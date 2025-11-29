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
  
  // 🛑 RECUSA TOTAL → PERDIDO (verifica PRIMEIRO - é mais específico com "nada"/"tudo")
  // Procura por: "não quero renovar NADA", "cancela TUDO", "recusa completa"
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
    return {
      sentimento: "negativo",
      confianca: 95,
      motivo: "Recusa total detectada - cliente rejeita tudo",
      etapa: "perdido",
      deveAgir: true,
      sugestao: "Arquivar oportunidade",
    };
  }
  
  // 2️⃣ RECUSA PARCIAL/ALTERAÇÃO (quer modificar PARTE) → SEM MOVIMENTO
  // Procura por: "ALGUMAS", "TODAS", "PARCIAL", "REDUZIR"
  const recusaParcialPalavrasChave = [
    "cancelar algumas linhas",
    "algumas linhas",
    "cancelar parcial",
    "remover algumas",
    "nao quero todas as linhas",
    "nao vou renovar todas",
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
    "preciso consultar"
  ];
  
  if (recusaParcialPalavrasChave.some(palavra => msg.includes(palavra))) {
    return {
      sentimento: "neutro",
      confianca: 70,
      motivo: "Recusa parcial ou indecisão - cliente quer modificar, não rejeitar",
      etapa: "contato",
      deveAgir: false,
      sugestao: "Alertar atendente - cliente deseja ajustes",
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

🎯 DISTINÇÃO CRÍTICA - ORDEM DE VERIFICAÇÃO:

1️⃣ RECUSA TOTAL (rejeição COMPLETA) → PERDIDO, deveAgir=true
   Palavras-chave: "NADA", "TUDO" ("não quero renovar NADA", "cancela TUDO")
   Exemplos:
   ✓ "Não quero renovar nada" → perdido, true
   ✓ "Cancela tudo" → perdido, true
   ✓ "Recuso, não tenho interesse" → perdido, true

2️⃣ RECUSA PARCIAL/ALTERAÇÃO (quer modificar PARTE) → Mantém etapa, deveAgir=false
   Palavras-chave: "ALGUMAS", "PARCIAL", "REDUZIR" ("cancelar ALGUMAS linhas", "reduzir ALGUMAS")
   Exemplos:
   ✗ "Quero cancelar algumas linhas" → false (sem mover, alertar atendente)
   ✗ "Não vou renovar todas as linhas" → false (sem mover)
   ✗ "Reduzir apenas alguns serviços" → false (sem mover)

3️⃣ INDECISÃO (sem decisão clara) → Mantém etapa, deveAgir=false
   Exemplos:
   ✗ "Vou pensar" → false
   ✗ "Deixa comigo" → false
   ✗ "Ok blz" → false (neutra, sem intenção)

▶️ 4 ETAPAS (escolha 1):
1. "contato" - Pergunta preço/valor OU mensagem inicial ("oi", "tudo bem?")
2. "proposta" - APROVAÇÃO: "ok", "sim", "manda", "gostei", "legal", "adorei"
3. "fornecedor" - Mensagens automáticas: "deixe contato", "breve", "aguarde"
4. "perdido" - APENAS RECUSA TOTAL (rejeitou tudo)

▶️ RETORNE deveAgir:
- true = Movimento deve acontecer (aprovação, recusa total, pergunta sobre preço)
- false = Sem movimento (recusa parcial, indecisão, conversa neutra)

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
