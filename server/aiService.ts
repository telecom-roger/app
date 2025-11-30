import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface MessageAnalysis {
  sentimento: "positivo" | "negativo" | "neutro" | "fornecedor";
  confianca: number;
  motivo: string;
  etapa: "CONTATO" | "PROPOSTA" | "AUTOMÁTICA" | "PERDIDO" | "LEAD";
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
      deveAgir: isAllowed,
      ehRecusaParcial: false,
      ehMensagemAutomatica: true,
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
      sugestao: "Cliente deseja ajustes - negociar modificações",
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
      deveAgir: isAllowed,
      ehRecusaParcial: false,
      ehMensagemAutomatica: false,
      sugestao: "Arquivar oportunidade",
    };
  }
  
  
  // 📲 AUTOMÁTICA
  const automatica = ["deixe seu contato", "breve", "aguarde", "em breve", "entro em contato"];
  if (automatica.some(palavra => msg.includes(palavra))) {
    const proposedStage = "AUTOMÁTICA";
    const isAllowed = validateMovement(etapaAtual, proposedStage);
    return {
      sentimento: "fornecedor",
      confianca: 90,
      motivo: "Mensagem automática",
      etapa: proposedStage,
      deveAgir: isAllowed,
      ehRecusaParcial: false,
      ehMensagemAutomatica: true,
      permitidoEmProducao: isAllowed,
      sugestao: "Aguardando resposta",
    };
  }
  
  // 📋 SOLICITAÇÃO DE PROPOSTA → PROPOSTA
  const solicitacaoProposta = [
    "me envia a proposta", "envia a proposta", "envia proposta", "manda proposta",
    "me manda a proposta", "quero ver a proposta", "mostra a proposta",
    "me mostra a proposta", "qual e a proposta", "qual é a proposta"
  ];
  if (solicitacaoProposta.some(palavra => msg.includes(palavra))) {
    const proposedStage = "PROPOSTA";
    const isAllowed = validateMovement(etapaAtual, proposedStage);
    return {
      sentimento: "positivo",
      confianca: 95,
      motivo: "Solicitação de proposta detectada",
      etapa: proposedStage,
      deveAgir: isAllowed,
      ehRecusaParcial: false,
      ehMensagemAutomatica: false,
      sugestao: "Enviar proposta",
    };
  }

  // ✅ APROVAÇÃO → PROPOSTA
  const aprovacao = [
    "ok", "sim", "manda", "pode enviar", "quero renovar", "topa", "pode", "vamos la",
    "gostei", "adorei", "legal", "otimo", "maravilha", "perfeito", "excelente",
    "bora", "vamo", "blz", "show", "massa", "incrivel", "top", "amei"
  ];
  if (aprovacao.some(palavra => msg.includes(palavra))) {
    const proposedStage = "PROPOSTA";
    const isAllowed = validateMovement(etapaAtual, proposedStage);
    return {
      sentimento: "positivo",
      confianca: 95,
      motivo: "Aprovação detectada",
      etapa: proposedStage,
      deveAgir: isAllowed,
      ehRecusaParcial: false,
      ehMensagemAutomatica: false,
      sugestao: "Enviar proposta",
    };
  }
  
  // ❓ INFORMAÇÃO → CONTATO
  const precoKeywords = ["preco", "quanto", "valor", "custa"];
  if (precoKeywords.some(palavra => msg.includes(palavra))) {
    const proposedStage = "CONTATO";
    const isAllowed = validateMovement(etapaAtual, proposedStage);
    return {
      sentimento: "positivo",
      confianca: 85,
      motivo: "Pergunta sobre preço",
      etapa: proposedStage,
      deveAgir: isAllowed,
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
    const useLocalMode = true; // 🧪 TESTE LOCAL - Verificar fallback
    
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
