import * as storage from "./storage";
import { db } from "./db";
import { eq, and, lt } from "drizzle-orm";
import { automationTasks, followUps, clientScores, opportunities, messages } from "@shared/schema";

// ======================== TESTE RÁPIDO: Intervalos pequenos para teste ========================
export async function createTestFollowUps(clientId: string, userId: string, conversationId: string) {
  try {
    console.log(`🧪 [TEST MODE] Criando follow-ups de teste (1, 2, 3 minutos)...`);

    await db.insert(automationTasks).values({
      userId,
      clientId,
      tipo: "follow_up",
      proximaExecucao: new Date(Date.now() + 1 * 60 * 1000),
      dados: { numero: 1, conversationId, dias: 1 },
    });

    await db.insert(automationTasks).values({
      userId,
      clientId,
      tipo: "follow_up",
      proximaExecucao: new Date(Date.now() + 2 * 60 * 1000),
      dados: { numero: 2, conversationId, dias: 2 },
    });

    await db.insert(automationTasks).values({
      userId,
      clientId,
      tipo: "follow_up",
      proximaExecucao: new Date(Date.now() + 3 * 60 * 1000),
      dados: { numero: 3, conversationId, dias: 3 },
    });

    console.log(`✅ Follow-ups de teste criados (1min, 2min, 3min)`);
  } catch (error) {
    console.error(`❌ Erro:`, error);
    throw error;
  }
}

// ======================== MOVIMENTO AUTOMÁTICO NO KANBAN ========================
export async function createTestKanbanMovement(clientId: string, userId: string) {
  try {
    console.log(`🧪 [TEST MODE] Criando movimento automático no Kanban...`);

    const client = await db.query.clients.findFirst({
      where: (c: any) => eq(c.id, clientId),
    });

    if (!client) throw new Error("Cliente não encontrado");

    const opp1 = await db.query.opportunities.findFirst({
      where: (o: any) => and(eq(o.clientId, clientId), eq(o.etapa, "lead")),
    });

    if (opp1) {
      await db.insert(automationTasks).values({
        userId,
        clientId,
        tipo: "kanban_move",
        proximaExecucao: new Date(Date.now() + 1 * 60 * 1000),
        dados: { oppId: opp1.id, fromStage: "lead", toStage: "contato" },
      });
    }

    const opp2 = await db.query.opportunities.findFirst({
      where: (o: any) => and(eq(o.clientId, clientId), eq(o.etapa, "contato")),
    });

    if (opp2) {
      await db.insert(automationTasks).values({
        userId,
        clientId,
        tipo: "kanban_move",
        proximaExecucao: new Date(Date.now() + 2 * 60 * 1000),
        dados: { oppId: opp2.id, fromStage: "contato", toStage: "proposta" },
      });
    }

    const opp3 = await db.query.opportunities.findFirst({
      where: (o: any) => and(eq(o.clientId, clientId), eq(o.etapa, "proposta")),
    });

    if (opp3) {
      await db.insert(automationTasks).values({
        userId,
        clientId,
        tipo: "kanban_move",
        proximaExecucao: new Date(Date.now() + 3 * 60 * 1000),
        dados: { oppId: opp3.id, fromStage: "proposta", toStage: "fechado" },
      });
    }

    console.log(`✅ Movimentos de Kanban agendados`);
  } catch (error) {
    console.error(`❌ Erro:`, error);
    throw error;
  }
}

export async function executeKanbanMove(task: any) {
  try {
    const taskData = task.dados || {};
    const { oppId, toStage } = taskData;

    console.log(`📊 Movendo para: ${toStage}`);

    await db
      .update(opportunities)
      .set({ etapa: toStage })
      .where(eq(opportunities.id, oppId));

    console.log(`✅ Movido!`);
  } catch (error) {
    console.error(`❌ Erro:`, error);
  }
}

export async function processAutomationTasks() {
  try {
    console.log(`\n🤖 [AUTOMATION] Processando tarefas agendadas...`);
    
    const now = new Date();
    const pendingTasks = await db
      .select()
      .from(automationTasks)
      .where(
        and(
          eq(automationTasks.status, "pendente"),
          lt(automationTasks.proximaExecucao, now)
        )
      )
      .limit(50);

    console.log(`📋 Encontradas ${pendingTasks.length} tarefas`);

    for (const task of pendingTasks) {
      try {
        await executeAutomationTask(task);
      } catch (error) {
        console.error(`❌ Erro:`, error);
      }
    }
  } catch (error) {
    console.error(`❌ Erro geral:`, error);
  }
}

async function executeAutomationTask(task: any) {
  switch (task.tipo) {
    case "follow_up":
      await executeFollowUp(task);
      break;
    case "kanban_move":
      await executeKanbanMove(task);
      break;
  }

  await db
    .update(automationTasks)
    .set({
      status: "executado",
      ultimaTentativa: new Date(),
      tentativas: (task.tentativas || 0) + 1,
    })
    .where(eq(automationTasks.id, task.id));
}

async function executeFollowUp(task: any) {
  const taskData = task.dados || {};
  
  console.log(`📞 Follow-up #${taskData.numero}`);

  const client = await db.query.clients.findFirst({
    where: (c: any) => eq(c.id, task.clientId),
  });

  if (!client) return;

  await storage.createNotification({
    titulo: `📞 Follow-up #${taskData.numero} - ${client.nome}`,
    descricao: `Cliente sem resposta. Resgate agora!`,
    clientId: task.clientId,
    userId: task.userId,
  });

  await db.insert(followUps).values({
    userId: task.userId,
    clientId: task.clientId,
    numero: taskData.numero || 1,
    diasSinceLastContact: 0,
    executadoEm: new Date(),
    descricao: `Follow-up #${taskData.numero} executado`,
  });
}

export async function updateClientScore(clientId: string, userId: string) {
  try {
    console.log(`⭐ Atualizando score...`);

    const opps = await db
      .select()
      .from(opportunities)
      .where(eq(opportunities.clientId, clientId));

    let scoreIA = 40;
    if (opps.length > 0) {
      const lastOpp = opps[opps.length - 1];
      if (lastOpp.etapa === "fechado") scoreIA = 100;
    }

    const scoreTotal = Math.round(scoreIA);

    const existing = await db
      .select()
      .from(clientScores)
      .where(
        and(
          eq(clientScores.clientId, clientId),
          eq(clientScores.userId, userId)
        )
      );

    if (existing.length > 0) {
      await db
        .update(clientScores)
        .set({
          scoreTotal,
          ultimaAtualizacao: new Date(),
        })
        .where(eq(clientScores.id, existing[0].id));
    } else {
      await db.insert(clientScores).values({
        userId,
        clientId,
        scoreTotal,
        proximaAtualizacao: new Date(),
      });
    }
  } catch (error) {
    console.error(`❌ Erro:`, error);
  }
}

export function startAutomationCron() {
  console.log(`\n⏰ [AUTOMATION CRON] Iniciando scheduler...`);
  
  const interval = setInterval(() => {
    processAutomationTasks().catch(console.error);
  }, 5 * 60 * 1000);

  processAutomationTasks().catch(console.error);

  return () => clearInterval(interval);
}

export async function getAllAutomationTasks() {
  const tasks = await db.query.automationTasks.findMany();
  return tasks;
}

export async function getAllFollowUps() {
  const followups = await db.query.followUps.findMany();
  return followups;
}

export async function getAllClientScores() {
  const scores = await db.query.clientScores.findMany();
  return scores;
}

export async function simulateClientResponse(clientId: string, userId: string, messageText: string) {
  console.log(`\n🧪 [TEST] Simulando resposta do cliente ${clientId}...`);
  return { success: true, clientId, message: "Teste criado" };
}
