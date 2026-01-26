import { useState } from "react";
import { useMentions } from "@/hooks/useMentions";
import { useThematicCards, CardType, ConversationAnalysisContent, InformativeContent } from "@/hooks/useThematicCards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  FileText,
  MessageSquare,
  Loader2,
  CalendarIcon,
  Sparkles,
  Check,
  X,
  Pencil,
} from "lucide-react";
import { ContentEditor } from "./ContentEditor";

interface ThematicCardFormProps {
  projectId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ThematicCardForm({ projectId, onSuccess, onCancel }: ThematicCardFormProps) {
  const [step, setStep] = useState<"type" | "mentions" | "generate" | "review">("type");
  const [cardType, setCardType] = useState<CardType>("conversation_analysis");
  const [title, setTitle] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [selectedMentionIds, setSelectedMentionIds] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: subDays(new Date(), 7),
    end: new Date(),
  });
  const [generatedContent, setGeneratedContent] = useState<
    ConversationAnalysisContent | InformativeContent | null
  >(null);
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);

  const { mentions } = useMentions(projectId, { isArchived: false });
  const { generate, isGenerating, regenerateSection, isRegenerating, create, isCreating } = useThematicCards(projectId);

  const selectedMentions = mentions.filter((m) => selectedMentionIds.has(m.id));

  const toggleMention = (id: string) => {
    const newSet = new Set(selectedMentionIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedMentionIds(newSet);
  };

  const selectAllMentions = () => {
    setSelectedMentionIds(new Set(mentions.map((m) => m.id)));
  };

  const clearSelection = () => {
    setSelectedMentionIds(new Set());
  };

  const handleGenerate = async () => {
    if (!title.trim() || selectedMentions.length === 0) return;

    try {
      const content = await generate({
        cardType,
        mentions: selectedMentions,
        title,
        additionalContext: additionalContext || undefined,
      });
      setGeneratedContent(content);
      setStep("review");
    } catch (error) {
      console.error("Error generating content:", error);
    }
  };

  const handleSave = async () => {
    if (!generatedContent) return;

    try {
      await create({
        title,
        cardType,
        content: generatedContent,
        mentionIds: Array.from(selectedMentionIds),
        periodStart: dateRange.start,
        periodEnd: dateRange.end,
      });
      onSuccess();
    } catch (error) {
      console.error("Error saving card:", error);
    }
  };

  const handleRegenerateSection = async (section: string) => {
    if (!generatedContent) return;
    
    setRegeneratingSection(section);
    try {
      const result = await regenerateSection({
        section,
        cardType,
        mentions: selectedMentions,
        title,
        currentContent: generatedContent,
      });
      
      // Update the content with the regenerated section
      setGeneratedContent(prev => {
        if (!prev) return prev;
        return { ...prev, [result.section]: result.content };
      });
    } catch (error) {
      console.error("Error regenerating section:", error);
    } finally {
      setRegeneratingSection(null);
    }
  };

  // Step 1: Select card type
  if (step === "type") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Nueva Ficha Temática</h2>
          <p className="text-sm text-muted-foreground">
            Selecciona el tipo de ficha que deseas crear
          </p>
        </div>

        <RadioGroup
          value={cardType}
          onValueChange={(v) => setCardType(v as CardType)}
          className="grid gap-4 md:grid-cols-2"
        >
          <Label
            htmlFor="conversation_analysis"
            className={cn(
              "cursor-pointer rounded-lg border-2 p-4 transition-colors",
              cardType === "conversation_analysis"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            <RadioGroupItem value="conversation_analysis" id="conversation_analysis" className="sr-only" />
            <div className="flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Análisis de Conversación Digital</p>
                <p className="text-sm text-muted-foreground">
                  Volumen, sentimiento, narrativas, actores y recomendaciones basados en menciones
                </p>
              </div>
            </div>
          </Label>

          <Label
            htmlFor="informative"
            className={cn(
              "cursor-pointer rounded-lg border-2 p-4 transition-colors",
              cardType === "informative"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            <RadioGroupItem value="informative" id="informative" className="sr-only" />
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Ficha Informativa</p>
                <p className="text-sm text-muted-foreground">
                  Contexto del tema, implicaciones y fuentes consultadas
                </p>
              </div>
            </div>
          </Label>
        </RadioGroup>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={() => setStep("mentions")}>
            Continuar
          </Button>
        </div>
      </div>
    );
  }

  // Step 2: Select mentions
  if (step === "mentions") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Seleccionar Menciones</h2>
          <p className="text-sm text-muted-foreground">
            Elige las menciones que servirán como fuente para la ficha
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{selectedMentionIds.size} seleccionadas</Badge>
              <span className="text-sm text-muted-foreground">
                de {mentions.length} disponibles
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAllMentions}>
                Seleccionar todas
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Limpiar
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[300px] rounded-md border p-4">
            <div className="space-y-2">
              {mentions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay menciones guardadas en este proyecto
                </p>
              ) : (
                mentions.map((mention) => (
                  <div
                    key={mention.id}
                    className={cn(
                      "flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors",
                      selectedMentionIds.has(mention.id)
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => toggleMention(mention.id)}
                  >
                    <Checkbox
                      checked={selectedMentionIds.has(mention.id)}
                      onCheckedChange={() => toggleMention(mention.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {mention.title || "Sin título"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {mention.source_domain} •{" "}
                        {format(new Date(mention.created_at), "d MMM yyyy", { locale: es })}
                      </p>
                    </div>
                    {mention.sentiment && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0",
                          mention.sentiment === "positivo" && "border-green-500 text-green-600",
                          mention.sentiment === "negativo" && "border-red-500 text-red-600",
                          mention.sentiment === "neutral" && "border-gray-500 text-gray-600"
                        )}
                      >
                        {mention.sentiment}
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep("type")}>
            Atrás
          </Button>
          <Button
            onClick={() => setStep("generate")}
            disabled={selectedMentionIds.size === 0}
          >
            Continuar ({selectedMentionIds.size} menciones)
          </Button>
        </div>
      </div>
    );
  }

  // Step 3: Configure and generate
  if (step === "generate") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Configurar Ficha</h2>
          <p className="text-sm text-muted-foreground">
            Define el título y contexto adicional para la generación
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título de la ficha *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                cardType === "conversation_analysis"
                  ? "Ej: Maltrato animal en Pénjamo - Agosto 2025"
                  : "Ej: Aranceles de EE.UU. a productos mexicanos"
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Fecha inicio</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.start, "PPP", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.start}
                    onSelect={(date) => date && setDateRange((r) => ({ ...r, start: date }))}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Fecha fin</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.end, "PPP", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.end}
                    onSelect={(date) => date && setDateRange((r) => ({ ...r, end: date }))}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="context">Contexto adicional (opcional)</Label>
            <Textarea
              id="context"
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="Información adicional que el AI debe considerar al generar la ficha..."
              rows={3}
            />
          </div>

          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>
                  Se analizarán <strong>{selectedMentionIds.size}</strong> menciones para generar{" "}
                  {cardType === "conversation_analysis"
                    ? "un análisis de conversación digital"
                    : "una ficha informativa"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep("mentions")}>
            Atrás
          </Button>
          <Button onClick={handleGenerate} disabled={!title.trim() || isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generando con AI...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generar Ficha
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Step 4: Review and edit
  if (step === "review" && generatedContent) {
    const dateRangeLabel = `${format(dateRange.start, "d MMM", { locale: es })} - ${format(dateRange.end, "d MMM yyyy", { locale: es })}`;

    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Editar Borrador</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Haz clic en cualquier campo para editarlo antes de guardar
          </p>
        </div>

        <ContentEditor
          cardType={cardType}
          content={generatedContent}
          title={title}
          dateRangeLabel={dateRangeLabel}
          mentionCount={selectedMentionIds.size}
          onContentChange={setGeneratedContent}
          onTitleChange={setTitle}
          onRegenerateSection={handleRegenerateSection}
          isRegenerating={isRegenerating}
          regeneratingSection={regeneratingSection}
        />

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep("generate")}>
            <X className="mr-2 h-4 w-4" />
            Regenerar
          </Button>
          <Button onClick={handleSave} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Guardar Ficha
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
