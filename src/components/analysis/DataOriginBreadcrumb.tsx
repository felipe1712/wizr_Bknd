import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Database, Calendar, ArrowLeft, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface DataOriginBreadcrumbProps {
  mentionCount: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
  showBackLink?: boolean;
  className?: string;
}

export function DataOriginBreadcrumb({ 
  mentionCount, 
  dateRange, 
  showBackLink = true,
  className 
}: DataOriginBreadcrumbProps) {
  if (mentionCount === 0) return null;

  const formatDateRange = () => {
    if (!dateRange) return null;
    
    const startStr = format(dateRange.start, "d MMM", { locale: es });
    const endStr = format(dateRange.end, "d MMM yyyy", { locale: es });
    
    // If same day
    if (format(dateRange.start, "yyyy-MM-dd") === format(dateRange.end, "yyyy-MM-dd")) {
      return format(dateRange.start, "d MMM yyyy", { locale: es });
    }
    
    // If same year, omit year from start
    if (dateRange.start.getFullYear() === dateRange.end.getFullYear()) {
      return `${startStr} - ${endStr}`;
    }
    
    return `${format(dateRange.start, "d MMM yyyy", { locale: es })} - ${endStr}`;
  };

  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2.5 ${className}`}>
      <div className="flex items-center gap-2 text-sm">
        <Database className="h-4 w-4 text-primary" />
        <span className="text-muted-foreground">Basado en</span>
        <Badge variant="secondary" className="font-semibold">
          {mentionCount} menciones
        </Badge>
      </div>
      
      {dateRange && (
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {formatDateRange()}
          </span>
        </div>
      )}
      
      {showBackLink && (
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
            <Link to="/dashboard/fuentes">
              <ExternalLink className="h-3 w-3 mr-1" />
              Ver fuentes
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
