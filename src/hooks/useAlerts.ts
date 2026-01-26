import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

export type AlertType = "sentiment_negative" | "mention_spike" | "keyword_match";

export interface AlertConfig {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  alert_type: AlertType;
  threshold_percent: number | null;
  keywords: string[];
  entity_ids: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  trigger_count: number;
  created_at: string;
  updated_at: string;
}

export interface AlertNotification {
  id: string;
  alert_config_id: string;
  project_id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  metadata: Json;
  is_read: boolean;
  is_dismissed: boolean;
  triggered_at: string;
  read_at: string | null;
  // Joined
  alert_config?: {
    name: string;
    alert_type: AlertType;
  } | null;
}

interface CreateAlertConfigData {
  project_id: string;
  name: string;
  description?: string | null;
  alert_type: AlertType;
  threshold_percent?: number | null;
  keywords?: string[];
  entity_ids?: string[];
  is_active?: boolean;
}

interface UpdateAlertConfigData {
  name?: string;
  description?: string | null;
  threshold_percent?: number | null;
  keywords?: string[];
  entity_ids?: string[];
  is_active?: boolean;
}

export function useAlertConfigs(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const configsQuery = useQuery({
    queryKey: ["alert-configs", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from("alert_configs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AlertConfig[];
    },
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: async (config: CreateAlertConfigData) => {
      const { data, error } = await supabase
        .from("alert_configs")
        .insert(config)
        .select()
        .single();

      if (error) throw error;
      return data as AlertConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-configs", projectId] });
      toast({
        title: "Alerta creada",
        description: "La configuración de alerta se ha guardado correctamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `No se pudo crear la alerta: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateAlertConfigData & { id: string }) => {
      const { data, error } = await supabase
        .from("alert_configs")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as AlertConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-configs", projectId] });
      toast({
        title: "Alerta actualizada",
        description: "Los cambios se han guardado correctamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `No se pudo actualizar: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("alert_configs")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-configs", projectId] });
      toast({
        title: "Alerta eliminada",
        description: "La configuración se ha eliminado correctamente",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("alert_configs")
        .update({ is_active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: ["alert-configs", projectId] });
      toast({
        title: is_active ? "Alerta activada" : "Alerta pausada",
        description: is_active
          ? "La alerta está ahora activa"
          : "La alerta ha sido pausada",
      });
    },
  });

  return {
    configs: configsQuery.data || [],
    isLoading: configsQuery.isLoading,
    error: configsQuery.error,
    createConfig: createMutation.mutate,
    updateConfig: updateMutation.mutate,
    deleteConfig: deleteMutation.mutate,
    toggleActive: toggleActiveMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}

export function useAlertNotifications(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const notificationsQuery = useQuery({
    queryKey: ["alert-notifications", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from("alert_notifications")
        .select(`
          *,
          alert_config:alert_configs(name, alert_type)
        `)
        .eq("project_id", projectId)
        .eq("is_dismissed", false)
        .order("triggered_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as AlertNotification[];
    },
    enabled: !!projectId,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("alert_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-notifications", projectId] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("alert_notifications")
        .update({ is_dismissed: true })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-notifications", projectId] });
      toast({
        title: "Notificación descartada",
      });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) return;
      const { error } = await supabase
        .from("alert_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("project_id", projectId)
        .eq("is_read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-notifications", projectId] });
      toast({
        title: "Notificaciones marcadas como leídas",
      });
    },
  });

  const unreadCount = notificationsQuery.data?.filter((n) => !n.is_read).length || 0;

  return {
    notifications: notificationsQuery.data || [],
    isLoading: notificationsQuery.isLoading,
    unreadCount,
    markAsRead: markAsReadMutation.mutate,
    dismiss: dismissMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
  };
}
