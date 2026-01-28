-- Update RLS policies for fk_profiles to support ranking-based profiles

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
);