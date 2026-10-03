CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  host_name TEXT NOT NULL,
  room_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'scheduled',
  started_at TIMESTAMPTZ,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, user_id)
);
CREATE INDEX idx_meeting_participants_user ON public.meeting_participants(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;
GRANT SELECT, INSERT, DELETE ON public.meeting_participants TO authenticated;
GRANT ALL ON public.meeting_participants TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_meeting_participant(_meeting_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.meeting_participants WHERE meeting_id = _meeting_id AND user_id = _user_id);
$$;
REVOKE ALL ON FUNCTION public.is_meeting_participant(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_meeting_participant(UUID, UUID) TO authenticated;

CREATE POLICY "View own or managed meetings" ON public.meetings FOR SELECT TO authenticated
  USING (public.can_manage(auth.uid()) OR public.is_meeting_participant(id, auth.uid()));
CREATE POLICY "Managers create meetings" ON public.meetings FOR INSERT TO authenticated
  WITH CHECK (public.can_manage(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Managers update meetings" ON public.meetings FOR UPDATE TO authenticated
  USING (public.can_manage(auth.uid()));
CREATE POLICY "Super admin deletes meetings" ON public.meetings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "View participants" ON public.meeting_participants FOR SELECT TO authenticated
  USING (public.can_manage(auth.uid()) OR public.is_meeting_participant(meeting_id, auth.uid()));
CREATE POLICY "Managers add participants" ON public.meeting_participants FOR INSERT TO authenticated
  WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "Managers remove participants" ON public.meeting_participants FOR DELETE TO authenticated
  USING (public.can_manage(auth.uid()));

CREATE TRIGGER trg_meetings_updated BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();