import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type FKNetwork = "facebook" | "instagram" | "youtube" | "linkedin" | "tiktok" | "threads" | "twitter";

export interface FKProfile {
  id: string;
  project_id: string | null;
  ranking_id: string | null;
  network: FKNetwork;
  profile_id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_own_profile: boolean;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FKProfileKPI {
  id: string;
  fk_profile_id: string;
  period_start: string;
  period_end: string;
  followers: number | null;
  follower_growth_percent: number | null;
  engagement_rate: number | null;
  posts_per_day: number | null;
  reach_per_day: number | null;
  impressions_per_interaction: number | null;
  page_performance_index: number | null;
  position: number | null;
  previous_position: number | null;
  raw_data: Record<string, unknown>;
  fetched_at: string;
  /** True cuando el KPI no cae dentro del rango solicitado y se devolvió como fallback (último snapshot disponible). */
  isFallback?: boolean;
}

function getKpiRangeDays(kpi: Pick<FKProfileKPI, "period_start" | "period_end">): number {
  const start = new Date(`${kpi.period_start}T00:00:00Z`).getTime();
  const end = new Date(`${kpi.period_end}T00:00:00Z`).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}

type RequestedKpiRange = {
  start: string;
  end: string;
};

type KpiSelectionKind = "exact" | "overlap" | "latest";

function getKpiSelectionKind(kpi: Pick<FKProfileKPI, "period_start" | "period_end">, requested: RequestedKpiRange): KpiSelectionKind {
  if (kpi.period_start === requested.start && kpi.period_end === requested.end) {
    return "exact";
  }

  if (kpi.period_start <= requested.end && kpi.period_end >= requested.start) {
    return "overlap";
  }

  return "latest";
}

function getKpiOverlapDays(kpi: Pick<FKProfileKPI, "period_start" | "period_end">, requested: RequestedKpiRange): number {
  const overlapStart = Math.max(
    new Date(`${kpi.period_start}T00:00:00Z`).getTime(),
    new Date(`${requested.start}T00:00:00Z`).getTime(),
  );
  const overlapEnd = Math.min(
    new Date(`${kpi.period_end}T00:00:00Z`).getTime(),
    new Date(`${requested.end}T00:00:00Z`).getTime(),
  );

  if (Number.isNaN(overlapStart) || Number.isNaN(overlapEnd) || overlapEnd < overlapStart) {
    return 0;
  }

  return Math.round((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
}

function shouldReplaceRequestedKpi(candidate: FKProfileKPI, existing: FKProfileKPI, requested: RequestedKpiRange) {
  const priority: Record<KpiSelectionKind, number> = {
    exact: 0,
    overlap: 1,
    latest: 2,
  };

  const candidateKind = getKpiSelectionKind(candidate, requested);
  const existingKind = getKpiSelectionKind(existing, requested);

  if (candidateKind !== existingKind) {
    return priority[candidateKind] < priority[existingKind];
  }

  if (candidateKind === "overlap") {
    const candidateOverlap = getKpiOverlapDays(candidate, requested);
    const existingOverlap = getKpiOverlapDays(existing, requested);

    if (candidateOverlap !== existingOverlap) {
      return candidateOverlap > existingOverlap;
    }
  }

  const candidateRangeDays = getKpiRangeDays(candidate);
  const existingRangeDays = getKpiRangeDays(existing);

  if (candidateRangeDays !== existingRangeDays) {
    return candidateRangeDays < existingRangeDays;
  }

  return shouldReplaceLatestKpi(candidate, existing);
}

function shouldReplaceLatestKpi(candidate: FKProfileKPI, existing: FKProfileKPI) {
  const candidateEnd = new Date(`${candidate.period_end}T00:00:00Z`).getTime();
  const existingEnd = new Date(`${existing.period_end}T00:00:00Z`).getTime();

  if (candidateEnd !== existingEnd) {
    return candidateEnd > existingEnd;
  }

  const candidateRangeDays = getKpiRangeDays(candidate);
  const existingRangeDays = getKpiRangeDays(existing);

  if (candidateRangeDays !== existingRangeDays) {
    return candidateRangeDays < existingRangeDays;
  }

  return new Date(candidate.fetched_at).getTime() > new Date(existing.fetched_at).getTime();
}

function selectLatestKpisByProfile(rows: FKProfileKPI[]) {
  const latestByProfile = new Map<string, FKProfileKPI>();

  rows.forEach((row) => {
    const existing = latestByProfile.get(row.fk_profile_id);
    if (!existing || shouldReplaceLatestKpi(row, existing)) {
      latestByProfile.set(row.fk_profile_id, row);
    }
  });

  return latestByProfile;
}

export interface FKPost {
  id?: string;
  url?: string;
  title?: string;
  message?: string;
  content_type?: string;
  image_url?: string;
  published_at?: string;
  likes?: number;
  comments?: number;
  shares?: number;
  engagement?: number;
}

export interface BatchProfileInput {
  network: FKNetwork;
  profiles: string; // newline-separated profile IDs
}

const NETWORK_LABELS: Record<FKNetwork, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  threads: "Threads",
  twitter: "Twitter/X",
};

export const getNetworkLabel = (network: FKNetwork) => NETWORK_LABELS[network];

// For ranking-based profiles
export function useFKProfilesByRanking(rankingId: string | undefined) {
  return useQuery({
    queryKey: ["fk-profiles-ranking", rankingId],
    queryFn: async () => {
      if (!rankingId) return [];
      
      const { data, error } = await supabase
        .from("fk_profiles")
        .select("*")
        .eq("ranking_id", rankingId)
        .eq("is_active", true)
        .order("network", { ascending: true })
        .order("display_name", { ascending: true });

      if (error) throw error;
      return data as FKProfile[];
    },
    enabled: !!rankingId,
  });
}

// Legacy: For project-based profiles (backwards compatibility)
export function useFKProfiles(projectId: string | undefined) {
  return useQuery({
    queryKey: ["fk-profiles", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from("fk_profiles")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("network", { ascending: true })
        .order("display_name", { ascending: true });

      if (error) throw error;
      return data as FKProfile[];
    },
    enabled: !!projectId,
  });
}

export function useFKProfileKPIs(profileIds: string[], periodStart?: string, periodEnd?: string) {
  return useQuery({
    queryKey: ["fk-kpis", profileIds, periodStart, periodEnd],
    queryFn: async () => {
      if (profileIds.length === 0) return [];

      if (!periodStart || !periodEnd) {
        const { data, error } = await supabase
          .from("fk_profile_kpis")
          .select("*")
          .in("fk_profile_id", profileIds)
          .order("period_end", { ascending: false })
          .order("fetched_at", { ascending: false });

        if (error) throw error;

        return Array.from(selectLatestKpisByProfile((data as FKProfileKPI[]) || []).values());
      }

      const requestedRange: RequestedKpiRange = {
        start: periodStart,
        end: periodEnd,
      };

      const { data, error } = await supabase
        .from("fk_profile_kpis")
        .select("*")
        .in("fk_profile_id", profileIds)
        .order("period_end", { ascending: false })
        .order("fetched_at", { ascending: false });

      if (error) throw error;

      const selectedByProfile = new Map<string, FKProfileKPI>();

      ((data as FKProfileKPI[]) || []).forEach((row) => {
        const existing = selectedByProfile.get(row.fk_profile_id);
        if (!existing || shouldReplaceRequestedKpi(row, existing, requestedRange)) {
          selectedByProfile.set(row.fk_profile_id, row);
        }
      });

      return profileIds.flatMap((id) => {
        const row = selectedByProfile.get(id);
        if (!row) return [];

        return [{
          ...row,
          isFallback: getKpiSelectionKind(row, requestedRange) !== "exact",
        }];
      });
    },
    enabled: profileIds.length > 0,
  });
}

export function useAddFKProfilesToRanking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rankingId, batch }: { rankingId: string; batch: BatchProfileInput }) => {
      const profileLines = batch.profiles
        .split("\n")
        .map((line) => line.trim().replace(/^@/, ""))
        .filter((line) => line.length > 0);

      if (profileLines.length === 0) {
        throw new Error("No se proporcionaron perfiles válidos");
      }

      const profilesToInsert = profileLines.map((profileId) => ({
        ranking_id: rankingId,
        project_id: null,
        network: batch.network,
        profile_id: profileId,
        display_name: profileId,
        is_own_profile: false,
        is_active: true,
      }));

      const { data, error } = await supabase
        .from("fk_profiles")
        .insert(profilesToInsert)
        .select();

      if (error) throw error;
      return { inserted: data.length, network: batch.network };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["fk-profiles-ranking", variables.rankingId] });
      toast.success(`${result.inserted} perfiles de ${getNetworkLabel(result.network as FKNetwork)} agregados`);
    },
    onError: (error: Error) => {
      toast.error(`Error al agregar perfiles: ${error.message}`);
    },
  });
}

// Legacy: For project-based profiles
export function useAddFKProfiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, batch }: { projectId: string; batch: BatchProfileInput }) => {
      const profileLines = batch.profiles
        .split("\n")
        .map((line) => line.trim().replace(/^@/, ""))
        .filter((line) => line.length > 0);

      if (profileLines.length === 0) {
        throw new Error("No se proporcionaron perfiles válidos");
      }

      const profilesToInsert = profileLines.map((profileId) => ({
        project_id: projectId,
        ranking_id: null,
        network: batch.network,
        profile_id: profileId,
        display_name: profileId,
        is_own_profile: false,
        is_active: true,
      }));

      const { data, error } = await supabase
        .from("fk_profiles")
        .upsert(profilesToInsert, { onConflict: "project_id,network,profile_id" })
        .select();

      if (error) throw error;
      return { inserted: data.length, network: batch.network };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["fk-profiles", variables.projectId] });
      toast.success(`${result.inserted} perfiles de ${getNetworkLabel(result.network as FKNetwork)} agregados`);
    },
    onError: (error: Error) => {
      toast.error(`Error al agregar perfiles: ${error.message}`);
    },
  });
}

export function useDeleteFKProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileId, rankingId }: { profileId: string; rankingId?: string }) => {
      const { error } = await supabase
        .from("fk_profiles")
        .delete()
        .eq("id", profileId);

      if (error) throw error;
      return rankingId;
    },
    onSuccess: (rankingId) => {
      queryClient.invalidateQueries({ queryKey: ["fk-profiles-ranking", rankingId] });
      queryClient.invalidateQueries({ queryKey: ["fk-profiles"] });
      toast.success("Perfil eliminado");
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar: ${error.message}`);
    },
  });
}

export function useBulkDeleteFKProfiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileIds, rankingId }: { profileIds: string[]; rankingId?: string }) => {
      if (profileIds.length === 0) {
        throw new Error("No se seleccionaron perfiles");
      }

      const { error } = await supabase
        .from("fk_profiles")
        .delete()
        .in("id", profileIds);

      if (error) throw error;
      return { count: profileIds.length, rankingId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["fk-profiles-ranking", result.rankingId] });
      queryClient.invalidateQueries({ queryKey: ["fk-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["fk-kpis"] });
      toast.success(`${result.count} perfiles eliminados`);
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar: ${error.message}`);
    },
  });
}

// Minimum hours between syncs for a single profile
const MIN_SYNC_INTERVAL_HOURS = 12;

function canSyncProfile(profile: FKProfile): boolean {
  if (!profile.last_synced_at) return true;
  const lastSync = new Date(profile.last_synced_at).getTime();
  const now = Date.now();
  return (now - lastSync) >= MIN_SYNC_INTERVAL_HOURS * 60 * 60 * 1000;
}

export function useSyncFKProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profile, periodDays = 28, force = false }: { profile: FKProfile; periodDays?: number; force?: boolean }) => {
      // Throttle: skip if recently synced (unless forced)
      if (!force && !canSyncProfile(profile)) {
        const hoursAgo = Math.round((Date.now() - new Date(profile.last_synced_at!).getTime()) / (1000 * 60 * 60));
        throw new Error(`Perfil sincronizado hace ${hoursAgo}h. Siguiente sync disponible en ${MIN_SYNC_INTERVAL_HOURS - hoursAgo}h. Usa "forzar" para omitir.`);
      }
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - periodDays);

      const period = `${startDate.toISOString().split("T")[0]}_${endDate.toISOString().split("T")[0]}`;

      const { data, error } = await supabase.functions.invoke("fanpage-karma", {
        body: {
          action: "kpi",
          network: profile.network,
          profileId: profile.profile_id,
          period,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Error al obtener KPIs");

      // Store the KPIs - extract values from Fanpage Karma response structure
      const kpiData = data.data || {};
      
          // Fanpage Karma returns metrics as objects with { title, value, formatted_value }
          // Field names differ by network:
          // - Facebook/LinkedIn: page_* (page_follower, page_engagement, page_posts_per_day)
          // - Instagram/Twitter/Threads/TikTok: profile_* (profile_followers, profile_engagement)
          // - YouTube: channel_* (channel_subscribers_count, channel_video_interaction)
          const extractValue = (key: string): number | null => {
            const metric = kpiData[key];
            if (metric && typeof metric === 'object' && 'value' in metric) {
              return metric.value;
            }
            return null;
          };

          let followers: number | null = null;
          let followerGrowth: number | null = null;
          let engagement: number | null = null;
          let postsPerDay: number | null = null;
          let performanceIndex: number | null = null;

          if (profile.network === 'youtube') {
            // YouTube uses channel_* prefix
            followers = extractValue('channel_subscribers_count');
            followerGrowth = extractValue('channel_subscribers_growth');
            engagement = extractValue('channel_video_interaction');
            postsPerDay = extractValue('channel_videos_per_day');
            performanceIndex = null;
          } else if (profile.network === 'tiktok') {
            // TikTok uses tiktoker_* prefix
            followers =
              extractValue('tiktoker_profile_follower_count') ||
              extractValue('tiktoker_followers') ||
              extractValue('tiktoker_followers_count') ||
              extractValue('tiktoker_fans') ||
              extractValue('tiktoker_fans_count');
            followerGrowth = extractValue('tiktoker_followers_growth_percent');
            engagement = extractValue('tiktoker_post_engagement') || extractValue('tiktoker_engagement');
            postsPerDay = extractValue('tiktoker_post_count_per_day') || extractValue('tiktoker_video_count_per_day');
            performanceIndex = extractValue('tiktoker_performance_index');
          } else if (['instagram', 'twitter', 'threads'].includes(profile.network)) {
            // These networks use profile_* prefix
            followers = extractValue('profile_followers');
            followerGrowth = extractValue('profile_followers_growth_percent');
            engagement = extractValue('profile_engagement') || extractValue('profile_media_interaction') || extractValue('profile_post_interaction');
            postsPerDay = extractValue('profile_posts_per_day') || extractValue('profile_media_per_day') || extractValue('profile_videos_per_day');
            performanceIndex = extractValue('profile_performance_index');
          } else {
            // Facebook/LinkedIn use page_* prefix
            followers = extractValue('page_follower') || extractValue('page_fans');
            followerGrowth = extractValue('page_fans_growth_percent');
            engagement = extractValue('page_engagement') || extractValue('page_post_interaction');
            postsPerDay = extractValue('page_posts_per_day');
            performanceIndex = extractValue('page_performance_index');
          }

      const { error: insertError } = await supabase
        .from("fk_profile_kpis")
        .upsert({
          fk_profile_id: profile.id,
          period_start: startDate.toISOString().split("T")[0],
          period_end: endDate.toISOString().split("T")[0],
          followers: followers,
          follower_growth_percent: followerGrowth,
          engagement_rate: engagement,
          posts_per_day: postsPerDay,
          reach_per_day: null,
          impressions_per_interaction: null,
          page_performance_index: performanceIndex,
          raw_data: kpiData,
          fetched_at: new Date().toISOString(),
        }, { onConflict: "fk_profile_id,period_start,period_end" });

      if (insertError) throw insertError;

      // Extract display_name from metadata if available
      const metadata = data.metadata || {};
      let displayName: string | null = null;
      let avatarUrl: string | null = null;
      
      // Fanpage Karma returns profile name in metadata
      if (metadata.name) {
        displayName = metadata.name;
      } else if (metadata.title) {
        displayName = metadata.title;
      } else if (metadata.profile_name) {
        displayName = metadata.profile_name;
      } else if (metadata.page_name) {
        displayName = metadata.page_name;
      } else if (metadata.channel_name) {
        displayName = metadata.channel_name;
      }
      
      // Try to get avatar from metadata
      if (metadata.image) {
        avatarUrl = metadata.image;
      } else if (metadata.picture) {
        avatarUrl = metadata.picture;
      } else if (metadata.avatar) {
        avatarUrl = metadata.avatar;
      }

      // Update last_synced_at and display_name if found
      const updateData: { last_synced_at: string; display_name?: string; avatar_url?: string } = {
        last_synced_at: new Date().toISOString(),
      };
      if (displayName && displayName !== profile.profile_id) {
        updateData.display_name = displayName;
      }
      if (avatarUrl) {
        updateData.avatar_url = avatarUrl;
      }
      
      await supabase
        .from("fk_profiles")
        .update(updateData)
        .eq("id", profile.id);

      return { profile, kpiData };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["fk-profiles-ranking"] });
      queryClient.invalidateQueries({ queryKey: ["fk-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["fk-kpis"] });
      toast.success(`KPIs de ${result.profile.display_name || result.profile.profile_id} sincronizados`);
    },
    onError: (error: Error) => {
      toast.error(`Error al sincronizar: ${error.message}`);
    },
  });
}

export function useSyncAllProfiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profiles, periodDays = 28, force = false }: { profiles: FKProfile[]; periodDays?: number; force?: boolean }) => {
      // Filter to only profiles that need syncing (unless forced)
      const profilesToSync = force ? profiles : profiles.filter(canSyncProfile);
      const skippedCount = profiles.length - profilesToSync.length;
      
      if (profilesToSync.length === 0) {
        return { 
          success: 0, 
          failed: 0, 
          skipped: skippedCount,
          errors: [] as string[],
        };
      }
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - periodDays);

      const results: { success: number; failed: number; skipped: number; errors: string[] } = {
        success: 0,
        failed: 0,
        skipped: skippedCount,
        errors: [],
      };

      for (const profile of profilesToSync) {
        try {
          const period = `${startDate.toISOString().split("T")[0]}_${endDate.toISOString().split("T")[0]}`;

          const { data, error } = await supabase.functions.invoke("fanpage-karma", {
            body: {
              action: "kpi",
              network: profile.network,
              profileId: profile.profile_id,
              period,
            },
          });

          if (error) throw error;
          if (!data.success) throw new Error(data.error || "Error al obtener KPIs");

          const kpiData = data.data || {};
          
          // Fanpage Karma returns metrics as objects with { title, value, formatted_value }
          const extractValue = (key: string): number | null => {
            const metric = kpiData[key];
            if (metric && typeof metric === 'object' && 'value' in metric) {
              return metric.value;
            }
            return null;
          };

          let followers: number | null = null;
          let followerGrowth: number | null = null;
          let engagement: number | null = null;
          let postsPerDay: number | null = null;
          let performanceIndex: number | null = null;

          if (profile.network === 'youtube') {
            // YouTube uses channel_* prefix
            followers = extractValue('channel_subscribers_count');
            followerGrowth = extractValue('channel_subscribers_growth');
            engagement = extractValue('channel_video_interaction');
            postsPerDay = extractValue('channel_videos_per_day');
            performanceIndex = null;
          } else if (profile.network === 'tiktok') {
            // TikTok uses tiktoker_* prefix
            followers =
              extractValue('tiktoker_profile_follower_count') ||
              extractValue('tiktoker_followers') ||
              extractValue('tiktoker_followers_count') ||
              extractValue('tiktoker_fans') ||
              extractValue('tiktoker_fans_count');
            followerGrowth = extractValue('tiktoker_followers_growth_percent');
            engagement = extractValue('tiktoker_post_engagement') || extractValue('tiktoker_engagement');
            postsPerDay = extractValue('tiktoker_post_count_per_day') || extractValue('tiktoker_video_count_per_day');
            performanceIndex = extractValue('tiktoker_performance_index');
          } else if (['instagram', 'twitter', 'threads'].includes(profile.network)) {
            // These networks use profile_* prefix
            followers = extractValue('profile_followers');
            followerGrowth = extractValue('profile_followers_growth_percent');
            engagement = extractValue('profile_engagement') || extractValue('profile_media_interaction') || extractValue('profile_post_interaction');
            postsPerDay = extractValue('profile_posts_per_day') || extractValue('profile_media_per_day') || extractValue('profile_videos_per_day');
            performanceIndex = extractValue('profile_performance_index');
          } else {
            // Facebook/LinkedIn use page_* prefix
            followers = extractValue('page_follower') || extractValue('page_fans');
            followerGrowth = extractValue('page_fans_growth_percent');
            engagement = extractValue('page_engagement') || extractValue('page_post_interaction');
            postsPerDay = extractValue('page_posts_per_day');
            performanceIndex = extractValue('page_performance_index');
          }

           const { error: upsertError } = await supabase
            .from("fk_profile_kpis")
            .upsert({
              fk_profile_id: profile.id,
              period_start: startDate.toISOString().split("T")[0],
              period_end: endDate.toISOString().split("T")[0],
               followers,
               follower_growth_percent: followerGrowth,
               engagement_rate: engagement,
               posts_per_day: postsPerDay,
              reach_per_day: null,
              impressions_per_interaction: null,
               page_performance_index: performanceIndex,
              raw_data: kpiData,
              fetched_at: new Date().toISOString(),
            }, { onConflict: "fk_profile_id,period_start,period_end" });

           // IMPORTANT: upsert can fail silently unless we check the returned error
           if (upsertError) throw upsertError;

          // Extract display_name from metadata if available
          const metadata = data.metadata || {};
          let displayName: string | null = null;
          let avatarUrl: string | null = null;
          
          if (metadata.name) {
            displayName = metadata.name;
          } else if (metadata.title) {
            displayName = metadata.title;
          } else if (metadata.profile_name) {
            displayName = metadata.profile_name;
          } else if (metadata.page_name) {
            displayName = metadata.page_name;
          } else if (metadata.channel_name) {
            displayName = metadata.channel_name;
          }
          
          if (metadata.image) {
            avatarUrl = metadata.image;
          } else if (metadata.picture) {
            avatarUrl = metadata.picture;
          } else if (metadata.avatar) {
            avatarUrl = metadata.avatar;
          }

          const updateData: { last_synced_at: string; display_name?: string; avatar_url?: string } = {
            last_synced_at: new Date().toISOString(),
          };
          if (displayName && displayName !== profile.profile_id) {
            updateData.display_name = displayName;
          }
          if (avatarUrl) {
            updateData.avatar_url = avatarUrl;
          }

          await supabase
            .from("fk_profiles")
            .update(updateData)
            .eq("id", profile.id);

          results.success++;
        } catch (err) {
          results.failed++;
          results.errors.push(`${profile.display_name || profile.profile_id}: ${(err as Error).message}`);
        }
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["fk-profiles-ranking"] });
      queryClient.invalidateQueries({ queryKey: ["fk-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["fk-kpis"] });
      
      const parts: string[] = [];
      if (results.success > 0) parts.push(`${results.success} sincronizados`);
      if (results.skipped > 0) parts.push(`${results.skipped} omitidos (ya actualizados)`);
      if (results.failed > 0) parts.push(`${results.failed} con errores`);
      
      if (results.failed === 0) {
        toast.success(parts.join(", "));
      } else if (results.success > 0) {
        toast.warning(parts.join(", "));
      } else {
        toast.error(parts.join(", "));
      }
    },
    onError: (error: Error) => {
      toast.error(`Error general: ${error.message}`);
    },
  });
}

export function useFetchProfilePosts(profile: FKProfile | undefined) {
  return useQuery({
    queryKey: ["fk-posts", profile?.id],
    queryFn: async (): Promise<FKPost[]> => {
      if (!profile) return [];

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 28);

      const period = `${startDate.toISOString().split("T")[0]}_${endDate.toISOString().split("T")[0]}`;

      const { data, error } = await supabase.functions.invoke("fanpage-karma", {
        body: {
          action: "posts",
          network: profile.network,
          profileId: profile.profile_id,
          period,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Error al obtener posts");

      // Fanpage Karma returns posts inside data.data.posts array
      const rawData = data.data || {};
      const postsData = Array.isArray(rawData) ? rawData : (rawData.posts || []);
      
      console.log("Posts data received:", postsData.length, "posts");
      
      // Transform Fanpage Karma posts format - map their field names to ours
      return postsData.slice(0, 100).map((post: Record<string, unknown>, index: number) => {
        // Fanpage Karma returns engagement metrics inside a nested 'kpi' object
        // Each metric is an object with { title, value, formatted_value }
        const kpi = (post.kpi as Record<string, { title?: string; value?: number; formatted_value?: string }>) || {};
        
        // Extract KPI values - these are nested inside the kpi object
        const extractKpiValue = (key: string): number => {
          const metric = kpi[key];
          if (metric && typeof metric === 'object' && 'value' in metric) {
            return Number(metric.value) || 0;
          }
          return 0;
        };
        
        // Different networks may use different field names for the same metrics
        const likes = extractKpiValue('page_posts_likes_count') || 
                      extractKpiValue('profile_post_likes_count') ||
                      extractKpiValue('page_posts_reactions') ||
                      Number(post.likes) || 0;
                      
        const comments = extractKpiValue('page_posts_comments_count') || 
                         extractKpiValue('profile_post_comments_count') ||
                         Number(post.comments) || 0;
                         
        const shares = extractKpiValue('page_posts_shares_count') || 
                       extractKpiValue('profile_post_shares_count') ||
                       Number(post.shares) || 0;
                       
        const totalEngagement = extractKpiValue('page_total_engagement_count') ||
                                extractKpiValue('profile_total_engagement_count') ||
                                (likes + comments + shares);
        
        return {
          id: (post.id as string) || `${profile.id}-${index}`,
          url: (post.link as string) || (post.url as string) || null,
          title: (post.title as string) || null,
          message: (post.message as string) || (post.description as string) || null,
          content_type: (post.type as string) || (post.content_type as string) || 'post',
          image_url: (post.image as string) || (post.picture as string) || null,
          published_at: (post.date as string) || (post.created_time as string) || null,
          likes,
          comments,
          shares,
          engagement: totalEngagement,
        };
      });
    },
    enabled: !!profile,
    staleTime: 60 * 60 * 1000, // 1 hour - avoid excessive API calls
  });
}

// Hook to get all historical KPIs for trend analysis
export function useFKAllKPIs(profileIds: string[]) {
  return useQuery({
    queryKey: ["fk-all-kpis", profileIds],
    queryFn: async () => {
      if (profileIds.length === 0) return [];

      const { data, error } = await supabase
        .from("fk_profile_kpis")
        .select("*")
        .in("fk_profile_id", profileIds)
        .order("period_end", { ascending: true });

      if (error) throw error;
      return data as FKProfileKPI[];
    },
    enabled: profileIds.length > 0,
  });
}

// ============ DAILY TOP POSTS ============

export interface FKDailyTopPost {
  id: string;
  fk_profile_id: string;
  network: string;
  post_date: string;
  post_url: string | null;
  post_content: string | null;
  post_image_url: string | null;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  raw_data: Record<string, unknown>;
  fetched_at: string;
}

export function useFKTopPosts(profileIds: string[], startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["fk-top-posts", profileIds, startDate, endDate],
    queryFn: async () => {
      if (profileIds.length === 0) return [];

      const PAGE = 1000;
      const allPosts: Array<{
        id: string;
        fk_profile_id: string;
        network: string;
        published_at: string;
        message: string | null;
        link: string | null;
        post_image_url: string | null;
        engagement: number | null;
        likes: number | null;
        comments: number | null;
        shares: number | null;
        raw_data: unknown;
      }> = [];

      let from = 0;
      while (from < 50000) {
        let query = supabase
          .from("fk_posts")
          .select("id, fk_profile_id, network, published_at, message, link, post_image_url, engagement, likes, comments, shares, raw_data")
          .in("fk_profile_id", profileIds)
          .order("published_at", { ascending: false })
          .range(from, from + PAGE - 1);

        if (startDate) {
          query = query.gte("published_at", `${startDate}T00:00:00`);
        }
        if (endDate) {
          query = query.lte("published_at", `${endDate}T23:59:59`);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;

        allPosts.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      return allPosts.map((post) => {
        const rawData = (post.raw_data && typeof post.raw_data === "object" ? post.raw_data : {}) as Record<string, unknown>;
        const rawViews = rawData.views ?? rawData.view_count ?? rawData.video_views;
        const views = typeof rawViews === "number" ? rawViews : Number(rawViews || 0);

        return {
          id: post.id,
          fk_profile_id: post.fk_profile_id,
          network: post.network,
          post_date: post.published_at?.slice(0, 10) || "",
          post_url: post.link,
          post_content: post.message,
          post_image_url: post.post_image_url,
          engagement: post.engagement || ((post.likes || 0) + (post.comments || 0) + (post.shares || 0)),
          likes: post.likes || 0,
          comments: post.comments || 0,
          shares: post.shares || 0,
          views,
          raw_data: {
            ...rawData,
            published_at: post.published_at,
          },
          fetched_at: post.published_at,
        } satisfies FKDailyTopPost;
      });
    },
    enabled: profileIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useFKDailyTopPosts(profileIds: string[], startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["fk-daily-top-posts", profileIds, startDate, endDate],
    queryFn: async () => {
      if (profileIds.length === 0) return [];

      let query = supabase
        .from("fk_daily_top_posts")
        .select("*")
        .in("fk_profile_id", profileIds)
        .order("post_date", { ascending: false });

      if (startDate) {
        query = query.gte("post_date", startDate);
      }
      if (endDate) {
        query = query.lte("post_date", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FKDailyTopPost[];
    },
    enabled: profileIds.length > 0,
  });
}

export function useFKDailyTopPostsByRanking(rankingId: string | undefined, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["fk-daily-top-posts-ranking", rankingId, startDate, endDate],
    queryFn: async () => {
      if (!rankingId) return [];

      // First get profile IDs for this ranking
      const { data: profiles, error: profilesError } = await supabase
        .from("fk_profiles")
        .select("id")
        .eq("ranking_id", rankingId)
        .eq("is_active", true);

      if (profilesError) throw profilesError;
      if (!profiles || profiles.length === 0) return [];

      const profileIds = profiles.map(p => p.id);

      let query = supabase
        .from("fk_daily_top_posts")
        .select("*")
        .in("fk_profile_id", profileIds)
        .order("post_date", { ascending: false });

      if (startDate) {
        query = query.gte("post_date", startDate);
      }
      if (endDate) {
        query = query.lte("post_date", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FKDailyTopPost[];
    },
    enabled: !!rankingId,
  });
}

// =====================================================
// Period post metrics — computed from fk_posts in real time
// =====================================================
export interface FKPeriodPostMetrics {
  postCount: number;
  avgEngagement: number;
  topPost: {
    engagement: number;
    message: string | null;
    link: string | null;
    published_at: string;
  } | null;
}

export function useFKPeriodPostMetrics(
  profileIds: string[],
  startDate?: string,
  endDate?: string,
) {
  return useQuery({
    queryKey: ["fk-period-post-metrics", profileIds, startDate, endDate],
    queryFn: async () => {
      const result = new Map<string, FKPeriodPostMetrics>();
      if (profileIds.length === 0 || !startDate || !endDate) return result;

      const startISO = `${startDate}T00:00:00Z`;
      const endISO = `${endDate}T23:59:59Z`;

      // Paginate to bypass 1000 row default limit
      const pageSize = 1000;
      let from = 0;
      const allPosts: Array<{
        fk_profile_id: string;
        engagement: number | null;
        message: string | null;
        link: string | null;
        published_at: string;
      }> = [];

      while (true) {
        const { data, error } = await supabase
          .from("fk_posts")
          .select("fk_profile_id, engagement, message, link, published_at")
          .in("fk_profile_id", profileIds)
          .gte("published_at", startISO)
          .lte("published_at", endISO)
          .order("engagement", { ascending: false, nullsFirst: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        allPosts.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      // Group by profile
      const byProfile = new Map<string, typeof allPosts>();
      for (const p of allPosts) {
        const arr = byProfile.get(p.fk_profile_id) ?? [];
        arr.push(p);
        byProfile.set(p.fk_profile_id, arr);
      }

      for (const [pid, posts] of byProfile.entries()) {
        const engagements = posts.map((p) => p.engagement ?? 0);
        const total = engagements.reduce((a, b) => a + b, 0);
        const top = posts.reduce<typeof posts[number] | null>(
          (best, p) => (!best || (p.engagement ?? 0) > (best.engagement ?? 0) ? p : best),
          null,
        );
        result.set(pid, {
          postCount: posts.length,
          avgEngagement: posts.length > 0 ? Math.round(total / posts.length) : 0,
          topPost: top
            ? {
                engagement: top.engagement ?? 0,
                message: top.message,
                link: top.link,
                published_at: top.published_at,
              }
            : null,
        });
      }

      return result;
    },
    enabled: profileIds.length > 0 && !!startDate && !!endDate,
  });
}
