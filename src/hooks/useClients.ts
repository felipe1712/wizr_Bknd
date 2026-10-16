import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { canonicalizeFKProfileIdentity } from "@/lib/fkProfileUtils";

export interface Client {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  services_enabled: Record<string, unknown>;
  kimediamx_profile_id: string | null;
  client_type: "branded" | "benchmark";
  created_at: string;
  updated_at: string;
}

export type ClientType = "branded" | "benchmark";

export function useClients() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["clients", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Client[];
    },
    enabled: !!user,
  });
}

export function useClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data as Client | null;
    },
    enabled: !!clientId,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ name, description, client_type = "branded" }: { name: string; description?: string; client_type?: "branded" | "benchmark" }) => {
      if (!user) throw new Error("No autenticado");
      const { data, error } = await supabase
        .from("clients")
        .insert({ user_id: user.id, name, description: description || null, client_type } as any)
        .select()
        .single();
      if (error) throw error;
      return data as Client;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente creado");
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Client> & { id: string }) => {
      const { data, error } = await supabase
        .from("clients")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Client;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client", data.id] });
      toast.success("Cliente actualizado");
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente eliminado");
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });
}

// FK profiles for a client (with brand/benchmark/unclassified filter)
export type ProfileClassification = "unclassified" | "brand" | "competitor";

export interface ClientFKProfile {
  id: string;
  client_id: string | null;
  network: string;
  profile_id: string;
  display_name: string | null;
  canonical_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_competitor: boolean;
  classification_status: ProfileClassification;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useFKProfilesByClient(clientId: string | undefined, mode: "all" | "brand" | "benchmark" = "all") {
  return useQuery({
    queryKey: ["fk-profiles-client", clientId, mode],
    queryFn: async () => {
      if (!clientId) return [];
      let q = supabase
        .from("fk_profiles")
        .select("*")
        .eq("client_id", clientId)
        .eq("is_active", true);
      // brand mode: solo perfiles clasificados como "brand"
      // benchmark mode: todos los clasificados (brand + competitor) — ignora unclassified
      // all: incluye también unclassified (lo usa la tabla de configuración / banner)
      if (mode === "brand") q = q.eq("classification_status", "brand");
      if (mode === "benchmark") q = q.in("classification_status", ["brand", "competitor"]);
      const { data, error } = await q
        .order("classification_status", { ascending: true })
        .order("network", { ascending: true })
        .order("display_name", { ascending: true });
      if (error) throw error;

      const deduped = new Map<string, ClientFKProfile>();

      for (const raw of (data || []) as any[]) {
        const profile: ClientFKProfile = {
          ...raw,
          classification_status: (raw.classification_status as ProfileClassification) || "unclassified",
          canonical_name: raw.canonical_name ?? null,
        };
        const dedupKey = [
          profile.network,
          profile.classification_status,
          canonicalizeFKProfileIdentity(profile.display_name || profile.profile_id),
        ].join("::");

        const existing = deduped.get(dedupKey);
        if (!existing) {
          deduped.set(dedupKey, profile);
          continue;
        }

        const existingTimestamp = existing.last_synced_at ? new Date(existing.last_synced_at).getTime() : 0;
        const candidateTimestamp = profile.last_synced_at ? new Date(profile.last_synced_at).getTime() : 0;
        const keepCandidate =
          candidateTimestamp > existingTimestamp ||
          (!!profile.display_name && !existing.display_name) ||
          (candidateTimestamp === existingTimestamp && new Date(profile.created_at).getTime() < new Date(existing.created_at).getTime());

        if (keepCandidate) {
          deduped.set(dedupKey, profile);
        }
      }

      return Array.from(deduped.values());
    },
    enabled: !!clientId,
  });
}

/**
 * Bulk update de clasificación marca/competencia para una lista de perfiles.
 * Sincroniza también `is_competitor` por compatibilidad con código legacy.
 */
export function useUpdateProfileClassifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Array<{ id: string; classification: ProfileClassification }>) => {
      // Agrupamos por valor para minimizar requests
      const byClass = new Map<ProfileClassification, string[]>();
      for (const u of updates) {
        if (!byClass.has(u.classification)) byClass.set(u.classification, []);
        byClass.get(u.classification)!.push(u.id);
      }
      for (const [classification, ids] of byClass.entries()) {
        if (ids.length === 0) continue;
        const { error } = await supabase
          .from("fk_profiles")
          .update({
            classification_status: classification,
            is_competitor: classification === "competitor",
            is_own_profile: classification === "brand",
          } as any)
          .in("id", ids);
        if (error) throw error;
      }
      return updates.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fk-profiles-client"] });
      toast.success("Clasificación actualizada");
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });
}
