
-- Project assignments (employees + freelancers)
CREATE TABLE IF NOT EXISTS public.project_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  assignee_type text NOT NULL CHECK (assignee_type IN ('employee','freelancer')),
  assignee_id uuid NOT NULL,
  role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, assignee_type, assignee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_assignments TO authenticated;
GRANT ALL ON public.project_assignments TO service_role;
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read project_assignments" ON public.project_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "managers manage project_assignments" ON public.project_assignments FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_project_assignments_project ON public.project_assignments(project_id);

-- Task comments
CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read task_comments" ON public.task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert own comments" ON public.task_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "author update own comments" ON public.task_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "author or manager delete" ON public.task_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.can_manage(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id);

-- Task attachments (multiple files)
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_attachments TO service_role;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read attachments" ON public.task_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert attachments" ON public.task_attachments FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "uploader or manager delete" ON public.task_attachments FOR DELETE TO authenticated
  USING (auth.uid() = uploaded_by OR public.can_manage(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON public.task_attachments(task_id);

-- Storage policies for hrms-files bucket, task-attachments/ prefix
CREATE POLICY "auth read task files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'hrms-files' AND (storage.foldername(name))[1] = 'task-attachments');
CREATE POLICY "auth upload task files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hrms-files' AND (storage.foldername(name))[1] = 'task-attachments');
CREATE POLICY "auth delete own task files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'hrms-files' AND (storage.foldername(name))[1] = 'task-attachments' AND owner = auth.uid());
