import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SearchFilter } from "@/components/search-filter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, GripVertical, User, DollarSign, Trash2, Edit2, TrendingUp, Zap, Settings, MessageCircle } from "lucide-react";
import type { Opportunity, KanbanStage } from "@shared/schema";
import { insertOpportunitySchema } from "@shared/schema";

const DEFAULT_STAGES = [
  { id: "lead", titulo: "Lead", ordem: 1 },
  { id: "contato", titulo: "Contato", ordem: 2 },
  { id: "proposta", titulo: "Proposta", ordem: 3 },
  { id: "fechado", titulo: "Fechado", ordem: 4 },
  { id: "perdido", titulo: "Perdido", ordem: 5 },
];

// Função para extrair número de valores em qualquer formato
function parseValue(value: string | undefined): number {
  if (!value || typeof value !== 'string') return 0;
  // Remove tudo que não é número ou vírgula/ponto
  const cleanValue = value.replace(/[^\d.,]/g, '');
  if (!cleanValue) return 0;
  // Detecta se usa vírgula ou ponto como separador decimal
  // Se houver separador de milhar, substitui
  if (cleanValue.includes(',') && cleanValue.includes('.')) {
    // Tem ambos - determinar qual é decimal
    const lastCommaIndex = cleanValue.lastIndexOf(',');
    const lastDotIndex = cleanValue.lastIndexOf('.');
    if (lastCommaIndex > lastDotIndex) {
      // Vírgula é decimal: "1.000,50" -> 1000.50
      return parseFloat(cleanValue.replace(/\./g, '').replace(',', '.'));
    } else {
      // Ponto é decimal: "1,000.50" -> 1000.50
      return parseFloat(cleanValue.replace(/,/g, ''));
    }
  } else if (cleanValue.includes(',')) {
    // Só vírgula: pode ser "1,50" (decimal) ou "1.000,50" (com ponto escondido)
    // Assume que último valor depois da vírgula é decimal
    return parseFloat(cleanValue.replace('.', '').replace(',', '.'));
  } else if (cleanValue.includes('.')) {
    // Só ponto - pode ser "1.50" (decimal) ou "1.000" (inteiro)
    // Se tiver 2+ dígitos após último ponto, é decimal; senão é milhar
    const parts = cleanValue.split('.');
    if (parts[parts.length - 1].length >= 2) {
      return parseFloat(cleanValue);
    } else {
      return parseInt(cleanValue.replace(/\./g, ''), 10);
    }
  }
  return parseInt(cleanValue, 10);
}

function formatValue(num: number): string {
  if (num === 0) return '-';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Kanban() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>("todos");
  const [filtroEtapa, setFiltroEtapa] = useState<string>("todas");
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>("todas");
  const [filtroCliente, setFiltroCliente] = useState<string>("");
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>("");
  const [filtroDataFim, setFiltroDataFim] = useState<string>("");
  const [showNovaOportunidade, setShowNovaOportunidade] = useState(false);
  const [editingOportunidade, setEditingOportunidade] = useState<Opportunity | null>(null);
  const [draggedCard, setDraggedCard] = useState<{ id: string; fromEtapa: string } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  // Fetch kanban stages
  const { data: stages = [] } = useQuery<KanbanStage[]>({
    queryKey: ["/api/kanban-stages"],
    enabled: isAuthenticated,
  });

  const { data: oportunidades, isLoading, refetch } = useQuery<Opportunity[]>({
    queryKey: ["/api/opportunities"],
    enabled: isAuthenticated,
    refetchInterval: 1000, // Refetch a cada 1 segundo para capturar oportunidades criadas pela IA em tempo real
    staleTime: 0, // Considera sempre stale para forçar refetch
    gcTime: 0, // Não cachear dados
  });

  const { data: clientesData } = useQuery<{ clientes: any[]; total: number }>({
    queryKey: ["/api/clients", "all"],
    enabled: isAuthenticated,
    queryFn: async () => {
      // Load ALL clients without pagination for Kanban matching
      const response = await fetch('/api/clients?limit=50000');
      if (!response.ok) throw new Error('Failed to fetch clients');
      return response.json();
    },
  });

  const { data: usersData = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
    enabled: isAuthenticated,
  });

  const clientes = clientesData?.clientes || [];
  const users = usersData || [];
  const colunas = stages.length > 0 ? stages.sort((a, b) => a.ordem - b.ordem) : DEFAULT_STAGES;

  const moveCardMutation = useMutation({
    mutationFn: async ({ id, etapa }: { id: string; etapa: string }) => {
      await apiRequest("PATCH", `/api/opportunities/${id}/move`, { etapa });
      return { id, etapa };
    },
    onSuccess: (data) => {
      // Atualizar estado local imediatamente para mudar cor da bolinha na hora
      queryClient.setQueryData(["/api/opportunities"], (old: Opportunity[] | undefined) => {
        if (!old) return old;
        return old.map(opp => 
          opp.id === data.id ? { ...opp, etapa: data.etapa } : opp
        );
      });
      // Depois invalidar para sincronizar com servidor
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] }); // Invalidar cache de clientes
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] }); // Sincronizar com chat
      toast({
        title: "Sucesso",
        description: "Oportunidade movida com sucesso",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Não autorizado",
          description: "Você foi desconectado. Fazendo login novamente...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erro",
        description: "Não foi possível mover a oportunidade",
        variant: "destructive",
      });
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/opportunities/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] }); // Sincronizar com chat
      toast({
        title: "Removida",
        description: "Oportunidade excluída com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a oportunidade",
        variant: "destructive",
      });
    },
  });

  // Calcular datas baseado no período
  const getDateRangeForPeriod = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let inicio = new Date(today);
    let fim = new Date(today);
    fim.setHours(23, 59, 59, 999);
    
    if (filtroPeriodo === "semana") {
      // Última segunda-feira
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      inicio = new Date(today);
      inicio.setDate(today.getDate() - daysToMonday);
      inicio.setHours(0, 0, 0, 0);
    } else if (filtroPeriodo === "mes") {
      // Primeiro dia do mês
      inicio = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (filtroPeriodo === "custom") {
      // Usar datas do input
      if (filtroDataInicio) inicio = new Date(filtroDataInicio);
      if (filtroDataFim) {
        fim = new Date(filtroDataFim);
        fim.setHours(23, 59, 59, 999);
      }
    }
    
    return { inicio, fim };
  };

  // Filtrar oportunidades por responsável, etapa, período e cliente
  const oportunidadesFiltradas = (oportunidades || []).filter(op => {
    // Filtro responsável
    if (filtroResponsavel !== "todos") {
      if (op.responsavelId !== filtroResponsavel) return false;
    }
    
    // Filtro etapa
    if (filtroEtapa !== "todas") {
      if (op.etapa?.toLowerCase() !== filtroEtapa.toLowerCase()) return false;
    }
    
    // Filtro período
    if (filtroPeriodo !== "todas") {
      const { inicio, fim } = getDateRangeForPeriod();
      if (op.createdAt) {
        const opDate = new Date(op.createdAt);
        if (opDate < inicio || opDate > fim) return false;
      }
    }
    
    // Filtro cliente (nome ou CNPJ)
    if (filtroCliente.trim()) {
      const cliente = clientes.find((c: any) => c.id === op.clientId);
      if (!cliente) return false;
      const searchTerm = filtroCliente.toLowerCase().trim();
      const nomeMatch = cliente.nome?.toLowerCase().includes(searchTerm);
      const cnpjMatch = cliente.cnpj?.toLowerCase().includes(searchTerm);
      if (!nomeMatch && !cnpjMatch) return false;
    }
    
    return true;
  });

  const getColumnColor = (titulo: string): string => {
    const tituloUpper = titulo.toUpperCase();
    if (tituloUpper === "FECHADO") return "bg-green-600 dark:bg-green-400";
    if (tituloUpper === "PERDIDO" || tituloUpper === "AGUARDANDO ACEITE") return "bg-red-600 dark:bg-red-400";
    return "bg-amber-600 dark:bg-amber-400";
  };

  const totalOportunidades = oportunidadesFiltradas.length;
  const oportunidadesFechadas = oportunidadesFiltradas.filter(op => op.etapa === 'fechado').length;
  
  // Calcular soma de valores em negociação (excluindo "perdido" e colunas com "perdido" no nome)
  const totalValueNegotiation = (oportunidades || [])
    .filter(op => {
      if (!op.etapa) return false;
      if (op.etapa === 'fechado' || op.etapa === 'perdido') return false;
      if (op.etapa?.toLowerCase().includes('perdido')) return false;
      return true;
    })
    .reduce((sum, op) => sum + parseValue(op.valorEstimado || "0"), 0);

  const oportunidadesPorEtapaFiltradas = colunas.map(coluna => ({
    ...coluna,
    cor: getColumnColor(coluna.titulo),
    oportunidades: oportunidadesFiltradas.filter(op => op.etapa?.toLowerCase() === coluna.titulo.toLowerCase()),
  }));

  if (authLoading || !isAuthenticated) {
    return <KanbanSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header Section */}
      <div className="px-3 md:px-6 py-4 md:py-8 lg:py-12">
        <div className="max-w-full mx-auto">
          <div className="flex items-start justify-between gap-2 md:gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 md:gap-3 mb-2">
                <div className="p-2 md:p-3 bg-purple-500/10 rounded-xl flex-shrink-0">
                  <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent truncate">
                  Oportunidades
                </h1>
              </div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1 md:mt-2 line-clamp-2">
                Gerencie seu funil de vendas com drag and drop
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/kanban-settings")}
              data-testid="button-kanban-settings"
              title="Configurar Kanban"
              className="flex-shrink-0"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-3 md:px-6 pb-8 md:pb-12">
        <div className="max-w-full mx-auto space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
            <Card className="p-3 md:p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total de Oportunidades</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{totalOportunidades}</p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total em Negociação</p>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">R$ {formatValue(totalValueNegotiation)}</p>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-lg">
                  <DollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Fechadas</p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">{oportunidadesFechadas}</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </Card>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col lg:flex-row gap-2 lg:gap-3 items-start lg:items-center flex-wrap">
              <div className="w-full lg:w-56">
                <SearchFilter
                  placeholder="Buscar cliente ou CNPJ..."
                  value={filtroCliente}
                  onChange={setFiltroCliente}
                  testId="input-filtro-cliente"
                />
              </div>

              <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
                <SelectTrigger className="w-full lg:w-48 text-xs lg:text-sm border-slate-200 dark:border-slate-700" data-testid="select-responsavel">
                  <SelectValue placeholder="Responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as oportunidades</SelectItem>
                  {user?.id && (
                    <SelectItem value={String(user.id)}>Minhas oportunidades</SelectItem>
                  )}
                </SelectContent>
              </Select>

              <Select value={filtroEtapa} onValueChange={setFiltroEtapa}>
                <SelectTrigger className="w-full lg:w-48 text-xs lg:text-sm border-slate-200 dark:border-slate-700" data-testid="select-etapa">
                  <SelectValue placeholder="Etapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as etapas</SelectItem>
                  {colunas.map((coluna) => (
                    <SelectItem key={coluna.id} value={coluna.titulo}>
                      {coluna.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                <SelectTrigger className="w-full lg:w-48 text-xs lg:text-sm border-slate-200 dark:border-slate-700" data-testid="select-periodo">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as datas</SelectItem>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="semana">Esta semana</SelectItem>
                  <SelectItem value="mes">Este mês</SelectItem>
                  <SelectItem value="custom">Período customizado</SelectItem>
                </SelectContent>
              </Select>

              {filtroPeriodo === "custom" && (
                <>
                  <Input
                    type="date"
                    value={filtroDataInicio}
                    onChange={(e) => setFiltroDataInicio(e.target.value)}
                    placeholder="Data início"
                    className="w-full lg:w-40 text-xs lg:text-sm border-slate-200 dark:border-slate-700"
                    data-testid="input-filtro-data-inicio"
                  />
                  
                  <Input
                    type="date"
                    value={filtroDataFim}
                    onChange={(e) => setFiltroDataFim(e.target.value)}
                    placeholder="Data fim"
                    className="w-full lg:w-40 text-xs lg:text-sm border-slate-200 dark:border-slate-700"
                    data-testid="input-filtro-data-fim"
                  />
                </>
              )}

              <Button 
                data-testid="button-nova-oportunidade" 
                onClick={() => setShowNovaOportunidade(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white w-full lg:w-auto text-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Oportunidade
              </Button>
            </div>

          </div>

          {/* Kanban Board */}
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {oportunidadesPorEtapaFiltradas.map((coluna) => (
                <KanbanColumn
                  key={coluna.id}
                  coluna={coluna}
                  isLoading={isLoading}
                  clientes={clientes}
                  users={users}
                  onMoveCard={(id, etapa) => {
                    setDraggedCard(null);
                    moveCardMutation.mutate({ id, etapa });
                  }}
                  onDeleteCard={(id) => deleteCardMutation.mutate(id)}
                  onEditCard={setEditingOportunidade}
                  draggedCard={draggedCard}
                  setDraggedCard={setDraggedCard}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Criar Oportunidade */}
      <NovaOportunidadeDialog
        open={showNovaOportunidade}
        onOpenChange={setShowNovaOportunidade}
        clientes={clientes || []}
        colunas={colunas}
      />
      {/* Modal Editar Oportunidade */}
      <EditarOportunidadeDialog
        open={!!editingOportunidade}
        onOpenChange={(open) => !open && setEditingOportunidade(null)}
        oportunidade={editingOportunidade}
        clientes={clientes || []}
      />
    </div>
  );
}

function KanbanColumn({
  coluna,
  isLoading,
  clientes,
  users,
  onMoveCard,
  onDeleteCard,
  onEditCard,
  draggedCard,
  setDraggedCard,
}: {
  coluna: { id: string; titulo: string; cor: string; oportunidades: Opportunity[] };
  isLoading: boolean;
  clientes: any[];
  users: any[];
  onMoveCard: (id: string, etapa: string) => void;
  onDeleteCard: (id: string) => void;
  onEditCard: (oportunidade: Opportunity) => void;
  draggedCard: { id: string; fromEtapa: string } | null;
  setDraggedCard: (card: { id: string; fromEtapa: string } | null) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (draggedCard && draggedCard.id) {
      onMoveCard(draggedCard.id, coluna.titulo);
    }
  };

  return (
    <div
      className="flex-shrink-0 w-80"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Card className={`h-full flex flex-col border-0 shadow-sm bg-white dark:bg-slate-800/50 transition-all ${isDragOver ? "bg-slate-100 dark:bg-slate-700/50 ring-2 ring-offset-2 ring-blue-500" : ""}`}>
        <CardHeader className="pb-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h3 className="font-semibold text-slate-900 dark:text-white">{coluna.titulo}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Total: R$ {formatValue(coluna.oportunidades.reduce((sum, opp) => sum + parseValue(opp.valorEstimado || "0"), 0))}
              </p>
            </div>
            <Badge variant="secondary" className="ml-auto bg-slate-100 dark:bg-slate-900">
              {coluna.oportunidades.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-300px)] pt-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))
          ) : coluna.oportunidades.length > 0 ? (
            coluna.oportunidades.map((oportunidade) => (
              <OpportunityCard
                key={oportunidade.id}
                oportunidade={oportunidade}
                cliente={clientes.find(c => c.id === oportunidade.clientId)}
                responsavel={users.find(u => u.id === oportunidade.responsavelId)}
                onDelete={onDeleteCard}
                onEdit={onEditCard}
                draggedCard={draggedCard}
                setDraggedCard={setDraggedCard}
              />
            ))
          ) : (
            <div className="text-center py-8 text-sm text-slate-500 dark:text-slate-400">
              Nenhuma oportunidade
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OpportunityCard({
  oportunidade,
  cliente,
  responsavel,
  onDelete,
  onEdit,
  draggedCard,
  setDraggedCard,
}: {
  oportunidade: Opportunity;
  cliente?: any;
  responsavel?: any;
  onDelete: (id: string) => void;
  onEdit: (oportunidade: Opportunity) => void;
  draggedCard: { id: string; fromEtapa: string } | null;
  setDraggedCard: (card: { id: string; fromEtapa: string } | null) => void;
}) {
  const [, navigate] = useLocation();

  const handleDragStart = () => {
    setDraggedCard({ id: oportunidade.id, fromEtapa: oportunidade.etapa });
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
  };

  const isDragging = draggedCard?.id === oportunidade.id;

  // Função que retorna a cor da bolinha baseado na etapa
  const getStatusColor = (etapa: string): string => {
    const etapaUpper = etapa.toUpperCase();
    // Vermelho
    if (etapaUpper === "AGUARDANDO ACEITE" || etapaUpper === "PERDIDO") {
      return "bg-red-600 dark:bg-red-400";
    }
    // Verde
    if (etapaUpper === "FECHADO") {
      return "bg-green-600 dark:bg-green-400";
    }
    // Amarelo (padrão para LEAD, CONTATO, PROPOSTA, PROPOSTA ENVIADA, AGUARDANDO CONTRATO, CONTRATO ENVIADO)
    return "bg-amber-600 dark:bg-amber-400";
  };

  // Função que retorna a cor clara do card baseado na etapa
  const getCardBackgroundColor = (etapa: string): string => {
    const etapaUpper = etapa.toUpperCase();
    // Vermelho claro
    if (etapaUpper === "AGUARDANDO ACEITE" || etapaUpper === "PERDIDO") {
      return "bg-red-100 dark:bg-red-900/20";
    }
    // Verde claro
    if (etapaUpper === "FECHADO") {
      return "bg-green-100 dark:bg-green-900/20";
    }
    // Amarelo claro (padrão)
    return "bg-amber-100 dark:bg-amber-900/20";
  };

  return (
    <Card
      className={`cursor-move hover-elevate active-elevate-2 transition-all border-0 shadow-sm ${getCardBackgroundColor(oportunidade.etapa)} ${
        isDragging ? "opacity-50" : "opacity-100"
      }`}
      data-testid={`card-oportunidade-${oportunidade.id}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <CardContent className="p-3 space-y-2">
        {/* Bloco 1: Cliente + CNPJ */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {cliente?.nome && (
              <p 
                onClick={() => navigate(`/clientes/${cliente.id}`)}
                className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase truncate hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
                data-testid={`text-cliente-nome-${cliente.id}`}
                title={cliente.nome}
              >
                {cliente.nome}
              </p>
            )}
            {cliente?.cnpj && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono" title={cliente.cnpj}>
                {cliente.cnpj}
              </p>
            )}
          </div>
          <div className={`h-2.5 w-2.5 rounded-full animate-pulse flex-shrink-0 ${getStatusColor(oportunidade.etapa)}`} data-testid={`status-indicator-${oportunidade.id}`} />
        </div>

        {/* Bloco 2: Título */}
        <h4 className="text-sm font-semibold leading-tight text-slate-900 dark:text-white line-clamp-2" title={oportunidade.titulo}>
          {oportunidade.titulo}
        </h4>

        {/* Bloco 3: Valor */}
        {oportunidade.valorEstimado && (
          <div className="flex items-center gap-1.5 text-xs">
            <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {oportunidade.valorEstimado}
            </span>
          </div>
        )}

        {/* Bloco 3B: Responsável */}
        {responsavel && (
          <div className="text-xs text-slate-700 dark:text-slate-300 font-medium p-1.5 bg-slate-100 dark:bg-slate-700/30 rounded">
            <User className="h-3 w-3 inline mr-1" />
            {responsavel.firstName || responsavel.email?.split('@')[0]}
          </div>
        )}

        {/* Bloco 4: Prazo + Botões */}
        <div className="flex items-center justify-between text-xs">
          {oportunidade.prazo && (
            <span className="text-slate-600 dark:text-slate-400 flex-shrink-0">
              {new Date(oportunidade.prazo).toLocaleDateString("pt-BR")}
            </span>
          )}
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => navigate(`/chat?clientId=${cliente?.id}`)}
              className="text-slate-600 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400 transition-colors p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
              data-testid={`button-chat-${oportunidade.id}`}
              title="Chat"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
            <button
              onClick={() => onEdit(oportunidade)}
              className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
              data-testid={`button-edit-${oportunidade.id}`}
              title="Editar"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(oportunidade.id)}
              className="text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
              data-testid={`button-delete-${oportunidade.id}`}
              title="Excluir"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NovaOportunidadeDialog({
  open,
  onOpenChange,
  clientes,
  colunas,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: any[];
  colunas: any[];
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchCliente, setSearchCliente] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  
  useEffect(() => {
    if (open) {
      setSearchCliente("");
      setShowDropdown(true);
    }
  }, [open]);
  
  const clientesFiltrados = searchCliente.trim() === "" 
    ? clientes 
    : clientes.filter((client: any) => {
        return (client.nome?.toLowerCase().includes(searchCliente.toLowerCase())) ||
               (client.cnpj?.includes(searchCliente));
      });
  
  const form = useForm({
    resolver: zodResolver(insertOpportunitySchema),
    defaultValues: {
      titulo: "",
      clientId: "",
      etapa: "lead",
      valorEstimado: "",
      responsavelId: user?.id,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/opportunities", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] }); // Sincronizar com chat
      toast({
        title: "Sucesso",
        description: "Oportunidade criada com sucesso",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível criar a oportunidade",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    createMutation.mutate({
      ...data,
      valorEstimado: data.valorEstimado || "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="p-3 bg-purple-500/10 rounded-xl flex-shrink-0">
            <Plus className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
              Nova Oportunidade
            </DialogTitle>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Crie uma nova oportunidade no seu pipeline
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-6">
            {/* SEÇÃO 1: CLIENTE */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-purple-600" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Informações do Cliente</p>
              </div>

              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => {
                  const fieldSelectedClient = clientes.find((c: any) => c.id === field.value);
                  return (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">Cliente</FormLabel>
                      <FormControl>
                        <div className="space-y-3">
                          <Input
                            placeholder="Buscar por CNPJ ou razão social..."
                            value={searchCliente}
                            onChange={(e) => setSearchCliente(e.target.value)}
                            onFocus={() => setShowDropdown(true)}
                            data-testid="input-search-cliente"
                            className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-10 text-base"
                          />
                          {showDropdown && searchCliente.length > 0 && (
                            <div className="border border-slate-200 dark:border-slate-800 rounded-lg max-h-64 overflow-y-auto bg-white dark:bg-slate-900 z-50 shadow-lg">
                              {clientesFiltrados.length > 0 ? (
                                <div className="space-y-1 p-2">
                                  {clientesFiltrados.map((client: any) => (
                                    <div
                                      key={client.id}
                                      onClick={() => {
                                        field.onChange(client.id);
                                        setSearchCliente("");
                                        setShowDropdown(false);
                                      }}
                                      className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                                      data-testid={`option-client-${client.id}`}
                                    >
                                      <div className="font-semibold text-purple-600 dark:text-purple-400">{client.nome}</div>
                                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">{client.cnpj}</div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="p-8 text-sm text-slate-600 dark:text-slate-400 text-center">
                                  Nenhum cliente encontrado
                                </div>
                              )}
                            </div>
                          )}
                          {fieldSelectedClient && (
                            <Card className="p-4 border-purple-200 dark:border-purple-900/30 bg-purple-50 dark:bg-purple-950/20">
                              <div className="flex items-start gap-3">
                                <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0">
                                  <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                                    {fieldSelectedClient.nome?.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-slate-900 dark:text-white truncate">{fieldSelectedClient.nome}</div>
                                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">{fieldSelectedClient.cnpj}</div>
                                </div>
                              </div>
                            </Card>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            {/* SEÇÃO 2: DETALHES DA OPORTUNIDADE */}
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-purple-600" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Detalhes</p>
              </div>

              <FormField
                control={form.control}
                name="titulo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold">Título da Oportunidade</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: Proposta de plano móvel corporativo" 
                        {...field} 
                        className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-10 text-base"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="etapa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">Etapa/Coluna</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-etapa" className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-10">
                            <SelectValue placeholder="Selecione a etapa" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {colunas.map((coluna: any) => (
                            <SelectItem key={coluna.id} value={coluna.titulo.toLowerCase()}>
                              {coluna.titulo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="valorEstimado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">Valor Estimado</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: R$ 5.000,00"
                          type="text"
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          data-testid="input-valor-estimado"
                          className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-10 text-base"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* FOOTER COM BOTÕES */}
            <div className="flex gap-3 justify-end pt-6 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createMutation.isPending}
                className="px-6 h-10 text-base font-medium border-slate-200 dark:border-slate-800"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending} 
                className="px-8 h-10 text-base font-medium bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                {createMutation.isPending ? "Criando..." : "Criar Oportunidade"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditarOportunidadeDialog({
  open,
  onOpenChange,
  oportunidade,
  clientes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oportunidade: Opportunity | null;
  clientes: any[];
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchCliente, setSearchCliente] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (open) {
      setSearchCliente("");
      setShowDropdown(false);
    }
  }, [open]);

  const clientesFiltrados = searchCliente.trim() === ""
    ? clientes
    : clientes.filter((client: any) => {
        return (client.nome?.toLowerCase().includes(searchCliente.toLowerCase())) ||
               (client.cnpj?.includes(searchCliente));
      });

  const selectedClient = clientes.find((c: any) => c.id === oportunidade?.clientId);

  const form = useForm({
    resolver: zodResolver(insertOpportunitySchema),
    defaultValues: {
      titulo: oportunidade?.titulo || "",
      clientId: oportunidade?.clientId || "",
      etapa: oportunidade?.etapa || "lead",
      valorEstimado: oportunidade?.valorEstimado || "",
      responsavelId: oportunidade?.responsavelId || user?.id,
    },
  });

  useEffect(() => {
    if (oportunidade) {
      form.reset({
        titulo: oportunidade.titulo,
        clientId: oportunidade.clientId,
        etapa: oportunidade.etapa,
        valorEstimado: oportunidade.valorEstimado || "",
        responsavelId: oportunidade.responsavelId || user?.id,
      });
      setSearchCliente("");
    }
  }, [oportunidade, open]);

  const editMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!oportunidade) return;
      // Atualizar oportunidade
      await apiRequest("PATCH", `/api/opportunities/${oportunidade.id}`, data);
      // Sincronizar valorEstimado no cliente também
      if (oportunidade.clientId && data.valorEstimado !== undefined) {
        await apiRequest("PATCH", `/api/clients/${oportunidade.clientId}`, {
          camposCustom: { valorEstimado: data.valorEstimado }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] }); // Sincronizar com chat
      toast({
        title: "Sucesso",
        description: "Oportunidade atualizada com sucesso",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a oportunidade",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    editMutation.mutate({
      ...data,
      valorEstimado: data.valorEstimado || "",
    });
  };

  if (!oportunidade) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Oportunidade</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => {
                const fieldSelectedClient = clientes.find((c: any) => c.id === field.value);
                return (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Input
                          placeholder="Buscar por CNPJ ou razão social..."
                          value={searchCliente}
                          onChange={(e) => setSearchCliente(e.target.value)}
                          onFocus={() => setShowDropdown(true)}
                          data-testid="input-search-cliente-edit"
                          className="bg-background"
                        />
                        {showDropdown && searchCliente.length > 0 && (
                          <div className="border rounded-lg max-h-56 overflow-y-auto bg-background z-50 shadow-xl">
                            {clientesFiltrados.length > 0 ? (
                              <div className="space-y-2 p-2">
                                {clientesFiltrados.map((client: any) => (
                                  <div
                                    key={client.id}
                                    onClick={() => {
                                      field.onChange(client.id);
                                      setSearchCliente("");
                                      setShowDropdown(false);
                                    }}
                                    className="p-3 border border-border rounded-lg hover-elevate cursor-pointer bg-card transition-all"
                                    data-testid={`option-client-edit-${client.id}`}
                                  >
                                    <div className="font-semibold text-primary">{client.nome}</div>
                                    <div className="text-xs text-muted-foreground mt-1">{client.cnpj}</div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="p-6 text-sm text-muted-foreground text-center">
                                Nenhum cliente encontrado
                              </div>
                            )}
                          </div>
                        )}
                        {fieldSelectedClient && (
                          <Card className="p-3 border-primary/30">
                            <div className="flex items-start gap-3">
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <span className="text-xs font-bold text-primary">
                                  {fieldSelectedClient.nome?.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-foreground truncate">{fieldSelectedClient.nome}</div>
                                <div className="text-xs text-muted-foreground mt-1">{fieldSelectedClient.cnpj}</div>
                              </div>
                            </div>
                          </Card>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Proposta de plano móvel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="valorEstimado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Estimado</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: R$ 5.000,00 ou 5000"
                      type="text"
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      data-testid="input-valor-estimado-edit"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 justify-end pt-6 border-t mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={editMutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={editMutation.isPending} className="bg-purple-600 hover:bg-purple-700">
                {editMutation.isPending ? "Atualizando..." : "Atualizar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function KanbanSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-full mx-auto">
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
      </div>
      <div className="px-6 pb-12">
        <div className="max-w-full mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6 border-0 shadow-sm">
                <Skeleton className="h-8 w-32" />
              </Card>
            ))}
          </div>
          <div className="flex gap-4 overflow-x-auto">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="w-80 border-0 shadow-sm">
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-64 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
