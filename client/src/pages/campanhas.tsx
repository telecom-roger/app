import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Mail, MessageSquare, Calendar, Users, BarChart } from "lucide-react";
import type { Campaign } from "@shared/schema";

export default function Campanhas() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

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

  const { data: campanhas, isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    enabled: isAuthenticated,
  });

  const statusColors: Record<string, string> = {
    rascunho: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    agendada: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    enviando: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    concluida: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    pausada: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  if (authLoading || !isAuthenticated) {
    return <CampanhasSkeleton />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Campanhas</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas campanhas de comunicação
          </p>
        </div>
        <Button asChild data-testid="button-nova-campanha">
          <Link href="/campanhas/nova">
            <Plus className="h-4 w-4 mr-2" />
            Nova Campanha
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Campanhas Ativas
            </CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {campanhas?.filter(c => c.status === 'enviando' || c.status === 'agendada').length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Abertura Média
            </CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">42.5%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Enviados (mês)
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">12,543</div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Destinatários</TableHead>
              <TableHead>Enviados</TableHead>
              <TableHead>Taxa de Abertura</TableHead>
              <TableHead>Agendamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                </TableRow>
              ))
            ) : campanhas && campanhas.length > 0 ? (
              campanhas.map((campanha) => (
                <TableRow 
                  key={campanha.id}
                  className="cursor-pointer hover-elevate"
                  data-testid={`row-campanha-${campanha.id}`}
                >
                  <TableCell>
                    <div>
                      <div className="font-medium">{campanha.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(campanha.createdAt).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {campanha.tipo === 'email' ? (
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="capitalize">{campanha.tipo}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary"
                      className={statusColors[campanha.status] || ''}
                    >
                      {campanha.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {campanha.totalRecipients?.toLocaleString('pt-BR') || 0}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {campanha.totalEnviados || 0}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({Math.round(((campanha.totalEnviados || 0) / (campanha.totalRecipients || 1)) * 100)}%)
                        </span>
                      </div>
                      {campanha.totalRecipients > 0 && (
                        <Progress 
                          value={((campanha.totalEnviados || 0) / campanha.totalRecipients) * 100}
                          className="h-1"
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {campanha.totalEnviados > 0 ? (
                      <span className="text-sm font-medium">
                        {Math.round(((campanha.totalAbertos || 0) / campanha.totalEnviados) * 100)}%
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {campanha.agendadaPara ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {new Date(campanha.agendadaPara).toLocaleString('pt-BR')}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto mb-3 opacity-40" />
                    <p>Nenhuma campanha criada</p>
                    <p className="text-sm mt-1">
                      Crie sua primeira campanha para começar a engajar seus clientes
                    </p>
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

function CampanhasSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <Skeleton className="h-64 w-full" />
      </Card>
    </div>
  );
}
