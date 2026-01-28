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

      let query = supabase
        .from("fk_profile_kpis")
        .select("*")
        .in("fk_profile_id", profileIds)
        .order("fetched_at", { ascending: false });

      if (periodStart && periodEnd) {
        query = query.eq("period_start", periodStart).eq("period_end", periodEnd);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FKProfileKPI[];
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

export function useSyncFKProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profile, periodDays = 28 }: { profile: FKProfile; periodDays?: number }) => {
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
          // - Instagram/TikTok/Twitter/YouTube/Threads: profile_* (profile_followers, profile_engagement)
          const extractValue = (key: string): number | null => {
            const metric = kpiData[key];
            if (metric && typeof metric === 'object' && 'value' in metric) {
              return metric.value;
            }
            return null;
          };

          // Networks that use "profile_*" field naming (vs "page_*" for Facebook/LinkedIn)
          const usesProfilePrefix = ['instagram', 'tiktok', 'twitter', 'youtube', 'threads'].includes(profile.network);
          
          const followers = usesProfilePrefix 
            ? extractValue('profile_followers') 
            : (extractValue('page_follower') || extractValue('page_fans'));
          
          const followerGrowth = usesProfilePrefix
            ? extractValue('profile_followers_growth_percent')
            : extractValue('page_fans_growth_percent');
          
          const engagement = usesProfilePrefix
            ? (extractValue('profile_engagement') || extractValue('profile_media_interaction') || extractValue('profile_post_interaction'))
            : (extractValue('page_engagement') || extractValue('page_post_interaction'));
          
          const postsPerDay = usesProfilePrefix
            ? (extractValue('profile_posts_per_day') || extractValue('profile_media_per_day') || extractValue('profile_videos_per_day'))
            : extractValue('page_posts_per_day');
          
          const performanceIndex = usesProfilePrefix
            ? extractValue('profile_performance_index')
            : extractValue('page_performance_index');

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

      // Update last_synced_at
      await supabase
        .from("fk_profiles")
        .update({ last_synced_at: new Date().toISOString() })
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
    mutationFn: async ({ profiles, periodDays = 28 }: { profiles: FKProfile[]; periodDays?: number }) => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - periodDays);

      const results: { success: number; failed: number; errors: string[] } = {
        success: 0,
        failed: 0,
        errors: [],
      };

      for (const profile of profiles) {
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

          // Networks that use "profile_*" field naming (vs "page_*" for Facebook/LinkedIn)
          const usesProfilePrefix = ['instagram', 'tiktok', 'twitter', 'youtube', 'threads'].includes(profile.network);

          const followers = usesProfilePrefix
            ? extractValue('profile_followers')
            : (extractValue('page_follower') || extractValue('page_fans'));

          const followerGrowth = usesProfilePrefix
            ? extractValue('profile_followers_growth_percent')
            : extractValue('page_fans_growth_percent');

          const engagement = usesProfilePrefix
            ? (extractValue('profile_engagement') || extractValue('profile_media_interaction') || extractValue('profile_post_interaction'))
            : (extractValue('page_engagement') || extractValue('page_post_interaction'));

          const postsPerDay = usesProfilePrefix
            ? (extractValue('profile_posts_per_day') || extractValue('profile_media_per_day') || extractValue('profile_videos_per_day'))
            : extractValue('page_posts_per_day');

          const performanceIndex = usesProfilePrefix
            ? extractValue('profile_performance_index')
            : extractValue('page_performance_index');

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

          await supabase
            .from("fk_profiles")
            .update({ last_synced_at: new Date().toISOString() })
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
      
      if (results.success > 0 && results.failed === 0) {
        toast.success(`${results.success} perfiles sincronizados exitosamente`);
      } else if (results.success > 0 && results.failed > 0) {
        toast.warning(`${results.success} sincronizados, ${results.failed} con errores`);
      } else {
        toast.error(`Falló la sincronización de ${results.failed} perfiles`);
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
      return postsData.slice(0, 50).map((post: Record<string, unknown>, index: number) => {
        // Fanpage Karma uses direct values, not nested objects for posts
        return {
          id: (post.id as string) || `${profile.id}-${index}`,
          url: (post.link as string) || (post.url as string) || null,
          title: (post.title as string) || null,
          message: (post.message as string) || (post.description as string) || null,
          content_type: (post.type as string) || (post.content_type as string) || 'post',
          image_url: (post.image as string) || (post.picture as string) || null,
          published_at: (post.date as string) || (post.created_time as string) || null,
          likes: Number(post.likes) || Number(post.reactions) || 0,
          comments: Number(post.comments) || 0,
          shares: Number(post.shares) || 0,
          engagement: Number(post.interaction) || Number(post.engagement) || 0,
        };
      });
    },
    enabled: !!profile,
    staleTime: 5 * 60 * 1000, // 5 minutes
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
