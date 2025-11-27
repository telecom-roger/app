CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"acao" varchar(50) NOT NULL,
	"entidade" varchar(50) NOT NULL,
	"entidade_id" varchar,
	"dados_antigos" jsonb,
	"dados_novos" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"tipo" varchar(20) NOT NULL,
	"template_id" varchar,
	"status" varchar(20) DEFAULT 'rascunho' NOT NULL,
	"filtros" jsonb DEFAULT '{}'::jsonb,
	"total_recipients" integer DEFAULT 0,
	"total_enviados" integer DEFAULT 0,
	"total_abertos" integer DEFAULT 0,
	"total_cliques" integer DEFAULT 0,
	"total_erros" integer DEFAULT 0,
	"agendada_para" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"conteudo" text NOT NULL,
	"cor" varchar(20) DEFAULT 'bg-blue-500',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_sharing" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"owner_id" varchar NOT NULL,
	"shared_with_user_id" varchar NOT NULL,
	"permissao" varchar(20) DEFAULT 'visualizar' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"razao_social" text,
	"cpf_cnpj" varchar(50),
	"status" varchar(50) DEFAULT 'lead' NOT NULL,
	"carteira" varchar(100),
	"categoria" varchar(100),
	"score" integer DEFAULT 0,
	"plano_atual" text,
	"produto_atual" text,
	"telefone" varchar(20),
	"email" varchar(255),
	"contato" text,
	"endereco" text,
	"numero" varchar(20),
	"complemento" text,
	"cep" varchar(10),
	"cidade" varchar(100),
	"uf" varchar(2),
	"data_contrato" timestamp,
	"valor_contrato" integer,
	"data_ultimo_contato" timestamp,
	"observacoes" text,
	"aparelho_liberado" varchar(255),
	"pedido_movel" varchar(255),
	"m_fixa" varchar(255),
	"pedido_fixa" varchar(255),
	"nome_contato" varchar(255),
	"email_principal" varchar(255),
	"celular_principal" varchar(20),
	"tipo_gestor" varchar(100),
	"flg_dominio_publico_sfa" boolean,
	"telefone_comercial" varchar(20),
	"celular" varchar(20),
	"telefone_residencial" varchar(20),
	"email_sibel" varchar(255),
	"prop_movel_avancada" varchar(255),
	"serasa" varchar(255),
	"mensagem_serasa" text,
	"tags" text[] DEFAULT ARRAY[]::text[],
	"campos_custom" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" varchar
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"tipo" varchar(20) NOT NULL,
	"valor" text NOT NULL,
	"preferencial" boolean DEFAULT false,
	"verified" boolean DEFAULT false,
	"last_contacted" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_client_contact" UNIQUE("client_id","tipo","valor")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"canal" varchar(20) DEFAULT 'whatsapp' NOT NULL,
	"assunto" text,
	"ativa" boolean DEFAULT true,
	"ultima_mensagem" text,
	"ultima_mensagem_em" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "custom_fields" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"tipo" varchar(20) NOT NULL,
	"opcoes" text[],
	"obrigatorio" boolean DEFAULT false,
	"visivel_no_front" boolean DEFAULT true,
	"ordem" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "custom_fields_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome_arquivo" text NOT NULL,
	"status" varchar(20) DEFAULT 'processando' NOT NULL,
	"total_linhas" integer DEFAULT 0,
	"linhas_validas" integer DEFAULT 0,
	"linhas_invalidas" integer DEFAULT 0,
	"duplicados" integer DEFAULT 0,
	"mapeamento" jsonb,
	"erros" jsonb DEFAULT '[]'::jsonb,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"tipo" varchar(50) NOT NULL,
	"origem" varchar(20) DEFAULT 'user' NOT NULL,
	"titulo" text,
	"texto" text,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"sender" varchar(20) NOT NULL,
	"tipo" varchar(20) DEFAULT 'texto' NOT NULL,
	"conteudo" text,
	"arquivo" text,
	"nome_arquivo" text,
	"tamanho" integer,
	"mime_type" text,
	"lido" boolean DEFAULT false,
	"deletado" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"titulo" text NOT NULL,
	"valor_estimado" integer,
	"etapa" varchar(100) DEFAULT 'lead' NOT NULL,
	"responsavel_id" varchar,
	"prazo" timestamp,
	"ordem" integer DEFAULT 0,
	"notas" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quick_replies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"conteudo" text NOT NULL,
	"ordem" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"cor" varchar(50) NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"tipo" varchar(20) NOT NULL,
	"assunto" text,
	"conteudo" text NOT NULL,
	"image_url" text,
	"variaveis" text[] DEFAULT ARRAY[]::text[],
	"ativo" boolean DEFAULT true,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"password_hash" varchar NOT NULL,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" varchar(20) DEFAULT 'agent' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"session_id" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'desconectada' NOT NULL,
	"qr_code" text,
	"telefone" varchar(20),
	"ativo" boolean DEFAULT true,
	"user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "whatsapp_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_sharing" ADD CONSTRAINT "client_sharing_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_sharing" ADD CONSTRAINT "client_sharing_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_sharing" ADD CONSTRAINT "client_sharing_shared_with_user_id_users_id_fk" FOREIGN KEY ("shared_with_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_responsavel_id_users_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_replies" ADD CONSTRAINT "quick_replies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_sessions" ADD CONSTRAINT "whatsapp_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entidade" ON "audit_logs" USING btree ("entidade","entidade_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_client_notes_user" ON "client_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_client_notes_client" ON "client_notes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_notes_user_client" ON "client_notes" USING btree ("user_id","client_id");--> statement-breakpoint
CREATE INDEX "idx_client_sharing_client" ON "client_sharing" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_sharing_owner" ON "client_sharing" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_client_sharing_shared_with" ON "client_sharing" USING btree ("shared_with_user_id");--> statement-breakpoint
CREATE INDEX "idx_contacts_client" ON "contacts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_client" ON "conversations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_user" ON "conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_import_jobs_created_by" ON "import_jobs" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_import_jobs_status" ON "import_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_interactions_client" ON "interactions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_interactions_created" ON "interactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_conversation" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_messages_sender" ON "messages" USING btree ("sender");--> statement-breakpoint
CREATE INDEX "idx_opportunities_client" ON "opportunities" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_opportunities_etapa" ON "opportunities" USING btree ("etapa");--> statement-breakpoint
CREATE INDEX "idx_opportunities_responsavel" ON "opportunities" USING btree ("responsavel_id");--> statement-breakpoint
CREATE INDEX "idx_quick_replies_user" ON "quick_replies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_tags_created_by" ON "tags" USING btree ("created_by");