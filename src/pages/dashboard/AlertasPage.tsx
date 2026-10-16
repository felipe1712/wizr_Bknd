import { useState } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { useNavigate } from "react-router-dom";
import { useAlertConfigs, useAlertNotifications, AlertConfig } from "@/hooks/useAlerts";
import { useEntities } from "@/hooks/useEntities";
import { AlertConfigDialog } from "@/components/alertas/AlertConfigDialog";
import { AlertConfigCard } from "@/components/alertas/AlertConfigCard";
import { NotificationCard } from "@/components/alertas/NotificationCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertCircle,
  Plus,
  Bell,
  BellOff,
  Settings,
  CheckCheck,
  RefreshCw,
  Clock,
} from "lucide-react";

const AlertasPage = () => {
  const { selectedProject, loading: projectLoading } = useProject();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AlertConfig | null>(null);
  const [isRunningMonitoring, setIsRunningMonitoring] = useState(false);

  const { entities } = useEntities(selectedProject?.id);
  const {
    configs,
    isLoading: configsLoading,
    createConfig,
    updateConfig,
    deleteConfig,
    toggleActive,
    isCreating,
    isUpdating,
  } = useAlertConfigs(selectedProject?.id);

  const {
    notifications,
    isLoading: notificationsLoading,
    unreadCount,
    markAsRead,
    dismiss,
    markAllAsRead,
    refetch: refetchNotifications,
  } = useAlertNotifications(selectedProject?.id);

  const loading = projectLoading || configsLoading || notificationsLoading;

  const handleRunMonitoring = async () => {
    setIsRunningMonitoring(true);
    try {
      const { data, error } = await supabase.functions.invoke('scheduled-unified-search', {
        body: { manual: true },
      });

      if (error) {
        toast.error('Error al ejecutar monitoreo', {
          description: error.message,
        });
        return;
      }

      if (data?.success) {
        const totalAlerts = (data.results || []).reduce((sum: number, r: any) => sum + (r.alertsTriggered || 0), 0);
        const totalMentions = (data.results || []).reduce((sum: number, r: any) => sum + (r.mentionsSaved || 0), 0);
        toast.success('Monitoreo completado', {
          description: `${totalMentions} menciones nuevas, ${totalAlerts} alertas activadas`,
        });
        refetchNotifications();
      } else {
        toast.error('Error en monitoreo', {
          description: data?.error || 'Error desconocido',
        });
      }
    } catch (err) {
      toast.error('Error de conexión', {
        description: 'No se pudo conectar con el servidor',
      });
    } finally {
      setIsRunningMonitoring(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingConfig(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (config: AlertConfig) => {
    setEditingConfig(config);
    setDialogOpen(true);
  };

  const handleSubmit = (data: any) => {
    if (editingConfig) {
      updateConfig({ id: editingConfig.id, ...data });
    } else {
      createConfig({ project_id: selectedProject!.id, ...data });
    }
    setDialogOpen(false);
    setEditingConfig(null);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="rounded-full bg-muted p-4">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-xl font-semibold">Sin proyecto seleccionado</h2>
        <p className="mt-2 max-w-md text-center text-muted-foreground">
          Crea o selecciona un proyecto para configurar alertas
        </p>
        <Button className="mt-4" onClick={() => navigate("/nuevo-proyecto")}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Proyecto
        </Button>
      </div>
    );
  }

  const activeConfigs = configs.filter((c) => c.is_active);
  const pausedConfigs = configs.filter((c) => !c.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-7 w-7" />
            Alertas
          </h1>
          <p className="text-muted-foreground">
            Sistema de alertas y notificaciones —{" "}
            <span className="font-medium">{selectedProject.nombre}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRunMonitoring}
            disabled={isRunningMonitoring}
          >
            {isRunningMonitoring ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {isRunningMonitoring ? "Buscando..." : "Buscar Ahora"}
          </Button>
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Alerta
          </Button>
        </div>
      </div>

      {/* Cron Status Banner */}
      <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2 text-sm">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">
          Monitoreo automático activo — búsqueda cada hora
        </span>
        <Badge variant="secondary" className="ml-auto">
          Programado
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{configs.length}</p>
                <p className="text-sm text-muted-foreground">Alertas configuradas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2">
                <Bell className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeConfigs.length}</p>
                <p className="text-sm text-muted-foreground">Alertas activas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={unreadCount > 0 ? "border-primary" : undefined}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unreadCount}</p>
                <p className="text-sm text-muted-foreground">Sin leer</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="notifications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="notifications" className="relative">
            Notificaciones
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="ml-2 h-5 min-w-5 px-1.5 text-xs"
              >
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="configs">
            Configuración
            <Badge variant="secondary" className="ml-2">
              {configs.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-4">
          {notifications.length > 0 && unreadCount > 0 && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => markAllAsRead()}>
                <CheckCheck className="mr-2 h-4 w-4" />
                Marcar todas como leídas
              </Button>
            </div>
          )}

          {notifications.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-muted p-4">
                  <BellOff className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">Sin notificaciones</h3>
                <p className="mt-1 max-w-md text-center text-sm text-muted-foreground">
                  Las alertas activadas aparecerán aquí. Configura reglas para
                  recibir notificaciones automáticas.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDismiss={dismiss}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="configs" className="space-y-4">
          {configs.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-primary/10 p-4">
                  <Settings className="h-10 w-10 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">
                  Sin alertas configuradas
                </h3>
                <p className="mt-1 max-w-md text-center text-sm text-muted-foreground">
                  Crea tu primera alerta para recibir notificaciones automáticas
                  sobre sentimiento negativo, picos de menciones o palabras clave.
                </p>
                <Button className="mt-4" onClick={handleOpenCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Alerta
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {activeConfigs.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Alertas Activas ({activeConfigs.length})
                  </h3>
                  {activeConfigs.map((config) => (
                    <AlertConfigCard
                      key={config.id}
                      config={config}
                      onEdit={handleOpenEdit}
                      onDelete={deleteConfig}
                      onToggleActive={toggleActive}
                    />
                  ))}
                </div>
              )}

              {pausedConfigs.length > 0 && (
                <div className="space-y-3 mt-6">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Alertas Pausadas ({pausedConfigs.length})
                  </h3>
                  {pausedConfigs.map((config) => (
                    <AlertConfigCard
                      key={config.id}
                      config={config}
                      onEdit={handleOpenEdit}
                      onDelete={deleteConfig}
                      onToggleActive={toggleActive}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Config Dialog */}
      <AlertConfigDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        entities={entities}
        editingConfig={editingConfig}
        isSubmitting={isCreating || isUpdating}
      />
    </div>
  );
};

export default AlertasPage;
