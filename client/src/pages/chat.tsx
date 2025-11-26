import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Send, Phone, MessageSquare, Search, X, Paperclip, Image as ImageIcon, Music, File, Mic, StopCircle, Download, Plus } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Message {
  id: string;
  conversationId: string;
  conteudo: string;
  sender: "user" | "client";
  tipo: string;
  createdAt: string;
  lido?: boolean;
  arquivo?: string;
  nomeArquivo?: string;
  mimeType?: string;
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

interface QuickReply {
  id: string;
  conteudo: string;
  ordem: number;
}

export default function Chat() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  const { data: quickReplies = [] } = useQuery<QuickReply[]>({
    queryKey: ["/api/quick-replies"],
    refetchInterval: 10000,
  });

  // Fetch all conversations for current user
  const { data: conversations = [], isLoading: conversationsLoading, refetch: refetchConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/chat/conversations"],
    refetchInterval: 500, // Poll a cada 500ms para atualização rápida
    staleTime: 0, // Força sempre buscar dados frescos do backend
    gcTime: 5000, // Cache por 5 segundos apenas
  });

  // Fetch all clients for search
  const { data: clients = [], isLoading: clientsLoading, refetch: refetchClients } = useQuery<Client[]>({
    queryKey: ["/api/clients/whatsapp-list"],
    refetchInterval: 10000, // Atualiza a cada 10s para pegar mudanças
  });

  // Fetch messages for selected conversation (MUST BE BEFORE WebSocket useEffect that uses refetchMessages)
  const { data: messages = [], isLoading: messagesLoading, refetch: refetchMessages } = useQuery<Message[]>({
    queryKey: selectedConversationId ? ["/api/chat/messages", selectedConversationId] : [],
    enabled: !!selectedConversationId,
    refetchInterval: 500, // Também reduzido para 500ms
  });

  // WebSocket para notificações em tempo real de novas mensagens
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/api/chat/ws`
    );

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_message") {
          console.log("📬 Nova mensagem recebida em tempo real:", data);
          refetchConversations();
          // Se está na conversa que recebeu a mensagem, refetch mensagens também
          if (selectedConversationId === data.conversationId) {
            refetchMessages();
          }
        }
      } catch (e) {
        console.error("Erro ao processar WebSocket:", e);
      }
    };

    ws.onerror = (error) => {
      console.log("⚠️ WebSocket desconectado, usando polling");
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [selectedConversationId, refetchConversations, refetchMessages]);

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

  // Mark messages as read when conversation is selected
  const markAsReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const res = await apiRequest("PATCH", `/api/chat/messages/${conversationId}/mark-read`, {});
      return res.json();
    },
    onSuccess: () => {
      if (selectedConversationId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/chat/messages", selectedConversationId],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/chat/conversations"],
        });
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
    mutationFn: async (payload: any) => {
      if (!selectedConversationId) return;
      if (typeof payload === "string") {
        payload = { conteudo: payload, tipo: "texto" };
      }
      const res = await apiRequest("POST", `/api/chat/messages/${selectedConversationId}`, payload);
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
    refetchClients(); // Força atualização de cache antes de criar conversa
    getConversationMutation.mutate(phone);
  };

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
  };

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedConversationId) return;
    sendMutation.mutate(messageText);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversationId) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const tipo = file.type.startsWith("image/") ? "imagem" : 
                   file.type.startsWith("audio/") ? "audio" : "documento";
      
      sendMutation.mutate({ arquivo: base64, tipo, nomeArquivo: file.name, tamanho: file.size, mimeType: file.type } as any);
    };
    reader.readAsDataURL(file);
    
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          sendMutation.mutate({ 
            arquivo: base64, 
            tipo: "audio",
            conteudo: "",
            nomeArquivo: `audio_${Date.now()}.opus`, 
            tamanho: blob.size, 
            mimeType: "audio/webm" 
          } as any);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      toast({ title: "Gravando áudio...", variant: "default" });
    } catch (error: any) {
      toast({
        title: "Erro ao acessar microfone",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  const handleSelectQuickReply = (reply: string) => {
    setMessageText(reply);
    setShowQuickReplies(false);
  };

  return (
    <div className="flex h-full bg-background">
      {/* Left Sidebar - Conversations List */}
      <div className="w-full md:w-96 lg:w-2/5 flex flex-col border-r border-border bg-card">
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
                          {(conv.unreadCount ?? 0) > 0 && conv.unreadCount && (
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
                <SiWhatsapp className="h-5 w-5 text-green-500" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {selectedConversation.client?.razaoSocial || selectedConversation.client?.nome || "Contato"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedConversation.client?.CELULAR_PRINCIPAL || selectedConversation.client?.telefone}
                  </p>
                </div>
              </div>
              <Popover open={showQuickReplies} onOpenChange={setShowQuickReplies}>
                <PopoverTrigger asChild>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    data-testid="button-quick-replies"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="end">
                  {quickReplies.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nenhuma mensagem configurada. Vá a Configurações para adicionar.
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-80 overflow-y-auto">
                      {quickReplies.map((reply: QuickReply) => (
                        <button
                          key={reply.id}
                          onClick={() => handleSelectQuickReply(reply.conteudo)}
                          className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors break-words"
                          data-testid={`button-quick-reply-${reply.id}`}
                          title={reply.conteudo}
                        >
                          {reply.conteudo.substring(0, 60)}
                          {reply.conteudo.length > 60 ? "..." : ""}
                        </button>
                      ))}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              {(selectedConversation.unreadCount ?? 0) > 0 && selectedConversation.unreadCount && (
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
                        {msg.tipo === "texto" && <p className="text-sm">{msg.conteudo}</p>}
                        
                        {msg.tipo === "imagem" && msg.arquivo && (
                          <button
                            onClick={() => setSelectedImage(msg.arquivo!)}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                            data-testid={`button-open-image-${msg.id}`}
                          >
                            <img src={msg.arquivo} alt="Imagem" className="max-w-xs rounded max-h-64 object-cover" />
                          </button>
                        )}
                        
                        {msg.tipo === "audio" && msg.arquivo && (
                          <div className="w-48">
                            <audio controls className="w-full h-8 rounded-full">
                              <source src={msg.arquivo} type={msg.mimeType} />
                            </audio>
                          </div>
                        )}
                        
                        {msg.tipo === "documento" && msg.arquivo && (
                          <button
                            onClick={() => {
                              const link = document.createElement("a");
                              link.href = msg.arquivo!;
                              link.download = msg.nomeArquivo || "documento";
                              link.click();
                            }}
                            className="flex items-center gap-2 text-sm hover:underline cursor-pointer"
                            data-testid={`button-download-document-${msg.id}`}
                          >
                            <File className="h-4 w-4" />
                            {msg.nomeArquivo}
                          </button>
                        )}
                        
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

      {/* Image Viewer Modal */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-2xl p-0 bg-black border-0">
          <div className="relative w-full h-auto flex items-center justify-center">
            {selectedImage && (
              <>
                <img src={selectedImage} alt="Imagem expandida" className="max-w-full max-h-[80vh] object-contain" />
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-4 right-4 bg-black/50 hover:bg-black/70"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = selectedImage;
                    link.download = `imagem_${Date.now()}.jpg`;
                    link.click();
                  }}
                  data-testid="button-download-image"
                >
                  <Download className="h-5 w-5 text-white" />
                </Button>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-4 left-4 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
                  data-testid="button-close-image"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

            {/* Input */}
            <div className="p-6 border-t border-border bg-card flex gap-3 items-end">
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
                className="h-12 text-base"
              />
              <input
                type="file"
                id="file-upload"
                onChange={handleFileUpload}
                className="hidden"
                data-testid="input-file-upload"
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => document.getElementById("file-upload")?.click()}
                disabled={sendMutation.isPending || isRecording}
                data-testid="button-file-upload"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant={isRecording ? "destructive" : "ghost"}
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                disabled={sendMutation.isPending}
                data-testid="button-voice-record"
              >
                {isRecording ? (
                  <StopCircle className="h-4 w-4 animate-pulse" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
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
