-- Create rankings table for independent ranking management
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
EXECUTE FUNCTION public.update_updated_at_column();