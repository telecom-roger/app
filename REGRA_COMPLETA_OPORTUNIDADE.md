# 📋 REGRA COMPLETA: CRIAÇÃO/ATUALIZAÇÃO DE OPORTUNIDADE

## ⚡ RESUMO EXECUTIVO

Quando um cliente envia uma mensagem:
1. Sistema ANALISA a mensagem
2. Sistema VALIDA se deve agir
3. Sistema VERIFICA se opp existe
4. Sistema CRIA ou ATUALIZA conforme regras
5. Sistema RECALCULA status do cliente

---

## 🔄 FLUXO COMPLETO PASSO-A-PASSO

### PASSO 0: ANÁLISE DA MENSAGEM

**Função:** `analyzeClientMessage()` 

A mensagem passa por DUAS análises em série:

**ANÁLISE 1: KEYWORDS** (Palavras-chave Local)
- Sistema verifica contra listas pré-definidas
- Se confiança >= 75% → usa resultado local
- Resultado contém: sentimento, intenção, etapa, deveAgir

**ANÁLISE 2: OPENAI** (Se confiança < 75%)
- Consulta OpenAI GPT-4o-mini
- Retorna JSON com mesma estrutura
- Resultado é validado e normalizado

**Resultado = MessageAnalysis:**
- `sentimento`: "positivo" | "neutro" | "negativo"
- `intenção`: "solicitacao_info" | "aprovacao_envio" | "resposta_automatica" | "rejeicao_clara" | "rejeicao_parcial" | "indefinida"
- `etapa`: "CONTATO" | "PROPOSTA" | "AUTOMÁTICA" | "PERDIDO" | "" (vazio)
- `deveAgir`: boolean
- `motivo`: string com razão

---

## 🚫 PASSO 1: BLOQUEIO TOTAL - MENSAGENS NEUTRAS PURAS

**Mensagens que NUNCA criam oportunidade:**

```
"oi", "ola", "olá", "teste", "test", "blz",
"kkk", "kk", "haha", "rsrs",
"valeu", "valew", "obrigado", "obrigada", "thanks",
"ok?", "🙃", "😊", "👌", "✌", "...", "…"
```

**O que retorna:**
- sentimento = "neutro"
- intenção = "indefinida"
- etapa = "" (vazio)
- **deveAgir = false** ← BLOQUEIO CRÍTICO

**Em routes.ts (linha 3184-3188):**
```
if (analysis.deveAgir === false) {
  // RETORNA SEM FAZER NADA
  res.json(mensagem);
  return;
}
```

**Resultado:**
- ❌ NÃO cria oportunidade
- ❌ NÃO move oportunidade
- ✅ Apenas salva mensagem

---

## 📝 PASSO 2: SEGUNDA VALIDAÇÃO - NEUTRO + INDEFINIDA

**Localização:** routes.ts, linhas 3191-3196

Se a IA retornar AMBAS:
- `sentimento === "neutro"` E
- `intenção === "indefinida"`

**O que acontece:**
```
if (ehMensagemNeutra) {
  res.json(mensagem);
  return; // ← SAIA
}
```

**Exemplos que caem aqui:**
- "vou pensar" → indefinida, não move
- "deixa comigo" → indefinida, não move
- "estou ocupado" → indefinida, não move

**Resultado:**
- ❌ NÃO cria
- ❌ NÃO move
- ✅ Apenas salva

---

## 🤖 PASSO 3: DETECÇÃO DE MENSAGEM AUTOMÁTICA

**Localização:** routes.ts, linhas 3198-3230

Se `analysis.ehMensagemAutomatica === true`:

Exemplos: "deixe seu contato", "aguarde", "nosso suporte retornará"

### Se cliente JÁ tem opp:

**Etapa BLOQUEADA?** (PROPOSTA ENVIADA, AGUARDANDO ACEITE)
- ❌ NÃO move

**Etapa NÃO BLOQUEADA?** (LEAD, CONTATO)
- ✅ MOVE para "AUTOMÁTICA"
- ✅ Registra na timeline
- ✅ Recalcula status

### Se cliente NÃO tem opp:

- ✅ CRIA em "AUTOMÁTICA"
- ✅ Recalcula status

---

## 🛑 PASSO 4: VERIFICAÇÃO DE ETAPA BLOQUEADA

**Localização:** routes.ts, linhas 3232-3234

Se cliente tem opp BLOQUEADA e mensagem NÃO é automática:

Etapas bloqueadas = PROPOSTA ENVIADA, CONTRATO ENVIADO, AGUARDANDO ACEITE, etc

**O que acontece:**
```
if (existingOpp && ETAPAS_MANUAIS_BLOQUEADAS.includes(existingOpp.etapa)) {
  // NÃO FAZ NADA
}
```

**Resultado:**
- ❌ NÃO move
- ✅ Apenas salva

---

## ✅ PASSO 5: LÓGICA NORMAL

**Localização:** routes.ts, linhas 3236-3312

### CENÁRIO 1: Cliente tem opp E etapa sugerida é DIFERENTE

#### Caso 1a: CONTATO → PROPOSTA (Aprovação clara)

**Condições (TODAS precisam ser verdadeiras):**
- Opp atual em: **CONTATO**
- IA sugere: **PROPOSTA**
- deveAgir = true
- sentimento = "positivo"

**O que acontece:**
1. ✅ MOVE para PROPOSTA
2. ✅ Atualiza título
3. ✅ Registra timeline (marca como "IA")
4. ✅ Recalcula status do cliente

**Exemplos:**
- "Manda a proposta!" → PROPOSTA
- "Tenho interesse!" → PROPOSTA
- "👍" → PROPOSTA

#### Caso 1b: LEAD → Qualquer etapa

- IA pode mover para qualquer etapa sugerida

#### Caso 1c: CONTATO → PROPOSTA ou PERDIDO

- IA pode mover para PROPOSTA ou PERDIDO

#### Caso 1d: Outros movimentos

- ❌ Não permitido

---

### CENÁRIO 2: Cliente NÃO tem oportunidade

**Localização:** linhas 3297-3316

#### Criar opp?

**Condições para CRIAR (UMA das 3 é suficiente):**
```
sentimento === "positivo" 
OR intenção === "aprovacao_envio"
OR intenção === "solicitacao_info"
```

**O que acontece:**
1. ✅ Cria na **etapa sugerida pela IA** (CONTATO ou PROPOSTA)
2. ✅ Atualiza título
3. ✅ Recalcula status

**Exemplos:**
- "Tenho interesse" → sentimento positivo → CRIA em CONTATO (se IA sugerir CONTATO)
- "Qual o preço?" → solicitacao_info → CRIA em CONTATO (se IA sugerir CONTATO)
- "Manda proposta" → aprovacao_envio → CRIA em PROPOSTA (se IA sugerir PROPOSTA)

#### NÃO criar?

Se nenhuma das 3 condições:
- ❌ NÃO cria
- ✅ Apenas salva

**Exemplos:**
- "Vou pensar" → indefinida → NÃO cria
- "Estou ocupado" → indefinida → NÃO cria

---

## 📊 TABELA RESUMIDA

| Mensagem | Sentimento | Intenção | Existe OPP? | IA Sugere | Ação |
|----------|-----------|----------|-----------|----------|------|
| "oi" | neutro | indefinida | Não | "" | ❌ NÃO cria |
| "teste" | neutro | indefinida | Não | "" | ❌ NÃO cria |
| "vou pensar" | neutro | indefinida | Não | "" | ❌ NÃO cria |
| "tenho interesse" | positivo | solicitacao_info | Não | CONTATO | ✅ CRIA em CONTATO |
| "qual o preço?" | positivo | solicitacao_info | Não | CONTATO | ✅ CRIA em CONTATO |
| "manda proposta" | positivo | aprovacao_envio | Não | PROPOSTA | ✅ CRIA em PROPOSTA |
| "👍" | positivo | aprovacao_envio | Sim (CONTATO) | PROPOSTA | ✅ MOVE para PROPOSTA |

---

## 🔄 ORDEM EXATA DE VALIDAÇÕES

```
1. deveAgir === false? → PARA, NÃO FAZ NADA
2. Neutro + Indefinida? → PARA, NÃO FAZ NADA
3. Mensagem automática? → MOVE para AUTOMÁTICA
4. Etapa bloqueada? → PARA, NÃO FAZ NADA
5. Tem opp + etapa ≠? → MOVE conforme regras
6. Tem opp + etapa =? → PARA
7. NÃO tem opp? → CRIA conforme sugestão da IA
```

---

## 💡 REGRA: CONTATO vs PROPOSTA

**Agora respeita a sugestão da IA:**
- Se IA sugere **PROPOSTA** → Cria em PROPOSTA ✅
- Se IA sugere **CONTATO** → Cria em CONTATO ✅
- Padrão é **CONTATO** se IA não retornar etapa

---

## ✅ CHECKLIST: QUANDO CRIA

```
Para CRIAR oportunidade, precisa de TODOS estes:
✅ deveAgir !== false?
✅ Não é neutro + indefinida?
✅ Não é mensagem automática?
✅ Etapa não bloqueada?
✅ Cliente NÃO tem opp?
✅ Sentimento positivo OU intenção comercial?

Se TODOS são verdadeiros → ✅ CRIA na etapa sugerida pela IA
```

---

Fim da descrição completa da lógica! 🎯
