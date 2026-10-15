CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  owner_name text,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  mobile text CHECK (mobile IS NULL OR char_length(mobile) <= 20),
  whatsapp text CHECK (whatsapp IS NULL OR char_length(whatsapp) <= 20),
  email text CHECK (email IS NULL OR char_length(email) <= 255),
  location text CHECK (location IS NULL OR char_length(location) <= 200),
  interest text CHECK (interest IS NULL OR char_length(interest) <= 200),
  source text,
  follow_up_date date,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','interested','follow_up','converted','lost')),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leads_owner_idx ON public.leads(owner_id);
CREATE INDEX leads_follow_idx ON public.leads(follow_up_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own or managed leads" ON public.leads FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.can_manage(auth.uid()));
CREATE POLICY "Create own leads" ON public.leads FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Update own or managed leads" ON public.leads FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.can_manage(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.can_manage(auth.uid()));
CREATE POLICY "Delete own or managed leads" ON public.leads FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.can_manage(auth.uid()));
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();