import * as storage from "./storage";
import { db } from "./db";
import { eq, and, lt, asc } from "drizzle-orm";
import { automationTasks, followUps, clientScores, opportunities, messages, conversations } from "@shared/schema";
import { analyzeClientMessage } from "./aiService";

// ======================== TESTE RÁPIDO: Intervalos pequenos para teste ========================
export async function createTestFollowUps(clientId: string, userId: string, conversationId: string) {
  try {
    console.log(`🧪 [TEST MODE] Criando follow-ups de teste (execução imediata)...`);

    const now = new Date();
    
    await db.insert(automationTasks).values({
      userId,
      clientId,
      tipo: "follow_up",
      status: "pendente",
      proximaExecucao: new Date(now.getTime() - 10 * 1000), // 10 segundos no passado = EXECUTA AGORA
      dados: { numero: 1, conversationId, dias: 1 },
    });

    await db.insert(automationTasks).values({
      userId,
      clientId,
      tipo: "follow_up",
      status: "pendente",
      proximaExecucao: new Date(now.getTime() - 5 * 1000), // 5 segundos no passado = EXECUTA AGORA
      dados: { numero: 2, conversationId, dias: 2 },
    });

    await db.insert(automationTasks).values({
      userId,
      clientId,
      tipo: "follow_up",
      status: "pendente",
      proximaExecucao: new Date(now.getTime()), // AGORA
      dados: { numero: 3, conversationId, dias: 3 },
    });

    console.log(`✅ Follow-ups de teste criados (execução imediata)`);
  } catch (error) {
    console.error(`❌ Erro:`, error);
    throw error;
  }
}

// ======================== MOVIMENTO AUTOMÁTICO NO KANBAN ========================
export async function createTestKanbanMovement(clientId: string, userId: string) {
  try {
    console.log(`🧪 [TEST MODE] Criando 3 oportunidades com fluxo completo...`);

    const client = await db.query.clients.findFirst({
      where: (c: any) => eq(c.id, clientId),
    });

    if (!client) throw new Error("Cliente não encontrado");

    const now = new Date();
    const timestamp = now.getTime();
    
    // Cria 3 oportunidades de teste NOVAS com etapas diferentes
    const opp1 = await db.insert(opportunities).values({
      clientId,
      titulo: `Test Kanban 1 - Lead (${timestamp})`,
      etapa: "Lead",
      valorEstimado: "1000",
      responsavelId: userId,
      ordem: 0,
    }).returning().then(r => r[0]);

    const opp2 = await db.insert(opportunities).values({
      clientId,
      titulo: `Test Kanban 2 - Contato (${timestamp})`,
      etapa: "Contato",
      valorEstimado: "2000",
      responsavelId: userId,
      ordem: 1,
    }).returning().then(r => r[0]);

    const opp3 = await db.insert(opportunities).values({
      clientId,
      titulo: `Test Kanban 3 - Proposta (${timestamp})`,
      etapa: "Proposta",
      valorEstimado: "3000",
      responsavelId: userId,
      ordem: 2,
    }).returning().then(r => r[0]);

    // Agenda movimentos automáticos em sequência
    // Opp1: Lead → Contato (executa em 5s)
    await db.insert(automationTasks).values({
      userId,
      clientId,
      tipo: "kanban_move",
      status: "pendente",
      proximaExecucao: new Date(now.getTime() - 10 * 1000),
      dados: { oppId: opp1.id, toStage: "Contato" },
    });

    // Opp2: Contato → Proposta (executa em 5s)
    await db.insert(automationTasks).values({
      userId,
      clientId,
      tipo: "kanban_move",
      status: "pendente",
      proximaExecucao: new Date(now.getTime() - 5 * 1000),
      dados: { oppId: opp2.id, toStage: "Proposta" },
    });

    // Opp3: Proposta → Fechado (executa agora)
    await db.insert(automationTasks).values({
      userId,
      clientId,
      tipo: "kanban_move",
      status: "pendente",
      proximaExecucao: new Date(now.getTime()),
      dados: { oppId: opp3.id, toStage: "Fechado" },
    });

    console.log(`✅ 3 oportunidades criadas + 3 movimentos agendados (Lead→Contato→Proposta→Fechado)`);
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
  
  console.log(`📞 Follow-up #${taskData.numero} para cliente ${task.clientId}`);

  const client = await db.query.clients.findFirst({
    where: (c: any) => eq(c.id, task.clientId),
  });

  if (!client) {
    console.error(`❌ Cliente não encontrado: ${task.clientId}`);
    return;
  }

  await storage.createNotification({
    tipo: "follow_up",
    titulo: `📞 Follow-up #${taskData.numero} - ${client.nome}`,
    descricao: `Cliente sem resposta há ${taskData.dias || 1} dias. Resgate agora!`,
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

  console.log(`✅ Follow-up #${taskData.numero} executado`);
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
  try {
    console.log(`\n🧪 [TEST] Simulando resposta do cliente ${clientId}...\nMensagem: "${messageText}"`);

    // 1. Buscar ou criar conversa
    let conv = await db.query.conversations.findFirst({
      where: (c: any) => eq(c.clientId, clientId),
    });

    if (!conv) {
      const [newConv] = await db
        .insert(conversations)
        .values({
          clientId,
          userId,
          ultimaMensagem: new Date(),
        })
        .returning();
      conv = newConv;
    }

    // 2. Criar mensagem
    const msg = await db.insert(messages).values({
      conversationId: conv.id,
      sender: "client",
      tipo: "texto",
      conteudo: messageText,
    }).returning().then(r => r[0]);

    // 3. Analisar com IA
    const client = await db.query.clients.findFirst({
      where: (c: any) => eq(c.id, clientId),
    });
    const analysis = await analyzeClientMessage(messageText, {
      nome: client?.nome,
      razaoSocial: client?.nomeFantasia,
    });

    console.log(`📊 IA retornou: ${analysis.sentimento} → ${analysis.etapa}`);

    // 4. Mover Kanban se houver oportunidade
    const opp = await db.query.opportunities.findFirst({
      where: (o: any) => eq(o.clientId, clientId),
    });

    if (opp && analysis.etapa !== "automatico") {
      await db.update(opportunities).set({ etapa: analysis.etapa }).where(eq(opportunities.id, opp.id));
      console.log(`📈 Oportunidade movida para: ${analysis.etapa}`);
    }

    // 5. Criar 3 follow-ups automáticos
    const now = new Date();
    await db.insert(automationTasks).values({
      userId,
      clientId,
      tipo: "follow_up",
      status: "pendente",
      proximaExecucao: new Date(now.getTime() - 10 * 1000),
      dados: { numero: 1, conversationId: conv.id, dias: 1 },
    });

    await db.insert(automationTasks).values({
      userId,
      clientId,
      tipo: "follow_up",
      status: "pendente",
      proximaExecucao: new Date(now.getTime() - 5 * 1000),
      dados: { numero: 2, conversationId: conv.id, dias: 3 },
    });

    await db.insert(automationTasks).values({
      userId,
      clientId,
      tipo: "follow_up",
      status: "pendente",
      proximaExecucao: new Date(now.getTime()),
      dados: { numero: 3, conversationId: conv.id, dias: 7 },
    });

    console.log(`✅ Teste concluído: Mensagem criada + Kanban movido + 3 follow-ups agendados`);
    
    return { 
      success: true, 
      clientId, 
      message: `IA respondeu: ${analysis.sentimento} → ${analysis.etapa}. Kanban movido + 3 follow-ups criados!`,
      analysis,
    };
  } catch (error) {
    console.error(`❌ Erro:`, error);
    throw error;
  }
}
