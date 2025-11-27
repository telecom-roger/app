import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Send, Phone, MessageSquare, Search, X, Paperclip, Image as ImageIcon, Music, File, Mic, StopCircle, Download, Plus, Info } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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

// Function to render text with clickable links
const renderTextWithLinks = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:opacity-80 transition-opacity font-medium"
          data-testid={`link-${index}`}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

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
    tags?: string[];
  };
}

interface Client {
  id: string;
  nome: string;
  razaoSocial?: string;
  cpfCnpj?: string;
  telefone: string;
  CELULAR_PRINCIPAL?: string;
  tags?: string[];
}

interface QuickReply {
  id: string;
  conteudo: string;
  ordem: number;
}

interface ClientNote {
  id: string;
  conteudo: string;
  cor: string;
  createdAt: string;
}

interface Tag {
  id: string;
  nome: string;
  cor: string;
  createdAt: string;
}

export default function Chat() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<{ base64: string; blob: Blob } | null>(null);
  const shouldDiscardAudioRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteColor, setNoteColor] = useState("bg-blue-500");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [closedConversations, setClosedConversations] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("closedConversations");
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  });
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [contextMenuConvId, setContextMenuConvId] = useState<string | null>(null);
  const [showClientInfo, setShowClientInfo] = useState(false);
  const [businessValue, setBusinessValue] = useState<string>("");

  // Persist closed conversations to localStorage
  useEffect(() => {
    localStorage.setItem("closedConversations", JSON.stringify(Array.from(closedConversations)));
  }, [closedConversations]);

  const { data: quickReplies = [] } = useQuery<QuickReply[]>({
    queryKey: ["/api/quick-replies"],
    refetchInterval: 10000,
  });

  // Fetch predefined tags
  const { data: allTags = [] } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
    refetchInterval: 5000,
  });

  // Fetch all conversations for current user
  const { data: conversations = [], isLoading: conversationsLoading, refetch: refetchConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/chat/conversations"],
    refetchInterval: 500, // Poll a cada 500ms para atualização rápida
    staleTime: 0, // Força sempre buscar dados frescos do backend
    gcTime: 5000, // Cache por 5 segundos apenas
  });

  // Get the current conversation's client ID
  const selectedConversation = conversations.find(c => c.id === selectedConversationId);
  const currentClientId = selectedConversation?.clientId;

  // Fetch client notes for selected conversation
  const { data: clientNotes = [], isLoading: notesLoading, refetch: refetchNotes } = useQuery<ClientNote[]>({
    queryKey: currentClientId ? ["/api/client-notes", currentClientId] : [],
    enabled: !!currentClientId,
  });

  // Fetch all clients for search
  const { data: clients = [], isLoading: clientsLoading, refetch: refetchClients } = useQuery<Client[]>({
    queryKey: ["/api/clients/whatsapp-list"],
    refetchInterval: 2000, // Atualiza a cada 2s para pegar mudanças rapidamente
    staleTime: 0, // Sempre considerar dados como stale
    gcTime: 0, // Não cachear dados
    refetchOnWindowFocus: true, // Refetch quando voltar a janela
  });

  // Fetch detailed client info when selected
  const { data: detailedClient = null, isLoading: clientDetailLoading } = useQuery<any>({
    queryKey: currentClientId ? ["/api/clients", currentClientId] : [],
    enabled: !!currentClientId,
  });

  // Fetch WhatsApp sessions to check connection status
  const { data: whatsappSessions = [] } = useQuery<any[]>({
    queryKey: ["/api/whatsapp/sessions"],
    refetchInterval: 3000, // Verifica a cada 3s
  });

  // Check if WhatsApp is connected
  const isWhatsappConnected = whatsappSessions.length > 0 && whatsappSessions.some(s => s.status === "conectada");

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

  // Scroll to bottom when messages change or conversation is selected
  useEffect(() => {
    if (messagesEndRef.current && (messages.length > 0 || selectedConversationId)) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, selectedConversationId]);

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
  const sortedConversations = [...conversations]
    .filter(conv => {
      // Filter out closed conversations
      if (closedConversations.has(conv.id)) {
        return false;
      }
      // If a tag is selected, only show conversations with that tag
      if (selectedTag && conv.client?.tags) {
        return (conv.client.tags as string[]).includes(selectedTag);
      }
      return true;
    })
    .sort((a, b) => {
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
      // Refetch conversations in background without blocking
      setTimeout(() => refetchConversations(), 0);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    },
    retry: 0,
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
    
    // Check if WhatsApp is connected
    if (!isWhatsappConnected) {
      toast({
        title: "WhatsApp desconectado",
        description: "Conecte uma sessão do WhatsApp antes de enviar mensagens",
        variant: "destructive",
      });
      return;
    }
    
    sendMutation.mutate(messageText);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversationId) return;

    // Check if WhatsApp is connected
    if (!isWhatsappConnected) {
      toast({
        title: "WhatsApp desconectado",
        description: "Conecte uma sessão do WhatsApp antes de enviar arquivos",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }

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
    // Check if WhatsApp is connected
    if (!isWhatsappConnected) {
      toast({
        title: "WhatsApp desconectado",
        description: "Conecte uma sessão do WhatsApp antes de enviar áudio",
        variant: "destructive",
      });
      return;
    }

    // Clear any previous recording and reset discard flag
    setRecordedAudio(null);
    shouldDiscardAudioRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        // Check if user discarded before recording finished
        if (shouldDiscardAudioRef.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        const blob = new Blob(chunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = (event) => {
          // Double check if user discarded during file reading
          if (shouldDiscardAudioRef.current) {
            return;
          }
          
          const base64 = event.target?.result as string;
          setRecordedAudio({ base64, blob });
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
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

  const handleSendRecordedAudio = () => {
    if (!recordedAudio) return;
    
    sendMutation.mutate({ 
      arquivo: recordedAudio.base64, 
      tipo: "audio",
      conteudo: "",
      nomeArquivo: `audio_${Date.now()}.opus`, 
      tamanho: recordedAudio.blob.size, 
      mimeType: "audio/webm" 
    } as any);
    
    setRecordedAudio(null);
  };

  const handleDiscardRecordedAudio = () => {
    shouldDiscardAudioRef.current = true;
    setRecordedAudio(null);
  };

  // Add tag to client mutation
  const addTagMutation = useMutation({
    mutationFn: async (tagName: string) => {
      if (!currentClientId) return;
      const valorEstimado = businessValue ? parseInt(businessValue.replace(/\D/g, "")) * 100 : 0;
      const res = await apiRequest("POST", `/api/clients/${currentClientId}/tags`, { tagName, valorEstimado });
      return res.json();
    },
    onSuccess: () => {
      refetchConversations();
      setShowNoteInput(false);
      setBusinessValue("");
      toast({ title: "Etiqueta adicionada e oportunidade criada", variant: "default" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao adicionar etiqueta", description: error.message, variant: "destructive" });
    },
  });

  // Remove tag from client mutation
  const removeTagMutation = useMutation({
    mutationFn: async (tagName: string) => {
      if (!currentClientId) return;
      const res = await apiRequest("DELETE", `/api/clients/${currentClientId}/tags/${tagName}`, {});
      return res.json();
    },
    onSuccess: () => {
      refetchConversations();
      toast({ title: "Etiqueta removida", variant: "default" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao remover etiqueta", description: error.message, variant: "destructive" });
    },
  });

  const handleDeleteTag = (tagName: string) => {
    removeTagMutation.mutate(tagName);
  };

  const handleSelectQuickReply = (reply: string) => {
    setMessageText(reply);
    setShowQuickReplies(false);
  };

  return (
    <div className="flex h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Left Sidebar - Conversations List */}
      <div className="w-full md:w-96 lg:w-2/5 flex flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
        {/* Search Input */}
        <div className="p-4 space-y-3 border-b border-slate-200 dark:border-slate-700">
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

        {/* Tag Filter Section */}
        {!showSearchResults && allTags.length > 0 && (
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 space-y-2">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">FILTRAR POR ETIQUETA</p>
            <div className="flex flex-wrap gap-1">
              <Button
                variant={selectedTag === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTag(null)}
                data-testid="button-filter-all-tags"
                className="h-7 px-2 text-xs rounded-full"
              >
                Todas
              </Button>
              {allTags.map((tag) => (
                <Button
                  key={tag.id}
                  variant={selectedTag === tag.nome ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTag(tag.nome)}
                  data-testid={`button-filter-tag-${tag.id}`}
                  className={`h-7 px-2 text-xs rounded-full ${
                    selectedTag === tag.nome ? `${tag.cor} border ${tag.cor.replace('bg-', 'border-')}` : ""
                  }`}
                >
                  {tag.nome}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Tags Section - for filtering and visualization */}
        {!showSearchResults && selectedConversationId && (
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 space-y-2">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">ETAPA ATUAL</p>
            {conversationsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <div className="flex flex-wrap gap-1">
                {selectedConversation?.client?.tags?.[0] ? (
                  (() => {
                    const tagName = selectedConversation.client.tags[0];
                    const tag = allTags.find(t => t.nome === tagName);
                    return (
                      <Badge className={`${tag?.cor || "bg-gray-500"} text-white`}>
                        {tagName}
                      </Badge>
                    );
                  })()
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhuma etapa</p>
                )}
              </div>
            )}
          </div>
        )}

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
                      className="w-full text-left p-3 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 mb-2"
                      data-testid={`button-search-client-${client.id}`}
                    >
                      <p className="text-sm font-medium truncate text-slate-900 dark:text-white">{client.nome}</p>
                      {client.razaoSocial && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                          {client.razaoSocial}
                        </p>
                      )}
                      <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
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
                  <p className="text-sm text-slate-600 dark:text-slate-400 p-4 text-center">
                    Nenhuma conversa ainda
                  </p>
                ) : (
                  sortedConversations.map((conv: Conversation) => {
                    const getInitials = (name: string) => {
                      return name
                        .split(" ")
                        .slice(0, 2)
                        .map(word => word[0])
                        .join("")
                        .toUpperCase();
                    };
                    const clientName = conv.client?.razaoSocial || conv.client?.nome || "Contato desconhecido";
                    const initials = getInitials(clientName);

                    const handleContextMenu = (e: React.MouseEvent) => {
                      e.preventDefault();
                      setContextMenuOpen(true);
                      setContextMenuPos({ x: e.clientX, y: e.clientY });
                      setContextMenuConvId(conv.id);
                    };

                    return (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      onContextMenu={handleContextMenu}
                      className={`w-full text-left p-3 rounded-lg transition-colors mb-1 hover:bg-purple-50 dark:hover:bg-purple-950/20 border-b border-slate-200 dark:border-slate-700 ${
                        selectedConversationId === conv.id
                          ? "bg-purple-50 dark:bg-purple-950/30 text-foreground"
                          : "text-foreground"
                      }`}
                      data-testid={`button-conversation-${conv.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Avatar className="h-8 w-8 flex-shrink-0" data-testid={`avatar-${conv.id}`}>
                            <AvatarFallback className="bg-purple-200 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-bold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex items-center gap-1 min-w-0 flex-1">
                            <p className="text-sm font-medium truncate text-slate-900 dark:text-white">
                              {clientName.length > 30
                                ? clientName.substring(0, 30) + "..."
                                : clientName}
                            </p>
                            {conv.client?.tags?.[0] && (() => {
                              const tagName = conv.client.tags[0];
                              const tag = allTags.find(t => t.nome === tagName);
                              return (
                                <div
                                  className={`w-2 h-2 rounded-full flex-shrink-0 ${tag?.cor || "bg-gray-500"}`}
                                  data-testid={`dot-tag-inline-${conv.id}`}
                                />
                              );
                            })()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          {(conv.unreadCount ?? 0) > 0 && conv.unreadCount && (
                            <span className="bg-primary text-white text-xs font-bold rounded-full min-w-[24px] h-6 flex items-center justify-center">
                              {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                            </span>
                          )}
                          {conv.ultimaMensagemEm && (
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              {new Date(conv.ultimaMensagemEm).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0 ml-10">
                          <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                            {conv.client?.CELULAR_PRINCIPAL || conv.client?.telefone || "Sem telefone"}
                          </p>
                          {conv.ultimaMensagem && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-1">
                              {conv.ultimaMensagem.length > 50
                                ? conv.ultimaMensagem.substring(0, 50) + "..."
                                : conv.ultimaMensagem}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                    );
                  })
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Context Menu */}
        {contextMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setContextMenuOpen(false)}
              onContextMenu={(e) => e.preventDefault()}
            />
            <div
              className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg py-1"
              style={{
                left: `${contextMenuPos.x}px`,
                top: `${contextMenuPos.y}px`,
              }}
            >
              <button
                onClick={() => {
                  if (contextMenuConvId) {
                    setClosedConversations(prev => new Set([...prev, contextMenuConvId]));
                    if (selectedConversationId === contextMenuConvId) {
                      setSelectedConversationId(null);
                    }
                  }
                  setContextMenuOpen(false);
                  toast({
                    title: "Conversa fechada",
                    description: "A conversa foi fechada, mas continua no banco de dados",
                  });
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-900 dark:text-white"
                data-testid="button-close-conversation"
              >
                Fechar conversa
              </button>
            </div>
          </>
        )}
      </div>

      {/* Right Panel - Messages */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-800">
        {selectedConversation ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-2 p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 justify-between">
              <div className="flex items-center gap-2 flex-1">
                <SiWhatsapp className="h-5 w-5 text-green-500" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {selectedConversation.client?.tags?.[0] && (() => {
                      const tagName = selectedConversation.client.tags[0];
                      const tag = allTags.find(t => t.nome === tagName);
                      return (
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${tag?.cor || "bg-gray-500"}`}
                          data-testid={`dot-tag-header-${selectedConversation.id}`}
                        />
                      );
                    })()}
                    <p className="font-medium text-slate-900 dark:text-white truncate">
                      {(selectedConversation.client?.razaoSocial || selectedConversation.client?.nome || "Contato").length > 30
                        ? (selectedConversation.client?.razaoSocial || selectedConversation.client?.nome || "Contato").substring(0, 30) + "..."
                        : selectedConversation.client?.razaoSocial || selectedConversation.client?.nome || "Contato"}
                    </p>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {selectedConversation.client?.CELULAR_PRINCIPAL || selectedConversation.client?.telefone}
                  </p>
                </div>
              </div>
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => setShowClientInfo(true)}
                data-testid="button-client-info"
              >
                <Info className="h-5 w-5" />
              </Button>
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
                    <p className="text-xs text-slate-600 dark:text-slate-400 text-center py-4">
                      Nenhuma mensagem configurada. Vá a Configurações para adicionar.
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-80 overflow-y-auto">
                      {quickReplies.map((reply: QuickReply) => (
                        <button
                          key={reply.id}
                          onClick={() => handleSelectQuickReply(reply.conteudo)}
                          className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors break-words text-slate-900 dark:text-white"
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
                <span className="bg-primary text-white text-xs font-bold rounded-full min-w-[28px] h-7 flex items-center justify-center">
                  {selectedConversation.unreadCount > 99 ? "99+" : selectedConversation.unreadCount}
                </span>
              )}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
              <div className="space-y-3 flex flex-col">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-20">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-600 dark:text-slate-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400 text-center py-8">
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
                        className={`max-w-xs px-3 py-2 rounded-lg shadow-sm ${
                          msg.sender === "user"
                            ? "bg-primary text-primary-foreground shadow-primary/20"
                            : "bg-muted text-foreground border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {msg.tipo === "texto" && (
                          <p className="text-sm break-words">
                            {renderTextWithLinks(msg.conteudo)}
                          </p>
                        )}
                        
                        {msg.tipo === "imagem" && msg.arquivo && (
                          <button
                            onClick={() => setSelectedImage(msg.arquivo!)}
                            className="cursor-pointer hover:opacity-90 transition-opacity rounded-md overflow-hidden"
                            data-testid={`button-open-image-${msg.id}`}
                          >
                            <img src={msg.arquivo} alt="Imagem" className="max-w-xs rounded-md max-h-56 object-cover" />
                          </button>
                        )}
                        
                        {msg.tipo === "audio" && msg.arquivo && (
                          <div className="w-48 py-0.5">
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
                            className="flex items-center gap-2 text-xs hover:underline cursor-pointer transition-opacity hover:opacity-80 p-1 rounded hover-elevate"
                            data-testid={`button-download-document-${msg.id}`}
                          >
                            <File className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{msg.nomeArquivo}</span>
                          </button>
                        )}
                        
                        <div className="flex items-center justify-between gap-2 mt-1 pt-0.5">
                          <p className="text-xs opacity-70">
                            {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          {msg.sender === "user" && (
                            <span className="text-xs opacity-70">
                              {msg.lido ? "✓✓" : "✓"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

      {/* Client Info Modal */}
      <Dialog open={showClientInfo} onOpenChange={(open) => {
        setShowClientInfo(open);
        if (!open) setBusinessValue("");
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Informações do Cliente
            </DialogTitle>
          </DialogHeader>
          {clientDetailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-600 dark:text-slate-400" />
            </div>
          ) : detailedClient ? (
            <div className="space-y-4">
              {/* Valor do Negócio + Tags */}
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-900 dark:text-slate-100">Valor do Negócio</label>
                  <Input
                    type="text"
                    placeholder="R$ 0,00"
                    value={businessValue}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      const formatted = new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL"
                      }).format(parseInt(value || "0") / 100);
                      setBusinessValue(formatted);
                    }}
                    className="mt-2"
                    data-testid="input-business-value"
                  />
                </div>
                
                {/* Tag Selection */}
                <div>
                  <label className="text-sm font-semibold text-slate-900 dark:text-slate-100">Selecione uma Etapa</label>
                  {allTags && allTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {allTags.map((tag) => {
                        const isCurrentTag = detailedClient?.tags?.[0] === tag.nome;
                        return (
                          <Button
                            key={tag.id}
                            size="sm"
                            variant={isCurrentTag ? "default" : "outline"}
                            className={`${isCurrentTag ? `${tag.cor}` : ""} rounded-full`}
                            onClick={() => {
                              addTagMutation.mutate(tag.nome);
                            }}
                            disabled={addTagMutation.isPending}
                            data-testid={`button-tag-${tag.id}`}
                          >
                            {addTagMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : isCurrentTag ? (
                              `✓ ${tag.nome}`
                            ) : (
                              tag.nome
                            )}
                          </Button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Nenhuma etapa criada. Crie em "Etiquetas"</p>
                  )}
                  
                  {/* Remove Tag Button */}
                  {detailedClient?.tags?.[0] && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteTag(detailedClient.tags[0])}
                      disabled={removeTagMutation.isPending}
                      className="w-full mt-3"
                      data-testid="button-remove-tag"
                    >
                      {removeTagMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-2" />
                      ) : (
                        <>
                          <X className="h-3 w-3 mr-2" />
                          Remover Etapa
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800/50">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-purple-200 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold text-lg">
                      {(detailedClient.nome || detailedClient.razaoSocial || "C")
                        .split(" ")
                        .slice(0, 2)
                        .map((w: string) => w[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {detailedClient.razaoSocial || detailedClient.nome || "Sem nome"}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {detailedClient.CELULAR_PRINCIPAL || detailedClient.telefone || "Sem contato"}
                    </p>
                  </div>
                </div>
                {detailedClient.tags?.[0] && (() => {
                  const tagName = detailedClient.tags[0];
                  const tag = allTags.find(t => t.nome === tagName);
                  return (
                    <Badge className={`${tag?.cor || "bg-gray-500"}`}>
                      {tagName}
                    </Badge>
                  );
                })()}
              </div>

              <div className="space-y-3">
                {detailedClient.email && (
                  <div className="border-b border-slate-200 dark:border-slate-700 pb-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">Email</p>
                    <p className="text-sm text-slate-900 dark:text-white mt-1">{detailedClient.email}</p>
                  </div>
                )}
                
                {detailedClient.carteira && (
                  <div className="border-b border-slate-200 dark:border-slate-700 pb-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">Carteira</p>
                    <p className="text-sm text-slate-900 dark:text-white mt-1">{detailedClient.carteira}</p>
                  </div>
                )}
                
                {detailedClient.status && (
                  <div className="border-b border-slate-200 dark:border-slate-700 pb-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">Status</p>
                    <Badge variant="outline" className="mt-1">
                      {detailedClient.status}
                    </Badge>
                  </div>
                )}
                
                {detailedClient.leadScore && (
                  <div className="border-b border-slate-200 dark:border-slate-700 pb-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">Lead Score</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-purple-600" 
                          style={{ width: `${(detailedClient.leadScore / 100) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{detailedClient.leadScore}</span>
                    </div>
                  </div>
                )}

                {detailedClient.cpfCnpj && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">CPF/CNPJ</p>
                    <p className="text-sm text-slate-900 dark:text-white mt-1 font-mono">{detailedClient.cpfCnpj}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-400 text-center py-8">
              Não foi possível carregar informações
            </p>
          )}
        </DialogContent>
      </Dialog>

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
            <div className="flex flex-col gap-3">
              {recordedAudio && (
                <div className="px-6 pt-4 pb-3 mx-6 flex items-center gap-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                    <Music className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Áudio pronto</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{(recordedAudio.blob.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={handleSendRecordedAudio}
                      disabled={sendMutation.isPending}
                      data-testid="button-send-audio"
                      className="gap-1.5"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Enviar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDiscardRecordedAudio}
                      disabled={sendMutation.isPending}
                      data-testid="button-discard-audio"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
              <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex gap-3 items-end">
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
                  disabled={sendMutation.isPending || recordedAudio !== null}
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
                  disabled={sendMutation.isPending || isRecording || recordedAudio !== null}
                  data-testid="button-file-upload"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant={isRecording ? "destructive" : "ghost"}
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  disabled={sendMutation.isPending || recordedAudio !== null}
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
                  disabled={!messageText.trim() || sendMutation.isPending || recordedAudio !== null}
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
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-500 mb-4" />
              <p className="text-slate-600 dark:text-slate-400">
                Selecione uma conversa ou busque um cliente
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
