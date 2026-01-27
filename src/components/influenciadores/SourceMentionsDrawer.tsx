import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Calendar, AlertCircle } from "lucide-react";
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

interface SourceMentionsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceDomain: string | null;
  mentions: Mention[];
}

export function SourceMentionsDrawer({
  open,
  onOpenChange,
  sourceDomain,
  mentions,
}: SourceMentionsDrawerProps) {
  const filteredMentions = mentions.filter(
    (m) => m.source_domain === sourceDomain
  );

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

  const faviconUrl = sourceDomain
    ? `https://www.google.com/s2/favicons?domain=${sourceDomain}&sz=32`
    : null;

  const openExternalUrl = (url: string) => {
    // Some environments (e.g., sandboxed iframes / strict popup blockers) may block window.open
    // even on user gestures. If so, fall back to same-tab navigation.
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
            {sourceDomain}
          </SheetTitle>
          <SheetDescription>
            {filteredMentions.length} menciones encontradas
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
          <div className="space-y-4">
            {filteredMentions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No se encontraron menciones para esta fuente
              </p>
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
                      {format(new Date(mention.created_at), "d MMM yyyy", {
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
