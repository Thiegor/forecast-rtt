import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'

export default function App() {
  const [status, setStatus] = useState('Carregando...')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? 'Logado: ' + data.session.user.email : 'Não logado')
    }).catch(e => setStatus('Erro: ' + e.message))
  }, [])

  return (
    <div style={{background:'#0d0d0d', minHeight:'100vh', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20}}>
      {status}
    </div>
  )
}
