import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Calendar, AlertCircle, TrendingUp, Globe } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Mention {
  id: string;
  title: string | null;
  description: string | null;
  url: string;
  source_domain: string | null;
  sentiment: string | null;
  created_at: string;
  matched_keywords: string[];
}

interface TrendMentionsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string | null;
  sourceDomain: string | null;
  sourceLabel: string | null;
  mentions: Mention[];
}

export function TrendMentionsDrawer({
  open,
  onOpenChange,
  date,
  sourceDomain,
  sourceLabel,
  mentions,
}: TrendMentionsDrawerProps) {
  // Filter mentions by the selected date and source domain
  const filteredMentions = mentions.filter((m) => {
    const mentionDate = format(new Date(m.created_at), "yyyy-MM-dd");
    const normalizedMentionDomain = normalizeDomain(m.source_domain || "");
    const normalizedFilterDomain = normalizeDomain(sourceDomain || "");
    
    return mentionDate === date && normalizedMentionDomain === normalizedFilterDomain;
  });

  const getSentimentBadge = (sentiment: string | null) => {
    if (!sentiment) {
      return (
        <Badge variant="outline" className="text-xs gap-1">
          <AlertCircle className="h-3 w-3" />
          Sin analizar
        </Badge>
      );
    }
    return (
      <Badge
        variant={
          sentiment === "positivo"
            ? "default"
            : sentiment === "negativo"
            ? "destructive"
            : "secondary"
        }
        className="text-xs capitalize"
      >
        {sentiment}
      </Badge>
    );
  };

  const formattedDate = date
    ? format(new Date(date), "d 'de' MMMM", { locale: es })
    : "";

  const faviconUrl = sourceLabel
    ? `https://www.google.com/s2/favicons?domain=${sourceLabel}&sz=32`
    : null;

  const openExternalUrl = (url: string) => {
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      window.location.assign(url);
      return;
    }
    try {
      win.opener = null;
    } catch {
      // ignore
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            {faviconUrl && (
              <img
                src={faviconUrl}
                alt=""
                className="h-6 w-6 rounded"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <span className="flex items-center gap-2">
              {sourceLabel || sourceDomain}
              <Badge variant="secondary" className="ml-1">
                <Calendar className="h-3 w-3 mr-1" />
                {formattedDate}
              </Badge>
            </span>
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {filteredMentions.length} mención{filteredMentions.length !== 1 ? "es" : ""} encontrada{filteredMentions.length !== 1 ? "s" : ""}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
          <div className="space-y-4">
            {filteredMentions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Globe className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No se encontraron menciones</p>
                <p className="text-sm text-muted-foreground/70">
                  Para {sourceLabel || sourceDomain} el {formattedDate}
                </p>
              </div>
            ) : (
              filteredMentions.map((mention, index) => (
                <div
                  key={mention.id}
                  className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors relative"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-muted text-xs font-medium text-muted-foreground shrink-0">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-2">
                        {mention.title || "Sin título"}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                        {mention.description || "Sin descripción"}
                      </p>
                    </div>
                    {getSentimentBadge(mention.sentiment)}
                  </div>

                  {/* Keywords */}
                  {mention.matched_keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {mention.matched_keywords.slice(0, 4).map((kw) => (
                        <Badge
                          key={kw}
                          variant="secondary"
                          className="text-xs"
                        >
                          {kw}
                        </Badge>
                      ))}
                      {mention.matched_keywords.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{mention.matched_keywords.length - 4}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-2 border-t">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(mention.created_at), "d MMM yyyy HH:mm", {
                        locale: es,
                      })}
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openExternalUrl(mention.url);
                      }}
                      className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Ver fuente
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// Normalize domain to match the hook's normalization
function normalizeDomain(domain: string): string {
  if (!domain) return "unknown";
  const lower = domain.toLowerCase().trim();
  
  if (lower === "linkedin" || lower.includes("linkedin.com")) return "linkedin";
  if (lower === "twitter" || lower === "x.com" || lower.includes("twitter.com")) return "twitter";
  if (lower === "facebook" || lower.includes("facebook.com")) return "facebook";
  if (lower === "instagram" || lower.includes("instagram.com")) return "instagram";
  if (lower === "youtube" || lower.includes("youtube.com")) return "youtube";
  if (lower === "tiktok" || lower.includes("tiktok.com")) return "tiktok";
  if (lower.includes("threads.")) return "threads";
  
  return lower.replace(/^www\./, "").split("/")[0];
}
