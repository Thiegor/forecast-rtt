import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const RTT = {
  vermelho:      "#E31E24",
  vermelhoEscuro:"#C01820",
  vermelhoFundo: "rgba(227,30,36,0.07)",
  preto:         "#09090b",
  cinzaEscuro:   "#111113",
  cinzaMedio:    "#1c1c1f",
  cinzaBorda:    "#27272a",
  cinzaBorda2:   "#3f3f46",
  cinzaTexto:    "#52525b",
  cinzaClaro:    "#a1a1aa",
  branco:        "#fafafa",
  brancoSuave:   "#d4d4d8",
  amarelo:       "#f59e0b",
  verde:         "#10b981",
}

const F = `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

const GRUPO_CORES = {
  Backlog:     { bg:"rgba(227,30,36,0.1)",  text:"#E31E24", border:"rgba(227,30,36,0.2)" },
  "Renovação": { bg:"rgba(96,165,250,0.1)", text:"#60a5fa", border:"rgba(96,165,250,0.2)" },
  PIPE:        { bg:"rgba(240,165,0,0.1)",  text:"#f0a500", border:"rgba(240,165,0,0.2)" },
  Spot:        { bg:"rgba(168,85,247,0.1)", text:"#c084fc", border:"rgba(168,85,247,0.2)" },
}

const MESES_LONGOS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]

// URL do webhook Power Automate — preencher após criar o flow "Exportar RFC Semanal"
const WEBHOOK_RFC_URL = ''

const CONFIANCA_OPTS = [
  { label: "Confirmado", cor: "#22c55e", corFundo: "rgba(34,197,94,0.15)", corBorda: "rgba(34,197,94,0.4)" },
  { label: "Provável",   cor: "#f0a500", corFundo: "rgba(240,165,0,0.15)", corBorda: "rgba(240,165,0,0.4)" },
  { label: "Em risco",   cor: "#E31E24", corFundo: "rgba(227,30,36,0.15)", corBorda: "rgba(227,30,36,0.4)" },
]

function getISOWeek(date) {
  const d = new Date(date)
  d.setHours(0,0,0,0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
}

function isJanelaAberta() {
  const now = new Date()
  const dia = now.getDay() // 4=quinta, 5=sexta
  const hora = now.getHours() + now.getMinutes() / 60
  if (dia === 4 && hora >= 9) return true
  if (dia === 5 && hora < 12) return true
  return false
}

function fmt(val) {
  if (!val || val === 0) return "—"
  if (val >= 1000000) return `${(val/1000000).toFixed(1)}M`
  if (val >= 1000) return `${(val/1000).toFixed(0)}K`
  return val.toLocaleString("pt-BR")
}

function calcPct(a, b) {
  if (!b || b === 0) return null
  return ((a - b) / b) * 100
}

function Delta({ val, refVal }) {
  const p = calcPct(val, refVal)
  if (p === null || !val) return <span style={{color:RTT.cinzaTexto,fontSize:9}}>—</span>
  const cor = p > 5 ? RTT.verde : p < -5 ? RTT.vermelho : RTT.amarelo
  return <span style={{fontSize:9,fontWeight:700,color:cor}}>{p>0?"▲":"▼"}{Math.abs(p).toFixed(0)}%</span>
}

function fmtDataColeta(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  const dia = String(d.getDate()).padStart(2,'0')
  const mes = String(d.getMonth()+1).padStart(2,'0')
  const h   = String(d.getHours()).padStart(2,'0')
  const min = String(d.getMinutes()).padStart(2,'0')
  return `${dia}/${mes} ${h}:${min}`
}

function PainelAnual({ proj, mesAtualIdx, bpAnual, forecastAnual, onClose }) {
  const anoAtual = new Date().getFullYear()
  const mesesRolantes = [mesAtualIdx, mesAtualIdx+1, mesAtualIdx+2]
  const projBP = bpAnual.filter(b => b.chave_rfc === proj.chave_rfc && b.ano === anoAtual)
  const totalBP = projBP.reduce((s,b) => s + (b.valor_bp||0), 0)

  // RFC atual por mês: registro com maior semana_coleta
  const rfcPorMes = {}
  forecastAnual
    .filter(f => f.chave_rfc === proj.chave_rfc && f.ano_referencia === anoAtual)
    .forEach(f => {
      const key = f.mes_referencia
      if (!rfcPorMes[key] || f.semana_coleta > rfcPorMes[key].semana_coleta)
        rfcPorMes[key] = f
    })

  const F = `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex"}}>
      <div onClick={onClose} style={{flex:1,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(3px)"}}/>
      <div style={{width:480,background:RTT.cinzaEscuro,borderLeft:`1px solid ${RTT.cinzaBorda}`,display:"flex",flexDirection:"column",overflow:"hidden",fontFamily:F}}>
        {/* HEADER DO PAINEL */}
        <div style={{padding:"20px 24px 16px",borderBottom:`1px solid ${RTT.cinzaBorda}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div style={{flex:1,marginRight:12}}>
              <div style={{fontSize:10,color:RTT.cinzaTexto,marginBottom:4,fontFamily:F}}>Visão Anual {anoAtual}</div>
              <div style={{fontSize:14,fontWeight:600,color:RTT.branco,lineHeight:1.3,fontFamily:F}}>{proj.identificacao}</div>
              <div style={{display:"flex",gap:8,marginTop:6,alignItems:"center"}}>
                {proj.grupo && <span style={{fontSize:10,padding:"1px 7px",borderRadius:4,background:RTT.cinzaMedio,color:RTT.cinzaClaro,border:`1px solid ${RTT.cinzaBorda2}`,fontFamily:F}}>{proj.grupo}</span>}
                <span style={{fontSize:11,color:RTT.cinzaTexto,fontFamily:F}}>{proj.gerente_site}</span>
              </div>
            </div>
            <button onClick={onClose} style={{background:"transparent",border:`1px solid ${RTT.cinzaBorda}`,color:RTT.cinzaClaro,width:28,height:28,borderRadius:6,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F}}>✕</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[
              {l:"BP Total "+anoAtual, v:`R$ ${fmt(totalBP)}`},
              {l:"Média mensal",       v:`R$ ${fmt(totalBP/12)}`},
            ].map(k=>(
              <div key={k.l} style={{background:RTT.cinzaMedio,borderRadius:6,padding:"8px 12px",border:`1px solid ${RTT.cinzaBorda}`}}>
                <div style={{fontSize:10,color:RTT.cinzaTexto,marginBottom:2,fontFamily:F}}>{k.l}</div>
                <div style={{fontSize:14,fontWeight:700,color:RTT.amarelo,fontFamily:F}}>{k.v}</div>
              </div>
            ))}
          </div>
        </div>
        {/* TABELA MENSAL */}
        <div style={{display:"grid",gridTemplateColumns:"48px 1fr 1fr 56px",padding:"8px 24px 6px",borderBottom:`1px solid ${RTT.cinzaBorda}`}}>
          {["Mês","BP","RFC atual","Δ"].map((h,i)=>(
            <div key={i} style={{fontSize:10,color:RTT.cinzaTexto,textAlign:i>0?"center":"left",fontWeight:500,fontFamily:F}}>{h}</div>
          ))}
        </div>
        <div style={{flex:1,overflowY:"auto"}}>
          {MESES_LONGOS.map((mes,i)=>{
            const isAtual = mesesRolantes.includes(i)
            const bpReg = projBP.find(b => b.mes === i+1)
            const bp = bpReg?.valor_bp || 0
            const rfcReg = rfcPorMes[mes]
            const rfc = rfcReg?.receita_prevista || 0
            const delta = bp > 0 && rfc > 0 ? ((rfc - bp) / bp * 100) : null
            const deltaCor = delta === null ? RTT.cinzaTexto : delta > 5 ? RTT.verde : delta < -5 ? RTT.vermelho : RTT.amarelo
            return (
              <div key={mes} style={{display:"grid",gridTemplateColumns:"48px 1fr 1fr 56px",padding:"7px 24px",background:isAtual?RTT.cinzaMedio:"transparent",borderLeft:isAtual?`2px solid ${RTT.vermelho}`:"2px solid transparent",borderBottom:`1px solid ${RTT.cinzaBorda}`}}>
                <div style={{fontSize:11,fontWeight:isAtual?600:400,color:isAtual?RTT.branco:RTT.cinzaClaro,fontFamily:F}}>{mes.slice(0,3)}</div>
                <div style={{textAlign:"center",fontSize:12,fontWeight:600,color:bp?RTT.amarelo:RTT.cinzaTexto,fontFamily:F}}>{fmt(bp)}</div>
                <div style={{textAlign:"center",fontSize:12,fontWeight:500,color:rfc?RTT.brancoSuave:RTT.cinzaTexto,fontFamily:F}}>{rfc ? fmt(rfc) : "—"}</div>
                <div style={{textAlign:"center",fontSize:10,fontWeight:600,color:deltaCor,fontFamily:F}}>
                  {delta !== null ? `${delta>0?'▲':'▼'}${Math.abs(delta).toFixed(0)}%` : "—"}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Forecast({ perfil, onLogout }) {
  const [projetosCadastro, setProjetosCadastro] = useState([])
  const [forecastSemana, setForecastSemana] = useState([])
  const [forecastSemanaAnterior, setForecastSemanaAnterior] = useState([])
  const [loading, setLoading] = useState(true)
  const [valores, setValores] = useState({})
  const [obsAbertas, setObsAbertas] = useState(new Set())
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState(null)
  const [painel, setPainel] = useState(null)
  const [filtro, setFiltro] = useState("Todos")
  const [bpAnual, setBpAnual] = useState([])
  const [forecastAnual, setForecastAnual] = useState([])
  const [atualizandoRFC, setAtualizandoRFC] = useState(false)
  const [rfcAtualizado, setRfcAtualizado] = useState(false)

  const now = new Date()
  const semana = getISOWeek(now)
  const anoAtual = now.getFullYear()
  const mesAtualIdx = now.getMonth()
  const janelaBloqueada = perfil.perfil !== 'admin' && !isJanelaAberta()

  // semana anterior (trata virada de ano)
  const semanaPrev = semana === 1 ? 52 : semana - 1
  const anoPrev = semana === 1 ? anoAtual - 1 : anoAtual

  const mes1 = MESES_LONGOS[mesAtualIdx]
  const mes2 = MESES_LONGOS[mesAtualIdx+1] || MESES_LONGOS[0]
  const mes3 = MESES_LONGOS[mesAtualIdx+2] || MESES_LONGOS[1]
  const ano1 = anoAtual
  const ano2 = mesAtualIdx+1 > 11 ? anoAtual+1 : anoAtual
  const ano3 = mesAtualIdx+2 > 11 ? anoAtual+1 : anoAtual

  const MESES = [
    { key:'mes1', label:mes1, ano:ano1, mesNum: mesAtualIdx + 1 },
    { key:'mes2', label:mes2, ano:ano2, mesNum: (mesAtualIdx + 1) % 12 + 1 },
    { key:'mes3', label:mes3, ano:ano3, mesNum: (mesAtualIdx + 2) % 12 + 1 },
  ]

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const { data: cadastro } = await supabase
        .from('projetos').select('*').eq('status','Vigente').order('identificacao')
      setProjetosCadastro(cadastro || [])

      // Início da janela atual: última quinta-feira às 9h
      const agora = new Date()
      const inicioJanela = new Date(agora)
      const diasDesdeQuinta = (agora.getDay() + 7 - 4) % 7
      inicioJanela.setDate(agora.getDate() - diasDesdeQuinta)
      inicioJanela.setHours(9, 0, 0, 0)

      // semana atual — apenas submissões da janela aberta (quinta 9h em diante)
      // garante que dados de testes anteriores não apareçam como "enviado"
      const { data: fc } = await supabase
        .from('forecast_semanal').select('*')
        .eq('semana_coleta', semana).eq('ano_referencia', anoAtual)
        .gte('data_coleta', inicioJanela.toISOString())
      setForecastSemana(fc || [])

      // RFC s-1: usa a semana mais recente disponível no banco (não necessariamente semana-1)
      const { data: ultimaSemanaData } = await supabase
        .from('forecast_semanal')
        .select('semana_coleta')
        .eq('ano_referencia', anoAtual)
        .order('semana_coleta', { ascending: false })
        .limit(1)
        .single()
      const semanaRef = ultimaSemanaData?.semana_coleta ?? semanaPrev
      const { data: fcPrev } = await supabase
        .from('forecast_semanal').select('*')
        .eq('semana_coleta', semanaRef).eq('ano_referencia', anoAtual)
      setForecastSemanaAnterior(fcPrev || [])

      // BP anual — todos os meses do ano atual
      const { data: bp } = await supabase
        .from('bp_anual').select('*')
        .eq('ano', anoAtual)
      setBpAnual(bp || [])

      // Forecast anual — todos os registros do ano atual (para PainelAnual)
      const { data: fcAnual } = await supabase
        .from('forecast_semanal').select('*')
        .eq('ano_referencia', anoAtual)
      setForecastAnual(fcAnual || [])

      setLoading(false)
    }
    carregar()
  }, []) // eslint-disable-line

  function getMesLabel(campo) {
    if (campo === 'mes1') return mes1
    if (campo === 'mes2') return mes2
    return mes3
  }

  function setValor(chave, campo, val) {
    setValores(prev => ({ ...prev, [chave]: { ...prev[chave], [campo]: val } }))
  }

  function toggleObs(key) {
    setObsAbertas(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Valor do input (pré-preenche da semana atual)
  function getVal(chave, campo) {
    if (valores[chave]?.[campo] !== undefined) return valores[chave][campo]
    const mes = getMesLabel(campo)
    const fc = forecastSemana.find(f => f.chave_rfc === chave && f.mes_referencia === mes)
    return fc ? fc.receita_prevista : ''
  }

  // Confiança (pré-preenche da semana atual)
  function getConfianca(chave, campo) {
    if (valores[chave]?.[campo+'_confianca'] !== undefined) return valores[chave][campo+'_confianca']
    const mes = getMesLabel(campo)
    const fc = forecastSemana.find(f => f.chave_rfc === chave && f.mes_referencia === mes)
    return fc?.confianca || ''
  }

  // Observações (pré-preenche da semana atual)
  function getObs(chave, campo) {
    if (valores[chave]?.[campo+'_obs'] !== undefined) return valores[chave][campo+'_obs']
    const mes = getMesLabel(campo)
    const fc = forecastSemana.find(f => f.chave_rfc === chave && f.mes_referencia === mes)
    return fc?.observacoes || ''
  }

  // RFC s-1: lê da semana ANTERIOR
  function getRFC(chave, mes) {
    const fc = forecastSemanaAnterior.find(f => f.chave_rfc === chave && f.mes_referencia === mes)
    return fc ? fc.receita_prevista : 0
  }

  // BP: lê de bp_anual por chave_rfc + mes (número 1-12) + ano
  function getBP(chave_rfc, mes, ano) {
    const reg = bpAnual.find(b => b.chave_rfc === chave_rfc && b.mes === mes && b.ano === ano)
    return reg?.valor_bp || 0
  }

  // Status de envio do gestor atual
  const registrosGestor = forecastSemana.filter(f => f.gerente_site === perfil.nome)
  const jaEnviei = registrosGestor.length > 0
  const ultimoEnvio = jaEnviei
    ? registrosGestor.sort((a,b) => new Date(b.data_coleta) - new Date(a.data_coleta))[0]?.data_coleta
    : null

  // Para admin: quais gestores já enviaram esta semana
  const gerentesQueEnviaram = new Set(forecastSemana.map(f => f.gerente_site))

  async function handleEnviar() {
    setEnviando(true)
    setErro(null)
    const registros = []
    const mesesMap = [
      { key:'mes1', label:mes1, ano:ano1 },
      { key:'mes2', label:mes2, ano:ano2 },
      { key:'mes3', label:mes3, ano:ano3 },
    ]

    for (const proj of itensFiltrados) {
      const chave_rfc = proj.chave_rfc
      for (const m of mesesMap) {
        // valor: estado local primeiro, senão valor já salvo desta semana
        const valStr = valores[chave_rfc]?.[m.key]
        const valExistente = forecastSemana.find(f => f.chave_rfc === chave_rfc && f.mes_referencia === m.label)?.receita_prevista
        const val = valStr !== undefined ? parseFloat(valStr) : valExistente
        if (!val || val === 0) continue

        const confianca = valores[chave_rfc]?.[m.key+'_confianca']
          ?? forecastSemana.find(f => f.chave_rfc === chave_rfc && f.mes_referencia === m.label)?.confianca
          ?? null
        const observacoes = valores[chave_rfc]?.[m.key+'_obs']
          ?? forecastSemana.find(f => f.chave_rfc === chave_rfc && f.mes_referencia === m.label)?.observacoes
          ?? null

        registros.push({
          chave_unica:      chave_rfc+'-'+m.label+'-'+m.ano+'-'+semana,
          chave_rfc,
          identificacao:    proj.identificacao,
          grupo:            proj.grupo,
          gerente_site:     perfil.nome,
          mes_referencia:   m.label,
          ano_referencia:   m.ano,
          semana_coleta:    semana,
          receita_prevista: val,
          confianca,
          observacoes,
          data_coleta:      new Date().toISOString(),
        })
      }
    }

    if (registros.length === 0) {
      setErro('Nenhum valor preenchido.')
      setEnviando(false)
      return
    }

    const { error } = await supabase.from('forecast_semanal').upsert(registros, { onConflict:'chave_unica' })
    if (error) {
      setErro(error.message)
    } else {
      const { data: fc } = await supabase
        .from('forecast_semanal').select('*')
        .eq('semana_coleta', semana).eq('ano_referencia', anoAtual)
      setForecastSemana(fc || [])
      setValores({})
      setSucesso(true)
      setTimeout(() => setSucesso(false), 4000)
    }
    setEnviando(false)
  }

  async function handleAtualizarRFC() {
    if (!WEBHOOK_RFC_URL) {
      alert('Webhook do Power Automate não configurado. Preencha WEBHOOK_RFC_URL em Forecast.js.')
      return
    }
    if (!window.confirm(`Deseja re-exportar o RFC da semana ${semana}/${anoAtual} para o SharePoint?`)) return
    setAtualizandoRFC(true)
    try {
      await fetch(WEBHOOK_RFC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semana, ano: anoAtual }),
      })
      setRfcAtualizado(true)
      setTimeout(() => setRfcAtualizado(false), 5000)
    } catch (e) {
      alert('Erro ao acionar webhook: ' + e.message)
    }
    setAtualizandoRFC(false)
  }

  // Derivar lista de itens: UNIÃO de chave_rfc em bp_anual + forecast_semanal do ano
  const itensMap = {}
  const GRUPOS_BP = ['Backlog', 'PIPE', 'Renovação']
  bpAnual.forEach(b => {
    if (!itensMap[b.chave_rfc]) {
      // BP: qualquer projeto, desde que grupo seja Backlog / PIPE / Renovação
      if (!GRUPOS_BP.includes(b.grupo)) return
      const proj = projetosCadastro.find(p => p.cod_projeto === b.cod_projeto)
      // chave_rfc foi construída como identificacao+grupo sem separador — remove o sufixo do grupo
      const identificacaoLimpa = b.grupo
        ? b.chave_rfc.replace(new RegExp(b.grupo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), '').trim()
        : b.chave_rfc
      itensMap[b.chave_rfc] = {
        chave_rfc: b.chave_rfc,
        cod_projeto: b.cod_projeto,
        grupo: b.grupo,
        identificacao: proj?.identificacao || identificacaoLimpa,
        gerente_site: proj?.gerente_site || '',
        gerente_regional: proj?.gerente_regional || '',
        cliente: proj?.cliente || '',
      }
    }
  })
  forecastAnual.forEach(f => {
    if (!itensMap[f.chave_rfc]) {
      // Apenas se existir projeto Vigente com código numérico correspondente
      const proj = projetosCadastro.find(p => p.cod_projeto === f.cod_projeto)
      if (!proj || !f.cod_projeto || !/^\d+$/.test(String(f.cod_projeto))) return
      itensMap[f.chave_rfc] = {
        chave_rfc: f.chave_rfc,
        cod_projeto: f.cod_projeto,
        grupo: f.grupo,
        identificacao: proj.identificacao,
        gerente_site: proj.gerente_site || '',
        gerente_regional: proj.gerente_regional || '',
        cliente: proj.cliente || '',
      }
    }
  })
  const itens = Object.values(itensMap).sort((a, b) => a.identificacao.localeCompare(b.identificacao))

  const itensFiltrados = perfil.perfil === 'gestor'
    ? itens.filter(i => i.gerente_site === perfil.nome)
    : filtro === "Todos" ? itens : itens.filter(i => i.gerente_site === filtro)
  const gerentes = [...new Set(itens.map(i => i.gerente_site).filter(Boolean))].sort()
  const gerentesVisiveis = filtro === "Todos" ? gerentes : [filtro]
  const totalBP = itensFiltrados.reduce((s, i) => s + getBP(i.chave_rfc, MESES[0].mesNum, MESES[0].ano), 0)
  const totalRFC = itensFiltrados.reduce((s, i) => s + getRFC(i.chave_rfc, mes1), 0)
  const delta = calcPct(totalRFC, totalBP)

  return (
    <div style={{minHeight:"100vh",background:RTT.preto,fontFamily:F,color:RTT.branco}}>
      {/* HEADER */}
      <header style={{background:RTT.cinzaEscuro,borderBottom:`1px solid ${RTT.cinzaBorda}`,padding:"0 28px",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:1800,margin:"0 auto",height:52,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          {/* LOGO + KPIs */}
          <div style={{display:"flex",alignItems:"center",gap:24}}>
            <div style={{display:"flex",alignItems:"center",gap:12,paddingRight:24,borderRight:`1px solid ${RTT.cinzaBorda}`}}>
              <span style={{fontSize:16,fontWeight:800,color:RTT.vermelho,letterSpacing:"-0.02em",fontFamily:F}}>RTT</span>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:RTT.branco,lineHeight:1.2,fontFamily:F}}>Forecast Semanal</div>
                <div style={{fontSize:11,color:RTT.cinzaTexto,fontFamily:F}}>S{semana} · {mes1.slice(0,3)}–{mes3.slice(0,3)} {anoAtual}</div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:12,fontWeight:700,color:RTT.amarelo,fontFamily:F}}>BP {mes1.slice(0,3)}</span>
              <span style={{fontSize:13,fontWeight:700,color:RTT.branco,fontFamily:F}}>R$ {fmt(totalBP)}</span>
              <span style={{color:RTT.cinzaBorda2,margin:"0 4px"}}>·</span>
              <span style={{fontSize:12,color:RTT.cinzaClaro,fontFamily:F}}>RFC s-1</span>
              <span style={{fontSize:13,fontWeight:600,color:RTT.brancoSuave,fontFamily:F}}>R$ {fmt(totalRFC)}</span>
              {delta !== null && (
                <>
                  <span style={{color:RTT.cinzaBorda2,margin:"0 4px"}}>·</span>
                  <span style={{fontSize:12,fontWeight:700,color:delta>=0?RTT.verde:RTT.vermelho,fontFamily:F}}>
                    {delta>0?"+":""}{delta.toFixed(0)}% vs BP
                  </span>
                </>
              )}
            </div>
          </div>
          {/* USUÁRIO */}
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:12,fontWeight:600,color:RTT.branco,fontFamily:F}}>{perfil.nome}</div>
              <div style={{fontSize:10,color:RTT.cinzaTexto,fontFamily:F}}>{perfil.perfil==='admin'?'Administrador':'Gerente de Site'}</div>
            </div>
            <button onClick={onLogout} style={{background:"transparent",border:`1px solid ${RTT.cinzaBorda}`,color:RTT.cinzaClaro,padding:"5px 12px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:F,transition:"border-color 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=RTT.cinzaBorda2}
              onMouseLeave={e=>e.currentTarget.style.borderColor=RTT.cinzaBorda}
            >Sair</button>
          </div>
        </div>
      </header>

      {/* BANNERS */}
      {sucesso && (
        <div style={{background:"rgba(16,185,129,0.08)",borderBottom:`1px solid rgba(16,185,129,0.2)`,color:RTT.verde,padding:"9px 28px",fontSize:12,textAlign:"center",fontWeight:600,fontFamily:F}}>
          Forecast semana {semana} enviado com sucesso
        </div>
      )}
      {erro && (
        <div style={{background:"rgba(227,30,36,0.08)",borderBottom:`1px solid rgba(227,30,36,0.2)`,color:"#fca5a5",padding:"9px 28px",fontSize:12,textAlign:"center",fontFamily:F}}>
          {erro}
        </div>
      )}
      {janelaBloqueada && (
        <div style={{background:RTT.cinzaEscuro,borderBottom:`1px solid ${RTT.cinzaBorda}`,color:RTT.cinzaClaro,padding:"9px 28px",fontSize:11,textAlign:"center",fontFamily:F}}>
          Preenchimento disponível de <strong style={{color:RTT.branco}}>quinta-feira às 09h</strong> até <strong style={{color:RTT.branco}}>sexta-feira às 12h</strong>
        </div>
      )}

      <main style={{maxWidth:1800,margin:"0 auto",padding:"20px 28px"}}>
        {/* FILTRO ADMIN */}
        {perfil.perfil==='admin' && (
          <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:`1px solid ${RTT.cinzaBorda}`,alignItems:"center"}}>
            {["Todos",...gerentes].map(g => {
              const ativo = filtro === g
              const count = g === "Todos" ? itens.length : itens.filter(i => i.gerente_site === g).length
              return (
                <button key={g} onClick={()=>setFiltro(g)} style={{
                  padding:"8px 14px",
                  fontSize:11,
                  cursor:"pointer",
                  fontFamily:F,
                  fontWeight:ativo?600:400,
                  background:"transparent",
                  color:ativo?RTT.branco:RTT.cinzaClaro,
                  border:"none",
                  borderBottom:ativo?`2px solid ${RTT.vermelho}`:"2px solid transparent",
                  marginBottom:"-1px",
                  transition:"color 0.15s",
                }}>
                  {g==="Todos"?"Todos":g.split(" ")[0]}
                  <span style={{marginLeft:5,fontSize:10,color:ativo?RTT.cinzaClaro:RTT.cinzaTexto}}>{count}</span>
                </button>
              )
            })}
          </div>
        )}

        {loading ? (
          <div style={{textAlign:"center",padding:"80px",color:RTT.cinzaTexto,fontSize:13,fontFamily:F}}>Carregando...</div>
        ) : (
          <>
            {/* CABEÇALHO DAS COLUNAS — fixo ao rolar */}
            <div style={{position:"sticky",top:52,zIndex:20,background:RTT.preto,paddingTop:4,paddingBottom:2}}>
              <div style={{display:"grid",gridTemplateColumns:"260px 1fr 1fr 1fr 32px",gap:6}}>
                <div style={{fontSize:10,fontWeight:500,color:RTT.cinzaTexto,fontFamily:F,alignSelf:"flex-end",paddingBottom:6}}>Projeto</div>
                {MESES.map(m=>(
                  <div key={m.key} style={{background:RTT.cinzaEscuro,border:`1px solid ${RTT.cinzaBorda}`,borderRadius:6,overflow:"hidden"}}>
                    <div style={{padding:"6px 10px 4px",borderBottom:`1px solid ${RTT.cinzaBorda}`}}>
                      <span style={{fontSize:11,fontWeight:700,color:RTT.branco,fontFamily:F,letterSpacing:"-0.01em"}}>{m.label.slice(0,3)} <span style={{color:RTT.cinzaTexto,fontWeight:400}}>{m.ano}</span></span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr"}}>
                      {[{l:"BP",c:RTT.amarelo},{l:"RFC s-1",c:RTT.cinzaClaro},{l:"Forecast",c:RTT.vermelho}].map(s=>(
                        <div key={s.l} style={{padding:"3px 6px",textAlign:"center",fontSize:10,fontWeight:600,color:s.c,fontFamily:F,background:s.l==="Forecast"?"rgba(227,30,36,0.05)":"transparent"}}>{s.l}</div>
                      ))}
                    </div>
                  </div>
                ))}
                <div/>
              </div>
            </div>

            {/* LINHAS POR GERENTE */}
            {gerentesVisiveis.map(gerente => {
              const projs = itensFiltrados.filter(p => p.gerente_site === gerente)
              if (!projs.length) return null
              const gerEnviou = gerentesQueEnviaram.has(gerente)
              return (
                <div key={gerente} style={{marginTop:16}}>
                  {/* separador de gerente */}
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",marginBottom:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:11,fontWeight:600,color:RTT.cinzaClaro,fontFamily:F}}>{gerente}</span>
                      <span style={{fontSize:10,color:RTT.cinzaTexto,fontFamily:F}}>{projs.length} projeto{projs.length!==1?"s":""}</span>
                    </div>
                    {perfil.perfil==='admin' && (
                      <span style={{fontSize:10,fontWeight:600,fontFamily:F,padding:"2px 8px",borderRadius:20,
                        background:gerEnviou?"rgba(16,185,129,0.1)":"rgba(245,158,11,0.1)",
                        color:gerEnviou?RTT.verde:RTT.amarelo,
                        border:`1px solid ${gerEnviou?"rgba(16,185,129,0.25)":"rgba(245,158,11,0.25)"}`
                      }}>
                        {gerEnviou ? "✓ enviado" : "pendente"}
                      </span>
                    )}
                  </div>

                  <div style={{display:"flex",flexDirection:"column",gap:2}}>
                  {projs.map(proj => {
                    const gs = GRUPO_CORES[proj.grupo] || {bg:"rgba(100,100,100,0.08)",text:"#71717a",border:"rgba(100,100,100,0.15)"}
                    return (
                      <div key={proj.chave_rfc} style={{display:"grid",gridTemplateColumns:"260px 1fr 1fr 1fr 32px",gap:6,alignItems:"center",padding:"8px 10px",borderRadius:6,background:RTT.cinzaEscuro,border:`1px solid ${RTT.cinzaBorda}`}}>
                        {/* NOME DO PROJETO */}
                        <div style={{minWidth:0,display:"flex",flexDirection:"column",gap:3}}>
                          <div style={{fontSize:12,fontWeight:500,color:RTT.branco,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontFamily:F}}>{proj.identificacao}</div>
                          {proj.grupo && <span style={{fontSize:10,padding:"1px 6px",borderRadius:4,fontWeight:500,background:gs.bg,color:gs.text,border:`1px solid ${gs.border}`,alignSelf:"flex-start",fontFamily:F}}>{proj.grupo}</span>}
                        </div>

                        {/* CÉLULAS DE MÊS */}
                        {MESES.map(m => {
                          const bp  = getBP(proj.chave_rfc, m.mesNum, m.ano)
                          const rfc = getRFC(proj.chave_rfc, m.label)
                          const obsKey = proj.chave_rfc + '_' + m.key
                          const obsAberta = obsAbertas.has(obsKey)
                          const obsVal = getObs(proj.chave_rfc, m.key)
                          const confVal = getConfianca(proj.chave_rfc, m.key)

                          return (
                            <div key={m.key} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,alignItems:"start"}}>
                              {/* BP */}
                              <div style={{textAlign:"center",padding:"2px 0"}}>
                                <div style={{fontSize:12,fontWeight:600,color:RTT.amarelo,fontFamily:F}}>{fmt(bp)}</div>
                              </div>

                              {/* RFC s-1 */}
                              <div style={{textAlign:"center",padding:"2px 0"}}>
                                <div style={{fontSize:12,fontWeight:500,color:RTT.brancoSuave,fontFamily:F}}>{fmt(rfc)}</div>
                                <Delta val={rfc} refVal={bp}/>
                              </div>

                              {/* FORECAST */}
                              <div style={{background:"rgba(227,30,36,0.04)",borderRadius:5,padding:"2px 4px"}}>
                                <div style={{display:"flex",gap:2,alignItems:"center"}}>
                                  <input
                                    type="number"
                                    placeholder="—"
                                    value={getVal(proj.chave_rfc, m.key)}
                                    onChange={e=>setValor(proj.chave_rfc, m.key, e.target.value)}
                                    style={{flex:1,background:"transparent",border:"none",borderBottom:`1px solid ${RTT.cinzaBorda2}`,borderRadius:0,padding:"3px 4px",color:RTT.branco,fontSize:12,outline:"none",textAlign:"right",boxSizing:"border-box",fontFamily:F,minWidth:0}}
                                    onFocus={e=>e.target.style.borderBottomColor=RTT.vermelho}
                                    onBlur={e=>e.target.style.borderBottomColor=RTT.cinzaBorda2}
                                  />
                                  <button
                                    onClick={()=>toggleObs(obsKey)}
                                    title="Observação"
                                    style={{background:"none",border:"none",color:obsVal?RTT.vermelho:RTT.cinzaTexto,cursor:"pointer",fontSize:11,padding:"2px",lineHeight:1,flexShrink:0}}
                                  >✎</button>
                                </div>
                                {/* Botões confiança — iniciais */}
                                <div style={{display:"flex",gap:2,marginTop:3}}>
                                  {CONFIANCA_OPTS.map(opt=>{
                                    const sel = confVal === opt.label
                                    return (
                                      <button
                                        key={opt.label}
                                        onClick={()=>setValor(proj.chave_rfc, m.key+'_confianca', sel?'':opt.label)}
                                        title={opt.label}
                                        style={{flex:1,padding:"2px 0",fontSize:10,fontWeight:sel?700:400,cursor:"pointer",fontFamily:F,borderRadius:3,border:`1px solid ${sel?opt.corBorda:RTT.cinzaBorda}`,background:sel?opt.corFundo:"transparent",color:sel?opt.cor:RTT.cinzaTexto}}
                                      >{opt.label[0]}</button>
                                    )
                                  })}
                                </div>
                                {(obsAberta || obsVal) && (
                                  <textarea
                                    value={obsVal}
                                    placeholder="Observação..."
                                    onChange={e=>setValor(proj.chave_rfc, m.key+'_obs', e.target.value)}
                                    rows={2}
                                    style={{width:"100%",marginTop:4,background:RTT.cinzaMedio,border:`1px solid ${RTT.cinzaBorda}`,borderRadius:4,padding:"4px 6px",color:RTT.branco,fontSize:11,outline:"none",resize:"none",boxSizing:"border-box",fontFamily:F}}
                                    onFocus={e=>e.target.style.borderColor=RTT.vermelho}
                                    onBlur={e=>e.target.style.borderColor=RTT.cinzaBorda}
                                  />
                                )}
                              </div>
                            </div>
                          )
                        })}

                        {/* BOTÃO PAINEL ANUAL */}
                        <button
                          onClick={()=>setPainel(proj)}
                          style={{width:28,height:28,background:"transparent",border:`1px solid ${RTT.cinzaBorda}`,borderRadius:6,color:RTT.cinzaTexto,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:F}}
                          onMouseEnter={e=>{e.currentTarget.style.borderColor=RTT.cinzaBorda2;e.currentTarget.style.color=RTT.branco}}
                          onMouseLeave={e=>{e.currentTarget.style.borderColor=RTT.cinzaBorda;e.currentTarget.style.color=RTT.cinzaTexto}}
                        >›</button>
                      </div>
                    )
                  })}
                  </div>
                </div>
              )
            })}

            {/* RODAPÉ */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0",marginTop:16,borderTop:`1px solid ${RTT.cinzaBorda}`}}>
              <div style={{display:"flex",flexDirection:"column",gap:3}}>
                <div style={{fontSize:11,color:RTT.cinzaTexto,fontFamily:F}}>
                  {itensFiltrados.length} projetos · S{semana}/{anoAtual} · Prazo <strong style={{color:RTT.cinzaClaro,fontWeight:500}}>sexta 12h</strong>
                </div>
                {perfil.perfil==='gestor' && (
                  <div style={{fontSize:11,fontWeight:600,fontFamily:F,color:jaEnviei?RTT.verde:RTT.amarelo}}>
                    {jaEnviei
                      ? `✓ Enviado · ${fmtDataColeta(ultimoEnvio)}`
                      : "Forecast desta semana ainda não enviado"}
                  </div>
                )}
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {perfil.perfil==='admin' && !isJanelaAberta() && (
                  <button
                    onClick={handleAtualizarRFC}
                    disabled={atualizandoRFC}
                    title="Re-exporta o RFC da semana atual para o SharePoint via Power Automate"
                    style={{background:"transparent",border:`1px solid ${rfcAtualizado?RTT.verde:RTT.cinzaBorda}`,color:rfcAtualizado?RTT.verde:RTT.cinzaClaro,padding:"8px 16px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F,opacity:atualizandoRFC?0.6:1}}
                  >{atualizandoRFC?"Atualizando...":rfcAtualizado?"✓ RFC atualizado":"Atualizar RFC"}</button>
                )}
                <button
                  onClick={handleEnviar}
                  disabled={enviando || janelaBloqueada}
                  style={{background:janelaBloqueada?RTT.cinzaMedio:RTT.vermelho,color:janelaBloqueada?RTT.cinzaTexto:"#fff",border:"none",padding:"10px 24px",borderRadius:6,fontSize:12,fontWeight:600,cursor:janelaBloqueada?"not-allowed":"pointer",fontFamily:F,opacity:enviando?0.7:1}}
                  onMouseEnter={e=>{ if(!enviando&&!janelaBloqueada) e.currentTarget.style.background=RTT.vermelhoEscuro }}
                  onMouseLeave={e=>{ if(!janelaBloqueada) e.currentTarget.style.background=RTT.vermelho }}
                >{enviando?"Enviando...":"Enviar Forecast"}</button>
              </div>
            </div>
          </>
        )}
      </main>

      {painel && <PainelAnual proj={painel} mesAtualIdx={mesAtualIdx} bpAnual={bpAnual} forecastAnual={forecastAnual} onClose={()=>setPainel(null)}/>}
    </div>
  )
}
