# Plataforma de Atendimento Inteligente

## Overview
This project is a comprehensive platform designed to manage over 500,000 telecommunications customers. It integrates a CRM, mass communication capabilities (WhatsApp/Email), a sales Kanban, AI-powered automation, and scheduled campaign management. The platform aims to streamline customer interaction, sales processes, and communication for telecom operators.

## User Preferences
- **Communication Style**: Please use clear, simple, and direct language.
- **Workflow**: I prefer an iterative development approach.
- **Interaction**: Ask for confirmation before implementing major changes or architectural decisions.
- **Code Changes**: Do not make changes to the `shared/schema.ts` file without explicit instruction.
- **Explanations**: Provide detailed explanations for complex features or architectural choices.

## System Architecture

### UI/UX
The application features a professional design system utilizing a deep dark blue (`#1A0B41`) as the primary color and a vibrant purple (`#7069FF`) for CTAs and buttons. Neutral colors include light grey and white. The typography uses Inter (sans-serif) for general text and Fira Code (monospace) for code. A full dark mode with a toggle is supported. The UI is fully responsive across mobile, tablet, and desktop, incorporating smooth animations with Framer Motion and accessibility features (data-testid). The layout includes a fixed navigation sidebar with contextual menus.

### Technical Implementations
- **Frontend**: React 18 with TypeScript, Vite, Wouter for routing, TanStack Query for data fetching, Tailwind CSS with Shadcn/UI components, and Lucide React for icons.
- **Backend**: Node.js with Express.js and TypeScript, PostgreSQL (Replit Database), Drizzle ORM, and Replit Auth for authentication (JWT + OAuth). Background job processing handles scheduled campaigns.
- **Data Model**: Key entities include `users`, `clients`, `opportunities`, `campaigns`, `templates`, `conversations`, `messages`, `whatsappSessions`, and `kanban_stages`. The `kanban_stages` are global to the entire company.
- **Authentication**: Replit Auth with local Passport strategy (email + bcrypt) and role-based access control (Admin, Gerente, Agente).
- **CRM**: Full CRUD for clients with 16 custom telecom fields, contact management, tagging, lead scoring, interaction timeline, and advanced search/filters.
- **Client Import**: A 4-step wizard supports CSV/XLSX imports with interactive column mapping, Brazilian phone normalization, duplicate detection, and detailed validation reports.
- **Kanban**: Drag-and-drop functionality for opportunities across **8 global stages** (LEAD, CONTATO, PROPOSTA, PROPOSTA ENVIADA, AGUARDANDO ACEITE, FECHADO, PERDIDO, FORNECEDOR). All titles in UPPERCASE. Supports inline editing and filtering by assignee.
- **Campaigns**: Management of Email and WhatsApp campaigns with template selection, dynamic variables, scheduling, and status tracking.
- **WhatsApp Integration**: Bidirectional chat, message sending, active listeners, phone number normalization (removes 55 prefix for storage), automatic conversation creation for new contacts, and voice note support.
- **AI Automation**: Integrated with OpenAI GPT-4o Mini for sentiment analysis of WhatsApp responses. **IA now works ONLY on 4 stages**: PROPOSTA, CONTATO, FORNECEDOR, PERDIDO. Other stages (LEAD, PROPOSTA ENVIADA, AGUARDANDO ACEITE, FECHADO) are manual-only. Automatically moves Kanban opportunities based on sentiment and creating intelligent notifications.

### System Design Choices
- **Folder Structure**: Organized into `client/src` (components, pages, hooks, lib, assets), `server` (app, routes, storage, auth, whatsapp service), and `shared` (Drizzle schemas, shared types).
- **API**: Comprehensive REST APIs for all major functionalities, including pagination, filtering, and inline editing.
- **Database**: PostgreSQL with Drizzle ORM, optimized with foreign key indices and increased payload limits for bulk imports.
- **Storage System**: Abstracted storage methods in `storage.ts` for CRUD operations.
- **Audit System**: Complete logging for creation, editing, and deletion actions, including IP and User-Agent tracking.

## External Dependencies
- **Replit Database**: PostgreSQL for persistent data storage.
- **Replit Auth**: For user authentication and authorization.
- **OpenAI API**: Specifically GPT-4o Mini, for AI-powered sentiment analysis and automation.
- **SendGrid**: (Future integration) for email sending.
- **Baileys**: WhatsApp API library for messaging functionality.
- **PapaParse**: For parsing CSV/XLSX files during client imports.
- **Framer Motion**: For UI animations.
- **Recharts**: For data visualization in the analytical dashboard.

---

## 🚀 FASE 5 - INTELIGÊNCIA IA LIMITADA + CONTRACT REMINDER (Nov 28, 18:15)

### ✅ Novas Etapas do Kanban (8 total):
- **LEAD** (0) - Manual
- **CONTATO** (1) - IA trabalha aqui
- **PROPOSTA** (2) - IA trabalha aqui
- **PROPOSTA ENVIADA** (3) - Manual (cobrado automaticamente após 24h)
- **AGUARDANDO ACEITE** (4) - Manual
- **FECHADO** (5) - Manual
- **PERDIDO** (6) - IA trabalha aqui
- **FORNECEDOR** (7) - IA trabalha aqui

### 🤖 Regras de IA Implementadas:
IA **TRABALHA APENAS** em 4 etapas:
1. **PROPOSTA** - "OK", "SIM", "TOPA", "MANDA" → cliente aprovou proposta
2. **CONTATO** - "PREÇO", "VALOR", "QUANTO" → cliente quer mais info
3. **FORNECEDOR** - Mensagens automáticas, "DEIXE SEU CONTATO", "BREVE", etc
4. **PERDIDO** - "NÃO", "RECUSO", "CANCELAR" → cliente rejeitou

**Outras etapas são 100% manuais** (vendedor move no Kanban):
- LEAD, PROPOSTA ENVIADA, AGUARDANDO ACEITE, FECHADO

### 📋 Contract Reminder Job (NOVO):
- **Executa a cada 30 segundos** (via cron job)
- **Verifica**: Oportunidades em "PROPOSTA ENVIADA" há **24h+ sem movimento**
- **Ação**: Envia lembrete cobrando assinatura do contrato via mensagem
- **Função**: `checkPropostaEnviadaTimeouts()` + `executeContractReminder()`
- **Tabela**: Usa `automation_tasks` com tipo `contract_reminder`
- **Log**: Registra mensagens em `messages` com `sender="bot"`

### 📡 Integração:
- ✅ 8 etapas criadas em `kanban_stages` com títulos em UPPERCASE
- ✅ AI Service atualizado: apenas 4 etapas permitidas
- ✅ Contract Reminder job implementado em `automationService.ts`
- ✅ Cron job roda a cada 30 segundos
- ✅ Testes confirmados:
  - "Ok, topa!" → **PROPOSTA** ✅
  - "Qual preço?" → **CONTATO** ✅
  - "Deixe seu contato" → **FORNECEDOR** ✅
  - "Não quero" → **PERDIDO** ✅

### 🎯 Próximas Fases:
1. Integração WhatsApp para enviar reminders de contrato via WhatsApp
2. Dashboard mostrando métricas de propostas pendentes
3. Configuração de templates customizáveis para mensagens de reminder

---

**Status:** ✅ IA LIMITADA A 4 ETAPAS + CONTRACT REMINDER OPERACIONAL
