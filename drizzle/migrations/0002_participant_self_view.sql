CREATE POLICY "Participants view own passes" ON public.participants FOR SELECT TO authenticated
  USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));