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
  
  // Fornecedor/Mensagem Automática - contexto de empresa/fornecedor respondendo OU mensagem automática
  if (msg.includes("fornecedor") || msg.includes("empresa") || msg.includes("nfe") || msg.includes("protocolo") || msg.includes("cnpj") || msg.includes("automático") || msg.includes("automática") || msg.includes("automaticas") || msg.includes("entro em contato") || msg.includes("deixe seu contato") || msg.includes("em contato em breve") || msg.includes("assim que") || msg.includes("breve entraremos") || msg.includes("breve")) {
    return {
      sentimento: "fornecedor",
      confianca: 90,
      motivo: "Mensagem automática ou resposta de fornecedor detectada",
      etapa: "FORNECEDOR",
      sugestao: "Aguardando confirmação ou contato posterior",
    };
  }
  
  if (msg.includes("ótimo") || msg.includes("gostei") || msg.includes("ok") || msg.includes("sim") || msg.includes("topa")) {
    return {
      sentimento: "positivo",
      confianca: 95,
      motivo: "Resposta positiva detectada",
      etapa: "PROPOSTA",
      sugestao: "Enviar contrato para assinatura",
    };
  }
  
  if (msg.includes("não") || msg.includes("nãoquero") || msg.includes("recuso") || msg.includes("cancelar") || msg.includes("obrigado")) {
    return {
      sentimento: "negativo",
      confianca: 90,
      motivo: "Resposta negativa detectada",
      etapa: "PERDIDO",
      sugestao: "Arquivar ou tentar resgate posterior",
    };
  }
  
  if (msg.includes("preço") || msg.includes("quanto") || msg.includes("valor") || msg.includes("custa")) {
    return {
      sentimento: "positivo",
      confianca: 85,
      motivo: "Pergunta sobre preço",
      etapa: "CONTATO",
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
  clienteInfo?: { nome?: string }
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
CLIENTE: ${clienteInfo?.nome || "Desconhecido"}

REGRAS DE CLASSIFICAÇÃO - SIGA EXATAMENTE (IA só trabalha em 5 etapas):
1. "OK", "SIM", "TOPA", "MANDA", qualquer aprovação → etapa "PROPOSTA", sentimento "positivo"
2. "NÃO", "RECUSO", "CANCELAR", rejeição → etapa "PERDIDO", sentimento "negativo"
3. "QUANTO", "PREÇO", "VALOR", "CUSTA" → etapa "CONTATO", sentimento "positivo"
4. AUTOMÁTICA, "BREVE", "DEIXE SEU CONTATO", "ENTRO EM CONTATO", mensagens automáticas → etapa "FORNECEDOR", sentimento "fornecedor"
5. Empresa/fornecedor/NF/protocolo/CNPJ → etapa "FORNECEDOR", sentimento "fornecedor"
6. "FECHADO", "CONTRATADO", "APROVADO" (após Aguardando Aceite) → etapa "FECHADO", sentimento "positivo"
7. Qualquer outra mensagem → retorne "CONTATO" como etapa padrão

Responda APENAS com JSON (sem markdown):
{"sentimento":"positivo","confianca":90,"motivo":"Respondeu OK","etapa":"PROPOSTA","sugestao":"Enviar contrato"}`;

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
