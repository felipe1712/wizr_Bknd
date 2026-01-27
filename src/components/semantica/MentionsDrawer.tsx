import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Mention } from "@/hooks/useMentions";

export type FilterType = "topic" | "sentiment" | "keyword";

export interface MentionsFilter {
  type: FilterType;
  value: string;
  label: string;
}

interface MentionsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: MentionsFilter | null;
  mentions: Mention[];
  mentionSentiments: Array<{ id: string; sentiment: string }>;
}

export function MentionsDrawer({
  open,
  onOpenChange,
  filter,
  mentions,
  mentionSentiments,
}: MentionsDrawerProps) {
  // Create a map of mention id -> sentiment for quick lookup
  const sentimentMap = new Map(mentionSentiments.map((ms) => [ms.id, ms.sentiment]));

  // Filter mentions based on the filter type
  const filteredMentions = mentions.filter((mention) => {
    if (!filter) return false;

    switch (filter.type) {
      case "sentiment": {
        const sentiment = sentimentMap.get(mention.id);
        return sentiment === filter.value;
      }
      case "keyword": {
        const keyword = filter.value.toLowerCase();
        const title = mention.title?.toLowerCase() || "";
        const desc = mention.description?.toLowerCase() || "";
        const keywords = mention.matched_keywords?.map((k) => k.toLowerCase()) || [];
        return (
          title.includes(keyword) ||
          desc.includes(keyword) ||
          keywords.some((k) => k.includes(keyword))
        );
      }
      case "topic": {
        // Topics are more abstract - search for topic keywords in content
        const topicLower = filter.value.toLowerCase();
        const title = mention.title?.toLowerCase() || "";
        const desc = mention.description?.toLowerCase() || "";
        // Simple heuristic: check if any word from the topic appears
        const topicWords = topicLower.split(/\s+/).filter((w) => w.length > 3);
        return topicWords.some((word) => title.includes(word) || desc.includes(word));
      }
      default:
        return false;
    }
  });

  const getSentimentBadge = (mentionId: string) => {
    const sentiment = sentimentMap.get(mentionId);
    if (!sentiment) return null;
    return (
      <Badge
        variant={
          sentiment === "positivo"
            ? "default"
            : sentiment === "negativo"
            ? "destructive"
            : "secondary"
        }
        className="text-xs"
      >
        {sentiment}
      </Badge>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {filter?.type === "sentiment" && "Menciones por sentimiento"}
            {filter?.type === "keyword" && "Menciones por palabra clave"}
            {filter?.type === "topic" && "Menciones por tema"}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <Badge variant="outline">{filter?.label}</Badge>
            <span className="text-muted-foreground">
              {filteredMentions.length} menciones
            </span>
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
          <div className="space-y-4">
            {filteredMentions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No se encontraron menciones para este filtro
              </p>
            ) : (
              filteredMentions.map((mention, index) => (
                <div
                  key={mention.id}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors relative"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-muted text-xs font-medium text-muted-foreground shrink-0">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-2">
                        {mention.title || "Sin título"}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {mention.description || "Sin descripción"}
                      </p>
                    </div>
                    {getSentimentBadge(mention.id)}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {mention.source_domain}
                    </span>
                    <a
                      href={mention.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      Ver fuente
                      <ExternalLink className="h-3 w-3" />
                    </a>
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
