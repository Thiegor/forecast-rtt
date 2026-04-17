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
const WEBHOOK_RFC_URL = 'https://default3ba4e9dd629e40049c62708d327b58.a5.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/dc05767c636d47efba1a2047b56c8dae/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=NHSaWdpp9beT-x-B3VJfYXpuf_en2MKdr2u6OW9mlhw'

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

// Número inteiro com separador de milhar: 1.540.350
function fmt(val) {
  if (!val || val === 0) return "—"
  return Math.round(val).toLocaleString("pt-BR")
}
// Abreviado para totais no header: 43.9M / 6.4M
function fmtShort(val) {
  if (!val || val === 0) return "—"
  if (val >= 1000000) return `${(val/1000000).toFixed(1)}M`
  if (val >= 1000) return `${(val/1000).toFixed(0)}K`
  return Math.round(val).toLocaleString("pt-BR")
}

function calcPct(a, b) {
  if (!b || b === 0) return null
  return ((a - b) / b) * 100
}

function Delta({ val, refVal }) {
  const p = calcPct(val, refVal)
  if (p === null || !val || !refVal) return null
  const cor = p > 5 ? RTT.verde : p < -5 ? RTT.vermelho : RTT.amarelo
  return <span style={{fontSize:9,fontWeight:700,color:cor}}>{p>0?"▲":"▼"}{Math.abs(p).toFixed(0)}%</span>
}

// Retorna true se val difere > 5% do rfc da semana anterior
function temVariacao(val, rfc) {
  const v = parseFloat(val)
  if (!v || !rfc || rfc === 0) return false
  return Math.abs((v - rfc) / rfc) > 0.05
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

function PainelAnual({ proj, mesAtualIdx, forecastAnual, onClose, perfil, semana }) {
  const anoAtual = new Date().getFullYear()
  const mesesRolantes = [mesAtualIdx, mesAtualIdx+1, mesAtualIdx+2]
  // Meses editáveis: a partir do 4º mês seguinte ao atual (excluindo os 3 do formulário e os passados)
  const mesesEditaveis = MESES_LONGOS.map((_,i)=>i).filter(i => i > mesAtualIdx + 2)

  const [projBP, setProjBP] = useState([])
  const [valoresEdit, setValoresEdit] = useState({})   // { mesIdx: string }
  const [obsEdit, setObsEdit]     = useState({})       // { mesIdx: string }
  const [obsAbertasEdit, setObsAbertasEdit] = useState(new Set())
  const [salvando, setSalvando]   = useState(false)
  const [salvouOk, setSalvouOk]   = useState(false)
  const [erroSalvar, setErroSalvar] = useState(null)
  // Registros recém-salvos: sobrepõem forecastAnual no cálculo do rfcPorMes
  const [savedExtra, setSavedExtra] = useState([])

  useEffect(() => {
    const query = supabase.from('bp_anual').select('chave_rfc,mes,valor_bp').eq('ano', anoAtual)
    const p = proj.cod_projeto ? query.eq('cod_projeto', proj.cod_projeto) : query.eq('chave_rfc', proj.chave_rfc)
    p.then(({ data }) => setProjBP(data || []))
  }, [proj.cod_projeto, proj.chave_rfc, anoAtual])

  const bpPorMes = {}
  projBP.forEach(b => { bpPorMes[b.mes] = (bpPorMes[b.mes] || 0) + (Number(b.valor_bp) || 0) })
  const totalBP = Object.values(bpPorMes).reduce((s, v) => s + v, 0)

  const chavesRfcProjeto = new Set(projBP.map(b => b.chave_rfc))
  const melhorPorChaveMes = {}
  // Combina forecastAnual com savedExtra (saved locally após salvar no painel)
  ;[...forecastAnual, ...savedExtra]
    .filter(f => chavesRfcProjeto.has(f.chave_rfc) && f.ano_referencia === anoAtual)
    .forEach(f => {
      const key = f.chave_rfc + '|' + f.mes_referencia
      if (!melhorPorChaveMes[key] || f.semana_coleta > melhorPorChaveMes[key].semana_coleta)
        melhorPorChaveMes[key] = f
    })
  const rfcPorMes = {}
  Object.values(melhorPorChaveMes).forEach(f => {
    rfcPorMes[f.mes_referencia] = (rfcPorMes[f.mes_referencia] || 0) + (f.receita_prevista || 0)
  })
  const totalRFC = Object.values(rfcPorMes).reduce((s, v) => s + v, 0)
  const deltaAnual = totalBP > 0 && totalRFC > 0 ? ((totalRFC - totalBP) / totalBP * 100) : null
  const deltaAnualCor = deltaAnual === null ? RTT.cinzaClaro : deltaAnual > 5 ? RTT.verde : deltaAnual < -5 ? RTT.vermelho : RTT.amarelo

  function getValEdit(i) {
    if (valoresEdit[i] !== undefined) return valoresEdit[i]
    const rfc = rfcPorMes[MESES_LONGOS[i]] || 0
    return rfc ? String(rfc) : ''
  }

  function toggleObsEdit(i) {
    setObsAbertasEdit(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
  }

  async function salvarFuturos() {
    setErroSalvar(null)
    // Validação: variação > 5% exige comentário
    const semObs = []
    mesesEditaveis.forEach(i => {
      const val = parseFloat(getValEdit(i))
      const rfcRef = rfcPorMes[MESES_LONGOS[i]] || 0
      if (val && rfcRef && temVariacao(val, rfcRef) && !obsEdit[i]?.trim())
        semObs.push(MESES_LONGOS[i])
    })
    if (semObs.length > 0) {
      setErroSalvar(`Comentário obrigatório para variação >5%: ${semObs.join(', ')}`)
      return
    }

    setSalvando(true)
    try {
      const registros = []
      mesesEditaveis.forEach(i => {
        const val = parseFloat(getValEdit(i))
        if (!val || val === 0) return
        const mesLabel = MESES_LONGOS[i]
        registros.push({
          chave_unica:      proj.chave_rfc+'-'+mesLabel+'-'+anoAtual+'-'+semana,
          chave_rfc:        proj.chave_rfc,
          identificacao:    proj.identificacao,
          grupo:            proj.grupo,
          gerente_site:     perfil.nome,
          mes_referencia:   mesLabel,
          ano_referencia:   anoAtual,
          semana_coleta:    semana,
          receita_prevista: val,
          confianca:        null,
          observacoes:      obsEdit[i]?.trim() || null,
          data_coleta:      new Date().toISOString(),
        })
      })
      if (registros.length === 0) { setErroSalvar('Nenhum valor preenchido.'); return }

      const { error } = await supabase.from('forecast_semanal').upsert(registros, { onConflict:'chave_unica' })
      if (error) { setErroSalvar(error.message); return }

      // Atualiza visualização local imediatamente
      setSavedExtra(prev => {
        const merged = [...prev]
        registros.forEach(reg => {
          const idx = merged.findIndex(f => f.chave_rfc === reg.chave_rfc && f.mes_referencia === reg.mes_referencia)
          if (idx >= 0) merged[idx] = { ...merged[idx], ...reg }
          else merged.push(reg)
        })
        return merged
      })
      setValoresEdit({})
      setObsEdit({})
      setObsAbertasEdit(new Set())
      setSalvouOk(true)
      setTimeout(() => setSalvouOk(false), 3000)
    } catch (e) {
      setErroSalvar(e.message)
    } finally {
      setSalvando(false)
    }
  }

  const temEdicoes = mesesEditaveis.some(i => {
    const v = valoresEdit[i]
    return v !== undefined && v !== '' && !isNaN(parseFloat(v))
  })

  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex"}}>
      <div onClick={onClose} style={{flex:1,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(3px)"}}/>
      <div style={{width:520,background:RTT.cinzaEscuro,borderLeft:`1px solid ${RTT.cinzaBorda}`,display:"flex",flexDirection:"column",overflow:"hidden",fontFamily:F}}>
        {/* HEADER */}
        <div style={{padding:"20px 24px 16px",borderBottom:`1px solid ${RTT.cinzaBorda}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div style={{flex:1,marginRight:12}}>
              <div style={{fontSize:10,color:RTT.cinzaTexto,marginBottom:4}}>Visão Anual {anoAtual} — todos os grupos</div>
              <div style={{fontSize:14,fontWeight:600,color:RTT.branco,lineHeight:1.3}}>{proj.identificacao}</div>
              <div style={{marginTop:6}}><span style={{fontSize:11,color:RTT.cinzaTexto}}>{proj.gerente_site}</span></div>
            </div>
            <button onClick={onClose} style={{background:"transparent",border:`1px solid ${RTT.cinzaBorda}`,color:RTT.cinzaClaro,width:28,height:28,borderRadius:6,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[
              {label:`BP Total ${anoAtual}`, val:`R$ ${fmtShort(totalBP)}`, cor:RTT.amarelo},
              {label:"RFC Total", val:totalRFC?`R$ ${fmtShort(totalRFC)}`:"—", cor:totalRFC?RTT.branco:RTT.cinzaTexto},
              {label:"RFC vs BP", val:deltaAnual!==null?`${deltaAnual>0?'▲':'▼'}${Math.abs(deltaAnual).toFixed(1)}%`:"—", cor:deltaAnualCor},
            ].map(k=>(
              <div key={k.label} style={{background:RTT.cinzaMedio,borderRadius:6,padding:"8px 12px",border:`1px solid ${RTT.cinzaBorda}`}}>
                <div style={{fontSize:10,color:RTT.cinzaTexto,marginBottom:2}}>{k.label}</div>
                <div style={{fontSize:14,fontWeight:700,color:k.cor}}>{k.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CABEÇALHO DA TABELA */}
        <div style={{display:"grid",gridTemplateColumns:"44px 1fr 1fr 1fr 44px",padding:"8px 24px 6px",borderBottom:`1px solid ${RTT.cinzaBorda}`,gap:4}}>
          {[
            {l:"Mês",align:"left"},
            {l:"BP",align:"center"},
            {l:"RFC atual",align:"center"},
            {l:"Forecast",align:"center"},
            {l:"Δ",align:"center"},
          ].map((h,i)=>(
            <div key={i} style={{fontSize:10,color:i===3?RTT.vermelho:RTT.cinzaTexto,textAlign:h.align,fontWeight:500}}>{h.l}</div>
          ))}
        </div>

        {/* LINHAS */}
        <div style={{flex:1,overflowY:"auto"}}>
          {MESES_LONGOS.map((mes,i)=>{
            const isAtual  = mesesRolantes.includes(i)
            const isEdit   = mesesEditaveis.includes(i)
            const bp       = bpPorMes[i+1] || 0
            const rfc      = rfcPorMes[mes] || 0
            const valInput = getValEdit(i)
            const valNum   = parseFloat(valInput)
            const variacaoAlta = isEdit && temVariacao(valNum, rfc)
            const obsObrig = variacaoAlta && !obsEdit[i]?.trim()
            const obsAberta = obsAbertasEdit.has(i)
            const delta    = bp > 0 && rfc > 0 ? ((rfc - bp) / bp * 100) : null
            const deltaCor = delta === null ? RTT.cinzaTexto : delta > 5 ? RTT.verde : delta < -5 ? RTT.vermelho : RTT.amarelo

            return (
              <div key={mes} style={{
                padding:"6px 24px",
                background: isAtual ? RTT.cinzaMedio : "transparent",
                borderLeft: isAtual ? `2px solid ${RTT.vermelho}` : isEdit ? `2px solid rgba(227,30,36,0.2)` : "2px solid transparent",
                borderBottom:`1px solid ${RTT.cinzaBorda}`,
              }}>
                <div style={{display:"grid",gridTemplateColumns:"44px 1fr 1fr 1fr 44px",alignItems:"center",gap:4}}>
                  {/* MÊS */}
                  <div style={{fontSize:11,fontWeight:isAtual?600:400,color:isAtual?RTT.branco:isEdit?RTT.cinzaClaro:RTT.cinzaTexto}}>{mes.slice(0,3)}</div>
                  {/* BP */}
                  <div style={{textAlign:"center",fontSize:12,fontWeight:600,color:bp?RTT.amarelo:RTT.cinzaTexto}}>{fmt(bp)}</div>
                  {/* RFC atual */}
                  <div style={{textAlign:"center",fontSize:12,color:rfc?RTT.brancoSuave:RTT.cinzaTexto}}>{rfc ? fmt(rfc) : "—"}</div>
                  {/* FORECAST — editável só para meses futuros */}
                  {isEdit ? (
                    <div style={{display:"flex",alignItems:"center",gap:2}}>
                      <input
                        type="number"
                        placeholder="—"
                        value={valInput}
                        onChange={e=>{
                          const v = e.target.value
                          setValoresEdit(prev=>({...prev,[i]:v}))
                          if (temVariacao(parseFloat(v), rfc))
                            setObsAbertasEdit(prev=>{const n=new Set(prev);n.add(i);return n})
                        }}
                        style={{flex:1,background:"rgba(227,30,36,0.05)",border:"none",borderBottom:`1px solid ${obsObrig?RTT.amarelo:RTT.cinzaBorda2}`,borderRadius:0,padding:"3px 4px",color:RTT.branco,fontSize:11,outline:"none",textAlign:"right",boxSizing:"border-box",fontFamily:F,minWidth:0}}
                        onFocus={e=>e.target.style.borderBottomColor=RTT.vermelho}
                        onBlur={e=>e.target.style.borderBottomColor=obsObrig?RTT.amarelo:RTT.cinzaBorda2}
                      />
                      <button
                        onClick={()=>toggleObsEdit(i)}
                        title={obsObrig?"Comentário obrigatório (variação >5%)":"Observação"}
                        style={{background:"none",border:"none",color:obsObrig?RTT.amarelo:obsEdit[i]?RTT.vermelho:RTT.cinzaTexto,cursor:"pointer",fontSize:10,padding:1,lineHeight:1,fontWeight:obsObrig?700:400,flexShrink:0}}
                      >✎</button>
                    </div>
                  ) : (
                    <div style={{textAlign:"center",fontSize:11,color:RTT.cinzaTexto}}>
                      {isAtual ? <span style={{fontSize:9,color:RTT.cinzaTexto}}>no form.</span> : "—"}
                    </div>
                  )}
                  {/* Δ */}
                  <div style={{textAlign:"center",fontSize:10,fontWeight:600,color:deltaCor}}>
                    {delta !== null ? `${delta>0?'▲':'▼'}${Math.abs(delta).toFixed(0)}%` : "—"}
                  </div>
                </div>
                {/* OBS expandida para meses editáveis */}
                {isEdit && (obsAberta || obsObrig) && (
                  <div style={{marginTop:4,paddingLeft:48}}>
                    {obsObrig && <div style={{fontSize:9,color:RTT.amarelo,marginBottom:2}}>⚠ comentário obrigatório</div>}
                    <textarea
                      value={obsEdit[i] || ''}
                      placeholder="Explique a variação..."
                      onChange={e=>setObsEdit(prev=>({...prev,[i]:e.target.value}))}
                      rows={2}
                      style={{width:"100%",background:RTT.cinzaMedio,border:`1px solid ${obsObrig?RTT.amarelo:RTT.cinzaBorda}`,borderRadius:4,padding:"4px 6px",color:RTT.branco,fontSize:11,outline:"none",resize:"none",boxSizing:"border-box",fontFamily:F}}
                      onFocus={e=>e.target.style.borderColor=RTT.vermelho}
                      onBlur={e=>e.target.style.borderColor=obsObrig?RTT.amarelo:RTT.cinzaBorda}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* RODAPÉ — salvar meses futuros */}
        <div style={{padding:"12px 24px",borderTop:`1px solid ${RTT.cinzaBorda}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <div style={{fontSize:11,fontFamily:F}}>
            {salvouOk && <span style={{color:RTT.verde}}>✓ Forecast salvo com sucesso</span>}
            {erroSalvar && <span style={{color:RTT.vermelho,whiteSpace:"pre-wrap"}}>{erroSalvar}</span>}
            {!salvouOk && !erroSalvar && (
              <span style={{color:RTT.cinzaTexto}}>Edite os meses futuros e salve</span>
            )}
          </div>
          <button
            onClick={salvarFuturos}
            disabled={salvando || !temEdicoes}
            style={{
              background: temEdicoes ? RTT.vermelho : RTT.cinzaMedio,
              color: temEdicoes ? RTT.branco : RTT.cinzaTexto,
              border:"none", borderRadius:6, padding:"8px 20px",
              fontSize:12, fontWeight:600, cursor: temEdicoes?"pointer":"default",
              fontFamily:F, opacity: salvando ? 0.6 : 1, flexShrink:0,
            }}
          >
            {salvando ? "Salvando..." : "Salvar Forecast"}
          </button>
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

  // Data da sexta-feira desta semana (prazo)
  const sexta = new Date(now)
  const diasParaSexta = (5 - now.getDay() + 7) % 7 || 7
  sexta.setDate(now.getDate() + (now.getDay() === 5 ? 0 : diasParaSexta))
  const prazoDia = String(sexta.getDate()).padStart(2, '0')
  const prazoMes = String(sexta.getMonth() + 1).padStart(2, '0')

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
      try {
        // Início da janela atual: última quinta-feira às 9h
        const agora = new Date()
        const inicioJanela = new Date(agora)
        const diasDesdeQuinta = (agora.getDay() + 7 - 4) % 7
        inicioJanela.setDate(agora.getDate() - diasDesdeQuinta)
        inicioJanela.setHours(9, 0, 0, 0)
        const mesesNums = [mesAtualIdx + 1, (mesAtualIdx + 1) % 12 + 1, (mesAtualIdx + 2) % 12 + 1]

        function withTimeout(promise, ms = 12000) {
          return Promise.race([promise, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))])
        }

        // Todas as queries em paralelo com timeout individual
        const [resCadastro, resFc, resUltSemana, resBp, resFcAnual] = await Promise.allSettled([
          withTimeout(supabase.from('projetos').select('*').order('identificacao')),
          withTimeout(supabase.from('forecast_semanal').select('*')
            .eq('semana_coleta', semana).eq('ano_referencia', anoAtual)
            .gte('data_coleta', inicioJanela.toISOString())),
          withTimeout(supabase.from('forecast_semanal').select('semana_coleta')
            .eq('ano_referencia', anoAtual)
            .order('semana_coleta', { ascending: false }).limit(1).single()),
          withTimeout(supabase.from('bp_anual').select('*').eq('ano', anoAtual).in('mes', mesesNums)),
          withTimeout(supabase.from('forecast_semanal').select('*').eq('ano_referencia', anoAtual)),
        ])

        setProjetosCadastro(resCadastro.value?.data || [])
        setForecastSemana(resFc.value?.data || [])

        const semanaRef = resUltSemana.value?.data?.semana_coleta ?? semanaPrev
        const resFcPrev = await withTimeout(
          supabase.from('forecast_semanal').select('*').eq('semana_coleta', semanaRef).eq('ano_referencia', anoAtual)
        ).catch(() => ({ data: [] }))
        setForecastSemanaAnterior(resFcPrev?.data || [])

        setBpAnual(resBp.value?.data || [])
        setForecastAnual(resFcAnual.value?.data || [])
      } catch (e) {
        console.error('Erro ao carregar dados:', e)
      } finally {
        setLoading(false)
      }
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

  // Replicar RFC s-1: copia valores da semana anterior para os inputs da semana atual
  function replicarRFC(proj) {
    const update = {}
    MESES.forEach(m => {
      const fc = forecastSemanaAnterior.find(f => f.chave_rfc === proj.chave_rfc && f.mes_referencia === m.label)
      if (fc && fc.receita_prevista > 0) {
        update[m.key] = fc.receita_prevista
        if (fc.confianca)   update[m.key + '_confianca'] = fc.confianca
        if (fc.observacoes) update[m.key + '_obs'] = fc.observacoes
      }
    })
    if (Object.keys(update).length > 0) {
      setValores(prev => ({ ...prev, [proj.chave_rfc]: { ...prev[proj.chave_rfc], ...update } }))
    }
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
    try {
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
            cod_projeto:      proj.cod_projeto ? parseInt(proj.cod_projeto, 10) || null : null,
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
        return
      }

      // Bloqueia envio se variação > 5% sem comentário
      const semObs = []
      for (const reg of registros) {
        const rfc = getRFC(reg.chave_rfc, reg.mes_referencia)
        if (temVariacao(reg.receita_prevista, rfc) && !reg.observacoes?.trim()) {
          semObs.push(`${reg.identificacao} — ${reg.mes_referencia}`)
        }
      }
      if (semObs.length > 0) {
        const lista = semObs.slice(0, 3).join('\n• ')
        const extra = semObs.length > 3 ? `\n...e mais ${semObs.length - 3} projeto(s)` : ''
        setErro(`Comentário obrigatório para variações acima de 5%:\n• ${lista}${extra}`)
        return
      }

      const upsertPromise = supabase
        .from('forecast_semanal')
        .upsert(registros, { onConflict:'chave_unica' })
        .select('chave_unica')
      const upsertTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000))
      const { data: saved, error } = await Promise.race([upsertPromise, upsertTimeout])
      if (error) {
        setErro('Erro ao salvar: ' + error.message)
      } else if (!saved || saved.length === 0) {
        setErro('Nenhum registro foi salvo. Verifique sua conexão e tente novamente.')
      } else {
        // Atualiza state local com os registros enviados (evita re-fetch que pode travar)
        setForecastSemana(prev => {
          const updated = [...prev]
          registros.forEach(reg => {
            const idx = updated.findIndex(f => f.chave_unica === reg.chave_unica)
            if (idx >= 0) updated[idx] = { ...updated[idx], ...reg }
            else updated.push(reg)
          })
          return updated
        })
        setValores({})
        setSucesso(true)
        setTimeout(() => setSucesso(false), 4000)
      }
    } catch (e) {
      setErro('Erro ao enviar: ' + (e.message === 'timeout' ? 'Servidor demorou demais (30s). Tente novamente.' : e.message))
    } finally {
      setEnviando(false)
    }
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
  const GRUPOS_BP = ['Backlog', 'PIPE', 'Renovação', 'Spot']
  bpAnual.forEach(b => {
    if (!itensMap[b.chave_rfc]) {
      // BP: qualquer projeto, desde que grupo seja Backlog / PIPE / Renovação
      if (!GRUPOS_BP.includes(b.grupo)) return
      const proj = projetosCadastro.find(p => p.cod_projeto === b.cod_projeto)
      // Excluir apenas Interno e Encerrado — Vigente, PIPELINE e demais entram
      // Se proj não encontrado (ex: cod 265/25), mantém (tem BP real)
      if (proj && (proj.status === 'Encerrado' || proj.status === 'Interno')) return
      // chave_rfc foi construída como identificacao+grupo sem separador — remove o sufixo do grupo
      const identificacaoLimpa = b.grupo
        ? b.chave_rfc.replace(new RegExp(b.grupo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), '').trim()
        : b.chave_rfc
      itensMap[b.chave_rfc] = {
        chave_rfc: b.chave_rfc,
        cod_projeto: b.cod_projeto,
        grupo: b.grupo,
        identificacao: identificacaoLimpa || proj?.identificacao,
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
              <span style={{fontSize:13,fontWeight:700,color:RTT.branco,fontFamily:F}}>R$ {fmtShort(totalBP)}</span>
              <span style={{color:RTT.cinzaBorda2,margin:"0 4px"}}>·</span>
              <span style={{fontSize:12,color:RTT.cinzaClaro,fontFamily:F}}>RFC s-1</span>
              <span style={{fontSize:13,fontWeight:600,color:RTT.brancoSuave,fontFamily:F}}>R$ {fmtShort(totalRFC)}</span>
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

      {/* TOAST FIXO — visível independente do scroll */}
      {(sucesso || erro) && (
        <div style={{
          position:'fixed', bottom:72, right:28, zIndex:9999,
          background: sucesso ? '#0d2e1f' : '#2a0a0a',
          border: `1px solid ${sucesso ? RTT.verde : RTT.vermelho}`,
          borderRadius:8, padding:'12px 20px', maxWidth:340,
          boxShadow:'0 4px 24px rgba(0,0,0,0.5)',
          display:'flex', alignItems:'center', gap:10, fontFamily:F,
        }}>
          <span style={{fontSize:18}}>{sucesso ? '✅' : '⚠️'}</span>
          <span style={{fontSize:13, fontWeight: sucesso ? 600 : 400, color: sucesso ? RTT.verde : '#fca5a5', lineHeight:1.4}}>
            {sucesso ? `Forecast S${semana} enviado com sucesso!` : erro}
          </span>
          <button onClick={()=>{setSucesso(false);setErro(null)}} style={{marginLeft:'auto',background:'none',border:'none',color:'#5a5a5a',cursor:'pointer',fontSize:16,lineHeight:1,padding:'0 0 0 8px'}}>✕</button>
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
              <div style={{display:"grid",gridTemplateColumns:"260px 1fr 1fr 1fr 64px",gap:6}}>
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
                      <div key={proj.chave_rfc} style={{display:"grid",gridTemplateColumns:"260px 1fr 1fr 1fr 64px",gap:6,alignItems:"center",padding:"8px 10px",borderRadius:6,background:RTT.cinzaEscuro,border:`1px solid ${RTT.cinzaBorda}`}}>
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

                          return (
                            <div key={m.key} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,alignItems:"center"}}>
                              {/* BP */}
                              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:28}}>
                                <div style={{fontSize:12,fontWeight:600,color:RTT.amarelo,fontFamily:F}}>{fmt(bp)}</div>
                              </div>

                              {/* RFC s-1 */}
                              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:28,gap:1}}>
                                <div style={{fontSize:12,fontWeight:500,color:RTT.brancoSuave,fontFamily:F}}>{fmt(rfc)}</div>
                                <Delta val={rfc} refVal={bp}/>
                              </div>

                              {/* FORECAST */}
                              {(() => {
                                const valAtual = getVal(proj.chave_rfc, m.key)
                                const variacaoAlta = temVariacao(valAtual, rfc)
                                const obsObrig = variacaoAlta && !obsVal?.trim()
                                return (
                                <div style={{background:"rgba(227,30,36,0.04)",borderRadius:5,padding:"0 4px",minHeight:28,display:"flex",flexDirection:"column",justifyContent:"center"}}>
                                  <div style={{display:"flex",gap:2,alignItems:"center"}}>
                                    <input
                                      type="number"
                                      placeholder="—"
                                      value={valAtual}
                                      onChange={e => {
                                        const v = e.target.value
                                        setValor(proj.chave_rfc, m.key, v)
                                        // Auto-abre obs se variação > 5% em relação ao RFC s-1
                                        if (temVariacao(v, rfc)) {
                                          setObsAbertas(prev => { const n = new Set(prev); n.add(obsKey); return n })
                                        }
                                      }}
                                      style={{flex:1,background:"transparent",border:"none",borderBottom:`1px solid ${RTT.cinzaBorda2}`,borderRadius:0,padding:"3px 4px",color:RTT.branco,fontSize:12,outline:"none",textAlign:"right",boxSizing:"border-box",fontFamily:F,minWidth:0}}
                                      onFocus={e=>e.target.style.borderBottomColor=RTT.vermelho}
                                      onBlur={e=>e.target.style.borderBottomColor=RTT.cinzaBorda2}
                                    />
                                    <button
                                      onClick={()=>toggleObs(obsKey)}
                                      title={obsObrig ? "Comentário obrigatório (variação >5%)" : "Observação"}
                                      style={{background:"none",border:"none",color:obsObrig?RTT.amarelo:obsVal?RTT.vermelho:RTT.cinzaTexto,cursor:"pointer",fontSize:11,padding:"2px",lineHeight:1,flexShrink:0,fontWeight:obsObrig?700:400}}
                                    >✎</button>
                                  </div>
                                  {(obsAberta || obsVal || variacaoAlta) && (
                                    <>
                                      {obsObrig && (
                                        <div style={{fontSize:9,color:RTT.amarelo,fontFamily:F,marginTop:2,paddingLeft:2}}>
                                          ⚠ comentário obrigatório
                                        </div>
                                      )}
                                      <textarea
                                        value={obsVal}
                                        placeholder="Explique a variação..."
                                        onChange={e=>setValor(proj.chave_rfc, m.key+'_obs', e.target.value)}
                                        rows={2}
                                        style={{width:"100%",marginTop:2,background:RTT.cinzaMedio,border:`1px solid ${obsObrig?RTT.amarelo:RTT.cinzaBorda}`,borderRadius:4,padding:"4px 6px",color:RTT.branco,fontSize:11,outline:"none",resize:"none",boxSizing:"border-box",fontFamily:F}}
                                        onFocus={e=>e.target.style.borderColor=RTT.vermelho}
                                        onBlur={e=>e.target.style.borderColor=obsObrig?RTT.amarelo:RTT.cinzaBorda}
                                      />
                                    </>
                                  )}
                                </div>
                                )
                              })()}
                            </div>
                          )
                        })}

                        {/* BOTÕES: REPLICAR + PAINEL ANUAL */}
                        <div style={{display:"flex",flexDirection:"column",gap:4,paddingTop:2}}>
                          {perfil.perfil==='gestor' && (
                            <button
                              onClick={()=>replicarRFC(proj)}
                              title="Replicar forecast da semana anterior"
                              style={{width:28,height:28,background:"transparent",border:`1px solid ${RTT.cinzaBorda}`,borderRadius:6,color:RTT.cinzaTexto,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F}}
                              onMouseEnter={e=>{e.currentTarget.style.borderColor=RTT.amarelo;e.currentTarget.style.color=RTT.amarelo}}
                              onMouseLeave={e=>{e.currentTarget.style.borderColor=RTT.cinzaBorda;e.currentTarget.style.color=RTT.cinzaTexto}}
                            >↺</button>
                          )}
                          <button
                            onClick={()=>setPainel(proj)}
                            style={{width:28,height:28,background:"transparent",border:`1px solid ${RTT.cinzaBorda}`,borderRadius:6,color:RTT.cinzaTexto,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F}}
                            onMouseEnter={e=>{e.currentTarget.style.borderColor=RTT.cinzaBorda2;e.currentTarget.style.color=RTT.branco}}
                            onMouseLeave={e=>{e.currentTarget.style.borderColor=RTT.cinzaBorda;e.currentTarget.style.color=RTT.cinzaTexto}}
                          >›</button>
                        </div>
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
                  {itensFiltrados.length} projetos · S{semana}/{anoAtual} · Prazo <strong style={{color:RTT.cinzaClaro,fontWeight:500}}>sexta {prazoDia}/{prazoMes} 12h</strong>
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

      {painel && <PainelAnual proj={painel} mesAtualIdx={mesAtualIdx} forecastAnual={forecastAnual} onClose={()=>setPainel(null)} perfil={perfil} semana={semana}/>}
    </div>
  )
}
