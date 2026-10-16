import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
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
import { Trash2, Users, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { FKProfile, getNetworkLabel, useDeleteFKProfile, useBulkDeleteFKProfiles, FKNetwork } from "@/hooks/useFanpageKarma";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { getFKProfileDisplayName, getFKProfileTechnicalLabel } from "@/lib/fkProfileUtils";

const NETWORK_COLORS: Record<FKNetwork, string> = {
  facebook: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  instagram: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  youtube: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  linkedin: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  tiktok: "bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200",
  threads: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  twitter: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
};

interface ProfilesListProps {
  profiles: FKProfile[];
  isLoading: boolean;
  rankingId?: string;
  projectId?: string;
}

export function ProfilesList({ profiles, isLoading, rankingId, projectId }: ProfilesListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  
  const deleteProfile = useDeleteFKProfile();
  const bulkDeleteProfiles = useBulkDeleteFKProfiles();

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(profiles.map(p => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (profileId: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(profileId);
    } else {
      newSet.delete(profileId);
    }
    setSelectedIds(newSet);
  };

  const handleBulkDelete = async () => {
    await bulkDeleteProfiles.mutateAsync({ 
      profileIds: Array.from(selectedIds), 
      rankingId 
    });
    setSelectedIds(new Set());
    setShowBulkDeleteDialog(false);
  };

  const isAllSelected = profiles.length > 0 && selectedIds.size === profiles.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < profiles.length;

  const groupedProfiles = profiles.reduce((acc, profile) => {
    const network = profile.network as FKNetwork;
    if (!acc[network]) acc[network] = [];
    acc[network].push(profile);
    return acc;
  }, {} as Record<FKNetwork, FKProfile[]>);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (profiles.length === 0) {
    return (
      <Card className="py-12">
        <CardContent className="text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Sin perfiles configurados</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Agrega perfiles usando el formulario de la izquierda para comenzar a generar rankings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Perfiles Configurados
            </CardTitle>
            <CardDescription>
              {profiles.length} perfiles en {Object.keys(groupedProfiles).length} redes
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    size="sm"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar ({selectedIds.size})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-background">
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar {selectedIds.size} perfiles?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se eliminarán los perfiles seleccionados y todos sus datos de KPIs almacenados. Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleBulkDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={bulkDeleteProfiles.isPending}
                    >
                      {bulkDeleteProfiles.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Eliminar {selectedIds.size} perfiles
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox 
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Seleccionar todos"
                  className={isSomeSelected ? "data-[state=checked]:bg-primary" : ""}
                  {...(isSomeSelected ? { "data-state": "indeterminate" } : {})}
                />
              </TableHead>
              <TableHead>Red</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Última Sync</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((profile) => {
              const network = profile.network as FKNetwork;
              const isSelected = selectedIds.has(profile.id);
              
              return (
                <TableRow key={profile.id} className={isSelected ? "bg-muted/50" : ""}>
                  <TableCell>
                    <Checkbox 
                      checked={isSelected}
                      onCheckedChange={(checked) => handleSelectOne(profile.id, !!checked)}
                      aria-label={`Seleccionar ${profile.profile_id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={NETWORK_COLORS[network]}>
                      {getNetworkLabel(network)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div title={profile.profile_id}>
                      {getFKProfileDisplayName(profile)}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {profile.last_synced_at ? (
                      formatDistanceToNow(new Date(profile.last_synced_at), { 
                        addSuffix: true, 
                        locale: es 
                      })
                    ) : (
                      "Nunca"
                    )}
                  </TableCell>
                  <TableCell>
                    {profile.last_synced_at ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm">Sincronizado</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-600">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">Pendiente</span>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-background">
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar perfil?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se eliminará {getFKProfileDisplayName(profile)} y todos sus datos de KPIs almacenados.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteProfile.mutate({ profileId: profile.id, rankingId })}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
