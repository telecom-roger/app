import { useState, useEffect } from "react";
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
  conteudo: string;
  sender: "user" | "client";
  tipo: string;
  createdAt: string;
  lido?: boolean;
}

interface Conversation {
  id: string;
  clientId: string;
  userId: string;
  canal: string;
  assunto?: string;
  ativa: boolean;
  ultimaMensagem?: string;
  ultimaMensagemEm?: string;
  createdAt: string;
  unreadCount?: number;
  client?: {
    id: string;
    nome: string;
    razaoSocial?: string;
    CELULAR_PRINCIPAL?: string;
    telefone: string;
  };
}

interface Client {
  id: string;
  nome: string;
  razaoSocial?: string;
  cpfCnpj?: string;
  telefone: string;
  CELULAR_PRINCIPAL?: string;
}

export default function Chat() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Fetch all conversations for current user
  const { data: conversations = [], isLoading: conversationsLoading, refetch: refetchConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/chat/conversations"],
    refetchInterval: 3000,
  });

  // Fetch all clients for search
  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients/whatsapp-list"],
    refetchInterval: false,
  });

  // Filter clients by search term
  const filteredClients = searchTerm.trim()
    ? clients.filter((client: Client) => {
        const term = searchTerm.toLowerCase();
        const nome = client.nome?.toLowerCase() || "";
        const razao = client.razaoSocial?.toLowerCase() || "";
        const cnpj = client.cpfCnpj?.toLowerCase() || "";
        const cel = (client.CELULAR_PRINCIPAL || client.telefone)?.toLowerCase() || "";
        
        return (
          nome.includes(term) ||
          razao.includes(term) ||
          cnpj.includes(term) ||
          cel.includes(term)
        );
      })
    : [];

  // Sort conversations by last message date (most recent first)
  const sortedConversations = [...conversations].sort((a, b) => {
    const aTime = a.ultimaMensagemEm ? new Date(a.ultimaMensagemEm).getTime() : 0;
    const bTime = b.ultimaMensagemEm ? new Date(b.ultimaMensagemEm).getTime() : 0;
    return bTime - aTime;
  });

  // Get or create conversation by phone
  const getConversationMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await apiRequest("POST", "/api/chat/conversation-by-phone", {
        phone,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setSelectedConversationId(data.id);
      setSearchTerm("");
      setShowSearchResults(false);
      refetchConversations();
      toast({ title: "Conversa carregada", variant: "default" });
    },
    onError: (error: any) => {
      console.error("❌ Erro ao carregar conversa:", error);
      toast({
        title: "Erro ao carregar conversa",
        description: error.message || "Cliente não encontrado",
        variant: "destructive",
      });
    },
  });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: messagesLoading, refetch: refetchMessages } = useQuery<Message[]>({
    queryKey: selectedConversationId ? ["/api/chat/messages", selectedConversationId] : [],
    enabled: !!selectedConversationId,
    refetchInterval: 3000,
  });

  // Mark messages as read when conversation is selected
  const markAsReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const res = await apiRequest("PATCH", `/api/chat/messages/${conversationId}/mark-read`, {});
      return res.json();
    },
    onSuccess: () => {
      if (selectedConversationId) {
        refetchMessages();
        refetchConversations();
      }
    },
  });

  // Auto mark as read when conversation is opened
  useEffect(() => {
    if (selectedConversationId) {
      markAsReadMutation.mutate(selectedConversationId);
    }
  }, [selectedConversationId]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedConversationId) return;
      const res = await apiRequest("POST", `/api/chat/messages/${selectedConversationId}`, {
        conteudo: content,
        tipo: "texto",
      });
      return res.json();
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({
        queryKey: selectedConversationId ? ["/api/chat/messages", selectedConversationId] : [],
      });
      refetchConversations();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    },
  });

  const handleSelectClient = (client: Client) => {
    const phone = client.CELULAR_PRINCIPAL || client.telefone;
    getConversationMutation.mutate(phone);
  };

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
  };

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedConversationId) return;
    sendMutation.mutate(messageText);
  };

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  return (
    <div className="flex h-full bg-background">
      {/* Left Sidebar - Conversations List */}
      <div className="w-80 flex flex-col border-r border-border bg-card">
        {/* Search Input */}
        <div className="p-4 space-y-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSearchResults(e.target.value.trim().length > 0);
              }}
              className="pl-9"
              data-testid="input-search-client"
            />
          </div>
        </div>

        {/* Search Results or Conversations List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {showSearchResults && searchTerm.trim() !== "" ? (
              // Search results
              <>
                {clientsLoading ? (
                  <div className="flex items-center justify-center h-20">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">
                    Nenhum cliente encontrado
                  </p>
                ) : (
                  filteredClients.map((client: Client) => (
                    <button
                      key={client.id}
                      onClick={() => handleSelectClient(client)}
                      className="w-full text-left p-3 rounded-lg transition-colors hover:bg-muted mb-2"
                      data-testid={`button-search-client-${client.id}`}
                    >
                      <p className="text-sm font-medium truncate">{client.nome}</p>
                      {client.razaoSocial && (
                        <p className="text-xs text-muted-foreground truncate">
                          {client.razaoSocial}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground truncate">
                        {client.CELULAR_PRINCIPAL || client.telefone}
                      </p>
                    </button>
                  ))
                )}
              </>
            ) : (
              // Conversations list
              <>
                {conversationsLoading ? (
                  <div className="flex items-center justify-center h-20">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : sortedConversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">
                    Nenhuma conversa ainda
                  </p>
                ) : (
                  sortedConversations.map((conv: Conversation) => (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      className={`w-full text-left p-3 rounded-lg transition-colors mb-1 hover:bg-muted ${
                        selectedConversationId === conv.id
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground"
                      }`}
                      data-testid={`button-conversation-${conv.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {conv.client?.razaoSocial || conv.client?.nome || "Contato desconhecido"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {conv.client?.CELULAR_PRINCIPAL || conv.client?.telefone || "Sem telefone"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          {conv.unreadCount && conv.unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[24px] h-6 flex items-center justify-center">
                              {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                            </span>
                          )}
                          {conv.ultimaMensagemEm && (
                            <p className="text-xs text-muted-foreground">
                              {new Date(conv.ultimaMensagemEm).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                      {conv.ultimaMensagem && (
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {conv.ultimaMensagem}
                        </p>
                      )}
                    </button>
                  ))
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - Messages */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-2 p-4 border-b border-border bg-card justify-between">
              <div className="flex items-center gap-2 flex-1">
                <Phone className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {selectedConversation.client?.razaoSocial || selectedConversation.client?.nome || "Contato"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedConversation.client?.CELULAR_PRINCIPAL || selectedConversation.client?.telefone}
                  </p>
                </div>
              </div>
              {selectedConversation.unreadCount && selectedConversation.unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[28px] h-7 flex items-center justify-center">
                  {selectedConversation.unreadCount > 99 ? "99+" : selectedConversation.unreadCount}
                </span>
              )}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
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
                        msg.sender === "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                      data-testid={`message-${msg.id}`}
                    >
                      <div
                        className={`max-w-xs px-4 py-2 rounded-lg ${
                          msg.sender === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        <p className="text-sm">{msg.conteudo}</p>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className="text-xs opacity-70">
                            {new Date(msg.createdAt).toLocaleTimeString("pt-BR")}
                          </p>
                          {msg.sender === "user" && (
                            <span className="text-xs">
                              {msg.lido ? "✓✓" : "✓"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-border bg-card flex gap-2">
              <Input
                placeholder="Digite uma mensagem..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
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
          <Card className="flex items-center justify-center h-full m-4">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Selecione uma conversa ou busque um cliente
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
