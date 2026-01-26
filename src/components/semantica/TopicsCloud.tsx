import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Topic } from "@/hooks/useSemanticAnalysis";

interface TopicsCloudProps {
  topics: Topic[];
  maxTopics?: number;
}

export function TopicsCloud({ topics, maxTopics = 8 }: TopicsCloudProps) {
  const displayTopics = topics.slice(0, maxTopics);

  const getSize = (relevance: number) => {
    if (relevance >= 80) return "text-xl font-bold";
    if (relevance >= 60) return "text-lg font-semibold";
    if (relevance >= 40) return "text-base font-medium";
    return "text-sm";
  };

  const getVariant = (relevance: number): "default" | "secondary" | "outline" => {
    if (relevance >= 70) return "default";
    if (relevance >= 40) return "secondary";
    return "outline";
  };

  if (displayTopics.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        No hay temas disponibles
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3 justify-center items-center p-4">
      {displayTopics.map((topic, index) => (
        <Badge
          key={index}
          variant={getVariant(topic.relevance)}
          className={cn(
            "cursor-default transition-transform hover:scale-105",
            getSize(topic.relevance)
          )}
        >
          {topic.name}
          <span className="ml-1.5 opacity-70">({topic.mentionCount})</span>
        </Badge>
      ))}
    </div>
  );
}
