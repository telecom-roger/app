import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MessageSquare, Plus, Trash2, RotateCw, CheckCircle, AlertCircle, Zap, Clock } from "lucide-react";
import { useLocation } from "wouter";

export default function WhatsApp() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();
  const [sessionName, setSessionName] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [reconnectSessionId, setReconnectSessionId] = useState<string | null>(null);
  const previousSessionsRef = useRef<any[]>([]);

  const { data: sessions, isLoading } = useQuery<any[]>({
    queryKey: ["/api/whatsapp/sessions"],
    enabled: isAuthenticated,
    refetchInterval: 1000,
  });

  useEffect(() => {
    if (sessions && sessions.length > 0) {
      sessions.forEach((currentSession) => {
        const previousSession = previousSessionsRef.current.find(
          (s) => s.id === currentSession.id
        );
        
        if (previousSession && previousSession.status !== "conectada" && currentSession.status === "conectada") {
          toast({
            title: "Conectado com sucesso",
            description: `${currentSession.nome} está pronto para enviar mensagens`,
          });
        }
        
        if (previousSession && previousSession.status === "conectada" && currentSession.status !== "conectada") {
          toast({
            title: "Desconectado",
            description: `${currentSession.nome} foi desconectado`,
            variant: "destructive",
          });
        }
      });

      previousSessionsRef.current = sessions;
    }
  }, [sessions, toast]);

  useEffect(() => {
    if (sessions && sessions.length > 0 && openDialog && user) {
      // Only close if THIS user has a connected session (not other users' sessions)
      const userConnectedSession = sessions.find((s) => s.status === "conectada" && s.userId === user.id);
      if (userConnectedSession) {
        setOpenDialog(false);
        setQrCode(null);
      }
    }
  }, [sessions, openDialog, user]);

  const connectMutation = useMutation({
    mutationFn: async (nome: string) => {
      const response = await apiRequest("POST", "/api/whatsapp/connect", { nome });
      const result = await response.json();
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/sessions"] });
      
      if (data?.qrCode && data.qrCode.length > 0) {
        setQrCode(data.qrCode);
        setOpenDialog(true);
        toast({
          title: "Pronto para conectar",
          description: "Escaneie o código QR com seu celular",
        });
      } else if (data?.sessionId) {
        setQrCode("fallback:" + data.sessionId);
        setOpenDialog(true);
        toast({
          title: "Sessão criada",
          description: "Tente criar uma nova sessão ou recarregue a página",
          variant: "destructive",
        });
      } else {
        setQrCode("error");
        setOpenDialog(true);
        toast({
          title: "Erro",
          description: "Falha ao criar sessão",
          variant: "destructive",
        });
      }
      setSessionName("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao conectar WhatsApp",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiRequest("DELETE", `/api/whatsapp/sessions/${sessionId}`, {});
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/sessions"] });
      toast({
        title: "Removido",
        description: "Sessão foi deletada com sucesso",
      });
      setDeleteSessionId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao deletar sessão",
        variant: "destructive",
      });
    },
  });

  const reconnectMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiRequest("POST", `/api/whatsapp/sessions/${sessionId}/reconnect`, {});
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/sessions"] });
      
      if (data?.qrCode && data.qrCode.length > 0) {
        setQrCode(data.qrCode);
        setOpenDialog(true);
        toast({
          title: "Reconecte seu WhatsApp",
          description: "Escaneie o novo código QR",
        });
      } else {
        toast({
          title: "Aviso",
          description: "Código QR não disponível no momento",
        });
      }
      setReconnectSessionId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao reconectar",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    if (status === "conectada") return "bg-emerald-500/80";
    return "bg-amber-500/80";
  };

  const getStatusLabel = (status: string) => {
    if (status === "conectada") return "Online";
    return "Offline";
  };

  const connectedCount = sessions?.filter((s: any) => s.status === "conectada").length || 0;
  const hasConnectedSession = connectedCount > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header Section */}
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-green-500/10 rounded-xl">
                  <MessageSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
                  WhatsApp Business
                </h1>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mt-2">
                Gerencie sessões e envie mensagens em massa para seus clientes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 pb-12">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Total de Sessões
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                    {sessions?.length || 0}
                  </p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <MessageSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Conectadas
                  </p>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                    {connectedCount}
                  </p>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Status
                  </p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mt-2">
                    {hasConnectedSession ? (
                      <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <span className="w-2 h-2 bg-emerald-600 dark:bg-emerald-400 rounded-full animate-pulse" />
                        Pronto para usar
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <span className="w-2 h-2 bg-amber-600 dark:bg-amber-400 rounded-full animate-pulse" />
                        Aguardando conexão
                      </span>
                    )}
                  </p>
                </div>
                <div className="p-3 bg-slate-500/10 rounded-lg">
                  <Zap className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                </div>
              </div>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
              <DialogTrigger asChild>
                <Button
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 text-white shadow-lg border-2 border-green-600 dark:border-green-600"
                  data-testid="button-new-session"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Nova Sessão
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader className="space-y-3">
                  <DialogTitle className="text-2xl">Conectar WhatsApp</DialogTitle>
                  <DialogDescription>
                    Digite um nome para sua sessão e escaneie o código QR com seu celular
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900 dark:text-white">
                      Nome da Sessão
                    </label>
                    <Input
                      placeholder="Ex: Vendas, Suporte, etc..."
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && sessionName && !connectMutation.isPending) {
                          connectMutation.mutate(sessionName);
                        }
                      }}
                      data-testid="input-session-name"
                      className="text-base"
                    />
                  </div>

                  {qrCode && !qrCode.startsWith("error") && !qrCode.startsWith("fallback:") && (
                    <div className="flex flex-col items-center gap-4 p-6 bg-gradient-to-b from-emerald-50 to-blue-50 dark:from-emerald-950/20 dark:to-blue-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-900">
                      <img
                        src={qrCode}
                        alt="QR Code WhatsApp"
                        className="w-64 h-64 rounded-2xl p-3 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 shadow-lg"
                        onError={() => console.error("Erro ao carregar imagem QR")}
                      />
                      <div className="text-center space-y-3">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                          Escaneie o Código QR
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xs leading-relaxed">
                          Abra WhatsApp → Configurações → Dispositivos Vinculados → Vincular Dispositivo
                        </p>
                        <div className="flex items-center justify-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 rounded-lg">
                          <Clock className="h-3 w-3" />
                          Código válido por 5 minutos
                        </div>
                      </div>
                    </div>
                  )}

                  {qrCode?.startsWith("fallback:") && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg space-y-2 text-center">
                      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 mx-auto" />
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                        QR Code não pôde ser gerado
                      </p>
                      <p className="text-xs text-amber-800 dark:text-amber-300 break-all font-mono bg-white dark:bg-slate-900 px-3 py-2 rounded mt-2">
                        ID: {qrCode.replace("fallback:", "")}
                      </p>
                    </div>
                  )}

                  {qrCode === "error" && (
                    <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
                      <p className="text-sm text-red-700 dark:text-red-400 text-center">
                        Erro ao criar sessão. Tente novamente.
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={() => connectMutation.mutate(sessionName)}
                    disabled={!sessionName || connectMutation.isPending}
                    size="lg"
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    data-testid="button-connect"
                  >
                    {connectMutation.isPending ? "Gerando código..." : "Conectar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Sessions List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Suas Sessões
              </h2>
              {sessions && sessions.length > 0 && (
                <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800">
                  {sessions.length} sessão{sessions.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="p-4 border-0 shadow-sm">
                    <Skeleton className="h-16 w-full" />
                  </Card>
                ))}
              </div>
            ) : sessions && sessions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sessions.map((session: any) => (
                  <Card
                    key={session.id}
                    className="p-5 border-0 shadow-sm hover:shadow-md transition-shadow duration-200 bg-white dark:bg-slate-800/50 group"
                    data-testid={`card-session-${session.id}`}
                  >
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 dark:text-white truncate text-lg">
                            {session.nome}
                          </h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400 truncate mt-1">
                            {session.status === "conectada"
                              ? session.telefone ? `📱 ${session.telefone}` : "✓ Conectado"
                              : "Não conectado"}
                          </p>
                        </div>
                        <div
                          className={`h-3 w-3 rounded-full flex-shrink-0 animate-pulse ${getStatusColor(session.status)}`}
                          data-testid={`status-dot-${session.id}`}
                        />
                      </div>

                      {/* Status Badge */}
                      <div>
                        <Badge
                          className={`text-xs font-medium ${
                            session.status === "conectada"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                          }`}
                          data-testid={`badge-status-${session.id}`}
                        >
                          {session.status === "conectada" ? "Online" : "Offline"}
                        </Badge>
                      </div>

                      {/* Actions - Only show if user owns this session */}
                      {user?.id === session.userId && (
                        <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                          {session.status === "desconectada" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setReconnectSessionId(session.id);
                                reconnectMutation.mutate(session.id);
                              }}
                              disabled={reconnectMutation.isPending}
                              data-testid={`button-reconnect-${session.id}`}
                              className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 flex-1"
                            >
                              <RotateCw className="h-4 w-4 mr-1" />
                              Reconectar
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteSessionId(session.id)}
                            data-testid={`button-delete-${session.id}`}
                            className={`text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 ${session.status !== "desconectada" ? "flex-1" : ""}`}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Deletar
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center border-0 shadow-sm bg-white dark:bg-slate-800/50">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-slate-400 dark:text-slate-600" />
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2 text-lg">
                  Nenhuma sessão conectada
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Clique em "Nova Sessão" para conectar seu WhatsApp Business
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteSessionId} onOpenChange={(open) => !open && setDeleteSessionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Sessão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta sessão? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteSessionId) {
                  deleteMutation.mutate(deleteSessionId);
                }
              }}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deletando..." : "Deletar"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
