CREATE TABLE public.event_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, name)
);
CREATE TABLE public.zone_staff (
  zone_id uuid NOT NULL REFERENCES public.event_zones(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (zone_id, user_id)
);
ALTER TABLE public.participants ADD COLUMN zone_id uuid REFERENCES public.event_zones(id) ON DELETE SET NULL;
CREATE INDEX ON public.participants(zone_id);
CREATE INDEX ON public.zone_staff(user_id);

GRANT SELECT ON public.event_zones TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_zones TO authenticated;
GRANT ALL ON public.event_zones TO service_role;
GRANT SELECT, INSERT, DELETE ON public.zone_staff TO authenticated;
GRANT ALL ON public.zone_staff TO service_role;

CREATE OR REPLACE FUNCTION public.can_manage_event(_event_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND owner_id = auth.uid()))
$$;
CREATE OR REPLACE FUNCTION public.is_event_staff(_event_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.zone_staff s JOIN public.event_zones z ON z.id = s.zone_id WHERE z.event_id = _event_id AND s.user_id = auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.is_zone_staff(_zone_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.zone_staff WHERE zone_id = _zone_id AND user_id = auth.uid())
$$;

ALTER TABLE public.event_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zone_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view zones" ON public.event_zones FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Managers insert zones" ON public.event_zones FOR INSERT TO authenticated WITH CHECK (public.can_manage_event(event_id));
CREATE POLICY "Managers update zones" ON public.event_zones FOR UPDATE TO authenticated USING (public.can_manage_event(event_id));
CREATE POLICY "Managers delete zones" ON public.event_zones FOR DELETE TO authenticated USING (public.can_manage_event(event_id));
CREATE POLICY "View own or managed staff rows" ON public.zone_staff FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_event((SELECT event_id FROM public.event_zones WHERE id = zone_id)));
CREATE POLICY "Managers assign staff" ON public.zone_staff FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_event((SELECT event_id FROM public.event_zones WHERE id = zone_id))
    AND (public.has_role(user_id,'organizer') OR public.has_role(user_id,'admin')));
CREATE POLICY "Managers remove staff" ON public.zone_staff FOR DELETE TO authenticated
  USING (public.can_manage_event((SELECT event_id FROM public.event_zones WHERE id = zone_id)));

CREATE POLICY "Zone staff view their participants" ON public.participants FOR SELECT TO authenticated
  USING (zone_id IS NOT NULL AND public.is_zone_staff(zone_id));
CREATE POLICY "Zone staff view event scan logs" ON public.scan_logs FOR SELECT TO authenticated
  USING (public.is_event_staff(event_id));

-- Staff candidates (organizers/admins) for assignment
CREATE OR REPLACE FUNCTION public.list_staff_candidates() RETURNS TABLE(id uuid, full_name text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.email FROM public.profiles p
  WHERE (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'organizer'))
    AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role IN ('organizer','admin'))
  ORDER BY p.full_name
$$;

-- Per-zone overview with staff & counts
CREATE OR REPLACE FUNCTION public.zone_overview(_event_id uuid) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.name), '[]'::json) FROM (
    SELECT z.id, z.name, z.capacity,
      (SELECT count(*) FROM public.participants p WHERE p.zone_id = z.id) AS registered,
      (SELECT count(*) FROM public.participants p WHERE p.zone_id = z.id AND p.checked_in_at IS NOT NULL) AS checked_in,
      (SELECT count(*) FROM public.scan_logs l WHERE l.event_id = z.event_id AND l.gate = z.name AND l.result <> 'success') AS rejected,
      coalesce((SELECT json_agg(json_build_object('user_id', s.user_id, 'full_name', pr.full_name, 'email', pr.email,
          'scans', (SELECT count(*) FROM public.scan_logs l WHERE l.event_id = z.event_id AND l.scanned_by = s.user_id AND l.result = 'success')))
        FROM public.zone_staff s LEFT JOIN public.profiles pr ON pr.id = s.user_id WHERE s.zone_id = z.id), '[]'::json) AS staff,
      public.is_zone_staff(z.id) AS mine
    FROM public.event_zones z
    WHERE z.event_id = _event_id AND (public.can_manage_event(_event_id) OR public.is_zone_staff(z.id))
  ) t
$$;

-- Auto-assign new registrations to the least-filled zone
CREATE OR REPLACE FUNCTION public.assign_participant_zone() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.zone_id IS NULL THEN
    SELECT z.id INTO NEW.zone_id FROM public.event_zones z
    WHERE z.event_id = NEW.event_id
      AND (z.capacity IS NULL OR (SELECT count(*) FROM public.participants p WHERE p.zone_id = z.id) < z.capacity)
    ORDER BY (SELECT count(*) FROM public.participants p WHERE p.zone_id = z.id), z.name LIMIT 1;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER participants_assign_zone BEFORE INSERT ON public.participants FOR EACH ROW EXECUTE FUNCTION public.assign_participant_zone();

CREATE OR REPLACE FUNCTION public.set_participant_zone(_participant_id uuid, _zone_id uuid) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.participants;
BEGIN
  SELECT * INTO p FROM public.participants WHERE id = _participant_id;
  IF NOT FOUND OR NOT public.can_manage_event(p.event_id) THEN RETURN json_build_object('ok',false,'error','Not allowed'); END IF;
  IF _zone_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.event_zones WHERE id = _zone_id AND event_id = p.event_id) THEN
    RETURN json_build_object('ok',false,'error','Zone not in this event'); END IF;
  UPDATE public.participants SET zone_id = _zone_id WHERE id = p.id;
  RETURN json_build_object('ok',true);
END $$;

-- Zone-aware check-in
CREATE OR REPLACE FUNCTION public.check_in_participant(_event_id uuid, _code text, _gate text DEFAULT 'Gate 01'::text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE p public.participants; ev public.events; c text := left(upper(trim(coalesce(_code,''))),64);
  g text := left(coalesce(nullif(trim(_gate),''),'Gate 01'), 40); opens timestamptz; manager boolean; zname text;
BEGIN
  SELECT * INTO ev FROM public.events WHERE id = _event_id;
  IF NOT FOUND THEN RETURN json_build_object('status','forbidden'); END IF;
  manager := ev.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin');
  IF NOT manager AND NOT public.is_event_staff(_event_id) THEN RETURN json_build_object('status','forbidden'); END IF;
  opens := ev.starts_at - make_interval(mins => ev.checkin_opens_minutes);
  IF now() < opens THEN
    INSERT INTO public.scan_logs (event_id, code, result, gate, scanned_by) VALUES (_event_id, c, 'too_early', g, auth.uid());
    RETURN json_build_object('status','too_early','code',c,'opens_at',opens);
  END IF;
  SELECT * INTO p FROM public.participants WHERE event_id = _event_id AND code = c FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.scan_logs (event_id, code, result, gate, scanned_by) VALUES (_event_id, c, 'invalid', g, auth.uid());
    RETURN json_build_object('status','invalid','code',c);
  END IF;
  SELECT name INTO zname FROM public.event_zones WHERE id = p.zone_id;
  IF zname IS NOT NULL THEN g := zname; END IF;
  IF NOT manager AND (p.zone_id IS NULL OR NOT public.is_zone_staff(p.zone_id)) THEN
    INSERT INTO public.scan_logs (event_id, participant_id, code, result, gate, participant_name, scanned_by) VALUES (_event_id, p.id, c, 'wrong_zone', g, p.full_name, auth.uid());
    RETURN json_build_object('status','wrong_zone','full_name',p.full_name,'code',p.code,'zone',coalesce(zname,'Unassigned'));
  END IF;
  IF p.checked_in_at IS NOT NULL THEN
    INSERT INTO public.scan_logs (event_id, participant_id, code, result, gate, participant_name, scanned_by) VALUES (_event_id, p.id, c, 'duplicate', g, p.full_name, auth.uid());
    RETURN json_build_object('status','duplicate','full_name',p.full_name,'code',p.code,'checked_in_at',p.checked_in_at,'gate',p.checked_in_gate);
  END IF;
  UPDATE public.participants SET checked_in_at = now(), checked_in_gate = g WHERE id = p.id RETURNING * INTO p;
  INSERT INTO public.scan_logs (event_id, participant_id, code, result, gate, participant_name, scanned_by) VALUES (_event_id, p.id, c, 'success', g, p.full_name, auth.uid());
  RETURN json_build_object('status','success','full_name',p.full_name,'code',p.code,'checked_in_at',p.checked_in_at,'gate',g);
END $function$;

-- Ticket shows zone
CREATE OR REPLACE FUNCTION public.get_ticket(_code text) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT json_build_object('code', p.code, 'full_name', p.full_name, 'checked_in_at', p.checked_in_at,
    'event_id', e.id, 'event_title', e.title, 'venue', e.venue, 'starts_at', e.starts_at, 'category', e.category,
    'zone', (SELECT name FROM public.event_zones WHERE id = p.zone_id))
  FROM public.participants p JOIN public.events e ON e.id = p.event_id
  WHERE p.code = upper(trim(_code)) LIMIT 1
$function$;