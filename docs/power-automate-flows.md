# Guia Power Automate — RTT Forecast

## Credenciais globais (usar em todos os flows)

| Variável | Valor |
|---|---|
| **URL Supabase** | `https://xiwuefhgkteqgmbnsrrb.supabase.co` |
| **Anon Key** (leitura pública) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpd3VlZmhna3RlcWdtYm5zcnJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTE1NDMsImV4cCI6MjA5MDcyNzU0M30.EUs2WgqySNe0fusiHcIDo1s2PkO5LfuL3TAMgEaIovk` |
| **Service Role Key** (escrita — usar nos flows) | Obter em: Supabase Dashboard → Settings → API → **service_role** (secret) |
| **App URL** | `https://thiegor.github.io/forecast-rtt` |
| **Site SharePoint** | `https://rematiptopbr.sharepoint.com/sites/Contratos` |

> ⚠️ **IMPORTANTE — qual chave usar nos flows:**
> Os flows escrevem no banco (upsert). A RLS do Supabase só permite escrita com a **service_role key**.
> Use a service_role key em **todos os headers `apikey` e `Authorization`** das ações HTTP dos flows.
> A anon key serve apenas para leituras públicas (usada no app React).

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

Dentro do loop, adicionar **duas ações**:

---

##### Ação 2a: Compose — montar o JSON

| Campo | Valor |
|---|---|
| Ação | **Data Operations → Compose** |
| Nome | `Compose_Projeto` |

**Inputs** — clicar no botão **fx** (Expression) e colar:

```
json(concat('{"cod_projeto":"', replace(string(items('Apply_to_each')?['Cód_x002e_ Projeto']), '"', ''), '","identificacao":"', replace(string(items('Apply_to_each')?['Identificação']), '"', '\"'), '","cliente":"', replace(string(items('Apply_to_each')?['Cliente']), '"', '\"'), '","gerente_site":"', replace(string(items('Apply_to_each')?['Gerente Site']), '"', '\"'), '","gerente_regional":"', replace(string(items('Apply_to_each')?['Gerente Regional']), '"', '\"'), '","status":"', replace(string(items('Apply_to_each')?['Status']), '"', '\"'), '"}'))
```

> ⚠️ **ATENÇÃO — nome da coluna codificado:** O Power Automate substitui caracteres especiais nos nomes das colunas. O ponto em `Cód. Projeto` vira `_x002e_`, ficando **`Cód_x002e_ Projeto`** (com espaço após o `_`). Usar exatamente esse nome na expressão.
>
> O campo `cod_projeto` foi alterado para `text` no Supabase, então todos os valores (inclusive "005/26", "CSN23-1") são aceitos sem conversão.

---

##### Ação 2b: HTTP — upsert no Supabase

| Campo | Valor |
|---|---|
| Method | POST |
| URI | `https://xiwuefhgkteqgmbnsrrb.supabase.co/rest/v1/projetos` |

**Headers:**

| Chave | Valor |
|---|---|
| `apikey` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpd3VlZmhna3RlcWdtYm5zcnJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTE1NDMsImV4cCI6MjA5MDcyNzU0M30.EUs2WgqySNe0fusiHcIDo1s2PkO5LfuL3TAMgEaIovk` |
| `Authorization` | `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpd3VlZmhna3RlcWdtYm5zcnJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTE1NDMsImV4cCI6MjA5MDcyNzU0M30.EUs2WgqySNe0fusiHcIDo1s2PkO5LfuL3TAMgEaIovk` |
| `Content-Type` | `application/json` |
| `Prefer` | `resolution=merge-duplicates` |

**Body** — clicar em **fx** (Expression) e colar:

```
outputs('Compose_Projeto')
```

> Isso usa exatamente o JSON montado no passo anterior. O nome `Compose_Projeto` deve bater com o nome dado à ação Compose.

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

## Flow 3a — RTT: Exportar RFC Semanal (automático)

**O que faz:** Toda sexta às 12h, lê o forecast do Supabase e atualiza as colunas `RB26`–`RB48` da `tbl_RFC2026` via **Office Script** — apenas 4 ações no flow.

> **Por que dois flows (3a e 3b)?** O Power Automate não suporta Recurrence + HTTP trigger no mesmo flow.

---

### Passo 0: Criar o Office Script no Excel

Abrir `Painel_de_Receita_Atual.xlsx` no SharePoint → menu **Automate** → **New Script** → colar o código abaixo → salvar como **`AtualizarRFC`**:

```typescript
function main(workbook: ExcelScript.Workbook, forecastJson: string) {
  const forecast: { chave_rfc: string; mes_referencia: string; receita_prevista: number }[] = JSON.parse(forecastJson);

  const table = workbook.getTable("tbl_RFC2026");
  const headerRow = table.getHeaderRowRange().getValues()[0] as string[];
  const dataRange = table.getRangeBetweenHeaderAndTotal();
  const values = dataRange.getValues();

  const mesParaColuna: Record<string, string> = {
    "Janeiro": "RB26", "Fevereiro": "RB28", "Março": "RB30",
    "Abril": "RB32", "Maio": "RB34", "Junho": "RB36",
    "Julho": "RB38", "Agosto": "RB40", "Setembro": "RB42",
    "Outubro": "RB44", "Novembro": "RB46", "Dezembro": "RB48"
  };

  const chaveIdx = headerRow.indexOf("Chave");
  const colIndices: Record<string, number> = {};
  for (const [mes, col] of Object.entries(mesParaColuna)) {
    colIndices[mes] = headerRow.indexOf(col);
  }

  const chaveToRow: Record<string, number> = {};
  for (let i = 0; i < values.length; i++) {
    chaveToRow[String(values[i][chaveIdx])] = i;
  }

  for (const item of forecast) {
    const rowIdx = chaveToRow[item.chave_rfc];
    const colIdx = colIndices[item.mes_referencia];
    if (rowIdx !== undefined && colIdx !== undefined && colIdx >= 0) {
      values[rowIdx][colIdx] = item.receita_prevista;
    }
  }

  dataRange.setValues(values);
}
```

> O script recebe o JSON do Supabase, localiza cada linha pelo campo `Chave` e atualiza apenas as colunas RB do mês correspondente. Linhas sem forecast ficam intactas.

---

### Criar o flow: Fluxo automatizado na nuvem

#### Trigger: Recurrence

| Campo | Valor |
|---|---|
| Interval | `1` |
| Frequency | `Week` |
| On these days | `Friday` |
| At these hours | `12` |
| At these minutes | `0` |
| Time zone | `(UTC-03:00) Brasília` |

---

#### Ação 1: Initialize variable — semanaAtual

| Campo | Valor |
|---|---|
| Name | `semanaAtual` |
| Type | `Integer` |
| Value (fx) | `add(int(div(sub(dayOfYear(utcNow()), 1), 7)), 1)` |

---

#### Ação 2: Initialize variable — anoAtual

| Campo | Valor |
|---|---|
| Name | `anoAtual` |
| Type | `Integer` |
| Value (fx) | `int(formatDateTime(utcNow(), 'yyyy'))` |

---

#### Ação 3: HTTP — buscar forecast da semana no Supabase

| Campo | Valor |
|---|---|
| Method | `GET` |
| URI (fx) | `concat('https://xiwuefhgkteqgmbnsrrb.supabase.co/rest/v1/forecast_semanal?semana_coleta=eq.', variables('semanaAtual'), '&ano_referencia=eq.', variables('anoAtual'), '&select=chave_rfc,mes_referencia,receita_prevista')` |
| `apikey` | service_role key |
| `Authorization` | `Bearer <service_role key>` |

---

#### Ação 4: Run script — AtualizarRFC

| Campo | Valor |
|---|---|
| Conector | Excel Online (Business) |
| Location | SharePoint |
| Document Library | Documents |
| File | `/General/Gerenciamento/Apresentação de Resultados/Painel de Receita Atual/Painel_de_Receita_Atual.xlsx` |
| Script | `AtualizarRFC` |
| forecastJson (fx) | `string(body('HTTP'))` |

---

#### Ação 5: Post message no Teams

| Campo | Valor |
|---|---|
| Team | (time da RTT) |
| Channel | (canal Performance e Receita) |
| Message | `RFC Semana @{variables('semanaAtual')}/@{variables('anoAtual')} atualizado no Painel de Receita.` |

---

## Flow 3b — RTT: Atualizar RFC (webhook admin)

**O que faz:** Idêntico ao Flow 3a, disparado pelo botão "Atualizar RFC Exportado" no app.

**Criar → Fluxo automatizado na nuvem**

#### Trigger: When an HTTP request is received

Schema:
```json
{
  "type": "object",
  "properties": {
    "semana": { "type": "integer" },
    "ano": { "type": "integer" }
  }
}
```

> Após salvar, copiar a **HTTP POST URL** gerada e colar em `WEBHOOK_RFC_URL` no topo de `src/pages/Forecast.js`.

#### Ações 1–5: idênticas ao Flow 3a, exceto:

**Ação 1 — semanaAtual (fx):** `triggerBody()?['semana']`

**Ação 2 — anoAtual (fx):** `triggerBody()?['ano']`

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
