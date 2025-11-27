import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Loader2, MessageSquare } from "lucide-react";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const quickReplySchema = z.object({
  conteudo: z.string().min(1, "Mensagem obrigatória").max(1000, "Máximo 1000 caracteres"),
});

type QuickReplyForm = z.infer<typeof quickReplySchema>;

interface QuickReply {
  id: string;
  conteudo: string;
  ordem: number;
}

export default function QuickRepliesConfig() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  const { data: replies = [], isLoading } = useQuery<QuickReply[]>({
    queryKey: ["/api/quick-replies"],
  });

  const form = useForm<QuickReplyForm>({
    resolver: zodResolver(quickReplySchema),
    defaultValues: { conteudo: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: QuickReplyForm) => {
      return apiRequest("POST", "/api/quick-replies", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quick-replies"] });
      form.reset();
      toast({
        title: "Mensagem adicionada",
        description: "Sua mensagem rápida foi salva com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao adicionar mensagem",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, conteudo }: { id: string; conteudo: string }) => {
      return apiRequest("PATCH", `/api/quick-replies/${id}`, { conteudo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quick-replies"] });
      setEditingId(null);
      setEditingContent("");
      toast({
        title: "Mensagem atualizada",
        description: "Sua mensagem rápida foi atualizada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao atualizar mensagem",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/quick-replies/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quick-replies"] });
      toast({
        title: "Mensagem removida",
        description: "Sua mensagem rápida foi deletada.",
      });
    },
  });

  const handleEdit = (reply: QuickReply) => {
    setEditingId(reply.id);
    setEditingContent(reply.conteudo);
  };

  const handleSaveEdit = () => {
    if (editingId && editingContent.trim()) {
      updateMutation.mutate({ id: editingId, conteudo: editingContent });
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-6 border-b bg-background">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <MessageSquare className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Mensagens Rápidas</h1>
        </div>
        <p className="text-muted-foreground">
          Defina suas mensagens pré-definidas para usar rapidamente no chat. Total: <span className="font-semibold text-foreground">{replies.length}</span> mensagens
        </p>
      </div>

      {/* Content - Two columns layout */}
      <div className="flex-1 overflow-hidden flex gap-6 p-6">
        {/* Left: Add New Message Form */}
        <div className="w-96 flex flex-col">
          <Card className="p-6 flex-1 flex flex-col">
            <h2 className="text-lg font-semibold mb-4">Adicionar Nova Mensagem</h2>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="flex flex-col flex-1 space-y-4">
                <FormField
                  control={form.control}
                  name="conteudo"
                  render={({ field }) => (
                    <FormItem className="flex-1 flex flex-col">
                      <FormLabel>Mensagem</FormLabel>
                      <FormControl className="flex-1">
                        <Textarea
                          placeholder="Digite sua mensagem rápida..."
                          className="resize-none flex-1"
                          rows={8}
                          {...field}
                          data-testid="input-new-quick-reply"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-add-quick-reply"
                  className="w-full"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Adicionar Mensagem
                </Button>
              </form>
            </Form>
          </Card>
        </div>

        {/* Right: Messages List */}
        <div className="flex-1 flex flex-col min-w-0">
          <Card className="p-6 flex-1 flex flex-col overflow-hidden">
            <h2 className="text-lg font-semibold mb-4">Suas Mensagens</h2>
            
            {isLoading ? (
              <div className="flex items-center justify-center flex-1">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : replies.length === 0 ? (
              <div className="flex items-center justify-center flex-1">
                <p className="text-center text-muted-foreground">
                  Você ainda não tem mensagens rápidas configuradas
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {replies.map((reply: QuickReply) => (
                  <div
                    key={reply.id}
                    className="p-4 rounded-lg border border-border bg-muted/30 hover-elevate transition-all"
                    data-testid={`reply-item-${reply.id}`}
                  >
                    {editingId === reply.id ? (
                      <div className="space-y-3">
                        <Textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="resize-none"
                          rows={3}
                          data-testid="input-edit-quick-reply"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleSaveEdit}
                            disabled={updateMutation.isPending}
                            data-testid="button-save-quick-reply"
                          >
                            {updateMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Salvar"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(null);
                              setEditingContent("");
                            }}
                            data-testid="button-cancel-quick-reply"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-foreground break-words leading-relaxed mb-3">
                          {reply.conteudo}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(reply)}
                            data-testid={`button-edit-quick-reply-${reply.id}`}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(reply.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-quick-reply-${reply.id}`}
                          >
                            {deleteMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
