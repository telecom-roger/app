import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Trash2, Clock, X, Download, AlertCircle, Loader } from "lucide-react";
import { useState } from "react";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const { connected: whatsappConnected } = useWhatsAppStatus();
  const [openDialog, setOpenDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [clientesSelecionados, setClientesSelecionados] = useState<Set<string>>(new Set());
  const [searchClientes, setSearchClientes] = useState("");
  const [quantidadeSelecar, setQuantidadeSelecar] = useState(10);

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

  // Filter clients by search
  const clientesFiltrados = clients.filter((c) =>
    c.nome.toLowerCase().includes(searchClientes.toLowerCase()) ||
    c.telefone.includes(searchClientes)
  );

  // Toggle client selection
  const toggleClienteSelecionado = (clientId: string) => {
    const novo = new Set(clientesSelecionados);
    if (novo.has(clientId)) {
      novo.delete(clientId);
    } else {
      novo.add(clientId);
    }
    setClientesSelecionados(novo);
  };

  // Import selected clients
  const importarSelecionadosDoBD = () => {
    if (clientesSelecionados.size === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um cliente",
        variant: "destructive",
      });
      return;
    }

    // Store selected clients in filtros
    const clientIds = Array.from(clientesSelecionados);
    form.setValue("filtros", { clientIds });
    form.setValue("totalRecipients", clientesSelecionados.size);
    
    setShowClientSelector(false);
    setClientesSelecionados(new Set());
    setSearchClientes("");

    toast({
      title: "Sucesso",
      description: `${clientesSelecionados.size} cliente${clientesSelecionados.size !== 1 ? "s" : ""} selecionado${clientesSelecionados.size !== 1 ? "s" : ""}`,
    });
  };

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
      if (!whatsappConnected) {
        throw new Error("WhatsApp não está conectado. Por favor, conecte antes de agendar.");
      }
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

                <FormItem>
                  <FormLabel>Clientes</FormLabel>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowClientSelector(true)}
                      className="flex-1"
                      data-testid="button-select-clients"
                    >
                      {form.watch("totalRecipients") > 0
                        ? `${form.watch("totalRecipients")} cliente${form.watch("totalRecipients") !== 1 ? "s" : ""} selecionado${form.watch("totalRecipients") !== 1 ? "s" : ""}`
                        : "Selecionar Clientes"}
                    </Button>
                  </div>
                </FormItem>

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

      {/* Cliente Selector Dialog - Exatamente igual a campanhas-whatsapp */}
      <Dialog open={showClientSelector} onOpenChange={setShowClientSelector}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-2xl">Selecionar Clientes</DialogTitle>
            <DialogDescription>
              Escolha os clientes que receberão a campanha agendada. Use a busca para filtrar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
            {/* Search Input + Counter */}
            <div className="flex gap-2 items-center">
              <Input
                placeholder="🔍 Buscar por nome ou telefone..."
                value={searchClientes}
                onChange={(e) => setSearchClientes(e.target.value)}
                className="flex-1"
                data-testid="input-search-clients"
              />
              <Badge variant="secondary" className="h-10 px-3 flex items-center gap-2 whitespace-nowrap">
                {clientesFiltrados.length} clientes
              </Badge>
            </div>

            {/* Quick Select Buttons */}
            <div className="flex gap-2 flex-wrap items-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setClientesSelecionados(new Set(clientesFiltrados.map((c) => c.id)))}
                disabled={clientesFiltrados.length === 0}
                data-testid="button-select-all-quick"
              >
                ✓ Selecionar Todos
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setClientesSelecionados(new Set())}
                disabled={clientesSelecionados.size === 0}
                data-testid="button-deselect-all"
              >
                ✕ Desselecionar Todos
              </Button>

              {/* Divider */}
              <div className="h-6 w-px bg-border" />

              {/* Random Selection */}
              <div className="flex gap-2 items-center">
                <Label className="text-xs font-medium whitespace-nowrap">Aleatório:</Label>
                <Input
                  type="number"
                  min={1}
                  max={clientesFiltrados.length}
                  value={quantidadeSelecar}
                  onChange={(e) => setQuantidadeSelecar(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 h-9"
                  data-testid="input-quantidade-selecionar"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const shuffled = [...clientesFiltrados].sort(() => Math.random() - 0.5);
                    const quantidadeReal = Math.min(quantidadeSelecar, clientesFiltrados.length);
                    const selecionados = shuffled.slice(0, quantidadeReal).map((c) => c.id);
                    setClientesSelecionados(new Set(selecionados));
                  }}
                  disabled={clientesFiltrados.length === 0}
                  data-testid="button-random-select"
                >
                  🎲 Selecionar
                </Button>
              </div>
            </div>

            {/* Clients Table with better styling */}
            <div className="flex-1 overflow-hidden flex flex-col border rounded-lg bg-white dark:bg-slate-950 min-h-[400px]">
              {clientesFiltrados.length === 0 ? (
                <div className="flex items-center justify-center flex-1 text-muted-foreground">
                  <div className="text-center">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum cliente encontrado</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto border-t">
                  <Table className="text-sm w-full">
                    <TableHeader className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10">
                      <TableRow className="border-b-2">
                        <TableHead className="w-12 text-center py-2 px-3">
                          <Checkbox
                            checked={clientesSelecionados.size === clientesFiltrados.length && clientesFiltrados.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setClientesSelecionados(new Set(clientesFiltrados.map((c) => c.id)));
                              } else {
                                setClientesSelecionados(new Set());
                              }
                            }}
                            data-testid="checkbox-select-all"
                          />
                        </TableHead>
                        <TableHead className="font-semibold py-2 px-3">RAZÃO SOCIAL</TableHead>
                        <TableHead className="font-semibold py-2 px-3">CELULAR</TableHead>
                        <TableHead className="font-semibold py-2 px-3">CARTEIRA</TableHead>
                        <TableHead className="font-semibold text-xs py-2 px-3">STATUS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientesFiltrados.map((client) => (
                        <TableRow key={client.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer transition-colors" data-testid={`row-cliente-${client.id}`}>
                          <TableCell className="text-center w-12 py-2 px-3" onClick={(e) => {
                            e.stopPropagation();
                            toggleClienteSelecionado(client.id);
                          }}>
                            <Checkbox
                              checked={clientesSelecionados.has(client.id)}
                              onCheckedChange={() => toggleClienteSelecionado(client.id)}
                              data-testid={`checkbox-cliente-${client.id}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium py-2 px-3" data-testid={`text-razaosocial-${client.id}`}>{client.razaoSocial || "N/A"}</TableCell>
                          <TableCell className="font-mono text-sm font-medium py-2 px-3" data-testid={`text-celular-${client.id}`}>{client.telefone}</TableCell>
                          <TableCell className="py-2 px-3">
                            <Badge variant="outline" className="text-xs">{client.carteira || "N/A"}</Badge>
                          </TableCell>
                          <TableCell className="text-xs py-2 px-3" data-testid={`status-cliente-${client.id}`}>
                            <Badge variant="secondary" className="text-xs">{client.status || "Lead"}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Summary with Stats */}
            <div className="flex gap-4 items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border">
              <div className="flex gap-6">
                <div className="text-sm">
                  <span className="text-muted-foreground">Selecionados:</span>
                  <span className="font-semibold ml-2 text-lg text-primary">{clientesSelecionados.size}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-semibold ml-2 text-lg">{clientesFiltrados.length}</span>
                </div>
              </div>
              {clientesSelecionados.size > 0 && (
                <div className="text-xs text-green-600 dark:text-green-400">
                  ✓ Pronto para agendar
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowClientSelector(false);
                setClientesSelecionados(new Set());
                setSearchClientes("");
              }}
              data-testid="button-cancelar-seletor"
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={importarSelecionadosDoBD}
              disabled={clientesSelecionados.size === 0}
              data-testid="button-confirmar-seletor"
            >
              Confirmar ({clientesSelecionados.size})
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
