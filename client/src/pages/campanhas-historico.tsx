import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Eye, AlertCircle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

type CampaignDetail = {
  id: string;
  nome: string;
  status: string;
  agendadaPara?: string;
  totalRecipients: number;
  totalEnviados: number;
  totalErros: number;
  filtros?: any;
};

export default function CampanhasHistorico() {
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDetail | null>(null);
  const [detailsData, setDetailsData] = useState<any[]>([]);

  const { data: campaigns = [], isLoading } = useQuery<CampaignDetail[]>({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/campaigns");
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      const data = await res.json();
      return Array.isArray(data) 
        ? data.filter((c: any) => ['concluida', 'enviando', 'pausada'].includes(c.status))
        : [];
    },
    refetchInterval: 3000,
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'concluida':
        return <Badge className="bg-green-500">✅ Concluída</Badge>;
      case 'enviando':
        return <Badge className="bg-blue-500">📤 Enviando</Badge>;
      case 'pausada':
        return <Badge className="bg-yellow-500">⏸️ Pausada</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
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
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Histórico de Campanhas</h1>
          <p className="text-muted-foreground mt-2">
            Visualize relatórios detalhados de campanhas enviadas
          </p>
        </div>
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">
            Nenhuma campanha enviada ainda
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Histórico de Campanhas</h1>
        <p className="text-muted-foreground mt-2">
          Relatórios detalhados de campanhas enviadas e em execução
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Campanhas Enviadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome da Campanha</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Taxa Sucesso</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => {
                  const taxa = campaign.totalRecipients > 0 
                    ? Math.round((campaign.totalEnviados / campaign.totalRecipients) * 100)
                    : 0;
                  
                  return (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">{campaign.nome}</TableCell>
                      <TableCell className="text-sm">
                        {campaign.agendadaPara 
                          ? format(new Date(campaign.agendadaPara), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">{campaign.totalEnviados}</span>
                        <span className="text-muted-foreground"> / {campaign.totalRecipients}</span>
                      </TableCell>
                      <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {taxa > 0 ? (
                            <>
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span className="text-sm font-medium">{taxa}%</span>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(campaign)}
                          data-testid={`button-view-details-${campaign.id}`}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Detalhes */}
      <Dialog open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Detalhes da Campanha</DialogTitle>
            <DialogDescription>{selectedCampaign?.nome}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Resumo */}
            <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Data/Hora</p>
                <p className="font-semibold">
                  {selectedCampaign?.agendadaPara 
                    ? format(new Date(selectedCampaign.agendadaPara), "dd/MM/yyyy HH:mm", { locale: ptBR })
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Enviados</p>
                <p className="font-semibold text-green-600">{selectedCampaign?.totalEnviados}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Erros</p>
                <p className="font-semibold text-red-600">{selectedCampaign?.totalErros}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                {selectedCampaign && getStatusBadge(selectedCampaign.status)}
              </div>
            </div>

            {/* Lista de Empresas/Celulares */}
            <div className="border rounded-lg">
              <div className="p-4 border-b bg-muted/50">
                <h3 className="font-semibold text-sm">Empresas Contatadas</h3>
              </div>
              <ScrollArea className="h-96">
                <div className="p-4 text-xs text-muted-foreground">
                  Total de contatos: <strong>{detailsData.length}</strong>
                </div>
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow className="border-b sticky top-0 bg-muted">
                      <TableHead className="px-4">Empresa / Razão Social</TableHead>
                      <TableHead className="px-4">Celular Principal</TableHead>
                      <TableHead className="px-4">Email</TableHead>
                      <TableHead className="px-4">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailsData && detailsData.length > 0 ? (
                      detailsData.map((item: any, idx) => (
                        <TableRow key={idx} className="border-b hover:bg-muted/50">
                          <TableCell className="px-4 py-2 font-medium" data-testid={`text-empresa-${idx}`}>
                            {item.razaoSocial || item.empresa || "-"}
                          </TableCell>
                          <TableCell className="px-4 py-2 font-mono text-xs" data-testid={`text-celular-${idx}`}>
                            {item.CELULAR_PRINCIPAL || item.telefone || "-"}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-xs" data-testid={`text-email-${idx}`}>
                            {item.email || item.EMAIL_PRINCIPAL || "-"}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            <Badge className="bg-green-100 text-green-800 text-xs">✓ Enviado</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="p-4 text-center text-muted-foreground">
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
