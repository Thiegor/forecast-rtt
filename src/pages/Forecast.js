import { useState } from 'react'
import { useForecast } from '../hooks/useForecast'

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
  Backlog:   { bg:"rgba(227,30,36,0.1)", text:"#E31E24", border:"rgba(227,30,36,0.2)" },
  Renovação: { bg:"rgba(96,165,250,0.1)", text:"#60a5fa", border:"rgba(96,165,250,0.2)" },
  PIPE:      { bg:"rgba(240,165,0,0.1)", text:"#f0a500", border:"rgba(240,165,0,0.2)" },
  Spot:      { bg:"rgba(168,85,247,0.1)", text:"#c084fc", border:"rgba(168,85,247,0.2)" },
}

function fmt(val) {
  if (!val || val === 0) return "—"
  if (val >= 1000000) return `${(val/1000000).toFixed(1)}M`
  if (val >= 1000) return `${(val/1000).toFixed(0)}K`
  return val.toLocaleString("pt-BR")
}

function pct(a, b) {
  if (!b || b === 0) return null
  return ((a - b) / b) * 100
}

function Delta({ val, ref }) {
  const p = pct(val, ref)
  if (p === null || val === 0) return <span style={{color:RTT.cinzaTexto,fontSize:9}}>—</span>
  const cor = p > 5 ? RTT.verde : p < -5 ? RTT.vermelho : RTT.amarelo
  return <span style={{fontSize:9,fontWeight:700,color:cor}}>{p>0?"▲":"▼"}{Math.abs(p).toFixed(0)}%</span>
}

function PainelAnual({ proj, meses, onClose }) {
  const MESES_LONGOS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
  const MES_ATUAL = new Date().getMonth()
  const MESES_ROLANTES = [MES_ATUAL, MES_ATUAL+1, MES_ATUAL+2]
  const totalBP = (proj.bp_anual||[]).reduce((a,b)=>a+b,0)
  const totalRFC = (proj.rfc_anual||[]).reduce((a,b)=>a+b,0)

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
                <span style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:"rgba(0,0,0,0.2)",color:"#fff",fontWeight:600,border:"1px solid rgba(255,255,255,0.15)"}}>{proj.grupo}</span>
                <span style={{fontSize:10,color:"rgba(255,255,255,0.55)"}}>{proj.gerente_site}</span>
              </div>
            </div>
            <button onClick={onClose} style={{background:"rgba(0,0,0,0.25)",border:"none",color:"#fff",width:28,height:28,borderRadius:6,cursor:"pointer",fontSize:14,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[
              {l:"Total BP",v:`R$ ${fmt(totalBP)}`,c:"rgba(255,255,255,0.9)"},
              {l:"RFC Acum.",v:`R$ ${fmt(totalRFC)}`,c:"rgba(255,255,255,0.9)"},
              {l:"Δ RFC vs BP",v:pct(totalRFC,totalBP)!==null?`${pct(totalRFC,totalBP)>0?"+":""}${pct(totalRFC,totalBP).toFixed(0)}%`:"—",c:pct(totalRFC,totalBP)>=0?"#86efac":"#fca5a5"},
            ].map(k=>(
              <div key={k.l} style={{background:"rgba(0,0,0,0.2)",borderRadius:7,padding:"9px 11px"}}>
                <div style={{fontSize:8,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>{k.l}</div>
                <div style={{fontSize:14,fontWeight:800,color:k.c}}>{k.v}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"52px 1fr 1fr 44px",gap:0,padding:"10px 20px 7px",borderBottom:`1px solid ${RTT.cinzaBorda}`}}>
          {["","BP 2026","RFC s-1","Δ"].map((h,i)=>(
            <div key={i} style={{fontSize:8,color:RTT.cinzaTexto,textTransform:"uppercase",letterSpacing:"0.08em",textAlign:i>0?"center":"left",fontWeight:700}}>{h}</div>
          ))}
        </div>
        <div style={{flex:1,overflowY:"auto"}}>
          {MESES_LONGOS.map((mes,i)=>{
            const isAtual = MESES_ROLANTES.includes(i)
            const bp = proj.bp_anual?.[i] || 0
            const rfc = proj.rfc_anual?.[i] || 0
            return (
              <div key={mes} style={{display:"grid",gridTemplateColumns:"52px 1fr 1fr 44px",gap:0,padding:"8px 20px",background:isAtual?RTT.vermelhoFundo:"transparent",borderLeft:isAtual?`2px solid ${RTT.vermelho}`:"2px solid transparent"}}>
                <div style={{fontSize:11,fontWeight:isAtual?700:400,color:isAtual?RTT.vermelho:RTT.cinzaClaro}}>{mes.slice(0,3)}</div>
                <div style={{textAlign:"center",fontSize:12,fontWeight:600,color:RTT.amarelo}}>{fmt(bp)}</div>
                <div style={{textAlign:"center",fontSize:12,fontWeight:600,color:RTT.brancoSuave}}>{fmt(rfc)}</div>
                <div style={{textAlign:"center"}}><Delta val={rfc} ref={bp}/></div>
              </div>
            )
          })}
        </div>
        <div style={{borderTop:`1px solid ${RTT.cinzaBorda2}`,padding:"16px 20px"}}>
          <div style={{fontSize:9,color:RTT.cinzaTexto,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,fontWeight:700}}>
            Forecast — Semana {new Date().getWeek?.() || "atual"}
          </div>
          <div style={{textAlign:"center",color:RTT.cinzaClaro,fontSize:12}}>
            Use os campos na tabela principal para preencher o forecast.
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Forecast({ perfil, onLogout }) {
  const {
    projetos, forecastSemana, loading,
    mes1, mes2, mes3, ano1, ano2, ano3,
    semanaAtual, anoAtual,
    enviarForecast, getValorExistente, getConfiancaExistente,
  } = useForecast(perfil)

  const [valores, setValores] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState(null)
  const [painel, setPainel] = useState(null)
  const [filtro, setFiltro] = useState("Todos")

function setValor(chave, campo, val) {
    setValores(prev => ({ ...prev, [chave]: { ...prev[chave], [campo]: val } }))
  }

  function getVal(chave, campo) {
    const mes = campo === 'mes1' ? mes1 : campo === 'mes2' ? mes2 : mes3
    return valores[chave]?.[campo] ?? (getValorExistente(chave, mes) || '')
  }

  const projetosFiltrados = filtro === "Todos"
    ? projetos.filter(p => p.chave_rfc && p.chave_rfc.trim() !== '')
    : projetos.filter(p => p.gerente_site === filtro && p.chave_rfc && p.chave_rfc.trim() !== '')

  const gerentes = [...new Set(projetos.filter(p => p.chave_rfc).map(p => p.gerente_site))].sort()
  const gerentesVisiveis = filtro === "Todos" ? gerentes : [filtro]

  const totalBP = projetosFiltrados.reduce((s, p) => s + (p.bp_abr || 0), 0)
  const totalRFC = projetosFiltrados.reduce((s, p) => s + (p.rfc_abr || 0), 0)
  const deltaTotal = totalBP > 0 ? ((totalRFC - totalBP) / totalBP) * 100 : null

  const MESES = [
    { key: 'mes1', label: mes1, ano: ano1 },
    { key: 'mes2', label: mes2, ano: ano2 },
    { key: 'mes3', label: mes3, ano: ano3 },
  ]

  async function handleEnviar() {
    setEnviando(true)
    setErro(null)
    setSucesso(false)
    try {
      await enviarForecast(valores)
      setSucesso(true)
      setValores({})
      setTimeout(() => setSucesso(false), 4000)
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{minHeight:"100vh",background:RTT.preto,fontFamily:"Georgia,serif",color:RTT.branco}}>

      {/* Header */}
      <header style={{background:RTT.cinzaEscuro,borderBottom:`1px solid ${RTT.cinzaBorda}`,padding:"0 24px",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:1800,margin:"0 auto",height:56,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:20}}>
            <div style={{display:"flex",alignItems:"center",gap:10,paddingRight:20,borderRight:`1px solid ${RTT.cinzaBorda}`}}>
              <div style={{width:30,height:30,borderRadius:7,background:RTT.vermelho,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#fff"}}>R</div>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:RTT.branco}}>Forecast Semanal</div>
                <div style={{fontSize:9,color:RTT.cinzaTexto}}>Semana {semanaAtual} · {mes1.slice(0,3)} → {mes3.slice(0,3)} {anoAtual}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:18}}>
              {[
                {l:`BP ${mes1.slice(0,3)}`,v:`R$ ${fmt(totalBP)}`,c:RTT.amarelo},
                {l:"RFC s-1",v:`R$ ${fmt(totalRFC)}`,c:RTT.cinzaClaro},
                {l:"Δ vs BP",v:deltaTotal!==null?`${deltaTotal>0?"+":""}${deltaTotal.toFixed(0)}%`:"—",c:deltaTotal>=0?RTT.verde:RTT.vermelho},
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
              <div style={{fontSize:9,color:RTT.vermelho,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>{perfil.perfil === 'admin' ? 'Administrador' : 'Gerente de Site'}</div>
            </div>
            <div style={{width:30,height:30,borderRadius:"50%",background:RTT.vermelho,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff"}}>
              {perfil.nome.charAt(0)}
            </div>
            <button onClick={onLogout} style={{background:"transparent",border:`1px solid ${RTT.cinzaBorda}`,color:RTT.cinzaTexto,padding:"4px 10px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>Sair</button>
          </div>
        </div>
      </header>

      {sucesso && <div style={{background:"#052e16",borderBottom:"1px solid #14532d",color:"#22c55e",padding:"8px 24px",fontSize:11,textAlign:"center",fontWeight:700,letterSpacing:"0.03em"}}>✓ FORECAST SEMANA {semanaAtual} ENVIADO COM SUCESSO</div>}
      {erro && <div style={{background:"#2d0a0a",borderBottom:"1px solid #7f1d1d",color:"#fca5a5",padding:"8px 24px",fontSize:11,textAlign:"center"}}>✗ {erro}</div>}

      <main style={{maxWidth:1800,margin:"0 auto",padding:"18px 24px"}}>

        {/* Filtro gerentes (admin) */}
        {perfil.perfil === 'admin' && (
          <div style={{display:"flex",gap:5,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:9,color:RTT.cinzaTexto,textTransform:"uppercase",letterSpacing:"0.08em",marginRight:4,fontWeight:700}}>Gerente:</span>
            {["Todos",...gerentes].map(g=>(
              <button key={g} onClick={()=>setFiltro(g)} style={{
                padding:"4px 11px",borderRadius:4,fontSize:10,cursor:"pointer",fontFamily:"inherit",
                fontWeight:filtro===g?700:400,
                background:filtro===g?RTT.vermelho:"transparent",
                color:filtro===g?"#fff":RTT.cinzaClaro,
                border:filtro===g?`1px solid ${RTT.vermelho}`:`1px solid ${RTT.cinzaBorda}`,
                transition:"all 0.1s",letterSpacing:"0.02em",
              }}>{g==="Todos"?"Todos":g.split(" ")[0]}</button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{textAlign:"center",padding:"80px",color:RTT.cinzaTexto,fontSize:14}}>Carregando projetos...</div>
        ) : projetosFiltrados.length === 0 ? (
          <div style={{textAlign:"center",padding:"80px",color:RTT.cinzaTexto,fontSize:14}}>Nenhum projeto encontrado.</div>
        ) : (
          <>
            {/* Cabeçalho linha 1 — grupos de mês */}
            <div style={{display:"grid",gridTemplateColumns:"280px 1fr 1fr 1fr 36px",gap:4,padding:"0 12px",marginBottom:0}}>
              <div/>
              {MESES.map(m=>(
                <div key={m.key} style={{textAlign:"center",padding:"5px 0",borderRadius:"5px 5px 0 0",background:RTT.vermelhoFundo,borderTop:`2px solid ${RTT.vermelho}`,borderLeft:"1px solid rgba(227,30,36,0.15)",borderRight:"1px solid rgba(227,30,36,0.15)"}}>
                  <span style={{fontSize:10,fontWeight:700,color:RTT.vermelho,textTransform:"uppercase",letterSpacing:"0.08em"}}>{m.label.slice(0,3).toUpperCase()}/{m.ano}</span>
                </div>
              ))}
              <div/>
            </div>

            {/* Cabeçalho linha 2 — subcolunas */}
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

            {/* Linhas por gerente */}
            {gerentesVisiveis.map(gerente => {
              const projs = projetosFiltrados.filter(p => p.gerente_site === gerente)
              if (!projs.length) return null
              return (
                <div key={gerente} style={{marginBottom:16}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px 4px",borderTop:`1px solid ${RTT.cinzaBorda}`,marginTop:8}}>
                    <div style={{width:5,height:5,borderRadius:2,background:RTT.vermelho}}/>
                    <span style={{fontSize:9,fontWeight:700,color:RTT.vermelho,textTransform:"uppercase",letterSpacing:"0.08em"}}>{gerente}</span>
                    <span style={{fontSize:9,color:RTT.cinzaTexto}}>{projs.length} projeto{projs.length!==1?"s":""}</span>
                  </div>

                  {projs.map(proj => {
                    const gs = GRUPO_CORES[proj.grupo] || {bg:"rgba(100,100,100,0.1)",text:"#8a8a8a",border:"rgba(100,100,100,0.2)"}
                    return (
                      <div key={proj.chave_rfc} style={{
                        display:"grid",gridTemplateColumns:"280px 1fr 1fr 1fr 36px",
                        gap:4,alignItems:"center",
                        padding:"8px 12px",borderRadius:6,marginBottom:2,
                        background:RTT.cinzaEscuro,border:`1px solid ${RTT.cinzaBorda}`,
                        transition:"border-color 0.1s",
                      }}
                        onMouseEnter={e=>e.currentTarget.style.borderColor="#333"}
                        onMouseLeave={e=>e.currentTarget.style.borderColor=RTT.cinzaBorda}
                      >
                        <div style={{minWidth:0}}>
                          <div style={{fontSize:11,fontWeight:500,color:RTT.branco,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{proj.identificacao}</div>
                          <span style={{fontSize:9,padding:"1px 6px",borderRadius:3,fontWeight:600,background:gs.bg,color:gs.text,border:`1px solid ${gs.border}`,marginTop:3,display:"inline-block"}}>{proj.grupo||"—"}</span>
                        </div>

                        {MESES.map((m, idx) => {
                          const bp = proj[`bp_${m.label.slice(0,3).toLowerCase()}`] || 0
                          const rfc = getValorExistente(proj.chave_rfc, m.label) || 0
                          return (
                            <div key={m.key} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:3,padding:"4px 6px",background:"rgba(227,30,36,0.03)",borderLeft:"1px solid rgba(227,30,36,0.1)",borderRight:"1px solid rgba(227,30,36,0.1)",borderRadius:4}}>
                              <div style={{textAlign:"center"}}>
                                <div style={{fontSize:11,fontWeight:600,color:RTT.amarelo}}>{fmt(bp)}</div>
                              </div>
                              <div style={{textAlign:"center"}}>
                                <div style={{fontSize:11,fontWeight:600,color:RTT.brancoSuave}}>{fmt(rfc)}</div>
                                <Delta val={rfc} ref={bp}/>
                              </div>
                              <div>
                                <input
                                  type="number" placeholder="0"
                                  value={getVal(proj.chave_rfc, m.key)}
                                  onChange={e=>setValor(proj.chave_rfc, m.key, e.target.value)}
                                  style={{width:"100%",background:RTT.cinzaMedio,border:`1px solid ${RTT.cinzaBorda2}`,borderRadius:4,padding:"5px 5px",color:RTT.branco,fontSize:11,outline:"none",textAlign:"right",boxSizing:"border-box",fontFamily:"inherit"}}
                                  onFocus={e=>e.target.style.borderColor=RTT.vermelho}
                                  onBlur={e=>e.target.style.borderColor=RTT.cinzaBorda2}
                                />
                              </div>
                            </div>
                          )
                        })}

                        <button onClick={()=>setPainel(proj)} title="Visão anual" style={{
                          width:28,height:28,background:"transparent",
                          border:`1px solid ${RTT.cinzaBorda}`,borderRadius:5,
                          color:RTT.cinzaTexto,cursor:"pointer",fontSize:16,
                          display:"flex",alignItems:"center",justifyContent:"center",
                          transition:"all 0.1s",flexShrink:0,
                        }}
                          onMouseEnter={e=>{e.currentTarget.style.borderColor=RTT.vermelho;e.currentTarget.style.color=RTT.vermelho;}}
                          onMouseLeave={e=>{e.currentTarget.style.borderColor=RTT.cinzaBorda;e.currentTarget.style.color=RTT.cinzaTexto;}}
                        >›</button>
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* Rodapé */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",marginTop:8,background:RTT.cinzaEscuro,borderRadius:7,border:`1px solid ${RTT.cinzaBorda}`}}>
              <div style={{fontSize:10,color:RTT.cinzaTexto}}>
                {projetosFiltrados.length} projetos · Prazo: <strong style={{color:RTT.branco}}>sexta-feira às 12h</strong> · Semana {semanaAtual}/{anoAtual}
              </div>
              <button onClick={handleEnviar} disabled={enviando} style={{
                background:RTT.vermelho,color:"#fff",border:"none",
                padding:"9px 22px",borderRadius:6,fontSize:12,fontWeight:700,
                cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.05em",
                opacity:enviando?0.7:1,transition:"background 0.1s",
              }}
                onMouseEnter={e=>!enviando&&(e.currentTarget.style.background=RTT.vermelhoEscuro)}
                onMouseLeave={e=>e.currentTarget.style.background=RTT.vermelho}
              >{enviando?"ENVIANDO...":"ENVIAR FORECAST"}</button>
            </div>
          </>
        )}
      </main>

      {painel && <PainelAnual proj={painel} meses={MESES} onClose={()=>setPainel(null)}/>}
    </div>
  )
}
