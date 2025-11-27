import { Bell } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useNavigate } from "wouter";

export function NotificationBell() {
  const navigate = useNavigate();

  // Poll unread count every 3 seconds
  const { data } = useQuery({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 3000,
  });

  const unreadCount = data?.count || 0;

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/mark-all-read", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const handleClick = async () => {
    // Mark all as read
    await markAllReadMutation.mutateAsync();
    // Navigate to chat
    navigate("/chat");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      className="relative"
      data-testid="button-notifications-bell"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          data-testid="badge-unread-count"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </Badge>
      )}
    </Button>
  );
}
