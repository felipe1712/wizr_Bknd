import { useState } from "react";
import { ThematicCard, ConversationAnalysisContent, InformativeContent } from "@/hooks/useThematicCards";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  MessageSquare,
  FileText,
  Users,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  ExternalLink,
  BarChart3,
  PieChart,
  Download,
  Loader2,
} from "lucide-react";
import { generateThematicCardPDF } from "@/lib/reports/thematicCardPdfGenerator";
import { useToast } from "@/hooks/use-toast";

interface ThematicCardViewerProps {
  card: ThematicCard;
  open: boolean;
  onClose: () => void;
}

export function ThematicCardViewer({ card, open, onClose }: ThematicCardViewerProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  const isConversation = card.card_type === "conversation_analysis";
  const content = card.content;

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await generateThematicCardPDF(card);
      toast({
        title: "PDF generado",
        description: "El archivo se ha descargado correctamente.",
      });
    } catch (error) {
      toast({
        title: "Error al exportar",
        description: "No se pudo generar el PDF. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {isConversation ? (
                <MessageSquare className="h-5 w-5 text-primary" />
              ) : (
                <FileText className="h-5 w-5 text-primary" />
              )}
              <Badge variant={card.status === "published" ? "default" : "secondary"}>
                {card.status === "published" ? "Publicada" : "Borrador"}
              </Badge>
              <Badge variant="outline">
                {isConversation ? "Análisis de Conversación" : "Ficha Informativa"}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Exportar PDF
            </Button>
          </div>
          <DialogTitle className="text-xl">{card.title}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {card.period_start && card.period_end
              ? `${format(new Date(card.period_start), "d MMMM", { locale: es })} - ${format(new Date(card.period_end), "d MMMM yyyy", { locale: es })}`
              : format(new Date(card.created_at), "d MMMM yyyy", { locale: es })}
            {" • "}
            {card.mention_ids.length} menciones analizadas
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 pb-4">
            {/* Executive Summary */}
            {"executiveSummary" in content && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-4">
                  <p className="text-sm leading-relaxed">{content.executiveSummary}</p>
                </CardContent>
              </Card>
            )}

            {isConversation && "volumeByChannel" in content && (
              <ConversationAnalysisView content={content as ConversationAnalysisContent} />
            )}

            {!isConversation && "whatIsHappening" in content && (
              <InformativeView content={content as InformativeContent} />
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function ConversationAnalysisView({ content }: { content: ConversationAnalysisContent }) {
  const channels = Object.entries(content.volumeByChannel).filter(([_, v]) => v > 0);
  const totalChannelMentions = channels.reduce((sum, [_, v]) => sum + v, 0);

  return (
    <div className="space-y-6">
      {/* Volume & Reach */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Volumen por Canal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {channels.map(([channel, count]) => (
                <div key={channel} className="flex items-center gap-2">
                  <div className="w-24 text-sm capitalize truncate">{channel}</div>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(count / Math.max(...channels.map(c => c[1]))) * 100}%` }}
                    />
                  </div>
                  <div className="w-8 text-sm text-right font-medium">{count}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Total: {content.totalMentions} menciones • Alcance estimado: {content.estimatedReach}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              Distribución de Sentimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    Positivo
                  </span>
                  <span className="font-medium">{content.sentimentDistribution.positivo}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    Neutral
                  </span>
                  <span className="font-medium">{content.sentimentDistribution.neutral}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    Negativo
                  </span>
                  <span className="font-medium">{content.sentimentDistribution.negativo}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Main Narratives */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Narrativas Principales
        </h3>
        <div className="space-y-3">
          {content.mainNarratives.map((narrative, i) => (
            <div key={i} className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0">
                {narrative.percentage}%
              </Badge>
              <div>
                <p className="text-sm font-medium">{narrative.narrative}</p>
                <p className="text-xs text-muted-foreground">
                  ~{narrative.volume} menciones
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Relevant Actors */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Actores Relevantes
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          {content.relevantActors.map((actor, i) => (
            <Card key={i} className="bg-muted/50">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{actor.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {actor.mentions} menciones
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground capitalize">{actor.type}</p>
                <p className="text-xs mt-1">{actor.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Risks */}
      {content.risks.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            Riesgos Identificados
          </h3>
          <ul className="space-y-2">
            {content.risks.map((risk, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-amber-600 mt-1">•</span>
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2 text-green-600">
          <Lightbulb className="h-4 w-4" />
          Recomendaciones
        </h3>
        <ul className="space-y-2">
          {content.recommendations.map((rec, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="text-green-600 mt-1">✓</span>
              {rec}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function InformativeView({ content }: { content: InformativeContent }) {
  return (
    <div className="space-y-6">
      {/* Context */}
      {content.context && (
        <div>
          <h3 className="font-semibold mb-2">Contexto</h3>
          <p className="text-sm text-muted-foreground">{content.context}</p>
        </div>
      )}

      <Separator />

      {/* What is happening */}
      <div>
        <h3 className="font-semibold mb-3">¿Qué está pasando?</h3>
        <div className="space-y-4">
          {content.whatIsHappening.map((item, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <h4 className="font-medium text-sm mb-2">{item.title}</h4>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Local Implications */}
      <div>
        <h3 className="font-semibold mb-3">Implicaciones</h3>
        <div className="space-y-4">
          {content.localImplications.map((item, i) => (
            <Card key={i} className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-4">
                <h4 className="font-medium text-sm mb-2">{item.title}</h4>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Sources */}
      <div>
        <h3 className="font-semibold mb-3">Fuentes Consultadas</h3>
        <div className="space-y-2">
          {content.sources.map((source, i) => (
            <div key={i} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
              <div>
                <span className="font-medium">{source.name}</span>
                {source.date && (
                  <span className="text-muted-foreground ml-2">({source.date})</span>
                )}
              </div>
              {source.url && (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Ver
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
