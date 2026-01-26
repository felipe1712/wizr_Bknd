-- Create enum for alert types
CREATE TYPE public.alert_type AS ENUM ('sentiment_negative', 'mention_spike', 'keyword_match');

-- Create enum for alert status
CREATE TYPE public.alert_status AS ENUM ('active', 'paused', 'triggered');

-- Table for alert configurations
CREATE TABLE public.alert_configs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    alert_type alert_type NOT NULL,
    -- Configuration based on type
    threshold_percent INTEGER, -- For sentiment: % negative threshold; For spike: % increase
    keywords TEXT[] DEFAULT '{}', -- For keyword_match type
    entity_ids UUID[] DEFAULT '{}', -- Filter to specific entities (empty = all)
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    trigger_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for triggered alerts (notifications)
CREATE TABLE public.alert_notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    alert_config_id UUID NOT NULL REFERENCES public.alert_configs(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'warning', -- info, warning, critical
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN NOT NULL DEFAULT false,
    is_dismissed BOOLEAN NOT NULL DEFAULT false,
    triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.alert_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for alert_configs
CREATE POLICY "Users can view alert configs in their projects"
ON public.alert_configs FOR SELECT
USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = alert_configs.project_id
    AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can create alert configs in their projects"
ON public.alert_configs FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = alert_configs.project_id
    AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can update alert configs in their projects"
ON public.alert_configs FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = alert_configs.project_id
    AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can delete alert configs in their projects"
ON public.alert_configs FOR DELETE
USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = alert_configs.project_id
    AND projects.user_id = auth.uid()
));

CREATE POLICY "Admins can view all alert configs"
ON public.alert_configs FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Directors can view all alert configs"
ON public.alert_configs FOR SELECT
USING (has_role(auth.uid(), 'director'));

-- RLS Policies for alert_notifications
CREATE POLICY "Users can view notifications in their projects"
ON public.alert_notifications FOR SELECT
USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = alert_notifications.project_id
    AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can update notifications in their projects"
ON public.alert_notifications FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = alert_notifications.project_id
    AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can create notifications in their projects"
ON public.alert_notifications FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = alert_notifications.project_id
    AND projects.user_id = auth.uid()
));

CREATE POLICY "Admins can view all notifications"
ON public.alert_notifications FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Directors can view all notifications"
ON public.alert_notifications FOR SELECT
USING (has_role(auth.uid(), 'director'));

-- Trigger for updated_at
CREATE TRIGGER update_alert_configs_updated_at
BEFORE UPDATE ON public.alert_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_alert_configs_project ON public.alert_configs(project_id);
CREATE INDEX idx_alert_notifications_project ON public.alert_notifications(project_id);
CREATE INDEX idx_alert_notifications_config ON public.alert_notifications(alert_config_id);
CREATE INDEX idx_alert_notifications_unread ON public.alert_notifications(project_id, is_read) WHERE NOT is_read;