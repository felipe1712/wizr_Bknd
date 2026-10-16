import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { FKProfile, FKProfileKPI, FKNetwork } from "./useFanpageKarma";

export type RankingReportType = "competitive_brief" | "performance_analysis" | "trends_report" | "benchmarking";
export type ReportExtension = "micro" | "short" | "medium";

export interface RankingReportMetrics {
  totalProfiles: number;
  networks: string[];
  avgEngagement: number;
  topPerformer: string | null;
  avgGrowth: number;
}

export interface RankingReportTemplates {
  executive: string;
  technical: string;
  public: string;
}

export interface RankingReportContent {
  title: string;
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  metrics: RankingReportMetrics;
  templates: RankingReportTemplates;
}

export interface NarrativeData {
  profile_id: string;
  summary: string;
  dominantNarratives: Array<{ theme: string; description: string }>;
  contentStrategy: { primaryFocus: string; strengths: string[] };
}

export interface RankingReportConfig {
  rankingName: string;
  reportType: RankingReportType;
  extension: ReportExtension;
  dateRange: {
    start: string;
    end: string;
    label: string;
  };
  filterNetwork?: FKNetwork | "all";
  includeNarratives?: boolean;
}

export function useRankingReport() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<RankingReportContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generateReport = async (
    profiles: FKProfile[],
    kpis: FKProfileKPI[],
    config: RankingReportConfig,
    narratives?: NarrativeData[]
  ): Promise<RankingReportContent | null> => {
    if (profiles.length === 0) {
      toast({
        title: "Sin perfiles",
        description: "No hay perfiles disponibles para generar el reporte",
        variant: "destructive",
      });
      return null;
    }

    // Filter by network if specified
    let filteredProfiles = profiles;
    let filteredKpis = kpis;
    
    if (config.filterNetwork && config.filterNetwork !== "all") {
      filteredProfiles = profiles.filter(p => p.network === config.filterNetwork);
      const profileIds = new Set(filteredProfiles.map(p => p.id));
      filteredKpis = kpis.filter(k => profileIds.has(k.fk_profile_id));
    }

    if (filteredProfiles.length === 0) {
      toast({
        title: "Sin perfiles",
        description: "No hay perfiles para la red seleccionada",
        variant: "destructive",
      });
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-ranking-report", {
        body: {
          rankingName: config.rankingName,
          reportType: config.reportType,
          extension: config.extension,
          profiles: filteredProfiles.map(p => ({
            id: p.id,
            profile_id: p.profile_id,
            display_name: p.display_name,
            network: p.network,
          })),
          kpis: filteredKpis.map(k => ({
            fk_profile_id: k.fk_profile_id,
            followers: k.followers,
            follower_growth_percent: k.follower_growth_percent,
            engagement_rate: k.engagement_rate,
            posts_per_day: k.posts_per_day,
            page_performance_index: k.page_performance_index,
          })),
          narratives: narratives || [],
          dateRange: config.dateRange,
          filterNetwork: config.filterNetwork,
        },
      });

      if (fnError) {
        throw fnError;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setReport(data);
      toast({
        title: "Reporte generado",
        description: `"${data.title}" está listo`,
      });

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      toast({
        title: "Error al generar reporte",
        description: message,
        variant: "destructive",
      });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const clearReport = () => {
    setReport(null);
    setError(null);
  };

  return {
    generateReport,
    clearReport,
    isGenerating,
    report,
    error,
  };
}
