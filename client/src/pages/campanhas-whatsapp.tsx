import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { Button } from "@/components/ui/button";

// ✅ Hook de debounce para otimizar busca
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ScrollArea,
} from "@/components/ui/scroll-area";
import { 
  Send, 
  Upload, 
  Image as ImageIcon, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Eye,
  Loader,
  Copy,
  Trash2,
  Download,
  X,
  Calendar,
  AlertTriangle,
  MessageSquare,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
// @ts-ignore
import Papa from "papaparse";

type ContactEntry = {
  [key: string]: string;
};

type SendingStatus = {
  telefone: string;
  status: "pendente" | "enviando" | "sucesso" | "erro";
  erro?: string;
  timestamp?: string;
  clientId?: string;
};

type ClientForImport = {
  id: string;
  nome: string;
  celular: string;
  email?: string;
  status?: string;
  tags?: Array<{ id: string; nome: string; cor: string }>;
  tipo?: string;
  carteira?: string;
  cidade?: string;
  ultimaCampanha?: {
    data: string;
    minutosPara: number;
    recente: boolean;
  };
  sendStatus?: "enviado" | "nao_enviado" | "erro";
  lastSendDate?: string;
};

type Tag = {
  id: string;
  nome: string;
  cor: string;
};

export default function CampanhasWhatsApp() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { connected: whatsappConnected } = useWhatsAppStatus();
  
  // ===== STATE =====
  const [tabAtivo, setTabAtivo] = useState("mensagens");
  const [textoPlanilha, setTextoPlanilha] = useState("");
  const [contatos, setContatos] = useState<ContactEntry[]>([]);
  const [variaveisDisponiveis, setVariaveisDisponiveis] = useState<string[]>([]);
  const [template, setTemplate] = useState("");
  const [tempoDelay, setTempoDelay] = useState(40);
  const [tempoRandomMin, setTempoRandomMin] = useState(5);
  const [tempoRandomMax, setTempoRandomMax] = useState(15);
  const [imagemSelecionada, setImagemSelecionada] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [statusEnvio, setStatusEnvio] = useState<SendingStatus[]>([]);
  const [mostrarPreview, setMostrarPreview] = useState(false);
  const [confirmarEnvio, setConfirmarEnvio] = useState(false);
  const [mostrarSeletorBD, setMostrarSeletorBD] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [searchClientes, setSearchClientes] = useState("");
  const [clientesSelecionados, setClientesSelecionados] = useState<Set<string>>(new Set());
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [quantidadeSelecar, setQuantidadeSelecar] = useState(10);
  const cancelarEnvioRef = useRef(false);
  const [campanhasEmProgresso, setCampanhasEmProgresso] = useState<any[]>([]);
  const [modoBackground, setModoBackground] = useState(true);
  const [templateSelecionado, setTemplateSelecionado] = useState("");
  const [quantidadeAleatoria, setQuantidadeAleatoria] = useState(50);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [dataEnvioInicio, setDataEnvioInicio] = useState("");
  const [dataEnvioFim, setDataEnvioFim] = useState("");
  const [selectedTiposFilter, setSelectedTiposFilter] = useState<Set<string>>(new Set());
  const [selectedCarteirasFilter, setSelectedCarteirasFilter] = useState<Set<string>>(new Set());
  const [selectedCidadesFilter, setSelectedCidadesFilter] = useState<Set<string>>(new Set());
  const [nomeCampanha, setNomeCampanha] = useState("");
  // ✅ Inicia como true para carregar clientes automaticamente ao abrir seletor
  const [filtersInitiated, setFiltersInitiated] = useState(true);
  const [selectedSendStatusFilter, setSelectedSendStatusFilter] = useState<Set<string>>(new Set());
  const [cancelandoCampanha, setCanceladoCampanha] = useState<string | null>(null);
  
  // ✅ Estados de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [allLoadedClientes, setAllLoadedClientes] = useState<ClientForImport[]>([]);
  const [totalClientes, setTotalClientes] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // ✅ Debounce do search (300ms)
  const debouncedSearch = useDebounce(searchClientes, 300);

  // Fetch templates
  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["/api/templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: isAuthenticated,
  });

  // Cancel campaign mutation
  const cancelarCampanhaMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      setCanceladoCampanha(campaignId);
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/cancel`, {});
      return res.json();
    },
    onSuccess: (_, campaignId) => {
      setCampanhasEmProgresso(prev => prev.filter(c => c.id !== campaignId));
      setCanceladoCampanha(null);
      toast({ title: "Campanha cancelada com sucesso", variant: "default" });
    },
    onError: () => {
      toast({ title: "Erro ao cancelar campanha", variant: "destructive" });
      setCanceladoCampanha(null);
    },
  });

  // ✅ Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
    setAllLoadedClientes([]);
  }, [selectedTiposFilter, selectedCarteirasFilter, selectedCidadesFilter, selectedSendStatusFilter, debouncedSearch, filtroStatus, selectedTag]);
  
  // ✅ Fetch clients with PAGINATION + SERVER-SIDE FILTERS
  const { data: clientesResponse, isLoading: carregandoClientes, isFetching } = useQuery<{
    data: ClientForImport[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: [
      "/api/clients/whatsapp-list",
      currentPage,
      Array.from(selectedTiposFilter).sort().join(","),
      Array.from(selectedCarteirasFilter).sort().join(","),
      Array.from(selectedCidadesFilter).sort().join(","),
      Array.from(selectedSendStatusFilter).sort().join(","),
      debouncedSearch,
      filtroStatus,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      params.append('limit', '50');
      if (selectedTiposFilter.size > 0) {
        params.append('tipos', Array.from(selectedTiposFilter).join(','));
      }
      if (selectedCarteirasFilter.size > 0) {
        params.append('carteiras', Array.from(selectedCarteirasFilter).join(','));
      }
      if (selectedCidadesFilter.size > 0) {
        params.append('cidades', Array.from(selectedCidadesFilter).join(','));
      }
      if (selectedSendStatusFilter.size > 0) {
        params.append('sendStatus', Array.from(selectedSendStatusFilter).join(','));
      }
      if (debouncedSearch && debouncedSearch.length >= 2) {
        params.append('search', debouncedSearch);
      }
      if (filtroStatus && filtroStatus !== 'todos') {
        params.append('status', filtroStatus);
      }
      const res = await fetch(`/api/clients/whatsapp-list?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
    enabled: isAuthenticated && mostrarSeletorBD && filtersInitiated,
    staleTime: 30000,
  });
  
  // ✅ Accumulate loaded clients for "Load More" pattern
  useEffect(() => {
    if (clientesResponse?.data) {
      if (currentPage === 1) {
        setAllLoadedClientes(clientesResponse.data);
      } else {
        setAllLoadedClientes(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newClients = clientesResponse.data.filter(c => !existingIds.has(c.id));
          return [...prev, ...newClients];
        });
      }
      setTotalClientes(clientesResponse.total);
      setTotalPages(clientesResponse.totalPages);
    }
  }, [clientesResponse, currentPage]);
  
  // ✅ Compatibilidade: alias para código existente
  const clientesDisponiveis = allLoadedClientes;

  // Fetch available tags
  const { data: tagsDisponiveis = [] } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
    enabled: isAuthenticated && mostrarSeletorBD,
  });

  // Fetch available tipos
  const { data: tiposDisponiveis = [] } = useQuery<string[]>({
    queryKey: ["/api/clients/tipos"],
    enabled: isAuthenticated && mostrarSeletorBD,
  });

  // Fetch available carteiras
  const { data: carteirasDisponiveis = [] } = useQuery<string[]>({
    queryKey: ["/api/clients/carteiras"],
    enabled: isAuthenticated && mostrarSeletorBD,
  });

  // Fetch available cidades
  const { data: cidadesDisponiveis = [] } = useQuery<string[]>({
    queryKey: ["/api/clients/cidades"],
    enabled: isAuthenticated && mostrarSeletorBD,
  });

  // Detect when filters are initiated (when user interacts with filters or seletor)
  useEffect(() => {
    if (
      searchClientes ||
      filtroStatus !== "todos" ||
      selectedTag ||
      selectedTiposFilter.size > 0 ||
      selectedCarteirasFilter.size > 0 ||
      selectedCidadesFilter.size > 0 ||
      selectedSendStatusFilter.size > 0 ||
      dataEnvioInicio ||
      dataEnvioFim
    ) {
      setFiltersInitiated(true);
    }
  }, [searchClientes, filtroStatus, selectedTag, selectedTiposFilter, selectedCarteirasFilter, selectedCidadesFilter, selectedSendStatusFilter, dataEnvioInicio, dataEnvioFim]);

  // Poll for campaigns in progress
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/whatsapp/campanhas-em-progresso");
        if (res.ok) {
          const data = await res.json();
          setCampanhasEmProgresso(data);
        }
      } catch (err) {
        console.error("Erro ao buscar campanhas:", err);
      }
    }, 10000); // Poll a cada 10 segundos (increased from 2s for better performance)

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // ✅ FILTROS AGORA SÃO SERVER-SIDE - clientesDisponiveis já vem filtrado
  // Apenas filtro por tag local se necessário (tags não estão no server filter ainda)
  const clientesFiltrados = useMemo(() => {
    if (!selectedTag) return clientesDisponiveis;
    return clientesDisponiveis.filter(c => c.tags && c.tags.some(t => t.nome === selectedTag));
  }, [clientesDisponiveis, selectedTag]);

  // Parse CSV when text changes
  useEffect(() => {
    if (!textoPlanilha.trim()) {
      setContatos([]);
      setVariaveisDisponiveis([]);
      return;
    }

    Papa.parse(textoPlanilha, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: (results: any) => {
        if (results.data && Array.isArray(results.data)) {
          // Remove duplicates and blank phones
          const contatosProcessados: ContactEntry[] = [];
          const telefonesVistos = new Set<string>();

          for (const linha of results.data) {
            if (!linha || typeof linha !== "object") continue;
            
            // Find phone field (numeroTelefone, whatsapp, telefone, celular, etc)
            let telefone = "";
            for (const [key, value] of Object.entries(linha)) {
              const keyLower = (key || "").toLowerCase();
              if (
                keyLower.includes("telefone") ||
                keyLower.includes("whatsapp") ||
                keyLower.includes("celular") ||
                keyLower === "phone"
              ) {
                telefone = (value as string)?.trim() || "";
                break;
              }
            }

            // Skip if no valid phone
            if (!telefone || telefonesVistos.has(telefone)) continue;
            
            telefonesVistos.add(telefone);
            contatosProcessados.push(linha as ContactEntry);
          }

          setContatos(contatosProcessados);

          // Extract variables from headers
          if (contatosProcessados.length > 0) {
            const vars = Object.keys(contatosProcessados[0])
              .filter((k) => k && k.trim() !== "")
              .sort();
            setVariaveisDisponiveis(vars);
          }
        }
      },
      error: (error: any) => {
        console.error("Erro ao parsear CSV:", error);
        toast({
          title: "Erro",
          description: "Erro ao processar a planilha",
          variant: "destructive",
        });
      },
    });
  }, [textoPlanilha, toast]);

  // Handle image upload
  const handleImagemSelecionada = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImagemSelecionada(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagemPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Import selected clients from database
  const importarSelecionadosDoBD = () => {
    // ✅ Remover duplicatas mantendo Set de IDs
    const idsUnicos = new Set(clientesSelecionados);
    const contatosFromDB: ContactEntry[] = Array.from(idsUnicos)
      .map((clientId) => {
        const cliente = clientesDisponiveis.find((c) => c.id === clientId);
        return {
          id: cliente?.id || "",
          celular: cliente?.celular || "",
          nome: cliente?.nome || "N/A",
        };
      })
      .filter((c) => c.celular);

    if (contatosFromDB.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um cliente",
        variant: "destructive",
      });
      return;
    }

    setContatos(contatosFromDB);
    setVariaveisDisponiveis(["celular", "nome", "id"]);
    setClientesSelecionados(new Set());
    setMostrarSeletorBD(false);
    setSearchClientes("");

    toast({
      title: "Sucesso",
      description: `${contatosFromDB.length} contato${contatosFromDB.length !== 1 ? "s" : ""} carregado${contatosFromDB.length !== 1 ? "s" : ""} da base`,
    });
  };

  // Toggle client selection
  const toggleClienteSelecionado = (clientId: string) => {
    const novo = new Set(clientesSelecionados);
    if (novo.has(clientId)) {
      novo.delete(clientId);
    } else {
      novo.add(clientId);
    }
    setClientesSelecionados(novo);
  };

  // Select all clients
  const selecionarTodos = () => {
    const todosIds = new Set(clientesFiltrados.map((c) => c.id));
    setClientesSelecionados(todosIds);
  };

  // Select random clients
  const selecionarAleatorios = () => {
    if (quantidadeAleatoria <= 0) {
      toast({
        title: "Erro",
        description: "Digite uma quantidade válida",
        variant: "destructive",
      });
      return;
    }

    if (quantidadeAleatoria > clientesFiltrados.length) {
      toast({
        title: "Erro",
        description: `Máximo ${clientesFiltrados.length} clientes disponíveis`,
        variant: "destructive",
      });
      return;
    }

    const shuffled = [...clientesFiltrados].sort(() => Math.random() - 0.5);
    const selecionados = new Set(
      shuffled.slice(0, quantidadeAleatoria).map((c) => c.id)
    );
    setClientesSelecionados(selecionados);

    toast({
      title: "Sucesso",
      description: `${quantidadeAleatoria} cliente${quantidadeAleatoria !== 1 ? "s" : ""} selecionado${quantidadeAleatoria !== 1 ? "s" : ""} aleatoriamente`,
    });
  };

  // Replace variables in template (supports both {variavel} and {{variavel}} syntax)
  const substituirVariaveisNoTemplate = (texto: string, dados: ContactEntry): string => {
    let resultado = texto;
    for (const [chave, valor] of Object.entries(dados)) {
      // Support both {variavel} and {{variavel}} syntax
      const regex1 = new RegExp(`\\{\\{${chave}\\}\\}`, "g");
      const regex2 = new RegExp(`\\{${chave}\\}`, "g");
      resultado = resultado.replace(regex1, String(valor || ""));
      resultado = resultado.replace(regex2, String(valor || ""));
    }
    return resultado;
  };

  // Get preview for first contact
  const obterPreview = (): string => {
    if (contatos.length === 0) return template;
    return substituirVariaveisNoTemplate(template, contatos[0]);
  };

  // Send campaign
  const enviarCampanha = async () => {
    if (!template.trim()) {
      toast({
        title: "Erro",
        description: "Template está vazio",
        variant: "destructive",
      });
      return;
    }

    if (contatos.length === 0) {
      toast({
        title: "Erro",
        description: "Nenhum contato para enviar",
        variant: "destructive",
      });
      return;
    }

    if (tempoDelay < 10) {
      toast({
        title: "Erro",
        description: "Delay mínimo é 10 segundos",
        variant: "destructive",
      });
      return;
    }

    if (modoBackground) {
      // ===== BACKGROUND MODE (using unified endpoint) =====
      setEnviando(true);
      setConfirmarEnvio(false);

      try {
        // Get active session
        const sessaoRes = await fetch("/api/whatsapp/status");
        const sessao = await sessaoRes.json();
        
        if (!sessao?.sessionId) {
          throw new Error("WhatsApp não conectado. Conecte uma sessão primeiro.");
        }

        // Get client IDs and create filtros com TODOS os filtros aplicados
        const clientIds = contatos.map((c) => c.id || "").filter(Boolean);
        
        // Enviar para novo endpoint unificado com parâmetros corretos
        await apiRequest("POST", "/api/whatsapp/broadcast/send", {
          sessionId: sessao.sessionId,
          mensagem: template,
          filtros: { 
            clientIds,
            tipos: selectedTiposFilter.size > 0 ? Array.from(selectedTiposFilter) : undefined,
            carteiras: selectedCarteirasFilter.size > 0 ? Array.from(selectedCarteirasFilter) : undefined,
            cidades: selectedCidadesFilter.size > 0 ? Array.from(selectedCidadesFilter) : undefined,
          },
          campanhaNome: nomeCampanha || "Envio Imediato",
          origemDisparo: "envio_imediato",
          tempoFixoSegundos: tempoDelay,
          tempoAleatorioMin: tempoRandomMin,
          tempoAleatorioMax: tempoRandomMax,
        });

        // Show notification and allow navigation
        toast({
          title: "Campanha iniciada!",
          description: `${contatos.length} mensagens serão enviadas em background. Você pode continuar navegando!`,
        });

        // Atualizar UI em tempo real
        queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
        queryClient.invalidateQueries({ queryKey: ['/api/campaigns/scheduled'] });

        // Clear form and go back
        setContatos([]);
        setTextoPlanilha("");
        setTemplate("");
        setVariaveisDisponiveis([]);
        setStatusEnvio([]);
        
      } catch (error: any) {
        toast({
          title: "Erro",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setEnviando(false);
      }
    } else {
      // ===== NORMAL MODE (original com progresso visível) =====
      setEnviando(true);
      cancelarEnvioRef.current = false;
      setStatusEnvio(
        contatos.map((c) => ({
          telefone: c.whatsapp || c.numeroTelefone || c.telefone || c.celular || "???",
          clientId: c.id || "",
          status: "pendente" as const,
        }))
      );

      try {
        const clientesEnviadosComSucesso: string[] = [];

        for (let i = 0; i < contatos.length; i++) {
          if (cancelarEnvioRef.current) {
            toast({
              title: "Cancelado",
              description: "Envio cancelado pelo usuário",
              variant: "default",
            });
            break;
          }
          const contato = contatos[i];
          const telefone =
            contato.whatsapp ||
            contato.numeroTelefone ||
            contato.telefone ||
            contato.celular ||
            "";

          if (!telefone) continue;

          // Update status to sending
          setStatusEnvio((prev) =>
            prev.map((s) =>
              s.telefone === telefone ? { ...s, status: "enviando" } : s
            )
          );

          try {
            const mensagem = substituirVariaveisNoTemplate(template, contato);
            
            // ✅ Usa sessao.sessionId obtida no início da função
            const sessionIdToUse = sessao?.sessionId;
            if (!sessionIdToUse) {
              throw new Error("Nenhuma sessão WhatsApp conectada");
            }
            
            const response = await fetch("/api/whatsapp/broadcast/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId: sessionIdToUse,
                mensagem,
                campanhaNome: nomeCampanha || "Envio Imediato",
                origemDisparo: "envio_imediato",
                filtros: {
                  clientIds: [contato.id],
                },
              }),
            });

            if (response.ok) {
              setStatusEnvio((prev) =>
                prev.map((s) =>
                  s.telefone === telefone
                    ? {
                        ...s,
                        status: "sucesso",
                        timestamp: new Date().toLocaleTimeString("pt-BR"),
                      }
                    : s
                )
              );
              // Adicionar cliente à lista de enviados com sucesso
              if (contato.id) {
                clientesEnviadosComSucesso.push(contato.id);
              }
            } else {
              const erro = await response.text();
              setStatusEnvio((prev) =>
                prev.map((s) =>
                  s.telefone === telefone
                    ? {
                        ...s,
                        status: "erro",
                        erro: erro,
                        timestamp: new Date().toLocaleTimeString("pt-BR"),
                      }
                    : s
                )
              );
            }
          } catch (error: any) {
            setStatusEnvio((prev) =>
              prev.map((s) =>
                s.telefone === telefone
                  ? {
                      ...s,
                      status: "erro",
                      erro: error.message,
                      timestamp: new Date().toLocaleTimeString("pt-BR"),
                    }
                  : s
              )
            );
          }

          // Wait before next message with random variation to avoid bot detection
          if (i < contatos.length - 1) {
            const rangeExtra = (tempoRandomMax - tempoRandomMin) * 1000; // intervalo em ms
            const randomExtra = Math.random() * rangeExtra + (tempoRandomMin * 1000); // min + randomizado
            const totalDelay = (tempoDelay * 1000) + randomExtra;
            await new Promise((resolve) => setTimeout(resolve, totalDelay));
          }
        }

        // Atualizar status dos clientes que foram enviados com sucesso
        if (clientesEnviadosComSucesso.length > 0) {
          try {
            await apiRequest("POST", "/api/clients/bulk-status", {
              clientIds: clientesEnviadosComSucesso,
              status: "ENVIADO",
            });
          } catch (err) {
            console.error("Erro ao atualizar status dos clientes:", err);
          }
        }

        toast({
          title: "Sucesso",
          description: "Campanha concluída",
        });
        
        // Atualizar UI em tempo real
        queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
        queryClient.invalidateQueries({ queryKey: ['/api/campaigns/scheduled'] });
      } catch (error: any) {
        toast({
          title: "Erro",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setEnviando(false);
        setConfirmarEnvio(false);
      }
    }
  };

  if (!isAuthenticated) {
    return <div>Carregando...</div>;
  }

  const contatosProcessados = contatos.length;
  const sucessos = statusEnvio.filter((s) => s.status === "sucesso").length;
  const erros = statusEnvio.filter((s) => s.status === "erro").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header Section */}
      <div className="px-3 sm:px-6 py-4 sm:py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <div className="p-2 sm:p-3 bg-green-500/10 rounded-xl flex-shrink-0">
                  <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
                </div>
                <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent truncate">
                  Campanhas WhatsApp
                </h1>
              </div>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-2">
                Envie mensagens em massa personalizadas via WhatsApp
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-3 sm:px-6 pb-6 sm:pb-12">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
          {/* Stats Cards */}
          {contatosProcessados > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <Card className="p-4 sm:p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Contatos Carregados</p>
                    <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-2">{contatosProcessados}</p>
                  </div>
                  <div className="p-2 sm:p-3 bg-blue-500/10 rounded-lg flex-shrink-0">
                    <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </Card>

              <Card className="p-4 sm:p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Enviadas</p>
                    <p className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{sucessos}</p>
                  </div>
                  <div className="p-2 sm:p-3 bg-emerald-500/10 rounded-lg flex-shrink-0">
                    <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </Card>

              <Card className="p-4 sm:p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Erros</p>
                    <p className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400 mt-2">{erros}</p>
                  </div>
                  <div className="p-2 sm:p-3 bg-red-500/10 rounded-lg flex-shrink-0">
                    <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Tabs */}
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 overflow-hidden">
            <Tabs value={tabAtivo} onValueChange={setTabAtivo} className="space-y-4 p-3 sm:p-6">
              <TabsList className="grid grid-cols-4 bg-slate-100 dark:bg-slate-900">
                <TabsTrigger value="mensagens" className="text-slate-700 dark:text-slate-300">Mensagens</TabsTrigger>
                <TabsTrigger value="configuracao" className="text-slate-700 dark:text-slate-300">Configuração</TabsTrigger>
                <TabsTrigger value="progresso" className="text-slate-700 dark:text-slate-300">
                  Progresso {campanhasEmProgresso.length > 0 && `(${campanhasEmProgresso.length})`}
                </TabsTrigger>
                <TabsTrigger value="historico" className="text-slate-700 dark:text-slate-300">Histórico</TabsTrigger>
              </TabsList>

              {/* ===== ABA MENSAGENS ===== */}
              <TabsContent value="mensagens" className="space-y-4">
                {/* Campaign Progress Widget */}
                {campanhasEmProgresso.length > 0 && (
                  <div className="grid gap-4">
                    {campanhasEmProgresso.map((campanha) => (
                      <Card key={campanha.id} className="border-0 shadow-sm bg-gradient-to-r from-blue-500/5 to-transparent dark:from-blue-500/10">
                        <CardHeader>
                          <div className="flex justify-between items-center">
                            <CardTitle className="text-base text-slate-900 dark:text-white">Campanha em Progresso</CardTitle>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                {Math.round((campanha.enviadas / campanha.total) * 100)}%
                              </Badge>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => cancelarCampanhaMutation.mutate(campanha.id)}
                                disabled={cancelandoCampanha === campanha.id}
                                className="h-8 px-2 text-xs"
                                data-testid={`button-cancelar-campanha-${campanha.id}`}
                              >
                                {cancelandoCampanha === campanha.id ? (
                                  <>
                                    <Loader className="h-3 w-3 mr-1 animate-spin" />
                                    Cancelando...
                                  </>
                                ) : (
                                  <>
                                    <X className="h-3 w-3 mr-1" />
                                    Cancelar
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Progress value={(campanha.enviadas / campanha.total) * 100} />
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div className="text-center">
                              <div className="text-slate-600 dark:text-slate-400">Enviadas</div>
                              <div className="font-semibold text-emerald-600 dark:text-emerald-400">{campanha.enviadas}/{campanha.total}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-slate-600 dark:text-slate-400">Taxa</div>
                              <div className="font-semibold text-slate-900 dark:text-white">{Math.round((campanha.enviadas / campanha.total) * 100)}%</div>
                            </div>
                            <div className="text-center">
                              <div className="text-slate-600 dark:text-slate-400">Erros</div>
                              <div className={`font-semibold ${campanha.erros > 0 ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-400"}`}>{campanha.erros}</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
                  {/* Left Section: Contatos + Preview */}
                  <div className="space-y-4 sm:space-y-6">
                    {/* Input Card */}
                    <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50">
                      <CardHeader className="pb-3 sm:pb-4">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <CardTitle className="text-lg text-slate-900 dark:text-white">Contatos</CardTitle>
                            <CardDescription className="mt-1 text-slate-600 dark:text-slate-400">Cole seus dados ou importe da base</CardDescription>
                          </div>
                          {contatosProcessados > 0 && (
                            <Badge className="text-sm px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              {contatosProcessados} contato{contatosProcessados !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 sm:space-y-4">
                        <Textarea
                          placeholder="Cole aqui..."
                          value={textoPlanilha}
                          onChange={(e) => setTextoPlanilha(e.target.value)}
                          className="font-mono text-xs sm:text-sm h-40 sm:h-56 resize-none border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                          data-testid="textarea-contatos"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="default"
                            onClick={() => setMostrarSeletorBD(true)}
                            className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold h-10"
                            data-testid="button-importar-db"
                          >
                            <Download className="h-4 w-4 mr-1.5" />
                            Importar
                          </Button>
                          {contatos.length > 0 && (
                            <Button
                              variant="outline"
                              onClick={() => {
                                setContatos([]);
                                setTextoPlanilha("");
                                setVariaveisDisponiveis([]);
                              }}
                              className="w-full text-slate-700 dark:text-slate-200 font-semibold h-10 border-slate-300 dark:border-slate-600"
                              data-testid="button-limpar-contatos"
                            >
                              <Trash2 className="h-4 w-4 mr-1.5" />
                              Limpar
                            </Button>
                          )}
                        </div>
                        {variaveisDisponiveis.length > 0 && (
                          <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Variáveis Disponíveis:</div>
                            <div className="flex flex-wrap gap-2">
                              {variaveisDisponiveis.map((v) => (
                                <Badge key={v} variant="outline" className="text-xs font-mono border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                                  {"{"}
                                  {v}
                                  {"}"}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Preview Card */}
                    {contatos.length > 0 && (
                      <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm text-slate-900 dark:text-white">Visualização de Contatos</CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-hidden">
                          <div className="border border-slate-200 dark:border-slate-700 rounded-md overflow-auto max-h-64">
                            <Table className="text-xs">
                              <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-900">
                                <TableRow>
                                  {variaveisDisponiveis.slice(0, 4).map((v) => (
                                    <TableHead key={v} className="py-3 px-4 font-semibold text-xs text-slate-900 dark:text-white">
                                      {v}
                                    </TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {contatos.slice(0, 8).map((contato, idx) => (
                                  <TableRow key={idx} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                                    {variaveisDisponiveis.slice(0, 4).map((v) => (
                                      <TableCell key={`${idx}-${v}`} className="py-3 px-4 font-mono text-xs truncate text-slate-700 dark:text-slate-300">
                                        {contato[v] || "-"}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            {contatos.length > 8 && (
                              <div className="text-xs text-slate-600 dark:text-slate-400 p-3 border-t border-slate-200 dark:border-slate-700 text-center bg-slate-50 dark:bg-slate-900/30">
                                +{contatos.length - 8} contatos
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Right Section: Template Editor */}
                  <div className="space-y-4 sm:space-y-6">
                    <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50">
                      <CardHeader className="pb-3 sm:pb-4">
                        <CardTitle className="text-base sm:text-lg text-slate-900 dark:text-white">Mensagem</CardTitle>
                        <CardDescription className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">Use {"{variável}"} para personalizar</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3 sm:space-y-5">
                        {/* Template Selector */}
                        <div className="space-y-2">
                          <Label htmlFor="template-select" className="text-sm font-semibold text-slate-900 dark:text-white">Usar Modelo</Label>
                          <Select 
                            value={templateSelecionado}
                            onValueChange={(value) => {
                              setTemplateSelecionado(value);
                              const templ = templates.find((t: any) => t.id === value);
                              if (templ) {
                                setTemplate(templ.conteudo);
                              }
                            }}
                          >
                            <SelectTrigger id="template-select" className="border-slate-200 dark:border-slate-700" data-testid="select-template">
                              <SelectValue placeholder="Selecionar modelo (opcional)..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                              {templates.length > 0 ? (
                                templates.map((t: any) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.nome}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="vazio" disabled>
                                  Nenhum modelo disponível
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Divider */}
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                          </div>
                          <div className="relative flex justify-center text-xs">
                            <span className="px-2 bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-400">ou escreva aqui</span>
                          </div>
                        </div>

                        {/* Template Textarea */}
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Olá {empresa}!..."
                            value={template}
                            onChange={(e) => setTemplate(e.target.value)}
                            className="flex-1 font-mono text-xs sm:text-sm h-36 sm:h-48 resize-none border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                            data-testid="textarea-template"
                          />
                        </div>

                        {/* Live Preview - Auto display when template & contacts */}
                        {contatos.length > 0 && template.trim() && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4 space-y-2 animate-in fade-in">
                            <div className="font-semibold text-xs text-blue-600 dark:text-blue-400 mb-2">Visualização do 1º contato:</div>
                            <div className="whitespace-pre-wrap break-words text-sm font-mono leading-relaxed text-slate-900 dark:text-slate-100 max-h-40 overflow-y-auto bg-white dark:bg-slate-950 p-3 rounded border border-blue-200 dark:border-blue-800">
                              {obterPreview()}
                            </div>
                          </div>
                        )}
                        
                        {/* Placeholder if no contacts or template */}
                        {(contatos.length === 0 || !template.trim()) && (
                          <div className="text-xs text-slate-600 dark:text-slate-400 italic p-3 bg-slate-100 dark:bg-slate-900/30 rounded border border-dashed border-slate-300 dark:border-slate-700">
                            💡 {contatos.length === 0 ? "Cole ou importe contatos para ver preview" : "Digite sua mensagem para ver preview"}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Status Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
                  {/* Status Summary */}
                  <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-slate-900 dark:text-white">Resumo</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {statusEnvio.length > 0 ? (
                        <>
                          <div className="flex justify-between items-center text-sm text-slate-700 dark:text-slate-300">
                            <span>Enviados:</span>
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">{sucessos}</Badge>
                          </div>
                          <div className="flex justify-between items-center text-sm text-slate-700 dark:text-slate-300">
                            <span>Erros:</span>
                            <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">{erros}</Badge>
                          </div>
                          <div className="flex justify-between items-center text-sm text-slate-700 dark:text-slate-300">
                            <span>Pendentes:</span>
                            <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200">
                              {statusEnvio.filter((s) => s.status === "pendente" || s.status === "enviando")
                                .length}
                            </Badge>
                          </div>
                          <Progress
                            value={
                              statusEnvio.length > 0
                                ? (sucessos / statusEnvio.length) * 100
                                : 0
                            }
                            className="h-2"
                          />
                        </>
                      ) : (
                        <div className="text-slate-600 dark:text-slate-400 text-sm">Aguardando envio...</div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Status list */}
                  <Card className="lg:col-span-2 border-0 shadow-sm bg-white dark:bg-slate-800/50">
                    <CardHeader>
                      <CardTitle className="text-sm text-slate-900 dark:text-white">Status de Envio</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {statusEnvio.length > 0 ? (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {statusEnvio.map((s, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm p-2 bg-slate-100 dark:bg-slate-900/50 rounded">
                              <div className="flex-1 min-w-0">
                                <div className="font-mono text-xs truncate text-slate-900 dark:text-slate-100">{s.telefone}</div>
                                {s.erro && (
                                  <div className="text-xs text-red-600 dark:text-red-400 truncate">{s.erro}</div>
                                )}
                                {s.timestamp && (
                                  <div className="text-xs text-slate-600 dark:text-slate-400">{s.timestamp}</div>
                                )}
                              </div>
                              {s.status === "sucesso" && (
                                <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-1" />
                              )}
                              {s.status === "erro" && (
                                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
                              )}
                              {s.status === "enviando" && (
                                <Loader className="h-4 w-4 text-blue-500 flex-shrink-0 mt-1 animate-spin" />
                              )}
                              {s.status === "pendente" && (
                                <Clock className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-slate-600 dark:text-slate-400 text-sm text-center py-4">
                          Nenhum envio realizado
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-4">
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center flex-1">
                    <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                      {contatosProcessados > 0 ? (
                        <>
                          <span className="text-green-600 dark:text-green-400 font-bold">{contatosProcessados}</span>
                          {" contato"}
                          {contatosProcessados !== 1 ? "s" : ""}{" prontos"}
                        </>
                      ) : (
                        <span className="text-slate-500">Cole seus contatos para começar</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-0 border-l-2 border-l-slate-200 dark:border-l-slate-700 sm:border-l sm:border-l-slate-200">
                      <Label className="text-xs sm:text-sm font-medium cursor-pointer flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={modoBackground}
                          onChange={(e) => setModoBackground(e.target.checked)}
                          disabled={enviando}
                          className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 cursor-pointer"
                        />
                        <span className="whitespace-nowrap">Background</span>
                      </Label>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-1 sm:flex-initial">
                    {enviando && !modoBackground && (
                      <Button
                        onClick={() => {
                          cancelarEnvioRef.current = true;
                        }}
                        variant="destructive"
                        size="lg"
                        data-testid="button-cancelar-envio"
                        className="flex-1 sm:flex-initial h-10 sm:h-11 text-sm sm:text-base font-semibold"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancelar
                      </Button>
                    )}
                    <Button
                      onClick={() => {
                        if (!whatsappConnected) {
                          toast({
                            title: "WhatsApp não conectado",
                            description: "Por favor, conecte seu WhatsApp em /whatsapp antes de enviar campanhas.",
                            variant: "destructive",
                          });
                          return;
                        }
                        setConfirmarEnvio(true);
                      }}
                      disabled={
                        enviando ||
                        contatosProcessados === 0 ||
                        !template.trim() ||
                        tempoDelay < 10 ||
                        !whatsappConnected
                      }
                      size="lg"
                      className="flex-1 h-10 sm:h-11 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-semibold text-sm sm:text-base"
                      data-testid="button-enviar-campanha"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      <span className="whitespace-nowrap">
                        {!whatsappConnected ? "Desconectado" : enviando ? "Enviando..." : "Enviar"}
                      </span>
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* ===== ABA CONFIGURAÇÃO ===== */}
              <TabsContent value="configuracao" className="space-y-4">
                <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50">
                  <CardHeader>
                    <CardTitle className="text-slate-900 dark:text-white">Configurações da Campanha</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Nome da Campanha */}
                    <div className="space-y-3">
                      <Label htmlFor="nome-campanha" className="text-slate-900 dark:text-white">Nome da Campanha</Label>
                      <Input
                        id="nome-campanha"
                        type="text"
                        placeholder="Ex: Promoção Black Friday, Upsell Premium, etc"
                        value={nomeCampanha}
                        onChange={(e) => setNomeCampanha(e.target.value)}
                        className="border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                        data-testid="input-nome-campanha"
                      />
                      <p className="text-xs text-slate-600 dark:text-slate-400">Usado para histórico e identificação de envios</p>
                    </div>
                    {/* Delay */}
                    <div className="space-y-3">
                      <Label htmlFor="delay" className="text-slate-900 dark:text-white">Tempo de delay entre mensagens (segundos)</Label>
                      <div className="flex gap-4 items-end">
                        <div className="flex-1">
                          <Input
                            id="delay"
                            type="number"
                            min={10}
                            max={300}
                            value={tempoDelay}
                            onChange={(e) => setTempoDelay(Math.max(10, parseInt(e.target.value) || 10))}
                            className="border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                            data-testid="input-delay"
                          />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">{tempoDelay}s</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Recomendado: 30-60 segundos</p>
                    </div>

                    {/* Random Delay */}
                    <div className="space-y-3 border-t border-slate-200 dark:border-slate-700 pt-6">
                      <Label htmlFor="random-min" className="text-slate-900 dark:text-white">Variação aleatória (segundos)</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="random-min" className="text-sm text-slate-700 dark:text-slate-300">Mínimo</Label>
                          <Input
                            id="random-min"
                            type="number"
                            min={0}
                            max={30}
                            value={tempoRandomMin}
                            onChange={(e) => setTempoRandomMin(Math.max(0, parseInt(e.target.value) || 0))}
                            className="mt-1 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                            data-testid="input-random-min"
                          />
                        </div>
                        <div>
                          <Label htmlFor="random-max" className="text-sm text-slate-700 dark:text-slate-300">Máximo</Label>
                          <Input
                            id="random-max"
                            type="number"
                            min={0}
                            max={60}
                            value={tempoRandomMax}
                            onChange={(e) => setTempoRandomMax(Math.max(0, parseInt(e.target.value) || 0))}
                            className="mt-1 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                            data-testid="input-random-max"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Adiciona variação para parecer mais natural</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ===== ABA PROGRESSO ===== */}
              <TabsContent value="progresso" className="space-y-4">
                <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50">
                  <CardHeader>
                    <CardTitle className="text-slate-900 dark:text-white">Campanhas em Progresso</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {campanhasEmProgresso.length > 0 ? (
                      <div className="space-y-4">
                        {campanhasEmProgresso.map((campanha) => (
                          <div key={campanha.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-3">
                              <h4 className="font-medium text-slate-900 dark:text-white">Campanha {campanha.id.slice(0, 8)}</h4>
                              <div className="flex items-center gap-2">
                                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                  {Math.round((campanha.enviadas / campanha.total) * 100)}%
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => cancelarCampanhaMutation.mutate(campanha.id)}
                                  disabled={cancelandoCampanha === campanha.id}
                                  className="h-8 px-2 text-xs"
                                  data-testid={`button-cancelar-campanha-${campanha.id}`}
                                >
                                  {cancelandoCampanha === campanha.id ? (
                                    <>
                                      <Loader className="h-3 w-3 mr-1 animate-spin" />
                                      Cancelando...
                                    </>
                                  ) : (
                                    <>
                                      <X className="h-3 w-3 mr-1" />
                                      Cancelar
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                            <Progress value={(campanha.enviadas / campanha.total) * 100} className="mb-3" />
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div className="text-center">
                                <div className="text-slate-600 dark:text-slate-400">Enviadas</div>
                                <div className="font-bold text-slate-900 dark:text-white">{campanha.enviadas}/{campanha.total}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-slate-600 dark:text-slate-400">Taxa</div>
                                <div className="font-bold text-slate-900 dark:text-white">{Math.round((campanha.enviadas / campanha.total) * 100)}%</div>
                              </div>
                              <div className="text-center">
                                <div className="text-slate-600 dark:text-slate-400">Erros</div>
                                <div className={`font-bold ${campanha.erros > 0 ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-400"}`}>
                                  {campanha.erros}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                        Nenhuma campanha em progresso
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ===== ABA HISTÓRICO ===== */}
              <TabsContent value="historico" className="space-y-4">
                <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50">
                  <CardHeader>
                    <CardTitle className="text-slate-900 dark:text-white">Histórico de Campanhas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                      Histórico em breve
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmarEnvio} onOpenChange={setConfirmarEnvio}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a enviar {contatosProcessados} mensagem{contatosProcessados !== 1 ? "s" : ""} via WhatsApp.
              {modoBackground ? " A campanha será enviada em background." : " Você será notificado do progresso em tempo real."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel className="text-slate-700 dark:text-slate-200">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => enviarCampanha()}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-confirmar-envio"
            >
              Confirmar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Database Selector Dialog */}
      <Dialog open={mostrarSeletorBD} onOpenChange={setMostrarSeletorBD}>
        <DialogContent className="max-w-7xl h-[92vh] flex flex-col">
          <DialogHeader className="pb-3 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
            <DialogTitle className="text-xl text-slate-900 dark:text-white">Selecionar Clientes da Base de Dados</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
              Use os filtros para segmentar clientes, depois selecione e importe para sua campanha
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-3 py-3 px-1">
            {/* Filters Section - Compacto */}
            <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2 flex-shrink-0">
              {/* Linha 1: Busca e Status */}
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-56">
                  <Input
                    placeholder="Buscar por razão social ou telefone..."
                    value={searchClientes}
                    onChange={(e) => setSearchClientes(e.target.value)}
                    className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 h-9"
                    data-testid="input-search-clientes-db"
                  />
                </div>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-40 border-slate-200 dark:border-slate-700 h-9" data-testid="select-status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Status</SelectItem>
                    <SelectItem value="lead_quente">Lead quente</SelectItem>
                    <SelectItem value="engajado">Engajado</SelectItem>
                    <SelectItem value="em_negociacao">Em negociação</SelectItem>
                    <SelectItem value="em_fechamento">Em fechamento</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="perdido">Perdido</SelectItem>
                    <SelectItem value="remarketing">Remarketing</SelectItem>
                  </SelectContent>
                </Select>

                {/* Divider */}
                <div className="h-6 w-px bg-border" />

                {/* Período */}
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Período:</span>
                <Input
                  type="date"
                  value={dataEnvioInicio}
                  onChange={(e) => setDataEnvioInicio(e.target.value)}
                  placeholder="Data início"
                  className="w-40 border-slate-200 dark:border-slate-700 h-9"
                  data-testid="input-filtro-data-inicio"
                />
                <Input
                  type="date"
                  value={dataEnvioFim}
                  onChange={(e) => setDataEnvioFim(e.target.value)}
                  placeholder="Data fim"
                  className="w-40 border-slate-200 dark:border-slate-700 h-9"
                  data-testid="input-filtro-data-fim"
                />
              </div>

              {/* Linha 2: Filtros Multi-Select */}
              <div className="flex gap-2 flex-wrap items-center">
                <MultiSelectFilter
                  label="Tipo"
                  options={tiposDisponiveis}
                  selectedValues={selectedTiposFilter}
                  onSelectionChange={setSelectedTiposFilter}
                />

                <MultiSelectFilter
                  label="Carteira"
                  options={carteirasDisponiveis}
                  selectedValues={selectedCarteirasFilter}
                  onSelectionChange={setSelectedCarteirasFilter}
                />

                <MultiSelectFilter
                  label="Cidade"
                  options={cidadesDisponiveis.slice(0, 100)}
                  selectedValues={selectedCidadesFilter}
                  onSelectionChange={setSelectedCidadesFilter}
                />

                <MultiSelectFilter
                  label="Status Envio"
                  options={["enviado", "nao_enviado", "erro"]}
                  selectedValues={selectedSendStatusFilter}
                  onSelectionChange={setSelectedSendStatusFilter}
                />
              </div>

              {/* Linha 3: Tags */}
              <div className="flex gap-2 flex-wrap items-center">
                <Button
                  variant={selectedTag === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTag(null)}
                  data-testid="button-filter-all-tags"
                  className="h-8 px-2 text-xs rounded-full"
                >
                  Todas
                </Button>
                {tagsDisponiveis.length > 0 && tagsDisponiveis.map((tag) => (
                  <Button
                    key={tag.id}
                    variant={selectedTag === tag.nome ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTag(tag.nome)}
                    data-testid={`button-filter-tag-${tag.id}`}
                    className={`h-8 px-2 text-xs rounded-full ${
                      selectedTag === tag.nome ? `text-white` : ""
                    }`}
                    style={selectedTag === tag.nome ? { backgroundColor: tag.cor } : {}}
                  >
                    {tag.nome}
                  </Button>
                ))}
              </div>

              {/* Linha 4: Quick Actions */}
              {clientesFiltrados.length > 0 && filtersInitiated && (
                <div className="flex gap-2 items-center flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selecionarTodos}
                    disabled={clientesFiltrados.length === 0}
                    data-testid="button-select-all-filters"
                    className="h-8 text-xs"
                  >
                    ✓ Selecionar Todos
                  </Button>
                  <div className="flex gap-1 items-center">
                    <Input
                      type="number"
                      min={1}
                      max={clientesFiltrados.length}
                      value={quantidadeAleatoria}
                      onChange={(e) => setQuantidadeAleatoria(Math.max(1, parseInt(e.target.value) || 1))}
                      className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 h-8 w-14 text-xs"
                      data-testid="input-quantidade-aleatoria-filters"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={selecionarAleatorios}
                      disabled={clientesFiltrados.length === 0}
                      className="h-8 text-xs"
                      data-testid="button-selecionar-aleatorios-filters"
                    >
                      🎲 Aleatórios
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setClientesSelecionados(new Set())}
                    disabled={clientesSelecionados.size === 0}
                    data-testid="button-deselect-all-filters"
                    className="h-8 text-xs"
                  >
                    ✕ Limpar
                  </Button>
                </div>
              )}

              {/* Info Line: Counter - ✅ Mostra total do servidor */}
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 pt-1">
                <span className="text-blue-600 dark:text-blue-400">{totalClientes > 0 ? totalClientes : clientesFiltrados.length}</span>
                {" cliente" + (totalClientes !== 1 ? "s" : "")} 
                {allLoadedClientes.length < totalClientes && (
                  <span className="text-slate-500"> ({allLoadedClientes.length} carregados)</span>
                )}
                {clientesSelecionados.size > 0 && <span className="ml-2">• <span className="text-green-600 dark:text-green-400">{clientesSelecionados.size}</span> selecionado{clientesSelecionados.size !== 1 ? "s" : ""}</span>}
              </div>
            </div>

            {/* ✅ LISTA DE CLIENTES - Layout Compacto Inline */}
            {!filtersInitiated ? (
              <div className="flex-1 flex items-center justify-center text-slate-600 dark:text-slate-400">
                <div className="text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <div className="text-lg font-medium mb-2">Selecione filtros para começar</div>
                  <p className="text-sm">Clique em um filtro acima para carregar clientes</p>
                </div>
              </div>
            ) : carregandoClientes && currentPage === 1 ? (
              <div className="flex-1 flex items-center justify-center text-slate-600 dark:text-slate-400">
                <div className="text-center">
                  <Loader className="h-8 w-8 animate-spin mx-auto mb-2" />
                  Carregando clientes...
                </div>
              </div>
            ) : (
              <ScrollArea className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950">
                <div className="p-3">
                  {clientesFiltrados.length > 0 ? (
                    <div className="space-y-1.5">
                      {clientesFiltrados.map((client) => (
                        <div
                          key={client.id}
                          onClick={() => toggleClienteSelecionado(client.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors border ${
                            clientesSelecionados.has(client.id) 
                              ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' 
                              : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/70 border-transparent'
                          }`}
                          data-testid={`row-cliente-${client.id}`}
                        >
                          <Checkbox
                            checked={clientesSelecionados.has(client.id)}
                            onCheckedChange={() => toggleClienteSelecionado(client.id)}
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`checkbox-cliente-${client.id}`}
                            className="flex-shrink-0"
                          />
                          {/* Nome truncado */}
                          <div className="flex-1 min-w-0 truncate font-medium text-sm text-slate-900 dark:text-white">
                            {client.nome}
                          </div>
                          {/* Telefone */}
                          <div className="flex-shrink-0 text-xs text-slate-600 dark:text-slate-400 font-mono">
                            {client.celular}
                          </div>
                          {/* Status Badge */}
                          <Badge variant="outline" className="flex-shrink-0 text-[10px] px-1.5 py-0 h-5 capitalize">
                            {client.status || 'N/A'}
                          </Badge>
                          {/* Carteira Badge */}
                          {client.carteira && (
                            <Badge variant="secondary" className="flex-shrink-0 text-[10px] px-1.5 py-0 h-5 max-w-[80px] truncate">
                              {client.carteira}
                            </Badge>
                          )}
                          {/* Send Status Badge */}
                          <Badge 
                            className={`flex-shrink-0 text-[10px] px-1.5 py-0 h-5 ${
                              client.sendStatus === 'enviado' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' 
                                : client.sendStatus === 'erro' 
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' 
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {client.sendStatus === 'enviado' ? '✓' : client.sendStatus === 'erro' ? '✕' : '○'}
                          </Badge>
                        </div>
                      ))}
                      
                      {/* ✅ Botão Carregar Mais */}
                      {currentPage < totalPages && (
                        <div className="pt-3 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => p + 1)}
                            disabled={isFetching}
                            className="w-full"
                            data-testid="button-carregar-mais"
                          >
                            {isFetching ? (
                              <>
                                <Loader className="h-4 w-4 animate-spin mr-2" />
                                Carregando...
                              </>
                            ) : (
                              <>
                                Carregar mais ({allLoadedClientes.length} de {totalClientes})
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-16 text-slate-600 dark:text-slate-400">
                      <div className="text-lg font-medium mb-2">Nenhum cliente encontrado</div>
                      <p className="text-sm">Ajuste os filtros e tente novamente</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}

            {/* Quick Actions */}
            {clientesFiltrados.length > 0 && filtersInitiated && (
              <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 rounded-lg p-2 flex gap-2 items-center flex-wrap flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selecionarTodos}
                  disabled={clientesFiltrados.length === 0}
                  className="h-8 text-xs"
                  data-testid="button-selecionar-todos"
                >
                  ✓ Selecionar Todos
                </Button>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    min={1}
                    max={clientesFiltrados.length}
                    value={quantidadeAleatoria}
                    onChange={(e) => setQuantidadeAleatoria(Math.max(1, parseInt(e.target.value) || 1))}
                    className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 h-8 w-16 text-xs"
                    data-testid="input-quantidade-aleatoria"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selecionarAleatorios}
                    disabled={clientesFiltrados.length === 0}
                    className="h-8 text-xs"
                    data-testid="button-selecionar-aleatorios"
                  >
                    🎲 Aleatórios
                  </Button>
                </div>
                <div className="h-5 w-px bg-border" />
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  Selecionados: <span className="text-green-600 dark:text-green-400 font-semibold">{clientesSelecionados.size}</span> / {clientesFiltrados.length}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button
              variant="outline"
              onClick={() => setMostrarSeletorBD(false)}
              className="text-slate-700 dark:text-slate-200"
            >
              Cancelar
            </Button>
            <Button
              onClick={importarSelecionadosDoBD}
              disabled={clientesSelecionados.size === 0}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-importar-selecionados"
            >
              ✓ Importar {clientesSelecionados.size > 0 && `(${clientesSelecionados.size})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
