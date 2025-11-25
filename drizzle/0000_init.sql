-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Sessions table (required for Replit Auth)
CREATE TABLE IF NOT EXISTS "sessions" (
  "sid" varchar PRIMARY KEY NOT NULL,
  "sess" jsonb NOT NULL,
  "expire" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" ("expire");

-- Users table (required for Replit Auth)
CREATE TABLE IF NOT EXISTS "users" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar UNIQUE,
  "first_name" varchar,
  "last_name" varchar,
  "profile_image_url" varchar,
  "role" varchar(20) NOT NULL DEFAULT 'agent',
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Clients table
CREATE TABLE IF NOT EXISTS "clients" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome" text NOT NULL,
  "razao_social" text,
  "cpf_cnpj" varchar(20),
  "status" varchar(50) NOT NULL DEFAULT 'lead',
  "carteira" varchar(100),
  "categoria" varchar(100),
  "score" integer DEFAULT 0,
  "plano_atual" text,
  "produto_atual" text,
  "tags" text[] DEFAULT ARRAY[]::text[],
  "campos_custom" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  "created_by" varchar REFERENCES "users"("id")
);

-- Contacts table
CREATE TABLE IF NOT EXISTS "contacts" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" varchar NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "tipo" varchar(20) NOT NULL,
  "valor" text NOT NULL,
  "preferencial" boolean DEFAULT false,
  "verified" boolean DEFAULT false,
  "last_contacted" timestamp,
  "created_at" timestamp DEFAULT now(),
  UNIQUE("client_id", "tipo", "valor")
);

CREATE INDEX IF NOT EXISTS "idx_contacts_client" ON "contacts" ("client_id");

-- Opportunities table
CREATE TABLE IF NOT EXISTS "opportunities" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" varchar NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "titulo" text NOT NULL,
  "valor_estimado" integer,
  "etapa" varchar(100) NOT NULL DEFAULT 'lead',
  "responsavel_id" varchar REFERENCES "users"("id"),
  "prazo" timestamp,
  "ordem" integer DEFAULT 0,
  "notas" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_opportunities_client" ON "opportunities" ("client_id");
CREATE INDEX IF NOT EXISTS "idx_opportunities_etapa" ON "opportunities" ("etapa");
CREATE INDEX IF NOT EXISTS "idx_opportunities_responsavel" ON "opportunities" ("responsavel_id");

-- Templates table
CREATE TABLE IF NOT EXISTS "templates" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome" text NOT NULL,
  "tipo" varchar(20) NOT NULL,
  "assunto" text,
  "conteudo" text NOT NULL,
  "variaveis" text[] DEFAULT ARRAY[]::text[],
  "ativo" boolean DEFAULT true,
  "created_by" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS "campaigns" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome" text NOT NULL,
  "tipo" varchar(20) NOT NULL,
  "template_id" varchar REFERENCES "templates"("id"),
  "status" varchar(20) NOT NULL DEFAULT 'rascunho',
  "filtros" jsonb DEFAULT '{}'::jsonb,
  "total_recipients" integer DEFAULT 0,
  "total_enviados" integer DEFAULT 0,
  "total_abertos" integer DEFAULT 0,
  "total_cliques" integer DEFAULT 0,
  "total_erros" integer DEFAULT 0,
  "agendada_para" timestamp,
  "created_by" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS "conversations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" varchar NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "contact_id" varchar REFERENCES "contacts"("id"),
  "canal" varchar(20) NOT NULL,
  "session_id" varchar,
  "mensagens" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_conversations_client" ON "conversations" ("client_id");

-- Interactions table (timeline)
CREATE TABLE IF NOT EXISTS "interactions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" varchar NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "tipo" varchar(50) NOT NULL,
  "origem" varchar(20) NOT NULL DEFAULT 'user',
  "titulo" text,
  "texto" text,
  "meta" jsonb DEFAULT '{}'::jsonb,
  "created_by" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_interactions_client" ON "interactions" ("client_id");
CREATE INDEX IF NOT EXISTS "idx_interactions_created" ON "interactions" ("created_at");

-- Custom Fields table
CREATE TABLE IF NOT EXISTS "custom_fields" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome" text NOT NULL UNIQUE,
  "tipo" varchar(20) NOT NULL,
  "opcoes" text[],
  "obrigatorio" boolean DEFAULT false,
  "visivel_no_front" boolean DEFAULT true,
  "ordem" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now()
);

-- Audit Logs table
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar REFERENCES "users"("id"),
  "acao" varchar(50) NOT NULL,
  "entidade" varchar(50) NOT NULL,
  "entidade_id" varchar,
  "dados_antigos" jsonb,
  "dados_novos" jsonb,
  "ip_address" varchar(45),
  "user_agent" text,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_audit_logs_user" ON "audit_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_entidade" ON "audit_logs" ("entidade", "entidade_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_created" ON "audit_logs" ("created_at");

-- Import Jobs table
CREATE TABLE IF NOT EXISTS "import_jobs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome_arquivo" text NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'processando',
  "total_linhas" integer DEFAULT 0,
  "linhas_validas" integer DEFAULT 0,
  "linhas_invalidas" integer DEFAULT 0,
  "duplicados" integer DEFAULT 0,
  "mapeamento" jsonb,
  "erros" jsonb DEFAULT '[]'::jsonb,
  "created_by" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now(),
  "completed_at" timestamp
);

CREATE INDEX IF NOT EXISTS "idx_import_jobs_created_by" ON "import_jobs" ("created_by");
CREATE INDEX IF NOT EXISTS "idx_import_jobs_status" ON "import_jobs" ("status");

-- WhatsApp Sessions table
CREATE TABLE IF NOT EXISTS "whatsapp_sessions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome" text NOT NULL,
  "session_id" varchar(100) NOT NULL UNIQUE,
  "status" varchar(20) NOT NULL DEFAULT 'desconectada',
  "qr_code" text,
  "telefone" varchar(20),
  "ativo" boolean DEFAULT true,
  "user_id" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
