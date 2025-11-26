import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, AlertCircle, Eye, MousePointerClick, Pause, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function CampanhasEmExecucao() {
  const { toast } = useToast();
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/campaigns");
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      const data = await res.json();
      return Array.isArray(data) ? data.filter((c: any) => ['enviando', 'pausada'].includes(c.status)) : [];
    },
    refetchInterval: 2000, // Atualiza a cada 2 segundos
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

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Campanhas em Execução</h1>
            <p className="text-muted-foreground mt-2">
              Monitore em tempo real as campanhas sendo enviadas
            </p>
          </div>
        </div>
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">
            Nenhuma campanha em execução no momento
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Campanhas em Execução</h1>
          <p className="text-muted-foreground mt-2">
            {campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''} ativa{campaigns.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {campaigns.map((campaign: any) => (
          <Card key={campaign.id} className="p-6">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{campaign.nome}</h3>
                <div className="flex gap-2 items-center mt-2">
                  {getStatusBadge(campaign.status)}
                  <span className="text-sm text-muted-foreground">
                    {campaign.agendadaPara && (
                      <>
                        <Clock className="w-4 h-4 inline mr-1" />
                        {format(new Date(campaign.agendadaPara), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </>
                    )}
                  </span>
                </div>
              </div>
              {campaign.status === 'enviando' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => pauseMutation.mutate(campaign.id)}
                    disabled={pauseMutation.isPending}
                    data-testid={`button-pause-campaign-${campaign.id}`}
                  >
                    <Pause className="w-4 h-4 mr-1" />
                    Pausar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteMutation.mutate(campaign.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-cancel-campaign-${campaign.id}`}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Cancelar
                  </Button>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Progresso de Envio</span>
                <span className="text-sm font-semibold">{calculateProgress(campaign)}%</span>
              </div>
              <Progress value={calculateProgress(campaign)} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {campaign.totalEnviados} de {campaign.totalRecipients} destinatários
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Enviados */}
              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium text-muted-foreground">Enviados</span>
                </div>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {campaign.totalEnviados}
                </p>
              </div>

              {/* Erros */}
              <div className="bg-red-50 dark:bg-red-950 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-xs font-medium text-muted-foreground">Erros</span>
                </div>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">
                  {campaign.totalErros}
                </p>
              </div>

              {/* Abertos */}
              <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-xs font-medium text-muted-foreground">Abertos</span>
                </div>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {campaign.totalAbertos}
                  <span className="text-xs font-normal ml-1">({calculateOpenRate(campaign)}%)</span>
                </p>
              </div>

              {/* Cliques */}
              <div className="bg-purple-50 dark:bg-purple-950 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <MousePointerClick className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-medium text-muted-foreground">Cliques</span>
                </div>
                <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {campaign.totalCliques}
                  <span className="text-xs font-normal ml-1">({calculateClickRate(campaign)}%)</span>
                </p>
              </div>
            </div>

            {/* Template Info */}
            {campaign.templateId && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Template ID: <span className="font-mono">{campaign.templateId.substring(0, 8)}...</span>
                </p>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Auto-refresh indicator */}
      <div className="mt-6 text-xs text-muted-foreground flex items-center gap-2">
        <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full" />
        Atualizando em tempo real a cada 2 segundos
      </div>
    </div>
  );
}
