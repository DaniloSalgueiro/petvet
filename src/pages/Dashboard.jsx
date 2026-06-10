import { Users, Calendar, Package, DollarSign, AlertTriangle, Settings, BookOpen } from 'lucide-react'
import { AGENDAMENTOS, PETS, LANCAMENTOS, PRODUTOS, USUARIOS, getDaysUntilExpiry } from '../data/mock'
import { usePersistentState } from '../hooks/usePersistentState'
import { useAuth } from '../context/AuthContext'
import { isSuporteAtivo } from '../lib/devAccess'

const TODAY = '2026-05-14'

const STATUS_COLOR = { agendado: 'neutral', confirmado: 'teal', 'em-atendimento': 'warning', concluido: 'success', cancelado: 'danger' }
const STATUS_LABEL = { agendado: 'Agendado', confirmado: 'Confirmado', 'em-atendimento': 'Em atendimento', concluido: 'Concluído', cancelado: 'Cancelado' }
const TYPE_LABEL = { consulta: 'Consulta', retorno: 'Retorno', cirurgia: 'Cirurgia', vacina: 'Vacina', banho: 'Banho & Tosa', sobanho: 'Banho', tosa: 'Tosa', outros: 'Outros' }

function DevDashboard({ navigateTo }) {
  const [petsLS]    = usePersistentState('petvet-pets',    PETS)
  const [usuariosLS] = usePersistentState('petvet-usuarios', USUARIOS)
  const suporteAtivo = isSuporteAtivo()
  const totalPets     = (Array.isArray(petsLS)    ? petsLS    : PETS).length
  const totalUsuarios = (Array.isArray(usuariosLS) ? usuariosLS : USUARIOS).length

  try {
    const cfg = JSON.parse(localStorage.getItem('petvet-ss-config') ?? '{}')
    const plano = cfg.plano || 'pro'
    var planoLabel = { basico:'Básico', plus:'Plus', pro:'Pro' }[plano] || plano
  } catch { var planoLabel = '—' }

  const stats = [
    { label:'Total de pets cadastrados', value: totalPets,     icon: Users,    variant:'teal' },
    { label:'Usuários do sistema',        value: totalUsuarios, icon: Users,    variant:'magenta' },
    { label:'Plano ativo',                value: planoLabel,    icon: Settings, variant:'success' },
    { label:'Modo Suporte',               value: suporteAtivo ? 'Ativo' : 'Inativo',
      icon: BookOpen, variant: suporteAtivo ? 'warning' : 'neutral' },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Painel do Desenvolvedor</h2>
          <p className="page-subtitle">Métricas técnicas — dados pessoais protegidos por LGPD</p>
        </div>
      </div>

      <div style={{ padding:'12px 16px', background:'rgba(212,175,55,0.1)', border:'1px solid rgba(212,175,55,0.35)', borderRadius:8, fontSize:'0.8125rem', color:'#92400e' }}>
        <strong>🔒 Modo Desenvolvedor ativo.</strong> Dados clínicos, financeiros e pessoais de clientes estão ocultos.
        {suporteAtivo
          ? ' O cliente autorizou acesso temporário — todos os módulos estão disponíveis.'
          : ' Para acesso a dados, solicite autorização em Configurações → Suporte Técnico.'}
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
        <div className="card">
          <h3 style={{ fontSize:'0.9375rem', fontWeight:700, color:'var(--text-primary)', marginBottom:12 }}>Acesso rápido</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              { label:'Configurações do sistema', page:'configuracoes' },
              { label:'Bulário veterinário',       page:'bulario' },
              { label:'Raças cadastradas',         page:'racas' },
              { label:'Config. Prontuário',        page:'prontuario-config' },
            ].map(item => (
              <button key={item.page} className="btn btn-outline btn-sm"
                style={{ justifyContent:'flex-start' }}
                onClick={() => navigateTo(item.page)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <h3 style={{ fontSize:'0.9375rem', fontWeight:700, color:'var(--text-primary)', marginBottom:12 }}>Suporte Técnico</h3>
          <p style={{ fontSize:'0.875rem', color:'var(--text-muted)', marginBottom:12, lineHeight:1.6 }}>
            Para acessar dados do cliente durante suporte técnico, o administrador da clínica deve autorizar
            o acesso temporário em <strong>Configurações → Suporte Técnico</strong>.
          </p>
          <p style={{ fontSize:'0.8125rem', color: suporteAtivo ? '#166534' : 'var(--text-muted)', fontWeight: suporteAtivo ? 700 : 400 }}>
            Status: {suporteAtivo ? '✓ Autorização ativa (24h)' : 'Não autorizado'}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard({ navigateTo }) {
  const { user } = useAuth()
  if (user?.role === 'dev') return <DevDashboard navigateTo={navigateTo} />

  const [rawAgendamentos] = usePersistentState('petvet-agendamentos', AGENDAMENTOS)
  const [petsLS] = usePersistentState('petvet-pets', PETS)
  const [produtosLS] = usePersistentState('petvet-produtos', PRODUTOS)
  const [lancamentosLS] = usePersistentState('petvet-lancamentos', LANCAMENTOS)

  const agendamentos = Array.isArray(rawAgendamentos) ? rawAgendamentos : AGENDAMENTOS
  const allPets = Array.isArray(petsLS) ? petsLS : PETS
  const allProdutos = Array.isArray(produtosLS) ? produtosLS : PRODUTOS
  const allLancamentos = Array.isArray(lancamentosLS) ? lancamentosLS : LANCAMENTOS

  const petsMap = new Map(allPets.map(p => [p.id, p]))
  const getPetName = apt => apt.petName || petsMap.get(apt.petId)?.name || '—'

  const hojeApts = agendamentos
    .filter(a => a.date === TODAY && a.status !== 'cancelado')
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))

  const thisMonth = allLancamentos.filter(l => {
    const d = new Date(l.date + 'T00:00')
    return d.getFullYear() === 2026 && d.getMonth() === 4
  })
  const totalReceitas = thisMonth.filter(l => l.type === 'receita' && l.status === 'recebido').reduce((s, l) => s + l.value, 0)

  const stockAlerts = allProdutos.filter(p => {
    const dias = getDaysUntilExpiry(p.expiryDate)
    return p.quantity <= p.minStock || dias <= 30
  }).sort((a, b) => getDaysUntilExpiry(a.expiryDate) - getDaysUntilExpiry(b.expiryDate))

  const stats = [
    { label: 'Pets cadastrados',    value: allPets.length,                                     icon: Users,     variant: 'teal' },
    { label: 'Consultas hoje',      value: hojeApts.length,                                    icon: Calendar,  variant: 'magenta' },
    { label: 'Itens em estoque',    value: allProdutos.reduce((s, p) => s + p.quantity, 0),    icon: Package,   variant: 'success' },
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
              {hojeApts.map(apt => (
                <div
                  key={apt.id}
                  onClick={() => navigateTo('servicos')}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', transition: 'background 150ms' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, minWidth: 38 }}>{apt.time}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getPetName(apt)}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{TYPE_LABEL[apt.type] ?? apt.type}</p>
                  </div>
                  <span className={`badge badge-${STATUS_COLOR[apt.status]}`} style={{ fontSize: '0.7rem', flexShrink: 0 }}>{STATUS_LABEL[apt.status]}</span>
                </div>
              ))}
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
