import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Zap, Settings, Clock, AlertTriangle, CheckCircle } from "lucide-react";

const JOBS = [
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
  },
  {
    id: "contrato_enviado_message",
    nome: "Contrato Enviado",
    descricao: "Instrui assinatura digital",
    icon: "📄",
  },
  {
    id: "aguardando_aceite_reminder",
    nome: "Aguardando Aceite",
    descricao: "3 lembretes + move para ATENÇÃO",
    icon: "📝",
  },
];

export default function AdminAutomacao() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  // Fetch configs
  const { data: configs = {}, isLoading } = useQuery({
    queryKey: ["/api/admin/automation-configs"],
  });

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", "/api/admin/automation-configs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/automation-configs"] });
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

  if (isLoading) {
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
            Configure os 8 jobs de automação do sistema
          </p>
        </div>

        {/* Status do Scheduler */}
        <Alert className="border-green-500/30 bg-green-500/5">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            ✅ Scheduler rodando: 1 minuto | Timezone: São Paulo | Dias: Seg-Sex
          </AlertDescription>
        </Alert>

        {/* Jobs Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {JOBS.map((job) => {
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
                        !job.id.includes("reminder") && (
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
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card className="bg-blue-500/5 border-blue-500/30">
          <CardHeader>
            <CardTitle className="text-sm">ℹ️ Dúvidas?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              • <strong>Follow-up</strong>: Notificações para vendedor em 1d, 3d, 7d
            </p>
            <p>
              • <strong>Contract Reminder</strong>: Lembretes automáticos nos horários configurados
            </p>
            <p>
              • <strong>Aguardando Aceite</strong>: 3 lembretes + movimento automático
            </p>
            <p>
              • Todos os jobs enviam mensagens no Chat + Timeline
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
