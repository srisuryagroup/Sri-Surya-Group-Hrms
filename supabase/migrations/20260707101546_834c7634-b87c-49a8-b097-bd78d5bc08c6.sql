
-- =========================================================================
-- ENUMS
-- =========================================================================
CREATE TYPE public.app_role AS ENUM ('super_admin', 'hr_manager', 'manager', 'employee', 'freelancer');
CREATE TYPE public.employment_type AS ENUM ('full_time', 'part_time', 'contract', 'intern');
CREATE TYPE public.gender_type AS ENUM ('male', 'female', 'other');
CREATE TYPE public.record_status AS ENUM ('active', 'inactive', 'on_leave', 'terminated');
CREATE TYPE public.availability_status AS ENUM ('available', 'busy', 'unavailable');
CREATE TYPE public.priority_level AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.project_status AS ENUM ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled');
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'on_hold');
CREATE TYPE public.commission_type AS ENUM ('employee', 'freelancer', 'referral');
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'cancelled');

-- =========================================================================
-- UPDATED_AT TRIGGER
-- =========================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================================
-- PROFILES
-- =========================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- USER ROLES
-- =========================================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- can_manage: super_admin or hr_manager
CREATE OR REPLACE FUNCTION public.can_manage(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('super_admin', 'hr_manager')
  );
$$;

-- Allow SELECT-all for admins on user_roles (still uses has_role which is SECURITY DEFINER, no recursion)
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- =========================================================================
-- HANDLE NEW USER: create profile, assign role
-- First signup gets super_admin; everyone else gets employee.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );

  SELECT count(*) INTO user_count FROM auth.users;
  IF user_count <= 1 THEN
    assigned_role := 'super_admin';
  ELSE
    assigned_role := 'employee';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- DEPARTMENTS
-- =========================================================================
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  head_name TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers insert departments" ON public.departments FOR INSERT TO authenticated WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "Managers update departments" ON public.departments FOR UPDATE TO authenticated USING (public.can_manage(auth.uid()));
CREATE POLICY "Managers delete departments" ON public.departments FOR DELETE TO authenticated USING (public.can_manage(auth.uid()));
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- EMPLOYEES
-- =========================================================================
CREATE SEQUENCE IF NOT EXISTS public.employee_seq START 1001;

CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT UNIQUE NOT NULL DEFAULT ('SSG-EMP-' || nextval('public.employee_seq')::TEXT),
  photo_url TEXT,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  mobile TEXT,
  gender public.gender_type,
  date_of_birth DATE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  designation TEXT,
  joining_date DATE,
  employment_type public.employment_type DEFAULT 'full_time',
  salary NUMERIC(12,2),
  aadhaar_number TEXT,
  pan_number TEXT,
  bank_name TEXT,
  account_number TEXT,
  ifsc_code TEXT,
  upi_id TEXT,
  address TEXT,
  emergency_contact TEXT,
  status public.record_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view employees" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers insert employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "Managers update employees" ON public.employees FOR UPDATE TO authenticated USING (public.can_manage(auth.uid()));
CREATE POLICY "Managers delete employees" ON public.employees FOR DELETE TO authenticated USING (public.can_manage(auth.uid()));
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- FREELANCERS
-- =========================================================================
CREATE SEQUENCE IF NOT EXISTS public.freelancer_seq START 2001;

CREATE TABLE public.freelancers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_code TEXT UNIQUE NOT NULL DEFAULT ('SSG-FRL-' || nextval('public.freelancer_seq')::TEXT),
  photo_url TEXT,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  mobile TEXT,
  skills TEXT[],
  experience_years NUMERIC(4,1),
  hourly_rate NUMERIC(10,2),
  upi_id TEXT,
  bank_name TEXT,
  account_number TEXT,
  ifsc_code TEXT,
  resume_url TEXT,
  portfolio_url TEXT,
  availability public.availability_status DEFAULT 'available',
  status public.record_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.freelancers TO authenticated;
GRANT ALL ON public.freelancers TO service_role;
ALTER TABLE public.freelancers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view freelancers" ON public.freelancers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers insert freelancers" ON public.freelancers FOR INSERT TO authenticated WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "Managers update freelancers" ON public.freelancers FOR UPDATE TO authenticated USING (public.can_manage(auth.uid()));
CREATE POLICY "Managers delete freelancers" ON public.freelancers FOR DELETE TO authenticated USING (public.can_manage(auth.uid()));
CREATE TRIGGER trg_freelancers_updated BEFORE UPDATE ON public.freelancers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- PROJECTS
-- =========================================================================
CREATE SEQUENCE IF NOT EXISTS public.project_seq START 3001;

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code TEXT UNIQUE NOT NULL DEFAULT ('SSG-PRJ-' || nextval('public.project_seq')::TEXT),
  name TEXT NOT NULL,
  client_name TEXT,
  description TEXT,
  budget NUMERIC(14,2),
  start_date DATE,
  end_date DATE,
  priority public.priority_level DEFAULT 'medium',
  status public.project_status NOT NULL DEFAULT 'planning',
  progress INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "Managers update projects" ON public.projects FOR UPDATE TO authenticated USING (public.can_manage(auth.uid()));
CREATE POLICY "Managers delete projects" ON public.projects FOR DELETE TO authenticated USING (public.can_manage(auth.uid()));
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- TASKS
-- =========================================================================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  assignee_type TEXT CHECK (assignee_type IN ('employee','freelancer')),
  assignee_id UUID,
  assignee_name TEXT,
  due_date DATE,
  priority public.priority_level DEFAULT 'medium',
  status public.task_status NOT NULL DEFAULT 'pending',
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "Managers update tasks" ON public.tasks FOR UPDATE TO authenticated USING (public.can_manage(auth.uid()));
CREATE POLICY "Managers delete tasks" ON public.tasks FOR DELETE TO authenticated USING (public.can_manage(auth.uid()));
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- COMMISSIONS
-- =========================================================================
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_type public.commission_type NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_id UUID,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  fixed_amount NUMERIC(12,2),
  percentage NUMERIC(5,2),
  amount NUMERIC(12,2),
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  payment_date DATE,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commissions TO authenticated;
GRANT ALL ON public.commissions TO service_role;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view commissions" ON public.commissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers insert commissions" ON public.commissions FOR INSERT TO authenticated WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "Managers update commissions" ON public.commissions FOR UPDATE TO authenticated USING (public.can_manage(auth.uid()));
CREATE POLICY "Managers delete commissions" ON public.commissions FOR DELETE TO authenticated USING (public.can_manage(auth.uid()));
CREATE TRIGGER trg_commissions_updated BEFORE UPDATE ON public.commissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- DOCUMENTS
-- =========================================================================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT CHECK (owner_type IN ('employee','freelancer','project','company')),
  owner_id UUID,
  doc_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view documents" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Managers update documents" ON public.documents FOR UPDATE TO authenticated USING (public.can_manage(auth.uid()));
CREATE POLICY "Managers delete documents" ON public.documents FOR DELETE TO authenticated USING (public.can_manage(auth.uid()));
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- NOTIFICATIONS
-- =========================================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  category TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
-- Broadcast notifications (user_id NULL) visible to all; targeted only to owner
CREATE POLICY "View own or broadcast notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "Managers insert notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Managers delete notifications" ON public.notifications FOR DELETE TO authenticated
  USING (public.can_manage(auth.uid()));
CREATE TRIGGER trg_notifications_updated BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- COMPANY SETTINGS (singleton)
-- =========================================================================
CREATE TABLE public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'Sri Surya Group',
  logo_url TEXT,
  business_info TEXT,
  office_address TEXT,
  email TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  currency TEXT DEFAULT 'INR',
  working_hours TEXT DEFAULT '9:00 AM - 6:00 PM',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view settings" ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin insert settings" ON public.company_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin update settings" ON public.company_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the singleton row
INSERT INTO public.company_settings (company_name, email, office_address)
VALUES ('Sri Surya Group', 'contact@srisuryagroup.com', 'Hyderabad, Telangana, India');

-- Seed departments
INSERT INTO public.departments (name, code, head_name, description) VALUES
  ('Engineering', 'ENG', 'Ravi Kumar', 'Software engineering & product development'),
  ('Human Resources', 'HR', 'Priya Sharma', 'People operations, recruitment, employee experience'),
  ('Finance', 'FIN', 'Anil Reddy', 'Accounting, payroll & financial planning'),
  ('Sales & Marketing', 'SNM', 'Deepika Rao', 'Client acquisition, marketing campaigns'),
  ('Operations', 'OPS', 'Suresh Naidu', 'Business operations & administration');

-- Seed employees
INSERT INTO public.employees (full_name, email, mobile, gender, designation, employment_type, salary, department_id, joining_date, status)
SELECT * FROM (VALUES
  ('Arjun Menon',      'arjun.menon@ssg.com',      '+91 98765 10001', 'male'::gender_type,   'Senior Engineer',   'full_time'::employment_type, 120000::numeric, (SELECT id FROM public.departments WHERE code='ENG'), '2023-04-15'::date, 'active'::record_status),
  ('Sneha Iyer',       'sneha.iyer@ssg.com',       '+91 98765 10002', 'female'::gender_type, 'HR Executive',      'full_time'::employment_type, 65000::numeric,  (SELECT id FROM public.departments WHERE code='HR'),  '2023-06-01'::date, 'active'::record_status),
  ('Karthik Rao',      'karthik.rao@ssg.com',      '+91 98765 10003', 'male'::gender_type,   'Finance Analyst',   'full_time'::employment_type, 80000::numeric,  (SELECT id FROM public.departments WHERE code='FIN'), '2022-11-20'::date, 'active'::record_status),
  ('Meera Nair',       'meera.nair@ssg.com',       '+91 98765 10004', 'female'::gender_type, 'Marketing Lead',    'full_time'::employment_type, 95000::numeric,  (SELECT id FROM public.departments WHERE code='SNM'), '2024-01-10'::date, 'active'::record_status),
  ('Vikram Singh',     'vikram.singh@ssg.com',     '+91 98765 10005', 'male'::gender_type,   'Operations Manager','full_time'::employment_type, 110000::numeric, (SELECT id FROM public.departments WHERE code='OPS'), '2021-08-05'::date, 'active'::record_status),
  ('Ananya Gupta',     'ananya.gupta@ssg.com',     '+91 98765 10006', 'female'::gender_type, 'Product Designer',  'full_time'::employment_type, 90000::numeric,  (SELECT id FROM public.departments WHERE code='ENG'), '2024-03-18'::date, 'active'::record_status),
  ('Rohit Verma',      'rohit.verma@ssg.com',      '+91 98765 10007', 'male'::gender_type,   'Sales Executive',   'full_time'::employment_type, 55000::numeric,  (SELECT id FROM public.departments WHERE code='SNM'), '2024-05-22'::date, 'active'::record_status),
  ('Divya Krishnan',   'divya.krishnan@ssg.com',   '+91 98765 10008', 'female'::gender_type, 'HR Manager',        'full_time'::employment_type, 130000::numeric, (SELECT id FROM public.departments WHERE code='HR'),  '2020-02-14'::date, 'active'::record_status),
  ('Nikhil Patel',     'nikhil.patel@ssg.com',     '+91 98765 10009', 'male'::gender_type,   'Backend Engineer',  'full_time'::employment_type, 105000::numeric, (SELECT id FROM public.departments WHERE code='ENG'), '2023-09-12'::date, 'active'::record_status),
  ('Kavya Bhat',       'kavya.bhat@ssg.com',       '+91 98765 10010', 'female'::gender_type, 'Accountant',        'full_time'::employment_type, 60000::numeric,  (SELECT id FROM public.departments WHERE code='FIN'), '2023-12-01'::date, 'active'::record_status),
  ('Ramesh Yadav',     'ramesh.yadav@ssg.com',     '+91 98765 10011', 'male'::gender_type,   'Ops Analyst',       'part_time'::employment_type, 40000::numeric,  (SELECT id FROM public.departments WHERE code='OPS'), '2025-01-08'::date, 'active'::record_status),
  ('Pooja Deshmukh',   'pooja.deshmukh@ssg.com',   '+91 98765 10012', 'female'::gender_type, 'QA Engineer',       'full_time'::employment_type, 75000::numeric,  (SELECT id FROM public.departments WHERE code='ENG'), '2024-07-30'::date, 'on_leave'::record_status),
  ('Aditya Rao',       'aditya.rao@ssg.com',       '+91 98765 10013', 'male'::gender_type,   'Sales Manager',     'full_time'::employment_type, 140000::numeric, (SELECT id FROM public.departments WHERE code='SNM'), '2019-05-01'::date, 'active'::record_status),
  ('Lakshmi Reddy',    'lakshmi.reddy@ssg.com',    '+91 98765 10014', 'female'::gender_type, 'Recruiter',         'contract'::employment_type,  50000::numeric,  (SELECT id FROM public.departments WHERE code='HR'),  '2025-02-15'::date, 'active'::record_status),
  ('Manoj Chandra',    'manoj.chandra@ssg.com',    '+91 98765 10015', 'male'::gender_type,   'DevOps Engineer',   'full_time'::employment_type, 115000::numeric, (SELECT id FROM public.departments WHERE code='ENG'), '2022-06-20'::date, 'active'::record_status)
) AS t(full_name,email,mobile,gender,designation,employment_type,salary,department_id,joining_date,status);

-- Seed freelancers
INSERT INTO public.freelancers (full_name, email, mobile, skills, experience_years, hourly_rate, availability, status) VALUES
  ('Ishaan Kapoor',   'ishaan.kapoor@freelance.com', '+91 90000 20001', ARRAY['React','Node.js','GraphQL'],       5.5, 1500, 'available',   'active'),
  ('Riya Malhotra',   'riya.malhotra@freelance.com', '+91 90000 20002', ARRAY['UI/UX','Figma','Illustrator'],     4.0, 1200, 'busy',        'active'),
  ('Arnav Chopra',    'arnav.chopra@freelance.com',  '+91 90000 20003', ARRAY['Content Writing','SEO'],           7.0, 800,  'available',   'active'),
  ('Tanya Bhatia',    'tanya.bhatia@freelance.com',  '+91 90000 20004', ARRAY['Video Editing','Motion Design'],   3.5, 1000, 'unavailable', 'active'),
  ('Vivaan Sethi',    'vivaan.sethi@freelance.com',  '+91 90000 20005', ARRAY['Mobile Dev','Flutter','iOS'],      6.0, 1800, 'available',   'active'),
  ('Sanya Aggarwal',  'sanya.aggarwal@freelance.com','+91 90000 20006', ARRAY['Data Science','Python','ML'],      4.5, 2000, 'busy',        'active'),
  ('Kabir Joshi',     'kabir.joshi@freelance.com',   '+91 90000 20007', ARRAY['DevOps','AWS','Kubernetes'],       8.0, 2200, 'available',   'active');

-- Seed projects
INSERT INTO public.projects (name, client_name, description, budget, start_date, end_date, priority, status, progress) VALUES
  ('Enterprise HR Portal',    'Aditya Birla Group', 'Custom HR portal for onboarding & payroll', 2500000, '2025-01-15','2026-04-30','high',   'in_progress', 45),
  ('E-commerce Redesign',     'Reliance Retail',    'Complete redesign of storefront + PWA',      1800000, '2025-03-01','2026-02-15','high',   'in_progress', 60),
  ('Mobile Banking App',      'HDFC Bank',          'Consumer banking mobile app v3.0',            4200000, '2024-11-20','2026-08-30','urgent', 'in_progress', 30),
  ('Logistics Dashboard',     'Delhivery',          'Real-time fleet tracking dashboard',           900000, '2025-06-10','2026-01-31','medium', 'in_progress', 75),
  ('AI Chatbot POC',          'Tata Digital',       'GenAI chatbot for customer support',           450000, '2026-01-05','2026-03-31','medium', 'planning',    10),
  ('Payroll Automation',      'Infosys BPM',        'Automate monthly payroll workflows',          1200000, '2025-09-01','2026-06-30','low',    'on_hold',     25),
  ('Data Warehouse Migration','Wipro',              'Migrate legacy DW to Snowflake',              3100000, '2025-04-12','2026-07-15','high',   'in_progress', 55);

-- Seed tasks
INSERT INTO public.tasks (project_id, name, description, assignee_name, due_date, priority, status)
SELECT p.id, t.name, t.description, t.assignee_name, t.due_date::date, t.priority::priority_level, t.status::task_status
FROM public.projects p
CROSS JOIN LATERAL (
  VALUES
    ('Design system setup',           'Configure design tokens', 'Ananya Gupta',   '2026-02-01', 'high',   'in_progress'),
    ('API contract review',           'Review OpenAPI spec',     'Arjun Menon',    '2026-01-25', 'medium', 'pending'),
    ('Sprint 3 planning',             'Backlog grooming',        'Vikram Singh',   '2026-01-20', 'low',    'completed'),
    ('Security audit',                'Penetration test',        'Manoj Chandra',  '2026-03-10', 'urgent', 'pending')
) AS t(name, description, assignee_name, due_date, priority, status)
WHERE p.status = 'in_progress'
LIMIT 24;

-- Seed commissions
INSERT INTO public.commissions (commission_type, recipient_name, fixed_amount, percentage, amount, payment_status, payment_date, remarks) VALUES
  ('employee',   'Aditya Rao',      NULL, 5,    75000,  'paid',    '2026-01-05', 'Q4 sales incentive'),
  ('employee',   'Rohit Verma',     NULL, 3,    18500,  'pending',  NULL,        'Client onboarding bonus'),
  ('freelancer', 'Ishaan Kapoor',   45000, NULL, 45000, 'paid',    '2026-01-10', 'Enterprise HR Portal delivery'),
  ('freelancer', 'Kabir Joshi',     60000, NULL, 60000, 'pending',  NULL,        'DevOps migration milestone'),
  ('referral',   'Divya Krishnan',  15000, NULL, 15000, 'paid',    '2026-01-08', 'Referred senior candidate'),
  ('referral',   'Meera Nair',      25000, NULL, 25000, 'pending',  NULL,        'Enterprise client referral');

-- Seed notifications (broadcast)
INSERT INTO public.notifications (user_id, title, message, category) VALUES
  (NULL, 'Welcome to Sri Surya Group HRMS', 'Your workspace is ready. Explore the dashboard to get started.', 'system'),
  (NULL, 'New Project Created', 'Mobile Banking App project has been added.', 'project'),
  (NULL, 'Commission Paid', 'Q4 sales incentive processed successfully.', 'commission');
