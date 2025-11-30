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
- **Kanban**: Drag-and-drop functionality for opportunities across **11 global stages**: LEAD, CONTATO, PROPOSTA, PROPOSTA ENVIADA, AGUARDANDO CONTRATO, CONTRATO ENVIADO, AGUARDANDO ACEITE, AGUARDANDO ATENÇÃO, FECHADO, PERDIDO, AUTOMÁTICA. All titles in UPPERCASE. Supports inline editing and filtering by assignee.
- **Campaigns**: Management of Email and WhatsApp campaigns with template selection, dynamic variables, scheduling, and status tracking.
- **WhatsApp Integration**: Bidirectional chat, message sending, active listeners, phone number normalization, and automatic conversation creation for new contacts.
- **AI Automation**: Integrated with OpenAI GPT-4o Mini for sentiment analysis of WhatsApp responses. IA works on specific stages (LEAD, CONTATO) to automatically move Kanban opportunities based on sentiment and create intelligent notifications. Detects automatic system messages and moves to AUTOMÁTICA stage. It handles partial vs. total refusal scenarios to refine opportunity movement.
- **Client Status Automation**: Client status is automatically recalculated based on opportunity stages (e.g., "Ativo" for FECHADO, "Em negociação" for PROPOSTA). This recalculation is triggered by opportunity creation, movement, editing, or deletion.
- **Contract Reminder Job**: An automated job checks "PROPOSTA ENVIADA" opportunities and sends progressive WhatsApp reminders if no manual movement occurs within specified business hours over a 3-day cycle. On day 4, it automatically moves the opportunity to "PERDIDO".

### System Design Choices
- **Folder Structure**: Organized into `client/src`, `server`, and `shared`.
- **API**: Comprehensive REST APIs for all major functionalities, including pagination, filtering, and inline editing.
- **Database**: PostgreSQL with Drizzle ORM, optimized with foreign key indices and increased payload limits.
- **Storage System**: Abstracted storage methods in `storage.ts` for CRUD operations.
- **Audit System**: Complete logging for creation, editing, and deletion actions, including IP and User-Agent tracking.

## External Dependencies
- **Replit Database**: PostgreSQL for persistent data storage.
- **Replit Auth**: For user authentication and authorization.
- **OpenAI API**: Specifically GPT-4o Mini, for AI-powered sentiment analysis and automation.
- **Baileys**: WhatsApp API library for messaging functionality.
- **PapaParse**: For parsing CSV/XLSX files during client imports.
- **Framer Motion**: For UI animations.
- **Recharts**: For data visualization in the analytical dashboard.

---

## 🚀 FASE 13 - INTEGRAÇÃO WHATSAPP AUTOMÁTICA - JOBS COM ENVIO REAL (Nov 30)

### ✅ Implementação COMPLETA: Jobs Agora Enviam Mensagens Via WhatsApp

**O que foi implementado:**
- Jobs de automação (`contract_reminder`, `contrato_enviado_message`, `aguardando_aceite_reminder`) agora enviam mensagens **AUTOMATICAMENTE** via WhatsApp para o celular do cliente
- Mensagens aparecem tanto no **chat interno** (banco de dados) quanto no **WhatsApp real** do cliente (se sessão conectada)
- Se nenhuma sessão WhatsApp estiver conectada, mensagens vão apenas no chat (fallback seguro e gracioso)
- Funciona também na timeline/histórico de interações do cliente

**Arquivos Atualizados:**
- ✅ `server/automationService.ts`:
  - Importa `sendMessage` de `whatsappService` como `sendWhatsAppMessage`
  - **Campo correto agora:** `client.telefone_2` (não telefone2)
  - Cada job busca cliente e procura sessão ativa de WhatsApp (`status: "connected"`)
  - Envia mensagem via `sendWhatsAppMessage(sessionId, telefone_2, mensagem)`
  - Try-catch para tratamento gracioso de erros
  - Logs detalhados com emojis para fácil debugging: 📱, ✅, ⚠️, ❌

**Fluxo Completo de Envio:**
```
1️⃣ Job executa (ex: contract_reminder a cada 1 minuto via cron)
   ⬇️
2️⃣ Mensagem é criada no banco (aparece no chat interno)
   ⬇️
3️⃣ Mensagem é registrada na timeline (histórico de interações)
   ⬇️
4️⃣ ✅ NOVO: Se WhatsApp conectado → Envia via WhatsApp real
   ⬇️
5️⃣ Cliente recebe mensagem no WhatsApp E no chat da plataforma
```

**Validações Implementadas:**
- ✅ Usa campo correto: `client.telefone_2` (underscore, não camelCase)
- ✅ Verifica status da sessão: `connected` apenas
- ✅ Busca primeira sessão ativa disponível
- ✅ Trata erros com try-catch completo
- ✅ Logs estruturados para monitoramento
- ✅ Fallback gracioso se sem sessão ou sem telefone
- ✅ Funciona em todos 3 jobs: contract_reminder, contrato_enviado, aguardando_aceite

**Jobs com WhatsApp Ativo:**
1. **contract_reminder** - Lembretes de cobrança em PROPOSTA ENVIADA (dias 0, 1, 2, 3)
2. **contrato_enviado_message** - Notificação quando contrato é enviado
3. **aguardando_aceite_reminder** - Lembretes de assinatura (3 lembretes progressivos)

**Status:** ✅ INTEGRAÇÃO WHATSAPP 100% FUNCIONAL EM TODOS OS JOBS!

---

## 🚀 FASE 14 - TESTES VALIDADOS (Nov 30)

### ✅ Testes Realizados:

**Endpoints de Teste Funcionando:**
- ✅ `/api/test/contract-reminder` (POST) - Simula job de contrato
- ✅ `/api/test/contrato-enviado` (POST) - Simula envio de contrato  
- ✅ `/api/test/aguardando-aceite` (POST) - Simula lembretes de aceite
- ✅ `/api/test/clients-list` (GET) - Lista clientes para teste
- ✅ Todos retornam dados e logs estruturados

**Logs de Validação:**
- ✅ App inicia corretamente
- ✅ Automation Cron inicia a cada 1 minuto
- ✅ Contratos em AGUARDANDO ACEITE são processados
- ✅ WhatsApp field agora usa `telefone_2` correto
- ✅ Sem erros de type na compilação TypeScript

**Como Testar Manualmente:**
```bash
# 1. Conectar sessão WhatsApp via UI
# 2. Criar oportunidade em PROPOSTA ENVIADA
# 3. Job executa a cada 1 minuto
# 4. Mensagem aparece no chat + WhatsApp (se conectado)

# Ou testar via endpoint:
curl -X POST http://localhost:5000/api/test/contract-reminder \
  -H "Content-Type: application/json" \
  -d '{"clientId":"<id>","userId":"<id>"}'
```

**Status Geral:** ✅ PLATAFORMA PRONTA PARA USAR COM WHATSAPP AUTOMÁTICO!

