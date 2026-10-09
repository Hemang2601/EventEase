ALTER TABLE public.events ADD COLUMN is_open boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.register_participant(_event_id uuid, _full_name text, _email text, _phone text, _department text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event public.events%ROWTYPE;
  _count integer;
  _code text;
BEGIN
  SELECT * INTO _event FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Event not found');
  END IF;
  IF NOT _event.is_open THEN
    RETURN json_build_object('ok', false, 'error', 'Registrations are closed for this event');
  END IF;
  IF EXISTS (SELECT 1 FROM public.participants WHERE event_id = _event_id AND lower(email) = lower(_email)) THEN
    RETURN json_build_object('ok', false, 'error', 'This email is already registered');
  END IF;
  SELECT count(*) INTO _count FROM public.participants WHERE event_id = _event_id;
  IF _count >= _event.capacity THEN
    RETURN json_build_object('ok', false, 'error', 'Event is full');
  END IF;
  _code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  INSERT INTO public.participants (event_id, full_name, email, phone, department, code)
  VALUES (_event_id, _full_name, _email, _phone, _department, _code);
  RETURN json_build_object('ok', true, 'code', _code);
END;
$$;