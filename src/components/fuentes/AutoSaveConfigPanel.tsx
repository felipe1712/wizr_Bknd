import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useAutoSaveConfig, AutoSaveConfigInput } from "@/hooks/useAutoSaveConfig";
import { Sparkles, X, Plus, Settings2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface AutoSaveConfigPanelProps {
  projectId: string | undefined;
}

export function AutoSaveConfigPanel({ projectId }: AutoSaveConfigPanelProps) {
  const { config, isLoading, updateConfig, isUpdating } = useAutoSaveConfig(projectId);
  const [isOpen, setIsOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [minScore, setMinScore] = useState(50);

  // Sync local state with config
  useEffect(() => {
    if (config) {
      setIsEnabled(config.is_enabled);
      setKeywords(config.required_keywords || []);
      setMinScore(config.min_relevance_score);
    }
  }, [config]);

  const handleAddKeyword = () => {
    const trimmed = newKeyword.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
      setNewKeyword("");
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
  };

  const handleSave = () => {
    const input: AutoSaveConfigInput = {
      is_enabled: isEnabled,
      required_keywords: keywords,
      min_relevance_score: minScore,
    };
    updateConfig(input);
  };

  const hasChanges =
    config?.is_enabled !== isEnabled ||
    JSON.stringify(config?.required_keywords || []) !== JSON.stringify(keywords) ||
    config?.min_relevance_score !== minScore;

  if (!projectId) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Auto-guardado</CardTitle>
                {isEnabled && (
                  <Badge variant="secondary" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Activo
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-6 px-2">
                {isOpen ? "Cerrar" : "Configurar"}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <CardDescription>
              Guarda automáticamente resultados que cumplan con las reglas configuradas
            </CardDescription>

            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-save-enabled" className="text-sm">
                Habilitar auto-guardado
              </Label>
              <Switch
                id="auto-save-enabled"
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
              />
            </div>

            {isEnabled && (
              <>
                {/* Required Keywords */}
                <div className="space-y-2">
                  <Label className="text-sm">Keywords obligatorios</Label>
                  <p className="text-xs text-muted-foreground">
                    Solo se guardarán resultados que contengan al menos uno de estos términos
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Agregar keyword..."
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
                      className="h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAddKeyword}
                      disabled={!newKeyword.trim()}
                      className="h-8"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  {keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {keywords.map((kw) => (
                        <Badge
                          key={kw}
                          variant="secondary"
                          className="text-xs pr-1"
                        >
                          {kw}
                          <button
                            onClick={() => handleRemoveKeyword(kw)}
                            className="ml-1 hover:bg-muted rounded p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Relevance Score */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Score mínimo de relevancia</Label>
                    <span className="text-sm font-medium">{minScore}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Basado en el porcentaje de keywords encontrados
                  </p>
                  <Slider
                    value={[minScore]}
                    onValueChange={([value]) => setMinScore(value)}
                    min={0}
                    max={100}
                    step={10}
                    className="w-full"
                  />
                </div>
              </>
            )}

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={isUpdating || isLoading || !hasChanges}
              size="sm"
              className="w-full"
            >
              {isUpdating ? "Guardando..." : "Guardar configuración"}
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
