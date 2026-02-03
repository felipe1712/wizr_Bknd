import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSearchSchedule, ScheduleFrequency } from "@/hooks/useSearchSchedule";
import { cn } from "@/lib/utils";
import {
  Clock,
  Zap,
  Calendar,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Settings2,
  Newspaper,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

// Platform icons (simplified)
const TwitterIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
  </svg>
);

const PLATFORMS = [
  { id: "news", label: "Noticias", icon: <Newspaper className="h-4 w-4" /> },
  { id: "twitter", label: "Twitter/X", icon: <TwitterIcon /> },
  { id: "facebook", label: "Facebook", icon: <FacebookIcon /> },
  { id: "youtube", label: "YouTube", icon: <YouTubeIcon /> },
  { id: "tiktok", label: "TikTok", icon: <span className="text-xs font-bold">TT</span> },
  { id: "instagram", label: "Instagram", icon: <span className="text-xs font-bold">IG</span> },
  { id: "linkedin", label: "LinkedIn", icon: <span className="text-xs font-bold">in</span> },
  { id: "reddit", label: "Reddit", icon: <span className="text-xs font-bold">R</span> },
];

const FREQUENCIES: Array<{ value: ScheduleFrequency; label: string; description: string }> = [
  { value: "hourly", label: "Cada hora", description: "Para monitoreo de crisis" },
  { value: "twice_daily", label: "2 veces al día", description: "Mañana y tarde" },
  { value: "daily", label: "Diariamente", description: "Recomendado" },
  { value: "weekly", label: "Semanalmente", description: "Para proyectos de bajo volumen" },
];

interface ScheduledSearchConfigProps {
  projectId: string;
}

export function ScheduledSearchConfig({ projectId }: ScheduledSearchConfigProps) {
  const { schedule, isLoading, saveSchedule, toggleEnabled, runNow, isRunning } = useSearchSchedule(projectId);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const selectedPlatforms = schedule?.platforms || ["news", "twitter", "facebook"];
  const frequency = (schedule?.frequency || "daily") as ScheduleFrequency;

  const handlePlatformToggle = (platformId: string) => {
    const newPlatforms = selectedPlatforms.includes(platformId)
      ? selectedPlatforms.filter(p => p !== platformId)
      : [...selectedPlatforms, platformId];
    
    if (newPlatforms.length > 0) {
      saveSchedule({ platforms: newPlatforms });
    }
  };

  const handleFrequencyChange = (value: ScheduleFrequency) => {
    saveSchedule({ frequency: value });
  };

  const handleMaxResultsChange = (value: string) => {
    saveSchedule({ max_results_per_platform: parseInt(value) });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "transition-all",
      schedule?.is_enabled && "border-primary/30 bg-primary/5"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              schedule?.is_enabled ? "bg-primary/20" : "bg-muted"
            )}>
              <Clock className={cn(
                "h-5 w-5",
                schedule?.is_enabled ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Búsqueda Programada
                {schedule?.is_enabled && (
                  <Badge className="bg-primary/20 text-primary hover:bg-primary/30">
                    Activa
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Ejecuta búsquedas automáticamente usando las entidades del proyecto
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={schedule?.is_enabled || false}
            onCheckedChange={toggleEnabled}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status */}
        {schedule && (
          <div className="flex flex-wrap gap-3 text-sm">
            {schedule.last_run_at && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Última ejecución: {formatDistanceToNow(new Date(schedule.last_run_at), { locale: es, addSuffix: true })}
              </div>
            )}
            {schedule.next_run_at && schedule.is_enabled && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Próxima: {format(new Date(schedule.next_run_at), "dd MMM, HH:mm", { locale: es })}
              </div>
            )}
            {schedule.run_count > 0 && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Zap className="h-4 w-4" />
                {schedule.run_count} ejecuciones
              </div>
            )}
          </div>
        )}

        {/* Error alert */}
        {schedule?.last_error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{schedule.last_error}</AlertDescription>
          </Alert>
        )}

        <Separator />

        {/* Frequency */}
        <div className="space-y-2">
          <Label>Frecuencia</Label>
          <Select value={frequency} onValueChange={handleFrequencyChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCIES.map(f => (
                <SelectItem key={f.value} value={f.value}>
                  <div className="flex flex-col">
                    <span>{f.label}</span>
                    <span className="text-xs text-muted-foreground">{f.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Platforms */}
        <div className="space-y-2">
          <Label>Plataformas a monitorear</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PLATFORMS.map(platform => {
              const isSelected = selectedPlatforms.includes(platform.id);
              return (
                <button
                  key={platform.id}
                  onClick={() => handlePlatformToggle(platform.id)}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border text-sm transition-all",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Checkbox checked={isSelected} className="pointer-events-none" />
                  <span className={isSelected ? "text-primary" : "text-muted-foreground"}>
                    {platform.icon}
                  </span>
                  <span className="truncate">{platform.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Advanced settings */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings2 className="h-4 w-4" />
          {showAdvanced ? "Ocultar" : "Mostrar"} configuración avanzada
        </button>

        {showAdvanced && (
          <div className="space-y-3 p-3 rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <Label htmlFor="maxResults">Resultados máximos por plataforma</Label>
              <Select 
                value={(schedule?.max_results_per_platform || 25).toString()} 
                onValueChange={handleMaxResultsChange}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <Separator />

        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            onClick={runNow}
            disabled={isRunning}
            variant="outline"
            className="flex-1"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ejecutando...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Ejecutar ahora
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
