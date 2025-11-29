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
- **Kanban**: Drag-and-drop functionality for opportunities across **10 global stages** (LEAD, CONTATO, PROPOSTA, PROPOSTA ENVIADA, CONTRATO ENVIADO, AGUARDANDO CONTRATO, AGUARDANDO ACEITE, FECHADO, PERDIDO, FORNECEDOR). All titles in UPPERCASE. Supports inline editing and filtering by assignee.
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

## 🚀 FASE 6 - KANBAN 10 ETAPAS + IA 5 ESTÁGIOS + CONTRACT REMINDER (Nov 28, 19:00)

### ✅ Kanban Stages (10 total - FINAIS):
1. **LEAD** (0) - Manual apenas
2. **CONTATO** (1) - IA trabalha aqui
3. **PROPOSTA** (2) - IA trabalha aqui
4. **PROPOSTA ENVIADA** (3) - Manual + Job automático
5. **CONTRATO ENVIADO** (4) - Manual - Novo estágio!
6. **AGUARDANDO CONTRATO** (5) - Manual
7. **AGUARDANDO ACEITE** (6) - Manual
8. **FECHADO** (7) - Manual
9. **PERDIDO** (8) - IA trabalha aqui
10. **FORNECEDOR** (9) - IA trabalha aqui

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

### 🧪 Teste Endpoint (1 MINUTO TIMEOUT):
**Endpoint:** `POST /api/test/contract-reminder`
```json
{
  "clientId": "1b67afd8-b174-4d57-a386-43e6eae28945",
  "userId": "187f6e5e-e5b9-4232-9dac-42296aa84414"
}
```
**O que faz:**
- ✅ Cria opportunity em PROPOSTA ENVIADA com timestamp 1 minuto atrás
- ✅ Executa job de Contract Reminder imediatamente
- ✅ Retorna mensagens enviadas e tasks criadas
- ✅ Perfeito para testar na página de testes!

### 📡 Implementação Completa:
- ✅ 9 etapas do Kanban criadas com lazy initialization em `storage.ts`
- ✅ AI Service atualizado para 5 estágios (CONTATO, PROPOSTA, FORNECEDOR, FECHADO, PERDIDO)
- ✅ Contract Reminder job em `automationService.ts` com:
  - `executeContractReminder()` - Envia mensagens naturais progressivas
  - `checkPropostaEnviadaTimeouts()` - **EXPORTADA** para reutilização
- ✅ Novo endpoint `/api/test/contract-reminder` em `routes.ts`
- ✅ Cron job roda a cada 30 segundos (2h real, 1 minuto nos testes)
- ✅ Pronto para testar na página de testes do frontend

### 🎯 Próximas Fases:
1. Integração WhatsApp para enviar reminders via WA
2. Dashboard mostrando métricas de propostas pendentes
3. Configuração de templates customizáveis
4. Calendário/reagendamento de followups

---

## 🚀 FASE 7 - AUTOMAÇÃO DE STATUS DO CLIENTE (Nov 29, turno 9)

### ✅ Implementação Completa:
1. **Função de Recalculation** em `storage.ts`:
   - `recalculateClientStatus(clientId)` - Calcula status baseado nas oportunidades
   - `getOpportunitiesByClientId(clientId)` - Busca todas as opps do cliente

2. **Integração nos 4 Endpoints** em `routes.ts`:
   - `POST /api/opportunities` (criar) - Recalcula status ao criar opp
   - `PATCH /api/opportunities/:id/move` (mover Kanban) - Recalcula ao mover de etapa
   - `PATCH /api/opportunities/:id` (editar) - Recalcula se etapa mudar
   - `DELETE /api/opportunities/:id` (deletar) - Recalcula ao remover opp

3. **Regras de Status** (Totalmente Automático):
   - **Sem oportunidades** → Lead quente
   - **Etapa mais avançada**:
     - FECHADO → Ativo
     - AGUARDANDO ACEITE/CONTRATO ENVIADO/AGUARDANDO CONTRATO → Em fechamento
     - PROPOSTA/PROPOSTA ENVIADA → Em negociação
     - CONTATO → Engajado
     - LEAD → Lead quente
   - **Todas PERDIDAS** → Perdido
   - **PERDIDO não eleva status** (ignorado na lógica)

4. **Endpoint de Teste**:
   - `POST /api/test/client-status-automation` - Testa recalculation manual
   - Integrado na página `/test/automation` (Seção 6️⃣)

5. **UI na Página de Teste**:
   - Novo botão: "🔄 Recalcular Status"
   - Mostra: Status antes/depois, lista de opps do cliente, mensagem de mudança
   - Cores: Verde se mudou, Amarelo se inalterado

### 🎯 Como Testar:
**Opção 1 - Manual no Kanban:**
1. Selecione um cliente com oportunidades
2. Mude a etapa de uma opp (drag-and-drop)
3. Abra o cliente em /clientes/ID
4. Veja o STATUS no lado direito (deve ter mudado AUTOMATICAMENTE!)

**Opção 2 - Via Página de Teste:**
1. Acesse /test/automation
2. Selecione um cliente
3. Clique "🔄 Recalcular Status"
4. Veja o resultado com todas as oportunidades do cliente

### 📊 Lógica de Prioridade (Ordem do Kanban):
- 0: FECHADO (qualquer um garante "Ativo")
- 1: AGUARDANDO ACEITE
- 2: CONTRATO ENVIADO
- 3: AGUARDANDO CONTRATO
- 4: PROPOSTA ENVIADA
- 5: PROPOSTA
- 6: CONTATO
- 7: LEAD
- 8: PERDIDO (ignorado, não eleva)

### 🔧 Cobertura Total de Gatilhos (Todos Recalculam Status):
1. **IA cria oportunidade** → Status atualizado ✅
2. **Usuário cria via Form** → Status atualizado ✅
3. **Usuário move no Kanban** → Status atualizado ✅
4. **Usuário edita oportunidade** → Status atualizado ✅
5. **Usuário deleta oportunidade** → Status atualizado ✅
6. **Teste manual (botão)** → Mostra resultado imediato ✅

### 🔄 OPÇÃO B - IA MOVE OPP EXISTENTE + VALIDAÇÃO RIGOROSA (Nov 29)

**Quando a IA processa múltiplas mensagens do mesmo cliente:**

1. **1ª mensagem** ("oi tudo bem?") → Cria OPP em CONTATO
2. **2ª mensagem** ("ok me envia proposta") → **MOVE** OPP de CONTATO → PROPOSTA (não cria nova!)
3. **Kanban fica limpo** - Uma única opp que evolui

**Lógica:**
- IA busca se existe opp "aberta" (não PERDIDA, não FECHADO)
- Se existe → **VALIDA MOVIMENTO** (nunca retrocede, respeita manuais)
- Se movimento válido → MOVE para nova etapa
- Se não válido → BLOQUEIA com mensagem clara
- Se não existe → Cria normalmente
- Status recalcula automaticamente em qualquer caso

**🤖 IA trabalha em 4 etapas APENAS (não mexe nas outras):**
1. **CONTATO** - Cliente quer informações (preço, valor, quanto custa)
2. **PROPOSTA** - Cliente aprova (ok, sim, manda, pode enviar, quero renovar)
3. **FORNECEDOR** - Mensagens automáticas (deixe seu contato, breve, aguarde)
4. **PERDIDO** - Recusa TOTAL (não quero renovar, cancela tudo, não tenho interesse)

**❌ Etapas 100% MANUAIS (IA NUNCA mexe):**
- LEAD, PROPOSTA ENVIADA, CONTRATO ENVIADO, AGUARDANDO CONTRATO, AGUARDANDO ACEITE, FECHADO

**🔒 NUNCA RETROCEDE (sempre avança ou fica igual):**
- CONTATO → PROPOSTA ✅
- PROPOSTA → FORNECEDOR ✅
- Qualquer → PERDIDO ✅ (final)
- PROPOSTA → CONTATO ❌ BLOQUEADO
- FORNECEDOR → PROPOSTA ❌ BLOQUEADO

**⚠️ Casos que NÃO movem (recusa parcial, indecisão):**
- "Quero cancelar algumas linhas" → Fica na mesma etapa
- "Vou pensar", "depois te falo" → Sem movimento
- Conversas normais ("tudo bem", "ok blz") → Sem movimento

**Benefício:** Kanban sem "ruído", validação rigorosa, histórico respeitado

---

**Status:** ✅ FASE 7 COMPLETA + OPÇÃO B + VALIDAÇÃO RIGOROSA!
