import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  Bot, 
  User, 
  Sparkles,
  Loader2,
  RefreshCw
} from "lucide-react";
import { FKProfile, FKProfileKPI } from "@/hooks/useFanpageKarma";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface RankingAIChatProps {
  profiles: FKProfile[];
  kpis: FKProfileKPI[];
  rankingName: string;
  initialQuestion?: string;
}

function buildContextFromData(profiles: FKProfile[], kpis: FKProfileKPI[]): string {
  // Get latest KPI for each profile
  const latestKpiByProfile = new Map<string, FKProfileKPI>();
  kpis.forEach(kpi => {
    const existing = latestKpiByProfile.get(kpi.fk_profile_id);
    if (!existing || new Date(kpi.period_end) > new Date(existing.period_end)) {
      latestKpiByProfile.set(kpi.fk_profile_id, kpi);
    }
  });

  const profilesWithData = profiles.map(profile => {
    const kpi = latestKpiByProfile.get(profile.id);
    return {
      nombre: profile.display_name || profile.profile_id,
      red: profile.network,
      seguidores: kpi?.followers || 0,
      crecimiento_seguidores: kpi?.follower_growth_percent || 0,
      engagement_rate: kpi?.engagement_rate || 0,
      posts_por_dia: kpi?.posts_per_day || 0,
      indice_rendimiento: kpi?.page_performance_index || 0,
      periodo: kpi ? `${kpi.period_start} a ${kpi.period_end}` : "sin datos"
    };
  });

  return JSON.stringify(profilesWithData, null, 2);
}

export function RankingAIChat({ profiles, kpis, rankingName, initialQuestion }: RankingAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialQuestion && messages.length === 0) {
      handleSendMessage(initialQuestion);
    }
  }, [initialQuestion]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const context = buildContextFromData(profiles, kpis);
      
      const systemPrompt = `Eres un analista experto en redes sociales y benchmarking competitivo. 
Estás analizando el ranking "${rankingName}" con estos perfiles y métricas:

${context}

INSTRUCCIONES DE FORMATO:
- Responde en español con lenguaje ejecutivo y profesional
- Usa formato limpio: párrafos cortos, sin exceso de negritas ni símbolos
- Para listas usa viñetas simples (-)
- Incluye datos específicos con números claros
- Máximo 150 palabras
- Destaca solo lo más importante, evita relleno
- Si no hay datos suficientes, indícalo brevemente`;

      const { data, error } = await supabase.functions.invoke("ranking-ai-chat", {
        body: {
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: text }
          ],
          systemPrompt
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response || "No pude generar una respuesta. Intenta de nuevo.",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("AI Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Lo siento, hubo un error al procesar tu pregunta. Por favor intenta de nuevo.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleReset = () => {
    setMessages([]);
    setInput("");
  };

  const suggestedQuestions = [
    "¿Cuál es el perfil con mejor rendimiento general?",
    "Compara el engagement de todos los perfiles",
    "¿Qué perfil debería mejorar su estrategia?",
    "Resume las fortalezas y debilidades del ranking"
  ];

  return (
    <Card className="flex flex-col h-[500px]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Asistente de Análisis
          </CardTitle>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Reiniciar
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-4 pt-0 gap-4">
        {/* Messages area */}
        <ScrollArea ref={scrollRef} className="flex-1 pr-4">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="text-center py-8">
                <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">Pregunta lo que quieras</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Puedo analizar los datos del ranking y responder preguntas específicas.
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Sugerencias:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((q, i) => (
                    <Badge 
                      key={i} 
                      variant="outline" 
                      className="cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => handleSendMessage(q)}
                    >
                      {q}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                   className={`flex gap-3 min-w-0 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                     className={`rounded-lg px-4 py-3 max-w-[85%] overflow-hidden min-w-0 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {message.role === "user" ? (
                      <p className="text-sm break-words whitespace-pre-wrap overflow-wrap-anywhere">{message.content}</p>
                    ) : (
                       <div className="prose prose-sm dark:prose-invert max-w-none overflow-hidden min-w-0 ai-markdown [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p]:my-2 [&>ul]:my-2 [&>ul]:pl-4 [&>li]:my-0.5 [&_strong]:font-semibold">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="rounded-lg px-4 py-3 bg-muted">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Analizando...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input area */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribe tu pregunta..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button 
            onClick={() => handleSendMessage()} 
            disabled={!input.trim() || isLoading}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
