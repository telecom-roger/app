import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, CheckCircle2, Calendar, Trash2 } from "lucide-react";
import type { ClientNote } from "@shared/schema";

interface ClientNoteItemProps {
  note: ClientNote;
  clientId: string;
}

export function ClientNoteItem({ note, clientId }: ClientNoteItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [conteudo, setConteudo] = useState(note.conteudo);
  const [dataPlanejada, setDataPlanejada] = useState(
    note.createdAt ? new Date(note.createdAt).toISOString().slice(0, 16) : ""
  );
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/client-notes/${note.id}`, {
        conteudo,
        cor: note.cor,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timeline", clientId] });
      setIsEditing(false);
      toast({ title: "Sucesso", description: "Observação atualizada!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao atualizar",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/client-notes/${note.id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timeline", clientId] });
      toast({ title: "Sucesso", description: "Observação deletada!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao deletar",
        variant: "destructive",
      });
    },
  });

  const getIcon = () => {
    switch (note.cor) {
      case "bg-green-500":
        return <CheckCircle2 className="h-5 w-5" />;
      case "bg-orange-500":
        return <Calendar className="h-5 w-5" />;
      default:
        return <MessageSquare className="h-5 w-5" />;
    }
  };

  if (isEditing) {
    return (
      <Card className="hover-elevate bg-card border-border">
        <CardContent className="pt-4">
          <div className="space-y-3">
            <Textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              className="min-h-20"
              data-testid={`edit-textarea-${note.id}`}
            />
            <div>
              <label className="text-xs font-medium mb-1 block">Data</label>
              <Input
                type="datetime-local"
                value={dataPlanejada}
                onChange={(e) => setDataPlanejada(e.target.value)}
                data-testid={`edit-date-${note.id}`}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(false)}
                data-testid={`button-cancelar-${note.id}`}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                data-testid={`button-salvar-${note.id}`}
              >
                {updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className="hover-elevate bg-card border-border cursor-pointer"
      onClick={() => setIsEditing(true)}
      data-testid={`card-note-${note.id}`}
    >
      <CardContent className="pt-4">
        <div className="flex gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary flex-shrink-0">
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground mb-1">
              {new Date(note.createdAt).toLocaleString('pt-BR')}
            </p>
            <p className="text-sm font-medium break-words">{note.conteudo}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              deleteMutation.mutate();
            }}
            disabled={deleteMutation.isPending}
            data-testid={`button-delete-${note.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
