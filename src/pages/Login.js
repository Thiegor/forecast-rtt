import { useState } from 'react'
import { supabase } from '../lib/supabase'

const RTT = {
  vermelho: "#E31E24",
  vermelhoEscuro: "#B71C1F",
  preto: "#0d0d0d",
  cinzaEscuro: "#161616",
  cinzaMedio: "#1f1f1f",
  cinzaBorda: "#272727",
  cinzaBorda2: "#2e2e2e",
  cinzaTexto: "#5a5a5a",
  cinzaClaro: "#8a8a8a",
  branco: "#ffffff",
}

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetMsg, setResetMsg] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 12000)
      )
      await Promise.race([onLogin(email, senha), timeout])
    } catch(err) {
      setErro(err?.message === 'timeout'
        ? 'Servidor demorou demais. Verifique sua conexão e tente novamente.'
        : 'Email ou senha inválidos.')
    } finally {
      setLoading(false)
    }
  }

  async function handleReset(e) {
    e.preventDefault()
    if (!email) { setErro('Digite seu email para redefinir a senha.'); return }
    setResetLoading(true)
    setErro('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/forecast-rtt',
    })
    setResetLoading(false)
    if (error) {
      setErro('Erro ao enviar email. Verifique o endereço.')
    } else {
      setResetMsg(`Link enviado para ${email}. Verifique sua caixa de entrada.`)
    }
  }

  return (
    <div style={{minHeight:"100vh",background:RTT.preto,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Georgia,serif",padding:20}}>
      <div style={{width:"100%",maxWidth:380}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:60,height:60,borderRadius:14,background:RTT.vermelho,fontSize:26,fontWeight:900,color:"#fff",marginBottom:14}}>R</div>
          <div style={{fontSize:17,fontWeight:700,color:RTT.branco}}>RTT Soluções Industriais</div>
          <div style={{fontSize:11,color:RTT.cinzaTexto,marginTop:3}}>Forecast de Receita Semanal</div>
        </div>
        <div style={{background:RTT.cinzaEscuro,border:`1px solid ${RTT.cinzaBorda}`,borderRadius:10,padding:"28px 24px"}}>
          {resetMsg ? (
            <div style={{textAlign:"center"}}>
              <div style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.25)",color:"#6ee7b7",padding:"14px 12px",borderRadius:6,fontSize:12,marginBottom:16}}>{resetMsg}</div>
              <button onClick={()=>{setResetMode(false);setResetMsg('')}} style={{background:"transparent",border:`1px solid ${RTT.cinzaBorda}`,color:RTT.cinzaClaro,padding:"8px 16px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
                Voltar ao login
              </button>
            </div>
          ) : (
            <form onSubmit={resetMode ? handleReset : handleSubmit} style={{display:"flex",flexDirection:"column",gap:16}}>
              <div>
                <div style={{fontSize:9,color:RTT.cinzaClaro,marginBottom:5,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>Email corporativo</div>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu.nome@rttshop.com.br" required
                  style={{width:"100%",background:RTT.cinzaMedio,border:`1px solid ${RTT.cinzaBorda2}`,borderRadius:6,padding:"10px 12px",color:RTT.branco,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}
                />
              </div>
              {!resetMode && (
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                    <div style={{fontSize:9,color:RTT.cinzaClaro,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>Senha</div>
                    <button type="button" onClick={()=>{setResetMode(true);setErro('')}} style={{background:"none",border:"none",color:RTT.cinzaClaro,fontSize:10,cursor:"pointer",fontFamily:"inherit",padding:0,textDecoration:"underline"}}>
                      Esqueci minha senha
                    </button>
                  </div>
                  <input type="password" value={senha} onChange={e=>setSenha(e.target.value)} placeholder="••••••••" required
                    style={{width:"100%",background:RTT.cinzaMedio,border:`1px solid ${RTT.cinzaBorda2}`,borderRadius:6,padding:"10px 12px",color:RTT.branco,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}
                  />
                </div>
              )}
              {resetMode && (
                <div style={{fontSize:11,color:RTT.cinzaClaro,textAlign:"center",lineHeight:1.5}}>
                  Enviaremos um link de redefinição para o email informado.
                </div>
              )}
              {erro && <div style={{background:"rgba(227,30,36,0.1)",border:"1px solid rgba(227,30,36,0.3)",color:"#fca5a5",padding:"9px 12px",borderRadius:6,fontSize:12}}>{erro}</div>}
              <button type="submit" disabled={loading||resetLoading} style={{padding:"12px",background:RTT.vermelho,border:"none",borderRadius:6,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.05em",opacity:(loading||resetLoading)?0.7:1}}>
                {resetMode ? (resetLoading?"ENVIANDO...":"ENVIAR LINK") : (loading?"ENTRANDO...":"ENTRAR")}
              </button>
              {resetMode && (
                <button type="button" onClick={()=>{setResetMode(false);setErro('')}} style={{background:"transparent",border:"none",color:RTT.cinzaClaro,fontSize:11,cursor:"pointer",fontFamily:"inherit",padding:0,textDecoration:"underline"}}>
                  Voltar ao login
                </button>
              )}
            </form>
          )}
        </div>
        <div style={{textAlign:"center",marginTop:18,fontSize:10,color:RTT.cinzaTexto}}>Acesso restrito · REMA TIP TOP BRASIL</div>
      </div>
    </div>
  )
}
