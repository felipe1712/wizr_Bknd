import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  TrendingUp,
  MessageSquare,
  Target,
  ThumbsUp,
  Lightbulb,
  Sparkles,
} from "lucide-react";

export interface NarrativeItem {
  theme: string;
  description: string;
  frequency: number;
}

export interface ToneAnalysis {
  overall: "formal" | "informal" | "mixed";
  emotionalTone: string;
  callToAction: boolean;
}

export interface ContentStrategy {
  primaryFocus: string;
  strengths: string[];
  opportunities: string[];
}

export interface ContentAnalysisData {
  summary: string;
  dominantNarratives: NarrativeItem[];
  toneAnalysis: ToneAnalysis;
  contentStrategy: ContentStrategy;
}

interface ContentAnalysisDisplayProps {
  analysis: ContentAnalysisData;
}

const getToneLabel = (tone: string): string => {
  switch (tone) {
    case "formal": return "Formal";
    case "informal": return "Informal";
    case "mixed": return "Mixto";
    default: return tone;
  }
};

const getToneColor = (tone: string): string => {
  switch (tone) {
    case "formal": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "informal": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    default: return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  }
};

const getNarrativeColor = (index: number): string => {
  const colors = [
    "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800",
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
    "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
    "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800",
  ];
  return colors[index % colors.length];
};

export function ContentAnalysisDisplay({ analysis }: ContentAnalysisDisplayProps) {
  const narratives = analysis.dominantNarratives || [];
  const strengths = analysis.contentStrategy?.strengths || [];
  const opportunities = analysis.contentStrategy?.opportunities || [];
  
  return (
    <ScrollArea className="max-h-[65vh] pr-4">
      <div className="space-y-6">
        {/* Executive Summary */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Resumen del Contenido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground/90">
              {analysis.summary}
            </p>
          </CardContent>
        </Card>

        {/* Narratives */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Narrativas Principales</h3>
          </div>
          <div className="space-y-3">
            {narratives.map((narrative, index) => (
              <Card 
                key={index} 
                className={`border ${getNarrativeColor(index)}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-background/80 font-bold text-sm border">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="font-semibold text-sm">{narrative.theme}</span>
                        <Badge variant="secondary" className="text-xs font-medium">
                          {narrative.frequency}%
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {narrative.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Separator />

        {/* Tone Analysis */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Tono de Comunicación</h3>
          </div>
          <Card>
            <CardContent className="p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    Estilo
                  </span>
                  <Badge className={`w-fit ${getToneColor(analysis.toneAnalysis?.overall || "mixed")}`}>
                    {getToneLabel(analysis.toneAnalysis?.overall || "mixed")}
                  </Badge>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    Tono Emocional
                  </span>
                  <span className="text-sm font-medium">
                    {analysis.toneAnalysis?.emotionalTone || "No determinado"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    Usa CTAs
                  </span>
                  <Badge 
                    variant={analysis.toneAnalysis?.callToAction ? "default" : "secondary"}
                    className="w-fit"
                  >
                    {analysis.toneAnalysis?.callToAction ? "Sí" : "No"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Content Strategy */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Estrategia de Contenido</h3>
          </div>
          
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  Enfoque Principal
                </span>
              </div>
              <p className="text-sm font-medium">
                {analysis.contentStrategy?.primaryFocus || "No determinado"}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Strengths */}
            {strengths.length > 0 && (
              <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-green-700 dark:text-green-400">
                    <ThumbsUp className="h-4 w-4" />
                    Fortalezas
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-2">
                    {strengths.map((strength, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                        <span className="text-foreground/80">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Opportunities */}
            {opportunities.length > 0 && (
              <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <Lightbulb className="h-4 w-4" />
                    Oportunidades
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-2">
                    {opportunities.map((opportunity, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-amber-600 dark:text-amber-400 mt-0.5">→</span>
                        <span className="text-foreground/80">{opportunity}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
