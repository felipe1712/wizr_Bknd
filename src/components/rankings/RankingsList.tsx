import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trophy, ChevronRight, Trash2, Plus } from "lucide-react";
import { Ranking, useDeleteRanking } from "@/hooks/useRankings";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { CreateRankingDialog } from "./CreateRankingDialog";

interface RankingsListProps {
  rankings: Ranking[];
  isLoading: boolean;
  onSelectRanking: (rankingId: string) => void;
}

export function RankingsList({ rankings, isLoading, onSelectRanking }: RankingsListProps) {
  const deleteRanking = useDeleteRanking();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (rankings.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mb-6">
            <Trophy className="h-8 w-8 text-amber-600" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Crea tu primer ranking</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Los rankings te permiten comparar perfiles de redes sociales y monitorear su desempeño competitivo a lo largo del tiempo.
          </p>
          <CreateRankingDialog onSuccess={onSelectRanking} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Mis Rankings</h2>
          <p className="text-muted-foreground">{rankings.length} rankings configurados</p>
        </div>
        <CreateRankingDialog onSuccess={onSelectRanking} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rankings.map((ranking) => (
          <Card 
            key={ranking.id} 
            className="hover:border-primary/50 transition-colors cursor-pointer group"
            onClick={() => onSelectRanking(ranking.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Trophy className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{ranking.name}</CardTitle>
                    <CardDescription className="text-xs">
                      Creado {formatDistanceToNow(new Date(ranking.created_at), { addSuffix: true, locale: es })}
                    </CardDescription>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </CardHeader>
            {ranking.description && (
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground line-clamp-2">{ranking.description}</p>
              </CardContent>
            )}
            <CardContent className="pt-2">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">
                  Benchmarking
                </Badge>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-muted-foreground hover:text-destructive"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-background" onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar ranking?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se eliminará "{ranking.name}" y todos sus perfiles asociados. Esta acción no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteRanking.mutate(ranking.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
