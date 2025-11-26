import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { insertTemplateSchema, type Template } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { useState } from "react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export default function ModelosMensagens() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
  });

  const form = useForm({
    resolver: zodResolver(insertTemplateSchema),
    defaultValues: {
      nome: "",
      tipo: "whatsapp" as const,
      assunto: "",
      conteudo: "",
      imageUrl: "",
      variaveis: [] as string[],
      ativo: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingId) {
        return apiRequest("PATCH", `/api/templates/${editingId}`, data);
      }
      return apiRequest("POST", "/api/templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      form.reset();
      setEditingId(null);
      setOpenDialog(false);
      toast({
        title: editingId ? "Template atualizado" : "Template criado",
        description: "Seu modelo de mensagem foi salvo com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao salvar template",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/templates/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setDeleteId(null);
      toast({
        title: "Template deletado",
        description: "Seu modelo de mensagem foi removido.",
      });
    },
  });

  const handleEdit = (template: Template) => {
    setEditingId(template.id);
    form.reset({
      nome: template.nome,
      tipo: (template.tipo as "whatsapp" | "email"),
      assunto: template.assunto || "",
      conteudo: template.conteudo,
      imageUrl: template.imageUrl || "",
      variaveis: template.variaveis || [],
      ativo: template.ativo ?? true,
    });
    setOpenDialog(true);
  };

  const handleNew = () => {
    setEditingId(null);
    form.reset({
      nome: "",
      tipo: "whatsapp" as const,
      assunto: "",
      conteudo: "",
      imageUrl: "",
      variaveis: [],
      ativo: true,
    });
    setOpenDialog(true);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Modelos de Mensagens</h1>
          <p className="text-muted-foreground mt-2">
            Crie e gerencie seus modelos de mensagens para campanhas
          </p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={handleNew} data-testid="button-create-template">
              <Plus className="w-4 h-4 mr-2" />
              Novo Modelo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Modelo" : "Criar Novo Modelo"}
              </DialogTitle>
              <DialogDescription>
                Defina o título, tipo, conteúdo e imagem do seu modelo de
                mensagem
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
                      <FormLabel>Título do Modelo</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Oferta Especial"
                          {...field}
                          data-testid="input-template-name"
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
                      <FormLabel>Tipo</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-template-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {(form.watch("tipo") as string) === "email" && (
                  <FormField
                    control={form.control}
                    name="assunto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assunto (Email)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Assunto do email"
                            {...field}
                            data-testid="input-template-subject"
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
                          placeholder="Escreva sua mensagem aqui. Use {{variavel}} para campos dinâmicos"
                          className="h-32"
                          {...field}
                          data-testid="textarea-template-content"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL da Imagem (Opcional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://exemplo.com/imagem.jpg"
                          {...field}
                          data-testid="input-template-image"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-save-template"
                  >
                    {createMutation.isPending ? "Salvando..." : "Salvar Modelo"}
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

      {isLoading ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : templates.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            Nenhum modelo criado ainda. Comece criando seu primeiro modelo!
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{template.nome}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tipo: <span className="capitalize">{template.tipo}</span>
                  </p>
                  <p className="text-sm mt-3 text-foreground">{template.conteudo}</p>
                  {template.imageUrl && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Com imagem: {template.imageUrl}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEdit(template)}
                    data-testid={`button-edit-template-${template.id}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeleteId(template.id)}
                    data-testid={`button-delete-template-${template.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este modelo de mensagem? Esta ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete"
            >
              Deletar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
