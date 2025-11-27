import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Mail, MessageSquare, Trash2 } from "lucide-react";
import { insertTemplateSchema } from "@shared/schema";

export default function AdminTemplates() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [showNovoTemplate, setShowNovoTemplate] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setTimeout(() => (window.location.href = "/api/login"), 500);
    }
    if (!authLoading && isAuthenticated && user?.role !== "admin") {
      window.location.href = "/";
    }
  }, [isAuthenticated, authLoading, user]);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["/api/templates"],
    enabled: isAuthenticated && user?.role === "admin",
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/templates/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Sucesso", description: "Template excluído" });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir",
        variant: "destructive",
      });
    },
  });

  if (authLoading || !isAuthenticated || user?.role !== "admin") {
    return <AdminTemplatesSkeleton />;
  }

  const totalTemplates = templates?.length || 0;
  const emailTemplates = templates?.filter((t: any) => t.tipo === "email").length || 0;
  const whatsappTemplates = templates?.filter((t: any) => t.tipo === "whatsapp").length || 0;
  const activeTemplates = templates?.filter((t: any) => t.ativo).length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header Section */}
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
              Modelos de Mensagens
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Gerencie templates de email e WhatsApp para suas campanhas
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 pb-12">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 overflow-hidden hover-elevate">
              <div className="px-6 py-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">Total de Templates</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{totalTemplates}</p>
              </div>
            </Card>

            <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 overflow-hidden hover-elevate">
              <div className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">Templates Email</p>
                </div>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{emailTemplates}</p>
              </div>
            </Card>

            <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 overflow-hidden hover-elevate">
              <div className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">Templates WhatsApp</p>
                </div>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">{whatsappTemplates}</p>
              </div>
            </Card>

            <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 overflow-hidden hover-elevate">
              <div className="px-6 py-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">Modelos Ativos</p>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{activeTemplates}</p>
              </div>
            </Card>
          </div>

          {/* Table Card */}
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 overflow-hidden">
            <div className="px-6 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Lista de Modelos</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {totalTemplates} modelo{totalTemplates !== 1 ? 's' : ''} registrado{totalTemplates !== 1 ? 's' : ''}
                  </p>
                </div>
                <Button
                  onClick={() => setShowNovoTemplate(true)}
                  data-testid="button-novo-template"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Modelo
                </Button>
              </div>
            </div>

            <div className="px-6 pb-6 mt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 dark:border-slate-700">
                      <TableHead className="text-slate-900 dark:text-slate-100">Nome</TableHead>
                      <TableHead className="text-slate-900 dark:text-slate-100">Tipo</TableHead>
                      <TableHead className="text-slate-900 dark:text-slate-100">Status</TableHead>
                      <TableHead className="text-slate-900 dark:text-slate-100">Variáveis</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i} className="border-slate-200 dark:border-slate-700">
                            {[...Array(5)].map((_, j) => (
                              <TableCell key={j}>
                                <Skeleton className="h-4 w-20" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      : templates && templates.length > 0
                      ? templates.map((template: any) => (
                          <TableRow
                            key={template.id}
                            className="border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                            data-testid={`row-template-${template.id}`}
                          >
                            <TableCell className="font-medium text-slate-900 dark:text-white">
                              {template.nome}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-slate-900 dark:text-slate-100">
                                {template.tipo === "email" ? (
                                  <>
                                    <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    Email
                                  </>
                                ) : (
                                  <>
                                    <MessageSquare className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    WhatsApp
                                  </>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={template.ativo ? "default" : "secondary"}>
                                {template.ativo ? "Ativo" : "Inativo"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                              {template.variaveis?.length || 0} variáveis
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteTemplateMutation.mutate(template.id)}
                                data-testid={`button-delete-${template.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      : (
                        <TableRow className="border-slate-200 dark:border-slate-700">
                          <TableCell colSpan={5} className="text-center py-12">
                            <p className="text-slate-600 dark:text-slate-400">Nenhum modelo criado</p>
                          </TableCell>
                        </TableRow>
                      )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <NovoTemplateDialog open={showNovoTemplate} onOpenChange={setShowNovoTemplate} />
    </div>
  );
}

function AdminTemplatesSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
      </div>
      <div className="px-6 pb-12">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    </div>
  );
}

function NovoTemplateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const form = useForm({
    resolver: zodResolver(insertTemplateSchema),
    defaultValues: {
      nome: "",
      tipo: "email",
      assunto: "",
      conteudo: "",
      variaveis: [],
      ativo: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Sucesso", description: "Template criado com sucesso" });
      form.reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível criar o template",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo Modelo de Mensagem</DialogTitle>
          <DialogDescription>
            Crie um novo modelo para campanhas de email ou WhatsApp com suporte a variáveis dinâmicas
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Modelo</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Bem-vindas aos novos clientes"
                      {...field}
                      data-testid="input-template-nome"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Mensagem</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-template-tipo">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("tipo") === "email" && (
              <FormField
                control={form.control}
                name="assunto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assunto do Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Bem-vindo ao nosso serviço! Use {{nome}} para variáveis"
                        {...field}
                        data-testid="input-template-assunto"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="conteudo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conteúdo da Mensagem</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Use {{nome}}, {{email}}, {{telefone}}, etc para inserir variáveis dinâmicas"
                      rows={6}
                      {...field}
                      data-testid="textarea-template-conteudo"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createMutation.isPending}
                data-testid="button-cancelar-template"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-criar-template"
              >
                {createMutation.isPending ? "Criando..." : "Criar Modelo"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
