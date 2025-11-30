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
import { Plus, X, Clock, CheckCircle, Zap, Save, MessageSquare, Calendar, Settings, ChevronDown, Download } from "lucide-react";
import Papa from "papaparse";

const ALL_JOBS = [
  {
    id: "follow_up",
    nome: "Follow-up Automático",
    descricao: "Lembretes 1d, 3d, 7d",
    icon: Clock,
  },
  {
    id: "re_engagement",
    nome: "Re-engagement",
    descricao: "Clientes inativos 30+d",
    icon: Zap,
  },
  {
    id: "score_update",
    nome: "Score Update",
    descricao: "Score (0-100)",
    icon: Zap,
  },
  {
    id: "contract_reminder",
    nome: "Contract Reminder",
    descricao: "Lembretes 2h, 4 dias",
    icon: Clock,
  },
  {
    id: "contrato_enviado_message",
    nome: "Contrato Enviado",
    descricao: "Instrui assinatura",
    icon: MessageSquare,
  },
  {
    id: "aguardando_aceite_reminder",
    nome: "Aguardando Aceite",
    descricao: "3 lembretes + move",
    icon: Clock,
  },
];

const JOBS_WITH_MESSAGES = [
  {
    id: "contract_reminder",
    nome: "Contract Reminder",
    descricao: "Lembretes 2h, 4 dias",
    icon: Clock,
    dias: [1, 2, 3, 4],
  },
  {
    id: "contrato_enviado_message",
    nome: "Contrato Enviado",
    descricao: "Instrui assinatura",
    icon: MessageSquare,
    dias: [1],
  },
  {
    id: "aguardando_aceite_reminder",
    nome: "Aguardando Aceite",
    descricao: "3 lembretes + move",
    icon: Clock,
    dias: [1, 2, 3],
  },
];
const DIAS_SEMANA = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];

export default function AdminAutomacaoAdvanced() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [selectedJobForMessages, setSelectedJobForMessages] = useState("contract_reminder");
  const [editingMsgs, setEditingMsgs] = useState<Record<number, string[]>>({});
  const [newHorario, setNewHorario] = useState("");
  const [mensagemContatoPositivo, setMensagemContatoPositivo] = useState("");
  const [mensagemPropostaPositivo, setMensagemPropostaPositivo] = useState("");
  const [mensagemFechado, setMensagemFechado] = useState("");
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());

  const { data: configs = {}, isLoading } = useQuery<Record<string, any>>({
    queryKey: ["/api/admin/automation-configs"],
    enabled: !!user,
  });

  const { data: jobConfig, isLoading: jobLoading, refetch: refetchJobConfig } = useQuery<any>({
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
      // Auto-expand todos os dias quando carregar
      const allDays = new Set(Object.keys(msgs).map(k => parseInt(k)));
      setExpandedDays(allDays);
    } else {
      setEditingMsgs({});
      setExpandedDays(new Set());
    }
  }, [jobConfig, selectedJobForMessages]);

  useEffect(() => {
    if (configs && typeof configs === 'object') {
      const firstConfig = Object.values(configs)[0] as any;
      if (firstConfig?.mensagemContatoPositivo) setMensagemContatoPositivo(firstConfig.mensagemContatoPositivo);
      if (firstConfig?.mensagemPropostaPositivo) setMensagemPropostaPositivo(firstConfig.mensagemPropostaPositivo);
      if (firstConfig?.mensagemFechado) setMensagemFechado(firstConfig.mensagemFechado);
    }
  }, [configs]);

  const updateConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", "/api/admin/automation-configs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/automation-configs"] });
      refetchJobConfig();
      toast({
        title: "✅ Atualizado",
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
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const handleExportClients = async () => {
    try {
      const response = await fetch("/api/admin/export-clients");
      if (!response.ok) throw new Error("Erro ao exportar");
      const data = await response.json();
      
      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      
      link.setAttribute("href", url);
      link.setAttribute("download", `clientes_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "✅ Exportado",
        description: `${data.length} clientes baixados com sucesso`,
      });
    } catch (error) {
      toast({
        title: "❌ Erro",
        description: "Falha ao exportar clientes",
        variant: "destructive",
      });
    }
  };

  const toggleJobStatus = (jobType: string, currentStatus: boolean) => {
    updateConfigMutation.mutate({
      jobType,
      ativo: !currentStatus,
    });
  };

  const handleAddMessage = (dia: number) => {
    const current = editingMsgs[dia] || [];
    setEditingMsgs({
      ...editingMsgs,
      [dia]: [...current, ""],
    });
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

  const toggleDayExpanded = (dia: number) => {
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dia)) {
        newSet.delete(dia);
      } else {
        newSet.add(dia);
      }
      return newSet;
    });
  };

  const selectedJob = JOBS_WITH_MESSAGES.find((j) => j.id === selectedJobForMessages);
  const daysWithMessages = selectedJob?.dias || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
                  Automação Avançada
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
                  Configure jobs, mensagens, horários e dias de execução
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleExportClients}
              className="gap-2 h-10 whitespace-nowrap"
              data-testid="btn-export-clients"
            >
              <Download className="w-4 h-4" />
              Exportar Clientes
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 pb-12">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Status Alert */}
          <Alert className="border-emerald-500/30 bg-emerald-500/5">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-700 dark:text-emerald-400 text-sm">
              ✅ Scheduler: 1 minuto | Timezone: São Paulo | Seg-Sex
            </AlertDescription>
          </Alert>

          {/* Jobs Grid */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Jobs
            </h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {ALL_JOBS.map((job) => {
                const IconComp = job.icon;
                const config = configs[job.id] || { ativo: true };
                return (
                  <Card
                    key={job.id}
                    className={`cursor-pointer transition-all hover:shadow-md border-0 bg-white dark:bg-slate-800/50 ${
                      !config.ativo ? "opacity-50" : ""
                    }`}
                    onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <IconComp className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                          <div className="min-w-0">
                            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
                              {job.nome}
                            </CardTitle>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-1">
                              {job.descricao}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={config.ativo}
                          onCheckedChange={() => toggleJobStatus(job.id, config.ativo)}
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`toggle-${job.id}`}
                          className="flex-shrink-0"
                        />
                      </div>
                    </CardHeader>

                    {expandedJob === job.id && (
                      <CardContent className="space-y-2 border-t pt-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 dark:text-slate-400">Status:</span>
                          <Badge variant={config.ativo ? "default" : "secondary"} className="text-xs">
                            {config.ativo ? "✅ Ativo" : "❌ Inativo"}
                          </Badge>
                        </div>
                        {config.horarios && config.horarios.length > 0 && (
                          <div>
                            <span className="text-slate-600 dark:text-slate-400">Horários:</span>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {config.horarios.map((h: string) => (
                                <Badge key={h} variant="outline" className="text-xs">
                                  {h}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Mensagens & Horários */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Customizar por Job
            </h2>

            {/* Job Selector */}
            <div className="grid gap-2 md:grid-cols-3">
              {JOBS_WITH_MESSAGES.map((j) => (
                <button
                  key={j.id}
                  onClick={() => setSelectedJobForMessages(j.id)}
                  className={`p-2 rounded-lg border transition-all text-left text-xs ${
                    selectedJobForMessages === j.id
                      ? "border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/20"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-blue-400"
                  }`}
                  data-testid={`job-select-${j.id}`}
                >
                  <div className="font-bold">{j.nome}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">{j.descricao}</div>
                </button>
              ))}
            </div>

            {selectedJob && jobConfig && !jobLoading && (
              <Tabs defaultValue="mensagens" className="w-full">
                <TabsList className="grid w-full grid-cols-4 h-8">
                  <TabsTrigger value="mensagens" className="gap-1 text-xs">
                    <MessageSquare className="w-3 h-3" />
                    Msgs
                  </TabsTrigger>
                  <TabsTrigger value="ia" className="gap-1 text-xs">
                    <Zap className="w-3 h-3" />
                    IA
                  </TabsTrigger>
                  <TabsTrigger value="config" className="gap-1 text-xs">
                    <Clock className="w-3 h-3" />
                    Horários
                  </TabsTrigger>
                  <TabsTrigger value="dias" className="gap-1 text-xs">
                    <Calendar className="w-3 h-3" />
                    Dias
                  </TabsTrigger>
                </TabsList>

                {/* TAB: MENSAGENS - Compact Mode com Collapse */}
                <TabsContent value="mensagens" className="space-y-2 mt-3">
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {daysWithMessages.map((dia) => {
                      const msgCount = editingMsgs[dia]?.length || 0;
                      const isExpanded = expandedDays.has(dia);
                      return (
                        <Card key={dia} className="border-0 bg-white dark:bg-slate-800/50">
                          {/* Header que pode ser clicado para expandir */}
                          <button
                            onClick={() => toggleDayExpanded(dia)}
                            className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <ChevronDown 
                                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              />
                              <span className="text-sm font-bold text-slate-900 dark:text-white">
                                Dia {dia}
                              </span>
                              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                {msgCount}
                              </Badge>
                            </div>
                            {msgCount > 0 && !isExpanded && (
                              <span className="text-xs text-slate-600 dark:text-slate-400">
                                {msgCount === 1 ? "1 mensagem" : `${msgCount} mensagens`}
                              </span>
                            )}
                          </button>

                          {/* Conteúdo Expandível */}
                          {isExpanded && (
                            <CardContent className="space-y-2 border-t pt-3">
                              {(editingMsgs[dia] || []).map((msg, idx) => (
                                <div key={idx} className="space-y-1 p-2 bg-slate-50 dark:bg-slate-900/20 rounded-md">
                                  <div className="flex items-center justify-between gap-1">
                                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                      Mensagem {idx + 1}
                                    </label>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleRemoveMessage(dia, idx)}
                                      className="h-5 w-5 p-0"
                                      data-testid={`btn-remove-msg-${dia}-${idx}`}
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                  <Textarea
                                    value={msg}
                                    onChange={(e) => handleUpdateMessage(dia, idx, e.target.value)}
                                    placeholder="Digite sua mensagem aqui..."
                                    className="min-h-20 text-xs resize-none"
                                    data-testid={`msg-${selectedJobForMessages}-${dia}-${idx}`}
                                  />
                                </div>
                              ))}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddMessage(dia)}
                                className="w-full gap-1 h-7 text-xs"
                                data-testid={`btn-add-msg-${dia}`}
                              >
                                <Plus className="w-3 h-3" />
                                Adicionar Mensagem
                              </Button>
                            </CardContent>
                          )}
                        </Card>
                      );
                    })}
                  </div>

                  <Button
                    size="sm"
                    onClick={handleSaveMessages}
                    disabled={updateConfigMutation.isPending}
                    className="w-full gap-1 h-8 text-xs"
                    data-testid="btn-save-messages"
                  >
                    <Save className="w-3 h-3" />
                    Salvar Todas as Mensagens
                  </Button>
                </TabsContent>

                {/* TAB: IA - Respostas Positivas */}
                <TabsContent value="ia" className="space-y-2 mt-3">
                  <Card className="border-0 bg-white dark:bg-slate-800/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs flex items-center gap-2">
                        <Zap className="w-3 h-3" />
                        Respostas Positivas IA
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Mensagens enviadas quando cliente demonstra interesse
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          📌 Mensagem em CONTATO
                        </label>
                        <Textarea
                          value={mensagemContatoPositivo}
                          onChange={(e) => setMensagemContatoPositivo(e.target.value)}
                          placeholder="Ex: Ótimo! Vou preparar as informações..."
                          className="min-h-16 text-xs resize-none"
                          data-testid="mensagem-contato-positivo"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          💰 Mensagem em PROPOSTA
                        </label>
                        <Textarea
                          value={mensagemPropostaPositivo}
                          onChange={(e) => setMensagemPropostaPositivo(e.target.value)}
                          placeholder="Ex: Perfeito! Estou gerando sua proposta..."
                          className="min-h-16 text-xs resize-none"
                          data-testid="mensagem-proposta-positivo"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          ✅ Mensagem em FECHADO
                        </label>
                        <Textarea
                          value={mensagemFechado}
                          onChange={(e) => setMensagemFechado(e.target.value)}
                          placeholder="Ex: Excelente! Seu contrato foi fechado..."
                          className="min-h-16 text-xs resize-none"
                          data-testid="mensagem-fechado"
                        />
                      </div>

                      <Button
                        size="sm"
                        onClick={() => {
                          updateConfigMutation.mutate({
                            jobType: "ia_resposta_positiva",
                            mensagemContatoPositivo,
                            mensagemPropostaPositivo,
                            mensagemFechado,
                          });
                        }}
                        disabled={updateConfigMutation.isPending}
                        className="w-full h-8 text-xs gap-1"
                        data-testid="btn-save-mensagens-positivas"
                      >
                        <Save className="w-3 h-3" />
                        Salvar Respostas IA
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* TAB: HORÁRIOS */}
                <TabsContent value="config" className="space-y-2 mt-3">
                  <Card className="border-0 bg-white dark:bg-slate-800/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs">Horários de Envio</CardTitle>
                      <CardDescription className="text-xs">
                        Timezone: São Paulo
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <label className="text-xs font-semibold block mb-1">Configurados:</label>
                        <div className="flex flex-wrap gap-1 min-h-6">
                          {(jobConfig.horarios || []).length > 0 ? (
                            (jobConfig.horarios || []).map((h: string) => (
                              <Badge key={h} variant="default" className="flex items-center gap-1 px-1.5 py-0 text-xs">
                                {h}
                                <button
                                  onClick={() => handleRemoveHorario(h)}
                                  className="hover:opacity-70"
                                  data-testid={`btn-remove-horario-${h}`}
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-slate-600 dark:text-slate-400 italic">Nenhum</span>
                          )}
                        </div>
                      </div>

                      <div className="border-t pt-2">
                        <label className="text-xs font-semibold block mb-1">Adicionar:</label>
                        <div className="flex gap-1">
                          <Input
                            type="time"
                            value={newHorario}
                            onChange={(e) => setNewHorario(e.target.value)}
                            className="flex-1 h-7 text-xs"
                            data-testid="input-new-horario"
                          />
                          <Button
                            size="sm"
                            onClick={handleAddHorario}
                            disabled={!newHorario || updateConfigMutation.isPending}
                            className="gap-1 h-7 px-2 text-xs"
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
                <TabsContent value="dias" className="space-y-2 mt-3">
                  <Card className="border-0 bg-white dark:bg-slate-800/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs">Dias da Semana</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <label className="text-xs font-semibold block mb-1">Selecionados:</label>
                        <div className="flex flex-wrap gap-1 min-h-6">
                          {(jobConfig.diasSemana || []).length > 0 ? (
                            (jobConfig.diasSemana || []).map((d: string) => (
                              <Badge key={d} variant="default" className="flex items-center gap-1 px-1.5 py-0 text-xs">
                                {d.charAt(0).toUpperCase() + d.slice(1)}
                                <button
                                  onClick={() => handleRemoveDia(d)}
                                  className="hover:opacity-70"
                                  data-testid={`btn-remove-dia-${d}`}
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-slate-600 dark:text-slate-400 italic">Nenhum</span>
                          )}
                        </div>
                      </div>

                      <div className="border-t pt-2">
                        <label className="text-xs font-semibold block mb-1">Escolher:</label>
                        <div className="grid grid-cols-3 gap-1">
                          {DIAS_SEMANA.map((dia) => {
                            const isSelected = jobConfig.diasSemana?.includes(dia);
                            return (
                              <Button
                                key={dia}
                                size="sm"
                                variant={isSelected ? "default" : "outline"}
                                onClick={() => isSelected ? handleRemoveDia(dia) : handleAddDia(dia)}
                                className="h-6 text-xs"
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
        </div>
      </div>
    </div>
  );
}
