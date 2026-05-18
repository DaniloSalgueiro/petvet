import {
  LayoutDashboard, Users, FileText, Calendar,
  Package, Scissors, DollarSign, UserCog, LogOut, ShoppingCart, Syringe,
  Briefcase, Settings, Tag, Pill,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

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
]

const ADMIN_ITEMS = [
  { id: 'usuarios',          label: 'Usuários',               icon: UserCog },
  { id: 'funcionarios',      label: 'Funcionários',           icon: Briefcase },
  { id: 'racas',             label: 'Raças',                  icon: Tag },
  { id: 'prontuario-config', label: 'Config. Prontuário',     icon: Settings },
]

export default function Sidebar({ currentPage, onNavigate }) {
  const { user, logout, hasRole } = useAuth()

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">
          <div className="sidebar-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4.5 9a3.5 3.5 0 1 1 7 0A3.5 3.5 0 0 1 4.5 9zm12 0a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0zM1 19.5C1 16.46 3.46 14 6.5 14h11c3.04 0 5.5 2.46 5.5 5.5v.5H1v-.5z"/>
            </svg>
          </div>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-name">PetVet</span>
            <span className="sidebar-logo-sub">Gestão Veterinária</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Principal</span>
        {NAV_ITEMS.map(item => (
          <NavItem
            key={item.id}
            item={item}
            active={currentPage === item.id}
            onClick={() => onNavigate(item.id)}
          />
        ))}

        {hasRole('admin') && (
          <>
            <span className="sidebar-section-label">Administração</span>
            {ADMIN_ITEMS.map(item => (
              <NavItem
                key={item.id}
                item={item}
                active={currentPage === item.id}
                onClick={() => onNavigate(item.id)}
              />
            ))}
          </>
        )}
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
