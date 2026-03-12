-- =============================================
-- WIZR Database Schema - Initial Setup
-- =============================================

-- 1. Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'analista', 'director');

-- 2. Create profiles table for user data
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Create user_roles table (separate for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'analista',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 4. Enable RLS on both tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- 6. Create function to get user's roles
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.user_roles WHERE user_id = _user_id
$$;

-- 7. RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- 8. RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
    ON public.user_roles FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- 9. Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
    
    -- Assign default 'analista' role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'analista');
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 10. Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();-- Create enum for project types
CREATE TYPE public.project_type AS ENUM ('monitoreo', 'investigacion', 'crisis', 'benchmark');

-- Create enum for sensitivity levels
CREATE TYPE public.sensitivity_level AS ENUM ('bajo', 'medio', 'alto', 'critico');

-- Create enum for temporal scope
CREATE TYPE public.temporal_scope AS ENUM ('tiempo_real', 'diario', 'semanal', 'mensual', 'historico');

-- Create projects table
CREATE TABLE public.projects (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    
    -- Project Spec fields
    nombre TEXT NOT NULL,
    tipo project_type NOT NULL DEFAULT 'monitoreo',
    objetivo TEXT NOT NULL,
    audiencia TEXT NOT NULL,
    sensibilidad sensitivity_level NOT NULL DEFAULT 'medio',
    alcance_temporal temporal_scope NOT NULL DEFAULT 'diario',
    alcance_geografico TEXT[] NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Metadata
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own projects"
ON public.projects
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
ON public.projects
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
ON public.projects
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
ON public.projects
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can view all projects
CREATE POLICY "Admins can view all projects"
ON public.projects
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Directors can view all projects
CREATE POLICY "Directors can view all projects"
ON public.projects
FOR SELECT
USING (has_role(auth.uid(), 'director'));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();-- Create enum for entity types
CREATE TYPE public.entity_type AS ENUM ('persona', 'marca', 'institucion');

-- Create entities table
CREATE TABLE public.entities (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    tipo entity_type NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    palabras_clave TEXT[] NOT NULL DEFAULT '{}',
    aliases TEXT[] NOT NULL DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_entities_project_id ON public.entities(project_id);
CREATE INDEX idx_entities_tipo ON public.entities(tipo);

-- Enable Row Level Security
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can manage entities in their own projects
CREATE POLICY "Users can view entities in their projects"
ON public.entities
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = entities.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Admins can view all entities"
ON public.entities
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Directors can view all entities"
ON public.entities
FOR SELECT
USING (has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Users can create entities in their projects"
ON public.entities
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = entities.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update entities in their projects"
ON public.entities
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = entities.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete entities in their projects"
ON public.entities
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = entities.project_id
        AND projects.user_id = auth.uid()
    )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_entities_updated_at
BEFORE UPDATE ON public.entities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();-- Create mentions table for storing search results
CREATE TABLE public.mentions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    source_domain TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    matched_keywords TEXT[] NOT NULL DEFAULT '{}',
    sentiment TEXT CHECK (sentiment IN ('positivo', 'neutral', 'negativo')),
    relevance_score NUMERIC(3,2) DEFAULT 0.5,
    raw_metadata JSONB DEFAULT '{}',
    is_read BOOLEAN NOT NULL DEFAULT false,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Unique constraint to avoid duplicate mentions per project
    UNIQUE(project_id, url)
);

-- Create indexes for efficient querying
CREATE INDEX idx_mentions_project_id ON public.mentions(project_id);
CREATE INDEX idx_mentions_entity_id ON public.mentions(entity_id);
CREATE INDEX idx_mentions_published_at ON public.mentions(published_at DESC);
CREATE INDEX idx_mentions_source_domain ON public.mentions(source_domain);
CREATE INDEX idx_mentions_sentiment ON public.mentions(sentiment);
CREATE INDEX idx_mentions_created_at ON public.mentions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view mentions in their projects"
ON public.mentions
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = mentions.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Admins can view all mentions"
ON public.mentions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Directors can view all mentions"
ON public.mentions
FOR SELECT
USING (has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Users can create mentions in their projects"
ON public.mentions
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = mentions.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update mentions in their projects"
ON public.mentions
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = mentions.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete mentions in their projects"
ON public.mentions
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = mentions.project_id
        AND projects.user_id = auth.uid()
    )
);

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_mentions_updated_at
BEFORE UPDATE ON public.mentions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for mentions
ALTER PUBLICATION supabase_realtime ADD TABLE public.mentions;-- Create enum for alert types
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
CREATE INDEX idx_alert_notifications_unread ON public.alert_notifications(project_id, is_read) WHERE NOT is_read;-- Create table for access requests (pending user registrations)
CREATE TABLE public.access_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    full_name text NOT NULL,
    reason text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by uuid REFERENCES auth.users(id),
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an access request (no auth required)
CREATE POLICY "Anyone can submit access request"
ON public.access_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (status = 'pending');

-- Only admins can view all access requests
CREATE POLICY "Admins can view all access requests"
ON public.access_requests
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can update access requests
CREATE POLICY "Admins can update access requests"
ON public.access_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_access_requests_updated_at
BEFORE UPDATE ON public.access_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();-- Create table for thematic cards (Fichas Temáticas)
CREATE TABLE public.thematic_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  
  -- Card metadata
  title TEXT NOT NULL,
  card_type TEXT NOT NULL CHECK (card_type IN ('conversation_analysis', 'informative')),
  period_start DATE,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  
  -- Generated content (editable by analyst)
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Mention references (for conversation analysis type)
  mention_ids UUID[] DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.thematic_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view thematic cards in their projects"
ON public.thematic_cards
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = thematic_cards.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Admins can view all thematic cards"
ON public.thematic_cards
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Directors can view all thematic cards"
ON public.thematic_cards
FOR SELECT
USING (has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Users can create thematic cards in their projects"
ON public.thematic_cards
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = thematic_cards.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can update thematic cards in their projects"
ON public.thematic_cards
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = thematic_cards.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can delete thematic cards in their projects"
ON public.thematic_cards
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = thematic_cards.project_id
  AND projects.user_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_thematic_cards_updated_at
BEFORE UPDATE ON public.thematic_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_thematic_cards_project_id ON public.thematic_cards(project_id);
CREATE INDEX idx_thematic_cards_status ON public.thematic_cards(status);-- Create table to store social media scrape jobs
CREATE TABLE public.social_scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  search_type TEXT NOT NULL,
  search_value TEXT NOT NULL,
  run_id TEXT,
  dataset_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  max_results INTEGER DEFAULT 25,
  results_count INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table to store normalized social results
CREATE TABLE public.social_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.social_scrape_jobs(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_id TEXT,
  title TEXT,
  description TEXT,
  author_name TEXT,
  author_username TEXT,
  author_url TEXT,
  author_avatar_url TEXT,
  author_verified BOOLEAN DEFAULT false,
  author_followers INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  engagement NUMERIC(10, 2) DEFAULT 0,
  published_at TIMESTAMP WITH TIME ZONE,
  url TEXT,
  content_type TEXT DEFAULT 'post',
  hashtags TEXT[] DEFAULT '{}',
  mentions TEXT[] DEFAULT '{}',
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, external_id)
);

-- Enable RLS on both tables
ALTER TABLE public.social_scrape_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_results ENABLE ROW LEVEL SECURITY;

-- RLS policies for social_scrape_jobs
CREATE POLICY "Users can view jobs in their projects"
ON public.social_scrape_jobs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = social_scrape_jobs.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can create jobs in their projects"
ON public.social_scrape_jobs FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = social_scrape_jobs.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can update jobs in their projects"
ON public.social_scrape_jobs FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = social_scrape_jobs.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can delete jobs in their projects"
ON public.social_scrape_jobs FOR DELETE
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = social_scrape_jobs.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Admins can view all jobs"
ON public.social_scrape_jobs FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Directors can view all jobs"
ON public.social_scrape_jobs FOR SELECT
USING (has_role(auth.uid(), 'director'));

-- RLS policies for social_results
CREATE POLICY "Users can view results in their projects"
ON public.social_results FOR SELECT
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = social_results.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can create results in their projects"
ON public.social_results FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = social_results.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can delete results in their projects"
ON public.social_results FOR DELETE
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = social_results.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Admins can view all results"
ON public.social_results FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Directors can view all results"
ON public.social_results FOR SELECT
USING (has_role(auth.uid(), 'director'));

-- Create indexes for performance
CREATE INDEX idx_social_scrape_jobs_project_id ON public.social_scrape_jobs(project_id);
CREATE INDEX idx_social_scrape_jobs_status ON public.social_scrape_jobs(status);
CREATE INDEX idx_social_scrape_jobs_platform ON public.social_scrape_jobs(platform);
CREATE INDEX idx_social_scrape_jobs_started_at ON public.social_scrape_jobs(started_at DESC);
CREATE INDEX idx_social_results_job_id ON public.social_results(job_id);
CREATE INDEX idx_social_results_project_id ON public.social_results(project_id);
CREATE INDEX idx_social_results_platform ON public.social_results(platform);
CREATE INDEX idx_social_results_published_at ON public.social_results(published_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_social_scrape_jobs_updated_at
BEFORE UPDATE ON public.social_scrape_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();-- Create table for storing comments from social posts
CREATE TABLE public.post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  social_result_id UUID REFERENCES public.social_results(id) ON DELETE CASCADE,
  mention_id UUID REFERENCES public.mentions(id) ON DELETE CASCADE,
  external_id TEXT,
  author_name TEXT,
  author_username TEXT,
  author_url TEXT,
  content TEXT NOT NULL,
  sentiment TEXT CHECK (sentiment IN ('positivo', 'neutral', 'negativo')),
  likes INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  published_at TIMESTAMP WITH TIME ZONE,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view comments in their projects" 
ON public.post_comments FOR SELECT 
USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = post_comments.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can create comments in their projects" 
ON public.post_comments FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = post_comments.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can delete comments in their projects" 
ON public.post_comments FOR DELETE 
USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = post_comments.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Admins can view all comments" 
ON public.post_comments FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Directors can view all comments" 
ON public.post_comments FOR SELECT 
USING (has_role(auth.uid(), 'director'::app_role));

-- Index for faster queries
CREATE INDEX idx_post_comments_project ON public.post_comments(project_id);
CREATE INDEX idx_post_comments_social_result ON public.post_comments(social_result_id);
CREATE INDEX idx_post_comments_mention ON public.post_comments(mention_id);-- Create table for Fanpage Karma profile configurations
CREATE TABLE public.fk_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  network TEXT NOT NULL CHECK (network IN ('facebook', 'instagram', 'youtube', 'linkedin', 'tiktok', 'threads', 'twitter')),
  profile_id TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  is_own_profile BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, network, profile_id)
);

-- Create table for cached KPI data from Fanpage Karma
CREATE TABLE public.fk_profile_kpis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fk_profile_id UUID NOT NULL REFERENCES public.fk_profiles(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  followers INTEGER,
  follower_growth_percent NUMERIC(10,4),
  engagement_rate NUMERIC(10,4),
  posts_per_day NUMERIC(10,2),
  reach_per_day INTEGER,
  impressions_per_interaction NUMERIC(10,4),
  page_performance_index NUMERIC(10,4),
  raw_data JSONB DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(fk_profile_id, period_start, period_end)
);

-- Enable RLS
ALTER TABLE public.fk_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fk_profile_kpis ENABLE ROW LEVEL SECURITY;

-- RLS policies for fk_profiles
CREATE POLICY "Users can view FK profiles in their projects"
  ON public.fk_profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = fk_profiles.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create FK profiles in their projects"
  ON public.fk_profiles FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = fk_profiles.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update FK profiles in their projects"
  ON public.fk_profiles FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = fk_profiles.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete FK profiles in their projects"
  ON public.fk_profiles FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = fk_profiles.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all FK profiles"
  ON public.fk_profiles FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Directors can view all FK profiles"
  ON public.fk_profiles FOR SELECT
  USING (has_role(auth.uid(), 'director'));

-- RLS policies for fk_profile_kpis
CREATE POLICY "Users can view FK KPIs in their projects"
  ON public.fk_profile_kpis FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM fk_profiles 
    JOIN projects ON projects.id = fk_profiles.project_id
    WHERE fk_profiles.id = fk_profile_kpis.fk_profile_id 
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create FK KPIs in their projects"
  ON public.fk_profile_kpis FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM fk_profiles 
    JOIN projects ON projects.id = fk_profiles.project_id
    WHERE fk_profiles.id = fk_profile_kpis.fk_profile_id 
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update FK KPIs in their projects"
  ON public.fk_profile_kpis FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM fk_profiles 
    JOIN projects ON projects.id = fk_profiles.project_id
    WHERE fk_profiles.id = fk_profile_kpis.fk_profile_id 
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all FK KPIs"
  ON public.fk_profile_kpis FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Directors can view all FK KPIs"
  ON public.fk_profile_kpis FOR SELECT
  USING (has_role(auth.uid(), 'director'));

-- Trigger for updated_at
CREATE TRIGGER update_fk_profiles_updated_at
  BEFORE UPDATE ON public.fk_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Create rankings table for independent ranking management
CREATE TABLE public.rankings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rankings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own rankings" 
ON public.rankings FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own rankings" 
ON public.rankings FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rankings" 
ON public.rankings FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rankings" 
ON public.rankings FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all rankings" 
ON public.rankings FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Directors can view all rankings" 
ON public.rankings FOR SELECT 
USING (has_role(auth.uid(), 'director'::app_role));

-- Add ranking_id to fk_profiles to link profiles to rankings instead of projects
ALTER TABLE public.fk_profiles ADD COLUMN ranking_id UUID REFERENCES public.rankings(id) ON DELETE CASCADE;

-- Make project_id nullable since profiles can belong to rankings instead
ALTER TABLE public.fk_profiles ALTER COLUMN project_id DROP NOT NULL;

-- Add position tracking for alerts
ALTER TABLE public.fk_profile_kpis ADD COLUMN position INTEGER;
ALTER TABLE public.fk_profile_kpis ADD COLUMN previous_position INTEGER;

-- Add trigger for updated_at
CREATE TRIGGER update_rankings_updated_at
BEFORE UPDATE ON public.rankings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();-- Update RLS policies for fk_profiles to support ranking-based profiles

-- Drop existing policies that need updating
DROP POLICY IF EXISTS "Users can create FK profiles in their projects" ON public.fk_profiles;
DROP POLICY IF EXISTS "Users can view FK profiles in their projects" ON public.fk_profiles;
DROP POLICY IF EXISTS "Users can update FK profiles in their projects" ON public.fk_profiles;
DROP POLICY IF EXISTS "Users can delete FK profiles in their projects" ON public.fk_profiles;

-- Create new policies that support both project-based and ranking-based profiles

-- INSERT: Allow if user owns the project OR the ranking
CREATE POLICY "Users can create FK profiles in their projects or rankings"
ON public.fk_profiles FOR INSERT
WITH CHECK (
  (project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM projects WHERE projects.id = fk_profiles.project_id AND projects.user_id = auth.uid()
  ))
  OR
  (ranking_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM rankings WHERE rankings.id = fk_profiles.ranking_id AND rankings.user_id = auth.uid()
  ))
);

-- SELECT: Allow if user owns the project OR the ranking
CREATE POLICY "Users can view FK profiles in their projects or rankings"
ON public.fk_profiles FOR SELECT
USING (
  (project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM projects WHERE projects.id = fk_profiles.project_id AND projects.user_id = auth.uid()
  ))
  OR
  (ranking_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM rankings WHERE rankings.id = fk_profiles.ranking_id AND rankings.user_id = auth.uid()
  ))
);

-- UPDATE: Allow if user owns the project OR the ranking
CREATE POLICY "Users can update FK profiles in their projects or rankings"
ON public.fk_profiles FOR UPDATE
USING (
  (project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM projects WHERE projects.id = fk_profiles.project_id AND projects.user_id = auth.uid()
  ))
  OR
  (ranking_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM rankings WHERE rankings.id = fk_profiles.ranking_id AND rankings.user_id = auth.uid()
  ))
);

-- DELETE: Allow if user owns the project OR the ranking
CREATE POLICY "Users can delete FK profiles in their projects or rankings"
ON public.fk_profiles FOR DELETE
USING (
  (project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM projects WHERE projects.id = fk_profiles.project_id AND projects.user_id = auth.uid()
  ))
  OR
  (ranking_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM rankings WHERE rankings.id = fk_profiles.ranking_id AND rankings.user_id = auth.uid()
  ))
);

-- Also update fk_profile_kpis policies to support ranking-based profiles
DROP POLICY IF EXISTS "Users can create FK KPIs in their projects" ON public.fk_profile_kpis;
DROP POLICY IF EXISTS "Users can view FK KPIs in their projects" ON public.fk_profile_kpis;
DROP POLICY IF EXISTS "Users can update FK KPIs in their projects" ON public.fk_profile_kpis;

-- INSERT for KPIs
CREATE POLICY "Users can create FK KPIs in their projects or rankings"
ON public.fk_profile_kpis FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM fk_profiles fp
    LEFT JOIN projects p ON p.id = fp.project_id
    LEFT JOIN rankings r ON r.id = fp.ranking_id
    WHERE fp.id = fk_profile_kpis.fk_profile_id
    AND (
      (fp.project_id IS NOT NULL AND p.user_id = auth.uid())
      OR
      (fp.ranking_id IS NOT NULL AND r.user_id = auth.uid())
    )
  )
);

-- SELECT for KPIs
CREATE POLICY "Users can view FK KPIs in their projects or rankings"
ON public.fk_profile_kpis FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM fk_profiles fp
    LEFT JOIN projects p ON p.id = fp.project_id
    LEFT JOIN rankings r ON r.id = fp.ranking_id
    WHERE fp.id = fk_profile_kpis.fk_profile_id
    AND (
      (fp.project_id IS NOT NULL AND p.user_id = auth.uid())
      OR
      (fp.ranking_id IS NOT NULL AND r.user_id = auth.uid())
    )
  )
);

-- UPDATE for KPIs
CREATE POLICY "Users can update FK KPIs in their projects or rankings"
ON public.fk_profile_kpis FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM fk_profiles fp
    LEFT JOIN projects p ON p.id = fp.project_id
    LEFT JOIN rankings r ON r.id = fp.ranking_id
    WHERE fp.id = fk_profile_kpis.fk_profile_id
    AND (
      (fp.project_id IS NOT NULL AND p.user_id = auth.uid())
      OR
      (fp.ranking_id IS NOT NULL AND r.user_id = auth.uid())
    )
  )
);-- Create auto-save configuration table per project
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
EXECUTE FUNCTION public.update_updated_at_column();-- Create table for daily top posts per profile/network
CREATE TABLE public.fk_daily_top_posts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    fk_profile_id UUID NOT NULL REFERENCES public.fk_profiles(id) ON DELETE CASCADE,
    network TEXT NOT NULL,
    post_date DATE NOT NULL,
    post_url TEXT,
    post_content TEXT,
    post_image_url TEXT,
    engagement INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    raw_data JSONB DEFAULT '{}'::jsonb,
    fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(fk_profile_id, network, post_date)
);

-- Enable RLS
ALTER TABLE public.fk_daily_top_posts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can view all daily top posts"
ON public.fk_daily_top_posts
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Directors can view all daily top posts"
ON public.fk_daily_top_posts
FOR SELECT
USING (has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Users can view daily top posts in their rankings"
ON public.fk_daily_top_posts
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM fk_profiles fp
        LEFT JOIN projects p ON p.id = fp.project_id
        LEFT JOIN rankings r ON r.id = fp.ranking_id
        WHERE fp.id = fk_daily_top_posts.fk_profile_id
        AND (
            (fp.project_id IS NOT NULL AND p.user_id = auth.uid())
            OR (fp.ranking_id IS NOT NULL AND r.user_id = auth.uid())
        )
    )
);

CREATE POLICY "Users can create daily top posts in their rankings"
ON public.fk_daily_top_posts
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM fk_profiles fp
        LEFT JOIN projects p ON p.id = fp.project_id
        LEFT JOIN rankings r ON r.id = fp.ranking_id
        WHERE fp.id = fk_daily_top_posts.fk_profile_id
        AND (
            (fp.project_id IS NOT NULL AND p.user_id = auth.uid())
            OR (fp.ranking_id IS NOT NULL AND r.user_id = auth.uid())
        )
    )
);

CREATE POLICY "Users can update daily top posts in their rankings"
ON public.fk_daily_top_posts
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM fk_profiles fp
        LEFT JOIN projects p ON p.id = fp.project_id
        LEFT JOIN rankings r ON r.id = fp.ranking_id
        WHERE fp.id = fk_daily_top_posts.fk_profile_id
        AND (
            (fp.project_id IS NOT NULL AND p.user_id = auth.uid())
            OR (fp.ranking_id IS NOT NULL AND r.user_id = auth.uid())
        )
    )
);

-- Create index for efficient queries
CREATE INDEX idx_fk_daily_top_posts_profile_date ON public.fk_daily_top_posts(fk_profile_id, post_date DESC);
CREATE INDEX idx_fk_daily_top_posts_network_date ON public.fk_daily_top_posts(network, post_date DESC);-- Add new entity types: tema and evento
ALTER TYPE public.entity_type ADD VALUE IF NOT EXISTS 'tema';
ALTER TYPE public.entity_type ADD VALUE IF NOT EXISTS 'evento';-- Table to store scheduled search configurations per project
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
$$;-- Add unique constraint on (fk_profile_id, network, post_date) for upsert to work
ALTER TABLE public.fk_daily_top_posts
ADD CONSTRAINT fk_daily_top_posts_profile_network_date_key
UNIQUE (fk_profile_id, network, post_date);