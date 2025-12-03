import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// Hook para debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Tipo para clientes na listagem
interface ClientForImport {
  id: string;
  nome: string;
  celular: string;
  email?: string;
  status?: string;
  cidade?: string;
  tipo?: string;
  carteira?: string;
  sendStatus?: string;
  tags?: { id: string; nome: string; cor: string }[];
}
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCampaignSchema, type Campaign, type Template } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Trash2, Clock, X, AlertCircle, Loader2, Calendar, CheckCircle, Users, Loader } from "lucide-react";
import { SearchFilter } from "@/components/search-filter";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MultiSelectFilter } from "@/components/multi-select-filter";

// Conversão de fuso horário para São Paulo (UTC-3)
const convertToSaoPauloDate = (isoDate: string) => {
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return "";
    // Converter de UTC para São Paulo (subtract 3 hours)
    const spDate = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    return spDate.toISOString().slice(0, 16);
  } catch {
    return "";
  }
};

const convertFromSaoPauloDate = (dateTimeLocal: string) => {
  try {
    // dateTimeLocal é "YYYY-MM-DDTHH:mm" interpretado como São Paulo local
    const isoString = dateTimeLocal + ":00Z"; // Parse como UTC
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return new Date().toISOString();
    
    // Agora temos a hora em UTC. Mas queremos que seja São Paulo (UTC-3)
    // Se usuário escolheu 16:00, quer dizer 16:00 SP = 19:00 UTC
    // Então adiciona 3 horas
    const spDate = new Date(date.getTime() + 3 * 60 * 60 * 1000);
    return spDate.toISOString();
  } catch {
    return new Date().toISOString();
  }
};

export default function CampanhasAgendadas() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { connected: whatsappConnected } = useWhatsAppStatus();
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [clientesSelecionados, setClientesSelecionados] = useState<Set<string>>(new Set());
  const [searchClientes, setSearchClientes] = useState("");
  const [quantidadeSelecar, setQuantidadeSelecar] = useState(10);
  const [orderBy, setOrderBy] = useState<"recent" | "oldest">("recent");
  const [quantidadeAleatoria, setQuantidadeAleatoria] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [dataEnvioInicio, setDataEnvioInicio] = useState("");
  const [dataEnvioFim, setDataEnvioFim] = useState("");
  const [selectedTiposFilter, setSelectedTiposFilter] = useState<Set<string>>(new Set());
  const [selectedCarteirasFilter, setSelectedCarteirasFilter] = useState<Set<string>>(new Set());
  const [selectedCidadesFilter, setSelectedCidadesFilter] = useState<Set<string>>(new Set());
  const [selectedSendStatusFilter, setSelectedSendStatusFilter] = useState<Set<string>>(new Set());
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState<string>("all");
  const [selectedEngajamentoFilter, setSelectedEngajamentoFilter] = useState<Set<string>>(new Set());
  const [selectedEtiquetaFilter, setSelectedEtiquetaFilter] = useState<Set<string>>(new Set());
  // ✅ Inicia como true para carregar clientes automaticamente ao abrir seletor
  const [filtersInitiated, setFiltersInitiated] = useState(true);
  
  // ✅ Estados de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [limitPerPage, setLimitPerPage] = useState(50); // ✅ Limite configurável
  const [allLoadedClientes, setAllLoadedClientes] = useState<ClientForImport[]>([]);
  const [totalClientes, setTotalClientes] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // ✅ Debounce do search (300ms)
  const debouncedSearch = useDebounce(searchClientes, 300);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Não autorizado",
        description: "Você precisa estar logado. Redirecionando...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns/scheduled"],
    queryFn: async () => {
      const res = await fetch("/api/campaigns/scheduled");
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      const data = await res.json();
      return Array.isArray(data) ? data.filter((c: any) => c.status === 'agendada') : [];
    },
    refetchInterval: 3000,
    enabled: isAuthenticated,
  });

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Fetch tags
  const { data: tagsDisponiveis = [] } = useQuery<any[]>({
    queryKey: ["/api/tags"],
    enabled: isAuthenticated && showClientSelector,
  });

  // Fetch tipos
  const { data: tiposDisponiveis = [] } = useQuery<string[]>({
    queryKey: ["/api/clients/tipos"],
    enabled: isAuthenticated && showClientSelector,
  });

  // Fetch carteiras
  const { data: carteirasDisponiveis = [] } = useQuery<string[]>({
    queryKey: ["/api/clients/carteiras"],
    enabled: isAuthenticated && showClientSelector,
  });

  // Fetch cidades
  const { data: cidadesDisponiveis = [] } = useQuery<string[]>({
    queryKey: ["/api/clients/cidades"],
    enabled: isAuthenticated && showClientSelector,
  });

  // Fetch campanhas concluídas para filtro
  const { data: campanhasParaFiltro = [] } = useQuery<{id: string; nome: string}[]>({
    queryKey: ["/api/campaigns/for-filter"],
    queryFn: async () => {
      const res = await fetch("/api/campaigns/for-filter");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && showClientSelector,
  });

  // ✅ Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
    setAllLoadedClientes([]);
  }, [selectedTiposFilter, selectedCarteirasFilter, selectedCidadesFilter, selectedSendStatusFilter, selectedCampaignFilter, selectedEngajamentoFilter, selectedEtiquetaFilter, debouncedSearch, filtroStatus, selectedTag, limitPerPage]);

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
      limitPerPage,
      Array.from(selectedTiposFilter).sort().join(","),
      Array.from(selectedCarteirasFilter).sort().join(","),
      Array.from(selectedCidadesFilter).sort().join(","),
      Array.from(selectedSendStatusFilter).sort().join(","),
      selectedCampaignFilter,
      Array.from(selectedEngajamentoFilter).sort().join(","),
      Array.from(selectedEtiquetaFilter).sort().join(","),
      debouncedSearch,
      filtroStatus,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      params.append('limit', String(limitPerPage));
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
      if (selectedCampaignFilter && selectedCampaignFilter !== 'all') {
        params.append('campaignId', selectedCampaignFilter);
      }
      if (selectedEngajamentoFilter.size > 0) {
        params.append('engajamento', Array.from(selectedEngajamentoFilter).join(','));
      }
      if (selectedEtiquetaFilter.size > 0) {
        params.append('etiqueta', Array.from(selectedEtiquetaFilter).join(','));
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
    enabled: isAuthenticated && showClientSelector && filtersInitiated,
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
          const newClients = clientesResponse.data.filter((c: ClientForImport) => !existingIds.has(c.id));
          return [...prev, ...newClients];
        });
      }
      setTotalClientes(clientesResponse.total);
      setTotalPages(clientesResponse.totalPages);
    }
  }, [clientesResponse, currentPage]);

  // ✅ Compatibilidade: alias para código existente
  const clientesDisponiveis = allLoadedClientes;

  // ✅ FILTROS AGORA SÃO SERVER-SIDE - clientesDisponiveis já vem filtrado
  // Apenas filtro por tag local se necessário (tags não estão no server filter ainda)
  const clientesFiltrados = useMemo(() => {
    if (!selectedTag) return clientesDisponiveis;
    return clientesDisponiveis.filter((c: ClientForImport) => c.tags && c.tags.some(t => t.nome === selectedTag));
  }, [clientesDisponiveis, selectedTag]);

  // Funções de seleção de clientes
  const selecionarTodos = () => {
    const todosIds = new Set(clientesFiltrados.map((c) => c.id));
    setClientesSelecionados(todosIds);
  };

  const selecionarAleatorios = () => {
    const quantidade = parseInt(quantidadeAleatoria) || 50;
    if (quantidade <= 0 || quantidade > clientesFiltrados.length) {
      toast({
        title: "Erro",
        description: `Quantidade deve estar entre 1 e ${clientesFiltrados.length}`,
        variant: "destructive",
      });
      return;
    }
    const shuffled = [...clientesFiltrados].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, quantidade);
    setClientesSelecionados(new Set(selected.map((c) => c.id)));
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

  // Import selected clients
  const importarSelecionadosDoBD = () => {
    if (clientesSelecionados.size === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um cliente",
        variant: "destructive",
      });
      return;
    }

    const quantidadeSelecionada = clientesSelecionados.size;
    const clientIds = Array.from(clientesSelecionados);
    
    // Store selected clients in filtros
    form.setValue("filtros", { clientIds });
    form.setValue("totalRecipients", quantidadeSelecionada);
    
    setShowClientSelector(false);
    setSearchClientes("");

    toast({
      title: "Sucesso",
      description: `${quantidadeSelecionada} cliente${quantidadeSelecionada !== 1 ? "s" : ""} selecionado${quantidadeSelecionada !== 1 ? "s" : ""}`,
    });
  };

  const form = useForm({
    resolver: zodResolver(insertCampaignSchema),
    defaultValues: {
      nome: "",
      tipo: "whatsapp" as const,
      templateId: "",
      status: "agendada" as const,
      totalRecipients: 0,
      agendadaPara: new Date().toISOString(),
      filtros: {},
      tempoFixoSegundos: 21,
      tempoAleatorioMin: 10,
      tempoAleatorioMax: 60,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!whatsappConnected) {
        throw new Error("WhatsApp não está conectado. Por favor, conecte antes de agendar.");
      }
      return apiRequest("POST", "/api/campaigns/schedule", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/scheduled"] });
      form.reset();
      setShowForm(false);
      toast({
        title: "Campanha agendada",
        description: "Sua campanha foi agendada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao agendar campanha",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/campaigns/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/scheduled"] });
      setDeleteId(null);
      toast({
        title: "Campanha removida",
        description: "Sua campanha agendada foi removida.",
      });
    },
  });

  if (authLoading || !isAuthenticated) {
    return <CampaignesSkeleton />;
  }

  const agendadasCount = campaigns.filter(c => c.status === 'agendada').length;
  const proximasCount = campaigns.filter(c => {
    const data = new Date(c.agendadaPara || '');
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    data.setHours(0, 0, 0, 0);
    return data.getTime() === hoje.getTime();
  }).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header Section */}
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-orange-500/10 rounded-xl">
                  <Calendar className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
                  Campanhas Agendadas
                </h1>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mt-2">
                Agende campanhas WhatsApp para serem enviadas automaticamente
              </p>
            </div>
            <Button 
              onClick={() => setShowForm(!showForm)}
              className="bg-orange-600 hover:bg-orange-700 text-white" 
              data-testid="button-schedule-campaign"
            >
              <Plus className="h-4 w-4 mr-2" />
              Agendar Campanha
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 pb-12">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Agendadas</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{agendadasCount}</p>
                </div>
                <div className="p-3 bg-orange-500/10 rounded-lg">
                  <Calendar className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Próximas Hoje</p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">{proximasCount}</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">WhatsApp</p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                    {whatsappConnected ? "✓ Conectado" : "✗ Offline"}
                  </p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </Card>
          </div>

          {/* Create New Campaign Form */}
          {showForm && (
            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Agendar Nova Campanha</h2>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((data) => {
                    if (!data.nome || data.nome.trim() === "") {
                      toast({
                        title: "Erro",
                        description: "Preencha o nome da campanha",
                        variant: "destructive",
                      });
                      return;
                    }
                    if (!data.templateId) {
                      toast({
                        title: "Erro",
                        description: "Selecione um modelo de mensagem",
                        variant: "destructive",
                      });
                      return;
                    }
                    if (!data.agendadaPara) {
                      toast({
                        title: "Erro",
                        description: "Selecione a data e hora de envio",
                        variant: "destructive",
                      });
                      return;
                    }
                    if (clientesSelecionados.size === 0) {
                      toast({
                        title: "Erro",
                        description: "Selecione pelo menos um cliente",
                        variant: "destructive",
                      });
                      return;
                    }
                    createMutation.mutate({
                      ...data,
                      filtros: {
                        clientIds: Array.from(clientesSelecionados),
                        orderBy,
                        quantidadeAleatoria,
                      },
                      totalRecipients: clientesSelecionados.size,
                    });
                  })}
                  className="space-y-4"
                >
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Campanha</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Oferta de Verão"
                          {...field}
                          data-testid="input-campaign-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="templateId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo de Mensagem</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-template">
                            <SelectValue placeholder="Selecione um modelo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {templates
                            .filter((t) => t.tipo === "whatsapp")
                            .map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.nome}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel>Clientes</FormLabel>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowClientSelector(true)}
                      className="flex-1"
                      data-testid="button-select-clients"
                    >
                      {form.watch("totalRecipients") > 0
                        ? `${form.watch("totalRecipients")} cliente${form.watch("totalRecipients") !== 1 ? "s" : ""} selecionado${form.watch("totalRecipients") !== 1 ? "s" : ""}`
                        : "Selecionar Clientes"}
                    </Button>
                  </div>
                </FormItem>

                <FormField
                  control={form.control}
                  name="agendadaPara"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data e Hora de Envio</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          data-testid="input-schedule-datetime"
                          value={
                            field.value
                              ? convertToSaoPauloDate(field.value)
                              : ""
                          }
                          onChange={(e) => {
                            if (e.target.value) {
                              field.onChange(
                                convertFromSaoPauloDate(e.target.value)
                              );
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="tempoFixoSegundos"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tempo Fixo (segundos)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="300"
                            placeholder="Ex: 21"
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            data-testid="input-tempo-fixo"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tempoAleatorioMin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aleatorio Mín. (seg)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="300"
                            placeholder="Ex: 10"
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            data-testid="input-tempo-aleatorio-min"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tempoAleatorioMax"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aleatorio Máx. (seg)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="300"
                            placeholder="Ex: 60"
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            data-testid="input-tempo-aleatorio-max"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded text-sm text-muted-foreground">
                  <Clock className="w-4 h-4 inline mr-2" />
                  A campanha será enviada automaticamente na data e hora
                  escolhida para todos os clientes selecionados
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-save-schedule"
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Agendando...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Agendar
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      form.reset();
                      setClientesSelecionados(new Set());
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Form>
            </Card>
          )}

          {/* Cliente Selector Dialog */}
      <Dialog open={showClientSelector} onOpenChange={setShowClientSelector}>
        <DialogContent className="max-w-7xl h-[92vh] flex flex-col">
          <DialogHeader className="pb-3 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
            <DialogTitle className="text-xl text-slate-900 dark:text-white">Selecionar Clientes</DialogTitle>
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
                  <SearchFilter
                    placeholder="Buscar por razão social ou telefone..."
                    value={searchClientes}
                    onChange={setSearchClientes}
                    testId="input-search-clientes-db"
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
                {/* ✅ Seletor de Limite */}
                <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 px-3 py-1 rounded-lg border border-orange-200 dark:border-orange-800">
                  <Label className="text-xs font-semibold text-orange-700 dark:text-orange-300 whitespace-nowrap">Exibir:</Label>
                  <Select value={String(limitPerPage)} onValueChange={(v) => setLimitPerPage(Number(v))}>
                    <SelectTrigger className="w-24 h-7 text-xs bg-white dark:bg-slate-800" data-testid="select-limit-per-page">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50 por vez</SelectItem>
                      <SelectItem value="100">100 por vez</SelectItem>
                      <SelectItem value="200">200 por vez</SelectItem>
                      <SelectItem value="500">500 por vez</SelectItem>
                      <SelectItem value="99999">Todos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
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
                  label="Status de Envio"
                  options={["enviado", "entregue", "lido", "erro"]}
                  selectedValues={selectedSendStatusFilter}
                  onSelectionChange={setSelectedSendStatusFilter}
                />

                <MultiSelectFilter
                  label="Engajamento"
                  options={["alto", "medio", "baixo", "nenhum"]}
                  selectedValues={selectedEngajamentoFilter}
                  onSelectionChange={setSelectedEngajamentoFilter}
                />

                <MultiSelectFilter
                  label="Etiqueta"
                  options={["Respondeu", "Visualizado", "Entregue", "Enviado", "Erro no envio"]}
                  selectedValues={selectedEtiquetaFilter}
                  onSelectionChange={setSelectedEtiquetaFilter}
                />

                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium whitespace-nowrap">Campanha:</Label>
                  <Select value={selectedCampaignFilter} onValueChange={setSelectedCampaignFilter}>
                    <SelectTrigger className="w-48 h-8 text-xs" data-testid="select-campaign-filter">
                      <SelectValue placeholder="Todas as campanhas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as campanhas</SelectItem>
                      {campanhasParaFiltro && campanhasParaFiltro.length > 0 && campanhasParaFiltro.map((camp) => (
                        <SelectItem key={camp.id} value={camp.id}>{camp.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                    onClick={() => setClientesSelecionados(new Set(clientesFiltrados.map((c) => c.id)))}
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
                      onChange={(e) => setQuantidadeAleatoria(e.target.value)}
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
                  size="sm"
                  variant="outline"
                  onClick={() => setClientesSelecionados(new Set(clientesFiltrados.map((c) => c.id)))}
                  disabled={clientesFiltrados.length === 0}
                  data-testid="button-select-all-quick"
                  className="h-8 text-xs"
                >
                  ✓ Selecionar Todos
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setClientesSelecionados(new Set())}
                  disabled={clientesSelecionados.size === 0}
                  data-testid="button-deselect-all"
                  className="h-8 text-xs"
                >
                  ✕ Desselecionar
                </Button>
                <div className="h-5 w-px bg-border" />
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  Selecionados: <span className="text-green-600 dark:text-green-400 font-semibold">{clientesSelecionados.size}</span> / {clientesFiltrados.length}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowClientSelector(false);
                setClientesSelecionados(new Set());
                setSearchClientes("");
              }}
              data-testid="button-cancelar-seletor"
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={importarSelecionadosDoBD}
              disabled={clientesSelecionados.size === 0}
              data-testid="button-confirmar-seletor"
            >
              Confirmar ({clientesSelecionados.size})
            </Button>
          </div>
        </DialogContent>
      </Dialog>

          {/* Campaigns Table */}
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Campanha</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Data/Hora</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Destinatários</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingCampaigns ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      </TableRow>
                    ))
                  ) : campaigns && campaigns.length > 0 ? (
                    campaigns.map((campaign) => (
                      <TableRow 
                        key={campaign.id}
                        className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                        data-testid={`campaign-row-${campaign.id}`}
                      >
                        <TableCell>
                          <span className="font-medium text-slate-900 dark:text-white">{campaign.nome}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              {campaign.agendadaPara ? format(new Date(campaign.agendadaPara), "dd/MM HH:mm", { locale: ptBR }) : "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {campaign.totalRecipients} {campaign.totalRecipients === 1 ? "cliente" : "clientes"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="text-xs bg-orange-500/20 text-orange-700 dark:text-orange-300">
                            Agendada
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteId(campaign.id)}
                            data-testid={`button-delete-campaign-${campaign.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12">
                        <div className="text-slate-500 dark:text-slate-400">
                          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
                          <p className="font-medium">Nenhuma campanha agendada</p>
                          <p className="text-sm mt-1">
                            Agende sua primeira campanha para começar
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta campanha agendada? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete-campaign"
            >
              Remover
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CampaignesSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
      </div>
      <div className="px-6 pb-12">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
                <Skeleton className="h-20 w-full" />
              </Card>
            ))}
          </div>
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50">
            <div className="p-6">
              <Skeleton className="h-64 w-full" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
