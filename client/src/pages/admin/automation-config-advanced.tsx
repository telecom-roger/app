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
import { Plus, X, Clock, AlertTriangle, Zap, Save, MessageSquare, Calendar } from "lucide-react";

const JOBS_ADVANCED = [
  {
    id: "contract_reminder",
    nome: "📋 Contract Reminder",
    descricao: "Lembretes de contratação com templates por dia",
    dias: [0, 1, 2, 3],
  },
  {
    id: "contrato_enviado_message",
    nome: "📄 Contrato Enviado",
    descricao: "Mensagens de instrução de assinatura",
    dias: [0],
  },
  {
    id: "aguardando_aceite_reminder",
    nome: "📝 Aguardando Aceite",
    descricao: "3 lembretes progressivos",
    dias: [1, 2, 3],
  },
];

const DIAS_SEMANA = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];

export default function AdminAutomacaoAdvanced() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedJob, setSelectedJob] = useState("contract_reminder");
  const [editingMsgs, setEditingMsgs] = useState<Record<number, string[]>>({});
  const [newHorario, setNewHorario] = useState("");

  const { data: config, isLoading, refetch } = useQuery({
    queryKey: [`/api/admin/automation-configs/${selectedJob}`],
    enabled: !!user,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      setTimeout(() => (window.location.href = "/api/login"), 500);
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (config?.mensagensTemplates) {
      setEditingMsgs(config.mensagensTemplates);
    } else if (config) {
      setEditingMsgs({});
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", "/api/admin/automation-configs", {
        jobType: selectedJob,
        ...data,
      });
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "✅ Salvo com sucesso",
        description: "Configurações atualizadas",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const job = JOBS_ADVANCED.find((j) => j.id === selectedJob);

  if (authLoading || isLoading) {
    return (
      <div className="p-8 space-y-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

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
    const current = config?.horarios || [];
    if (!current.includes(newHorario)) {
      saveMutation.mutate({ horarios: [...current, newHorario] });
      setNewHorario("");
    }
  };

  const handleRemoveHorario = (horario: string) => {
    const current = config?.horarios || [];
    saveMutation.mutate({ horarios: current.filter((h) => h !== horario) });
  };

  const handleAddDia = (dia: string) => {
    const current = config?.diasSemana || [];
    if (!current.includes(dia)) {
      saveMutation.mutate({ diasSemana: [...current, dia] });
    }
  };

  const handleRemoveDia = (dia: string) => {
    const current = config?.diasSemana || [];
    saveMutation.mutate({ diasSemana: current.filter((d) => d !== dia) });
  };

  const handleSaveMessages = () => {
    saveMutation.mutate({
      mensagensTemplates: editingMsgs,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-4xl font-bold">Configuração de Automação</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Customize mensagens, horários e dias de execução de cada job
          </p>
        </div>

        {/* Job Selector */}
        <div className="grid gap-3">
          {JOBS_ADVANCED.map((j) => (
            <button
              key={j.id}
              onClick={() => setSelectedJob(j.id)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                selectedJob === j.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/50"
              }`}
              data-testid={`job-select-${j.id}`}
            >
              <div className="font-bold text-lg">{j.nome}</div>
              <div className="text-sm text-muted-foreground">{j.descricao}</div>
            </button>
          ))}
        </div>

        {job && config && (
          <Tabs defaultValue="mensagens" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-slate-100 dark:bg-slate-800">
              <TabsTrigger value="mensagens" className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Mensagens
              </TabsTrigger>
              <TabsTrigger value="horarios" className="gap-2">
                <Clock className="w-4 h-4" />
                Horários
              </TabsTrigger>
              <TabsTrigger value="dias" className="gap-2">
                <Calendar className="w-4 h-4" />
                Dias Semana
              </TabsTrigger>
            </TabsList>

            {/* TAB: MENSAGENS */}
            <TabsContent value="mensagens" className="space-y-6 mt-6">
              {job.dias.map((dia) => (
                <Card key={dia} className="border-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Mensagens - Dia {dia}</CardTitle>
                      <Badge variant="secondary" className="text-base px-3 py-1">
                        {editingMsgs[dia]?.length || 0} templates
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(editingMsgs[dia] || []).map((msg, idx) => (
                      <div key={idx} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Template {idx + 1}</label>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRemoveMessage(dia, idx)}
                            data-testid={`btn-remove-msg-${dia}-${idx}`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <Textarea
                          value={msg}
                          onChange={(e) =>
                            handleUpdateMessage(dia, idx, e.target.value)
                          }
                          placeholder="Digite a mensagem que será enviada..."
                          className="min-h-24 text-base"
                          data-testid={`msg-${selectedJob}-${dia}-${idx}`}
                        />
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      onClick={() => handleAddMessage(dia)}
                      className="w-full gap-2"
                      data-testid={`btn-add-msg-${dia}`}
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Mensagem
                    </Button>
                  </CardContent>
                </Card>
              ))}

              <Button
                size="lg"
                onClick={handleSaveMessages}
                disabled={saveMutation.isPending}
                className="w-full gap-2 text-lg py-6"
                data-testid="btn-save-messages"
              >
                <Save className="w-5 h-5" />
                {saveMutation.isPending ? "Salvando..." : "Salvar Mensagens"}
              </Button>
            </TabsContent>

            {/* TAB: HORÁRIOS */}
            <TabsContent value="horarios" className="space-y-6 mt-6">
              <Card className="border-2">
                <CardHeader>
                  <CardTitle>Horários de Envio</CardTitle>
                  <CardDescription>
                    Configure os horários em que este job será executado (timezone São Paulo)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Horários Configurados */}
                  <div>
                    <label className="text-sm font-semibold block mb-3">Horários Configurados:</label>
                    <div className="flex flex-wrap gap-2 min-h-10">
                      {(config.horarios || []).length > 0 ? (
                        (config.horarios || []).map((h: string) => (
                          <Badge
                            key={h}
                            variant="default"
                            className="flex items-center gap-2 px-3 py-1.5 text-base"
                          >
                            <Clock className="w-4 h-4" />
                            {h}
                            <button
                              onClick={() => handleRemoveHorario(h)}
                              className="ml-2 hover:opacity-70"
                              data-testid={`btn-remove-horario-${h}`}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground italic">Nenhum horário configurado</span>
                      )}
                    </div>
                  </div>

                  {/* Adicionar Novo Horário */}
                  <div className="border-t pt-6">
                    <label className="text-sm font-semibold block mb-3">Adicionar Novo Horário:</label>
                    <div className="flex gap-2">
                      <Input
                        type="time"
                        value={newHorario}
                        onChange={(e) => setNewHorario(e.target.value)}
                        placeholder="HH:MM"
                        className="flex-1 text-base"
                        data-testid="input-new-horario"
                      />
                      <Button
                        onClick={handleAddHorario}
                        disabled={!newHorario || saveMutation.isPending}
                        className="gap-2"
                        data-testid="btn-add-horario"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: DIAS SEMANA */}
            <TabsContent value="dias" className="space-y-6 mt-6">
              <Card className="border-2">
                <CardHeader>
                  <CardTitle>Dias da Semana</CardTitle>
                  <CardDescription>
                    Selecione os dias em que este job pode ser executado
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Dias Selecionados */}
                  <div>
                    <label className="text-sm font-semibold block mb-3">Dias Selecionados:</label>
                    <div className="flex flex-wrap gap-2 min-h-10">
                      {(config.diasSemana || []).length > 0 ? (
                        (config.diasSemana || []).map((d: string) => (
                          <Badge
                            key={d}
                            variant="default"
                            className="flex items-center gap-2 px-3 py-1.5 text-base"
                          >
                            {d.charAt(0).toUpperCase() + d.slice(1)}
                            <button
                              onClick={() => handleRemoveDia(d)}
                              className="ml-2 hover:opacity-70"
                              data-testid={`btn-remove-dia-${d}`}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground italic">Nenhum dia selecionado</span>
                      )}
                    </div>
                  </div>

                  {/* Dias Disponíveis */}
                  <div className="border-t pt-6">
                    <label className="text-sm font-semibold block mb-3">Dias Disponíveis:</label>
                    <div className="grid grid-cols-2 gap-2">
                      {DIAS_SEMANA.map((dia) => {
                        const isSelected = config.diasSemana?.includes(dia);
                        return (
                          <Button
                            key={dia}
                            variant={isSelected ? "default" : "outline"}
                            onClick={() =>
                              isSelected ? handleRemoveDia(dia) : handleAddDia(dia)
                            }
                            className="justify-start"
                            data-testid={`btn-dia-${dia}`}
                          >
                            {dia.charAt(0).toUpperCase() + dia.slice(1)}
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

        {/* Info Box */}
        <Alert className="border-2 border-primary/20 bg-primary/5">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <AlertDescription>
            <strong>💡 Informação:</strong> Todas as mudanças são salvas automaticamente quando você clica em adicionar/remover. Mensagens são selecionadas aleatoriamente do template quando o job executa.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
