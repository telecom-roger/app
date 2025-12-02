# 📊 Lógica Completa de Atualização de Status do Cliente

## 1️⃣ CAMPO UTILIZADO

**Campo exato:** `clients.status` (varchar 50)

**Localizado em:**
- Schema: `shared/schema.ts` (linha 51)
- Storage: `server/storage.ts`
- Routes: `server/routes.ts`

---

## 2️⃣ VALORES POSSÍVEIS

```
- base_frio (padrão inicial)
- lead_quente
- engajado
- em_negociacao
- em_fechamento
- ativo
- perdido
- remarketing (reconversão)
```

---

## 3️⃣ FLUXO ATUAL - DO ZERO ATÉ CLIENTE RESPONDER

### 📍 Passo 1: Cliente entra no sistema
```
1. Campanha é enviada
2. Client recebe status "base_frio" (padrão)
3. Nenhuma oportunidade é criada automaticamente
```

### 📍 Passo 2: Cliente responde no WhatsApp
```
Arquivo: server/whatsappService.ts (processIncomingMessages)
Linha: ~275-405

1. Mensagem é recebida
2. Conversa é criada/encontrada
3. ⚡ GATILHO: Análise de IA (analyzeClientMessage)
   ↓
4. IA decide:
   - deveAgir? (boolean)
   - etapa? (LEAD, CONTATO, PROPOSTA, etc)
   - sentimento? (positivo/negativo)
   ↓
5. Lógica de oportunidades:
   
   ✅ TEM OPORTUNIDADE ABERTA?
      → ATUALIZAR essa oportunidade com nova etapa (se diferente)
      
   ❌ NÃO TEM OPORTUNIDADE ABERTA?
      → CRIAR nova oportunidade com etapa detectada pela IA
```

---

## 4️⃣ FUNÇÃO CRÍTICA: `recalculateClientStatus()`

**Arquivo:** `server/storage.ts` (linhas 1384-1464)

**Lógica:**
```
1. Busca TODAS as oportunidades do cliente
2. Aplica regras de prioridade:

┌─────────────────────────────────────────┐
│ REGRA DE PRIORIDADE (ordem descrita)    │
├─────────────────────────────────────────┤
│ 1. Se EXISTE "FECHADO"                  │
│    → Status = "ativo" (máxima prioridade)│
│                                          │
│ 2. Se TODAS são "PERDIDO"               │
│    → Status = "perdido"                 │
│                                          │
│ 3. Se tem "PERDIDO" + oportunidades     │
│    ativas (LEAD/CONTATO/AUTOMÁTICA)     │
│    → Status = "remarketing"             │
│                                          │
│ 4. Se NÃO tem oportunidades             │
│    → Status = "lead_quente"             │
│                                          │
│ 5. Pega a oportunidade MAIS AVANÇADA    │
│    e mapeia para status do cliente      │
└─────────────────────────────────────────┘

MAPEAMENTO ETAPA → STATUS CLIENTE:
┌──────────────────────┬──────────────────┐
│ ETAPA                │ STATUS CLIENTE   │
├──────────────────────┼──────────────────┤
│ LEAD                 │ lead_quente      │
│ CONTATO              │ engajado         │
│ AUTOMÁTICA           │ engajado         │
│ PROPOSTA             │ em_negociacao    │
│ PROPOSTA ENVIADA     │ em_negociacao    │
│ AGUARDANDO CONTRATO  │ em_fechamento    │
│ CONTRATO ENVIADO     │ em_fechamento    │
│ AGUARDANDO ACEITE    │ em_fechamento    │
│ AGUARDANDO ATENÇÃO   │ em_fechamento    │
│ FECHADO              │ ativo            │
│ PERDIDO              │ perdido          │
└──────────────────────┴──────────────────┘
```

---

## 5️⃣ QUANDO O STATUS É ATUALIZADO

### ✅ Via IA (AUTOMÁTICO - WhatsApp Listener)
**Arquivo:** `server/whatsappService.ts` (linhas 348-405)

```javascript
// Quando cliente responde mensagem:
if (analysis.deveAgir) {
  if (openOpp) {
    // ATUALIZAR oportunidade existente
    await storage.updateOpportunity(...);
    // ↓
    // Isso chama automaticamente recalculateClientStatus()
  } else {
    // CRIAR nova oportunidade
    await storage.createOpportunity(...);
    // ↓
    // Isso chama automaticamente recalculateClientStatus()
  }
}
```

### ✅ Via WEBHOOK WhatsApp (Status de Entrega)
**Arquivo:** `server/whatsappService.ts` (linhas 577-683)

```javascript
// Quando Baileys recebe update de status (ticks):
sock.ev.on("messages.update", (updates) => {
  // Atualiza campaign_sendings
  // Incrementa totalRespostas se cliente respondeu
  // ↓
  // processIncomingMessages é disparado
  // ↓
  // recalculateClientStatus() é chamada
});
```

### ✅ Via IA - Análise Contínua
**Arquivo:** `server/routes.ts` (linhas 726, 797, 930, 967)

```javascript
// Quando oportunidade é movida manualmente no Kanban:
app.patch("/api/opportunities/:id/move", async (req, res) => {
  await storage.updateOpportunity(opportunityId, { etapa: newStage });
  // ↓
  // Chama automaticamente:
  const newStatus = await storage.recalculateClientStatus(clientId);
});
```

### ❌ NÃO há atualização:
- **Ticks do WhatsApp (enviado/entregue/lido)**: Não atualizam status do cliente
  - Só atualizam `campaign_sendings.status` e `campaign_sendings.totalRespostas`
- **Timeout após inatividade**: Ainda não implementado

---

## 6️⃣ FLUXO VISUAL COMPLETO

```
┌──────────────────┐
│  CLIENTE NOVO    │
│  status:base_frio │
└────────┬─────────┘
         │
         ├─ Recebe campanha
         │  (status continua base_frio)
         │
         └─ AGUARDA RESPOSTA
            │
            ├─ Sem resposta
            │  └─ Status CONGELADO em base_frio
            │     (sem automação de decaimento)
            │
            └─ CLIENTE RESPONDE NO WHATSAPP
               │
               ├─ Disparador: messages.upsert (Baileys)
               │
               ├─ 🤖 IA ANALISA
               │   - sentimento (positivo/negativo/neutro)
               │   - intenção (aprovacao_envio/rejeicao/interesse)
               │   - etapa (LEAD/CONTATO/PROPOSTA/etc)
               │   - deveAgir (true/false)
               │   - confianca (0-1)
               │
               ├─ if deveAgir = true:
               │
               │  ├─ TEM OPORTUNIDADE ABERTA?
               │  │  └─ ATUALIZA: etapa = analysis.etapa
               │  │     └─ CHAMA: recalculateClientStatus()
               │  │        └─ STATUS MUDA para status_novo
               │  │
               │  └─ NÃO TEM OPORTUNIDADE ABERTA?
               │     └─ CRIA: nova oportunidade
               │        └─ CHAMA: recalculateClientStatus()
               │           └─ STATUS MUDA para status_novo
               │
               └─ MENSAGENS AUTOMÁTICAS ENVIADAS
                  (if sentimento = positivo && etapa != AUTOMÁTICA)
                  └─ Resposta automática apropriada

┌─────────────────────────────────────┐
│ STATUS FINAL DO CLIENTE             │
│ (determinado por oportunidade mais  │
│  avançada)                          │
├─────────────────────────────────────┤
│ Exemplo:                            │
│ Se opp está em PROPOSTA ENVIADA     │
│ → status_cliente = "em_negociacao"  │
└─────────────────────────────────────┘
```

---

## 7️⃣ EXEMPLO PRÁTICO PASSO-A-PASSO

```
T=0s:  Campanha enviada
       → Cliente criado com status="base_frio"
       → campaign_sendings.status="enviado"

T=2s:  WhatsApp: 📬 "entregue" (2 ticks)
       → campaign_sendings.status="entregue"
       → client.status NÃO MUDA

T=5s:  WhatsApp: 👁️ "lido" (2 ticks azuis)
       → campaign_sendings.status="lido"
       → client.status NÃO MUDA

T=30s: CLIENTE RESPONDE: "Sim, tem interesse!"
       → Baileys dispara messages.upsert
       → 🤖 IA analisa: sentimento="positivo", etapa="PROPOSTA"
       → IA cria nova oportunidade com etapa="PROPOSTA"
       → recalculateClientStatus() chamada
       → STATUS MUDA: "base_frio" → "em_negociacao" ✅
       → campaign_sendings.totalRespostas += 1
       → campaign_sendings.dataPrimeiraResposta = now()
       → Mensagem automática "Entendi seu interesse..." é enviada

T=60s: Vendedor move oportunidade: PROPOSTA → PROPOSTA ENVIADA
       → recalculateClientStatus() chamada
       → STATUS CONTINUA: "em_negociacao" (mesma etapa)

T=2h:  Vendedor move: PROPOSTA ENVIADA → FECHADO
       → recalculateClientStatus() chamada
       → STATUS MUDA: "em_negociacao" → "ativo" ✅
```

---

## 8️⃣ CAMPOS RELACIONADOS EM campaign_sendings

```
Além de status do CLIENTE (que é derived de oportunidades):

campaign_sendings.status
  - pendente
  - enviado (1 tick)
  - entregue (2 ticks)
  - lido (2 ticks azuis)
  - erro

campaign_sendings.totalRespostas
  - Incrementado quando cliente responde
  - Usado para calcular "respondidos" no relatório

campaign_sendings.dataPrimeiraResposta
  - Timestamp da primeira resposta
  - Setado quando totalRespostas muda de 0 → 1

campaign_sendings.estadoDerivado
  - Derivado do status:
    - 'entregue' (se status=entregue)
    - 'visualizado' (se status=lido)
```

---

## 9️⃣ PROBLEMAS ATUAIS (ANTES DO FIX)

### ❌ Bug 1: totalRespostas não incrementava
**Causa:** `processIncomingMessages` não atualizava `campaign_sendings.totalRespostas`

**Status:** ✅ FIXADO - Agora incrementa quando cliente responde

### ❌ Bug 2: Status regressivo (LIDO → ENVIADO)
**Causa:** Baileys enviava updates com remoteJid diferentes
- Mesmo messageId vinha com status=3 (ENTREGUE) depois status=2 (ENVIADO)

**Status:** ✅ FIXADO - Adicionados guards de prioridade

### ❌ Bug 3: campaign_sendings records não eram criados
**Causa:** POST `/api/campaigns` criava campanha mas NÃO criava registros em `campaign_sendings`

**Status:** ✅ FIXADO - Agora cria 1 registro por clientId

---

## 🔟 AUDITORIA - ONDE O STATUS É ATUALIZADO

| Local | Arquivo | Linha | Ação |
|-------|---------|-------|------|
| **IA - Nova resposta** | whatsappService.ts | 348-405 | Cria/atualiza opp → recalculate |
| **Kanban - Movimento manual** | routes.ts | 726, 797, 930, 967 | Move opp → recalculate |
| **Timeline - Mudança registrada** | storage.ts | 1384-1464 | recalculateClientStatus() |
| **Chat - Interação automática** | routes.ts | 3214-3317 | Interação criada → recalculate |
| **Webhook WhatsApp** | whatsappService.ts | 315-346 | Response counted → recalculate |

---

## 🎯 PRÓXIMOS PASSOS SUGERIDOS

1. **Implementar decaimento de status**
   - Se cliente em "engajado" sem resposta por 7 dias → "base_frio"
   - Se cliente em "em_negociacao" sem resposta por 14 dias → "base_frio"

2. **Criar endpoint de automação de retorno**
   - Disparar campanha de remarketing quando status = "perdido"

3. **Dashboard com funil melhorado**
   - Mostrar transições de status ao longo do tempo
   - Identificar "dead leads" (base_frio por muito tempo)

---

## 📝 RESUMO EXECUTIVO

| Aspecto | Resposta |
|---------|----------|
| **Campo usado** | `clients.status` |
| **Após envio de campanha** | Status = "base_frio" (padrão) |
| **Ao cliente responder** | Status = derivado da etapa da oportunidade via IA |
| **Automação de retorno** | ❌ NÃO implementada ainda |
| **Atualizado por** | IA (ao analisar resposta), Webhook WhatsApp, Movimento manual no Kanban |
| **Método de cálculo** | `recalculateClientStatus()` que olha para oportunidades mais avançadas |

