import { useState } from 'react'
import {
  LayoutDashboard, Users, Calendar, ShoppingCart,
  MoreHorizontal, FileText, Package, Scissors,
  DollarSign, Syringe, Pill, BarChart2,
  UserCog, Briefcase, Tag, Settings, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const PRIMARY_NAV = [
  { id: 'dashboard', label: 'Início',  icon: LayoutDashboard },
  { id: 'pets',      label: 'Pets',    icon: Users },
  { id: 'agenda',    label: 'Agenda',  icon: Calendar },
  { id: 'pdv',       label: 'PDV',     icon: ShoppingCart },
]

const MORE_NAV = [
  { id: 'prontuario',      label: 'Prontuário', icon: FileText },
  { id: 'estoque',         label: 'Estoque',    icon: Package },
  { id: 'servicos',        label: 'Serviços',   icon: Scissors },
  { id: 'financeiro',      label: 'Financeiro', icon: DollarSign },
  { id: 'vacinaprotocolo', label: 'Vacinas',    icon: Syringe },
  { id: 'bulario',         label: 'Bulário',    icon: Pill },
  { id: 'relatorios',      label: 'Relatórios', icon: BarChart2 },
]

const ADMIN_MORE = [
  { id: 'usuarios',          label: 'Usuários',     icon: UserCog },
  { id: 'funcionarios',      label: 'Funcionários', icon: Briefcase },
  { id: 'racas',             label: 'Raças',        icon: Tag },
  { id: 'prontuario-config', label: 'Config. Pront.', icon: Settings },
]

export default function MobileNav({ currentPage, onNavigate }) {
  const { hasRole, hasPermission } = useAuth()
  const [showMore, setShowMore] = useState(false)

  function goTo(id) {
    onNavigate(id)
    setShowMore(false)
  }

  const primaryIds = PRIMARY_NAV.map(n => n.id)
  const isMoreActive = !primaryIds.includes(currentPage)

  return (
    <>
      {showMore && (
        <div
          className="mobile-more-overlay"
          onClick={() => setShowMore(false)}
        />
      )}

      {showMore && (
        <div className="mobile-more-panel">
          <div className="mobile-more-header">
            <span>Mais módulos</span>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setShowMore(false)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="mobile-more-grid">
            {MORE_NAV.map(item => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  className={`mobile-more-item${currentPage === item.id ? ' active' : ''}`}
                  onClick={() => goTo(item.id)}
                >
                  <Icon size={22} />
                  <span>{item.label}</span>
                </button>
              )
            })}
            {ADMIN_MORE.filter(item => hasRole('admin') || hasPermission(item.id, 'view')).map(item => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  className={`mobile-more-item${currentPage === item.id ? ' active' : ''}`}
                  onClick={() => goTo(item.id)}
                >
                  <Icon size={22} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <nav className="mobile-nav">
        <div className="mobile-nav-inner">
          {PRIMARY_NAV.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={`mobile-nav-item${currentPage === item.id ? ' active' : ''}`}
                onClick={() => goTo(item.id)}
              >
                <Icon size={22} />
                <span>{item.label}</span>
              </button>
            )
          })}
          <button
            className={`mobile-nav-item${isMoreActive ? ' active' : ''}`}
            onClick={() => setShowMore(v => !v)}
          >
            <MoreHorizontal size={22} />
            <span>Mais</span>
          </button>
        </div>
      </nav>
    </>
  )
}
