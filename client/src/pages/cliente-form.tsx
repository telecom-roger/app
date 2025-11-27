import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, FileText } from "lucide-react";
import { insertClientSchema } from "@shared/schema";
import type { Client } from "@shared/schema";

export default function ClienteForm() {
  const { id } = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const isEditing = id && id !== "novo";

  const form = useForm({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      nome: "",
      razaoSocial: "",
      cpfCnpj: "",
      status: "lead",
      carteira: "",
      categoria: "",
      score: 0,
      planoAtual: "",
      produtoAtual: "",
      telefone: "",
      email: "",
      contato: "",
      endereco: "",
      numero: "",
      complemento: "",
      cep: "",
      cidade: "",
      uf: "",
      dataContrato: undefined,
      valorContrato: 0,
      dataUltimoContato: undefined,
      observacoes: "",
      APARELHO_LIBERADO: "",
      PEDIDO_MOVEL: "",
      M_FIXA: "",
      PEDIDO_FIXA: "",
      NOME_CONTATO: "",
      EMAIL_PRINCIPAL: "",
      CELULAR_PRINCIPAL: "",
      TIPO_GESTOR: "",
      FLG_DOMINIO_PUBLICO_SFA: false,
      TELEFONE_COMERCIAL: "",
      CELULAR: "",
      TELEFONE_RESIDENCIAL: "",
      EMAIL_SIBEL: "",
      PROP_MOVEL_AVANCADA: "",
      SERASA: "",
      MENSAGEM_SERASA: "",
      tags: [],
    },
  });

  // Fetch cliente para edição
  const { data: cliente, isLoading: clienteLoading } = useQuery<Client>({
    queryKey: ["/api/clients", id],
    enabled: isEditing && isAuthenticated && !!id,
  });

  // Preencher form quando cliente é carregado
  useEffect(() => {
    if (cliente && isEditing) {
      console.log("Preenchendo form com cliente:", cliente);
      form.reset({
        nome: cliente.nome || "",
        razaoSocial: cliente.razaoSocial || "",
        cpfCnpj: cliente.cpfCnpj || "",
        status: cliente.status || "lead",
        carteira: cliente.carteira || "",
        categoria: cliente.categoria || "",
        score: cliente.score || 0,
        planoAtual: cliente.planoAtual || "",
        produtoAtual: cliente.produtoAtual || "",
        telefone: cliente.telefone || "",
        email: cliente.email || "",
        contato: cliente.contato || "",
        endereco: cliente.endereco || "",
        numero: cliente.numero || "",
        complemento: cliente.complemento || "",
        cep: cliente.cep || "",
        cidade: cliente.cidade || "",
        uf: cliente.uf || "",
        dataContrato: cliente.dataContrato || undefined,
        valorContrato: cliente.valorContrato || 0,
        dataUltimoContato: cliente.dataUltimoContato || undefined,
        observacoes: cliente.observacoes || "",
        APARELHO_LIBERADO: cliente.APARELHO_LIBERADO || "",
        PEDIDO_MOVEL: cliente.PEDIDO_MOVEL || "",
        M_FIXA: cliente.M_FIXA || "",
        PEDIDO_FIXA: cliente.PEDIDO_FIXA || "",
        NOME_CONTATO: cliente.NOME_CONTATO || "",
        EMAIL_PRINCIPAL: cliente.EMAIL_PRINCIPAL || "",
        CELULAR_PRINCIPAL: cliente.CELULAR_PRINCIPAL || "",
        TIPO_GESTOR: cliente.TIPO_GESTOR || "",
        FLG_DOMINIO_PUBLICO_SFA: cliente.FLG_DOMINIO_PUBLICO_SFA || false,
        TELEFONE_COMERCIAL: cliente.TELEFONE_COMERCIAL || "",
        CELULAR: cliente.CELULAR || "",
        TELEFONE_RESIDENCIAL: cliente.TELEFONE_RESIDENCIAL || "",
        EMAIL_SIBEL: cliente.EMAIL_SIBEL || "",
        PROP_MOVEL_AVANCADA: cliente.PROP_MOVEL_AVANCADA || "",
        SERASA: cliente.SERASA || "",
        MENSAGEM_SERASA: cliente.MENSAGEM_SERASA || "",
        tags: cliente.tags || [],
      });
    }
  }, [cliente?.id, isEditing]);

  // Mutation para criar/atualizar
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEditing) {
        await apiRequest("PATCH", `/api/clients/${id}`, data);
      } else {
        await apiRequest("POST", `/api/clients`, data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Sucesso",
        description: isEditing
          ? "Cliente atualizado com sucesso"
          : "Cliente criado com sucesso",
      });
      navigate("/clientes");
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao salvar cliente",
        variant: "destructive",
      });
    },
  });

  if (authLoading || (isEditing && clienteLoading)) {
    return <ClienteFormSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header Section */}
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/clientes")}
              data-testid="button-back"
              className="mt-1"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-purple-500/10 rounded-xl">
                  <FileText className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
                  {isEditing ? "Editar Cliente" : "Novo Cliente"}
                </h1>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mt-2">
                {isEditing ? "Atualize as informações do cliente" : "Crie um novo cliente"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Container */}
      <div className="px-6 pb-12">
        <div className="max-w-7xl mx-auto">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))}
          className="space-y-6"
        >
          {/* Informações Básicas */}
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50">
            <CardHeader className="border-b border-slate-200 dark:border-slate-700">
              <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nome do cliente"
                        {...field}
                        data-testid="input-nome-cliente"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="razaoSocial"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Razão Social</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Razão social"
                          {...field}
                          data-testid="input-razao-social"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cpfCnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF/CNPJ</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="XXX.XXX.XXX-XX"
                          {...field}
                          data-testid="input-cpf-cnpj"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-status-form">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="lead">Lead</SelectItem>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="proposta">Proposta</SelectItem>
                          <SelectItem value="fechado">Fechado</SelectItem>
                          <SelectItem value="perdido">Perdido</SelectItem>
                          <SelectItem value="inativo">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="carteira"
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

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="categoria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Categoria"
                          {...field}
                          data-testid="input-categoria"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="score"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Score (0-100)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-score"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="planoAtual"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plano Atual</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Plano atual"
                          {...field}
                          data-testid="input-plano"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="produtoAtual"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Produto Atual</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Produto atual"
                        {...field}
                        data-testid="input-produto"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Contato & Endereço */}
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50">
            <CardHeader className="border-b border-slate-200 dark:border-slate-700">
              <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Contato & Endereço</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(11) 99999-9999"
                          {...field}
                          data-testid="input-telefone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="email@example.com"
                          {...field}
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contato"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pessoa de Contato</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Nome do contato"
                          {...field}
                          data-testid="input-contato"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="endereco"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endereço</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Rua, avenida..."
                            {...field}
                            data-testid="input-endereco"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="numero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="123"
                          {...field}
                          data-testid="input-numero"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="complemento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complemento</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Apto, sala..."
                          {...field}
                          data-testid="input-complemento"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <FormField
                    control={form.control}
                    name="cidade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="São Paulo"
                            {...field}
                            data-testid="input-cidade"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="uf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF</FormLabel>
                      <FormControl>
                        <Input
                          maxLength={2}
                          placeholder="SP"
                          {...field}
                          data-testid="input-uf"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cep"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="00000-000"
                          {...field}
                          data-testid="input-cep"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Contrato & Datas */}
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50">
            <CardHeader className="border-b border-slate-200 dark:border-slate-700">
              <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Contrato & Datas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="dataContrato"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data do Contrato</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={
                            field.value instanceof Date
                              ? field.value.toISOString().split("T")[0]
                              : field.value
                              ? new Date(field.value).toISOString().split("T")[0]
                              : ""
                          }
                          onChange={(e) =>
                            field.onChange(e.target.value ? new Date(e.target.value) : null)
                          }
                          data-testid="input-data-contrato"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="valorContrato"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor do Contrato</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0,00"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-valor-contrato"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dataUltimoContato"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Último Contato</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={
                            field.value instanceof Date
                              ? field.value.toISOString().split("T")[0]
                              : field.value
                              ? new Date(field.value).toISOString().split("T")[0]
                              : ""
                          }
                          onChange={(e) =>
                            field.onChange(e.target.value ? new Date(e.target.value) : null)
                          }
                          data-testid="input-data-ultimo-contato"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <textarea
                        placeholder="Anotações sobre o cliente..."
                        {...field}
                        className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        data-testid="textarea-observacoes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Dados Telecom */}
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50">
            <CardHeader className="border-b border-slate-200 dark:border-slate-700">
              <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Dados Telecom</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="APARELHO_LIBERADO"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aparelho Liberado</FormLabel>
                      <FormControl>
                        <Input placeholder="Aparelho" {...field} data-testid="input-aparelho" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="PEDIDO_MOVEL"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pedido Móvel</FormLabel>
                      <FormControl>
                        <Input placeholder="Pedido" {...field} data-testid="input-pedido-movel" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="M_FIXA"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>M Fixa</FormLabel>
                      <FormControl>
                        <Input placeholder="M Fixa" {...field} data-testid="input-m-fixa" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="PEDIDO_FIXA"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pedido Fixa</FormLabel>
                      <FormControl>
                        <Input placeholder="Pedido" {...field} data-testid="input-pedido-fixa" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="EMAIL_PRINCIPAL"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Principal</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@example.com" {...field} data-testid="input-email-principal" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="CELULAR_PRINCIPAL"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Celular Principal</FormLabel>
                      <FormControl>
                        <Input placeholder="(11) 99999-9999" {...field} data-testid="input-celular-principal" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="TIPO_GESTOR"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo Gestor</FormLabel>
                      <FormControl>
                        <Input placeholder="Gestor" {...field} data-testid="input-tipo-gestor" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="TELEFONE_COMERCIAL"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone Comercial</FormLabel>
                      <FormControl>
                        <Input placeholder="(11) 3333-3333" {...field} data-testid="input-telefone-comercial" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="CELULAR"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Celular</FormLabel>
                      <FormControl>
                        <Input placeholder="(11) 99999-9999" {...field} data-testid="input-celular" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="TELEFONE_RESIDENCIAL"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone Residencial</FormLabel>
                      <FormControl>
                        <Input placeholder="(11) 3333-3333" {...field} data-testid="input-telefone-residencial" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="EMAIL_SIBEL"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Sibel</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="sibel@example.com" {...field} data-testid="input-email-sibel" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="PROP_MOVEL_AVANCADA"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prop. Móvel/Avançada</FormLabel>
                      <FormControl>
                        <Input placeholder="Proposta" {...field} data-testid="input-prop-movel" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="SERASA"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serasa</FormLabel>
                      <FormControl>
                        <Input placeholder="Serasa" {...field} data-testid="input-serasa" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="MENSAGEM_SERASA"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mensagem Serasa</FormLabel>
                      <FormControl>
                        <textarea
                          placeholder="Mensagem"
                          {...field}
                          className="min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          data-testid="textarea-mensagem-serasa"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Buttons */}
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/clientes")}
              data-testid="button-cancelar"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saveMutation.isPending}
              data-testid="button-salvar-cliente"
            >
              {saveMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {isEditing ? "Atualizar" : "Criar"} Cliente
            </Button>
          </div>
        </form>
      </Form>
        </div>
      </div>
    </div>
  );
}

function ClienteFormSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96" />
        </CardContent>
      </Card>
    </div>
  );
}
