import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Info,
  Sparkles,
  CalendarIcon,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
  </svg>
);

interface FanpageKarmaSearchProps {
  projectId: string;
  onResultsSaved?: () => void;
}

interface SearchResult {
  success: boolean;
  platform?: string;
  profileId?: string;
  profileName?: string;
  totalFetched?: number;
  filteredCount?: number;
  duplicatesSkipped?: number;
  newPostsSaved?: number;
  jobId?: string;
  period?: string;
  error?: string;
}

export const FanpageKarmaSearch = ({ projectId, onResultsSaved }: FanpageKarmaSearchProps) => {
  const { toast } = useToast();
  const [platform, setPlatform] = useState<"facebook" | "instagram">("facebook");
  const [profileId, setProfileId] = useState("");
  const [filterKeywords, setFilterKeywords] = useState("");
  const [periodType, setPeriodType] = useState<string>("28");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [isSearching, setIsSearching] = useState(false);
  const [lastResult, setLastResult] = useState<SearchResult | null>(null);

  // Calculate periodDays based on selection
  const getPeriodDays = (): number => {
    if (periodType === "custom" && customDateRange.from && customDateRange.to) {
      return differenceInDays(customDateRange.to, customDateRange.from) + 1;
    }
    return parseInt(periodType, 10);
  };

  const handleSearch = async () => {
    if (!profileId.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa el ID del perfil",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    setLastResult(null);

    try {
      const keywords = filterKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const response = await supabase.functions.invoke("fanpage-karma", {
        body: {
          platform,
          profileId: profileId.trim(),
          projectId,
          periodDays: getPeriodDays(),
          filterKeywords: keywords,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result: SearchResult = response.data;
      setLastResult(result);

      if (result.success) {
        toast({
          title: "Búsqueda completada",
          description: `${result.newPostsSaved} nuevos posts guardados (${result.duplicatesSkipped} duplicados omitidos)`,
        });
        onResultsSaved?.();
      } else {
        throw new Error(result.error || "Error desconocido");
      }
    } catch (error) {
      console.error("Fanpage Karma error:", error);
      setLastResult({
        success: false,
        error: error instanceof Error ? error.message : "Error de conexión",
      });
      toast({
        title: "Error en búsqueda",
        description: error instanceof Error ? error.message : "Error de conexión",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Fanpage Karma
          <Badge variant="secondary" className="ml-2">Premium</Badge>
        </CardTitle>
        <CardDescription>
          Extrae posts de perfiles de Facebook e Instagram con métricas detalladas y deduplicación automática
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Fanpage Karma permite buscar por <strong>perfil específico</strong> y filtrar por palabras clave en el contenido.
            Ideal para monitorear páginas de marcas y detectar menciones específicas.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Platform selector */}
          <div className="space-y-2">
            <Label>Plataforma</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as "facebook" | "instagram")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="facebook">
                  <div className="flex items-center gap-2">
                    <FacebookIcon />
                    Facebook
                  </div>
                </SelectItem>
                <SelectItem value="instagram">
                  <div className="flex items-center gap-2">
                    <InstagramIcon />
                    Instagram
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Period selector */}
          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={periodType} onValueChange={(v) => setPeriodType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Últimas 24 horas</SelectItem>
                <SelectItem value="7">Últimos 7 días</SelectItem>
                <SelectItem value="14">Últimos 14 días</SelectItem>
                <SelectItem value="28">Últimos 28 días</SelectItem>
                <SelectItem value="60">Últimos 60 días</SelectItem>
                <SelectItem value="90">Últimos 90 días</SelectItem>
                <SelectItem value="custom">Rango personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Custom date range picker */}
        {periodType === "custom" && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-2">
              <Label>Fecha inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !customDateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDateRange.from ? (
                      format(customDateRange.from, "PPP", { locale: es })
                    ) : (
                      <span>Seleccionar fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customDateRange.from}
                    onSelect={(date) => setCustomDateRange(prev => ({ ...prev, from: date }))}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex-1 space-y-2">
              <Label>Fecha final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !customDateRange.to && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDateRange.to ? (
                      format(customDateRange.to, "PPP", { locale: es })
                    ) : (
                      <span>Seleccionar fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customDateRange.to}
                    onSelect={(date) => setCustomDateRange(prev => ({ ...prev, to: date }))}
                    disabled={(date) => 
                      date > new Date() || 
                      (customDateRange.from ? date < customDateRange.from : false)
                    }
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        {/* Profile ID input */}
        <div className="space-y-2">
          <Label htmlFor="profileId">
            ID del Perfil
            <span className="text-muted-foreground text-xs ml-2">
              (Page ID para Facebook, username para Instagram)
            </span>
          </Label>
          <Input
            id="profileId"
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
            placeholder={platform === "facebook" ? "Ej: 123456789 o actinver" : "Ej: actinver"}
            disabled={isSearching}
          />
        </div>

        {/* Filter keywords */}
        <div className="space-y-2">
          <Label htmlFor="filterKeywords">
            Palabras clave para filtrar
            <span className="text-muted-foreground text-xs ml-2">
              (opcional, separadas por comas)
            </span>
          </Label>
          <Input
            id="filterKeywords"
            value={filterKeywords}
            onChange={(e) => setFilterKeywords(e.target.value)}
            placeholder="Ej: Actinver, inversiones, nuevo producto"
            disabled={isSearching}
          />
          <p className="text-xs text-muted-foreground">
            Solo se guardarán posts que contengan al menos una de estas palabras en el texto
          </p>
        </div>

        {/* Search button */}
        <Button 
          onClick={handleSearch} 
          disabled={isSearching || !profileId.trim()} 
          className="w-full"
        >
          {isSearching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Buscando...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Buscar en Fanpage Karma
            </>
          )}
        </Button>

        {/* Results summary */}
        {lastResult && (
          <div className={`p-4 rounded-lg border ${lastResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <div className="flex items-center gap-2 mb-2">
              {lastResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <span className="font-medium">
                {lastResult.success ? "Búsqueda completada" : "Error en búsqueda"}
              </span>
            </div>
            
            {lastResult.success ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Obtenidos:</span>
                  <span className="ml-1 font-medium">{lastResult.totalFetched}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Filtrados:</span>
                  <span className="ml-1 font-medium">{lastResult.filteredCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Duplicados:</span>
                  <span className="ml-1 font-medium">{lastResult.duplicatesSkipped}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Guardados:</span>
                  <span className="ml-1 font-medium text-green-600">{lastResult.newPostsSaved}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-red-600">{lastResult.error}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
