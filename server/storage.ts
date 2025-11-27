import { db } from "./db";
import { eq, and, desc, asc, sql, ilike, or, inArray } from "drizzle-orm";
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
  tagId?: string;
  page?: number;
  limit?: number;
  userId?: string;
  isAdmin?: boolean;
}): Promise<{ clientes: Client[]; total: number }> {
  const { search, status, tagId, page = 1, limit = 20, userId, isAdmin = false } = params;
  const offset = (page - 1) * limit;

  let conditions = [];
  
  // Se não é admin, filtra apenas clientes do usuário
  if (userId && !isAdmin) {
    conditions.push(
      or(
        eq(clients.createdBy, userId),
        sql`${clients.createdBy} IS NULL` // Também vê clientes sem proprietário definido
      )
    );
  }
  // Se é admin, não filtra - vê todos os clientes
  
  if (search) {
    conditions.push(
      or(
        ilike(clients.nome, `%${search}%`),
        ilike(clients.razaoSocial, `%${search}%`),
        ilike(clients.cpfCnpj, `%${search}%`)
      )
    );
  }
  if (status && status !== "todos") {
    conditions.push(eq(clients.status, status));
  }
  if (tagId) {
    conditions.push(sql`${clients.tags}::text[] @> ARRAY[${tagId}]`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [clientes, totalResult] = await Promise.all([
    db
      .select()
      .from(clients)
      .where(whereClause)
      .orderBy(desc(clients.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(clients)
      .where(whereClause),
  ]);

  return {
    clientes,
    total: totalResult[0]?.count || 0,
  };
}

export async function deleteClient(id: string): Promise<void> {
  await db.delete(clients).where(eq(clients.id, id));
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
  return result;
}

export async function getOpportunities(params: {
  responsavel?: string;
  etapa?: string;
}): Promise<Opportunity[]> {
  let conditions = [];
  if (params.responsavel && params.responsavel !== "todos") {
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
    .orderBy(opportunities.ordem, desc(opportunities.createdAt));
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
  await db.delete(opportunities).where(eq(opportunities.id, id));
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

export async function getTimelineByClientId(clientId: string): Promise<Interaction[]> {
  return await db
    .select()
    .from(interactions)
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
  const [clientStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      ativos: sql<number>`count(*) FILTER (WHERE status = 'ativo')::int`,
    })
    .from(clients);

  const [opportunityCount] = await db
    .select({
      total: sql<number>`count(*)::int`,
    })
    .from(opportunities);

  const [campaignStats] = await db
    .select({
      ativas: sql<number>`count(*) FILTER (WHERE status IN ('agendada', 'enviando'))::int`,
    })
    .from(campaigns);

  return {
    totalClientes: clientStats?.total || 0,
    clientesAtivos: clientStats?.ativos || 0,
    oportunidades: opportunityCount?.total || 0,
    campanhasAtivas: campaignStats?.ativas || 0,
    taxaConversao: 21.5,
    tendenciaClientes: 12.5,
  };
}

export async function getFunnelData() {
  const results = await db
    .select({
      etapa: opportunities.etapa,
      count: sql<number>`count(*)::int`,
    })
    .from(opportunities)
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

export async function getStatusDistribution() {
  const results = await db
    .select({
      status: clients.status,
      count: sql<number>`count(*)::int`,
    })
    .from(clients)
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
    (c) => c.CELULAR_PRINCIPAL || c.telefone
  ).length;

  return {
    totalClientes: allClientes.length,
    filtrados: filteredClientes.length,
    comTelefone,
    pronto: comTelefone > 0,
  };
}

export async function getClientsForBroadcast(filtros?: { status?: string; carteira?: string; userId?: string; isAdmin?: boolean }) {
  let conditions = [];
  
  // Se não é admin, filtra apenas clientes do usuário
  if (filtros?.userId && !filtros?.isAdmin) {
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
    .values({ clientId, userId, canal: "whatsapp", ativa: true })
    .returning();
  console.log("✨ Nova conversa criada:", created.id);
  return created;
}

export async function getConversations(userId: string): Promise<any[]> {
  const result = await db
    .select({
      id: conversations.id,
      clientId: conversations.clientId,
      userId: conversations.userId,
      canal: conversations.canal,
      assunto: conversations.assunto,
      ativa: conversations.ativa,
      ultimaMensagem: conversations.ultimaMensagem,
      ultimaMensagemEm: conversations.ultimaMensagemEm,
      createdAt: conversations.createdAt,
      client: {
        id: clients.id,
        nome: clients.nome,
        razaoSocial: clients.razaoSocial,
        CELULAR_PRINCIPAL: clients.CELULAR_PRINCIPAL,
        telefone: clients.telefone,
        tags: clients.tags,
      }
    })
    .from(conversations)
    .leftJoin(clients, eq(conversations.clientId, clients.id))
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.ultimaMensagemEm));
  
  // Add unread message counts
  const withCounts = await Promise.all(result.map(async (row) => {
    const unreadCount = await countUnreadMessages(row.id);
    return {
      ...row,
      unreadCount,
      client: row.client && row.client.id ? row.client : null
    };
  }));
  
  return withCounts;
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
      createdAt: messages.createdAt,
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
  // Normalize phone number
  let normalizado = telefone.replace(/\D/g, "");
  if (normalizado.startsWith("55")) {
    normalizado = normalizado.substring(2);
  }
  
  // Find client by phone number
  const [client] = await db
    .select()
    .from(clients)
    .where(or(
      ilike(clients.CELULAR_PRINCIPAL, `%${normalizado}%`),
      ilike(clients.telefone, `%${normalizado}%`)
    ))
    .limit(1);
  
  if (!client) return undefined;
  
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
