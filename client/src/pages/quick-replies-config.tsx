import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Plus, Loader2, MessageSquare, Edit, Clock } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [showForm, setShowForm] = useState(false);

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

  const { data: replies = [], isLoading } = useQuery<QuickReply[]>({
    queryKey: ["/api/quick-replies"],
    enabled: isAuthenticated,
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
      setShowForm(false);
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

  if (authLoading || !isAuthenticated) {
    return <QuickRepliesSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header Section */}
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-emerald-500/10 rounded-xl">
                  <MessageSquare className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
                  Mensagens Rápidas
                </h1>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mt-2">
                Gerencie suas mensagens pré-definidas para usar rapidamente no chat
              </p>
            </div>
            <Button 
              onClick={() => setShowForm(!showForm)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white" 
              data-testid="button-add-quick-reply"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Mensagem
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 pb-12">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total de Mensagens</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{replies.length}</p>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-lg">
                  <MessageSquare className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Disponíveis</p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">{replies.length}</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Loader2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Em Edição</p>
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2">{editingId ? 1 : 0}</p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </Card>
          </div>

          {/* Add New Reply Form */}
          {showForm && (
            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Adicionar Nova Mensagem</h2>
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
                            rows={4}
                            {...field}
                            data-testid="input-new-quick-reply"
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
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {createMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Adicionar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowForm(false);
                        form.reset();
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </Form>
            </Card>
          )}

          {/* Messages Table */}
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Mensagem</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                        <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      </TableRow>
                    ))
                  ) : replies && replies.length > 0 ? (
                    replies.map((reply: QuickReply) => (
                      <TableRow 
                        key={reply.id}
                        className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                        data-testid={`reply-item-${reply.id}`}
                      >
                        <TableCell>
                          {editingId === reply.id ? (
                            <div className="space-y-2">
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
                                  className="bg-emerald-600 hover:bg-emerald-700"
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
                            <p className="text-sm text-slate-700 dark:text-slate-300 break-words max-w-2xl">
                              {reply.conteudo}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(reply)}
                              data-testid={`button-edit-quick-reply-${reply.id}`}
                            >
                              <Edit className="h-4 w-4" />
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
                                <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-12">
                        <div className="text-slate-500 dark:text-slate-400">
                          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-40" />
                          <p className="font-medium">Nenhuma mensagem criada</p>
                          <p className="text-sm mt-1">
                            Crie sua primeira mensagem rápida para começar
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QuickRepliesSkeleton() {
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
                <Skeleton className="h-20 w-full" />
              </Card>
            ))}
          </div>
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50">
            <div className="p-6">
              <Skeleton className="h-64 w-full" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
