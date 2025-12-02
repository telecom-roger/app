import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  ArrowLeft,
  Send,
  CheckCheck,
  Eye,
  MessageCircle,
  AlertTriangle,
  Clock,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Phone,
  Mail,
} from "lucide-react";

interface CampaignDetails {
  campaign: {
    id: string;
    nome: string;
    status: string;
    tipo: string;
    createdAt: string;
    agendadaPara?: string;
    totalRecipients: number;
    totalEnviados: number;
    totalErros: number;
  };
  resumo: {
    total: number;
    enviados: number;
    entregues: number;
    visualizados: number;
    respondidos: number;
    erros: number;
    pendentes: number;
    engajamentoAlto: number;
    engajamentoMedio: number;
    engajamentoBaixo: number;
    semEngajamento: number;
  };
  clientes: Array<{
    id: string;
    clientId: string;
    nome: string;
    telefone: string;
    email: string;
    status: string;
    etiqueta: string;
    engajamento: string;
    statusWhatsapp: number;
    erroMensagem?: string;
    dataSending?: string;
    dataEntrega?: string;
    dataVisualizacao?: string;
    dataPrimeiraResposta?: string;
    dataUltimaResposta?: string;
    totalRespostas: number;
    ultimaInteracao?: string;
  }>;
  timeline: Array<{
    data: string;
    tipo: string;
    descricao: string;
    clienteNome?: string;
  }>;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
    erro: { variant: "destructive", icon: AlertTriangle },
    enviado: { variant: "secondary", icon: Send },
    entregue: { variant: "default", icon: CheckCheck },
    lido: { variant: "default", icon: Eye },
  };

  const cfg = config[status] || { variant: "outline", icon: Clock };
  const Icon = cfg.icon;

  return (
    <Badge variant={cfg.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function EtiquetaBadge({ etiqueta }: { etiqueta: string }) {
  const colors: Record<string, string> = {
    "Respondeu": "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30",
    "Visualizado": "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
    "Entregue": "bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30",
    "Enviado": "bg-gray-500/20 text-gray-700 dark:text-gray-400 border-gray-500/30",
    "Erro no envio": "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
  };

  return (
    <Badge variant="outline" className={colors[etiqueta] || "bg-gray-100"}>
      {etiqueta}
    </Badge>
  );
}

function EngajamentoBadge({ engajamento }: { engajamento: string }) {
  const config: Record<string, { color: string; icon: any }> = {
    alto: { color: "bg-green-500/20 text-green-700 dark:text-green-400", icon: TrendingUp },
    medio: { color: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400", icon: Minus },
    baixo: { color: "bg-orange-500/20 text-orange-700 dark:text-orange-400", icon: TrendingDown },
    nenhum: { color: "bg-gray-500/20 text-gray-600 dark:text-gray-400", icon: Minus },
  };

  const cfg = config[engajamento] || config.nenhum;
  const Icon = cfg.icon;

  return (
    <Badge variant="outline" className={`gap-1 ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {engajamento.charAt(0).toUpperCase() + engajamento.slice(1)}
    </Badge>
  );
}

function TimelineIcon({ tipo }: { tipo: string }) {
  const icons: Record<string, { icon: any; color: string }> = {
    envio: { icon: Send, color: "text-blue-500" },
    entrega: { icon: CheckCheck, color: "text-purple-500" },
    visualizacao: { icon: Eye, color: "text-green-500" },
    resposta: { icon: MessageCircle, color: "text-emerald-500" },
    erro: { icon: AlertTriangle, color: "text-red-500" },
  };

  const cfg = icons[tipo] || { icon: Clock, color: "text-gray-500" };
  const Icon = cfg.icon;

  return <Icon className={`h-4 w-4 ${cfg.color}`} />;
}

export default function CampanhaDetalhes() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, refetch } = useQuery<CampaignDetails>({
    queryKey: ["/api/campaigns", id, "details"],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${id}/details`);
      if (!res.ok) throw new Error("Failed to fetch campaign details");
      return res.json();
    },
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Campanha não encontrada</p>
            <Link href="/campanhas-historico">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao Histórico
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { campaign, resumo, clientes, timeline } = data;

  const taxaEntrega = resumo.total > 0 ? Math.round((resumo.entregues / resumo.total) * 100) : 0;
  const taxaVisualizacao = resumo.entregues > 0 ? Math.round((resumo.visualizados / resumo.entregues) * 100) : 0;
  const taxaResposta = resumo.visualizados > 0 ? Math.round((resumo.respondidos / resumo.visualizados) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/campanhas-historico">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-campaign-name">{campaign.nome}</h1>
            <p className="text-muted-foreground text-sm">
              Criada em {format(new Date(campaign.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              {campaign.agendadaPara && ` • Agendada para ${format(new Date(campaign.agendadaPara), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card data-testid="card-total">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">Total</span>
            </div>
            <p className="text-2xl font-bold">{resumo.total}</p>
          </CardContent>
        </Card>

        <Card data-testid="card-enviados">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-blue-500 mb-1">
              <Send className="h-4 w-4" />
              <span className="text-xs font-medium">Enviados</span>
            </div>
            <p className="text-2xl font-bold">{resumo.enviados}</p>
          </CardContent>
        </Card>

        <Card data-testid="card-entregues">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-purple-500 mb-1">
              <CheckCheck className="h-4 w-4" />
              <span className="text-xs font-medium">Entregues</span>
            </div>
            <p className="text-2xl font-bold">{resumo.entregues}</p>
            <p className="text-xs text-muted-foreground">{taxaEntrega}% do total</p>
          </CardContent>
        </Card>

        <Card data-testid="card-visualizados">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-500 mb-1">
              <Eye className="h-4 w-4" />
              <span className="text-xs font-medium">Visualizados</span>
            </div>
            <p className="text-2xl font-bold">{resumo.visualizados}</p>
            <p className="text-xs text-muted-foreground">{taxaVisualizacao}% dos entregues</p>
          </CardContent>
        </Card>

        <Card data-testid="card-respondidos">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-emerald-500 mb-1">
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Respondidos</span>
            </div>
            <p className="text-2xl font-bold">{resumo.respondidos}</p>
            <p className="text-xs text-muted-foreground">{taxaResposta}% dos visualizados</p>
          </CardContent>
        </Card>

        <Card data-testid="card-erros">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-500 mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">Erros</span>
            </div>
            <p className="text-2xl font-bold">{resumo.erros}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-green-500/30" data-testid="card-engajamento-alto">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-500/20">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Engajamento Alto</p>
              <p className="text-xl font-bold">{resumo.engajamentoAlto}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/30" data-testid="card-engajamento-medio">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-yellow-500/20">
              <Minus className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Engajamento Médio</p>
              <p className="text-xl font-bold">{resumo.engajamentoMedio}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-500/30" data-testid="card-engajamento-baixo">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-orange-500/20">
              <TrendingDown className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Engajamento Baixo</p>
              <p className="text-xl font-bold">{resumo.engajamentoBaixo}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-500/30" data-testid="card-sem-engajamento">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-gray-500/20">
              <Minus className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sem Engajamento</p>
              <p className="text-xl font-bold">{resumo.semEngajamento}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="clientes" className="w-full">
        <TabsList>
          <TabsTrigger value="clientes" data-testid="tab-clientes">
            <Users className="h-4 w-4 mr-2" />
            Relatório por Cliente ({clientes.length})
          </TabsTrigger>
          <TabsTrigger value="timeline" data-testid="tab-timeline">
            <Clock className="h-4 w-4 mr-2" />
            Timeline ({timeline.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Relatório Individual por Cliente</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Etiqueta</TableHead>
                      <TableHead>Engajamento</TableHead>
                      <TableHead>Respostas</TableHead>
                      <TableHead>Última Interação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                          Nenhum envio registrado ainda
                        </TableCell>
                      </TableRow>
                    ) : (
                      clientes.map((cliente) => (
                        <TableRow key={cliente.id} data-testid={`row-cliente-${cliente.clientId}`}>
                          <TableCell>
                            <Link href={`/clientes/${cliente.clientId}`}>
                              <span className="font-medium hover:underline cursor-pointer">
                                {cliente.nome || "Sem nome"}
                              </span>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {cliente.telefone && (
                                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {cliente.telefone}
                                </span>
                              )}
                              {cliente.email && (
                                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Mail className="h-3 w-3" />
                                  {cliente.email}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={cliente.status} />
                          </TableCell>
                          <TableCell>
                            <EtiquetaBadge etiqueta={cliente.etiqueta} />
                          </TableCell>
                          <TableCell>
                            <EngajamentoBadge engajamento={cliente.engajamento} />
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{cliente.totalRespostas}</span>
                          </TableCell>
                          <TableCell>
                            {cliente.ultimaInteracao ? (
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(cliente.ultimaInteracao), "dd/MM HH:mm", { locale: ptBR })}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Log da Campanha</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {timeline.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    Nenhum evento registrado ainda
                  </div>
                ) : (
                  <div className="space-y-4">
                    {timeline.map((evento, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 pb-4 border-b last:border-0"
                        data-testid={`timeline-event-${index}`}
                      >
                        <div className="mt-1">
                          <TimelineIcon tipo={evento.tipo} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{evento.descricao}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(evento.data), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
