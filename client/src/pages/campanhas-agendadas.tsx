import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { DateRangeFilter } from "@/components/date-range-filter";

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
  const [dataEnvioInicio, setDataEnvioInicio] = useState<Date | undefined>();
  const [dataEnvioFim, setDataEnvioFim] = useState<Date | undefined>();
  const [selectedTiposFilter, setSelectedTiposFilter] = useState<Set<string>>(new Set());
  const [selectedCarteirasFilter, setSelectedCarteirasFilter] = useState<Set<string>>(new Set());
  const [selectedCidadesFilter, setSelectedCidadesFilter] = useState<Set<string>>(new Set());
  const [selectedSendStatusFilter, setSelectedSendStatusFilter] = useState<Set<string>>(new Set());
  const [filtersInitiated, setFiltersInitiated] = useState(false);

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

  const { data: clients = [], isLoading: carregandoClientes } = useQuery<any[]>({
    queryKey: ["/api/clients/whatsapp-list"],
    queryFn: async () => {
      const res = await fetch("/api/clients/whatsapp-list");
      if (!res.ok) throw new Error("Failed to fetch clients");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: isAuthenticated && showClientSelector && filtersInitiated,
  });

  // Detect when filters are initiated
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

  // Filter clients by all criteria
  const clientesFiltrados = clients
    .filter((c) => {
      const searchMatch = c.nome.toLowerCase().includes(searchClientes.toLowerCase()) ||
        c.razaoSocial?.toLowerCase().includes(searchClientes.toLowerCase()) ||
        c.telefone.includes(searchClientes);
      const statusMatch = filtroStatus === "todos" || c.status?.toLowerCase() === filtroStatus.toLowerCase();
      const tagMatch = selectedTag === null || (c.tags && c.tags.some((t: any) => t.nome === selectedTag));
      const tipoMatch = selectedTiposFilter.size === 0 || (c.tipo && selectedTiposFilter.has(c.tipo));
      const carteiraMatch = selectedCarteirasFilter.size === 0 || (c.carteira && selectedCarteirasFilter.has(c.carteira));
      const cidadeMatch = selectedCidadesFilter.size === 0 || (c.cidade && selectedCidadesFilter.has(c.cidade));
      const sendStatusMatch = selectedSendStatusFilter.size === 0 || (c.sendStatus && selectedSendStatusFilter.has(c.sendStatus));
      return searchMatch && statusMatch && tagMatch && tipoMatch && carteiraMatch && cidadeMatch && sendStatusMatch;
    })
    .sort((a, b) => {
      if (orderBy === "recent") {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      } else {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
    });


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
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="proposta">Proposta</SelectItem>
                    <SelectItem value="fechado">Fechado</SelectItem>
                    <SelectItem value="perdido">Perdido</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>

                {/* Divider */}
                <div className="h-6 w-px bg-border" />

                {/* Período */}
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Período:</span>
                <DateRangeFilter
                  startDate={dataEnvioInicio}
                  endDate={dataEnvioFim}
                  onStartDateChange={setDataEnvioInicio}
                  onEndDateChange={setDataEnvioFim}
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

              {/* Info Line: Counter */}
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 pt-1">
                <span className="text-blue-600 dark:text-blue-400">{clientesFiltrados.length}</span>
                {" cliente" + (clientesFiltrados.length !== 1 ? "s" : "")} •
                {clientesSelecionados.size > 0 && <span className="ml-2"><span className="text-green-600 dark:text-green-400">{clientesSelecionados.size}</span> selecionado{clientesSelecionados.size !== 1 ? "s" : ""}</span>}
              </div>
            </div>

            {/* Clients List - Expanded */}
            {!filtersInitiated ? (
              <div className="flex-1 flex items-center justify-center text-slate-600 dark:text-slate-400">
                <div className="text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <div className="text-lg font-medium mb-2">Selecione filtros para começar</div>
                  <p className="text-sm">Clique em um filtro acima para carregar clientes</p>
                </div>
              </div>
            ) : carregandoClientes ? (
              <div className="flex-1 flex items-center justify-center text-slate-600 dark:text-slate-400">
                <div className="text-center">
                  <Loader className="h-8 w-8 animate-spin mx-auto mb-2" />
                  Carregando clientes...
                </div>
              </div>
            ) : (
              <ScrollArea className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950">
                <div className="p-6">
                  {clientesFiltrados.length > 0 ? (
                    <div className="space-y-3">
                      {clientesFiltrados.map((client) => (
                        <div
                          key={client.id}
                          className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors border border-slate-100 dark:border-slate-800"
                          data-testid={`card-cliente-${client.id}`}
                        >
                          <Checkbox
                            checked={clientesSelecionados.has(client.id)}
                            onCheckedChange={() => toggleClienteSelecionado(client.id)}
                            data-testid={`checkbox-cliente-${client.id}`}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-white text-base">{client.razaoSocial || client.nome}</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400 mt-1 space-y-1">
                              <div>📞 {client.telefone}</div>
                              {client.email && <div>✉️ {client.email}</div>}
                              {client.status && <div>Status: <span className="font-medium capitalize text-slate-700 dark:text-slate-300">{client.status}</span></div>}
                              {client.cidade && <div>📍 {client.cidade}</div>}
                              {client.tipo && <div>Tipo: <span className="font-medium text-slate-700 dark:text-slate-300">{client.tipo}</span></div>}
                              {client.carteira && <div>Carteira: <span className="font-medium text-slate-700 dark:text-slate-300">{client.carteira}</span></div>}
                              {client.sendStatus && <div>Envio: <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">{client.sendStatus === 'nao_enviado' ? 'Não Enviado' : client.sendStatus}</span></div>}
                            </div>
                          </div>
                        </div>
                      ))}
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
