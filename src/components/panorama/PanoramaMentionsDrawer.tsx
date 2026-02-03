import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mention } from "@/hooks/useMentions";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ExternalLink,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  X,
  Newspaper,
  Twitter,
  Facebook,
  Youtube,
  Instagram,
  Linkedin,
  Globe,
  Hash,
} from "lucide-react";

export type FilterType = "date" | "sentiment" | "platform" | "all";

export interface MentionsFilter {
  type: FilterType;
  value?: string; // date string, sentiment value, or platform
  label?: string;
}

interface PanoramaMentionsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mentions: Mention[];
  filter: MentionsFilter | null;
}

const PLATFORM_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  twitter: { label: "Twitter/X", icon: Twitter, color: "text-sky-500" },
  facebook: { label: "Facebook", icon: Facebook, color: "text-blue-600" },
  instagram: { label: "Instagram", icon: Instagram, color: "text-pink-500" },
  youtube: { label: "YouTube", icon: Youtube, color: "text-red-500" },
  linkedin: { label: "LinkedIn", icon: Linkedin, color: "text-blue-700" },
  tiktok: { label: "TikTok", icon: Hash, color: "text-foreground" },
  reddit: { label: "Reddit", icon: Globe, color: "text-orange-500" },
  news: { label: "Medios digitales", icon: Newspaper, color: "text-muted-foreground" },
  other: { label: "Otros", icon: Globe, color: "text-muted-foreground" },
};

function categorizeSource(domain: string | null): string {
  if (!domain) return "other";
  const d = domain.toLowerCase();
  if (d.includes("twitter") || d.includes("x.com")) return "twitter";
  if (d.includes("facebook") || d.includes("fb.com")) return "facebook";
  if (d.includes("instagram")) return "instagram";
  if (d.includes("tiktok")) return "tiktok";
  if (d.includes("youtube") || d.includes("youtu.be")) return "youtube";
  if (d.includes("linkedin")) return "linkedin";
  if (d.includes("reddit")) return "reddit";
  return "news";
}

function getSentimentIcon(sentiment: string | null) {
  if (!sentiment) return <Minus className="h-4 w-4 text-muted-foreground" />;
  switch (sentiment.toLowerCase()) {
    case "positivo":
    case "positive":
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case "negativo":
    case "negative":
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    default:
      return <Minus className="h-4 w-4 text-blue-500" />;
  }
}

function getSentimentLabel(sentiment: string | null): string {
  if (!sentiment) return "Sin analizar";
  const s = sentiment.toLowerCase();
  if (s === "positivo" || s === "positive") return "Positivo";
  if (s === "negativo" || s === "negative") return "Negativo";
  if (s === "neutral") return "Neutral";
  return sentiment;
}

export function PanoramaMentionsDrawer({
  open,
  onOpenChange,
  mentions,
  filter,
}: PanoramaMentionsDrawerProps) {
  const [platformFilter, setPlatformFilter] = useState<string>("__all__");
  const [sentimentFilter, setSentimentFilter] = useState<string>("__all__");

  // Get unique platforms from mentions
  const availablePlatforms = useMemo(() => {
    const platforms = new Set<string>();
    mentions.forEach((m) => platforms.add(categorizeSource(m.source_domain)));
    return Array.from(platforms).sort();
  }, [mentions]);

  // Apply filters
  const filteredMentions = useMemo(() => {
    let result = [...mentions];

    // Apply initial filter (from chart click)
    if (filter) {
      switch (filter.type) {
        case "date":
          result = result.filter((m) => {
            const effectiveDate = m.published_at || m.created_at;
            return format(new Date(effectiveDate), "yyyy-MM-dd") === filter.value;
          });
          break;
        case "sentiment":
          result = result.filter((m) => {
            const s = (m.sentiment || "").toLowerCase();
            if (filter.value === "positivo") return s === "positivo" || s === "positive";
            if (filter.value === "negativo") return s === "negativo" || s === "negative";
            if (filter.value === "neutral") return s === "neutral";
            if (filter.value === "sinAnalizar") return !m.sentiment;
            return true;
          });
          break;
        case "platform":
          result = result.filter((m) => categorizeSource(m.source_domain) === filter.value);
          break;
      }
    }

    // Apply additional filters
    if (platformFilter !== "__all__") {
      result = result.filter((m) => categorizeSource(m.source_domain) === platformFilter);
    }

    if (sentimentFilter !== "__all__") {
      result = result.filter((m) => {
        const s = (m.sentiment || "").toLowerCase();
        if (sentimentFilter === "positivo") return s === "positivo" || s === "positive";
        if (sentimentFilter === "negativo") return s === "negativo" || s === "negative";
        if (sentimentFilter === "neutral") return s === "neutral";
        if (sentimentFilter === "sinAnalizar") return !m.sentiment;
        return true;
      });
    }

    // Sort by date (newest first)
    return result.sort((a, b) => {
      const dateA = new Date(a.published_at || a.created_at);
      const dateB = new Date(b.published_at || b.created_at);
      return dateB.getTime() - dateA.getTime();
    });
  }, [mentions, filter, platformFilter, sentimentFilter]);

  // Reset additional filters when drawer closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPlatformFilter("__all__");
      setSentimentFilter("__all__");
    }
    onOpenChange(newOpen);
  };

  // Get title based on filter
  const getTitle = () => {
    if (!filter) return "Todas las menciones";
    switch (filter.type) {
      case "date":
        return `Menciones del ${filter.label || filter.value}`;
      case "sentiment":
        return `Menciones ${filter.label || filter.value}`;
      case "platform":
        return `Menciones de ${PLATFORM_CONFIG[filter.value || "other"]?.label || filter.value}`;
      default:
        return "Menciones";
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {getTitle()}
          </SheetTitle>
          <SheetDescription>
            {filteredMentions.length} mención{filteredMentions.length !== 1 ? "es" : ""} encontrada{filteredMentions.length !== 1 ? "s" : ""}
          </SheetDescription>
        </SheetHeader>

        {/* Additional Filters */}
        <div className="flex gap-2 py-3 border-b">
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="flex-1 bg-background">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="__all__">Todas las plataformas</SelectItem>
              {availablePlatforms.map((p) => {
                const config = PLATFORM_CONFIG[p] || PLATFORM_CONFIG.other;
                const Icon = config.icon;
                return (
                  <SelectItem key={p} value={p}>
                    <span className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${config.color}`} />
                      {config.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
            <SelectTrigger className="flex-1 bg-background">
              <SelectValue placeholder="Sentimiento" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="__all__">Todo sentimiento</SelectItem>
              <SelectItem value="positivo">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Positivo
                </span>
              </SelectItem>
              <SelectItem value="neutral">
                <span className="flex items-center gap-2">
                  <Minus className="h-4 w-4 text-blue-500" />
                  Neutral
                </span>
              </SelectItem>
              <SelectItem value="negativo">
                <span className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  Negativo
                </span>
              </SelectItem>
              <SelectItem value="sinAnalizar">
                <span className="flex items-center gap-2">
                  <Minus className="h-4 w-4 text-muted-foreground" />
                  Sin analizar
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active filters display */}
        {(filter || platformFilter !== "__all__" || sentimentFilter !== "__all__") && (
          <div className="flex flex-wrap gap-2 py-2">
            {filter && (
              <Badge variant="secondary" className="gap-1">
                {filter.label || filter.value}
                <button onClick={() => onOpenChange(false)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {platformFilter !== "__all__" && (
              <Badge variant="outline" className="gap-1">
                {PLATFORM_CONFIG[platformFilter]?.label || platformFilter}
                <button onClick={() => setPlatformFilter("__all__")} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {sentimentFilter !== "__all__" && (
              <Badge variant="outline" className="gap-1">
                {sentimentFilter === "sinAnalizar" ? "Sin analizar" : sentimentFilter}
                <button onClick={() => setSentimentFilter("__all__")} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )}

        {/* Mentions List */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {filteredMentions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Filter className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No hay menciones que coincidan</p>
              <p className="text-sm text-muted-foreground/70">Prueba ajustando los filtros</p>
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {filteredMentions.map((mention) => {
                const platform = categorizeSource(mention.source_domain);
                const platformConfig = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.other;
                const PlatformIcon = platformConfig.icon;

                return (
                  <div
                    key={mention.id}
                    className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${platformConfig.color}`}>
                        <PlatformIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getSentimentIcon(mention.sentiment)}
                          <span className="text-xs text-muted-foreground">
                            {getSentimentLabel(mention.sentiment)}
                          </span>
                        </div>
                        <h4 className="font-medium text-sm line-clamp-2 mb-1">
                          {mention.title || "Sin título"}
                        </h4>
                        {mention.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {mention.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(
                              new Date(mention.published_at || mention.created_at),
                              "d MMM yyyy",
                              { locale: es }
                            )}
                            {mention.source_domain && (
                              <span className="text-muted-foreground/70 truncate max-w-[100px]">
                                · {mention.source_domain}
                              </span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => window.open(mention.url, "_blank")}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
