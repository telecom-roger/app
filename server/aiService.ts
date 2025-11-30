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
  deveCriarNovoNegocio: boolean; // true = criar novo negócio ao invés de mover (para FECHADO/PERDIDO)
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
  "FECHADO": ["CONTATO", "PROPOSTA"], // Se cliente responder novamente, reinicia o funil
  "PERDIDO": ["CONTATO", "PROPOSTA"], // Se cliente enviar interesse, reinicia o funil
  "FORNECEDOR": ["CONTATO", "PROPOSTA"], // Se cliente enviar interesse
  "AUTOMÁTICA": ["CONTATO", "PROPOSTA", "PERDIDO"], // De automática pode voltar
};

function validateMovement(currentStage: string | undefined, proposedStage: string): { allowed: boolean; shouldCreateNew: boolean } {
  // Se não houver etapa atual, aceitar (criar novo)
  if (!currentStage) return { allowed: true, shouldCreateNew: false };
  
  const allowedStages = AI_MOVEMENT_RULES[currentStage] || [];
  const isAllowed = allowedStages.includes(proposedStage);
  
  // ✅ REGRA CRÍTICA: FECHADO/PERDIDO NUNCA SE MOVEM
  // Apenas criam novo negócio se cliente responder
  const isFechadoOrPerdido = currentStage === "FECHADO" || currentStage === "PERDIDO";
  const shouldCreateNew = isFechadoOrPerdido && isAllowed;
  const canMove = !isFechadoOrPerdido && isAllowed; // FECHADO/PERDIDO: NUNCA movimento
  
  if (!canMove && !shouldCreateNew) {
    console.log(`⚠️ Movimento bloqueado: ${currentStage} → ${proposedStage}`);
  }
  
  if (shouldCreateNew) {
    console.log(`🆕 ${currentStage} → ${proposedStage}: Criar novo negócio (opp atual CONGELADO em ${currentStage})`);
  }
  
  return { allowed: canMove, shouldCreateNew };
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
    const { allowed: isAllowed, shouldCreateNew } = validateMovement(etapaAtual, proposedStage);
    return {
      sentimento: "neutro",
      confianca: 100,
      intenção: "resposta_automatica",
      motivo: "Resposta automática do sistema",
      etapa: proposedStage,
      deveAgir: isAllowed,
      deveCriarNovoNegocio: shouldCreateNew,
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
      deveCriarNovoNegocio: false,
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
      deveCriarNovoNegocio: false,
      ehRecusaParcial: false,
      ehMensagemAutomatica: false,
      sugestao: "Aguardar próxima mensagem do cliente",
    };
  }
  
  // 🛑 4️⃣ DETECTAR REJEIÇÕES CLARAS → PERDIDO (NEGATIVE)
  // APENAS rejeições absolutas, sem ambiguidade
  const recusaTotalPalavrasChave = [
    // NEGATIVE - Rejeição clara
    "caro",
    "muito caro",
    "não quero",
    "nao quero",
    "não gostei",
    "nao gostei",
    "não tenho interesse",
    "nao tenho interesse",
    "não",
    "não!",
    "para de mandar mensagem",
    "não insista",
    "nao insista",
    "chato",
    "pare",
    "pare de chamar",
    "bloquear",
    "vou bloquear",
    "não me liga",
    "nao me liga",
    "absurdo",
    "péssimo",
    "pessimo",
    "ruim",
    "insatisfeito",
    "não gostei do valor",
    "nao gostei do valor",
    "não me interessa",
    "nao me interessa",
    "esse valor está muito alto",
    "esse valor esta muito alto",
    "para de me chamar",
    // Extras mantidos
    "nao quero renovar nada",
    "nao quero renovar",
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
    const { allowed: isAllowed, shouldCreateNew } = validateMovement(etapaAtual, proposedStage);
    return {
      sentimento: "negativo",
      confianca: 95,
      intenção: "rejeicao_clara",
      motivo: "Rejeição clara e definitiva",
      etapa: proposedStage,
      deveAgir: isAllowed,
      deveCriarNovoNegocio: shouldCreateNew,
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
    "me mostra a proposta",
    // CLOSING - Fechamento
    "vamos fechar",
    "quero fechar",
    "pode ativar",
    "pode mandar o contrato",
    "quero contratar",
    "onde assino",
    "pode prosseguir",
    "link de contratação",
    "manda o link",
    "tudo certo",
    "vamos fechar agora"
  ];
  
  // 🎯 APROVAÇÕES QUE MOVEM PARA PROPOSTA - Cliente concordando/aprovando (POSITIVE + CLOSING)
  const aprovacaoParaProposta = [
    // POSITIVE
    "ok",
    "certo",
    "beleza",
    "blz",
    "tranquilo",
    "combinado",
    "pode ser",
    "fechado",
    "gostei",
    "quero",
    "interesse",
    "manda aí",
    "me manda",
    "envia aí",
    "bora",
    "perfeito",
    "maravilha",
    "show",
    "top",
    "excelente",
    "aprovado",
    "ótimo",
    "otimo",
    "adorei",
    "legal",
    "massa",
    "gostei do plano",
    "pode me enviar",
    "quero saber mais",
    // CLOSING
    "vamos fechar",
    "quero fechar",
    "pode ativar",
    "quero contratar",
    "pode prosseguir",
    // Extras mantidos
    "sim",
    "claro",
    "tudo bem",
    "concordo",
    "aceito",
    "interessado",
    "vamos la",
    "boa",
    "pode mandar",
    "pode enviar",
    "quero renovar",
    "me envia",
    "aprova",
    "manda",
    // 👍 EMOJIS POSITIVOS
    "👍",
    "👌",
    "✔️",
    "✅",
    "🤝",
    "💪",
    "🙏",
    "😊",
    "😃",
    "🔥",
    "💯",
    "✔",
    "☑",
    "👏",
    "🎉",
    "❤",
    "💚",
    "💙"
  ];
  
  // 🔥 APROVAÇÕES GENÉRICAS - (lista vazia, todas vão para PROPOSTA agora)
  const aprovacaoGenerica: string[] = [];
  
  const isSolicitacaoProposta = solicitacaoProposta.some(palavra => msg.includes(palavra));
  const isAprovacaoParaProposta = aprovacaoParaProposta.some(palavra => msg.includes(palavra) && !msg.includes("nao"));
  const isAprovacaoGenerica = aprovacaoGenerica.some(palavra => msg.includes(palavra) && !msg.includes("nao"));
  
  // 🎯 PEDIDO EXPLÍCITO DE PROPOSTA → Move para PROPOSTA
  if (isSolicitacaoProposta || isAprovacaoParaProposta) {
    const proposedStage = "PROPOSTA";
    const { allowed: isAllowed, shouldCreateNew } = validateMovement(etapaAtual, proposedStage);
    console.log(`📋 [LOCAL] Detectado: pedido explícito de proposta → PROPOSTA`);
    return {
      sentimento: "positivo",
      confianca: 95,
      intenção: "aprovacao_envio",
      motivo: isSolicitacaoProposta ? "Solicitação de proposta" : "Aprovação/concordância para proposta",
      etapa: proposedStage,
      deveAgir: isAllowed,
      deveCriarNovoNegocio: shouldCreateNew,
      ehRecusaParcial: false,
      ehMensagemAutomatica: false,
      sugestao: "Enviar proposta/simulador",
    };
  }
  
  // ✅ APROVAÇÃO GENÉRICA → Move para CONTATO (não para PROPOSTA)
  if (isAprovacaoGenerica) {
    const proposedStage = "CONTATO";
    const { allowed: isAllowed, shouldCreateNew } = validateMovement(etapaAtual, proposedStage);
    console.log(`📋 [LOCAL] Detectado: aprovação genérica → CONTATO`);
    return {
      sentimento: "positivo",
      confianca: 85,
      intenção: "solicitacao_info",
      motivo: "Aprovação genérica do cliente",
      etapa: proposedStage,
      deveAgir: isAllowed, // Move para CONTATO se permitido
      deveCriarNovoNegocio: shouldCreateNew,
      ehRecusaParcial: false,
      ehMensagemAutomatica: false,
      sugestao: "Cliente respondeu positivamente, continuar atendimento",
    };
  }
  
  // ❓ 6️⃣ DETECTAR SOLICITAÇÃO DE INFORMAÇÕES → CONTATO (NEUTRAL + CONFUSION + URGENCY)
  // Preço, valor, como funciona, quando vence, migrar, etc
  const solicitacaoInfoPalavras = [
    // NEUTRAL
    "oi",
    "olá",
    "ola",
    "bom dia",
    "boa tarde",
    "boa noite",
    "por favor",
    "pfvr",
    "informações",
    "informacoes",
    "tenho uma dúvida",
    "tenho uma duvida",
    "qual valor",
    "quanto fica",
    "explica",
    "como funciona",
    "estou avaliando",
    "interessado talvez",
    "queria mais informações",
    "queria mais informacoes",
    "qual o valor total",
    "o que está incluso",
    "o que esta incluso",
    // CONFUSION
    "não entendi",
    "nao entendi",
    "confuso",
    "não ficou claro",
    "nao ficou claro",
    "explica melhor",
    "pode explicar",
    "qual a diferença",
    "qual a diferenca",
    "estou na dúvida",
    "estou na duvida",
    "não compreendi",
    "nao compreendi",
    "pode detalhar",
    "não entendi esse valor",
    "nao entendi esse valor",
    "qual a diferença desse plano",
    "pode explicar melhor",
    // URGENCY
    "urgente",
    "preciso hoje",
    "preciso agora",
    "resolve pra mim",
    "tem como agilizar",
    "agiliza",
    "o quanto antes",
    "pra hoje",
    "preciso resolver isso hoje",
    "quero ativar agora",
    // Extras mantidos
    "preco",
    "valor",
    "quanto",
    "custa",
    "quais planos",
    "me explica",
    "enviar detalhes",
    "quando vence",
    "meu contrato",
    "migrar",
    "pre pago",
    "me liga",
    "pode me ligar",
    "detalhes",
    "planos",
    "opcoes",
    "opções",
    "tarifas"
  ];
  
  if (solicitacaoInfoPalavras.some(palavra => msg.includes(palavra))) {
    const proposedStage = "CONTATO";
    const { allowed: isAllowed, shouldCreateNew } = validateMovement(etapaAtual, proposedStage);
    return {
      sentimento: "positivo",
      confianca: 85,
      intenção: "solicitacao_info",
      motivo: "Cliente pedindo informações",
      etapa: proposedStage,
      deveAgir: isAllowed,
      deveCriarNovoNegocio: shouldCreateNew,
      ehRecusaParcial: false,
      ehMensagemAutomatica: false,
      sugestao: "Enviar informações/detalhes",
    };
  }
  
  // 🤷 7️⃣ PADRÃO: Mensagem inicial/neutra → CONTATO
  const proposedStage = "CONTATO";
  const { allowed: isAllowed, shouldCreateNew } = validateMovement(etapaAtual, proposedStage);
  return {
    sentimento: "neutro",
    confianca: 50,
    intenção: "indefinida",
    motivo: "Mensagem genérica/inicial",
    etapa: proposedStage,
    deveAgir: isAllowed,
    deveCriarNovoNegocio: shouldCreateNew,
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
    // 🎯 SISTEMA HÍBRIDO: Keywords primeiro, OpenAI como fallback inteligente
    
    // 1️⃣ PRIMEIRO: Tentar análise local (palavras-chave definidas pelo usuário)
    const localAnalysis = analyzeLocalTest(mensagem, clienteInfo?.etapaAtual);
    
    // 2️⃣ Se análise local tem alta confiança (>= 75) → usar local
    if (localAnalysis.confianca >= 75) {
      console.log(`📝 [KEYWORDS] "${mensagem}" → ${localAnalysis.etapa} (confiança: ${localAnalysis.confianca}%)`);
      return localAnalysis;
    }
    
    // 3️⃣ Se confiança baixa (< 75) → usar OpenAI para entender melhor
    console.log(`🤖 [HÍBRIDO] Confiança local baixa (${localAnalysis.confianca}%), consultando IA...`);

    const prompt = `Analise a resposta do cliente e classifique. Retorne APENAS JSON puro:

MENSAGEM: "${mensagem}"

🎯 REGRAS DE CLASSIFICAÇÃO (SIGA EXATAMENTE):

**POSITIVE/CLOSING → etapa:"PROPOSTA"**
Palavras: ok, certo, beleza, blz, tranquilo, combinado, pode ser, fechado, gostei, quero, interesse, manda aí, me manda, bora, perfeito, maravilha, show, top, excelente, aprovado, ótimo, adorei, legal, massa, vamos fechar, pode ativar, quero contratar, onde assino, manda o link, 👍, 👌, ✔️

**NEUTRAL/CONFUSION/URGENCY → etapa:"CONTATO"**
Palavras: oi, olá, bom dia, boa tarde, boa noite, por favor, informações, tenho dúvida, qual valor, quanto fica, explica, como funciona, não entendi, confuso, pode explicar, qual diferença, urgente, preciso hoje, agiliza

**NEGATIVE → etapa:"PERDIDO"**
Palavras: caro, muito caro, não quero, não gostei, não tenho interesse, para de mandar mensagem, não insista, chato, pare, bloquear, absurdo, péssimo, ruim, insatisfeito, não me interessa, cancela tudo

**AUTOMÁTICA → etapa:"AUTOMÁTICA"**
Palavras: deixe seu contato, aguarde, nosso suporte retornará, estamos verificando

**INDECISÃO → etapa:"" (não mover)**
Palavras: vou pensar, deixa comigo, estou ocupado, depois conversamos

JSON OBRIGATÓRIO:
{"sentimento":"positivo|neutro|negativo","confianca":85,"motivo":"razão","etapa":"PROPOSTA|CONTATO|PERDIDO|AUTOMÁTICA|","deveAgir":true|false,"ehRecusaParcial":false,"ehMensagemAutomatica":false,"sugestao":"ação"}`;

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

    const aiAnalysis = JSON.parse(messageContent) as MessageAnalysis;
    
    // Normalizar etapa para MAIÚSCULA
    aiAnalysis.etapa = (aiAnalysis.etapa || "").toUpperCase() as any;
    
    console.log(`🤖 [OpenAI] "${mensagem}" → ${aiAnalysis.etapa} (confiança: ${aiAnalysis.confianca}%)`);
    
    // 4️⃣ VALIDAÇÃO: Garantir que IA respeita as regras de movimento
    const { allowed: isMovementAllowed, shouldCreateNew } = validateMovement(clienteInfo?.etapaAtual, aiAnalysis.etapa);
    
    if (!isMovementAllowed && aiAnalysis.deveAgir) {
      aiAnalysis.deveAgir = false;
      console.log(`⚠️ [BLOQUEADO] ${clienteInfo?.etapaAtual} → ${aiAnalysis.etapa} (não permitido)`);
    }
    
    // Marcar se deve criar novo negócio (para FECHADO/PERDIDO)
    aiAnalysis.deveCriarNovoNegocio = shouldCreateNew;
    
    return aiAnalysis;
  } catch (error) {
    console.error(`❌ [OpenAI Error] Usando keywords locais: "${mensagem}"`, error);
    const localAnalysis = analyzeLocalTest(mensagem, clienteInfo?.etapaAtual);
    console.log(`📝 [FALLBACK] "${mensagem}" → ${localAnalysis.etapa}`);
    return localAnalysis;
  }
}
