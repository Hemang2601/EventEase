CREATE TYPE public.app_role AS ENUM ('admin','organizer','student');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  wants_organizer boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own profile or admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

INSERT INTO public.profiles (id, email, full_name)
  SELECT id, email, coalesce(raw_user_meta_data->>'full_name', split_part(email,'@',1)) FROM auth.users
  ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT id, 'student' FROM auth.users ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT DISTINCT owner_id, 'organizer'::public.app_role FROM public.events
  WHERE owner_id IN (SELECT id FROM auth.users) ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT id, 'admin' FROM auth.users ORDER BY created_at LIMIT 1 ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, wants_organizer)
  VALUES (NEW.id, NEW.email, coalesce(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
          coalesce(NEW.raw_user_meta_data->>'account_type','') = 'organizer')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin'), (NEW.id, 'organizer') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.admin_set_role(_user_id uuid, _role public.app_role, _enabled boolean)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RETURN json_build_object('ok',false,'error','Admins only'); END IF;
  IF _role = 'student' THEN RETURN json_build_object('ok',false,'error','Student role is permanent'); END IF;
  IF NOT _enabled AND _role = 'admin' AND _user_id = auth.uid() THEN
    RETURN json_build_object('ok',false,'error','You cannot remove your own admin role');
  END IF;
  IF _enabled THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role) ON CONFLICT DO NOTHING;
    IF _role = 'organizer' THEN UPDATE public.profiles SET wants_organizer = false WHERE id = _user_id; END IF;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  END IF;
  RETURN json_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_dismiss_request(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE public.profiles SET wants_organizer = false WHERE id = _user_id;
END $$;

-- events: only organizers/admins create; admins manage all
DROP POLICY IF EXISTS "Owners insert events" ON public.events;
DROP POLICY IF EXISTS "Owners update events" ON public.events;
DROP POLICY IF EXISTS "Owners delete events" ON public.events;
CREATE POLICY "Organizers insert events" ON public.events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id AND (public.has_role(auth.uid(),'organizer') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "Owners or admin update events" ON public.events FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owners or admin delete events" ON public.events FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));

ALTER TABLE public.events ADD COLUMN checkin_opens_minutes integer NOT NULL DEFAULT 60;

CREATE POLICY "Admins view participants" ON public.participants FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update participants" ON public.participants FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete participants" ON public.participants FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins view scan logs" ON public.scan_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.participants ADD COLUMN user_id uuid;
CREATE POLICY "Students view own registrations" ON public.participants FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.register_participant(_event_id uuid, _full_name text, _email text, _phone text, _department text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _event public.events%ROWTYPE; _count integer; _code text;
BEGIN
  SELECT * INTO _event FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'Event not found'); END IF;
  IF NOT _event.is_open THEN RETURN json_build_object('ok', false, 'error', 'Registrations are closed for this event'); END IF;
  IF _event.starts_at <= now() THEN RETURN json_build_object('ok', false, 'error', 'This event has already started'); END IF;
  IF EXISTS (SELECT 1 FROM public.participants WHERE event_id = _event_id AND (lower(email) = lower(_email) OR (auth.uid() IS NOT NULL AND user_id = auth.uid()))) THEN
    RETURN json_build_object('ok', false, 'error', 'This email is already registered');
  END IF;
  SELECT count(*) INTO _count FROM public.participants WHERE event_id = _event_id;
  IF _count >= _event.capacity THEN RETURN json_build_object('ok', false, 'error', 'Event is full'); END IF;
  _code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  INSERT INTO public.participants (event_id, full_name, email, phone, department, code, user_id)
  VALUES (_event_id, _full_name, _email, _phone, _department, _code, auth.uid());
  RETURN json_build_object('ok', true, 'code', _code);
END; $function$;

CREATE OR REPLACE FUNCTION public.owns_pass(_p public.participants)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (_p.user_id = auth.uid() OR lower(_p.email) = lower(coalesce(auth.jwt()->>'email','')))
$$;

CREATE OR REPLACE FUNCTION public.cancel_registration(_participant_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.participants; e public.events;
BEGIN
  SELECT * INTO p FROM public.participants WHERE id = _participant_id FOR UPDATE;
  IF NOT FOUND OR NOT public.owns_pass(p) THEN RETURN json_build_object('ok',false,'error','Pass not found'); END IF;
  SELECT * INTO e FROM public.events WHERE id = p.event_id;
  IF p.checked_in_at IS NOT NULL THEN RETURN json_build_object('ok',false,'error','Already checked in'); END IF;
  IF e.starts_at <= now() THEN RETURN json_build_object('ok',false,'error','Event has started — changes are locked'); END IF;
  UPDATE public.scan_logs SET participant_id = NULL WHERE participant_id = p.id;
  DELETE FROM public.participants WHERE id = p.id;
  RETURN json_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.switch_registration(_participant_id uuid, _new_event_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.participants; e public.events; n public.events; _count int; _code text;
BEGIN
  SELECT * INTO p FROM public.participants WHERE id = _participant_id FOR UPDATE;
  IF NOT FOUND OR NOT public.owns_pass(p) THEN RETURN json_build_object('ok',false,'error','Pass not found'); END IF;
  IF p.event_id = _new_event_id THEN RETURN json_build_object('ok',false,'error','Pick a different event'); END IF;
  SELECT * INTO e FROM public.events WHERE id = p.event_id;
  IF p.checked_in_at IS NOT NULL THEN RETURN json_build_object('ok',false,'error','Already checked in'); END IF;
  IF e.starts_at <= now() THEN RETURN json_build_object('ok',false,'error','Event has started — changes are locked'); END IF;
  SELECT * INTO n FROM public.events WHERE id = _new_event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('ok',false,'error','Event not found'); END IF;
  IF NOT n.is_open THEN RETURN json_build_object('ok',false,'error','Registrations are closed for that event'); END IF;
  IF n.starts_at <= now() THEN RETURN json_build_object('ok',false,'error','That event has already started'); END IF;
  IF EXISTS (SELECT 1 FROM public.participants WHERE event_id = n.id AND lower(email) = lower(p.email)) THEN
    RETURN json_build_object('ok',false,'error','You are already registered for that event');
  END IF;
  SELECT count(*) INTO _count FROM public.participants WHERE event_id = n.id;
  IF _count >= n.capacity THEN RETURN json_build_object('ok',false,'error','That event is full'); END IF;
  _code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  UPDATE public.scan_logs SET participant_id = NULL WHERE participant_id = p.id;
  UPDATE public.participants SET event_id = n.id, code = _code, created_at = now(), user_id = coalesce(user_id, auth.uid()) WHERE id = p.id;
  RETURN json_build_object('ok',true,'code',_code);
END $$;

CREATE OR REPLACE FUNCTION public.check_in_participant(_event_id uuid, _code text, _gate text DEFAULT 'Gate 01'::text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE p public.participants; ev public.events; c text := left(upper(trim(coalesce(_code,''))),64); g text := left(coalesce(nullif(trim(_gate),''),'Gate 01'), 40); opens timestamptz;
BEGIN
  SELECT * INTO ev FROM public.events WHERE id = _event_id;
  IF NOT FOUND OR NOT (ev.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')) THEN
    RETURN json_build_object('status', 'forbidden');
  END IF;
  opens := ev.starts_at - make_interval(mins => ev.checkin_opens_minutes);
  IF now() < opens THEN
    INSERT INTO public.scan_logs (event_id, code, result, gate, scanned_by) VALUES (_event_id, c, 'too_early', g, auth.uid());
    RETURN json_build_object('status', 'too_early', 'code', c, 'opens_at', opens);
  END IF;
  SELECT * INTO p FROM public.participants WHERE event_id = _event_id AND code = c FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.scan_logs (event_id, code, result, gate, scanned_by) VALUES (_event_id, c, 'invalid', g, auth.uid());
    RETURN json_build_object('status', 'invalid', 'code', c);
  END IF;
  IF p.checked_in_at IS NOT NULL THEN
    INSERT INTO public.scan_logs (event_id, participant_id, code, result, gate, participant_name, scanned_by) VALUES (_event_id, p.id, c, 'duplicate', g, p.full_name, auth.uid());
    RETURN json_build_object('status', 'duplicate', 'full_name', p.full_name, 'code', p.code, 'checked_in_at', p.checked_in_at, 'gate', p.checked_in_gate);
  END IF;
  UPDATE public.participants SET checked_in_at = now(), checked_in_gate = g WHERE id = p.id RETURNING * INTO p;
  INSERT INTO public.scan_logs (event_id, participant_id, code, result, gate, participant_name, scanned_by) VALUES (_event_id, p.id, c, 'success', g, p.full_name, auth.uid());
  RETURN json_build_object('status', 'success', 'full_name', p.full_name, 'code', p.code, 'checked_in_at', p.checked_in_at, 'gate', g);
END $function$;

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  email text NOT NULL,
  full_name text,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 150),
  message text NOT NULL CHECK (char_length(message) BETWEEN 5 AND 3000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','closed')),
  reply text CHECK (reply IS NULL OR char_length(reply) <= 3000),
  replied_by uuid,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students create own tickets" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'open' AND reply IS NULL);
CREATE POLICY "View own or managed tickets" ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')
    OR (public.has_role(auth.uid(),'organizer') AND (event_id IS NULL OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid()))));
CREATE POLICY "Staff reply to tickets" ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')
    OR (public.has_role(auth.uid(),'organizer') AND (event_id IS NULL OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid()))));