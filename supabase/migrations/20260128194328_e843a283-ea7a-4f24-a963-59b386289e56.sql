-- Create table for daily top posts per profile/network
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
CREATE INDEX idx_fk_daily_top_posts_network_date ON public.fk_daily_top_posts(network, post_date DESC);