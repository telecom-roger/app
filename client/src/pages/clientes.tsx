import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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

function ShareClientDialog({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users-list"],
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
      setOpen(false);
      setSelectedUserId("");
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao compartilhar cliente",
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compartilhar "{clientName}"</DialogTitle>
          <DialogDescription>Selecione um usuário para compartilhar este cliente</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger data-testid="select-share-user">
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

export default function Clientes() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const limit = 10;

  // Fetch predefined tags
  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
    refetchInterval: 5000,
  });

  // Fetch clients with stats
  const { data, isLoading } = useQuery<{ clientes: Client[]; total: number }>({
    queryKey: [
      "/api/clients",
      { 
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== "todos" && { status: statusFilter }),
        ...(selectedTag && { tagName: selectedTag }),
        page,
        limit,
      }
    ],
    enabled: isAuthenticated,
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

  const statusColors: Record<string, string> = {
    lead: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    ativo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    proposta: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    fechado: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    perdido: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    inativo: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
  };

  const totalClientes = data?.total || 0;
  const clientesAtivos = data?.clientes?.filter(c => c.status === 'ativo').length || 0;
  const leads = data?.clientes?.filter(c => c.status === 'lead').length || 0;

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

            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Leads</p>
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">{leads}</p>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-lg">
                  <Zap className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </Card>
          </div>

          {/* Filters */}
          <Card className="p-5 border-0 shadow-sm bg-white dark:bg-slate-800/50">
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por nome, razão social ou CNPJ..."
                    className="pl-10 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    data-testid="input-search-clientes"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-48 border-slate-200 dark:border-slate-700" data-testid="select-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="proposta">Proposta</SelectItem>
                    <SelectItem value="fechado">Fechado</SelectItem>
                    <SelectItem value="perdido">Perdido</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" data-testid="button-filtros-avancados" className="text-slate-700 dark:text-slate-200">
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                </Button>
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

          {/* Table */}
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Nome / Razão Social</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">CPF/CNPJ</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Carteira</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      </TableRow>
                    ))
                  ) : data?.clientes && data.clientes.length > 0 ? (
                    data.clientes.map((cliente) => (
                      <TableRow 
                        key={cliente.id} 
                        className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30 cursor-pointer transition-colors"
                        data-testid={`row-cliente-${cliente.id}`}
                      >
                        <TableCell>
                          <Link href={`/clientes/${cliente.id}`}>
                            <div>
                              <div className="font-medium text-slate-900 dark:text-white">{cliente.nome}</div>
                              {cliente.razaoSocial && (
                                <div className="text-sm text-slate-600 dark:text-slate-400">
                                  {cliente.razaoSocial}
                                </div>
                              )}
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-slate-700 dark:text-slate-300">
                          {cliente.cpfCnpj || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary" 
                            className={statusColors[cliente.status] || ''}
                          >
                            {cliente.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-700 dark:text-slate-300">
                          {cliente.carteira || '-'}
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
                      <TableCell colSpan={5} className="text-center py-12">
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
              <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
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
