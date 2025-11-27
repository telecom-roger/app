import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Shield, UserCog, User as UserIcon } from "lucide-react";
import type { User } from "@shared/schema";

export default function AdminUsuarios() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

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
    
    if (!authLoading && isAuthenticated && user?.role !== 'admin') {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
      window.location.href = "/";
    }
  }, [isAuthenticated, authLoading, user, toast]);

  const { data: usuarios, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    manager: "Gerente",
    agent: "Agente",
  };

  const roleColors: Record<string, string> = {
    admin: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    manager: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    agent: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };

  const roleIcons: Record<string, React.ReactNode> = {
    admin: <Shield className="h-3 w-3" />,
    manager: <UserCog className="h-3 w-3" />,
    agent: <UserIcon className="h-3 w-3" />,
  };

  if (authLoading || !isAuthenticated || user?.role !== 'admin') {
    return <AdminUsuariosSkeleton />;
  }

  const totalUsers = usuarios?.length || 0;
  const adminCount = usuarios?.filter(u => u.role === 'admin').length || 0;
  const managerCount = usuarios?.filter(u => u.role === 'manager').length || 0;
  const agentCount = usuarios?.filter(u => u.role === 'agent').length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header Section */}
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-purple-500/10 rounded-xl">
              <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
              Gestão de Usuários
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Gerencie usuários, permissões e acesso à plataforma
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 pb-12">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 overflow-hidden hover-elevate">
              <div className="px-6 py-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">Total de Usuários</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{totalUsers}</p>
              </div>
            </Card>

            <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 overflow-hidden hover-elevate">
              <div className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">Administradores</p>
                </div>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-1">{adminCount}</p>
              </div>
            </Card>

            <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 overflow-hidden hover-elevate">
              <div className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <UserCog className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">Gerentes</p>
                </div>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{managerCount}</p>
              </div>
            </Card>

            <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 overflow-hidden hover-elevate">
              <div className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">Agentes</p>
                </div>
                <p className="text-3xl font-bold text-gray-600 dark:text-gray-400 mt-1">{agentCount}</p>
              </div>
            </Card>
          </div>

          {/* Table Card */}
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 overflow-hidden">
            <div className="px-6 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Lista de Usuários</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {totalUsers} usuário{totalUsers !== 1 ? 's' : ''} registrado{totalUsers !== 1 ? 's' : ''}
                  </p>
                </div>
                <Button data-testid="button-novo-usuario">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Usuário
                </Button>
              </div>
            </div>

            <div className="px-6 pb-6 mt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 dark:border-slate-700">
                      <TableHead className="text-slate-900 dark:text-slate-100">Usuário</TableHead>
                      <TableHead className="text-slate-900 dark:text-slate-100">Email</TableHead>
                      <TableHead className="text-slate-900 dark:text-slate-100">Perfil</TableHead>
                      <TableHead className="text-slate-900 dark:text-slate-100">Status</TableHead>
                      <TableHead className="text-slate-900 dark:text-slate-100">Último Acesso</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i} className="border-slate-200 dark:border-slate-700">
                          <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                        </TableRow>
                      ))
                    ) : usuarios && usuarios.length > 0 ? (
                      usuarios.map((usuario) => (
                        <TableRow 
                          key={usuario.id}
                          className="border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                          data-testid={`row-usuario-${usuario.id}`}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={usuario.profileImageUrl || undefined} />
                                <AvatarFallback className="text-sm bg-primary text-primary-foreground">
                                  {usuario.firstName?.[0]}{usuario.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium text-slate-900 dark:text-white">
                                  {usuario.firstName} {usuario.lastName}
                                </div>
                                <div className="text-xs text-slate-600 dark:text-slate-400">
                                  ID: {usuario.id.substring(0, 8)}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-900 dark:text-slate-100">
                            {usuario.email}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="secondary"
                              className={`${roleColors[usuario.role]} flex items-center gap-1 w-fit`}
                            >
                              {roleIcons[usuario.role]}
                              {roleLabels[usuario.role]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={usuario.active ? "default" : "secondary"}>
                              {usuario.active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                            {usuario.updatedAt ? new Date(usuario.updatedAt).toLocaleDateString('pt-BR') : '-'}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" data-testid={`button-edit-usuario-${usuario.id}`}>
                              Editar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow className="border-slate-200 dark:border-slate-700">
                        <TableCell colSpan={6} className="text-center py-12">
                          <div className="text-slate-600 dark:text-slate-400">
                            <UserIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
                            <p>Nenhum usuário encontrado</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AdminUsuariosSkeleton() {
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    </div>
  );
}
