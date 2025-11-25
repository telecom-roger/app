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
} from "lucide-react";
import type { Client } from "@shared/schema";

export default function Clientes() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [page, setPage] = useState(1);
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const limit = 10;

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/clients/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Sucesso",
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

  const { data, isLoading } = useQuery<{ clientes: Client[]; total: number }>({
    queryKey: [
      "/api/clients",
      (searchTerm || statusFilter !== "todos" || page !== 1) 
        ? { 
            ...(searchTerm && { search: searchTerm }),
            ...(statusFilter !== "todos" && { status: statusFilter }),
            page,
            limit,
          }
        : null,
    ].filter(Boolean),
    enabled: isAuthenticated,
  });

  const statusColors: Record<string, string> = {
    lead: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    ativo: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    proposta: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    fechado: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    perdido: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    inativo: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };

  if (authLoading || !isAuthenticated) {
    return <ClientesSkeleton />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie sua base de clientes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button asChild data-testid="button-novo-cliente">
            <Link href="/clientes/novo">
              <Plus className="h-4 w-4 mr-2" />
              Novo Cliente
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, razão social ou CNPJ..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-clientes"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48" data-testid="select-status">
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
          <Button variant="outline" data-testid="button-filtros-avancados">
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
        </div>
      </Card>

      {/* Cards List */}
      <div className="space-y-4">
        {isLoading ? (
          <>
            {Array.from({ length: 10 }).map((_, i) => (
              <Card key={i} className="p-4 bg-white border border-[#776BFF]">
                <Skeleton className="h-8 w-1/3 mb-2" />
                <Skeleton className="h-6 w-1/4" />
              </Card>
            ))}
          </>
        ) : data?.clientes && data.clientes.length > 0 ? (
          <>
            {data.clientes.map((cliente) => (
              <Link key={cliente.id} href={`/clientes/${cliente.id}`}>
                <Card 
                  className="p-5 hover-elevate cursor-pointer transition-all bg-white border-2 border-[#776BFF] hover:shadow-lg"
                  data-testid={`card-cliente-${cliente.id}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Left Content */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground">
                        {cliente.razaoSocial || cliente.nome}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {cliente.cpfCnpj}
                      </div>
                    </div>

                    {/* Status */}
                    <div>
                      <Badge 
                        variant="secondary" 
                        className={`${statusColors[cliente.status] || ''} text-xs`}
                      >
                        {cliente.status}
                      </Badge>
                    </div>

                    {/* Score */}
                    <div className="w-32">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Score</span>
                        <span className="text-sm font-semibold text-primary">{cliente.score || 0}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div 
                          className="h-full bg-primary"
                          style={{ width: `${cliente.score || 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Carteira */}
                    {cliente.carteira && (
                      <div className="text-sm text-center min-w-24">
                        <div className="text-xs text-muted-foreground">Carteira</div>
                        <div className="font-medium">{cliente.carteira}</div>
                      </div>
                    )}

                    {/* Tags */}
                    <div className="flex gap-1">
                      {cliente.tags && cliente.tags.length > 0 ? (
                        <>
                          {cliente.tags.slice(0, 1).map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {cliente.tags.length > 1 && (
                            <Badge variant="outline" className="text-xs">
                              +{cliente.tags.length - 1}
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9"
                          data-testid={`button-actions-${cliente.id}`}
                        >
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
                        <DropdownMenuItem
                          onClick={() => setDeleteClientId(cliente.id)}
                          className="text-destructive"
                          data-testid={`button-delete-${cliente.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Deletar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
              </Link>
            ))}

            {/* Pagination */}
            {data.total > limit && (
              <div className="flex items-center justify-between mt-8 p-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Página {page} de {Math.ceil(data.total / limit)} • {data.total} clientes
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    data-testid="button-prev-page"
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page * limit >= data.total}
                    onClick={() => setPage(p => p + 1)}
                    data-testid="button-next-page"
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <Card className="p-12 text-center">
            <div className="text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum cliente encontrado</p>
              <p className="text-sm mt-1">
                Importe seus clientes ou crie um novo cadastro
              </p>
            </div>
          </Card>
        )}
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
              className="bg-destructive text-destructive-foreground"
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
    <div className="p-6 space-y-6">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <Card className="p-4">
        <Skeleton className="h-10 w-full" />
      </Card>
      <Card className="p-4">
        <Skeleton className="h-64 w-full" />
      </Card>
    </div>
  );
}

// Missing import
import { Users } from "lucide-react";
