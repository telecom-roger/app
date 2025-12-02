import { useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UnreadMessage {
  messageId: string;
  conteudo: string;
  createdAt: string;
  conversationId: string;
  clientId: string;
  clientName: string;
}

interface UnreadMessagesResponse {
  messages: UnreadMessage[];
  hasMore: boolean;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: msgData = { messages: [], hasMore: false } as UnreadMessagesResponse, isLoading } = useQuery<UnreadMessagesResponse>({
    queryKey: ["/api/unread-messages"],
    refetchInterval: 3000,
  });

  const unreadCount = msgData.messages?.length || 0;

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleConversation = (clientId: string, conversationId: string) => {
    navigate(`/chat?clientId=${clientId}`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notifications-bell"
        >
          <MessageCircle className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-white flex items-center justify-center text-xs font-semibold rounded-full shadow-md"
              data-testid="badge-unread-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="bg-background rounded-lg overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b bg-slate-50 dark:bg-slate-900/50">
            <h3 className="font-semibold text-sm">Mensagens</h3>
            {unreadCount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{unreadCount} não lida{unreadCount > 1 ? 's' : ''}</p>
            )}
          </div>

          {/* Content */}
          {isLoading && unreadCount === 0 ? (
            <div className="p-8 text-center">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando...</p>
            </div>
          ) : unreadCount === 0 ? (
            <div className="p-8 text-center">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm text-muted-foreground">Sem mensagens não lidas</p>
            </div>
          ) : (
            <ScrollArea className="h-80">
              <div className="space-y-2 p-2">
                {msgData.messages?.map((msg: UnreadMessage) => (
                  <div
                    key={msg.messageId}
                    className="p-2 rounded-md border border-slate-200 dark:border-slate-200/20 bg-white dark:bg-slate-950 hover-elevate transition-colors"
                    data-testid={`message-notification-${msg.messageId}`}
                  >
                    <div className="flex items-start gap-2">
                      <Avatar className="h-6 w-6 flex-shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                          {getInitials(msg.clientName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-xs truncate">{msg.clientName}</p>
                          <p className="text-xs text-muted-foreground flex-shrink-0">
                            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: false, locale: ptBR })}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{msg.conteudo}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleConversation(msg.clientId, msg.conversationId)}
                      data-testid={`button-conversar-${msg.messageId}`}
                      className="mt-1.5 px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded hover-elevate transition-colors"
                    >
                      Conversar
                    </button>
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
