import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Mention } from "./useMentions";

export type ReportType = "brief" | "crisis" | "thematic" | "comparative";
export type ReportExtension = "micro" | "short" | "medium";

export interface SmartReportMetrics {
  totalMentions: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  topSources: string[];
}

export interface SmartReportTemplates {
  executive: string;
  technical: string;
  public: string;
}

export interface SmartReportContent {
  title: string;
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  metrics: SmartReportMetrics;
  templates: SmartReportTemplates;
}

export interface SmartReportConfig {
  reportType: ReportType;
  extension: ReportExtension;
  projectName: string;
  projectAudience: string;
  projectObjective: string;
  entityNames?: string[];
  dateRange: {
    start: string;
    end: string;
    label: string;
  };
}

export function useSmartReport() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<SmartReportContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generateReport = async (
    mentions: Mention[],
    config: SmartReportConfig
  ): Promise<SmartReportContent | null> => {
    if (mentions.length === 0) {
      toast({
        title: "Sin menciones",
        description: "No hay menciones disponibles para generar el reporte",
        variant: "destructive",
      });
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-smart-report", {
        body: {
          mentions: mentions.map(m => ({
            id: m.id,
            title: m.title,
            description: m.description,
            url: m.url,
            source_domain: m.source_domain,
            sentiment: m.sentiment,
            created_at: m.created_at,
            matched_keywords: m.matched_keywords,
          })),
          ...config,
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
