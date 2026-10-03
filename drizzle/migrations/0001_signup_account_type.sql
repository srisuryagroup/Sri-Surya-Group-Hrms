CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
  assigned_role public.app_role;
  requested TEXT := lower(COALESCE(NEW.raw_user_meta_data ->> 'account_type', ''));
  fname TEXT := COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), NEW.email);
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, fname, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  SELECT count(*) INTO user_count FROM auth.users;
  IF user_count <= 1 THEN
    assigned_role := 'super_admin';
  ELSIF requested = 'freelancer' THEN
    assigned_role := 'freelancer';
  ELSE
    -- Self-signup can only ever be employee or freelancer; elevated roles are granted by a Super Admin.
    assigned_role := 'employee';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF assigned_role = 'employee' AND NEW.email IS NOT NULL THEN
    INSERT INTO public.employees (full_name, email) VALUES (fname, NEW.email)
    ON CONFLICT (email) DO NOTHING;
  ELSIF assigned_role = 'freelancer' AND NEW.email IS NOT NULL THEN
    INSERT INTO public.freelancers (full_name, email) VALUES (fname, NEW.email)
    ON CONFLICT (email) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;