import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function TestAutomation() {
  const { toast } = useToast();
  const [clientId, setClientId] = useState("");
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("Ótimo! Gostei da proposta");

  // Get clients and users list
  const { data: testData = { clients: [], users: [] }, isLoading: loadingTestData } = useQuery({
    queryKey: ["/api/test/clients-list"],
    queryFn: async () => {
      const response = await fetch("/api/test/clients-list");
      return response.json();
    },
  });

  // Auto-set first client and user
  if (testData.clients.length > 0 && !clientId && testData.clients[0]?.id) {
    setClientId(testData.clients[0].id);
  }
  if (testData.users.length > 0 && !userId && testData.users[0]?.id) {
    setUserId(testData.users[0].id);
  }

  // Simulate response
  const simulateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/test/simulate-response", {
        clientId,
        userId,
        messageText: message,
      });
    },
    onSuccess: (data) => {
      toast({ title: "✅ Teste simulado com sucesso!", description: data.message });
      refetchTestOpps();
    },
    onError: (error: any) => {
      toast({ title: "❌ Erro", description: error.message, variant: "destructive" });
    },
  });



  // Get test opportunities
  const { data: testOpps = [], refetch: refetchTestOpps, isLoading: loadingTestOpps } = useQuery({
    queryKey: ["/api/test/opportunities"],
    refetchInterval: 3000, // Auto-refresh para testes
    queryFn: async () => {
      const response = await fetch("/api/test/opportunities");
      return response.json();
    },
  });

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-900 to-slate-800 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">🧪 Teste de Automação com IA</h1>
        <p className="text-slate-300">Simule respostas de clientes e veja a IA criar oportunidades automaticamente</p>
      </div>

      {/* Input Section */}
      <Card className="p-6 bg-slate-800 border-purple-500/20">
        <h2 className="text-xl font-bold text-white mb-4">1️⃣ Simular Resposta do Cliente</h2>
        
        {loadingTestData && <p className="text-slate-300 mb-4">Carregando clientes...</p>}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Cliente</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 text-xs"
              data-testid="select-client"
            >
              <option value="">Selecionar cliente...</option>
              {testData.clients.map((client: any) => (
                <option key={client.id} value={client.id}>
                  {client.nome} ({client.id.slice(0, 8)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Vendedor</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 text-xs"
              data-testid="select-user"
            >
              <option value="">Selecionar vendedor...</option>
              {testData.users.map((user: any) => (
                <option key={user.id} value={user.id}>
                  {user.email} ({user.id.slice(0, 8)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Mensagem</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 text-xs"
              rows={3}
              data-testid="input-message"
            />
          </div>

          <Button
            onClick={() => simulateMutation.mutate()}
            disabled={simulateMutation.isPending || !clientId || !userId}
            className="w-full bg-purple-600 hover:bg-purple-700"
            data-testid="button-simulate"
          >
            {simulateMutation.isPending ? "Processando IA..." : "🚀 Simular IA"}
          </Button>
        </div>
      </Card>

      {/* Test Opportunities Section */}
      <Card className="p-6 bg-slate-800 border-cyan-500/20">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">2️⃣ Oportunidades Criadas (Teste)</h2>
          <Button
            onClick={() => refetchTestOpps()}
            variant="outline"
            size="sm"
            data-testid="button-refresh-test-opps"
          >
            🔄 Atualizar
          </Button>
        </div>

        {loadingTestOpps ? (
          <p className="text-slate-400">Carregando...</p>
        ) : testOpps.length === 0 ? (
          <p className="text-slate-400">Nenhuma oportunidade</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {testOpps
              .filter((opp: any) => !opp.titulo?.includes("Test Kanban"))
              .slice(0, 10)
              .map((opp: any) => (
                <div
                  key={opp.id}
                  className="p-3 bg-slate-700/50 rounded border border-cyan-500/30 text-xs"
                  data-testid={`test-opp-${opp.id}`}
                >
                  <p className="text-cyan-300 font-bold">{opp.titulo}</p>
                  <p className="text-slate-300">Etapa: <span className="text-green-400">{opp.etapa}</span></p>
                  <p className="text-slate-400">R$: {opp.valorEstimado}</p>
                </div>
              ))}
          </div>
        )}
      </Card>

      {/* Instructions */}
      <Card className="p-6 bg-slate-800 border-slate-700">
        <h3 className="text-lg font-bold text-white mb-3">📖 Como Usar:</h3>
        <div className="space-y-4 text-sm text-slate-300">
          <p>1️⃣ <span className="text-purple-300 font-bold">Selecione</span> um cliente e um vendedor</p>
          <p>2️⃣ <span className="text-purple-300 font-bold">Digite</span> uma mensagem de resposta do cliente</p>
          <p>3️⃣ <span className="text-purple-300 font-bold">Clique</span> em "🚀 Simular IA"</p>
          <p>4️⃣ <span className="text-green-300 font-bold">Automaticamente</span> a IA analisa e cria uma oportunidade na etapa correta</p>
          <p className="mt-3 text-xs text-slate-400">Exemplos de mensagens:</p>
          <ul className="list-disc list-inside text-xs text-slate-400 ml-2 space-y-1">
            <li>"OK, quero levar!" → <span className="text-green-300">Proposta</span></li>
            <li>"Não tenho interesse" → <span className="text-red-300">Perdido</span></li>
            <li>"Qual o preço?" → <span className="text-blue-300">Lead</span></li>
            <li>"Aqui é o fornecedor com NF" → <span className="text-yellow-300">Fornecedor</span></li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
