import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Loader2, RefreshCw, Pencil, Check, Undo2, Globe, Target, Users2, Presentation,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  usePerformanceReport, type PerformanceReportContent, type PerformanceReportMode,
} from "@/hooks/usePerformanceReport";
import type { FKProfile, FKProfileKPI, FKDailyTopPost } from "@/hooks/useFanpageKarma";
import { PerformanceReportView } from "@/components/reports/PerformanceReportView";
import { PublishReportDialog } from "@/components/reports/PublishReportDialog";
import { PerformanceReportPDFGenerator } from "@/components/reports/PerformanceReportPDFGenerator";
import { PerformanceSlidesViewer } from "@/components/reports/PerformanceSlidesViewer";
import { format } from "date-fns";

interface PerformanceReportGeneratorProps {
  reportMode: PerformanceReportMode;
  clientId: string;
  clientName: string;
  brandName?: string;
  profiles: FKProfile[];
  kpis: FKProfileKPI[];
  topPosts: FKDailyTopPost[];
  dateRange: { from: Date; to: Date };
}

export function PerformanceReportGenerator({
  reportMode, clientId, clientName, brandName, profiles, kpis, topPosts, dateRange,
}: PerformanceReportGeneratorProps) {
  const { toast } = useToast();
  const { generateReport, isGenerating, report, clearReport } = usePerformanceReport();

  const [strategicFocus, setStrategicFocus] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [slidesOpen, setSlidesOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedReport, setEditedReport] = useState<PerformanceReportContent | null>(null);

  useEffect(() => {
    setEditedReport(report);
    setIsEditing(false);
  }, [report]);

  const activeReport = editedReport ?? report;
  const isBrand = reportMode === "brand";
  const isComparative = reportMode === "comparative";

  const dateLabel = `${format(dateRange.from, "d MMM")} – ${format(dateRange.to, "d MMM yyyy")}`;
  const dateRangeIso = {
    start: format(dateRange.from, "yyyy-MM-dd"),
    end: format(dateRange.to, "yyyy-MM-dd"),
    label: dateLabel,
  };

  const updateReport = (patch: Partial<PerformanceReportContent>) => {
    setEditedReport((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const resetEdits = () => {
    setEditedReport(report);
    toast({ title: "Cambios descartados" });
  };

  const handleGenerate = async () => {
    await generateReport(profiles, kpis, topPosts, {
      reportMode,
      clientName,
      brandName,
      strategicFocus: strategicFocus.trim() || undefined,
      dateRange: dateRangeIso,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isBrand ? <Target className="h-5 w-5 text-primary" /> : <Users2 className="h-5 w-5 text-primary" />}
          {isComparative
            ? "Análisis Comparativo"
            : `Reporte de Performance — ${isBrand ? "Marca" : "Benchmark"}`}
        </CardTitle>
        <CardDescription>
          {isComparative
            ? `Comparativa de desempeño entre los perfiles cargados en ${clientName} para el período seleccionado.`
            : isBrand
              ? `Análisis del desempeño en redes sociales de ${brandName || clientName} en el período seleccionado.`
              : `Comparativa de ${brandName || clientName} vs su competencia en el período seleccionado.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!report && (
          <div className="space-y-4">
            <div className="space-y-2 p-4 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <Label className="font-medium">Enfoque estratégico (opcional)</Label>
              </div>
              <Textarea
                value={strategicFocus}
                onChange={(e) => setStrategicFocus(e.target.value)}
                placeholder={isComparative
                  ? "Ej: Identificar qué cuentas y formatos generan mayor conversación dentro del grupo."
                  : isBrand
                    ? "Ej: Evaluar si el incremento de frecuencia en Instagram en abril mejoró la salud orgánica del perfil."
                    : "Ej: Identificar en qué redes y formatos la competencia nos está sacando ventaja."}
                className="text-sm min-h-[80px]"
              />
              <p className="text-xs text-muted-foreground">
                Define el ángulo del análisis. La IA leerá hallazgos y recomendaciones a través de este lente.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">{profiles.length} perfiles</Badge>
              <Badge variant="outline">{kpis.length} KPIs</Badge>
              <Badge variant="outline">{topPosts.length} posts en período</Badge>
              <Badge variant="secondary">{dateLabel}</Badge>
            </div>

            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={isGenerating || profiles.length === 0}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando reporte de performance...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generar reporte ({profiles.length} perfiles)
                </>
              )}
            </Button>
          </div>
        )}

        {report && activeReport && (
          <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isEditing ? (
                  <span className="inline-flex items-center gap-1">
                    <Pencil className="h-3.5 w-3.5 text-primary" />
                    Modo edición
                  </span>
                ) : (
                  <span>Reporte listo. Puedes editar cualquier texto antes de publicar.</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={resetEdits}>
                      <Undo2 className="mr-2 h-4 w-4" /> Descartar
                    </Button>
                    <Button size="sm" onClick={() => { setIsEditing(false); toast({ title: "Cambios guardados" }); }}>
                      <Check className="mr-2 h-4 w-4" /> Listo
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                      <Pencil className="mr-2 h-4 w-4" /> Editar
                    </Button>
                    <PerformanceReportPDFGenerator
                      report={activeReport}
                      clientName={brandName || clientName}
                      dateRange={dateRangeIso}
                    />
                    <Button variant="outline" size="sm" onClick={() => setSlidesOpen(true)} className="gap-2">
                      <Presentation className="h-4 w-4" /> Presentación
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPublishOpen(true)}>
                      <Globe className="mr-2 h-4 w-4" /> Publicar como link
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearReport}>
                      <RefreshCw className="mr-2 h-4 w-4" /> Nuevo
                    </Button>
                  </>
                )}
              </div>
            </div>

            <PerformanceReportView
              report={activeReport}
              editing={isEditing}
              onUpdate={updateReport}
              dateLabel={dateLabel}
            />
          </div>
        )}
      </CardContent>

      {activeReport && (
        <>
          <PublishReportDialog
            open={publishOpen}
            onOpenChange={setPublishOpen}
            ownerKind="client"
            ownerId={clientId}
            ownerName={clientName}
            reportKind={isComparative ? "performance_comparative" : isBrand ? "performance_brand" : "performance_benchmark"}
            report={activeReport}
            dateRange={dateRangeIso}
          />
          <PerformanceSlidesViewer
            open={slidesOpen}
            onOpenChange={setSlidesOpen}
            report={activeReport}
            clientName={brandName || clientName}
            dateRange={dateRangeIso}
          />
        </>
      )}
    </Card>
  );
}
