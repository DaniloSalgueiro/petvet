import { Shield } from 'lucide-react'

export default function AccessDenied({ title }) {
  return (
    <div className="page">
      {title && (
        <div className="page-header">
          <h2 className="page-title">{title}</h2>
        </div>
      )}
      <div className="card" style={{ textAlign: 'center', padding: '64px 24px' }}>
        <Shield size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
        <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Acesso restrito</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 6 }}>
          Você não tem permissão para acessar este módulo.
        </p>
      </div>
    </div>
  )
}
