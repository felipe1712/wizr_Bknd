import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Ranking {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export function useRankings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["rankings", user?.id],
    queryFn: async () => {
      const { data } = await api.get('/rankings');
      return data as Ranking[];
    },
    enabled: !!user,
  });
}

export function useRanking(rankingId: string | undefined) {
  return useQuery({
    queryKey: ["ranking", rankingId],
    queryFn: async () => {
      if (!rankingId) return null;

      const { data } = await api.get(`/rankings/${rankingId}`);
      return data as Ranking;
    },
    enabled: !!rankingId,
  });
}

export function useCreateRanking() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      if (!user) throw new Error("No autenticado");

      const { data } = await api.post('/rankings', {
        name,
        description: description || null,
      });
      return data as Ranking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rankings"] });
      toast.success("Ranking creado exitosamente");
    },
    onError: (error: Error) => {
      toast.error(`Error al crear ranking: ${error.message}`);
    },
  });
}

export function useUpdateRanking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name: string; description?: string }) => {
      const { data } = await api.patch(`/rankings/${id}`, {
        name,
        description: description || null,
      });
      return data as Ranking;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rankings"] });
      queryClient.invalidateQueries({ queryKey: ["ranking", data.id] });
      toast.success("Ranking actualizado");
    },
    onError: (error: Error) => {
      toast.error(`Error al actualizar: ${error.message}`);
    },
  });
}

export function useDeleteRanking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rankingId: string) => {
      await api.delete(`/rankings/${rankingId}`);
      return rankingId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rankings"] });
      toast.success("Ranking eliminado");
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar: ${error.message}`);
    },
  });
}
