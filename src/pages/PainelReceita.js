import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import GestaoUsuarios from './GestaoUsuarios'

const RTT = {
  vermelho:      "#E31E24",
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
  Backlog:     { bg: "rgba(227,30,36,0.10)",  text: "#E31E24",  borda: "rgba(227,30,36,0.2)" },
  "Renovação": { bg: "rgba(96,165,250,0.10)", text: "#60a5fa",  borda: "rgba(96,165,250,0.2)" },
  PIPE:        { bg: "rgba(240,165,0,0.10)",  text: "#f0a500",  borda: "rgba(240,165,0,0.2)" },
}

const MESES = [
  {num:1,  label:'Jan', nome:'Janeiro'},
  {num:2,  label:'Fev', nome:'Fevereiro'},
  {num:3,  label:'Mar', nome:'Março'},
  {num:4,  label:'Abr', nome:'Abril'},
  {num:5,  label:'Mai', nome:'Maio'},
  {num:6,  label:'Jun', nome:'Junho'},
  {num:7,  label:'Jul', nome:'Julho'},
  {num:8,  label:'Ago', nome:'Agosto'},
  {num:9,  label:'Set', nome:'Setembro'},
  {num:10, label:'Out', nome:'Outubro'},
  {num:11, label:'Nov', nome:'Novembro'},
  {num:12, label:'Dez', nome:'Dezembro'},
]

const MES_NUM = {
  Janeiro:1,Fevereiro:2,Março:3,Abril:4,Maio:5,Junho:6,
  Julho:7,Agosto:8,Setembro:9,Outubro:10,Novembro:11,Dezembro:12
}

const GRUPO_ORDER = ['Backlog','Renovação','PIPE','PIPE2','PIPE 2','Outros']

function getGrupoCor(grupo) {
  if (GRUPO_CORES[grupo]) return GRUPO_CORES[grupo]
  // fallback para grupos desconhecidos
  return { bg: 'rgba(161,161,170,0.10)', text: '#a1a1aa', borda: 'rgba(161,161,170,0.2)' }
}

const NOME_W = 290
const COL_W  = 76

function fmt(v) {
  if (!v && v !== 0) return '—'
  if (v === 0) return '—'
  const abs = Math.abs(v)
  if (abs >= 1000000) return (v / 1000000).toFixed(1).replace('.', ',') + 'M'
  if (abs >= 1000)    return Math.round(v / 1000) + 'k'
  return Math.round(v).toLocaleString('pt-BR')
}

function somarMeses(lista, campo) {
  const r = {}
  for (const m of MESES) {
    r[m.num] = lista.reduce((s, p) => s + (p[campo]?.[m.num] || 0), 0)
  }
  r.total = MESES.reduce((s, m) => s + (r[m.num] || 0), 0)
  return r
}

function somarProjetoTotal(p, campo) {
  return MESES.reduce((s, m) => s + (p[campo]?.[m.num] || 0), 0)
}

export default function PainelReceita({ perfil, onLogout, onNavigate }) {
  const [dados,          setDados]          = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [semana,         setSemana]         = useState(null)
  const [collapsed,      setCollapsed]      = useState({})
  const [modalUsuarios,  setModalUsuarios]  = useState(false)

  const mesAtual = new Date().getMonth() + 1

  useEffect(() => { carregar() }, []) // eslint-disable-line

  async function fetchAllBP() {
    const PAGE = 1000
    let all = [], from = 0, done = false
    while (!done) {
      const { data, error } = await supabase
        .from('bp_anual')
        .select('chave_rfc,mes,valor_bp,cod_projeto,grupo')
        .eq('ano', 2026)
        .range(from, from + PAGE - 1)
      if (error) throw error
      if (data?.length) all = all.concat(data)
      done = !data || data.length < PAGE
      from += PAGE
    }
    return all
  }

  async function fetchAllFC() {
    const PAGE = 1000
    let all = [], from = 0, done = false
    while (!done) {
      const { data, error } = await supabase
        .rpc('get_fc_painel_2026')
        .range(from, from + PAGE - 1)
      if (error) throw error
      if (data?.length) all = all.concat(data)
      done = !data || data.length < PAGE
      from += PAGE
    }
    return all
  }

  async function carregar() {
    setLoading(true)
    try {
      const { data: semData } = await supabase
        .from('forecast_semanal')
        .select('semana_coleta')
        .eq('ano_referencia', 2026)
        .order('semana_coleta', { ascending: false })
        .limit(1).single()

      const sem = semData?.semana_coleta || 17
      setSemana(sem)

      const [fcData, bpData, { data: projData }] = await Promise.all([
        fetchAllFC(),
        fetchAllBP(),
        supabase
          .from('projetos')
          .select('cod_projeto,identificacao,gerente_site'),
      ])

      setDados(processar(fcData || [], bpData || [], projData || []))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function processar(fcData, bpData, projData) {
    // Lookup de projetos cadastrados: cod_projeto -> {identificacao, gerente_site}
    const projLookup = {}
    for (const p of projData) {
      projLookup[String(p.cod_projeto).trim()] = p
    }

    // BP: chave_rfc -> {mesNum -> valor}  +  metadados do bp_anual
    const bpMap  = {}  // chave_rfc -> {mes -> valor}
    const bpMeta = {}  // chave_rfc -> {cod_projeto, grupo}
    for (const r of bpData) {
      if (!bpMap[r.chave_rfc])  bpMap[r.chave_rfc]  = {}
      if (!bpMeta[r.chave_rfc]) bpMeta[r.chave_rfc] = { cod_projeto: String(r.cod_projeto || '').trim(), grupo: r.grupo || '' }
      bpMap[r.chave_rfc][r.mes] = parseFloat(r.valor_bp) || 0
    }

    // FC: já vem com melhor semana_coleta por chave_rfc+mes (via RPC DISTINCT ON no banco)
    const projMap = {}
    for (const r of fcData) {
      if (!projMap[r.chave_rfc]) {
        projMap[r.chave_rfc] = {
          chave_rfc:     r.chave_rfc,
          identificacao: r.identificacao,
          grupo:         r.grupo,
          gerente_site:  r.gerente_site,
          fc: {},
        }
      }
      const mn = MES_NUM[r.mes_referencia]
      if (mn) projMap[r.chave_rfc].fc[mn] = parseFloat(r.receita_prevista) || 0
    }

    // Adicionar projetos que só têm BP (não estão em forecast_semanal)
    for (const [chave, meses] of Object.entries(bpMap)) {
      if (projMap[chave]) continue  // já existe via forecast

      const totalBP = Object.values(meses).reduce((s, v) => s + v, 0)
      if (totalBP === 0) continue   // ignora linhas zeradas

      const meta    = bpMeta[chave] || {}
      const cadast  = projLookup[meta.cod_projeto] || {}
      const grupo   = meta.grupo || 'Outros'

      // identificacao: tenta lookup no cadastro, senão remove sufixo do grupo do chave_rfc
      const identificacao = cadast.identificacao
        || (grupo && chave.endsWith(grupo) ? chave.slice(0, -grupo.length) : chave)

      projMap[chave] = {
        chave_rfc:     chave,
        identificacao: identificacao || chave,
        grupo,
        gerente_site:  cadast.gerente_site || 'Sem gerente',
        fc:            {},
      }
    }

    // Associar BP a todos os projetos
    for (const p of Object.values(projMap)) {
      p.bp = bpMap[p.chave_rfc] || {}
    }

    // Hierarquia: grupo -> gerente -> [projetos]
    const grupos = {}
    for (const p of Object.values(projMap)) {
      const g   = p.grupo        || 'Outros'
      const ger = p.gerente_site || 'Sem gerente'
      if (!grupos[g])      grupos[g] = {}
      if (!grupos[g][ger]) grupos[g][ger] = []
      grupos[g][ger].push(p)
    }

    for (const g of Object.keys(grupos)) {
      for (const ger of Object.keys(grupos[g])) {
        grupos[g][ger].sort((a, b) => a.identificacao.localeCompare(b.identificacao))
      }
    }

    return { grupos }
  }

  function toggleCollapse(key) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ── estilos ──────────────────────────────────────────────────────────────

  const stickyLeft = (bg, extraZ = 0) => ({
    position: 'sticky',
    left: 0,
    zIndex: 2 + extraZ,
    background: bg,
    width: NOME_W,
    minWidth: NOME_W,
    maxWidth: NOME_W,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    borderRight: `1px solid ${RTT.cinzaBorda2}`,
    borderBottom: `1px solid ${RTT.cinzaBorda}`,
  })

  const tdBP = (val, isMonth) => ({
    width: COL_W,
    minWidth: COL_W,
    padding: '3px 7px',
    textAlign: 'right',
    fontSize: 11,
    color: RTT.cinzaClaro,
    borderRight: `1px solid ${RTT.cinzaBorda}`,
    borderBottom: `1px solid ${RTT.cinzaBorda}`,
    background: isMonth === mesAtual ? 'rgba(245,158,11,0.04)' : 'transparent',
    whiteSpace: 'nowrap',
  })

  const tdFC = (fcVal, bpVal, isMonth) => {
    const diff = bpVal > 0 ? (fcVal - bpVal) / bpVal : null
    const cor = diff === null ? RTT.brancoSuave
              : diff < -0.05 ? '#f87171'
              : diff >  0.05 ? '#6ee7b7'
              : RTT.brancoSuave
    const bg  = diff === null ? (isMonth === mesAtual ? 'rgba(245,158,11,0.04)' : 'transparent')
              : diff < -0.05 ? (isMonth === mesAtual ? 'rgba(248,113,113,0.12)' : 'rgba(248,113,113,0.07)')
              : diff >  0.05 ? (isMonth === mesAtual ? 'rgba(110,231,183,0.10)' : 'rgba(110,231,183,0.05)')
              : (isMonth === mesAtual ? 'rgba(245,158,11,0.04)' : 'transparent')
    return {
      width: COL_W,
      minWidth: COL_W,
      padding: '3px 7px',
      textAlign: 'right',
      fontSize: 11,
      color: cor,
      background: bg,
      borderRight: `1px solid ${RTT.cinzaBorda}`,
      borderBottom: `1px solid ${RTT.cinzaBorda}`,
      whiteSpace: 'nowrap',
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight:'100vh', background:RTT.preto, display:'flex', alignItems:'center',
      justifyContent:'center', color:RTT.cinzaClaro, fontFamily:F, fontSize:13 }}>
      Carregando painel...
    </div>
  )

  const { grupos } = dados || {}
  // Grupos conhecidos primeiro, depois qualquer outro que venha do bp_anual
  const gruposExtras = Object.keys(grupos || {}).filter(g => !GRUPO_ORDER.includes(g))
  const gruposOrdem  = [...GRUPO_ORDER, ...gruposExtras].filter(g => grupos?.[g])
  const todosProjs   = gruposOrdem.flatMap(g => Object.values(grupos[g]).flat())
  const grandFC        = somarMeses(todosProjs, 'fc')
  const grandBP        = somarMeses(todosProjs, 'bp')

  return (
    <div style={{ minHeight:'100vh', background:RTT.preto, fontFamily:F, color:RTT.branco, overflow:'clip' }}>

      {/* ── HEADER ── */}
      <header style={{ height:52, background:RTT.cinzaEscuro, borderBottom:`1px solid ${RTT.cinzaBorda}`,
        display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 24px',
        position:'sticky', top:0, zIndex:30 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <button onClick={() => onNavigate('forecast')}
            style={{ background:'transparent', border:`1px solid ${RTT.cinzaBorda}`, color:RTT.cinzaClaro,
              padding:'5px 12px', borderRadius:6, fontSize:11, cursor:'pointer', fontFamily:F }}
            onMouseEnter={e => e.currentTarget.style.borderColor = RTT.cinzaBorda2}
            onMouseLeave={e => e.currentTarget.style.borderColor = RTT.cinzaBorda}>
            ← Forecast
          </button>
          <div>
            <span style={{ fontWeight:700, fontSize:15, color:RTT.branco, letterSpacing:'-0.3px' }}>
              RTT — Painel Anual 2026
            </span>
            {semana && (
              <span style={{ marginLeft:10, fontSize:11, color:RTT.cinzaTexto, background:RTT.cinzaMedio,
                border:`1px solid ${RTT.cinzaBorda}`, borderRadius:4, padding:'2px 8px' }}>
                S{semana}
              </span>
            )}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => setModalUsuarios(true)}
            style={{ background:'transparent', border:`1px solid ${RTT.cinzaBorda}`, color:RTT.cinzaClaro,
              padding:'5px 12px', borderRadius:6, fontSize:11, cursor:'pointer', fontFamily:F }}
            onMouseEnter={e => e.currentTarget.style.borderColor = RTT.cinzaBorda2}
            onMouseLeave={e => e.currentTarget.style.borderColor = RTT.cinzaBorda}>
            👥 Usuários
          </button>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:12, fontWeight:600, color:RTT.branco }}>{perfil?.nome}</div>
            <div style={{ fontSize:10, color:RTT.cinzaTexto }}>Administrador</div>
          </div>
          <button onClick={onLogout}
            style={{ background:'transparent', border:`1px solid ${RTT.cinzaBorda}`, color:RTT.cinzaClaro,
              padding:'5px 12px', borderRadius:6, fontSize:11, cursor:'pointer', fontFamily:F }}
            onMouseEnter={e => e.currentTarget.style.borderColor = RTT.cinzaBorda2}
            onMouseLeave={e => e.currentTarget.style.borderColor = RTT.cinzaBorda}>
            Sair
          </button>
        </div>
      </header>

      {/* ── TABELA ── */}
      <div style={{ height:'calc(100vh - 52px)', overflow:'auto' }}>
        <table style={{ borderCollapse:'collapse', tableLayout:'fixed', width:'max-content', minWidth:'100%' }}>

          {/* ── THEAD ── */}
          <thead>
            {/* Row 1: meses */}
            <tr>
              <th style={{ ...stickyLeft(RTT.cinzaMedio, 3), position:'sticky', top:0, zIndex:5,
                padding:'5px 12px', fontSize:11, fontWeight:700, color:RTT.cinzaClaro,
                textAlign:'left', letterSpacing:'0.05em' }}>
                PROJETO
              </th>
              {MESES.map(m => (
                <th key={m.num} colSpan={2} style={{
                  position:'sticky', top:0, zIndex:3,
                  background: m.num === mesAtual ? 'rgba(245,158,11,0.15)' : RTT.cinzaMedio,
                  color: m.num === mesAtual ? RTT.amarelo : RTT.cinzaClaro,
                  fontSize: 11, fontWeight: 700, textAlign:'center',
                  padding:'5px 0', borderLeft:`1px solid ${RTT.cinzaBorda}`,
                  borderBottom:`1px solid ${RTT.cinzaBorda}`,
                  width: COL_W * 2, minWidth: COL_W * 2,
                  whiteSpace:'nowrap',
                }}>
                  {m.label}
                </th>
              ))}
              <th colSpan={2} style={{
                position:'sticky', top:0, zIndex:3,
                background:'#181820', color:RTT.brancoSuave,
                fontSize:11, fontWeight:700, textAlign:'center',
                padding:'5px 0', borderLeft:`2px solid ${RTT.cinzaBorda2}`,
                borderBottom:`1px solid ${RTT.cinzaBorda}`,
                width: COL_W * 2, minWidth: COL_W * 2,
              }}>
                TOTAL
              </th>
            </tr>
            {/* Row 2: BP / FC */}
            <tr>
              <th style={{ ...stickyLeft(RTT.cinzaMedio, 3), position:'sticky', top:28, zIndex:5,
                padding:'3px 12px', fontSize:9, fontWeight:600, color:RTT.cinzaTexto,
                textAlign:'left', letterSpacing:'0.08em' }}>
                BP&nbsp;&nbsp;/&nbsp;&nbsp;FORECAST
              </th>
              {MESES.map(m => [
                <th key={`bp-${m.num}`} style={{
                  position:'sticky', top:28, zIndex:3,
                  background: m.num === mesAtual ? 'rgba(245,158,11,0.08)' : RTT.cinzaMedio,
                  color:RTT.cinzaTexto, fontSize:9, fontWeight:600, textAlign:'right',
                  padding:'3px 7px', borderLeft:`1px solid ${RTT.cinzaBorda}`,
                  borderBottom:`2px solid ${RTT.cinzaBorda2}`,
                  width:COL_W, minWidth:COL_W, letterSpacing:'0.05em',
                }}>BP</th>,
                <th key={`fc-${m.num}`} style={{
                  position:'sticky', top:28, zIndex:3,
                  background: m.num === mesAtual ? 'rgba(245,158,11,0.08)' : RTT.cinzaMedio,
                  color:RTT.cinzaClaro, fontSize:9, fontWeight:600, textAlign:'right',
                  padding:'3px 7px', borderRight:`1px solid ${RTT.cinzaBorda}`,
                  borderBottom:`2px solid ${RTT.cinzaBorda2}`,
                  width:COL_W, minWidth:COL_W, letterSpacing:'0.05em',
                }}>FC</th>,
              ])}
              <th style={{
                position:'sticky', top:28, zIndex:3,
                background:'#181820', color:RTT.cinzaTexto, fontSize:9, fontWeight:600,
                textAlign:'right', padding:'3px 7px',
                borderLeft:`2px solid ${RTT.cinzaBorda2}`,
                borderBottom:`2px solid ${RTT.cinzaBorda2}`,
                width:COL_W, minWidth:COL_W, letterSpacing:'0.05em',
              }}>BP</th>
              <th style={{
                position:'sticky', top:28, zIndex:3,
                background:'#181820', color:RTT.brancoSuave, fontSize:9, fontWeight:600,
                textAlign:'right', padding:'3px 7px', borderRight:`1px solid ${RTT.cinzaBorda}`,
                borderBottom:`2px solid ${RTT.cinzaBorda2}`,
                width:COL_W, minWidth:COL_W, letterSpacing:'0.05em',
              }}>FC</th>
            </tr>
          </thead>

          {/* ── TBODY ── */}
          <tbody>
            {gruposOrdem.map(grupo => {
              const gerentes      = grupos[grupo]
              const gerentesOrdem = Object.keys(gerentes).sort()
              const todosDoGrupo  = Object.values(gerentes).flat()
              const totGrupoFC    = somarMeses(todosDoGrupo, 'fc')
              const totGrupoBP    = somarMeses(todosDoGrupo, 'bp')
              const gc            = getGrupoCor(grupo)
              const grCollapsed   = collapsed[grupo]

              return [
                // ── linha GRUPO ──
                <tr key={`g-${grupo}`} onClick={() => toggleCollapse(grupo)}
                  style={{ cursor:'pointer', userSelect:'none' }}>
                  <td style={{ ...stickyLeft(gc.bg), padding:'7px 12px',
                    fontSize:12, fontWeight:700, color:gc.text, letterSpacing:'0.04em' }}>
                    {grCollapsed ? '▶' : '▼'}&nbsp; {grupo.toUpperCase()}
                    <span style={{ fontWeight:400, fontSize:10, color:gc.text, opacity:0.7, marginLeft:6 }}>
                      ({todosDoGrupo.length} projetos)
                    </span>
                  </td>
                  {MESES.map(m => [
                    <td key={`g-${grupo}-bp-${m.num}`}
                      style={{ ...tdBP(totGrupoBP[m.num], m.num), background: gc.bg,
                        fontWeight:600, borderLeft:`1px solid ${RTT.cinzaBorda}` }}>
                      {fmt(totGrupoBP[m.num])}
                    </td>,
                    <td key={`g-${grupo}-fc-${m.num}`}
                      style={{ ...tdFC(totGrupoFC[m.num], totGrupoBP[m.num], m.num),
                        background: gc.bg, fontWeight:600 }}>
                      {fmt(totGrupoFC[m.num])}
                    </td>,
                  ])}
                  <td style={{ ...tdBP(totGrupoBP.total, -1), background:gc.bg, fontWeight:700,
                    borderLeft:`2px solid ${RTT.cinzaBorda2}`, color:RTT.cinzaClaro }}>
                    {fmt(totGrupoBP.total)}
                  </td>
                  <td style={{ ...tdFC(totGrupoFC.total, totGrupoBP.total, -1),
                    background:gc.bg, fontWeight:700 }}>
                    {fmt(totGrupoFC.total)}
                  </td>
                </tr>,

                // ── linhas GERENTE + PROJETOS ──
                ...(!grCollapsed ? gerentesOrdem.flatMap(ger => {
                  const projetos   = gerentes[ger]
                  const totGerFC   = somarMeses(projetos, 'fc')
                  const totGerBP   = somarMeses(projetos, 'bp')
                  const gerKey     = `${grupo}|${ger}`
                  const gerCollapsed = collapsed[gerKey]

                  return [
                    // linha GERENTE
                    <tr key={`ger-${gerKey}`} onClick={() => toggleCollapse(gerKey)}
                      style={{ cursor:'pointer', userSelect:'none' }}>
                      <td style={{ ...stickyLeft(RTT.cinzaEscuro), padding:'5px 12px 5px 24px',
                        fontSize:11, fontWeight:600, color:RTT.brancoSuave }}>
                        {gerCollapsed ? '▶' : '▼'}&nbsp; {ger}
                        <span style={{ fontWeight:400, fontSize:10, color:RTT.cinzaTexto, marginLeft:6 }}>
                          ({projetos.length})
                        </span>
                      </td>
                      {MESES.map(m => [
                        <td key={`ger-${gerKey}-bp-${m.num}`}
                          style={{ ...tdBP(totGerBP[m.num], m.num),
                            background: m.num===mesAtual ? 'rgba(245,158,11,0.04)' : RTT.cinzaEscuro,
                            borderLeft:`1px solid ${RTT.cinzaBorda}` }}>
                          {fmt(totGerBP[m.num])}
                        </td>,
                        <td key={`ger-${gerKey}-fc-${m.num}`}
                          style={{ ...tdFC(totGerFC[m.num], totGerBP[m.num], m.num),
                            background: m.num===mesAtual ? 'rgba(245,158,11,0.04)' : RTT.cinzaEscuro }}>
                          {fmt(totGerFC[m.num])}
                        </td>,
                      ])}
                      <td style={{ ...tdBP(totGerBP.total, -1), background:RTT.cinzaEscuro,
                        fontWeight:600, borderLeft:`2px solid ${RTT.cinzaBorda2}`, color:RTT.cinzaClaro }}>
                        {fmt(totGerBP.total)}
                      </td>
                      <td style={{ ...tdFC(totGerFC.total, totGerBP.total, -1),
                        background:RTT.cinzaEscuro, fontWeight:600 }}>
                        {fmt(totGerFC.total)}
                      </td>
                    </tr>,

                    // linhas PROJETO
                    ...(!gerCollapsed ? projetos.map(p => {
                      const pTotalFC = somarProjetoTotal(p, 'fc')
                      const pTotalBP = somarProjetoTotal(p, 'bp')
                      return (
                        <tr key={`p-${p.chave_rfc}`}>
                          <td style={{ ...stickyLeft(RTT.preto), padding:'3px 12px 3px 40px',
                            fontSize:11, color:RTT.cinzaClaro }}>
                            {p.identificacao}
                          </td>
                          {MESES.map(m => {
                            const fcV = p.fc[m.num] || 0
                            const bpV = p.bp[m.num] || 0
                            return [
                              <td key={`p-${p.chave_rfc}-bp-${m.num}`}
                                style={{ ...tdBP(bpV, m.num), borderLeft:`1px solid ${RTT.cinzaBorda}` }}>
                                {fmt(bpV)}
                              </td>,
                              <td key={`p-${p.chave_rfc}-fc-${m.num}`}
                                style={{ ...tdFC(fcV, bpV, m.num) }}>
                                {fmt(fcV)}
                              </td>,
                            ]
                          })}
                          <td style={{ ...tdBP(pTotalBP, -1),
                            borderLeft:`2px solid ${RTT.cinzaBorda2}`, color:RTT.cinzaClaro }}>
                            {fmt(pTotalBP)}
                          </td>
                          <td style={{ ...tdFC(pTotalFC, pTotalBP, -1) }}>
                            {fmt(pTotalFC)}
                          </td>
                        </tr>
                      )
                    }) : []),
                  ]
                }) : []),
              ]
            })}

            {/* ── TOTAL GERAL ── */}
            <tr style={{ borderTop:`2px solid ${RTT.cinzaBorda2}` }}>
              <td style={{ ...stickyLeft('#181820'), padding:'7px 12px',
                fontSize:12, fontWeight:700, color:RTT.branco, letterSpacing:'0.04em' }}>
                TOTAL GERAL
              </td>
              {MESES.map(m => [
                <td key={`tot-bp-${m.num}`}
                  style={{ ...tdBP(grandBP[m.num], m.num),
                    background: m.num===mesAtual ? 'rgba(245,158,11,0.08)' : '#181820',
                    fontWeight:700, borderLeft:`1px solid ${RTT.cinzaBorda}`, color:RTT.cinzaClaro }}>
                  {fmt(grandBP[m.num])}
                </td>,
                <td key={`tot-fc-${m.num}`}
                  style={{ ...tdFC(grandFC[m.num], grandBP[m.num], m.num),
                    background: m.num===mesAtual ? 'rgba(245,158,11,0.08)' : '#181820',
                    fontWeight:700 }}>
                  {fmt(grandFC[m.num])}
                </td>,
              ])}
              <td style={{ ...tdBP(grandBP.total, -1), background:'#181820',
                fontWeight:700, borderLeft:`2px solid ${RTT.cinzaBorda2}`, color:RTT.cinzaClaro }}>
                {fmt(grandBP.total)}
              </td>
              <td style={{ ...tdFC(grandFC.total, grandBP.total, -1),
                background:'#181820', fontWeight:700 }}>
                {fmt(grandFC.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {modalUsuarios && <GestaoUsuarios onClose={() => setModalUsuarios(false)} />}
    </div>
  )
}
