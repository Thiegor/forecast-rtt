# Guia Power Automate — RTT Forecast

## Credenciais globais (usar em todos os flows)

| Variável | Valor |
|---|---|
| **URL Supabase** | `https://xiwuefhgkteqgmbnsrrb.supabase.co` |
| **API Key** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpd3VlZmhna3RlcWdtYm5zcnJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTE1NDMsImV4cCI6MjA5MDcyNzU0M30.EUs2WgqySNe0fusiHcIDo1s2PkO5LfuL3TAMgEaIovk` |
| **App URL** | `https://thiegor.github.io/forecast-rtt` |
| **Site SharePoint** | `https://rematiptopbr.sharepoint.com/sites/Contratos` |

---

## Flow 1 — RTT: Sync Projetos

**O que faz:** Quando a planilha GESTÃO PRJETOS E CONTRATOS.xlsx é modificada, sincroniza os dados cadastrais de projetos com o Supabase.

### Como criar no Power Automate

Acesse **make.powerautomate.com → Criar → Fluxo automatizado na nuvem**

---

#### Trigger: When a file is modified (properties only)

| Campo | Valor |
|---|---|
| Site Address | `https://rematiptopbr.sharepoint.com/sites/Contratos` |
| Library Name | `Documents` |
| File | `/General/Gerenciamento/Contratos - Serviços/GESTÃO PRJETOS E CONTRATOS.xlsx` |

---

#### Ação 1: List rows present in a table

| Campo | Valor |
|---|---|
| Conector | Excel Online (Business) |
| Location | SharePoint |
| Document Library | Documents |
| File | `/General/Gerenciamento/Contratos - Serviços/GESTÃO PRJETOS E CONTRATOS.xlsx` |
| Table | `tbl_Projetos` |

---

#### Ação 2: Apply to each

- **Input:** `value` da ação anterior (selecionar via dynamic content)

Dentro do loop, adicionar **HTTP**:

| Campo | Valor |
|---|---|
| Method | POST |
| URI | `https://xiwuefhgkteqgmbnsrrb.supabase.co/rest/v1/projetos` |

**Headers** (adicionar um a um clicando em "+ Add new parameter" → Headers):

| Chave | Valor |
|---|---|
| `apikey` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpd3VlZmhna3RlcWdtYm5zcnJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTE1NDMsImV4cCI6MjA5MDcyNzU0M30.EUs2WgqySNe0fusiHcIDo1s2PkO5LfuL3TAMgEaIovk` |
| `Authorization` | `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpd3VlZmhna3RlcWdtYm5zcnJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTE1NDMsImV4cCI6MjA5MDcyNzU0M30.EUs2WgqySNe0fusiHcIDo1s2PkO5LfuL3TAMgEaIovk` |
| `Content-Type` | `application/json` |
| `Prefer` | `resolution=merge-duplicates` |

**Body** (clicar em "Switch to input entire array" se aparecer, depois colar como expressão):

Clicar no campo Body → botão **fx** (Expression) → colar:

```
concat('{"cod_projeto":', items('Apply_to_each')?['Cód. Projeto'], ',"identificacao":"', replace(items('Apply_to_each')?['Identificação'], '"', '\"'), '","cliente":"', replace(items('Apply_to_each')?['Cliente'], '"', '\"'), '","gerente_site":"', replace(items('Apply_to_each')?['Gerente Site'], '"', '\"'), '","gerente_regional":"', replace(items('Apply_to_each')?['Gerente Regional'], '"', '\"'), '","status":"', replace(items('Apply_to_each')?['Status'], '"', '\"'), '"}')
```

> ⚠️ **Importante:** os nomes dos campos entre `?['...']` devem ser exatamente iguais aos cabeçalhos das colunas em `tbl_Projetos`. Abrir o Excel e confirmar os nomes antes de salvar.

---

#### Testar o flow

1. Salvar o flow
2. Clicar em **Test → Manually → Test**
3. Abrir o Excel no SharePoint e salvar qualquer alteração para disparar
4. Verificar em **Run history** se executou com sucesso
5. Confirmar no Supabase: `SELECT * FROM projetos ORDER BY cod_projeto;`

---

## Flow 2 — RTT: Import BP Anual

**O que faz:** Importa os valores de Budget Plan da planilha `Painel_de_Receita_Atual.xlsx` para a tabela `bp_anual` no Supabase. Roda **1x por ano**, disparado manualmente.

### Como criar no Power Automate

**Criar → Fluxo instantâneo na nuvem** (trigger manual)

---

#### Trigger: Manually trigger a flow

Sem parâmetros adicionais.

---

#### Ação 1: List rows — tbl_RFC2026

| Campo | Valor |
|---|---|
| Conector | Excel Online (Business) |
| Location | SharePoint |
| Document Library | Documents |
| File | `/General/Gerenciamento/Apresentação de Resultados/Painel de Receita Atual/Painel_de_Receita_Atual.xlsx` |
| Table | `tbl_RFC2026` |

---

#### Ação 2: List rows — tbl_BP2026

Mesma configuração, tabela: `tbl_BP2026`

---

#### Ação 3: Apply to each (linha do tbl_RFC2026)

- **Input:** `value` da Ação 1

Dentro do loop:

**Ação 3a: Filter array** — encontrar o BP desta chave_rfc

| Campo | Valor |
|---|---|
| From | `value` da Ação 2 (tbl_BP2026) |
| Condition (left) | `item()?['Chave']` (ou o nome da coluna de chave no tbl_BP2026) |
| Condition | is equal to |
| Condition (right) | `items('Apply_to_each')?['Chave']` (chave_rfc da linha atual do tbl_RFC2026) |

**Ação 3b: Apply to each 2** — para cada mês, fazer upsert

> Como o tbl_BP2026 provavelmente tem 1 linha por chave_rfc com colunas Jan, Fev... Dez, criar 12 ações HTTP (uma por mês) ou usar uma variável de array.

**Alternativa simplificada — 12 ações HTTP, uma por mês:**

Para cada mês, adicionar uma ação **HTTP**:

| Campo | Valor |
|---|---|
| Method | POST |
| URI | `https://xiwuefhgkteqgmbnsrrb.supabase.co/rest/v1/bp_anual` |
| Headers | (mesmos do Flow 1) + `Prefer: resolution=merge-duplicates` |

Body (exemplo para Janeiro — mês 1):
```
concat('{"chave_rfc":"', replace(items('Apply_to_each')?['Chave'], '"', '\"'), '","cod_projeto":', items('Apply_to_each')?['Cód. Projeto'], ',"grupo":"', replace(items('Apply_to_each')?['Grupo'], '"', '\"'), '","ano":2026,"mes":1,"valor_bp":', if(equals(first(body('Filter_array'))?['Jan'], null), '0', string(first(body('Filter_array'))?['Jan'])), '}')
```

Repetir para mes 2 (Fev), 3 (Mar) ... 12 (Dez), trocando `"mes":1` e `?['Jan']` correspondentemente.

> ⚠️ **Confirmar:** os nomes das colunas de BP na tbl_BP2026 (Jan/Fev ou Janeiro/Fevereiro ou 01/02?) e o nome da coluna de chave (`'Chave'` ou `'Chave RFC'`?). Abrir o Excel e verificar antes de montar as expressões.

---

## Flow 3 — RTT: Exportar RFC Semanal

**O que faz:** Toda sexta às 12h, exporta o forecast da semana atual do Supabase para uma planilha no SharePoint. Também aceita disparo via webhook (botão no app para o admin).

### Como criar no Power Automate

**Criar → Fluxo automatizado na nuvem**

---

#### Trigger A: Recurrence

| Campo | Valor |
|---|---|
| Interval | 1 |
| Frequency | Week |
| On these days | Friday |
| At these hours | 12 |
| At these minutes | 0 |
| Time zone | (UTC-03:00) Brasília |

---

#### Trigger B: When an HTTP request is received (adicionar como trigger paralelo)

- Deixar o Schema em branco ou colar:
```json
{
  "type": "object",
  "properties": {
    "semana": { "type": "integer" },
    "ano": { "type": "integer" }
  }
}
```

> Após salvar, o Power Automate gera a **HTTP POST URL**. Copiar essa URL e colocar na constante `WEBHOOK_RFC_URL` no topo de `src/pages/Forecast.js`.

---

#### Ação 1: Initialize variable — semanaAtual

| Campo | Valor |
|---|---|
| Name | `semanaAtual` |
| Type | Integer |
| Value | (expressão fx) `if(equals(triggerBody()?['semana'], null), int(div(sub(dayOfYear(utcNow()), 1), 7)), triggerBody()?['semana'])` |

> Esta expressão usa o número da semana do webhook se vier do app, ou calcula a semana aproximada pela data se vier da recorrência. (Ajuste fino pode ser feito depois.)

---

#### Ação 2: Initialize variable — anoAtual

| Campo | Valor |
|---|---|
| Name | `anoAtual` |
| Type | Integer |
| Value | (expressão fx) `if(equals(triggerBody()?['ano'], null), int(formatDateTime(utcNow(), 'yyyy')), triggerBody()?['ano'])` |

---

#### Ação 3: HTTP — buscar forecast da semana

| Campo | Valor |
|---|---|
| Method | GET |
| URI | (expressão fx) `concat('https://xiwuefhgkteqgmbnsrrb.supabase.co/rest/v1/forecast_semanal?semana_coleta=eq.', variables('semanaAtual'), '&ano_referencia=eq.', variables('anoAtual'), '&select=chave_rfc,identificacao,grupo,gerente_site,mes_referencia,receita_prevista,confianca,observacoes,data_coleta')` |
| apikey (header) | (igual aos outros flows) |
| Authorization (header) | (igual) |

---

#### Ação 4: Parse JSON

| Campo | Valor |
|---|---|
| Content | `body('HTTP')` |
| Schema | Clicar "Generate from sample" e colar: `[{"chave_rfc":"x","identificacao":"x","grupo":"x","gerente_site":"x","mes_referencia":"x","receita_prevista":0,"confianca":"x","observacoes":"x","data_coleta":"x"}]` |

---

#### Ação 5: Apply to each — escrever no Excel

- **Input:** `body('Parse_JSON')`

Dentro do loop — **Add a row into a table**:

| Campo | Valor |
|---|---|
| Conector | Excel Online (Business) |
| Location | SharePoint |
| File | `/General/Gerenciamento/Apresentação de Resultados/Painel de Receita Atual/RFC_Semanal.xlsx` |
| Table | `tbl_RFC_Semanal` |

> ⚠️ Criar o arquivo `RFC_Semanal.xlsx` no SharePoint com uma tabela `tbl_RFC_Semanal` contendo as colunas: `chave_rfc, identificacao, grupo, gerente_site, mes_referencia, receita_prevista, confianca, observacoes, data_coleta, semana, ano`

Mapear cada campo do Dynamic content para a coluna correspondente.

---

#### Ação 6: Post message no Teams

| Campo | Valor |
|---|---|
| Team | (selecionar o time da RTT) |
| Channel | (canal de Performance e Receita) |
| Message | `📊 RFC Semana @{variables('semanaAtual')}/@{variables('anoAtual')} exportado para o SharePoint.` |

---

## Flow 4 — RTT: Lembrete Forecast

**O que faz:** Toda quinta às 09h, posta lembrete no Teams com os gestores que ainda não enviaram o forecast da semana.

### Como criar no Power Automate

---

#### Trigger: Recurrence

| Campo | Valor |
|---|---|
| Interval | 1 |
| Frequency | Week |
| On these days | Thursday |
| At these hours | 9 |
| At these minutes | 0 |
| Time zone | (UTC-03:00) Brasília |

---

#### Ação 1: Initialize variable — semanaAtual

(mesmo cálculo do Flow 3, mas sem o fallback do webhook — só pela data)

| Value | (expressão fx) `int(div(sub(dayOfYear(utcNow()), 1), 7))` |
|---|---|

---

#### Ação 2: HTTP — gestores que JÁ enviaram

| Campo | Valor |
|---|---|
| Method | GET |
| URI | (expressão fx) `concat('https://xiwuefhgkteqgmbnsrrb.supabase.co/rest/v1/forecast_semanal?semana_coleta=eq.', variables('semanaAtual'), '&ano_referencia=eq.', int(formatDateTime(utcNow(), 'yyyy')), '&select=gerente_site')` |
| Headers | (padrão) |

---

#### Ação 3: Parse JSON da resposta

Schema: `[{"gerente_site":"x"}]`

---

#### Ação 4: HTTP — lista de gestores ativos

| Campo | Valor |
|---|---|
| Method | GET |
| URI | `https://xiwuefhgkteqgmbnsrrb.supabase.co/rest/v1/usuarios?perfil=eq.gestor&ativo=eq.true&select=nome` |
| Headers | (padrão) |

---

#### Ação 5: Parse JSON da resposta

Schema: `[{"nome":"x"}]`

---

#### Ação 6: Filter array — gestores PENDENTES

| Campo | Valor |
|---|---|
| From | `body('Parse_JSON_2')` (lista completa de gestores) |
| Condition (left) | (expressão) `contains(string(body('Parse_JSON')), item()?['nome'])` |
| Condition | is equal to |
| Condition (right) | `false` |

---

#### Ação 7: Condição — há pendentes?

- **If yes** (length do filter array > 0):

  **Post message no Teams:**
  ```
  🔔 Lembrete — Forecast Semanal (Semana @{variables('semanaAtual')})
  Prazo: sexta-feira às 12h

  Gestores com preenchimento pendente:
  @{join(body('Filter_array'), ', ')}

  Acesse: https://thiegor.github.io/forecast-rtt
  ```

- **If no:** não fazer nada (ou postar "✅ Todos os gestores já enviaram!")

---

## Checklist de implementação

- [ ] Flow 1 criado e testado — projetos sincronizando do SharePoint
- [ ] Flow 2 criado — BP 2026 importado para bp_anual (rodar 1x agora)
- [ ] Flow 3 criado — URL do webhook copiada para `WEBHOOK_RFC_URL` em `Forecast.js`
- [ ] Arquivo `RFC_Semanal.xlsx` criado no SharePoint com `tbl_RFC_Semanal`
- [ ] Flow 4 criado e testado
- [ ] Confirmar nomes de colunas do Excel nas expressões dos flows
