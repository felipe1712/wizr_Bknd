import { useState } from "react";
import { useThematicCards, ThematicCard, ConversationAnalysisContent, InformativeContent } from "@/hooks/useThematicCards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  FileText,
  MessageSquare,
  Trash2,
  Eye,
  Download,
  Calendar,
  MoreVertical,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThematicCardViewer } from "./ThematicCardViewer";
import { generateThematicCardPDF } from "@/lib/reports/thematicCardPdfGenerator";
import { useToast } from "@/hooks/use-toast";

interface ThematicCardListProps {
  projectId: string;
}

export function ThematicCardList({ projectId }: ThematicCardListProps) {
  const { cards, isLoading, delete: deleteCard, isDeleting } = useThematicCards(projectId);
  const [selectedCard, setSelectedCard] = useState<ThematicCard | null>(null);
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (cardToDelete) {
      await deleteCard(cardToDelete);
      setCardToDelete(null);
    }
  };

  const handleExportPDF = async (card: ThematicCard) => {
    setExportingId(card.id);
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
      setExportingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Cargando fichas...</div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No hay fichas temáticas</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Crea tu primera ficha temática seleccionando menciones y generando análisis con AI.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const isConversation = card.card_type === "conversation_analysis";
          const content = card.content as ConversationAnalysisContent | InformativeContent;

          return (
            <Card key={card.id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isConversation ? (
                      <MessageSquare className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <Badge
                      variant={card.status === "published" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {card.status === "published" ? "Publicada" : "Borrador"}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedCard(card)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleExportPDF(card)}
                        disabled={exportingId === card.id}
                      >
                        {exportingId === card.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        Exportar PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setCardToDelete(card.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardTitle className="text-base line-clamp-2">{card.title}</CardTitle>
                <CardDescription className="flex items-center gap-1 text-xs">
                  <Calendar className="h-3 w-3" />
                  {card.period_start && card.period_end
                    ? `${format(new Date(card.period_start), "d MMM", { locale: es })} - ${format(new Date(card.period_end), "d MMM yyyy", { locale: es })}`
                    : format(new Date(card.created_at), "d MMM yyyy", { locale: es })}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {"executiveSummary" in content
                    ? content.executiveSummary
                    : "Sin resumen disponible"}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="outline" className="text-xs">
                    {isConversation ? "Análisis" : "Informativa"}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {card.mention_ids.length} menciones
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  className="w-full mt-3"
                  onClick={() => setSelectedCard(card)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Ver ficha completa
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Card Viewer Dialog */}
      {selectedCard && (
        <ThematicCardViewer
          card={selectedCard}
          open={!!selectedCard}
          onClose={() => setSelectedCard(null)}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!cardToDelete} onOpenChange={() => setCardToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ficha temática?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La ficha y todo su contenido serán eliminados
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
