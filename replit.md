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
- **Kanban**: Drag-and-drop functionality for opportunities across **9 global stages** (LEAD, CONTATO, PROPOSTA, PROPOSTA ENVIADA, AGUARDANDO CONTRATO, AGUARDANDO ACEITE, FECHADO, PERDIDO, FORNECEDOR). All titles in UPPERCASE. Supports inline editing and filtering by assignee.
- **Campaigns**: Management of Email and WhatsApp campaigns with template selection, dynamic variables, scheduling, and status tracking.
- **WhatsApp Integration**: Bidirectional chat, message sending, active listeners, phone number normalization (removes 55 prefix for storage), automatic conversation creation for new contacts, and voice note support.
- **AI Automation**: Integrated with OpenAI GPT-4o Mini for sentiment analysis of WhatsApp responses. **IA now works ONLY on 5 stages**: CONTATO, PROPOSTA, FORNECEDOR, FECHADO, PERDIDO. Other stages (LEAD, PROPOSTA ENVIADA, AGUARDANDO CONTRATO, AGUARDANDO ACEITE) are manual-only. Automatically moves Kanban opportunities based on sentiment and creating intelligent notifications.

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

## 🚀 FASE 6 - KANBAN 9 ETAPAS + IA 5 ESTÁGIOS + CONTRACT REMINDER (Nov 28, 18:45)

### ✅ Kanban Stages (9 total - REORDENADAS):
1. **LEAD** (0) - Manual
2. **CONTATO** (1) - IA trabalha aqui
3. **PROPOSTA** (2) - IA trabalha aqui
4. **PROPOSTA ENVIADA** (3) - Manual
5. **AGUARDANDO CONTRATO** (4) - Nova etapa! Manual
6. **AGUARDANDO ACEITE** (5) - Manual
7. **FECHADO** (6) - Manual
8. **PERDIDO** (7) - IA trabalha aqui
9. **FORNECEDOR** (8) - IA trabalha aqui

### 🤖 IA Trabalha em 5 Etapas:
1. **CONTATO** - "PREÇO", "VALOR", "QUANTO", "CUSTA" → Quer informações
2. **PROPOSTA** - "OK", "SIM", "TOPA", "MANDA" → Aprovação
3. **FORNECEDOR** - Mensagens automáticas, "DEIXE SEU CONTATO", "BREVE", etc
4. **FECHADO** - "CONTRATADO", "APROVADO" → Negócio fechado
5. **PERDIDO** - "NÃO", "RECUSO", "CANCELAR" → Rejeição

### 📋 Contract Reminder Job (PROPOSTA ENVIADA):
**Regra de Negócio:**
- ⏰ Verifica se passou **2h** sem movimento manual para AGUARDANDO ACEITE
- 📲 Se passado 2h: envia cobrança natural via WhatsApp/chat
- 🕐 **Horários comerciais**: 08:00, 11:50, 17:00 (São Paulo)
- 📅 **Ciclo**: 3 dias com reenvios nos horários acima
- ❌ **Dia 4**: Auto-move para PERDIDO com timeline: *"Cliente tinha interesse em renovar mas não finalizou"*

**Mensagens Progressivas (naturais, não-robóticas):**
- Dia 0: "Oi [Nome], tudo bem? Recebemos a proposta aqui com sucesso. Pode confirmar o recebimento pra gente?"
- Dia 1: "[Nome], só para confirmar se chegou tudo bem aí. Ficou com alguma dúvida sobre a proposta?"
- Dia 2: "[Nome], podemos seguir com a melhoria que ofertamos? Vamos fechar isso aí?"
- Dia 3: "Última tentativa, [Nome]. Vamos seguir com a contratação? Estamos aqui pra ajudar!"

### 📡 Implementação:
- ✅ 9 etapas do Kanban criadas com lazy initialization em `storage.ts`
- ✅ AI Service atualizado para 5 estágios (CONTATO, PROPOSTA, FORNECEDOR, FECHADO, PERDIDO)
- ✅ Contract Reminder job em `automationService.ts` com:
  - `executeContractReminder()` - Envia mensagens naturais progressivas
  - `checkPropostaEnviadaTimeouts()` - Verifica 2h timeout + horários comerciais + 3 dias + auto-move PERDIDO
- ✅ Cron job roda a cada 30 segundos
- ✅ Testes confirmados

### 🎯 Próximas Fases:
1. WhatsApp integration para enviar reminders via WA ao invés de apenas chat
2. Dashboard mostrando métricas de propostas pendentes
3. Configuração de templates customizáveis para mensagens de reminder
4. Integração com Google Calendar para reagendar followups

---

**Status:** ✅ FASE 6 COMPLETA - Kanban 9 etapas + IA 5 estágios + Contract Reminder com horários comerciais e ciclo 3 dias OPERACIONAL
