import { useState, useEffect } from 'react'
import { Calendar, ClipboardList, BookOpen, CreditCard, BarChart2, Smartphone, Sun, Moon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useIdentidade } from '../context/IdentidadeContext'
import { useTheme } from '../context/ThemeContext'
import SSLogo from '../components/SSLogo'

// ── helpers ──────────────────────────────────────────────────────────────────

function loadSsCfg() {
  try { return JSON.parse(localStorage.getItem('petvet-ss-config') ?? '{}') }
  catch { return {} }
}
function loadNovidades() {
  try { return JSON.parse(localStorage.getItem('petvet-login-novidades') ?? '[]') }
  catch { return [] }
}
function hexToRgba(hex, alpha) {
  let h = (hex || '#000').replace('#', '')
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2]
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ── Logo SS elaborada para o painel esquerdo ──────────────────────────────────
function LoginSSMark({ size = 80, logo }) {
  if (logo) {
    return (
      <img src={logo} alt="SS"
        style={{ width: size, height: size, objectFit: 'contain', borderRadius: size * 0.15, flexShrink: 0 }} />
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="lssGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#27B5AC"/>
          <stop offset="100%" stopColor="#1a3a6b"/>
        </linearGradient>
        <linearGradient id="lssGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#D4AF37"/>
          <stop offset="100%" stopColor="#B8960C"/>
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r="39" fill="url(#lssGold)" opacity="0.3"/>
      <circle cx="40" cy="40" r="36" fill="url(#lssGrad)"/>
      <circle cx="40" cy="40" r="38" fill="none" stroke="#D4AF37" strokeWidth="1" opacity="0.6"/>
      <text x="12" y="52" fontFamily="Georgia, serif" fontSize="38" fontWeight="bold" fill="white" opacity="0.95">SS</text>
      <line x1="12" y1="58" x2="68" y2="58" stroke="#D4AF37" strokeWidth="1" opacity="0.5"/>
    </svg>
  )
}

// ── Features list ─────────────────────────────────────────────────────────────
const SS_FEATURES = [
  { Icon: ClipboardList, label: 'Prontuário Veterinário Completo' },
  { Icon: Calendar,      label: 'Agenda Integrada'               },
  { Icon: BookOpen,      label: 'Bulário com 265+ medicamentos'  },
  { Icon: CreditCard,    label: 'Financeiro e PDV'               },
  { Icon: BarChart2,     label: 'Relatórios e CRM'               },
  { Icon: Smartphone,    label: 'Acesso mobile e tablet'         },
]

// ── Componente principal ──────────────────────────────────────────────────────
export default function Login() {
  const { login }      = useAuth()
  const { identidade } = useIdentidade()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError]           = useState('')
  const [ssCfg, setSsCfg]           = useState(loadSsCfg)
  const [novidades, setNovidades]   = useState(loadNovidades)

  useEffect(() => {
    function refresh() { setSsCfg(loadSsCfg()); setNovidades(loadNovidades()) }
    window.addEventListener('petvet-ss-updated', refresh)
    window.addEventListener('petvet-novidades-updated', refresh)
    return () => {
      window.removeEventListener('petvet-ss-updated', refresh)
      window.removeEventListener('petvet-novidades-updated', refresh)
    }
  }, [])

  useEffect(() => {
    try {
      if (localStorage.getItem('petvet-credentials')) localStorage.removeItem('petvet-credentials')
      const active     = localStorage.getItem('petvet-remember-active')
      const savedEmail = localStorage.getItem('petvet-remember-email')
      const savedSenha = localStorage.getItem('petvet-remember-senha')
      if (active === 'true' && savedEmail) {
        setEmail(savedEmail); setPassword(savedSenha || ''); setRememberMe(true)
      }
    } catch {}
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (rememberMe) {
      localStorage.setItem('petvet-remember-email',  email)
      localStorage.setItem('petvet-remember-senha',  password)
      localStorage.setItem('petvet-remember-active', 'true')
    } else {
      localStorage.removeItem('petvet-remember-email')
      localStorage.removeItem('petvet-remember-senha')
      localStorage.removeItem('petvet-remember-active')
    }
    const ok = await login(email, password)
    if (!ok) setError('E-mail ou senha inválidos.')
  }

  const cor1 = identidade.corPrimaria || '#27B5AC'
  const cor2 = identidade.corDestaque || '#DE098D'
  const ssNome = ssCfg.nome || 'Salgueiro Systems'

  const temLogoP = identidade?.logoP && identidade.logoP.length > 10
  const temLogoS = identidade?.logoS && identidade.logoS.length > 10

  // Fundo suave do painel direito com cores do cliente (usa #fff fixo para não depender de var CSS)
  const rightBg = isDark
    ? 'var(--bg)'
    : `linear-gradient(135deg, ${hexToRgba(cor1, 0.12)} 0%, #ffffff 35%, ${hexToRgba(cor2, 0.08)} 100%)`

  return (
    <>
      {/* ── Toggle tema: fixo canto superior direito ── */}
      <button
        onClick={toggleTheme}
        title={isDark ? 'Modo claro' : 'Modo escuro'}
        style={{
          position: 'fixed', top: 16, right: 16, zIndex: 300,
          width: 40, height: 40, borderRadius: '50%',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isDark ? '#D4AF37' : '#1a3a6b',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          transition: 'background 0.2s',
        }}
      >
        {isDark
          ? <Sun  size={18} color="#0a0a0a" />
          : <Moon size={18} color="#ffffff" />
        }
      </button>

      <div className="login-shell">

        {/* ══ PAINEL ESQUERDO — Salgueiro Systems ══ */}
        <div className={`login-left${isDark ? ' login-left-dark' : ''}`}>
          <div className="login-left-inner">

            {/* Logo SS elaborada */}
            <div style={{ marginBottom: 16 }}>
              <LoginSSMark size={80} logo={ssCfg.logo || null} />
            </div>
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: '0 0 2px', lineHeight: 1.2 }}>
                {ssNome}
              </p>
              <p style={{ fontSize: '0.75rem', color: isDark ? '#D4AF37' : 'rgba(255,255,255,0.6)', margin: 0 }}>
                Technology &amp; Innovation
              </p>
            </div>

            {/* Título PetVet */}
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.25rem', fontWeight: 800, color: '#fff', margin: '0 0 6px', lineHeight: 1.15 }}>
              PetVet
            </h1>
            <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.7)', margin: '0 0 28px' }}>
              Sistema de gestão veterinária
            </p>

            {/* Features */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, width: '100%', maxWidth: 380, marginBottom: 28 }}>
              {SS_FEATURES.map(({ Icon, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: isDark ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={15} color={isDark ? '#D4AF37' : 'rgba(255,255,255,0.9)'} />
                  </div>
                  <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.88)', fontWeight: 500 }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Novidades */}
            {novidades.length > 0 && (
              <div style={{ width: '100%', maxWidth: 380 }}>
                <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: isDark ? '#D4AF37' : 'rgba(255,255,255,0.5)', marginBottom: 10 }}>
                  O que há de novo
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {novidades.slice(0, 5).map((n, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: isDark ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', border: isDark ? '1px solid rgba(212,175,55,0.2)' : 'none' }}>
                      <span style={{ fontSize: '1.05rem', lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{n.icone || '✨'}</span>
                      <div>
                        <p style={{ fontWeight: 700, color: '#fff', fontSize: '0.875rem', margin: '0 0 2px' }}>{n.titulo}</p>
                        {n.descricao && <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>{n.descricao}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rodapé SS */}
            <div style={{ marginTop: 'auto', paddingTop: 24, display: 'flex', alignItems: 'center', gap: 10, borderTop: isDark ? '1px solid rgba(212,175,55,0.25)' : '1px solid rgba(255,255,255,0.12)' }}>
              <SSLogo size={24} />
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                Powered by <span style={{ color: isDark ? '#D4AF37' : '#fff', fontWeight: 600 }}>{ssNome}</span>
              </p>
            </div>
          </div>
        </div>

        {/* ══ PAINEL DIREITO — identidade do cliente + formulário ══ */}
        <div className="login-right" style={{ background: rightBg }}>
          <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '24px' }} className="card">

            {/* Logos + nome da clínica */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {(temLogoP || temLogoS) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {temLogoP && (
                    <img src={identidade.logoP} alt="logo" style={{ maxHeight: 48, width: 'auto', objectFit: 'contain', borderRadius: 10, flexShrink: 0 }} />
                  )}
                  {temLogoS && (
                    <img src={identidade.logoS} alt="logo2" style={{ maxHeight: 48, width: 'auto', objectFit: 'contain', borderRadius: 10, flexShrink: 0 }} />
                  )}
                </div>
              )}
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', fontFamily: "'Playfair Display', serif" }}>{identidade.nomeP}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{identidade.nomeS}</div>
              </div>
            </div>

            {identidade.slogan && (
              <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: -8 }}>{identidade.slogan}</p>
            )}

            <h2 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-primary)', fontFamily: "'Playfair Display', serif" }}>
              Entrar no sistema
            </h2>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="email">E-mail</label>
                <input id="email" type="email" className="form-input"
                  placeholder="seu@email.com" value={email}
                  onChange={e => setEmail(e.target.value)} required autoComplete="email" />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Senha</label>
                <input id="password" type="password" className="form-input"
                  placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-secondary)', userSelect: 'none' }}>
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                    style={{ accentColor: 'var(--teal)', width: 16, height: 16 }} />
                  Lembrar de mim
                </label>
                {rememberMe && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Credenciais salvas</span>}
              </div>

              {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem', fontWeight: '500' }}>{error}</p>}

              <button type="submit" className="btn btn-primary btn-full btn-lg">Entrar</button>
            </form>

            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
              Acesso inicial: use seu e-mail e senha <strong>123456</strong>
            </p>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <SSLogo size={32} />
              <p className="ss-brand-text">
                Desenvolvido por <span className="ss-brand-link">{ssNome}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
