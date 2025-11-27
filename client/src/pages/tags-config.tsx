import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Plus, Loader2, Edit2, Check, X, Tag, Palette } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface Tag {
  id: string;
  nome: string;
  cor: string;
  createdAt: string;
}

const TAG_COLORS = [
  { name: "Azul", class: "bg-blue-500", hex: "#3b82f6" },
  { name: "Roxo", class: "bg-purple-500", hex: "#a855f7" },
  { name: "Verde", class: "bg-green-500", hex: "#22c55e" },
  { name: "Vermelho", class: "bg-red-500", hex: "#ef4444" },
  { name: "Amarelo", class: "bg-yellow-500", hex: "#eab308" },
  { name: "Laranja", class: "bg-orange-500", hex: "#f97316" },
  { name: "Rosa", class: "bg-pink-500", hex: "#ec4899" },
  { name: "Cinza", class: "bg-gray-500", hex: "#6b7280" },
];

export default function TagsConfig() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState("bg-blue-500");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingColor, setEditingColor] = useState("bg-blue-500");
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

  const { data: tags = [], isLoading, refetch } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/tags", {
        nome: newTagName,
        cor: selectedColor,
      });
    },
    onSuccess: () => {
      refetch();
      setNewTagName("");
      setSelectedColor("bg-blue-500");
      setShowForm(false);
      toast({
        title: "Etiqueta criada",
        description: "Sua etiqueta foi criada com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar etiqueta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, nome, cor }: { id: string; nome: string; cor: string }) => {
      return apiRequest("PATCH", `/api/tags/${id}`, { nome, cor });
    },
    onSuccess: () => {
      refetch();
      setEditingId(null);
      setEditingName("");
      toast({
        title: "Etiqueta atualizada",
        description: "Sua etiqueta foi atualizada com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar etiqueta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/tags/${id}`, {});
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Etiqueta removida",
        description: "Sua etiqueta foi deletada",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover etiqueta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!newTagName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, digite um nome para a etiqueta",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate();
  };

  const handleStartEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditingName(tag.nome);
    setEditingColor(tag.cor);
  };

  const handleSaveEdit = () => {
    if (!editingName.trim() || !editingId) return;
    updateMutation.mutate({
      id: editingId,
      nome: editingName,
      cor: editingColor,
    });
  };

  if (authLoading || !isAuthenticated) {
    return <TagsSkeleton />;
  }

  const uniqueColors = new Set(tags.map(tag => tag.cor)).size;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header Section */}
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-purple-500/10 rounded-xl">
                  <Tag className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
                  Etiquetas
                </h1>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mt-2">
                Crie e organize suas etiquetas pré-definidas para reutilizar em clientes
              </p>
            </div>
            <Button 
              onClick={() => setShowForm(!showForm)}
              className="bg-purple-600 hover:bg-purple-700 text-white" 
              data-testid="button-create-tag"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Etiqueta
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
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total de Etiquetas</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{tags.length}</p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <Tag className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Cores Usadas</p>
                  <p className="text-3xl font-bold text-pink-600 dark:text-pink-400 mt-2">{uniqueColors}</p>
                </div>
                <div className="p-3 bg-pink-500/10 rounded-lg">
                  <Palette className="h-6 w-6 text-pink-600 dark:text-pink-400" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Disponíveis</p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">{TAG_COLORS.length}</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Loader2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </Card>
          </div>

          {/* Create New Tag Form */}
          {showForm && (
            <Card className="p-6 border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Criar Nova Etiqueta</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-900 dark:text-slate-100">Nome da Etiqueta</label>
                  <Input
                    placeholder="Ex: Cliente VIP"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleCreate()}
                    data-testid="input-tag-name"
                    className="mt-2"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-900 dark:text-slate-100">Cor</label>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {TAG_COLORS.map((color) => (
                      <button
                        key={color.class}
                        onClick={() => setSelectedColor(color.class)}
                        className={`w-8 h-8 rounded-full ${color.class} transition-transform hover-elevate ${
                          selectedColor === color.class ? "ring-2 ring-offset-2 ring-foreground scale-110" : ""
                        }`}
                        title={color.name}
                        data-testid={`button-color-${color.name.toLowerCase()}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleCreate}
                    disabled={createMutation.isPending || !newTagName.trim()}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Criar
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setNewTagName("");
                      setSelectedColor("bg-blue-500");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Tags Table */}
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Nome</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider">Cor</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-100 font-semibold text-xs uppercase tracking-wider text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      </TableRow>
                    ))
                  ) : tags && tags.length > 0 ? (
                    tags.map((tag) => (
                      <TableRow 
                        key={tag.id}
                        className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                        data-testid={`tag-item-${tag.id}`}
                      >
                        <TableCell>
                          {editingId === tag.id ? (
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="h-9 text-sm"
                              data-testid="input-edit-tag-name"
                            />
                          ) : (
                            <span className="font-medium text-slate-900 dark:text-white">{tag.nome}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === tag.id ? (
                            <div className="flex gap-2">
                              {TAG_COLORS.map((color) => (
                                <button
                                  key={color.class}
                                  onClick={() => setEditingColor(color.class)}
                                  className={`w-6 h-6 rounded-full ${color.class} transition-transform ${
                                    editingColor === color.class ? "ring-2 ring-offset-1 ring-foreground scale-110" : ""
                                  }`}
                                  data-testid={`button-edit-color-${color.name.toLowerCase()}`}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded-full ${tag.cor}`} />
                              <span className="text-xs text-slate-600 dark:text-slate-400">
                                {TAG_COLORS.find(c => c.class === tag.cor)?.name || tag.cor}
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            {editingId === tag.id ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleSaveEdit}
                                  disabled={updateMutation.isPending}
                                  data-testid="button-save-tag-edit"
                                >
                                  <Check className="h-4 w-4 text-emerald-600" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingId(null)}
                                  data-testid="button-cancel-tag-edit"
                                >
                                  <X className="h-4 w-4 text-red-600" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleStartEdit(tag)}
                                  data-testid={`button-edit-tag-${tag.id}`}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteMutation.mutate(tag.id)}
                                  disabled={deleteMutation.isPending}
                                  data-testid={`button-delete-tag-${tag.id}`}
                                >
                                  {deleteMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-12">
                        <div className="text-slate-500 dark:text-slate-400">
                          <Tag className="h-12 w-12 mx-auto mb-3 opacity-40" />
                          <p className="font-medium">Nenhuma etiqueta criada</p>
                          <p className="text-sm mt-1">
                            Crie sua primeira etiqueta para começar a organizar seus clientes
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

function TagsSkeleton() {
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
