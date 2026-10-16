import { useState } from "react";
import { useAlertConfigs, useAlertNotifications, AlertConfig } from "@/hooks/useAlerts";
import { useEntities } from "@/hooks/useEntities";
import { AlertConfigDialog } from "@/components/alertas/AlertConfigDialog";
import { AlertConfigCard } from "@/components/alertas/AlertConfigCard";
import { NotificationCard } from "@/components/alertas/NotificationCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus,
  Bell,
  BellOff,
  Settings,
  CheckCheck,
  RefreshCw,
  Clock,
} from "lucide-react";

interface AlertsSidePanelProps {
  projectId: string;
}

export function AlertsSidePanel({ projectId }: AlertsSidePanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AlertConfig | null>(null);
  const [isRunningMonitoring, setIsRunningMonitoring] = useState(false);

  const { entities } = useEntities(projectId);
  const {
    configs,
    isLoading: configsLoading,
    createConfig,
    updateConfig,
    deleteConfig,
    toggleActive,
    isCreating,
    isUpdating,
  } = useAlertConfigs(projectId);

  const {
    notifications,
    isLoading: notificationsLoading,
    unreadCount,
    markAsRead,
    dismiss,
    markAllAsRead,
    refetch: refetchNotifications,
  } = useAlertNotifications(projectId);

  const loading = configsLoading || notificationsLoading;

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
        toast.success('Monitoreo completado', {
          description: `${totalAlerts} alertas activadas`,
        });
        refetchNotifications();
      }
    } catch (err) {
      toast.error('Error de conexión');
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
      createConfig({ project_id: projectId, ...data });
    }
    setDialogOpen(false);
    setEditingConfig(null);
  };

  if (loading) {
    return (
      <div className="space-y-4 pt-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  const activeConfigs = configs.filter((c) => c.is_active);

  return (
    <div className="flex flex-col h-full">
      <SheetHeader className="pb-4">
        <SheetTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Alertas
          {unreadCount > 0 && (
            <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
              {unreadCount}
            </Badge>
          )}
        </SheetTitle>
        <SheetDescription>
          {activeConfigs.length} alertas activas • Monitoreo cada hora
        </SheetDescription>
      </SheetHeader>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRunMonitoring}
          disabled={isRunningMonitoring}
          className="flex-1"
        >
          {isRunningMonitoring ? (
            <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-3 w-3" />
          )}
          {isRunningMonitoring ? "Buscando..." : "Buscar Ahora"}
        </Button>
        <Button size="sm" onClick={handleOpenCreate} className="flex-1">
          <Plus className="mr-2 h-3 w-3" />
          Nueva
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="notifications" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="notifications" className="relative text-xs">
            Notificaciones
            {unreadCount > 0 && (
              <span className="ml-1 text-[10px]">({unreadCount})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="configs" className="text-xs">
            Reglas ({configs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="flex-1 mt-4">
          <ScrollArea className="h-[calc(100vh-280px)]">
            {notifications.length > 0 && unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsRead()}
                className="mb-2 w-full text-xs"
              >
                <CheckCheck className="mr-2 h-3 w-3" />
                Marcar todas como leídas
              </Button>
            )}

            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BellOff className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Sin notificaciones</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Las alertas aparecerán aquí
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                    onDismiss={dismiss}
                    compact
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="configs" className="flex-1 mt-4">
          <ScrollArea className="h-[calc(100vh-280px)]">
            {configs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Settings className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Sin alertas configuradas</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Crea una alerta para recibir notificaciones
                </p>
                <Button className="mt-4" size="sm" onClick={handleOpenCreate}>
                  <Plus className="mr-2 h-3 w-3" />
                  Crear Alerta
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {configs.map((config) => (
                  <AlertConfigCard
                    key={config.id}
                    config={config}
                    onEdit={handleOpenEdit}
                    onDelete={deleteConfig}
                    onToggleActive={toggleActive}
                    compact
                  />
                ))}
              </div>
            )}
          </ScrollArea>
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
}
