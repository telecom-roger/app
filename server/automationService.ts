import * as storage from "./storage";
import { db } from "./db";
import { eq, and, lt, isNull, gte, desc, sql } from "drizzle-orm";
import { automationTasks, followUps, clientScores, opportunities, clients as clientsTable, messages, interactions, conversations, whatsappSessions } from "@shared/schema";
import { analyzeClientMessage } from "./aiService";
import * as whatsappService from "./whatsappService";
import { wsClients } from "./routes";

// ======================== HELPER: Verificar se é dia de semana ========================
function isWeekday(): boolean {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = domingo, 1-5 = seg-sex, 6 = sábado
  return dayOfWeek >= 1 && dayOfWeek <= 5;
}

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
    case "contrato_enviado_message":
      await executeContratoEnviadoMessage(task);
      break;
    case "aguardando_aceite_reminder":
      await executeAguardandoAceiteReminder(task);
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

// ======================== CONTRACT REMINDER - Cobrança em horários comerciais 08:00, 16:30 ========================
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
  
  const daysSinceCreation = task.dados?.daysSinceCreation || 0;
  
  console.log(`💬 Enviando cobrança de contrato - Dia ${daysSinceCreation} para ${client.nome}`);
  
  // Buscar ou criar conversation do cliente
  let conversation = await db.query.conversations.findFirst({
    where: (conv: any) => eq(conv.clientId, opportunity.clientId),
  });

  if (!conversation) {
    const [newConv] = await db.insert(conversations).values({
      clientId: opportunity.clientId,
      userId: task.userId,
      ultimaMensagemEm: new Date(),
    }).returning();
    conversation = newConv;
  }
  
  // 🔥 LER MENSAGENS DO BANCO (automation_configs)
  const config = await db.query.automationConfigs.findFirst({
    where: (ac: any) => eq(ac.jobType, "contract_reminder"),
  });
  
  console.log(`📊 [DEBUG] Config completo:`, JSON.stringify(config, null, 2));
  console.log(`📊 [DEBUG] mensagensTemplates:`, config?.mensagensTemplates);
  console.log(`📊 [DEBUG] Keys:`, Object.keys(config?.mensagensTemplates || {}));
  
  let messages_templates = config?.mensagensTemplates || {};
  
  // Fallback para mensagens padrão se não houver no banco
  if (Object.keys(messages_templates).length === 0) {
    console.warn(`⚠️ [FALLBACK ACIONADO] Usando mensagens hardcoded para contract_reminder`);
    messages_templates = {
      0: [
        `Olá, tudo bem? Podemos seguir com a contratação? Qualquer dúvida é só me chamar.`,
        `Oi! Tudo certo? Conseguimos avançar com o plano? Estou por aqui caso precise de algo.`,
        `Olá, tudo bem? Podemos finalizar sua contratação agora? Ficou com alguma dúvida?`,
        `Oi! Só confirmando: deseja seguir com o plano que conversamos? Se quiser ajustar algo, me avise!`,
        `Olá! Tudo bem por aí? Posso dar andamento na contratação para você? Qualquer dúvida me avisa.`,
        `Olá, tudo bem? Qualquer dúvida sobre o plano ou condições, estou à disposição. Podemos avançar?`,
        `Olá, tudo bem? Só passando pra saber se deseja continuar com a contratação. Qualquer dúvida me avisa.`,
      ],
    };
  }
  
  // Pegar array de mensagens do dia e randomizar
  const dayKey = Math.min(daysSinceCreation, 3).toString();
  const dayMessages = (messages_templates as any)[dayKey] || (messages_templates as any)["0"] || [];
  
  if (dayMessages.length === 0) {
    console.warn(`⚠️ Nenhuma mensagem disponível para o dia ${daysSinceCreation}`);
    return;
  }
  
  const randomIndex = Math.floor(Math.random() * dayMessages.length);
  const mensagem = dayMessages[randomIndex];
  
  // 1️⃣ REGISTRAR MENSAGEM NO CHAT PRIMEIRO (com whatsappMessageId vazio por enquanto)
  const [insertedMessage] = await db.insert(messages).values({
    conversationId: conversation.id,
    sender: "user",
    tipo: "texto",
    conteudo: mensagem,
    origem: "automation",
    statusEntrega: "pendente",
    createdAt: new Date(),
  }).returning();

  // ✅ ATUALIZAR ultimaMensagemEm para a conversa ir para o topo da fila
  await db.update(conversations).set({
    ultimaMensagemEm: new Date(),
  }).where(eq(conversations.id, conversation.id));

  // 2️⃣ REGISTRAR NA TIMELINE DO CLIENTE (como histórico)
  await db.insert(interactions).values({
    clientId: opportunity.clientId,
    tipo: "contract_reminder",
    origem: "automation",
    titulo: `Cobrança de Contrato Enviada (Dia ${daysSinceCreation})`,
    texto: mensagem,
    meta: { opportunityId: opportunity.id, daysSinceCreation },
    createdBy: task.userId,
  });
  
  // 3️⃣ ENVIAR VIA WHATSAPP AUTOMATICAMENTE (IGUAL AO ENDPOINT POST)
  try {
    // Pega a sessão do usuário (importante: por userId!)
    const [session] = await db
      .select()
      .from(whatsappSessions)
      .where(and(eq(whatsappSessions.userId, task.userId), eq(whatsappSessions.status, "conectada")))
      .limit(1);

    if (session) {
      // Usa client.celular (não telefone_2!)
      if (client && client.celular) {
        const isAlive = whatsappService.isSessionAlive(session.sessionId);
        if (isAlive) {
          // Formata o telefone para WhatsApp
          let telefone = client.celular.replace(/\D/g, "");
          if (!telefone.startsWith("55")) {
            telefone = "55" + telefone;
          }
          
          console.log(`📱 Enviando mensagem via WhatsApp para ${telefone}...`);
          const result = await whatsappService.sendMessage(session.sessionId, telefone, mensagem);
          if (result.success && result.messageId) {
            console.log(`✅ Mensagem WhatsApp enviada com sucesso para ${client.nome} (ID: ${result.messageId})`);
            // ✅ ATUALIZAR whatsappMessageId e status para tracking de ticks
            await db.update(messages)
              .set({ 
                whatsappMessageId: result.messageId,
                statusEntrega: "enviado"
              })
              .where(eq(messages.id, insertedMessage.id));
          } else {
            console.warn(`⚠️ Falha ao enviar WhatsApp para ${client.nome}`);
            await db.update(messages)
              .set({ statusEntrega: "erro" })
              .where(eq(messages.id, insertedMessage.id));
          }
        }
      } else {
        console.warn(`⚠️ Cliente sem celular. Mensagem só no chat.`);
      }
    } else {
      console.warn(`⚠️ Nenhuma sessão WhatsApp conectada. Mensagem só no chat.`);
    }
  } catch (error) {
    console.error(`❌ Erro ao enviar WhatsApp:`, error);
    await db.update(messages)
      .set({ statusEntrega: "erro" })
      .where(eq(messages.id, insertedMessage.id));
  }
  
  // 🚀 BROADCAST VIA WEBSOCKET
  wsClients.forEach((client) => {
    try {
      client.send(JSON.stringify({
        type: "new_message",
        conversationId: conversation.id,
        message: {
          id: insertedMessage.id,
          conversationId: conversation.id,
          sender: "user",
          tipo: "texto",
          conteudo: mensagem,
          origem: "automation",
          statusEntrega: "enviado",
          createdAt: new Date(),
        },
        timestamp: new Date(),
      }));
    } catch (err) {
      console.error("❌ Erro ao broadcast WebSocket:", err);
    }
  });
  
  console.log(`✅ Mensagem enviada no chat e registrada na timeline de ${client.nome}`);
}

// ======================== CONTRATO ENVIADO - Envio automático quando opportunity muda para essa etapa ========================
async function executeContratoEnviadoMessage(task: any) {
  console.log(`📄 Contrato Enviado para ${task.clientId}`);
  
  const opportunity = await db.query.opportunities.findFirst({
    where: (o: any) => eq(o.id, task.dados?.opportunityId || ""),
  });
  
  if (!opportunity) return;
  
  const client = await db.query.clients.findFirst({
    where: (c: any) => eq(c.id, opportunity.clientId),
  });
  
  if (!client) return;
  
  // Buscar ou criar conversation do cliente
  let conversation = await db.query.conversations.findFirst({
    where: (conv: any) => eq(conv.clientId, opportunity.clientId),
  });
  
  if (!conversation) {
    const [newConv] = await db.insert(conversations).values({
      clientId: opportunity.clientId,
      userId: task.userId,
      ultimaMensagemEm: new Date(),
    }).returning();
    conversation = newConv;
  }
  
  // 🔥 LER MENSAGENS DO BANCO (automation_configs)
  const config = await db.query.automationConfigs.findFirst({
    where: (ac: any) => eq(ac.jobType, "contrato_enviado_message"),
  });
  
  let messages_templates = (config?.mensagensTemplates as any)?.["0"] || [];
  
  // Fallback para mensagens padrão se não houver no banco
  if (messages_templates.length === 0) {
    messages_templates = [
      `Oi!\nSeu contrato já chegou no seu e-mail.\nÉ só abrir o link, colocar a data de nascimento do gestor e seguir as etapas.\n\nVocê vai receber um e-mail com o TOKEN de confirmação.\nInforme o código e pronto — assinatura concluída.\n\nQualquer dúvida estou por aqui!`,
      `Olá!\nO contrato foi enviado para o seu e-mail.\nÉ só clicar no link, inserir a data de nascimento do gestor e avançar.\n\nDepois disso, você vai receber um e-mail com o TOKEN.\nBasta inserir no campo solicitado e finalizar a assinatura.\n\nQualquer dúvida, estou à disposição.`,
    ];
  }
  
  if (messages_templates.length === 0) {
    console.warn(`⚠️ Nenhuma mensagem disponível para Contrato Enviado`);
    return;
  }
  
  // Pegar mensagem randomizada
  const randomIndex = Math.floor(Math.random() * messages_templates.length);
  const mensagem = messages_templates[randomIndex];
  
  // 1️⃣ REGISTRAR MENSAGEM NO CHAT PRIMEIRO (com tracking de status)
  const [insertedMessage] = await db.insert(messages).values({
    conversationId: conversation.id,
    sender: "user",
    tipo: "texto",
    conteudo: mensagem,
    origem: "automation",
    statusEntrega: "pendente",
    createdAt: new Date(),
  }).returning();

  // ✅ ATUALIZAR ultimaMensagemEm para a conversa ir para o topo da fila
  await db.update(conversations).set({
    ultimaMensagemEm: new Date(),
  }).where(eq(conversations.id, conversation.id));

  // 2️⃣ REGISTRAR NA TIMELINE DO CLIENTE (como histórico)
  await db.insert(interactions).values({
    clientId: opportunity.clientId,
    tipo: "contrato_enviado",
    origem: "automation",
    titulo: `Contrato Enviado ao Cliente`,
    texto: mensagem,
    meta: { opportunityId: opportunity.id },
    createdBy: task.userId,
  });
  
  // 3️⃣ ENVIAR VIA WHATSAPP AUTOMATICAMENTE (IGUAL AO ENDPOINT POST)
  let whatsappEnviado = false;
  try {
    // Pega a sessão do usuário (importante: por userId!)
    const [session] = await db
      .select()
      .from(whatsappSessions)
      .where(and(eq(whatsappSessions.userId, task.userId), eq(whatsappSessions.status, "conectada")))
      .limit(1);

    if (session) {
      // Usa client.celular (não telefone_2!)
      if (client && client.celular) {
        const isAlive = whatsappService.isSessionAlive(session.sessionId);
        if (isAlive) {
          // Formata o telefone para WhatsApp (normalização completa)
          let telefone = client.celular.replace(/\D/g, "").trim();
          // Remove 55 duplicado se existir
          if (telefone.startsWith("5555")) {
            telefone = telefone.substring(2);
          }
          // Adiciona 55 se não tiver
          if (!telefone.startsWith("55")) {
            telefone = "55" + telefone;
          }
          
          try {
            console.log(`📱 Enviando contrato via WhatsApp para ${telefone}...`);
            const result = await whatsappService.sendMessage(session.sessionId, telefone, mensagem);
            if (result.success && result.messageId) {
              console.log(`✅ Contrato enviado via WhatsApp com sucesso para ${client.nome} (ID: ${result.messageId})`);
              whatsappEnviado = true;
              // ✅ ATUALIZAR whatsappMessageId e status para tracking de ticks
              await db.update(messages)
                .set({ 
                  whatsappMessageId: result.messageId,
                  statusEntrega: "enviado"
                })
                .where(eq(messages.id, insertedMessage.id));
            } else {
              console.warn(`⚠️ Falha ao enviar contrato via WhatsApp para ${client.nome}`);
              await db.update(messages)
                .set({ statusEntrega: "erro" })
                .where(eq(messages.id, insertedMessage.id));
            }
          } catch (error) {
            console.error(`❌ Erro ao enviar mensagem via WhatsApp:`, error);
            await db.update(messages)
              .set({ statusEntrega: "erro" })
              .where(eq(messages.id, insertedMessage.id));
          }
        } else {
          console.warn(`⚠️ Sessão WhatsApp não está viva (isAlive=false). Mensagem só no chat.`);
        }
      } else {
        console.warn(`⚠️ Cliente sem celular. Mensagem só no chat.`);
      }
    } else {
      console.warn(`⚠️ Nenhuma sessão WhatsApp conectada. Mensagem só no chat.`);
    }
  } catch (error) {
    console.error(`❌ Erro ao enviar WhatsApp:`, error);
    await db.update(messages)
      .set({ statusEntrega: "erro" })
      .where(eq(messages.id, insertedMessage.id));
  }
  
  // 🚀 BROADCAST VIA WEBSOCKET
  wsClients.forEach((wsClient) => {
    try {
      wsClient.send(JSON.stringify({
        type: "new_message",
        conversationId: conversation.id,
        message: {
          id: insertedMessage.id,
          conversationId: conversation.id,
          sender: "user",
          tipo: "texto",
          conteudo: mensagem,
          origem: "automation",
          statusEntrega: "enviado",
          createdAt: new Date(),
        },
        timestamp: new Date(),
      }));
    } catch (err) {
      console.error("❌ Erro ao broadcast WebSocket:", err);
    }
  });
  
  if (whatsappEnviado) {
    console.log(`✅ Mensagem de contrato enviada no chat E WhatsApp para ${client.nome}`);
  } else {
    console.log(`✅ Mensagem de contrato salva apenas no chat para ${client.nome} (WhatsApp offline)`);
  }
}

// ======================== VERIFICAR PROPOSTAS ENVIADAS - Lógica de 2h timeout + 3 dias + horários comerciais ========================
export async function checkPropostaEnviadaTimeouts() {
  try {
    // ⏸️ Não executa em fins de semana
    if (!isWeekday()) {
      console.log(`⏸️ [CONTRACT CHECK] Pausado no fim de semana (${new Date().toLocaleDateString("pt-BR", { weekday: "long" })})`);
      return;
    }
    
    console.log(`\n⏰ [CONTRACT CHECK] Verificando propostas enviadas com timeout de 2h...`);
    
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    
    // Buscar oportunidades em PROPOSTA ENVIADA
    const propostas = await db
      .select()
      .from(opportunities)
      .where(eq(opportunities.etapa, "PROPOSTA ENVIADA"));
    
    console.log(`📋 Encontradas ${propostas.length} propostas em PROPOSTA ENVIADA`);
    
    for (const opp of propostas) {
      const lastUpdate = opp.updatedAt || new Date();
      const daysSinceEnvio = Math.floor((Date.now() - lastUpdate.getTime()) / (24 * 60 * 60 * 1000));
      
      // Se passou 4 dias, move para PERDIDO
      if (daysSinceEnvio >= 4) {
        console.log(`❌ Movendo ${opp.id} para PERDIDO após 4 dias sem resposta`);
        await db
          .update(opportunities)
          .set({
            etapa: "PERDIDO",
            updatedAt: new Date(),
            notas: sql`jsonb_insert(coalesce(notas, '[]'::jsonb), '{0}', jsonb_build_object('type', 'timeline', 'data', jsonb_build_object('titulo', 'Movido para Perdido', 'msg', 'Cliente tinha interesse em renovar mas não finalizou', 'timestamp', now())))`,
          })
          .where(eq(opportunities.id, opp.id));

        // 📝 REGISTRAR MUDANÇA NA TIMELINE (Sistema)
        await storage.recordEtapaChange(
          opp.id,
          opp.clientId,
          "PROPOSTA ENVIADA",
          "PERDIDO",
          "sistema",
          opp.responsavelId
        );

        // Buscar ou criar conversation
        let conversation = await db.query.conversations.findFirst({
          where: (conv: any) => eq(conv.clientId, opp.clientId),
        });

        if (!conversation) {
          const [newConv] = await db.insert(conversations).values({
            clientId: opp.clientId,
            userId: opp.responsavelId || "",
            ultimaMensagemEm: new Date(),
          }).returning();
          conversation = newConv;
        }

        // Mensagem de finalização
        const mensagem = `Sua proposta expirou após 3 dias sem retorno. Caso deseje retomar as negociações, é só me chamar!`;

        // REGISTRAR MENSAGEM NO CHAT
        await db.insert(messages).values({
          conversationId: conversation.id,
          sender: "user",
          tipo: "texto",
          conteudo: mensagem,
          origem: "automation",
          createdAt: new Date(),
        });
        
        console.log(`✅ Timeline registrada e mensagem enviada para PERDIDO`);
        continue;
      }
      
      // Se passou 2h, criar task de reminder
      if (lastUpdate < twoHoursAgo) {
        // Verificar horário comercial (08:00-18:00 SP)
        const now = new Date();
        const spTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        const currentHour = spTime.getHours();
        
        // Horários permitidos: 08:00, 16:30
        const isValidTime = (currentHour === 8 || currentHour === 16);
        
        if (isValidTime || daysSinceEnvio > 0) { // Em dias seguintes, enviar sempre
          // Verificar se já foi enviado task nesta hora/dia
          const lastTask = await db
            .select()
            .from(automationTasks)
            .where(
              and(
                eq(automationTasks.tipo, "contract_reminder"),
                eq(automationTasks.clientId, opp.clientId)
              )
            )
            .orderBy((t: any) => desc(t.proximaExecucao))
            .limit(1);
          
          if (!lastTask || lastTask.length === 0 || lastTask[0].status === "executado") {
            // Criar novo task
            await db.insert(automationTasks).values({
              userId: opp.responsavelId,
              clientId: opp.clientId,
              tipo: "contract_reminder",
              proximaExecucao: new Date(),
              dados: { opportunityId: opp.id, daysSinceCreation: daysSinceEnvio },
            });
            console.log(`✅ Reminder agendado para oportunidade ${opp.id} (dia ${daysSinceEnvio})`);
          }
        }
      }
    }
  } catch (error) {
    console.error(`❌ Erro ao verificar propostas enviadas:`, error);
  }
}

// ======================== HELPER: Calcular próximo horário para AGUARDANDO ACEITE (PRODUÇÃO) ========================
function getNextAguardandoAceiteTime(lastTaskData: any): Date {
  const now = new Date();
  const spTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const lembreteNum = lastTaskData?.lembrete || 1;
  
  if (lembreteNum === 1) {
    // 1º lembrete: HOJE às 16:30 SP, se não passou, ou amanhã às 08:00
    const today = new Date(spTime);
    today.setHours(16, 30, 0, 0);
    if (today > spTime) return today;
    
    const tomorrow = new Date(spTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    return tomorrow;
  } else if (lembreteNum === 2) {
    // 2º lembrete: Amanhã às 08:00 (weekday)
    const nextDay = new Date(spTime);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(8, 0, 0, 0);
    
    // Se cair no fim de semana, pular para próximo dia útil
    while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    return nextDay;
  } else if (lembreteNum === 3) {
    // 3º lembrete: Dia seguinte às 08:00 (weekday)
    const nextDay = new Date(spTime);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(8, 0, 0, 0);
    
    // Se cair no fim de semana, pular para próximo dia útil
    while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    return nextDay;
  }
  
  return new Date(Date.now() + 24 * 60 * 60 * 1000); // Fallback: próximo dia
}

// ======================== AGUARDANDO ACEITE - Lembretes de Assinatura de Contrato ========================
async function executeAguardandoAceiteReminder(task: any) {
  console.log(`📝 Aguardando Aceite reminder para ${task.clientId}`);
  
  const opportunity = await db.query.opportunities.findFirst({
    where: (o: any) => eq(o.id, task.dados?.opportunityId || ""),
  });
  
  if (!opportunity) return;
  
  const client = await db.query.clients.findFirst({
    where: (c: any) => eq(c.id, opportunity.clientId),
  });
  
  if (!client) return;
  
  const lembreteNum = task.dados?.lembrete || 1;
  
  // ⏰ ANTI-SPAM: Verificar se já enviou ESTE lembrete nas últimas 3 horas
  const tresHorasAtras = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const lembreteRecente = await db
    .select()
    .from(interactions)
    .where(
      and(
        eq(interactions.clientId, opportunity.clientId),
        eq(interactions.tipo, "aguardando_aceite_reminder"),
        gte(interactions.createdAt, tresHorasAtras)
      )
    )
    .orderBy(desc(interactions.createdAt))
    .limit(1);
  
  if (lembreteRecente.length > 0) {
    const ultimoLembrete = (lembreteRecente[0].meta as any)?.lembreteNum || 1;
    if (ultimoLembrete >= lembreteNum) {
      console.log(`⏳ [ANTI-SPAM] Lembrete ${lembreteNum} já enviado recentemente para ${client.nome}. Pulando...`);
      return;
    }
  }
  
  console.log(`💬 Enviando lembrete ${lembreteNum}/3 de Aguardando Aceite para ${client.nome}`);
  
  // 🔥 LER MENSAGENS DO BANCO (automation_configs)
  const config = await db.query.automationConfigs.findFirst({
    where: (ac: any) => eq(ac.jobType, "aguardando_aceite_reminder"),
  });
  
  let messages_templates = config?.mensagensTemplates || {};
  
  // Fallback para mensagens padrão se não houver no banco
  if (Object.keys(messages_templates).length === 0) {
    messages_templates = {
      1: [`Olá, tudo bem?\nSeu contrato já está pronto para assinatura digital.\nPor favor, clique no link que você recebeu e finalize o aceite.\nSe tiver alguma dúvida, estou à disposição!`],
      2: [`Oi, tudo bem?\nSó passando para lembrar que seu contrato ainda está aguardando assinatura.\nAssine o quanto antes para garantir os benefícios.\nQualquer dúvida, me avise!`],
      3: [`Oi, tudo bem?\nEste é o último lembrete para assinatura do contrato.\nPara não gerar atrasos, finalize o aceite o quanto antes clicando no link enviado no email.\nSe precisar de ajuda, estou à disposição!`],
    };
  }
  
  const dayMessages = (messages_templates as any)[lembreteNum] || (messages_templates as any)[1] || [];
  
  if (!Array.isArray(dayMessages) || dayMessages.length === 0) {
    console.warn(`⚠️ Nenhuma mensagem disponível para lembrete ${lembreteNum}`);
    return;
  }
  
  // Se tem múltiplas mensagens para o dia, randomiza
  const randomIndex = Math.floor(Math.random() * dayMessages.length);
  const mensagem = dayMessages[randomIndex];
  
  // Buscar ou criar conversation do cliente
  let conversation = await db.query.conversations.findFirst({
    where: (conv: any) => eq(conv.clientId, opportunity.clientId),
  });
  
  if (!conversation) {
    const [newConv] = await db.insert(conversations).values({
      clientId: opportunity.clientId,
      userId: task.userId,
      ultimaMensagemEm: new Date(),
    }).returning();
    conversation = newConv;
  }
  
  // Registrar mensagem no banco (salvando como "user" para aparecer no chat como mensagem enviada)
  const [insertedMessage] = await db.insert(messages).values({
    conversationId: conversation.id,
    sender: "user",
    tipo: "texto",
    origem: "automation",
    conteudo: mensagem,
    statusEntrega: "pendente",
    createdAt: new Date(),
  }).returning();

  // ✅ ATUALIZAR ultimaMensagemEm para a conversa ir para o topo da fila
  await db.update(conversations).set({
    ultimaMensagemEm: new Date(),
  }).where(eq(conversations.id, conversation.id));

  // 📋 REGISTRAR NA TIMELINE DO CLIENTE
  const titulos = {
    1: "1º Lembrete de Assinatura",
    2: "2º Lembrete de Assinatura",
    3: "3º Lembrete de Assinatura (Última Chance)",
  };
  
  await db.insert(interactions).values({
    clientId: opportunity.clientId,
    tipo: "aguardando_aceite_reminder",
    origem: "automation",
    titulo: titulos[lembreteNum as 1 | 2 | 3] || "Lembrete de Assinatura",
    texto: mensagem,
    meta: { opportunityId: opportunity.id, lembreteNum },
    createdBy: task.userId,
  });
  
  // 📱 ENVIAR VIA WHATSAPP - IGUAL AO CONTRATO ENVIADO (QUE FUNCIONA!)
  try {
    // ✅ BUSCA SESSÃO DO BANCO (igual executeContratoEnviadoMessage)
    const [session] = await db
      .select()
      .from(whatsappSessions)
      .where(and(eq(whatsappSessions.userId, task.userId), eq(whatsappSessions.status, "conectada")))
      .limit(1);

    if (session) {
      // Usa client.celular
      if (client && client.celular) {
        const isAlive = whatsappService.isSessionAlive(session.sessionId);
        if (isAlive) {
          // Formata o telefone para WhatsApp (normalização completa)
          let telefone = client.celular.replace(/\D/g, "").trim();
          // Remove 55 duplicado se existir
          if (telefone.startsWith("5555")) {
            telefone = telefone.substring(2);
          }
          // Adiciona 55 se não tiver
          if (!telefone.startsWith("55")) {
            telefone = "55" + telefone;
          }
          
          try {
            console.log(`📱 Enviando lembrete ${lembreteNum} via WhatsApp para ${telefone}...`);
            const result = await whatsappService.sendMessage(session.sessionId, telefone, mensagem);
            if (result.success && result.messageId) {
              console.log(`✅ Lembrete ${lembreteNum}/3 enviado via WhatsApp com sucesso para ${client.nome} (ID: ${result.messageId})`);
              // ✅ ATUALIZAR whatsappMessageId e status para tracking de ticks
              await db.update(messages)
                .set({ 
                  whatsappMessageId: result.messageId,
                  statusEntrega: "enviado"
                })
                .where(eq(messages.id, insertedMessage.id));
            } else {
              console.warn(`⚠️ Falha ao enviar lembrete via WhatsApp para ${client.nome}`);
              await db.update(messages)
                .set({ statusEntrega: "erro" })
                .where(eq(messages.id, insertedMessage.id));
            }
          } catch (error) {
            console.error(`❌ Erro ao enviar mensagem via WhatsApp:`, error);
            await db.update(messages)
              .set({ statusEntrega: "erro" })
              .where(eq(messages.id, insertedMessage.id));
          }
        } else {
          console.warn(`⚠️ Sessão WhatsApp não está viva (isAlive=false). Mensagem só no chat.`);
        }
      } else {
        console.warn(`⚠️ Cliente sem celular. Mensagem só no chat.`);
      }
    } else {
      console.warn(`⚠️ Nenhuma sessão WhatsApp conectada para userId ${task.userId}. Mensagem só no chat.`);
    }
  } catch (error) {
    console.error(`❌ Erro ao enviar WhatsApp:`, error);
    await db.update(messages)
      .set({ statusEntrega: "erro" })
      .where(eq(messages.id, insertedMessage.id));
  }
  
  // 🚀 BROADCAST VIA WEBSOCKET
  wsClients.forEach((wsClient) => {
    try {
      wsClient.send(JSON.stringify({
        type: "new_message",
        conversationId: conversation.id,
        message: {
          id: insertedMessage.id,
          conversationId: conversation.id,
          sender: "user",
          tipo: "texto",
          conteudo: mensagem,
          origem: "automation",
          statusEntrega: "enviado",
          createdAt: new Date(),
        },
        timestamp: new Date(),
      }));
    } catch (err) {
      console.error("❌ Erro ao broadcast WebSocket:", err);
    }
  });
  
  console.log(`✅ Lembrete ${lembreteNum}/3 enviado para ${client.nome}`);
  
  // Se foi o 3º lembrete, agendar movimento para AGUARDANDO ATENÇÃO IMEDIATAMENTE
  if (lembreteNum === 3) {
    console.log(`⏭️ 3º lembrete executado! Agendando movimento IMEDIATO para AGUARDANDO ATENÇÃO...`);
    const proximaExecucao = new Date(); // AGORA!
    
    await db.insert(automationTasks).values({
      userId: task.userId,
      clientId: opportunity.clientId,
      tipo: "kanban_move",
      proximaExecucao,
      dados: { 
        oppId: opportunity.id,  // ✅ CORRIGIDO: era opportunityId
        toStage: "AGUARDANDO ATENÇÃO",  // ✅ CORRIGIDO: era etapa
        motivo: "Terceiro lembrete enviado - movendo para análise gerencial",
        notificarResponsavel: true,
      },
    });
  }
}

// ======================== SCHEDULER DE CRON (executar a cada 30 segundos - OTIMIZADO) ========================
export function startAutomationCron() {
  console.log(`\n⏰ [AUTOMATION CRON] Iniciando scheduler (30 segundos - OTIMIZADO)...`);
  
  // Executar a cada 30 segundos (otimizado para evitar bloqueio do event loop)
  const interval = setInterval(async () => {
    try {
      await processAutomationTasks();
    } catch (err) {
      console.error("❌ Erro em processAutomationTasks:", err);
    }
    
    try {
      await checkPropostaEnviadaTimeouts();
    } catch (err) {
      console.error("❌ Erro em checkPropostaEnviadaTimeouts:", err);
    }
    
    try {
      await checkAguardandoAceiteTimeouts();
    } catch (err) {
      console.error("❌ Erro em checkAguardandoAceiteTimeouts:", err);
    }
  }, 30 * 1000);

  // Executar também na inicialização (com delay de 5s para não bloquear startup)
  setTimeout(async () => {
    try {
      await processAutomationTasks();
      await checkPropostaEnviadaTimeouts();
      await checkAguardandoAceiteTimeouts();
    } catch (err) {
      console.error("❌ Erro na execução inicial do cron:", err);
    }
  }, 5000);

  return () => clearInterval(interval);
}

// ======================== VERIFICAR AGUARDANDO ACEITE - Lógica de Lembretes ========================
export async function checkAguardandoAceiteTimeouts() {
  try {
    console.log(`\n📝 [ACEITE CHECK] Verificando contratos em Aguardando Aceite...`);
    
    // Buscar oportunidades em AGUARDANDO ACEITE
    const aguardando = await db
      .select()
      .from(opportunities)
      .where(eq(opportunities.etapa, "AGUARDANDO ACEITE"));
    
    console.log(`📋 Encontradas ${aguardando.length} em AGUARDANDO ACEITE`);
    
    for (const opp of aguardando) {
      // Buscar último reminder deste contrato (filtrar por opportunityId, não clientId!)
      const lastTask = await db
        .select()
        .from(automationTasks)
        .where(
          and(
            eq(automationTasks.tipo, "aguardando_aceite_reminder"),
            eq(automationTasks.opportunityId, opp.id)  // ✅ CORRIGIDO: usar opportunityId
          )
        )
        .orderBy((t: any) => desc(t.createdAt))
        .limit(1);
      
      // Se não tem tarefa agendada NENHUMA
      if (!lastTask || lastTask.length === 0) {
        // ⏰ ANTI-SPAM: Verificar se já enviou mensagem de aceite nas últimas 3 horas
        const tresHorasAtras = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const mensagensRecentes = await db
          .select()
          .from(interactions)
          .where(
            and(
              eq(interactions.clientId, opp.clientId),
              eq(interactions.tipo, "aguardando_aceite_reminder"),
              gte(interactions.createdAt, tresHorasAtras)
            )
          )
          .limit(1);
        
        if (mensagensRecentes.length > 0) {
          console.log(`⏳ [ANTI-SPAM] Já enviou lembrete de aceite recente para ${opp.id}. Aguardando...`);
          continue;
        }
        
        console.log(`✅ Agendando 1º lembrete para oportunidade ${opp.id}`);
        const nextTime = new Date(); // ✅ EXECUTA IMEDIATAMENTE no próximo ciclo do cron
        
        await db.insert(automationTasks).values({
          userId: opp.responsavelId,
          clientId: opp.clientId,
          opportunityId: opp.id,  // ✅ Adicionar ao campo, não apenas ao dados
          tipo: "aguardando_aceite_reminder",
          proximaExecucao: nextTime,
          dados: { 
            opportunityId: opp.id, 
            lembrete: 1,
            contractSentAt: opp.updatedAt || new Date(),
          },
        });
      } 
      // Se a última tarefa foi EXECUTADA, criar próxima
      else if (lastTask[0].status === "executado") {
        const lembreteAtual = lastTask[0].dados?.lembrete || 1;
        console.log(`📌 Última task executada: lembrete ${lembreteAtual}/3`);
        
        if (lembreteAtual < 3) {
          // Criar próximo lembrete
          const nextLembrete = lembreteAtual + 1;
          const proximaExecucao = getNextAguardandoAceiteTime({ 
            lembrete: nextLembrete,
            contractSentAt: lastTask[0].dados?.contractSentAt,
          });
          
          console.log(`✅ Agendando ${nextLembrete}º lembrete para ${opp.id} às ${proximaExecucao.toLocaleString("pt-BR")}`);
          
          await db.insert(automationTasks).values({
            userId: opp.responsavelId,
            clientId: opp.clientId,
            opportunityId: opp.id,  // ✅ Adicionar ao campo, não apenas ao dados
            tipo: "aguardando_aceite_reminder",
            proximaExecucao,
            dados: { 
              opportunityId: opp.id, 
              lembrete: nextLembrete,
              contractSentAt: lastTask[0].dados?.contractSentAt,
            },
          });
        } else if (lembreteAtual === 3) {
          // 3º lembrete foi executado = agendar movimento para AGUARDANDO ATENÇÃO IMEDIATAMENTE
          console.log(`⏭️ 3º lembrete executado! Agendando movimento IMEDIATO para AGUARDANDO ATENÇÃO...`);
          
          const proximaExecucao = new Date(); // ✅ EXECUTA IMEDIATAMENTE
          
          await db.insert(automationTasks).values({
            userId: opp.responsavelId,
            clientId: opp.clientId,
            opportunityId: opp.id,  // ✅ Adicionar ao campo
            tipo: "kanban_move",
            proximaExecucao,
            dados: { 
              opportunityId: opp.id, 
              etapa: "AGUARDANDO ATENÇÃO",
              motivo: "Terceiro lembrete enviado - movendo para análise gerencial",
              notificarResponsavel: true,
            },
          });
        }
      }
    }
  } catch (error) {
    console.error(`❌ Erro ao verificar Aguardando Aceite:`, error);
  }
}
