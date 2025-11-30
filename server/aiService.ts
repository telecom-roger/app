import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface MessageAnalysis {
  sentimento: "positivo" | "negativo" | "neutro";
  confianca: number;
  motivo: string;
  intenção: "solicitacao_info" | "aprovacao_envio" | "resposta_automatica" | "rejeicao_clara" | "rejeicao_parcial" | "indefinida";
  etapa: "CONTATO" | "PROPOSTA" | "AUTOMÁTICA" | "PERDIDO" | "";
  deveAgir: boolean; // true = movimento permitido, false = bloqueado
  ehRecusaParcial: boolean;
  ehMensagemAutomatica: boolean;
  sugestao: string;
}

// 🎯 REGRAS DE MOVIMENTO IA POR ETAPA
const AI_MOVEMENT_RULES: Record<string, string[]> = {
  "LEAD": ["CONTATO", "PROPOSTA", "FORNECEDOR", "PERDIDO"],
  "CONTATO": ["PROPOSTA", "PERDIDO"],
  "PROPOSTA": [], // IA PROIBIDO
  "PROPOSTA ENVIADA": [], // IA PROIBIDO
  "AGUARDANDO CONTRATO": [], // IA PROIBIDO
  "CONTRATO ENVIADO": [], // IA PROIBIDO
  "AGUARDANDO ACEITE": [], // IA PROIBIDO
  "AGUARDANDO ATENÇÃO": [], // IA PROIBIDO
  "FECHADO": [], // IA PROIBIDO
  "PERDIDO": ["CONTATO", "PROPOSTA"], // Se cliente enviar interesse
  "FORNECEDOR": ["CONTATO", "PROPOSTA"], // Se cliente enviar interesse
  "AUTOMÁTICA": ["CONTATO", "PROPOSTA", "PERDIDO"], // De automática pode voltar
};

function validateMovement(currentStage: string | undefined, proposedStage: string): boolean {
  // Se não houver etapa atual, aceitar (criar novo)
  if (!currentStage) return true;
  
  const allowedStages = AI_MOVEMENT_RULES[currentStage] || [];
  const isAllowed = allowedStages.includes(proposedStage);
  
  if (!isAllowed) {
    console.log(`⚠️ Movimento bloqueado: ${currentStage} → ${proposedStage}`);
  }
  
  return isAllowed;
}

// Normalizar mensagem: minúsculas + remove acentos
function normalizeMessage(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Remove acentos
}

// Modo de teste local (sem OpenAI API)
function analyzeLocalTest(mensagem: string, etapaAtual?: string): MessageAnalysis {
  const msg = normalizeMessage(mensagem);
  
  // 🎯 1️⃣ DETECTAR MENSAGENS AUTOMÁTICAS (PRIMEIRA VERIFICAÇÃO)
  const mensagensAutomaticas = [
    "deixe seu contato",
    "aguarde",
    "nosso suporte retornará",
    "estamos verificando",
    "fora do horario",
    "fora do horário",
    "estamos fora",
    "nao estamos disponiveis",
    "não estamos disponíveis",
    "nao estamos em atendimento",
    "não estamos em atendimento",
    "retornaremos",
    "responderemos",
    "breve entraremos",
    "em breve entraremos",
    "mensagem automatica",
    "mensagem automática",
  ];
  
  if (mensagensAutomaticas.some(palavra => msg.includes(palavra))) {
    const proposedStage = "AUTOMÁTICA";
    const isAllowed = validateMovement(etapaAtual, proposedStage);
    return {
      sentimento: "neutro",
      confianca: 100,
      intenção: "resposta_automatica",
      motivo: "Resposta automática do sistema",
      etapa: proposedStage,
      deveAgir: isAllowed,
      ehRecusaParcial: false,
      ehMensagemAutomatica: true,
      sugestao: "Aguardando retorno do sistema",
    };
  }
  
  // 🛑 2️⃣ DETECTAR REJEIÇÕES PARCIAIS (NÃO MOVER PARA PERDIDO!)
  // Cliente quer modificar parte, cancelar algumas linhas, reduzir, etc
  const recusaParcialPalavrasChave = [
    "cancelar algumas linhas",
    "algumas linhas",
    "nao quero todas as linhas",
    "nao vou renovar todas",
    "nao vai renovar todas",
    "apenas algumas",
    "nao vai renovar todas",
    "reduzir",
    "diminuir",
    "remover apenas",
    "quero so",
    "somente",
    "precisam cancelar algumas",
    "cancelar parcial",
    "mexer no plano",
    "ajustar o plano",
    "modificar as linhas"
  ];
  
  if (recusaParcialPalavrasChave.some(palavra => msg.includes(palavra))) {
    return {
      sentimento: "neutro",
      confianca: 85,
      intenção: "rejeicao_parcial",
      motivo: "Cliente quer ajustes parciais/cancelamento de algumas linhas - negócio ativo",
      etapa: "", // NÃO MOVER
      deveAgir: false,
      ehRecusaParcial: true,
      ehMensagemAutomatica: false,
      sugestao: "Alertar atendente - cliente quer ajustes, não é perda total",
    };
  }
  
  // ⏸️ 3️⃣ DETECTAR INDECISÃO/ADIAMENTO (NÃO MOVER!)
  // Cliente está indeciso, quer pensar, está ocupado, etc
  const indecisaoPalavrasChave = [
    "vou pensar",
    "deixa comigo",
    "depois te falo",
    "estou ocupado",
    "ocupado agora",
    "agora nao posso",
    "nao posso agora",
    "vamos ver depois",
    "depois a gente conversa",
    "nao sei ainda",
    "tenho que pensar",
    "deixa eu avaliar",
    "preciso verificar",
    "preciso consultar",
    "quanto pago de multa",
    "qual e a multa",
    "se eu cancelar",
    "quanto custa cancelar"
  ];
  
  if (indecisaoPalavrasChave.some(palavra => msg.includes(palavra))) {
    return {
      sentimento: "neutro",
      confianca: 75,
      intenção: "indefinida",
      motivo: "Cliente indeciso ou ocupado - sem decisão clara",
      etapa: "", // NÃO MOVER
      deveAgir: false,
      ehRecusaParcial: false,
      ehMensagemAutomatica: false,
      sugestao: "Aguardar próxima mensagem do cliente",
    };
  }
  
  // 🛑 4️⃣ DETECTAR REJEIÇÕES CLARAS → PERDIDO
  // APENAS rejeições absolutas, sem ambiguidade
  const recusaTotalPalavrasChave = [
    "nao quero renovar nada",
    "nao quero renovar",
    "nao tenho interesse",
    "nao quero contratar",
    "nao quero continuar",
    "cancela tudo",
    "cancele tudo",
    "quero cancelar",
    "nao tenho mais empresa",
    "empresa fechou",
    "eu cancelei o plano",
    "nao tenho mais plano",
    "eu mudei de operadora",
    "pode encerrar",
    "nao tenho mais a empresa",
    "pode cancelar",
    "favor cancelar"
  ];
  
  if (recusaTotalPalavrasChave.some(palavra => msg.includes(palavra))) {
    const proposedStage = "PERDIDO";
    const isAllowed = validateMovement(etapaAtual, proposedStage);
    return {
      sentimento: "negativo",
      confianca: 95,
      intenção: "rejeicao_clara",
      motivo: "Rejeição clara e definitiva",
      etapa: proposedStage,
      deveAgir: isAllowed,
      ehRecusaParcial: false,
      ehMensagemAutomatica: false,
      sugestao: "Mover para PERDIDO",
    };
  }
  
  // ✅ 5️⃣ DETECTAR APROVAÇÃO/SOLICITAÇÃO DE PROPOSTA → PROPOSTA
  // "ok", "sim", "manda", "me envia proposta", etc
  const solicitacaoProposta = [
    "me envia proposta",
    "envia proposta",
    "manda proposta",
    "me envia a proposta",
    "envia a proposta",
    "manda a proposta",
    "quero ver a proposta",
    "quero a proposta",
    "me passa a proposta",
    "mostra a proposta",
    "me mostra a proposta"
  ];
  
  // 🔥 APROVAÇÕES GENÉRICAS - Mantém na etapa atual, apenas sentimento positivo
  const aprovacaoGenerica = [
    "ok",
    "sim",
    "claro",
    "certo",
    "perfeito",
    "beleza",
    "combinado",
    "pode ser",
    "tudo bem",
    "concordo",
    "aceito",
    "gostei",
    "interessado",
    "interesse",
    "vamos la",
    "bora",
    "show",
    "legal",
    "otimo",
    "boa",
    "blz"
  ];
  
  // 🎯 APROVAÇÕES QUE MOVEM PARA PROPOSTA - Pedidos explícitos
  const aprovacaoParaProposta = [
    "pode mandar",
    "pode enviar",
    "quero renovar",
    "me envia",
    "aprova",
    "aprovado",
    "fechado",
    "quero",
    "manda"
  ];
  
  const isSolicitacaoProposta = solicitacaoProposta.some(palavra => msg.includes(palavra));
  const isAprovacaoParaProposta = aprovacaoParaProposta.some(palavra => msg.includes(palavra) && !msg.includes("nao"));
  const isAprovacaoGenerica = aprovacaoGenerica.some(palavra => msg.includes(palavra) && !msg.includes("nao"));
  
  // 🎯 PEDIDO EXPLÍCITO DE PROPOSTA → Move para PROPOSTA
  if (isSolicitacaoProposta || isAprovacaoParaProposta) {
    const proposedStage = "PROPOSTA";
    const isAllowed = validateMovement(etapaAtual, proposedStage);
    console.log(`📋 [LOCAL] Detectado: pedido explícito de proposta → PROPOSTA`);
    return {
      sentimento: "positivo",
      confianca: 95,
      intenção: "aprovacao_envio",
      motivo: isSolicitacaoProposta ? "Solicitação de proposta" : "Aprovação/concordância para proposta",
      etapa: proposedStage,
      deveAgir: isAllowed,
      ehRecusaParcial: false,
      ehMensagemAutomatica: false,
      sugestao: "Enviar proposta/simulador",
    };
  }
  
  // ✅ APROVAÇÃO GENÉRICA → Move para CONTATO (não para PROPOSTA)
  if (isAprovacaoGenerica) {
    const proposedStage = "CONTATO";
    const isAllowed = validateMovement(etapaAtual, proposedStage);
    console.log(`📋 [LOCAL] Detectado: aprovação genérica → CONTATO`);
    return {
      sentimento: "positivo",
      confianca: 85,
      intenção: "solicitacao_info",
      motivo: "Aprovação genérica do cliente",
      etapa: proposedStage,
      deveAgir: isAllowed, // Move para CONTATO se permitido
      ehRecusaParcial: false,
      ehMensagemAutomatica: false,
      sugestao: "Cliente respondeu positivamente, continuar atendimento",
    };
  }
  
  // ❓ 6️⃣ DETECTAR SOLICITAÇÃO DE INFORMAÇÕES → CONTATO
  // Preço, valor, como funciona, quando vence, migrar, etc
  const solicitacaoInfoPalavras = [
    "preco",
    "valor",
    "quanto",
    "custa",
    "como funciona",
    "quais planos",
    "me explica",
    "enviar detalhes",
    "quando vence",
    "meu contrato",
    "migrar",
    "pre pago",
    "me liga",
    "pode me ligar",
    "informacoes",
    "informações",
    "detalhes",
    "planos",
    "opcoes",
    "opções",
    "tarifas"
  ];
  
  if (solicitacaoInfoPalavras.some(palavra => msg.includes(palavra))) {
    const proposedStage = "CONTATO";
    const isAllowed = validateMovement(etapaAtual, proposedStage);
    return {
      sentimento: "positivo",
      confianca: 85,
      intenção: "solicitacao_info",
      motivo: "Cliente pedindo informações",
      etapa: proposedStage,
      deveAgir: isAllowed,
      ehRecusaParcial: false,
      ehMensagemAutomatica: false,
      sugestao: "Enviar informações/detalhes",
    };
  }
  
  // 🤷 7️⃣ PADRÃO: Mensagem inicial/neutra → CONTATO
  const proposedStage = "CONTATO";
  const isAllowed = validateMovement(etapaAtual, proposedStage);
  return {
    sentimento: "neutro",
    confianca: 50,
    intenção: "indefinida",
    motivo: "Mensagem genérica/inicial",
    etapa: proposedStage,
    deveAgir: isAllowed,
    ehRecusaParcial: false,
    ehMensagemAutomatica: false,
    sugestao: "Engajar com cliente",
  };
}

export async function analyzeClientMessage(
  mensagem: string,
  clienteInfo?: { nome?: string; etapaAtual?: string }
): Promise<MessageAnalysis> {
  try {
    // Usar análise local confiável (keywords) ao invés de OpenAI por agora
    const useLocalMode = false; // 🤖 OPENAI - Ativado para teste com IA real
    
    if (useLocalMode) {
      return analyzeLocalTest(mensagem, clienteInfo?.etapaAtual);
    }

    const prompt = `Analise RAPIDAMENTE essa resposta de cliente. Retorne JSON PURO (sem markdown, SEM CODE FENCE):

MENSAGEM: "${mensagem}"
CLIENTE: ${clienteInfo?.nome || "Desconhecido"}

⚠️ VERIFICAÇÃO DE SOLICITAÇÃO DE PROPOSTA (PRIMEIRO!):
- Se mensagem contém: "me envia proposta", "envia proposta", "manda proposta", "quero ver a proposta"
- RETORNE: etapa:"PROPOSTA", deveAgir:true, confianca:95

🎯 DISTINÇÃO CRÍTICA - ORDEM DE VERIFICAÇÃO:

**⚠️ CUIDADO: "TODAS as linhas" = PARCIAL, não TOTAL!**
- TOTAL: "NADA", "TUDO", "RECUSO COMPLETO" (cliente rejeita 100%)
- PARCIAL: "ALGUMAS", "TODAS (menos algumas)", "REDUZIR", "CANCELAR PARCIAL"

1️⃣ RECUSA TOTAL (rejeição COMPLETA) → PERDIDO, deveAgir=true
   Keywords exatos: "nada", "tudo", "recuso" sem contexto de parcial
   Exemplos:
   ✓ "Não quero renovar nada" → perdido, true
   ✓ "Cancela tudo" → perdido, true
   ✓ "Recuso, não tenho interesse" → perdido, true
   ✗ "Não vou renovar TODAS as linhas" → PARCIAL (note: "todas as" = parcial)

2️⃣ RECUSA PARCIAL/ALTERAÇÃO (quer modificar PARTE) → Mantém etapa, deveAgir=false
   Keywords: "algumas", "parcial", "reduzir", "diminuir", "cancelar alguns"
   Exemplos:
   ✓ "Quero cancelar algumas linhas" → false (sem mover, alertar atendente)
   ✓ "Não vou renovar TODAS as linhas" → false (quer manter ALGUMAS)
   ✓ "Reduzir apenas alguns serviços" → false (sem mover)

3️⃣ INDECISÃO/CONVERSA NEUTRA (sem decisão) → Mantém etapa, deveAgir=false
   Exemplos:
   ✓ "Vou pensar" → false
   ✓ "Deixa comigo" → false
   ✓ "Se eu cancelar quanto pago de multa?" → false (informação, não decisão)

▶️ 4 ETAPAS (escolha 1 - SEMPRE EM MAIÚSCULA):
1. "CONTATO" - Pergunta preço/valor OU mensagem inicial ("oi", "tudo bem?")
2. "PROPOSTA" - APROVAÇÃO ("ok", "sim", "manda", "gostei", "legal", "adorei") OU SOLICITAÇÃO DE PROPOSTA ("me envia a proposta", "envia proposta", "manda proposta", "quero ver a proposta")
3. "AUTOMÁTICA" - Mensagens automáticas: "deixe contato", "breve", "aguarde"
4. "PERDIDO" - APENAS RECUSA TOTAL (rejeitou tudo)

▶️ RETORNE deveAgir + ehRecusaParcial:
- deveAgir: true = Move para próxima etapa, false = Mantém etapa atual
- ehRecusaParcial: true = Cliente quer ajustes (alertar atendente), false = Padrão

JSON OBRIGATÓRIO (sem markdown, sem fence, APENAS JSON):
{"sentimento":"positivo","confianca":95,"motivo":"Cliente aprovou","etapa":"PROPOSTA","deveAgir":true,"ehRecusaParcial":false,"ehMensagemAutomatica":false,"sugestao":"Enviar proposta"}

EXEMPLOS CRÍTICOS:
✓ "me envia proposta" → etapa:"PROPOSTA", deveAgir:true ⚠️ IMPORTANTE!
✓ "Envia a proposta" → etapa:"PROPOSTA", deveAgir:true ⚠️ IMPORTANTE!
✓ "Me envia a proposta por favor" → etapa:"PROPOSTA", deveAgir:true
✓ "Ok, manda" → etapa:"PROPOSTA", deveAgir:true, ehRecusaParcial:false
✓ "Cancelar algumas linhas" → etapa:"CONTATO", deveAgir:false, ehRecusaParcial:true
✓ "Não quero renovar nada" → etapa:"PERDIDO", deveAgir:true, ehRecusaParcial:false`;

    const response = await Promise.race([
      client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("OpenAI timeout: 30s")), 30000)
      ),
    ]);

    const messageContent = (response as any).choices[0].message.content;
    if (!messageContent) throw new Error("Empty response from AI");

    const analysis = JSON.parse(messageContent) as MessageAnalysis;
    
    // Normalizar etapa para MAIÚSCULA (OpenAI pode retornar em minúscula)
    analysis.etapa = analysis.etapa.toUpperCase() as any;
    
    console.log(`🤖 [OpenAI] "${mensagem}" → etapa: ${analysis.etapa}, deveAgir: ${analysis.deveAgir}`);
    
    // Validar movimento baseado em etapa atual
    const isMovementAllowed = validateMovement(clienteInfo?.etapaAtual, analysis.etapa);
    
    if (!isMovementAllowed && analysis.deveAgir) {
      analysis.deveAgir = false;
      console.log(`⚠️ [BLOQUEADO] ${clienteInfo?.etapaAtual} → ${analysis.etapa} (não permitido)`);
    }
    
    return analysis;
  } catch (error) {
    console.error(`❌ [OpenAI Error] Caindo para local: "${mensagem}"`, error);
    const localAnalysis = analyzeLocalTest(mensagem, clienteInfo?.etapaAtual);
    console.log(`📝 [Local] "${mensagem}" → etapa: ${localAnalysis.etapa}, deveAgir: ${localAnalysis.deveAgir}`);
    return localAnalysis;
  }
}
