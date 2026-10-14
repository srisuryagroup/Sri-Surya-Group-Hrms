CREATE TABLE public.offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('website_design','software_development','digital_marketing','it_services','physical_product')),
  description text,
  price numeric,
  commission_mode text NOT NULL DEFAULT 'percentage' CHECK (commission_mode IN ('percentage','fixed')),
  commission_value numeric NOT NULL DEFAULT 0 CHECK (commission_value >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offerings TO authenticated;
GRANT ALL ON public.offerings TO service_role;
ALTER TABLE public.offerings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view active offerings" ON public.offerings FOR SELECT TO authenticated USING (is_active OR public.can_manage(auth.uid()));
CREATE POLICY "managers insert offerings" ON public.offerings FOR INSERT TO authenticated WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "managers update offerings" ON public.offerings FOR UPDATE TO authenticated USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "managers delete offerings" ON public.offerings FOR DELETE TO authenticated USING (public.can_manage(auth.uid()));
CREATE TRIGGER trg_offerings_updated BEFORE UPDATE ON public.offerings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL REFERENCES public.offerings(id) ON DELETE RESTRICT,
  freelancer_id uuid NOT NULL REFERENCES public.freelancers(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  client_contact text,
  deal_value numeric NOT NULL DEFAULT 0 CHECK (deal_value >= 0),
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','in_progress','completed','rejected','cancelled')),
  commission_amount numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid')),
  paid_on date,
  review_note text,
  reviewed_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bookings_freelancer_idx ON public.bookings(freelancer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers or own view bookings" ON public.bookings FOR SELECT TO authenticated
  USING (public.can_manage(auth.uid()) OR freelancer_id = public.my_freelancer_id());
CREATE POLICY "freelancer or manager create bookings" ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (public.can_manage(auth.uid()) OR (freelancer_id = public.my_freelancer_id() AND status = 'pending' AND payment_status = 'unpaid'));
CREATE POLICY "manager or own update bookings" ON public.bookings FOR UPDATE TO authenticated
  USING (public.can_manage(auth.uid()) OR freelancer_id = public.my_freelancer_id())
  WITH CHECK (public.can_manage(auth.uid()) OR freelancer_id = public.my_freelancer_id());
CREATE POLICY "managers delete bookings" ON public.bookings FOR DELETE TO authenticated USING (public.can_manage(auth.uid()));

ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL;

-- Compute commission, restrict what freelancers may change, sync to commissions
CREATE OR REPLACE FUNCTION public.booking_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o record; mgr boolean := public.can_manage(auth.uid());
BEGIN
  IF TG_OP = 'UPDATE' AND NOT mgr THEN
    -- Freelancers may only edit details of a pending booking, or cancel it
    IF OLD.status <> 'pending' THEN RAISE EXCEPTION 'Only pending bookings can be changed'; END IF;
    IF NEW.status NOT IN ('pending','cancelled') THEN RAISE EXCEPTION 'Only Admin/HR can approve bookings'; END IF;
    NEW.freelancer_id := OLD.freelancer_id; NEW.payment_status := OLD.payment_status;
    NEW.paid_on := OLD.paid_on; NEW.review_note := OLD.review_note; NEW.reviewed_by := OLD.reviewed_by;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    IF NOT mgr THEN NEW.status := 'pending'; NEW.payment_status := 'unpaid'; NEW.paid_on := NULL; END IF;
  END IF;
  SELECT * INTO o FROM public.offerings WHERE id = NEW.offering_id;
  IF NEW.payment_status = 'unpaid' THEN
    NEW.commission_amount := CASE WHEN o.commission_mode = 'fixed' THEN o.commission_value
      ELSE round(COALESCE(NEW.deal_value,0) * o.commission_value / 100.0, 2) END;
  END IF;
  IF mgr AND TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN NEW.reviewed_by := auth.uid(); END IF;
  IF NEW.payment_status = 'paid' AND NEW.paid_on IS NULL THEN NEW.paid_on := current_date; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_booking_before_write BEFORE INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.booking_before_write();
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.booking_after_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE fname text; em text; oname text; cid uuid;
BEGIN
  SELECT full_name, email INTO fname, em FROM public.freelancers WHERE id = NEW.freelancer_id;
  SELECT name INTO oname FROM public.offerings WHERE id = NEW.offering_id;
  SELECT id INTO cid FROM public.commissions WHERE booking_id = NEW.id LIMIT 1;
  IF NEW.status IN ('approved','in_progress','completed') THEN
    IF cid IS NULL THEN
      INSERT INTO public.commissions (commission_type, recipient_name, recipient_id, fixed_amount, payment_status, payment_date, remarks, booking_id)
      VALUES ('freelancer', COALESCE(fname,'Freelancer'), NEW.freelancer_id, NEW.commission_amount,
        CASE WHEN NEW.payment_status = 'paid' THEN 'paid'::payment_status ELSE 'pending'::payment_status END,
        NEW.paid_on, 'Booking: ' || COALESCE(oname,'') || ' — ' || NEW.client_name, NEW.id);
    ELSE
      UPDATE public.commissions SET fixed_amount = NEW.commission_amount,
        payment_status = CASE WHEN NEW.payment_status = 'paid' THEN 'paid'::payment_status ELSE 'pending'::payment_status END,
        payment_date = NEW.paid_on WHERE id = cid;
    END IF;
  ELSIF cid IS NOT NULL THEN
    UPDATE public.commissions SET payment_status = 'cancelled' WHERE id = cid AND payment_status <> 'paid';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected','completed') THEN
    INSERT INTO public.notifications (user_id, title, message, category)
    VALUES (public.user_id_for_email(em), 'Booking ' || NEW.status,
      'Your booking for ' || COALESCE(oname,'a service') || ' (' || NEW.client_name || ') is ' || NEW.status || '.', 'booking');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_booking_after_write AFTER INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.booking_after_write();