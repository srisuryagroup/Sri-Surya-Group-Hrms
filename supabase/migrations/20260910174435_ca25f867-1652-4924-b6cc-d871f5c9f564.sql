-- ===== helpers =====
CREATE OR REPLACE FUNCTION public.user_id_for_email(_email text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.my_freelancer_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id FROM public.freelancers WHERE lower(email) = lower(public.current_user_email()) LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.my_employee_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id FROM public.employees WHERE lower(email) = lower(public.current_user_email()) LIMIT 1 $$;

-- ===== work updates =====
CREATE TABLE public.work_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_id uuid REFERENCES public.freelancers(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  title text NOT NULL,
  details text,
  hours_spent numeric,
  work_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'submitted',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_updates TO authenticated;
GRANT ALL ON public.work_updates TO service_role;
ALTER TABLE public.work_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_updates mgr all" ON public.work_updates FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "work_updates own read" ON public.work_updates FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR freelancer_id = public.my_freelancer_id() OR employee_id = public.my_employee_id());
CREATE POLICY "work_updates own insert" ON public.work_updates FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "work_updates own update" ON public.work_updates FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE TRIGGER trg_work_updates_updated BEFORE UPDATE ON public.work_updates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_work_updates_freelancer ON public.work_updates(freelancer_id);
CREATE INDEX idx_work_updates_project ON public.work_updates(project_id);

-- ===== commissions: project value + auto calc =====
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS project_value numeric;

CREATE OR REPLACE FUNCTION public.calc_commission_amount()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE base numeric;
BEGIN
  IF NEW.fixed_amount IS NOT NULL THEN
    NEW.amount := NEW.fixed_amount;
  ELSIF NEW.percentage IS NOT NULL THEN
    base := NEW.project_value;
    IF base IS NULL AND NEW.project_id IS NOT NULL THEN
      SELECT budget INTO base FROM public.projects WHERE id = NEW.project_id;
    END IF;
    IF base IS NOT NULL THEN
      NEW.amount := round(base * NEW.percentage / 100.0, 2);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_calc_commission BEFORE INSERT OR UPDATE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.calc_commission_amount();

-- ===== self-service profile permissions =====
CREATE POLICY "employees update own row" ON public.employees FOR UPDATE TO authenticated
  USING (lower(email) = lower(public.current_user_email()))
  WITH CHECK (lower(email) = lower(public.current_user_email()));

CREATE POLICY "freelancers update own row" ON public.freelancers FOR UPDATE TO authenticated
  USING (lower(email) = lower(public.current_user_email()))
  WITH CHECK (lower(email) = lower(public.current_user_email()));

CREATE POLICY "assignee update own task" ON public.tasks FOR UPDATE TO authenticated
  USING (
    (assignee_type = 'employee' AND assignee_id = public.my_employee_id())
    OR (assignee_type = 'freelancer' AND assignee_id = public.my_freelancer_id())
  )
  WITH CHECK (
    (assignee_type = 'employee' AND assignee_id = public.my_employee_id())
    OR (assignee_type = 'freelancer' AND assignee_id = public.my_freelancer_id())
  );

-- ===== notification triggers =====
CREATE OR REPLACE FUNCTION public.notify_project_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE em text; uid uuid; pname text; who text;
BEGIN
  IF NEW.assignee_type = 'employee' THEN
    SELECT email, full_name INTO em, who FROM public.employees WHERE id = NEW.assignee_id;
  ELSE
    SELECT email, full_name INTO em, who FROM public.freelancers WHERE id = NEW.assignee_id;
  END IF;
  SELECT name INTO pname FROM public.projects WHERE id = NEW.project_id;
  uid := public.user_id_for_email(em);
  INSERT INTO public.notifications (user_id, title, message, category)
  VALUES (uid, 'Project assigned',
    COALESCE(who, 'A team member') || ' was assigned to project ' || COALESCE(pname, 'Untitled'), 'project');
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_project_assignment AFTER INSERT ON public.project_assignments
  FOR EACH ROW EXECUTE FUNCTION public.notify_project_assignment();

CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE em text; uid uuid;
BEGIN
  IF NEW.assignee_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.assignee_id IS NOT DISTINCT FROM OLD.assignee_id THEN RETURN NEW; END IF;
  IF NEW.assignee_type = 'employee' THEN
    SELECT email INTO em FROM public.employees WHERE id = NEW.assignee_id;
  ELSE
    SELECT email INTO em FROM public.freelancers WHERE id = NEW.assignee_id;
  END IF;
  uid := public.user_id_for_email(em);
  INSERT INTO public.notifications (user_id, title, message, category)
  VALUES (uid, 'Task assigned', 'You have been assigned the task: ' || NEW.name, 'task');
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_task_assignment AFTER INSERT OR UPDATE OF assignee_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignment();

CREATE OR REPLACE FUNCTION public.notify_leave_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE em text; uid uuid;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('approved', 'rejected') THEN RETURN NEW; END IF;
  SELECT email INTO em FROM public.employees WHERE id = NEW.employee_id;
  uid := public.user_id_for_email(em);
  INSERT INTO public.notifications (user_id, title, message, category)
  VALUES (uid,
    CASE WHEN NEW.status = 'approved' THEN 'Leave approved' ELSE 'Leave rejected' END,
    'Your ' || NEW.leave_type || ' leave from ' || NEW.start_date || ' to ' || NEW.end_date || ' was ' || NEW.status || '.',
    'leave');
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_leave_decision AFTER UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_leave_decision();

CREATE OR REPLACE FUNCTION public.notify_commission_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE em text; uid uuid;
BEGIN
  IF NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status OR NEW.payment_status <> 'paid' THEN
    RETURN NEW;
  END IF;
  IF NEW.recipient_id IS NOT NULL THEN
    SELECT email INTO em FROM public.freelancers WHERE id = NEW.recipient_id;
    IF em IS NULL THEN SELECT email INTO em FROM public.employees WHERE id = NEW.recipient_id; END IF;
  END IF;
  IF em IS NULL THEN
    SELECT email INTO em FROM public.freelancers WHERE lower(full_name) = lower(NEW.recipient_name);
  END IF;
  IF em IS NULL THEN
    SELECT email INTO em FROM public.employees WHERE lower(full_name) = lower(NEW.recipient_name);
  END IF;
  uid := public.user_id_for_email(em);
  INSERT INTO public.notifications (user_id, title, message, category)
  VALUES (uid, 'Commission paid',
    'A commission of ' || COALESCE(NEW.amount, 0)::text || ' was marked paid for ' || NEW.recipient_name || '.',
    'commission');
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_commission_paid AFTER UPDATE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_commission_paid();

CREATE OR REPLACE FUNCTION public.notify_payroll_generated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE em text; uid uuid;
BEGIN
  SELECT email INTO em FROM public.employees WHERE id = NEW.employee_id;
  uid := public.user_id_for_email(em);
  INSERT INTO public.notifications (user_id, title, message, category)
  VALUES (uid, 'Payslip generated',
    'Your payslip for ' || NEW.month || '/' || NEW.year || ' is available. Net pay: ' || NEW.net_salary::text,
    'payroll');
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_payroll AFTER INSERT ON public.payroll
  FOR EACH ROW EXECUTE FUNCTION public.notify_payroll_generated();