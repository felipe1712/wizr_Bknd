import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle,
  TrendingUp,
  Hash,
  MoreVertical,
  Pencil,
  Trash2,
  ThumbsDown,
} from "lucide-react";
import type { AlertConfig, AlertType } from "@/hooks/useAlerts";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface AlertConfigCardProps {
  config: AlertConfig;
  onEdit: (config: AlertConfig) => void;
  onDelete: (id: string) => void;
  onToggleActive: (data: { id: string; is_active: boolean }) => void;
}

const alertTypeIcons: Record<AlertType, React.ElementType> = {
  sentiment_negative: ThumbsDown,
  mention_spike: TrendingUp,
  keyword_match: Hash,
};

const alertTypeLabels: Record<AlertType, string> = {
  sentiment_negative: "Sentimiento Negativo",
  mention_spike: "Pico de Menciones",
  keyword_match: "Palabra Clave",
};

const alertTypeColors: Record<AlertType, string> = {
  sentiment_negative: "text-red-500 bg-red-500/10",
  mention_spike: "text-amber-500 bg-amber-500/10",
  keyword_match: "text-blue-500 bg-blue-500/10",
};

export function AlertConfigCard({
  config,
  onEdit,
  onDelete,
  onToggleActive,
}: AlertConfigCardProps) {
  const Icon = alertTypeIcons[config.alert_type];

  const getThresholdLabel = () => {
    if (config.alert_type === "sentiment_negative") {
      return `Umbral: >${config.threshold_percent}% negativas`;
    }
    if (config.alert_type === "mention_spike") {
      return `Umbral: +${config.threshold_percent}% aumento`;
    }
    if (config.alert_type === "keyword_match" && config.keywords.length > 0) {
      return `${config.keywords.length} palabra(s) clave`;
    }
    return null;
  };

  return (
    <Card className={!config.is_active ? "opacity-60" : undefined}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`rounded-lg p-2 ${alertTypeColors[config.alert_type]}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{config.name}</h4>
                {!config.is_active && (
                  <Badge variant="secondary" className="text-xs">
                    Pausada
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {alertTypeLabels[config.alert_type]}
              </p>
              {getThresholdLabel() && (
                <p className="text-xs text-muted-foreground">
                  {getThresholdLabel()}
                </p>
              )}
              {config.keywords.length > 0 && config.alert_type === "keyword_match" && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {config.keywords.slice(0, 3).map((kw) => (
                    <Badge key={kw} variant="outline" className="text-xs">
                      {kw}
                    </Badge>
                  ))}
                  {config.keywords.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{config.keywords.length - 3}
                    </Badge>
                  )}
                </div>
              )}
              {config.trigger_count > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  <AlertTriangle className="inline h-3 w-3 mr-1" />
                  {config.trigger_count} veces activada
                  {config.last_triggered_at && (
                    <span>
                      {" "}
                      • Última:{" "}
                      {format(new Date(config.last_triggered_at), "d MMM HH:mm", {
                        locale: es,
                      })}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={config.is_active}
              onCheckedChange={(checked) => onToggleActive({ id: config.id, is_active: checked })}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem onClick={() => onEdit(config)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(config.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
