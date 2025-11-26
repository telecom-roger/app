import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Plus, Image as ImageIcon, Loader } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

  // Get conversations
  const { data: conversas = [], isLoading: carregandoConversas } = useQuery({
    queryKey: ["/api/chat/conversations"],
    enabled: isAuthenticated,
  });

  // Get messages for selected conversation
  const { data: mensagens = [], isLoading: carregandoMensagens } = useQuery({
    queryKey: ["/api/chat/messages", conversaSelecionada],
    enabled: isAuthenticated && !!conversaSelecionada,
  });

  // Send message mutation
  const { mutate: enviarMensagem, isPending: enviando } = useMutation({
    mutationFn: async (dados: any) => {
      const response = await apiRequest(
        `/api/chat/messages/${conversaSelecionada}`,
        { method: "POST", body: JSON.stringify(dados) }
      );
      return response;
    },
    onSuccess: () => {
      setMensagemTexto("");
      setArquivoSelecionado(null);
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/messages", conversaSelecionada],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/conversations"],
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

  const handleEnviarMensagem = () => {
    if (!conversaSelecionada) return;
    if (!mensagemTexto.trim() && !arquivoSelecionado) return;

    enviarMensagem({
      conteudo: mensagemTexto || "",
      tipo: arquivoSelecionado ? "documento" : "texto",
    });
  };

  if (!isAuthenticated) return <div>Carregando...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Chat com Clientes</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[600px]">
        {/* Lista de conversas */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex justify-between items-center">
              <span>Conversas</span>
              <Button size="icon" variant="ghost">
                <Plus className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[520px]">
              <div className="space-y-1 p-4">
                {carregandoConversas ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader className="h-6 w-6 animate-spin" />
                  </div>
                ) : conversas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma conversa</p>
                ) : (
                  conversas.map((conversa: Conversation) => (
                    <button
                      key={conversa.id}
                      onClick={() => setConversaSelecionada(conversa.id)}
                      className={`w-full text-left p-3 rounded-md transition ${
                        conversaSelecionada === conversa.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                      data-testid={`button-conversa-${conversa.id}`}
                    >
                      <div className="font-medium text-sm truncate">
                        {conversa.clientNome}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {conversa.ultimaMensagem}
                      </div>
                      {conversa.ultimaMensagemEm && (
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(conversa.ultimaMensagemEm), "HH:mm", {
                            locale: ptBR,
                          })}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat */}
        <Card className="lg:col-span-3">
          {conversaSelecionada ? (
            <>
              <CardContent className="p-4 h-[520px] flex flex-col">
                {/* Mensagens */}
                <ScrollArea className="flex-1 mb-4 border rounded-md p-4">
                  <div className="space-y-3">
                    {carregandoMensagens ? (
                      <div className="flex items-center justify-center h-32">
                        <Loader className="h-6 w-6 animate-spin" />
                      </div>
                    ) : mensagens.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center">
                        Nenhuma mensagem
                      </p>
                    ) : (
                      [...mensagens].reverse().map((msg: Message) => (
                        <div
                          key={msg.id}
                          className={`flex ${
                            msg.sender === "user" ? "justify-end" : "justify-start"
                          }`}
                          data-testid={`message-${msg.id}`}
                        >
                          <div
                            className={`max-w-xs px-3 py-2 rounded-md ${
                              msg.sender === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            {msg.conteudo && (
                              <p className="text-sm">{msg.conteudo}</p>
                            )}
                            {msg.tipo !== "texto" && (
                              <p className="text-xs opacity-75">
                                [{msg.tipo.toUpperCase()}]
                              </p>
                            )}
                            <span className="text-xs opacity-75">
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

                {/* Input */}
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    data-testid="button-upload-arquivo"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={mensagemTexto}
                    onChange={(e) => setMensagemTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleEnviarMensagem();
                      }
                    }}
                    data-testid="input-mensagem"
                  />
                  <Button
                    onClick={handleEnviarMensagem}
                    disabled={
                      enviando ||
                      (!mensagemTexto.trim() && !arquivoSelecionado)
                    }
                    data-testid="button-enviar-mensagem"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="p-4 h-[520px] flex items-center justify-center">
              <p className="text-muted-foreground">
                Selecione uma conversa para começar
              </p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
