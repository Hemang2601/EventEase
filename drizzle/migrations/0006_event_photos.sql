ALTER TABLE public.events ADD COLUMN cover_url text, ADD COLUMN host_photo_url text, ADD COLUMN host_name text;
INSERT INTO storage.buckets (id, name, public) VALUES ('event-images', 'event-images', true) ON CONFLICT (id) DO UPDATE SET public = true;
CREATE POLICY "Public read event images" ON storage.objects FOR SELECT USING (bucket_id = 'event-images');
CREATE POLICY "Staff upload event images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'event-images' AND (storage.foldername(name))[1] = auth.uid()::text
    AND (public.has_role(auth.uid(),'organizer') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "Staff delete own event images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'event-images' AND (storage.foldername(name))[1] = auth.uid()::text);