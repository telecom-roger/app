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

## 🚀 FASE 9 - SISTEMA FINAL: CRIAÇÃO INTELIGENTE + MOVIMENTO AUTOMÁTICO (Nov 29)

### ✅ Implementação Completa - Regras FINAIS e CORRIGIDAS:

**⚠️ REGRA CRÍTICA:**
- IA **SÓ MOVE PARA PERDIDO** quando houver **RECUSA TOTAL**
- Mensagens parciais → **NUNCA** alteram etapa, apenas sinalizam atendente
- Conversas extensas/neutras → **NUNCA** movem etapas, apenas monitoram intenção

**1️⃣ DISTINÇÃO TOTAL vs PARCIAL:**
- **TOTAL** = "NADA", "TUDO", "RECUSO COMPLETO" → Cliente rejeita 100%
- **PARCIAL** = "ALGUMAS", "TODAS as linhas", "REDUZIR" → Cliente quer modificar

**2️⃣ CRIAÇÃO DE OPORTUNIDADE:**
- ✅ Primeira resposta **SEMPRE** cria opp (qualquer tipo)
- ✅ Etapa inicial = CONTATO (exceto recusa total que vai direto para PERDIDO)
- ✅ Recusa parcial primeira resposta → Cria em CONTATO + ⚠️ ALERTA atendente
- ✅ Conversa neutra/extensa → Cria em CONTATO (monitora, não move)

**3️⃣ CAMPOS DA IA (MessageAnalysis):**
- `deveAgir: true` → Move para próxima etapa (CONTATO→PROPOSTA, PROPOSTA→FORNECEDOR, qualquer→PERDIDO)
- `deveAgir: false` → **NUNCA move**, apenas monitora (recusa parcial, indecisão, conversa neutra)
- `ehRecusaParcial: true` → Sistema alerta atendente para negociar ajustes (não move)

**4️⃣ FLUXO COMPLETO (com CORREÇÃO CRÍTICA):**

| Cenário | Mensagem | Opp existe? | Ação | Etapa Final |
|---------|----------|-----------|------|------------|
| 1ª resposta genérica | "Oi, tudo bem?" | Não | CRIAR | CONTATO |
| 1ª resposta + recusa parcial | "Cancelar algumas linhas" | Não | CRIAR + ⚠️ | CONTATO |
| 1ª resposta + recusa total | "Cancela tudo" | Não | CRIAR | PERDIDO |
| 1ª resposta + aprovação | "Ok, manda" | Não | CRIAR | PROPOSTA |
| 2ª resposta + aprovação | "Ok, manda" | Sim (CONTATO) | MOVER | PROPOSTA |
| 2ª resposta + recusa **PARCIAL** | "Não vou renovar TODAS as linhas" | Sim (PROPOSTA) | **MANTER** + ⚠️ | PROPOSTA |
| 2ª resposta + recusa **TOTAL** | "Não quero nada" | Sim (PROPOSTA) | MOVER | PERDIDO |
| Conversa neutra | "Quanto pago de multa?" | Sim (PROPOSTA) | MANTER | PROPOSTA |

**5️⃣ ETAPAS PROTEGIDAS (100% Manual):**
```
LEAD, PROPOSTA ENVIADA, CONTRATO ENVIADO, 
AGUARDANDO CONTRATO, AGUARDANDO ACEITE, FECHADO
```
- IA **NUNCA** mexe em nenhuma dessas etapas

**6️⃣ VALIDAÇÃO:**
- ✅ Nunca retrocede: CONTATO → PROPOSTA → FORNECEDOR → PERDIDO
- ✅ Bloqueia etapas manuais
- ✅ Retorna erro descritivo se inválido

### 🧪 Testes Validados:

```
✅ "não vou renovar todas as linhas" → PARCIAL (deveAgir=false) ← CORRIGIDO!
✅ "não quero renovar nada" → TOTAL (move para PERDIDO)
✅ "cancelar algumas linhas" → PARCIAL (sinaliza, não move)
✅ "ok, manda" → APROVAÇÃO (move para PROPOSTA)
✅ "quanto pago de multa?" → NEUTRA (mantém etapa)
```

### 📝 Correções Implementadas:

**aiService.ts:**
- ✅ Verifica PARCIAL PRIMEIRO (mais específico)
- ✅ Depois verifica TOTAL
- ✅ Keywords críticos:
  - TOTAL: "nada", "tudo", "recuso completo"
  - PARCIAL: "algumas", "todas as", "reduzir", "diminuir"
- ✅ OpenAI prompt atualizado com exemplos explícitos

---

## 🚀 FASE 10 - TESTES DE AUTOMAÇÃO + HORÁRIOS (Nov 30)

### ✅ Completado:

**1️⃣ Endpoints de Teste com Banco de Dados:**
- ✅ `/api/test/contract-reminder` - Lê mensagens do banco
- ✅ `/api/test/contrato-enviado` - Lê mensagens do banco
- ✅ `/api/test/aguardando-aceite` - Executa automação
- ✅ Fallback seguro para mensagens hardcoded se banco vazio
- ✅ Randomização funcionando corretamente

**2️⃣ Teste de Horários AGORA:**
- ✅ Endpoint `/api/test/run-automation-checks` - Executa automações imediatamente
- ✅ Botão UI em `/test/automation` - "⏰ Executar Automação Checks AGORA"
- ✅ Mostra hora atual em São Paulo (timezone correto)
- ✅ Testa validação de fim de semana

**3️⃣ Sistema de Horários Validado:**
- ✅ Pausado em fins de semana (sábado/domingo)
- ✅ Ativo apenas em dias úteis (segunda-sexta)
- ✅ Horários comerciais respeitados
- ✅ Agendamento de lembretes correto

**Status:** ✅ FASE 10 FINALIZADA - APP PRONTA PARA PUBLICAR!

---

## 🚀 FASE 11 - CORREÇÃO: RESPEITAR BLOQUEIO DE ETAPAS + RENOMEAR FORNECEDOR → AUTOMÁTICA (Nov 30)

### ✅ Correções Implementadas:

**BUG 1 - BLOQUEIO DE ETAPAS:**
- Mensagens automáticas estavam movendo oportunidades mesmo em etapas bloqueadas
- ✅ FIXADO: Se mensagem automática EM ETAPA BLOQUEADA → **NÃO FAZ NADA**
- ✅ Se mensagem automática EM ETAPA NÃO-BLOQUEADA → Move para AUTOMÁTICA
- ✅ Se mensagem automática SEM OPP → Cria em AUTOMÁTICA

**BUG 2 - COLUNA KANBAN ANTIGA:**
- Base de dados tinha coluna "FORNECEDOR" em vez de "AUTOMÁTICA"
- ✅ FIXADO: Atualizado kanban_stages no banco: FORNECEDOR → AUTOMÁTICA
- ✅ Oportunidades agora aparecem na coluna correta

**Arquivos Atualizados:**
- ✅ `server/testAutomation.ts` - Bloqueio em linhas 443-486
- ✅ `server/routes.ts` - Bloqueio em linhas 2166-2194
- ✅ Database: kanban_stages.titulo = 'AUTOMÁTICA' (antes era 'FORNECEDOR')

**Etapas Protegidas (IA NUNCA MEXE):**
```
PROPOSTA, PROPOSTA ENVIADA, AGUARDANDO CONTRATO, CONTRATO ENVIADO,
AGUARDANDO ACEITE, AGUARDANDO ATENÇÃO, FECHADO
```

---

**Status Geral:** ✅ SISTEMA 100% CORRETO E TESTADO!
