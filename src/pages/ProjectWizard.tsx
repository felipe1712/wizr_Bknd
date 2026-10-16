import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Send,
  BarChart3,
  Search,
  FileText,
  Zap,
  Clock,
  Telescope,
  BookOpen,
  Loader2,
  Sparkles,
  Plus,
  X,
  ArrowRight,
} from "lucide-react";
import wizrLogo from "@/assets/wizr-logo.png";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

type ProductType = "performance" | "listening" | "briefing";
type ListeningDepth = "flash" | "brief" | "deep_dive" | "investigacion";
type InputMode = "text" | "textarea" | "entities" | null;

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  options?: OptionItem[];
  entities?: string[]; // for displaying entity chips in user messages
}

interface OptionItem {
  value: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

interface WizardState {
  step: number;
  product?: ProductType;
  depth?: ListeningDepth;
  name?: string;
  entities: string[];
  audience?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PRODUCT_OPTIONS: OptionItem[] = [
  {
    value: "performance",
    label: "Performance de Redes",
    description: "Análisis competitivo de actores en redes sociales",
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    value: "listening",
    label: "Listening Temático",
    description: "Monitorear conversaciones sobre un tema, actor o fenómeno",
    icon: <Search className="h-5 w-5" />,
  },
  {
    value: "briefing",
    label: "Briefing Personalizado",
    description: "Contenido curado para tomadores de decisiones",
    icon: <FileText className="h-5 w-5" />,
  },
];

const DEPTH_OPTIONS: OptionItem[] = [
  {
    value: "flash",
    label: "Flash ⚡",
    description: "¿Qué se dice ahora? Búsqueda rápida + resumen",
    icon: <Zap className="h-5 w-5" />,
  },
  {
    value: "brief",
    label: "Brief 📋",
    description: "Un evento o noticia. Análisis de 1 día",
    icon: <Clock className="h-5 w-5" />,
  },
  {
    value: "deep_dive",
    label: "Deep Dive 🔍",
    description: "Fenómeno de días o semanas. Evolución y narrativas",
    icon: <Telescope className="h-5 w-5" />,
  },
  {
    value: "investigacion",
    label: "Investigación 📊",
    description: "Análisis exhaustivo de semanas o meses",
    icon: <BookOpen className="h-5 w-5" />,
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────────

function mapProductToProjectType(product: ProductType): string {
  switch (product) {
    case "performance": return "benchmark";
    case "listening": return "monitoreo";
    case "briefing": return "monitoreo";
  }
}

function mapDepthToTemporal(depth?: ListeningDepth): string {
  switch (depth) {
    case "flash": return "tiempo_real";
    case "brief": return "diario";
    case "deep_dive": return "semanal";
    case "investigacion": return "mensual";
    default: return "diario";
  }
}

function mapDepthToSensitivity(depth?: ListeningDepth): string {
  switch (depth) {
    case "flash": return "bajo";
    case "brief": return "medio";
    case "deep_dive": return "alto";
    case "investigacion": return "alto";
    default: return "medio";
  }
}

function guessEntityType(product: ProductType): string {
  switch (product) {
    case "performance": return "marca";
    case "listening": return "tema";
    case "briefing": return "tema";
  }
}

const uid = () => crypto.randomUUID();

// ── Component ──────────────────────────────────────────────────────────────────

const ProjectWizard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const [state, setState] = useState<WizardState>({ step: 0, entities: [] });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>(null);
  const [placeholder, setPlaceholder] = useState("");
  const [pendingEntities, setPendingEntities] = useState<string[]>([]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pendingEntities]);

  // Focus input
  useEffect(() => {
    if (inputMode && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [inputMode]);

  // Start conversation
  useEffect(() => {
    const timer = setTimeout(() => {
      addAssistantMessage(
        "¡Hola! Soy Wizr. Vamos a configurar tu nuevo análisis.\n\n¿Qué necesitas hacer?",
        PRODUCT_OPTIONS
      );
      setState({ step: 1, entities: [] });
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const addAssistantMessage = (content: string, options?: OptionItem[]) => {
    setMessages((prev) => [...prev, { id: uid(), role: "assistant", content, options }]);
  };

  const addUserMessage = (content: string, entities?: string[]) => {
    setMessages((prev) => [...prev, { id: uid(), role: "user", content, entities }]);
    setInputMode(null);
  };

  const showInput = (mode: InputMode, ph: string) => {
    setInputMode(mode);
    setPlaceholder(ph);
  };

  // ── Entity Input Helpers ──────────────────────────────────────────────────

  const addEntity = () => {
    const val = inputValue.trim();
    if (!val || pendingEntities.includes(val)) return;
    setPendingEntities((prev) => [...prev, val]);
    setInputValue("");
  };

  const removeEntity = (name: string) => {
    setPendingEntities((prev) => prev.filter((e) => e !== name));
  };

  const confirmEntities = () => {
    if (pendingEntities.length === 0) return;
    const entities = [...pendingEntities];
    const displayText = entities.join(", ");
    addUserMessage(displayText, entities);
    setState((s) => ({ ...s, entities }));
    setPendingEntities([]);
    advanceAfterEntities(entities);
  };

  // ── Flow Logic ──────────────────────────────────────────────────────────────

  const handleOptionSelect = useCallback(
    (value: string, label: string) => {
      addUserMessage(label);

      switch (state.step) {
        case 1: {
          const product = value as ProductType;
          setState((s) => ({ ...s, step: 2, product }));

          setTimeout(() => {
            if (product === "performance") {
              addAssistantMessage(
                "Perfecto, análisis de performance.\n\n¿A quiénes quieres comparar? Agrega los actores o marcas que te interesan."
              );
              showInput("entities", "Escribe un nombre y presiona Enter o +");
            } else if (product === "listening") {
              addAssistantMessage("Entendido, listening temático. ¿Qué tan profundo necesitas ir?", DEPTH_OPTIONS);
            } else {
              addAssistantMessage(
                "Briefing personalizado. ¿Para quién es este briefing? Describe al tomador de decisiones."
              );
              showInput("text", "Ej: Director de comunicación de Actinver");
            }
          }, 300);
          break;
        }

        case 2: {
          // Depth selected (listening only)
          const depth = value as ListeningDepth;
          setState((s) => ({ ...s, step: 3, depth }));

          setTimeout(() => {
            addAssistantMessage(
              "¿Sobre qué temas, personas o fenómenos quieres investigar?\n\nPuedes agregar varios para comparar o dar seguimiento."
            );
            showInput("entities", "Ej: Reforma judicial, AMLO, Claudia Sheinbaum...");
          }, 300);
          break;
        }
      }
    },
    [state.step]
  );

  const advanceAfterEntities = (entities: string[]) => {
    const { product } = state;
    const entitiesList = entities.map((e) => `**${e}**`).join(", ");

    if (product === "performance") {
      setState((s) => ({ ...s, step: 3 }));
      setTimeout(() => {
        addAssistantMessage(
          `Genial, vamos a analizar: ${entitiesList}.\n\n¿Quieres darle un nombre al proyecto?`
        );
        showInput("text", `Ej: Performance Banca Digital Q2 2026`);
      }, 300);
    } else if (product === "listening") {
      setState((s) => ({ ...s, step: 4 }));
      setTimeout(() => {
        addAssistantMessage(
          `Perfecto, vamos a monitorear: ${entitiesList}.\n\n¿Quién va a usar este análisis?`
        );
        showInput("text", "Ej: Equipo de comunicación, director general...");
      }, 300);
    } else if (product === "briefing") {
      setState((s) => ({ ...s, step: 4 }));
      setTimeout(() => {
        addAssistantMessage(
          `Temas del briefing: ${entitiesList}.\n\n¿Quieres darle un nombre al proyecto?`
        );
        showInput("text", `Ej: Briefing para ${state.audience}`);
      }, 300);
    }
  };

  const handleTextSubmit = useCallback(() => {
    if (!inputValue.trim()) return;

    // If in entities mode, add entity instead of submitting
    if (inputMode === "entities") {
      addEntity();
      return;
    }

    const value = inputValue.trim();
    addUserMessage(value);
    setInputValue("");

    const { step, product } = state;

    if (product === "briefing" && step === 2) {
      // Audience entered for briefing
      setState((s) => ({ ...s, step: 3, audience: value }));
      setTimeout(() => {
        addAssistantMessage(
          "¿Sobre qué temas necesita estar informado?\n\nAgrega los temas, competidores o actores que quieras monitorear."
        );
        showInput("entities", "Ej: Mercado financiero, regulación CNBV, GBM...");
      }, 300);
    } else if (product === "listening" && step === 4) {
      // Audience entered for listening
      setState((s) => ({ ...s, step: 5, audience: value }));
      setTimeout(() => {
        addAssistantMessage("¿Quieres darle un nombre al proyecto?");
        const firstEntity = state.entities[0] || "Tema";
        showInput("text", `Ej: Listening - ${firstEntity}`);
      }, 300);
    } else if (
      (product === "performance" && step === 3) ||
      (product === "listening" && step === 5) ||
      (product === "briefing" && step === 4)
    ) {
      // Name entered → create project
      setState((s) => ({ ...s, name: value }));
      createProject({ ...state, name: value });
    }
  }, [inputValue, state, inputMode]);

  // ── Create Project + Entities ─────────────────────────────────────────────

  const createProject = async (finalState: WizardState) => {
    if (!user) return;
    setIsCreating(true);
    setInputMode(null);

    const projectName =
      finalState.name || `${finalState.product} - ${finalState.entities.join(", ") || "Nuevo"}`;
    const objetivo = buildObjective(finalState);

    try {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          nombre: projectName,
          tipo: mapProductToProjectType(finalState.product!) as any,
          objetivo,
          audiencia: finalState.audience || "Equipo de análisis",
          sensibilidad: mapDepthToSensitivity(finalState.depth) as any,
          alcance_temporal: mapDepthToTemporal(finalState.depth) as any,
          alcance_geografico: ["México", "LATAM"],
          descripcion: `Producto: ${finalState.product}${finalState.depth ? ` | Profundidad: ${finalState.depth}` : ""}`,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Create entities
      if (finalState.entities.length > 0 && data?.id) {
        const entityType = guessEntityType(finalState.product!);
        const entitiesToInsert = finalState.entities.map((name) => ({
          project_id: data.id,
          nombre: name,
          tipo: entityType as any,
          palabras_clave: [name],
          aliases: [],
        }));

        const { error: entitiesError } = await supabase
          .from("entities")
          .insert(entitiesToInsert);

        if (entitiesError) {
          console.error("Error creating entities:", entitiesError);
        }
      }

      setTimeout(() => {
        const entityCount = finalState.entities.length;
        const entityMsg = entityCount > 0 ? `\n${entityCount} entidades creadas.` : "";
        addAssistantMessage(
          `✅ **¡Proyecto creado!**\n\n**${projectName}**${entityMsg}\n\nTe llevo al dashboard para que empieces a trabajar.`
        );

        setTimeout(() => {
          toast({ title: "¡Proyecto creado!", description: projectName });
          navigate("/dashboard/fuentes");
        }, 1500);
      }, 400);
    } catch (error: any) {
      addAssistantMessage(`❌ Hubo un error: ${error.message}. Intenta de nuevo.`);
      setIsCreating(false);
    }
  };

  const buildObjective = (s: WizardState): string => {
    const entitiesStr = s.entities.join(", ") || "los actores definidos";
    switch (s.product) {
      case "performance":
        return `Analizar el performance en redes sociales de ${entitiesStr} para identificar tendencias de engagement, crecimiento y contenido top.`;
      case "listening":
        return `Monitorear y analizar conversaciones sobre ${entitiesStr} en medios digitales y redes sociales.`;
      case "briefing":
        return `Generar briefings personalizados sobre ${entitiesStr} para ${s.audience || "el tomador de decisiones"}.`;
      default:
        return "Análisis de inteligencia estratégica.";
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <img src={wizrLogo} alt="Wizr" className="h-7 w-auto" />
            <span className="text-sm font-medium text-muted-foreground">Nuevo análisis</span>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-1 px-4 py-6">
          {messages.map((msg) => (
            <div key={msg.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {msg.role === "assistant" ? (
                <AssistantBubble
                  content={msg.content}
                  options={msg.options}
                  onOptionSelect={handleOptionSelect}
                  isLatest={msg.id === messages[messages.length - 1]?.id}
                />
              ) : (
                <UserBubble content={msg.content} entities={msg.entities} />
              )}
            </div>
          ))}

          {isCreating && (
            <div className="flex items-center gap-2 py-4 pl-12 text-sm text-muted-foreground animate-in fade-in">
              <Loader2 className="h-4 w-4 animate-spin" />
              Creando tu proyecto...
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      {inputMode && !isCreating && (
        <div className="border-t border-border bg-card px-4 py-3 animate-in slide-in-from-bottom-4 duration-200">
          <div className="mx-auto max-w-2xl space-y-2">
            {/* Entity chips */}
            {inputMode === "entities" && pendingEntities.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {pendingEntities.map((name) => (
                  <Badge
                    key={name}
                    variant="secondary"
                    className="gap-1 py-1 pl-3 pr-1.5 text-sm"
                  >
                    {name}
                    <button
                      onClick={() => removeEntity(name)}
                      className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              {inputMode === "textarea" ? (
                <Textarea
                  ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={placeholder}
                  className="min-h-[80px] resize-none bg-background"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleTextSubmit();
                    }
                  }}
                />
              ) : (
                <Input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={placeholder}
                  className="bg-background"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleTextSubmit();
                    }
                  }}
                />
              )}

              {inputMode === "entities" ? (
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={addEntity}
                    disabled={!inputValue.trim()}
                    title="Agregar"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={confirmEntities}
                    disabled={pendingEntities.length === 0}
                    title="Continuar"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  size="icon"
                  onClick={handleTextSubmit}
                  disabled={!inputValue.trim()}
                  className="shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>

            {inputMode === "entities" && (
              <p className="text-xs text-muted-foreground">
                Escribe cada nombre y presiona Enter o <Plus className="inline h-3 w-3" /> para agregar. 
                Cuando termines, presiona <ArrowRight className="inline h-3 w-3" /> para continuar.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Sub-components ──────────────────────────────────────────────────────────────

function AssistantBubble({
  content,
  options,
  onOptionSelect,
  isLatest,
}: {
  content: string;
  options?: OptionItem[];
  onOptionSelect: (value: string, label: string) => void;
  isLatest: boolean;
}) {
  return (
    <div className="flex gap-3 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 space-y-3">
        <div className="text-sm leading-relaxed text-foreground whitespace-pre-line">
          {content.split(/\*\*(.*?)\*\*/g).map((part, i) =>
            i % 2 === 1 ? (
              <strong key={i} className="font-semibold">{part}</strong>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </div>
        {options && isLatest && (
          <div className="grid gap-2 sm:grid-cols-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onOptionSelect(opt.value, opt.label)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all",
                  "hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm",
                  "active:scale-[0.98]"
                )}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {opt.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UserBubble({ content, entities }: { content: string; entities?: string[] }) {
  return (
    <div className="flex justify-end py-2">
      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
        {entities && entities.length > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            {entities.map((e) => (
              <span key={e} className="inline-block rounded-full bg-primary-foreground/20 px-2.5 py-0.5 text-xs font-medium">
                {e}
              </span>
            ))}
          </div>
        ) : (
          content
        )}
      </div>
    </div>
  );
}

export default ProjectWizard;
