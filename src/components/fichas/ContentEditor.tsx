import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Pencil, X, Check, Plus, Trash2, RefreshCw, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ConversationAnalysisContent, InformativeContent, CardType } from "@/hooks/useThematicCards";

interface ContentEditorProps {
  cardType: CardType;
  content: ConversationAnalysisContent | InformativeContent;
  title: string;
  dateRangeLabel: string;
  mentionCount: number;
  onContentChange: (content: ConversationAnalysisContent | InformativeContent) => void;
  onTitleChange: (title: string) => void;
  onRegenerateSection?: (section: string) => Promise<void>;
  isRegenerating?: boolean;
  regeneratingSection?: string | null;
}

interface EditableFieldProps {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  label?: string;
  className?: string;
}

function EditableField({ value, onChange, multiline = false, label, className }: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    onChange(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className={cn("space-y-2", className)}>
        {label && <span className="text-xs text-muted-foreground">{label}</span>}
        {multiline ? (
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="min-h-[80px]"
            autoFocus
          />
        ) : (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            autoFocus
          />
        )}
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={handleSave}>
            <Check className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative cursor-pointer rounded-md p-2 -m-2 transition-colors hover:bg-muted/50",
        className
      )}
      onClick={() => setIsEditing(true)}
    >
      {label && <span className="text-xs text-muted-foreground block mb-1">{label}</span>}
      <span>{value || <span className="text-muted-foreground italic">Click para editar</span>}</span>
      <Pencil className="absolute top-2 right-2 h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
    </div>
  );
}

interface EditableListItemProps {
  title: string;
  description: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onDelete: () => void;
}

function EditableListItem({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  onDelete,
}: EditableListItemProps) {
  return (
    <div className="group relative border rounded-md p-3 space-y-2">
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
      <EditableField
        value={title}
        onChange={onTitleChange}
        label="Título"
        className="font-medium"
      />
      <EditableField
        value={description}
        onChange={onDescriptionChange}
        multiline
        label="Descripción"
        className="text-sm text-muted-foreground"
      />
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  section: string;
  onRegenerate?: (section: string) => Promise<void>;
  isRegenerating?: boolean;
  regeneratingSection?: string | null;
  children?: React.ReactNode;
}

function SectionHeader({ 
  title, 
  section, 
  onRegenerate, 
  isRegenerating, 
  regeneratingSection,
  children 
}: SectionHeaderProps) {
  const isThisSectionRegenerating = isRegenerating && regeneratingSection === section;

  return (
    <div className="flex items-center justify-between mb-2">
      <h4 className="font-medium">{title}</h4>
      <div className="flex items-center gap-1">
        {children}
        {onRegenerate && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => onRegenerate(section)}
                  disabled={isRegenerating}
                >
                  {isThisSectionRegenerating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Regenerar con AI</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

export function ContentEditor({
  cardType,
  content,
  title,
  dateRangeLabel,
  mentionCount,
  onContentChange,
  onTitleChange,
  onRegenerateSection,
  isRegenerating,
  regeneratingSection,
}: ContentEditorProps) {
  const updateContent = <K extends keyof typeof content>(
    key: K,
    value: typeof content[K]
  ) => {
    onContentChange({ ...content, [key]: value });
  };

  const isConversation = cardType === "conversation_analysis";
  const conversationContent = content as ConversationAnalysisContent;
  const informativeContent = content as InformativeContent;

  return (
    <Card>
      <CardHeader>
        <div className="space-y-1">
          <EditableField
            value={title}
            onChange={onTitleChange}
            className="text-lg font-semibold"
          />
          <CardDescription>
            {dateRangeLabel} • {mentionCount} menciones
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-4 pr-4">
            {/* Executive Summary - Both types */}
            {"executiveSummary" in content && (
              <div>
                <SectionHeader
                  title="Resumen Ejecutivo"
                  section="executiveSummary"
                  onRegenerate={onRegenerateSection}
                  isRegenerating={isRegenerating}
                  regeneratingSection={regeneratingSection}
                />
                <EditableField
                  value={content.executiveSummary}
                  onChange={(v) => updateContent("executiveSummary" as keyof typeof content, v as any)}
                  multiline
                  className="text-sm text-muted-foreground"
                />
              </div>
            )}

            <Separator />

            {/* Conversation Analysis Fields */}
            {isConversation && "volumeByChannel" in conversationContent && (
              <>
                {/* Volume by Channel */}
                <div>
                  <h4 className="font-medium mb-2">Volumen por Canal</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(conversationContent.volumeByChannel).map(([channel, count]) => (
                      <div key={channel} className="flex items-center gap-2">
                        <span className="text-sm capitalize w-28">{channel}:</span>
                        <Input
                          type="number"
                          value={count}
                          onChange={(e) => {
                            const newVolume = {
                              ...conversationContent.volumeByChannel,
                              [channel]: parseInt(e.target.value) || 0,
                            };
                            updateContent("volumeByChannel" as keyof typeof content, newVolume as any);
                          }}
                          className="h-8 w-20"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sentiment Distribution */}
                <div>
                  <h4 className="font-medium mb-2">Distribución de Sentimiento (%)</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(conversationContent.sentimentDistribution).map(([sentiment, pct]) => (
                      <div key={sentiment} className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "capitalize",
                            sentiment === "positivo" && "border-green-500 text-green-600",
                            sentiment === "negativo" && "border-red-500 text-red-600",
                            sentiment === "neutral" && "border-gray-500 text-gray-600"
                          )}
                        >
                          {sentiment}
                        </Badge>
                        <Input
                          type="number"
                          value={pct}
                          onChange={(e) => {
                            const newSentiment = {
                              ...conversationContent.sentimentDistribution,
                              [sentiment]: parseInt(e.target.value) || 0,
                            };
                            updateContent("sentimentDistribution" as keyof typeof content, newSentiment as any);
                          }}
                          className="h-8 w-16"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Main Narratives */}
                <div>
                  <SectionHeader
                    title="Narrativas Principales"
                    section="mainNarratives"
                    onRegenerate={onRegenerateSection}
                    isRegenerating={isRegenerating}
                    regeneratingSection={regeneratingSection}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => {
                        const newNarratives = [
                          ...conversationContent.mainNarratives,
                          { narrative: "Nueva narrativa", volume: 0, percentage: 0 },
                        ];
                        updateContent("mainNarratives" as keyof typeof content, newNarratives as any);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar
                    </Button>
                  </SectionHeader>
                  <div className="space-y-2">
                    {conversationContent.mainNarratives.map((n, i) => (
                      <div key={i} className="group relative flex items-center gap-2 border rounded-md p-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute -right-2 -top-2 h-5 w-5 opacity-0 group-hover:opacity-100 bg-background border text-destructive"
                          onClick={() => {
                            const newNarratives = conversationContent.mainNarratives.filter((_, idx) => idx !== i);
                            updateContent("mainNarratives" as keyof typeof content, newNarratives as any);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <Input
                          value={n.narrative}
                          onChange={(e) => {
                            const newNarratives = [...conversationContent.mainNarratives];
                            newNarratives[i] = { ...n, narrative: e.target.value };
                            updateContent("mainNarratives" as keyof typeof content, newNarratives as any);
                          }}
                          placeholder="Narrativa"
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          value={n.percentage}
                          onChange={(e) => {
                            const newNarratives = [...conversationContent.mainNarratives];
                            newNarratives[i] = { ...n, percentage: parseInt(e.target.value) || 0 };
                            updateContent("mainNarratives" as keyof typeof content, newNarratives as any);
                          }}
                          className="w-16"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Relevant Actors */}
                <div>
                  <SectionHeader
                    title="Actores Relevantes"
                    section="relevantActors"
                    onRegenerate={onRegenerateSection}
                    isRegenerating={isRegenerating}
                    regeneratingSection={regeneratingSection}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => {
                        const newActors = [
                          ...conversationContent.relevantActors,
                          { name: "Nuevo actor", type: "Persona", mentions: 0, description: "" },
                        ];
                        updateContent("relevantActors" as keyof typeof content, newActors as any);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar
                    </Button>
                  </SectionHeader>
                  <div className="space-y-2">
                    {conversationContent.relevantActors.map((actor, i) => (
                      <div key={i} className="group relative border rounded-md p-3 space-y-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute -right-2 -top-2 h-5 w-5 opacity-0 group-hover:opacity-100 bg-background border text-destructive"
                          onClick={() => {
                            const newActors = conversationContent.relevantActors.filter((_, idx) => idx !== i);
                            updateContent("relevantActors" as keyof typeof content, newActors as any);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <div className="flex gap-2">
                          <Input
                            value={actor.name}
                            onChange={(e) => {
                              const newActors = [...conversationContent.relevantActors];
                              newActors[i] = { ...actor, name: e.target.value };
                              updateContent("relevantActors" as keyof typeof content, newActors as any);
                            }}
                            placeholder="Nombre"
                            className="flex-1"
                          />
                          <Input
                            value={actor.type}
                            onChange={(e) => {
                              const newActors = [...conversationContent.relevantActors];
                              newActors[i] = { ...actor, type: e.target.value };
                              updateContent("relevantActors" as keyof typeof content, newActors as any);
                            }}
                            placeholder="Tipo"
                            className="w-24"
                          />
                        </div>
                        <Textarea
                          value={actor.description}
                          onChange={(e) => {
                            const newActors = [...conversationContent.relevantActors];
                            newActors[i] = { ...actor, description: e.target.value };
                            updateContent("relevantActors" as keyof typeof content, newActors as any);
                          }}
                          placeholder="Descripción"
                          rows={2}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Risks */}
                <div>
                  <SectionHeader
                    title="Riesgos"
                    section="risks"
                    onRegenerate={onRegenerateSection}
                    isRegenerating={isRegenerating}
                    regeneratingSection={regeneratingSection}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => {
                        const newRisks = [...conversationContent.risks, "Nuevo riesgo"];
                        updateContent("risks" as keyof typeof content, newRisks as any);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar
                    </Button>
                  </SectionHeader>
                  <ul className="space-y-2">
                    {conversationContent.risks.map((risk, i) => (
                      <li key={i} className="group relative flex items-center gap-2">
                        <span className="text-muted-foreground">•</span>
                        <Input
                          value={risk}
                          onChange={(e) => {
                            const newRisks = [...conversationContent.risks];
                            newRisks[i] = e.target.value;
                            updateContent("risks" as keyof typeof content, newRisks as any);
                          }}
                          className="flex-1"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                          onClick={() => {
                            const newRisks = conversationContent.risks.filter((_, idx) => idx !== i);
                            updateContent("risks" as keyof typeof content, newRisks as any);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recommendations */}
                <div>
                  <SectionHeader
                    title="Recomendaciones"
                    section="recommendations"
                    onRegenerate={onRegenerateSection}
                    isRegenerating={isRegenerating}
                    regeneratingSection={regeneratingSection}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => {
                        const newRecs = [...conversationContent.recommendations, "Nueva recomendación"];
                        updateContent("recommendations" as keyof typeof content, newRecs as any);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar
                    </Button>
                  </SectionHeader>
                  <ul className="space-y-2">
                    {conversationContent.recommendations.map((rec, i) => (
                      <li key={i} className="group relative flex items-center gap-2">
                        <span className="text-muted-foreground">•</span>
                        <Input
                          value={rec}
                          onChange={(e) => {
                            const newRecs = [...conversationContent.recommendations];
                            newRecs[i] = e.target.value;
                            updateContent("recommendations" as keyof typeof content, newRecs as any);
                          }}
                          className="flex-1"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                          onClick={() => {
                            const newRecs = conversationContent.recommendations.filter((_, idx) => idx !== i);
                            updateContent("recommendations" as keyof typeof content, newRecs as any);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {/* Informative Fields */}
            {!isConversation && "whatIsHappening" in informativeContent && (
              <>
                {/* Context */}
                <div>
                  <SectionHeader
                    title="Contexto"
                    section="context"
                    onRegenerate={onRegenerateSection}
                    isRegenerating={isRegenerating}
                    regeneratingSection={regeneratingSection}
                  />
                  <EditableField
                    value={informativeContent.context}
                    onChange={(v) => updateContent("context" as keyof typeof content, v as any)}
                    multiline
                    className="text-sm text-muted-foreground"
                  />
                </div>

                {/* What is happening */}
                <div>
                  <SectionHeader
                    title="¿Qué está pasando?"
                    section="whatIsHappening"
                    onRegenerate={onRegenerateSection}
                    isRegenerating={isRegenerating}
                    regeneratingSection={regeneratingSection}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => {
                        const newItems = [
                          ...informativeContent.whatIsHappening,
                          { title: "Nuevo punto", description: "" },
                        ];
                        updateContent("whatIsHappening" as keyof typeof content, newItems as any);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar
                    </Button>
                  </SectionHeader>
                  <div className="space-y-2">
                    {informativeContent.whatIsHappening.map((item, i) => (
                      <EditableListItem
                        key={i}
                        title={item.title}
                        description={item.description}
                        onTitleChange={(v) => {
                          const newItems = [...informativeContent.whatIsHappening];
                          newItems[i] = { ...item, title: v };
                          updateContent("whatIsHappening" as keyof typeof content, newItems as any);
                        }}
                        onDescriptionChange={(v) => {
                          const newItems = [...informativeContent.whatIsHappening];
                          newItems[i] = { ...item, description: v };
                          updateContent("whatIsHappening" as keyof typeof content, newItems as any);
                        }}
                        onDelete={() => {
                          const newItems = informativeContent.whatIsHappening.filter((_, idx) => idx !== i);
                          updateContent("whatIsHappening" as keyof typeof content, newItems as any);
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Local Implications */}
                <div>
                  <SectionHeader
                    title="Implicaciones Locales"
                    section="localImplications"
                    onRegenerate={onRegenerateSection}
                    isRegenerating={isRegenerating}
                    regeneratingSection={regeneratingSection}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => {
                        const newItems = [
                          ...informativeContent.localImplications,
                          { title: "Nueva implicación", description: "" },
                        ];
                        updateContent("localImplications" as keyof typeof content, newItems as any);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar
                    </Button>
                  </SectionHeader>
                  <div className="space-y-2">
                    {informativeContent.localImplications.map((item, i) => (
                      <EditableListItem
                        key={i}
                        title={item.title}
                        description={item.description}
                        onTitleChange={(v) => {
                          const newItems = [...informativeContent.localImplications];
                          newItems[i] = { ...item, title: v };
                          updateContent("localImplications" as keyof typeof content, newItems as any);
                        }}
                        onDescriptionChange={(v) => {
                          const newItems = [...informativeContent.localImplications];
                          newItems[i] = { ...item, description: v };
                          updateContent("localImplications" as keyof typeof content, newItems as any);
                        }}
                        onDelete={() => {
                          const newItems = informativeContent.localImplications.filter((_, idx) => idx !== i);
                          updateContent("localImplications" as keyof typeof content, newItems as any);
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Sources */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Fuentes Consultadas</h4>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const newSources = [
                          ...informativeContent.sources,
                          { name: "Nueva fuente", url: "", date: new Date().toISOString().split("T")[0] },
                        ];
                        updateContent("sources" as keyof typeof content, newSources as any);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {informativeContent.sources.map((source, i) => (
                      <div key={i} className="group relative border rounded-md p-3 space-y-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute -right-2 -top-2 h-5 w-5 opacity-0 group-hover:opacity-100 bg-background border text-destructive"
                          onClick={() => {
                            const newSources = informativeContent.sources.filter((_, idx) => idx !== i);
                            updateContent("sources" as keyof typeof content, newSources as any);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <Input
                          value={source.name}
                          onChange={(e) => {
                            const newSources = [...informativeContent.sources];
                            newSources[i] = { ...source, name: e.target.value };
                            updateContent("sources" as keyof typeof content, newSources as any);
                          }}
                          placeholder="Nombre de la fuente"
                        />
                        <Input
                          value={source.url}
                          onChange={(e) => {
                            const newSources = [...informativeContent.sources];
                            newSources[i] = { ...source, url: e.target.value };
                            updateContent("sources" as keyof typeof content, newSources as any);
                          }}
                          placeholder="URL"
                        />
                        <Input
                          type="date"
                          value={source.date}
                          onChange={(e) => {
                            const newSources = [...informativeContent.sources];
                            newSources[i] = { ...source, date: e.target.value };
                            updateContent("sources" as keyof typeof content, newSources as any);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
