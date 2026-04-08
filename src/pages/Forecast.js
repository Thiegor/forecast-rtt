import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const RTT = {
  vermelho: "#E31E24",
  vermelhoEscuro: "#B71C1F",
  vermelhoFundo: "rgba(227,30,36,0.06)",
  preto: "#0d0d0d",
  cinzaEscuro: "#161616",
  cinzaMedio: "#1f1f1f",
  cinzaBorda: "#272727",
  cinzaBorda2: "#2e2e2e",
  cinzaTexto: "#5a5a5a",
  cinzaClaro: "#8a8a8a",
  branco: "#ffffff",
  brancoSuave: "#e8e8e8",
  amarelo: "#f0a500",
  verde: "#22c55e",
}

const GRUPO_CORES = {
  Backlog:     { bg:"rgba(227,30,36,0.1)",  text:"#E31E24", border:"rgba(227,30,36,0.2)" },
  "Renovação": { bg:"rgba(96,165,250,0.1)", text:"#60a5fa", border:"rgba(96,165,250,0.2)" },
  PIPE:        { bg:"rgba(240,165,0,0.1)",  text:"#f0a500", border:"rgba(240,165,0,0.2)" },
  Spot:        { bg:"rgba(168,85,247,0.1)", text:"#c084fc", border:"rgba(168,85,247,0.2)" },
}

const MESES_LONGOS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
const MESES_BP = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

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

function PainelAnual({ proj, mesAtualIdx, onClose }) {
  const mesesRolantes = [mesAtualIdx, mesAtualIdx+1, mesAtualIdx+2]
  const totalBP = MESES_BP.reduce((s,m) => s + (proj['bp_'+m]||0), 0)

  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex"}}>
      <div onClick={onClose} style={{flex:1,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(4px)"}}/>
      <div style={{width:480,background:RTT.cinzaEscuro,borderLeft:`1px solid ${RTT.cinzaBorda2}`,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{background:RTT.vermelho,padding:"22px 24px 18px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
            <div style={{flex:1,marginRight:12}}>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>Visão Anual 2026</div>
              <div style={{fontSize:13,fontWeight:700,color:"#fff",lineHeight:1.35}}>{proj.identificacao}</div>
              <div style={{display:"flex",gap:8,marginTop:8,alignItems:"center"}}>
                <span style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:"rgba(0,0,0,0.2)",color:"#fff",fontWeight:600}}>{proj.grupo}</span>
                <span style={{fontSize:10,color:"rgba(255,255,255,0.55)"}}>{proj.gerente_site}</span>
              </div>
            </div>
            <button onClick={onClose} style={{background:"rgba(0,0,0,0.25)",border:"none",color:"#fff",width:28,height:28,borderRadius:6,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[
              {l:"Total BP 2026", v:`R$ ${fmt(totalBP)}`},
              {l:"BP Médio/mês",  v:`R$ ${fmt(totalBP/12)}`},
            ].map(k=>(
              <div key={k.l} style={{background:"rgba(0,0,0,0.2)",borderRadius:7,padding:"9px 11px"}}>
                <div style={{fontSize:8,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>{k.l}</div>
                <div style={{fontSize:14,fontWeight:800,color:"rgba(255,255,255,0.9)"}}>{k.v}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"60px 1fr",gap:0,padding:"10px 20px 7px",borderBottom:`1px solid ${RTT.cinzaBorda}`}}>
          {["Mês","BP 2026"].map((h,i)=>(
            <div key={i} style={{fontSize:8,color:RTT.cinzaTexto,textTransform:"uppercase",letterSpacing:"0.08em",textAlign:i>0?"center":"left",fontWeight:700}}>{h}</div>
          ))}
        </div>
        <div style={{flex:1,overflowY:"auto"}}>
          {MESES_LONGOS.map((mes,i)=>{
            const isAtual = mesesRolantes.includes(i)
            const bp = proj['bp_'+MESES_BP[i]] || 0
            return (
              <div key={mes} style={{display:"grid",gridTemplateColumns:"60px 1fr",gap:0,padding:"8px 20px",background:isAtual?RTT.vermelhoFundo:"transparent",borderLeft:isAtual?`2px solid ${RTT.vermelho}`:"2px solid transparent"}}>
                <div style={{fontSize:11,fontWeight:isAtual?700:400,color:isAtual?RTT.vermelho:RTT.cinzaClaro}}>{mes.slice(0,3)}</div>
                <div style={{textAlign:"center",fontSize:12,fontWeight:600,color:RTT.amarelo}}>{fmt(bp)}</div>
              </div>
            )
          })}
        </div>
        <div style={{borderTop:`1px solid ${RTT.cinzaBorda2}`,padding:"16px 20px"}}>
          <div style={{textAlign:"center",color:RTT.cinzaClaro,fontSize:12}}>Use os campos na tabela para preencher o forecast.</div>
        </div>
      </div>
    </div>
  )
}

export default function Forecast({ perfil, onLogout }) {
  const [projetos, setProjetos] = useState([])
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
    { key:'mes1', label:mes1, ano:ano1, bp_campo:'bp_'+MESES_BP[mesAtualIdx] },
    { key:'mes2', label:mes2, ano:ano2, bp_campo:'bp_'+MESES_BP[mesAtualIdx+1 > 11 ? 0 : mesAtualIdx+1] },
    { key:'mes3', label:mes3, ano:ano3, bp_campo:'bp_'+MESES_BP[mesAtualIdx+2 > 11 ? 1 : mesAtualIdx+2] },
  ]

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      let q = supabase.from('projetos').select('*').eq('status','Vigente').neq('chave_rfc','').order('identificacao')
      if (perfil.perfil === 'gestor') q = q.eq('gerente_site', perfil.nome)
      const { data: proj } = await q
      setProjetos(proj || [])

      // semana atual — para pré-preencher inputs e verificar status de envio
      const { data: fc } = await supabase
        .from('forecast_semanal').select('*')
        .eq('semana_coleta', semana).eq('ano_referencia', anoAtual)
      setForecastSemana(fc || [])

      // semana anterior — para coluna RFC s-1
      const { data: fcPrev } = await supabase
        .from('forecast_semanal').select('*')
        .eq('semana_coleta', semanaPrev).eq('ano_referencia', anoPrev)
      setForecastSemanaAnterior(fcPrev || [])

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

    for (const proj of projetos) {
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

  const projsFiltrados = filtro === "Todos" ? projetos : projetos.filter(p => p.gerente_site === filtro)
  const gerentes = [...new Set(projetos.map(p => p.gerente_site))].sort()
  const gerentesVisiveis = filtro === "Todos" ? gerentes : [filtro]
  const totalBP = projsFiltrados.reduce((s,p) => s + (p[MESES[0].bp_campo]||0), 0)
  const totalRFC = projsFiltrados.reduce((s,p) => s + getRFC(p.chave_rfc, mes1), 0)
  const delta = calcPct(totalRFC, totalBP)

  return (
    <div style={{minHeight:"100vh",background:RTT.preto,fontFamily:"Georgia,serif",color:RTT.branco}}>
      {/* HEADER */}
      <header style={{background:RTT.cinzaEscuro,borderBottom:`1px solid ${RTT.cinzaBorda}`,padding:"0 24px",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:1800,margin:"0 auto",height:56,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:20}}>
            <div style={{display:"flex",alignItems:"center",gap:10,paddingRight:20,borderRight:`1px solid ${RTT.cinzaBorda}`}}>
              <div style={{width:30,height:30,borderRadius:7,background:RTT.vermelho,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#fff"}}>R</div>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:RTT.branco}}>Forecast Semanal</div>
                <div style={{fontSize:9,color:RTT.cinzaTexto}}>Semana {semana} · {mes1.slice(0,3)} → {mes3.slice(0,3)} {anoAtual}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:20}}>
              {[
                {l:"BP "+mes1.slice(0,3), v:"R$ "+fmt(totalBP), c:RTT.amarelo},
                {l:"RFC s-1",             v:"R$ "+fmt(totalRFC), c:RTT.cinzaClaro},
                {l:"Δ vs BP",             v:delta!==null?(delta>0?"+":"")+delta.toFixed(0)+"%":"—", c:delta!=null&&delta>=0?RTT.verde:RTT.vermelho},
              ].map(k=>(
                <div key={k.l}>
                  <div style={{fontSize:8,color:RTT.cinzaTexto,textTransform:"uppercase",letterSpacing:"0.08em"}}>{k.l}</div>
                  <div style={{fontSize:13,fontWeight:700,color:k.c}}>{k.v}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11,fontWeight:600,color:RTT.branco}}>{perfil.nome}</div>
              <div style={{fontSize:9,color:RTT.vermelho,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>{perfil.perfil==='admin'?'Administrador':'Gerente de Site'}</div>
            </div>
            <div style={{width:30,height:30,borderRadius:"50%",background:RTT.vermelho,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff"}}>{perfil.nome.charAt(0)}</div>
            <button onClick={onLogout} style={{background:"transparent",border:`1px solid ${RTT.cinzaBorda}`,color:RTT.cinzaTexto,padding:"4px 10px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>Sair</button>
          </div>
        </div>
      </header>

      {/* BANNERS */}
      {sucesso && (
        <div style={{background:"#052e16",borderBottom:"1px solid #14532d",color:"#22c55e",padding:"8px 24px",fontSize:11,textAlign:"center",fontWeight:700}}>
          ✓ FORECAST SEMANA {semana} ENVIADO COM SUCESSO
        </div>
      )}
      {erro && (
        <div style={{background:"#2d0a0a",borderBottom:"1px solid #7f1d1d",color:"#fca5a5",padding:"8px 24px",fontSize:11,textAlign:"center"}}>
          ✗ {erro}
        </div>
      )}
      {janelaBloqueada && (
        <div style={{background:"rgba(227,30,36,0.08)",borderBottom:`1px solid rgba(227,30,36,0.25)`,color:"#fca5a5",padding:"9px 24px",fontSize:11,textAlign:"center"}}>
          🔒 Preenchimento disponível apenas de <strong>quinta-feira às 09h</strong> até <strong>sexta-feira às 12h</strong>. Em caso de urgência, contate o departamento de <strong>Performance e Receita</strong>.
        </div>
      )}

      <main style={{maxWidth:1800,margin:"0 auto",padding:"18px 24px"}}>
        {/* FILTRO ADMIN */}
        {perfil.perfil==='admin' && (
          <div style={{display:"flex",gap:5,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:9,color:RTT.cinzaTexto,textTransform:"uppercase",letterSpacing:"0.08em",marginRight:4,fontWeight:700}}>Gerente:</span>
            {["Todos",...gerentes].map(g=>(
              <button key={g} onClick={()=>setFiltro(g)} style={{padding:"4px 11px",borderRadius:4,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:filtro===g?700:400,background:filtro===g?RTT.vermelho:"transparent",color:filtro===g?"#fff":RTT.cinzaClaro,border:filtro===g?`1px solid ${RTT.vermelho}`:`1px solid ${RTT.cinzaBorda}`}}>
                {g==="Todos"?"Todos":g.split(" ")[0]}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{textAlign:"center",padding:"80px",color:RTT.cinzaTexto,fontSize:14}}>Carregando projetos...</div>
        ) : (
          <>
            {/* CABEÇALHO DAS COLUNAS */}
            <div style={{display:"grid",gridTemplateColumns:"280px 1fr 1fr 1fr 36px",gap:4,padding:"0 12px"}}>
              <div/>
              {MESES.map(m=>(
                <div key={m.key} style={{textAlign:"center",padding:"5px 0",borderRadius:"5px 5px 0 0",background:RTT.vermelhoFundo,borderTop:`2px solid ${RTT.vermelho}`,borderLeft:"1px solid rgba(227,30,36,0.15)",borderRight:"1px solid rgba(227,30,36,0.15)"}}>
                  <span style={{fontSize:10,fontWeight:700,color:RTT.vermelho,textTransform:"uppercase",letterSpacing:"0.08em"}}>{m.label.slice(0,3).toUpperCase()}/{m.ano}</span>
                </div>
              ))}
              <div/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"280px 1fr 1fr 1fr 36px",gap:4,padding:"0 12px",marginBottom:4}}>
              <div style={{fontSize:8,color:RTT.cinzaTexto,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700,padding:"4px 0"}}>Projeto</div>
              {MESES.map(m=>(
                <div key={m.key} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:3,padding:"3px 6px",background:"rgba(227,30,36,0.03)",borderLeft:"1px solid rgba(227,30,36,0.1)",borderRight:"1px solid rgba(227,30,36,0.1)",borderBottom:"1px solid rgba(227,30,36,0.1)"}}>
                  {["BP","RFC s-1","Forecast"].map(sub=>(
                    <div key={sub} style={{fontSize:8,color:sub==="Forecast"?RTT.vermelho:RTT.cinzaTexto,textTransform:"uppercase",letterSpacing:"0.06em",textAlign:"center",fontWeight:sub==="Forecast"?700:400}}>{sub}</div>
                  ))}
                </div>
              ))}
              <div/>
            </div>

            {/* LINHAS POR GERENTE */}
            {gerentesVisiveis.map(gerente => {
              const projs = projsFiltrados.filter(p => p.gerente_site === gerente)
              if (!projs.length) return null
              const gerEnviou = gerentesQueEnviaram.has(gerente)
              return (
                <div key={gerente} style={{marginBottom:16}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px 4px",borderTop:`1px solid ${RTT.cinzaBorda}`,marginTop:8}}>
                    <div style={{width:5,height:5,borderRadius:2,background:RTT.vermelho}}/>
                    <span style={{fontSize:9,fontWeight:700,color:RTT.vermelho,textTransform:"uppercase",letterSpacing:"0.08em"}}>{gerente}</span>
                    <span style={{fontSize:9,color:RTT.cinzaTexto}}>{projs.length} projeto{projs.length!==1?"s":""}</span>
                    {/* status de envio por gerente (visível apenas para admin) */}
                    {perfil.perfil==='admin' && (
                      <span style={{fontSize:9,fontWeight:700,color:gerEnviou?RTT.verde:RTT.amarelo,marginLeft:4}}>
                        {gerEnviou ? "✓ enviado" : "⚠ pendente"}
                      </span>
                    )}
                  </div>

                  {projs.map(proj => {
                    const gs = GRUPO_CORES[proj.grupo] || {bg:"rgba(100,100,100,0.1)",text:"#8a8a8a",border:"rgba(100,100,100,0.2)"}
                    return (
                      <div key={proj.chave_rfc} style={{display:"grid",gridTemplateColumns:"280px 1fr 1fr 1fr 36px",gap:4,alignItems:"start",padding:"8px 12px",borderRadius:6,marginBottom:2,background:RTT.cinzaEscuro,border:`1px solid ${RTT.cinzaBorda}`}}>
                        {/* NOME DO PROJETO */}
                        <div style={{minWidth:0,paddingTop:4}}>
                          <div style={{fontSize:11,fontWeight:500,color:RTT.branco,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{proj.identificacao}</div>
                          <span style={{fontSize:9,padding:"1px 6px",borderRadius:3,fontWeight:600,background:gs.bg,color:gs.text,border:`1px solid ${gs.border}`,marginTop:3,display:"inline-block"}}>{proj.grupo||"—"}</span>
                        </div>

                        {/* CÉLULAS DE MÊS */}
                        {MESES.map(m => {
                          const bp  = proj[m.bp_campo] || 0
                          const rfc = getRFC(proj.chave_rfc, m.label)
                          const obsKey = proj.chave_rfc + '_' + m.key
                          const obsAberta = obsAbertas.has(obsKey)
                          const obsVal = getObs(proj.chave_rfc, m.key)
                          const confVal = getConfianca(proj.chave_rfc, m.key)

                          return (
                            <div key={m.key} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:3,padding:"4px 6px",background:"rgba(227,30,36,0.03)",borderLeft:"1px solid rgba(227,30,36,0.1)",borderRight:"1px solid rgba(227,30,36,0.1)",borderRadius:4}}>
                              {/* BP */}
                              <div style={{textAlign:"center",paddingTop:3}}>
                                <div style={{fontSize:11,fontWeight:600,color:RTT.amarelo}}>{fmt(bp)}</div>
                              </div>

                              {/* RFC s-1 */}
                              <div style={{textAlign:"center",paddingTop:3}}>
                                <div style={{fontSize:11,fontWeight:600,color:RTT.brancoSuave}}>{fmt(rfc)}</div>
                                <Delta val={rfc} refVal={bp}/>
                              </div>

                              {/* FORECAST */}
                              <div>
                                {/* Input + botão obs */}
                                <div style={{display:"flex",gap:3,alignItems:"center"}}>
                                  <input
                                    type="number"
                                    placeholder="0"
                                    value={getVal(proj.chave_rfc, m.key)}
                                    onChange={e=>setValor(proj.chave_rfc, m.key, e.target.value)}
                                    style={{flex:1,background:RTT.cinzaMedio,border:`1px solid ${RTT.cinzaBorda2}`,borderRadius:4,padding:"5px 5px",color:RTT.branco,fontSize:11,outline:"none",textAlign:"right",boxSizing:"border-box",fontFamily:"inherit"}}
                                    onFocus={e=>e.target.style.borderColor=RTT.vermelho}
                                    onBlur={e=>e.target.style.borderColor=RTT.cinzaBorda2}
                                  />
                                  {/* Ícone observação */}
                                  <button
                                    onClick={()=>toggleObs(obsKey)}
                                    title="Observação"
                                    style={{background:"transparent",border:`1px solid ${obsVal?RTT.vermelho:RTT.cinzaBorda}`,borderRadius:4,color:obsVal?RTT.vermelho:RTT.cinzaTexto,width:20,height:24,cursor:"pointer",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,padding:0}}
                                  >✎</button>
                                </div>

                                {/* Botões confiança */}
                                <div style={{display:"flex",gap:2,marginTop:4}}>
                                  {CONFIANCA_OPTS.map(opt=>{
                                    const sel = confVal === opt.label
                                    return (
                                      <button
                                        key={opt.label}
                                        onClick={()=>setValor(proj.chave_rfc, m.key+'_confianca', sel?'':opt.label)}
                                        style={{flex:1,padding:"2px 0",fontSize:8,fontWeight:sel?700:400,cursor:"pointer",fontFamily:"inherit",borderRadius:3,border:`1px solid ${sel?opt.corBorda:RTT.cinzaBorda}`,background:sel?opt.corFundo:"transparent",color:sel?opt.cor:RTT.cinzaTexto,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}
                                        title={opt.label}
                                      >{opt.label}</button>
                                    )
                                  })}
                                </div>

                                {/* Campo observação (expansível) */}
                                {(obsAberta || obsVal) && (
                                  <textarea
                                    value={obsVal}
                                    placeholder="Observação..."
                                    onChange={e=>setValor(proj.chave_rfc, m.key+'_obs', e.target.value)}
                                    rows={2}
                                    style={{width:"100%",marginTop:4,background:RTT.cinzaMedio,border:`1px solid ${RTT.cinzaBorda2}`,borderRadius:4,padding:"4px 6px",color:RTT.branco,fontSize:10,outline:"none",resize:"none",boxSizing:"border-box",fontFamily:"inherit"}}
                                    onFocus={e=>e.target.style.borderColor=RTT.vermelho}
                                    onBlur={e=>e.target.style.borderColor=RTT.cinzaBorda2}
                                  />
                                )}
                              </div>
                            </div>
                          )
                        })}

                        {/* BOTÃO PAINEL ANUAL */}
                        <button
                          onClick={()=>setPainel(proj)}
                          style={{width:28,height:28,background:"transparent",border:`1px solid ${RTT.cinzaBorda}`,borderRadius:5,color:RTT.cinzaTexto,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,alignSelf:"center"}}
                          onMouseEnter={e=>{e.currentTarget.style.borderColor=RTT.vermelho;e.currentTarget.style.color=RTT.vermelho}}
                          onMouseLeave={e=>{e.currentTarget.style.borderColor=RTT.cinzaBorda;e.currentTarget.style.color=RTT.cinzaTexto}}
                        >›</button>
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* RODAPÉ */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",marginTop:8,background:RTT.cinzaEscuro,borderRadius:7,border:`1px solid ${RTT.cinzaBorda}`}}>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                <div style={{fontSize:10,color:RTT.cinzaTexto}}>
                  {projsFiltrados.length} projetos · Prazo: <strong style={{color:RTT.branco}}>sexta-feira às 12h</strong> · Semana {semana}/{anoAtual}
                </div>
                {/* Badge de status de envio (gestor) */}
                {perfil.perfil==='gestor' && (
                  <div style={{fontSize:10,fontWeight:700,color:jaEnviei?RTT.verde:RTT.amarelo}}>
                    {jaEnviei
                      ? `✓ Forecast enviado · última atualização: ${fmtDataColeta(ultimoEnvio)}`
                      : "⚠ Forecast desta semana ainda não enviado"}
                  </div>
                )}
              </div>
              <button
                onClick={handleEnviar}
                disabled={enviando || janelaBloqueada}
                style={{background:janelaBloqueada?RTT.cinzaMedio:RTT.vermelho,color:janelaBloqueada?RTT.cinzaTexto:"#fff",border:"none",padding:"9px 22px",borderRadius:6,fontSize:12,fontWeight:700,cursor:janelaBloqueada?"not-allowed":"pointer",fontFamily:"inherit",letterSpacing:"0.05em",opacity:enviando?0.7:1}}
                onMouseEnter={e=>{ if(!enviando&&!janelaBloqueada) e.currentTarget.style.background=RTT.vermelhoEscuro }}
                onMouseLeave={e=>{ if(!janelaBloqueada) e.currentTarget.style.background=RTT.vermelho }}
              >{enviando?"ENVIANDO...":"ENVIAR FORECAST"}</button>
            </div>
          </>
        )}
      </main>

      {painel && <PainelAnual proj={painel} mesAtualIdx={mesAtualIdx} onClose={()=>setPainel(null)}/>}
    </div>
  )
}
