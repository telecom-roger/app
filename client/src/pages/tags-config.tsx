import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Trash2, Plus, Loader2, Edit2, Check, X } from "lucide-react";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState("bg-blue-500");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingColor, setEditingColor] = useState("bg-blue-500");

  const { data: tags = [], isLoading, refetch } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Etiquetas</h1>
        <p className="text-muted-foreground mt-1">
          Crie etiquetas pré-definidas e reutilize-as em seus clientes. Assim como no WhatsApp!
        </p>
      </div>

      {/* Create New Tag */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nome da Etiqueta</label>
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
            <label className="text-sm font-medium">Cor</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {TAG_COLORS.map((color) => (
                <button
                  key={color.class}
                  onClick={() => setSelectedColor(color.class)}
                  className={`w-8 h-8 rounded-full ${color.class} transition-transform ${
                    selectedColor === color.class ? "ring-2 ring-offset-2 ring-foreground scale-110" : ""
                  }`}
                  title={color.name}
                  data-testid={`button-color-${color.name.toLowerCase()}`}
                />
              ))}
            </div>
          </div>

          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending || !newTagName.trim()}
            data-testid="button-create-tag"
            className="w-full"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Criar Etiqueta
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Tags List */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Suas Etiquetas</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : tags.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              Você ainda não criou nenhuma etiqueta. Comece criando uma acima!
            </p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {tags.map((tag) => (
              <Card key={tag.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  {editingId === tag.id ? (
                    <div className="flex-1 flex items-center gap-3">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 h-8 text-sm"
                        data-testid="input-edit-tag-name"
                      />
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleSaveEdit}
                        disabled={updateMutation.isPending}
                        data-testid="button-save-tag-edit"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                        data-testid="button-cancel-tag-edit"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`w-4 h-4 rounded-full ${tag.cor}`} />
                        <span className="font-medium">{tag.nome}</span>
                      </div>
                      <div className="flex gap-2">
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
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
