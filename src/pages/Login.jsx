import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useIdentidade } from '../context/IdentidadeContext'

export default function Login() {
  const { login } = useAuth()
  const { identidade } = useIdentidade()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('petvet-credentials')
      if (saved) {
        const { email: savedEmail, password: savedPassword } = JSON.parse(saved)
        setEmail(savedEmail)
        setPassword(savedPassword)
        setRememberMe(true)
      }
    } catch {}
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (rememberMe) {
      localStorage.setItem('petvet-credentials', JSON.stringify({ email, password }))
    } else {
      localStorage.removeItem('petvet-credentials')
    }
    const ok = login(email, password)
    if (!ok) setError('E-mail ou senha inválidos.')
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card} className="card">
        <div style={styles.logo}>
          {/* Logos agrupados com mesmo tamanho (64×64) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {identidade.logoP ? (
              <img src={identidade.logoP} alt="logo" style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 10, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 12, background: `${identidade.corPrimaria}22`, border: `2px solid ${identidade.corPrimaria}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: identidade.corPrimaria, fontSize: 26, fontWeight: 700 }}>
                {(identidade.nomeP.replace(/^\W+/, '') || 'E')[0].toUpperCase()}
              </div>
            )}
            {identidade.logoS ? (
              <img src={identidade.logoS} alt="logo2" style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 10, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 12, background: `${identidade.corDestaque}22`, border: `2px solid ${identidade.corDestaque}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: identidade.corDestaque, fontSize: 26, fontWeight: 700 }}>
                {(identidade.nomeS.replace(/^\W+/, '') || 'T')[0].toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <div style={styles.logoName}>{identidade.nomeP}</div>
            <div style={styles.logoSub}>{identidade.nomeS}</div>
          </div>
        </div>
        {identidade.slogan && (
          <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: -8 }}>{identidade.slogan}</p>
        )}

        <h2 style={styles.title}>Entrar no sistema</h2>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                style={{ accentColor: 'var(--teal)', width: 16, height: 16 }}
              />
              Lembrar de mim
            </label>
            {rememberMe && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Credenciais salvas
              </span>
            )}
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" className="btn btn-primary btn-full btn-lg">
            Entrar
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
          Acesso inicial: use seu e-mail e senha <strong>123456</strong>
        </p>
      </div>
    </div>
  )
}

const styles = {
  wrapper: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg)' },
  card: { width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '24px' },
  logo: { display: 'flex', alignItems: 'center', gap: '12px' },
  logoIcon: { width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #27B5AC 0%, #DE098D 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  logoName: { fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', fontFamily: "'Playfair Display', serif" },
  logoSub: { fontSize: '0.75rem', color: 'var(--text-muted)' },
  title: { fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-primary)', fontFamily: "'Playfair Display', serif" },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-secondary)', userSelect: 'none' },
  error: { color: 'var(--danger)', fontSize: '0.875rem', fontWeight: '500' },
}
