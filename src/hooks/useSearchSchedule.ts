import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export type ScheduleFrequency = "hourly" | "twice_daily" | "daily" | "weekly";

export interface SearchSchedule {
  id: string;
  project_id: string;
  is_enabled: boolean;
  frequency: ScheduleFrequency;
  platforms: string[];
  max_results_per_platform: number;
  last_run_at: string | null;
  next_run_at: string | null;
  run_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface UseSearchScheduleResult {
  schedule: SearchSchedule | null;
  isLoading: boolean;
  error: Error | null;
  saveSchedule: (data: Partial<SearchSchedule>) => Promise<void>;
  toggleEnabled: () => Promise<void>;
  runNow: () => Promise<void>;
  isRunning: boolean;
}

export function useSearchSchedule(projectId: string | undefined): UseSearchScheduleResult {
  const [schedule, setSchedule] = useState<SearchSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();

  // Fetch schedule
  const fetchSchedule = useCallback(async () => {
    if (!projectId) {
      setSchedule(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data } = await api.get(`/projects/${projectId}/search-schedules`);
      setSchedule(data as SearchSchedule | null);
      setError(null);
    } catch (err) {
      console.error("Error fetching schedule:", err);
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // Save or create schedule
  const saveSchedule = useCallback(async (data: Partial<SearchSchedule>) => {
    if (!projectId) return;

    try {
      if (schedule) {
        // Update existing
        await api.patch(`/project-search-schedules/${schedule.id}`, {
          ...data,
          updated_at: new Date().toISOString(),
        });
      } else {
        // Create new
        await api.post(`/project-search-schedules`, {
          project_id: projectId,
          is_enabled: false,
          frequency: "daily",
          platforms: ["news", "twitter", "facebook"],
          max_results_per_platform: 50,
          ...data,
        });
      }

      await fetchSchedule();
      toast({
        title: "Configuración guardada",
        description: "La programación de búsqueda se actualizó correctamente",
      });
    } catch (err) {
      console.error("Error saving schedule:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo guardar la configuración",
        variant: "destructive",
      });
    }
  }, [projectId, schedule, fetchSchedule, toast]);

  // Toggle enabled state
  const toggleEnabled = useCallback(async () => {
    if (!schedule) {
      // Create new schedule with enabled = true
      await saveSchedule({ is_enabled: true });
      return;
    }

    const newEnabled = !schedule.is_enabled;
    const nextRun = newEnabled ? new Date().toISOString() : null;

    try {
      await api.patch(`/project-search-schedules/${schedule.id}`, {
        is_enabled: newEnabled,
        next_run_at: nextRun,
        updated_at: new Date().toISOString(),
      });

      await fetchSchedule();
      toast({
        title: newEnabled ? "Búsqueda programada activada" : "Búsqueda programada desactivada",
        description: newEnabled 
          ? "Las búsquedas se ejecutarán automáticamente según la frecuencia configurada"
          : "Las búsquedas automáticas han sido pausadas",
      });
    } catch (err) {
      console.error("Error toggling schedule:", err);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado",
        variant: "destructive",
      });
    }
  }, [schedule, fetchSchedule, toast, saveSchedule]);

  // Run search now
  const runNow = useCallback(async () => {
    if (!projectId) return;

    setIsRunning(true);
    try {
      // Ensure schedule exists
      if (!schedule) {
        await saveSchedule({ is_enabled: false });
        await fetchSchedule();
      }

      // Invoke the edge function
      const { data } = await api.post(`/project-search-schedules/${projectId}/run-now`);

      await fetchSchedule();
      
      const result = data?.results?.[0];
      toast({
        title: "Búsqueda completada",
        description: result 
          ? `${result.mentionsFound} menciones encontradas, ${result.mentionsSaved} guardadas`
          : "La búsqueda se ejecutó correctamente",
      });
    } catch (err) {
      console.error("Error running search:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo ejecutar la búsqueda",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  }, [projectId, schedule, fetchSchedule, saveSchedule, toast]);

  return {
    schedule,
    isLoading,
    error,
    saveSchedule,
    toggleEnabled,
    runNow,
    isRunning,
  };
}
