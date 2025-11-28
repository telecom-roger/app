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

// Modo de teste local (sem OpenAI API)
function analyzeLocalTest(mensagem: string): MessageAnalysis {
  const msg = mensagem.toLowerCase();
  
  // Fornecedor - contexto de empresa/fornecedor respondendo
  if (msg.includes("fornecedor") || msg.includes("empresa") || msg.includes("nfe") || msg.includes("protocolo") || msg.includes("cnpj")) {
    return {
      sentimento: "fornecedor",
      confianca: 90,
      motivo: "Resposta de fornecedor/empresa detectada",
      etapa: "fornecedor",
      sugestao: "Aguardando confirmação do fornecedor",
    };
  }
  
  if (msg.includes("ótimo") || msg.includes("gostei") || msg.includes("ok") || msg.includes("sim") || msg.includes("topa")) {
    return {
      sentimento: "positivo",
      confianca: 95,
      motivo: "Resposta positiva detectada",
      etapa: "proposta",
      sugestao: "Enviar simulador ou contrato",
    };
  }
  
  if (msg.includes("não") || msg.includes("nãoquero") || msg.includes("recuso") || msg.includes("cancelar") || msg.includes("obrigado")) {
    return {
      sentimento: "negativo",
      confianca: 90,
      motivo: "Resposta negativa detectada",
      etapa: "perdido",
      sugestao: "Arquivar ou tentar resgate posterior",
    };
  }
  
  if (msg.includes("preço") || msg.includes("quanto") || msg.includes("valor") || msg.includes("custa")) {
    return {
      sentimento: "positivo",
      confianca: 85,
      motivo: "Pergunta sobre preço",
      etapa: "lead",
      sugestao: "Enviar tabela de preços",
    };
  }
  
  return {
    sentimento: "neutro",
    confianca: 50,
    motivo: "Mensagem neutra",
    etapa: "automatico",
    sugestao: "Revisar manualmente",
  };
}

export async function analyzeClientMessage(
  mensagem: string,
  clienteInfo?: { nome?: string; razaoSocial?: string }
): Promise<MessageAnalysis> {
  try {
    // MODO TESTE: Usar análise local se não tiver créditos OpenAI
    const useLocalMode = !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.length < 10;
    
    if (useLocalMode) {
      console.log(`🧪 [MODO TESTE] Analisando sem OpenAI API`);
      const analysis = analyzeLocalTest(mensagem);
      console.log(`🤖 IA (LOCAL): ${analysis.sentimento} (${analysis.confianca}%) → ${analysis.etapa}`);
      return analysis;
    }

    const prompt = `Analise RAPIDAMENTE essa resposta de cliente e retorne JSON PURO (sem markdown):

MENSAGEM: "${mensagem}"
CLIENTE: ${clienteInfo?.razaoSocial || clienteInfo?.nome || "Desconhecido"}

Classificação rápida:
- "OK", "SIM", "TOPA", "MANDA" → sentimento positivo, etapa proposta
- "NÃO", "RECUSO", "DELETAR" → sentimento negativo, etapa perdido  
- Pergunta sobre preço/info → sentimento positivo, etapa lead
- Empresa/fornecedor respondendo → sentimento fornecedor, etapa fornecedor
- Só confirmou recebimento → sentimento neutro, etapa automatico

Responda APENAS com JSON válido (sem markdown, sem código blocks):
{"sentimento":"positivo","confianca":90,"motivo":"Respondeu OK","etapa":"proposta","sugestao":"Enviar simulador"}`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const messageContent = response.choices[0].message.content;
    if (!messageContent) throw new Error("Empty response from AI");

    const analysis = JSON.parse(messageContent) as MessageAnalysis;
    console.log(`🤖 IA (OPENAI): ${analysis.sentimento} (${analysis.confianca}%) → ${analysis.etapa}`);
    return analysis;
  } catch (error) {
    console.error("❌ Erro IA:", error);
    console.log(`🧪 Caindo para análise local...`);
    return analyzeLocalTest(mensagem);
  }
}
