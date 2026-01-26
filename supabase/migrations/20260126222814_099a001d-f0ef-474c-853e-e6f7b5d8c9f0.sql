-- Create table to store social media scrape jobs
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
EXECUTE FUNCTION public.update_updated_at_column();