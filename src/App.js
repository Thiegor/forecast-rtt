import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Forecast from './pages/Forecast'
import PainelReceita from './pages/PainelReceita'
import RedefinirSenha from './pages/RedefinirSenha'

const CACHE_KEY = 'rtt_perfil_cache'

function lerCache(email) {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw)
    if (cached?.email?.toLowerCase() === email.toLowerCase()) return cached
  } catch {}
  return null
}

function salvarCache(perfil) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(perfil)) } catch {}
}

function limparCache() {
  try { localStorage.removeItem(CACHE_KEY) } catch {}
}

export default function App() {
  const [estado, setEstado] = useState('carregando')
  const [perfil, setPerfil] = useState(null)
  const [pagina, setPagina] = useState('forecast')

  useEffect(() => {
    // Busca perfil com timeout generoso para cold starts do Supabase free tier
    async function buscarPerfil(email) {
      const t = new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 20000))
      const q = supabase.from('usuarios').select('*').eq('email', email.toLowerCase()).maybeSingle()
      const { data } = await Promise.race([q, t])
      return data
    }

    // Timeout geral de segurança
    const fallback = setTimeout(() => setEstado('login'), 30000)

    async function init() {
      try {
        const { data: { session } } = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 12000))
        ])

        if (session?.user) {
          // Usa cache para mostrar o app imediatamente enquanto busca dados frescos
          const cached = lerCache(session.user.email)
          if (cached) {
            setPerfil(cached)
            setEstado('logado')
            clearTimeout(fallback)
            // Atualiza perfil em background sem derrubar o usuário
            buscarPerfil(session.user.email).then(fresh => {
              if (fresh) { setPerfil(fresh); salvarCache(fresh) }
            }).catch(() => {})
            return
          }

          // Sem cache: busca normalmente (primeira vez ou cache limpo)
          const data = await buscarPerfil(session.user.email)
          if (data) salvarCache(data)
          setPerfil(data)
          setEstado(data ? 'logado' : 'sem-perfil')
        } else {
          setEstado('login')
        }
      } catch {
        setEstado('login')
      } finally {
        clearTimeout(fallback)
      }
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session?.user) {
        limparCache()
        setPerfil(null)
        setEstado('login')
        return
      }
      // Usuário clicou no link de "Esqueci minha senha": mostrar tela de redefinição
      if (event === 'PASSWORD_RECOVERY') { setEstado('recovery'); return }

      // TOKEN_REFRESHED / USER_UPDATED: sessão ainda válida, não re-busca
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return

      // SIGNED_IN / INITIAL_SESSION: usa cache se disponível
      const cached = lerCache(session.user.email)
      if (cached) {
        setPerfil(cached)
        setEstado('logado')
        buscarPerfil(session.user.email).then(fresh => {
          if (fresh) { setPerfil(fresh); salvarCache(fresh) }
        }).catch(() => {})
        return
      }

      try {
        const data = await buscarPerfil(session.user.email)
        if (data) salvarCache(data)
        setPerfil(data)
        setEstado(data ? 'logado' : 'sem-perfil')
      } catch {
        setEstado('login')
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line

  async function handleLogin(email, senha) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) throw error
  }

  async function handleLogout() {
    limparCache()
    await supabase.auth.signOut()
  }

  if (estado === 'carregando') {
    return (
      <div style={{minHeight:'100vh',background:'#0d0d0d',display:'flex',alignItems:'center',justifyContent:'center',color:'#5a5a5a',fontFamily:'Georgia,serif',fontSize:14}}>
        Carregando...
      </div>
    )
  }

  if (estado === 'logado' && perfil) {
    if (pagina === 'painel' && ['admin', 'gestor', 'regional'].includes(perfil.perfil)) {
      return <PainelReceita perfil={perfil} onLogout={handleLogout} onNavigate={setPagina} />
    }
    return <Forecast perfil={perfil} onLogout={handleLogout} onNavigate={setPagina} />
  }

  if (estado === 'sem-perfil') {
    return (
      <div style={{minHeight:'100vh',background:'#0d0d0d',display:'flex',alignItems:'center',justifyContent:'center',color:'#fca5a5',fontFamily:'Georgia,serif',fontSize:13,textAlign:'center',padding:20}}>
        <div>
          <div style={{marginBottom:12}}>Usuário não cadastrado no sistema.</div>
          <div style={{fontSize:11,color:'#5a5a5a',marginBottom:20}}>Contate o Planejamento e Controle.</div>
          <button onClick={handleLogout} style={{background:'transparent',border:'1px solid #272727',color:'#8a8a8a',padding:'8px 16px',borderRadius:6,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
            Sair
          </button>
        </div>
      </div>
    )
  }

  if (estado === 'recovery') {
    return <RedefinirSenha onConcluido={() => { limparCache(); supabase.auth.signOut(); setEstado('login') }} />
  }

  return <Login onLogin={handleLogin} />
}
