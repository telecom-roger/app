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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie usuários e permissões
          </p>
        </div>
        <Button data-testid="button-novo-usuario">
          <Plus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Último Acesso</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
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
                  className="hover-elevate"
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
                        <div className="font-medium">
                          {usuario.firstName} {usuario.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ID: {usuario.id.substring(0, 8)}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
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
                  <TableCell className="text-sm text-muted-foreground">
                    {usuario.updatedAt ? new Date(usuario.updatedAt).toLocaleDateString('pt-BR') : '-'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="text-muted-foreground">
                    <UserIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
                    <p>Nenhum usuário encontrado</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function AdminUsuariosSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <Card className="p-4">
        <Skeleton className="h-64 w-full" />
      </Card>
    </div>
  );
}
