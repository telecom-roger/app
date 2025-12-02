import { useState } from "react";
import { MessageCircle, ChevronDown, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UnreadMessage {
  messageId: string;
  conteudo: string;
  createdAt: string;
  conversationId: string;
  clientId: string;
  clientName: string;
  clientPhone?: string;
}

interface UnreadMessagesResponse {
  messages: UnreadMessage[];
  hasMore: boolean;
  total: number;
  offset: number;
  limit: number;
}

export function MessagesNotificationBell() {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [, navigate] = useLocation();
  const limit = 30;

  const { data: msgData = { messages: [], hasMore: false, total: 0, offset: 0, limit: 30 } as UnreadMessagesResponse, isLoading } = useQuery<UnreadMessagesResponse>({
    queryKey: ["/api/unread-messages", offset],
    refetchInterval: 5000,
  });

  const totalMessages = msgData.messages?.length || 0;
  const showCount = Math.min(totalMessages, limit);

  const handleConversation = (clientId: string, conversationId: string) => {
    navigate(`/chat?clientId=${clientId}`);
    setOpen(false);
    setOffset(0);
  };

  const handleLoadMore = () => {
    setOffset(offset + limit);
  };

  const handleReset = () => {
    setOffset(0);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-messages-notifications"
        >
          <MessageCircle className="h-5 w-5" />
          {totalMessages > 0 && (
            <span
              className="absolute -top-1 -right-1 h-5 w-5 bg-blue-600 text-white flex items-center justify-center text-xs font-semibold rounded-full shadow-md"
              data-testid="badge-messages-unread-count"
            >
              {totalMessages > 99 ? "99+" : totalMessages}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="bg-background rounded-lg overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
            <h3 className="font-semibold text-sm">Mensagens não lidas</h3>
            {showCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {showCount} {showCount === 1 ? "mensagem" : "mensagens"}
              </span>
            )}
          </div>

          {/* Content */}
          {isLoading && totalMessages === 0 ? (
            <div className="p-8 text-center">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando...</p>
            </div>
          ) : totalMessages === 0 ? (
            <div className="p-8 text-center">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm text-muted-foreground">Nenhuma mensagem não lida</p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-96">
                <div className="space-y-2 p-2">
                  {msgData.messages?.map((msg: UnreadMessage) => (
                    <div
                      key={msg.messageId}
                      className="p-3 rounded-md border border-blue-200/50 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/30 hover-elevate transition-colors"
                      data-testid={`message-notification-${msg.messageId}`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                            {getInitials(msg.clientName)}
                          </AvatarFallback>
                        </Avatar>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <p className="font-semibold text-sm truncate">{msg.clientName}</p>
                            <p className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                              {formatDistanceToNow(new Date(msg.createdAt), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {msg.conteudo}
                          </p>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="mt-2 flex justify-end">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleConversation(msg.clientId, msg.conversationId)}
                          data-testid={`button-conversar-${msg.messageId}`}
                          className="h-7 text-xs"
                        >
                          Conversar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Load More Button */}
              {msgData?.hasMore && (
                <div className="px-3 py-2 border-t bg-slate-50/50 dark:bg-slate-900/30 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadMore}
                    className="flex-1 h-8 text-xs"
                    data-testid="button-load-more-messages"
                  >
                    Carregar mais
                  </Button>
                  {offset > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReset}
                      className="flex-1 h-8 text-xs"
                      data-testid="button-reset-messages"
                    >
                      Voltar
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
