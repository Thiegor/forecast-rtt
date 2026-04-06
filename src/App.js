import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Forecast from './pages/Forecast'

export default function App() {
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    setTimeout(() => setPronto(true), 100)
  }, [])

  if (!pronto) return <div style={{background:'#0d0d0d',minHeight:'100vh'}}/>

  const perfilTeste = { nome: 'Thiego Silva', perfil: 'admin', email: 'thiego.silva@rttshop.com.br' }
  return <Forecast perfil={perfilTeste} onLogout={()=>{}} />
}
