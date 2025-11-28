import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, CheckCircle2, Calendar, Plus } from "lucide-react";

interface AddClientNoteProps {
  clientId: string;
}

export function AddClientNote({ clientId }: AddClientNoteProps) {
  const [tipo, setTipo] = useState<string>("comentario");
  const [conteudo, setConteudo] = useState("");
  const [dataPlanejada, setDataPlanejada] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", `/api/client-notes/${clientId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-notes", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/timeline", clientId] });
      setConteudo("");
      setDataPlanejada("");
      toast({
        title: "Sucesso",
        description: "Observação adicionada!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao adicionar nota",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!conteudo.trim()) {
      toast({
        title: "Erro",
        description: "Descrição é obrigatória",
        variant: "destructive",
      });
      return;
    }

    if ((tipo === "atividade" || tipo === "agendamento") && !dataPlanejada) {
      toast({
        title: "Erro",
        description: "Data é obrigatória para " + (tipo === "atividade" ? "atividade" : "agendamento"),
        variant: "destructive",
      });
      return;
    }

    mutation.mutate({
      tipo: tipo as "comentario" | "atividade" | "agendamento",
      conteudo,
      dataPlanejada: dataPlanejada ? new Date(dataPlanejada).toISOString() : null,
    });
  };

  const handleCancel = () => {
    setConteudo("");
    setDataPlanejada("");
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="pt-4 pb-4">
        <Tabs value={tipo} onValueChange={setTipo} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="comentario" className="flex items-center gap-1 text-xs">
              <MessageSquare className="h-3 w-3" />
              <span className="hidden sm:inline">Comentário</span>
            </TabsTrigger>
            <TabsTrigger value="atividade" className="flex items-center gap-1 text-xs">
              <CheckCircle2 className="h-3 w-3" />
              <span className="hidden sm:inline">Atividade</span>
            </TabsTrigger>
            <TabsTrigger value="agendamento" className="flex items-center gap-1 text-xs">
              <Calendar className="h-3 w-3" />
              <span className="hidden sm:inline">Agendamento</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comentario" className="space-y-2 mt-3">
            <Textarea
              placeholder="Adicione um comentário..."
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              className="min-h-20 text-xs"
              data-testid="textarea-comentario"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleCancel} className="text-xs h-7" data-testid="button-cancelar">
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={mutation.isPending} className="text-xs h-7" data-testid="button-salvar-comentario">
                {mutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="atividade" className="space-y-2 mt-3">
            <Textarea
              placeholder="Descreva a atividade..."
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              className="min-h-20 text-xs"
              data-testid="textarea-atividade"
            />
            <div>
              <label className="text-xs font-medium mb-1 block">Data da Atividade</label>
              <Input
                type="datetime-local"
                value={dataPlanejada}
                onChange={(e) => setDataPlanejada(e.target.value)}
                className="text-xs h-8"
                data-testid="input-data-atividade"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleCancel} className="text-xs h-7" data-testid="button-cancelar">
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={mutation.isPending} className="text-xs h-7" data-testid="button-salvar-atividade">
                {mutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="agendamento" className="space-y-2 mt-3">
            <Textarea
              placeholder="Descreva o agendamento..."
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              className="min-h-20 text-xs"
              data-testid="textarea-agendamento"
            />
            <div>
              <label className="text-xs font-medium mb-1 block">Data e Hora</label>
              <Input
                type="datetime-local"
                value={dataPlanejada}
                onChange={(e) => setDataPlanejada(e.target.value)}
                className="text-xs h-8"
                data-testid="input-data-agendamento"
              />
            </div>
            <div className="flex gap-2 justify-between">
              <Button size="icon" variant="ghost" className="h-7 w-7" data-testid="button-anexar-arquivo">
                <Plus className="h-3 w-3" />
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel} className="text-xs h-7" data-testid="button-cancelar">
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSave} disabled={mutation.isPending} className="text-xs h-7" data-testid="button-salvar-agendamento">
                  {mutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
