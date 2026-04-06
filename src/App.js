import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Forecast from './pages/Forecast'

export default function App() {
  const [estado, setEstado] = useState('carregando')
  const [perfil, setPerfil] = useState(null)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session && session.user) {
        const { data } = await supabase
          .from('usuarios')
          .select('*')
          .eq('email', session.user.email.toLowerCase())
          .maybeSingle()
        setPerfil(data)
        setEstado(data ? 'logado' : 'sem-perfil')
      } else {
        setEstado('login')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session && session.user) {
        const { data } = await supabase
          .from('usuarios')
          .select('*')
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

  async function handleLogin(e) {
    e.preventDefault()
    setErro('')
    setLoginLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) throw error
    } catch (err) {
      setErro('Email ou senha inválidos.')
      setLoginLoading(false)
    }
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

  return (
    <div style={{minHeight:'100vh',background:'#0d0d0d',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Georgia,serif',padding:20}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div style={{textAlign:'center',marginBottom:36}}>
          <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:60,height:60,borderRadius:14,background:'#E31E24',fontSize:26,fontWeight:900,color:'#fff',marginBottom:14}}>R</div>
          <div style={{fontSize:17,fontWeight:700,color:'#fff'}}>RTT Soluções Industriais</div>
          <div style={{fontSize:11,color:'#5a5a5a',marginTop:3}}>Forecast de Receita Semanal</div>
        </div>
        <div style={{background:'#161616',border:'1px solid #272727',borderRadius:10,padding:'28px 24px'}}>
          <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:16}}>
            <div>
              <div style={{fontSize:9,color:'#8a8a8a',marginBottom:5,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase'}}>Email corporativo</div>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu.nome@rttshop.com.br" required
                style={{width:'100%',background:'#1f1f1f',border:'1px solid #2e2e2e',borderRadius:6,padding:'10px 12px',color:'#fff',fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}
              />
            </div>
            <div>
              <div style={{fontSize:9,color:'#8a8a8a',marginBottom:5,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase'}}>Senha</div>
              <input type="password" value={senha} onChange={e=>setSenha(e.target.value)} placeholder="••••••••" required
                style={{width:'100%',background:'#1f1f1f',border:'1px solid #2e2e2e',borderRadius:6,padding:'10px 12px',color:'#fff',fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}
              />
            </div>
            {erro && <div style={{background:'rgba(227,30,36,0.1)',border:'1px solid rgba(227,30,36,0.3)',color:'#fca5a5',padding:'9px 12px',borderRadius:6,fontSize:12}}>{erro}</div>}
            {estado === 'sem-perfil' && <div style={{background:'rgba(227,30,36,0.1)',border:'1px solid rgba(227,30,36,0.3)',color:'#fca5a5',padding:'9px 12px',borderRadius:6,fontSize:12}}>Usuário não cadastrado. Contate o Planejamento e Controle.</div>}
            <button type="submit" disabled={loginLoading} style={{padding:'12px',background:'#E31E24',border:'none',borderRadius:6,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',letterSpacing:'0.05em',opacity:loginLoading?0.7:1}}>
              {loginLoading?'ENTRANDO...':'ENTRAR'}
            </button>
          </form>
        </div>
        <div style={{textAlign:'center',marginTop:18,fontSize:10,color:'#5a5a5a'}}>Acesso restrito · REMA TIP TOP AG</div>
      </div>
    </div>
  )
}
