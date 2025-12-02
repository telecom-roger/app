import OpenAI from "openai";
import { db } from "./db";
import { clients, opportunities, messages } from "@shared/schema";
import { eq, and, sql, desc, gte, lt, inArray } from "drizzle-orm";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface MessageAnalysis {
  sentimento: "positivo" | "neutro" | "negativo";
  intenção: "solicitacao_info" | "aprovacao_envio" | "resposta_automatica" | "rejeicao_clara" | "rejeicao_parcial" | "indefinida";
  etapa: "CONTATO" | "PROPOSTA" | "AUTOMÁTICA" | "PERDIDO" | "";
  confianca: number;
  motivo: string;
  deveAgir: boolean;
  deveCriarNovoNegocio: boolean;
  ehRecusaParcial: boolean;
  ehMensagemAutomatica: boolean;
  sugestao: string;
}

export interface OpportunityCreationRules {
  podecriar: boolean;
  motivo: string;
  etapa?: string;
}

// Etapas que bloqueiam ações da IA
export const ETAPAS_MANUAIS_BLOQUEADAS = ["PROPOSTA ENVIADA", "CONTRATO ENVIADO", "AGUARDANDO ACEITE", "AGUARDANDO ATENÇÃO", "AGUARDANDO CONTRATO"];

// Validar movimentos entre etapas
export function validateMovement(currentStage?: string, proposedStage?: string) {
  if (!currentStage || !proposedStage) {
    return { allowed: true, shouldCreateNew: false };
  }

  const allowedMovements: Record<string, string[]> = {
    "LEAD": ["CONTATO", "PROPOSTA", "FORNECEDOR", "PERDIDO"],
    "CONTATO": ["PROPOSTA", "PERDIDO"],
    "PROPOSTA": [], // IA PROIBIDO
    "PROPOSTA ENVIADA": [], // IA PROIBIDO
    "AGUARDANDO CONTRATO": [], // IA PROIBIDO
    "CONTRATO ENVIADO": [], // IA PROIBIDO
    "AGUARDANDO ACEITE": [], // IA PROIBIDO
    "AGUARDANDO ATENÇÃO": [], // IA PROIBIDO
    "FORNECEDOR": ["CONTATO", "PROPOSTA", "AUTOMÁTICA"],
    "AUTOMÁTICA": ["CONTATO", "PROPOSTA", "PERDIDO"], // De automática pode voltar
    "FECHADO": ["CONTATO", "PROPOSTA"], // Se cliente responder novamente, reinicia o funil
    "PERDIDO": ["CONTATO", "PROPOSTA"], // Se cliente enviar interesse, reinicia o funil
  };

  const currentMoves = allowedMovements[currentStage] || [];
  const isAllowed = currentMoves.includes(proposedStage);
  
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

// ========================================
// NOVA LÓGICA: CLASSIFICAÇÃO EXPLÍCITA
// ========================================

function analyzeLocalTest(mensagem: string, etapaAtual?: string): MessageAnalysis {
  const msg = normalizeMessage(mensagem);
  
  // 🚫 PASSO 1: VERIFICAR SE ESTÁ EM LISTA DE NEUTRAS → NÃO CRIA
  const mensagensNeutras = [
    "oi",
    "ola",
    "olá",
    "eae",
    "e ae",
    "bom dia",
    "boa tarde",
    "boa noite",
    "kkk",
    "kk",
    "haha",
    "hehe",
    "rsrs",
    "teste",
    "test",
    "valeu",
    "valew",
    "obrigado",
    "obrigada",
    "thanks",
    "ok?",
    "tudo bem",
    "tudo bem?",
    "🙌",
    "🙏",
    "🙃",
    "😊",
    "✌",
    "...",
    "…",
    // Sentimentos neutros adicionados
    "entendi",
    "certo",
    "pode ser",
    "talvez",
    "estou avaliando",
    "deixa eu verificar",
    "vou analisar",
  ];

  if (mensagensNeutras.some(palavra => msg === palavra || msg === palavra.trim())) {
    console.log(`📋 [NEUTRO PURO] "${mensagem}" → BLOQUEIO TOTAL`);
    return {
      sentimento: "neutro",
      confianca: 100,
      intenção: "indefinida",
      motivo: "Mensagem completamente neutra/vazia",
      etapa: "", // NÃO MOVER
      deveAgir: false, // 🚫 BLOQUEIO TOTAL
      deveCriarNovoNegocio: false,
      ehRecusaParcial: false,
      ehMensagemAutomatica: false,
      sugestao: "Ignorar mensagem",
    };
  }

  // ✅ PASSO 2: VERIFICAR SE ESTÁ EM LISTA DE AÇÃO (OK, 👍, etc) → CRIA PROPOSTA
  const acoesParaProposta = [
    "ok",
    "okk",
    "okkk",
    "OK",
    "joia",
    "👍",
    "👌",
    "sim",
    "blz",
    "beleza",
    "manda",
    "pode mandar",
    "envia",
    "me manda",
    "envia aí",
    "manda aí",
  ];

  if (acoesParaProposta.some(palavra => msg === palavra || msg === palavra.trim() || msg.includes(palavra))) {
    const proposedStage = "PROPOSTA";
    const { allowed: isAllowed, shouldCreateNew } = validateMovement(etapaAtual, proposedStage);
    console.log(`📋 [AÇÃO PROPOSTA] "${mensagem}" → PROPOSTA (confiança: 100%)`);
    return {
      sentimento: "positivo",
      confianca: 100,
      intenção: "aprovacao_envio",
      motivo: "Ação explícita para proposta",
      etapa: proposedStage,
      deveAgir: isAllowed,
      deveCriarNovoNegocio: shouldCreateNew,
      ehRecusaParcial: false,
      ehMensagemAutomatica: false,
      sugestao: "Enviar proposta/simulador",
    };
  }

  // 🟧 PASSO 3: VERIFICAR INTENÇÃO COMERCIAL FRACA → CRIA CONTATO
  const intentoContato = [
    "quero saber mais",
    "como funciona",
    "pode me explicar",
    "qual operadora é melhor",
    "qual operadora e melhor",
    // Intenções e dúvidas adicionadas
    "me envia detalhes",
    "esse valor é bom",
    "quero entender melhor",
    "me chama",
    "pode falar",
    "quero conhecer mais",
    "como funciona esse servico",
    "tem mais informacoes",
    "qual e o valor",
    "quanto custa",
    "quais condicoes",
    "quais prazos",
    "como posso iniciar",
    "tem taxa",
    "qual prazo de entrega",
    "qual o tempo de implementacao",
    "me envia o contrato",
    "quase fechando",
    "so falta um detalhe",
    "estou analisando",
    "quase decidido",
    "quero validacao final",
    "preciso confirmar uma coisa antes",
    "tem desconto",
    "e esse mesmo o preco",
    "quero falar com um consultor",
    "como faco o pagamento",
  ];

  if (intentoContato.some(palavra => msg.includes(palavra))) {
    const proposedStage = "CONTATO";
    const { allowed: isAllowed, shouldCreateNew } = validateMovement(etapaAtual, proposedStage);
    console.log(`📋 [INTENÇÃO CONTATO] "${mensagem}" → CONTATO (confiança: 85%)`);
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

  // 🤖 DETECTAR MENSAGENS AUTOMÁTICAS
  const mensagensAutomaticas = [
    // Padrões típicos de auto-resposta de empresas
    "agradecem seu contato",
    "agradecemos seu contato",
    "obrigado pelo contato",
    "obrigado por entrar em contato",
    "como podemos ajudar",
    "como posso ajudar",
    "em que posso ajudar",
    "em que podemos ajudar",
    "podemos ajuda-lo",
    "podemos ajudá-lo",
    "sou assistente virtual",
    "sou um assistente",
    "atendimento automatico",
    "atendimento automático",
    "bem-vindo ao",
    "bem vindo ao",
    "seja bem-vindo",
    "seja bem vindo",
    // Padrões antigos
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
    // Padrões de auto-resposta WhatsApp Business
    "esta e uma resposta automatica",
    "esta é uma resposta automática",
    "resposta automatica",
    "resposta automática",
    "horario de atendimento",
    "horário de atendimento",
    "nosso horario",
    "nosso horário",
    "em breve retornaremos",
    "em breve responderemos",
    "logo entraremos em contato",
    "entraremos em contato em breve",
    "equipe de atendimento",
    "nossa equipe entrara",
    "nossa equipe entrará",
    "selecione uma opcao",
    "selecione uma opção",
    "digite o numero",
    "digite o número",
    "para falar com",
    "menu de opcoes",
    "menu de opções",
  ];

  if (mensagensAutomaticas.some(palavra => msg.includes(palavra))) {
    const proposedStage = "AUTOMÁTICA";
    const { allowed: isAllowed, shouldCreateNew } = validateMovement(etapaAtual, proposedStage);
    console.log(`📋 [AUTOMÁTICA] "${mensagem}" → AUTOMÁTICA (confiança: 100%)`);
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

  // 🛑 REJEIÇÕES CLARAS → PERDIDO
  const recusaTotalPalavrasChave = [
    "caro",
    "muito caro",
    "não quero",
    "nao quero",
    "não gostei",
    "nao gostei",
    "não tenho interesse",
    "nao tenho interesse",
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
    "não me interessa",
    "nao me interessa",
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
    "favor cancelar",
    // Sentimentos negativos e hard negatives adicionados
    "ruim demais",
    "não faz sentido",
    "nao faz sentido",
    "estou confuso",
    "nao entendi",
    "não entendi",
    "não obrigado",
    "nao obrigado",
    "não preciso",
    "nao preciso",
    "deixe pra la",
    "muito ruim",
    "nao gostei da proposta",
    "isso nao serve pra mim",
    "não me interessa",
    "retire meu numero",
    "não entre mais em contato",
    "nao entre mais em contato",
    "não tenho interesse nenhum",
    "nao tenho interesse nenhum",
    "muito caro",
    "esta acima do orcamento",
    "preço alto",
    "preco alto",
    "não posso pagar isso agora",
    "nao posso pagar isso agora",
    "achei caro",
    "não cabe no meu orcamento",
    "nao cabe no meu orcamento",
  ];

  if (recusaTotalPalavrasChave.some(palavra => msg.includes(palavra))) {
    const proposedStage = "PERDIDO";
    const { allowed: isAllowed, shouldCreateNew } = validateMovement(etapaAtual, proposedStage);
    console.log(`📋 [REJEIÇÃO] "${mensagem}" → PERDIDO (confiança: 95%)`);
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

  // ⏸️ INDECISÃO/ADIAMENTO (NÃO MOVER!)
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
    "quanto custa cancelar",
    // Soft negatives, objeções de tempo e confiança adicionadas
    "nao agora",
    "mais tarde",
    "depois falamos",
    "não tenho tempo agora",
    "nao tenho tempo agora",
    "manda depois",
    "não posso agora",
    "estou correndo no momento",
    "agora nao da",
    "sem tempo",
    "muito corrido",
    "vejo isso depois",
    "podemos falar semana que vem",
    "não conheço",
    "nao conheco",
    "não tenho segurança",
    "nao tenho seguranca",
    "preciso pesquisar mais",
    "preciso ver depoimentos",
    "não sei se vale a pena",
    "nao sei se vale a pena",
    "não preciso disso",
    "nao preciso disso",
    "já tenho solução",
    "ja tenho solucao",
    "não é prioridade",
    "nao e prioridade",
    "não vejo necessidade agora",
    "nao vejo necessidade agora",
    "vou ver",
    "vou pensar",
    "deixe pra lá",
    "agora não",
  ];

  if (indecisaoPalavrasChave.some(palavra => msg.includes(palavra))) {
    console.log(`📋 [INDECISÃO] "${mensagem}" → BLOQUEIO (indefinida)`);
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

  // 🛑 REJEIÇÕES PARCIAIS
  const recusaParcialPalavrasChave = [
    "cancelar algumas linhas",
    "algumas linhas",
    "nao quero todas as linhas",
    "nao vou renovar todas",
    "nao vai renovar todas",
    "apenas algumas",
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
    console.log(`📋 [REJEIÇÃO PARCIAL] "${mensagem}" → BLOQUEIO`);
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

  // 🤷 PADRÃO: Mensagem inicial/neutra → CONTATO
  const proposedStage = "CONTATO";
  const { allowed: isAllowed, shouldCreateNew } = validateMovement(etapaAtual, proposedStage);
  console.log(`📋 [PADRÃO] "${mensagem}" → CONTATO (confiança: 50%)`);
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
Palavras: ok, okk, okkk, OK, joia, 👍, 👌, sim, blz, beleza, manda, pode mandar, envia, me manda, envia aí, manda aí

**FRACO/DÚVIDA → etapa:"CONTATO"**
Palavras: quero saber mais, como funciona, pode me explicar, qual operadora é melhor, oi, olá, bom dia, boa tarde, para de mandar mensagem

**NEGATIVE → etapa:"PERDIDO"**
Palavras: caro, muito caro, não quero, não gostei, não tenho interesse, para de mandar, não insista, chato, pare, bloquear, absurdo, péssimo, ruim, cancela tudo

**AUTOMÁTICA → etapa:"AUTOMÁTICA"** (mensagens de auto-resposta de empresas/bots)
Palavras: agradecem seu contato, agradecemos seu contato, como podemos ajudar, como posso ajudar, em que posso ajudar, sou assistente virtual, atendimento automático, bem-vindo ao, seja bem-vindo, deixe seu contato, aguarde, nosso suporte retornará, estamos verificando, fora do horário, resposta automática, horário de atendimento, nossa equipe entrará, selecione uma opção, digite o número, menu de opções

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

// ========================================
// VALIDAÇÕES PARA CRIAÇÃO DE OPORTUNIDADES
// ========================================

function isAtendentMessage(mensagem: string): boolean {
  const atendentePalavras = [
    "qual seu nome",
    "qual nome",
    "qual seu cpf",
    "qual cpf",
    "qual sua data de nascimento",
    "data de nascimento",
    "qual seu endereco",
    "qual endereco",
    "qual seu email",
    "qual email",
    "qual seu telefone",
    "qual telefone",
    "qual sua empresa",
    "qual empresa",
    "qual seu cnpj",
    "qual cnpj",
    "pergunta",
    "poderia responder",
    "pode responder",
  ];
  
  const msg = mensagem.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return atendentePalavras.some(palavra => msg.includes(palavra));
}

export async function validateOpportunityCreation(
  clientId: string,
  analysis: MessageAnalysis,
  isClientMessage: boolean = true,
  conversationId?: string,
  isPropostaAction: boolean = false
): Promise<OpportunityCreationRules> {
  // ❌ REGRA 1: Apenas mensagens do cliente (incoming)
  if (!isClientMessage) {
    return { podecriar: false, motivo: "Mensagem não é do cliente" };
  }

  // ❌ REGRA 2: Não criar se IA decidiu não agir
  if (!analysis.deveAgir) {
    return { podecriar: false, motivo: "IA decidiu não agir (deveAgir=false)" };
  }

  // ❌ REGRA 3: Etapa deve ser válida
  if (analysis.etapa === "" || analysis.etapa === "AUTOMÁTICA") {
    return { podecriar: false, motivo: "Etapa inválida ou automática" };
  }

  // ❌ REGRA 4: Nunca 2+ opps ativas por cliente
  const openOpps = await db
    .select()
    .from(opportunities)
    .where(
      and(
        eq(opportunities.clientId, clientId),
        inArray(opportunities.etapa, [
          "LEAD",
          "CONTATO",
          "PROPOSTA",
          "FORNECEDOR",
          "AUTOMÁTICA",
          "PROPOSTA ENVIADA",
          "AGUARDANDO CONTRATO",
          "CONTRATO ENVIADO",
          "AGUARDANDO ACEITE",
          "AGUARDANDO ATENÇÃO",
        ])
      )
    );

  if (openOpps.length > 0) {
    return {
      podecriar: false,
      motivo: `Cliente já tem ${openOpps.length} oportunidade(s) aberta(s)`,
    };
  }

  // ❌ REGRA 5: Conversa ativa (últimos 30 min) bloqueia criação (a menos que seja PROPOSTA)
  if (conversationId) {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    
    const recentMessages = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          gte(messages.createdAt, thirtyMinutesAgo),
          lt(messages.createdAt, now)
        )
      )
      .limit(1);

    // Se há conversa ativa e mensagem NÃO é PROPOSTA, bloquear
    if (recentMessages.length > 0 && !isPropostaAction && analysis.etapa !== "PROPOSTA") {
      return {
        podecriar: false,
        motivo: "Conversa ativa nos últimos 30 minutos - bloqueia criação (exceto PROPOSTA)",
      };
    }
  }

  // ✅ TODAS AS CONDIÇÕES ATENDIDAS
  return { podecriar: true, motivo: "Todas as condições atendidas", etapa: analysis.etapa };
}
