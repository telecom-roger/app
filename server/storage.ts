import { db } from "./db";
import { eq, and, desc, sql, ilike, or, inArray } from "drizzle-orm";
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
  page?: number;
  limit?: number;
}): Promise<{ clientes: Client[]; total: number }> {
  const { search, status, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  let conditions = [];
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

export async function getClientsForBroadcast(filtros?: { status?: string; carteira?: string }) {
  let conditions = [];
  
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
      assunto: conversations.assunto,
      ativa: conversations.ativa,
      ultimaMensagem: conversations.ultimaMensagem,
      ultimaMensagemEm: conversations.ultimaMensagemEm,
      createdAt: conversations.createdAt,
      clientNome: clients.nome,
      razaoSocial: clients.razaoSocial,
    })
    .from(conversations)
    .leftJoin(clients, eq(conversations.clientId, clients.id))
    .where(eq(conversations.userId, userId));
  return result;
}

export async function getMessages(conversationId: string, limit: number = 50): Promise<Message[]> {
  return await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
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
