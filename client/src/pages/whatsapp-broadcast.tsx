import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MessageSquare, ArrowLeft, Send, Users } from "lucide-react";

const broadcastSchema = z.object({
  sessionId: z.string().min(1, "Selecione uma sessão WhatsApp"),
  mensagem: z.string().min(1, "Digite a mensagem").max(4096, "Mensagem muito longa"),
  filtros: z.object({
    status: z.string().optional(),
    carteira: z.string().optional(),
    tags: z.string().optional(),
  }).optional(),
});

type BroadcastForm = z.infer<typeof broadcastSchema>;

interface BroadcastStats {
  totalClientes: number;
  filtrados: number;
  comTelefone: number;
  pronto: boolean;
}

export default function WhatsAppBroadcast() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<BroadcastStats>({
    totalClientes: 0,
    filtrados: 0,
    comTelefone: 0,
    pronto: false,
  });
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmedData, setConfirmedData] = useState<BroadcastForm | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  const form = useForm<BroadcastForm>({
    resolver: zodResolver(broadcastSchema),
    defaultValues: {
      sessionId: "",
      mensagem: "",
      filtros: {
        status: "",
        carteira: "",
        tags: "",
      },
    },
  });

  // Load sessions
  const { data: sessions = [], isLoading: loadingSessions } = useQuery<any[]>({
    queryKey: ["/api/whatsapp/sessions"],
    enabled: isAuthenticated,
  });

  const connectedSessions = sessions.filter((s: any) => s.status === "conectada");

  // Calculate broadcast stats when form changes
  useEffect(() => {
    const calculateStats = async () => {
      const sessionId = form.watch("sessionId");
      const status = form.watch("filtros.status");
      const carteira = form.watch("filtros.carteira");

      if (!sessionId) {
        setStats({
          totalClientes: 0,
          filtrados: 0,
          comTelefone: 0,
          pronto: false,
        });
        return;
      }

      try {
        const response = await apiRequest("POST", "/api/whatsapp/broadcast/preview", {
          sessionId,
          filtros: {
            status: status || undefined,
            carteira: carteira || undefined,
          },
        });
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error("Erro ao calcular estatísticas:", error);
      }
    };

    calculateStats();
  }, [
    form.watch("sessionId"),
    form.watch("filtros.status"),
    form.watch("filtros.carteira"),
  ]);

  const sendMutation = useMutation({
    mutationFn: async (data: BroadcastForm) => {
      const response = await apiRequest("POST", "/api/whatsapp/broadcast/send", {
        sessionId: data.sessionId,
        mensagem: data.mensagem,
        filtros: data.filtros,
        // ✅ Unificação: Envio imediato como agendamento para "agora"
        campanhaNome: "Envio Imediato",
        origemDisparo: "envio_imediato",
        dataAgendada: new Date().toISOString(),
        tempoFixoSegundos: 21,
        tempoAleatorioMin: 10,
        tempoAleatorioMax: 60,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/sessions"] });
      toast({
        title: "Sucesso!",
        description: `Mensagens enfileiradas para envio: ${data.enfileiradas} clientes`,
      });
      setShowConfirm(false);
      setConfirmedData(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar",
        description: error.message || "Não foi possível enviar as mensagens",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BroadcastForm) => {
    if (stats.comTelefone === 0) {
      toast({
        title: "Atenção",
        description: "Nenhum cliente com telefone para enviar",
        variant: "destructive",
      });
      return;
    }

    setConfirmedData(data);
    setShowConfirm(true);
  };

  const handleConfirmSend = () => {
    if (confirmedData) {
      sendMutation.mutate(confirmedData);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/whatsapp")}
          data-testid="button-voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="h-8 w-8" />
            Envio em Massa
          </h1>
          <p className="text-muted-foreground mt-1">
            Envie mensagens para múltiplos clientes via WhatsApp
          </p>
        </div>
      </div>

      {/* Main Form */}
      <Card className="border-2 border-[#776BFF]">
        <CardHeader>
          <CardTitle>Configurar Envio</CardTitle>
          <CardDescription>Selecione a sessão e configure a mensagem</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Session Selection */}
              <FormField
                control={form.control}
                name="sessionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sessão WhatsApp</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-session">
                          <SelectValue placeholder="Selecione uma sessão conectada" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {loadingSessions ? (
                          <SelectItem value="">Carregando...</SelectItem>
                        ) : connectedSessions.length === 0 ? (
                          <SelectItem value="">Nenhuma sessão conectada</SelectItem>
                        ) : (
                          connectedSessions.map((session: any) => (
                            <SelectItem key={session.id} value={session.id}>
                              {session.nome}
                              {session.telefone && ` (${session.telefone})`}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Filters Section */}
              <div className="border-t pt-6">
                <h3 className="font-semibold mb-4">Filtros de Clientes</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="filtros.status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue placeholder="Todos os status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">Todos</SelectItem>
                            <SelectItem value="lead_quente">Lead quente</SelectItem>
                            <SelectItem value="engajado">Engajado</SelectItem>
                            <SelectItem value="em_negociacao">Em negociação</SelectItem>
                            <SelectItem value="em_fechamento">Em fechamento</SelectItem>
                            <SelectItem value="ativo">Ativo</SelectItem>
                            <SelectItem value="perdido">Perdido</SelectItem>
                            <SelectItem value="remarketing">Remarketing</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="filtros.carteira"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Carteira</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: Vivo, Claro, Tim"
                            {...field}
                            data-testid="input-carteira"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Statistics */}
              {form.watch("sessionId") && (
                <div className="border-t pt-6">
                  <h3 className="font-semibold mb-4">Estatísticas</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="p-4 bg-blue-50 dark:bg-blue-950">
                      <p className="text-sm text-muted-foreground">Total de Clientes</p>
                      <p className="text-2xl font-bold">{stats.totalClientes}</p>
                    </Card>
                    <Card className="p-4 bg-purple-50 dark:bg-purple-950">
                      <p className="text-sm text-muted-foreground">Filtrados</p>
                      <p className="text-2xl font-bold">{stats.filtrados}</p>
                    </Card>
                    <Card className="p-4 bg-green-50 dark:bg-green-950">
                      <p className="text-sm text-muted-foreground">Com Telefone</p>
                      <p className="text-2xl font-bold">{stats.comTelefone}</p>
                    </Card>
                  </div>
                </div>
              )}

              {/* Message */}
              <div className="border-t pt-6">
                <FormField
                  control={form.control}
                  name="mensagem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mensagem</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Digite a mensagem que será enviada..."
                          className="min-h-32"
                          {...field}
                          data-testid="textarea-message"
                        />
                      </FormControl>
                      <div className="flex justify-between items-center mt-2">
                        <p className="text-xs text-muted-foreground">
                          {field.value.length} / 4096 caracteres
                        </p>
                        {field.value.length > 0 && (
                          <Badge variant="secondary">
                            ~{Math.ceil(field.value.length / 160)} SMS
                          </Badge>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 justify-end border-t pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/whatsapp")}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    sendMutation.isPending ||
                    loadingSessions ||
                    !form.watch("sessionId") ||
                    stats.comTelefone === 0
                  }
                  className="bg-[#776BFF] hover:bg-[#6658DD]"
                  data-testid="button-submit"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sendMutation.isPending ? "Enviando..." : "Enviar Mensagens"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Envio</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Você está prestes a enviar mensagens para <strong>{stats.comTelefone}</strong> clientes.
              </p>
              <div className="mt-4 p-3 bg-muted rounded-md max-h-24 overflow-y-auto">
                <p className="text-sm whitespace-pre-wrap break-words">
                  {confirmedData?.mensagem}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                ⚠️ Esta ação não pode ser desfeita. As mensagens serão enfileiradas para envio imediato.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel data-testid="button-cancel-confirm">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSend}
              disabled={sendMutation.isPending}
              className="bg-[#776BFF] hover:bg-[#6658DD]"
              data-testid="button-confirm-send"
            >
              {sendMutation.isPending ? "Enviando..." : "Confirmar Envio"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
