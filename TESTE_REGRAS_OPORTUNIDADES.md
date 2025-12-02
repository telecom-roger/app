# Como Testar as Regras de Criação de Oportunidades

## 🧪 Endpoint de Teste

```
POST /api/test/validate-opp-creation
```

**Parâmetros:**
```json
{
  "clientId": "ID_DO_CLIENTE_AQUI",
  "mensagem": "ok",
  "conversationId": "ID_CONVERSA_OPCIONAL",
  "isClientMessage": true
}
```

**Resposta:**
```json
{
  "mensagem": "ok",
  "analysis": {
    "etapa": "PROPOSTA",
    "sentimento": "positivo",
    "intenção": "aprovacao_envio",
    "deveAgir": true,
    "confianca": 100,
    "motivo": "Ação explícita para proposta"
  },
  "validation": {
    "podecriar": true,
    "motivo": "Todas as condições atendidas",
    "etapa": "PROPOSTA"
  }
}
```

---

## ✅ Casos de Teste

### 1. LISTA PROPOSTA - "ok" → PROPOSTA
```json
{
  "clientId": "123",
  "mensagem": "ok",
  "isClientMessage": true
}
```
**Esperado:** `podecriar: true, etapa: PROPOSTA`

### 2. LISTA PROPOSTA - "👍" → PROPOSTA
```json
{
  "clientId": "123",
  "mensagem": "👍",
  "isClientMessage": true
}
```
**Esperado:** `podecriar: true, etapa: PROPOSTA`

### 3. LISTA PROPOSTA - "manda" → PROPOSTA
```json
{
  "clientId": "123",
  "mensagem": "manda",
  "isClientMessage": true
}
```
**Esperado:** `podecriar: true, etapa: PROPOSTA`

### 4. LISTA CONTATO - "como funciona?" → CONTATO
```json
{
  "clientId": "123",
  "mensagem": "como funciona?",
  "isClientMessage": true
}
```
**Esperado:** `podecriar: true, etapa: CONTATO`

### 5. LISTA NEUTRA - "oi" → BLOQUEIO
```json
{
  "clientId": "123",
  "mensagem": "oi",
  "isClientMessage": true
}
```
**Esperado:** `podecriar: false, deveAgir: false`

### 6. LISTA NEUTRA - "kkk" → BLOQUEIO
```json
{
  "clientId": "123",
  "mensagem": "kkk",
  "isClientMessage": true
}
```
**Esperado:** `podecriar: false, deveAgir: false`

### 7. LISTA NEUTRA - "obrigado" → BLOQUEIO
```json
{
  "clientId": "123",
  "mensagem": "obrigado",
  "isClientMessage": true
}
```
**Esperado:** `podecriar: false, deveAgir: false`

### 8. Mensagem não do cliente → BLOQUEIO
```json
{
  "clientId": "123",
  "mensagem": "ok",
  "isClientMessage": false
}
```
**Esperado:** `podecriar: false, motivo: Mensagem não é do cliente`

### 9. REJEIÇÃO CLARA - "caro" → PERDIDO
```json
{
  "clientId": "123",
  "mensagem": "muito caro",
  "isClientMessage": true
}
```
**Esperado:** `podecriar: true, etapa: PERDIDO`

---

## 🔍 Como Testar via Browser

1. **Abrir DevTools** (F12)
2. **Abrir Console** (ou Network → XHR)
3. **Colar código:**

```javascript
const teste = await fetch('/api/test/validate-opp-creation', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    clientId: '123',
    mensagem: 'ok',
    isClientMessage: true
  })
}).then(r => r.json());

console.log(teste);
```

4. **Ver resultado no console**

---

## 📋 Regras Validadas

✅ 1. Mensagem do cliente (incoming)
✅ 2. IA decidiu agir (deveAgir=true)
✅ 3. Etapa válida (não AUTOMÁTICA)
✅ 4. Nunca 2+ opps ativas por cliente
✅ 5. Conversa ativa (30 min) - exceto PROPOSTA
✅ LISTA PROPOSTA - sempre cria
✅ LISTA CONTATO - cria CONTATO
✅ LISTA NEUTRA - nunca cria
✅ REJEIÇÕES - cria PERDIDO

---

## 🚀 Próximas Etapas

1. Teste cada caso acima
2. Verifique os logs do servidor (verificar console)
3. Quando tudo passar, faça deploy com **Publish**
