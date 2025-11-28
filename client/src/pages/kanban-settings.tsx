import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, GripVertical } from "lucide-react";
import type { KanbanStage } from "@shared/schema";

export default function KanbanSettings() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: stages = [], isLoading } = useQuery<KanbanStage[]>({
    queryKey: ["/api/kanban-stages"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; titulo: string; descricao?: string; ordem: number }) => {
      const res = await apiRequest("PUT", `/api/kanban-stages/${data.id}`, {
        titulo: data.titulo,
        descricao: data.descricao,
        ordem: data.ordem,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban-stages"] });
      toast({ title: "Sucesso", description: "Estágio atualizado!" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (titulo: string) => {
      const res = await apiRequest("POST", "/api/kanban-stages", {
        titulo,
        ordem: (stages?.length || 0) + 1,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban-stages"] });
      toast({ title: "Sucesso", description: "Estágio criado!" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/kanban-stages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban-stages"] });
      toast({ title: "Sucesso", description: "Estágio removido!" });
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/oportunidades")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Configurar Kanban</h1>
        </div>

        {/* Add New Stage */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Novo Estágio</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.querySelector("input") as HTMLInputElement;
                if (input?.value.trim()) {
                  createMutation.mutate(input.value.trim());
                  input.value = "";
                }
              }}
            >
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do estágio (ex: Lead, Proposta, etc)"
                  className="text-sm"
                  data-testid="input-new-stage"
                />
                <Button type="submit" size="sm" data-testid="button-add-stage">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Stages List */}
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))
          ) : stages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum estágio configurado
            </div>
          ) : (
            stages
              .sort((a, b) => a.ordem - b.ordem)
              .map((stage) => (
                <StageCard
                  key={stage.id}
                  stage={stage}
                  onUpdate={(data) => updateMutation.mutate({ ...data, id: stage.id })}
                  onDelete={() => deleteMutation.mutate(stage.id)}
                  isUpdating={updateMutation.isPending}
                  isDeleting={deleteMutation.isPending}
                />
              ))
          )}
        </div>
      </div>
    </div>
  );
}

function StageCard({
  stage,
  onUpdate,
  onDelete,
  isUpdating,
  isDeleting,
}: {
  stage: KanbanStage;
  onUpdate: (data: { titulo: string; descricao?: string; ordem: number }) => void;
  onDelete: () => void;
  isUpdating: boolean;
  isDeleting: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [titulo, setTitulo] = useState(stage.titulo);
  const [descricao, setDescricao] = useState(stage.descricao || "");

  const handleSave = () => {
    if (titulo.trim()) {
      onUpdate({ titulo: titulo.trim(), descricao: descricao.trim() || undefined, ordem: stage.ordem });
      setIsEditing(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm hover-elevate">
      <CardContent className="pt-4">
        {!isEditing ? (
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setIsEditing(true)}>
              <h3 className="font-semibold text-sm" data-testid={`text-stage-title-${stage.id}`}>
                {stage.titulo}
              </h3>
              {stage.descricao && (
                <p className="text-xs text-muted-foreground mt-1">{stage.descricao}</p>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete()}
              disabled={isDeleting}
              data-testid={`button-delete-stage-${stage.id}`}
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Nome do estágio"
              className="text-sm"
              data-testid={`input-edit-stage-${stage.id}`}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setIsEditing(false);
              }}
            />
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição (opcional)"
              className="text-xs min-h-16"
            />
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(false)}
                data-testid="button-cancel-edit"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isUpdating}
                data-testid="button-save-stage"
              >
                Salvar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
