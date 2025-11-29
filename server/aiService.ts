import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface MessageAnalysis {
  sentimento: "positivo" | "negativo" | "neutro" | "fornecedor";
  confianca: number;
  motivo: string;
  etapa: "contato" | "proposta" | "fornecedor" | "perdido"; // Apenas 4 etapas automáticas!
  acao: "criar" | "mover" | "nenhuma"; // Indica se deve criar, mover ou ignorar
  sugestao: string;
}

// Normalizar mensagem: minúsculas + remove acentos
function normalizeMessage(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Remove acentos
}

// Modo de teste local (sem OpenAI API)
function analyzeLocalTest(mensagem: string): MessageAnalysis {
  const msg = normalizeMessage(mensagem);
  
  // 🛑 RECUSA TOTAL → PERDIDO
  const recusaTotal = [
    "nao quero renovar", "cancela tudo", "nao tenho interesse",
    "nao quero nenhum plano", "nao quero", "recuso", "nao me interessa", "nao tenho mais interesse"
  ];
  if (recusaTotal.some(palavra => msg.includes(palavra))) {
    return {
      sentimento: "negativo",
      confianca: 95,
      motivo: "Recusa total detectada",
      etapa: "perdido",
      acao: "criar",
      sugestao: "Arquivar oportunidade",
    };
  }
  
  // ℹ️ RECUSA PARCIAL → NÃO MOVE
  const recusaParcial = [
    "cancelar algumas linhas", "cancelar parcial", "remover algumas",
    "quero apenas algumas", "nao quero algumas", "vou pensar", "deixa comigo",
    "depois te falo"
  ];
  if (recusaParcial.some(palavra => msg.includes(palavra))) {
    return {
      sentimento: "neutro",
      confianca: 70,
      motivo: "Recusa parcial - não afeta etapa",
      etapa: "contato",
      acao: "nenhuma",
      sugestao: "Conversar com cliente",
    };
  }
  
  // 📲 FORNECEDOR
  const fornecedor = ["deixe seu contato", "breve", "aguarde", "em breve", "entro em contato"];
  if (fornecedor.some(palavra => msg.includes(palavra))) {
    return {
      sentimento: "fornecedor",
      confianca: 90,
      motivo: "Mensagem automática",
      etapa: "fornecedor",
      acao: "criar",
      sugestao: "Aguardando resposta",
    };
  }
  
  // ✅ APROVAÇÃO → PROPOSTA
  const aprovacao = [
    "ok", "sim", "manda", "pode enviar", "quero renovar", "topa", "pode", "vamos la",
    "gostei", "adorei", "legal", "otimo", "maravilha", "perfeito", "excelente",
    "bora", "vamo", "blz", "show", "massa", "incrivel", "top", "amei",
    "fechado", "confira", "envia", "envia ai", "pede ai", "me envia"
  ];
  if (aprovacao.some(palavra => msg.includes(palavra))) {
    return {
      sentimento: "positivo",
      confianca: 95,
      motivo: "Aprovação detectada",
      etapa: "proposta",
      acao: "criar",
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
      etapa: "contato",
      acao: "criar",
      sugestao: "Enviar tabela",
    };
  }
  
  // 🤷 NEUTRO → CONTATO (padrão para qualquer mensagem inicial)
  return {
    sentimento: "neutro",
    confianca: 50,
    motivo: "Mensagem inicial",
    etapa: "contato",
    acao: "criar",
    sugestao: "Engajar",
  };
}

export async function analyzeClientMessage(
  mensagem: string,
  clienteInfo?: { nome?: string }
): Promise<MessageAnalysis> {
  try {
    // Usar OpenAI para análise de sentimento (a IA entende melhor variações, acentos, erros)
    const useLocalMode = false; // ✅ ATIVAR OPENAI - IA entende tudo!
    
    if (useLocalMode) {
      console.log(`🧪 [MODO LOCAL] Analisando com regras locais (confiável)`);
      const analysis = analyzeLocalTest(mensagem);
      console.log(`🤖 IA (LOCAL): ${analysis.sentimento} (${analysis.confianca}%) → ${analysis.etapa}`);
      return analysis;
    }

    const prompt = `Analise RAPIDAMENTE essa resposta de cliente e retorne JSON PURO (sem markdown):

MENSAGEM: "${mensagem}"
CLIENTE: ${clienteInfo?.nome || "Desconhecido"}

REGRAS - RETORNE EXATAMENTE UMA DESTAS 4 ETAPAS + AÇÃO:

▶️ ETAPAS AUTOMÁTICAS (4 apenas):
1. "contato" - Cliente quer informação: preço, valor, quantidade, detalhes OU mensagens iniciais genéricas ("oi", "tudo bem?")
2. "proposta" - Cliente aprova: "ok", "sim", "manda", "pode enviar", "quero renovar", "legal", "gostei"
3. "fornecedor" - Mensagens automáticas: "deixe seu contato", "breve", "aguarde"
4. "perdido" - Recusa TOTAL: "não quero renovar", "cancela tudo", "não tenho interesse", "recuso"

▶️ AÇÃO (obrigatório):
- "criar" = Primeira resposta do cliente OU movimento claro de etapa
- "mover" = Cliente já respondeu antes, esta é nova informação para mover etapa
- "nenhuma" = Recusa parcial, indecisão, conversa extensa (não age)

⚠️ CASOS ESPECIAIS - RETORNE "nenhuma":
- "Quero cancelar algumas linhas" (parcial)
- "Vou pensar", "depois te falo", "deixa comigo" (indecisão)
- Conversas normais extensas sem intenção clara

❌ NUNCA RETORNE ESTAS (100% manuais):
- lead, proposta_enviada, contrato_enviado, aguardando_contrato, aguardando_aceite, fechado

Responda APENAS JSON - ETAPAS EM MINÚSCULA:
{"sentimento":"positivo","confianca":95,"motivo":"Cliente aprovou","etapa":"proposta","acao":"criar","sugestao":"Enviar proposta"}`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const messageContent = response.choices[0].message.content;
    if (!messageContent) throw new Error("Empty response from AI");

    console.log(`📝 [DEBUG] Resposta bruta do OpenAI: ${messageContent}`);
    
    const analysis = JSON.parse(messageContent) as MessageAnalysis;
    console.log(`📝 [DEBUG] Etapa ANTES de normalizar: "${analysis.etapa}"`);
    
    // Normalizar etapa para minúscula (OpenAI pode retornar em MAIÚSCULA)
    analysis.etapa = analysis.etapa.toLowerCase() as any;
    console.log(`📝 [DEBUG] Etapa DEPOIS de normalizar: "${analysis.etapa}"`);
    console.log(`🤖 IA (OPENAI): ${analysis.sentimento} (${analysis.confianca}%) → ${analysis.etapa}`);
    return analysis;
  } catch (error) {
    console.error("❌ Erro IA:", error);
    console.log(`🧪 Caindo para análise local...`);
    return analyzeLocalTest(mensagem);
  }
}
