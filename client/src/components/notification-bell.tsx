import { Bell, Check } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function NotificationBell() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Poll unread count every 3 seconds
  const { data } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 3000,
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/mark-all-read", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Sucesso",
        description: "Todas as notificações marcadas como lidas",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao marcar notificações como lidas",
        variant: "destructive",
      });
    },
  });

  const unreadCount = data?.count || 0;

  const handleNavigate = () => {
    navigate("/chat");
  };

  const handleMarkAllRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    markAllReadMutation.mutate();
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNavigate}
        className="relative"
        data-testid="button-notifications-bell"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-white flex items-center justify-center text-xs font-semibold rounded-full shadow-md"
            data-testid="badge-unread-count"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>
      {unreadCount > 0 && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleMarkAllRead}
          disabled={markAllReadMutation.isPending}
          className="h-9 w-9"
          data-testid="button-mark-all-read"
          title="Marcar tudo como lido"
        >
          <Check className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
