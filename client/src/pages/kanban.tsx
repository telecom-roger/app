import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, GripVertical, User, DollarSign, Trash2, Edit2 } from "lucide-react";
import type { Opportunity } from "@shared/schema";
import { insertOpportunitySchema } from "@shared/schema";

const colunas = [
  { id: "lead", titulo: "Lead", cor: "bg-blue-500" },
  { id: "contato", titulo: "Contato Realizado", cor: "bg-yellow-500" },
  { id: "proposta", titulo: "Proposta Enviada", cor: "bg-purple-500" },
  { id: "fechado", titulo: "Fechado", cor: "bg-green-500" },
  { id: "perdido", titulo: "Perdido", cor: "bg-red-500" },
];

export default function Kanban() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>("todos");
  const [showNovaOportunidade, setShowNovaOportunidade] = useState(false);
  const [editingOportunidade, setEditingOportunidade] = useState<Opportunity | null>(null);
  const [draggedCard, setDraggedCard] = useState<{ id: string; fromEtapa: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Não autorizado",
        description: "Você precisa estar logado. Redirecionando...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: oportunidades, isLoading } = useQuery<Opportunity[]>({
    queryKey: [
      "/api/opportunities",
      filtroResponsavel !== "todos" ? { responsavel: filtroResponsavel } : null,
    ].filter(Boolean),
    enabled: isAuthenticated,
  });

  const { data: clientesData } = useQuery<{ clientes: any[]; total: number }>({
    queryKey: ["/api/clients"],
    enabled: isAuthenticated,
  });

  const clientes = clientesData?.clientes || [];

  const moveCardMutation = useMutation({
    mutationFn: async ({ id, etapa }: { id: string; etapa: string }) => {
      await apiRequest("PATCH", `/api/opportunities/${id}/move`, { etapa });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      toast({
        title: "Sucesso",
        description: "Oportunidade movida com sucesso",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Não autorizado",
          description: "Você foi desconectado. Fazendo login novamente...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erro",
        description: "Não foi possível mover a oportunidade",
        variant: "destructive",
      });
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/opportunities/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      toast({
        title: "Sucesso",
        description: "Oportunidade excluída",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a oportunidade",
        variant: "destructive",
      });
    },
  });

  const oportunidadesPorEtapa = colunas.map(coluna => ({
    ...coluna,
    oportunidades: (oportunidades || []).filter(op => op.etapa === coluna.id),
  }));

  if (authLoading || !isAuthenticated) {
    return <KanbanSkeleton />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Oportunidades</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seu funil de vendas
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
            <SelectTrigger className="w-48" data-testid="select-responsavel">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value={user?.id ? String(user.id) : ""}>Minhas oportunidades</SelectItem>
            </SelectContent>
          </Select>
          <Button data-testid="button-nova-oportunidade" onClick={() => setShowNovaOportunidade(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Oportunidade
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {oportunidadesPorEtapa.map((coluna) => (
            <KanbanColumn
              key={coluna.id}
              coluna={coluna}
              isLoading={isLoading}
              clientes={clientes}
              onMoveCard={(id, etapa) => {
                setDraggedCard(null);
                moveCardMutation.mutate({ id, etapa });
              }}
              onDeleteCard={(id) => deleteCardMutation.mutate(id)}
              onEditCard={setEditingOportunidade}
              draggedCard={draggedCard}
              setDraggedCard={setDraggedCard}
            />
          ))}
        </div>
      </div>

      {/* Modal Criar Oportunidade */}
      <NovaOportunidadeDialog
        open={showNovaOportunidade}
        onOpenChange={setShowNovaOportunidade}
        clientes={clientes || []}
      />
      {/* Modal Editar Oportunidade */}
      <EditarOportunidadeDialog
        open={!!editingOportunidade}
        onOpenChange={(open) => !open && setEditingOportunidade(null)}
        oportunidade={editingOportunidade}
        clientes={clientes || []}
      />
    </div>
  );
}

function KanbanColumn({
  coluna,
  isLoading,
  clientes,
  onMoveCard,
  onDeleteCard,
  onEditCard,
  draggedCard,
  setDraggedCard,
}: {
  coluna: { id: string; titulo: string; cor: string; oportunidades: Opportunity[] };
  isLoading: boolean;
  clientes: any[];
  onMoveCard: (id: string, etapa: string) => void;
  onDeleteCard: (id: string) => void;
  onEditCard: (oportunidade: Opportunity) => void;
  draggedCard: { id: string; fromEtapa: string } | null;
  setDraggedCard: (card: { id: string; fromEtapa: string } | null) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (draggedCard && draggedCard.id) {
      onMoveCard(draggedCard.id, coluna.id);
    }
  };

  return (
    <div
      className="flex-shrink-0 w-80"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Card className={`h-full flex flex-col transition-colors ${isDragOver ? "bg-muted/50" : ""}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${coluna.cor}`} />
              <div className="flex flex-col">
                <h3 className="font-semibold">{coluna.titulo}</h3>
                {coluna.oportunidades.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Total: R$ {(
                      coluna.oportunidades.reduce((sum, op) => sum + (op.valorEstimado || 0), 0) / 100
                    ).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                )}
              </div>
            </div>
            <Badge variant="secondary" className="ml-auto">
              {coluna.oportunidades.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-300px)]">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))
          ) : coluna.oportunidades.length > 0 ? (
            coluna.oportunidades.map((oportunidade) => (
              <OpportunityCard
                key={oportunidade.id}
                oportunidade={oportunidade}
                cliente={clientes.find(c => c.id === oportunidade.clientId)}
                onDelete={onDeleteCard}
                onEdit={onEditCard}
                draggedCard={draggedCard}
                setDraggedCard={setDraggedCard}
              />
            ))
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhuma oportunidade
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OpportunityCard({
  oportunidade,
  cliente,
  onDelete,
  onEdit,
  draggedCard,
  setDraggedCard,
}: {
  oportunidade: Opportunity;
  cliente?: any;
  onDelete: (id: string) => void;
  onEdit: (oportunidade: Opportunity) => void;
  draggedCard: { id: string; fromEtapa: string } | null;
  setDraggedCard: (card: { id: string; fromEtapa: string } | null) => void;
}) {
  const handleDragStart = () => {
    setDraggedCard({ id: oportunidade.id, fromEtapa: oportunidade.etapa });
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
  };

  const isDragging = draggedCard?.id === oportunidade.id;

  return (
    <Card
      className={`cursor-move hover-elevate active-elevate-2 transition-opacity ${
        isDragging ? "opacity-50" : "opacity-100"
      }`}
      data-testid={`card-oportunidade-${oportunidade.id}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {cliente?.razaoSocial && (
              <p className="text-xs font-semibold text-muted-foreground uppercase truncate">
                {cliente.razaoSocial}
              </p>
            )}
            <h4 className="font-medium leading-snug break-words">{oportunidade.titulo}</h4>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={() => onEdit(oportunidade)}
              className="text-muted-foreground hover:text-primary transition-colors"
              data-testid={`button-edit-${oportunidade.id}`}
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(oportunidade.id)}
              className="text-muted-foreground hover:text-destructive transition-colors"
              data-testid={`button-delete-${oportunidade.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {oportunidade.valorEstimado && (
          <div className="flex items-center gap-2 text-sm font-semibold">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-primary">
              R$ {(oportunidade.valorEstimado / 100).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
          {oportunidade.prazo && (
            <span>
              {new Date(oportunidade.prazo).toLocaleDateString("pt-BR")}
            </span>
          )}
          {oportunidade.responsavelId && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>Atribuído</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function NovaOportunidadeDialog({
  open,
  onOpenChange,
  clientes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: any[];
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchCliente, setSearchCliente] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  
  useEffect(() => {
    if (open) {
      setSearchCliente("");
      setShowDropdown(true);
    }
  }, [open]);
  
  const clientesFiltrados = searchCliente.trim() === "" 
    ? clientes 
    : clientes.filter((client: any) => {
        return (client.razaoSocial?.toLowerCase().includes(searchCliente.toLowerCase())) ||
               (client.cpfCnpj?.includes(searchCliente));
      });
  
  const form = useForm({
    resolver: zodResolver(insertOpportunitySchema),
    defaultValues: {
      titulo: "",
      clientId: "",
      etapa: "lead",
      valorEstimado: 0,
      responsavelId: user?.id,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/opportunities", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      toast({
        title: "Sucesso",
        description: "Oportunidade criada com sucesso",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível criar a oportunidade",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    createMutation.mutate({
      ...data,
      valorEstimado: data.valorEstimado || 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Oportunidade</DialogTitle>
          <DialogDescription>
            Crie uma nova oportunidade para rastrear no funil de vendas
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => {
                const fieldSelectedClient = clientes.find((c: any) => c.id === field.value);
                return (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Input
                          placeholder="Buscar por razão social ou CNPJ..."
                          value={searchCliente}
                          onChange={(e) => setSearchCliente(e.target.value)}
                          onFocus={() => setShowDropdown(true)}
                          data-testid="input-search-cliente"
                        />
                        {showDropdown && (
                          <div className="border rounded-md max-h-96 overflow-y-auto bg-background z-50 shadow-lg">
                            {Array.isArray(clientes) && clientes.length > 0 ? (
                              clientesFiltrados.length > 0 ? (
                                <>
                                  <div className="sticky top-0 p-2 bg-background border-b text-xs text-muted-foreground">
                                    {clientesFiltrados.length} de {clientes.length} clientes
                                  </div>
                                  {clientesFiltrados.map((client: any) => (
                                    <div
                                      key={client.id}
                                      onClick={() => {
                                        field.onChange(client.id);
                                        setSearchCliente("");
                                        setShowDropdown(false);
                                      }}
                                      className="p-3 border-b hover:bg-muted cursor-pointer last:border-b-0"
                                      data-testid={`option-client-${client.id}`}
                                    >
                                      <div className="font-medium">{client.razaoSocial || client.nome}</div>
                                      {client.cpfCnpj && (
                                        <div className="text-xs text-muted-foreground">{client.cpfCnpj}</div>
                                      )}
                                    </div>
                                  ))}
                                </>
                              ) : (
                                <div className="p-3 text-sm text-muted-foreground text-center">
                                  Nenhum cliente encontrado
                                </div>
                              )
                            ) : (
                              <div className="p-3 text-sm text-muted-foreground text-center">
                                Carregando clientes...
                              </div>
                            )}
                          </div>
                        )}
                        {fieldSelectedClient && (
                          <div className="p-2 bg-muted rounded text-sm">
                            <div className="font-medium">{fieldSelectedClient.razaoSocial || fieldSelectedClient.nome}</div>
                            <div className="text-xs text-muted-foreground">{fieldSelectedClient.cpfCnpj}</div>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Proposta de plano móvel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="valorEstimado"
              render={({ field }) => {
                const formatCurrency = (value: number) => {
                  return new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(value / 100);
                };

                const parseCurrency = (text: string) => {
                  const cleaned = text.replace(/\D/g, "");
                  // Converte para centavos (multiplica por 100)
                  return cleaned ? parseInt(cleaned) * 100 : 0;
                };

                return (
                  <FormItem>
                    <FormLabel>Valor Estimado</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="R$ 0,00"
                        value={field.value ? formatCurrency(field.value) : ""}
                        onChange={(e) => {
                          const parsed = parseCurrency(e.target.value);
                          field.onChange(parsed);
                        }}
                        data-testid="input-valor-estimado"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createMutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Criando..." : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditarOportunidadeDialog({
  open,
  onOpenChange,
  oportunidade,
  clientes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oportunidade: Opportunity | null;
  clientes: any[];
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchCliente, setSearchCliente] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (open) {
      setSearchCliente("");
      setShowDropdown(false);
    }
  }, [open]);

  const clientesFiltrados = searchCliente.trim() === ""
    ? clientes
    : clientes.filter((client: any) => {
        return (client.razaoSocial?.toLowerCase().includes(searchCliente.toLowerCase())) ||
               (client.cpfCnpj?.includes(searchCliente));
      });

  const selectedClient = clientes.find((c: any) => c.id === oportunidade?.clientId);

  const form = useForm({
    resolver: zodResolver(insertOpportunitySchema),
    defaultValues: {
      titulo: oportunidade?.titulo || "",
      clientId: oportunidade?.clientId || "",
      etapa: oportunidade?.etapa || "lead",
      valorEstimado: oportunidade?.valorEstimado || 0,
      responsavelId: oportunidade?.responsavelId || user?.id,
    },
  });

  useEffect(() => {
    if (oportunidade) {
      form.reset({
        titulo: oportunidade.titulo,
        clientId: oportunidade.clientId,
        etapa: oportunidade.etapa,
        valorEstimado: oportunidade.valorEstimado || 0,
        responsavelId: oportunidade.responsavelId || user?.id,
      });
      setSearchCliente("");
    }
  }, [oportunidade, open]);

  const editMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!oportunidade) return;
      await apiRequest("PATCH", `/api/opportunities/${oportunidade.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      toast({
        title: "Sucesso",
        description: "Oportunidade atualizada com sucesso",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a oportunidade",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    editMutation.mutate({
      ...data,
      valorEstimado: data.valorEstimado || 0,
    });
  };

  if (!oportunidade) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Oportunidade</DialogTitle>
          <DialogDescription>
            Atualize os detalhes da oportunidade
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => {
                const fieldSelectedClient = clientes.find((c: any) => c.id === field.value);
                return (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Input
                          placeholder="Buscar por razão social ou CNPJ..."
                          value={searchCliente}
                          onChange={(e) => setSearchCliente(e.target.value)}
                          onFocus={() => setShowDropdown(true)}
                          data-testid="input-search-cliente-edit"
                        />
                        {showDropdown && (
                          <div className="border rounded-md max-h-96 overflow-y-auto bg-background z-50 shadow-lg">
                            {Array.isArray(clientes) && clientes.length > 0 ? (
                              clientesFiltrados.length > 0 ? (
                                <>
                                  <div className="sticky top-0 p-2 bg-background border-b text-xs text-muted-foreground">
                                    {clientesFiltrados.length} de {clientes.length} clientes
                                  </div>
                                  {clientesFiltrados.map((client: any) => (
                                    <div
                                      key={client.id}
                                      onClick={() => {
                                        field.onChange(client.id);
                                        setSearchCliente("");
                                        setShowDropdown(false);
                                      }}
                                      className="p-3 border-b hover:bg-muted cursor-pointer last:border-b-0"
                                      data-testid={`option-client-edit-${client.id}`}
                                    >
                                      <div className="font-medium">{client.razaoSocial || client.nome}</div>
                                      {client.cpfCnpj && (
                                        <div className="text-xs text-muted-foreground">{client.cpfCnpj}</div>
                                      )}
                                    </div>
                                  ))}
                                </>
                              ) : (
                                <div className="p-3 text-sm text-muted-foreground text-center">
                                  Nenhum cliente encontrado
                                </div>
                              )
                            ) : (
                              <div className="p-3 text-sm text-muted-foreground text-center">
                                Carregando clientes...
                              </div>
                            )}
                          </div>
                        )}
                        {fieldSelectedClient && (
                          <div className="p-2 bg-muted rounded text-sm">
                            <div className="font-medium">{fieldSelectedClient.razaoSocial || fieldSelectedClient.nome}</div>
                            <div className="text-xs text-muted-foreground">{fieldSelectedClient.cpfCnpj}</div>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Proposta de plano móvel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="valorEstimado"
              render={({ field }) => {
                const formatCurrency = (value: number) => {
                  return new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(value / 100);
                };

                const parseCurrency = (text: string) => {
                  const cleaned = text.replace(/\D/g, "");
                  // Converte para centavos (multiplica por 100)
                  return cleaned ? parseInt(cleaned) * 100 : 0;
                };

                return (
                  <FormItem>
                    <FormLabel>Valor Estimado</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="R$ 0,00"
                        value={field.value ? formatCurrency(field.value) : ""}
                        onChange={(e) => {
                          const parsed = parseCurrency(e.target.value);
                          field.onChange(parsed);
                        }}
                        data-testid="input-valor-estimado-edit"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={editMutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending ? "Atualizando..." : "Atualizar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function KanbanSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="flex gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="w-80">
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
