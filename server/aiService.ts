import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface MessageAnalysis {
  sentimento: "positivo" | "negativo" | "neutro" | "fornecedor";
  confianca: number;
  motivo: string;
  etapa: "automatico" | "lead" | "contato" | "proposta" | "fechado" | "perdido" | "fornecedor";
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
  
  // 🛑 RECUSA TOTAL → PERDIDO (palavras-chave normalizadas - maiúsculas/acentos automáticos)
  const recusaTotal = [
    "nao quero renovar",
    "cancela tudo",
    "nao tenho interesse",
    "nao quero nenhum plano",
    "nao quero",
    "recuso",
    "nao me interessa",
    "nao tenho mais interesse"
  ];
  if (recusaTotal.some(palavra => msg.includes(palavra))) {
    return {
      sentimento: "negativo",
      confianca: 95,
      motivo: "Recusa total detectada",
      etapa: "perdido",
      sugestao: "Arquivar oportunidade",
    };
  }
  
  // ℹ️ RECUSA PARCIAL → NÃO MOVE (não gera ação - normalizadas)
  const recusaParcial = [
    "cancelar algumas linhas",
    "cancelar parcial",
    "remover algumas",
    "quero apenas algumas",
    "nao quero algumas",
  ];
  if (recusaParcial.some(palavra => msg.includes(palavra))) {
    return {
      sentimento: "neutro",
      confianca: 70,
      motivo: "Recusa parcial - não afeta etapa",
      etapa: "automatico",
      sugestao: "Conversar com cliente sobre parcelas",
    };
  }
  
  // 📲 FORNECEDOR/AUTOMÁTICA → FORNECEDOR (mensagens automáticas - normalizadas)
  const fornecedor = [
    "deixe seu contato",
    "breve",
    "aguarde",
    "em breve",
    "entro em contato"
  ];
  if (fornecedor.some(palavra => msg.includes(palavra))) {
    return {
      sentimento: "fornecedor",
      confianca: 90,
      motivo: "Mensagem automática ou de fornecedor",
      etapa: "fornecedor",
      sugestao: "Aguardando resposta posterior",
    };
  }
  
  // ✅ APROVAÇÃO → PROPOSTA (palavras-chave de aprovação - normalizadas)
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
      motivo: "Aprovação ou autorização detectada",
      etapa: "proposta",
      sugestao: "Enviar proposta formal",
    };
  }
  
  // ❓ INFORMAÇÃO → CONTATO (perguntas sobre preço/valor - normalizadas)
  const precoKeywords = ["preco", "quanto", "valor", "custa"];
  if (precoKeywords.some(palavra => msg.includes(palavra))) {
    return {
      sentimento: "positivo",
      confianca: 85,
      motivo: "Pergunta sobre preço/valor",
      etapa: "contato",
      sugestao: "Enviar tabela de preços",
    };
  }
  
  // 🤷 NEUTRO → CONTATO (por padrão, qualquer mensagem inicial do cliente vai para CONTATO)
  return {
    sentimento: "neutro",
    confianca: 50,
    motivo: "Mensagem inicial - cliente em contato",
    etapa: "contato",
    sugestao: "Engajar com cliente",
  };
}

export async function analyzeClientMessage(
  mensagem: string,
  clienteInfo?: { nome?: string }
): Promise<MessageAnalysis> {
  try {
    // MODO TESTE: SEMPRE usar análise local para evitar problemas com OpenAI
    // Usar OpenAI apenas se tiver variável específica para produção
    const useLocalMode = true; // SEMPRE usar local agora
    
    if (useLocalMode) {
      console.log(`🧪 [MODO LOCAL] Analisando com regras locais (confiável)`);
      const analysis = analyzeLocalTest(mensagem);
      console.log(`🤖 IA (LOCAL): ${analysis.sentimento} (${analysis.confianca}%) → ${analysis.etapa}`);
      return analysis;
    }

    const prompt = `Analise RAPIDAMENTE essa resposta de cliente e retorne JSON PURO (sem markdown):

MENSAGEM: "${mensagem}"
CLIENTE: ${clienteInfo?.nome || "Desconhecido"}

REGRAS DE CLASSIFICAÇÃO - SIGA EXATAMENTE (IA trabalha APENAS em 4 etapas automáticas):

▶️ ETAPAS AUTOMÁTICAS (4 apenas - retorne em MINÚSCULA):
1. "contato" - Cliente pergunta preço, valor, quanto custa (quer informação)
2. "proposta" - Cliente diz "ok", "sim", "manda", "pode enviar", "quero renovar" (aprovação)
3. "fornecedor" - Mensagens automáticas: "deixe seu contato", "breve", "aguarde", "em breve"
4. "perdido" - Recusa TOTAL: "não quero renovar", "cancela tudo", "não tenho interesse"

⚠️ CASOS ESPECIAIS:
- "Quero cancelar algumas linhas" (recusa PARCIAL) → retorne "automatico" (NÃO move)
- "Vou pensar", "depois te falo" (indecisão) → retorne "automatico" (NÃO move)
- Conversas normais ("oi", "tudo bem", "ok blz") → retorne "automatico" (NÃO move)

❌ NUNCA RETORNE ESTAS (são 100% manuais):
- lead, proposta_enviada, contrato_enviado, aguardando_contrato, aguardando_aceite, fechado

Responda APENAS com JSON (sem markdown) - ETAPAS EM MINÚSCULA:
{"sentimento":"positivo","confianca":95,"motivo":"Cliente aprovou","etapa":"proposta","sugestao":"Enviar proposta"}`;

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
