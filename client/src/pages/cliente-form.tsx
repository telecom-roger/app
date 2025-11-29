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
import { Textarea } from "@/components/ui/textarea";
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
      cnpj: "",
      status: "lead",
      parceiro: "",
      tipoCliente: "",
      carteira: "",
      celular: "",
      telefone2: "",
      email: "",
      nomeGestor: "",
      emailGestor: "",
      cpfGestor: "",
      endereco: "",
      numero: "",
      bairro: "",
      cep: "",
      cidade: "",
      uf: "",
      dataUltimoPedido: "",
      observacoes: "",
      tags: [],
    },
  });

  const { data: cliente, isLoading: clienteLoading } = useQuery<Client>({
    queryKey: ["/api/clients", id],
    enabled: isEditing && isAuthenticated && !!id,
  });

  useEffect(() => {
    if (cliente && isEditing) {
      form.reset({
        nome: cliente.nome || "",
        cnpj: cliente.cnpj || "",
        status: cliente.status || "lead",
        parceiro: cliente.parceiro || "",
        tipoCliente: cliente.tipoCliente || "",
        carteira: cliente.carteira || "",
        celular: cliente.celular || "",
        telefone2: cliente.telefone2 || "",
        email: cliente.email || "",
        nomeGestor: cliente.nomeGestor || "",
        emailGestor: cliente.emailGestor || "",
        cpfGestor: cliente.cpfGestor || "",
        endereco: cliente.endereco || "",
        numero: cliente.numero || "",
        bairro: cliente.bairro || "",
        cep: cliente.cep || "",
        cidade: cliente.cidade || "",
        uf: cliente.uf || "",
        dataUltimoPedido: cliente.dataUltimoPedido || "",
        observacoes: cliente.observacoes || "",
        tags: cliente.tags || [],
      });
    }
  }, [cliente?.id, isEditing]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const normalizedData = Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
          key,
          value === "" ? null : value
        ])
      );
      normalizedData.tags = data.tags || [];
      
      if (isEditing) {
        await apiRequest("PATCH", `/api/clients/${id}`, normalizedData);
      } else {
        await apiRequest("POST", `/api/clients`, normalizedData);
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
      <div className="px-3 md:px-6 py-4 md:py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/clientes")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
              {isEditing ? "Editar Cliente" : "Novo Cliente"}
            </h1>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))}
              className="space-y-4"
            >
              <Card className="border-0 shadow-sm">
                <CardHeader className="py-3 border-b">
                  <CardTitle className="text-base font-semibold">Dados Principais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Razao Social *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome/Razao Social" {...field} data-testid="input-nome" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cnpj"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CNPJ</FormLabel>
                          <FormControl>
                            <Input placeholder="00000000000000" maxLength={14} {...field} data-testid="input-cnpj" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="parceiro"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Parceiro</FormLabel>
                          <Select value={field.value || ""} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-parceiro">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="MIRAI">MIRAI</SelectItem>
                              <SelectItem value="3M">3M</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tipoCliente"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo Cliente</FormLabel>
                          <FormControl>
                            <Input placeholder="Tipo" {...field} value={field.value || ""} data-testid="input-tipo" />
                          </FormControl>
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
                            <Input placeholder="Carteira" {...field} value={field.value || ""} data-testid="input-carteira" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="py-3 border-b">
                  <CardTitle className="text-base font-semibold">Contato</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="celular"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Celular (WhatsApp)</FormLabel>
                          <FormControl>
                            <Input placeholder="11999999999" {...field} value={field.value || ""} data-testid="input-celular" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="telefone2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone 2</FormLabel>
                          <FormControl>
                            <Input placeholder="1133334444" {...field} value={field.value || ""} data-testid="input-telefone2" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="email@empresa.com" {...field} value={field.value || ""} data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="py-3 border-b">
                  <CardTitle className="text-base font-semibold">Gestor</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="nomeGestor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Gestor</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome completo" {...field} value={field.value || ""} data-testid="input-nome-gestor" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cpfGestor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPF do Gestor</FormLabel>
                          <FormControl>
                            <Input placeholder="00000000000" maxLength={11} {...field} value={field.value || ""} data-testid="input-cpf-gestor" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="emailGestor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email do Gestor</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="gestor@empresa.com" {...field} value={field.value || ""} data-testid="input-email-gestor" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="py-3 border-b">
                  <CardTitle className="text-base font-semibold">Endereco</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                    <div className="col-span-2 md:col-span-3">
                      <FormField
                        control={form.control}
                        name="endereco"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Endereco</FormLabel>
                            <FormControl>
                              <Input placeholder="Rua, Av..." {...field} value={field.value || ""} data-testid="input-endereco" />
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
                          <FormLabel>Numero</FormLabel>
                          <FormControl>
                            <Input placeholder="123" {...field} value={field.value || ""} data-testid="input-numero" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="bairro"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bairro</FormLabel>
                          <FormControl>
                            <Input placeholder="Bairro" {...field} value={field.value || ""} data-testid="input-bairro" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cidade"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input placeholder="Cidade" {...field} value={field.value || ""} data-testid="input-cidade" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="uf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UF</FormLabel>
                          <FormControl>
                            <Input placeholder="SP" maxLength={2} {...field} value={field.value || ""} data-testid="input-uf" />
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
                            <Input placeholder="00000000" maxLength={8} {...field} value={field.value || ""} data-testid="input-cep" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="py-3 border-b">
                  <CardTitle className="text-base font-semibold">Informacoes Adicionais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="dataUltimoPedido"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Ultimo Pedido</FormLabel>
                        <FormControl>
                          <Input placeholder="DD/MM/AAAA" {...field} value={field.value || ""} data-testid="input-data-pedido" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="observacoes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observacoes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Anotacoes sobre o cliente..." 
                            className="min-h-[100px]"
                            {...field} 
                            value={field.value || ""} 
                            data-testid="input-observacoes" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <div className="flex gap-3 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/clientes")}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saveMutation.isPending}
                  data-testid="button-save"
                >
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEditing ? "Atualizar" : "Criar Cliente"}
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="px-3 md:px-6 py-4 md:py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-10 w-10 rounded" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="space-y-4 py-6">
                <Skeleton className="h-10 w-full" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="space-y-4 py-6">
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
