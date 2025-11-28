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

export async function analyzeClientMessage(
  mensagem: string,
  clienteInfo?: { nome?: string; razaoSocial?: string }
): Promise<MessageAnalysis> {
  try {
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

    const response = await client.messages.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Invalid response");

    const analysis = JSON.parse(content.text) as MessageAnalysis;
    console.log(`🤖 IA: ${analysis.sentimento} (${analysis.confianca}%) → ${analysis.etapa}`);
    return analysis;
  } catch (error) {
    console.error("❌ Erro IA:", error);
    return {
      sentimento: "neutro",
      confianca: 0,
      motivo: "Erro ao analisar",
      etapa: "automatico",
      sugestao: "Revisar manualmente",
    };
  }
}
