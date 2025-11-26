import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
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
// @ts-ignore
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
  razaoSocial?: string;
  telefone: string;
  email?: string;
  status?: string;
  ultimaCampanha?: {
    data: string;
    minutosPara: number;
    recente: boolean;
  };
};

export default function CampanhasWhatsApp() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { connected: whatsappConnected } = useWhatsAppStatus();
  
  // ===== STATE =====
  const [tabAtivo, setTabAtivo] = useState("mensagens");
  const [textoPlanilha, setTextoPlanilha] = useState("");
  const [contatos, setContatos] = useState<ContactEntry[]>([]);
  const [variaveisDisponiveis, setVariaveisDisponiveis] = useState<string[]>([]);
  const [template, setTemplate] = useState("");
  const [tempoDelay, setTempoDelay] = useState(40);
  const [tempoRandomMin, setTempoRandomMin] = useState(5);
  const [tempoRandomMax, setTempoRandomMax] = useState(15);
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
  const [quantidadeSelecar, setQuantidadeSelecar] = useState(10);
  const cancelarEnvioRef = useRef(false);
  const [campanhasEmProgresso, setCampanhasEmProgresso] = useState<any[]>([]);
  const [modoBackground, setModoBackground] = useState(true);
  const [templateSelecionado, setTemplateSelecionado] = useState("");

  // Fetch templates
  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["/api/templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: isAuthenticated,
  });

  // Fetch clients with campaign history
  const { data: clientesDisponiveis = [], isLoading: carregandoClientes } = useQuery<ClientForImport[]>({
    queryKey: ["/api/clients/whatsapp-list"],
    enabled: isAuthenticated && mostrarSeletorBD,
  });

  // Poll for campaigns in progress
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/whatsapp/campanhas-em-progresso");
        if (res.ok) {
          const data = await res.json();
          setCampanhasEmProgresso(data);
        }
      } catch (err) {
        console.error("Erro ao buscar campanhas:", err);
      }
    }, 2000); // Poll a cada 2 segundos

    return () => clearInterval(interval);
  }, [isAuthenticated]);

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
          celular: cliente?.telefone || "",
          razao_social: cliente?.razaoSocial || "N/A",
        };
      })
      .filter((c) => c.celular);

    if (contatosFromDB.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um cliente",
        variant: "destructive",
      });
      return;
    }

    setContatos(contatosFromDB);
    setVariaveisDisponiveis(["celular", "razao_social", "id"]);
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

    if (modoBackground) {
      // ===== BACKGROUND MODE =====
      setEnviando(true);
      setConfirmarEnvio(false);

      try {
        // Enviar para backend de forma assíncrona (fire-and-forget)
        fetch("/api/whatsapp/enviar-campanha-background", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contatos: contatos.map((c) => ({
              id: c.id || "",
              celular: c.celular || c.numeroTelefone || c.telefone || c.whatsapp || "",
              razao_social: c.razao_social || c.empresa || "N/A",
            })),
            template,
            tempoDelay,
          }),
        }).catch((err) => console.error("Erro ao enviar campanha:", err));

        // Show notification and allow navigation
        toast({
          title: "Campanha iniciada!",
          description: `${contatos.length} mensagens serão enviadas em background. Você pode continuar navegando!`,
        });

        // Clear form and go back
        setContatos([]);
        setTextoPlanilha("");
        setTemplate("");
        setVariaveisDisponiveis([]);
        setStatusEnvio([]);
        
      } catch (error: any) {
        toast({
          title: "Erro",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setEnviando(false);
      }
    } else {
      // ===== NORMAL MODE (original com progresso visível) =====
      setEnviando(true);
      cancelarEnvioRef.current = false;
      setStatusEnvio(
        contatos.map((c) => ({
          telefone: c.whatsapp || c.numeroTelefone || c.telefone || c.celular || "???",
          clientId: c.id || "",
          status: "pendente" as const,
        }))
      );

      try {
        const clientesEnviadosComSucesso: string[] = [];

        for (let i = 0; i < contatos.length; i++) {
          if (cancelarEnvioRef.current) {
            toast({
              title: "Cancelado",
              description: "Envio cancelado pelo usuário",
              variant: "default",
            });
            break;
          }
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
            
            const response = await fetch("/api/whatsapp/enviar-broadcast", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                telefone,
                mensagem,
                clientId: contato.id || "",
              }),
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
              // Adicionar cliente à lista de enviados com sucesso
              if (contato.id) {
                clientesEnviadosComSucesso.push(contato.id);
              }
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

          // Wait before next message with random variation to avoid bot detection
          if (i < contatos.length - 1) {
            const rangeExtra = (tempoRandomMax - tempoRandomMin) * 1000; // intervalo em ms
            const randomExtra = Math.random() * rangeExtra + (tempoRandomMin * 1000); // min + randomizado
            const totalDelay = (tempoDelay * 1000) + randomExtra;
            await new Promise((resolve) => setTimeout(resolve, totalDelay));
          }
        }

        // Atualizar status dos clientes que foram enviados com sucesso
        if (clientesEnviadosComSucesso.length > 0) {
          try {
            await apiRequest("POST", "/api/clients/bulk-status", {
              clientIds: clientesEnviadosComSucesso,
              status: "ENVIADO",
            });
          } catch (err) {
            console.error("Erro ao atualizar status dos clientes:", err);
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
          <TabsTrigger value="progresso">Campanhas em Progresso {campanhasEmProgresso.length > 0 && `(${campanhasEmProgresso.length})`}</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* ===== ABA MENSAGENS ===== */}
        <TabsContent value="mensagens" className="space-y-4">
          {/* Campaign Progress Widget */}
          {campanhasEmProgresso.length > 0 && (
            <div className="grid gap-4">
              {campanhasEmProgresso.map((campanha) => (
                <Card key={campanha.id} className="border-primary/50 bg-gradient-to-r from-primary/5 to-transparent">
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base">Campanha em Progresso</CardTitle>
                      <Badge variant={campanha.status === "concluida" ? "outline" : "default"}>
                        {Math.round((campanha.enviadas / campanha.total) * 100)}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Progress value={(campanha.enviadas / campanha.total) * 100} />
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="text-center">
                        <div className="text-muted-foreground">Enviadas</div>
                        <div className="font-semibold text-green-600 dark:text-green-400">{campanha.enviadas}/{campanha.total}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground">Taxa</div>
                        <div className="font-semibold">{Math.round((campanha.enviadas / campanha.total) * 100)}%</div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground">Erros</div>
                        <div className={`font-semibold ${campanha.erros > 0 ? "text-destructive" : "text-muted-foreground"}`}>{campanha.erros}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Section: Contatos + Preview */}
            <div className="space-y-6">
              {/* Input Card */}
              <Card className="border hover-elevate transition-all">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Contatos</CardTitle>
                      <CardDescription className="mt-1">Cole seus dados ou importe da base</CardDescription>
                    </div>
                    {contatosProcessados > 0 && (
                      <Badge className="text-sm px-3 py-1" variant="secondary">
                        {contatosProcessados} contato{contatosProcessados !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Cole aqui (Tab para separar colunas, Enter para linhas)..."
                    value={textoPlanilha}
                    onChange={(e) => setTextoPlanilha(e.target.value)}
                    className="font-mono text-sm h-56 resize-none"
                    data-testid="textarea-contatos"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="default"
                      onClick={() => setMostrarSeletorBD(true)}
                      className="w-full"
                      data-testid="button-importar-db"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Base de Dados
                    </Button>
                    {contatos.length > 0 && (
                      <Button
                        variant="outline"
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
                  </div>
                  {variaveisDisponiveis.length > 0 && (
                    <div className="pt-2 border-t">
                      <div className="text-xs font-semibold text-muted-foreground mb-2">Variáveis Disponíveis:</div>
                      <div className="flex flex-wrap gap-2">
                        {variaveisDisponiveis.map((v) => (
                          <Badge key={v} variant="outline" className="text-xs font-mono">
                            {"{"}
                            {v}
                            {"}"}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Preview Card */}
              {contatos.length > 0 && (
                <Card className="border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Visualização de Contatos</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-hidden">
                    <div className="border rounded-md overflow-auto max-h-64">
                      <Table className="text-xs">
                        <TableHeader className="sticky top-0 bg-muted">
                          <TableRow>
                            {variaveisDisponiveis.slice(0, 4).map((v) => (
                              <TableHead key={v} className="py-3 px-4 font-semibold text-xs">
                                {v}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contatos.slice(0, 8).map((contato, idx) => (
                            <TableRow key={idx} className="hover:bg-muted/50">
                              {variaveisDisponiveis.slice(0, 4).map((v) => (
                                <TableCell key={`${idx}-${v}`} className="py-3 px-4 font-mono text-xs truncate">
                                  {contato[v] || "-"}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {contatos.length > 8 && (
                        <div className="text-xs text-muted-foreground p-3 border-t text-center bg-muted/30">
                          +{contatos.length - 8} contatos
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Section: Template Editor */}
            <div className="space-y-6">
              <Card className="border flex flex-col h-auto md:h-fit lg:h-auto hover-elevate transition-all">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Mensagem</CardTitle>
                  <CardDescription className="mt-1">Use {"{variável}"} para personalizar</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Template Selector */}
                  <div className="space-y-2">
                    <Label htmlFor="template-select" className="text-sm font-semibold">Usar Modelo</Label>
                    <Select 
                      value={templateSelecionado}
                      onValueChange={(value) => {
                        setTemplateSelecionado(value);
                        const templ = templates.find((t: any) => t.id === value);
                        if (templ) {
                          setTemplate(templ.conteudo);
                        }
                      }}
                    >
                      <SelectTrigger id="template-select" className="h-10 text-foreground" data-testid="select-template">
                        <SelectValue placeholder="Selecionar modelo (opcional)...">
                          {templateSelecionado && templates.length > 0
                            ? templates.find((t: any) => t.id === templateSelecionado)?.titulo
                            : "Selecionar modelo (opcional)..."}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {templates.length > 0 ? (
                          templates.map((t: any) => (
                            <SelectItem key={t.id} value={t.id} className="text-sm">
                              {t.titulo}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="vazio" disabled className="text-xs text-muted-foreground">
                            Nenhum modelo disponível
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-muted"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-2 bg-white dark:bg-slate-950 text-muted-foreground">ou escreva aqui</span>
                    </div>
                  </div>

                  {/* Template Textarea */}
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Olá {empresa}! Temos uma promoção especial para você..."
                      value={template}
                      onChange={(e) => setTemplate(e.target.value)}
                      className="flex-1 font-mono text-sm h-48 resize-none"
                      data-testid="textarea-template"
                    />
                  </div>

                  {/* Preview Button */}
                  <Button
                    variant={mostrarPreview ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMostrarPreview(!mostrarPreview)}
                    className="w-full"
                    data-testid="button-toggle-preview"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {mostrarPreview ? "Ocultar Preview" : "Ver Preview"}
                  </Button>

                  {/* Live Preview */}
                  {mostrarPreview && contatos.length > 0 && (
                    <div className="bg-primary/5 border border-primary/20 p-4 rounded-md text-sm space-y-2">
                      <div className="font-semibold text-xs text-primary mb-2">Visualização (1º contato):</div>
                      <div className="whitespace-pre-wrap break-words text-sm font-mono leading-relaxed text-foreground max-h-32 overflow-y-auto">
                        {obterPreview()}
                      </div>
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
            <div className="flex gap-4 items-center">
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
              <div className="flex items-center gap-2 pl-4 border-l">
                <Label className="text-sm font-medium cursor-pointer flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={modoBackground}
                    onChange={(e) => setModoBackground(e.target.checked)}
                    disabled={enviando}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Enviar em Background
                </Label>
              </div>
            </div>
            <div className="flex gap-2">
              {enviando && !modoBackground && (
                <Button
                  onClick={() => {
                    cancelarEnvioRef.current = true;
                  }}
                  variant="destructive"
                  size="lg"
                  data-testid="button-cancelar-envio"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar Envio
                </Button>
              )}
              <Button
                onClick={() => {
                  if (!whatsappConnected) {
                    toast({
                      title: "WhatsApp não conectado",
                      description: "Por favor, conecte seu WhatsApp em /whatsapp antes de enviar campanhas.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setConfirmarEnvio(true);
                }}
                disabled={
                  enviando ||
                  contatosProcessados === 0 ||
                  !template.trim() ||
                  tempoDelay < 10 ||
                  !whatsappConnected
                }
                size="lg"
                data-testid="button-enviar-campanha"
              >
                <Send className="h-4 w-4 mr-2" />
                {!whatsappConnected ? "WhatsApp Desconectado" : enviando ? "Enviando..." : "Enviar Campanha"}
              </Button>
            </div>
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

              {/* Randomização */}
              <div className="space-y-3">
                <Label>Randomização de delay (evita parecer robô)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="random-min" className="text-xs">Tempo mínimo extra (seg)</Label>
                    <Input
                      id="random-min"
                      type="number"
                      min={0}
                      max={60}
                      value={tempoRandomMin}
                      onChange={(e) => setTempoRandomMin(Math.max(0, parseInt(e.target.value) || 0))}
                      data-testid="input-random-min"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="random-max" className="text-xs">Tempo máximo extra (seg)</Label>
                    <Input
                      id="random-max"
                      type="number"
                      min={1}
                      max={60}
                      value={tempoRandomMax}
                      onChange={(e) => setTempoRandomMax(Math.max(1, parseInt(e.target.value) || 15))}
                      data-testid="input-random-max"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  O delay entre mensagens será: {tempoDelay}s + {tempoRandomMin}s a {tempoRandomMax}s aleatórios = {tempoDelay + tempoRandomMin}s a {tempoDelay + tempoRandomMax}s
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

        {/* ===== ABA CAMPANHAS EM PROGRESSO ===== */}
        <TabsContent value="progresso" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Campanhas em Progresso</CardTitle>
              <CardDescription>Acompanhe o status de suas campanhas em tempo real</CardDescription>
            </CardHeader>
            <CardContent>
              {campanhasEmProgresso.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma campanha em progresso no momento
                </div>
              ) : (
                <div className="space-y-4">
                  {campanhasEmProgresso.map((campanha) => (
                    <div key={campanha.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="font-mono text-sm">{campanha.id}</div>
                        <Badge variant={campanha.status === "concluida" ? "outline" : "secondary"}>
                          {campanha.status === "em_progresso" ? "Em Progresso" : "Concluída"}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">
                          {campanha.enviadas} / {campanha.total} mensagens enviadas
                        </div>
                        <Progress value={(campanha.enviadas / campanha.total) * 100} />
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Enviadas:</span>
                          <div className="font-semibold text-green-600 dark:text-green-400">{campanha.enviadas}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Erros:</span>
                          <div className={`font-semibold ${campanha.erros > 0 ? "text-destructive" : ""}`}>{campanha.erros}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Taxa de Sucesso:</span>
                          <div className="font-semibold">{Math.round((campanha.enviadas / campanha.total) * 100)}%</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-2xl">Selecionar Clientes</DialogTitle>
            <DialogDescription>
              Escolha os clientes para receber a campanha. Você pode adicionar à planilha ou enviar direto.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
            {/* Search Input */}
            <div className="flex gap-2 items-center">
              <Input
                placeholder="🔍 Buscar por nome ou telefone..."
                value={searchClientes}
                onChange={(e) => setSearchClientes(e.target.value)}
                className="flex-1"
                data-testid="input-search-clientes"
              />
              <Badge variant="secondary" className="h-10 px-3 flex items-center gap-2 whitespace-nowrap">
                {clientesFiltrados.length} clientes
              </Badge>
            </div>

            {/* Quick Select Buttons */}
            <div className="flex gap-2 flex-wrap items-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setClientesSelecionados(new Set(clientesFiltrados.map((c) => c.id)))}
                disabled={clientesFiltrados.length === 0}
                data-testid="button-select-all-quick"
              >
                ✓ Selecionar Todos
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setClientesSelecionados(new Set())}
                disabled={clientesSelecionados.size === 0}
                data-testid="button-deselect-all"
              >
                ✕ Desselecionar Todos
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const novos = clientesFiltrados
                    .filter((c) => !c.ultimaCampanha)
                    .map((c) => c.id);
                  setClientesSelecionados(new Set(novos));
                }}
                disabled={clientesFiltrados.every((c) => c.ultimaCampanha)}
                data-testid="button-select-news"
              >
                ⭐ Apenas Novos
              </Button>
              
              {/* Divider */}
              <div className="h-6 w-px bg-border" />
              
              {/* Random Selection */}
              <div className="flex gap-2 items-center">
                <Label className="text-xs font-medium whitespace-nowrap">Selecionar aleatoriamente:</Label>
                <Input
                  type="number"
                  min={1}
                  max={clientesFiltrados.length}
                  value={quantidadeSelecar}
                  onChange={(e) => setQuantidadeSelecar(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 h-9"
                  data-testid="input-quantidade-selecionar"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const shuffled = [...clientesFiltrados].sort(() => Math.random() - 0.5);
                    const quantidadeReal = Math.min(quantidadeSelecar, clientesFiltrados.length);
                    const selecionados = shuffled.slice(0, quantidadeReal).map((c) => c.id);
                    setClientesSelecionados(new Set(selecionados));
                  }}
                  disabled={clientesFiltrados.length === 0}
                  data-testid="button-random-select"
                >
                  🎲 Selecionar
                </Button>
              </div>
            </div>

            {/* Clients Table with better styling - Scroll enabled */}
            <div className="flex-1 overflow-hidden flex flex-col border rounded-lg bg-white dark:bg-slate-950 min-h-[500px]">
              {carregandoClientes ? (
                <div className="flex items-center justify-center flex-1">
                  <div className="flex flex-col items-center gap-2">
                    <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Carregando clientes...</span>
                  </div>
                </div>
              ) : clientesFiltrados.length === 0 ? (
                <div className="flex items-center justify-center flex-1 text-muted-foreground">
                  <div className="text-center">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum cliente encontrado</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto border-t">
                  <Table className="text-sm w-full">
                    <TableHeader className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10">
                      <TableRow className="border-b-2">
                        <TableHead className="w-12 text-center">
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
                        <TableHead className="font-semibold">RAZÃO SOCIAL</TableHead>
                        <TableHead className="font-semibold">CELULAR</TableHead>
                        <TableHead className="font-semibold text-xs">STATUS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientesFiltrados.map((cliente) => (
                        <TableRow key={cliente.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer transition-colors" data-testid={`row-cliente-${cliente.id}`}>
                          <TableCell className="text-center w-12" onClick={(e) => {
                            e.stopPropagation();
                            toggleClienteSelecionado(cliente.id);
                          }}>
                            <Checkbox
                              checked={clientesSelecionados.has(cliente.id)}
                              onCheckedChange={() => toggleClienteSelecionado(cliente.id)}
                              data-testid={`checkbox-cliente-${cliente.id}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium" data-testid={`text-razaosocial-${cliente.id}`}>{cliente.razaoSocial || "N/A"}</TableCell>
                          <TableCell className="font-mono text-sm font-medium" data-testid={`text-celular-${cliente.id}`}>{cliente.telefone}</TableCell>
                          <TableCell className="text-xs" data-testid={`status-campanha-${cliente.id}`}>
                            {cliente.status === "ENVIADO" ? (
                              <Badge variant="destructive" className="text-xs gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Enviado
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">{cliente.status || "Lead"}</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Summary with Stats */}
            <div className="flex gap-4 items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border">
              <div className="flex gap-6">
                <div className="text-sm">
                  <span className="text-muted-foreground">Selecionados:</span>
                  <span className="font-semibold ml-2 text-lg text-primary">{clientesSelecionados.size}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-semibold ml-2 text-lg">{clientesFiltrados.length}</span>
                </div>
              </div>
              {clientesSelecionados.size > 0 && (
                <div className="text-xs text-green-600 dark:text-green-400">
                  ✓ Pronto para enviar
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons - Two options */}
          <div className="flex gap-3 justify-end border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setMostrarSeletorBD(false);
                setClientesSelecionados(new Set());
                setSearchClientes("");
              }}
              data-testid="button-cancelar-seletor"
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                importarSelecionadosDoBD();
              }}
              disabled={clientesSelecionados.size === 0}
              data-testid="button-adicionar-planilha"
            >
              <Download className="h-4 w-4 mr-2" />
              Adicionar à Planilha ({clientesSelecionados.size})
            </Button>
            <Button
              onClick={() => {
                const contatosFromDB: ContactEntry[] = Array.from(clientesSelecionados)
                  .map((clientId) => {
                    const cliente = clientesDisponiveis.find((c) => c.id === clientId);
                    return {
                      id: cliente?.id || "",
                      celular: cliente?.telefone || "",
                      razao_social: cliente?.razaoSocial || "N/A",
                    };
                  })
                  .filter((c) => c.celular);

                setContatos(contatosFromDB);
                setVariaveisDisponiveis(["celular", "razao_social"]);
                setClientesSelecionados(new Set());
                setMostrarSeletorBD(false);
                setSearchClientes("");
                setConfirmarEnvio(true); // Skip to confirmation dialog

                toast({
                  title: "Pronto para enviar!",
                  description: `${contatosFromDB.length} contato${contatosFromDB.length !== 1 ? "s" : ""} selecionado${contatosFromDB.length !== 1 ? "s" : ""}`,
                });
              }}
              disabled={clientesSelecionados.size === 0}
              data-testid="button-enviar-direto"
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar Direto ({clientesSelecionados.size})
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
