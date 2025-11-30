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

  const handleMarkAllAsRead = async () => {
    try {
      const unreadNotifs = notifications.filter(n => !n.lida);
      await Promise.all(
        unreadNotifs.map(notif =>
          fetch(`/api/notifications/${notif.id}/read`, {
            method: "POST",
          })
        )
      );
      await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Sucesso",
        description: "Todas as notificações marcadas como lidas",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível marcar todas como lidas",
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
            <span
              className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-white flex items-center justify-center text-xs font-semibold rounded-full shadow-md"
              data-testid="badge-chat-unread-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="bg-background rounded-lg overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
            <h3 className="font-semibold text-sm">Atividades</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-primary hover:underline font-medium transition-colors"
                data-testid="button-mark-all-as-read"
              >
                Marcar tudo como lido
              </button>
            )}
          </div>

          {/* Content */}
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma atividade</p>
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-3 p-3">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-md border transition-colors ${
                      notif.lida
                        ? "border-slate-200 dark:border-slate-700 bg-background"
                        : "border-primary/30 dark:border-primary/20 bg-primary/5 dark:bg-primary/10"
                    }`}
                    data-testid={`activity-${notif.id}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm leading-snug">{notif.titulo}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-snug">
                          {notif.descricao}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-2">
                          {new Date(notif.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit'
                          })}
                        </p>
                      </div>
                      {!notif.lida && (
                        <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                      )}
                    </div>
                    
                    {/* Actions - Small text links */}
                    <div className="flex gap-3 mt-2 text-xs">
                      {notif.clientId && (
                        <button
                          onClick={() => handleViewClient(notif.clientId)}
                          data-testid={`button-view-client-${notif.id}`}
                          className="text-primary hover:underline font-medium transition-colors"
                        >
                          Ver cliente
                        </button>
                      )}
                      {!notif.lida && (
                        <button
                          onClick={() => handleMarkAsRead(notif.id)}
                          data-testid={`button-mark-read-${notif.id}`}
                          className="text-primary hover:underline font-medium transition-colors"
                        >
                          Marcar como lida
                        </button>
                      )}
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
