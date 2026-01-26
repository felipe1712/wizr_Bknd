-- Create enum for project types
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
EXECUTE FUNCTION public.update_updated_at_column();