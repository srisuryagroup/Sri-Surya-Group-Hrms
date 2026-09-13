ALTER TABLE public.freelancers
  ADD COLUMN IF NOT EXISTS commission_percentage numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.calc_commission_amount()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE base numeric; pct numeric;
BEGIN
  pct := NEW.percentage;

  -- Fall back to the freelancer's default commission percentage
  IF pct IS NULL AND NEW.fixed_amount IS NULL AND NEW.recipient_id IS NOT NULL THEN
    SELECT NULLIF(commission_percentage, 0) INTO pct
    FROM public.freelancers WHERE id = NEW.recipient_id;
    IF pct IS NOT NULL THEN
      NEW.percentage := pct;
    END IF;
  END IF;

  IF NEW.fixed_amount IS NOT NULL THEN
    NEW.amount := NEW.fixed_amount;
  ELSIF pct IS NOT NULL THEN
    base := NEW.project_value;
    IF base IS NULL AND NEW.project_id IS NOT NULL THEN
      SELECT budget INTO base FROM public.projects WHERE id = NEW.project_id;
    END IF;
    IF base IS NOT NULL THEN
      NEW.amount := round(base * pct / 100.0, 2);
    END IF;
  END IF;
  RETURN NEW;
END; $function$;