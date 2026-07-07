
CREATE POLICY "hrms authenticated read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'hrms-files');
CREATE POLICY "hrms authenticated upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'hrms-files' AND owner = auth.uid());
CREATE POLICY "hrms owner or manager update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'hrms-files' AND (owner = auth.uid() OR public.can_manage(auth.uid())));
CREATE POLICY "hrms owner or manager delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'hrms-files' AND (owner = auth.uid() OR public.can_manage(auth.uid())));
