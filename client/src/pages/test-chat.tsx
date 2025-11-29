import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

export default function TestChat() {
  const [selectedConvId, setSelectedConvId] = useState("");
  const [testResults, setTestResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch conversations
  const { data: conversations = [], isLoading: convsLoading } = useQuery<any[]>({
    queryKey: ["/api/chat/conversations"],
    refetchInterval: 2000,
  });

  // Test mutation
  const testMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      if (!conversationId) {
        throw new Error("Selecione uma conversa");
      }
      setIsLoading(true);
      const res = await apiRequest("POST", "/api/chat/test/send-receive", {
        conversationId,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setTestResults(data);
      setIsLoading(false);
    },
    onError: (error: any) => {
      setTestResults({ error: error.message });
      setIsLoading(false);
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🧪 Teste de Chat</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Conversas */}
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4">Conversas Disponíveis</h2>
          {convsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conversa disponível</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedConvId === conv.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                  data-testid={`button-test-conv-${conv.id}`}
                >
                  <p className="font-medium truncate">{conv.client?.nome || "Sem nome"}</p>
                  <p className="text-xs opacity-75 truncate">
                    {conv.client?.celular || conv.id.substring(0, 8)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Teste */}
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4">Executar Teste</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Conversa Selecionada</label>
              <Input
                value={selectedConvId}
                onChange={(e) => setSelectedConvId(e.target.value)}
                placeholder="ID da conversa"
                className="font-mono text-xs"
                data-testid="input-conv-id"
              />
            </div>
            <Button
              onClick={() => testMutation.mutate(selectedConvId)}
              disabled={!selectedConvId || isLoading}
              className="w-full"
              data-testid="button-start-test"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Testando...
                </>
              ) : (
                "▶️ Iniciar Teste"
              )}
            </Button>
          </div>
        </Card>
      </div>

      {/* Resultados */}
      {testResults && (
        <Card className="p-6 mt-6">
          <h2 className="text-lg font-semibold mb-4">📊 Resultados do Teste</h2>
          
          {testResults.error ? (
            <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
              <p className="text-red-900 dark:text-red-200 font-semibold">❌ Erro</p>
              <p className="text-red-800 dark:text-red-300 text-sm mt-1">{testResults.error}</p>
            </div>
          ) : (
            <>
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg mb-4">
                <p className="text-green-900 dark:text-green-200 font-semibold">✅ Teste Concluído</p>
              </div>

              {/* Logs */}
              <div className="space-y-3">
                {testResults.logs?.map((log: any, idx: number) => (
                  <div key={idx} className="bg-slate-100 dark:bg-slate-900 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-bold">
                        {log.step ? `Step ${log.step}` : log.status}
                      </span>
                      <span className={`text-xs font-semibold ${log.status === "OK" ? "text-green-600" : "text-blue-600"}`}>
                        {log.status || (log.step ? "OK" : "")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">{log.action}</p>
                    <pre className="text-xs bg-slate-50 dark:bg-slate-800 p-2 rounded overflow-auto max-h-32">
                      {JSON.stringify(log, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>

              {/* Mensagens */}
              {testResults.messages && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <h3 className="font-semibold mb-3">💬 Mensagens Criadas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                      <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">Enviada (Agent)</p>
                      <p className="text-xs text-blue-800 dark:text-blue-300 mt-1">
                        {testResults.messages.sent?.conteudo}
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">
                        ID: {testResults.messages.sent?.id?.substring(0, 8)}
                      </p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                      <p className="text-xs font-semibold text-green-900 dark:text-green-200">Recebida (Client)</p>
                      <p className="text-xs text-green-800 dark:text-green-300 mt-1">
                        {testResults.messages.received?.conteudo}
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-400 mt-2">
                        ID: {testResults.messages.received?.id?.substring(0, 8)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
