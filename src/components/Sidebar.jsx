import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Users, FileText, Calendar,
  Package, Scissors, DollarSign, UserCog, LogOut, ShoppingCart, Syringe,
  Briefcase, Settings, Tag, Pill, BarChart2, Palette, Calculator, Lock, X,
  MessageCircle, CreditCard,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useIdentidade } from '../context/IdentidadeContext'
import SSLogo from './SSLogo'
import { DEFAULT_PLANOS, PLANO_LABELS } from '../lib/planos'
import { DEV_MODULOS_PERMITIDOS, devPodeAcessar } from '../lib/devAccess'

const PLANO_CORES = {
  pro:    { bg: 'var(--teal-light)',  color: 'var(--teal-dark)',  border: 'var(--teal)' },
  plus:   { bg: '#dbeafe',            color: '#1e40af',           border: '#93c5fd' },
  basico: { bg: 'var(--surface-2)',   color: 'var(--text-muted)', border: 'var(--border)' },
}

// Descrição dos recursos por módulo (usada no modal de upgrade)
const MODULE_FEATURES = {
  estoque:           ['Controle de estoque e produtos', 'Alertas de estoque baixo', 'Histórico de movimentações'],
  servicos:          ['Catálogo de serviços', 'Preços e promoções', 'Pacotes e combos'],
  pdv:               ['Ponto de venda completo', 'Emissão de recibo', 'Múltiplos meios de pagamento'],
  financeiro:        ['DRE mensal', 'Lançamentos de receitas e despesas', 'Controle de comissões'],
  'notas-fiscais':   ['Notas fiscais de entrada e saída', 'Cálculo automático de impostos', 'Lançamento automático no Financeiro'],
  'contas-pagar':    ['Contas a pagar e a receber', 'Parcelamento e recorrência', 'Alertas de vencimento'],
  vacinaprotocolo:   ['Protocolos de vacinação personalizados', 'Carteirinha digital do pet', 'Alertas de vencimento'],
  bulario:           ['Bulário veterinário completo', 'Busca por princípio ativo', 'Posologias e interações'],
  relatorios:        ['Relatórios gerenciais completos', 'Exportar CSV', 'Análise de desempenho'],
  contabilidade:     ['Plano de contas', 'DRE contábil', 'Livro caixa', 'Apuração de impostos', 'Relatório para contador'],
  crm:               ['Gestão de relacionamento', 'Classificação VIP/Frequente/Inativo', 'Análise RFM', 'Campanhas WhatsApp'],
  funcionarios:      ['Folha de pagamento', 'INSS progressivo e FGTS', 'Histórico mensal de pagamentos'],
  usuarios:          ['Controle de acesso por perfil', 'Múltiplos usuários', 'Auditoria de ações'],
  racas:             ['Cadastro completo de raças', 'Organizado por espécie', 'Usado no prontuário'],
  'prontuario-config': ['Configuração por tipo de consulta', 'Campos personalizados', 'Seções opcionais'],
}

function loadSsCfg() {
  try { return JSON.parse(localStorage.getItem('petvet-ss-config') ?? '{}') }
  catch { return {} }
}
function loadSsNome() {
  const c = loadSsCfg()
  return c.poweredBy || c.nome || 'Salgueiro Systems'
}
function loadSsPlano() {
  return loadSsCfg().plano ?? 'pro'
}

// Retorna o objeto de planos efetivos (custom ou padrão)
function getEffectivePlanos() {
  const cfg = loadSsCfg()
  if (cfg.planosCustom) return cfg.planosCustom
  return DEFAULT_PLANOS
}

// Retorna o plano mínimo que inclui um módulo ('basico' | 'plus' | 'pro')
function getMinPlan(moduleId, planos) {
  if (planos.basico && planos.basico.includes(moduleId)) return 'basico'
  if (planos.plus   && planos.plus.includes(moduleId))   return 'plus'
  return 'pro' // pro = null = tudo incluído
}

// ── Nav items ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'dashboard',        label: 'Dashboard',       icon: LayoutDashboard },
  { id: 'pets',             label: 'Pets & Tutores',   icon: Users },
  { id: 'prontuario',       label: 'Prontuário',        icon: FileText },
  { id: 'agenda',           label: 'Agenda',            icon: Calendar },
  { id: 'estoque',          label: 'Estoque',           icon: Package },
  { id: 'servicos',         label: 'Serviços',          icon: Scissors },
  { id: 'pdv',              label: 'PDV',               icon: ShoppingCart },
  { id: 'vacinaprotocolo',  label: 'Vacinas',           icon: Syringe },
  { id: 'bulario',          label: 'Bulário',           icon: Pill },
  { id: 'financeiro',       label: 'Financeiro',        icon: DollarSign },
  { id: 'notas-fiscais',    label: 'Notas Fiscais',     icon: FileText },
  { id: 'contas-pagar',     label: 'Contas a Pagar',    icon: CreditCard },
  { id: 'contabilidade',    label: 'Contabilidade',     icon: Calculator },
  { id: 'crm',              label: 'CRM',               icon: Users },
  { id: 'relatorios',       label: 'Relatórios',        icon: BarChart2 },
]

const ADMIN_ITEMS = [
  { id: 'usuarios',          label: 'Usuários',           icon: UserCog },
  { id: 'funcionarios',      label: 'Funcionários',       icon: Briefcase },
  { id: 'racas',             label: 'Raças',              icon: Tag },
  { id: 'prontuario-config', label: 'Config. Prontuário', icon: Settings },
  { id: 'configuracoes',     label: 'Configurações',      icon: Palette },
]

// Determina se um módulo está bloqueado no plano atual
function isLocked(moduleId, ssPlano, planos) {
  if (ssPlano === 'pro') return false
  const modulosAtivos = planos[ssPlano] // null = pro = tudo liberado
  if (modulosAtivos === null) return false
  return !modulosAtivos.includes(moduleId)
}

// ── Upgrade modal ─────────────────────────────────────────────────────────────

function UpgradeModal({ moduleId, label, minPlan, ssWhatsapp, onClose }) {
  const features = MODULE_FEATURES[moduleId] || ['Recursos avançados', 'Funcionalidades exclusivas']
  const planoLabel = PLANO_LABELS[minPlan] || 'Superior'
  const planoCor = PLANO_CORES[minPlan] || PLANO_CORES.pro

  function handleWhatsApp() {
    const digits = (ssWhatsapp || '').replace(/\D/g, '')
    const phone  = digits.startsWith('55') && digits.length >= 12 ? digits : '55' + digits
    const msg    = `Olá! Gostaria de fazer upgrade do meu plano PetVet para ter acesso ao módulo ${label}.`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.55)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={onClose}
    >
      <div
        style={{ background:'var(--surface)', borderRadius:16, padding:28, width:'100%', maxWidth:420,
          boxShadow:'0 20px 60px rgba(0,0,0,0.3)', display:'flex', flexDirection:'column', gap:20 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, flex:1 }}>
            <div style={{ width:60, height:60, borderRadius:'50%', background:'#fef9c3',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Lock size={28} color="#D4AF37" />
            </div>
            <div style={{ textAlign:'center' }}>
              <p style={{ fontWeight:700, fontSize:'1rem', color:'var(--text-primary)', marginBottom:4 }}>
                Módulo bloqueado
              </p>
              <p style={{ fontSize:'0.875rem', color:'var(--text-muted)' }}>
                <strong>{label}</strong> está disponível no
              </p>
              <span style={{
                display:'inline-flex', alignItems:'center', marginTop:6,
                padding:'3px 14px', borderRadius:20, fontWeight:700, fontSize:'0.875rem',
                background:planoCor.bg, color:planoCor.color, border:`1px solid ${planoCor.border}`,
              }}>
                Plano {planoLabel}
              </span>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" style={{ padding:4, flexShrink:0 }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Features */}
        <div style={{ background:'var(--surface-2)', borderRadius:10, padding:'12px 16px' }}>
          <p style={{ fontSize:'0.8125rem', fontWeight:600, color:'var(--text-primary)', marginBottom:8 }}>
            Recursos que seriam desbloqueados:
          </p>
          <ul style={{ margin:0, paddingLeft:16, display:'flex', flexDirection:'column', gap:4 }}>
            {features.map((f, i) => (
              <li key={i} style={{ fontSize:'0.8125rem', color:'var(--text-secondary)' }}>{f}</li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <button
            className="btn btn-primary"
            style={{ gap:8, justifyContent:'center' }}
            onClick={handleWhatsApp}
          >
            <MessageCircle size={16} />
            Falar com a Salgueiro Systems
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>

        <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', textAlign:'center', margin:0 }}>
          Entre em contato para fazer upgrade e desbloquear todos os recursos do Plano {planoLabel}.
        </p>
      </div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar({ currentPage, onNavigate }) {
  const { user, logout, hasRole, isDevMode, hasPermission } = useAuth()
  const { identidade } = useIdentidade()
  const temLogoP = identidade?.logoP && identidade.logoP.length > 10
  const temLogoS = identidade?.logoS && identidade.logoS.length > 10

  const [ssNome,      setSsNome]      = useState(loadSsNome)
  const [ssPlano,     setSsPlano]     = useState(loadSsPlano)
  const [ssCfg,       setSsCfg]       = useState(loadSsCfg)
  const [planos,      setPlanos]      = useState(getEffectivePlanos)
  const [upgradeItem, setUpgradeItem] = useState(null)

  useEffect(() => {
    function handler() {
      setSsNome(loadSsNome())
      setSsPlano(loadSsPlano())
      setSsCfg(loadSsCfg())
      setPlanos(getEffectivePlanos())
    }
    window.addEventListener('petvet-ss-updated', handler)
    return () => window.removeEventListener('petvet-ss-updated', handler)
  }, [])

  const devMode = isDevMode()

  function handleNavClick(item) {
    if (devMode) {
      // Dev vê apenas módulos permitidos — não deve chegar aqui com bloqueados,
      // mas por segurança navegamos apenas se permitido
      if (devPodeAcessar(item.id)) onNavigate(item.id)
      return
    }
    if (isLocked(item.id, ssPlano, planos)) {
      setUpgradeItem(item)
    } else {
      onNavigate(item.id)
    }
  }

  // Para dev: mostrar apenas módulos permitidos (sem cadeados, sem módulos de dados)
  const navItemsVisiveis = devMode
    ? NAV_ITEMS.filter(i => devPodeAcessar(i.id))
    : NAV_ITEMS

  // Admin items: dev nunca vê (não é admin), demais roles conforme permissão
  const visibleAdminItems = devMode ? [] : ADMIN_ITEMS.filter(item =>
    hasRole('admin') || hasPermission(item.id, 'view')
  )
  // Dev vê apenas Configurações e Config. Prontuário na seção admin
  const devAdminItems = devMode
    ? ADMIN_ITEMS.filter(i => devPodeAcessar(i.id))
    : []

  const planoCor = PLANO_CORES[ssPlano] || PLANO_CORES.basico

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, flexShrink:0 }}>
              {temLogoP && (
                <img src={identidade.logoP} alt="" style={{ maxHeight:32, width:'auto', objectFit:'contain', borderRadius:6, flexShrink:0 }} />
              )}
              {temLogoS && (
                <img src={identidade.logoS} alt="" style={{ maxHeight:32, width:'auto', objectFit:'contain', borderRadius:6, flexShrink:0 }} />
              )}
            </div>
            <div className="sidebar-logo-text">
              <span className="sidebar-logo-name">{identidade.nomeP}</span>
              <span className="sidebar-logo-sub">{identidade.nomeS}</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <span className="sidebar-section-label">
            {devMode ? 'Acesso Técnico' : 'Principal'}
          </span>
          {navItemsVisiveis.map(item => (
            <NavItem
              key={item.id}
              item={item}
              active={currentPage === item.id}
              locked={!devMode && isLocked(item.id, ssPlano, planos)}
              minPlan={!devMode && isLocked(item.id, ssPlano, planos) ? getMinPlan(item.id, planos) : null}
              onClick={() => handleNavClick(item)}
            />
          ))}

          {/* Admin section (não aparece para dev) */}
          {visibleAdminItems.length > 0 && (
            <>
              <span className="sidebar-section-label">Administração</span>
              {visibleAdminItems.map(item => {
                const locked = !hasRole('admin') && isLocked(item.id, ssPlano, planos)
                const minPlan = locked ? getMinPlan(item.id, planos) : null
                return (
                  <NavItem
                    key={item.id}
                    item={item}
                    active={currentPage === item.id}
                    locked={locked}
                    minPlan={minPlan}
                    onClick={() => locked ? setUpgradeItem(item) : onNavigate(item.id)}
                  />
                )
              })}
            </>
          )}

          {/* Dev admin items (apenas Configurações e Config. Prontuário) */}
          {devAdminItems.length > 0 && (
            <>
              <span className="sidebar-section-label">Configurações</span>
              {devAdminItems.map(item => (
                <NavItem
                  key={item.id}
                  item={item}
                  active={currentPage === item.id}
                  locked={false}
                  minPlan={null}
                  onClick={() => onNavigate(item.id)}
                />
              ))}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          {/* Aviso modo dev */}
          {devMode && (
            <div style={{
              margin:'0 10px 8px',
              padding:'7px 10px',
              borderRadius:8,
              background:'rgba(212,175,55,0.12)',
              border:'1px solid rgba(212,175,55,0.35)',
            }}>
              <div style={{ fontSize:9, color:'#D4AF37', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:2 }}>
                Modo Desenvolvedor
              </div>
              <div style={{ fontSize:8, color:'rgba(212,175,55,0.75)', lineHeight:1.4 }}>
                Acesso técnico — dados do cliente protegidos
              </div>
            </div>
          )}

          <div className="sidebar-user">
            <div className="user-avatar">{user?.initials ?? 'U'}</div>
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{ROLE_LABEL[user?.role]}</div>
            </div>
            <button
              className="btn btn-ghost btn-icon"
              onClick={logout}
              title="Sair"
              style={{ marginLeft:'auto' }}
            >
              <LogOut size={16} />
            </button>
          </div>

          <div style={{ borderTop:'1px solid var(--sidebar-divider)', padding:'8px 14px 6px',
            display:'flex', alignItems:'center', gap:8 }}>
            <SSLogo size={24} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:9, color:'var(--sidebar-text)', opacity:0.55, lineHeight:1.3, fontWeight:400 }}>Powered by</div>
              <div style={{ fontSize:10, color:'var(--sidebar-text)', opacity:0.75, fontWeight:700, letterSpacing:'0.04em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {ssNome}
              </div>
            </div>
          </div>

          {/* Plano badge — apenas admin */}
          {hasRole('admin') && (
            <div style={{ padding:'0 14px 10px' }}>
              <span style={{
                display:'inline-flex', alignItems:'center', gap:4,
                padding:'2px 10px', borderRadius:20, fontSize:10, fontWeight:700,
                background: planoCor.bg, color: planoCor.color,
                border:`1px solid ${planoCor.border}`,
              }}>
                Plano {PLANO_LABELS[ssPlano] || ssPlano}
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* Upgrade modal */}
      {upgradeItem && (
        <UpgradeModal
          moduleId={upgradeItem.id}
          label={upgradeItem.label}
          minPlan={getMinPlan(upgradeItem.id, planos)}
          ssWhatsapp={ssCfg.whatsapp || ''}
          onClose={() => setUpgradeItem(null)}
        />
      )}
    </>
  )
}

function NavItem({ item, active, locked, minPlan, onClick }) {
  const Icon = item.icon
  return (
    <button
      className={`nav-item ${active && !locked ? 'active' : ''}`}
      onClick={onClick}
      title={locked ? `🔒 Disponível no Plano ${PLANO_LABELS[minPlan] || 'Superior'} — Fale com a Salgueiro Systems para fazer upgrade.` : item.label}
      style={{
        opacity:    locked ? 0.5 : 1,
        cursor:     locked ? 'not-allowed' : 'pointer',
        userSelect: locked ? 'none' : undefined,
      }}
    >
      <Icon size={18} className="nav-item-icon" />
      <span style={{ flex:1 }}>{item.label}</span>
      {locked && (
        <Lock size={12} style={{ color:'#D4AF37', flexShrink:0, marginLeft:'auto' }} />
      )}
    </button>
  )
}

const ROLE_LABEL = {
  admin:      'Administrador',
  veterinario:'Veterinário',
  atendente:  'Atendente',
  dev:        'Suporte Técnico',
}
