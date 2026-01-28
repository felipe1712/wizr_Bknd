import { useState, useMemo } from "react";
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
  BarChart3,
  TrendingUp,
  GitCompare,
  Loader2,
  Copy,
  MessageCircle,
  CheckCircle2,
  Trophy,
  FileDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  useRankingReport, 
  RankingReportType, 
  ReportExtension, 
  RankingReportContent, 
  RankingReportConfig,
  NarrativeData 
} from "@/hooks/useRankingReport";
import { FKProfile, FKProfileKPI, FKNetwork, getNetworkLabel } from "@/hooks/useFanpageKarma";
import { NetworkFilter } from "./NetworkFilter";
import { RankingReportPDFGenerator } from "./RankingReportPDFGenerator";

interface RankingReportGeneratorProps {
  rankingName: string;
  profiles: FKProfile[];
  kpis: FKProfileKPI[];
  dateRange: { from: Date; to: Date };
  onGenerateNarratives?: (profileId: string) => Promise<NarrativeData | null>;
}

const REPORT_TYPES: { value: RankingReportType; label: string; icon: typeof FileText; description: string }[] = [
  { value: "competitive_brief", label: "Brief Competitivo", icon: Trophy, description: "Resumen ejecutivo del panorama competitivo" },
  { value: "performance_analysis", label: "Análisis de Performance", icon: BarChart3, description: "Deep-dive en métricas y performers" },
  { value: "trends_report", label: "Reporte de Tendencias", icon: TrendingUp, description: "Evolución y predicciones" },
  { value: "benchmarking", label: "Benchmarking Comparativo", icon: GitCompare, description: "Comparación vs promedio del grupo" },
];

const EXTENSIONS: { value: ReportExtension; label: string; description: string }[] = [
  { value: "micro", label: "Micro", description: "1-2 párrafos • WhatsApp" },
  { value: "short", label: "Corto", description: "1 página • Executive summary" },
  { value: "medium", label: "Medio", description: "2-3 páginas • Análisis detallado" },
];

export function RankingReportGenerator({
  rankingName,
  profiles,
  kpis,
  dateRange,
}: RankingReportGeneratorProps) {
  const { toast } = useToast();
  const { generateReport, isGenerating, report, clearReport } = useRankingReport();
  
  const [reportType, setReportType] = useState<RankingReportType>("competitive_brief");
  const [extension, setExtension] = useState<ReportExtension>("short");
  const [selectedTemplate, setSelectedTemplate] = useState<"executive" | "technical" | "public">("executive");
  const [editedTemplates, setEditedTemplates] = useState<RankingReportContent["templates"] | null>(null);
  const [filterNetwork, setFilterNetwork] = useState<FKNetwork | "all">("all");

  // Get unique networks from profiles
  const profileNetworks = useMemo(() => 
    profiles.map(p => p.network as FKNetwork), 
    [profiles]
  );

  // Filter profiles and KPIs by network
  const filteredData = useMemo(() => {
    if (filterNetwork === "all") {
      return { profiles, kpis, count: profiles.length };
    }
    const filteredProfiles = profiles.filter(p => p.network === filterNetwork);
    const profileIds = new Set(filteredProfiles.map(p => p.id));
    const filteredKpis = kpis.filter(k => profileIds.has(k.fk_profile_id));
    return { profiles: filteredProfiles, kpis: filteredKpis, count: filteredProfiles.length };
  }, [profiles, kpis, filterNetwork]);

  const handleGenerate = async () => {
    const config: RankingReportConfig = {
      rankingName,
      reportType,
      extension,
      dateRange: {
        start: dateRange.from.toISOString().split('T')[0],
        end: dateRange.to.toISOString().split('T')[0],
        label: `${dateRange.from.toLocaleDateString()} - ${dateRange.to.toLocaleDateString()}`,
      },
      filterNetwork,
    };

    const result = await generateReport(filteredData.profiles, filteredData.kpis, config);
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
          Reportes Inteligentes de Ranking
        </CardTitle>
        <CardDescription>
          Genera análisis competitivo con IA basado en los datos del ranking "{rankingName}"
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configuration */}
        {!report && (
          <div className="space-y-4">
            {/* Network Filter */}
            <div className="space-y-2">
              <Label>Filtrar por Red Social</Label>
              <NetworkFilter
                networks={profileNetworks}
                selected={filterNetwork}
                onChange={setFilterNetwork}
              />
            </div>

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
              <Badge variant={filteredData.count < profiles.length ? "default" : "outline"}>
                {filteredData.count} perfiles
                {filteredData.count < profiles.length && ` (de ${profiles.length})`}
              </Badge>
              <Badge variant="outline">
                {dateRange.from.toLocaleDateString()} - {dateRange.to.toLocaleDateString()}
              </Badge>
              {filterNetwork !== "all" && (
                <Badge variant="secondary">
                  {getNetworkLabel(filterNetwork)}
                </Badge>
              )}
            </div>

            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={isGenerating || filteredData.count === 0}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando reporte inteligente...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generar Reporte ({filteredData.count} perfiles)
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
                  <TabsTrigger value="public">WhatsApp</TabsTrigger>
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
                      <RankingReportPDFGenerator
                        report={report}
                        rankingName={rankingName}
                        dateRange={{
                          start: dateRange.from.toISOString(),
                          end: dateRange.to.toISOString(),
                          label: `${dateRange.from.toLocaleDateString()} - ${dateRange.to.toLocaleDateString()}`,
                        }}
                        selectedTemplate={selectedTemplate}
                        editedTemplate={currentTemplate}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Metrics Summary */}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{report.metrics.totalProfiles} perfiles</span>
              <span>•</span>
              <span>Redes: {report.metrics.networks.join(', ')}</span>
              <span>•</span>
              <span>Engagement promedio: {report.metrics.avgEngagement}%</span>
              <span>•</span>
              <span>Crecimiento promedio: {report.metrics.avgGrowth}%</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
