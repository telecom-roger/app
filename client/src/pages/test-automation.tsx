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
      refetchTasks();
      refetchFollowUps();
      refetchScores();
    },
    onError: (error: any) => {
      toast({ title: "❌ Erro", description: error.message, variant: "destructive" });
    },
  });

  // Quick follow-ups (1, 2, 3 minutos)
  const quickFollowupsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/test/quick-followups", {
        clientId,
        userId,
      });
    },
    onSuccess: (data) => {
      toast({ title: "⚡ Follow-ups rápidos criados!", description: data.message });
      refetchTasks();
    },
    onError: (error: any) => {
      toast({ title: "❌ Erro", description: error.message, variant: "destructive" });
    },
  });

  // Kanban movement
  const kanbanMovementMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/test/kanban-movement", {
        clientId,
        userId,
      });
    },
    onSuccess: (data) => {
      toast({ title: "📊 Movimento Kanban agendado!", description: data.message });
      refetchTasks();
    },
    onError: (error: any) => {
      toast({ title: "❌ Erro", description: error.message, variant: "destructive" });
    },
  });

  // Get automation tasks
  const { data: tasks = [], refetch: refetchTasks, isLoading: loadingTasks } = useQuery({
    queryKey: ["/api/test/automation-tasks"],
    queryFn: async () => {
      const response = await fetch("/api/test/automation-tasks");
      return response.json();
    },
  });

  // Get follow-ups
  const { data: followups = [], refetch: refetchFollowUps, isLoading: loadingFollowUps } = useQuery({
    queryKey: ["/api/test/follow-ups"],
    queryFn: async () => {
      const response = await fetch("/api/test/follow-ups");
      return response.json();
    },
  });

  // Get client scores
  const { data: scores = [], refetch: refetchScores, isLoading: loadingScores } = useQuery({
    queryKey: ["/api/test/client-scores"],
    queryFn: async () => {
      const response = await fetch("/api/test/client-scores");
      return response.json();
    },
  });

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-900 to-slate-800 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">🧪 Teste de Automação</h1>
        <p className="text-slate-300">Simule respostas de clientes e veja a automação em tempo real</p>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Button
              onClick={() => simulateMutation.mutate()}
              disabled={simulateMutation.isPending || !clientId || !userId}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="button-simulate"
            >
              {simulateMutation.isPending ? "..." : "🚀 Resposta"}
            </Button>

            <Button
              onClick={() => quickFollowupsMutation.mutate()}
              disabled={quickFollowupsMutation.isPending || !clientId || !userId}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-quick-followups"
            >
              {quickFollowupsMutation.isPending ? "..." : "⚡ Quick Follow-ups"}
            </Button>

            <Button
              onClick={() => kanbanMovementMutation.mutate()}
              disabled={kanbanMovementMutation.isPending || !clientId || !userId}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-kanban-movement"
            >
              {kanbanMovementMutation.isPending ? "..." : "📊 Kanban Move"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Tasks Section */}
      <Card className="p-6 bg-slate-800 border-blue-500/20">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">2️⃣ Tarefas de Automação</h2>
          <Button
            onClick={() => refetchTasks()}
            variant="outline"
            size="sm"
            data-testid="button-refresh-tasks"
          >
            🔄 Atualizar
          </Button>
        </div>

        {loadingTasks ? (
          <p className="text-slate-400">Carregando...</p>
        ) : tasks.length === 0 ? (
          <p className="text-slate-400">Nenhuma tarefa agendada ainda</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {tasks.map((task: any) => (
              <div
                key={task.id}
                className="p-3 bg-slate-700/50 rounded border border-blue-500/30 text-xs"
                data-testid={`task-${task.id}`}
              >
                <p className="text-blue-300 font-bold">{task.tipo}</p>
                <p className="text-slate-300">Status: {task.status}</p>
                <p className="text-slate-400">Próx. exec: {new Date(task.proximaExecucao).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Follow-ups Section */}
      <Card className="p-6 bg-slate-800 border-green-500/20">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">3️⃣ Follow-ups Registrados</h2>
          <Button
            onClick={() => refetchFollowUps()}
            variant="outline"
            size="sm"
            data-testid="button-refresh-followups"
          >
            🔄 Atualizar
          </Button>
        </div>

        {loadingFollowUps ? (
          <p className="text-slate-400">Carregando...</p>
        ) : followups.length === 0 ? (
          <p className="text-slate-400">Nenhum follow-up registrado ainda</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {followups.map((fu: any) => (
              <div
                key={fu.id}
                className="p-3 bg-slate-700/50 rounded border border-green-500/30 text-xs"
                data-testid={`followup-${fu.id}`}
              >
                <p className="text-green-300 font-bold">Follow-up #{fu.numero}</p>
                <p className="text-slate-300">Cliente ID: {fu.clientId}</p>
                <p className="text-slate-400">Executado em: {new Date(fu.executadoEm).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Scores Section */}
      <Card className="p-6 bg-slate-800 border-yellow-500/20">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">4️⃣ Scores dos Clientes</h2>
          <Button
            onClick={() => refetchScores()}
            variant="outline"
            size="sm"
            data-testid="button-refresh-scores"
          >
            🔄 Atualizar
          </Button>
        </div>

        {loadingScores ? (
          <p className="text-slate-400">Carregando...</p>
        ) : scores.length === 0 ? (
          <p className="text-slate-400">Nenhum score calculado ainda</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {scores.map((score: any) => (
              <div
                key={score.id}
                className="p-3 bg-slate-700/50 rounded border border-yellow-500/30 text-xs"
                data-testid={`score-${score.id}`}
              >
                <p className="text-yellow-300 font-bold">Score Total: {score.scoreTotal}/100</p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-slate-300">
                  <p>IA: {score.scoreIA}</p>
                  <p>Contato: {score.scoreContato}</p>
                  <p>Engajamento: {score.scoreEngajamento}</p>
                  <p>Potencial: {score.scorePotencial}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Instructions */}
      <Card className="p-6 bg-slate-800 border-slate-700">
        <h3 className="text-lg font-bold text-white mb-3">📖 3 Modos de Teste:</h3>
        <div className="space-y-4 text-sm">
          <div className="border-l-4 border-purple-500 pl-4 py-2">
            <p className="font-bold text-purple-300">🚀 Simular Resposta (Padrão)</p>
            <p className="text-slate-300">Cria 3 follow-ups normais (1 dia, 3 dias, 7 dias)</p>
          </div>
          <div className="border-l-4 border-blue-500 pl-4 py-2">
            <p className="font-bold text-blue-300">⚡ Quick Follow-ups (TESTE RÁPIDO)</p>
            <p className="text-slate-300">Cria 3 follow-ups em intervalos PEQUENOS: 1 min, 2 min, 3 min</p>
            <p className="text-slate-400 text-xs mt-1">Você verá as notificações em poucos minutos!</p>
          </div>
          <div className="border-l-4 border-green-500 pl-4 py-2">
            <p className="font-bold text-green-300">📊 Kanban Move (TESTE VISUAL)</p>
            <p className="text-slate-300">Move automaticamente oportunidades: Lead → Contato → Proposta → Fechado</p>
            <p className="text-slate-400 text-xs mt-1">Cada movimento em 1, 2, 3 minutos. Veja no Kanban mudando!</p>
          </div>
        </div>
      </Card>

      {/* Live Monitoring */}
      <Card className="p-6 bg-slate-800 border-slate-700">
        <h3 className="text-lg font-bold text-white mb-3">🔴 Monitoramento em Tempo Real:</h3>
        <div className="bg-slate-900 p-4 rounded font-mono text-xs text-slate-300 space-y-1">
          <p>✅ Tarefas agendadas: <span className="text-blue-400">{tasks.length}</span></p>
          <p>✅ Follow-ups executados: <span className="text-green-400">{followups.length}</span></p>
          <p>✅ Clientes com score: <span className="text-yellow-400">{scores.length}</span></p>
          <p className="text-slate-500 text-[11px] mt-3">Clique em "Atualizar" para ver mudanças em tempo real</p>
        </div>
      </Card>
    </div>
  );
}
