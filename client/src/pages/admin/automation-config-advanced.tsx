import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Plus, X, Clock, AlertTriangle, Zap, Save, MessageSquare, Calendar, Settings, CheckCircle } from "lucide-react";

const ALL_JOBS = [
  {
    id: "follow_up",
    nome: "Follow-up Automático",
    descricao: "Agendas follow-ups 1d, 3d, 7d após resposta",
    icon: "📞",
  },
  {
    id: "re_engagement",
    nome: "Re-engagement",
    descricao: "Notifica vendedor se cliente inativo 30+ dias",
    icon: "♻️",
  },
  {
    id: "score_update",
    nome: "Score Update",
    descricao: "Recalcula score do cliente (0-100)",
    icon: "⭐",
  },
  {
    id: "contract_reminder",
    nome: "Contract Reminder",
    descricao: "Lembretes de contratação - 2h, 4 dias",
    icon: "📋",
    frequencia: "08:00, 16:30",
    dias: [0, 1, 2, 3],
  },
  {
    id: "contrato_enviado_message",
    nome: "Contrato Enviado",
    descricao: "Instrui assinatura digital",
    icon: "📄",
    dias: [0],
  },
  {
    id: "aguardando_aceite_reminder",
    nome: "Aguardando Aceite",
    descricao: "3 lembretes + move para ATENÇÃO",
    icon: "📝",
    dias: [1, 2, 3],
  },
];

const JOBS_WITH_MESSAGES = ALL_JOBS.filter((j) => j.dias);
const DIAS_SEMANA = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];

export default function AdminAutomacaoAdvanced() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [selectedJobForMessages, setSelectedJobForMessages] = useState("contract_reminder");
  const [editingMsgs, setEditingMsgs] = useState<Record<number, string[]>>({});
  const [newHorario, setNewHorario] = useState("");
  const [mensagemPadraoRespostaIA, setMensagemPadraoRespostaIA] = useState("");

  // Fetch configs
  const { data: configs = {}, isLoading } = useQuery({
    queryKey: ["/api/admin/automation-configs"],
    enabled: !!user,
  });

  // Fetch specific job config for messages
  const { data: jobConfig, isLoading: jobLoading, refetch: refetchJobConfig } = useQuery({
    queryKey: [`/api/admin/automation-configs/${selectedJobForMessages}`],
    enabled: !!user && !!selectedJobForMessages,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      setTimeout(() => (window.location.href = "/api/login"), 500);
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (jobConfig?.mensagensTemplates) {
      const msgs: Record<number, string[]> = {};
      Object.entries(jobConfig.mensagensTemplates || {}).forEach(([key, value]: any) => {
        const dayNum = parseInt(key);
        if (!isNaN(dayNum)) {
          msgs[dayNum] = Array.isArray(value) ? value : [];
        }
      });
      setEditingMsgs(msgs);
    } else {
      setEditingMsgs({});
    }
  }, [jobConfig, selectedJobForMessages]);

  // Carrega a mensagem padrão da IA quando configs mudam
  useEffect(() => {
    if (configs && typeof configs === 'object') {
      // Procura por qualquer job que tenha a mensagem padrão
      const firstConfig = Object.values(configs)[0] as any;
      if (firstConfig?.mensagemPadraoRespostaIA) {
        setMensagemPadraoRespostaIA(firstConfig.mensagemPadraoRespostaIA);
      }
    }
  }, [configs]);

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", "/api/admin/automation-configs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/automation-configs"] });
      refetchJobConfig();
      toast({
        title: "✅ Configuração atualizada",
        description: "Mudanças salvas com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Erro",
        description: error.message || "Falha ao atualizar",
        variant: "destructive",
      });
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="space-y-4 p-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  const toggleJobStatus = (jobType: string, currentStatus: boolean) => {
    updateConfigMutation.mutate({
      jobType,
      ativo: !currentStatus,
    });
  };

  const updateSchedulerInterval = (jobType: string, interval: number) => {
    updateConfigMutation.mutate({
      jobType,
      intervaloScheduler: interval,
    });
  };

  const handleAddMessage = (dia: number) => {
    const current = editingMsgs[dia] || [];
    const newMsgs = {
      ...editingMsgs,
      [dia]: [...current, ""],
    };
    setEditingMsgs(newMsgs);
  };

  const handleRemoveMessage = (dia: number, idx: number) => {
    const current = editingMsgs[dia] || [];
    setEditingMsgs({
      ...editingMsgs,
      [dia]: current.filter((_, i) => i !== idx),
    });
  };

  const handleUpdateMessage = (dia: number, idx: number, texto: string) => {
    const current = editingMsgs[dia] || [];
    const updated = [...current];
    updated[idx] = texto;
    setEditingMsgs({
      ...editingMsgs,
      [dia]: updated,
    });
  };

  const handleAddHorario = () => {
    if (!newHorario.trim()) return;
    const current = jobConfig?.horarios || [];
    if (!current.includes(newHorario)) {
      updateConfigMutation.mutate({
        jobType: selectedJobForMessages,
        horarios: [...current, newHorario],
      });
      setNewHorario("");
    }
  };

  const handleRemoveHorario = (horario: string) => {
    const current = jobConfig?.horarios || [];
    updateConfigMutation.mutate({
      jobType: selectedJobForMessages,
      horarios: current.filter((h: string) => h !== horario),
    });
  };

  const handleAddDia = (dia: string) => {
    const current = jobConfig?.diasSemana || [];
    if (!current.includes(dia)) {
      updateConfigMutation.mutate({
        jobType: selectedJobForMessages,
        diasSemana: [...current, dia],
      });
    }
  };

  const handleRemoveDia = (dia: string) => {
    const current = jobConfig?.diasSemana || [];
    updateConfigMutation.mutate({
      jobType: selectedJobForMessages,
      diasSemana: current.filter((d: string) => d !== dia),
    });
  };

  const handleSaveMessages = () => {
    updateConfigMutation.mutate({
      jobType: selectedJobForMessages,
      mensagensTemplates: editingMsgs,
    });
  };

  const selectedJob = JOBS_WITH_MESSAGES.find((j) => j.id === selectedJobForMessages);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Zap className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Administração de Automação</h1>
          </div>
          <p className="text-muted-foreground">
            Configure os 8 jobs de automação do sistema + customize mensagens
          </p>
        </div>

        {/* Status do Scheduler */}
        <Alert className="border-green-500/30 bg-green-500/5">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            ✅ Scheduler rodando: 1 minuto | Timezone: São Paulo | Dias: Seg-Sex
          </AlertDescription>
        </Alert>

        {/* Jobs Grid - Basic Controls */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Jobs de Automação
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {ALL_JOBS.map((job) => {
              const config = configs[job.id] || {
                ativo: true,
                intervaloScheduler: 60,
                horarios: job.frequencia?.split(", ") || [],
              };

              return (
                <Card
                  key={job.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    !config.ativo ? "opacity-50" : ""
                  }`}
                  onClick={() =>
                    setExpandedJob(expandedJob === job.id ? null : job.id)
                  }
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{job.icon}</span>
                        <div>
                          <CardTitle className="text-base">{job.nome}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">
                            {job.descricao}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={config.ativo}
                        onCheckedChange={() =>
                          toggleJobStatus(job.id, config.ativo)
                        }
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`toggle-${job.id}`}
                      />
                    </div>
                  </CardHeader>

                  {expandedJob === job.id && (
                    <CardContent className="space-y-4 border-t pt-4">
                      {/* Status */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">
                          STATUS
                        </p>
                        <Badge
                          variant={config.ativo ? "default" : "secondary"}
                          data-testid={`status-${job.id}`}
                        >
                          {config.ativo ? "✅ Ativo" : "❌ Inativo"}
                        </Badge>
                      </div>

                      {/* Horários */}
                      {config.horarios && config.horarios.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2">
                            HORÁRIOS
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            {config.horarios.map((h: string) => (
                              <Badge key={h} variant="outline">
                                <Clock className="w-3 h-3 mr-1" />
                                {h}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Intervalo */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">
                          INTERVALO SCHEDULER
                        </p>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={config.intervaloScheduler}
                            onChange={(e) =>
                              updateSchedulerInterval(job.id, parseInt(e.target.value))
                            }
                            min="10"
                            max="600"
                            className="w-20"
                            data-testid={`interval-${job.id}`}
                          />
                          <span className="text-xs text-muted-foreground">segundos</span>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="bg-muted/50 p-2 rounded text-xs text-muted-foreground">
                        {job.id === "contract_reminder" && (
                          <>
                            <AlertTriangle className="w-3 h-3 inline mr-1" />
                            Timeout 2h: criar task | Timeout 4 dias: mover PERDIDO
                          </>
                        )}
                        {job.id === "aguardando_aceite_reminder" && (
                          <>
                            <AlertTriangle className="w-3 h-3 inline mr-1" />
                            3 lembretes progressivos + move automático
                          </>
                        )}
                        {!job.id.includes("reminder") &&
                          !job.id.includes("message") && (
                            <>
                              <CheckCircle className="w-3 h-3 inline mr-1" />
                              Job auxiliar - Controle manual
                            </>
                          )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Global Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configurações Globais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-muted-foreground mb-2 block">
                Intervalo Principal do Scheduler
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  defaultValue="60"
                  min="10"
                  max="600"
                  className="w-20"
                  disabled
                  data-testid="global-interval"
                />
                <span className="text-sm text-muted-foreground">segundos (1 minuto)</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                🔒 Locked em produção - Entre em contato com admin para alterar
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-muted-foreground mb-2 block">
                Timezone
              </label>
              <Input
                value="America/Sao_Paulo"
                disabled
                className="w-full"
                data-testid="timezone"
              />
              <p className="text-xs text-muted-foreground mt-2">
                🔒 Locked em produção
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded"
                  data-testid="notifications-enabled"
                />
                Email Notificações Habilitadas
              </label>
            </div>

            <div className="border-t pt-4">
              <label className="text-sm font-semibold text-muted-foreground mb-2 block">
                💬 Mensagem Automática Padrão da IA
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                Mensagem enviada automaticamente quando cliente responde no chat e IA cria o card
              </p>
              <Textarea
                value={mensagemPadraoRespostaIA}
                onChange={(e) => setMensagemPadraoRespostaIA(e.target.value)}
                placeholder="Ex: Obrigado pelo seu interesse! Estou analisando sua resposta e um de nossos especialistas entrará em contato em breve."
                className="min-h-20 text-sm resize-none"
                data-testid="mensagem-ia-padrao"
              />
              <Button
                size="sm"
                onClick={() => {
                  updateConfigMutation.mutate({
                    jobType: "ia_resposta_padrao",
                    mensagemPadraoRespostaIA,
                  });
                }}
                disabled={updateConfigMutation.isPending}
                className="w-full gap-2 h-8 mt-3"
                data-testid="btn-save-mensagem-ia"
              >
                <Save className="w-4 h-4" />
                {updateConfigMutation.isPending ? "Salvando..." : "Salvar Mensagem"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Message Configuration Section */}
        <div className="space-y-4 border-t pt-6">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Customizar Mensagens & Horários
          </h2>

          {/* Job Selector */}
          <div className="grid gap-2 md:grid-cols-3">
            {JOBS_WITH_MESSAGES.map((j) => (
              <button
                key={j.id}
                onClick={() => setSelectedJobForMessages(j.id)}
                className={`p-3 rounded-lg border transition-all text-left ${
                  selectedJobForMessages === j.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/50"
                }`}
                data-testid={`job-select-${j.id}`}
              >
                <div className="font-bold text-base">{j.nome}</div>
                <div className="text-xs text-muted-foreground">{j.descricao}</div>
              </button>
            ))}
          </div>

          {selectedJob && jobConfig && !jobLoading && (
            <Tabs defaultValue="mensagens" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="mensagens" className="gap-1 text-sm">
                  <MessageSquare className="w-4 h-4" />
                  Mensagens
                </TabsTrigger>
                <TabsTrigger value="horarios" className="gap-1 text-sm">
                  <Clock className="w-4 h-4" />
                  Horários
                </TabsTrigger>
                <TabsTrigger value="dias" className="gap-1 text-sm">
                  <Calendar className="w-4 h-4" />
                  Dias
                </TabsTrigger>
              </TabsList>

              {/* TAB: MENSAGENS */}
              <TabsContent value="mensagens" className="space-y-3 mt-4">
                {selectedJob.dias.map((dia) => (
                  <Card key={dia}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Dia {dia}</CardTitle>
                        <Badge variant="secondary" className="text-xs px-2 py-0.5">
                          {editingMsgs[dia]?.length || 0} templates
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {(editingMsgs[dia] || []).map((msg, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium">Msg {idx + 1}</label>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveMessage(dia, idx)}
                              className="h-6 w-6 p-0"
                              data-testid={`btn-remove-msg-${dia}-${idx}`}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                          <Textarea
                            value={msg}
                            onChange={(e) =>
                              handleUpdateMessage(dia, idx, e.target.value)
                            }
                            placeholder="Mensagem..."
                            className="min-h-16 text-sm resize-none"
                            data-testid={`msg-${selectedJobForMessages}-${dia}-${idx}`}
                          />
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddMessage(dia)}
                        className="w-full gap-2 h-8"
                        data-testid={`btn-add-msg-${dia}`}
                      >
                        <Plus className="w-3 h-3" />
                        Nova
                      </Button>
                    </CardContent>
                  </Card>
                ))}

                <Button
                  size="sm"
                  onClick={handleSaveMessages}
                  disabled={updateConfigMutation.isPending}
                  className="w-full gap-2 h-9"
                  data-testid="btn-save-messages"
                >
                  <Save className="w-4 h-4" />
                  {updateConfigMutation.isPending ? "Salvando..." : "Salvar Mensagens"}
                </Button>
              </TabsContent>

              {/* TAB: HORÁRIOS */}
              <TabsContent value="horarios" className="space-y-3 mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Horários de Envio</CardTitle>
                    <CardDescription className="text-xs">
                      Timezone: São Paulo
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Horários Configurados */}
                    <div>
                      <label className="text-xs font-semibold block mb-2">Configurados:</label>
                      <div className="flex flex-wrap gap-2 min-h-8">
                        {(jobConfig.horarios || []).length > 0 ? (
                          (jobConfig.horarios || []).map((h: string) => (
                            <Badge
                              key={h}
                              variant="default"
                              className="flex items-center gap-1.5 px-2 py-0.5 text-xs"
                            >
                              {h}
                              <button
                                onClick={() => handleRemoveHorario(h)}
                                className="hover:opacity-70"
                                data-testid={`btn-remove-horario-${h}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Nenhum</span>
                        )}
                      </div>
                    </div>

                    {/* Adicionar Novo Horário */}
                    <div className="border-t pt-3">
                      <label className="text-xs font-semibold block mb-2">Adicionar:</label>
                      <div className="flex gap-2">
                        <Input
                          type="time"
                          value={newHorario}
                          onChange={(e) => setNewHorario(e.target.value)}
                          className="flex-1 h-8 text-sm"
                          data-testid="input-new-horario"
                        />
                        <Button
                          size="sm"
                          onClick={handleAddHorario}
                          disabled={!newHorario || updateConfigMutation.isPending}
                          className="gap-1 h-8 px-3"
                          data-testid="btn-add-horario"
                        >
                          <Plus className="w-3 h-3" />
                          Add
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB: DIAS SEMANA */}
              <TabsContent value="dias" className="space-y-3 mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Dias da Semana</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Dias Selecionados */}
                    <div>
                      <label className="text-xs font-semibold block mb-2">Selecionados:</label>
                      <div className="flex flex-wrap gap-2 min-h-8">
                        {(jobConfig.diasSemana || []).length > 0 ? (
                          (jobConfig.diasSemana || []).map((d: string) => (
                            <Badge
                              key={d}
                              variant="default"
                              className="flex items-center gap-1.5 px-2 py-0.5 text-xs"
                            >
                              {d.charAt(0).toUpperCase() + d.slice(1)}
                              <button
                                onClick={() => handleRemoveDia(d)}
                                className="hover:opacity-70"
                                data-testid={`btn-remove-dia-${d}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Nenhum</span>
                        )}
                      </div>
                    </div>

                    {/* Dias Disponíveis */}
                    <div className="border-t pt-3">
                      <label className="text-xs font-semibold block mb-2">Escolher:</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {DIAS_SEMANA.map((dia) => {
                          const isSelected = jobConfig.diasSemana?.includes(dia);
                          return (
                            <Button
                              key={dia}
                              size="sm"
                              variant={isSelected ? "default" : "outline"}
                              onClick={() =>
                                isSelected ? handleRemoveDia(dia) : handleAddDia(dia)
                              }
                              className="h-7 text-xs"
                              data-testid={`btn-dia-${dia}`}
                            >
                              {dia.slice(0, 3)}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* Help Section */}
        <Card className="bg-blue-500/5 border-blue-500/30">
          <CardHeader>
            <CardTitle className="text-sm">ℹ️ Dúvidas?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              • <strong>Toggle Jobs</strong>: Ative/desative cada job de automação
            </p>
            <p>
              • <strong>Mensagens</strong>: Customize templates por dia (randomizados)
            </p>
            <p>
              • <strong>Horários</strong>: Configure horários de envio (timezone SP)
            </p>
            <p>
              • <strong>Dias</strong>: Escolha quais dias da semana executar
            </p>
            <p>
              • Mudanças salvam automaticamente | Mensagens são selecionadas aleatoriamente
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
