import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type EntityType = "persona" | "marca" | "institucion" | "tema" | "evento";

export interface Entity {
  id: string;
  project_id: string;
  tipo: EntityType;
  nombre: string;
  descripcion: string | null;
  palabras_clave: string[];
  aliases: string[];
  metadata: Record<string, unknown>;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

interface CreateEntityData {
  project_id: string;
  tipo: EntityType;
  nombre: string;
  descripcion?: string;
  palabras_clave: string[];
  aliases: string[];
}

interface UpdateEntityData extends Partial<CreateEntityData> {
  id: string;
}

export function useEntities(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const entitiesQuery = useQuery({
    queryKey: ["entities", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from("entities")
        .select("*")
        .eq("project_id", projectId)
        .eq("activo", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Entity[];
    },
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateEntityData) => {
      const { data: entity, error } = await supabase
        .from("entities")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return entity as Entity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entities", projectId] });
      toast({
        title: "Entidad creada",
        description: "La entidad se ha creado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `No se pudo crear la entidad: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: UpdateEntityData) => {
      const { data: entity, error } = await supabase
        .from("entities")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return entity as Entity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entities", projectId] });
      toast({
        title: "Entidad actualizada",
        description: "Los cambios se han guardado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `No se pudo actualizar la entidad: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete by setting activo to false
      const { error } = await supabase
        .from("entities")
        .update({ activo: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entities", projectId] });
      toast({
        title: "Entidad eliminada",
        description: "La entidad se ha eliminado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `No se pudo eliminar la entidad: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  return {
    entities: entitiesQuery.data || [],
    isLoading: entitiesQuery.isLoading,
    error: entitiesQuery.error,
    createEntity: createMutation.mutate,
    updateEntity: updateMutation.mutate,
    deleteEntity: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
