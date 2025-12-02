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
  uniqueIndex,
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
  cnpj: varchar("cnpj", { length: 14 }),
  status: varchar("status", { length: 50 }).notNull().default("base_frio"), // base_frio, lead_quente, engajado, em_negociacao, em_fechamento, ativo, perdido, remarketing
  parceiro: varchar("parceiro", { length: 50 }), // MIRAI, 3M
  tipoCliente: varchar("tipo_cliente", { length: 100 }),
  carteira: varchar("carteira", { length: 100 }),
  celular: varchar("celular", { length: 20 }),
  telefone2: varchar("telefone_2", { length: 20 }),
  email: varchar("email", { length: 255 }),
  nomeGestor: varchar("nome_gestor", { length: 255 }),
  emailGestor: varchar("email_gestor", { length: 255 }),
  cpfGestor: varchar("cpf_gestor", { length: 11 }),
  endereco: text("endereco"),
  numero: varchar("numero", { length: 20 }),
  bairro: varchar("bairro", { length: 100 }),
  cep: varchar("cep", { length: 8 }),
  cidade: varchar("cidade", { length: 100 }),
  uf: varchar("uf", { length: 2 }),
  dataUltimoPedido: varchar("data_ultimo_pedido", { length: 20 }),
  observacoes: text("observacoes"),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
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
    nome: z.string().min(1, "Nome obrigatório"),
    cnpj: z.string().max(14).optional().nullable(),
    uf: z.string().max(2).optional().nullable(),
    cep: z.string().max(8).optional().nullable(),
    email: z.string().email("Email inválido").optional().nullable().or(z.literal('')),
    emailGestor: z.string().email("Email inválido").optional().nullable().or(z.literal('')),
    celular: z.string().optional().nullable(),
    telefone2: z.string().optional().nullable(),
    parceiro: z.string().optional().nullable(),
    tipoCliente: z.string().optional().nullable(),
    nomeGestor: z.string().optional().nullable(),
    cpfGestor: z.string().max(11).optional().nullable(),
    dataUltimoPedido: z.string().optional().nullable(),
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
  valorEstimado: text("valor_estimado"), // text field for flexible value entry
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

// ==================== KANBAN STAGES ====================
export const kanbanStages = pgTable("kanban_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ordem: integer("ordem").notNull().default(0),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_kanban_stages_ordem").on(table.ordem),
]);

export const insertKanbanStageSchema = createInsertSchema(kanbanStages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertKanbanStage = z.infer<typeof insertKanbanStageSchema>;
export type KanbanStage = typeof kanbanStages.$inferSelect;

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
  tempoFixoSegundos: integer("tempo_fixo_segundos").default(70), // segundos fixo entre mensagens (padrão para agendamentos)
  tempoAleatorioMin: integer("tempo_aleatorio_min").default(30), // segundos mínimo aleatório
  tempoAleatorioMax: integer("tempo_aleatorio_max").default(60), // segundos máximo aleatório
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
  tempoFixoSegundos: z.number().int().min(1).max(300).default(70),
  tempoAleatorioMin: z.number().int().min(0).max(300).default(30),
  tempoAleatorioMax: z.number().int().min(0).max(300).default(60),
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
  oculta: boolean("oculta").default(false),
  naoLida: boolean("nao_lida").default(false),
  ultimaMensagem: text("ultima_mensagem"),
  ultimaMensagemEm: timestamp("ultima_mensagem_em"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_conversations_client").on(table.clientId),
  index("idx_conversations_user").on(table.userId),
  index("idx_conversations_oculta").on(table.oculta),
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
  origem: varchar("origem", { length: 50 }), // "automation", "whatsapp", "manual", null
  lido: boolean("lido").default(false),
  deletado: boolean("deletado").default(false), // Soft delete for "removed for all"
  // ✅ Campos para status de entrega do WhatsApp (ticks)
  statusEntrega: varchar("status_entrega", { length: 20 }).default("enviado"), // enviado, entregue, lido
  whatsappMessageId: varchar("whatsapp_message_id", { length: 100 }), // ID da mensagem no WhatsApp para rastrear status
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_messages_conversation").on(table.conversationId),
  index("idx_messages_sender").on(table.sender),
  index("idx_messages_whatsapp_id").on(table.whatsappMessageId),
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
  tipo: varchar("tipo", { length: 20 }).notNull().default("comentario"), // comentario, atividade, agendamento
  dataPlanejada: timestamp("data_planejada"), // for agendamento type
  anexos: jsonb("anexos").default(sql`'[]'::jsonb`), // array of {nome, tipo, conteudo_base64}
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
  tipo: z.enum(["comentario", "atividade", "agendamento"]).optional(),
  dataPlanejada: z.date().optional().nullable(),
  anexos: z.array(z.object({
    nome: z.string(),
    tipo: z.string(),
    conteudo_base64: z.string(),
  })).optional(),
  cor: z.string().optional(),
});

export type ClientNote = typeof clientNotes.$inferSelect;
export type InsertClientNote = z.infer<typeof insertClientNoteSchema>;

// ==================== TAGS (Reusable Tags for Clients) ====================
export const tags = pgTable("tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  cor: varchar("cor", { length: 50 }).notNull(), // bg-blue-500, bg-purple-500, etc
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_tags_created_by").on(table.createdBy),
]);

export const insertTagSchema = createInsertSchema(tags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  nome: z.string().min(1, "Nome da etiqueta obrigatório").max(50, "Nome muito longo"),
  cor: z.string().min(1, "Cor obrigatória"),
});

export type Tag = typeof tags.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;

// ==================== CLIENT SHARING ====================
export const clientSharing = pgTable("client_sharing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sharedWithUserId: varchar("shared_with_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  permissao: varchar("permissao", { length: 20 }).notNull().default("visualizar"), // visualizar, editar
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_client_sharing_client").on(table.clientId),
  index("idx_client_sharing_owner").on(table.ownerId),
  index("idx_client_sharing_shared_with").on(table.sharedWithUserId),
]);

export const insertClientSharingSchema = createInsertSchema(clientSharing).omit({
  id: true,
  createdAt: true,
}).extend({
  permissao: z.enum(["visualizar", "editar"]),
});

export type ClientSharing = typeof clientSharing.$inferSelect;
export type InsertClientSharing = z.infer<typeof insertClientSharingSchema>;

// ==================== NOTIFICATIONS ====================
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tipo: varchar("tipo", { length: 50 }).notNull(), // "client_shared", etc
  titulo: text("titulo").notNull(),
  descricao: text("descricao").notNull(),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "cascade" }),
  fromUserId: varchar("from_user_id").references(() => users.id, { onDelete: "cascade" }),
  lida: boolean("lida").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_notifications_user").on(table.userId),
  index("idx_notifications_lida").on(table.lida),
  index("idx_notifications_user_lida").on(table.userId, table.lida),
]);

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// ==================== CAMPAIGN SENDINGS (Histórico de Envios por Cliente) ====================
export const campaignSendings = pgTable("campaign_sendings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  campaignId: varchar("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
  campaignName: text("campaign_name").notNull(),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 20 }).notNull().default("enviado"), // erro, enviado, entregue, lido
  erroMensagem: text("erro_mensagem"),
  dataSending: timestamp("data_sending").defaultNow(),
  origemDisparo: varchar("origem_disparo", { length: 30 }).default("agendamento"),
  mensagemUsada: text("mensagem_usada"),
  modeloId: varchar("modelo_id").references(() => templates.id, { onDelete: "set null" }),
  
  // ✅ NOVOS CAMPOS: Rastreamento completo de status WhatsApp
  whatsappMessageId: varchar("whatsapp_message_id", { length: 100 }), // ID da mensagem no WhatsApp
  statusWhatsapp: integer("status_whatsapp").default(0), // 0=erro, 1=pendente, 2=enviado, 3=entregue, 4=lido
  dataEntrega: timestamp("data_entrega"), // Quando recebeu ack 3 (entregue)
  dataVisualizacao: timestamp("data_visualizacao"), // Quando recebeu ack 4 (lido)
  dataPrimeiraResposta: timestamp("data_primeira_resposta"),
  dataUltimaResposta: timestamp("data_ultima_resposta"),
  totalRespostas: integer("total_respostas").default(0),
  ultimaInteracao: timestamp("ultima_interacao"),
  
  // ✅ Estado derivado (etiqueta calculada automaticamente)
  estadoDerivado: varchar("estado_derivado", { length: 50 }).default("enviado"),
  // Valores: enviado, entregue, nao_entregue, numero_invalido, bloqueado, 
  //          visualizado, nao_visualizado, visualizou_nao_respondeu,
  //          respondeu, respondeu_imediato, respondeu_24h, respondeu_dias, respondeu_muito_tempo,
  //          engajamento_alto, engajamento_medio, engajamento_baixo, sem_engajamento
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_campaign_sendings_user").on(table.userId),
  index("idx_campaign_sendings_campaign").on(table.campaignId),
  index("idx_campaign_sendings_client").on(table.clientId),
  index("idx_campaign_sendings_date").on(table.dataSending),
  index("idx_campaign_sendings_user_client").on(table.userId, table.clientId),
  index("idx_campaign_sendings_origem").on(table.origemDisparo),
  index("idx_campaign_sendings_whatsapp_id").on(table.whatsappMessageId),
  index("idx_campaign_sendings_estado").on(table.estadoDerivado),
  uniqueIndex("idx_campaign_sendings_unique_client_campaign").on(table.campaignId, table.clientId),
]);

export const insertCampaignSendingSchema = createInsertSchema(campaignSendings).omit({
  id: true,
  createdAt: true,
  dataSending: true,
}).extend({
  origemDisparo: z.enum(["agendamento", "envio_imediato"]).default("agendamento"),
  mensagemUsada: z.string().optional(),
  modeloId: z.string().optional().nullable(),
  whatsappMessageId: z.string().optional(),
  statusWhatsapp: z.number().optional(),
  estadoDerivado: z.string().optional(),
});

export type CampaignSending = typeof campaignSendings.$inferSelect;
export type InsertCampaignSending = z.infer<typeof insertCampaignSendingSchema>;

// ==================== CAMPAIGN GROUPS (Grupos/Templates de Filtros) ====================
export const campaignGroups = pgTable("campaign_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  filtros: jsonb("filtros").notNull().default(sql`'{}'::jsonb`), // { diasDesdeEnvio, tags, cidades, tipos, carteiras, semEtiqueta }
  clientCount: integer("client_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_campaign_groups_user").on(table.userId),
]);

export const insertCampaignGroupSchema = createInsertSchema(campaignGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  clientCount: true,
});

export type CampaignGroup = typeof campaignGroups.$inferSelect;
export type InsertCampaignGroup = z.infer<typeof insertCampaignGroupSchema>;

// ==================== AUTOMATION TASKS ====================
export const automationTasks = pgTable("automation_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  opportunityId: varchar("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }), // ✅ Para filtrar por oportunidade específica
  tipo: varchar("tipo", { length: 50 }).notNull(), // "follow_up", "re_engagement", "score_update", "auto_send"
  status: varchar("status", { length: 50 }).notNull().default("pendente"), // pendente, executado, erro
  proximaExecucao: timestamp("proxima_execucao").notNull(),
  dados: jsonb("dados").default(sql`'{}'::jsonb`), // { diasSinceLastContact, tentativas, mensagem, etc }
  tentativas: integer("tentativas").default(0),
  ultimaTentativa: timestamp("ultima_tentativa"),
  erro: text("erro"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_automation_tasks_user").on(table.userId),
  index("idx_automation_tasks_client").on(table.clientId),
  index("idx_automation_tasks_opportunity").on(table.opportunityId), // ✅ Nova índice
  index("idx_automation_tasks_status").on(table.status),
  index("idx_automation_tasks_proxima").on(table.proximaExecucao),
]);

export const insertAutomationTaskSchema = createInsertSchema(automationTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  tentativas: true,
  ultimaTentativa: true,
});

export type AutomationTask = typeof automationTasks.$inferSelect;
export type InsertAutomationTask = z.infer<typeof insertAutomationTaskSchema>;

// ==================== FOLLOW UPS ====================
export const followUps = pgTable("follow_ups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  numero: integer("numero").notNull(), // 1, 2, 3 follow-up
  diasSinceLastContact: integer("dias_since_last_contact").notNull(),
  resultado: varchar("resultado", { length: 50 }), // "resposta", "sem_resposta", "recusou", "converteu"
  executadoEm: timestamp("executado_em"),
  proximoFollowUpEm: timestamp("proximo_follow_up_em"),
  descricao: text("descricao"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_follow_ups_user").on(table.userId),
  index("idx_follow_ups_client").on(table.clientId),
  index("idx_follow_ups_numero").on(table.numero),
  index("idx_follow_ups_executado").on(table.executadoEm),
]);

export const insertFollowUpSchema = createInsertSchema(followUps).omit({
  id: true,
  createdAt: true,
});

export type FollowUp = typeof followUps.$inferSelect;
export type InsertFollowUp = z.infer<typeof insertFollowUpSchema>;

// ==================== CLIENT SCORES ====================
export const clientScores = pgTable("client_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  scoreIA: integer("score_ia").default(0), // 0-100 from AI analysis
  scoreContato: integer("score_contato").default(0), // Contact frequency
  scoreEngajamento: integer("score_engajamento").default(0), // Engagement level
  scorePotencial: integer("score_potencial").default(0), // Revenue potential
  scoreTotal: integer("score_total").default(0), // Weighted total
  ultimaAtualizacao: timestamp("ultima_atualizacao").defaultNow(),
  proximaAtualizacao: timestamp("proxima_atualizacao"),
}, (table) => [
  index("idx_client_scores_user").on(table.userId),
  index("idx_client_scores_client").on(table.clientId),
  index("idx_client_scores_total").on(table.scoreTotal),
]);

export const insertClientScoreSchema = createInsertSchema(clientScores).omit({
  id: true,
  ultimaAtualizacao: true,
});

export type ClientScore = typeof clientScores.$inferSelect;
export type InsertClientScore = z.infer<typeof insertClientScoreSchema>;

// ==================== AUTOMATION CONFIGS ====================
export const automationConfigs = pgTable("automation_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobType: varchar("job_type", { length: 50 }).notNull(), // follow_up, re_engagement, score_update, contract_reminder, etc
  ativo: boolean("ativo").default(true),
  horarios: text("horarios").array().default(sql`ARRAY[]::text[]`), // ['08:00', '16:30']
  timeout2h: boolean("timeout_2h").default(true),
  timeout4dias: boolean("timeout_4_dias").default(true),
  diasSemana: text("dias_semana").array().default(sql`ARRAY['segunda', 'terca', 'quarta', 'quinta', 'sexta']::text[]`),
  // Estrutura: { dia_0: [...msgs], dia_1: [...msgs], ... }
  mensagensTemplates: jsonb("mensagens_templates").default(sql`'{}'::jsonb`),
  intervaloScheduler: integer("intervalo_scheduler").default(60), // segundos
  emailNotificacoes: boolean("email_notificacoes").default(true),
  mensagemPadraoRespostaIA: text("mensagem_padrao_resposta_ia"), // Mensagem automática quando cliente envia msg e IA responde
  mensagemContatoPositivo: text("mensagem_contato_positivo"), // Resposta positiva → CONTATO
  mensagemPropostaPositivo: text("mensagem_proposta_positivo"), // Resposta positiva → PROPOSTA
  mensagemFechado: text("mensagem_fechado"), // Mensagem ao mover manualmente para FECHADO
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAutomationConfigSchema = createInsertSchema(automationConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AutomationConfig = typeof automationConfigs.$inferSelect;
export type InsertAutomationConfig = z.infer<typeof insertAutomationConfigSchema>;
