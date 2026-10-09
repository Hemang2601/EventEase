CREATE OR REPLACE FUNCTION public.check_in_participant(_event_id uuid, _code text, _gate text DEFAULT 'Gate 01'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p public.participants; ev public.events; other record; c text := left(upper(trim(coalesce(_code,''))),64);
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
    SELECT p2.full_name, e2.title INTO other FROM public.participants p2 JOIN public.events e2 ON e2.id = p2.event_id WHERE p2.code = c AND p2.event_id <> _event_id LIMIT 1;
    IF FOUND THEN
      INSERT INTO public.scan_logs (event_id, code, result, gate, participant_name, scanned_by) VALUES (_event_id, c, 'wrong_event', g, other.full_name, auth.uid());
      RETURN json_build_object('status','wrong_event','full_name',other.full_name,'code',c,'event',other.title);
    END IF;
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