import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface MessageAnalysis {
  sentimento: "positivo" | "negativo" | "neutro" | "fornecedor";
  confianca: number;
  motivo: string;
  etapa: "contato" | "proposta" | "fornecedor" | "perdido"; // Apenas 4 etapas automáticas!
  deveAgir: boolean; // true = mover/criar, false = ignorar (recusa parcial, indecisão, etc)
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
  
  // 🛑 RECUSA PARCIAL DEVE VIR PRIMEIRO (mais específico)
  const recusaParcial = [
    "cancelar algumas linhas", "cancelar parcial", "remover algumas",
    "quero apenas algumas", "nao quero algumas", "quero so", "somente o",
    "vou pensar", "deixa comigo", "depois te falo", "ta bom", "ok blz",
    "e tal", "nao agora"
  ];
  if (recusaParcial.some(palavra => msg.includes(palavra))) {
    return {
      sentimento: "neutro",
      confianca: 70,
      motivo: "Recusa parcial - não altera etapa",
      etapa: "contato",
      deveAgir: false,
      sugestao: "Aguardar decisão do cliente",
    };
  }
  
  // 🛑 RECUSA TOTAL → PERDIDO (após verificar parcial)
  const recusaTotal = [
    "nao quero renovar nada", "cancela tudo", "nao tenho interesse",
    "nao quero nenhum", "recuso", "nao me interessa", "empresa nao existe",
    "nao vai dar", "muito caro", "vou para concorrente", "trocar de fornecedor"
  ];
  if (recusaTotal.some(palavra => msg.includes(palavra))) {
    return {
      sentimento: "negativo",
      confianca: 95,
      motivo: "Recusa total detectada",
      etapa: "perdido",
      deveAgir: true,
      sugestao: "Arquivar oportunidade",
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
      deveAgir: true,
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
      etapa: "proposta",
      deveAgir: true,
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
      deveAgir: true,
      sugestao: "Enviar tabela",
    };
  }
  
  // 🤷 NEUTRO → CONTATO (padrão para qualquer mensagem inicial)
  return {
    sentimento: "neutro",
    confianca: 50,
    motivo: "Mensagem inicial",
    etapa: "contato",
    deveAgir: true,
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

    const prompt = `Analise RAPIDAMENTE essa resposta de cliente. Retorne JSON PURO (sem markdown):

MENSAGEM: "${mensagem}"
CLIENTE: ${clienteInfo?.nome || "Desconhecido"}

🎯 DISTINÇÃO CRÍTICA:
- RECUSA TOTAL: Cliente rejeita TUDO ("não quero renovar", "cancela tudo", "recuso", "não tenho interesse")
- RECUSA PARCIAL: Cliente quer modificar parte ("cancelar algumas linhas", "quero só 1 linha", "remover alguns serviços")
- INDECISÃO: ("vou pensar", "deixa comigo", "depois te falo")

▶️ 4 ETAPAS (escolha 1):
1. "contato" - Pergunta preço/valor OU mensagem inicial genérica ("oi", "tudo bem?")
2. "proposta" - APROVAÇÃO CLARA: "ok", "sim", "manda", "gostei", "legal", "adorei", "vamo fechar"
3. "fornecedor" - Mensagens automáticas: "deixe contato", "breve", "aguarde"
4. "perdido" - APENAS RECUSA TOTAL (rejeição completa)

▶️ DEVE AGIR (true/false):
- true = Intenção CLARA: aprovação, recusa total, pergunta sobre preço
- false = Recusa PARCIAL, indecisão, ou conversa sem intenção

⚠️ EXEMPLOS DE FALSE (não agir):
✗ "Quero cancelar algumas linhas" → false (recusa parcial)
✗ "Não quero renovar os serviços X e Y, mas e o Z?" → false (parcial)
✗ "Vou pensar" → false (indecisão)
✗ "Deixa comigo" → false (indecisão)
✗ "Ok blz" → false (neutra)

⚠️ EXEMPLOS DE TRUE (agir):
✓ "Não quero renovar NADA" → perdido, true (total)
✓ "Cancela tudo" → perdido, true (total)
✓ "Ok, manda" → proposta, true (aprovação)
✓ "Qual é o preço?" → contato, true (pergunta)

JSON - ETAPAS EM MINÚSCULA:
{"sentimento":"positivo","confianca":95,"motivo":"Cliente aprovou","etapa":"proposta","deveAgir":true,"sugestao":"Enviar proposta"}`;

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
