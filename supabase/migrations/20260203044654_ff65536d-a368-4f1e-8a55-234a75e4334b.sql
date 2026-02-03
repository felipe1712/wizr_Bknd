-- Add unique constraint on (fk_profile_id, network, post_date) for upsert to work
ALTER TABLE public.fk_daily_top_posts
ADD CONSTRAINT fk_daily_top_posts_profile_network_date_key
UNIQUE (fk_profile_id, network, post_date);