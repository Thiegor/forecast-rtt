import { useState } from 'react'
import { supabase } from '../lib/supabase'

const RTT = {
  vermelho: '#E31E24',
  preto: '#0d0d0d',
  cinzaEscuro: '#161616',
  cinzaMedio: '#1f1f1f',
  cinzaBorda: '#272727',
  cinzaBorda2: '#2e2e2e',
  cinzaTexto: '#5a5a5a',
  cinzaClaro: '#8a8a8a',
  branco: '#ffffff',
}

export default function RedefinirSenha({ onConcluido }) {
  const [senha, setSenha]           = useState('')
  const [confirma, setConfirma]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [erro, setErro]             = useState('')
  const [sucesso, setSucesso]       = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    if (senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
    if (senha !== confirma) { setErro('As senhas não coincidem.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setLoading(false)
    if (error) {
      setErro('Erro ao redefinir senha: ' + error.message)
    } else {
      setSucesso(true)
      setTimeout(() => onConcluido(), 2500)
    }
  }

  const inputStyle = {
    width: '100%', background: RTT.cinzaMedio,
    border: `1px solid ${RTT.cinzaBorda2}`, borderRadius: 6,
    padding: '10px 12px', color: RTT.branco, fontSize: 13,
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  }
  const labelStyle = {
    fontSize: 9, color: RTT.cinzaClaro, marginBottom: 5,
    fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
  }

  return (
    <div style={{ minHeight: '100vh', background: RTT.preto, display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia,serif', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 60, height: 60, borderRadius: 14, background: RTT.vermelho,
            fontSize: 26, fontWeight: 900, color: '#fff', marginBottom: 14 }}>R</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: RTT.branco }}>RTT Soluções Industriais</div>
          <div style={{ fontSize: 11, color: RTT.cinzaTexto, marginTop: 3 }}>Redefinição de senha</div>
        </div>

        <div style={{ background: RTT.cinzaEscuro, border: `1px solid ${RTT.cinzaBorda}`,
          borderRadius: 10, padding: '28px 24px' }}>

          {sucesso ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>✅</div>
              <div style={{ color: '#6ee7b7', fontSize: 13, marginBottom: 6 }}>Senha redefinida com sucesso!</div>
              <div style={{ color: RTT.cinzaTexto, fontSize: 11 }}>Redirecionando para o login...</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 12, color: RTT.cinzaClaro, textAlign: 'center', lineHeight: 1.5 }}>
                Defina sua nova senha de acesso ao sistema.
              </div>
              <div>
                <div style={labelStyle}>Nova senha</div>
                <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres" required style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>Confirmar senha</div>
                <input type="password" value={confirma} onChange={e => setConfirma(e.target.value)}
                  placeholder="Repita a nova senha" required style={inputStyle} />
              </div>
              {erro && (
                <div style={{ background: 'rgba(227,30,36,0.1)', border: '1px solid rgba(227,30,36,0.3)',
                  color: '#fca5a5', padding: '9px 12px', borderRadius: 6, fontSize: 12 }}>{erro}</div>
              )}
              <button type="submit" disabled={loading}
                style={{ padding: 12, background: RTT.vermelho, border: 'none', borderRadius: 6,
                  color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit', letterSpacing: '0.05em', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'SALVANDO...' : 'SALVAR NOVA SENHA'}
              </button>
            </form>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 10, color: RTT.cinzaTexto }}>
          Acesso restrito · REMA TIP TOP BRASIL
        </div>
      </div>
    </div>
  )
}
