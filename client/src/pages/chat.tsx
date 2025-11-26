import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Plus, Image as ImageIcon, Loader, Search, X, FileText, Volume2, Video, Paperclip, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Conversation {
  id: string;
  clientId: string;
  userId: string;
  clientNome: string;
  ultimaMensagem?: string;
  ultimaMensagemEm?: string;
}

interface Message {
  id: string;
  conversationId: string;
  sender: "user" | "client";
  tipo: "texto" | "imagem" | "audio" | "video" | "documento";
  conteudo?: string;
  arquivo?: string;
  nomeArquivo?: string;
  createdAt: string;
}

export default function Chat() {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [conversaSelecionada, setConversaSelecionada] = useState<string | null>(null);
  const [mensagemTexto, setMensagemTexto] = useState("");
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [mostrarClientesDisp, setMostrarClientesDisp] = useState(false);
  const [clientesSelecionaveis, setClientesSelecionaveis] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nomeArquivoMostrado, setNomeArquivoMostrado] = useState<string | null>(null);
  const [sidebarAberto, setSidebarAberto] = useState(true);

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
    onError: () => {
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
        throw new Error("Erro ao iniciar conversa");
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
        description: "Erro ao iniciar conversa",
        variant: "destructive",
      });
    },
  });

  // Test receive message mutation
  const { mutate: simularMensagemRecebida, isPending: simulando } = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/chat/test/receive-message/${conversaSelecionada}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conteudo: "Obrigado, já recebi sua mensagem!" }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/messages", conversaSelecionada],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/conversations"],
      });
      toast({
        title: "Mensagem recebida",
        description: "Teste: mensagem do cliente simulada",
      });
    },
  });

  // Filter clients by search (for new conversations)
  const clientesFiltrados = useMemo(() => {
    if (!busca) return [];
    const buscaLower = busca.toLowerCase();
    return (clientesDisponiveis as any[]).filter(
      (client) =>
        client.nome?.toLowerCase().includes(buscaLower) ||
        client.razaoSocial?.toLowerCase().includes(buscaLower) ||
        client.telefone?.toLowerCase().includes(buscaLower) ||
        client.cpfCnpj?.toLowerCase().includes(buscaLower)
    );
  }, [clientesDisponiveis, busca]);

  // Filter conversations by search
  const conversasFiltradas = useMemo(() => {
    if (!busca) return conversas;
    return (conversas as any[]).filter(
      (conv) =>
        conv.clientNome?.toLowerCase().includes(busca.toLowerCase()) ||
        conv.razaoSocial?.toLowerCase().includes(busca.toLowerCase()) ||
        conv.ultimaMensagem?.toLowerCase().includes(busca.toLowerCase())
    );
  }, [conversas, busca]);

  // Get current conversation details
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
      
      // Detectar tipo de arquivo
      let tipo = "documento";
      if (file.type.startsWith("image/")) tipo = "imagem";
      else if (file.type.startsWith("audio/")) tipo = "audio";
      else if (file.type.startsWith("video/")) tipo = "video";

      // Armazenar no estado com metadados
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
      // Enviar com arquivo
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
      // Enviar texto simples
      enviarMensagem({
        conteudo: mensagemTexto,
        tipo: "texto",
      });
    }
  };

  if (!isAuthenticated) return <div>Carregando...</div>;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b p-4 bg-background">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold">Mensagens</h1>
          <p className="text-xs text-muted-foreground">Gerencie suas conversas com clientes</p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 h-full gap-0">
          {/* Sidebar - Lista de conversas */}
          <div className="lg:col-span-1 border-r flex flex-col bg-background">
            {/* Header da sidebar */}
            <div className="p-4 border-b space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm">Conversas</h2>
                <Button 
                  size="icon" 
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setMostrarClientesDisp(!mostrarClientesDisp)}
                  data-testid="button-nova-conversa"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Busca */}
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
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            </div>

            {/* Nova conversa dropdown */}
            {mostrarClientesDisp && (
              <div className="p-3 border-b bg-muted/50 space-y-2 max-h-[200px] overflow-auto">
                <p className="text-xs text-muted-foreground font-semibold px-2">Selecione cliente:</p>
                {(clientesDisponiveis as any[]).map((client: any) => (
                  <Button
                    key={client.id}
                    variant="ghost"
                    className="w-full justify-start text-left h-8 text-sm"
                    onClick={() => iniciarConversa(client.id)}
                    disabled={iniciandoConversa}
                    data-testid={`button-select-client-${client.id}`}
                  >
                    <span className="truncate">{client.nome}</span>
                  </Button>
                ))}
              </div>
            )}

            {/* Lista de conversas e clientes */}
            <ScrollArea className="flex-1">
              <div className="space-y-1 p-2">
                {carregandoConversas ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader className="h-6 w-6 animate-spin" />
                  </div>
                ) : busca && clientesFiltrados.length > 0 ? (
                  <>
                    {/* Clientes disponíveis para nova conversa */}
                    <div className="px-2 py-2">
                      <p className="text-xs text-muted-foreground font-semibold mb-2">Iniciar nova conversa:</p>
                      {clientesFiltrados.map((cliente: any) => (
                        <button
                          key={`new-${cliente.id}`}
                          onClick={() => iniciarConversa(cliente.id)}
                          disabled={iniciandoConversa}
                          className="w-full text-left p-3 rounded-lg transition-all duration-200 hover:bg-muted/50 mb-2 border border-primary/20"
                          data-testid={`button-novo-cliente-${cliente.id}`}
                        >
                          <div className="flex items-start gap-2">
                            <Avatar className="h-9 w-9 flex-shrink-0">
                              <AvatarFallback className="text-xs font-bold bg-primary/20">
                                {(cliente.razaoSocial || cliente.nome)?.[0]?.toUpperCase() || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate text-primary">
                                {cliente.razaoSocial || cliente.nome}
                              </div>
                              {cliente.telefone && (
                                <div className="text-xs text-muted-foreground truncate">
                                  📞 {cliente.telefone}
                                </div>
                              )}
                              {cliente.cpfCnpj && (
                                <div className="text-xs text-muted-foreground truncate">
                                  🔖 {cliente.cpfCnpj}
                                </div>
                              )}
                              <div className="text-xs text-primary/70 mt-1">+ Novo chat</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    {conversasFiltradas.length > 0 && (
                      <>
                        <div className="px-2 py-2 mt-2">
                          <p className="text-xs text-muted-foreground font-semibold">Conversas existentes:</p>
                        </div>
                      </>
                    )}
                  </>
                ) : null}
                
                {/* Conversas existentes */}
                {conversasFiltradas.length === 0 && !busca ? (
                  <p className="text-xs text-muted-foreground text-center p-4">Nenhuma conversa</p>
                ) : conversasFiltradas.length === 0 && busca ? (
                  <p className="text-xs text-muted-foreground text-center p-4">Nenhuma conversa encontrada</p>
                ) : (
                  conversasFiltradas.map((conversa: any) => (
                    <button
                      key={conversa.id}
                      onClick={() => setConversaSelecionada(conversa.id)}
                      className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                        conversaSelecionada === conversa.id
                          ? "bg-primary/10 border-l-4 border-primary"
                          : "hover:bg-muted/50"
                      }`}
                      data-testid={`button-conversa-${conversa.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10 mt-1">
                          <AvatarFallback className="text-xs font-bold bg-primary/20">
                            {(conversa.razaoSocial || conversa.clientNome)?.[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {conversa.razaoSocial || conversa.clientNome}
                          </div>
                          <div className="text-xs text-muted-foreground truncate line-clamp-1">
                            {conversa.ultimaMensagem || "Sem mensagens"}
                          </div>
                          {conversa.ultimaMensagemEm && (
                            <div className="text-xs text-muted-foreground/70 mt-1">
                              {format(new Date(conversa.ultimaMensagemEm), "HH:mm", {
                                locale: ptBR,
                              })}
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

          {/* Chat area */}
          <div className="lg:col-span-2 flex flex-col bg-background">
            {conversaSelecionada ? (
              <>
                {/* Chat Header */}
                <div className="border-b p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/20 font-bold">
                        {(conversaAtual?.razaoSocial || conversaAtual?.clientNome)?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="font-semibold text-sm">{conversaAtual?.razaoSocial || conversaAtual?.clientNome}</h2>
                      <p className="text-xs text-muted-foreground">Cliente</p>
                    </div>
                  </div>
                </div>

                {/* Messages Area */}
                <ScrollArea className="flex-1 px-4 py-6">
                  <div className="space-y-4 max-w-2xl mx-auto">
                    {carregandoMensagens ? (
                      <div className="flex items-center justify-center h-32">
                        <Loader className="h-6 w-6 animate-spin" />
                      </div>
                    ) : (mensagens as any[]).length === 0 ? (
                      <div className="flex items-center justify-center h-32 text-center">
                        <div>
                          <p className="text-sm text-muted-foreground">Nenhuma mensagem</p>
                          <p className="text-xs text-muted-foreground/70">Comece a conversa!</p>
                        </div>
                      </div>
                    ) : (
                      [...(mensagens as any[])].reverse().map((msg: any) => (
                        <div
                          key={msg.id}
                          className={`flex gap-2 ${
                            msg.sender === "user" ? "justify-end" : "justify-start"
                          }`}
                          data-testid={`message-${msg.id}`}
                        >
                          <div
                            className={`max-w-sm px-4 py-2 rounded-lg break-words ${
                              msg.sender === "user"
                                ? "bg-primary text-primary-foreground rounded-br-none"
                                : "bg-muted rounded-bl-none"
                            }`}
                          >
                            {/* Renderizar mídia */}
                            {msg.tipo === "imagem" && msg.arquivo && (
                              <div className="mb-2">
                                <img 
                                  src={msg.arquivo} 
                                  alt={msg.nomeArquivo}
                                  className="rounded-md max-w-xs max-h-64 object-cover"
                                />
                              </div>
                            )}
                            {msg.tipo === "video" && msg.arquivo && (
                              <div className="mb-2">
                                <video 
                                  controls 
                                  className="rounded-md max-w-xs max-h-64"
                                >
                                  <source src={msg.arquivo} type={msg.mimeType} />
                                </video>
                              </div>
                            )}
                            {msg.tipo === "audio" && msg.arquivo && (
                              <div className="mb-2 flex items-center gap-2">
                                <Volume2 className="h-4 w-4" />
                                <audio 
                                  controls 
                                  className="h-8"
                                >
                                  <source src={msg.arquivo} type={msg.mimeType} />
                                </audio>
                              </div>
                            )}
                            {msg.tipo === "documento" && msg.arquivo && (
                              <div className="mb-2 flex items-center gap-2 p-2 bg-white/10 rounded">
                                <FileText className="h-4 w-4" />
                                <a 
                                  href={msg.arquivo}
                                  download={msg.nomeArquivo}
                                  className="text-xs underline truncate"
                                >
                                  {msg.nomeArquivo || "Documento"}
                                </a>
                              </div>
                            )}

                            {/* Texto da mensagem */}
                            {msg.conteudo && msg.tipo === "texto" && (
                              <p className="text-sm leading-relaxed">{msg.conteudo}</p>
                            )}
                            {msg.conteudo && msg.tipo !== "texto" && (
                              <p className="text-xs opacity-70">{msg.conteudo}</p>
                            )}

                            {/* Timestamp */}
                            <span className="text-xs opacity-70 block mt-1">
                              {format(new Date(msg.createdAt), "HH:mm", {
                                locale: ptBR,
                              })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="border-t p-4 space-y-2 bg-muted/30">
                  {/* Arquivo selecionado preview */}
                  {nomeArquivoMostrado && (
                    <div className="flex items-center justify-between bg-primary/10 p-2 rounded-lg max-w-2xl mx-auto w-full">
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

                  <div className="flex gap-2 max-w-2xl mx-auto">
                    {/* File input hidden */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleArquivoSelecionado}
                      className="hidden"
                      data-testid="input-arquivo"
                      accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                    />

                    {/* Upload button */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-upload-arquivo"
                      title="Enviar arquivo (imagem, áudio, vídeo, documento)"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>

                    {/* Message input */}
                    <Input
                      placeholder="Escreva uma mensagem..."
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

                    {/* Send button */}
                    <Button
                      onClick={handleEnviarMensagem}
                      disabled={
                        enviando ||
                        (!mensagemTexto.trim() && !arquivoSelecionado)
                      }
                      className="h-9"
                      data-testid="button-enviar-mensagem"
                    >
                      {enviando ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* Test button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full max-w-2xl mx-auto text-xs"
                    onClick={() => simularMensagemRecebida()}
                    disabled={simulando || !conversaSelecionada}
                    data-testid="button-teste-receber"
                  >
                    🧪 Teste: Simular resposta
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium text-muted-foreground">Nenhuma conversa selecionada</p>
                  <p className="text-sm text-muted-foreground/70">Escolha um cliente ou comece uma nova conversa</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
