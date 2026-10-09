CREATE OR REPLACE FUNCTION public.register_participant(_event_id uuid, _full_name text, _email text, _phone text, _department text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _event public.events%ROWTYPE; _count integer; _code text; _staff boolean;
BEGIN
  SELECT * INTO _event FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'Event not found'); END IF;
  _staff := auth.uid() IS NOT NULL AND (_event.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  IF NOT _event.is_open AND NOT _staff THEN RETURN json_build_object('ok', false, 'error', 'Registrations are closed for this event'); END IF;
  IF _event.starts_at <= now() AND NOT _staff THEN RETURN json_build_object('ok', false, 'error', 'This event has already started'); END IF;
  IF EXISTS (SELECT 1 FROM public.participants WHERE event_id = _event_id AND (lower(email) = lower(_email) OR (NOT _staff AND auth.uid() IS NOT NULL AND user_id = auth.uid()))) THEN
    RETURN json_build_object('ok', false, 'error', 'This email is already registered');
  END IF;
  SELECT count(*) INTO _count FROM public.participants WHERE event_id = _event_id;
  IF _count >= _event.capacity THEN RETURN json_build_object('ok', false, 'error', 'Event is full'); END IF;
  _code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  INSERT INTO public.participants (event_id, full_name, email, phone, department, code, user_id)
  VALUES (_event_id, _full_name, _email, _phone, _department, _code, CASE WHEN _staff THEN NULL ELSE auth.uid() END);
  RETURN json_build_object('ok', true, 'code', _code);
END; $function$;