import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchFilter } from "@/components/search-filter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Search, 
  Plus, 
  Filter,
  Download,
  Tag,
  MoreHorizontal,
  Edit,
  Trash2,
  Users,
  TrendingUp,
  Zap,
  Share2,
  Check,
  MessageSquare,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Client } from "@shared/schema";

// Format phone number
function formatPhoneNumber(phone: string | undefined): string {
  if (!phone) return '-';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

interface Tag {
  id: string;
  nome: string;
  cor: string;
}

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface ClientSharing {
  clientId: string;
  ownerId: string;
  sharedWithUserId: string;
  permissao: string;
}

function ShareClientDialog({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users-list"],
    enabled: open,
  });

  const { data: sharings = [] } = useQuery<ClientSharing[]>({
    queryKey: [`/api/clients/${clientId}/sharings`],
    enabled: open,
  });

  const shareMutation = useMutation({
    mutationFn: async (sharedWithUserId: string) => {
      await apiRequest("POST", `/api/clients/${clientId}/share`, { sharedWithUserId });
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Cliente compartilhado com sucesso",
      });
      setSelectedUserId("");
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/sharings`] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao compartilhar cliente",
        variant: "destructive",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (sharedWithUserId: string) => {
      await apiRequest("DELETE", `/api/clients/${clientId}/share/${sharedWithUserId}`);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Compartilhamento removido com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/sharings`] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao remover compartilhamento",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onClick={(e) => { e.preventDefault(); setOpen(true); }}>
          <Share2 className="h-4 w-4 mr-2" />
          Compartilhar
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compartilhar "{clientName}"</DialogTitle>
          <DialogDescription>Selecione um usuário para compartilhar este cliente</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Compartilhamentos Existentes */}
          {sharings.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Compartilhado com:</h3>
              <div className="space-y-1 bg-muted p-2 rounded-md">
                {sharings.map(sharing => {
                  const user = users.find(u => u.id === sharing.sharedWithUserId);
                  return (
                    <div key={sharing.sharedWithUserId} className="flex items-center justify-between text-sm py-1">
                      <span>{user?.email || sharing.sharedWithUserId}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeMutation.mutate(sharing.sharedWithUserId)}
                        disabled={removeMutation.isPending}
                        data-testid={`button-remove-share-${sharing.sharedWithUserId}`}
                        className="h-auto px-2 py-0"
                      >
                        ✕
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Novo Compartilhamento */}
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger data-testid="select-share-user">
              <SelectValue placeholder="Escolha um usuário..." />
            </SelectTrigger>
            <SelectContent>
              {users
                .filter(u => !sharings.some(s => s.sharedWithUserId === u.id))
                .map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.email}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button 
              onClick={() => selectedUserId && shareMutation.mutate(selectedUserId)}
              disabled={!selectedUserId || shareMutation.isPending}
              data-testid="button-confirm-share"
            >
              {shareMutation.isPending ? "Compartilhando..." : "Compartilhar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface BulkShareDialogProps {
  selectedClientIds: string[];
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  open: boolean;
}

function BulkShareDialog({ selectedClientIds, onOpenChange, onSuccess, open }: BulkShareDialogProps) {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState("");
  
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users-list"],
    enabled: open,
  });

  const totalClients = selectedClientIds.length;
  
  const bulkShareMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("POST", "/api/clients/share-bulk", { clientIds: selectedClientIds, sharedWithUserId: userId });
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: `${totalClients} cliente(s) compartilhado(s) com sucesso`,
      });
      onOpenChange(false);
      setSelectedUserId("");
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao compartilhar clientes",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compartilhar {selectedClientIds.length} cliente(s)</DialogTitle>
          <DialogDescription>Selecione um usuário para compartilhar</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger data-testid="select-bulk-share-user">
              <SelectValue placeholder="Escolha um usuário..." />
            </SelectTrigger>
            <SelectContent>
              {users.map(user => (
                <SelectItem key={user.id} value={user.id}>
                  {user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button 
              onClick={() => selectedUserId && bulkShareMutation.mutate(selectedUserId)}
              disabled={!selectedUserId || bulkShareMutation.isPending}
              data-testid="button-confirm-bulk-share"
            >
              {bulkShareMutation.isPending ? "Compartilhando..." : "Compartilhar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface BulkUnshareDialogProps {
  selectedClientIds: string[];
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  open: boolean;
}

function BulkUnshareDialog({ selectedClientIds, onOpenChange, onSuccess, open }: BulkUnshareDialogProps) {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState("");
  
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users-list"],
    enabled: open,
  });

  const bulkUnshareMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("POST", "/api/clients/unshare-bulk", { clientIds: selectedClientIds, sharedWithUserId: userId });
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: `${selectedClientIds.length} compartilhamento(s) removido(s)`,
      });
      onOpenChange(false);
      setSelectedUserId("");
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao remover compartilhamento",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover compartilhamento de {selectedClientIds.length} cliente(s)</DialogTitle>
          <DialogDescription>Selecione de qual usuário deseja remover</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger data-testid="select-bulk-unshare-user">
              <SelectValue placeholder="Escolha um usuário..." />
            </SelectTrigger>
            <SelectContent>
              {users.map(user => (
                <SelectItem key={user.id} value={user.id}>
                  {user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button 
              onClick={() => selectedUserId && bulkUnshareMutation.mutate(selectedUserId)}
              disabled={!selectedUserId || bulkUnshareMutation.isPending}
              data-testid="button-confirm-bulk-unshare"
              className="bg-red-600 hover:bg-red-700"
            >
              {bulkUnshareMutation.isPending ? "Removendo..." : "Remover"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Clientes() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [carteiraFiltro, setCarteiraFiltro] = useState<string>("all");
  const [orderBy, setOrderBy] = useState<string>("recent");
  const [quantidadeSelecar, setQuantidadeSelecar] = useState<number>(10);
  const [page, setPage] = useState(1);
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [allSelectedClientIds, setAllSelectedClientIds] = useState<Set<string>>(new Set());
  const [bulkShareDialogOpen, setBulkShareDialogOpen] = useState(false);
  const [bulkUnshareDialogOpen, setBulkUnshareDialogOpen] = useState(false);
  const paginationRef = useRef<HTMLDivElement>(null);

  // Check if any filter is active
  const hasActiveFilter = searchTerm || statusFilter !== "todos" || selectedTag || carteiraFiltro !== "all";
  
  // Always use pagination with 50 per page (optimized for performance)
  // User can click "próximo" to load more results
  const limit = 50;
  const effectivePage = page;

  // Fetch predefined tags
  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
    refetchInterval: 5000,
  });

  // Fetch notifications to listen for client sharing
  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 3000,
  });

  // Fetch all carteiras
  const { data: carteirasDoDb = [] } = useQuery<string[]>({
    queryKey: ["/api/clients/carteiras"],
    enabled: isAuthenticated,
  });

  // Fetch clients with stats (paginated for viewing)
  const { data, isLoading } = useQuery<{ clientes: Client[]; total: number }>({
    queryKey: [
      "/api/clients",
      { 
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== "todos" && { status: statusFilter }),
        ...(selectedTag && { tagName: selectedTag }),
        ...(carteiraFiltro !== "all" && { carteira: carteiraFiltro }),
        page: effectivePage,
        limit,
      }
    ],
    enabled: isAuthenticated,
  });

  // Fetch ALL clients matching filters (for bulk selection)
  const { data: allFilteredClients = { clientes: [], total: 0 } } = useQuery<{ clientes: Client[]; total: number }>({
    queryKey: [
      "/api/clients/all-filtered",
      { 
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== "todos" && { status: statusFilter }),
        ...(selectedTag && { tagName: selectedTag }),
        ...(carteiraFiltro !== "all" && { carteira: carteiraFiltro }),
      }
    ],
    enabled: Boolean(isAuthenticated && hasActiveFilter),
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: "50000",
        page: "1",
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== "todos" && { status: statusFilter }),
        ...(selectedTag && { tagName: selectedTag }),
        ...(carteiraFiltro !== "all" && { carteira: carteiraFiltro }),
      });
      const res = await fetch(`/api/clients?${params}`);
      return res.json();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/clients/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Removido",
        description: "Cliente deletado com sucesso",
      });
      setDeleteClientId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao deletar cliente",
        variant: "destructive",
      });
    },
  });

  // Bulk share with accumulated total
  const onBulkShareSuccess = () => {
    setSelectedClientIds(new Set());
    setAllSelectedClientIds(new Set());
    setBulkShareDialogOpen(false);
  };

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

  // Invalidate clients cache when a new client_shared notification arrives
  useEffect(() => {
    const clientSharedNotifications = notifications.filter(n => n.tipo === "client_shared" && !n.lida);
    if (clientSharedNotifications.length > 0) {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    }
  }, [notifications]);

  // When page changes: accumulate IDs from previous page, then clear current page selection
  useEffect(() => {
    setAllSelectedClientIds(prev => new Set([...Array.from(prev), ...Array.from(selectedClientIds)]));
    setSelectedClientIds(new Set());
    const tableElement = document.querySelector('[data-testid="table-container"]');
    tableElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [page]);

  const statusColors: Record<string, string> = {
    lead_quente: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    engajado: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    em_negociacao: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    em_fechamento: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    ativo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    perdido: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
    remarketing: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  };

  const totalClientes = data?.total || 0;
  const clientesAtivos = data?.clientes?.filter(c => c.status === 'ativo').length || 0;

  // Use tipos from DB, fallback to loaded clients

  // Clients from backend (already sorted)
  const clientesFiltrados = data?.clientes || [];
  const clientesFiltradosUnicos = clientesFiltrados;

  const toggleClienteSelecionado = (clienteId: string) => {
    const novoSet = new Set(selectedClientIds);
    if (novoSet.has(clienteId)) {
      novoSet.delete(clienteId);
    } else {
      novoSet.add(clienteId);
    }
    setSelectedClientIds(novoSet);
  };

  if (authLoading || !isAuthenticated) {
    return <ClientesSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header Section */}
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-blue-500/10 rounded-xl">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
                  Clientes
                </h1>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mt-2">
                Gerencie sua base de clientes e acompanhe seu pipeline de vendas
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" data-testid="button-export" className="text-slate-700 dark:text-slate-200">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="button-novo-cliente">
                <Link href="/clientes/novo">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Cliente
                </Link>
              </Button>
            </div>
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
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total de Clientes</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{totalClientes}</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Clientes Ativos</p>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{clientesAtivos}</p>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </Card>

          </div>

          {/* Filters */}
          <Card className="p-5 border-0 shadow-sm bg-white dark:bg-slate-800/50">
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-3">
                <SearchFilter
                placeholder="Buscar por nome, razão social ou CNPJ..."
                value={searchTerm}
                onChange={setSearchTerm}
                testId="input-search-clientes"
              />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-48 border-slate-200 dark:border-slate-700" data-testid="select-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    <SelectItem value="lead_quente">Lead quente</SelectItem>
                    <SelectItem value="engajado">Engajado</SelectItem>
                    <SelectItem value="em_negociacao">Em negociação</SelectItem>
                    <SelectItem value="em_fechamento">Em fechamento</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="perdido">Perdido</SelectItem>
                    <SelectItem value="remarketing">Remarketing</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" data-testid="button-filtros-avancados" className="text-slate-700 dark:text-slate-200">
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                </Button>
              </div>

              {/* Quick Select & Filters */}
              <div className="flex gap-2 flex-wrap items-center pt-2 border-t border-slate-200 dark:border-slate-700">
                <Button
                  size="sm"
                  variant={statusFilter === "em_fechamento" ? "default" : "outline"}
                  onClick={() => setStatusFilter(statusFilter === "em_fechamento" ? "todos" : "em_fechamento")}
                  data-testid="button-filter-aguardando-atencao"
                  className="h-8 text-xs bg-orange-50 dark:bg-orange-950 hover:bg-orange-100 dark:hover:bg-orange-900 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800"
                >
                  ⏰ Aguardando Atenção
                </Button>

                <div className="h-6 w-px bg-border" />

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const novoSet = new Set(selectedClientIds);
                    clientesFiltradosUnicos.forEach(c => novoSet.add(c.id));
                    setSelectedClientIds(novoSet);
                  }}
                  disabled={clientesFiltradosUnicos.length === 0}
                  data-testid="button-select-all-quick"
                  className="h-8 text-xs"
                >
                  ✓ Página ({clientesFiltradosUnicos.length})
                </Button>
                {hasActiveFilter && allFilteredClients?.total > limit && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setSelectedClientIds(new Set((allFilteredClients?.clientes || []).map((c: Client) => c.id)))}
                    disabled={!allFilteredClients?.clientes || allFilteredClients?.clientes.length === 0}
                    data-testid="button-select-all-results"
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                    title="Seleciona TODOS os resultados da busca (não paginados)"
                  >
                    ✓ Todos ({allFilteredClients?.total})
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedClientIds(new Set())}
                  disabled={selectedClientIds.size === 0}
                  data-testid="button-deselect-all"
                  className="h-8 text-xs"
                >
                  ✕ Desselecionar Todos
                </Button>

                <div className="h-6 w-px bg-border" />

                {/* Carteira Filter */}
                <Select value={carteiraFiltro} onValueChange={(value) => setCarteiraFiltro(value)}>
                  <SelectTrigger className="w-40 h-8 text-xs" data-testid="select-carteira-filtro">
                    <SelectValue placeholder="Filtrar por carteira..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as carteiras</SelectItem>
                    {carteirasDoDb.map((carteira) => (
                      <SelectItem key={carteira} value={carteira}>
                        {carteira}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="h-6 w-px bg-border" />

                {/* Ordering */}
                <Select value={orderBy} onValueChange={(value: any) => setOrderBy(value)}>
                  <SelectTrigger className="w-32 h-8 text-xs" data-testid="select-orderBy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Mais Recentes</SelectItem>
                    <SelectItem value="oldest">Mais Antigos</SelectItem>
                  </SelectContent>
                </Select>

                <div className="h-6 w-px bg-border" />

                {/* Random Selection */}
                <div className="flex gap-2 items-center">
                  <Label className="text-xs font-medium whitespace-nowrap">Aleatório:</Label>
                  <Input
                    type="number"
                    min={1}
                    max={clientesFiltradosUnicos.length}
                    value={quantidadeSelecar}
                    onChange={(e) => setQuantidadeSelecar(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 h-8 text-xs"
                    data-testid="input-quantidade-selecionar"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const shuffled = [...clientesFiltradosUnicos].sort(() => Math.random() - 0.5);
                      const quantidadeReal = Math.min(quantidadeSelecar, clientesFiltradosUnicos.length);
                      const selecionados = shuffled.slice(0, quantidadeReal).map((c) => c.id);
                      setSelectedClientIds(new Set(selecionados));
                    }}
                    disabled={clientesFiltradosUnicos.length === 0}
                    data-testid="button-random-select"
                    className="h-8 text-xs"
                  >
                    🎲 Selecionar
                  </Button>
                </div>
              </div>

              {/* Tag Filter */}
              {tags.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">FILTRAR POR ETIQUETA</p>
                  <ScrollArea className="w-full">
                    <div className="flex gap-2 pb-2">
                      <Button
                        variant={selectedTag === null ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedTag(null)}
                        data-testid="button-filter-all-tags"
                        className="h-8 px-3 text-xs whitespace-nowrap rounded-full"
                      >
                        Todas
                      </Button>
                      {tags.map((tag) => (
                        <Button
                          key={tag.id}
                          variant={selectedTag === tag.nome ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedTag(tag.nome)}
                          data-testid={`button-filter-tag-${tag.id}`}
                          className={`h-8 px-3 text-xs whitespace-nowrap rounded-full ${
                            selectedTag === tag.nome ? `${tag.cor} border ${tag.cor.replace('bg-', 'border-')}` : ""
                          }`}
                        >
                          {tag.nome}
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </Card>

          {/* Bulk Actions Bar */}
          {(selectedClientIds.size > 0 || allSelectedClientIds.size > 0) && (
            <Card className="border-0 shadow-sm bg-blue-50 dark:bg-blue-950/20 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Total: {allSelectedClientIds.size + selectedClientIds.size} cliente(s) selecionado(s)
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setSelectedClientIds(new Set());
                      setAllSelectedClientIds(new Set());
                    }}
                    data-testid="button-clear-selection"
                  >
                    Limpar Tudo
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => setBulkShareDialogOpen(true)}
                    data-testid="button-bulk-share"
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Compartilhar
                  </Button>
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => setBulkUnshareDialogOpen(true)}
                    data-testid="button-bulk-unshare"
                    className="text-red-600 dark:text-red-400"
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Remover
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Table */}
          <Card data-testid="table-container" className="border-0 shadow-sm bg-white dark:bg-slate-800/50 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12">
                      <Checkbox 
                        checked={!!data?.clientes && data.clientes.length > 0 && data.clientes.every(c => selectedClientIds.has(c.id))}
                        onCheckedChange={(checked) => {
                          if (checked && data?.clientes) {
                            const novoSet = new Set(selectedClientIds);
                            data.clientes.forEach(c => novoSet.add(c.id));
                            setSelectedClientIds(novoSet);
                          } else if (data?.clientes) {
                            const novoSet = new Set(selectedClientIds);
                            data.clientes.forEach(c => novoSet.delete(c.id));
                            setSelectedClientIds(novoSet);
                          }
                        }}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Nome / Parceiro</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">CNPJ</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Celular</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Email</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Carteira</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                        <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      </TableRow>
                    ))
                  ) : data?.clientes && data.clientes.length > 0 ? (
                    data.clientes.map((cliente) => (
                      <TableRow 
                        key={cliente.id} 
                        className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                        data-testid={`row-cliente-${cliente.id}`}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={selectedClientIds.has(cliente.id)}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedClientIds);
                              if (checked) {
                                newSelected.add(cliente.id);
                              } else {
                                newSelected.delete(cliente.id);
                              }
                              setSelectedClientIds(newSelected);
                            }}
                            data-testid={`checkbox-cliente-${cliente.id}`}
                          />
                        </TableCell>
                        <TableCell className="cursor-pointer">
                          <Link href={`/clientes/${cliente.id}`}>
                            <div>
                              <div className="font-medium text-slate-900 dark:text-white">{cliente.nome}</div>
                              {cliente.parceiro && (
                                <Badge variant="outline" className="mt-1 text-xs">
                                  {cliente.parceiro}
                                </Badge>
                              )}
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-slate-700 dark:text-slate-300">
                          {cliente.cnpj || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700 dark:text-slate-300">
                          {formatPhoneNumber(cliente.celular || undefined)}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700 dark:text-slate-300">
                          {cliente.email || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700 dark:text-slate-300">
                          {cliente.carteira || '-'}
                        </TableCell>
                        <TableCell>
                          {cliente.status && (
                            <Badge className={`${statusColors[cliente.status] || 'bg-slate-200 text-slate-800'}`}>
                              {cliente.status.toUpperCase()}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid="button-actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/chat?clientId=${cliente.id}`}>
                                  <MessageSquare className="h-4 w-4 mr-2" />
                                  Conversar
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/clientes/${cliente.id}/editar`}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar
                                </Link>
                              </DropdownMenuItem>
                              <ShareClientDialog clientId={cliente.id} clientName={cliente.nome} />
                              <DropdownMenuItem
                                onClick={() => setDeleteClientId(cliente.id)}
                                className="text-red-600 dark:text-red-400"
                                data-testid={`button-delete-${cliente.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Deletar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12">
                        <div className="text-slate-500 dark:text-slate-400">
                          <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
                          <p className="font-medium">Nenhum cliente encontrado</p>
                          <p className="text-sm mt-1">
                            Importe seus clientes ou crie um novo cadastro
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {data && data.total > limit && (
              <div ref={paginationRef} className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                <div className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                  Página {page} de {Math.ceil(data.total / limit)} • {data.total} clientes
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    data-testid="button-prev-page"
                    className="text-slate-700 dark:text-slate-200"
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page * limit >= data.total}
                    onClick={() => setPage(p => p + 1)}
                    data-testid="button-next-page"
                    className="text-slate-700 dark:text-slate-200"
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteClientId} onOpenChange={() => setDeleteClientId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O cliente será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteClientId && deleteMutation.mutate(deleteClientId)
              }
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deletando..." : "Deletar"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

    <BulkShareDialog 
      selectedClientIds={Array.from(new Set([...Array.from(allSelectedClientIds), ...Array.from(selectedClientIds)]))} 
      onOpenChange={setBulkShareDialogOpen}
      onSuccess={onBulkShareSuccess}
      open={bulkShareDialogOpen}
    />
    <BulkUnshareDialog 
      selectedClientIds={Array.from(new Set([...Array.from(allSelectedClientIds), ...Array.from(selectedClientIds)]))} 
      onOpenChange={setBulkUnshareDialogOpen}
      onSuccess={onBulkShareSuccess}
      open={bulkUnshareDialogOpen}
    />
    </div>
  );
}

function ClientesSkeleton() {
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
              <Card key={i} className="p-6 border-0 shadow-sm">
                <Skeleton className="h-8 w-32" />
              </Card>
            ))}
          </div>
          <Card className="p-4 border-0 shadow-sm">
            <Skeleton className="h-10 w-full" />
          </Card>
          <Card className="p-4 border-0 shadow-sm">
            <Skeleton className="h-64 w-full" />
          </Card>
        </div>
      </div>
    </div>
  );
}
