import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useSocialScrapeJobs, SocialScrapeJob, SocialResult } from "@/hooks/useSocialScrapeJobs";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";

// Mexico City timezone (Central Mexico)
const MEXICO_TIMEZONE = "America/Mexico_City";
import {
  Search,
  Download,
  Trash2,
  Eye,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Calendar,
  Filter,
  Heart,
  MessageCircle,
  Share2,
  ExternalLink,
  User,
  BarChart3,
} from "lucide-react";

// Platform icons
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

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
  </svg>
);

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const RedditIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
  </svg>
);

const PLATFORM_ICONS: Record<string, React.ComponentType> = {
  twitter: TwitterIcon,
  facebook: FacebookIcon,
  tiktok: TikTokIcon,
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  youtube: YouTubeIcon,
  reddit: RedditIcon,
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter: "bg-black text-white",
  facebook: "bg-blue-600 text-white",
  tiktok: "bg-black text-white",
  instagram: "bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white",
  linkedin: "bg-blue-700 text-white",
  youtube: "bg-red-600 text-white",
  reddit: "bg-orange-600 text-white",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  running: { label: "En progreso", color: "bg-blue-100 text-blue-800", icon: Loader2 },
  completed: { label: "Completado", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  failed: { label: "Fallido", color: "bg-red-100 text-red-800", icon: XCircle },
};

interface SocialHistoryTabProps {
  projectId: string;
}

export function SocialHistoryTab({ projectId }: SocialHistoryTabProps) {
  const { toast } = useToast();
  const {
    jobs,
    jobsLoading,
    filters,
    setFilters,
    refetchJobs,
    fetchJobResults,
    deleteJob,
    stats,
  } = useSocialScrapeJobs(projectId);

  const [selectedJob, setSelectedJob] = useState<SocialScrapeJob | null>(null);
  const [jobResults, setJobResults] = useState<SocialResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const handleViewResults = async (job: SocialScrapeJob) => {
    setSelectedJob(job);
    setResultsLoading(true);
    try {
      const results = await fetchJobResults(job.id);
      setJobResults(results);
    } catch (error) {
      console.error("Error fetching results:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los resultados",
        variant: "destructive",
      });
    } finally {
      setResultsLoading(false);
    }
  };

  const handleExportCSV = (results: SocialResult[]) => {
    if (results.length === 0) return;

    const headers = [
      "Plataforma",
      "Título",
      "Autor",
      "Usuario",
      "Likes",
      "Comentarios",
      "Compartidos",
      "Vistas",
      "Engagement",
      "Fecha publicación",
      "URL",
      "Tipo",
      "Hashtags",
    ];

    const rows = results.map((r) => [
      r.platform,
      `"${(r.title || "").replace(/"/g, '""')}"`,
      `"${(r.author_name || "").replace(/"/g, '""')}"`,
      r.author_username || "",
      r.likes,
      r.comments,
      r.shares,
      r.views,
      r.engagement,
      r.published_at || "",
      r.url || "",
      r.content_type,
      (r.hashtags || []).join(", "),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `social_results_${selectedJob?.platform}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Exportación completada",
      description: `${results.length} resultados exportados a CSV`,
    });
  };

  const filteredJobs = jobs.filter((job) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      job.search_value.toLowerCase().includes(search) ||
      job.platform.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats?.totalJobs || 0}</p>
                <p className="text-sm text-muted-foreground">Total ejecuciones</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.completedJobs || 0}</p>
                <p className="text-sm text-muted-foreground">Completadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.totalResults?.toLocaleString() || 0}</p>
                <p className="text-sm text-muted-foreground">Total resultados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-1">
              {Object.entries(stats?.byPlatform || {}).map(([platform, count]) => {
                const Icon = PLATFORM_ICONS[platform];
                return (
                  <Badge key={platform} variant="secondary" className="flex items-center gap-1">
                    {Icon && <Icon />}
                    {count}
                  </Badge>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground mt-2">Por plataforma</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Historial de ejecuciones
          </CardTitle>
          <CardDescription>
            Consulta y exporta los resultados de búsquedas anteriores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por término o plataforma..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select
              value={filters.platform || "all"}
              onValueChange={(v) => setFilters({ ...filters, platform: v === "all" ? undefined : v })}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Plataforma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="twitter">X (Twitter)</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="reddit">Reddit</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.status || "all"}
              onValueChange={(v) => setFilters({ ...filters, status: v === "all" ? undefined : v })}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="completed">Completados</SelectItem>
                <SelectItem value="running">En progreso</SelectItem>
                <SelectItem value="failed">Fallidos</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => refetchJobs()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
          </div>

          {/* Jobs Table */}
          {jobsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay ejecuciones registradas</p>
              <p className="text-sm">Las búsquedas de redes sociales aparecerán aquí</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plataforma</TableHead>
                    <TableHead>Búsqueda</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Resultados</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job) => {
                    const PlatformIcon = PLATFORM_ICONS[job.platform];
                    const statusConfig = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
                    const StatusIcon = statusConfig.icon;

                    return (
                      <TableRow key={job.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`rounded-full p-1.5 ${PLATFORM_COLORS[job.platform]}`}>
                              {PlatformIcon && <PlatformIcon />}
                            </div>
                            <span className="capitalize">{job.platform}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium truncate max-w-[200px]">{job.search_value}</p>
                            <p className="text-xs text-muted-foreground">{job.search_type}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusConfig.color}>
                            <StatusIcon className={`h-3 w-3 mr-1 ${job.status === "running" ? "animate-spin" : ""}`} />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{job.results_count}</span>
                        </TableCell>
                        <TableCell>
                          {formatInTimeZone(new Date(job.started_at), MEXICO_TIMEZONE, "d MMM yyyy HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewResults(job)}
                                  disabled={job.status !== "completed" || job.results_count === 0}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[80vh]">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    {selectedJob && (
                                      <>
                                        <div className={`rounded-full p-1.5 ${PLATFORM_COLORS[selectedJob.platform]}`}>
                                          {PLATFORM_ICONS[selectedJob.platform] && <span>{React.createElement(PLATFORM_ICONS[selectedJob.platform])}</span>}
                                        </div>
                                        Resultados: {selectedJob.search_value}
                                      </>
                                    )}
                                  </DialogTitle>
                                </DialogHeader>
                                <div className="flex justify-end mb-4">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleExportCSV(jobResults)}
                                    disabled={jobResults.length === 0}
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    Exportar CSV
                                  </Button>
                                </div>
                                {resultsLoading ? (
                                  <div className="space-y-2">
                                    {[1, 2, 3].map((i) => (
                                      <Skeleton key={i} className="h-20 w-full" />
                                    ))}
                                  </div>
                                ) : (
                                  <ScrollArea className="h-[500px]">
                                    <div className="space-y-3">
                                      {jobResults.map((result) => (
                                        <Card key={result.id} className="overflow-hidden">
                                          <CardContent className="p-4">
                                            <div className="flex items-start gap-3">
                                              <div className="flex-1 min-w-0 space-y-2">
                                                {result.author_name && (
                                                  <div className="flex items-center gap-2">
                                                    <User className="h-3 w-3 text-muted-foreground" />
                                                    {result.author_url ? (
                                                      <a
                                                        href={result.author_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm font-medium hover:text-primary flex items-center gap-1"
                                                      >
                                                        @{result.author_username || result.author_name}
                                                        {result.author_verified && (
                                                          <CheckCircle2 className="h-3 w-3 text-blue-500" />
                                                        )}
                                                      </a>
                                                    ) : (
                                                      <span className="text-sm font-medium">
                                                        @{result.author_username || result.author_name}
                                                      </span>
                                                    )}
                                                  </div>
                                                )}
                                                <p className="text-sm line-clamp-3">
                                                  {result.title || result.description || "Sin contenido"}
                                                </p>
                                                
                                                {/* Thumbnail from raw_data if available */}
                                                {(() => {
                                                  const rawData = result.raw_data as Record<string, unknown> | null;
                                                  const media = rawData?.media as Record<string, unknown> | undefined;
                                                  const thumbnailUrl = (media?.thumbnailUrl as string | undefined) 
                                                    || (rawData?.thumbnailUrl as string | undefined)
                                                    || (rawData?.thumbnail as string | undefined);
                                                  return thumbnailUrl ? (
                                                    <img 
                                                      src={thumbnailUrl} 
                                                      alt={result.title || "Thumbnail"}
                                                      className="h-16 w-auto max-w-[100px] object-cover rounded border mt-2"
                                                      onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                      }}
                                                    />
                                                  ) : null;
                                                })()}
                                                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                                  <span className="flex items-center gap-1">
                                                    <Heart className="h-3 w-3" />
                                                    {(result.likes ?? 0).toLocaleString()}
                                                  </span>
                                                  <span className="flex items-center gap-1">
                                                    <MessageCircle className="h-3 w-3" />
                                                    {(result.comments ?? 0).toLocaleString()}
                                                  </span>
                                                  {(result.shares ?? 0) > 0 && (
                                                    <span className="flex items-center gap-1">
                                                      <Share2 className="h-3 w-3" />
                                                      {(result.shares ?? 0).toLocaleString()}
                                                    </span>
                                                  )}
                                                  {result.published_at && (
                                                    <span className="flex items-center gap-1">
                                                      <Clock className="h-3 w-3" />
                                                      {formatInTimeZone(new Date(result.published_at), MEXICO_TIMEZONE, "d MMM yyyy HH:mm", { locale: es })}
                                                    </span>
                                                  )}
                                                  {result.url && (
                                                    <a
                                                      href={result.url}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="flex items-center gap-1 text-primary hover:underline"
                                                    >
                                                      <ExternalLink className="h-3 w-3" />
                                                      Ver original
                                                    </a>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      ))}
                                    </div>
                                  </ScrollArea>
                                )}
                              </DialogContent>
                            </Dialog>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar ejecución?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción eliminará la ejecución y todos sus resultados. Esta acción no se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteJob(job.id)}>
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
