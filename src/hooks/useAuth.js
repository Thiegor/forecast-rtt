import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
 
export function useAuth() {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)
 
  useEffect(() => {
    let mounted = true
 
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
 
      if (session?.user) {
        setUser(session.user)
        const { data } = await supabase
          .from('usuarios')
          .select('*')
          .eq('email', session.user.email.toLowerCase())
          .maybeSingle()
        if (mounted) setPerfil(data)
      }
      if (mounted) setLoading(false)
    }
 
    init()
 
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      if (session?.user) {
        setUser(session.user)
        const { data } = await supabase
          .from('usuarios')
          .select('*')
          .eq('email', session.user.email.toLowerCase())
          .maybeSingle()
        if (mounted) setPerfil(data)
      } else {
        setUser(null)
        setPerfil(null)
      }
      if (mounted) setLoading(false)
    })
 
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])
 
  async function login(email, senha) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) throw error
  }
 
  async function logout() {
    await supabase.auth.signOut()
  }
 
  return { user, perfil, loading, login, logout }
}
