import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock, CheckCircle, AlertCircle, Eye, MousePointerClick, Pause, Trash2, Activity, Loader2, Play } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function CampanhasEmExecucao() {
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

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/campaigns");
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      const data = await res.json();
      return Array.isArray(data) ? data.filter((c: any) => ['enviando', 'pausada'].includes(c.status)) : [];
    },
    refetchInterval: 1000, // ✅ Aumentado para 1s para atualizar em tempo real
    enabled: isAuthenticated,
  });

  const pauseMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest("POST", `/api/campaigns/${campaignId}/pause`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Campanha pausada",
        description: "A campanha foi pausada com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao pausar a campanha",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest("POST", `/api/campaigns/${campaignId}/cancel`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Campanha cancelada",
        description: "A campanha foi cancelada e removida.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao cancelar a campanha",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'enviando':
        return <Badge className="bg-blue-500">📤 Enviando</Badge>;
      case 'concluida':
        return <Badge className="bg-green-500">✅ Concluída</Badge>;
      case 'cancelada':
        return <Badge className="bg-red-500">❌ Cancelada</Badge>;
      case 'pausada':
        return <Badge className="bg-yellow-500">⏸️ Pausada</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const calculateProgress = (campaign: any) => {
    if (campaign.totalRecipients === 0) return 0;
    return Math.round((campaign.totalEnviados / campaign.totalRecipients) * 100);
  };

  const calculateOpenRate = (campaign: any) => {
    if (campaign.totalEnviados === 0) return 0;
    return Math.round((campaign.totalAbertos / campaign.totalEnviados) * 100);
  };

  const calculateClickRate = (campaign: any) => {
    if (campaign.totalEnviados === 0) return 0;
    return Math.round((campaign.totalCliques / campaign.totalEnviados) * 100);
  };

  if (authLoading || !isAuthenticated) {
    return <CampaignesSkeleton />;
  }

  const enviadoCount = campaigns.filter(c => c.status === 'enviando').length;
  const pausadaCount = campaigns.filter(c => c.status === 'pausada').length;
  const totalEnviados = campaigns.reduce((sum, c) => sum + (c.totalEnviados || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header Section */}
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-green-500/10 rounded-xl">
                  <Activity className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
                  Campanhas em Execução
                </h1>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mt-2">
                Monitore em tempo real as campanhas sendo enviadas
              </p>
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
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total em Execução</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{campaigns.length}</p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <Activity className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Enviando</p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">{enviadoCount}</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Play className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Enviados</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{totalEnviados}</p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-purple-600 dark:text-purple-400" />
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
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Campanha</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Progresso</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Enviados</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Abertos</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      </TableRow>
                    ))
                  ) : campaigns && campaigns.length > 0 ? (
                    campaigns.map((campaign: any) => (
                      <TableRow 
                        key={campaign.id}
                        className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                        data-testid={`campaign-row-${campaign.id}`}
                      >
                        <TableCell>
                          <div>
                            <span className="font-medium text-slate-900 dark:text-white">{campaign.nome}</span>
                            {campaign.agendadaPara && (
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(campaign.agendadaPara), "dd/MM HH:mm", { locale: ptBR })}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(campaign.status)}
                        </TableCell>
                        <TableCell>
                          <div className="w-32">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium">{calculateProgress(campaign)}%</span>
                            </div>
                            <Progress value={calculateProgress(campaign)} className="h-1.5" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="font-semibold text-slate-900 dark:text-white">{campaign.totalEnviados}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">/{campaign.totalRecipients}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="font-semibold text-slate-900 dark:text-white">{campaign.totalAbertos}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">({calculateOpenRate(campaign)}%)</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            {campaign.status === 'enviando' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => pauseMutation.mutate(campaign.id)}
                                  disabled={pauseMutation.isPending}
                                  data-testid={`button-pause-campaign-${campaign.id}`}
                                >
                                  {pauseMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Pause className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteMutation.mutate(campaign.id)}
                                  disabled={deleteMutation.isPending}
                                  data-testid={`button-cancel-campaign-${campaign.id}`}
                                >
                                  {deleteMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <div className="text-slate-500 dark:text-slate-400">
                          <Activity className="h-12 w-12 mx-auto mb-3 opacity-40" />
                          <p className="font-medium">Nenhuma campanha em execução</p>
                          <p className="text-sm mt-1">
                            Campanhas aparecerão aqui quando forem iniciadas
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Auto-refresh indicator */}
          {campaigns.length > 0 && (
            <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full" />
              Atualizando em tempo real a cada 2 segundos
            </div>
          )}
        </div>
      </div>
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
