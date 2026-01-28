import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { RefreshCw, Trash2, Users, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { FKProfile, getNetworkLabel, useDeleteFKProfile, useSyncFKProfile, useSyncAllProfiles, FKNetwork } from "@/hooks/useFanpageKarma";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

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
  const [syncingId, setSyncingId] = useState<string | null>(null);
  
  const deleteProfile = useDeleteFKProfile();
  const syncProfile = useSyncFKProfile();
  const syncAllProfiles = useSyncAllProfiles();

  const handleSync = async (profile: FKProfile) => {
    setSyncingId(profile.id);
    try {
      await syncProfile.mutateAsync({ profile });
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    await syncAllProfiles.mutateAsync({ profiles });
  };

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
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSyncAll}
            disabled={syncAllProfiles.isPending || syncingId !== null}
          >
            {syncAllProfiles.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sincronizar Todos
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Red</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Última Sync</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((profile) => {
              const isSyncing = syncingId === profile.id;
              const network = profile.network as FKNetwork;
              
              return (
                <TableRow key={profile.id}>
                  <TableCell>
                    <Badge variant="outline" className={NETWORK_COLORS[network]}>
                      {getNetworkLabel(network)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    @{profile.profile_id}
                    {profile.display_name && profile.display_name !== profile.profile_id && (
                      <span className="ml-2 text-muted-foreground text-sm">
                        ({profile.display_name})
                      </span>
                    )}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSync(profile)}
                        disabled={isSyncing}
                      >
                        {isSyncing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
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
                              Se eliminará @{profile.profile_id} y todos sus datos de KPIs almacenados.
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
