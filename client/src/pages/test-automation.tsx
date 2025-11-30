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
  const [contractReminderResult, setContractReminderResult] = useState<any>(null);
  const [contratoEnviadoResult, setContratoEnviadoResult] = useState<any>(null);
  const [cleanupResult, setCleanupResult] = useState<any>(null);

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
    onSuccess: async (response: any) => {
      const data = await response.json();
      toast({ title: "✅ Teste simulado com sucesso!", description: data.message });
      refetchTestOpps();
      setMessage("Ótimo! Gostei da proposta");
    },
    onError: (error: any) => {
      toast({ title: "❌ Erro", description: error.message, variant: "destructive" });
    },
  });

  // Test contract reminder (1 minute timeout)
  const contractReminderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/test/contract-reminder", {
        clientId,
        userId,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setContractReminderResult(data);
      toast({ title: "✅ Registrado na Timeline!", description: `Mensagem para ${data.cliente}` });
      refetchTestOpps();
    },
    onError: (error: any) => {
      toast({ title: "❌ Erro", description: error.message, variant: "destructive" });
    },
  });

  // Test contrato enviado
  const contratoEnviadoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/test/contrato-enviado", {
        clientId,
        userId,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setContratoEnviadoResult(data);
      toast({ title: "✅ Contrato Enviado - Mensagem Registrada!", description: `Mensagem para ${data.cliente}` });
      refetchTestOpps();
    },
    onError: (error: any) => {
      toast({ title: "❌ Erro", description: error.message, variant: "destructive" });
    },
  });

  // Test aguardando aceite
  const aguardandoAceiteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/test/aguardando-aceite", {
        clientId,
        userId,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "✅ Aguardando Aceite!", description: `${data.observacao}` });
      refetchTestOpps();
    },
    onError: (error: any) => {
      toast({ title: "❌ Erro", description: error.message, variant: "destructive" });
    },
  });

  // Test 4th day auto-move to PERDIDO
  const fourthDayMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/test/contract-reminder-4th-day", {
        clientId,
        userId,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: data.opportunity.moved ? "✅ Movido para PERDIDO!" : "❌ Não moveu", 
        description: `Oportunidade: ${data.opportunity.etapaAntes} → ${data.opportunity.etapaAgora}` 
      });
      refetchTestOpps();
    },
    onError: (error: any) => {
      toast({ title: "❌ Erro", description: error.message, variant: "destructive" });
    },
  });

  // Test client status automation
  const [statusAutomationResult, setStatusAutomationResult] = useState<any>(null);
  const statusAutomationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/test/client-status-automation", {
        clientId,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setStatusAutomationResult(data);
      toast({ 
        title: data.cliente.changed ? "✅ Status Atualizado!" : "⚠️ Status Inalterado", 
        description: `${data.cliente.statusAntes} → ${data.cliente.statusDepois}` 
      });
    },
    onError: (error: any) => {
      toast({ title: "❌ Erro", description: error.message, variant: "destructive" });
    },
  });

  // Test automation checks with current time
  const [automationChecksResult, setAutomationChecksResult] = useState<any>(null);
  const automationChecksMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/test/run-automation-checks", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      setAutomationChecksResult(data);
      toast({ 
        title: "✅ Automação Checks Executado!", 
        description: `Tempo: ${data.duration} - Verifique os logs` 
      });
    },
    onError: (error: any) => {
      toast({ title: "❌ Erro", description: error.message, variant: "destructive" });
    },
  });

  // Cleanup test data
  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/test/cleanup", {});
      return res.json();
    },
    onSuccess: (data) => {
      setCleanupResult(data);
      toast({ title: "✅ Limpeza Concluída!", description: data.detalhes });
      refetchTestOpps();
      setContractReminderResult(null);
      setContratoEnviadoResult(null);
      setStatusAutomationResult(null);
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

      {/* SELEÇÃO RÁPIDA - Cliente e Vendedor */}
      {!loadingTestData && (testData.clients.length > 0 || testData.users.length > 0) && (
        <Card className="p-4 bg-purple-900/30 border-purple-500/50">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <p className="text-xs text-slate-400 mb-1">👤 Cliente Selecionado:</p>
              <p className="text-lg font-bold text-purple-300">
                {testData.clients.find((c: any) => c.id === clientId)?.nome || "Carregando..."}
              </p>
            </div>
            <div className="hidden sm:block w-px h-12 bg-slate-600"></div>
            <div>
              <p className="text-xs text-slate-400 mb-1">👨‍💼 Vendedor Selecionado:</p>
              <p className="text-lg font-bold text-blue-300">
                {testData.users.find((u: any) => u.id === userId)?.email.split("@")[0] || "Carregando..."}
              </p>
            </div>
          </div>
        </Card>
      )}

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
          <h2 className="text-xl font-bold text-white">2️⃣ Oportunidades Criadas (⏱️ Auto-refresh 3s)</h2>
          <Button
            onClick={() => refetchTestOpps()}
            variant="outline"
            size="sm"
            data-testid="button-refresh-test-opps"
          >
            🔄 Atualizar Agora
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
                  <p className="text-slate-300">
                    Etapa: <span className="text-green-400">{opp.etapa}</span>
                  </p>
                  <p className="text-slate-400">R$: {opp.valorEstimado}</p>
                </div>
              ))}
          </div>
        )}
      </Card>

      {/* Contract Reminder Test Section */}
      <Card className="p-6 bg-slate-800 border-orange-500/20">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">3️⃣ Teste Contract Reminder (1 min)</h2>
          <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-1 rounded">PROPOSTA ENVIADA</span>
        </div>

        <p className="text-slate-300 mb-4 text-xs">
          Cria uma opportunity em PROPOSTA ENVIADA com timestamp de 1 minuto atrás e executa o job automaticamente
        </p>

        <Button
          onClick={() => contractReminderMutation.mutate()}
          disabled={contractReminderMutation.isPending || !clientId || !userId}
          className="w-full bg-orange-600 hover:bg-orange-700 mb-4"
          data-testid="button-test-contract-reminder"
        >
          {contractReminderMutation.isPending ? "Executando..." : "📋 Testar Contract Reminder"}
        </Button>

        {contractReminderResult && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded">
            <p className="text-green-300 font-bold">✅ {contractReminderResult.message}</p>
            <p className="text-slate-300 text-xs mt-2">Cliente: <span className="text-slate-200">{contractReminderResult.cliente}</span></p>
            <p className="text-slate-300 text-xs">📍 Verifique na timeline do cliente em /clientes/ID</p>
          </div>
        )}
      </Card>

      {/* CONTRATO ENVIADO TEST */}
      <Card className="p-6 bg-slate-800 border-blue-500/20">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">4️⃣ Teste Contrato Enviado</h2>
          <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded">NOVO!</span>
        </div>

        <p className="text-slate-300 mb-4 text-xs">
          Move uma opportunity para CONTRATO ENVIADO e envia mensagem automática com TOKEN
        </p>

        <Button
          onClick={() => contratoEnviadoMutation.mutate()}
          disabled={contratoEnviadoMutation.isPending || !clientId || !userId}
          className="w-full bg-blue-600 hover:bg-blue-700 mb-4"
          data-testid="button-test-contrato-enviado"
        >
          {contratoEnviadoMutation.isPending ? "Enviando..." : "📄 Testar Contrato Enviado"}
        </Button>

        {contratoEnviadoResult && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded">
            <p className="text-green-300 font-bold">✅ {contratoEnviadoResult.message}</p>
            <p className="text-slate-300 text-xs mt-2">Cliente: <span className="text-slate-200">{contratoEnviadoResult.cliente}</span></p>
            <p className="text-slate-300 text-xs">Etapa: <span className="text-slate-200">{contratoEnviadoResult.oportunidade_etapa}</span></p>
            <p className="text-slate-300 text-xs">Mensagem: <span className="text-slate-200">{contratoEnviadoResult.mensagem_enviada}</span></p>
            <p className="text-slate-300 text-xs">📍 Verifique no chat do cliente em /chat</p>
          </div>
        )}
      </Card>

      {/* AGUARDANDO ACEITE TEST */}
      <Card className="p-6 bg-slate-800 border-purple-500/20">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">5️⃣ Teste Aguardando Aceite</h2>
          <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded">NOVO!</span>
        </div>

        <p className="text-slate-300 mb-4 text-xs">
          Move oportunidade para AGUARDANDO ACEITE e agenda 3 lembretes automáticos (1 por dia, sempre às 08:00)
        </p>

        <Button
          onClick={() => aguardandoAceiteMutation.mutate()}
          disabled={aguardandoAceiteMutation.isPending || !clientId || !userId}
          className="w-full bg-purple-600 hover:bg-purple-700 mb-4"
          data-testid="button-test-aguardando-aceite"
        >
          {aguardandoAceiteMutation.isPending ? "Agendando..." : "📝 Testar Aguardando Aceite"}
        </Button>
      </Card>

      {/* 4º DIA - AUTO-MOVE PERDIDO */}
      <Card className="p-6 bg-slate-800 border-red-500/20">
        <h2 className="text-xl font-bold text-white mb-4">6️⃣ Teste 4º Dia (Auto-Move PERDIDO)</h2>
        
        <p className="text-slate-300 mb-4 text-xs">
          Simula que passaram 4 dias sem resposta e o sistema automaticamente move para PERDIDO com timeline
        </p>

        <Button
          onClick={() => fourthDayMutation.mutate()}
          disabled={fourthDayMutation.isPending || !clientId || !userId}
          className="w-full bg-red-600 hover:bg-red-700"
          data-testid="button-test-4th-day"
        >
          {fourthDayMutation.isPending ? "Executando..." : "⏰ Testar 4º Dia"}
        </Button>
      </Card>

      {/* CLIENT STATUS AUTOMATION TEST */}
      <Card className="p-6 bg-slate-800 border-green-500/20">
        <h2 className="text-xl font-bold text-white mb-4">7️⃣ Teste Automação de Status do Cliente</h2>
        
        <p className="text-slate-300 mb-4 text-xs">
          Recalcula automaticamente o status do cliente baseado nas oportunidades dele. O status NUNCA é manual e sempre segue a etapa mais avançada!
        </p>

        <Button
          onClick={() => statusAutomationMutation.mutate()}
          disabled={statusAutomationMutation.isPending || !clientId}
          className="w-full bg-green-600 hover:bg-green-700 mb-4"
          data-testid="button-test-status-automation"
        >
          {statusAutomationMutation.isPending ? "Calculando..." : "🔄 Recalcular Status"}
        </Button>

        {statusAutomationResult && (
          <div className={`p-3 rounded border ${statusAutomationResult.cliente.changed ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
            <p className={`font-bold ${statusAutomationResult.cliente.changed ? 'text-green-300' : 'text-yellow-300'}`}>
              {statusAutomationResult.mensagem}
            </p>
            <p className="text-slate-300 text-xs mt-2">Cliente: <span className="text-slate-200">{statusAutomationResult.cliente.nome}</span></p>
            <p className="text-slate-300 text-xs">Status: <span className="font-bold text-cyan-300">{statusAutomationResult.cliente.statusDepois}</span></p>
            <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
              <p className="text-slate-400 text-xs font-bold">Oportunidades:</p>
              {statusAutomationResult.oportunidades.map((opp: any, idx: number) => (
                <div key={idx} className="text-slate-400 text-xs ml-2">
                  • {opp.titulo} - <span className="text-cyan-300">{opp.etapa}</span>
                </div>
              ))}
              {statusAutomationResult.oportunidades.length === 0 && (
                <p className="text-slate-500 text-xs ml-2">Sem oportunidades - Status: LEAD_QUENTE</p>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* TEST AUTOMATION CHECKS - RUN NOW */}
      <Card className="p-6 bg-slate-800 border-emerald-500/20">
        <h2 className="text-xl font-bold text-white mb-4">⏰ Testar Horários de Automação AGORA</h2>
        <p className="text-slate-300 mb-4 text-xs">
          Executa as verificações de automação imediatamente com a hora atual para testar horários comerciais e agendamentos
        </p>
        <Button
          onClick={() => automationChecksMutation.mutate()}
          disabled={automationChecksMutation.isPending}
          className="w-full bg-emerald-600 hover:bg-emerald-700 mb-4"
          data-testid="button-run-automation-checks"
        >
          {automationChecksMutation.isPending ? "Executando..." : "⏰ Executar Automação Checks AGORA"}
        </Button>

        {automationChecksResult && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded space-y-2">
            <p className="text-green-300 font-bold">✅ {automationChecksResult.message}</p>
            <p className="text-slate-300 text-xs">⏱️ Tempo: {automationChecksResult.duration}</p>
            <p className="text-slate-300 text-xs">🕐 Executado em: {automationChecksResult.horaExecucao}</p>
            <p className="text-slate-300 text-xs">📝 {automationChecksResult.info}</p>
          </div>
        )}
      </Card>

      {/* CLEANUP */}
      <Card className="p-6 bg-slate-800 border-red-500/20">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">🧹 Limpar Dados de Teste</h2>
          <span className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">CUIDADO!</span>
        </div>

        <p className="text-slate-300 mb-4 text-xs">
          Remove TODAS as mensagens de automação do chat e timelines. Útil para resetar dados de teste.
        </p>

        <Button
          onClick={() => cleanupMutation.mutate()}
          disabled={cleanupMutation.isPending}
          className="w-full bg-red-600 hover:bg-red-700 mb-4"
          data-testid="button-cleanup"
        >
          {cleanupMutation.isPending ? "Limpando..." : "🗑️ Remover Dados de Teste"}
        </Button>

        {cleanupResult && (
          <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded">
            <p className="text-orange-300 font-bold">✅ {cleanupResult.message}</p>
            <p className="text-slate-300 text-xs mt-2">Deletados: <span className="text-slate-200">{cleanupResult.detalhes}</span></p>
          </div>
        )}
      </Card>

      {/* Instructions */}
      <Card className="p-6 bg-slate-800 border-slate-700">
        <h3 className="text-lg font-bold text-white mb-3">📖 Como Usar + Regras de Status:</h3>
        <div className="space-y-4 text-sm text-slate-300">
          <div>
            <p className="font-bold text-purple-300 mb-2">Teste 1 - Simular IA:</p>
            <p>1️⃣ <span className="text-purple-300 font-bold">Selecione</span> um cliente e um vendedor</p>
            <p>2️⃣ <span className="text-purple-300 font-bold">Digite</span> uma mensagem de resposta do cliente</p>
            <p>3️⃣ <span className="text-purple-300 font-bold">Clique</span> em "🚀 Simular IA"</p>
            <p>4️⃣ <span className="text-green-300 font-bold">Automaticamente</span> a IA analisa e cria uma oportunidade</p>
          </div>
          <div>
            <p className="font-bold text-orange-300 mb-2">Teste 2 - Contract Reminder:</p>
            <p>1️⃣ <span className="text-orange-300 font-bold">Selecione</span> um cliente e um vendedor</p>
            <p>2️⃣ <span className="text-orange-300 font-bold">Clique</span> em "📋 Testar Contract Reminder"</p>
            <p>3️⃣ <span className="text-green-300 font-bold">Sistema cria</span> opportunity em PROPOSTA ENVIADA</p>
            <p>4️⃣ <span className="text-green-300 font-bold">Job executa</span> e envia cobrança automática (1 minuto = 2h real)</p>
          </div>
          <p className="mt-3 text-xs text-slate-400">Exemplos de mensagens (IA):</p>
          <ul className="list-disc list-inside text-xs text-slate-400 ml-2 space-y-1">
            <li>"OK, quero levar!" → <span className="text-green-300">Proposta</span></li>
            <li>"Não tenho interesse" → <span className="text-red-300">Perdido</span></li>
            <li>"Qual o preço?" → <span className="text-blue-300">Contato</span></li>
            <li>"Aqui é o fornecedor com NF" → <span className="text-yellow-300">Fornecedor</span></li>
          </ul>
          <p className="mt-3 text-xs text-slate-400 font-bold">📊 Regras de Status Automático:</p>
          <ul className="list-disc list-inside text-xs text-slate-400 ml-2 space-y-1">
            <li>❌ Sem oportunidades → <span className="text-purple-300">LEAD_QUENTE</span></li>
            <li>🎯 CONTATO (mais avançada) → <span className="text-blue-300">ENGAJADO</span></li>
            <li>💼 PROPOSTA/PROPOSTA ENVIADA → <span className="text-yellow-300">EM_NEGOCIACAO</span></li>
            <li>📄 AGUARDANDO CONTRATO/CONTRATO ENVIADO/AGUARDANDO ACEITE → <span className="text-orange-300">EM_FECHAMENTO</span></li>
            <li>✅ FECHADO (qualquer um) → <span className="text-green-300">ATIVO</span></li>
            <li>❌ Todas PERDIDAS → <span className="text-red-300">PERDIDO</span></li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
