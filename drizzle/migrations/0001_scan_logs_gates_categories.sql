ALTER TABLE public.events ADD COLUMN category text NOT NULL DEFAULT 'Technology';
ALTER TABLE public.participants ADD COLUMN checked_in_gate text;

CREATE TABLE public.scan_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.participants(id) ON DELETE SET NULL,
  code text NOT NULL,
  result text NOT NULL,
  gate text,
  participant_name text,
  scanned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scan_logs_event_idx ON public.scan_logs (event_id, created_at DESC);
GRANT SELECT ON public.scan_logs TO authenticated;
GRANT ALL ON public.scan_logs TO service_role;
ALTER TABLE public.scan_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view scan logs" ON public.scan_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid()));

DROP FUNCTION IF EXISTS public.check_in_participant(uuid, text);
CREATE OR REPLACE FUNCTION public.check_in_participant(_event_id uuid, _code text, _gate text DEFAULT 'Gate 01')
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.participants; c text := upper(trim(coalesce(_code,''))); g text := left(coalesce(nullif(trim(_gate),''),'Gate 01'), 40);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND owner_id = auth.uid()) THEN
    RETURN json_build_object('status', 'forbidden');
  END IF;
  c := left(c, 64);
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
END $$;
REVOKE EXECUTE ON FUNCTION public.check_in_participant(uuid, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.check_in_participant(uuid, text, text) TO authenticated;

-- Public ticket status lookup (code is the secret)
CREATE OR REPLACE FUNCTION public.get_ticket(_code text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object('code', p.code, 'full_name', p.full_name, 'checked_in_at', p.checked_in_at,
    'event_id', e.id, 'event_title', e.title, 'venue', e.venue, 'starts_at', e.starts_at, 'category', e.category)
  FROM public.participants p JOIN public.events e ON e.id = p.event_id
  WHERE p.code = upper(trim(_code)) LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_ticket(text) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_logs;