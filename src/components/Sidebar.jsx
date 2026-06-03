import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Users, FileText, Calendar,
  Package, Scissors, DollarSign, UserCog, LogOut, ShoppingCart, Syringe,
  Briefcase, Settings, Tag, Pill, BarChart2, Palette, Calculator,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useIdentidade } from '../context/IdentidadeContext'
import SSLogo from './SSLogo'

const PLANOS_MODULOS = {
  basico: ['dashboard','pets','prontuario','agenda','configuracoes'],
  plus:   ['dashboard','pets','prontuario','agenda','vacinaprotocolo','bulario','estoque','servicos','configuracoes'],
  pro:    null,
}

function loadSsCfgSidebar() {
  try { return JSON.parse(localStorage.getItem('petvet-ss-config') ?? '{}') }
  catch { return {} }
}
function loadSsNome() {
  const c = loadSsCfgSidebar()
  return c.poweredBy || c.nome || 'Salgueiro Systems'
}
function loadSsPlano() {
  return loadSsCfgSidebar().plano ?? 'pro'
}

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
  { id: 'contabilidade',    label: 'Contabilidade',     icon: Calculator },
  { id: 'crm',              label: 'CRM',               icon: Users },
  { id: 'relatorios',       label: 'Relatórios',        icon: BarChart2 },
]

const ADMIN_ITEMS = [
  { id: 'usuarios',          label: 'Usuários',               icon: UserCog },
  { id: 'funcionarios',      label: 'Funcionários',           icon: Briefcase },
  { id: 'racas',             label: 'Raças',                  icon: Tag },
  { id: 'prontuario-config', label: 'Config. Prontuário',     icon: Settings },
  { id: 'configuracoes',     label: 'Configurações',          icon: Palette },
]

export default function Sidebar({ currentPage, onNavigate }) {
  const { user, logout, hasRole, hasPermission } = useAuth()
  const { identidade } = useIdentidade()
  const [ssNome, setSsNome] = useState(loadSsNome)
  const [ssPlano, setSsPlano] = useState(loadSsPlano)
  useEffect(() => {
    function handler() { setSsNome(loadSsNome()); setSsPlano(loadSsPlano()) }
    window.addEventListener('petvet-ss-updated', handler)
    return () => window.removeEventListener('petvet-ss-updated', handler)
  }, [])

  const modulosAtivos = PLANOS_MODULOS[ssPlano] ?? null
  const filteredNavItems = modulosAtivos ? NAV_ITEMS.filter(i => modulosAtivos.includes(i.id)) : NAV_ITEMS

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">
          {/* Logos agrupados com mesmo tamanho (32×32) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, flexShrink: 0 }}>
            {identidade.logoP ? (
              <img src={identidade.logoP} alt="" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: 6, background: `${identidade.corPrimaria}22`, border: `1.5px solid ${identidade.corPrimaria}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: identidade.corPrimaria, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                {(identidade.nomeP.replace(/^\W+/, '') || 'E')[0].toUpperCase()}
              </div>
            )}
            {identidade.logoS ? (
              <img src={identidade.logoS} alt="" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: 6, background: `${identidade.corDestaque}22`, border: `1.5px solid ${identidade.corDestaque}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: identidade.corDestaque, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                {(identidade.nomeS.replace(/^\W+/, '') || 'T')[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-name">{identidade.nomeP}</span>
            <span className="sidebar-logo-sub">{identidade.nomeS}</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Principal</span>
        {filteredNavItems.map(item => (
          <NavItem
            key={item.id}
            item={item}
            active={currentPage === item.id}
            onClick={() => onNavigate(item.id)}
          />
        ))}

        {(() => {
          const visibleAdminItems = ADMIN_ITEMS.filter(item =>
            (modulosAtivos === null || modulosAtivos.includes(item.id)) &&
            (hasRole('admin') || hasPermission(item.id, 'view'))
          )
          if (visibleAdminItems.length === 0) return null
          return (
            <>
              <span className="sidebar-section-label">Administração</span>
              {visibleAdminItems.map(item => (
                <NavItem
                  key={item.id}
                  item={item}
                  active={currentPage === item.id}
                  onClick={() => onNavigate(item.id)}
                />
              ))}
            </>
          )
        })()}
      </nav>

      <div className="sidebar-footer">
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
            style={{ marginLeft: 'auto' }}
          >
            <LogOut size={16} />
          </button>
        </div>
        <div style={{
          borderTop: '1px solid var(--sidebar-divider)',
          padding: '8px 14px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <SSLogo size={24} />
          <div>
            <div style={{ fontSize: 9, color: 'var(--sidebar-text)', opacity: 0.55, lineHeight: 1.3, fontWeight: 400 }}>Powered by</div>
            <div style={{ fontSize: 10, color: 'var(--sidebar-text)', opacity: 0.75, fontWeight: 700, letterSpacing: '0.04em' }}>{ssNome}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

function NavItem({ item, active, onClick }) {
  const Icon = item.icon
  return (
    <button
      className={`nav-item ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <Icon size={18} className="nav-item-icon" />
      {item.label}
    </button>
  )
}

const ROLE_LABEL = {
  admin: 'Administrador',
  veterinario: 'Veterinário',
  atendente: 'Atendente',
}
