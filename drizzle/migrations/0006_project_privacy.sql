CREATE OR REPLACE FUNCTION public.can_view_project(_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_manage(auth.uid())
    OR EXISTS (SELECT 1 FROM public.project_assignments a WHERE a.project_id = _project_id AND (
         (a.assignee_type = 'employee' AND a.assignee_id = public.my_employee_id())
      OR (a.assignee_type = 'freelancer' AND a.assignee_id = public.my_freelancer_id())))
    OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.project_id = _project_id AND (
         (t.assignee_type = 'employee' AND t.assignee_id = public.my_employee_id())
      OR (t.assignee_type = 'freelancer' AND t.assignee_id = public.my_freelancer_id())))
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_project(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_view_project(uuid) TO authenticated;

DROP POLICY IF EXISTS "Authenticated view projects" ON public.projects;
CREATE POLICY "View authorized projects" ON public.projects FOR SELECT TO authenticated
  USING (public.can_view_project(id));

DROP POLICY IF EXISTS "auth read project_assignments" ON public.project_assignments;
CREATE POLICY "View assignments of visible projects" ON public.project_assignments FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));