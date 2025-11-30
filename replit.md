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

## 🚀 FASE 15 - CHAT + JOBS ENVIANDO PARA WHATSAPP AUTOMATICAMENTE (Nov 30)

### ✅ IMPLEMENTAÇÃO CONCLUÍDA COM SUCESSO!

**O que foi corrigido e implementado:**

1. **Chat instantâneo + IA em background** ✅
   - Quando você envia mensagem no chat → resposta **INSTANTÂNEA** (sem delay)
   - IA analisa em background (fire-and-forget)
   - Kanban se move silenciosamente quando análise termina

2. **Jobs enviando para WhatsApp** ✅
   - `contract_reminder` - Lembretes de cobrança em PROPOSTA ENVIADA
   - `contrato_enviado_message` - Notificação quando contrato é enviado
   - `aguardando_aceite_reminder` - Lembretes de assinatura (3 progressivos)
   - Todos enviam **EXATAMENTE como você digita Enter**

3. **Correções críticas**:
   - ✅ Status correto: `"conectada"` (não "connected")
   - ✅ Campo correto: `client.celular` (não telefone_2)
   - ✅ Validação: `isSessionAlive()` antes de enviar
   - ✅ Import correto: `import * as whatsappService` (não alias)
   - ✅ userId sempre incluído na busca de sessão

**Fluxo completo agora:**
```
CHAT:
1. Você envia "me envia proposta"
2. Mensagem aparece INSTANTANEAMENTE ✅
3. IA analisa em background
4. Kanban se move para PROPOSTA (se permitido)
5. WhatsApp recebe mensagem (se sessão conectada)

JOBS:
1. Job executa a cada 1 minuto
2. Cria mensagem no chat + timeline
3. Busca sessão por userId + status
4. Formata telefone (remove espaços, adiciona 55)
5. Valida sessão está viva
6. Envia para WhatsApp automaticamente
```

**🎯 REGRAS DE CLASSIFICAÇÃO DE INTENÇÃO (ATUALIZADO):**

1. **CONTATO** - Cliente pedindo informações
   - Palavras: "preço", "valor", "quanto", "custa", "como funciona", "quais planos", "me explica", "enviar detalhes", "quando vence", "meu contrato", "migrar", "me liga"
   - Intenção: `solicitacao_info`
   - Etapa: `CONTATO`

2. **PROPOSTA** - Cliente dando aprovação ou pedindo proposta
   - Palavras: "ok", "sim", "pode mandar", "manda", "me envia", "me envia proposta", "quero saber", "aprovado"
   - Intenção: `aprovacao_envio`
   - Etapa: `PROPOSTA`

3. **AUTOMÁTICA** - Respostas automáticas/frias
   - Palavras: "deixe seu contato", "aguarde", "nosso suporte retornará", "estamos verificando"
   - Intenção: `resposta_automatica`
   - Etapa: `AUTOMÁTICA`

4. **PERDIDO** - Apenas rejeições CLARAS
   - Palavras: "não quero renovar nada", "não tenho interesse", "pode encerrar", "cancela tudo", "empresa fechou", "eu cancelei o plano"
   - Intenção: `rejeicao_clara`
   - Etapa: `PERDIDO`
   - **⚠️ IMPORTANTE**: NÃO mover quando rejeição é parcial/ambígua

5. **REJEIÇÃO PARCIAL** - Cliente quer ajustes, NÃO é perda
   - Palavras: "cancelar algumas linhas", "não quero renovar TODAS", "reduzir", "diminuir", "mexer no plano"
   - Intenção: `rejeicao_parcial`
   - Etapa: "" (NÃO MOVER)
   - Ação: Alertar atendente para negociar

6. **INDEFINIDA** - Cliente indeciso ou ocupado
   - Palavras: "vou pensar", "deixa comigo", "estou ocupado agora", "vamos ver depois", "quanto pago de multa"
   - Intenção: `indefinida`
   - Etapa: "" (NÃO MOVER)
   - Ação: Aguardar próxima mensagem

**AI Movement Rules** (11 etapas):
- LEAD → IA move para: CONTATO, PROPOSTA, FORNECEDOR, PERDIDO
- CONTATO → IA move para: PROPOSTA, PERDIDO
- PROPOSTA+ (PROPOSTA a FECHADO) → IA BLOQUEADO
- PERDIDO → IA move para CONTATO/PROPOSTA (se interesse)
- FORNECEDOR → IA move para CONTATO/PROPOSTA (se interesse)

**Status**: ✅ PLATAFORMA 100% FUNCIONAL PARA PRODUÇÃO!

---

## 🚀 FASE 16 - NOVO CICLO DE VENDAS PARA CLIENTES FECHADO/PERDIDO (Nov 30)

### ✅ IMPLEMENTAÇÃO CONCLUÍDA COM SUCESSO!

**O que foi implementado:**

1. **Flag `deveCriarNovoNegocio` adicionado** ✅
   - Novo campo na interface `MessageAnalysis` para indicar quando criar novo negócio
   - Quando cliente em FECHADO/PERDIDO responde → Cria NOVA oportunidade ao invés de mover

2. **Lógica de `validateMovement` atualizada** ✅
   - Agora retorna objeto `{ allowed, shouldCreateNew }`
   - Se está em FECHADO/PERDIDO e pode mover → `shouldCreateNew = true`

3. **Fluxo de chat atualizado** ✅
   - Prioridade: Se `deveCriarNovoNegocio` = true → Cria nova oportunidade
   - Se `deveCriarNovoNegocio` = false → Move oportunidade existente
   - Cada ciclo de venda é independente com seus dados

**Cada ciclo é único:**
```
Ciclo 1: LEAD → CONTATO → PROPOSTA → FECHADO
Ciclo 2: (Cliente responde) → CRIA NOVO em CONTATO/PROPOSTA → FECHADO
Ciclo 3: (Cliente responde novamente) → CRIA NOVO → FECHADO
```

**Regra de IA atualizada:**
- FECHADO → ["CONTATO", "PROPOSTA"] = **Criar novo negócio**
- PERDIDO → ["CONTATO", "PROPOSTA"] = **Criar novo negócio**
- Todas outras etapas = Mover existente

**Status**: ✅ VENDAS MULTICLICLO 100% OPERACIONAL!

---

## 🚀 FASE 17 - ISOLAMENTO MULTI-VENDEDOR + VALIDAÇÃO REFINADA (Nov 30)

### ✅ IMPLEMENTAÇÃO CONCLUÍDA COM SUCESSO!

**O que foi implementado:**

1. **Isolamento por Vendedor (Multi-tenant)** ✅
   - Helper `getOpenOpportunityForClient(clientId, userId)` filtra por vendedor
   - Cada vendedor só vê/atualiza suas próprias oportunidades
   - Cliente pode ter múltiplas oportunidades (uma por vendedor)

2. **Validação de Etapa Refinada** ✅
   - `etapaValida` = etapa não vazia E != "AUTOMÁTICA"
   - AUTOMÁTICA não cria nem atualiza oportunidades
   - FECHADO/PERDIDO são considerados "congelados" (não são oportunidades abertas)

3. **Guardrails de IA** ✅
   - `deveAgir` deve ser true para criar OU atualizar
   - Etapa deve ser diferente da atual para atualizar
   - Logs detalhados em cada decisão

**Regras de Negócio:**
```
OPORTUNIDADE ABERTA = etapa != FECHADO E etapa != PERDIDO

QUANDO CLIENTE RESPONDE:
├── Vendedor TEM oportunidade aberta?
│   ├── SIM → ATUALIZA (se deveAgir E etapaValida E etapa diferente)
│   └── NÃO → CRIA NOVA (se deveAgir E etapaValida)
│
└── NUNCA toca em FECHADO/PERDIDO (histórico imutável)

VALIDAÇÕES:
- etapaValida = etapa truthy E != "" E != "AUTOMÁTICA"
- deveAgir = IA decidiu que há ação a tomar
- userId = filtro obrigatório para buscar oportunidades
```

**Arquivos Modificados:**
- `server/storage.ts` - getOpenOpportunityForClient com userId
- `server/whatsappService.ts` - lógica de criação/atualização com validações
- `server/routes.ts` - mesma lógica no chat

**Status**: ✅ MULTI-VENDEDOR 100% OPERACIONAL!

---

## 🚀 FASE 18 - IMPORTAÇÃO DOMINIO (Nov 30)

### ✅ 2876 CLIENTES DOMINIO IMPORTADOS COM SUCESSO!

**O que foi feito:**

1. **Processamento de arquivo DOMINIO filtrado** ✅
   - 2876 registros extraídos e organizados
   - CNPJ, Gestor, Endereço completo preservados
   
2. **Sanitização e mapeamento** ✅
   - CPF → máx 11 dígitos
   - CEP → máx 8 caracteres
   - Celulares → combinados (Tel1 / Tel2)
   - Todos os limites de campo respeitados

3. **Importação em chunks** ✅
   - 29 chunks de ~100 registros cada
   - 100% de sucesso: 2876/2876 importados
   - Scripts: `import_clean.ts` (script final de importação)

**Campos mapeados:**
- Nome, CNPJ, Email, Celular (Tel1+Tel2)
- Nome Gestor, Email Gestor, CPF Gestor
- Endereço, Número, Bairro, CEP, Cidade, UF
- Parceiro = DOMINIO, Status = ativo

**Arquivos gerados:**
- `DOMINIO_PRONTO.csv` (784KB)
- `DOMINIO_IMPORT.json` (1.5MB)
- `import_clean.ts` (script reutilizável para imports)

**Status**: ✅ Base de clientes DOMINIO 100% importada!
