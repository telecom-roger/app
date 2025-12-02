# Plataforma de Atendimento Inteligente

## Overview
This project is a comprehensive platform designed to manage over 500,000 telecommunications customers. It integrates a CRM, mass communication capabilities (WhatsApp/Email), a sales Kanban, AI-powered automation, and scheduled campaign management. The platform aims to streamline customer interaction, sales processes, and communication for telecom operators, enhancing efficiency and customer retention.

## User Preferences
- **Communication Style**: Please use clear, simple, and direct language.
- **Workflow**: I prefer an iterative development approach.
- **Interaction**: Ask for confirmation before implementing major changes or architectural decisions.
- **Code Changes**: Do not make changes to the `shared/schema.ts` file without explicit instruction.
- **Explanations**: Provide detailed explanations for complex features or architectural choices.

## System Architecture

### UI/UX
The application features a professional design system utilizing a deep dark blue (`#1A0B41`) as the primary color and a vibrant purple (`#7069FF`) for CTAs and buttons. The UI is fully responsive across mobile, tablet, and desktop, incorporating smooth animations and accessibility features.

### Technical Implementations
- **Frontend**: React 18 with TypeScript, Vite, Wouter for routing, TanStack Query for data fetching, Tailwind CSS with Shadcn/UI components, and Lucide React for icons.
- **Backend**: Node.js with Express.js and TypeScript, PostgreSQL (Replit Database), Drizzle ORM, and Replit Auth for authentication. Background job processing handles scheduled campaigns and automated reminders.
- **Data Model**: Key entities include `users`, `clients`, `opportunities`, `campaigns`, `templates`, `conversations`, `messages`, `whatsappSessions`, and global `kanban_stages`.
- **Authentication**: Replit Auth with local Passport strategy (email + bcrypt) and role-based access control (Admin, Gerente, Agente).
- **CRM**: Full CRUD for clients with 16 custom telecom fields, contact management, tagging, lead scoring, interaction timeline, and advanced search/filters.
- **Client Import**: A 4-step wizard supports CSV/XLSX imports with interactive column mapping, Brazilian phone normalization, duplicate detection, and detailed validation reports.
- **Kanban**: Drag-and-drop functionality for opportunities across 11 global stages (LEAD, CONTATO, PROPOSTA, PROPOSTA ENVIADA, AGUARDANDO CONTRATO, CONTRATO ENVIADO, AGUARDANDO ACEITE, AGUARDANDO ATENÇÃO, FECHADO, PERDIDO, AUTOMÁTICA). Supports inline editing and filtering by assignee.
- **Campaigns**: Management of Email and WhatsApp campaigns with template selection, dynamic variables, scheduling, and status tracking. The WhatsApp campaign client selector features server-side pagination (50 per page), debounced search (300ms), compact inline layout, and "Load More" pattern for handling 500k+ clients efficiently. Campaign timing is fully customizable with three parameters: `tempoFixoSegundos` (base delay, default 70s), `tempoAleatorioMin` (minimum random delay, default 30s), and `tempoAleatorioMax` (maximum random delay, default 60s). Total delay between messages = fixed + random(min to max). Defaults are optimized for scheduled campaigns; manual campaigns via API can override these values per execution.
- **WhatsApp Integration**: Bidirectional chat, message sending, active listeners, phone number normalization, and automatic conversation creation for new contacts via Baileys. WhatsApp session status is correctly persisted to database on connect/disconnect events.
- **AI Automation**: Integrated with OpenAI GPT-4o Mini for sentiment analysis of WhatsApp responses, automatically moving Kanban opportunities based on sentiment and creating intelligent notifications. It handles partial vs. total refusal scenarios and identifies automatic system messages. It also supports multi-vendor isolation, ensuring each salesperson manages their own opportunities, and facilitates new sales cycles for clients previously in "FECHADO" or "PERDIDO" status by creating new opportunities.
- **Client Status Automation**: Client status (`ativo`, `lead_quente`, `engajado`, `em_negociacao`, `em_fechamento`, `perdido`, `remarketing`) is automatically recalculated based on opportunity stages. A new "REMARKETING" status identifies reconverted clients. The `statusComercial` field was consolidated into a single `status` field for clarity and efficiency.
- **Contract Reminder Job**: An automated job sends progressive WhatsApp reminders for "PROPOSTA ENVIADA" opportunities, eventually moving them to "PERDIDO" if no manual action is taken.
- **Tags System**: Tags are completely separate from opportunity stages. Tags are used exclusively for chat filtering and conversation organization. They do NOT affect opportunity stages, client status, or kanban board. When an opportunity stage changes, tags remain untouched.
- **AI Message Classification (NOVO - ATUALIZADO)**: 
  - Mensagens neutras ("teste", "oi", "bom dia", "blz", "kkk") = NÃO criam oportunidades ✅
  - "👍" com sentimento positivo = Aprova (pode criar em PROPOSTA) ✅
  - Mensagens com intenção comercial = Criam na etapa sugerida pela IA (CONTATO ou PROPOSTA)
  - Se IA sugere PROPOSTA (confiança alta) → cria direto em PROPOSTA ✅
  - Se IA sugere CONTATO → cria em CONTATO
  - Sentimento positivo + intenção = Aprova e avança funil
  - Sentimento negativo = Move para PERDIDO
  - Nunca volta status pra trás (ex: PROPOSTA → CONTATO)

### System Design Choices
- **Folder Structure**: Organized into `client/src`, `server`, and `shared`.
- **API**: Comprehensive REST APIs for all major functionalities, including pagination, filtering, and inline editing.
- **Database**: PostgreSQL with Drizzle ORM, optimized with foreign key indices and increased payload limits.
- **Storage System**: Abstracted storage methods for CRUD operations.
- **Audit System**: Complete logging for creation, editing, and deletion actions, including IP and User-Agent tracking.
- **Architectural Rule**: Tags and Opportunities/Stages remain completely separate. Tags are only for chat filtering, never used for stage transitions or status calculations.

## Recent Changes (Current Session)
- **REGRAS DE CRIAÇÃO DE OPORTUNIDADES** (9 validações):
  1. ✅ Apenas mensagens do cliente (incoming)
  2. ✅ Não está respondendo pergunta do atendente
  3. ✅ Mensagem em LISTA DE PROPOSTA ou CONTATO (ou intenção comercial clara)
  4. ✅ Mensagem NÃO em lista neutra
  5. ✅ Nunca 2+ opps ativas por cliente (1 por vez!)
  6. ✅ Se já existe opp aberta → atualiza, não cria
  7. ✅ Validação: deveAgir=true + etapa válida
  8. ✅ Etapa não pode ser AUTOMÁTICA ou vazia
  9. ✅ Detecção de mensagens de fluxo do atendente (nome, CPF, email, etc)
- **CLASSIFICAÇÃO REFATORADA** com 4 passos explícitos:
  1. Verificar se é NEUTRA → NÃO cria
  2. Verificar se é AÇÃO (OK, 👍) → Cria PROPOSTA
  3. Verificar INTENÇÃO FRACA → Cria CONTATO
  4. Se não nas listas, consultar IA para intenção comercial clara
- **LISTA PROPOSTA**: "ok", "okk", "okkk", "OK", "joia", "👍", "👌", "sim", "blz", "beleza", "manda", "pode mandar", "envia", "me manda"
- **LISTA CONTATO**: "quero saber mais", "como funciona?", "pode me explicar?", "qual operadora é melhor?"
- **LISTA NEUTRA**: "oi", "eae", "bom dia", "boa tarde", "kkk", "teste", "valeu", "obrigado", "🙌", "🙏"

## Recent Changes (Current Session)
- **MAJOR REFACTOR**: Complete classification logic overhaul with explicit rules
  - **LISTA PROPOSTA** (SEMPRE cria PROPOSTA):
    - "ok", "okk", "okkk", "OK", "joia", "👍", "👌", "sim", "blz", "beleza", "manda", "pode mandar", "envia", "me manda" ✅
  - **LISTA CONTATO** (cria CONTATO):
    - "quero saber mais", "como funciona?", "pode me explicar?", "qual operadora é melhor?" ✅
  - **LISTA NEUTRA** (NÃO cria):
    - "oi", "eae", "bom dia", "boa tarde", "kkk", "teste", "valeu", "obrigado", "🙌", "🙏" ✅
  - **Ordem de execução obrigatória**:
    1. Verificar se é neutra → não cria ✅
    2. Verificar se é ação (OK, 👍, etc) → cria PROPOSTA ✅
    3. Verificar intenção fraca → cria CONTATO ✅
    4. Se já existe opp → atualizar ✅
    5. Se cliente ativo → criar nova opp ✅
- **CRITICAL BUG FIX #5**: Removed "tudo bem" from aprovacao keywords
  - "Tudo bem?" era criando oportunidade em PROPOSTA (ERRADO) ❌
  - Agora "tudo bem" está em mensagens neutras puras ✅
  - "Tudo bem?" = mensagem neutra, não cria opp ✅
- **FEATURE UPDATE #1**: Opportunity creation now respects IA suggestion for etapa
  - Se IA sugere PROPOSTA → cria direto em PROPOSTA ✅
  - Se IA sugere CONTATO → cria em CONTATO ✅
  - Etapa padrão mantém CONTATO se IA não sugerir ✅
- **CRITICAL BUG FIX #4**: Fixed IA neutral message classification (FINAL FIX)
  - "oi", "teste", "blz", "kkk", "tudo bem" → neutro/indefinida/deveAgir=false ✅
  - "👍" com sentimento positivo → pode criar em PROPOSTA ✅
  - ZERO mensagens neutras puras criam oportunidades ✅
  - Bloqueio ocorre ANTES de qualquer criação ✅
- **CRITICAL BUG FIX #3**: Fixed AI classification - now respects message intention vs neutral
  - Mensagens neutras NÃO criam oportunidades ✅
  - Apenas mensagens com intenção comercial avançam o funil ✅
  - Validação: `deveAgir === false` não cria mais opp automática ✅
- **CRITICAL BUG FIX #2**: Fixed tag/stage coupling - removed code that was updating tags when stages changed
- Previously corrected `recalculateClientStatus()` implementation to properly persist status changes
- Tags now remain completely independent of opportunity stages (tags for chat filtering only)

## External Dependencies
- **Replit Database**: PostgreSQL for persistent data storage.
- **Replit Auth**: For user authentication and authorization.
- **OpenAI API**: Specifically GPT-4o Mini, for AI-powered sentiment analysis and automation.
- **Baileys**: WhatsApp API library for messaging functionality.
- **PapaParse**: For parsing CSV/XLSX files during client imports.
- **Framer Motion**: For UI animations.
- **Recharts**: For data visualization.
