import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
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
          <div style={styles.logoIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M4.5 9a3.5 3.5 0 1 1 7 0A3.5 3.5 0 0 1 4.5 9zm12 0a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0zM1 19.5C1 16.46 3.46 14 6.5 14h11c3.04 0 5.5 2.46 5.5 5.5v.5H1v-.5z"/>
            </svg>
          </div>
          <div>
            <div style={styles.logoName}>PetVet</div>
            <div style={styles.logoSub}>Emporium Vazpet · Tatá Bichos</div>
          </div>
        </div>

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
