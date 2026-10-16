import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Mention } from "@/hooks/useMentions";
import { getMentionAuthorInfo } from "@/lib/mentionAuthors";

interface ExecutiveSummaryCardProps {
  mentions: Mention[];
  projectName?: string;
  dateFrom?: Date;
  dateTo?: Date;
  activeFiltersLabel?: string;
}

interface SummaryResponse {
  success?: boolean;
  summary?: string;
  error?: string;
  meta?: {
    totalMentions: number;
    sampleSize: number;
    generatedAt: string;
  };
}

export function ExecutiveSummaryCard({
  mentions,
  projectName,
  dateFrom,
  dateTo,
  activeFiltersLabel,
}: ExecutiveSummaryCardProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [meta, setMeta] = useState<SummaryResponse["meta"] | null>(null);

  const handleGenerate = async () => {
    if (mentions.length === 0) {
      toast({
        title: "Sin menciones",
        description: "No hay menciones filtradas para resumir.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const payloadMentions = mentions.map((m) => {
        const author = getMentionAuthorInfo(m);
        return {
          title: m.title,
          description: m.description,
          source_domain: m.source_domain,
          sentiment: m.sentiment,
          published_at: m.published_at,
          matched_keywords: m.matched_keywords,
          author: author?.name || author?.username || null,
        };
      });

      const { data, error } = await supabase.functions.invoke<SummaryResponse>(
        "summarize-mentions",
        {
          body: {
            mentions: payloadMentions,
            projectName,
            dateRange: {
              from: dateFrom ? format(dateFrom, "yyyy-MM-dd") : undefined,
              to: dateTo ? format(dateTo, "yyyy-MM-dd") : undefined,
            },
          },
        },
      );

      if (error) throw new Error(error.message || "Error al generar resumen");
      if (!data?.success || !data.summary) {
        throw new Error(data?.error || "Respuesta vacía de la IA");
      }

      setSummary(data.summary);
      setMeta(data.meta || null);
      toast({
        title: "Resumen generado",
        description: `Brief ejecutivo sobre ${data.meta?.totalMentions ?? mentions.length} menciones`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      toast({
        title: "No se pudo generar el resumen",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Resumen Ejecutivo IA
            </CardTitle>
            <CardDescription>
              Brief en lenguaje natural sobre las {mentions.length} menciones filtradas
              {activeFiltersLabel ? ` · ${activeFiltersLabel}` : ""}
            </CardDescription>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isLoading || mentions.length === 0}
            size="sm"
            variant={summary ? "outline" : "default"}
            className="shrink-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Generando...
              </>
            ) : summary ? (
              <>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Regenerar
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-3.5 w-3.5" />
                Generar resumen
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {summary ? (
        <CardContent className="space-y-3">
          <div className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground whitespace-pre-line">
            {summary}
          </div>
          {meta && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
              <Badge variant="secondary" className="text-[10px]">
                {meta.totalMentions} menciones analizadas
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                Muestra: {meta.sampleSize}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                Generado{" "}
                {format(new Date(meta.generatedAt), "d MMM yyyy HH:mm", { locale: es })}
              </span>
            </div>
          )}
        </CardContent>
      ) : !isLoading && mentions.length === 0 ? (
        <CardContent>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" />
            Ajusta los filtros para tener menciones que resumir.
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
