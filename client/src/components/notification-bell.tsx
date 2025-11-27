import { Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

export function NotificationBell() {
  const [, navigate] = useLocation();

  // Poll unread count every 3 seconds
  const { data } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 3000,
  });

  const unreadCount = data?.count || 0;

  const handleClick = () => {
    // Navigate to chat - messages marked as read individually per conversation
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
