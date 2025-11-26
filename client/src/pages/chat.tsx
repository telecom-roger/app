import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Phone, MessageSquare, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  conversationId: string;
  content: string;
  fromPhoneNumber: string;
  toPhoneNumber: string;
  direction: "inbound" | "outbound";
  createdAt: string;
}

interface Conversation {
  id: string;
  phoneNumber: string;
  lastMessage: string;
  lastMessageAt: string;
}

export default function Chat() {
  const { toast } = useToast();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch conversations with search filter
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/chat/conversations", searchTerm],
    refetchInterval: 5000,
  });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: selectedPhone ? ["/api/chat/messages", selectedPhone] : [],
    enabled: !!selectedPhone,
    refetchInterval: 3000,
  });

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedPhone) return;
      return apiRequest("POST", "/api/chat/messages", {
        toPhoneNumber: selectedPhone,
        content,
      });
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({
        queryKey: selectedPhone ? ["/api/chat/messages", selectedPhone] : [],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      toast({ title: "Mensagem enviada", variant: "default" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedPhone) return;
    sendMutation.mutate(messageText);
  };

  return (
    <div className="flex h-full gap-4 p-4 bg-background">
      {/* Conversations List */}
      <div className="w-64 flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-foreground">Conversas</h2>
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-8"
            data-testid="input-search-conversation"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
              data-testid="button-clear-search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <ScrollArea className="flex-1 border rounded-lg bg-card">
          <div className="p-4 space-y-2">
            {conversationsLoading ? (
              <div className="flex items-center justify-center h-20">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma conversa</p>
            ) : (
              conversations.map((conv: Conversation) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedPhone(conv.phoneNumber)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedPhone === conv.phoneNumber
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-foreground"
                  }`}
                  data-testid={`button-conversation-${conv.phoneNumber}`}
                >
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {conv.phoneNumber}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {conv.lastMessage}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col gap-4">
        {selectedPhone ? (
          <>
            <div className="flex items-center gap-2 p-3 bg-card border rounded-lg">
              <Phone className="h-5 w-5 text-primary" />
              <span className="font-medium text-foreground">{selectedPhone}</span>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 border rounded-lg bg-card p-4">
              <div className="space-y-3 flex flex-col">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-20">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma mensagem ainda
                  </p>
                ) : (
                  messages.map((msg: Message) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.direction === "outbound"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                      data-testid={`message-${msg.id}`}
                    >
                      <div
                        className={`max-w-xs px-4 py-2 rounded-lg ${
                          msg.direction === "outbound"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(msg.createdAt).toLocaleTimeString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="flex gap-2">
              <Input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Digite sua mensagem..."
                onKeyPress={(e) =>
                  e.key === "Enter" && !e.shiftKey && handleSendMessage()
                }
                disabled={sendMutation.isPending}
                data-testid="input-message"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!messageText.trim() || sendMutation.isPending}
                size="icon"
                data-testid="button-send-message"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </>
        ) : (
          <Card className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Selecione uma conversa para começar
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
