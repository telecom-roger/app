import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Send, 
  Upload, 
  Image as ImageIcon, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Eye,
  Loader,
  Copy,
  Trash2,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import Papa from "papaparse";

type ContactEntry = {
  [key: string]: string;
};

type SendingStatus = {
  telefone: string;
  status: "pendente" | "enviando" | "sucesso" | "erro";
  erro?: string;
  timestamp?: string;
};

export default function CampanhasWhatsApp() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  
  // ===== STATE =====
  const [tabAtivo, setTabAtivo] = useState("mensagens");
  const [textoPlanilha, setTextoPlanilha] = useState("");
  const [contatos, setContatos] = useState<ContactEntry[]>([]);
  const [variaveisDisponiveis, setVariaveisDisponiveis] = useState<string[]>([]);
  const [template, setTemplate] = useState("");
  const [tempoDelay, setTempoDelay] = useState(40);
  const [imagemSelecionada, setImagemSelecionada] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [statusEnvio, setStatusEnvio] = useState<SendingStatus[]>([]);
  const [mostrarPreview, setMostrarPreview] = useState(false);
  const [confirmarEnvio, setConfirmarEnvio] = useState(false);

  // Parse CSV when text changes
  useEffect(() => {
    if (!textoPlanilha.trim()) {
      setContatos([]);
      setVariaveisDisponiveis([]);
      return;
    }

    Papa.parse(textoPlanilha, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && Array.isArray(results.data)) {
          // Remove duplicates and blank phones
          const contatosProcessados: ContactEntry[] = [];
          const telefonesVistos = new Set<string>();

          for (const linha of results.data) {
            if (!linha || typeof linha !== "object") continue;
            
            // Find phone field (numeroTelefone, whatsapp, telefone, celular, etc)
            let telefone = "";
            for (const [key, value] of Object.entries(linha)) {
              const keyLower = (key || "").toLowerCase();
              if (
                keyLower.includes("telefone") ||
                keyLower.includes("whatsapp") ||
                keyLower.includes("celular") ||
                keyLower === "phone"
              ) {
                telefone = (value as string)?.trim() || "";
                break;
              }
            }

            // Skip if no valid phone
            if (!telefone || telefonesVistos.has(telefone)) continue;
            
            telefonesVistos.add(telefone);
            contatosProcessados.push(linha as ContactEntry);
          }

          setContatos(contatosProcessados);

          // Extract variables from headers
          if (contatosProcessados.length > 0) {
            const vars = Object.keys(contatosProcessados[0])
              .filter((k) => k && k.trim() !== "")
              .sort();
            setVariaveisDisponiveis(vars);
          }
        }
      },
      error: (error) => {
        console.error("Erro ao parsear CSV:", error);
        toast({
          title: "Erro",
          description: "Erro ao processar a planilha",
          variant: "destructive",
        });
      },
    });
  }, [textoPlanilha, toast]);

  // Handle image upload
  const handleImagemSelecionada = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImagemSelecionada(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagemPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Replace variables in template
  const substituirVariaveisNoTemplate = (texto: string, dados: ContactEntry): string => {
    let resultado = texto;
    for (const [chave, valor] of Object.entries(dados)) {
      const regex = new RegExp(`\\{${chave}\\}`, "g");
      resultado = resultado.replace(regex, valor || "");
    }
    return resultado;
  };

  // Get preview for first contact
  const obterPreview = (): string => {
    if (contatos.length === 0) return template;
    return substituirVariaveisNoTemplate(template, contatos[0]);
  };

  // Send campaign
  const enviarCampanha = async () => {
    if (!template.trim()) {
      toast({
        title: "Erro",
        description: "Template está vazio",
        variant: "destructive",
      });
      return;
    }

    if (contatos.length === 0) {
      toast({
        title: "Erro",
        description: "Nenhum contato para enviar",
        variant: "destructive",
      });
      return;
    }

    if (tempoDelay < 10) {
      toast({
        title: "Erro",
        description: "Delay mínimo é 10 segundos",
        variant: "destructive",
      });
      return;
    }

    setEnviando(true);
    setStatusEnvio(
      contatos.map((c) => ({
        telefone: c.numeroTelefone || c.whatsapp || c.telefone || c.celular || "???",
        status: "pendente" as const,
      }))
    );

    try {
      // Enviar para o backend
      for (let i = 0; i < contatos.length; i++) {
        const contato = contatos[i];
        const telefone =
          contato.numeroTelefone ||
          contato.whatsapp ||
          contato.telefone ||
          contato.celular ||
          "";

        if (!telefone) continue;

        // Update status to sending
        setStatusEnvio((prev) =>
          prev.map((s) =>
            s.telefone === telefone ? { ...s, status: "enviando" } : s
          )
        );

        try {
          const mensagem = substituirVariaveisNoTemplate(template, contato);
          
          const formData = new FormData();
          formData.append("telefone", telefone);
          formData.append("mensagem", mensagem);
          if (imagemSelecionada) {
            formData.append("imagem", imagemSelecionada);
          }

          const response = await fetch("/api/whatsapp/enviar-broadcast", {
            method: "POST",
            body: formData,
          });

          if (response.ok) {
            setStatusEnvio((prev) =>
              prev.map((s) =>
                s.telefone === telefone
                  ? {
                      ...s,
                      status: "sucesso",
                      timestamp: new Date().toLocaleTimeString("pt-BR"),
                    }
                  : s
              )
            );
          } else {
            const erro = await response.text();
            setStatusEnvio((prev) =>
              prev.map((s) =>
                s.telefone === telefone
                  ? {
                      ...s,
                      status: "erro",
                      erro: erro,
                      timestamp: new Date().toLocaleTimeString("pt-BR"),
                    }
                  : s
              )
            );
          }
        } catch (error: any) {
          setStatusEnvio((prev) =>
            prev.map((s) =>
              s.telefone === telefone
                ? {
                    ...s,
                    status: "erro",
                    erro: error.message,
                    timestamp: new Date().toLocaleTimeString("pt-BR"),
                  }
                : s
            )
          );
        }

        // Wait before next message
        if (i < contatos.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, tempoDelay * 1000));
        }
      }

      toast({
        title: "Sucesso",
        description: "Campanha concluída",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setEnviando(false);
      setConfirmarEnvio(false);
    }
  };

  if (!isAuthenticated) {
    return <div>Carregando...</div>;
  }

  const contatosProcessados = contatos.length;
  const sucessos = statusEnvio.filter((s) => s.status === "sucesso").length;
  const erros = statusEnvio.filter((s) => s.status === "erro").length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Campanhas WhatsApp</h1>
        <p className="text-muted-foreground mt-1">
          Envie mensagens em massa personalizadas via WhatsApp
        </p>
      </div>

      <Tabs value={tabAtivo} onValueChange={setTabAtivo} className="space-y-4">
        <TabsList>
          <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
          <TabsTrigger value="configuracao">Configuração</TabsTrigger>
        </TabsList>

        {/* ===== ABA MENSAGENS ===== */}
        <TabsContent value="mensagens" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Contatos */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Contatos</CardTitle>
                  <CardDescription>Cole sua planilha aqui (Ctrl+C/Ctrl+V)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Cole seus contatos aqui...&#10;Exemplo:&#10;numeroTelefone&#9;empresa&#10;5511999999999&#9;Empresa A&#10;5511988888888&#9;Empresa B"
                    value={textoPlanilha}
                    onChange={(e) => setTextoPlanilha(e.target.value)}
                    className="font-mono text-sm h-64"
                    data-testid="textarea-contatos"
                  />
                  
                  {contatosProcessados > 0 && (
                    <div className="space-y-2">
                      <Badge className="w-full justify-center py-2 text-sm" variant="outline">
                        {contatosProcessados} contato{contatosProcessados !== 1 ? "s" : ""} válido
                        {contatosProcessados !== 1 ? "s" : ""}
                      </Badge>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>
                          <strong>Variáveis disponíveis:</strong>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {variaveisDisponiveis.map((v) => (
                            <Badge key={v} variant="secondary" className="text-xs">
                              {"{"}
                              {v}
                              {"}"}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Center: Template */}
            <div className="lg:col-span-1 space-y-4">
              <Card className="flex flex-col h-full">
                <CardHeader>
                  <CardTitle className="text-base">Template</CardTitle>
                  <CardDescription>Use {"{variavel}"} para personalizar</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 flex-1 flex flex-col">
                  <Textarea
                    placeholder="Olá {empresa}! Temos uma promoção especial para você..."
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    className="flex-1 font-mono text-sm"
                    data-testid="textarea-template"
                  />
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMostrarPreview(!mostrarPreview)}
                    data-testid="button-toggle-preview"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {mostrarPreview ? "Ocultar" : "Ver"} Preview
                  </Button>

                  {mostrarPreview && contatos.length > 0 && (
                    <div className="bg-muted p-3 rounded-md text-sm border-l-2 border-primary">
                      <div className="font-semibold mb-2">Preview (1º contato):</div>
                      <div className="whitespace-pre-wrap break-words">{obterPreview()}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: Status em tempo real */}
            <div className="lg:col-span-1 space-y-4">
              <Card className="flex flex-col h-full">
                <CardHeader>
                  <CardTitle className="text-base">Status</CardTitle>
                  <CardDescription>Acompanhe os envios</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 flex-1 flex flex-col">
                  {statusEnvio.length > 0 ? (
                    <>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span>Enviados:</span>
                          <Badge variant="default">{sucessos}</Badge>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span>Erros:</span>
                          <Badge variant="destructive">{erros}</Badge>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span>Pendentes:</span>
                          <Badge variant="secondary">
                            {statusEnvio.filter((s) => s.status === "pendente" || s.status === "enviando")
                              .length}
                          </Badge>
                        </div>
                      </div>

                      <Progress
                        value={
                          statusEnvio.length > 0
                            ? (sucessos / statusEnvio.length) * 100
                            : 0
                        }
                        className="h-2"
                      />

                      {/* Status list */}
                      <div className="space-y-2 flex-1 overflow-y-auto max-h-64">
                        {statusEnvio.map((s, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-sm p-2 bg-muted rounded">
                            <div className="flex-1">
                              <div className="font-mono text-xs">{s.telefone}</div>
                              {s.erro && (
                                <div className="text-xs text-destructive">{s.erro}</div>
                              )}
                              {s.timestamp && (
                                <div className="text-xs text-muted-foreground">{s.timestamp}</div>
                              )}
                            </div>
                            {s.status === "sucesso" && (
                              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-1" />
                            )}
                            {s.status === "erro" && (
                              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-1" />
                            )}
                            {s.status === "enviando" && (
                              <Loader className="h-4 w-4 text-blue-500 flex-shrink-0 mt-1 animate-spin" />
                            )}
                            {s.status === "pendente" && (
                              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                      Aguardando envio...
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {contatosProcessados > 0 ? (
                <>
                  <strong>{contatosProcessados}</strong> contato
                  {contatosProcessados !== 1 ? "s" : ""} prontos para envio
                </>
              ) : (
                "Cole seus contatos para começar"
              )}
            </div>
            <Button
              onClick={() => setConfirmarEnvio(true)}
              disabled={
                enviando ||
                contatosProcessados === 0 ||
                !template.trim() ||
                tempoDelay < 10
              }
              size="lg"
              data-testid="button-enviar-campanha"
            >
              <Send className="h-4 w-4 mr-2" />
              {enviando ? "Enviando..." : "Enviar Campanha"}
            </Button>
          </div>
        </TabsContent>

        {/* ===== ABA CONFIGURAÇÃO ===== */}
        <TabsContent value="configuracao" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações da Campanha</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Delay */}
              <div className="space-y-3">
                <Label htmlFor="delay">Tempo de delay entre mensagens (segundos)</Label>
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Input
                      id="delay"
                      type="number"
                      min={10}
                      max={300}
                      value={tempoDelay}
                      onChange={(e) => setTempoDelay(Math.max(10, parseInt(e.target.value) || 10))}
                      data-testid="input-delay"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Min: 10s | Recomendado: 15-30s
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Quanto maior o delay, mais seguro é o envio. Mínimo de 10 segundos para não ser
                  bloqueado.
                </p>
              </div>

              {/* Imagem */}
              <div className="space-y-3">
                <Label>Imagem (opcional)</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover-elevate cursor-pointer transition-colors"
                  onClick={() => document.getElementById("upload-imagem")?.click()}
                >
                  {imagemPreview ? (
                    <div className="space-y-3">
                      <img
                        src={imagemPreview}
                        alt="Preview"
                        className="h-32 w-auto mx-auto rounded"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImagemSelecionada(null);
                          setImagemPreview(null);
                        }}
                        data-testid="button-remover-imagem"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remover
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground" />
                      <div className="font-medium">Clique ou arraste uma imagem</div>
                      <p className="text-xs text-muted-foreground">JPG, PNG - Máx 5MB</p>
                    </div>
                  )}
                  <input
                    id="upload-imagem"
                    type="file"
                    accept="image/*"
                    onChange={handleImagemSelecionada}
                    className="hidden"
                    data-testid="input-imagem"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmarEnvio} onOpenChange={setConfirmarEnvio}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a enviar {contatosProcessados} mensagens com delay de {tempoDelay}
              s. Isso pode levar {Math.ceil((contatosProcessados * tempoDelay) / 60)} minutos.
              Você tem certeza?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4 p-3 bg-muted rounded text-sm">
            <strong>Preview:</strong>
            <div className="mt-2 text-xs whitespace-pre-wrap">{obterPreview()}</div>
          </div>
          <div className="flex gap-3">
            <AlertDialogCancel data-testid="button-cancelar-envio">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={enviarCampanha}
              disabled={enviando}
              data-testid="button-confirmar-envio"
            >
              {enviando ? "Enviando..." : "Confirmar"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
