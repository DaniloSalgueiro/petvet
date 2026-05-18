export default function Placeholder({ title, description }) {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">{title}</h2>
          <p className="page-subtitle">{description}</p>
        </div>
      </div>
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: '2rem', marginBottom: '12px' }}>🚧</p>
        <p style={{ fontWeight: '500' }}>Módulo em desenvolvimento</p>
        <p style={{ fontSize: '0.875rem', marginTop: '6px' }}>Este módulo será implementado em breve.</p>
      </div>
    </div>
  )
}
