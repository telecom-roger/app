import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, Clock, AlertTriangle, CheckCircle, Zap, Save } from "lucide-react";

const JOBS_ADVANCED = [
  {
    id: "contract_reminder",
    nome: "📋 Contract Reminder",
    descricao: "Lembretes de contratação com templates por dia",
    dias: [0, 1, 2, 3],
    temHorarios: true,
    temTimeout: true,
  },
  {
    id: "contrato_enviado_message",
    nome: "📄 Contrato Enviado",
    descricao: "Mensagens de instrução de assinatura",
    dias: [0],
    temHorarios: false,
    temTimeout: false,
  },
  {
    id: "aguardando_aceite_reminder",
    nome: "📝 Aguardando Aceite",
    descricao: "3 lembretes progressivos",
    dias: [1, 2, 3],
    temHorarios: true,
    temTimeout: false,
  },
];

export default function AdminAutomacaoAdvanced() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedJob, setSelectedJob] = useState("contract_reminder");
  const [editingMsgs, setEditingMsgs] = useState<Record<number, string[]>>({});

  // Fetch config do job selecionado
  const { data: config, isLoading, refetch } = useQuery({
    queryKey: [`/api/admin/automation-configs/${selectedJob}`],
  });

  useEffect(() => {
    if (config?.mensagensTemplates) {
      setEditingMsgs(config.mensagensTemplates);
    }
  }, [config]);

  // Mutation para salvar
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
        title: "✅ Salvo",
        description: "Configurações atualizadas com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const job = JOBS_ADVANCED.find((j) => j.id === selectedJob);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
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

  const handleSave = () => {
    saveMutation.mutate({
      mensagensTemplates: editingMsgs,
    });
  };

  const handleSaveHorarios = (horarios: string[]) => {
    saveMutation.mutate({ horarios });
  };

  const handleSaveDias = (dias: string[]) => {
    saveMutation.mutate({ diasSemana: dias });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-bold">Admin Avançado - Automação</h1>
          </div>
          <p className="text-muted-foreground">
            Customize mensagens, horários e dias de execução
          </p>
        </div>

        {/* Job Selector */}
        <div className="grid gap-2">
          {JOBS_ADVANCED.map((j) => (
            <Button
              key={j.id}
              variant={selectedJob === j.id ? "default" : "outline"}
              onClick={() => setSelectedJob(j.id)}
              className="justify-start text-left h-auto py-3"
              data-testid={`job-select-${j.id}`}
            >
              <div>
                <div className="font-semibold">{j.nome}</div>
                <div className="text-xs text-muted-foreground">{j.descricao}</div>
              </div>
            </Button>
          ))}
        </div>

        {job && config && (
          <Tabs defaultValue="mensagens" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
              {job.temHorarios && <TabsTrigger value="horarios">Horários</TabsTrigger>}
              {job.temTimeout && <TabsTrigger value="dias">Dias Semana</TabsTrigger>}
            </TabsList>

            {/* TAB: MENSAGENS */}
            <TabsContent value="mensagens" className="space-y-4">
              {job.dias.map((dia) => (
                <Card key={dia}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>Dia {dia}</span>
                      <Badge variant="secondary">
                        {editingMsgs[dia]?.length || 0} mensagens
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(editingMsgs[dia] || []).map((msg, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Textarea
                          value={msg}
                          onChange={(e) =>
                            handleUpdateMessage(dia, idx, e.target.value)
                          }
                          placeholder="Digite a mensagem..."
                          className="min-h-20"
                          data-testid={`msg-${selectedJob}-${dia}-${idx}`}
                        />
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() => handleRemoveMessage(dia, idx)}
                          data-testid={`btn-remove-msg-${dia}-${idx}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      onClick={() => handleAddMessage(dia)}
                      className="w-full"
                      data-testid={`btn-add-msg-${dia}`}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Mensagem
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* TAB: HORÁRIOS */}
            {job.temHorarios && (
              <TabsContent value="horarios" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Horários de Envio</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Horários em que o job executará (timezone São Paulo)
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {(config.horarios || []).map((h: string) => (
                        <Badge key={h} variant="default">
                          <Clock className="w-3 h-3 mr-1" />
                          {h}
                        </Badge>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {["08:00", "16:30", "10:00", "14:00"].map((h) => (
                        <Button
                          key={h}
                          variant={
                            config.horarios?.includes(h) ? "default" : "outline"
                          }
                          onClick={() => {
                            const current = config.horarios || [];
                            const updated = current.includes(h)
                              ? current.filter((x: string) => x !== h)
                              : [...current, h];
                            handleSaveHorarios(updated);
                          }}
                          data-testid={`btn-horario-${h}`}
                        >
                          {h}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* TAB: DIAS SEMANA */}
            {job.temTimeout && (
              <TabsContent value="dias" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Dias da Semana</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Selecione os dias que o job pode executar
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"].map(
                        (dia) => (
                          <Button
                            key={dia}
                            variant={
                              config.diasSemana?.includes(dia)
                                ? "default"
                                : "outline"
                            }
                            onClick={() => {
                              const current = config.diasSemana || [];
                              const updated = current.includes(dia)
                                ? current.filter((x: string) => x !== dia)
                                : [...current, dia];
                              handleSaveDias(updated);
                            }}
                            data-testid={`btn-dia-${dia}`}
                          >
                            {dia.charAt(0).toUpperCase() + dia.slice(1)}
                          </Button>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        )}

        {/* Save Button */}
        {job && (
          <Button
            size="lg"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="w-full"
            data-testid="btn-save-config"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Salvando..." : "Salvar Mensagens"}
          </Button>
        )}

        {/* Info */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            💡 As mudanças entram em efeito imediatamente. Mensagens são selecionadas
            aleatoriamente do template quando o job executa.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
