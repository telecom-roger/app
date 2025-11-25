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
import { MessageSquare, Plus } from "lucide-react";

export default function WhatsApp() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [sessionName, setSessionName] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);

  const { data: sessions, isLoading } = useQuery<any[]>({
    queryKey: ["/api/whatsapp/sessions"],
    enabled: isAuthenticated,
  });

  const connectMutation = useMutation({
    mutationFn: async (nome: string) => {
      const result: any = await apiRequest("POST", "/api/whatsapp/connect", { nome });
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/sessions"] });
      toast({
        title: "Sucesso",
        description: "Sessão criada! Escaneie o QR code com seu WhatsApp",
      });
      setSessionName("");
      setQrCode(data.sessionId);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao conectar WhatsApp",
        variant: "destructive",
      });
    },
  });

  const statusColors: Record<string, string> = {
    conectada: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    desconectada: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    erro: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
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
                {sessions?.length || 0} sessão(ões) ativa(s)
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
                    Digite um nome para a sessão e escaneie o QR code
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Nome da sessão (ex: Vendas)"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    data-testid="input-session-name"
                  />
                  <Button
                    onClick={() => connectMutation.mutate(sessionName)}
                    disabled={!sessionName || connectMutation.isPending}
                    className="w-full bg-[#776BFF] text-white"
                    data-testid="button-connect"
                  >
                    {connectMutation.isPending ? "Conectando..." : "Conectar"}
                  </Button>
                  {qrCode && (
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">
                        QR Code: {qrCode}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Escaneie com seu WhatsApp para conectar
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
              className="p-4 bg-white border-2 border-[#776BFF] hover:shadow-md transition-shadow"
              data-testid={`card-session-${session.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold">{session.nome}</h3>
                  <p className="text-sm text-muted-foreground">
                    {session.telefone ? `📱 ${session.telefone}` : "Não conectado"}
                  </p>
                </div>
                <Badge
                  className={statusColors[session.status] || ""}
                  variant="secondary"
                >
                  {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                </Badge>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-12 text-center bg-white border-2 border-[#776BFF]">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma sessão conectada</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crie uma nova sessão para começar a enviar mensagens
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
