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
      // Carrega mensagens do formato salvo no banco (chaves numéricas como strings)
      const msgs: Record<number, string[]> = {};
      Object.entries(config.mensagensTemplates || {}).forEach(([key, value]: any) => {
        const dayNum = parseInt(key);
        if (!isNaN(dayNum)) {
          msgs[dayNum] = Array.isArray(value) ? value : [];
        }
      });
      console.log("✅ Mensagens carregadas para", selectedJob, ":", msgs);
      setEditingMsgs(msgs);
    } else {
      console.log("⚠️ Nenhuma mensagem no config para", selectedJob);
      setEditingMsgs({});
    }
  }, [config, selectedJob]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", "/api/admin/automation-configs", {
        jobType: selectedJob,
        ...data,
      });
    },
    onSuccess: (data) => {
      console.log("Salvo com sucesso:", data);
      // Invalida a query e force refresh
      queryClient.invalidateQueries({ queryKey: [`/api/admin/automation-configs/${selectedJob}`] });
      // Espera um pouco e faz refetch
      setTimeout(() => refetch(), 100);
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
    console.log("➕ Adicionando mensagem ao dia", dia);
    const current = editingMsgs[dia] || [];
    console.log("Estado atual:", current);
    const newMsgs = {
      ...editingMsgs,
      [dia]: [...current, ""],
    };
    console.log("Novo estado:", newMsgs);
    setEditingMsgs(newMsgs);
  };

  const handleRemoveMessage = (dia: number, idx: number) => {
    console.log("❌ Removendo mensagem", idx, "do dia", dia);
    const current = editingMsgs[dia] || [];
    setEditingMsgs({
      ...editingMsgs,
      [dia]: current.filter((_, i) => i !== idx),
    });
  };

  const handleUpdateMessage = (dia: number, idx: number, texto: string) => {
    console.log("✏️ Atualizando mensagem", idx, "do dia", dia, "com:", texto.substring(0, 50));
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
    console.log("💾 Salvando mensagens:", editingMsgs);
    console.log("Tamanho de editingMsgs:", Object.keys(editingMsgs).length);
    saveMutation.mutate({
      mensagensTemplates: editingMsgs,
    });
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold">Configuração de Automação</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Customize mensagens, horários e dias de execução
          </p>
        </div>

        {/* Job Selector */}
        <div className="grid gap-2">
          {JOBS_ADVANCED.map((j) => (
            <button
              key={j.id}
              onClick={() => setSelectedJob(j.id)}
              className={`p-3 rounded-lg border transition-all text-left ${
                selectedJob === j.id
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

        {job && config && (
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
              {job.dias.map((dia) => (
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
                          data-testid={`msg-${selectedJob}-${dia}-${idx}`}
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
                disabled={saveMutation.isPending}
                className="w-full gap-2 h-9"
                data-testid="btn-save-messages"
              >
                <Save className="w-4 h-4" />
                {saveMutation.isPending ? "Salvando..." : "Salvar Mensagens"}
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
                      {(config.horarios || []).length > 0 ? (
                        (config.horarios || []).map((h: string) => (
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
                        disabled={!newHorario || saveMutation.isPending}
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
                      {(config.diasSemana || []).length > 0 ? (
                        (config.diasSemana || []).map((d: string) => (
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
                        const isSelected = config.diasSemana?.includes(dia);
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

        {/* Info Box */}
        <Alert className="border border-primary/20 bg-primary/5">
          <AlertTriangle className="h-3 w-3 text-primary" />
          <AlertDescription className="text-xs ml-1">
            💡 Mudanças salvam automaticamente. Mensagens são selecionadas aleatoriamente.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
