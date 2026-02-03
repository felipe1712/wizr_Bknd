-- Table to store scheduled search configurations per project
CREATE TABLE public.project_search_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('hourly', 'twice_daily', 'daily', 'weekly')),
  platforms TEXT[] NOT NULL DEFAULT ARRAY['news', 'twitter', 'facebook']::TEXT[],
  max_results_per_platform INTEGER NOT NULL DEFAULT 25,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  run_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

-- Enable RLS
ALTER TABLE public.project_search_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their project schedules"
  ON public.project_search_schedules FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_search_schedules.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create schedules for their projects"
  ON public.project_search_schedules FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_search_schedules.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their project schedules"
  ON public.project_search_schedules FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_search_schedules.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their project schedules"
  ON public.project_search_schedules FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_search_schedules.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all schedules"
  ON public.project_search_schedules FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Directors can view all schedules"
  ON public.project_search_schedules FOR SELECT
  USING (has_role(auth.uid(), 'director'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_project_search_schedules_updated_at
  BEFORE UPDATE ON public.project_search_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate next run time based on frequency
CREATE OR REPLACE FUNCTION calculate_next_run(freq TEXT, from_time TIMESTAMP WITH TIME ZONE DEFAULT now())
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN CASE freq
    WHEN 'hourly' THEN from_time + INTERVAL '1 hour'
    WHEN 'twice_daily' THEN from_time + INTERVAL '12 hours'
    WHEN 'daily' THEN from_time + INTERVAL '1 day'
    WHEN 'weekly' THEN from_time + INTERVAL '1 week'
    ELSE from_time + INTERVAL '1 day'
  END;
END;
$$;