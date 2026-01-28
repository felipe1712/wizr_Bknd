import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Database, ArrowRight, BarChart3, MessageSquareText, TrendingUp, FileText } from "lucide-react";

interface SavedMentionsBadgeProps {
  count: number;
  showLinks?: boolean;
  className?: string;
}

export function SavedMentionsBadge({ count, showLinks = true, className }: SavedMentionsBadgeProps) {
  if (count === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">
          {count} menciones guardadas
        </span>
      </div>
      
      {showLinks && (
        <>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">Ver en:</span>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link to="/dashboard/panorama">
                <BarChart3 className="h-3 w-3 mr-1" />
                Panorama
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link to="/dashboard/semantica">
                <MessageSquareText className="h-3 w-3 mr-1" />
                Semántica
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link to="/dashboard/tendencias">
                <TrendingUp className="h-3 w-3 mr-1" />
                Tendencias
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link to="/dashboard/reportes">
                <FileText className="h-3 w-3 mr-1" />
                Reportes
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
