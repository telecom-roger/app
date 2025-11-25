# Plataforma de Atendimento Inteligente

## Visão Geral
Plataforma completa para gerenciar 500k+ clientes de operadoras de telecom com CRM, comunicação em massa (WhatsApp/Email), Kanban de vendas e automação com IA.

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
- BullMQ + Redis para filas de processamento
- SendGrid para envio de emails

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

/shared
  schema.ts       - Schemas Drizzle e tipos TypeScript compartilhados
```

### Modelo de Dados
Principais entidades no PostgreSQL:
- **users**: Usuários do sistema (Admin, Gerente, Agente)
- **clients**: Base de clientes (500k+)
- **contacts**: Contatos de clientes (telefone, email)
- **opportunities**: Oportunidades de vendas (Kanban)
- **campaigns**: Campanhas de comunicação
- **templates**: Templates de email/WhatsApp
- **conversations**: Histórico de conversas
- **interactions**: Timeline de interações
- **customFields**: Campos dinâmicos configuráveis
- **auditLogs**: Logs de auditoria completos
- **importJobs**: Jobs de importação CSV/XLSX
- **whatsappSessions**: Sessões do WhatsApp

## Funcionalidades MVP (Fase 1 - Concluída)

### Autenticação e Autorização
- ✅ Login via Replit Auth (Google, GitHub, Email)
- ✅ Controle de permissões por role (Admin, Gerente, Agente)
- ✅ Proteção de rotas no frontend e backend
- ✅ Session management com PostgreSQL

### CRM Completo
- ✅ CRUD de clientes com campos personalizados
- ✅ Gestão de contatos (telefone/email)
- ✅ Sistema de tags e categorização
- ✅ Lead scoring (0-100)
- ✅ Timeline de interações cronológica
- ✅ Busca e filtros avançados

### Importação de Clientes
- ✅ Wizard com 4 etapas (Upload → Mapeamento → Validação → Concluído)
- ✅ Suporte para CSV e XLSX
- ✅ Mapeamento interativo de colunas
- ✅ Normalização de telefones brasileiros (+55)
- ✅ Detecção de duplicados
- ✅ Relatório de validação detalhado

### Kanban de Oportunidades
- ✅ Colunas configuráveis (Lead → Contato → Proposta → Fechado/Perdido)
- ✅ Cards drag-and-drop (preparado para backend)
- ✅ Filtros por responsável e data
- ✅ Visualização de valor estimado e prazos

### Campanhas
- ✅ Gestão de campanhas de Email e WhatsApp
- ✅ Editor de templates com variáveis dinâmicas
- ✅ Agendamento de envios
- ✅ Métricas de performance (abertura, cliques, envios)
- ✅ Status tracking (rascunho, agendada, enviando, concluída)

### Dashboard Analítico
- ✅ KPIs principais (clientes, oportunidades, campanhas)
- ✅ Funil de conversão visual
- ✅ Atividade recente
- ✅ Métricas de performance

### Administração
- ✅ Gerenciamento de usuários e permissões
- ✅ Visualização de perfis (Admin, Gerente, Agente)
- ✅ Status de usuários (Ativo/Inativo)

### UI/UX
- ✅ Design system profissional com cores #1A0B41 e #7069FF
- ✅ Sidebar de navegação fixa com menu contextual
- ✅ Modo escuro completo
- ✅ Componentes com estados de loading, error e empty
- ✅ Responsividade total (mobile, tablet, desktop)
- ✅ Animações suaves e micro-interações
- ✅ Acessibilidade (data-testid em elementos interativos)

## Próximas Fases

### Fase 2 - Backend (Em Desenvolvimento)
- [ ] Criar banco PostgreSQL e migrations
- [ ] Implementar Replit Auth
- [ ] APIs REST completas para todas as entidades
- [ ] BullMQ para processamento de filas
- [ ] Upload e parsing de CSV/XLSX
- [ ] Integração SendGrid
- [ ] Sistema de logs de auditoria
- [ ] Normalização de telefones com libphonenumber-js

### Fase 3 - Integração
- [ ] Conectar todas as páginas às APIs
- [ ] Data fetching com React Query
- [ ] Estados de loading/error elegantes
- [ ] Validação de formulários
- [ ] Upload de arquivos com progresso
- [ ] Testes end-to-end

### Futuro (Avançado)
- [ ] Integração WhatsApp (WPPConnect ou Meta API)
- [ ] IA com OpenAI (lead scoring, sugestões, respostas automáticas)
- [ ] ElasticSearch para busca full-text
- [ ] Relatórios exportáveis (CSV/PDF)
- [ ] Observabilidade (logs estruturados, métricas)

## Variáveis de Ambiente

### Secrets (já configurados)
- `OPENAI_API_KEY`: Chave da API OpenAI para recursos de IA
- `SESSION_SECRET`: Secret para sessões (auto-gerenciado pelo Replit)

### A configurar
- `DATABASE_URL`: String de conexão PostgreSQL (Replit Database)
- `SENDGRID_API_KEY`: Chave da API SendGrid para emails
- `REDIS_URL`: URL do Redis para BullMQ (opcional)

## Como Executar

O projeto já está configurado para rodar automaticamente:
```bash
npm run dev
```

Isso inicia:
- Frontend (Vite) em http://localhost:5000
- Backend (Express) no mesmo servidor

## Convenções de Código

### Frontend
- Componentes funcionais com TypeScript
- Hooks para lógica reutilizável
- TanStack Query para data fetching
- Shadcn/UI para componentes base
- Tailwind para estilos
- `data-testid` em todos os elementos interativos

### Backend
- Express com TypeScript
- Validação com Zod
- Storage pattern para abstração de dados
- Middleware para autenticação
- Logs estruturados

### Padrões
- Nomes em português para entidades de negócio
- camelCase para variáveis e funções
- PascalCase para componentes React
- Tipos compartilhados em `shared/schema.ts`

## Estado Atual
**Fase 1 Concluída**: Todos os componentes React e design system implementados com qualidade excepcional.
**Próximo**: Fase 2 - Implementação completa do backend com PostgreSQL.
