import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface MessageAnalysis {
  sentimento: "positivo" | "negativo" | "neutro" | "fornecedor";
  confianca: number;
  motivo: string;
  etapa: "CONTATO" | "PROPOSTA" | "AUTOMÁTICA" | "PERDIDO" | "LEAD"; // Etapas automáticas em MAIÚSCULA
  deveAgir: boolean; // true = mover/criar, false = manter etapa atual sem mover
  ehRecusaParcial: boolean; // true = recusa parcial/alteração, alerta atendente
  ehMensagemAutomatica: boolean; // true = mensagem automática do sistema (deve ir para AUTOMÁTICA)
  sugestao: string;
  permitidoEmProducao?: boolean; // true = movimento permitido pelas regras de IA, false = bloqueado
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
    console.log(`🚫 MOVIMENTO BLOQUEADO: ${currentStage} → ${proposedStage} (não permitido pelas regras)`);
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
  
  // 🤖 DETECTAR MENSAGENS AUTOMÁTICAS (deve ir para AUTOMÁTICA)
  const mensagensAutomaticas = [
    "fora do horario de atendimento",
    "fora do horário de atendimento",
    "estamos fora do horario",
    "estamos fora do horário",
    "nao estamos disponiveis",
    "não estamos disponíveis",
    "nao estamos em atendimento",
    "não estamos em atendimento",
    "retornaremos",
    "responderemos",
    "breve entraremos",
    "em breve entraremos",
    "deixe seu contato",
    "mensagem automatica",
    "mensagem automática",
    "segunda a sexta",
    "segunda à sexta",
    "9h as 18h",
    "9h às 18h",
    "agradecemos a compreensao",
    "agradecemos a compreensão"
  ];
  
  if (mensagensAutomaticas.some(palavra => msg.includes(palavra))) {
    const proposedStage = "AUTOMÁTICA";
    const isAllowed = validateMovement(etapaAtual, proposedStage);
    return {
      sentimento: "neutro",
      confianca: 100,
      motivo: "Mensagem automática do sistema - cliente aguardando retorno",
      etapa: proposedStage,
      deveAgir: isAllowed, // true = move para AUTOMÁTICA
      ehRecusaParcial: false,
      ehMensagemAutomatica: true,
      permitidoEmProducao: isAllowed,
      sugestao: "Aguardando retorno automático do sistema",
    };
  }
  
  // 🛑 RECUSA TOTAL → PERDIDO (verifica PRIMEIRO - é mais específico com "nada"/"tudo")
  // Procura por: "não quero renovar NADA", "cancela TUDO", "recusa completa"
  // VERIFICAR RECUSA PARCIAL PRIMEIRO (mais específico que total)
  const recusaParcialPalavrasChave = [
    "cancelar algumas linhas",
    "algumas linhas",
    "cancelar parcial",
    "remover algumas",
    "nao quero todas as linhas",
    "nao vou renovar todas",
    "nao vai renovar todas",
    "apenas algumas",
    "so algumas",
    "reduzir",
    "diminuir",
    "retirar apenas",
    "quero so",
    "somente",
    "vou pensar",
    "deixa comigo",
    "depois te falo",
    "ta bom",
    "ok blz",
    "e tal",
    "nao agora",
    "depois",
    "preciso consultar",
    "quanto pago de multa",
    "qual e a multa"
  ];
  
  if (recusaParcialPalavrasChave.some(palavra => msg.includes(palavra))) {
    return {
      sentimento: "neutro",
      confianca: 70,
      motivo: "Recusa parcial ou indecisão - cliente quer modificar, não rejeitar",
      etapa: "CONTATO",
      deveAgir: false,
      ehRecusaParcial: msg.includes("cancelar") || msg.includes("reduzir") || msg.includes("remover"),
      ehMensagemAutomatica: false,
      sugestao: "⚠️ Cliente deseja ajustes - negociar modificações",
    };
  }
  
  // APÓS VERIFICAR PARCIAL, VERIFICAR TOTAL
  const recusaTotalPalavrasChave = [
    "nao quero renovar nada",
    "cancela tudo",
    "recuso",
    "nao tenho interesse",
    "nao quero nenhum",
    "empresa nao existe",
    "nao vai dar pra continuar",
    "muito caro demais",
    "vou para concorrente",
    "trocar de fornecedor",
    "sem interesse",
    "finaliza",
    "desliga"
  ];
  
  if (recusaTotalPalavrasChave.some(palavra => msg.includes(palavra))) {
    const proposedStage = "PERDIDO";
    const isAllowed = validateMovement(etapaAtual, proposedStage);
    return {
      sentimento: "negativo",
      confianca: 95,
      motivo: "Recusa total detectada - cliente rejeita tudo",
      etapa: proposedStage,
      deveAgir: isAllowed, // true = move para PERDIDO
      ehRecusaParcial: false,
      ehMensagemAutomatica: false,
      permitidoEmProducao: isAllowed,
      sugestao: "Arquivar oportunidade",
    };
  }
  
  
  // 📲 AUTOMÁTICA
  const automatica = ["deixe seu contato", "breve", "aguarde", "em breve", "entro em contato"];
  if (automatica.some(palavra => msg.includes(palavra))) {
    return {
      sentimento: "fornecedor",
      confianca: 90,
      motivo: "Mensagem automática",
      etapa: "AUTOMÁTICA",
      deveAgir: true,
      ehRecusaParcial: false,
      ehMensagemAutomatica: true,
      sugestao: "Aguardando resposta",
    };
  }
  
  // ✅ APROVAÇÃO → PROPOSTA
  const aprovacao = [
    "ok", "sim", "manda", "pode enviar", "quero renovar", "topa", "pode", "vamos la",
    "gostei", "adorei", "legal", "otimo", "maravilha", "perfeito", "excelente",
    "bora", "vamo", "blz", "show", "massa", "incrivel", "top", "amei"
  ];
  if (aprovacao.some(palavra => msg.includes(palavra))) {
    return {
      sentimento: "positivo",
      confianca: 95,
      motivo: "Aprovação detectada",
      etapa: "PROPOSTA",
      deveAgir: true,
      ehRecusaParcial: false,
      ehMensagemAutomatica: false,
      sugestao: "Enviar proposta",
    };
  }
  
  // ❓ INFORMAÇÃO → CONTATO
  const precoKeywords = ["preco", "quanto", "valor", "custa"];
  if (precoKeywords.some(palavra => msg.includes(palavra))) {
    return {
      sentimento: "positivo",
      confianca: 85,
      motivo: "Pergunta sobre preço",
      etapa: "CONTATO",
      deveAgir: true,
      ehRecusaParcial: false,
      ehMensagemAutomatica: false,
      sugestao: "Enviar tabela",
    };
  }
  
  // 🤷 NEUTRO → CONTATO (padrão para qualquer mensagem inicial)
  const proposedStage = "CONTATO";
  const isAllowed = validateMovement(etapaAtual, proposedStage);
  return {
    sentimento: "neutro",
    confianca: 50,
    motivo: "Mensagem inicial",
    etapa: proposedStage,
    deveAgir: isAllowed,
    ehRecusaParcial: false,
    ehMensagemAutomatica: false,
    permitidoEmProducao: isAllowed,
    sugestao: "Engajar",
  };
}

export async function analyzeClientMessage(
  mensagem: string,
  clienteInfo?: { nome?: string; etapaAtual?: string }
): Promise<MessageAnalysis> {
  try {
    // Usar OpenAI para análise de sentimento (a IA entende melhor variações, acentos, erros)
    const useLocalMode = false; // ✅ ATIVAR OPENAI - IA entende tudo!
    
    if (useLocalMode) {
      console.log(`🧪 [MODO LOCAL] Analisando com regras locais (confiável)`);
      const analysis = analyzeLocalTest(mensagem, clienteInfo?.etapaAtual);
      console.log(`🤖 IA (LOCAL): ${analysis.sentimento} (${analysis.confianca}%) → ${analysis.etapa} (permitido=${analysis.permitidoEmProducao})`);
      return analysis;
    }

    const prompt = `Analise RAPIDAMENTE essa resposta de cliente. Retorne JSON PURO (sem markdown):

MENSAGEM: "${mensagem}"
CLIENTE: ${clienteInfo?.nome || "Desconhecido"}

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
2. "PROPOSTA" - APROVAÇÃO: "ok", "sim", "manda", "gostei", "legal", "adorei"
3. "AUTOMÁTICA" - Mensagens automáticas: "deixe contato", "breve", "aguarde"
4. "PERDIDO" - APENAS RECUSA TOTAL (rejeitou tudo)

▶️ RETORNE deveAgir + ehRecusaParcial:
- deveAgir: true = Move para próxima etapa, false = Mantém etapa atual
- ehRecusaParcial: true = Cliente quer ajustes (alertar atendente), false = Padrão

JSON - ETAPAS EM MAIÚSCULA:
{"sentimento":"positivo","confianca":95,"motivo":"Cliente aprovou","etapa":"PROPOSTA","deveAgir":true,"ehRecusaParcial":false,"sugestao":"Enviar proposta"}

EXEMPLOS:
✓ "Não quero renovar nada" → etapa:"PERDIDO", deveAgir:true, ehRecusaParcial:false
✓ "Cancelar algumas linhas" → etapa:"CONTATO", deveAgir:false, ehRecusaParcial:true
✓ "Ok, manda" → etapa:"PROPOSTA", deveAgir:true, ehRecusaParcial:false`;

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

    console.log(`📝 [DEBUG] Resposta bruta do OpenAI: ${messageContent}`);
    
    const analysis = JSON.parse(messageContent) as MessageAnalysis;
    console.log(`📝 [DEBUG] Etapa ANTES de normalizar: "${analysis.etapa}"`);
    
    // Normalizar etapa para MAIÚSCULA (OpenAI pode retornar em minúscula)
    analysis.etapa = analysis.etapa.toUpperCase() as any;
    console.log(`📝 [DEBUG] Etapa DEPOIS de normalizar: "${analysis.etapa}"`);
    
    // ✅ VALIDAR MOVIMENTO BASEADO EM ETAPA ATUAL
    const isMovementAllowed = validateMovement(clienteInfo?.etapaAtual, analysis.etapa);
    analysis.permitidoEmProducao = isMovementAllowed;
    
    if (!isMovementAllowed && analysis.deveAgir) {
      console.log(`⚠️ MOVIMENTO BLOQUEADO: ${clienteInfo?.etapaAtual} → ${analysis.etapa}`);
      analysis.deveAgir = false; // Bloquear movimento
    }
    
    console.log(`🤖 IA (OPENAI): ${analysis.sentimento} (${analysis.confianca}%) → ${analysis.etapa} (permitido=${isMovementAllowed})`);
    return analysis;
  } catch (error) {
    console.error("❌ Erro IA:", error);
    console.log(`🧪 Caindo para análise local...`);
    return analyzeLocalTest(mensagem);
  }
}
