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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, MessageSquare, ArrowLeft } from "lucide-react";
import { insertCampaignSchema } from "@shared/schema";

const novaCampaignSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  tipo: z.enum(["email", "whatsapp"]),
  templateId: z.string().min(1, "Selecione um template"),
  status: z.enum(["rascunho", "agendada"]).default("rascunho"),
  agendadaPara: z.string().optional(),
  filtros: z.object({
    status: z.string().optional(),
    carteira: z.string().optional(),
  }).default({}),
});

type NovaCampaignForm = z.infer<typeof novaCampaignSchema>;

export default function CampanhaNova() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [preview, setPreview] = useState<string>("");

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  const form = useForm<NovaCampaignForm>({
    resolver: zodResolver(novaCampaignSchema),
    defaultValues: {
      nome: "",
      tipo: "email",
      templateId: "",
      status: "rascunho",
      filtros: {},
    },
  });

  const { data: templates } = useQuery({
    queryKey: ["/api/templates"],
    enabled: isAuthenticated,
  });

  const { data: selectedTemplate } = useQuery({
    queryKey: ["/api/templates", form.watch("templateId")],
    enabled: !!form.watch("templateId"),
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (data: NovaCampaignForm) => {
      const campaignData = {
        nome: data.nome,
        tipo: data.tipo,
        templateId: data.templateId,
        status: data.status,
        agendadaPara: data.agendadaPara ? new Date(data.agendadaPara).toISOString() : null,
        filtros: data.filtros,
        totalRecipients: 0,
      };
      await apiRequest("POST", "/api/campaigns", campaignData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Sucesso",
        description: "Campanha criada com sucesso",
      });
      setLocation("/campanhas");
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível criar a campanha",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: NovaCampaignForm) => {
    createCampaignMutation.mutate(data);
  };

  const tipoAtual = form.watch("tipo");
  const templateSelecionado = (templates as any[])?.find((t: any) => t.id === form.watch("templateId"));

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/campanhas")}
          data-testid="button-voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Nova Campanha</h1>
          <p className="text-muted-foreground mt-1">
            Crie uma campanha de comunicação para seus clientes
          </p>
        </div>
      </div>

      <Tabs defaultValue="configuracao" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="configuracao">Configuração</TabsTrigger>
          <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="configuracao" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>
                Configure os detalhes essenciais da campanha
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form className="space-y-6">
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Campanha</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: Campanha de Upgrade Móvel - Nov"
                            {...field}
                            data-testid="input-nome-campanha"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="tipo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Comunicação</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-tipo-campanha">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="email">
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4" />
                                  Email
                                </div>
                              </SelectItem>
                              <SelectItem value="whatsapp">
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4" />
                                  WhatsApp
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="templateId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-template">
                                <SelectValue placeholder="Selecione um template" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(templates as any[])
                                ?.filter((t: any) => t.tipo === tipoAtual)
                                .map((template: any) => (
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
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="font-semibold mb-4">Agendamento</h3>
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem className="mb-4">
                          <FormLabel>Quando enviar?</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="rascunho">Salvar como rascunho</SelectItem>
                              <SelectItem value="agendada">Agendar para depois</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch("status") === "agendada" && (
                      <FormField
                        control={form.control}
                        name="agendadaPara"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data e Hora</FormLabel>
                            <FormControl>
                              <Input
                                type="datetime-local"
                                {...field}
                                data-testid="input-agendamento"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conteudo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Conteúdo da Campanha</CardTitle>
              <CardDescription>
                {templateSelecionado
                  ? `Usando template: ${templateSelecionado.nome}`
                  : "Selecione um template na aba anterior"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {templateSelecionado ? (
                <div className="space-y-4">
                  {tipoAtual === "email" && templateSelecionado.assunto && (
                    <div>
                      <label className="text-sm font-medium">Assunto</label>
                      <div className="bg-muted p-3 rounded mt-2 text-sm font-mono break-words">
                        {templateSelecionado.assunto}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium">Conteúdo</label>
                    <div className="bg-muted p-3 rounded mt-2 text-sm break-words whitespace-pre-wrap">
                      {templateSelecionado.conteudo}
                    </div>
                  </div>
                  {templateSelecionado.variaveis && templateSelecionado.variaveis.length > 0 && (
                    <div>
                      <label className="text-sm font-medium">Variáveis disponíveis</label>
                      <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded mt-2 text-sm">
                        {templateSelecionado.variaveis.map((v: any) => (
                          <code key={v} className="block text-blue-600 dark:text-blue-400">
                            {`{{${v}}}`}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Nenhum template selecionado</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Preview da Campanha</CardTitle>
            </CardHeader>
            <CardContent>
              {templateSelecionado ? (
                <div className="bg-muted p-6 rounded-lg">
                  {tipoAtual === "email" ? (
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground">DE:</p>
                        <p className="font-medium">{user?.email}</p>
                      </div>
                      {templateSelecionado.assunto && (
                        <div>
                          <p className="text-xs text-muted-foreground">ASSUNTO:</p>
                          <p className="font-medium">{templateSelecionado.assunto}</p>
                        </div>
                      )}
                      <div className="border-t pt-4">
                        <p className="text-xs text-muted-foreground mb-2">CONTEÚDO:</p>
                        <div className="text-sm whitespace-pre-wrap break-words">
                          {templateSelecionado.conteudo}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Mensagem WhatsApp:</p>
                      <div className="bg-green-50 dark:bg-green-950 p-4 rounded text-sm break-words whitespace-pre-wrap">
                        {templateSelecionado.conteudo}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Selecione um template para ver o preview</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button
          variant="outline"
          onClick={() => setLocation("/campanhas")}
          disabled={createCampaignMutation.isPending}
          data-testid="button-cancelar"
        >
          Cancelar
        </Button>
        <Button
          onClick={form.handleSubmit(onSubmit)}
          disabled={createCampaignMutation.isPending}
          data-testid="button-criar-campanha"
        >
          {createCampaignMutation.isPending ? "Criando..." : "Criar Campanha"}
        </Button>
      </div>
    </div>
  );
}
