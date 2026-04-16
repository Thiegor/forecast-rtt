import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Forecast from './pages/Forecast'

export default function App() {
  const [estado, setEstado] = useState('carregando')
  const [perfil, setPerfil] = useState(null)

  useEffect(() => {
    // Timeout de segurança: se getSession travar, redireciona para login em 8s
    const fallback = setTimeout(() => setEstado('login'), 8000)

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(fallback)
      if (session && session.user) {
        const { data } = await supabase
          .from('usuarios').select('*')
          .eq('email', session.user.email.toLowerCase())
          .maybeSingle()
        setPerfil(data)
        setEstado(data ? 'logado' : 'sem-perfil')
      } else {
        setEstado('login')
      }
    }).catch(() => { clearTimeout(fallback); setEstado('login') })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session && session.user) {
        const { data } = await supabase
          .from('usuarios').select('*')
          .eq('email', session.user.email.toLowerCase())
          .maybeSingle()
        setPerfil(data)
        setEstado(data ? 'logado' : 'sem-perfil')
      } else {
        setPerfil(null)
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
    return <Forecast perfil={perfil} onLogout={handleLogout} />
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

  return <Login onLogin={handleLogin} />
}
