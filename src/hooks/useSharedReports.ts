import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type SharedReportKind = "listening" | "performance_brand" | "performance_benchmark" | "performance_comparative";

export interface SharedReport {
  id: string;
  project_id: string | null;
  client_id: string | null;
  report_kind: SharedReportKind;
  created_by: string;
  title: string;
  project_name: string;
  content: any;
  date_range: { start: string; end: string; label: string };
  public_token: string;
  expires_at: string | null;
  is_revoked: boolean;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSharedReportInput {
  // New API
  owner_kind?: "project" | "client";
  owner_id?: string;
  owner_name?: string;
  report_kind?: SharedReportKind;
  // Legacy (Listening only)
  project_id?: string;
  project_name?: string;
  // Common
  title: string;
  content: any;
  date_range: { start: string; end: string; label: string };
  expires_in_days: number | null;
}

export function useSharedReportsByProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["shared-reports", "project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shared_reports")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SharedReport[];
    },
  });
}

export function useSharedReportsByClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ["shared-reports", "client", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("shared_reports") as any)
        .select("*")
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SharedReport[];
    },
  });
}

export function useCreateSharedReport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSharedReportInput) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No autenticado");

      const expires_at = input.expires_in_days
        ? new Date(Date.now() + input.expires_in_days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const ownerKind = input.owner_kind ?? "project";
      const ownerId = input.owner_id ?? input.project_id;
      const ownerName = input.owner_name ?? input.project_name ?? "";
      const reportKind = input.report_kind ?? "listening";

      if (!ownerId) throw new Error("Falta el ID del proyecto o cliente");

      const insertPayload: any = {
        created_by: userData.user.id,
        title: input.title,
        project_name: ownerName,
        content: input.content,
        date_range: input.date_range,
        expires_at,
        report_kind: reportKind,
        project_id: ownerKind === "project" ? ownerId : null,
        client_id: ownerKind === "client" ? ownerId : null,
      };

      const { data, error } = await (supabase.from("shared_reports") as any)
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as SharedReport;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["shared-reports"] });
      toast({ title: "Reporte publicado", description: "Link generado correctamente" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al publicar", description: err.message, variant: "destructive" });
    },
  });
}

export function useRevokeSharedReport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("shared_reports")
        .update({ is_revoked: true })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as SharedReport;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-reports"] });
      toast({ title: "Link revocado", description: "El reporte ya no es accesible" });
    },
  });
}

export function useDeleteSharedReport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (report: SharedReport) => {
      const { error } = await supabase.from("shared_reports").delete().eq("id", report.id);
      if (error) throw error;
      return report;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-reports"] });
      toast({ title: "Reporte eliminado" });
    },
  });
}

export async function fetchPublicReport(token: string): Promise<SharedReport | null> {
  const { data, error } = await supabase
    .from("shared_reports")
    .select("*")
    .eq("public_token", token)
    .eq("is_revoked", false)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

  supabase.rpc("increment_report_view", { _token: token }).then(() => {});

  return data as unknown as SharedReport;
}
