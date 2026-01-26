import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, AlertTriangle, Info, AlertCircle } from "lucide-react";
import type { AlertNotification } from "@/hooks/useAlerts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface NotificationCardProps {
  notification: AlertNotification;
  onMarkAsRead: (id: string) => void;
  onDismiss: (id: string) => void;
}

const severityConfig = {
  info: {
    icon: Info,
    color: "text-blue-500",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-500",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  critical: {
    icon: AlertCircle,
    color: "text-red-500",
    bg: "bg-red-500/10 border-red-500/20",
  },
};

export function NotificationCard({
  notification,
  onMarkAsRead,
  onDismiss,
}: NotificationCardProps) {
  const severity = severityConfig[notification.severity] || severityConfig.warning;
  const Icon = severity.icon;

  const handleClick = () => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id);
    }
  };

  return (
    <Card
      className={cn(
        "transition-colors cursor-pointer hover:bg-muted/50",
        !notification.is_read && "border-l-4 border-l-primary",
        severity.bg
      )}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={cn("rounded-full p-1.5", severity.color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-sm">{notification.title}</h4>
                {!notification.is_read && (
                  <Badge variant="default" className="text-xs h-5">
                    Nueva
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {notification.message}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {format(new Date(notification.triggered_at), "d MMM, HH:mm", {
                    locale: es,
                  })}
                </span>
                {notification.alert_config && (
                  <>
                    <span>•</span>
                    <span>{notification.alert_config.name}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(notification.id);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
