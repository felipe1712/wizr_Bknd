-- Create mentions table for storing search results
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
ALTER PUBLICATION supabase_realtime ADD TABLE public.mentions;