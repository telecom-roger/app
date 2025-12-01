import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Send, Phone, MessageSquare, Search, X, Paperclip, Image as ImageIcon, Music, File, Mic, StopCircle, Download, Plus, Info, User, Zap, Eye, EyeOff, ChevronDown, Trash2, Forward } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SiWhatsapp } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { KanbanStage } from "@shared/schema";

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
  origem?: string;  // ✅ "automation" para mensagens enviadas por IA
  statusEntrega?: "enviado" | "entregue" | "lido";  // Status de entrega WhatsApp
}

// Componente para exibir os ticks de status de entrega
const DeliveryStatusTicks = ({ status }: { status?: "enviado" | "entregue" | "lido" }) => {
  if (status === "lido") {
    // Dois ticks azuis escuros - mensagem lida
    return <span className="text-xs font-bold text-blue-600">✓✓</span>;
  } else if (status === "entregue") {
    // Dois ticks cinza - mensagem entregue
    return <span className="text-xs font-bold opacity-70">✓✓</span>;
  } else {
    // Um tick - mensagem enviada (ou sem status)
    return <span className="text-xs font-bold opacity-70">✓</span>;
  }
};

// Function to normalize text (remove accents and convert to lowercase)
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

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
    celular: string;
    tags?: string[];
  };
}

interface Client {
  id: string;
  nome: string;
  cnpj?: string;
  celular: string;
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

interface User {
  id: string;
  email: string;
  role: string;
}

export default function Chat() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  // State separado para armazenar a conversa selecionada diretamente
  // (evita que o polling sobrescreva conversas novas sem mensagens)
  const [selectedConversationData, setSelectedConversationData] = useState<Conversation | null>(null);
  // Rastrear quantidade anterior de mensagens para detectar novas
  const [previousMessageCount, setPreviousMessageCount] = useState(0);
  
  // Get current authenticated user
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });
  const [messageText, setMessageText] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isInitializingFromUrl, setIsInitializingFromUrl] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<{ base64: string; blob: Blob } | null>(null);
  const shouldDiscardAudioRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [pastedImage, setPastedImage] = useState<{ base64: string; nome: string; tipo: string; size: number; mimeType: string } | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteColor, setNoteColor] = useState("bg-blue-500");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [contextMenuConvId, setContextMenuConvId] = useState<string | null>(null);
  const [contextMenuConvOculta, setContextMenuConvOculta] = useState(false);
  const [showHiddenConversations, setShowHiddenConversations] = useState(false);
  const [showClientInfo, setShowClientInfo] = useState(false);
  const [businessValue, setBusinessValue] = useState<string>("");
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [creatingOpportunity, setCreatingOpportunity] = useState(false);
  const [messageSearchTerm, setMessageSearchTerm] = useState("");
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [selectedMessageResultIndex, setSelectedMessageResultIndex] = useState<number | null>(null);
  const messageSearchResultsRef = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [forwardSearchTerm, setForwardSearchTerm] = useState("");
  const [forwardCustomNumber, setForwardCustomNumber] = useState("");
  const [isForwarding, setIsForwarding] = useState(false);

  // Handle clientId from URL parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get('clientId');
    
    if (clientId && isInitializingFromUrl) {
      setIsInitializingFromUrl(false);
      
      // Fetch client data to populate search field
      fetch(`/api/clients/${clientId}`)
        .then(res => res.json())
        .then((client) => {
          // Set search term to client's nome for automatic filtering
          setSearchTerm(client.nome || "");
          setShowSearchResults(true);
        })
        .catch((error) => {
          console.error("Erro ao buscar dados do cliente:", error);
        });
      
      // Create or get conversation for this client
      apiRequest("POST", `/api/chat/start-conversation/${clientId}`, {})
        .then(res => res.json())
        .then((conversa: Conversation) => {
          // Mark as not hidden if it was
          if ((conversa as any).oculta) {
            apiRequest("PATCH", `/api/chat/conversations/${conversa.id}/toggle-hidden`, { oculta: false })
              .catch(err => console.error("Erro ao reabrir conversa:", err));
          }
          
          // Get current conversations from cache (usar a mesma queryKey exata)
          const queryKey = ["/api/chat/conversations", { showHidden: showHiddenConversations }];
          const currentConversations = queryClient.getQueryData<Conversation[]>(queryKey) || [];
          
          // Check if conversation already exists in cache
          const existingIndex = currentConversations.findIndex(c => c.id === conversa.id);
          
          // Update cache
          if (existingIndex >= 0) {
            // Update existing
            currentConversations[existingIndex] = conversa;
          } else {
            // Add new
            currentConversations.unshift(conversa);
          }
          
          queryClient.setQueryData(queryKey, currentConversations);
          
          // Armazenar no state separado e selecionar
          setSelectedConversationData(conversa);
          setSelectedConversationId(conversa.id);
        })
        .catch((error) => {
          console.error("Erro ao iniciar conversa:", error);
          toast({
            title: "Erro",
            description: "Não foi possível iniciar conversa com este cliente",
            variant: "destructive",
          });
        });
    } else {
      setIsInitializingFromUrl(false);
    }
  }, [window.location.search]);

  const { data: quickReplies = [] } = useQuery<QuickReply[]>({
    queryKey: ["/api/quick-replies"],
    refetchInterval: 10000,
  });

  // Fetch predefined tags
  const { data: allTags = [] } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
    refetchInterval: 5000,
  });

  // Fetch kanban stages
  const { data: kanbanStages = [] } = useQuery<KanbanStage[]>({
    queryKey: ["/api/kanban-stages"],
    refetchInterval: 5000,
  });

  // Fetch all conversations for current user
  const { data: conversations = [], isLoading: conversationsLoading, refetch: refetchConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/chat/conversations", { showHidden: showHiddenConversations }],
    queryFn: async () => {
      const res = await fetch(`/api/chat/conversations?showHidden=${showHiddenConversations}`);
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
    refetchInterval: 500, // Poll a cada 500ms para atualização rápida
    staleTime: 0, // Força sempre buscar dados frescos do backend
    gcTime: 5000, // Cache por 5 segundos apenas
  });

  // Get the current conversation's client ID
  // Usa o state separado como fallback (para conversas novas sem mensagens que não aparecem no polling)
  const conversationFromList = conversations.find(c => c.id === selectedConversationId);
  const selectedConversation = conversationFromList || selectedConversationData;
  const currentClientId = selectedConversation?.clientId;

  // Fetch client notes for selected conversation
  const { data: clientNotes = [], isLoading: notesLoading, refetch: refetchNotes } = useQuery<ClientNote[]>({
    queryKey: currentClientId ? ["/api/client-notes", currentClientId] : [],
    enabled: !!currentClientId,
  });

  // Fetch all clients for search
  const { data: clientsResponse = { clientes: [] }, isLoading: clientsLoading, refetch: refetchClients } = useQuery<any>({
    queryKey: ["/api/clients"],
    refetchInterval: 2000, // Atualiza a cada 2s para pegar mudanças rapidamente
    staleTime: 0, // Sempre considerar dados como stale
    gcTime: 0, // Não cachear dados
    refetchOnWindowFocus: true, // Refetch quando voltar a janela
  });
  
  // Extrair array de clientes da resposta
  const clients = clientsResponse.clientes || [];

  // Fetch detailed client info when selected
  const { data: detailedClient = null, isLoading: clientDetailLoading, refetch: refetchDetailedClient } = useQuery<any>({
    queryKey: currentClientId ? ["/api/clients", currentClientId] : [],
    enabled: !!currentClientId,
  });

  // Fetch all opportunities
  const { data: allOpportunities = [], refetch: refetchOpportunities } = useQuery<any[]>({
    queryKey: ["/api/opportunities"],
    refetchInterval: 1000, // Refetch a cada 1 segundo para capturar oportunidades criadas pela IA
    staleTime: 0,
    gcTime: 0,
  });

  // Filter opportunities for current client
  const clientOpportunities = allOpportunities.filter(opp => opp.clientId === currentClientId);

  // Load saved business value when popup opens or client changes
  useEffect(() => {
    if (showClientInfo && detailedClient?.camposCustom?.valorEstimado) {
      setBusinessValue(detailedClient.camposCustom.valorEstimado);
    }
  }, [showClientInfo, detailedClient?.camposCustom?.valorEstimado]);

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
          
          // Se a conversa estava oculta, reabre automaticamente quando recebe mensagem
          if (data.conversationId) {
            const conv = conversations.find(c => c.id === data.conversationId);
            if ((conv as any)?.oculta) {
              console.log("🔄 Reabrindo conversa oculta automaticamente:", data.conversationId);
              apiRequest("PATCH", `/api/chat/conversations/${data.conversationId}/toggle-hidden`, { oculta: false })
                .catch(err => console.error("Erro ao reabrir conversa:", err));
            }
          }
          
          refetchConversations();
          // Se está na conversa que recebeu a mensagem, refetch mensagens também
          if (selectedConversationId === data.conversationId) {
            refetchMessages();
          }
          // Refetch opportunities em tempo real para atualizar Kanban quando IA cria oportunidade
          refetchOpportunities();
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
  }, [selectedConversationId, refetchConversations, refetchMessages, refetchOpportunities]);

  // Request notification permission on component mount
  useEffect(() => {
    if ("Notification" in window) {
      console.log("🔔 Status de notificações:", Notification.permission);
      
      // Pedir permissão se ainda não foi solicitada
      if (Notification.permission === "default") {
        Notification.requestPermission().then(permission => {
          console.log("🔔 Permissão de notificação respondida:", permission);
        });
      } else if (Notification.permission === "denied") {
        console.log("⚠️ Notificações foram bloqueadas. Verifique as configurações do navegador.");
      }
    } else {
      console.log("⚠️ Notificações não suportadas neste navegador");
    }
  }, []);

  // Função para tocar som de notificação (som padrão tipo WhatsApp)
  const playNotificationSound = () => {
    // Som de notificação em base64 (som curto e discreto)
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioContext.currentTime;
    
    // Criar dois tons para simular o som de notificação do WhatsApp
    const oscillator1 = audioContext.createOscillator();
    const oscillator2 = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator1.frequency.value = 880; // Nota A5
    oscillator2.frequency.value = 1320; // Nota E6
    oscillator1.type = "sine";
    oscillator2.type = "sine";
    
    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Envelope ADSR rápido para som curto
    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    oscillator1.start(now);
    oscillator2.start(now + 0.1);
    
    oscillator1.stop(now + 0.15);
    oscillator2.stop(now + 0.2);
  };

  // Mostrar notificação ao receber nova mensagem
  useEffect(() => {
    if (messages.length > previousMessageCount && messages.length > 0) {
      const newMessage = messages[messages.length - 1];
      
      // Só mostra notificação se a mensagem é do cliente (não do usuário)
      if (newMessage.sender === "client") {
        const clientName = selectedConversation?.client?.nome || "Novo contato";
        const messagePreview = newMessage.conteudo.substring(0, 50) + 
          (newMessage.conteudo.length > 50 ? "..." : "");
        
        // SEMPRE tocar som quando recebe mensagem de cliente
        try {
          playNotificationSound();
          console.log("🔊 Som de notificação tocado");
        } catch (err) {
          console.log("⚠️ Erro ao tocar som:", err);
        }
        
        // Mostra notificação visual se a janela não está em foco OU se há múltiplas mensagens
        if (!document.hasFocus() || messages.length > previousMessageCount + 1) {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(`Nova mensagem de ${clientName}`, {
              body: messagePreview,
              icon: "/icon.png",
              tag: `message-${newMessage.conversationId}`,
            });
            console.log("📬 Notificação visual mostrada");
          } else {
            console.log("⚠️ Notificações bloqueadas ou não suportadas");
          }
        }
      }
      
      setPreviousMessageCount(messages.length);
    }
  }, [messages, previousMessageCount, selectedConversation]);

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
        const cnpj = client.cnpj?.toLowerCase() || "";
        const cel = (client.celular || "").toLowerCase();
        const tel2 = ((client as any).telefone2 || "").toLowerCase();
        
        return (
          nome.includes(term) ||
          cnpj.includes(term) ||
          cel.includes(term) ||
          tel2.includes(term)
        );
      })
    : clients;

  // Filter conversations (backend already filters oculta=false and sorts by ultimaMensagemEm DESC)
  const sortedConversations = conversations
    .filter(conv => {
      // If a tag is selected, only show conversations with that tag
      if (selectedTag && conv.client?.tags) {
        return (conv.client.tags as string[]).includes(selectedTag);
      }
      return true;
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
      // Usar a mesma queryKey exata que a query usa
      const queryKey = ["/api/chat/conversations", { showHidden: showHiddenConversations }];
      const currentConversations = queryClient.getQueryData<Conversation[]>(queryKey) || [];
      const existingIndex = currentConversations.findIndex(c => c.id === data.id);
      
      if (existingIndex >= 0) {
        // Atualiza existente
        currentConversations[existingIndex] = { ...currentConversations[existingIndex], ...data };
      } else {
        // Adiciona nova no topo
        currentConversations.unshift(data);
      }
      
      queryClient.setQueryData(queryKey, [...currentConversations]);
      
      // Armazenar dados da conversa no state separado
      // (evita que polling sobrescreva conversas novas sem mensagens)
      setSelectedConversationData(data);
      setSelectedConversationId(data.id);
      setSearchTerm("");
      setShowSearchResults(false);
      
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
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
    const phone = client.celular;
    if (!phone) {
      toast({
        title: "Erro",
        description: "Cliente sem telefone cadastrado",
        variant: "destructive",
      });
      return;
    }
    console.log(`[CHAT] Selecionando cliente: ${client.nome} -> Telefone: ${phone}`);
    refetchClients(); // Força atualização de cache antes de criar conversa
    getConversationMutation.mutate(phone);
  };

  const handleSelectConversation = (conversationId: string) => {
    // Buscar dados da conversa da lista e salvar no state separado
    const conv = conversations.find(c => c.id === conversationId);
    if (conv) {
      setSelectedConversationData(conv);
    }
    setSelectedConversationId(conversationId);
    queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
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

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items || !selectedConversationId) return;

    // Check if WhatsApp is connected
    if (!isWhatsappConnected) {
      toast({
        title: "WhatsApp desconectado",
        description: "Conecte uma sessão do WhatsApp antes de enviar imagens",
        variant: "destructive",
      });
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setPastedImage({
            base64,
            nome: `imagem_${Date.now()}.${file.type.split("/")[1]}`,
            tipo: "imagem",
            size: file.size,
            mimeType: file.type
          });
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  };

  const handleSendPastedImage = () => {
    if (!pastedImage) return;
    sendMutation.mutate({
      arquivo: pastedImage.base64,
      tipo: pastedImage.tipo,
      nomeArquivo: pastedImage.nome,
      tamanho: pastedImage.size,
      mimeType: pastedImage.mimeType
    } as any);
    setPastedImage(null);
  };

  const handleDiscardPastedImage = () => {
    setPastedImage(null);
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
      if (!currentClientId || !detailedClient) return;
      
      // 1. Adicionar tag ao cliente
      const tagRes = await apiRequest("POST", `/api/clients/${currentClientId}/tags`, { tagName, valorEstimado: businessValue });
      
      // 2. Gerenciar oportunidade - cada cliente tem apenas 1 oportunidade por vez
      try {
        const oppsRes = await fetch(`/api/opportunities`);
        const opps = await oppsRes.json();
        // Buscar oportunidades do cliente
        const clientOpps = opps.filter((op: any) => op.clientId === currentClientId);
        
        // Remover todas as oportunidades antigas do cliente
        for (const opp of clientOpps) {
          await apiRequest("DELETE", `/api/opportunities/${opp.id}`, {});
        }
        
        // Criar nova oportunidade na etiqueta selecionada (mesmo sem valor)
        await apiRequest("POST", "/api/opportunities", {
          clientId: currentClientId,
          titulo: `${detailedClient.nome}`,
          etapa: tagName,
          valorEstimado: businessValue || "",
          responsavelId: detailedClient.createdBy,
        });
      } catch (err) {
        console.error("Erro ao gerenciar oportunidade:", err);
      }
      
      return tagRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] }).then(() => {
        queryClient.refetchQueries({ queryKey: ["/api/opportunities"] });
      });
      refetchConversations();
      refetchDetailedClient();
      setBusinessValue("");
      toast({ title: "Etiqueta adicionada", variant: "default" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao adicionar etiqueta", description: error.message, variant: "destructive" });
    },
  });

  // Remove tag from client mutation
  const removeTagMutation = useMutation({
    mutationFn: async (tagName: string) => {
      if (!currentClientId) return;
      
      // 1. Remover tag do cliente
      const res = await apiRequest("DELETE", `/api/clients/${currentClientId}/tags/${tagName}`, {});
      
      // 2. Remover oportunidade correspondente
      if (detailedClient?.id) {
        try {
          const oppsRes = await fetch(`/api/opportunities`);
          const opps = await oppsRes.json();
          const opToDelete = opps.find((op: any) => op.clientId === detailedClient.id && op.etapa === tagName);
          if (opToDelete) {
            await apiRequest("DELETE", `/api/opportunities/${opToDelete.id}`, {});
          }
        } catch (err) {
          console.error("Erro ao remover oportunidade:", err);
        }
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] }).then(() => {
        queryClient.refetchQueries({ queryKey: ["/api/opportunities"] });
      });
      refetchConversations();
      refetchDetailedClient();
      toast({ title: "Etiqueta e oportunidade removidas", variant: "default" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao remover etiqueta", description: error.message, variant: "destructive" });
    },
  });

  const handleDeleteTag = (tagName: string) => {
    removeTagMutation.mutate(tagName);
  };

  // Save business value mutation
  const saveBusinessValueMutation = useMutation({
    mutationFn: async () => {
      if (!currentClientId) return;
      // Salvar no cliente
      await apiRequest("PATCH", `/api/clients/${currentClientId}`, { 
        camposCustom: { valorEstimado: businessValue } 
      });
      // Sincronizar em todas as oportunidades do cliente
      try {
        const oppsRes = await fetch(`/api/opportunities`);
        const opps = await oppsRes.json();
        const clientOpps = opps.filter((op: any) => op.clientId === currentClientId);
        for (const opp of clientOpps) {
          await apiRequest("PATCH", `/api/opportunities/${opp.id}`, {
            valorEstimado: businessValue
          });
        }
      } catch (err) {
        console.error("Erro ao sincronizar oportunidades:", err);
      }
      return businessValue;
    },
    onSuccess: () => {
      refetchDetailedClient();
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      toast({ title: "Valor salvo com sucesso", variant: "default" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao salvar valor", description: error.message, variant: "destructive" });
    },
  });

  // Create opportunity mutation
  const createOpportunityMutation = useMutation({
    mutationFn: async () => {
      if (!currentClientId) throw new Error("Cliente não selecionado");
      if (!selectedStage) throw new Error("Etapa não selecionada");
      if (!detailedClient) throw new Error("Dados do cliente não carregados");
      if (!currentUser?.id) throw new Error("Usuário não autenticado");
      
      const response = await apiRequest("POST", "/api/opportunities", {
        clientId: currentClientId,
        titulo: detailedClient.nome || "Sem título",
        etapa: selectedStage,
        valorEstimado: businessValue || "",
        responsavelId: currentUser.id,
      });
      
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      setSelectedStage("");
      setBusinessValue("");
      setShowClientInfo(false);
      toast({ title: "Negócio criado!", description: "Oportunidade adicionada ao Kanban", variant: "default" });
    },
    onError: (error: any) => {
      console.error("Erro ao criar negócio:", error);
      toast({ title: "Erro ao criar negócio", description: error.message || "Tente novamente", variant: "destructive" });
    },
  });

  const handleSelectQuickReply = (reply: string) => {
    setMessageText(reply);
    setShowQuickReplies(false);
  };

  return (
    <div className="flex h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Left Sidebar - Conversations List */}
      <div className="w-full md:w-80 lg:w-96 flex flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
        {/* Search Input */}
        <div className="p-3 sm:p-4 space-y-2 sm:space-y-3 border-b border-slate-200 dark:border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSearchResults(e.target.value.trim().length > 0);
              }}
              className="pl-9 h-9 sm:h-10 text-sm"
              data-testid="input-search-client"
            />
          </div>
        </div>

        {/* Tag Filter Section */}
        {!showSearchResults && allTags.length > 0 && (
          <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">FILTRAR POR ETIQUETA</p>
              <Button
                variant={showHiddenConversations ? "default" : "ghost"}
                size="sm"
                onClick={() => setShowHiddenConversations(!showHiddenConversations)}
                data-testid="button-toggle-hidden-conversations"
                className="h-7 px-2 text-xs gap-1"
              >
                {showHiddenConversations ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                <span className="hidden sm:inline">Ocultas</span>
              </Button>
            </div>
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
                  filteredClients.map((client: Client) => {
                    const phone = client.celular;
                    const cnpj = (client as any)?.cnpj;
                    
                    return (
                      <button
                        key={client.id}
                        onClick={() => handleSelectClient(client)}
                        className="w-full text-left p-3 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 mb-2"
                        data-testid={`button-search-client-${client.id}`}
                      >
                        <p className="text-sm font-medium truncate text-slate-900 dark:text-white">{client.nome}</p>
                        {phone && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                            {phone}
                          </p>
                        )}
                        {cnpj && (
                          <p className="text-xs text-slate-500 dark:text-slate-500 truncate">
                            {cnpj}
                          </p>
                        )}
                      </button>
                    );
                  })
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
                    const clientName = conv.client?.nome || "Contato desconhecido";
                    const initials = getInitials(clientName);

                    const handleContextMenu = (e: React.MouseEvent) => {
                      e.preventDefault();
                      console.log("🖱️ Context menu acionado para conversa:", conv.id, "oculta:", (conv as any).oculta);
                      setContextMenuOpen(true);
                      setContextMenuPos({ x: e.clientX, y: e.clientY });
                      setContextMenuConvId(conv.id);
                      setContextMenuConvOculta((conv as any).oculta ?? false);
                    };

                    return (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      onContextMenu={handleContextMenu}
                      className={`w-full text-left p-3 rounded-lg transition-colors mb-1 hover:bg-purple-50 border-b border-slate-200 dark:border-slate-700 ${
                        selectedConversationId === conv.id
                          ? "bg-purple-50 dark:bg-purple-950/30 text-foreground"
                          : "text-foreground"
                      }`}
                      onMouseEnter={(e) => {
                        if (document.documentElement.classList.contains('dark')) {
                          e.currentTarget.style.backgroundColor = '#F0F1F2';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (document.documentElement.classList.contains('dark')) {
                          e.currentTarget.style.backgroundColor = '';
                        }
                      }}
                      data-testid={`button-conversation-${conv.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Avatar className="h-8 w-8 flex-shrink-0" data-testid={`avatar-${conv.id}`}>
                            <AvatarFallback style={{ backgroundColor: '#F0F1F2', color: '#1F1F1F' }} className="bg-slate-300 text-slate-700 text-xs font-bold">
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
                          {(conv as any).oculta && (
                            <EyeOff className="h-3 w-3 text-slate-400" />
                          )}
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
                            {conv.client?.celular || (conv.client as any)?.cnpj || "Sem contato"}
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
              className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg py-1 min-w-[160px]"
              style={{
                left: `${contextMenuPos.x}px`,
                top: `${contextMenuPos.y}px`,
              }}
            >
              <button
                onClick={() => {
                  if (contextMenuConvId) {
                    const newOculta = !contextMenuConvOculta;
                    apiRequest("PATCH", `/api/chat/conversations/${contextMenuConvId}/toggle-hidden`, { oculta: newOculta })
                      .then(() => {
                        if (newOculta && selectedConversationId === contextMenuConvId) {
                          setSelectedConversationId(null);
                        }
                        refetchConversations();
                        toast({
                          title: newOculta ? "Conversa oculta" : "Conversa reaberta",
                          description: newOculta 
                            ? "Reabrirá automaticamente quando o cliente chamar" 
                            : "A conversa está visível novamente",
                        });
                      })
                      .catch(err => {
                        console.error("Erro ao alterar visibilidade:", err);
                        toast({
                          title: "Erro",
                          description: "Não foi possível alterar a conversa",
                          variant: "destructive",
                        });
                      });
                  }
                  setContextMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-900 dark:text-white flex items-center gap-2"
                data-testid="button-toggle-hide-conversation"
              >
                {contextMenuConvOculta ? (
                  <>
                    <Eye className="h-4 w-4" />
                    Reabrir conversa
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4" />
                    Ocultar conversa
                  </>
                )}
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
            <div className="flex items-center gap-2 p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 justify-between flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <SiWhatsapp className="h-5 w-5 text-green-500 flex-shrink-0" />
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
                      {(selectedConversation.client?.nome || "Contato").length > 30
                        ? (selectedConversation.client?.nome || "Contato").substring(0, 30) + "..."
                        : selectedConversation.client?.nome || "Contato"}
                    </p>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {selectedConversation.client?.celular || (selectedConversation.client as any)?.cnpj || "Sem contato"}
                  </p>
                </div>
              </div>
              <Popover open={showMessageSearch} onOpenChange={setShowMessageSearch}>
                <PopoverTrigger asChild>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    data-testid="button-search-messages"
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3" align="end">
                  <div className="space-y-3">
                    <Input
                      placeholder="Buscar mensagens..."
                      value={messageSearchTerm}
                      onChange={(e) => setMessageSearchTerm(e.target.value)}
                      data-testid="input-message-search"
                      autoFocus
                    />
                    {messageSearchTerm && messages.filter(m => normalizeText(m.conteudo).includes(normalizeText(messageSearchTerm))).length > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {messages.filter(m => normalizeText(m.conteudo).includes(normalizeText(messageSearchTerm))).map((result, idx) => (
                          <button
                            key={result.id}
                            onClick={() => {
                              setSelectedMessageResultIndex(idx);
                              messageSearchResultsRef.current[result.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
                              setShowMessageSearch(false);
                            }}
                            className="w-full text-left p-2 rounded text-sm bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-colors break-words"
                            data-testid={`button-search-result-${result.id}`}
                          >
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                              {new Date(result.createdAt).toLocaleTimeString("pt-BR")}
                            </p>
                            <p className="line-clamp-2 text-slate-900 dark:text-white">
                              {result.conteudo}
                            </p>
                          </button>
                        ))}
                      </div>
                    ) : messageSearchTerm ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                        Nenhuma mensagem encontrada
                      </p>
                    ) : null}
                  </div>
                </PopoverContent>
              </Popover>
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => setShowClientInfo(true)}
                data-testid="button-client-info"
              >
                <User className="h-5 w-5" />
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
            <ScrollArea className="flex-1 p-3 sm:p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
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
                      ref={(el) => {
                        if (el) messageSearchResultsRef.current[msg.id] = el;
                      }}
                      className={`flex ${
                        msg.sender === "user"
                          ? "justify-end"
                          : "justify-start"
                      } group ${messageSearchTerm && normalizeText(msg.conteudo).includes(normalizeText(messageSearchTerm)) ? "bg-blue-200 dark:bg-blue-900 px-2 py-1 rounded-lg" : ""}`}
                      data-testid={`message-${msg.id}`}
                    >
                      <div
                        className={`relative max-w-xs px-3 py-2 rounded-lg shadow-sm ${
                          msg.tipo === "deletada"
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 italic"
                            : msg.sender === "user"
                            ? "bg-blue-100 dark:bg-blue-950 text-slate-900 dark:text-blue-100 shadow-blue-100/20"
                            : "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-600"
                        }`}
                      >
                        {msg.tipo !== "deletada" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className={`absolute top-1 ${msg.sender === "user" ? "right-1" : "left-1"} invisible group-hover:visible p-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-900 transition-colors`}
                                data-testid={`button-message-menu-${msg.id}`}
                              >
                                <ChevronDown className="h-3 w-3 text-slate-500" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={msg.sender === "user" ? "end" : "start"} className="w-44">
                              <DropdownMenuItem
                                onClick={() => {
                                  setForwardingMessage(msg);
                                  setShowForwardModal(true);
                                  setForwardSearchTerm("");
                                  setForwardCustomNumber("");
                                }}
                                className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 hover:text-inherit focus:text-inherit"
                                data-testid={`button-forward-message-${msg.id}`}
                              >
                                <Forward className="h-4 w-4 mr-2" />
                                Encaminhar
                              </DropdownMenuItem>
                              {msg.sender === "user" && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    apiRequest("DELETE", `/api/chat/messages/${msg.id}`)
                                      .then(() => {
                                        refetchMessages();
                                        toast({
                                          title: "Mensagem apagada",
                                          description: "Apagada para você e para o cliente"
                                        });
                                      })
                                      .catch(err => {
                                        console.error("Erro ao deletar:", err);
                                        toast({
                                          title: "Erro",
                                          description: "Não foi possível apagar a mensagem",
                                          variant: "destructive"
                                        });
                                      });
                                  }}
                                  className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 hover:text-inherit focus:text-inherit"
                                  data-testid={`button-delete-message-${msg.id}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Apagar para Todos
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {msg.tipo === "deletada" && (
                          <p className="text-sm break-words italic opacity-70">
                            {msg.conteudo}
                          </p>
                        )}
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
                          <div className="flex items-center gap-1">
                            <p className="text-xs opacity-70">
                              {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                            {msg.origem === "automation" && (
                              <span className="text-xs opacity-60 italic" data-testid={`badge-ai-${msg.id}`}>
                                enviado por IA
                              </span>
                            )}
                          </div>
                          {msg.sender === "user" && (
                            <DeliveryStatusTicks status={msg.statusEntrega} />
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

      {/* Client Info Modal - Modern UI */}
      <Dialog open={showClientInfo} onOpenChange={(open) => {
        setShowClientInfo(open);
        if (!open) {
          setBusinessValue("");
          setSelectedStage("");
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#2A2B2D] border border-slate-200 dark:border-[#3C4043]">
          <DialogTitle className="sr-only">Informações do Cliente</DialogTitle>
          {clientDetailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#1A73E8]" />
            </div>
          ) : detailedClient ? (
            <div className="space-y-6">
              {/* Header - Cliente */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16 flex-shrink-0 border-2 border-[#1A73E8]/20">
                    <AvatarFallback className="bg-[#1A73E8]/10 text-[#1A73E8] font-bold text-xl">
                      {(detailedClient.nome || "C")
                        .split(" ")
                        .slice(0, 2)
                        .map((w: string) => w[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-[#FFFFFF]">
                      {detailedClient.nome || "Sem nome"}
                    </h2>
                    <button
                      onClick={() => {
                        navigate(`/clientes/${detailedClient.id}`);
                        setShowClientInfo(false);
                      }}
                      className="flex items-center gap-1 text-sm text-[#1A73E8] hover:underline hover-elevate mt-1 transition-colors"
                      data-testid="button-edit-client"
                    >
                      <User className="h-3.5 w-3.5" />
                      Ver cliente
                    </button>
                  </div>
                </div>
              </div>

              {/* Dados do Cliente - Grid 3 colunas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {detailedClient.celular && (
                  <div className="bg-slate-50 dark:bg-[#202124] rounded-lg p-3 border border-slate-200 dark:border-[#3C4043]">
                    <p className="text-xs font-semibold text-slate-600 dark:text-[#A9A9A9] mb-1">CELULAR</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-[#FFFFFF]">{detailedClient.celular}</p>
                  </div>
                )}
                {detailedClient.email && (
                  <div className="bg-slate-50 dark:bg-[#202124] rounded-lg p-3 border border-slate-200 dark:border-[#3C4043]">
                    <p className="text-xs font-semibold text-slate-600 dark:text-[#A9A9A9] mb-1">EMAIL</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-[#FFFFFF] break-all">{detailedClient.email}</p>
                  </div>
                )}
                {detailedClient.carteira && (
                  <div className="bg-slate-50 dark:bg-[#202124] rounded-lg p-3 border border-slate-200 dark:border-[#3C4043]">
                    <p className="text-xs font-semibold text-slate-600 dark:text-[#A9A9A9] mb-1">CARTEIRA</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-[#FFFFFF]">{detailedClient.carteira}</p>
                  </div>
                )}
                {detailedClient.cnpj && (
                  <div className="bg-slate-50 dark:bg-[#202124] rounded-lg p-3 border border-slate-200 dark:border-[#3C4043]">
                    <p className="text-xs font-semibold text-slate-600 dark:text-[#A9A9A9] mb-1">CNPJ</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-[#FFFFFF] font-mono">{detailedClient.cnpj}</p>
                  </div>
                )}
                {detailedClient.status && (
                  <div className="bg-slate-50 dark:bg-[#202124] rounded-lg p-3 border border-slate-200 dark:border-[#3C4043]">
                    <p className="text-xs font-semibold text-slate-600 dark:text-[#A9A9A9] mb-1">STATUS</p>
                    <Badge className={(() => {
                      const statusColors: Record<string, string> = {
                        lead_quente: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
                        engajado: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
                        em_negociacao: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
                        em_fechamento: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
                        ativo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
                        perdido: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
                        remarketing: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
                      };
                      return statusColors[detailedClient.status?.toLowerCase() || ''] || 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200';
                    })()}>{detailedClient.status.toUpperCase()}</Badge>
                  </div>
                )}
                {clientOpportunities && clientOpportunities.length > 0 && (
                  <div className="bg-slate-50 dark:bg-[#202124] rounded-lg p-3 border border-slate-200 dark:border-[#3C4043]">
                    <p className="text-xs font-semibold text-slate-600 dark:text-[#A9A9A9] mb-1">ETAPA ATUAL</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-[#FFFFFF]">{clientOpportunities[0].etapa.toUpperCase()}</p>
                  </div>
                )}
              </div>

              {/* Etiquetas/Tags */}
              {allTags && allTags.length > 0 && (
                <div className="border-t border-slate-200 dark:border-[#3C4043] pt-4">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-[#FFFFFF] mb-3">Etiquetas</h3>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => {
                      const isCurrentTag = detailedClient?.tags?.[0] === tag.nome;
                      return (
                        <Button
                          key={tag.id}
                          size="sm"
                          variant={isCurrentTag ? "default" : "outline"}
                          className={`${isCurrentTag ? `${tag.cor}` : "opacity-60"} rounded-full text-xs`}
                          onClick={() => {
                            if (isCurrentTag) {
                              handleDeleteTag(tag.nome);
                            } else {
                              addTagMutation.mutate(tag.nome);
                            }
                          }}
                          disabled={addTagMutation.isPending || removeTagMutation.isPending}
                          data-testid={`button-tag-${tag.id}`}
                        >
                          {addTagMutation.isPending || removeTagMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : isCurrentTag ? (
                            <span className="flex items-center gap-1">
                              {tag.nome}
                              <X className="h-3 w-3 ml-0.5" />
                            </span>
                          ) : (
                            tag.nome
                          )}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Criar Negócio - Card Principal */}
              <Card className="border border-[#1A73E8]/30 dark:border-[#1A73E8]/30 bg-[#1A73E8]/5 dark:bg-[#1A73E8]/10 p-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-[#1A73E8]" />
                    <h3 className="font-semibold text-slate-900 dark:text-[#FFFFFF]">Criar Novo Negócio</h3>
                  </div>
                  
                  {/* Valor + Etapa em linha */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-[#A9A9A9] mb-2 block">Valor Estimado</label>
                      <Input
                        type="text"
                        placeholder="Ex: 5000 ou R$ 5.000"
                        value={businessValue}
                        onChange={(e) => setBusinessValue(e.target.value)}
                        className="text-sm h-9"
                        data-testid="input-opp-value"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-[#A9A9A9] mb-2 block">Etapa</label>
                      <Select value={selectedStage} onValueChange={setSelectedStage}>
                        <SelectTrigger className="h-9 text-sm" data-testid="select-opp-stage">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {kanbanStages.sort((a, b) => a.ordem - b.ordem).map((stage) => (
                            <SelectItem key={stage.id} value={stage.titulo}>{stage.titulo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Botão Criar */}
                  <Button
                    onClick={() => createOpportunityMutation.mutate()}
                    disabled={!selectedStage || createOpportunityMutation.isPending}
                    className="w-full bg-[#1A73E8] hover:bg-[#185ABC] text-white"
                    data-testid="button-create-opportunity"
                  >
                    {createOpportunityMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Criar Negócio
                  </Button>
                </div>
              </Card>
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-[#A9A9A9] text-center py-8">
              Não foi possível carregar informações
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Viewer Modal */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-2xl p-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <DialogTitle className="sr-only">Imagem Expandida</DialogTitle>
          <div className="relative w-full h-auto flex items-center justify-center">
            {selectedImage && (
              <>
                <img src={selectedImage} alt="Imagem expandida" className="max-w-full max-h-[80vh] object-contain" />
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-4 right-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = selectedImage;
                    link.download = `imagem_${Date.now()}.jpg`;
                    link.click();
                  }}
                  data-testid="button-download-image"
                >
                  <Download className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </Button>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-4 left-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full p-2 transition-colors"
                  data-testid="button-close-image"
                >
                  <X className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

            {/* Input */}
            <div className="flex flex-col gap-3">
              {pastedImage && (
                <div className="px-3 sm:px-6 pt-4 pb-3 mx-3 sm:mx-6 flex items-center gap-3 sm:gap-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue/10 dark:bg-blue/20 flex items-center justify-center">
                    <img src={pastedImage.base64} alt="Preview" className="w-10 h-10 object-cover rounded-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Imagem pronta</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{(pastedImage.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={handleSendPastedImage}
                      disabled={sendMutation.isPending}
                      data-testid="button-send-pasted-image"
                      className="gap-1.5"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Enviar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDiscardPastedImage}
                      disabled={sendMutation.isPending}
                      data-testid="button-discard-pasted-image"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
              {recordedAudio && (
                <div className="px-3 sm:px-6 pt-4 pb-3 mx-3 sm:mx-6 flex items-center gap-3 sm:gap-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
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
              <div className="p-3 sm:p-6 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex gap-2 sm:gap-3 items-end">
                <Textarea
                  placeholder="Digite..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  onPaste={handlePaste}
                  disabled={sendMutation.isPending || recordedAudio !== null || pastedImage !== null}
                  data-testid="input-message"
                  className="resize-none min-h-11 sm:min-h-12 max-h-32 text-sm sm:text-base"
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
                  className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant={isRecording ? "destructive" : "ghost"}
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  disabled={sendMutation.isPending || recordedAudio !== null}
                  data-testid="button-voice-record"
                  className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
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
                  className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
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

      {/* Forward Message Modal */}
      <Dialog open={showForwardModal} onOpenChange={(open) => {
        setShowForwardModal(open);
        if (!open) {
          setForwardingMessage(null);
          setForwardSearchTerm("");
          setForwardCustomNumber("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Forward className="h-5 w-5" />
              Encaminhar Mensagem
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {forwardingMessage && (
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Mensagem a encaminhar:</p>
                <p className="text-sm text-slate-900 dark:text-white line-clamp-3">
                  {forwardingMessage.tipo === "texto" ? forwardingMessage.conteudo : `[${forwardingMessage.tipo}]`}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900 dark:text-white">
                Buscar cliente
              </label>
              <Input
                placeholder="Digite o nome do cliente..."
                value={forwardSearchTerm}
                onChange={(e) => setForwardSearchTerm(e.target.value)}
                data-testid="input-forward-search"
              />
              {forwardSearchTerm && clients.filter((c: Client) => 
                normalizeText(c.nome).includes(normalizeText(forwardSearchTerm)) ||
                c.celular?.includes(forwardSearchTerm)
              ).length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1 border border-slate-200 dark:border-slate-700 rounded-lg p-2">
                  {clients.filter((c: Client) => 
                    normalizeText(c.nome).includes(normalizeText(forwardSearchTerm)) ||
                    c.celular?.includes(forwardSearchTerm)
                  ).slice(0, 10).map((client: Client) => (
                    <button
                      key={client.id}
                      onClick={async () => {
                        if (!forwardingMessage || !client.celular) return;
                        setIsForwarding(true);
                        try {
                          await apiRequest("POST", "/api/chat/forward-message", {
                            messageId: forwardingMessage.id,
                            targetClientId: client.id,
                            targetPhone: client.celular,
                            messageContent: forwardingMessage.conteudo,
                            messageType: forwardingMessage.tipo,
                            arquivo: forwardingMessage.arquivo,
                            nomeArquivo: forwardingMessage.nomeArquivo,
                            mimeType: forwardingMessage.mimeType,
                          });
                          toast({
                            title: "Mensagem encaminhada",
                            description: `Enviada para ${client.nome}`,
                          });
                          refetchConversations();
                          refetchClients();
                          setShowForwardModal(false);
                        } catch (err) {
                          console.error("Erro ao encaminhar:", err);
                          toast({
                            title: "Erro",
                            description: "Não foi possível encaminhar a mensagem",
                            variant: "destructive",
                          });
                        } finally {
                          setIsForwarding(false);
                        }
                      }}
                      disabled={isForwarding || !client.celular}
                      className="w-full text-left p-2 rounded text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-between"
                      data-testid={`button-forward-to-${client.id}`}
                    >
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{client.nome}</p>
                        <p className="text-xs text-slate-500">{client.celular || "Sem celular"}</p>
                      </div>
                      {isForwarding && <Loader2 className="h-4 w-4 animate-spin" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <label className="text-sm font-medium text-slate-900 dark:text-white">
                Ou digite um número
              </label>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Ex: 5511999999999"
                  value={forwardCustomNumber}
                  onChange={(e) => setForwardCustomNumber(e.target.value.replace(/\D/g, ''))}
                  data-testid="input-forward-custom-number"
                  className="flex-1"
                />
                <Button
                  onClick={async () => {
                    if (!forwardingMessage || !forwardCustomNumber) return;
                    setIsForwarding(true);
                    try {
                      await apiRequest("POST", "/api/chat/forward-message", {
                        messageId: forwardingMessage.id,
                        targetPhone: forwardCustomNumber,
                        messageContent: forwardingMessage.conteudo,
                        messageType: forwardingMessage.tipo,
                        arquivo: forwardingMessage.arquivo,
                        nomeArquivo: forwardingMessage.nomeArquivo,
                        mimeType: forwardingMessage.mimeType,
                      });
                      toast({
                        title: "Mensagem encaminhada",
                        description: `Enviada para ${forwardCustomNumber}`,
                      });
                      refetchConversations();
                      refetchClients();
                      setShowForwardModal(false);
                    } catch (err) {
                      console.error("Erro ao encaminhar:", err);
                      toast({
                        title: "Erro",
                        description: "Não foi possível encaminhar a mensagem",
                        variant: "destructive",
                      });
                    } finally {
                      setIsForwarding(false);
                    }
                  }}
                  disabled={isForwarding || !forwardCustomNumber || forwardCustomNumber.length < 10}
                  data-testid="button-forward-to-custom"
                >
                  {isForwarding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Digite o número completo com DDI+DDD (ex: 5511999999999)
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
