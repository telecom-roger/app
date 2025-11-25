import { useState } from "react";
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
import { MessageSquare, Plus, Trash2, RotateCw } from "lucide-react";

export default function WhatsApp() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [sessionName, setSessionName] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [reconnectSessionId, setReconnectSessionId] = useState<string | null>(null);

  const { data: sessions, isLoading } = useQuery<any[]>({
    queryKey: ["/api/whatsapp/sessions"],
    enabled: isAuthenticated,
  });

  const connectMutation = useMutation({
    mutationFn: async (nome: string) => {
      console.log("📤 Enviando requisição para conectar WhatsApp:", nome);
      const response = await apiRequest("POST", "/api/whatsapp/connect", { nome });
      const result = await response.json();
      console.log("📥 Resposta recebida:", result);
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/sessions"] });
      
      console.log("✅ Resposta da conexão processada:", data);
      console.log("✅ QR Code disponível?", !!data?.qrCode, "Length:", data?.qrCode?.length);
      
      if (data?.qrCode && data.qrCode.length > 0) {
        console.log("🎯 Exibindo QR code na tela");
        setQrCode(data.qrCode);
        setOpenDialog(true); // ✅ ABRIR DIÁLOGO COM QR CODE
        console.log("✓ QR Code (imagem) recebido do servidor");
        toast({
          title: "Sucesso",
          description: "Sessão criada! Escaneie o QR code com seu WhatsApp",
        });
      } else if (data?.sessionId) {
        // Fallback: mostrar ID se QR code não foi gerado
        setQrCode("fallback:" + data.sessionId);
        setOpenDialog(true); // ✅ ABRIR DIÁLOGO COM FALLBACK
        console.log("⚠️ QR Code não disponível, usando fallback com ID:", data.sessionId);
        toast({
          title: "Atenção",
          description: "Sessão criada, mas QR code não pôde ser gerado. Tente novamente.",
          variant: "destructive",
        });
      } else {
        setQrCode("error");
        setOpenDialog(true); // ✅ ABRIR DIÁLOGO COM ERRO
        console.log("❌ Erro: sem qrCode e sem sessionId");
        toast({
          title: "Erro",
          description: "Falha ao criar sessão",
          variant: "destructive",
        });
      }
      setSessionName("");
    },
    onError: (error: any) => {
      console.error("❌ Erro na mutation:", error.message);
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
        title: "Sucesso",
        description: "Sessão deletada",
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
          title: "Sucesso",
          description: "Sessão reconectada! Escaneie o novo QR code",
        });
      } else {
        toast({
          title: "Atenção",
          description: "Sessão preparada para reconectar, mas QR code não disponível",
        });
      }
      setReconnectSessionId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao reconectar sessão",
        variant: "destructive",
      });
    },
  });

  const getStatusDot = (status: string) => {
    if (status === "conectada") {
      return "bg-green-400";
    } else if (status === "erro") {
      return "bg-red-500";
    } else {
      return "bg-red-500";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="h-8 w-8" />
          WhatsApp Business
        </h1>
        <p className="text-muted-foreground mt-2">
          Conecte e envie mensagens em massa via WhatsApp
        </p>
      </div>

      <Card className="bg-white border-2 border-[#776BFF]">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Sessões Conectadas</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {sessions?.length || 0} sessão(ões) criada(s)
              </p>
            </div>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
              <DialogTrigger asChild>
                <Button
                  className="bg-[#776BFF] text-white hover:bg-[#6658DD]"
                  data-testid="button-new-session"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Sessão
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Conectar WhatsApp</DialogTitle>
                  <DialogDescription>
                    Digite um nome para a sessão e escaneie o QR code com seu celular
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Nome da sessão (ex: Vendas)"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && sessionName && !connectMutation.isPending) {
                        connectMutation.mutate(sessionName);
                      }
                    }}
                    data-testid="input-session-name"
                  />
                  <Button
                    onClick={() => connectMutation.mutate(sessionName)}
                    disabled={!sessionName || connectMutation.isPending}
                    className="w-full bg-[#776BFF] text-white hover:bg-[#6658DD]"
                    data-testid="button-connect"
                  >
                    {connectMutation.isPending ? "Gerando QR Code..." : "Conectar"}
                  </Button>
                  {qrCode && !qrCode.startsWith("error") && !qrCode.startsWith("fallback:") && (
                    <div className="flex flex-col items-center gap-4 p-6 bg-gradient-to-b from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 rounded-xl border-3 border-[#776BFF] shadow-lg">
                      <img
                        src={qrCode}
                        alt="QR Code WhatsApp"
                        className="w-80 h-80 rounded-lg p-2 bg-white border-2 border-gray-200 dark:border-gray-700 shadow-md"
                        onError={() => console.error("Erro ao carregar imagem QR")}
                      />
                      <div className="text-center space-y-2">
                        <p className="text-lg font-bold text-foreground">
                          📱 Escaneie o Código QR
                        </p>
                        <p className="text-sm text-muted-foreground max-w-xs">
                          Abra o WhatsApp → Configurações → Dispositivos Vinculados → Vincular Dispositivo
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                          ✓ Código válido por 5 minutos
                        </p>
                      </div>
                    </div>
                  )}
                  {qrCode?.startsWith("fallback:") && (
                    <div className="text-center p-4 bg-yellow-50 rounded-lg dark:bg-yellow-950 space-y-2 border-2 border-yellow-200 dark:border-yellow-800">
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        ⚠️ QR Code não pôde ser gerado
                      </p>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300 break-all font-mono">
                        ID: {qrCode.replace("fallback:", "")}
                      </p>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300">
                        A sessão foi criada. Tente criar uma nova sessão.
                      </p>
                    </div>
                  )}
                  {qrCode === "error" && (
                    <div className="text-center p-3 bg-red-50 rounded-lg dark:bg-red-950 border border-red-200 dark:border-red-800">
                      <p className="text-sm text-red-700 dark:text-red-200">
                        ❌ Erro ao criar sessão. Tente novamente.
                      </p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-12 w-full" />
            </Card>
          ))
        ) : sessions && sessions.length > 0 ? (
          sessions.map((session: any) => (
            <Card
              key={session.id}
              className="p-4 bg-white border-2 border-[#776BFF] hover:shadow-md transition-shadow dark:bg-gray-950"
              data-testid={`card-session-${session.id}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className={`h-3 w-3 rounded-full flex-shrink-0 ${getStatusDot(
                      session.status
                    )}`}
                    data-testid={`status-dot-${session.id}`}
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">{session.nome}</h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {session.telefone ? `📱 ${session.telefone}` : "Não conectado"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge
                    variant="secondary"
                    className={`${
                      session.status === "conectada"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : session.status === "erro"
                        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                    }`}
                    data-testid={`badge-status-${session.id}`}
                  >
                    {session.status === "conectada"
                      ? "Online"
                      : session.status === "desconectada"
                      ? "Offline"
                      : "Erro"}
                  </Badge>
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
                      className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                    >
                      <RotateCw className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteSessionId(session.id)}
                    data-testid={`button-delete-${session.id}`}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-12 text-center bg-white border-2 border-[#776BFF] dark:bg-gray-950">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma sessão conectada</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crie uma nova sessão para começar a enviar mensagens
            </p>
          </Card>
        )}
      </div>

      <AlertDialog open={!!deleteSessionId} onOpenChange={(open) => !open && setDeleteSessionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Sessão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar esta sessão? Esta ação não pode ser desfeita.
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
              className="bg-red-500 hover:bg-red-600"
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
