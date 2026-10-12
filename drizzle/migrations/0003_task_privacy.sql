CREATE OR REPLACE FUNCTION public.can_view_task(_task_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.can_manage(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = _task_id AND (
      (t.assignee_type = 'employee' AND t.assignee_id = public.my_employee_id()) OR
      (t.assignee_type = 'freelancer' AND t.assignee_id = public.my_freelancer_id())))
$$;

DROP POLICY IF EXISTS "Authenticated view tasks" ON public.tasks;
CREATE POLICY "Managers or assignee view tasks" ON public.tasks FOR SELECT TO authenticated
USING (public.can_manage(auth.uid())
  OR (assignee_type = 'employee' AND assignee_id = public.my_employee_id())
  OR (assignee_type = 'freelancer' AND assignee_id = public.my_freelancer_id()));

DROP POLICY IF EXISTS "auth read task_comments" ON public.task_comments;
CREATE POLICY "view comments on visible tasks" ON public.task_comments FOR SELECT TO authenticated
USING (public.can_view_task(task_id));
DROP POLICY IF EXISTS "auth insert own comments" ON public.task_comments;
CREATE POLICY "comment on visible tasks" ON public.task_comments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.can_view_task(task_id));
DROP POLICY IF EXISTS "author update own comments" ON public.task_comments;
CREATE POLICY "author update own comments" ON public.task_comments FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND public.can_view_task(task_id))
WITH CHECK (auth.uid() = user_id AND public.can_view_task(task_id));

DROP POLICY IF EXISTS "auth read attachments" ON public.task_attachments;
CREATE POLICY "view attachments on visible tasks" ON public.task_attachments FOR SELECT TO authenticated
USING (public.can_view_task(task_id));
DROP POLICY IF EXISTS "auth insert attachments" ON public.task_attachments;
CREATE POLICY "attach to visible tasks" ON public.task_attachments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = uploaded_by AND public.can_view_task(task_id));

-- Task files: only readable/uploadable for tasks the user can see (path task-attachments/<task_id>/...)
DROP POLICY IF EXISTS "auth read task files" ON storage.objects;
CREATE POLICY "auth read task files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'hrms-files' AND (storage.foldername(name))[1] = 'task-attachments'
  AND public.can_view_task(((storage.foldername(name))[2])::uuid));
DROP POLICY IF EXISTS "auth upload task files" ON storage.objects;
CREATE POLICY "auth upload task files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'hrms-files' AND (storage.foldername(name))[1] = 'task-attachments'
  AND owner = auth.uid() AND public.can_view_task(((storage.foldername(name))[2])::uuid));
DROP POLICY IF EXISTS "hrms authenticated read" ON storage.objects;
CREATE POLICY "hrms authenticated read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'hrms-files' AND COALESCE((storage.foldername(name))[1], '') <> 'task-attachments');
DROP POLICY IF EXISTS "hrms authenticated upload" ON storage.objects;
CREATE POLICY "hrms authenticated upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'hrms-files' AND owner = auth.uid() AND COALESCE((storage.foldername(name))[1], '') <> 'task-attachments');