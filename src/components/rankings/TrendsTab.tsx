import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { TrendingUp, ChevronDown, ChevronUp, Users, Search, X } from "lucide-react";
import { FaFacebookF, FaInstagram, FaYoutube, FaLinkedinIn, FaTiktok, FaXTwitter } from "react-icons/fa6";
import { SiThreads } from "react-icons/si";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { FKProfile, FKProfileKPI, FKNetwork } from "@/hooks/useFanpageKarma";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getFKProfileDisplayName, getFKProfileSeriesLabel } from "@/lib/fkProfileUtils";

// Network icon component
const NetworkIcon = ({ network, className = "h-3 w-3" }: { network: string; className?: string }) => {
  const icons: Record<string, React.ReactNode> = {
    facebook: <FaFacebookF className={`${className} text-[#1877F2]`} />,
    instagram: <FaInstagram className={`${className} text-[#E4405F]`} />,
    youtube: <FaYoutube className={`${className} text-[#FF0000]`} />,
    linkedin: <FaLinkedinIn className={`${className} text-[#0A66C2]`} />,
    tiktok: <FaTiktok className={className} />,
    twitter: <FaXTwitter className={className} />,
    threads: <SiThreads className={className} />,
  };
  return <>{icons[network] || null}</>;
};

type MetricType = "followers" | "engagement_rate" | "follower_growth_percent" | "posts_per_day";

interface TrendsTabProps {
  profiles: FKProfile[];
  kpis: FKProfileKPI[];
  isLoading: boolean;
}

const METRIC_OPTIONS: { value: MetricType; label: string }[] = [
  { value: "followers", label: "Seguidores" },
  { value: "engagement_rate", label: "Engagement Rate" },
  { value: "follower_growth_percent", label: "Crecimiento %" },
  { value: "posts_per_day", label: "Posts por día" },
];

const LINE_COLORS = [
  "hsl(var(--primary))",
  "hsl(210, 70%, 50%)",
  "hsl(340, 70%, 50%)",
  "hsl(150, 70%, 40%)",
  "hsl(45, 90%, 50%)",
  "hsl(280, 70%, 50%)",
  "hsl(0, 70%, 50%)",
  "hsl(180, 70%, 40%)",
];

const formatValue = (value: number | null, metric: MetricType): string => {
  if (value === null || value === undefined) return "-";
  if (metric === "followers") {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  }
  return `${value.toFixed(2)}%`;
};

export function TrendsTab({ profiles, kpis, isLoading }: TrendsTabProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("engagement_rate");
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [isProfilesOpen, setIsProfilesOpen] = useState(false);
  const [profileSearch, setProfileSearch] = useState("");

  // Filter profiles based on search term
  const filteredProfiles = useMemo(() => {
    if (!profileSearch.trim()) return profiles;
    const searchLower = profileSearch.toLowerCase();
      return profiles.filter(p => 
        p.profile_id.toLowerCase().includes(searchLower) ||
        getFKProfileDisplayName(p).toLowerCase().includes(searchLower) ||
      p.network.toLowerCase().includes(searchLower)
    );
  }, [profiles, profileSearch]);

  // Group KPIs by date and profile
  const chartData = useMemo(() => {
    if (kpis.length === 0 || profiles.length === 0) return [];

    // Create a map of dates to profile values
    const dateMap = new Map<string, Record<string, number | null>>();

    // Filter to selected profiles or use all if none selected
    const profilesToShow = selectedProfiles.length > 0 
      ? profiles.filter(p => selectedProfiles.includes(p.id))
      : profiles.slice(0, 5); // Default to first 5 profiles

    const profileIds = new Set(profilesToShow.map(p => p.id));

    kpis.forEach((kpi) => {
      if (!profileIds.has(kpi.fk_profile_id)) return;
      
      const dateKey = kpi.period_end;
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, {});
      }
      
      const profile = profiles.find(p => p.id === kpi.fk_profile_id);
      if (profile) {
        const profileName = getFKProfileSeriesLabel(profile);
        dateMap.get(dateKey)![profileName] = kpi[selectedMetric];
      }
    });

    // Convert to array and sort by date
    return Array.from(dateMap.entries())
      .map(([date, values]) => ({
        date,
        formattedDate: format(new Date(date), "dd MMM", { locale: es }),
        ...values,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [kpis, profiles, selectedMetric, selectedProfiles]);

  const displayProfiles = useMemo(() => {
    if (selectedProfiles.length > 0) {
      return profiles.filter(p => selectedProfiles.includes(p.id));
    }
    return profiles.slice(0, 5);
  }, [profiles, selectedProfiles]);

  const toggleProfile = (profileId: string) => {
    setSelectedProfiles(prev => {
      if (prev.includes(profileId)) {
        return prev.filter(id => id !== profileId);
      }
      if (prev.length >= 8) return prev; // Max 8 profiles
      return [...prev, profileId];
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (profiles.length === 0 || kpis.length === 0) {
    return (
      <Card className="py-12">
        <CardContent className="text-center">
          <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Sin datos históricos</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Sincroniza los perfiles varias veces en diferentes fechas para ver la evolución de las métricas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Métrica:</span>
          <Select value={selectedMetric} onValueChange={(v) => setSelectedMetric(v as MetricType)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METRIC_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Profile selection - Collapsible */}
      <Collapsible open={isProfilesOpen} onOpenChange={setIsProfilesOpen}>
        <div className="flex items-center gap-3">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Users className="h-4 w-4" />
              <span>Perfiles</span>
              <Badge variant="secondary" className="ml-1">
                {selectedProfiles.length > 0 ? selectedProfiles.length : Math.min(5, profiles.length)} de {profiles.length}
              </Badge>
              {isProfilesOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          
          {/* Show selected profiles as chips when collapsed */}
          {!isProfilesOpen && selectedProfiles.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {profiles
                .filter(p => selectedProfiles.includes(p.id))
                .slice(0, 5)
                .map((profile) => (
                  <Badge key={profile.id} variant="default" className="text-xs flex items-center gap-1">
                    <NetworkIcon network={profile.network} className="h-2.5 w-2.5" />
                    @{profile.profile_id}
                  </Badge>
                ))}
              {selectedProfiles.length > 5 && (
                <Badge variant="secondary" className="text-xs">
                  +{selectedProfiles.length - 5} más
                </Badge>
              )}
            </div>
          )}
        </div>
        
        <CollapsibleContent className="mt-3">
          <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar perfil o red social..."
                value={profileSearch}
                onChange={(e) => setProfileSearch(e.target.value)}
                className="pl-9 pr-8 h-9"
              />
              {profileSearch && (
                <button
                  onClick={() => setProfileSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            {/* Filtered profiles */}
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {filteredProfiles.length > 0 ? (
                filteredProfiles.map((profile, index) => {
                  const isSelected = selectedProfiles.length === 0 
                    ? profiles.indexOf(profile) < 5 
                    : selectedProfiles.includes(profile.id);
                  return (
                    <Badge
                      key={profile.id}
                      variant={isSelected ? "default" : "outline"}
                      className="cursor-pointer transition-colors hover:opacity-80 flex items-center gap-1.5"
                      onClick={() => toggleProfile(profile.id)}
                    >
                      <NetworkIcon network={profile.network} className="h-3 w-3" />
                      <span>@{profile.profile_id}</span>
                    </Badge>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  No se encontraron perfiles para "{profileSearch}"
                </p>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground">
              {filteredProfiles.length} de {profiles.length} perfiles · Máximo 8 seleccionados
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Evolución de {METRIC_OPTIONS.find(m => m.value === selectedMetric)?.label}
          </CardTitle>
          <CardDescription>
            Comparativa histórica de métricas entre perfiles seleccionados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="formattedDate" 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v) => formatValue(v, selectedMetric)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                    formatter={(value: number) => [formatValue(value, selectedMetric), ""]}
                  />
                  <Legend />
                  {displayProfiles.map((profile, index) => {
                    const name = profile.display_name || profile.profile_id;
                    return (
                      <Line
                        key={profile.id}
                        type="monotone"
                        dataKey={name}
                        stroke={LINE_COLORS[index % LINE_COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No hay suficientes datos para mostrar tendencias
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
