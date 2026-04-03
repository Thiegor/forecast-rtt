import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Forecast from './pages/Forecast'

export default function App() {
  const { user, perfil, loading, login, logout } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0F6E56',
        fontFamily: 'Georgia, serif',
        color: '#fff',
        fontSize: '16px',
      }}>
        Carregando...
      </div>
    )
  }

  if (!user || !perfil) {
    return <Login onLogin={login} />
  }

  return <Forecast perfil={perfil} onLogout={logout} />
}
