import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Forecast from './pages/Forecast'

export default function App() {
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        carregarPerfil(session.user.email)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        carregarPerfil(session.user.email)
      } else {
        setPerfil(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function carregarPerfil(email) {
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle()
    setPerfil(data)
    setLoading(false)
  }

  async function login(email, senha) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) throw error
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0d0d0d',
        color: '#5a5a5a',
        fontFamily: 'Georgia, serif',
        fontSize: 14,
      }}>
        Carregando...
      </div>
    )
  }

  if (!perfil) {
    return <Login onLogin={login} />
  }

  return <Forecast perfil={perfil} onLogout={logout} />
}
