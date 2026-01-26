import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

export interface SocialScrapeJob {
  id: string;
  project_id: string;
  platform: string;
  search_type: string;
  search_value: string;
  run_id: string | null;
  dataset_id: string | null;
  status: string;
  max_results: number;
  results_count: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface SocialResult {
  id: string;
  job_id: string;
  project_id: string;
  platform: string;
  external_id: string | null;
  title: string | null;
  description: string | null;
  author_name: string | null;
  author_username: string | null;
  author_url: string | null;
  author_avatar_url: string | null;
  author_verified: boolean;
  author_followers: number;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  engagement: number;
  published_at: string | null;
  url: string | null;
  content_type: string;
  hashtags: string[];
  mentions: string[];
  raw_data: Json;
  created_at: string;
}

interface JobFilters {
  platform?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export function useSocialScrapeJobs(projectId: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<JobFilters>({});

  // Fetch jobs for the project
  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = useQuery({
    queryKey: ["social-scrape-jobs", projectId, filters],
    queryFn: async () => {
      if (!projectId) return [];

      let query = supabase
        .from("social_scrape_jobs")
        .select("*")
        .eq("project_id", projectId)
        .order("started_at", { ascending: false });

      if (filters.platform) {
        query = query.eq("platform", filters.platform);
      }
      if (filters.status) {
        query = query.eq("status", filters.status);
      }
      if (filters.dateFrom) {
        query = query.gte("started_at", filters.dateFrom.toISOString());
      }
      if (filters.dateTo) {
        query = query.lte("started_at", filters.dateTo.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SocialScrapeJob[];
    },
    enabled: !!projectId,
  });

  // Fetch results for a specific job
  const fetchJobResults = async (jobId: string) => {
    const { data, error } = await supabase
      .from("social_results")
      .select("*")
      .eq("job_id", jobId)
      .order("published_at", { ascending: false });

    if (error) throw error;
    return data as SocialResult[];
  };

  // Create a new job
  const createJobMutation = useMutation({
    mutationFn: async (job: {
      project_id: string;
      platform: string;
      search_type: string;
      search_value: string;
      max_results: number;
    }) => {
      const { data, error } = await supabase
        .from("social_scrape_jobs")
        .insert({
          ...job,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return data as SocialScrapeJob;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-scrape-jobs", projectId] });
    },
  });

  // Update job status
  const updateJobMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: {
        run_id?: string;
        dataset_id?: string;
        status?: string;
        results_count?: number;
        completed_at?: string;
        error_message?: string;
        metadata?: Json;
      };
    }) => {
      const { data, error } = await supabase
        .from("social_scrape_jobs")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as SocialScrapeJob;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-scrape-jobs", projectId] });
    },
  });

  // Save results for a job
  const saveResultsMutation = useMutation({
    mutationFn: async ({
      jobId,
      results,
    }: {
      jobId: string;
      results: Array<{
        platform: string;
        external_id: string;
        title: string;
        description: string;
        author_name: string;
        author_username: string;
        author_url: string;
        author_avatar_url?: string;
        author_verified?: boolean;
        author_followers?: number;
        likes: number;
        comments: number;
        shares: number;
        views?: number;
        engagement?: number;
        published_at: string;
        url: string;
        content_type: string;
        hashtags?: string[];
        mentions?: string[];
        raw_data: Json;
      }>;
    }) => {
      if (!projectId) throw new Error("No project selected");

      const formattedResults = results.map((r) => ({
        job_id: jobId,
        project_id: projectId,
        platform: r.platform,
        external_id: r.external_id,
        title: r.title,
        description: r.description,
        author_name: r.author_name,
        author_username: r.author_username,
        author_url: r.author_url,
        author_avatar_url: r.author_avatar_url || null,
        author_verified: r.author_verified || false,
        author_followers: r.author_followers || 0,
        likes: r.likes,
        comments: r.comments,
        shares: r.shares,
        views: r.views || 0,
        engagement: r.engagement || 0,
        published_at: r.published_at,
        url: r.url,
        content_type: r.content_type,
        hashtags: r.hashtags || [],
        mentions: r.mentions || [],
        raw_data: r.raw_data as Json,
      }));

      const { data, error } = await supabase
        .from("social_results")
        .upsert(formattedResults, { onConflict: "job_id,external_id" })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["social-scrape-jobs", projectId] });
      toast({
        title: "Resultados guardados",
        description: `${data?.length || 0} resultados guardados en el historial`,
      });
    },
    onError: (error) => {
      console.error("Error saving results:", error);
      toast({
        title: "Error al guardar",
        description: "No se pudieron guardar los resultados",
        variant: "destructive",
      });
    },
  });

  // Delete a job and its results
  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from("social_scrape_jobs")
        .delete()
        .eq("id", jobId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-scrape-jobs", projectId] });
      toast({
        title: "Ejecución eliminada",
        description: "La ejecución y sus resultados han sido eliminados",
      });
    },
    onError: (error) => {
      console.error("Error deleting job:", error);
      toast({
        title: "Error al eliminar",
        description: "No se pudo eliminar la ejecución",
        variant: "destructive",
      });
    },
  });

  // Get aggregated stats
  const { data: stats } = useQuery({
    queryKey: ["social-scrape-stats", projectId],
    queryFn: async () => {
      if (!projectId) return null;

      const { data: jobs, error: jobsError } = await supabase
        .from("social_scrape_jobs")
        .select("platform, status, results_count")
        .eq("project_id", projectId);

      if (jobsError) throw jobsError;

      const totalJobs = jobs?.length || 0;
      const completedJobs = jobs?.filter((j) => j.status === "completed").length || 0;
      const totalResults = jobs?.reduce((sum, j) => sum + (j.results_count || 0), 0) || 0;

      const byPlatform = jobs?.reduce((acc, j) => {
        acc[j.platform] = (acc[j.platform] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      return {
        totalJobs,
        completedJobs,
        totalResults,
        byPlatform,
      };
    },
    enabled: !!projectId,
  });

  return {
    jobs: jobs || [],
    jobsLoading,
    filters,
    setFilters,
    refetchJobs,
    fetchJobResults,
    createJob: createJobMutation.mutateAsync,
    updateJob: updateJobMutation.mutateAsync,
    saveResults: saveResultsMutation.mutateAsync,
    deleteJob: deleteJobMutation.mutateAsync,
    stats,
    isCreating: createJobMutation.isPending,
    isSaving: saveResultsMutation.isPending,
  };
}
