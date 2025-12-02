import { db } from "./db";
import { eq, and, desc, asc, sql, ilike, or, inArray, count } from "drizzle-orm";
import type {
  Client,
  InsertClient,
  Opportunity,
  InsertOpportunity,
  Campaign,
  InsertCampaign,
  Template,
  InsertTemplate,
  User,
  UpsertUser,
  Interaction,
  InsertInteraction,
  Contact,
  InsertContact,
  CustomField,
  InsertCustomField,
  AuditLog,
  InsertAuditLog,
  ImportJob,
  InsertImportJob,
  Conversation,
  InsertConversation,
  Message,
  InsertMessage,
  QuickReply,
  InsertQuickReply,
  ClientNote,
  InsertClientNote,
  Tag,
  InsertTag,
  ClientSharing,
  InsertClientSharing,
  Notification,
  InsertNotification,
  CampaignSending,
  InsertCampaignSending,
  CampaignGroup,
  InsertCampaignGroup,
  KanbanStage,
  InsertKanbanStage,
  AutomationTask,
  InsertAutomationTask,
  FollowUp,
  InsertFollowUp,
  ClientScore,
  InsertClientScore,
} from "@shared/schema";
import {
  clients,
  opportunities,
  campaigns,
  templates,
  users,
  interactions,
  contacts,
  customFields,
  auditLogs,
  importJobs,
  whatsappSessions,
  conversations,
  messages,
  quickReplies,
  clientNotes,
  tags,
  clientSharing,
  notifications,
  campaignSendings,
  campaignGroups,
  kanbanStages,
  automationTasks,
  followUps,
  clientScores,
} from "@shared/schema";

// ==================== USER STORAGE ====================
export async function upsertUser(user: UpsertUser): Promise<User> {
  const [result] = await db
    .insert(users)
    .values(user)
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        updatedAt: new Date(),
      },
    })
    .returning();
  return result;
}

export async function getUserById(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user;
}

export async function createUser(data: any): Promise<User> {
  const [result] = await db.insert(users).values(data).returning();
  return result;
}

export async function getAllUsers(): Promise<User[]> {
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

// ==================== CLIENT STORAGE ====================
export async function createClient(data: InsertClient): Promise<Client> {
  const [result] = await db.insert(clients).values(data).returning();
  return result;
}

export async function updateClient(
  id: string,
  data: Partial<InsertClient>
): Promise<Client | undefined> {
  const [result] = await db
    .update(clients)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning();
  return result;
}

export async function getClientById(id: string): Promise<Client | undefined> {
  const [result] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result;
}

export async function getClients(params: {
  search?: string;
  status?: string;
  tagName?: string;
  tipo?: string;
  carteira?: string;
  page?: number;
  limit?: number;
  userId?: string;
  isAdmin?: boolean;
}): Promise<{ clientes: Client[]; total: number }> {
  const { search, status, tagName, tipo, carteira, page = 1, limit = 20, userId, isAdmin = false } = params;
  const offset = (page - 1) * limit;

  let conditions = [];
  
  // TODOS (admin ou não) veem apenas seus clientes OU compartilhados
  if (userId) {
    conditions.push(
      or(
        eq(clients.createdBy, userId),
        sql`${clients.id} IN (SELECT ${clientSharing.clientId} FROM ${clientSharing} WHERE ${clientSharing.sharedWithUserId} = ${userId})`
      )
    );
  }
  
  if (search) {
    conditions.push(
      or(
        ilike(clients.nome, `%${search}%`),
        ilike(clients.cnpj, `%${search}%`),
        ilike(clients.celular, `%${search}%`)
      )
    );
  }
  if (status && status !== "todos") {
    conditions.push(eq(clients.status, status));
  }
  if (tagName) {
    conditions.push(sql`${clients.tags}::text[] @> ARRAY[${tagName}]`);
  }
  if (tipo) {
    conditions.push(eq(clients.tipoCliente, tipo));
  }
  if (carteira) {
    conditions.push(eq(clients.carteira, carteira));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [clientes, totalResult] = await Promise.all([
    db
      .selectDistinct()
      .from(clients)
      .where(whereClause)
      .orderBy(desc(clients.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .selectDistinct({ id: clients.id })
      .from(clients)
      .where(whereClause),
  ]);

  return {
    clientes,
    total: totalResult.length,
  };
}

export async function deleteClient(id: string): Promise<void> {
  await db.delete(clients).where(eq(clients.id, id));
}

// Verificar se usuário pode acessar o cliente (criou ou compartilhado)
export async function canUserAccessClient(clientId: string, userId: string): Promise<boolean> {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  
  if (!client) return false;
  
  // Usuário é o proprietário
  if (client.createdBy === userId) return true;
  
  // Cliente foi compartilhado com o usuário
  const [sharing] = await db
    .select()
    .from(clientSharing)
    .where(and(
      eq(clientSharing.clientId, clientId),
      eq(clientSharing.sharedWithUserId, userId)
    ))
    .limit(1);
  
  return !!sharing;
}

// ==================== CONTACT STORAGE ====================
export async function createContact(data: InsertContact): Promise<Contact> {
  const [result] = await db.insert(contacts).values(data).returning();
  return result;
}

export async function getContactsByClientId(clientId: string): Promise<Contact[]> {
  return await db
    .select()
    .from(contacts)
    .where(eq(contacts.clientId, clientId))
    .orderBy(desc(contacts.preferencial));
}

// ==================== OPPORTUNITY STORAGE ====================
export async function createOpportunity(data: InsertOpportunity): Promise<Opportunity> {
  const [result] = await db.insert(opportunities).values(data).returning();
  
  // Recalculate client's status
  if (result?.clientId) {
    await recalculateClientStatus(result.clientId);
  }
  
  return result;
}

export async function updateOpportunity(
  id: string,
  data: Partial<InsertOpportunity>
): Promise<Opportunity | undefined> {
  const [result] = await db
    .update(opportunities)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(opportunities.id, id))
    .returning();
  
  // Recalculate client's status
  if (result?.clientId) {
    await recalculateClientStatus(result.clientId);
  }
  
  return result;
}

export async function getOpportunities(params: {
  responsavel?: string;
  etapa?: string;
  userId?: string; // Filtro por usuário
}): Promise<Opportunity[]> {
  let conditions = [];
  
  // Se userId está definido, filtra APENAS oportunidades do usuário (responsavelId)
  // Cada vendedor vê APENAS suas próprias oportunidades, mesmo que cliente seja compartilhado
  if (params.userId) {
    conditions.push(eq(opportunities.responsavelId, params.userId));
  } else if (params.responsavel && params.responsavel !== "todos") {
    conditions.push(eq(opportunities.responsavelId, params.responsavel));
  }
  
  if (params.etapa) {
    conditions.push(eq(opportunities.etapa, params.etapa));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  return await db
    .select()
    .from(opportunities)
    .where(whereClause)
    .orderBy(opportunities.ordem, opportunities.createdAt);
}

export async function getOpportunityById(id: string): Promise<Opportunity | undefined> {
  const [result] = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.id, id))
    .limit(1);
  return result;
}

export async function deleteOpportunity(id: string): Promise<void> {
  // Get opportunity before deleting to know which client to update
  const opp = await getOpportunityById(id);
  await db.delete(opportunities).where(eq(opportunities.id, id));
  
  // Recalculate client's status
  if (opp?.clientId) {
    await recalculateClientStatus(opp.clientId);
  }
}

// ==================== CAMPAIGN STORAGE ====================
export async function createCampaign(data: InsertCampaign): Promise<Campaign> {
  const [result] = await db.insert(campaigns).values(data).returning();
  return result;
}

export async function updateCampaign(
  id: string,
  data: Partial<InsertCampaign>
): Promise<Campaign | undefined> {
  const [result] = await db
    .update(campaigns)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(campaigns.id, id))
    .returning();
  return result;
}

export async function getCampaigns(): Promise<Campaign[]> {
  return await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
}

export async function getCampaignById(id: string): Promise<Campaign | undefined> {
  const [result] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return result;
}

export async function deleteCampaign(id: string): Promise<void> {
  await db.delete(campaigns).where(eq(campaigns.id, id));
}

// ==================== TEMPLATE STORAGE ====================
export async function createTemplate(data: InsertTemplate): Promise<Template> {
  const [result] = await db.insert(templates).values(data).returning();
  return result;
}

export async function getTemplates(): Promise<Template[]> {
  return await db
    .select()
    .from(templates)
    .where(eq(templates.ativo, true))
    .orderBy(desc(templates.createdAt));
}

export async function getTemplateById(id: string): Promise<Template | undefined> {
  const [result] = await db.select().from(templates).where(eq(templates.id, id)).limit(1);
  return result;
}

export async function updateTemplate(
  id: string,
  data: Partial<InsertTemplate>
): Promise<Template | undefined> {
  const [result] = await db
    .update(templates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(templates.id, id))
    .returning();
  return result;
}

export async function deleteTemplate(id: string): Promise<void> {
  await db.delete(templates).where(eq(templates.id, id));
}

// ==================== INTERACTION/TIMELINE STORAGE ====================
export async function createInteraction(data: InsertInteraction): Promise<Interaction> {
  const [result] = await db.insert(interactions).values(data).returning();
  return result;
}

export async function getTimelineByClientId(clientId: string): Promise<any[]> {
  return await db
    .select({
      id: interactions.id,
      clientId: interactions.clientId,
      tipo: interactions.tipo,
      origem: interactions.origem,
      titulo: interactions.titulo,
      texto: interactions.texto,
      meta: interactions.meta,
      createdBy: interactions.createdBy,
      createdAt: interactions.createdAt,
      userName: users.firstName,
    })
    .from(interactions)
    .leftJoin(users, eq(interactions.createdBy, users.id))
    .where(eq(interactions.clientId, clientId))
    .orderBy(desc(interactions.createdAt));
}

// ==================== CUSTOM FIELD STORAGE ====================
export async function createCustomField(data: InsertCustomField): Promise<CustomField> {
  const [result] = await db.insert(customFields).values(data).returning();
  return result;
}

export async function getCustomFields(): Promise<CustomField[]> {
  return await db.select().from(customFields).orderBy(customFields.ordem);
}

// ==================== AUDIT LOG STORAGE ====================
export async function createAuditLog(data: InsertAuditLog): Promise<void> {
  await db.insert(auditLogs).values(data);
}

export async function getAuditLogs(params: {
  userId?: string;
  entidade?: string;
  limit?: number;
}): Promise<AuditLog[]> {
  const { userId, entidade, limit = 100 } = params;

  let conditions = [];
  if (userId) {
    conditions.push(eq(auditLogs.userId, userId));
  }
  if (entidade) {
    conditions.push(eq(auditLogs.entidade, entidade));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  return await db
    .select()
    .from(auditLogs)
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

// ==================== IMPORT JOB STORAGE ====================
export async function createImportJob(data: InsertImportJob): Promise<ImportJob> {
  const [result] = await db.insert(importJobs).values(data).returning();
  return result;
}

export async function updateImportJob(
  id: string,
  data: Partial<InsertImportJob>
): Promise<ImportJob | undefined> {
  const [result] = await db
    .update(importJobs)
    .set(data)
    .where(eq(importJobs.id, id))
    .returning();
  return result;
}

export async function getImportJobs(userId?: string): Promise<ImportJob[]> {
  const whereClause = userId ? eq(importJobs.createdBy, userId) : undefined;
  return await db
    .select()
    .from(importJobs)
    .where(whereClause)
    .orderBy(desc(importJobs.createdAt));
}

// ==================== STATISTICS ====================
export async function getDashboardStats(userId?: string) {
  let clientWhereClause = userId ? eq(clients.createdBy, userId) : undefined;
  let opportunityWhereClause = userId ? eq(opportunities.responsavelId, userId) : undefined;
  let campaignWhereClause = userId ? eq(campaigns.createdBy, userId) : undefined;

  const [clientStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      ativos: sql<number>`count(*) FILTER (WHERE status = 'ativo')::int`,
      importados: sql<number>`count(*) FILTER (WHERE created_by IS NOT NULL)::int`,
      antigos: sql<number>`count(*) FILTER (WHERE created_by IS NULL)::int`,
    })
    .from(clients)
    .where(clientWhereClause);

  const [opportunityCount] = await db
    .select({
      total: sql<number>`count(*)::int`,
    })
    .from(opportunities)
    .where(opportunityWhereClause);

  const [campaignStats] = await db
    .select({
      ativas: sql<number>`count(*) FILTER (WHERE status IN ('agendada', 'enviando'))::int`,
    })
    .from(campaigns)
    .where(campaignWhereClause);

  return {
    totalClientes: clientStats?.total || 0,
    clientesAtivos: clientStats?.ativos || 0,
    clientesImportados: clientStats?.importados || 0,
    clientesAntigos: clientStats?.antigos || 0,
    oportunidades: opportunityCount?.total || 0,
    campanhasAtivas: campaignStats?.ativas || 0,
    taxaConversao: 21.5,
    tendenciaClientes: 12.5,
  };
}

export async function getFunnelData(userId?: string) {
  let whereClause = userId ? eq(opportunities.responsavelId, userId) : undefined;
  
  const results = await db
    .select({
      etapa: opportunities.etapa,
      count: sql<number>`count(*)::int`,
    })
    .from(opportunities)
    .where(whereClause)
    .groupBy(opportunities.etapa);

  const funnelMap: Record<string, number> = {
    lead: 0,
    contato: 0,
    proposta: 0,
    fechado: 0,
  };

  results?.forEach((row: any) => {
    if (funnelMap.hasOwnProperty(row.etapa)) {
      funnelMap[row.etapa] = row.count;
    }
  });

  return funnelMap;
}

export async function getStatusDistribution(userId?: string) {
  let whereClause = userId ? eq(clients.createdBy, userId) : undefined;
  
  const results = await db
    .select({
      status: clients.status,
      count: sql<number>`count(*)::int`,
    })
    .from(clients)
    .where(whereClause)
    .groupBy(clients.status)
    .orderBy(sql<number>`count(*) DESC`);

  return (
    results?.map((row: any) => ({
      name: row.status.charAt(0).toUpperCase() + row.status.slice(1),
      value: row.count,
    })) || []
  );
}

// ==================== WHATSAPP SESSIONS ====================
export async function createWhatsappSession(data: any) {
  const [result] = await db.insert(whatsappSessions).values(data).returning();
  return result;
}

export async function updateWhatsappSession(id: string, data: any) {
  const [result] = await db
    .update(whatsappSessions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(whatsappSessions.id, id))
    .returning();
  return result;
}

export async function getWhatsappSessionById(id: string) {
  const [result] = await db
    .select()
    .from(whatsappSessions)
    .where(eq(whatsappSessions.id, id))
    .limit(1);
  return result;
}

export async function getWhatsappSessionBySessionId(sessionId: string) {
  const [result] = await db
    .select()
    .from(whatsappSessions)
    .where(eq(whatsappSessions.sessionId, sessionId))
    .limit(1);
  return result;
}

export async function getAllWhatsappSessions(userId?: string) {
  const query = db.select().from(whatsappSessions);
  
  if (userId) {
    return await query.where(eq(whatsappSessions.userId, userId)).orderBy(desc(whatsappSessions.createdAt));
  }
  
  return await query.orderBy(desc(whatsappSessions.createdAt));
}

// Busca a sessão WhatsApp conectada de um usuário específico
export async function getConnectedSessionByUserId(userId: string) {
  const [result] = await db
    .select()
    .from(whatsappSessions)
    .where(
      and(
        eq(whatsappSessions.userId, userId),
        eq(whatsappSessions.status, 'conectada'),
        eq(whatsappSessions.ativo, true)
      )
    )
    .limit(1);
  return result;
}

// ==================== WHATSAPP BROADCAST STORAGE ====================
export async function getBroadcastStats(filtros?: { status?: string; carteira?: string }) {
  let conditions = [];
  
  if (filtros?.status && filtros.status !== "") {
    conditions.push(eq(clients.status, filtros.status));
  }
  if (filtros?.carteira && filtros.carteira !== "") {
    conditions.push(ilike(clients.carteira, `%${filtros.carteira}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const allClientes = await db.select().from(clients);
  const filteredClientes = whereClause 
    ? await db.select().from(clients).where(whereClause)
    : allClientes;

  const comTelefone = filteredClientes.filter(
    (c) => c.celular || c.telefone2
  ).length;

  return {
    totalClientes: allClientes.length,
    filtrados: filteredClientes.length,
    comTelefone,
    pronto: comTelefone > 0,
  };
}

export async function getClientsForBroadcast(filtros?: { 
  status?: string; 
  carteira?: string; 
  userId?: string; 
  isAdmin?: boolean; 
  clientIds?: string[];
  tipos?: string[];
  carteiras?: string[];
  cidades?: string[];
}) {
  let conditions = [];
  
  // Se há clientIds específicos, usa apenas eles
  if (filtros?.clientIds && filtros.clientIds.length > 0) {
    conditions.push(inArray(clients.id, filtros.clientIds));
  }
  // Se não é admin, filtra apenas clientes do usuário
  else if (filtros?.userId && !filtros?.isAdmin) {
    conditions.push(
      or(
        eq(clients.createdBy, filtros.userId),
        sql`${clients.createdBy} IS NULL` // Também vê clientes sem proprietário definido
      )
    );
  }
  // Se é admin, não filtra - vê todos os clientes
  
  if (filtros?.status && filtros.status !== "") {
    conditions.push(eq(clients.status, filtros.status));
  }
  if (filtros?.carteira && filtros.carteira !== "") {
    conditions.push(ilike(clients.carteira, `%${filtros.carteira}%`));
  }
  
  // ✅ Filtros adicionais do frontend
  if (filtros?.tipos && filtros.tipos.length > 0) {
    conditions.push(inArray(clients.tipoCliente, filtros.tipos));
  }
  if (filtros?.carteiras && filtros.carteiras.length > 0) {
    conditions.push(inArray(clients.carteira, filtros.carteiras));
  }
  if (filtros?.cidades && filtros.cidades.length > 0) {
    conditions.push(inArray(clients.cidade, filtros.cidades));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  return await db.select().from(clients).where(whereClause);
}

// ==================== CHAT STORAGE ====================
export async function createOrGetConversation(clientId: string, userId: string): Promise<Conversation> {
  const [existing] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.clientId, clientId), eq(conversations.userId, userId)))
    .limit(1);
  
  if (existing) {
    console.log("📌 Conversa existente encontrada:", existing.id);
    return existing;
  }
  
  const [created] = await db
    .insert(conversations)
    .values({ clientId, userId, canal: "whatsapp", ativa: true, oculta: false })
    .returning();
  console.log("✨ Nova conversa criada:", created.id);
  return created;
}

export async function toggleConversationHidden(conversationId: string, userId: string, oculta: boolean): Promise<Conversation | null> {
  const [existing] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);
  
  if (!existing) {
    console.error("❌ Conversa não encontrada ou sem permissão:", conversationId);
    return null;
  }

  const [updated] = await db
    .update(conversations)
    .set({ oculta })
    .where(eq(conversations.id, conversationId))
    .returning();

  console.log(`🔐 Conversa ${oculta ? 'oculta' : 'reabrida'}: ${conversationId}`);
  return updated;
}

export async function getConversations(userId: string, showHidden: boolean = false): Promise<any[]> {
  // ✅ Get conversations with messages, ordered by latest message
  // Por padrão, filtra conversas ocultas (showHidden=false)
  const whereCondition = showHidden 
    ? eq(conversations.userId, userId)
    : and(eq(conversations.userId, userId), eq(conversations.oculta, false));
    
  const conversationsData = await db
    .select({
      id: conversations.id,
      clientId: conversations.clientId,
      userId: conversations.userId,
      canal: conversations.canal,
      assunto: conversations.assunto,
      ativa: conversations.ativa,
      oculta: conversations.oculta,
      naoLida: conversations.naoLida,
      ultimaMensagem: conversations.ultimaMensagem,
      ultimaMensagemEm: conversations.ultimaMensagemEm,
      createdAt: conversations.createdAt,
      client: {
        id: clients.id,
        nome: clients.nome,
        celular: clients.celular,
        telefone2: clients.telefone2,
        tags: clients.tags,
      }
    })
    .from(conversations)
    .leftJoin(clients, eq(conversations.clientId, clients.id))
    .where(whereCondition)
    .orderBy(desc(conversations.ultimaMensagemEm));

  // Filter to only show conversations with messages and add unread counts
  const withCounts = await Promise.all(
    conversationsData.map(async (row) => {
      // Count messages in this conversation
      const msgCount = await db
        .select({ count: count() })
        .from(messages)
        .where(eq(messages.conversationId, row.id));
      
      const hasMessages = Number(msgCount[0]?.count || 0) > 0;
      if (!hasMessages) return null;

      const unreadCount = await countUnreadMessages(row.id);
      return {
        ...row,
        unreadCount,
        client: row.client && row.client.id ? row.client : null
      };
    })
  );
  
  return withCounts.filter(Boolean);
}

export async function getMessages(conversationId: string, limit: number = 50): Promise<Message[]> {
  return await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      conteudo: messages.conteudo,
      sender: messages.sender,
      tipo: messages.tipo,
      arquivo: messages.arquivo,
      nomeArquivo: messages.nomeArquivo,
      tamanho: messages.tamanho,
      mimeType: messages.mimeType,
      lido: messages.lido,
      deletado: messages.deletado,
      createdAt: messages.createdAt,
      origem: messages.origem,  // ✅ Adicionado para retornar o campo "Enviado por IA"
      statusEntrega: messages.statusEntrega,  // ✅ Status de entrega (enviado, entregue, lido)
      whatsappMessageId: messages.whatsappMessageId,  // ✅ ID da mensagem no WhatsApp
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .limit(limit);
}

export async function createMessage(data: InsertMessage): Promise<Message> {
  console.log(`💾 Salvando mensagem: sender=${data.sender}, conteudo=${data.conteudo?.substring(0, 50)}, convId=${data.conversationId}`);
  
  const [created] = await db.insert(messages).values(data).returning();
  
  if (!created) {
    console.error(`❌ ERRO: createMessage não retornou mensagem!`);
    throw new Error("Failed to create message");
  }
  
  console.log(`✅ Mensagem salva no DB: ${created.id}`);
  
  // Update conversation last message
  if (created.conversationId) {
    await db
      .update(conversations)
      .set({
        ultimaMensagem: created.conteudo || `[${created.tipo.toUpperCase()}]`,
        ultimaMensagemEm: new Date(),
      })
      .where(eq(conversations.id, created.conversationId));
    
    console.log(`✅ Conversa atualizada: ${created.conversationId}`);
  }
  
  return created;
}

export async function findConversationByPhoneAndUser(telefone: string, userId: string): Promise<Conversation | undefined> {
  // Normalize phone to SEM 55 format (all clients in system are stored without 55)
  let normalizado = telefone.replace(/\D/g, "");
  
  // Remove 55 prefix if present
  if (normalizado.startsWith("55")) {
    normalizado = normalizado.substring(2);
  }
  
  console.log(`🔍 findConversationByPhoneAndUser: buscando por "${normalizado}"`);
  
  // Find client by phone number - search SEM 55 format across phone fields
  const [client] = await db
    .select()
    .from(clients)
    .where(or(
      eq(clients.celular, normalizado),
      eq(clients.telefone2, normalizado),
      ilike(clients.celular, `%${normalizado}%`),
      ilike(clients.telefone2, `%${normalizado}%`)
    ))
    .limit(1);
  
  if (!client) {
    console.log(`⚠️ Cliente não encontrado: "${normalizado}"`);
    return undefined;
  }
  
  console.log(`✅ Cliente encontrado: ${client.id} (${client.nome})`);
  
  // Find or create conversation
  return await createOrGetConversation(client.id, userId);
}

export async function markMessagesAsRead(conversationId: string): Promise<void> {
  await db
    .update(messages)
    .set({ lido: true })
    .where(and(
      eq(messages.conversationId, conversationId),
      eq(messages.sender, "client"),
      eq(messages.lido, false)
    ));
}

export async function countUnreadMessages(conversationId: string): Promise<number> {
  const result = await db
    .select({ count: sql`COUNT(*)` })
    .from(messages)
    .where(and(
      eq(messages.conversationId, conversationId),
      eq(messages.sender, "client"),
      eq(messages.lido, false)
    ));
  return result[0]?.count ? Number(result[0].count) : 0;
}

// ==================== NOTIFICATIONS STORAGE ====================
export async function createNotification(data: any): Promise<any> {
  const [result] = await db.insert(notifications).values(data).returning();
  return result;
}

export async function getNotificationsByUserId(userId: string): Promise<any[]> {
  return await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  const result = await db
    .select({ count: sql`COUNT(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.lida, false)));
  return result[0]?.count ? Number(result[0].count) : 0;
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ lida: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.lida, false)));
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ lida: true })
    .where(eq(notifications.id, notificationId));
}

// ==================== QUICK REPLIES STORAGE ====================
export async function getQuickRepliesByUserId(userId: string): Promise<QuickReply[]> {
  return await db
    .select()
    .from(quickReplies)
    .where(eq(quickReplies.userId, userId))
    .orderBy(asc(quickReplies.ordem), asc(quickReplies.createdAt));
}

export async function createQuickReply(data: InsertQuickReply): Promise<QuickReply> {
  const [result] = await db.insert(quickReplies).values(data).returning();
  return result;
}

export async function updateQuickReply(id: string, data: Partial<InsertQuickReply>): Promise<QuickReply | undefined> {
  const [result] = await db
    .update(quickReplies)
    .set(data)
    .where(eq(quickReplies.id, id))
    .returning();
  return result;
}

export async function deleteQuickReply(id: string): Promise<void> {
  await db.delete(quickReplies).where(eq(quickReplies.id, id));
}

// ==================== CLIENT NOTES STORAGE ====================
export async function getClientNotesByUserId(userId: string, clientId: string): Promise<ClientNote[]> {
  return await db
    .select()
    .from(clientNotes)
    .where(and(eq(clientNotes.userId, userId), eq(clientNotes.clientId, clientId)))
    .orderBy(desc(clientNotes.createdAt));
}

export async function createClientNote(data: InsertClientNote): Promise<ClientNote> {
  const [result] = await db.insert(clientNotes).values(data).returning();
  return result;
}

export async function updateClientNote(id: string, data: Partial<InsertClientNote>): Promise<ClientNote | undefined> {
  const [result] = await db
    .update(clientNotes)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(clientNotes.id, id))
    .returning();
  return result;
}

export async function deleteClientNote(id: string): Promise<void> {
  await db.delete(clientNotes).where(eq(clientNotes.id, id));
}

// ==================== TAGS STORAGE ====================
export async function createTag(data: InsertTag): Promise<Tag> {
  const [result] = await db.insert(tags).values(data).returning();
  return result;
}

export async function getTags(userId: string): Promise<Tag[]> {
  return await db.select().from(tags).where(eq(tags.createdBy, userId)).orderBy(asc(tags.nome));
}

export async function updateTag(id: string, data: Partial<InsertTag>): Promise<Tag | undefined> {
  const [result] = await db
    .update(tags)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tags.id, id))
    .returning();
  return result;
}

export async function deleteTag(id: string): Promise<void> {
  await db.delete(tags).where(eq(tags.id, id));
}

// Count unread RECEIVED messages for a specific user
export async function countAllUnreadMessages(userId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(
      eq(conversations.userId, userId),
      eq(messages.sender, "client"),
      eq(messages.lido, false)
    ));
  return result[0]?.count ? Number(result[0].count) : 0;
}

// Set tag to client (only one tag per client - replaces existing)
export async function addTagToClient(clientId: string, tagName: string): Promise<Client | undefined> {
  const client = await getClientById(clientId);
  if (!client) return undefined;
  
  // Only one tag per client - replace existing with new tag
  return updateClient(clientId, { tags: [tagName] });
}

// Remove tag from client
export async function removeTagFromClient(clientId: string, tagName: string): Promise<Client | undefined> {
  const client = await getClientById(clientId);
  if (!client) return undefined;
  
  // Remove the tag (set to empty array)
  if (client.tags?.[0] === tagName) {
    return updateClient(clientId, { tags: [] });
  }
  
  return client;
}

// ==================== CLIENT SHARING STORAGE ====================
export async function shareClientWithUser(data: InsertClientSharing): Promise<ClientSharing> {
  const [result] = await db.insert(clientSharing).values(data).returning();
  return result;
}

export async function unshareClientWithUser(clientId: string, sharedWithUserId: string): Promise<void> {
  await db.delete(clientSharing).where(
    and(eq(clientSharing.clientId, clientId), eq(clientSharing.sharedWithUserId, sharedWithUserId))
  );
}

export async function getClientSharings(clientId: string): Promise<ClientSharing[]> {
  return await db
    .select()
    .from(clientSharing)
    .where(eq(clientSharing.clientId, clientId));
}

export async function getSharedClientsForUser(userId: string): Promise<ClientSharing[]> {
  return await db
    .select()
    .from(clientSharing)
    .where(eq(clientSharing.sharedWithUserId, userId));
}

// Check if user can access a client (owner or shared)
// Returns { canAccess, permissao }
export async function checkClientAccess(clientId: string, userId: string): Promise<{ canAccess: boolean; permissao: string }> {
  // Check if user is the owner
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.createdBy, userId)))
    .limit(1);

  if (client) {
    return { canAccess: true, permissao: "proprietario" };
  }

  // Check if client is shared with user
  const [sharing] = await db
    .select()
    .from(clientSharing)
    .where(and(eq(clientSharing.clientId, clientId), eq(clientSharing.sharedWithUserId, userId)))
    .limit(1);

  if (sharing) {
    return { canAccess: true, permissao: sharing.permissao };
  }

  return { canAccess: false, permissao: "" };
}

// Share multiple clients with a user
export async function shareClientsWithUser(clientIds: string[], sharedWithUserId: string, ownerId: string): Promise<ClientSharing[]> {
  const sharings = clientIds.map(clientId => ({
    clientId,
    ownerId,
    sharedWithUserId,
    permissao: "editar",
  }));
  
  return await db.insert(clientSharing).values(sharings).returning();
}

// ==================== CAMPAIGN SENDINGS STORAGE ====================
export async function recordCampaignSending(data: InsertCampaignSending): Promise<CampaignSending> {
  // ✅ UPSERT com prioridade - só atualiza se status for >= ao existente
  // Prioridade: erro(1) < enviado(2) < entregue(3) < lido(4)
  // O índice único (campaignId, clientId) garante não haver duplicatas
  
  const newStatus = data.status || 'erro';
  const getPriority = (status: string) => {
    const priorities: Record<string, number> = { erro: 1, enviado: 2, entregue: 3, lido: 4 };
    return priorities[status] || 0;
  };
  const newPriority = getPriority(newStatus);
  
  // ✅ Todas as atualizações condicionadas à mesma regra de prioridade
  // Se novo status tem prioridade < existente, NÃO atualiza NADA (preserva sucesso)
  const [result] = await db
    .insert(campaignSendings)
    .values(data)
    .onConflictDoUpdate({
      target: [campaignSendings.campaignId, campaignSendings.clientId],
      set: {
        // Status: só atualiza se novo >= existente
        status: sql`
          CASE WHEN ${newPriority} >= (
            CASE ${campaignSendings.status}
              WHEN 'erro' THEN 1 
              WHEN 'enviado' THEN 2 
              WHEN 'entregue' THEN 3 
              WHEN 'lido' THEN 4 
              ELSE 0 
            END
          ) THEN ${newStatus}
          ELSE ${campaignSendings.status}
          END
        `,
        // erroMensagem: só atualiza se status avançar
        erroMensagem: sql`
          CASE WHEN ${newPriority} >= (
            CASE ${campaignSendings.status}
              WHEN 'erro' THEN 1 
              WHEN 'enviado' THEN 2 
              WHEN 'entregue' THEN 3 
              WHEN 'lido' THEN 4 
              ELSE 0 
            END
          ) THEN ${newStatus === 'erro' ? (data.erroMensagem || null) : null}
          ELSE ${campaignSendings.erroMensagem}
          END
        `,
        // dataSending: só atualiza se status avançar
        dataSending: sql`
          CASE WHEN ${newPriority} >= (
            CASE ${campaignSendings.status}
              WHEN 'erro' THEN 1 
              WHEN 'enviado' THEN 2 
              WHEN 'entregue' THEN 3 
              WHEN 'lido' THEN 4 
              ELSE 0 
            END
          ) THEN NOW()
          ELSE ${campaignSendings.dataSending}
          END
        `,
        // origemDisparo: só atualiza se status avançar
        origemDisparo: sql`
          CASE WHEN ${newPriority} >= (
            CASE ${campaignSendings.status}
              WHEN 'erro' THEN 1 
              WHEN 'enviado' THEN 2 
              WHEN 'entregue' THEN 3 
              WHEN 'lido' THEN 4 
              ELSE 0 
            END
          ) THEN COALESCE(${data.origemDisparo || null}, ${campaignSendings.origemDisparo})
          ELSE ${campaignSendings.origemDisparo}
          END
        `,
        // mensagemUsada: só atualiza se status avançar
        mensagemUsada: sql`
          CASE WHEN ${newPriority} >= (
            CASE ${campaignSendings.status}
              WHEN 'erro' THEN 1 
              WHEN 'enviado' THEN 2 
              WHEN 'entregue' THEN 3 
              WHEN 'lido' THEN 4 
              ELSE 0 
            END
          ) THEN COALESCE(${data.mensagemUsada || null}, ${campaignSendings.mensagemUsada})
          ELSE ${campaignSendings.mensagemUsada}
          END
        `,
        // whatsappMessageId: SEMPRE atualiza se tiver valor (fundamental para rastreamento)
        whatsappMessageId: sql`COALESCE(${data.whatsappMessageId ?? null}, ${campaignSendings.whatsappMessageId})`,
        // statusWhatsapp: só atualiza se novo status >= existente
        statusWhatsapp: sql`
          CASE WHEN ${newPriority} >= (
            CASE ${campaignSendings.status}
              WHEN 'erro' THEN 1 
              WHEN 'enviado' THEN 2 
              WHEN 'entregue' THEN 3 
              WHEN 'lido' THEN 4 
              ELSE 0 
            END
          ) THEN COALESCE(${data.statusWhatsapp ?? null}, ${campaignSendings.statusWhatsapp})
          ELSE ${campaignSendings.statusWhatsapp}
          END
        `,
        // estadoDerivado: só atualiza se novo status >= existente
        estadoDerivado: sql`
          CASE WHEN ${newPriority} >= (
            CASE ${campaignSendings.status}
              WHEN 'erro' THEN 1 
              WHEN 'enviado' THEN 2 
              WHEN 'entregue' THEN 3 
              WHEN 'lido' THEN 4 
              ELSE 0 
            END
          ) THEN COALESCE(${data.estadoDerivado ?? null}, ${campaignSendings.estadoDerivado})
          ELSE ${campaignSendings.estadoDerivado}
          END
        `,
      },
    })
    .returning();
  
  return result;
}

export async function recordMultipleCampaignSendings(records: InsertCampaignSending[]): Promise<CampaignSending[]> {
  if (records.length === 0) return [];
  return await db.insert(campaignSendings).values(records).returning();
}

export async function getCampaignSendingHistory(userId: string, clientId: string): Promise<CampaignSending[]> {
  return await db
    .select()
    .from(campaignSendings)
    .where(and(eq(campaignSendings.userId, userId), eq(campaignSendings.clientId, clientId)))
    .orderBy(desc(campaignSendings.dataSending));
}

// ==================== CAMPAIGN GROUPS STORAGE ====================
export async function createCampaignGroup(data: InsertCampaignGroup): Promise<CampaignGroup> {
  const [result] = await db.insert(campaignGroups).values(data).returning();
  return result;
}

export async function getCampaignGroups(userId: string): Promise<CampaignGroup[]> {
  return await db
    .select()
    .from(campaignGroups)
    .where(eq(campaignGroups.userId, userId));
}

export async function getCampaignGroupById(id: string, userId: string): Promise<CampaignGroup | undefined> {
  const [result] = await db
    .select()
    .from(campaignGroups)
    .where(and(eq(campaignGroups.id, id), eq(campaignGroups.userId, userId)))
    .limit(1);
  return result;
}

export async function updateCampaignGroup(id: string, userId: string, data: Partial<InsertCampaignGroup>): Promise<CampaignGroup | undefined> {
  const [result] = await db
    .update(campaignGroups)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(campaignGroups.id, id), eq(campaignGroups.userId, userId)))
    .returning();
  return result;
}

export async function deleteCampaignGroup(id: string, userId: string): Promise<void> {
  await db.delete(campaignGroups).where(and(eq(campaignGroups.id, id), eq(campaignGroups.userId, userId)));
}

// ==================== KANBAN STAGES STORAGE ====================
export async function getAllKanbanStages(): Promise<KanbanStage[]> {
  // Check if stages already exist
  const existingStages = await db.select().from(kanbanStages).orderBy(asc(kanbanStages.ordem));
  
  if (existingStages.length === 0) {
    // Lazy initialize with 10 stages
    const defaultStages = [
      { ordem: 0, titulo: "LEAD", descricao: "Leads iniciais" },
      { ordem: 1, titulo: "CONTATO", descricao: "Em contato com cliente" },
      { ordem: 2, titulo: "PROPOSTA", descricao: "Proposta enviada" },
      { ordem: 3, titulo: "PROPOSTA ENVIADA", descricao: "Aguardando resposta" },
      { ordem: 4, titulo: "CONTRATO ENVIADO", descricao: "Contrato enviado ao cliente" },
      { ordem: 5, titulo: "AGUARDANDO CONTRATO", descricao: "Assinatura de contrato" },
      { ordem: 6, titulo: "AGUARDANDO ACEITE", descricao: "Aguardando aceitação" },
      { ordem: 7, titulo: "FECHADO", descricao: "Negócio fechado" },
      { ordem: 8, titulo: "PERDIDO", descricao: "Negócio perdido" },
      { ordem: 9, titulo: "AUTOMÁTICA", descricao: "Resposta automática do sistema" },
    ];
    
    console.log("📋 Inicializando 10 etapas do Kanban...");
    const inserted = await db.insert(kanbanStages).values(defaultStages).returning();
    return inserted;
  }
  
  return existingStages;
}

export async function createKanbanStage(data: InsertKanbanStage): Promise<KanbanStage> {
  const [result] = await db.insert(kanbanStages).values(data).returning();
  return result;
}

export async function updateKanbanStage(id: string, data: Partial<InsertKanbanStage>): Promise<KanbanStage | undefined> {
  const [result] = await db
    .update(kanbanStages)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(kanbanStages.id, id))
    .returning();
  return result;
}

export async function deleteKanbanStage(id: string): Promise<void> {
  await db.delete(kanbanStages).where(eq(kanbanStages.id, id));
}

// ==================== RECORD ETAPA CHANGE ====================
/**
 * Registra na timeline quando uma oportunidade muda de etapa
 * Indica se foi manual (usuário), automática (IA), ou sistema
 */
export async function recordEtapaChange(
  opportunityId: string,
  clientId: string,
  etapaAnterior: string,
  etapaNova: string,
  tipo: "manual" | "ia" | "sistema",
  userId?: string
): Promise<void> {
  try {
    console.log(`📝 [TIMELINE] Iniciando registro: ${etapaAnterior} → ${etapaNova} (${tipo})`);
    console.log(`   ClientID: ${clientId}, OppID: ${opportunityId}, UserID: ${userId}`);

    const tipoInteracao = "etapa_mudou";
    const origem = tipo === "ia" ? "ia" : tipo === "sistema" ? "sistema" : "usuario";
    const titulo = tipo === "ia" 
      ? `Etapa alterada pela IA: ${etapaAnterior} → ${etapaNova}`
      : tipo === "sistema"
      ? `Etapa alterada pelo sistema: ${etapaAnterior} → ${etapaNova}`
      : `Etapa alterada manualmente: ${etapaAnterior} → ${etapaNova}`;

    const insertData = {
      clientId,
      tipo: tipoInteracao,
      origem,
      titulo,
      texto: `Mudança de etapa registrada automaticamente`,
      meta: {
        opportunityId,
        etapa_anterior: etapaAnterior,
        etapa_nova: etapaNova,
        tipo_movimento: tipo === "manual" ? "manual (usuário)" : tipo === "ia" ? "automática (IA)" : "automática (sistema)",
      },
      createdBy: userId || null,
    };

    console.log(`📝 [TIMELINE] Inserindo dados:`, JSON.stringify(insertData, null, 2));

    const result = await db.insert(interactions).values(insertData).returning();
    
    console.log(`✅ [TIMELINE] Registrada com sucesso! ID: ${result[0]?.id}`);
  } catch (error: any) {
    console.error(`❌ [TIMELINE] ERRO ao registrar:`, error?.message || error);
    console.error(`❌ [TIMELINE] Stack:`, error?.stack);
  }
}

// ==================== CLIENT STATUS AUTOMATION ====================
/**
 * Calcula o status do cliente baseado nas oportunidades dele
 * Regra: Status reflete a etapa mais avançada, exceto FECHADO (sempre manual) e PERDIDO (só se todas forem perdidas)
 * Ordem de prioridade (menor número = mais avançado):
 * FECHADO → AGUARDANDO ACEITE → CONTRATO ENVIADO → AGUARDANDO CONTRATO → AGUARDANDO ATENÇÃO →
 * PROPOSTA ENVIADA → PROPOSTA → AUTOMÁTICA → CONTATO → LEAD → REMARKETING
 */
export async function recalculateClientStatus(clientId: string): Promise<string> {
  // Buscar todas as oportunidades do cliente
  const clientOpportunities = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.clientId, clientId));

  // Se não tem oportunidades → Lead quente
  if (clientOpportunities.length === 0) {
    return "lead_quente";
  }

  // Se existe pelo menos 1 FECHADO → Ativo (100% manual, sempre prioridade máxima)
  if (clientOpportunities.some((opp) => opp.etapa === "FECHADO")) {
    return "ativo";
  }

  // Filtrar oportunidades ativas (não PERDIDAS)
  const activeOpps = clientOpportunities.filter((opp) => opp.etapa !== "PERDIDO");

  // Se todas são PERDIDAS → Perdido
  if (activeOpps.length === 0) {
    return "perdido";
  }

  // REMARKETING: Se tem oportunidades ativas MAS também tem oportunidades PERDIDAS
  // Significa que o cliente voltou com interesse após rejeição
  const hasLostOpps = clientOpportunities.some((opp) => opp.etapa === "PERDIDO");
  if (hasLostOpps && activeOpps.length > 0) {
    // Se a oportunidade ativa é em LEAD/CONTATO, é REMARKETING puro
    const isRemarketingStage = activeOpps.some((opp) => 
      opp.etapa === "LEAD" || opp.etapa === "CONTATO" || opp.etapa === "AUTOMÁTICA"
    );
    if (isRemarketingStage) {
      return "remarketing";
    }
  }

  // Ordem de prioridade (menor número = mais avançado)
  const stagePriority: Record<string, number> = {
    FECHADO: 0,                    // Manual - sempre máxima prioridade
    "AGUARDANDO ACEITE": 1,        // Manual + IA (lembretes)
    "AGUARDANDO ATENÇÃO": 2,       // Manual - reciclagem de AGUARDANDO ACEITE
    "CONTRATO ENVIADO": 3,         // Manual
    "AGUARDANDO CONTRATO": 4,      // Manual
    "PROPOSTA ENVIADA": 5,         // Manual + IA (lembretes)
    PROPOSTA: 6,                   // IA + Manual
    AUTOMÁTICA: 7,                 // IA (mensagens automáticas)
    CONTATO: 8,                    // IA + Manual
    LEAD: 9,                       // Manual - início da prospecção
  };

  // Encontrar a oportunidade com menor prioridade (mais avançada)
  let mostAdvancedOpp = activeOpps[0];
  let minPriority = stagePriority[mostAdvancedOpp.etapa] ?? 999;

  for (const opp of activeOpps) {
    const priority = stagePriority[opp.etapa] ?? 999;
    if (priority < minPriority) {
      minPriority = priority;
      mostAdvancedOpp = opp;
    }
  }

  // Mapear etapa → status cliente conforme regras de negócio
  const stageToStatus: Record<string, string> = {
    LEAD: "lead_quente",                      // Manual
    CONTATO: "engajado",                      // IA + Manual
    AUTOMÁTICA: "engajado",                   // IA (mensagens automáticas)
    PROPOSTA: "em_negociacao",                // IA + Manual
    "PROPOSTA ENVIADA": "em_negociacao",      // Manual + IA (lembretes)
    "AGUARDANDO CONTRATO": "em_fechamento",   // Manual
    "CONTRATO ENVIADO": "em_fechamento",      // Manual
    "AGUARDANDO ACEITE": "em_fechamento",     // Manual + IA (lembretes)
    "AGUARDANDO ATENÇÃO": "em_fechamento",    // Manual (reciclagem)
    FECHADO: "ativo",                         // Manual
    PERDIDO: "perdido",                       // IA + Manual
  };

  return stageToStatus[mostAdvancedOpp.etapa] || "ativo";
}

export async function getOpportunitiesByClientId(clientId: string): Promise<Opportunity[]> {
  return await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.clientId, clientId));
}

// ✅ HELPER: Buscar oportunidade ABERTA do cliente para um usuário específico
// Retorna a oportunidade aberta do vendedor atual, ou null se não houver
// - Cada vendedor só vê/atualiza suas próprias oportunidades
// - FECHADO e PERDIDO são considerados "fechados" (ignorados)
export async function getOpenOpportunityForClient(clientId: string, userId?: string): Promise<Opportunity | null> {
  const ETAPAS_FECHADAS = ["FECHADO", "PERDIDO"];
  
  const allOpps = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.clientId, clientId));
  
  // Filtrar apenas oportunidades ABERTAS (não FECHADO nem PERDIDO)
  let openOpps = allOpps.filter(opp => !ETAPAS_FECHADAS.includes(opp.etapa));
  
  // Se userId fornecido, filtrar por responsável
  if (userId) {
    openOpps = openOpps.filter(opp => opp.responsavelId === userId);
  }
  
  if (openOpps.length === 0) {
    return null;
  }
  
  // Retornar a mais recente (ou a primeira encontrada)
  return openOpps[0];
}
