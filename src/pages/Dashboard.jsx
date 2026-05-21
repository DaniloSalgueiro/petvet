import { Users, Calendar, Package, DollarSign, AlertTriangle } from 'lucide-react'
import { AGENDAMENTOS, PETS, LANCAMENTOS, PRODUTOS, getPetById, getDaysUntilExpiry } from '../data/mock'

const TODAY = '2026-05-14'

const hojeApts = AGENDAMENTOS
  .filter(a => a.date === TODAY && a.status !== 'cancelado')
  .sort((a, b) => a.time.localeCompare(b.time))

const thisMonth = LANCAMENTOS.filter(l => {
  const d = new Date(l.date + 'T00:00')
  return d.getFullYear() === 2026 && d.getMonth() === 4
})
const totalReceitas = thisMonth.filter(l => l.type === 'receita' && l.status === 'recebido').reduce((s, l) => s + l.value, 0)

const stockAlerts = PRODUTOS.filter(p => {
  const dias = getDaysUntilExpiry(p.expiryDate)
  return p.quantity <= p.minStock || dias <= 30
}).sort((a, b) => getDaysUntilExpiry(a.expiryDate) - getDaysUntilExpiry(b.expiryDate))

const STATUS_COLOR = { agendado: 'neutral', confirmado: 'teal', 'em-atendimento': 'warning', concluido: 'success', cancelado: 'danger' }
const STATUS_LABEL = { agendado: 'Agendado', confirmado: 'Confirmado', 'em-atendimento': 'Em atendimento', concluido: 'Concluído', cancelado: 'Cancelado' }
const TYPE_LABEL = { consulta: 'Consulta', retorno: 'Retorno', cirurgia: 'Cirurgia', vacina: 'Vacina', banho: 'Banho & Tosa', outros: 'Outros' }

export default function Dashboard({ navigateTo }) {
  const stats = [
    { label: 'Pets cadastrados',    value: PETS.length,                              icon: Users,     variant: 'teal' },
    { label: 'Consultas hoje',      value: hojeApts.length,                          icon: Calendar,  variant: 'magenta' },
    { label: 'Itens em estoque',    value: PRODUTOS.reduce((s, p) => s + p.quantity, 0), icon: Package, variant: 'success' },
    { label: 'Receita do mês',      value: `R$ ${totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, variant: 'warning' },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Visão geral</h2>
          <p className="page-subtitle">
            {new Date(TODAY + 'T00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="stat-card">
              <div className={`stat-icon stat-icon-${stat.variant}`}><Icon size={20} /></div>
              <div>
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="dash-panels-grid">
        {/* Fila do dia */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Playfair Display', serif" }}>
              Fila do dia
            </h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigateTo('servicos')}>Ver todos</button>
          </div>
          {hojeApts.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nenhum agendamento para hoje.</p>
          ) : (
            <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {hojeApts.map(apt => {
                const pet = getPetById(apt.petId)
                return (
                  <div
                    key={apt.id}
                    onClick={() => navigateTo('servicos')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', transition: 'background 150ms' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, minWidth: 38 }}>{apt.time}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pet?.name ?? '—'}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{TYPE_LABEL[apt.type]}</p>
                    </div>
                    <span className={`badge badge-${STATUS_COLOR[apt.status]}`} style={{ fontSize: '0.7rem', flexShrink: 0 }}>{STATUS_LABEL[apt.status]}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Alertas de estoque */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Playfair Display', serif" }}>
              Alertas de estoque
            </h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigateTo('estoque')}>Ver estoque</button>
          </div>
          {stockAlerts.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nenhum alerta no momento.</p>
          ) : (
            <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {stockAlerts.map(p => {
                const dias = getDaysUntilExpiry(p.expiryDate)
                const lowStock = p.quantity <= p.minStock
                const nearExpiry = dias <= 30
                return (
                  <div
                    key={p.id}
                    onClick={() => navigateTo('estoque')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', transition: 'background 150ms' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <AlertTriangle size={14} style={{ color: dias <= 7 || p.quantity <= 0 ? 'var(--danger)' : 'var(--warning)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {lowStock && `Estoque: ${p.quantity} ${p.unit}`}
                        {lowStock && nearExpiry && ' · '}
                        {nearExpiry && `Vence em ${dias}d`}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {lowStock && <span className="badge badge-danger" style={{ fontSize: '0.68rem' }}>Baixo</span>}
                      {nearExpiry && !lowStock && <span className="badge badge-warning" style={{ fontSize: '0.68rem' }}>Validade</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
