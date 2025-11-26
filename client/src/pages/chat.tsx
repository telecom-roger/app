import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Plus, Loader, Search, X, FileText, Volume2, Paperclip, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Chat() {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [conversaSelecionada, setConversaSelecionada] = useState<string | null>(null);
  const [mensagemTexto, setMensagemTexto] = useState("");
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [mostrarClientesDisp, setMostrarClientesDisp] = useState(false);
  const [busca, setBusca] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nomeArquivoMostrado, setNomeArquivoMostrado] = useState<string | null>(null);

  // Get conversations
  const { data: conversas = [], isLoading: carregandoConversas } = useQuery<any[]>({
    queryKey: ["/api/chat/conversations"],
    enabled: isAuthenticated,
  });

  // Get messages for selected conversation
  const { data: mensagens = [], isLoading: carregandoMensagens } = useQuery<any[]>({
    queryKey: ["/api/chat/messages", conversaSelecionada],
    enabled: isAuthenticated && !!conversaSelecionada,
  });

  // Get available clients for new conversation
  const { data: clientesDisponiveis = [] } = useQuery<any[]>({
    queryKey: ["/api/clients/whatsapp-list"],
    enabled: isAuthenticated,
  });

  // Send message mutation
  const { mutate: enviarMensagem, isPending: enviando } = useMutation({
    mutationFn: async (dados: any) => {
      const response = await fetch(`/api/chat/messages/${conversaSelecionada}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
      if (!response.ok) throw new Error("Erro ao enviar");
      return response.json();
    },
    onSuccess: () => {
      setMensagemTexto("");
      setArquivoSelecionado(null);
      setNomeArquivoMostrado(null);
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/messages", conversaSelecionada],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/conversations"],
      });
      toast({
        title: "Enviado",
        description: "Mensagem enviada com sucesso",
      });
    },
    onError: (error: any) => {
      console.error("Erro ao enviar mensagem:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem",
        variant: "destructive",
      });
    },
  });

  // Start conversation mutation
  const { mutate: iniciarConversa, isPending: iniciandoConversa } = useMutation({
    mutationFn: async (clientId: string) => {
      const response = await fetch(`/api/chat/start-conversation/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao iniciar conversa");
      }
      return response.json();
    },
    onSuccess: (conversa) => {
      if (conversa && conversa.id) {
        setConversaSelecionada(conversa.id);
        setBusca("");
        setMostrarClientesDisp(false);
        queryClient.invalidateQueries({
          queryKey: ["/api/chat/conversations"],
        });
        toast({
          title: "Conversa iniciada",
          description: "Agora você pode enviar mensagens",
        });
      }
    },
    onError: (error: any) => {
      console.error("Erro ao iniciar conversa:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao iniciar conversa",
        variant: "destructive",
      });
    },
  });

  // Test receive message
  const { mutate: simularMensagemRecebida, isPending: simulando } = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/chat/test/receive-message/${conversaSelecionada}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/messages", conversaSelecionada],
      });
    },
  });

  // Filter conversations and clients
  const conversasFiltradas = useMemo(() => {
    if (!busca) return conversas;
    return (conversas as any[]).filter(
      (c) =>
        c.razaoSocial?.toLowerCase().includes(busca.toLowerCase()) ||
        c.clientNome?.toLowerCase().includes(busca.toLowerCase())
    );
  }, [conversas, busca]);

  const clientesFiltrados = useMemo(() => {
    if (!busca) return [];
    return (clientesDisponiveis as any[]).filter(
      (c) =>
        c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        c.razaoSocial?.toLowerCase().includes(busca.toLowerCase())
    );
  }, [clientesDisponiveis, busca]);

  const conversaAtual = useMemo(() => {
    return (conversas as any[]).find((c) => c.id === conversaSelecionada);
  }, [conversas, conversaSelecionada]);

  const handleArquivoSelecionado = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArquivoSelecionado(file);
    setNomeArquivoMostrado(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      
      let tipo = "documento";
      if (file.type.startsWith("image/")) tipo = "imagem";
      else if (file.type.startsWith("audio/")) tipo = "audio";
      else if (file.type.startsWith("video/")) tipo = "video";

      setArquivoSelecionado({
        ...file,
        base64,
        tipo,
      } as any);
    };
    reader.readAsDataURL(file);
  };

  const handleEnviarMensagem = () => {
    if (!conversaSelecionada) return;
    if (!mensagemTexto.trim() && !arquivoSelecionado) return;

    if (arquivoSelecionado && (arquivoSelecionado as any).base64) {
      const file = arquivoSelecionado as any;
      let tipo = "documento";
      if (file.type.startsWith("image/")) tipo = "imagem";
      else if (file.type.startsWith("audio/")) tipo = "audio";
      else if (file.type.startsWith("video/")) tipo = "video";

      enviarMensagem({
        conteudo: mensagemTexto || `[${tipo.toUpperCase()}]`,
        tipo,
        arquivo: file.base64,
        nomeArquivo: file.name,
        tamanho: file.size,
        mimeType: file.type,
      });
    } else {
      enviarMensagem({
        conteudo: mensagemTexto,
        tipo: "texto",
      });
    }
  };

  if (!isAuthenticated) return <div>Carregando...</div>;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Main content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3 gap-0">
          
          {/* ===== SIDEBAR ESQUERDA - LISTA DE CONVERSAS ===== */}
          <div className="border-r bg-background flex flex-col lg:col-span-1">
            {/* Header da sidebar */}
            <div className="p-4 border-b space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Conversas</h2>
                <Button 
                  size="icon" 
                  variant="ghost"
                  onClick={() => setMostrarClientesDisp(!mostrarClientesDisp)}
                  data-testid="button-nova-conversa"
                  title="Nova conversa"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Busca de clientes */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar cliente..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9 pr-8 h-9 text-sm"
                  data-testid="input-busca-clientes"
                />
                {busca && (
                  <button
                    onClick={() => setBusca("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Dropdown - Selecionar cliente */}
            {mostrarClientesDisp && (
              <div className="p-3 border-b bg-muted/50 space-y-2 max-h-[200px] overflow-auto">
                <p className="text-xs text-muted-foreground font-semibold px-2">Clientes:</p>
                {(clientesDisponiveis as any[]).map((client: any) => (
                  <Button
                    key={client.id}
                    variant="ghost"
                    className="w-full justify-start text-left h-8 text-sm"
                    onClick={() => iniciarConversa(client.id)}
                    disabled={iniciandoConversa}
                  >
                    <span className="truncate">{client.razaoSocial || client.nome}</span>
                  </Button>
                ))}
              </div>
            )}

            {/* Lista de conversas */}
            <ScrollArea className="flex-1">
              <div className="space-y-1 p-2">
                {carregandoConversas ? (
                  <div className="flex justify-center py-8">
                    <Loader className="h-5 w-5 animate-spin" />
                  </div>
                ) : conversasFiltradas.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">Nenhuma conversa</p>
                  </div>
                ) : (
                  conversasFiltradas.map((conversa: any) => (
                    <button
                      key={conversa.id}
                      onClick={() => setConversaSelecionada(conversa.id)}
                      className={`w-full text-left p-3 rounded-lg transition-all ${
                        conversaSelecionada === conversa.id
                          ? "bg-primary/10 border-l-4 border-primary"
                          : "hover:bg-muted/50"
                      }`}
                      data-testid={`button-conversa-${conversa.id}`}
                    >
                      <div className="flex items-start gap-2">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-xs bg-primary/20">
                            {(conversa.razaoSocial || conversa.clientNome)?.[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {conversa.razaoSocial || conversa.clientNome}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {conversa.ultimaMensagem || "Sem mensagens"}
                          </div>
                          {conversa.ultimaMensagemEm && (
                            <div className="text-xs text-muted-foreground/70 mt-1">
                              {format(new Date(conversa.ultimaMensagemEm), "HH:mm", { locale: ptBR })}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* ===== AREA CENTRAL - CHAT ===== */}
          <div className="lg:col-span-2 flex flex-col bg-background">
            {conversaSelecionada && conversaAtual ? (
              <>
                {/* Header do chat */}
                <div className="border-b p-4 bg-background">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/20">
                        {(conversaAtual?.razaoSocial || conversaAtual?.clientNome)?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="font-semibold">{conversaAtual?.razaoSocial || conversaAtual?.clientNome}</h2>
                      <p className="text-xs text-muted-foreground">Cliente</p>
                    </div>
                  </div>
                </div>

                {/* Area de mensagens */}
                <ScrollArea className="flex-1 px-4 py-6">
                  <div className="space-y-4 max-w-2xl mx-auto w-full">
                    {carregandoMensagens ? (
                      <div className="flex justify-center">
                        <Loader className="h-6 w-6 animate-spin" />
                      </div>
                    ) : (mensagens as any[]).length === 0 ? (
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Nenhuma mensagem</p>
                        <p className="text-xs text-muted-foreground/70">Comece digitando abaixo →</p>
                      </div>
                    ) : (
                      [...(mensagens as any[])].reverse().map((msg: any) => (
                        <div
                          key={msg.id}
                          className={`flex gap-2 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-sm px-4 py-2 rounded-lg break-words ${
                              msg.sender === "user"
                                ? "bg-primary text-primary-foreground rounded-br-none"
                                : "bg-muted rounded-bl-none"
                            }`}
                          >
                            {/* Imagem */}
                            {msg.tipo === "imagem" && msg.arquivo && (
                              <img src={msg.arquivo} alt={msg.nomeArquivo} className="rounded max-w-xs max-h-64 mb-2" />
                            )}
                            {/* Vídeo */}
                            {msg.tipo === "video" && msg.arquivo && (
                              <video controls className="rounded max-w-xs max-h-64 mb-2">
                                <source src={msg.arquivo} type={msg.mimeType} />
                              </video>
                            )}
                            {/* Áudio */}
                            {msg.tipo === "audio" && msg.arquivo && (
                              <div className="flex items-center gap-2 mb-2">
                                <Volume2 className="h-4 w-4" />
                                <audio controls className="h-8">
                                  <source src={msg.arquivo} type={msg.mimeType} />
                                </audio>
                              </div>
                            )}
                            {/* Documento */}
                            {msg.tipo === "documento" && msg.arquivo && (
                              <div className="flex items-center gap-2 p-2 bg-white/10 rounded mb-2">
                                <FileText className="h-4 w-4" />
                                <a href={msg.arquivo} download={msg.nomeArquivo} className="text-xs underline truncate">
                                  {msg.nomeArquivo || "Documento"}
                                </a>
                              </div>
                            )}

                            {/* Texto */}
                            {msg.conteudo && (
                              <p className="text-sm leading-relaxed">{msg.conteudo}</p>
                            )}

                            {/* Hora */}
                            <span className="text-xs opacity-70 block mt-1">
                              {format(new Date(msg.createdAt), "HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                {/* Input para digitar mensagem */}
                <div className="border-t p-4 space-y-2 bg-muted/30">
                  {nomeArquivoMostrado && (
                    <div className="flex items-center justify-between bg-primary/10 p-2 rounded max-w-2xl mx-auto w-full">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        <span className="truncate">{nomeArquivoMostrado}</span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => {
                          setArquivoSelecionado(null);
                          setNomeArquivoMostrado(null);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-2 max-w-2xl mx-auto w-full">
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleArquivoSelecionado}
                      className="hidden"
                      accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
                    />

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => fileInputRef.current?.click()}
                      title="Enviar arquivo"
                      className="h-9 w-9"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>

                    <Input
                      placeholder="Digite sua mensagem aqui..."
                      value={mensagemTexto}
                      onChange={(e) => setMensagemTexto(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleEnviarMensagem();
                        }
                      }}
                      className="h-9"
                      data-testid="input-mensagem"
                    />

                    <Button
                      onClick={handleEnviarMensagem}
                      disabled={enviando || (!mensagemTexto.trim() && !arquivoSelecionado)}
                      className="h-9"
                      data-testid="button-enviar-mensagem"
                    >
                      {enviando ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full max-w-2xl mx-auto text-xs"
                    onClick={() => simularMensagemRecebida()}
                    disabled={simulando}
                  >
                    🧪 Simular resposta do cliente
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="text-lg font-semibold text-muted-foreground">Bem-vindo ao Chat!</div>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    👈 <strong>Selecione uma conversa</strong> na lateral ou clique em <strong>+</strong> para iniciar nova conversa
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
