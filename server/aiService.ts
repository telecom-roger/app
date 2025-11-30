import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface MessageAnalysis {
  sentimento: "positivo" | "negativo" | "neutro" | "fornecedor";
  confianca: number;
  motivo: string;
  etapa: "CONTATO" | "PROPOSTA" | "FORNECEDOR" | "PERDIDO" | "LEAD"; // Etapas automáticas em MAIÚSCULA
  deveAgir: boolean; // true = mover/criar, false = manter etapa atual sem mover
  ehRecusaParcial: boolean; // true = recusa parcial/alteração, alerta atendente
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
      sugestao: "⚠️ Cliente deseja ajustes - negociar modificações",
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
    return {
      sentimento: "negativo",
      confianca: 95,
      motivo: "Recusa total detectada - cliente rejeita tudo",
      etapa: "PERDIDO",
      deveAgir: true, // true = move para PERDIDO
      ehRecusaParcial: false,
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
      etapa: "FORNECEDOR",
      deveAgir: true,
      ehRecusaParcial: false,
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
      etapa: "PROPOSTA",
      deveAgir: true,
      ehRecusaParcial: false,
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
      etapa: "CONTATO",
      deveAgir: true,
      ehRecusaParcial: false,
      sugestao: "Enviar tabela",
    };
  }
  
  // 🤷 NEUTRO → CONTATO (padrão para qualquer mensagem inicial)
  return {
    sentimento: "neutro",
    confianca: 50,
    motivo: "Mensagem inicial",
    etapa: "CONTATO",
    deveAgir: true,
    ehRecusaParcial: false,
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
2. "PROPOSTA" - APROVAÇÃO: "ok", "sim", "manda", "gostei", "legal", "adorei"
3. "FORNECEDOR" - Mensagens automáticas: "deixe contato", "breve", "aguarde"
4. "PERDIDO" - APENAS RECUSA TOTAL (rejeitou tudo)

▶️ RETORNE deveAgir + ehRecusaParcial:
- deveAgir: true = Move para próxima etapa, false = Mantém etapa atual
- ehRecusaParcial: true = Cliente quer ajustes (alertar atendente), false = Padrão

JSON - ETAPAS EM MAIÚSCULA:
{"sentimento":"positivo","confianca":95,"motivo":"Cliente aprovou","etapa":"PROPOSTA","deveAgir":true,"ehRecusaParcial":false,"sugestao":"Enviar proposta"}

EXEMPLOS:
✓ "Não quero renovar nada" → etapa:"PERDIDO", deveAgir:true, ehRecusaParcial:false
✓ "Cancelar algumas linhas" → etapa:"CONTATO", deveAgir:false, ehRecusaParcial:true
✓ "Ok, manda" → etapa:"PROPOSTA", deveAgir:true, ehRecusaParcial:false`;

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
    
    // Normalizar etapa para MAIÚSCULA (OpenAI pode retornar em minúscula)
    analysis.etapa = analysis.etapa.toUpperCase() as any;
    console.log(`📝 [DEBUG] Etapa DEPOIS de normalizar: "${analysis.etapa}"`);
    console.log(`🤖 IA (OPENAI): ${analysis.sentimento} (${analysis.confianca}%) → ${analysis.etapa}`);
    return analysis;
  } catch (error) {
    console.error("❌ Erro IA:", error);
    console.log(`🧪 Caindo para análise local...`);
    return analyzeLocalTest(mensagem);
  }
}
