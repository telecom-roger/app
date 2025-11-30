import * as storage from "./storage";
import { db } from "./db";
import { eq, and, lt, asc, desc, sql } from "drizzle-orm";
import { automationTasks, followUps, clientScores, opportunities, messages, conversations } from "@shared/schema";
import { analyzeClientMessage } from "./aiService";

// ======================== VALIDAÇÃO DE MOVIMENTO ========================
// 🔥 REGRAS CRÍTICAS DE MOVIMENTO DA IA:
// LEAD → Pode ir para: CONTATO, PROPOSTA, AUTOMÁTICA, PERDIDO
// CONTATO → Pode ir para: PROPOSTA ou PERDIDO
// PROPOSTA → BLOQUEADO (IA não mexe)
// PROPOSTA ENVIADA → BLOQUEADO (IA não mexe)
// AGUARDANDO CONTRATO → BLOQUEADO (IA não mexe)
// CONTRATO ENVIADO → BLOQUEADO (IA não mexe)
// AGUARDANDO ACEITE → BLOQUEADO (IA não mexe)
// AGUARDANDO ATENÇÃO → BLOQUEADO (IA não mexe)
// FECHADO → BLOQUEADO (IA não mexe)
// PERDIDO → Pode ir para: CONTATO, PROPOSTA (se cliente enviar interesse)
// AUTOMÁTICA → Pode ir para: CONTATO, PROPOSTA (se cliente enviar interesse)

// Etapas que NÃO podem ser tocadas pela IA (100% manuais)
const ETAPAS_MANUAIS_BLOQUEADAS = [
  "PROPOSTA", 
  "PROPOSTA ENVIADA", 
  "AGUARDANDO CONTRATO", 
  "CONTRATO ENVIADO", 
  "AGUARDANDO ACEITE", 
  "AGUARDANDO ATENÇÃO",
  "FECHADO"
];

/**
 * Valida se um movimento de etapa é permitido
 * Regras:
 * - LEAD: livre (pode ir para qualquer lugar)
 * - CONTATO: pode ir para PROPOSTA ou PERDIDO
 * - PROPOSTA+: bloqueado (7 etapas manuais)
 * - PERDIDO: pode voltar se interesse (→ CONTATO ou PROPOSTA)
 * - AUTOMÁTICA: pode voltar se interesse (→ CONTATO ou PROPOSTA)
 */
function isValidMovement(etapaAtual: string, etapaNova: string): { permitido: boolean; motivo: string } {
  // 🔥 BLOQUEIO: Se etapa atual está nas "manuais bloqueadas" → IA PARA COMPLETAMENTE
  if (ETAPAS_MANUAIS_BLOQUEADAS.includes(etapaAtual)) {
    return { permitido: false, motivo: `${etapaAtual} - IA PROIBIDO` };
  }
  
  // 🔥 CONTATO → pode ir para PROPOSTA ou PERDIDO
  if (etapaAtual === "CONTATO" && etapaNova !== "PROPOSTA" && etapaNova !== "PERDIDO") {
    return { permitido: false, motivo: `${etapaAtual} → ${etapaNova}: CONTATO só vai para PROPOSTA ou PERDIDO` };
  }
  
  // 🔥 LEAD → livre (pode ir para qualquer lugar)
  if (etapaAtual === "LEAD") {
    return { permitido: true, motivo: "LEAD é livre" };
  }
  
  // 🔥 PERDIDO ou AUTOMÁTICA → pode voltar para CONTATO ou PROPOSTA (interesse)
  if ((etapaAtual === "PERDIDO" || etapaAtual === "AUTOMÁTICA") && 
      (etapaNova === "CONTATO" || etapaNova === "PROPOSTA")) {
    return { permitido: true, motivo: `${etapaAtual} → ${etapaNova}: Volta por interesse` };
  }
  
  // 🔥 Se são iguais, permite (sem movimento)
  if (etapaAtual === etapaNova) {
    return { permitido: true, motivo: "Mesma etapa - sem mudança" };
  }
  
  // Outros movimentos de PERDIDO/AUTOMÁTICA são bloqueados
  if (etapaAtual === "PERDIDO" || etapaAtual === "AUTOMÁTICA") {
    return { permitido: false, motivo: `${etapaAtual} → ${etapaNova}: Só pode voltar para CONTATO ou PROPOSTA` };
  }
  
  return { permitido: false, motivo: `Movimento não mapeado: ${etapaAtual} → ${etapaNova}` };
}

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
    const clientName = client.nome || "Cliente Desconhecido";
    
    // Cria 3 oportunidades de teste NOVAS com etapas diferentes
    const opp1 = await db.insert(opportunities).values({
      clientId,
      titulo: `${clientName} - Lead`,
      etapa: "LEAD",
      valorEstimado: "1000",
      responsavelId: userId,
      ordem: 0,
    }).returning().then(r => r[0]);

    const opp2 = await db.insert(opportunities).values({
      clientId,
      titulo: `${clientName} - Contato`,
      etapa: "CONTATO",
      valorEstimado: "2000",
      responsavelId: userId,
      ordem: 1,
    }).returning().then(r => r[0]);

    const opp3 = await db.insert(opportunities).values({
      clientId,
      titulo: `${clientName} - Proposta`,
      etapa: "PROPOSTA",
      valorEstimado: "3000",
      responsavelId: userId,
      ordem: 2,
    }).returning().then(r => r[0]);
    
    // 🔄 RECALCULATE CLIENT STATUS
    const newStatus = await storage.recalculateClientStatus(clientId);
    await storage.updateClient(clientId, { status: newStatus });
    console.log(`🔄 Status do cliente atualizado para: ${newStatus.toUpperCase()}`);

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

    // Buscar oportunidade antiga
    const oldOpp = await db.query.opportunities.findFirst({
      where: (o: any) => eq(o.id, oppId),
    });

    await db
      .update(opportunities)
      .set({ etapa: toStage })
      .where(eq(opportunities.id, oppId));

    // 📝 REGISTRAR NA TIMELINE (Sistema - teste)
    if (oldOpp) {
      const storageModule = await import("./storage");
      await storageModule.recordEtapaChange(oppId, oldOpp.clientId, oldOpp.etapa, toStage, "sistema", task.userId);
    }

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
          ultimaMensagemEm: new Date(),
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
    });

    console.log(`📊 IA retornou: ${analysis.sentimento} → ${analysis.etapa} (deveAgir: ${analysis.deveAgir}, ehRecusaParcial: ${analysis.ehRecusaParcial})`);

    // Normalizar etapa da IA para MAIÚSCULA
    const etapaNormalizada = analysis.etapa.toUpperCase();
    
    // 4. CRIAR ou MOVER OPORTUNIDADE
    if (client) {
      // Buscar opp aberta (não PERDIDA, não FECHADA)
      const etapasFinais = ["PERDIDO", "FECHADO"];
      let existingOpp = await db.query.opportunities.findFirst({
        where: (o: any) => 
          and(
            eq(o.clientId, clientId),
            sql`${o.etapa} NOT IN (${sql.raw("'" + etapasFinais.join("','") + "'")})`
          ),
        orderBy: (o: any) => desc(o.createdAt),
      });
      
      let resultOpp: any;
      let actionType: "criar" | "mover" | "nenhuma" | "bloqueado" = "criar";
      let statusAtualizado: string | null = null;
      let alerta = "";
      
      // 🤖 DETECÇÃO ESPECIAL: Se mensagem automática → MOVER PARA AUTOMÁTICA (apenas se etapa NÃO bloqueada)
      if (analysis.ehMensagemAutomatica) {
        console.log(`🤖 MENSAGEM AUTOMÁTICA DETECTADA`);
        // Verificar se etapa é bloqueada
        const ETAPAS_MANUAIS_BLOQUEADAS = [
          "PROPOSTA", 
          "PROPOSTA ENVIADA", 
          "AGUARDANDO CONTRATO",
          "CONTRATO ENVIADO",
          "AGUARDANDO ACEITE",
          "AGUARDANDO ATENÇÃO",
          "FECHADO"
        ];
        
        if (existingOpp && ETAPAS_MANUAIS_BLOQUEADAS.includes(existingOpp.etapa)) {
          // 🛑 BLOQUEIO: Etapa bloqueada - não pode mexer
          console.log(`🛑 BLOQUEADO: ${existingOpp.etapa} é etapa bloqueada - IA não pode mexer`);
          resultOpp = existingOpp;
          actionType = "nenhuma";
        } else if (existingOpp) {
          // Move para AUTOMÁTICA (etapa não-bloqueada)
          resultOpp = await db.update(opportunities).set({ 
            etapa: "AUTOMÁTICA",
            titulo: `${client.nome} - Aguardando resposta (mensagem automática)`,
            updatedAt: new Date()
          }).where(eq(opportunities.id, existingOpp.id))
          .returning()
          .then(r => r[0]);
          console.log(`✅ OPP MOVIDA (AUTOMÁTICO): ${existingOpp.etapa} → AUTOMÁTICA`);
          actionType = "mover";
        } else {
          // Cria em AUTOMÁTICA (sem opp existente)
          resultOpp = await db.insert(opportunities).values({
            clientId,
            titulo: `${client.nome} - Aguardando resposta (mensagem automática)`,
            etapa: "AUTOMÁTICA",
            valorEstimado: "5000",
            responsavelId: userId,
            ordem: 0,
          }).returning().then(r => r[0]);
          console.log(`✅ OPP CRIADA (AUTOMÁTICO): AUTOMÁTICA`);
          actionType = "criar";
        }
      } 
      // 🎯 SE NÃO EXISTE OPP → SEMPRE CRIAR (até mesmo recusa parcial)
      else if (!existingOpp) {
        console.log(`✨ CRIANDO nova opportunity em ${etapaNormalizada}`);
        resultOpp = await db.insert(opportunities).values({
          clientId,
          titulo: `${client.nome} - ${analysis.motivo}`,
          etapa: etapaNormalizada,
          valorEstimado: "5000",
          responsavelId: userId,
          ordem: 0,
        }).returning().then(r => r[0]);
        console.log(`✅ Oportunidade criada: ${resultOpp.id}`);
        actionType = "criar";
        
        // Se é recusa parcial → alerta atendente
        if (analysis.ehRecusaParcial) {
          alerta = `\n⚠️ ALERTA: ${analysis.sugestao}`;
          console.log(`⚠️ Recusa parcial no primeiro contato - alertando atendente`);
        }
      } 
      // 🔥 EXCEÇÃO CRÍTICA: CONTATO→PROPOSTA é OBRIGATÓRIO se cliente aprova
      else if (existingOpp.etapa === "CONTATO" && 
               analysis.deveAgir === true &&
               (analysis.sentimento === "positivo" || analysis.sentimento === "fornecedor")) {
        // MOVIMENTO OBRIGATÓRIO para PROPOSTA (aprovação clara)
        console.log(`🔥 MOVIMENTO OBRIGATÓRIO: CONTATO → PROPOSTA (aprovação detectada)`);
        resultOpp = await db
          .update(opportunities)
          .set({ 
            etapa: "PROPOSTA",
            titulo: `${client.nome} - ${analysis.motivo}`,
            updatedAt: new Date()
          })
          .where(eq(opportunities.id, existingOpp.id))
          .returning()
          .then(r => r[0]);
        
        console.log(`✅ Oportunidade MOVIDA (OBRIGATÓRIO): CONTATO → PROPOSTA`);
        actionType = "mover";
      }
      // 🎯 SE EXISTE OPP E deveAgir = true → VALIDAR MOVIMENTO
      else if (analysis.deveAgir && existingOpp.etapa !== etapaNormalizada) {
        const validacao = isValidMovement(existingOpp.etapa, etapaNormalizada);
        
        if (!validacao.permitido) {
          console.log(`🚫 MOVIMENTO BLOQUEADO: ${validacao.motivo}`);
          return { 
            success: false, 
            clientId, 
            message: `🚫 Movimento bloqueado: ${validacao.motivo}`,
            analysis,
            action: "bloqueado",
          };
        }
        
        console.log(`🔄 MOVENDO opp de ${existingOpp.etapa} → ${etapaNormalizada}`);
        resultOpp = await db
          .update(opportunities)
          .set({ 
            etapa: etapaNormalizada,
            titulo: `${client.nome} - ${analysis.motivo}`,
            updatedAt: new Date()
          })
          .where(eq(opportunities.id, existingOpp.id))
          .returning()
          .then(r => r[0]);
        
        console.log(`✅ Oportunidade MOVIDA: ${existingOpp.etapa} → ${etapaNormalizada}`);
        actionType = "mover";
      } 
      // 🎯 SE EXISTE OPP E deveAgir = false → MANTER ETAPA ATUAL (recusa parcial respostas seguintes)
      else if (!analysis.deveAgir) {
        resultOpp = existingOpp;
        console.log(`ℹ️ Mantendo oportunidade em ${existingOpp.etapa}`);
        actionType = "nenhuma";
        
        // Alerta se é recusa parcial
        if (analysis.ehRecusaParcial) {
          alerta = `\n⚠️ ALERTA: ${analysis.sugestao}`;
          console.log(`⚠️ Recusa parcial detectada - alertando atendente`);
        }
      } 
      // 🎯 OPP JÁ NA MESMA ETAPA → SEM AÇÃO
      else {
        resultOpp = existingOpp;
        console.log(`ℹ️ Oportunidade já em ${etapaNormalizada}`);
        actionType = "nenhuma";
      }
      
      // 🔄 RECALCULATE CLIENT STATUS
      statusAtualizado = await storage.recalculateClientStatus(clientId);
      await storage.updateClient(clientId, { status: statusAtualizado });
      console.log(`🔄 Status do cliente atualizado: ${statusAtualizado.toUpperCase()}`);
      
      const actionMessage = 
        actionType === "mover" ? `✅ Oportunidade MOVIDA para "${etapaNormalizada}"` :
        actionType === "criar" ? `✅ Nova oportunidade criada em "${etapaNormalizada}"` :
        `ℹ️ Oportunidade mantida em "${resultOpp.etapa}"`;
      
      return { 
        success: true, 
        clientId, 
        message: `${actionMessage}\n📊 Sentimento: ${analysis.sentimento}\n💡 ${analysis.sugestao}${alerta}\n🔄 Status: ${statusAtualizado?.toUpperCase() || ""}`,
        analysis,
        opportunityId: resultOpp.id,
        statusAtualizado,
        action: actionType,
      };
    }

    console.log(`✅ Teste concluído: Mensagem criada + Oportunidade criada`);
    
    return { 
      success: true, 
      clientId, 
      message: `IA respondeu: ${analysis.sentimento} → ${analysis.etapa}`,
      analysis,
    };
  } catch (error) {
    console.error(`❌ Erro:`, error);
    throw error;
  }
}

export async function processBatchResponses(userId: string, responses: Array<{ clientId: string; message: string }>) {
  try {
    console.log(`\n📦 [BATCH TEST] Processando ${responses.length} respostas...`);
    
    const results = [];
    
    for (const resp of responses) {
      try {
        const result = await simulateClientResponse(resp.clientId, userId, resp.message);
        results.push({
          clientId: resp.clientId,
          success: true,
          message: result.message,
          analysis: result.analysis,
        });
      } catch (err) {
        results.push({
          clientId: resp.clientId,
          success: false,
          error: String(err),
        });
      }
    }
    
    console.log(`✅ Batch concluído: ${results.filter((r: any) => r.success).length}/${responses.length} com sucesso`);
    
    return { success: true, results };
  } catch (error) {
    console.error(`❌ Erro:`, error);
    throw error;
  }
}
