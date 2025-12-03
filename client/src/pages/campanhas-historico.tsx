import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, AlertCircle, CheckCircle, History, Zap, TrendingUp, Target, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";

type CampaignDetail = {
  id: string;
  nome: string;
  status: string;
  agendadaPara?: string;
  totalRecipients: number;
  totalEnviados: number;
  totalErros: number;
  filtros?: {
    origemDisparo?: string;
    clientIds?: string[];
    [key: string]: any;
  };
};

export default function CampanhasHistorico() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDetail | null>(null);
  const [detailsData, setDetailsData] = useState<any[]>([]);
  const [retryingCampaign, setRetryingCampaign] = useState<string | null>(null);

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

  const { data: campaigns = [], isLoading } = useQuery<CampaignDetail[]>({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/campaigns");
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      const data = await res.json();
      return Array.isArray(data) 
        ? data.filter((c: any) => c.status === 'concluida' || c.status === 'erro')
        : [];
    },
    refetchInterval: 3000,
    enabled: isAuthenticated,
  });

  const handleViewDetails = async (campaign: CampaignDetail) => {
    setSelectedCampaign(campaign);
    setDetailsData([]); // Reset dados
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/details`);
      if (res.ok) {
        const data = await res.json();
        console.log("Detalhes recebidos:", data);
        setDetailsData(Array.isArray(data) ? data : []);
      } else {
        console.error("Erro na resposta:", res.status);
      }
    } catch (err) {
      console.error("Erro ao buscar detalhes:", err);
      setDetailsData([]);
    }
  };

  const handleRetry = async (campaignId: string, campaignName: string) => {
    setRetryingCampaign(campaignId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/retry`, {
        method: 'POST',
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao reprocessar campanha');
      }
      
      const data = await res.json();
      
      // ✅ Invalidar cache para refletir mudança imediatamente
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      
      toast({
        title: "✅ Campanha reprocessada!",
        description: `A campanha "${campaignName}" foi reagendada e será executada em breve.`,
      });
    } catch (err: any) {
      toast({
        title: "❌ Erro ao reprocessar",
        description: err.message || "Não foi possível reprocessar a campanha",
        variant: "destructive",
      });
    } finally {
      setRetryingCampaign(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'concluida':
        return <Badge className="bg-green-500">✅ Concluída</Badge>;
      case 'erro':
        return <Badge className="bg-red-500">❌ Erro</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (authLoading || !isAuthenticated) {
    return <HistoricoSkeleton />;
  }

  const totalCampanhas = campaigns.length;
  const totalEnviados = campaigns.reduce((sum, c) => sum + (c.totalEnviados || 0), 0);
  const taxaMediaSucesso = totalEnviados > 0
    ? Math.round(
        (campaigns.reduce((sum, c) => sum + (c.totalEnviados || 0), 0) / 
         campaigns.reduce((sum, c) => sum + (c.totalRecipients || 0), 0)) * 100
      )
    : 0;
  const totalErros = campaigns.reduce((sum, c) => sum + (c.totalErros || 0), 0);

  if (campaigns.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="px-6 py-8 md:py-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-purple-500/10 rounded-xl">
                <History className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
                Histórico de Campanhas
              </h1>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              Visualize relatórios detalhados de campanhas enviadas
            </p>
          </div>
        </div>
        <div className="px-6 pb-12">
          <div className="max-w-7xl mx-auto">
            <Card className="p-8 text-center border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-slate-400 opacity-50" />
              <p className="text-slate-600 dark:text-slate-400 font-medium">
                Nenhuma campanha enviada ainda
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                Campanhas concluídas aparecerão aqui
              </p>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-purple-500/10 rounded-xl">
              <History className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
              Histórico de Campanhas
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Relatórios detalhados de campanhas enviadas e conclusões
          </p>
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
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Campanhas</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{totalCampanhas}</p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <History className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Enviados</p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">{totalEnviados}</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Taxa Média</p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{taxaMediaSucesso}%</p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Erros</p>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">{totalErros}</p>
                </div>
                <div className="p-3 bg-red-500/10 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
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
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Origem</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Data/Hora</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Quantidade</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Taxa Sucesso</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      </TableRow>
                    ))
                  ) : (
                    campaigns.map((campaign) => {
                      const taxa = campaign.totalRecipients > 0 
                        ? Math.round((campaign.totalEnviados / campaign.totalRecipients) * 100)
                        : 0;
                      
                      return (
                        <TableRow 
                          key={campaign.id}
                          className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                          data-testid={`campaign-history-row-${campaign.id}`}
                        >
                          <TableCell className="font-medium text-slate-900 dark:text-white">{campaign.nome}</TableCell>
                          <TableCell className="text-sm">
                            <Badge variant="outline" className="text-xs">
                              {campaign.filtros?.origemDisparo === 'envio_imediato' ? '⚡ Imediato' : '📅 Agendado'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                            {campaign.agendadaPara 
                              ? format(new Date(campaign.agendadaPara), "dd/MM/yyyy HH:mm", { locale: ptBR })
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <span className="font-semibold text-slate-900 dark:text-white">{campaign.totalEnviados}</span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">/{campaign.totalRecipients}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {taxa > 0 ? (
                                <>
                                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                  <span className="text-sm font-medium text-slate-900 dark:text-white">{taxa}%</span>
                                </>
                              ) : (
                                <span className="text-sm text-slate-500 dark:text-slate-400">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {campaign.status === 'erro' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRetry(campaign.id, campaign.nome)}
                                  disabled={retryingCampaign === campaign.id}
                                  data-testid={`button-retry-${campaign.id}`}
                                  className="border-purple-500 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950"
                                >
                                  <RefreshCw className={`h-4 w-4 mr-1 ${retryingCampaign === campaign.id ? 'animate-spin' : ''}`} />
                                  Reprocessar
                                </Button>
                              )}
                              <Link href={`/campanhas/${campaign.id}/detalhes`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  data-testid={`button-view-details-${campaign.id}`}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Ver Relatório
                                </Button>
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>

      {/* Details Modal */}
      <Dialog open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Detalhes da Campanha</DialogTitle>
            <DialogDescription>{selectedCampaign?.nome}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Data/Hora</p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {selectedCampaign?.agendadaPara 
                    ? format(new Date(selectedCampaign.agendadaPara), "dd/MM/yyyy HH:mm", { locale: ptBR })
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Enviados</p>
                <p className="font-semibold text-green-600 dark:text-green-400">{selectedCampaign?.totalEnviados}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Erros</p>
                <p className="font-semibold text-red-600 dark:text-red-400">{selectedCampaign?.totalErros}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Status</p>
                {selectedCampaign && getStatusBadge(selectedCampaign.status)}
              </div>
            </div>

            {/* Contacts List */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Empresas Contatadas</h3>
              </div>
              <ScrollArea className="h-96">
                <div className="p-4 text-xs text-slate-600 dark:text-slate-400">
                  Total de contatos: <strong>{detailsData.length}</strong>
                </div>
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow className="border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-slate-50 dark:bg-slate-900/50">
                      <TableHead className="px-4 text-slate-900 dark:text-slate-100">Empresa / Razão Social</TableHead>
                      <TableHead className="px-4 text-slate-900 dark:text-slate-100">Celular Principal</TableHead>
                      <TableHead className="px-4 text-slate-900 dark:text-slate-100">Email</TableHead>
                      <TableHead className="px-4 text-slate-900 dark:text-slate-100">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailsData && detailsData.length > 0 ? (
                      detailsData.map((item: any, idx) => (
                        <TableRow key={idx} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                          <TableCell className="px-4 py-2 font-medium text-slate-900 dark:text-white" data-testid={`text-empresa-${idx}`}>
                            {item.nome || item.empresa || "-"}
                          </TableCell>
                          <TableCell className="px-4 py-2 font-mono text-xs text-slate-600 dark:text-slate-400" data-testid={`text-celular-${idx}`}>
                            {item.celular || "-"}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400" data-testid={`text-email-${idx}`}>
                            {item.email || "-"}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 text-xs border-0">✓ Enviado</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="p-4 text-center text-slate-500 dark:text-slate-400">
                          Carregando dados...
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HistoricoSkeleton() {
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
