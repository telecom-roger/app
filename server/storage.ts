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
  return await db.select().from(users).orderBy(users.createdAt.desc());
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
  const [client] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return client;
}

export async function deleteClient(id: string): Promise<void> {
  await db.delete(clients).where(eq(clients.id, id));
}

export async function getClients(params: {
  search?: string;
  status?: string;
  tagName?: string;
  page?: number;
  limit?: number;
  userId?: string;
  isAdmin?: boolean;
}): Promise<{ clientes: Client[]; total: number }> {
  let query = db.select().from(clients);

  if (params.search) {
    query = query.where(
      or(
        ilike(clients.nome, `%${params.search}%`),
        ilike(clients.razaoSocial, `%${params.search}%`),
        ilike(clients.email, `%${params.search}%`),
        ilike(clients.telefone, `%${params.search}%`)
      )
    );
  }

  if (params.status) {
    query = query.where(eq(clients.status, params.status));
  }

  if (params.tagName && !params.isAdmin) {
    query = query.where(sql`clients.tags @> ARRAY[${params.tagName}]`);
  }

  query = query.orderBy(clients.createdAt.desc());

  const total = await db.select({ count: sql<number>`count(*)` }).from(clients).then(r => r[0]?.count || 0);

  const offset = ((params.page || 1) - 1) * (params.limit || 10);
  const limit = params.limit || 10;

  const clientes = await query.offset(offset).limit(limit);
  return { clientes, total };
}

// ==================== OPPORTUNITY STORAGE ====================
export async function createOpportunity(data: InsertOpportunity): Promise<Opportunity> {
  const [result] = await db.insert(opportunities).values(data).returning();
  return result;
}

export async function getOpportunityById(id: string): Promise<Opportunity | undefined> {
  const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1);
  return opp;
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

export async function deleteOpportunity(id: string): Promise<void> {
  await db.delete(opportunities).where(eq(opportunities.id, id));
}

export async function getOpportunities(params: {
  responsavel?: string;
  etapa?: string;
}): Promise<Opportunity[]> {
  let query = db.select().from(opportunities);

  if (params.responsavel && params.responsavel !== "todos") {
    query = query.where(eq(opportunities.responsavelId, params.responsavel));
  }

  if (params.etapa) {
    query = query.where(eq(opportunities.etapa, params.etapa));
  }

  return await query.orderBy(asc(opportunities.ordem));
}

// ==================== CAMPAIGN STORAGE ====================
export async function createCampaign(data: InsertCampaign): Promise<Campaign> {
  const [result] = await db.insert(campaigns).values(data).returning();
  return result;
}

export async function getCampaigns(): Promise<Campaign[]> {
  return await db.select().from(campaigns).orderBy(campaigns.createdAt.desc());
}

export async function getCampaignById(id: string): Promise<Campaign | undefined> {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return campaign;
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

export async function deleteCampaign(id: string): Promise<void> {
  await db.delete(campaigns).where(eq(campaigns.id, id));
}

// ==================== TEMPLATE STORAGE ====================
export async function createTemplate(data: InsertTemplate): Promise<Template> {
  const [result] = await db.insert(templates).values(data).returning();
  return result;
}

export async function getTemplates(): Promise<Template[]> {
  return await db.select().from(templates).orderBy(templates.createdAt.desc());
}

export async function getTemplateById(id: string): Promise<Template | undefined> {
  const [template] = await db.select().from(templates).where(eq(templates.id, id)).limit(1);
  return template;
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

// ==================== INTERACTION STORAGE ====================
export async function createInteraction(data: InsertInteraction): Promise<Interaction> {
  const [result] = await db.insert(interactions).values(data).returning();
  return result;
}

export async function getInteractionsByClientId(clientId: string): Promise<Interaction[]> {
  return await db
    .select()
    .from(interactions)
    .where(eq(interactions.clientId, clientId))
    .orderBy(interactions.createdAt.desc());
}

// ==================== CONTACT STORAGE ====================
export async function createContact(data: InsertContact): Promise<Contact> {
  const [result] = await db.insert(contacts).values(data).returning();
  return result;
}

export async function getContactsByClientId(clientId: string): Promise<Contact[]> {
  return await db.select().from(contacts).where(eq(contacts.clientId, clientId));
}

export async function getContactById(id: string): Promise<Contact | undefined> {
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return contact;
}

export async function updateContact(
  id: string,
  data: Partial<InsertContact>
): Promise<Contact | undefined> {
  const [result] = await db
    .update(contacts)
    .set(data)
    .where(eq(contacts.id, id))
    .returning();
  return result;
}

export async function deleteContact(id: string): Promise<void> {
  await db.delete(contacts).where(eq(contacts.id, id));
}

// ==================== AUDIT LOG STORAGE ====================
export async function createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
  const [result] = await db.insert(auditLogs).values(data).returning();
  return result;
}

// ==================== WHATSAPP SESSIONS ====================
export async function createWhatsAppSession(data: any): Promise<any> {
  const [result] = await db.insert(whatsappSessions).values(data).returning();
  return result;
}

export async function getWhatsAppSessions(): Promise<any[]> {
  return await db.select().from(whatsappSessions).orderBy(whatsappSessions.createdAt.desc());
}

export async function getAllWhatsappSessions(userIdFilter?: string): Promise<any[]> {
  let query = db.select().from(whatsappSessions);
  if (userIdFilter) {
    query = query.where(eq(whatsappSessions.userId, userIdFilter));
  }
  return await query.orderBy(whatsappSessions.createdAt.desc());
}

export async function getWhatsappSessionById(id: string): Promise<any | undefined> {
  const [result] = await db.select().from(whatsappSessions).where(eq(whatsappSessions.id, id)).limit(1);
  return result;
}

export async function updateWhatsAppSession(id: string, data: any): Promise<any | undefined> {
  const [result] = await db
    .update(whatsappSessions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(whatsappSessions.id, id))
    .returning();
  return result;
}

export async function updateWhatsappSession(id: string, data: any): Promise<any | undefined> {
  return updateWhatsAppSession(id, data);
}

export async function deleteWhatsAppSession(id: string): Promise<void> {
  await db.delete(whatsappSessions).where(eq(whatsappSessions.id, id));
}

export async function deleteWhatsappSession(id: string): Promise<void> {
  return deleteWhatsAppSession(id);
}

// ==================== CONVERSATION STORAGE ====================
export async function createConversation(data: InsertConversation): Promise<Conversation> {
  const [result] = await db.insert(conversations).values(data).returning();
  return result;
}

export async function getConversations(): Promise<Conversation[]> {
  return await db
    .select()
    .from(conversations)
    .orderBy(conversations.updatedAt.desc());
}

export async function getConversationById(id: string): Promise<Conversation | undefined> {
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  return conv;
}

export async function findConversationByPhoneAndUser(telefone: string, userId: string): Promise<Conversation | undefined> {
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.telefone, telefone), eq(conversations.userId, userId)))
    .limit(1);
  return conv;
}

export async function createOrGetConversation(clientIdOrData: string | InsertConversation, userId?: string): Promise<Conversation> {
  // Handle both old (clientId, userId) and new (InsertConversation) signatures
  let data: InsertConversation;
  if (typeof clientIdOrData === 'string' && userId) {
    // Old signature: createOrGetConversation(clientId, userId)
    const client = await getClientById(clientIdOrData);
    if (!client) throw new Error("Client not found");
    data = {
      clientId: clientIdOrData,
      userId,
      telefone: client.telefone || client.CELULAR_PRINCIPAL || "",
    } as InsertConversation;
  } else {
    // New signature: createOrGetConversation(InsertConversation)
    data = clientIdOrData as InsertConversation;
  }
  
  const existing = await findConversationByPhoneAndUser(data.telefone, data.userId);
  if (existing) return existing;
  return createConversation(data);
}

export async function updateConversation(
  id: string,
  data: Partial<InsertConversation>
): Promise<Conversation | undefined> {
  const [result] = await db
    .update(conversations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(conversations.id, id))
    .returning();
  return result;
}

// ==================== MESSAGE STORAGE ====================
export async function createMessage(data: InsertMessage): Promise<Message> {
  const [result] = await db.insert(messages).values(data).returning();
  return result;
}

export async function getMessagesByConversationId(conversationId: string): Promise<Message[]> {
  return await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));
}

export async function markMessagesAsRead(conversationId: string): Promise<void> {
  await db
    .update(messages)
    .set({ lido: true })
    .where(and(eq(messages.conversationId, conversationId), eq(messages.sender, "client")));
}

// ==================== QUICK REPLIES ====================
export async function createQuickReply(data: InsertQuickReply): Promise<QuickReply> {
  const [result] = await db.insert(quickReplies).values(data).returning();
  return result;
}

export async function getQuickReplies(userId: string): Promise<QuickReply[]> {
  return await db
    .select()
    .from(quickReplies)
    .where(eq(quickReplies.userId, userId))
    .orderBy(asc(quickReplies.ordem));
}

export async function getQuickRepliesByUserId(userId: string): Promise<QuickReply[]> {
  return getQuickReplies(userId);
}

export async function updateQuickReply(id: string, data: Partial<QuickReply>): Promise<QuickReply | undefined> {
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

// ==================== CLIENT NOTES ====================
export async function createClientNote(data: InsertClientNote): Promise<ClientNote> {
  const [result] = await db.insert(clientNotes).values(data).returning();
  return result;
}

export async function getClientNotes(clientId: string): Promise<ClientNote[]> {
  return await db
    .select()
    .from(clientNotes)
    .where(eq(clientNotes.clientId, clientId))
    .orderBy(clientNotes.createdAt.desc());
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
  return updateClient(clientId, { tags: [] });
}

// ==================== DASHBOARD STATS ====================
export async function getDashboardStats(userId: string): Promise<any> {
  const totalClients = await db.select({ count: sql<number>`count(*)` }).from(clients).then(r => r[0]?.count || 0);
  const totalOpportunities = await db.select({ count: sql<number>`count(*)` }).from(opportunities).then(r => r[0]?.count || 0);
  const closedOpportunities = await db.select({ count: sql<number>`count(*)` }).from(opportunities).where(eq(opportunities.etapa, 'fechado')).then(r => r[0]?.count || 0);
  const totalCampaigns = await db.select({ count: sql<number>`count(*)` }).from(campaigns).then(r => r[0]?.count || 0);
  
  return {
    totalClientes: totalClients,
    totalOportunidades: totalOpportunities,
    oportunidadesFechadas: closedOpportunities,
    totalCampanhas: totalCampaigns,
  };
}

export async function getFunnelData(): Promise<any> {
  const lead = await db.select({ count: sql<number>`count(*)` }).from(opportunities).where(eq(opportunities.etapa, 'lead')).then(r => r[0]?.count || 0);
  const contato = await db.select({ count: sql<number>`count(*)` }).from(opportunities).where(eq(opportunities.etapa, 'contato')).then(r => r[0]?.count || 0);
  const proposta = await db.select({ count: sql<number>`count(*)` }).from(opportunities).where(eq(opportunities.etapa, 'proposta')).then(r => r[0]?.count || 0);
  const fechado = await db.select({ count: sql<number>`count(*)` }).from(opportunities).where(eq(opportunities.etapa, 'fechado')).then(r => r[0]?.count || 0);
  
  return { lead, contato, proposta, fechado };
}

export async function getStatusDistribution(): Promise<any> {
  const result = await db.select({
    status: clients.status,
    count: sql<number>`count(*)`,
  }).from(clients).groupBy(clients.status);
  
  return result.map(r => ({ name: r.status, value: r.count }));
}
