import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, CheckCircle2, Calendar, Trash2, Download } from "lucide-react";
import type { ClientNote } from "@shared/schema";

interface ClientNoteItemProps {
  note: ClientNote;
  clientId: string;
}

export function ClientNoteItem({ note, clientId }: ClientNoteItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [conteudo, setConteudo] = useState(note.conteudo);
  const [dataPlanejada, setDataPlanejada] = useState(
    note.dataPlanejada ? new Date(note.dataPlanejada).toISOString().slice(0, 16) : ""
  );
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (data: { conteudo?: string; dataPlanejada?: string }) => {
      await apiRequest("PATCH", `/api/client-notes/${note.id}`, {
        conteudo: data.conteudo ?? conteudo,
        dataPlanejada: data.dataPlanejada ? new Date(data.dataPlanejada).toISOString() : null,
        tipo: note.tipo,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timeline", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-notes", clientId] });
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

  const handleSaveField = (field: "conteudo" | "data") => {
    if (field === "conteudo" && conteudo.trim() !== note.conteudo) {
      updateMutation.mutate({ conteudo });
    } else if (field === "data" && dataPlanejada) {
      updateMutation.mutate({ dataPlanejada });
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/client-notes/${note.id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timeline", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-notes", clientId] });
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
    switch (note.tipo) {
      case "atividade":
        return <CheckCircle2 className="h-5 w-5" />;
      case "agendamento":
        return <Calendar className="h-5 w-5" />;
      case "comentario":
      default:
        return <MessageSquare className="h-5 w-5" />;
    }
  };

  if (isEditing) {
    return (
      <Card className="hover-elevate bg-card border-border">
        <CardContent className="pt-3 pb-3">
          <div className="space-y-2">
            <Textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              onBlur={() => handleSaveField("conteudo")}
              className="min-h-16 text-xs"
              data-testid={`edit-textarea-${note.id}`}
            />
            <div>
              <label className="text-xs font-medium mb-1 block">Data</label>
              <Input
                type="datetime-local"
                value={dataPlanejada}
                onChange={(e) => setDataPlanejada(e.target.value)}
                onBlur={() => handleSaveField("data")}
                className="text-xs h-8"
                data-testid={`edit-date-${note.id}`}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setConteudo(note.conteudo);
                  setDataPlanejada(note.dataPlanejada ? new Date(note.dataPlanejada).toISOString().slice(0, 16) : "");
                  setIsEditing(false);
                }}
                className="text-xs h-7"
                data-testid={`button-cancelar-${note.id}`}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  handleSaveField("conteudo");
                  setIsEditing(false);
                }}
                disabled={updateMutation.isPending}
                className="text-xs h-7"
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

  const formatTimeOnly = (date: string) => {
    return new Date(date).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(/\s/g, '');
  };

  const formatDateWithoutSeconds = (date: string) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month} ${hours}:${minutes}`;
  };

  const handleDownloadAnexo = (anexo: any) => {
    const byteCharacters = atob(anexo.conteudo_base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: anexo.tipo });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = anexo.nome;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card 
      className="hover-elevate bg-card border-border cursor-pointer"
      onClick={() => setIsEditing(true)}
      data-testid={`card-note-${note.id}`}
    >
      <CardContent className="pt-3 pb-3">
        <div className="flex gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary flex-shrink-0 text-xs">
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium break-words leading-snug">{note.conteudo}</p>
            
            {note.anexos && note.anexos.length > 0 && (
              <div className="mt-2 space-y-1">
                {(note.anexos as any[]).map((anexo, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleDownloadAnexo(anexo)}
                    className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Download className="h-3 w-3" />
                    {anexo.nome}
                  </button>
                ))}
              </div>
            )}
            
            <div className="flex justify-between items-center mt-1 gap-2 flex-wrap">
              <p className="text-[10px] text-muted-foreground">
                {formatDateWithoutSeconds(note.createdAt)}
              </p>
              {note.tipo === "agendamento" && note.dataPlanejada && (
                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                  📅 {formatDateWithoutSeconds(note.dataPlanejada)}
                </p>
              )}
            </div>
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
