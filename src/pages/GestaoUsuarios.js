import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const RTT = {
  vermelho:'#E31E24', preto:'#09090b', cinzaEscuro:'#111113',
  cinzaMedio:'#1c1c1f', cinzaBorda:'#27272a', cinzaBorda2:'#3f3f46',
  cinzaTexto:'#52525b', cinzaClaro:'#a1a1aa', branco:'#fafafa',
  brancoSuave:'#d4d4d8', amarelo:'#f59e0b', verde:'#10b981',
}
const F = `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

const PERFIS = ['gestor', 'admin']

const PERFIL_COR = {
  admin:  { bg:'rgba(227,30,36,0.12)',  text:'#E31E24',  borda:'rgba(227,30,36,0.25)' },
  gestor: { bg:'rgba(161,161,170,0.10)', text:'#a1a1aa', borda:'rgba(161,161,170,0.2)' },
}

function Badge({ perfil }) {
  const c = PERFIL_COR[perfil] || PERFIL_COR.gestor
  return (
    <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.06em',
      background:c.bg, color:c.text, border:`1px solid ${c.borda}`,
      borderRadius:4, padding:'2px 7px', textTransform:'uppercase' }}>
      {perfil}
    </span>
  )
}

export default function GestaoUsuarios({ onClose }) {
  const [usuarios,   setUsuarios]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [editando,   setEditando]   = useState({})   // id -> { perfil, ativo }
  const [salvando,   setSalvando]   = useState(null)
  const [novo,       setNovo]       = useState({ nome:'', email:'', perfil:'gestor' })
  const [adicionando, setAdicionando] = useState(false)
  const [erro,       setErro]       = useState(null)
  const [busca,      setBusca]      = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase
      .from('usuarios')
      .select('id,nome,email,perfil,ativo,recebe_lembrete,created_at')
      .order('nome')
    setUsuarios(data || [])
    setLoading(false)
  }

  function iniciarEdicao(u) {
    setEditando(prev => ({
      ...prev,
      [u.id]: { perfil: u.perfil, ativo: u.ativo }
    }))
  }

  function cancelarEdicao(id) {
    setEditando(prev => { const n = {...prev}; delete n[id]; return n })
  }

  async function salvarEdicao(u) {
    const ed = editando[u.id]
    if (!ed) return
    setSalvando(u.id)
    setErro(null)
    const { error } = await supabase
      .from('usuarios')
      .update({ perfil: ed.perfil, ativo: ed.ativo })
      .eq('id', u.id)
    setSalvando(null)
    if (error) { setErro('Erro ao salvar: ' + error.message); return }
    cancelarEdicao(u.id)
    carregar()
  }

  async function handleAdicionar() {
    setErro(null)
    if (!novo.nome.trim() || !novo.email.trim()) {
      setErro('Nome e e-mail são obrigatórios.')
      return
    }
    const emailLimpo = novo.email.trim().toLowerCase()
    // Verifica duplicata
    const { data: exist } = await supabase
      .from('usuarios').select('id').eq('email', emailLimpo).maybeSingle()
    if (exist) { setErro('E-mail já cadastrado.'); return }

    setSalvando('novo')
    const { error } = await supabase.from('usuarios').insert({
      nome: novo.nome.trim(),
      email: emailLimpo,
      perfil: novo.perfil,
      ativo: true,
      recebe_lembrete: true,
    })
    setSalvando(null)
    if (error) { setErro('Erro ao inserir: ' + error.message); return }
    setNovo({ nome:'', email:'', perfil:'gestor' })
    setAdicionando(false)
    carregar()
  }

  const lista = usuarios.filter(u =>
    !busca.trim() ||
    u.nome.toLowerCase().includes(busca.toLowerCase()) ||
    u.email.toLowerCase().includes(busca.toLowerCase())
  )

  const tdStyle = {
    padding:'10px 14px', fontSize:12, color:RTT.cinzaClaro,
    borderBottom:`1px solid ${RTT.cinzaBorda}`, verticalAlign:'middle',
  }
  const inputStyle = {
    background:RTT.cinzaMedio, border:`1px solid ${RTT.cinzaBorda2}`,
    borderRadius:5, color:RTT.branco, fontSize:12, padding:'5px 9px',
    outline:'none', fontFamily:F,
  }
  const btnPrimary = {
    background:RTT.vermelho, border:'none', color:RTT.branco,
    borderRadius:6, padding:'6px 14px', fontSize:12, cursor:'pointer',
    fontFamily:F, fontWeight:600,
  }
  const btnSecondary = {
    background:'transparent', border:`1px solid ${RTT.cinzaBorda}`,
    color:RTT.cinzaClaro, borderRadius:6, padding:'6px 14px',
    fontSize:12, cursor:'pointer', fontFamily:F,
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:100,
      background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <div style={{ background:RTT.cinzaEscuro, border:`1px solid ${RTT.cinzaBorda}`,
        borderRadius:10, width:'min(760px,96vw)', maxHeight:'88vh',
        display:'flex', flexDirection:'column', fontFamily:F, overflow:'hidden' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:`1px solid ${RTT.cinzaBorda}`, flexShrink:0 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:RTT.branco }}>Gestão de Usuários</div>
            <div style={{ fontSize:11, color:RTT.cinzaTexto, marginTop:2 }}>
              {usuarios.length} cadastrados · {usuarios.filter(u=>u.ativo).length} ativos
            </div>
          </div>
          <button onClick={onClose}
            style={{ background:'transparent', border:'none', color:RTT.cinzaClaro,
              fontSize:18, cursor:'pointer', lineHeight:1, padding:4 }}>✕</button>
        </div>

        {/* Busca + botão novo */}
        <div style={{ display:'flex', gap:10, padding:'12px 20px',
          borderBottom:`1px solid ${RTT.cinzaBorda}`, flexShrink:0 }}>
          <input
            value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            style={{ ...inputStyle, flex:1 }}
          />
          <button onClick={() => { setAdicionando(true); setErro(null) }}
            style={{ ...btnPrimary, whiteSpace:'nowrap' }}>
            + Novo usuário
          </button>
        </div>

        {/* Formulário novo usuário */}
        {adicionando && (
          <div style={{ padding:'14px 20px', borderBottom:`1px solid ${RTT.cinzaBorda}`,
            background:RTT.cinzaMedio, flexShrink:0 }}>
            <div style={{ fontSize:11, fontWeight:700, color:RTT.cinzaClaro,
              letterSpacing:'0.06em', marginBottom:10 }}>NOVO USUÁRIO</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              <input
                placeholder="Nome completo"
                value={novo.nome} onChange={e => setNovo(p => ({...p, nome:e.target.value}))}
                style={{ ...inputStyle, minWidth:180, flex:2 }}
              />
              <input
                placeholder="E-mail"
                value={novo.email} onChange={e => setNovo(p => ({...p, email:e.target.value}))}
                style={{ ...inputStyle, minWidth:200, flex:3 }}
              />
              <select
                value={novo.perfil} onChange={e => setNovo(p => ({...p, perfil:e.target.value}))}
                style={{ ...inputStyle, cursor:'pointer' }}>
                {PERFIS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <button onClick={handleAdicionar} disabled={salvando==='novo'}
                style={{ ...btnPrimary, opacity: salvando==='novo' ? 0.6 : 1 }}>
                {salvando==='novo' ? 'Salvando...' : 'Adicionar'}
              </button>
              <button onClick={() => { setAdicionando(false); setErro(null) }}
                style={btnSecondary}>Cancelar</button>
            </div>
            {erro && (
              <div style={{ marginTop:8, fontSize:11, color:'#f87171' }}>{erro}</div>
            )}
            <div style={{ marginTop:8, fontSize:10, color:RTT.cinzaTexto }}>
              ⚠ O usuário precisará criar a senha via "Esqueci minha senha" na tela de login.
            </div>
          </div>
        )}

        {/* Tabela */}
        <div style={{ overflow:'auto', flex:1 }}>
          {loading ? (
            <div style={{ padding:40, textAlign:'center', color:RTT.cinzaTexto, fontSize:13 }}>
              Carregando...
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ position:'sticky', top:0, zIndex:2 }}>
                  {['Nome','E-mail','Perfil','Ativo','Ações'].map(h => (
                    <th key={h} style={{ padding:'8px 14px', fontSize:10, fontWeight:700,
                      color:RTT.cinzaTexto, textAlign:'left', letterSpacing:'0.06em',
                      background:RTT.cinzaMedio, borderBottom:`2px solid ${RTT.cinzaBorda2}`,
                      whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map(u => {
                  const ed = editando[u.id]
                  const emEdicao = !!ed
                  const isSaving = salvando === u.id

                  return (
                    <tr key={u.id}
                      style={{ background: !u.ativo ? 'rgba(0,0,0,0.2)' : 'transparent',
                        opacity: !u.ativo ? 0.6 : 1 }}>

                      {/* Nome */}
                      <td style={{ ...tdStyle, color:RTT.branco, fontWeight:500 }}>
                        {u.nome}
                      </td>

                      {/* Email */}
                      <td style={{ ...tdStyle, fontSize:11 }}>{u.email}</td>

                      {/* Perfil */}
                      <td style={tdStyle}>
                        {emEdicao ? (
                          <select
                            value={ed.perfil}
                            onChange={e => setEditando(prev => ({
                              ...prev, [u.id]: { ...prev[u.id], perfil:e.target.value }
                            }))}
                            style={{ ...inputStyle, fontSize:11, padding:'3px 7px' }}>
                            {PERFIS.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        ) : (
                          <Badge perfil={u.perfil} />
                        )}
                      </td>

                      {/* Ativo */}
                      <td style={tdStyle}>
                        {emEdicao ? (
                          <button
                            onClick={() => setEditando(prev => ({
                              ...prev, [u.id]: { ...prev[u.id], ativo: !prev[u.id].ativo }
                            }))}
                            style={{ background: ed.ativo ? 'rgba(16,185,129,0.15)' : 'rgba(248,113,113,0.1)',
                              border:`1px solid ${ed.ativo ? '#10b981' : '#f87171'}`,
                              color: ed.ativo ? '#10b981' : '#f87171',
                              borderRadius:5, padding:'3px 10px', fontSize:11,
                              cursor:'pointer', fontFamily:F }}>
                            {ed.ativo ? 'Ativo' : 'Inativo'}
                          </button>
                        ) : (
                          <span style={{ fontSize:11, color: u.ativo ? RTT.verde : '#f87171' }}>
                            {u.ativo ? '● Ativo' : '○ Inativo'}
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td style={{ ...tdStyle, whiteSpace:'nowrap' }}>
                        {emEdicao ? (
                          <div style={{ display:'flex', gap:6 }}>
                            <button onClick={() => salvarEdicao(u)} disabled={isSaving}
                              style={{ ...btnPrimary, padding:'4px 12px', fontSize:11,
                                opacity: isSaving ? 0.6 : 1 }}>
                              {isSaving ? '...' : 'Salvar'}
                            </button>
                            <button onClick={() => cancelarEdicao(u.id)}
                              style={{ ...btnSecondary, padding:'4px 10px', fontSize:11 }}>
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => iniciarEdicao(u)}
                            style={{ ...btnSecondary, padding:'4px 10px', fontSize:11 }}>
                            Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {erro && !adicionando && (
          <div style={{ padding:'8px 20px', fontSize:11, color:'#f87171',
            borderTop:`1px solid ${RTT.cinzaBorda}`, flexShrink:0 }}>
            {erro}
          </div>
        )}
      </div>
    </div>
  )
}
