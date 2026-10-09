CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  venue text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  capacity integer NOT NULL CHECK (capacity > 0 AND capacity <= 100000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view events" ON public.events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owners insert events" ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update events" ON public.events FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete events" ON public.events FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  department text,
  code text NOT NULL UNIQUE,
  checked_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX participants_event_email_uidx ON public.participants (event_id, lower(email));
CREATE INDEX participants_event_idx ON public.participants (event_id);
GRANT SELECT, UPDATE, DELETE ON public.participants TO authenticated;
GRANT ALL ON public.participants TO service_role;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view participants" ON public.participants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid()));
CREATE POLICY "Owners update participants" ON public.participants FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid()));
CREATE POLICY "Owners delete participants" ON public.participants FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid()));

-- Public counts
CREATE OR REPLACE FUNCTION public.event_stats(_event_id uuid)
RETURNS TABLE(registered bigint, checked_in bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*), count(checked_in_at) FROM public.participants WHERE event_id = _event_id
$$;
GRANT EXECUTE ON FUNCTION public.event_stats(uuid) TO anon, authenticated;

-- Registration with capacity + duplicate checks, atomic
CREATE OR REPLACE FUNCTION public.register_participant(_event_id uuid, _full_name text, _email text, _phone text, _department text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev public.events;
  cnt int;
  new_code text;
  p public.participants;
BEGIN
  IF length(trim(coalesce(_full_name,''))) < 2 OR length(_full_name) > 100 THEN
    RETURN json_build_object('ok', false, 'error', 'Please enter a valid name');
  END IF;
  IF coalesce(_email,'') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(_email) > 255 THEN
    RETURN json_build_object('ok', false, 'error', 'Please enter a valid email');
  END IF;
  SELECT * INTO ev FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'Event not found'); END IF;
  IF EXISTS (SELECT 1 FROM public.participants WHERE event_id = _event_id AND lower(email) = lower(trim(_email))) THEN
    RETURN json_build_object('ok', false, 'error', 'This email is already registered for this event');
  END IF;
  SELECT count(*) INTO cnt FROM public.participants WHERE event_id = _event_id;
  IF cnt >= ev.capacity THEN RETURN json_build_object('ok', false, 'error', 'Event is full — capacity reached'); END IF;
  LOOP
    new_code := 'EE-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)) || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.participants WHERE code = new_code);
  END LOOP;
  INSERT INTO public.participants (event_id, full_name, email, phone, department, code)
  VALUES (_event_id, trim(_full_name), lower(trim(_email)), nullif(trim(coalesce(_phone,'')),''), nullif(trim(coalesce(_department,'')),''), new_code)
  RETURNING * INTO p;
  RETURN json_build_object('ok', true, 'id', p.id, 'code', p.code, 'full_name', p.full_name, 'email', p.email, 'event_title', ev.title);
END $$;
GRANT EXECUTE ON FUNCTION public.register_participant(uuid, text, text, text, text) TO anon, authenticated;

-- Check-in: owner only, atomic, rejects duplicates
CREATE OR REPLACE FUNCTION public.check_in_participant(_event_id uuid, _code text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.participants;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND owner_id = auth.uid()) THEN
    RETURN json_build_object('status', 'forbidden');
  END IF;
  SELECT * INTO p FROM public.participants WHERE event_id = _event_id AND code = upper(trim(_code)) FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('status', 'invalid'); END IF;
  IF p.checked_in_at IS NOT NULL THEN
    RETURN json_build_object('status', 'duplicate', 'full_name', p.full_name, 'code', p.code, 'checked_in_at', p.checked_in_at);
  END IF;
  UPDATE public.participants SET checked_in_at = now() WHERE id = p.id RETURNING * INTO p;
  RETURN json_build_object('status', 'success', 'full_name', p.full_name, 'code', p.code, 'checked_in_at', p.checked_in_at, 'email', p.email);
END $$;
REVOKE EXECUTE ON FUNCTION public.check_in_participant(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.check_in_participant(uuid, text) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;