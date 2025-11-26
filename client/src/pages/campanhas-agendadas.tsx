import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCampaignSchema, type Campaign, type Template } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Clock } from "lucide-react";
import { useState } from "react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Conversão de fuso horário para São Paulo (UTC-3)
const convertToSaoPauloDate = (isoDate: string) => {
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return "";
    // Converter de UTC para São Paulo (subtract 3 hours)
    const spDate = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    return spDate.toISOString().slice(0, 16);
  } catch {
    return "";
  }
};

const convertFromSaoPauloDate = (dateTimeLocal: string) => {
  try {
    // dateTimeLocal é "YYYY-MM-DDTHH:mm" interpretado como São Paulo local
    const isoString = dateTimeLocal + ":00Z"; // Parse como UTC
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return new Date().toISOString();
    
    // Agora temos a hora em UTC. Mas queremos que seja São Paulo (UTC-3)
    // Se usuário escolheu 16:00, quer dizer 16:00 SP = 19:00 UTC
    // Então adiciona 3 horas
    const spDate = new Date(date.getTime() + 3 * 60 * 60 * 1000);
    return spDate.toISOString();
  } catch {
    return new Date().toISOString();
  }
};

export default function CampanhasAgendadas() {
  const { toast } = useToast();
  const [openDialog, setOpenDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns/scheduled"],
    queryFn: async () => {
      const res = await fetch("/api/campaigns/scheduled");
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients/whatsapp-list"],
    queryFn: async () => {
      const res = await fetch("/api/clients/whatsapp-list");
      if (!res.ok) throw new Error("Failed to fetch clients");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const form = useForm({
    resolver: zodResolver(insertCampaignSchema),
    defaultValues: {
      nome: "",
      tipo: "whatsapp" as const,
      templateId: "",
      status: "agendada" as const,
      totalRecipients: 0,
      agendadaPara: new Date().toISOString(),
      filtros: {},
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/campaigns/schedule", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/scheduled"] });
      form.reset();
      setOpenDialog(false);
      toast({
        title: "Campanha agendada",
        description: "Sua campanha foi agendada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao agendar campanha",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/campaigns/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/scheduled"] });
      setDeleteId(null);
      toast({
        title: "Campanha removida",
        description: "Sua campanha agendada foi removida.",
      });
    },
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Campanhas Agendadas</h1>
          <p className="text-muted-foreground mt-2">
            Agende campanhas WhatsApp para serem enviadas automaticamente na data
            e hora escolhida
          </p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-schedule-campaign">
              <Plus className="w-4 h-4 mr-2" />
              Agendar Campanha
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Agendar Nova Campanha</DialogTitle>
              <DialogDescription>
                Configure os detalhes e escolha data e hora para envio automático
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) =>
                  createMutation.mutate(data)
                )}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Campanha</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Oferta de Verão"
                          {...field}
                          data-testid="input-campaign-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="templateId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo de Mensagem</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-template">
                            <SelectValue placeholder="Selecione um modelo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {templates
                            .filter((t) => t.tipo === "whatsapp")
                            .map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.nome}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="agendadaPara"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data e Hora de Envio</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          data-testid="input-schedule-datetime"
                          value={
                            field.value
                              ? convertToSaoPauloDate(field.value)
                              : ""
                          }
                          onChange={(e) => {
                            if (e.target.value) {
                              field.onChange(
                                convertFromSaoPauloDate(e.target.value)
                              );
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded text-sm text-muted-foreground">
                  <Clock className="w-4 h-4 inline mr-2" />
                  A campanha será enviada automaticamente na data e hora
                  escolhida para todos os clientes selecionados
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-save-schedule"
                  >
                    {createMutation.isPending ? "Agendando..." : "Agendar Campanha"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpenDialog(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {loadingCampaigns ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            Nenhuma campanha agendada. Agende sua primeira campanha agora!
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{campaign.nome}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Status:{" "}
                    <span className="capitalize font-medium">
                      {campaign.status}
                    </span>
                  </p>
                  {campaign.agendadaPara && (
                    <p className="text-sm mt-2 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Agendado para:{" "}
                      {format(new Date(campaign.agendadaPara), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-2">
                    Total de destinatários: {campaign.totalRecipients}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setDeleteId(campaign.id)}
                  data-testid={`button-delete-campaign-${campaign.id}`}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta campanha agendada? Esta ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete-campaign"
            >
              Remover
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
