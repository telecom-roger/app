import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ==================== SESSION STORAGE ====================
// (IMPORTANT) This table is mandatory for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// ==================== USERS ====================
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  passwordHash: varchar("password_hash").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { length: 20 }).notNull().default("agent"), // admin, manager, agent
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// ==================== CLIENTS ====================
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  razaoSocial: text("razao_social"),
  cpfCnpj: varchar("cpf_cnpj", { length: 50 }),
  status: varchar("status", { length: 50 }).notNull().default("lead"), // lead, ativo, inativo, proposta, fechado, perdido
  carteira: varchar("carteira", { length: 100 }), // Vivo, Claro, Tim, etc
  categoria: varchar("categoria", { length: 100 }),
  score: integer("score").default(0), // 0-100 lead scoring
  planoAtual: text("plano_atual"),
  produtoAtual: text("produto_atual"),
  // Contact fields
  telefone: varchar("telefone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  contato: text("contato"), // Contact person name
  // Address fields
  endereco: text("endereco"),
  numero: varchar("numero", { length: 20 }),
  complemento: text("complemento"),
  cep: varchar("cep", { length: 10 }),
  cidade: varchar("cidade", { length: 100 }),
  uf: varchar("uf", { length: 2 }), // State abbreviation (SP, RJ, etc)
  // Contract fields
  dataContrato: timestamp("data_contrato"),
  valorContrato: integer("valor_contrato"), // in cents
  dataUltimoContato: timestamp("data_ultimo_contato"),
  observacoes: text("observacoes"),
  // New telecom fields (UPPERCASE names in schema)
  APARELHO_LIBERADO: varchar("aparelho_liberado", { length: 255 }),
  PEDIDO_MOVEL: varchar("pedido_movel", { length: 255 }),
  M_FIXA: varchar("m_fixa", { length: 255 }),
  PEDIDO_FIXA: varchar("pedido_fixa", { length: 255 }),
  NOME_CONTATO: varchar("nome_contato", { length: 255 }),
  EMAIL_PRINCIPAL: varchar("email_principal", { length: 255 }),
  CELULAR_PRINCIPAL: varchar("celular_principal", { length: 20 }),
  TIPO_GESTOR: varchar("tipo_gestor", { length: 100 }),
  FLG_DOMINIO_PUBLICO_SFA: boolean("flg_dominio_publico_sfa"),
  TELEFONE_COMERCIAL: varchar("telefone_comercial", { length: 20 }),
  CELULAR: varchar("celular", { length: 20 }),
  TELEFONE_RESIDENCIAL: varchar("telefone_residencial", { length: 20 }),
  EMAIL_SIBEL: varchar("email_sibel", { length: 255 }),
  PROP_MOVEL_AVANCADA: varchar("prop_movel_avancada", { length: 255 }),
  SERASA: varchar("serasa", { length: 255 }),
  MENSAGEM_SERASA: text("mensagem_serasa"),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  camposCustom: jsonb("campos_custom").default(sql`'{}'::jsonb`), // flexible custom fields
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

export const insertClientSchema = createInsertSchema(clients)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    uf: z.string().max(2).optional().nullable(),
    cep: z.string().regex(/^\d{5}-?\d{3}$|^$/, "CEP inválido").optional().nullable(),
    email: z.string().email("Email inválido").optional().nullable(),
    telefone: z.string().min(10, "Telefone inválido").optional().nullable(),
    // Telecom fields - make all optional
    APARELHO_LIBERADO: z.string().optional().nullable(),
    PEDIDO_MOVEL: z.string().optional().nullable(),
    M_FIXA: z.string().optional().nullable(),
    PEDIDO_FIXA: z.string().optional().nullable(),
    NOME_CONTATO: z.string().optional().nullable(),
    EMAIL_PRINCIPAL: z.string().optional().nullable(),
    CELULAR_PRINCIPAL: z.string().optional().nullable(),
    TIPO_GESTOR: z.string().optional().nullable(),
    FLG_DOMINIO_PUBLICO_SFA: z.boolean().optional().nullable(),
    TELEFONE_COMERCIAL: z.string().optional().nullable(),
    CELULAR: z.string().optional().nullable(),
    TELEFONE_RESIDENCIAL: z.string().optional().nullable(),
    EMAIL_SIBEL: z.string().optional().nullable(),
    PROP_MOVEL_AVANCADA: z.string().optional().nullable(),
    SERASA: z.string().optional().nullable(),
    MENSAGEM_SERASA: z.string().optional().nullable(),
  });

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// ==================== CONTACTS ====================
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  tipo: varchar("tipo", { length: 20 }).notNull(), // telefone, email
  valor: text("valor").notNull(), // +5511999999999 or email@example.com
  preferencial: boolean("preferencial").default(false),
  verified: boolean("verified").default(false),
  lastContacted: timestamp("last_contacted"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_contacts_client").on(table.clientId),
  unique("unique_client_contact").on(table.clientId, table.tipo, table.valor),
]);

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

// ==================== OPPORTUNITIES ====================
export const opportunities = pgTable("opportunities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  titulo: text("titulo").notNull(),
  valorEstimado: integer("valor_estimado"), // in cents
  etapa: varchar("etapa", { length: 100 }).notNull().default("lead"), // lead, contato, proposta, fechado, perdido
  responsavelId: varchar("responsavel_id").references(() => users.id),
  prazo: timestamp("prazo"),
  ordem: integer("ordem").default(0), // for drag & drop ordering within column
  notas: jsonb("notas").default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_opportunities_client").on(table.clientId),
  index("idx_opportunities_etapa").on(table.etapa),
  index("idx_opportunities_responsavel").on(table.responsavelId),
]);

export const insertOpportunitySchema = createInsertSchema(opportunities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type Opportunity = typeof opportunities.$inferSelect;

// ==================== TEMPLATES ====================
export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  tipo: varchar("tipo", { length: 20 }).notNull(), // email, whatsapp
  assunto: text("assunto"), // for email
  conteudo: text("conteudo").notNull(),
  imageUrl: text("image_url"), // image URL for WhatsApp/Email
  variaveis: text("variaveis").array().default(sql`ARRAY[]::text[]`), // ['razao_social', 'plano_atual']
  ativo: boolean("ativo").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  tipo: z.enum(["email", "whatsapp"]),
});

export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templates.$inferSelect;

// ==================== CAMPAIGNS ====================
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  tipo: varchar("tipo", { length: 20 }).notNull(), // email, whatsapp
  templateId: varchar("template_id").references(() => templates.id),
  status: varchar("status", { length: 20 }).notNull().default("rascunho"), // rascunho, agendada, enviando, concluida, pausada
  filtros: jsonb("filtros").default(sql`'{}'::jsonb`), // filter criteria for recipients
  totalRecipients: integer("total_recipients").default(0),
  totalEnviados: integer("total_enviados").default(0),
  totalAbertos: integer("total_abertos").default(0),
  totalCliques: integer("total_cliques").default(0),
  totalErros: integer("total_erros").default(0),
  agendadaPara: timestamp("agendada_para"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  agendadaPara: z.union([z.date(), z.string().datetime()]).transform(val => typeof val === 'string' ? new Date(val) : val),
});

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;


// ==================== INTERACTIONS (Timeline Items) ====================
export const interactions = pgTable("interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  tipo: varchar("tipo", { length: 50 }).notNull(), // nota, email_enviado, whatsapp_enviado, status_mudou, campanha, ligacao
  origem: varchar("origem", { length: 20 }).notNull().default("user"), // user, system
  titulo: text("titulo"),
  texto: text("texto"),
  meta: jsonb("meta").default(sql`'{}'::jsonb`), // extra metadata like campaign_id, old_status, new_status, etc
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_interactions_client").on(table.clientId),
  index("idx_interactions_created").on(table.createdAt),
]);

export const insertInteractionSchema = createInsertSchema(interactions).omit({
  id: true,
  createdAt: true,
});

export type InsertInteraction = z.infer<typeof insertInteractionSchema>;
export type Interaction = typeof interactions.$inferSelect;

// ==================== CUSTOM FIELDS ====================
export const customFields = pgTable("custom_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull().unique(),
  tipo: varchar("tipo", { length: 20 }).notNull(), // texto, numero, selecao, data, boolean
  opcoes: text("opcoes").array(), // for selecao type
  obrigatorio: boolean("obrigatorio").default(false),
  visivelNoFront: boolean("visivel_no_front").default(true),
  ordem: integer("ordem").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomFieldSchema = createInsertSchema(customFields).omit({
  id: true,
  createdAt: true,
});

export type InsertCustomField = z.infer<typeof insertCustomFieldSchema>;
export type CustomField = typeof customFields.$inferSelect;

// ==================== AUDIT LOGS ====================
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  acao: varchar("acao", { length: 50 }).notNull(), // criar, editar, excluir, enviar, importar
  entidade: varchar("entidade", { length: 50 }).notNull(), // client, opportunity, campaign, etc
  entidadeId: varchar("entidade_id"),
  dadosAntigos: jsonb("dados_antigos"),
  dadosNovos: jsonb("dados_novos"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_audit_logs_user").on(table.userId),
  index("idx_audit_logs_entidade").on(table.entidade, table.entidadeId),
  index("idx_audit_logs_created").on(table.createdAt),
]);

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// ==================== IMPORT JOBS ====================
export const importJobs = pgTable("import_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nomeArquivo: text("nome_arquivo").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("processando"), // processando, concluido, erro
  totalLinhas: integer("total_linhas").default(0),
  linhasValidas: integer("linhas_validas").default(0),
  linhasInvalidas: integer("linhas_invalidas").default(0),
  duplicados: integer("duplicados").default(0),
  mapeamento: jsonb("mapeamento"), // column mapping
  erros: jsonb("erros").default(sql`'[]'::jsonb`), // array of error messages
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_import_jobs_created_by").on(table.createdBy),
  index("idx_import_jobs_status").on(table.status),
]);

export const insertImportJobSchema = createInsertSchema(importJobs).omit({
  id: true,
  createdAt: true,
});

export type InsertImportJob = z.infer<typeof insertImportJobSchema>;
export type ImportJob = typeof importJobs.$inferSelect;

// ==================== WHATSAPP SESSIONS ====================
export const whatsappSessions = pgTable("whatsapp_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  sessionId: varchar("session_id", { length: 100 }).notNull().unique(),
  status: varchar("status", { length: 20 }).notNull().default("desconectada"), // conectada, desconectada, erro
  qrCode: text("qr_code"),
  telefone: varchar("telefone", { length: 20 }),
  ativo: boolean("ativo").default(true),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWhatsappSessionSchema = createInsertSchema(whatsappSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWhatsappSession = z.infer<typeof insertWhatsappSessionSchema>;
export type WhatsappSession = typeof whatsappSessions.$inferSelect;

// ==================== CONVERSATIONS ====================
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  canal: varchar("canal", { length: 20 }).notNull().default("whatsapp"),
  assunto: text("assunto"),
  ativa: boolean("ativa").default(true),
  ultimaMensagem: text("ultima_mensagem"),
  ultimaMensagemEm: timestamp("ultima_mensagem_em"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_conversations_client").on(table.clientId),
  index("idx_conversations_user").on(table.userId),
]);

export type Conversation = typeof conversations.$inferSelect;
export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  ultimaMensagemEm: true,
});
export type InsertConversation = z.infer<typeof insertConversationSchema>;

// ==================== MESSAGES ====================
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  sender: varchar("sender", { length: 20 }).notNull(), // "user", "client"
  tipo: varchar("tipo", { length: 20 }).notNull().default("texto"), // texto, imagem, audio, video, documento
  conteudo: text("conteudo"),
  arquivo: text("arquivo"), // URL no Replit Storage
  nomeArquivo: text("nome_arquivo"),
  tamanho: integer("tamanho"), // em bytes
  mimeType: text("mime_type"),
  lido: boolean("lido").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_messages_conversation").on(table.conversationId),
  index("idx_messages_sender").on(table.sender),
]);

export type Message = typeof messages.$inferSelect;
export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// ==================== QUICK REPLIES ====================
export const quickReplies = pgTable("quick_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  conteudo: text("conteudo").notNull(),
  ordem: integer("ordem").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_quick_replies_user").on(table.userId),
]);

export const insertQuickReplySchema = createInsertSchema(quickReplies).omit({
  id: true,
  createdAt: true,
}).extend({
  conteudo: z.string().min(1, "Mensagem não pode estar vazia").max(1000, "Mensagem muito longa"),
});

export type QuickReply = typeof quickReplies.$inferSelect;
export type InsertQuickReply = z.infer<typeof insertQuickReplySchema>;

// ==================== CLIENT NOTES ====================
export const clientNotes = pgTable("client_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  conteudo: text("conteudo").notNull(),
  cor: varchar("cor", { length: 20 }).default("bg-blue-500"), // color class for badge
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_client_notes_user").on(table.userId),
  index("idx_client_notes_client").on(table.clientId),
  index("idx_client_notes_user_client").on(table.userId, table.clientId),
]);

export const insertClientNoteSchema = createInsertSchema(clientNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  conteudo: z.string().min(1, "Nota não pode estar vazia").max(500, "Nota muito longa"),
  cor: z.string().optional(),
});

export type ClientNote = typeof clientNotes.$inferSelect;
export type InsertClientNote = z.infer<typeof insertClientNoteSchema>;
