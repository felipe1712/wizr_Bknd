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
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
    badge: "bg-blue-100 text-blue-700",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
    badge: "bg-amber-100 text-amber-700",
  },
  critical: {
    icon: AlertCircle,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-700",
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
        "transition-all cursor-pointer hover:shadow-md",
        !notification.is_read && "border-l-4 border-l-primary shadow-sm",
        severity.bg
      )}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={cn("rounded-full p-2 bg-white shadow-sm", severity.color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm text-foreground">{notification.title}</h4>
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
            className="h-7 w-7 shrink-0 hover:bg-white/50"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(notification.id);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
