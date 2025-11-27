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
          className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 text-xs font-bold shadow-lg"
          data-testid="badge-unread-count"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </Badge>
      )}
    </Button>
  );
}
