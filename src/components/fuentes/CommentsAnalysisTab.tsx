import React, { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  MessageCircle,
  Search,
  Filter,
  RefreshCw,
  ThumbsUp,
  Reply,
  ExternalLink,
  User,
  TrendingUp,
  AlertCircle,
  Sparkles,
  BarChart3,
  Download,
  CheckCircle2,
} from "lucide-react";

interface CommentsAnalysisTabProps {
  projectId: string;
}

// Simple text sentiment analysis function
async function analyzeTextSentiment(text: string): Promise<string | null> {
  if (!text?.trim()) return null;
  
  try {
    const { data, error } = await supabase.functions.invoke("analyze-sentiment", {
      body: { mentions: [{ id: "temp", title: text, description: null }] },
    });

    if (error) throw error;
    if (!data?.success || !data.results?.length) return null;

    return data.results[0].sentiment;
  } catch (err) {
    console.error("Text sentiment analysis error:", err);
    return null;
  }
}

interface PostComment {
  id: string;
  content: string;
  author_name: string | null;
  author_username: string | null;
  author_url: string | null;
  likes: number | null;
  replies_count: number | null;
  published_at: string | null;
  sentiment: string | null;
  external_id: string | null;
  social_result_id: string | null;
  mention_id: string | null;
  created_at: string;
}

const SENTIMENT_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  positivo: { label: "Positivo", color: "text-green-700", bgColor: "bg-green-100" },
  neutral: { label: "Neutral", color: "text-gray-700", bgColor: "bg-gray-100" },
  negativo: { label: "Negativo", color: "text-red-700", bgColor: "bg-red-100" },
};

export function CommentsAnalysisTab({ projectId }: CommentsAnalysisTabProps) {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [selectedComments, setSelectedComments] = useState<Set<string>>(new Set());

  // Fetch comments from database
  const {
    data: comments = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["post-comments", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_comments")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data as PostComment[];
    },
    enabled: !!projectId,
  });

  // Stats calculation
  const stats = useMemo(() => {
    const total = comments.length;
    const analyzed = comments.filter((c) => c.sentiment).length;
    const positive = comments.filter((c) => c.sentiment === "positivo").length;
    const neutral = comments.filter((c) => c.sentiment === "neutral").length;
    const negative = comments.filter((c) => c.sentiment === "negativo").length;
    const totalLikes = comments.reduce((sum, c) => sum + (c.likes || 0), 0);
    const totalReplies = comments.reduce((sum, c) => sum + (c.replies_count || 0), 0);

    return { total, analyzed, positive, neutral, negative, totalLikes, totalReplies };
  }, [comments]);

  // Filtered comments
  const filteredComments = useMemo(() => {
    return comments.filter((comment) => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const inContent = comment.content?.toLowerCase().includes(search);
        const inAuthor = comment.author_name?.toLowerCase().includes(search);
        const inUsername = comment.author_username?.toLowerCase().includes(search);
        if (!inContent && !inAuthor && !inUsername) return false;
      }

      // Sentiment filter
      if (sentimentFilter !== "all") {
        if (sentimentFilter === "pending" && comment.sentiment) return false;
        if (sentimentFilter !== "pending" && comment.sentiment !== sentimentFilter) return false;
      }

      return true;
    });
  }, [comments, searchTerm, sentimentFilter]);

  // Handle bulk sentiment analysis
  const handleAnalyzeSelected = async () => {
    if (selectedComments.size === 0) {
      toast({
        title: "Sin selección",
        description: "Selecciona comentarios para analizar",
        variant: "destructive",
      });
      return;
    }

    const toAnalyze = comments.filter((c) => selectedComments.has(c.id) && !c.sentiment);

    if (toAnalyze.length === 0) {
      toast({
        title: "Ya analizados",
        description: "Los comentarios seleccionados ya tienen sentimiento asignado",
      });
      return;
    }

    setIsAnalyzing(true);
    toast({
      title: "Analizando...",
      description: `Procesando ${toAnalyze.length} comentarios`,
    });

    let processed = 0;
    for (const comment of toAnalyze) {
      try {
        const sentiment = await analyzeTextSentiment(comment.content);
        if (sentiment) {
          await supabase
            .from("post_comments")
            .update({ sentiment })
            .eq("id", comment.id);
          processed++;
        }
      } catch (err) {
        console.error("Error analyzing comment:", err);
      }
    }

    setIsAnalyzing(false);
    await refetch();
    setSelectedComments(new Set());

    toast({
      title: "Análisis completado",
      description: `Se analizaron ${processed} comentarios`,
    });
  };

  // Handle export
  const handleExport = () => {
    if (filteredComments.length === 0) return;

    const headers = ["Contenido", "Autor", "Usuario", "Likes", "Respuestas", "Sentimiento", "Fecha"];
    const rows = filteredComments.map((c) => [
      `"${(c.content || "").replace(/"/g, '""')}"`,
      `"${(c.author_name || "").replace(/"/g, '""')}"`,
      c.author_username || "",
      c.likes || 0,
      c.replies_count || 0,
      c.sentiment || "Sin analizar",
      c.published_at || c.created_at,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `comentarios_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Exportación completada",
      description: `${filteredComments.length} comentarios exportados`,
    });
  };

  // Toggle selection
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedComments);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedComments(newSet);
  };

  const selectAll = () => {
    if (selectedComments.size === filteredComments.length) {
      setSelectedComments(new Set());
    } else {
      setSelectedComments(new Set(filteredComments.map((c) => c.id)));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xl font-bold">{stats.analyzed}</p>
                <p className="text-xs text-muted-foreground">Analizados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xl font-bold text-green-700">{stats.positive}</p>
            <p className="text-xs text-green-600">Positivos</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200 bg-gray-50/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xl font-bold text-gray-700">{stats.neutral}</p>
            <p className="text-xs text-gray-600">Neutrales</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xl font-bold text-red-700">{stats.negative}</p>
            <p className="text-xs text-red-600">Negativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-pink-500" />
              <div>
                <p className="text-xl font-bold">{stats.totalLikes.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Likes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Reply className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-xl font-bold">{stats.totalReplies.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Respuestas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Análisis de Comentarios
          </CardTitle>
          <CardDescription>
            Analiza el sentimiento de comentarios recopilados de publicaciones en redes sociales
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en contenido o autor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sentimiento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="positivo">Positivo</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="negativo">Negativo</SelectItem>
                <SelectItem value="pending">Sin analizar</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={filteredComments.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>

          {/* Bulk Actions */}
          {selectedComments.size > 0 && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mb-4">
              <span className="text-sm font-medium">{selectedComments.size} seleccionados</span>
              <Button size="sm" onClick={handleAnalyzeSelected} disabled={isAnalyzing}>
                <Sparkles className="h-4 w-4 mr-2" />
                {isAnalyzing ? "Analizando..." : "Analizar sentimiento"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedComments(new Set())}>
                Cancelar
              </Button>
            </div>
          )}

          {/* Comments Table */}
          {filteredComments.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium">Sin comentarios</p>
              <p className="text-sm text-muted-foreground">
                {comments.length === 0
                  ? "Los comentarios de publicaciones de redes sociales aparecerán aquí"
                  : "No hay comentarios que coincidan con los filtros"}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <input
                        type="checkbox"
                        checked={selectedComments.size === filteredComments.length && filteredComments.length > 0}
                        onChange={selectAll}
                        className="rounded border-gray-300"
                      />
                    </TableHead>
                    <TableHead>Comentario</TableHead>
                    <TableHead>Autor</TableHead>
                    <TableHead className="text-center">Interacción</TableHead>
                    <TableHead className="text-center">Sentimiento</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredComments.slice(0, 100).map((comment) => {
                    const sentimentInfo = comment.sentiment
                      ? SENTIMENT_CONFIG[comment.sentiment]
                      : null;

                    return (
                      <TableRow key={comment.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedComments.has(comment.id)}
                            onChange={() => toggleSelect(comment.id)}
                            className="rounded border-gray-300"
                          />
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <p className="line-clamp-2 text-sm">{comment.content}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">
                                {comment.author_name || "Anónimo"}
                              </p>
                              {comment.author_username && (
                                <p className="text-xs text-muted-foreground">
                                  @{comment.author_username}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <ThumbsUp className="h-3 w-3" />
                              {comment.likes || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <Reply className="h-3 w-3" />
                              {comment.replies_count || 0}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {sentimentInfo ? (
                            <Badge className={`${sentimentInfo.bgColor} ${sentimentInfo.color}`}>
                              {sentimentInfo.label}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Sin analizar
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {comment.published_at
                            ? formatDistanceToNow(new Date(comment.published_at), {
                                addSuffix: true,
                                locale: es,
                              })
                            : format(new Date(comment.created_at), "dd MMM yyyy", { locale: es })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {filteredComments.length > 100 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Mostrando 100 de {filteredComments.length} comentarios
                </p>
              )}
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Cómo funciona el análisis de comentarios</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Los comentarios se recopilan automáticamente al scrapear publicaciones de redes sociales</li>
                <li>Selecciona comentarios y haz clic en "Analizar sentimiento" para clasificarlos con IA</li>
                <li>El análisis detecta si el comentario es positivo, neutral o negativo</li>
                <li>Exporta los resultados a CSV para reportes externos</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
