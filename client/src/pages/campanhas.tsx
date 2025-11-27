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
import { Plus, Mail, MessageSquare, Calendar, Users, Send, TrendingUp } from "lucide-react";
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
    rascunho: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
    agendada: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    enviando: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    concluida: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    pausada: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  const totalCampanhas = campanhas?.length || 0;
  const campanhasAtivas = campanhas?.filter(c => c.status === 'enviando' || c.status === 'agendada').length || 0;
  const concluidasTotal = campanhas?.filter(c => c.status === 'concluida').length || 0;
  const totalEnviados = campanhas?.reduce((sum, c) => sum + (c.totalEnviados || 0), 0) || 0;

  if (authLoading || !isAuthenticated) {
    return <CampanhasSkeleton />;
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
                  <Send className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
                  Campanhas
                </h1>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mt-2">
                Gerencie suas campanhas de comunicação em massa
              </p>
            </div>
            <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="button-nova-campanha">
              <Link href="/campanhas/nova">
                <Plus className="h-4 w-4 mr-2" />
                Nova Campanha
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 pb-12">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total de Campanhas</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{totalCampanhas}</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Send className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Campanhas Ativas</p>
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">{campanhasAtivas}</p>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Concluídas</p>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{concluidasTotal}</p>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-lg">
                  <Mail className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Enviados</p>
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2">
                    {(totalEnviados / 1000).toFixed(1)}k
                  </p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </Card>
          </div>

          {/* Campaigns Table */}
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Nome</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Tipo</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Destinatários</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Enviados</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Taxa</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Agendamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30">
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
                        className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30 cursor-pointer transition-colors"
                        data-testid={`row-campanha-${campanha.id}`}
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white">{campanha.nome}</div>
                            <div className="text-xs text-slate-600 dark:text-slate-400">
                              {new Date(campanha.createdAt).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                            {campanha.tipo === 'email' ? (
                              <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <MessageSquare className="h-4 w-4 text-green-600 dark:text-green-400" />
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
                        <TableCell className="text-sm text-slate-700 dark:text-slate-300">
                          {campanha.totalRecipients?.toLocaleString('pt-BR') || 0}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-900 dark:text-white">
                                {(campanha.totalEnviados || 0)}
                              </span>
                              <span className="text-xs text-slate-600 dark:text-slate-400">
                                ({Math.round(((campanha.totalEnviados || 0) / ((campanha.totalRecipients || 1))) * 100)}%)
                              </span>
                            </div>
                            {(campanha.totalRecipients || 0) > 0 && (
                              <Progress 
                                value={((campanha.totalEnviados || 0) / (campanha.totalRecipients || 1)) * 100}
                                className="h-1"
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {(campanha.totalEnviados || 0) > 0 ? (
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                              {Math.round(((campanha.totalAbertos || 0) / (campanha.totalEnviados || 1)) * 100)}%
                            </span>
                          ) : (
                            <span className="text-sm text-slate-600 dark:text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {campanha.agendadaPara && new Date(campanha.agendadaPara).toString() !== 'Invalid Date' ? (
                            <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                              <Calendar className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                              {new Date(String(campanha.agendadaPara)).toLocaleString('pt-BR')}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-600 dark:text-slate-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        <div className="text-slate-500 dark:text-slate-400">
                          <Mail className="h-12 w-12 mx-auto mb-3 opacity-40" />
                          <p className="font-medium">Nenhuma campanha criada</p>
                          <p className="text-sm mt-1">
                            Crie sua primeira campanha para começar a engajar seus clientes
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
    </div>
  );
}

function CampanhasSkeleton() {
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
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-6 border-0 shadow-sm">
                <Skeleton className="h-8 w-32" />
              </Card>
            ))}
          </div>
          <Card className="p-4 border-0 shadow-sm">
            <Skeleton className="h-64 w-full" />
          </Card>
        </div>
      </div>
    </div>
  );
}
