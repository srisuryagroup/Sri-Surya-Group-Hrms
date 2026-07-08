
CREATE OR REPLACE FUNCTION public.current_user_email() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT email FROM auth.users WHERE id = auth.uid() $$;

-- ATTENDANCE
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','late','half_day','work_from_home','on_leave')),
  hours_worked NUMERIC(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);
CREATE INDEX idx_attendance_employee_date ON public.attendance(employee_id, date DESC);
CREATE INDEX idx_attendance_date ON public.attendance(date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "att_mgr_all" ON public.attendance FOR ALL TO authenticated
USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

CREATE POLICY "att_self_read" ON public.attendance FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = attendance.employee_id AND e.email = public.current_user_email()));

CREATE POLICY "att_self_write" ON public.attendance FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = attendance.employee_id AND e.email = public.current_user_email()));

CREATE POLICY "att_self_update" ON public.attendance FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = attendance.employee_id AND e.email = public.current_user_email()));

CREATE TRIGGER trg_attendance_updated_at BEFORE UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- LEAVE REQUESTS
CREATE TABLE public.leave_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('casual','sick','earned','unpaid','maternity','other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days NUMERIC(4,1) NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leave_employee ON public.leave_requests(employee_id, created_at DESC);
CREATE INDEX idx_leave_status ON public.leave_requests(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_mgr_all" ON public.leave_requests FOR ALL TO authenticated
USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

CREATE POLICY "leave_self_read" ON public.leave_requests FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = leave_requests.employee_id AND e.email = public.current_user_email()));

CREATE POLICY "leave_self_insert" ON public.leave_requests FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = leave_requests.employee_id AND e.email = public.current_user_email()));

CREATE POLICY "leave_self_update" ON public.leave_requests FOR UPDATE TO authenticated
USING (status = 'pending' AND EXISTS (SELECT 1 FROM public.employees e WHERE e.id = leave_requests.employee_id AND e.email = public.current_user_email()));

CREATE TRIGGER trg_leave_updated_at BEFORE UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PAYROLL
CREATE TABLE public.payroll (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year SMALLINT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  basic_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowances NUMERIC(12,2) NOT NULL DEFAULT 0,
  bonus NUMERIC(12,2) NOT NULL DEFAULT 0,
  pf NUMERIC(12,2) NOT NULL DEFAULT 0,
  esi NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','processing','paid','failed')),
  paid_on DATE,
  payslip_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, month, year)
);
CREATE INDEX idx_payroll_employee ON public.payroll(employee_id, year DESC, month DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll TO authenticated;
GRANT ALL ON public.payroll TO service_role;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pay_mgr_all" ON public.payroll FOR ALL TO authenticated
USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

CREATE POLICY "pay_self_read" ON public.payroll FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = payroll.employee_id AND e.email = public.current_user_email()));

CREATE TRIGGER trg_payroll_updated_at BEFORE UPDATE ON public.payroll
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ACTIVITY LOGS
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_created ON public.activity_logs(created_at DESC);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "log_mgr_read" ON public.activity_logs FOR SELECT TO authenticated
USING (public.can_manage(auth.uid()));

CREATE POLICY "log_self_write" ON public.activity_logs FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);
