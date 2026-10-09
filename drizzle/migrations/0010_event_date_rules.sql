CREATE OR REPLACE FUNCTION public.validate_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE clash text; regs int;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.starts_at < now() THEN
    RAISE EXCEPTION 'Event date & time cannot be in the past' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.starts_at IS DISTINCT FROM OLD.starts_at AND NEW.starts_at < now() AND OLD.starts_at >= now() THEN
    RAISE EXCEPTION 'Event date & time cannot be moved into the past' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'INSERT' OR NEW.starts_at IS DISTINCT FROM OLD.starts_at THEN
    SELECT title INTO clash FROM public.events
    WHERE id <> NEW.id AND (starts_at AT TIME ZONE 'Asia/Kolkata')::date = (NEW.starts_at AT TIME ZONE 'Asia/Kolkata')::date
    LIMIT 1;
    IF clash IS NOT NULL THEN
      RAISE EXCEPTION 'Another event ("%") is already scheduled on this date. Pick a different date.', clash USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.capacity < OLD.capacity THEN
    SELECT count(*) INTO regs FROM public.participants WHERE event_id = NEW.id;
    IF NEW.capacity < regs THEN
      RAISE EXCEPTION 'Capacity cannot be lower than the % students already registered', regs USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.validate_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS events_validate ON public.events;
CREATE TRIGGER events_validate BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.validate_event();

CREATE OR REPLACE FUNCTION public.register_participant(_event_id uuid, _full_name text, _email text, _phone text, _department text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _event public.events%ROWTYPE; _count integer; _code text; _staff boolean; _clash text;
BEGIN
  SELECT * INTO _event FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'Event not found'); END IF;
  _staff := auth.uid() IS NOT NULL AND (_event.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  IF NOT _event.is_open AND NOT _staff THEN RETURN json_build_object('ok', false, 'error', 'Registrations are closed for this event'); END IF;
  IF _event.starts_at <= now() AND NOT _staff THEN RETURN json_build_object('ok', false, 'error', 'This event has already started'); END IF;
  IF EXISTS (SELECT 1 FROM public.participants WHERE event_id = _event_id AND (lower(email) = lower(_email) OR (NOT _staff AND auth.uid() IS NOT NULL AND user_id = auth.uid()))) THEN
    RETURN json_build_object('ok', false, 'error', 'This email is already registered');
  END IF;
  SELECT e.title INTO _clash FROM public.participants p JOIN public.events e ON e.id = p.event_id
  WHERE e.id <> _event_id
    AND (e.starts_at AT TIME ZONE 'Asia/Kolkata')::date = (_event.starts_at AT TIME ZONE 'Asia/Kolkata')::date
    AND (lower(p.email) = lower(_email) OR (NOT _staff AND auth.uid() IS NOT NULL AND p.user_id = auth.uid()))
  LIMIT 1;
  IF _clash IS NOT NULL THEN
    RETURN json_build_object('ok', false, 'error', format('Already registered for "%s" on the same date — one event per day', _clash));
  END IF;
  SELECT count(*) INTO _count FROM public.participants WHERE event_id = _event_id;
  IF _count >= _event.capacity THEN RETURN json_build_object('ok', false, 'error', 'Event is full'); END IF;
  _code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  INSERT INTO public.participants (event_id, full_name, email, phone, department, code, user_id)
  VALUES (_event_id, _full_name, _email, _phone, _department, _code, CASE WHEN _staff THEN NULL ELSE auth.uid() END);
  RETURN json_build_object('ok', true, 'code', _code);
END; $function$;

CREATE OR REPLACE FUNCTION public.switch_registration(_participant_id uuid, _new_event_id uuid)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.participants; e public.events; n public.events; _count int; _code text; _clash text;
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
  SELECT ev.title INTO _clash FROM public.participants q JOIN public.events ev ON ev.id = q.event_id
  WHERE q.id <> p.id AND ev.id <> n.id
    AND (ev.starts_at AT TIME ZONE 'Asia/Kolkata')::date = (n.starts_at AT TIME ZONE 'Asia/Kolkata')::date
    AND (lower(q.email) = lower(p.email) OR (auth.uid() IS NOT NULL AND q.user_id = auth.uid()))
  LIMIT 1;
  IF _clash IS NOT NULL THEN
    RETURN json_build_object('ok',false,'error',format('You already have a pass for "%s" on that date — one event per day', _clash));
  END IF;
  SELECT count(*) INTO _count FROM public.participants WHERE event_id = n.id;
  IF _count >= n.capacity THEN RETURN json_build_object('ok',false,'error','That event is full'); END IF;
  _code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  UPDATE public.scan_logs SET participant_id = NULL WHERE participant_id = p.id;
  UPDATE public.participants SET event_id = n.id, code = _code, zone_id = NULL, checked_in_gate = NULL, created_at = now(), user_id = coalesce(user_id, auth.uid()) WHERE id = p.id;
  RETURN json_build_object('ok',true,'code',_code);
END $function$;