import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, CheckCircle2, Calendar, Plus, Paperclip, X } from "lucide-react";

interface Anexo {
  nome: string;
  tipo: string;
  conteudo_base64: string;
}

interface AddClientNoteProps {
  clientId: string;
}

export function AddClientNote({ clientId }: AddClientNoteProps) {
  const [tipo, setTipo] = useState<string>("comentario");
  const [conteudo, setConteudo] = useState("");
  const [dataPlanejada, setDataPlanejada] = useState("");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          const conteudo_base64 = base64.split(",")[1] || base64;
          setAnexos((prev) => [...prev, {
            nome: file.name,
            tipo: file.type,
            conteudo_base64,
          }]);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        toast({ title: "Erro", description: "Falha ao processar arquivo", variant: "destructive" });
      }
    }
    e.currentTarget.value = "";
  };

  const resetFileInput = () => {
    const input = document.getElementById("file-input-comentario") as HTMLInputElement;
    if (input) input.value = "";
  };

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", `/api/client-notes/${clientId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-notes", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/timeline", clientId] });
      setConteudo("");
      setDataPlanejada("");
      setAnexos([]);
      resetFileInput();
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
      anexos: anexos.length > 0 ? anexos : undefined,
    });
  };

  const handleCancel = () => {
    setConteudo("");
    setDataPlanejada("");
    setAnexos([]);
    resetFileInput();
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
            
            {anexos.length > 0 && (
              <div className="bg-muted p-2 rounded text-xs space-y-1">
                <p className="font-medium">Anexos:</p>
                {anexos.map((anexo, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 bg-background p-1 rounded">
                    <span className="truncate">{anexo.nome}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5"
                      onClick={() => setAnexos(anexos.filter((_, i) => i !== idx))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 justify-between">
              <div className="flex gap-1">
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-input-comentario"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById("file-input-comentario")?.click()}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Paperclip className="h-3 w-3" />
                  <span>Anexar</span>
                </button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { handleCancel(); resetFileInput(); }} className="text-xs h-7" data-testid="button-cancelar">
                  Cancelar
                </Button>
                <Button size="sm" onClick={() => { handleSave(); resetFileInput(); }} disabled={mutation.isPending} className="text-xs h-7" data-testid="button-salvar-comentario">
                  {mutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
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
            
            {anexos.length > 0 && (
              <div className="bg-muted p-2 rounded text-xs space-y-1">
                <p className="font-medium">Anexos:</p>
                {anexos.map((anexo, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 bg-background p-1 rounded">
                    <span className="truncate">{anexo.nome}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5"
                      onClick={() => setAnexos(anexos.filter((_, i) => i !== idx))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 justify-between">
              <div className="flex gap-1">
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-input-atividade"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById("file-input-atividade")?.click()}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Paperclip className="h-3 w-3" />
                  <span>Anexar</span>
                </button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { handleCancel(); resetFileInput(); }} className="text-xs h-7" data-testid="button-cancelar">
                  Cancelar
                </Button>
                <Button size="sm" onClick={() => { handleSave(); resetFileInput(); }} disabled={mutation.isPending} className="text-xs h-7" data-testid="button-salvar-atividade">
                  {mutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
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
            
            {anexos.length > 0 && (
              <div className="bg-muted p-2 rounded text-xs space-y-1">
                <p className="font-medium">Anexos:</p>
                {anexos.map((anexo, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 bg-background p-1 rounded">
                    <span className="truncate">{anexo.nome}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5"
                      onClick={() => setAnexos(anexos.filter((_, i) => i !== idx))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 justify-between">
              <div className="flex gap-1">
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-input-agendamento"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById("file-input-agendamento")?.click()}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Paperclip className="h-3 w-3" />
                  <span>Anexar</span>
                </button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { handleCancel(); resetFileInput(); }} className="text-xs h-7" data-testid="button-cancelar">
                  Cancelar
                </Button>
                <Button size="sm" onClick={() => { handleSave(); resetFileInput(); }} disabled={mutation.isPending} className="text-xs h-7" data-testid="button-salvar-agendamento">
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
