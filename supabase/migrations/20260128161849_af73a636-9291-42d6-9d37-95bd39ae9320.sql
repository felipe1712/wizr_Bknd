-- Create auto-save configuration table per project
CREATE TABLE public.auto_save_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  required_keywords TEXT[] NOT NULL DEFAULT '{}',
  min_relevance_score INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

-- Enable RLS
ALTER TABLE public.auto_save_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view auto_save_configs in their projects"
ON public.auto_save_configs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM projects WHERE projects.id = auto_save_configs.project_id AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can create auto_save_configs in their projects"
ON public.auto_save_configs FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM projects WHERE projects.id = auto_save_configs.project_id AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can update auto_save_configs in their projects"
ON public.auto_save_configs FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM projects WHERE projects.id = auto_save_configs.project_id AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can delete auto_save_configs in their projects"
ON public.auto_save_configs FOR DELETE
USING (EXISTS (
  SELECT 1 FROM projects WHERE projects.id = auto_save_configs.project_id AND projects.user_id = auth.uid()
));

CREATE POLICY "Admins can view all auto_save_configs"
ON public.auto_save_configs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Directors can view all auto_save_configs"
ON public.auto_save_configs FOR SELECT
USING (has_role(auth.uid(), 'director'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_auto_save_configs_updated_at
BEFORE UPDATE ON public.auto_save_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();