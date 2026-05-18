import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Key } from 'lucide-react'

export default function ChangePassword() {
  const { changePassword, user } = useAuth()
  const [nova, setNova] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (nova.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return }
    if (nova !== confirmar) { setError('As senhas não coincidem.'); return }
    changePassword(nova)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, var(--teal), var(--magenta))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Key size={24} color="#fff" />
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Definir nova senha
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 6 }}>
            Olá, <strong>{user?.name}</strong>. Por segurança, defina uma nova senha antes de continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Nova senha</label>
            <input
              type="password" className="form-input"
              value={nova} onChange={e => setNova(e.target.value)}
              placeholder="Mínimo 6 caracteres" autoComplete="new-password" required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirmar nova senha</label>
            <input
              type="password" className="form-input"
              value={confirmar} onChange={e => setConfirmar(e.target.value)}
              placeholder="Repita a senha" autoComplete="new-password" required
            />
          </div>
          {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem', fontWeight: 500 }}>{error}</p>}
          <button type="submit" className="btn btn-primary btn-full btn-lg">Definir senha e entrar</button>
        </form>
      </div>
    </div>
  )
}
