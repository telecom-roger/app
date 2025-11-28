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

    mutation.mutate({
      tipo,
      conteudo,
      dataPlanejada: dataPlanejada ? new Date(dataPlanejada).toISOString() : null,
      cor: "bg-blue-500",
    });
  };

  const handleCancel = () => {
    setConteudo("");
    setDataPlanejada("");
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="pt-6">
        <Tabs value={tipo} onValueChange={setTipo} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="comentario" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Comentário
            </TabsTrigger>
            <TabsTrigger value="atividade" className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Atividade
            </TabsTrigger>
            <TabsTrigger value="agendamento" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Agendamento
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comentario" className="space-y-4 mt-4">
            <Textarea
              placeholder="Adicione um comentário..."
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              className="min-h-24"
              data-testid="textarea-comentario"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCancel} data-testid="button-cancelar">
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={mutation.isPending} data-testid="button-salvar-comentario">
                {mutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="atividade" className="space-y-4 mt-4">
            <Textarea
              placeholder="Descreva a atividade..."
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              className="min-h-24"
              data-testid="textarea-atividade"
            />
            <div>
              <label className="text-sm font-medium mb-2 block">Data da Atividade</label>
              <Input
                type="datetime-local"
                value={dataPlanejada}
                onChange={(e) => setDataPlanejada(e.target.value)}
                data-testid="input-data-atividade"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCancel} data-testid="button-cancelar">
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={mutation.isPending} data-testid="button-salvar-atividade">
                {mutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="agendamento" className="space-y-4 mt-4">
            <Textarea
              placeholder="Descreva o agendamento..."
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              className="min-h-24"
              data-testid="textarea-agendamento"
            />
            <div>
              <label className="text-sm font-medium mb-2 block">Data e Hora</label>
              <Input
                type="datetime-local"
                value={dataPlanejada}
                onChange={(e) => setDataPlanejada(e.target.value)}
                data-testid="input-data-agendamento"
              />
            </div>
            <div className="flex gap-2 justify-between">
              <Button size="icon" variant="ghost" data-testid="button-anexar-arquivo">
                <Plus className="h-4 w-4" />
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCancel} data-testid="button-cancelar">
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={mutation.isPending} data-testid="button-salvar-agendamento">
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
