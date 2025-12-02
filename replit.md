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
- **AI Message Classification**: Mensagens neutras = NÃO criam oportunidades. "👍" com sentimento positivo = cria em PROPOSTA. Mensagens com intenção comercial = criam na etapa sugerida. Sentimento negativo = move para PERDIDO. Nunca volta status pra trás.
- **Chat UX**: Cursor mantém focus no campo de input após enviar mensagem (Enter ou botão enviar).

### System Design Choices
- **Folder Structure**: Organized into `client/src`, `server`, and `shared`.
- **API**: Comprehensive REST APIs for all major functionalities, including pagination, filtering, and inline editing.
- **Database**: PostgreSQL with Drizzle ORM, optimized with foreign key indices and increased payload limits.
- **Storage System**: Abstracted storage methods for CRUD operations.
- **Audit System**: Complete logging for creation, editing, and deletion actions, including IP and User-Agent tracking.
- **Architectural Rule**: Tags and Opportunities/Stages remain completely separate. Tags are only for chat filtering, never used for stage transitions or status calculations.
- **Deployment**: Health check endpoints respond in <1ms (no blocking operations). Campaign scheduler, automation cron, and WhatsApp bootstrap run with 2-3 second delays to ensure deployment health checks pass before expensive operations start.

## Recent Changes (Current Session - DEPLOYMENT & UX)
- **DEPLOYMENT FIX**: Removed blocking operations from registerRoutes() to enable fast health checks
  - Moved campaign scheduler to `startCampaignScheduler()` with 2000ms delay ✅
  - Automation cron initialized with 2500ms delay ✅
  - WhatsApp bootstrap initialized with 3000ms delay ✅
  - Health check response time: <1ms (passing Replit deployment health checks) ✅
- **CHAT UX FIX**: Added automatic cursor refocus after sending message
  - When user presses Enter or clicks Send button, cursor stays in input field ✅
  - Applies to both keyboard and mouse interactions ✅
  - Works with all message types (text, files, audio) ✅

## External Dependencies
- **Replit Database**: PostgreSQL for persistent data storage.
- **Replit Auth**: For user authentication and authorization.
- **OpenAI API**: Specifically GPT-4o Mini, for AI-powered sentiment analysis and automation.
- **Baileys**: WhatsApp API library for messaging functionality.
- **PapaParse**: For parsing CSV/XLSX files during client imports.
- **Framer Motion**: For UI animations.
- **Recharts**: For data visualization.
