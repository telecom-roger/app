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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ScrollArea,
} from "@/components/ui/scroll-area";
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
  Download,
  X,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Papa from "papaparse";

type ContactEntry = {
  [key: string]: string;
};

type SendingStatus = {
  telefone: string;
  status: "pendente" | "enviando" | "sucesso" | "erro";
  erro?: string;
  timestamp?: string;
  clientId?: string;
};

type ClientForImport = {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  ultimaCampanha?: {
    data: string;
    minutosPara: number;
    recente: boolean;
  };
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
  const [mostrarSeletorBD, setMostrarSeletorBD] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [searchClientes, setSearchClientes] = useState("");
  const [clientesSelecionados, setClientesSelecionados] = useState<Set<string>>(new Set());
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  // Fetch clients with campaign history
  const { data: clientesDisponiveis = [], isLoading: carregandoClientes } = useQuery<ClientForImport[]>({
    queryKey: ["/api/clients/whatsapp-list"],
    enabled: isAuthenticated && mostrarSeletorBD,
  });

  // Filter clients by search
  const clientesFiltrados = clientesDisponiveis.filter((c) =>
    c.nome.toLowerCase().includes(searchClientes.toLowerCase()) ||
    c.telefone.includes(searchClientes)
  );

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
      complete: (results: any) => {
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
      error: (error: any) => {
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

  // Import selected clients from database
  const importarSelecionadosDoBD = () => {
    const contatosFromDB: ContactEntry[] = Array.from(clientesSelecionados)
      .map((clientId) => {
        const cliente = clientesDisponiveis.find((c) => c.id === clientId);
        return {
          id: cliente?.id || "",
          whatsapp: cliente?.telefone || "",
          empresa: cliente?.nome || "N/A",
        };
      })
      .filter((c) => c.whatsapp);

    if (contatosFromDB.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um cliente",
        variant: "destructive",
      });
      return;
    }

    setContatos(contatosFromDB);
    setVariaveisDisponiveis(["id", "whatsapp", "empresa"]);
    setClientesSelecionados(new Set());
    setMostrarSeletorBD(false);
    setSearchClientes("");

    toast({
      title: "Sucesso",
      description: `${contatosFromDB.length} contato${contatosFromDB.length !== 1 ? "s" : ""} carregado${contatosFromDB.length !== 1 ? "s" : ""} da base`,
    });
  };

  // Toggle client selection
  const toggleClienteSelecionado = (clientId: string) => {
    const novo = new Set(clientesSelecionados);
    if (novo.has(clientId)) {
      novo.delete(clientId);
    } else {
      novo.add(clientId);
    }
    setClientesSelecionados(novo);
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
        telefone: c.whatsapp || c.numeroTelefone || c.telefone || c.celular || "???",
        clientId: c.id || "",
        status: "pendente" as const,
      }))
    );

    try {
      // Enviar para o backend
      for (let i = 0; i < contatos.length; i++) {
        const contato = contatos[i];
        const telefone =
          contato.whatsapp ||
          contato.numeroTelefone ||
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
          formData.append("clientId", contato.id || "");
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
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* ===== ABA MENSAGENS ===== */}
        <TabsContent value="mensagens" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Contatos */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Contatos</CardTitle>
                  <CardDescription>Cole planilha ou importe da base</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Textarea for pasting */}
                  <Textarea
                    placeholder="Cole seus contatos aqui (Ctrl+C/Ctrl+V)..."
                    value={textoPlanilha}
                    onChange={(e) => setTextoPlanilha(e.target.value)}
                    className="font-mono text-sm h-48"
                    data-testid="textarea-contatos"
                  />

                  {/* Import from DB button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMostrarSeletorBD(true)}
                    className="w-full"
                    data-testid="button-importar-db"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Carregar da Base
                  </Button>

                  {/* Clear button */}
                  {contatos.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setContatos([]);
                        setTextoPlanilha("");
                        setVariaveisDisponiveis([]);
                      }}
                      className="w-full"
                      data-testid="button-limpar-contatos"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Limpar
                    </Button>
                  )}

                  {contatosProcessados > 0 && (
                    <div className="space-y-2">
                      <Badge className="w-full justify-center py-2 text-sm" variant="outline">
                        {contatosProcessados} contato
                        {contatosProcessados !== 1 ? "s" : ""} válido
                        {contatosProcessados !== 1 ? "s" : ""}
                      </Badge>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>
                          <strong>Variáveis:</strong>
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

            {/* Center: Tabela de Contatos */}
            <div className="lg:col-span-1 space-y-4">
              <Card className="flex flex-col h-full">
                <CardHeader>
                  <CardTitle className="text-base">Planilha</CardTitle>
                  <CardDescription>Visualização dos contatos</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden flex flex-col">
                  {contatos.length > 0 ? (
                    <div className="flex-1 overflow-auto border rounded-md">
                      <Table className="text-xs">
                        <TableHeader className="sticky top-0 bg-muted">
                          <TableRow>
                            {variaveisDisponiveis.slice(0, 3).map((v) => (
                              <TableHead key={v} className="py-2 px-3">
                                {v}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contatos.slice(0, 10).map((contato, idx) => (
                            <TableRow key={idx}>
                              {variaveisDisponiveis.slice(0, 3).map((v) => (
                                <TableCell key={`${idx}-${v}`} className="py-2 px-3 font-mono text-xs">
                                  {contato[v] || "-"}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {contatos.length > 10 && (
                        <div className="text-xs text-muted-foreground p-3 border-t">
                          ... e mais {contatos.length - 10}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center flex-1 text-muted-foreground">
                      Nenhum contato
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: Template */}
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
                    <div className="bg-muted p-3 rounded-md text-sm border-l-2 border-primary max-h-40 overflow-y-auto">
                      <div className="font-semibold mb-2 text-xs">Preview (1º contato):</div>
                      <div className="whitespace-pre-wrap break-words text-xs">{obterPreview()}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Status Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Status Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {statusEnvio.length > 0 ? (
                  <>
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
                    <Progress
                      value={
                        statusEnvio.length > 0
                          ? (sucessos / statusEnvio.length) * 100
                          : 0
                      }
                      className="h-2"
                    />
                  </>
                ) : (
                  <div className="text-muted-foreground text-sm">Aguardando envio...</div>
                )}
              </CardContent>
            </Card>

            {/* Status list */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm">Status de Envio</CardTitle>
              </CardHeader>
              <CardContent>
                {statusEnvio.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {statusEnvio.map((s, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm p-2 bg-muted rounded">
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-xs truncate">{s.telefone}</div>
                          {s.erro && (
                            <div className="text-xs text-destructive truncate">{s.erro}</div>
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
                ) : (
                  <div className="text-muted-foreground text-sm text-center py-4">
                    Nenhum envio realizado
                  </div>
                )}
              </CardContent>
            </Card>
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
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center hover-elevate cursor-pointer transition-colors"
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

        {/* ===== ABA HISTÓRICO ===== */}
        <TabsContent value="historico" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Campanhas por Cliente</CardTitle>
              <CardDescription>Veja quando cada cliente recebeu mensagens</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setMostrarHistorico(true)}
                variant="outline"
                size="sm"
                data-testid="button-abrir-historico"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Visualizar Histórico
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Import from DB with Multi-Select */}
      <Dialog open={mostrarSeletorBD} onOpenChange={setMostrarSeletorBD}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Selecionar Contatos da Base</DialogTitle>
            <DialogDescription>
              Escolha os clientes para receber as mensagens. RAZÃO_SOCIAL + CELULAR_PRINCIPAL
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 flex-1 flex flex-col">
            {/* Search Input */}
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={searchClientes}
              onChange={(e) => setSearchClientes(e.target.value)}
              data-testid="input-search-clientes"
            />

            {/* Clients Table */}
            {carregandoClientes ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : clientesFiltrados.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                Nenhum cliente encontrado
              </div>
            ) : (
              <ScrollArea className="flex-1 border rounded-md">
                <div className="relative">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted">
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={clientesSelecionados.size === clientesFiltrados.length && clientesFiltrados.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setClientesSelecionados(new Set(clientesFiltrados.map((c) => c.id)));
                              } else {
                                setClientesSelecionados(new Set());
                              }
                            }}
                            data-testid="checkbox-select-all"
                          />
                        </TableHead>
                        <TableHead>RAZÃO SOCIAL</TableHead>
                        <TableHead>CELULAR PRINCIPAL</TableHead>
                        <TableHead className="text-xs">Última Campanha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientesFiltrados.map((cliente) => (
                        <TableRow key={cliente.id} className="hover-elevate cursor-pointer">
                          <TableCell onClick={(e) => {
                            e.stopPropagation();
                            toggleClienteSelecionado(cliente.id);
                          }}>
                            <Checkbox
                              checked={clientesSelecionados.has(cliente.id)}
                              onCheckedChange={() => toggleClienteSelecionado(cliente.id)}
                              data-testid={`checkbox-cliente-${cliente.id}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{cliente.nome}</TableCell>
                          <TableCell className="font-mono text-sm">{cliente.telefone}</TableCell>
                          <TableCell className="text-xs">
                            {cliente.ultimaCampanha ? (
                              <div className="flex items-center gap-2">
                                {cliente.ultimaCampanha.recente ? (
                                  <Badge variant="destructive" className="text-xs gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    {cliente.ultimaCampanha.minutosPara}m
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">
                                    {cliente.ultimaCampanha.data}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Nenhuma</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            )}

            {/* Summary */}
            <div className="flex justify-between items-center p-3 bg-muted rounded">
              <span className="text-sm">
                <strong>{clientesSelecionados.size}</strong> de <strong>{clientesFiltrados.length}</strong> selecionados
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setMostrarSeletorBD(false);
                setClientesSelecionados(new Set());
                setSearchClientes("");
              }}
              data-testid="button-cancelar-seletor"
            >
              Cancelar
            </Button>
            <Button
              onClick={importarSelecionadosDoBD}
              disabled={clientesSelecionados.size === 0}
              data-testid="button-confirmar-importar"
            >
              Importar {clientesSelecionados.size} Contato{clientesSelecionados.size !== 1 ? "s" : ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
            <div className="mt-2 text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">{obterPreview()}</div>
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
