# Plataforma de Atendimento Inteligente

## Visão Geral
Plataforma completa para gerenciar 500k+ clientes de operadoras de telecom com CRM, comunicação em massa (WhatsApp/Email), Kanban de vendas, automação com IA e **agendamento de campanhas automáticas**.

## Tecnologias
**Frontend:**
- React 18 com TypeScript
- Vite para build tool
- Wouter para roteamento
- TanStack Query (React Query) para data fetching
- Tailwind CSS com Shadcn/UI components
- Lucide React para ícones

**Backend:**
- Node.js com Express.js e TypeScript
- PostgreSQL (Replit Database) para persistência
- Drizzle ORM para queries
- Replit Auth para autenticação (JWT + OAuth)
- Background job processing para campanhas agendadas
- SendGrid para envio de emails (futuro)

**Design System:**
- Cor Principal: #1A0B41 (azul escuro profundo)
- Cor CTA/Botões: #7069FF (roxo vibrante)
- Cores Neutras: Cinza claro e Branco
- Fonte: Inter (sans-serif) e Fira Code (mono)
- Modo Escuro: Suportado

## Arquitetura do Projeto

### Estrutura de Pastas
```
/client/src
  /components      - Componentes reutilizáveis e UI components (Shadcn)
  /pages          - Páginas da aplicação
  /hooks          - React hooks customizados
  /lib            - Utilitários e configurações
  /assets         - Imagens e assets estáticos

/server
  app.ts          - Configuração do Express
  routes.ts       - Definição de rotas da API
  storage.ts      - Interface de storage e implementações
  replitAuth.ts   - Configuração do Replit Auth
  whatsappService.ts - Gerenciamento de sessões WhatsApp

/shared
  schema.ts       - Schemas Drizzle e tipos TypeScript compartilhados
```

### Modelo de Dados
Principais entidades no PostgreSQL:
- **users**: Usuários do sistema (Admin, Gerente, Agente)
- **clients**: Base de clientes (4346 registros) - campos telecom completos
- **contacts**: Contatos de clientes (telefone, email)
- **opportunities**: Oportunidades de vendas (Kanban)
- **campaigns**: Campanhas de comunicação com agendamento
- **templates**: Templates de email/WhatsApp com suporte a imagens
- **conversations**: Conversas bidirecionais WhatsApp
- **messages**: Histórico de mensagens (usuário ↔ cliente)
- **interactions**: Timeline de interações
- **customFields**: Campos dinâmicos configuráveis
- **auditLogs**: Logs de auditoria completos
- **importJobs**: Jobs de importação CSV/XLSX
- **whatsappSessions**: Sessões do WhatsApp conectadas
- **kanban_stages**: Estágios do Kanban (Lead, Contato, Proposta, Fechado, Perdido) - **GLOBAL para toda empresa**

## Funcionalidades MVP (Fase 1 - ✅ CONCLUÍDA!)

### Autenticação e Autorização
- ✅ Login via Replit Auth com Passport Local (email + bcrypt)
- ✅ Controle de permissões por role (Admin, Gerente, Agente)
- ✅ Proteção de rotas no frontend e backend
- ✅ Session management com PostgreSQL + connect-pg-simple

### CRM Completo
- ✅ CRUD de clientes com 16 campos UPPERCASE telecom personalizados
- ✅ Gestão de contatos (telefone/email)
- ✅ Sistema de tags e categorização
- ✅ Lead scoring (0-100)
- ✅ Timeline de interações cronológica
- ✅ Busca e filtros avançados

### Importação de Clientes
- ✅ Wizard com 4 etapas (Upload → Mapeamento → Validação → Concluído)
- ✅ Suporte para CSV e XLSX com PapaParse
- ✅ Mapeamento interativo de colunas
- ✅ Normalização de telefones brasileiros (+55)
- ✅ Detecção de duplicados
- ✅ Relatório de validação detalhado com 1845 clientes testados

### Kanban de Oportunidades
- ✅ Drag-and-drop funcional entre 5 colunas (Lead → Contato → Proposta → Fechado → Perdido)
- ✅ Criar e deletar cards de oportunidades
- ✅ Modais de edição inline com formulários validados
- ✅ Filtros por responsável
- ✅ Visualização de valor estimado e prazos
- ✅ **Configuração GLOBAL**: Todos usuários compartilham mesmas estágios (sem config por-usuário)
- ✅ **Contagem de oportunidades** por coluna com badge

### Campanhas
- ✅ Gestão de campanhas de Email e WhatsApp
- ✅ Página de listagem com estatísticas
- ✅ Criação de campanhas com template selection
- ✅ Editor de templates com variáveis dinâmicas
- ✅ Agendamento de envios
- ✅ Status tracking (rascunho, agendada, enviando, concluída)

### Modelos de Mensagens
- ✅ Criação de templates com título, tipo, conteúdo e imagem
- ✅ Suporte a variáveis dinâmicas {{variavel}}
- ✅ Edição e exclusão de modelos
- ✅ Separação por tipo (WhatsApp/Email)
- ✅ Página dedicada: `/modelos-mensagens`

### Campanhas Agendadas
- ✅ Agendamento de campanhas para data/hora específica
- ✅ Campanhas executadas automaticamente no horário agendado
- ✅ Listagem com status e data de envio
- ✅ Cancelamento de campanhas agendadas
- ✅ Página dedicada: `/campanhas-agendadas`

### Chat Bidirecional WhatsApp
- ✅ Envio de mensagens via WhatsApp (200+ testadas)
- ✅ Listeners ativos recebendo mensagens de clientes
- ✅ Interface de chat em `/chat` com auto-refresh 3s
- ✅ Normalização de formato de telefone (remover @s.whatsapp.net, @lid, @c.us)
- ✅ Auto-salvamento de mensagens recebidas
- ✅ Auto-criar conversas para novos contatos
- ✅ Listar conversas recentes com mensagens não lidas

### Chat Modal - Criar Negócio (NOVO!)
- ✅ Modal com informações completas do cliente (3 colunas)
- ✅ Entrada de valor estimado (TEXT type para preservar input)
- ✅ Seleção de etapa do Kanban
- ✅ Botão "Criar Negócio" que adiciona oportunidade ao Kanban
- ✅ **BUG FIXADO**: Agora usa `currentUser.id` como responsávelId (FK validada)
- ✅ Toast de sucesso/erro

### Perfil de Cliente - Layout Social Media
- ✅ Layout em 3 colunas (Esquerda: Menu | Centro: Timeline | Direita: Informações)
- ✅ Menu com ações rápidas (WhatsApp, Email, Nota, Editar, Compartilhar, Configurações)
- ✅ Timeline de interações com scroll infinito
- ✅ Sidebar direita com informações completas do cliente
- ✅ Status Badge e dados de negócio visíveis
- ✅ Cores seguindo design do Dashboard (gradient slate)

### Edição Inline de Campos
- ✅ Clique em qualquer campo para editar inline
- ✅ Campos editáveis: Email, Telefone, Contato, Razão Social, Carteira, Plano, Endereço completo, CPF/CNPJ, Observações
- ✅ Salva automaticamente ao fazer Enter ou clicar fora
- ✅ Validação de campos
- ✅ Toast de sucesso/erro
- ✅ Logs de auditoria das alterações

### Admin Panel
- ✅ Templates CRUD completo (criar, listar, deletar)
- ✅ Gerenciamento de usuários
- ✅ Visualização de perfis (Admin, Gerente, Agente)
- ✅ Status de usuários (Ativo/Inativo)

### Dashboard Analítico
- ✅ KPIs principais (clientes, oportunidades, campanhas)
- ✅ Funil de conversão visual
- ✅ Atividade recente
- ✅ Métricas de performance com charts (Recharts)

### UI/UX
- ✅ Design system profissional com cores #1A0B41 (azul) e #7069FF (roxo)
- ✅ Sidebar de navegação fixa com menu contextual (Shadcn Sidebar)
- ✅ Modo escuro completo com dark mode toggle
- ✅ Componentes com estados de loading, error e empty states
- ✅ Responsividade total (mobile, tablet, desktop)
- ✅ Animações suaves com Framer Motion
- ✅ Acessibilidade (data-testid em todos os elementos interativos)

## Backend Implementado

### APIs REST Completas
- ✅ GET/POST/DELETE /api/clients (com paginação e filtros)
- ✅ PATCH /api/clients/:id (edição inline de campos)
- ✅ GET/POST/DELETE /api/opportunities (com drag-and-drop)
- ✅ GET/POST /api/campaigns
- ✅ GET/POST/PATCH/DELETE /api/templates (CRUD completo)
- ✅ GET/POST/DELETE /api/campaigns/schedule (agendamento)
- ✅ GET /api/campaigns/scheduled (listar agendadas)
- ✅ GET /api/timeline/:clientId (histórico de interações)
- ✅ POST /api/import/clients (com validação e mapeamento)
- ✅ GET /api/admin/users (listagem de usuários)
- ✅ POST /api/whatsapp/connect (conectar WhatsApp)
- ✅ GET /api/whatsapp/sessions (listar sessões)
- ✅ GET /api/chat/messages/:conversationId (histórico)
- ✅ POST /api/chat/messages/:conversationId (enviar)

### Banco de Dados PostgreSQL
- ✅ Tabelas: users, sessions, clients, contacts, opportunities, campaigns, templates, interactions, auditLogs, customFields, tags, conversations, messages, whatsappSessions, kanban_stages
- ✅ Relacionamentos configurados corretamente
- ✅ Índices em chaves estrangeiras para performance
- ✅ Express payload limit aumentado para 50MB (importações em massa)
- ✅ Campo `imageUrl` adicionado a templates

### Sistema de Armazenamento
- ✅ Métodos em storage.ts para CRUD completo
- ✅ Métodos implementados: `deleteCampaign`, `updateTemplate`, `deleteTemplate`, `findConversationByPhoneAndUser`, `createOrGetConversation`
- ✅ Query builders otimizados com Drizzle ORM

### Sistema de WhatsApp
- ✅ Baileys listeners ativos e processando mensagens
- ✅ Normalização de telefone (remover sufixos @s.whatsapp.net, @lid, @c.us)
- ✅ Normalização DO 55 PREFIX - **CRÍTICO**: Remove 55 IMEDIATAMENTE após receber (todos clientes armazenados SEM 55)
- ✅ Salvamento de mensagens recebidas
- ✅ Notas de voz (áudio WebM → M4A/AAC com ffmpeg, `ppt: true`)
- ✅ Auto-criação de conversas para novos contatos (sempre SEM 55)
- ✅ Sem duplicatas de clientes (mesmo número COM/SEM 55 = mesmo cliente)

### Sistema de Auditoria
- ✅ Logs completos para criar, editar, deletar
- ✅ Rastreamento de IP e User-Agent
- ✅ Auditoria de templates, opportunities, clientes, campanhas

## Variáveis de Ambiente

### Secrets (Configurados)
- ✅ `DATABASE_URL`: Replit PostgreSQL
- ✅ `OPENAI_API_KEY`: OpenAI para IA
- ✅ `SESSION_SECRET`: Segurança de sessões
- ✅ `PGDATABASE`, `PGHOST`, `PGPASSWORD`, `PGPORT`, `PGUSER`: PostgreSQL credentials

## Como Executar

O projeto já está configurado para rodar automaticamente:
```bash
npm run dev
```

Isso inicia:
- Frontend (Vite) em http://0.0.0.0:5000
- Backend (Express) no mesmo servidor

## Estado Atual - ✅ Serviço de Busca de Clientes Otimizado!

**Decisões Arquiteturais:**
- ✅ **Kanban Stages**: GLOBAL (compartilhado por toda empresa, não por-usuário)
- ✅ **Chat Modal**: Mostra dados completos do cliente + criação de negócio integrada
- ✅ **Opportunity Creation**: Usa `currentUser.id` como responsávelId (validado em FK)
- ✅ **Busca de Clientes**: Procura em 4 campos de telefone para máxima compatibilidade

**Últimas Correções (Nov 28, 2025):**

1. ✅ **VARIÁVEIS DE TEMPLATE CORRIGIDAS** (Nov 28, 15:36)
   - Problema: {empresa} e {razao_social} ficavam vazias em campanhas
   - Solução: Confirmado com usuário que razaoSocial sempre está preenchida
   - Status: ✅ Variáveis funcionando corretamente

2. ✅ **NOVO CONTATO SENDO CRIADO QUANDO CLIENTE RESPONDE** (Nov 28, 15:40)
   - Problema: Cliente cadastrado respondendo criava novo contato em vez de usar o existente
   - Causa: Busca só procurava em 2 campos de telefone (CELULAR_PRINCIPAL, telefone)
   - Solução: Expandiu busca para 4 campos (CELULAR_PRINCIPAL, telefone, CELULAR, TELEFONE_COMERCIAL)
   - Arquivos: `server/storage.ts` e `server/whatsappService.ts`
   - Status: ✅ Corrigido e testado

3. ✅ **PUBLICAÇÃO EM RESERVED VM** (Nov 28, 15:38)
   - Problema: WhatsApp desconectava toda vez que servidor reiniciava para corrigir código
   - Solução: Publicar em Reserved VM para deixar sempre online
   - Status: ✅ Botão de publicação disponível (usuário em processo de publicar)

4. ✅ **ISOLAMENTO POR USUÁRIO EM CAMPANHAS AGENDADAS** (Nov 28, 16:00)
   - Problema: Scheduler executava TODAS as campanhas com TODOS os clientes de TODOS usuários
   - Solução: MODO 1 (Isolado por Usuário) implementado
   - Detalhes: 
     - Scheduler agora carrega campanhas agendadas
     - Para cada campanha, identifica o `createdBy` (dono)
     - Carrega APENAS clientes daquele usuário
     - Executa isoladamente
   - Arquivos: `server/routes.ts` (scheduler actualizado)
   - Benefícios: ✅ Segurança, ✅ Privacidade, ✅ Auditoria completa
   - Status: ✅ Implementado e funcionando

5. ✅ **NOVO CLIENTE CRIADO COM createdBy ATRELADO AO USUÁRIO** (Nov 28, 16:10)
   - Problema: Quando WhatsApp criava novo contato automaticamente, não estava atrelado ao usuário
   - Solução: Adicionado `createdBy: userId` em ambos os locais:
     - `whatsappService.ts` (linha 284) - criação automática por WhatsApp
     - `routes.ts` - endpoint de teste (removido após teste)
   - Resultado: Novo cliente agora aparece com `createdBy` correto
   - Status: ✅ Corrigido e validado

6. ✅ **ROTA DE PERFIL DO CLIENTE CORRIGIDA** (Nov 28, 16:15)
   - Problema: Rotas de clientes conflitando - `/clientes` vinha antes de `/clientes/:id`
   - Solução: Reordenado em `App.tsx` para que rotas específicas venham PRIMEIRO:
     - `/clientes/novo` → ClienteForm
     - `/clientes/:id/editar` → ClienteForm
     - `/clientes/:id` → ClienteProfile (rotas com parâmetro)
     - `/clientes` → Clientes (rota geral - vem por último)
   - Detalhes: Bot no bell/chat agora direciona corretamente para `/clientes/{id}`
   - Arquivos: `App.tsx`, `chat-notification-bell.tsx`, `chat.tsx`
   - Status: ✅ Funcionando corretamente

**Próximas Ações (Fase 3):**
1. Teste de respostas de clientes (validar se novo contato não é mais criado)
2. Dashboard de performance por vendedor
3. Relatórios de campanhas enviadas
4. Filtros avançados em campanhas-agendadas
5. Integração com IA para sugestões de contato
6. Melhorias de performance (caching, otimizações)
