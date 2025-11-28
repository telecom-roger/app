import * as storage from "./storage";
import { db } from "./db";
import { eq, and, lt, isNull, gte } from "drizzle-orm";
import { automationTasks, followUps, clientScores, opportunities, clients as clientsTable, messages } from "@shared/schema";
import { analyzeClientMessage } from "./aiService";

// ======================== CRON JOB: Executar tarefas pendentes ========================
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
      .limit(50); // Processar até 50 por vez

    console.log(`📋 Encontradas ${pendingTasks.length} tarefas`);

    for (const task of pendingTasks) {
      try {
        await executeAutomationTask(task);
      } catch (error) {
        console.error(`❌ Erro ao executar tarefa ${task.id}:`, error);
        await db
          .update(automationTasks)
          .set({
            status: "erro",
            erro: String(error),
            ultimaTentativa: new Date(),
            tentativas: (task.tentativas || 0) + 1,
          })
          .where(eq(automationTasks.id, task.id));
      }
    }
  } catch (error) {
    console.error(`❌ Erro geral na automação:`, error);
  }
}

async function executeAutomationTask(task: any) {
  const taskData = task.dados || {};
  
  switch (task.tipo) {
    case "follow_up":
      await executeFollowUp(task);
      break;
    case "re_engagement":
      await executeReEngagement(task);
      break;
    case "score_update":
      await updateClientScore(task.clientId, task.userId);
      break;
    case "auto_send":
      await executeAutoSend(task);
      break;
    case "kanban_move":
      await executeKanbanMove(task);
      break;
    case "contract_reminder":
      await executeContractReminder(task);
      break;
  }

  // Marcar como executado
  await db
    .update(automationTasks)
    .set({
      status: "executado",
      ultimaTentativa: new Date(),
      tentativas: (task.tentativas || 0) + 1,
    })
    .where(eq(automationTasks.id, task.id));
}

// ======================== FOLLOW UP AUTOMÁTICO ========================
async function executeFollowUp(task: any) {
  const taskData = task.dados || {};
  
  console.log(`📞 Follow-up #${taskData.numero} para cliente ${task.clientId}`);

  const client = await db.query.clients.findFirst({
    where: (c: any) => eq(c.id, task.clientId),
  });

  if (!client) return;

  // Buscar última interação
  const lastMessage = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, taskData.conversationId || ""),
        eq(messages.sender, "client")
      )
    )
    .orderBy((m: any) => m.createdAt)
    .limit(1);

  const diasSinceContact = lastMessage?.[0] 
    ? Math.floor((Date.now() - lastMessage[0].createdAt.getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  // Criar notificação de follow-up
  await storage.createNotification({
    tipo: "follow_up",
    titulo: `📞 Follow-up #${taskData.numero} - ${client.nome}`,
    descricao: `Cliente sem resposta há ${diasSinceContact} dias. Resgate agora!`,
    clientId: task.clientId,
    userId: task.userId,
  });

  // Registrar follow-up
  await db.insert(followUps).values({
    userId: task.userId,
    clientId: task.clientId,
    numero: taskData.numero || 1,
    diasSinceLastContact: diasSinceContact,
    executadoEm: new Date(),
    descricao: `Follow-up automático executado`,
  });
}

// ======================== RE-ENGAGEMENT ========================
async function executeReEngagement(task: any) {
  const taskData = task.dados || {};
  
  console.log(`♻️ Re-engagement para cliente ${task.clientId}`);

  const client = await db.query.clients.findFirst({
    where: (c: any) => eq(c.id, task.clientId),
  });

  if (!client) return;

  // Notificar vendedor para re-engajar
  await storage.createNotification({
    tipo: "re_engagement",
    titulo: `♻️ Re-engagement - ${client.nome}`,
    descricao: `Cliente inativo há mais de 30 dias. Considere enviar uma mensagem personalizada!`,
    clientId: task.clientId,
    userId: task.userId,
  });
}

// ======================== AUTO SEND (WhatsApp/Email) ========================
async function executeAutoSend(task: any) {
  const taskData = task.dados || {};
  
  console.log(`💬 Auto-send para cliente ${task.clientId}`);
  
  // Aqui você integraria com seu serviço de envio
  // Por enquanto, apenas registra a tentativa
  await storage.createNotification({
    tipo: "auto_send",
    titulo: `💬 Mensagem automática enviada`,
    descricao: `Mensagem: "${taskData.mensagem || "---}"}"`,
    clientId: task.clientId,
    userId: task.userId,
  });
}

// ======================== SCORING AUTOMÁTICO ========================
export async function updateClientScore(clientId: string, userId: string) {
  try {
    console.log(`⭐ Atualizando score para cliente ${clientId}`);

    const client = await db.query.clients.findFirst({
      where: (c: any) => eq(c.id, clientId),
    });

    if (!client) return;

    // Buscar histórico de mensagens para engagement
    const messageCount = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, clientId));

    // Buscar oportunidades
    const opps = await db
      .select()
      .from(opportunities)
      .where(eq(opportunities.clientId, clientId));

    // Calcular scores
    const scoreEngajamento = Math.min(messageCount.length * 10, 100); // 0-100
    const scoreContato = opps.length > 0 ? 50 : 0; // Tem oportunidade?
    const scorePotencial = client.valor_contrato ? 60 : 20; // Tem valor?
    
    // Score IA: baseado em última ação
    let scoreIA = 40; // Default neutral
    if (opps.length > 0) {
      const lastOpp = opps[opps.length - 1];
      if (lastOpp.etapa === "proposta") scoreIA = 80;
      if (lastOpp.etapa === "fechado") scoreIA = 100;
      if (lastOpp.etapa === "perdido") scoreIA = 10;
    }

    const scoreTotal = Math.round((scoreIA + scoreContato + scoreEngajamento + scorePotencial) / 4);

    // Upsert score
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
          scoreIA,
          scoreContato,
          scoreEngajamento,
          scorePotencial,
          scoreTotal,
          ultimaAtualizacao: new Date(),
        })
        .where(eq(clientScores.id, existing[0].id));
    } else {
      await db.insert(clientScores).values({
        userId,
        clientId,
        scoreIA,
        scoreContato,
        scoreEngajamento,
        scorePotencial,
        scoreTotal,
        proximaAtualizacao: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    }

    console.log(`⭐ Score atualizado: ${scoreTotal}/100`);
  } catch (error) {
    console.error(`❌ Erro ao atualizar score:`, error);
  }
}

// ======================== KANBAN MOVE AUTOMÁTICO ========================
async function executeKanbanMove(task: any) {
  try {
    const taskData = task.dados || {};
    const { oppId, toStage } = taskData;

    console.log(`📊 Movendo oportunidade ${oppId} para: ${toStage}`);

    if (!oppId || !toStage) {
      console.error(`❌ Dados inválidos para kanban move:`, taskData);
      return;
    }

    await db
      .update(opportunities)
      .set({ etapa: toStage })
      .where(eq(opportunities.id, oppId));

    console.log(`✅ Oportunidade movida para ${toStage}!`);
  } catch (error) {
    console.error(`❌ Erro ao mover Kanban:`, error);
    throw error;
  }
}

// ======================== CRIAR FOLLOW-UP AUTOMÁTICO APÓS RESPOSTA ========================
export async function createFollowUpAfterResponse(clientId: string, userId: string, conversationId: string) {
  try {
    // Follow-up 1: 1 dia
    await db.insert(automationTasks).values({
      userId,
      clientId,
      tipo: "follow_up",
      proximaExecucao: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      dados: { numero: 1, conversationId, dias: 1 },
    });

    // Follow-up 2: 3 dias
    await db.insert(automationTasks).values({
      userId,
      clientId,
      tipo: "follow_up",
      proximaExecucao: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      dados: { numero: 2, conversationId, dias: 3 },
    });

    // Follow-up 3: 7 dias
    await db.insert(automationTasks).values({
      userId,
      clientId,
      tipo: "follow_up",
      proximaExecucao: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      dados: { numero: 3, conversationId, dias: 7 },
    });

    // Score update: 12 horas
    await db.insert(automationTasks).values({
      userId,
      clientId,
      tipo: "score_update",
      proximaExecucao: new Date(Date.now() + 12 * 60 * 60 * 1000),
      dados: { reason: "update_after_response" },
    });

    console.log(`✨ Follow-ups automáticos agendados para ${clientId}`);
  } catch (error) {
    console.error(`❌ Erro ao criar follow-ups:`, error);
  }
}

// ======================== CONTRACT REMINDER - Cobrar assinatura após 24h ========================
async function executeContractReminder(task: any) {
  console.log(`📋 Contract reminder para ${task.clientId}`);
  
  const opportunity = await db.query.opportunities.findFirst({
    where: (o: any) => eq(o.id, task.dados?.opportunityId || ""),
  });
  
  if (!opportunity) return;
  
  const client = await db.query.clients.findFirst({
    where: (c: any) => eq(c.id, opportunity.clientId),
  });
  
  if (!client) return;
  
  console.log(`💬 Enviando lembrete de assinatura para ${client.nome}`);
  
  // Log da ação (pode ser integrado com WhatsApp depois)
  await db.insert(messages).values({
    conversationId: `reminder-${opportunity.id}`,
    sender: "bot",
    tipo: "text",
    conteudo: `Olá ${client.nome}, confirmamos recebimento da proposta. Aguardamos assinatura do contrato. Pode fazer isso em: [LINK_CONTRATO]. Qualquer dúvida, estou à disposição!`,
    createdAt: new Date(),
  });
}

// ======================== VERIFICAR PROPOSTAS ENVIADAS (Job agendado) ========================
async function checkPropostaEnviadaTimeouts() {
  try {
    console.log(`\n⏰ [CONTRACT CHECK] Verificando propostas enviadas há 24h...`);
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Buscar oportunidades em PROPOSTA ENVIADA há mais de 24h
    const proposatasComTimeout = await db
      .select()
      .from(opportunities)
      .where(
        and(
          eq(opportunities.etapa, "PROPOSTA ENVIADA"),
          lt(opportunities.updatedAt, oneDayAgo)
        )
      );
    
    console.log(`📋 Encontradas ${proposatasComTimeout.length} propostas com timeout`);
    
    for (const opp of proposatasComTimeout) {
      // Verificar se já foi enviado um reminder
      const existingReminder = await db
        .select()
        .from(automationTasks)
        .where(
          and(
            eq(automationTasks.tipo, "contract_reminder"),
            eq(automationTasks.dados, JSON.stringify({ opportunityId: opp.id }))
          )
        )
        .limit(1);
      
      if (!existingReminder || existingReminder.length === 0) {
        // Criar novo task de reminder
        await db.insert(automationTasks).values({
          userId: opp.responsavelId,
          clientId: opp.clientId,
          tipo: "contract_reminder",
          proximaExecucao: new Date(),
          dados: { opportunityId: opp.id },
        });
        console.log(`✅ Reminder agendado para oportunidade ${opp.id}`);
      }
    }
  } catch (error) {
    console.error(`❌ Erro ao verificar propostas enviadas:`, error);
  }
}

// ======================== SCHEDULER DE CRON (executar a cada 30 segundos) ========================
export function startAutomationCron() {
  console.log(`\n⏰ [AUTOMATION CRON] Iniciando scheduler...`);
  
  // Executar a cada 30 segundos (para testes rápidos)
  const interval = setInterval(() => {
    processAutomationTasks().catch(console.error);
    checkPropostaEnviadaTimeouts().catch(console.error);
  }, 30 * 1000);

  // Executar também na inicialização
  processAutomationTasks().catch(console.error);
  checkPropostaEnviadaTimeouts().catch(console.error);

  return () => clearInterval(interval);
}
