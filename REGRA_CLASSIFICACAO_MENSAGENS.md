# Regras de Classificação de Mensagens

## 📋 Ordem de Execução Obrigatória

1. **Verificar se é NEUTRA** → NÃO cria oportunidade
2. **Verificar se é AÇÃO (OK, 👍, etc)** → Cria **PROPOSTA**
3. **Verificar INTENÇÃO FRACA** → Cria **CONTATO**
4. **Se já existe opp** → Atualizar
5. **Se cliente ativo** → Criar nova opp

---

## ✅ LISTA PROPOSTA (SEMPRE cria PROPOSTA)

Mensagens de **aprovação/ação explícita**:

```
"ok"
"okk"
"okkk"
"OK"
"joia"
"👍"
"👌"
"sim"
"blz"
"beleza"
"manda"
"pode mandar"
"envia"
"me manda"
"envia aí"
"manda aí"
```

**Comportamento:**
- SEMPRE cria oportunidade em **PROPOSTA**
- Funciona para:
  - Primeira mensagem do cliente ✅
  - Cliente antigo ✅
  - Cliente ativo ✅
  - Cliente em FECHADO/PERDIDO → cria novo negócio ✅

---

## 🟧 LISTA CONTATO (cria CONTATO)

Mensagens de **intenção comercial fraca / dúvida**:

```
"quero saber mais"
"como funciona"
"pode me explicar"
"qual operadora é melhor"
```

**Comportamento:**
- Cria oportunidade em **CONTATO**
- Cliente quer mais informações mas não decidiu

---

## 🔴 LISTA NEUTRA (NÃO cria oportunidade)

Mensagens **completamente neutras/vazias**:

```
"oi"
"ola"
"olá"
"eae"
"e ae"
"bom dia"
"boa tarde"
"boa noite"
"kkk"
"kk"
"haha"
"hehe"
"rsrs"
"teste"
"test"
"valeu"
"valew"
"obrigado"
"obrigada"
"thanks"
"ok?"
"tudo bem"
"tudo bem?"
"🙌"
"🙏"
"🙃"
"😊"
"✌"
"..."
"…"
```

**Comportamento:**
- NÃO cria oportunidade ✅
- BLOQUEIO TOTAL (deveAgir = false)
- Não moveimenta etapa
- Ignora mensagem

---

## 🤖 Outras Classificações

### Mensagens Automáticas → AUTOMÁTICA
```
"deixe seu contato"
"aguarde"
"nosso suporte retornará"
"estamos verificando"
"fora do horário"
"estamos fora"
```

### Rejeições Claras → PERDIDO
```
"caro"
"muito caro"
"não quero"
"não gostei"
"não tenho interesse"
"para de mandar mensagem"
"não insista"
"chato"
"pare"
"bloquear"
"absurdo"
"péssimo"
"ruim"
"cancela tudo"
```

### Indecisão / Adiamento → BLOQUEIO
```
"vou pensar"
"deixa comigo"
"depois te falo"
"estou ocupado"
"depois a gente conversa"
"tenho que pensar"
"deixa eu avaliar"
```

---

## 🎯 Resumo Rápido

| Tipo | Etapa | Cria? | Exemplo |
|------|-------|-------|---------|
| **Ação** | PROPOSTA | ✅ Sim | "ok", "👍", "manda" |
| **Intenção Fraca** | CONTATO | ✅ Sim | "quero saber mais" |
| **Neutra** | — | ❌ Não | "oi", "kkk", "obrigado" |
| **Automática** | AUTOMÁTICA | ✅ Sim | "deixe seu contato" |
| **Rejeição** | PERDIDO | ✅ Sim | "não quero", "caro" |
| **Indecisão** | — | ❌ Não | "vou pensar", "depois" |

---

## 🔐 Etapas Bloqueadas (IA PROIBIDA)

A IA **NUNCA** pode mover oportunidades EM ou PARA essas etapas:

```
- PROPOSTA ENVIADA
- CONTRATO ENVIADO
- AGUARDANDO ACEITE
- AGUARDANDO ATENÇÃO
- AGUARDANDO CONTRATO
```

Estas etapas são **100% manuais**.

---

## 📝 Validação

- Confiança **≥ 75%** → Usa keywords locais
- Confiança **< 75%** → Consulta OpenAI (fallback)
- Em erro → Volta para keywords locais (fail-safe)

