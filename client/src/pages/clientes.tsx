import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
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
  Search, 
  Plus, 
  Filter,
  Download,
  Tag,
  MoreHorizontal,
} from "lucide-react";
import type { Client } from "@shared/schema";

export default function Clientes() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [page, setPage] = useState(1);
  const limit = 20;

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

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome / Razão Social</TableHead>
              <TableHead>CPF/CNPJ</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Carteira</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                </TableRow>
              ))
            ) : data?.clientes && data.clientes.length > 0 ? (
              data.clientes.map((cliente) => (
                <TableRow 
                  key={cliente.id} 
                  className="cursor-pointer hover-elevate"
                  data-testid={`row-cliente-${cliente.id}`}
                >
                  <TableCell>
                    <Link href={`/clientes/${cliente.id}`}>
                      <div>
                        <div className="font-medium">{cliente.nome}</div>
                        {cliente.razaoSocial && (
                          <div className="text-sm text-muted-foreground">
                            {cliente.razaoSocial}
                          </div>
                        )}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
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
                  <TableCell className="text-sm">
                    {cliente.carteira || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">{cliente.score || 0}</div>
                      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                        <div 
                          className="h-full bg-primary"
                          style={{ width: `${cliente.score || 0}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {cliente.tags && cliente.tags.length > 0 ? (
                        cliente.tags.slice(0, 2).map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                      {cliente.tags && cliente.tags.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{cliente.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" data-testid="button-actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
                    <p>Nenhum cliente encontrado</p>
                    <p className="text-sm mt-1">
                      Importe seus clientes ou crie um novo cadastro
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {data && data.total > limit && (
          <div className="flex items-center justify-between p-4 border-t">
            <div className="text-sm text-muted-foreground">
              Mostrando {(page - 1) * limit + 1} a {Math.min(page * limit, data.total)} de {data.total} clientes
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
      </Card>
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
