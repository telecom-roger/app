import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Phone, MessageSquare, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  conversationId: string;
  conteudo: string;
  sender: "user" | "client";
  tipo: string;
  createdAt: string;
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
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");

  // Fetch all clients once (filtering happens on frontend)
  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients/whatsapp-list"],
    refetchInterval: false,
  });

  // Filter clients by search term (nome, razão social, CNPJ, celular)
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

  // Get or create conversation by phone
  const getConversationMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await apiRequest("POST", "/api/chat/conversation-by-phone", {
        phone,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      console.log("✅ Conversa recebida do servidor:", data);
      setSelectedConversationId(data.id);
      toast({ title: "Conversa carregada", variant: "default" });
    },
    onError: (error: any) => {
      console.error("❌ Erro ao carregar conversa:", error);
      toast({
        title: "Erro ao carregar conversa",
        description: error.message || "Cliente não encontrado",
        variant: "destructive",
      });
      setSelectedPhone(null);
    },
  });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: selectedConversationId ? ["/api/chat/messages", selectedConversationId] : [],
    enabled: !!selectedConversationId,
    refetchInterval: 3000,
  });

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

  const handleSelectClient = (client: Client) => {
    const phone = client.CELULAR_PRINCIPAL || client.telefone;
    setSelectedClientId(client.id);
    setSelectedClientName(client.nome);
    setSelectedPhone(phone);
    setSearchTerm("");
    // Load or create conversation by phone
    getConversationMutation.mutate(phone);
  };

  const handleSendMessage = () => {
    console.log(`🔵 handleSendMessage: text="${messageText.trim()}", convId="${selectedConversationId}"`);
    if (!messageText.trim()) {
      console.log(`❌ Sem texto`);
      return;
    }
    if (!selectedConversationId) {
      console.log(`❌ Sem conversationId`);
      return;
    }
    console.log(`✅ Enviando: ${messageText}`);
    sendMutation.mutate(messageText);
  };

  const handleStartConversation = () => {
    if (!selectedConversationId) {
      toast({
        title: "Aguarde",
        description: "Carregando conversa...",
        variant: "default",
      });
      return;
    }
    // Send initial greeting message
    sendMutation.mutate("Olá! Como vai?");
  };

  return (
    <div className="flex h-full gap-4 p-4 bg-background">
      {/* Search and Clients List */}
      <div className="w-80 flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-foreground">Buscar Cliente</h2>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nome, CNPJ ou celular..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-client"
          />
        </div>

        {/* Clients List */}
        <ScrollArea className="flex-1 border rounded-lg bg-card">
          <div className="p-4 space-y-2">
            {searchTerm.trim() === "" ? (
              <p className="text-sm text-muted-foreground">
                Digite para buscar um cliente
              </p>
            ) : clientsLoading ? (
              <div className="flex items-center justify-center h-20">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filteredClients.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum cliente encontrado
              </p>
            ) : (
              filteredClients.map((client: Client) => (
                <button
                  key={client.id}
                  onClick={() => handleSelectClient(client)}
                  className={`w-full text-left p-3 rounded-lg transition-colors hover:bg-muted ${
                    selectedClientId === client.id
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground"
                  }`}
                  data-testid={`button-client-${client.id}`}
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
          </div>
        </ScrollArea>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col gap-4">
        {selectedPhone ? (
          <>
            <div className="flex items-center gap-2 p-3 bg-card border rounded-lg justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Phone className="h-5 w-5 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {selectedClientName}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedPhone}</p>
                </div>
              </div>
              <Button
                size="icon"
                variant="outline"
                onClick={handleStartConversation}
                disabled={sendMutation.isPending || getConversationMutation.isPending || !selectedConversationId}
                data-testid="button-start-conversation"
              >
                {sendMutation.isPending || getConversationMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "+"
                )}
              </Button>
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
                placeholder={selectedConversationId ? "Digite uma mensagem..." : "Selecione um cliente..."}
                value={messageText}
                onChange={(e) => {
                  setMessageText(e.target.value);
                  console.log(`📝 Digitando: "${e.target.value}", convId: ${selectedConversationId}`);
                }}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={!selectedConversationId || sendMutation.isPending}
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
                Busque e selecione um cliente para começar
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
