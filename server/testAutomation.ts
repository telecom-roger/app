import { db } from "./db";
import { clients, conversations, messages, opportunities } from "@shared/schema";
import { createFollowUpAfterResponse } from "./automationService";
import { eq } from "drizzle-orm";

/**
 * Simula uma resposta de cliente para testar automação
 * Cria follow-ups automáticos, atualiza score, etc.
 */
export async function simulateClientResponse(clientId: string, userId: string, messageText: string) {
  console.log(`\n🧪 [TEST] Simulando resposta do cliente ${clientId}...`);

  try {
    // 1. Buscar cliente
    const client = await db.query.clients.findFirst({
      where: (c: any) => eq(c.id, clientId),
    });

    if (!client) {
      throw new Error(`Cliente ${clientId} não encontrado`);
    }

    console.log(`   ✅ Cliente encontrado: ${client.nome}`);

    // 2. Criar/buscar conversa
    let conversation = await db.query.conversations.findFirst({
      where: (c: any) => eq(c.clientId, clientId),
    });

    if (!conversation) {
      const [newConv] = await db
        .insert(conversations)
        .values({ clientId, userId })
        .returning();
      conversation = newConv;
      console.log(`   ✅ Conversa criada`);
    }

    // 3. Criar mensagem
    await db.insert(messages).values({
      conversationId: conversation.id,
      sender: "client",
      content: messageText,
      tipo: "text",
    });

    console.log(`   ✅ Mensagem criada: "${messageText}"`);

    // 4. Criar follow-ups automáticos (1, 3, 7 dias)
    await createFollowUpAfterResponse(clientId, userId, conversation.id);

    console.log(`   ✅ 3 Follow-ups agendados (1, 3, 7 dias)`);
    console.log(`\n🎉 Teste simulado com sucesso!\n`);

    return {
      success: true,
      clientId,
      conversationId: conversation.id,
      message: `Teste simulado para ${client.nome}`,
    };
  } catch (error) {
    console.error(`   ❌ Erro no teste:`, error);
    throw error;
  }
}

/**
 * Get todas as tarefas de automação
 */
export async function getAllAutomationTasks() {
  const tasks = await db.query.automationTasks.findMany();
  return tasks;
}

/**
 * Get todos os follow-ups registrados
 */
export async function getAllFollowUps() {
  const followups = await db.query.followUps.findMany();
  return followups;
}

/**
 * Get scores de todos clientes
 */
export async function getAllClientScores() {
  const scores = await db.query.clientScores.findMany();
  return scores;
}
