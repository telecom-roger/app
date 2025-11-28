import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function TestAutomation() {
  const { toast } = useToast();
  const [clientId, setClientId] = useState("925a3eb3-c22d-42fe-bab2-c5f4d3e8b1a7");
  const [userId, setUserId] = useState("187f6e5e-e5b9-4232-9dac-42296aa84414");
  const [message, setMessage] = useState("Ótimo! Gostei da proposta");

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
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Client ID</label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 text-xs"
              data-testid="input-client-id"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">User ID</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 text-xs"
              data-testid="input-user-id"
            />
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
            disabled={simulateMutation.isPending}
            className="w-full bg-purple-600 hover:bg-purple-700"
            data-testid="button-simulate"
          >
            {simulateMutation.isPending ? "Simulando..." : "🚀 Simular Resposta"}
          </Button>
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
        <h3 className="text-lg font-bold text-white mb-3">📖 Como Funciona:</h3>
        <ul className="space-y-2 text-slate-300 text-sm">
          <li>✅ Clique em "Simular Resposta" para criar uma resposta de cliente</li>
          <li>✅ Isso automaticamente cria 3 follow-ups (1, 3, 7 dias)</li>
          <li>✅ Clique em "Atualizar" para ver as tarefas sendo processadas</li>
          <li>✅ A cada 5 minutos, o cron job executa as tarefas pendentes</li>
          <li>✅ Veja os logs do servidor para confirmar a execução</li>
        </ul>
      </Card>
    </div>
  );
}
