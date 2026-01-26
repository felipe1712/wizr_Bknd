-- Create table for storing comments from social posts
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
CREATE INDEX idx_post_comments_mention ON public.post_comments(mention_id);