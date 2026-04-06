export default function Forecast({ perfil, onLogout }) {
  return (
    <div style={{background:'#0d0d0d',minHeight:'100vh',color:'white',padding:40,fontFamily:'Georgia,serif'}}>
      <h1 style={{color:'#E31E24'}}>Forecast RTT</h1>
      <p>Usuário: {perfil.nome}</p>
      <p>Perfil: {perfil.perfil}</p>
      <button onClick={onLogout} style={{background:'#E31E24',color:'white',border:'none',padding:'8px 16px',cursor:'pointer'}}>Sair</button>
    </div>
  )
}
