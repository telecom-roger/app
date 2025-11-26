import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Loader2 } from "lucide-react";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mensagens Rápidas</h1>
        <p className="text-muted-foreground mt-1">
          Defina suas mensagens pré-definidas para usar rapidamente no chat
        </p>
      </div>

      {/* Add New Reply */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Adicionar Nova Mensagem</h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="conteudo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mensagem</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Digite sua mensagem rápida..."
                      className="resize-none"
                      rows={3}
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

      {/* Replies List */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Suas Mensagens ({replies.length})</h2>
        {isLoading ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : replies.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Você ainda não tem mensagens rápidas configuradas
          </p>
        ) : (
          <div className="space-y-2">
            {replies.map((reply: QuickReply) => (
              <div
                key={reply.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
                data-testid={`reply-item-${reply.id}`}
              >
                {editingId === reply.id ? (
                  <div className="flex-1 space-y-2">
                    <Textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="resize-none"
                      rows={2}
                      data-testid="input-edit-quick-reply"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={updateMutation.isPending}
                        data-testid="button-save-quick-reply"
                      >
                        Salvar
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
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground break-words">{reply.conteudo}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
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
  );
}
