ALTER TABLE public.project_assignments
  ADD COLUMN IF NOT EXISTS commission_mode text,
  ADD COLUMN IF NOT EXISTS commission_value numeric;
ALTER TABLE public.project_assignments
  ADD CONSTRAINT project_assignments_commission_mode_chk CHECK (commission_mode IS NULL OR commission_mode IN ('percentage','fixed'));
COMMENT ON COLUMN public.freelancers.hourly_rate IS 'DEPRECATED: freelancers are paid project-based commissions (project_assignments.commission_*)';

CREATE OR REPLACE FUNCTION public.sync_assignment_commission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE fname text; existing uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.commissions WHERE project_id = OLD.project_id AND recipient_id = OLD.assignee_id
      AND commission_type = 'freelancer' AND payment_status = 'pending';
    RETURN OLD;
  END IF;
  IF NEW.assignee_type <> 'freelancer' OR NEW.commission_mode IS NULL OR NEW.commission_value IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT full_name INTO fname FROM public.freelancers WHERE id = NEW.assignee_id;
  SELECT id INTO existing FROM public.commissions
    WHERE project_id = NEW.project_id AND recipient_id = NEW.assignee_id AND commission_type = 'freelancer'
    ORDER BY created_at LIMIT 1;
  IF existing IS NULL THEN
    INSERT INTO public.commissions (commission_type, recipient_name, recipient_id, project_id, percentage, fixed_amount, payment_status)
    VALUES ('freelancer', COALESCE(fname, 'Freelancer'), NEW.assignee_id, NEW.project_id,
      CASE WHEN NEW.commission_mode = 'percentage' THEN NEW.commission_value END,
      CASE WHEN NEW.commission_mode = 'fixed' THEN NEW.commission_value END, 'pending');
  ELSE
    UPDATE public.commissions SET
      percentage = CASE WHEN NEW.commission_mode = 'percentage' THEN NEW.commission_value END,
      fixed_amount = CASE WHEN NEW.commission_mode = 'fixed' THEN NEW.commission_value END
    WHERE id = existing AND payment_status = 'pending';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sync_assignment_commission
AFTER INSERT OR UPDATE OR DELETE ON public.project_assignments
FOR EACH ROW EXECUTE FUNCTION public.sync_assignment_commission();

-- Recalculate pending percentage commissions when a project's budget changes
CREATE OR REPLACE FUNCTION public.recalc_project_commissions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.budget IS DISTINCT FROM OLD.budget THEN
    UPDATE public.commissions SET updated_at = now()
    WHERE project_id = NEW.id AND payment_status = 'pending' AND percentage IS NOT NULL AND fixed_amount IS NULL AND project_value IS NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_recalc_project_commissions
AFTER UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.recalc_project_commissions();

-- Commission privacy: managers see all, others only their own
DROP POLICY IF EXISTS "Authenticated view commissions" ON public.commissions;
CREATE POLICY "Managers or recipient view commissions" ON public.commissions FOR SELECT TO authenticated
USING (public.can_manage(auth.uid())
  OR (recipient_id IS NOT NULL AND (recipient_id = public.my_freelancer_id() OR recipient_id = public.my_employee_id())));