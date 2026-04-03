import { useState, useCallback } from 'react'
import { useForecast } from '../hooks/useForecast'

export default function Forecast({ perfil, onLogout }) {
  const {
    projetos, loading,
    mes1, mes2, mes3, ano1, ano2, ano3,
    semanaAtual, anoAtual,
    enviarForecast, getValorExistente, getConfiancaExistente,
  } = useForecast(perfil)

  const [valores, setValores] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(null)
  const [erro, setErro] = useState(null)
  const [expandido, setExpandido] = useState(null)

  const setValor = useCallback((chave_rfc, campo, val) => {
    setValores(prev => ({
      ...prev,
      [chave_rfc]: { ...prev[chave_rfc], [campo]: val }
    }))
  }, [])

  const getVal = (chave_rfc, campo) => {
    return valores[chave_rfc]?.[campo] ?? getValorExistente(chave_rfc, campo === 'mes1' ? mes1 : campo === 'mes2' ? mes2 : mes3) ?? ''
  }

  const getConf = (chave_rfc) => {
    return valores[chave_rfc]?.confianca ?? getConfiancaExistente(chave_rfc) ?? ''
  }

  async function handleEnviar() {
    setEnviando(true)
    setErro(null)
    setSucesso(null)
    try {
      const total = await enviarForecast(valores)
      setSucesso(`${total} registro${total !== 1 ? 's' : ''} enviado${total !== 1 ? 's' : ''} com sucesso.`)
      setValores({})
      setTimeout(() => setSucesso(null), 5000)
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
    }
  }

  // Agrupar por gerente de site (para admins)
  const gerentes = perfil.perfil === 'admin'
    ? [...new Set(projetos.map(p => p.gerente_site))].sort()
    : [perfil.nome]

  const meses = [mes1, mes2, mes3]
  const anos = [ano1, ano2, ano3]
  const campos = ['mes1', 'mes2', 'mes3']

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.headerLeft}>
            <div style={styles.logoMini}>R</div>
            <div>
              <div style={styles.headerTitle}>Forecast de Receita Semanal</div>
              <div style={styles.headerSub}>
                Semana {semanaAtual} · {capitalize(mes1)}/{anoAtual} → {capitalize(mes3)}/{ano3}
              </div>
            </div>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.userInfo}>
              <div style={styles.userName}>{perfil.nome}</div>
              <div style={styles.userPerfil}>{perfil.perfil === 'admin' ? 'Administrador' : 'Gerente de Site'}</div>
            </div>
            <button onClick={onLogout} style={styles.btnLogout}>Sair</button>
          </div>
        </div>
      </header>

      {/* Notificações */}
      {sucesso && (
        <div style={styles.notifSucesso}>
          ✓ {sucesso}
        </div>
      )}
      {erro && (
        <div style={styles.notifErro}>
          ✗ {erro}
        </div>
      )}

      {/* Conteúdo */}
      <main style={styles.main}>
        {loading ? (
          <div style={styles.loading}>Carregando projetos...</div>
        ) : projetos.length === 0 ? (
          <div style={styles.vazio}>Nenhum projeto encontrado para seu perfil.</div>
        ) : (
          <>
            {/* Cabeçalho da tabela */}
            <div style={styles.tableHeader}>
              <div style={{ ...styles.colProjeto, fontWeight: 600, color: '#555', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Projeto
              </div>
              {meses.map((mes, i) => (
                <div key={mes} style={{ ...styles.colMes, textAlign: 'center', fontWeight: 600, color: '#555', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {capitalize(mes)}/{anos[i]}
                </div>
              ))}
              <div style={{ ...styles.colConfianca, textAlign: 'center', fontWeight: 600, color: '#555', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Confiança
              </div>
            </div>

            {/* Linhas por gerente */}
            {gerentes.map(gerente => {
              const projetosGerente = projetos.filter(p => p.gerente_site === gerente)
              if (projetosGerente.length === 0) return null

              return (
                <div key={gerente} style={styles.gerenteSection}>
                  {perfil.perfil === 'admin' && (
                    <div style={styles.gerenteLabel}>{gerente}</div>
                  )}

                  {projetosGerente.map(proj => {
                    const jaEnviou = [mes1, mes2, mes3].some(m =>
                      getValorExistente(proj.chave_rfc, m) > 0
                    )

                    return (
                      <div key={proj.chave_rfc} style={{
                        ...styles.row,
                        ...(jaEnviou ? styles.rowEnviado : {})
                      }}>
                        {/* Nome do projeto */}
                        <div style={styles.colProjeto}>
                          <div style={styles.projetoNome}>
                            {proj.identificacao}
                          </div>
                          <div style={styles.projetoGrupo}>
                            <span style={{
                              ...styles.grupoBadge,
                              background: getGrupoColor(proj.grupo).bg,
                              color: getGrupoColor(proj.grupo).text,
                            }}>
                              {proj.grupo || '—'}
                            </span>
                            {jaEnviou && <span style={styles.enviado}>✓ enviado</span>}
                          </div>
                        </div>

                        {/* Inputs de valor */}
                        {campos.map((campo, i) => (
                          <div key={campo} style={styles.colMes}>
                            <input
                              type="number"
                              placeholder="R$ 0"
                              value={getVal(proj.chave_rfc, campo)}
                              onChange={e => setValor(proj.chave_rfc, campo, e.target.value)}
                              style={styles.inputValor}
                            />
                          </div>
                        ))}

                        {/* Confiança */}
                        <div style={styles.colConfianca}>
                          <select
                            value={getConf(proj.chave_rfc)}
                            onChange={e => setValor(proj.chave_rfc, 'confianca', e.target.value)}
                            style={styles.selectConfianca}
                          >
                            <option value="">—</option>
                            <option value="Alta">Alta</option>
                            <option value="Média">Média</option>
                            <option value="Baixa">Baixa</option>
                          </select>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* Rodapé com botão */}
            <div style={styles.footer}>
              <div style={styles.footerInfo}>
                {projetos.length} projeto{projetos.length !== 1 ? 's' : ''} · Prazo: sexta-feira às 12h
              </div>
              <button
                onClick={handleEnviar}
                disabled={enviando}
                style={styles.btnEnviar}
              >
                {enviando ? 'Enviando...' : 'Enviar Forecast'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''
}

function getGrupoColor(grupo) {
  const map = {
    'Backlog':  { bg: '#E1F5EE', text: '#085041' },
    'Renovação':{ bg: '#EFF6FF', text: '#1d4ed8' },
    'PIPE':     { bg: '#FEF3C7', text: '#92400e' },
    'Spot':     { bg: '#F3E8FF', text: '#6b21a8' },
  }
  return map[grupo] || { bg: '#F3F4F6', text: '#374151' }
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#F8F7F4',
    fontFamily: "'Georgia', serif",
  },
  header: {
    background: '#0F6E56',
    padding: '0 24px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
  },
  headerInner: {
    maxWidth: '1400px',
    margin: '0 auto',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  logoMini: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.2)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: 'bold',
    flexShrink: 0,
  },
  headerTitle: {
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    lineHeight: 1.2,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '12px',
    marginTop: '2px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  userInfo: { textAlign: 'right' },
  userName: { color: '#fff', fontSize: '14px', fontWeight: '500' },
  userPerfil: { color: 'rgba(255,255,255,0.6)', fontSize: '11px' },
  btnLogout: {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  notifSucesso: {
    background: '#D1FAE5',
    color: '#065F46',
    padding: '12px 24px',
    fontSize: '14px',
    textAlign: 'center',
    borderBottom: '1px solid #A7F3D0',
  },
  notifErro: {
    background: '#FEE2E2',
    color: '#991B1B',
    padding: '12px 24px',
    fontSize: '14px',
    textAlign: 'center',
    borderBottom: '1px solid #FECACA',
  },
  main: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '24px',
  },
  loading: {
    textAlign: 'center',
    color: '#666',
    padding: '60px',
    fontSize: '15px',
  },
  vazio: {
    textAlign: 'center',
    color: '#666',
    padding: '60px',
    fontSize: '15px',
  },
  tableHeader: {
    display: 'flex',
    gap: '8px',
    padding: '8px 16px',
    marginBottom: '4px',
  },
  gerenteSection: { marginBottom: '16px' },
  gerenteLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#0F6E56',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '12px 16px 6px',
    borderTop: '2px solid #0F6E56',
    marginTop: '16px',
  },
  row: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    background: '#fff',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '4px',
    border: '1px solid #E5E7EB',
    transition: 'box-shadow 0.15s',
  },
  rowEnviado: {
    borderLeft: '3px solid #0F6E56',
  },
  colProjeto: { flex: 3, minWidth: 0 },
  colMes: { flex: 1, minWidth: '100px' },
  colConfianca: { flex: 1, minWidth: '90px' },
  projetoNome: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#111',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  projetoGrupo: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '4px',
  },
  grupoBadge: {
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '10px',
    fontWeight: '500',
  },
  enviado: {
    fontSize: '11px',
    color: '#0F6E56',
    fontWeight: '500',
  },
  inputValor: {
    width: '100%',
    padding: '8px 10px',
    border: '1.5px solid #E5E7EB',
    borderRadius: '6px',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit',
    textAlign: 'right',
    boxSizing: 'border-box',
  },
  selectConfianca: {
    width: '100%',
    padding: '8px 10px',
    border: '1.5px solid #E5E7EB',
    borderRadius: '6px',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit',
    background: '#fff',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 16px',
    marginTop: '8px',
    background: '#fff',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
  },
  footerInfo: {
    fontSize: '13px',
    color: '#666',
  },
  btnEnviar: {
    background: '#0F6E56',
    color: '#fff',
    border: 'none',
    padding: '12px 28px',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
}
