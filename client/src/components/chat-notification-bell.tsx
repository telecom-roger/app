import { useState } from "react";
import { Bell, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  titulo: string;
  descricao: string;
  lida: boolean;
  createdAt: string;
  clientId?: string;
}

export function ChatNotificationBell() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 5000,
  });

  const unreadCount = notifications.filter(n => !n.lida).length;

  const handleMarkAsRead = async (notifId: string) => {
    try {
      await fetch(`/api/notifications/${notifId}/read`, {
        method: "POST",
      });
      // Invalidate queries to refresh badge
      await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível marcar como lida",
        variant: "destructive",
      });
    }
  };

  const handleViewClient = (clientId: string | undefined) => {
    if (clientId) {
      navigate(`/clientes/${clientId}`);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-chat-notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 text-xs font-bold shadow-lg"
              data-testid="badge-chat-unread-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Atividades</h3>
            {notifications.length === 0 && (
              <span className="text-xs text-muted-foreground">Nenhuma atividade</span>
            )}
          </div>
          
          {notifications.length > 0 && (
            <ScrollArea className="h-80 border rounded-md p-3">
              <div className="space-y-2">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      notif.lida
                        ? "bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700"
                        : "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700"
                    }`}
                    data-testid={`activity-${notif.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{notif.titulo}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              {notif.descricao}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                              {new Date(notif.createdAt).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          {!notif.lida && (
                            <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                          )}
                        </div>
                        <div className="flex gap-2 mt-3">
                          {notif.clientId && (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs"
                              onClick={() => handleViewClient(notif.clientId)}
                              data-testid={`button-view-client-${notif.id}`}
                            >
                              Ver cliente
                            </Button>
                          )}
                          {!notif.lida && (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs"
                              onClick={() => handleMarkAsRead(notif.id)}
                              data-testid={`button-mark-read-${notif.id}`}
                            >
                              Marcar como lida
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
