import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles,
  FileText,
  AlertTriangle,
  BarChart3,
  GitCompare,
  Loader2,
  Copy,
  Download,
  MessageCircle,
  Globe,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSmartReport, ReportType, ReportExtension, SmartReportContent, SmartReportConfig } from "@/hooks/useSmartReport";
import type { Mention } from "@/hooks/useMentions";
import { SmartReportPDFGenerator } from "./SmartReportPDFGenerator";

interface SmartReportGeneratorProps {
  mentions: Mention[];
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

const REPORT_TYPES: { value: ReportType; label: string; icon: typeof FileText; description: string }[] = [
  { value: "brief", label: "Brief Diario/Semanal", icon: FileText, description: "Resumen ejecutivo del periodo" },
  { value: "crisis", label: "Alerta de Crisis", icon: AlertTriangle, description: "Documento urgente sobre eventos críticos" },
  { value: "thematic", label: "Análisis Temático", icon: BarChart3, description: "Profundización en un tema detectado" },
  { value: "comparative", label: "Reporte Comparativo", icon: GitCompare, description: "Benchmark entre entidades" },
];

const EXTENSIONS: { value: ReportExtension; label: string; description: string }[] = [
  { value: "micro", label: "Micro", description: "1-2 párrafos • WhatsApp, tweets" },
  { value: "short", label: "Corto", description: "1 página • Executive summary" },
  { value: "medium", label: "Medio", description: "2-3 páginas • Análisis detallado" },
];

export function SmartReportGenerator({
  mentions,
  projectName,
  projectAudience,
  projectObjective,
  entityNames,
  dateRange,
}: SmartReportGeneratorProps) {
  const { toast } = useToast();
  const { generateReport, isGenerating, report, clearReport } = useSmartReport();
  
  const [reportType, setReportType] = useState<ReportType>("brief");
  const [extension, setExtension] = useState<ReportExtension>("short");
  const [selectedTemplate, setSelectedTemplate] = useState<"executive" | "technical" | "public">("executive");
  const [editedTemplates, setEditedTemplates] = useState<SmartReportContent["templates"] | null>(null);

  const handleGenerate = async () => {
    const config: SmartReportConfig = {
      reportType,
      extension,
      projectName,
      projectAudience,
      projectObjective,
      entityNames,
      dateRange: {
        start: dateRange.start,
        end: dateRange.end,
        label: dateRange.label,
      },
    };

    const result = await generateReport(mentions, config);
    if (result) {
      setEditedTemplates(result.templates);
    }
  };

  const handleCopyToClipboard = () => {
    const template = editedTemplates?.[selectedTemplate] || report?.templates[selectedTemplate];
    if (template) {
      navigator.clipboard.writeText(template);
      toast({
        title: "Copiado",
        description: "Texto copiado al portapapeles",
      });
    }
  };

  const handleWhatsAppShare = () => {
    const template = editedTemplates?.[selectedTemplate] || report?.templates[selectedTemplate];
    if (template) {
      const encodedText = encodeURIComponent(template);
      const whatsappUrl = `https://wa.me/?text=${encodedText}`;
      window.open(whatsappUrl, "_blank");
    }
  };

  const handleTemplateEdit = (value: string) => {
    if (editedTemplates) {
      setEditedTemplates({
        ...editedTemplates,
        [selectedTemplate]: value,
      });
    }
  };

  const currentTemplate = editedTemplates?.[selectedTemplate] || report?.templates[selectedTemplate] || "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Reportes Inteligentes
        </CardTitle>
        <CardDescription>
          Genera productos de inteligencia listos para publicar en múltiples formatos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configuration */}
        {!report && (
          <div className="space-y-4">
            {/* Report Type Selection */}
            <div className="space-y-2">
              <Label>Tipo de Reporte</Label>
              <div className="grid grid-cols-2 gap-2">
                {REPORT_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = reportType === type.value;
                  return (
                    <button
                      key={type.value}
                      onClick={() => setReportType(type.value)}
                      className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/50"
                      }`}
                    >
                      <Icon className={`h-5 w-5 mt-0.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      <div>
                        <div className={`font-medium text-sm ${isSelected ? "text-primary" : ""}`}>
                          {type.label}
                        </div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Extension Selection */}
            <div className="space-y-2">
              <Label>Extensión</Label>
              <Select value={extension} onValueChange={(v) => setExtension(v as ReportExtension)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXTENSIONS.map((ext) => (
                    <SelectItem key={ext.value} value={ext.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{ext.label}</span>
                        <span className="text-xs text-muted-foreground">{ext.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data Summary */}
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">{mentions.length} menciones</Badge>
              <Badge variant="outline">{dateRange.label}</Badge>
              {entityNames && entityNames.length > 0 && (
                <Badge variant="outline">{entityNames.length} entidades</Badge>
              )}
            </div>

            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={isGenerating || mentions.length === 0}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando reporte inteligente...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generar Reporte
                </>
              )}
            </Button>
          </div>
        )}

        {/* Generated Report */}
        {report && (
          <div className="space-y-6">
            {/* Report Header */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{report.title}</h3>
                <Button variant="ghost" size="sm" onClick={clearReport}>
                  Nuevo reporte
                </Button>
              </div>
              <p className="text-muted-foreground">{report.summary}</p>
            </div>

            {/* Key Findings & Recommendations */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Hallazgos Clave
                </h4>
                <ul className="space-y-1 text-sm">
                  {report.keyFindings.map((finding, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-muted-foreground">•</span>
                      {finding}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Recomendaciones
                </h4>
                <ul className="space-y-1 text-sm">
                  {report.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-muted-foreground">{i + 1}.</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <Separator />

            {/* Output Channels */}
            <div className="space-y-4">
              <h4 className="font-medium">Canales de Salida</h4>
              
              {/* Template Selector */}
              <Tabs value={selectedTemplate} onValueChange={(v) => setSelectedTemplate(v as typeof selectedTemplate)}>
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="executive">Ejecutivo</TabsTrigger>
                  <TabsTrigger value="technical">Técnico</TabsTrigger>
                  <TabsTrigger value="public">Público</TabsTrigger>
                </TabsList>
                
                <TabsContent value={selectedTemplate} className="mt-4">
                  <div className="space-y-3">
                    <Textarea
                      value={currentTemplate}
                      onChange={(e) => handleTemplateEdit(e.target.value)}
                      className="min-h-[200px] font-sans"
                      placeholder="Contenido del mensaje..."
                    />
                    
                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={handleCopyToClipboard}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleWhatsAppShare}>
                        <MessageCircle className="mr-2 h-4 w-4" />
                        WhatsApp
                      </Button>
                      <SmartReportPDFGenerator
                        report={report}
                        projectName={projectName}
                        dateRange={dateRange}
                        selectedTemplate={selectedTemplate}
                        editedTemplate={currentTemplate}
                      />
                      <Button variant="outline" size="sm" disabled>
                        <Globe className="mr-2 h-4 w-4" />
                        Vista Web (próximamente)
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Metrics Summary */}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>Métricas: {report.metrics.totalMentions} menciones</span>
              <span>•</span>
              <span className="text-green-600">+{report.metrics.positiveCount}</span>
              <span className="text-gray-500">{report.metrics.neutralCount}</span>
              <span className="text-red-600">-{report.metrics.negativeCount}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
