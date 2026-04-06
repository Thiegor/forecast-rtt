import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Forecast({ perfil, onLogout }) {
  const [projetos, setProjetos] = useState([])
  const [loading, setLoading] = useState(true)

  const semana = 15
  const anoAtual = 2026

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const { data: proj } = await supabase
        .from('projetos')
        .select('*')
        .eq('status','Vigente')
        .neq('chave_rfc','')
        .order('identificacao')
      setProjetos(proj || [])
      setLoading(false)
    }
    carregar()
  }, [])

  return (
    <div style={{background:'#0d0d0d',minHeight:'100vh',color:'white',padding:40,fontFamily:'Georgia,serif'}}>
      <h1 style={{color:'#E31E24'}}>Forecast RTT — {perfil.nome}</h1>
      <p>{loading ? 'Carregando...' : `${projetos.length} projetos carregados`}</p>
      <button onClick={onLogout} style={{background:'#E31E24',color:'white',border:'none',padding:'8px 16px',cursor:'pointer'}}>Sair</button>
    </div>
  )
}
