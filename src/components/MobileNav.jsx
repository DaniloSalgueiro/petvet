import { useState } from 'react'
import {
  LayoutDashboard, Users, Calendar, ShoppingCart,
  MoreHorizontal, FileText, Package, Scissors,
  DollarSign, Syringe, Pill, BarChart2, Calculator,
  UserCog, Briefcase, Tag, Settings, Palette, X, LogOut,
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
  { id: 'financeiro',      label: 'Financeiro',   icon: DollarSign },
  { id: 'contabilidade',   label: 'Contabilidade',icon: Calculator },
  { id: 'crm',             label: 'CRM',          icon: Users },
  { id: 'vacinaprotocolo', label: 'Vacinas',      icon: Syringe },
  { id: 'bulario',         label: 'Bulário',      icon: Pill },
  { id: 'relatorios',      label: 'Relatórios',   icon: BarChart2 },
]

const ADMIN_MORE = [
  { id: 'usuarios',          label: 'Usuários',        icon: UserCog },
  { id: 'funcionarios',      label: 'Funcionários',    icon: Briefcase },
  { id: 'racas',             label: 'Raças',           icon: Tag },
  { id: 'prontuario-config', label: 'Config. Pront.',  icon: Settings },
  { id: 'configuracoes',     label: 'Configurações',   icon: Palette },
]

export default function MobileNav({ currentPage, onNavigate }) {
  const { logout, hasRole, hasPermission } = useAuth()
  const [showMore, setShowMore] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  function goTo(id) {
    onNavigate(id)
    setShowMore(false)
  }

  const primaryIds = PRIMARY_NAV.map(n => n.id)
  const isMoreActive = !primaryIds.includes(currentPage)

  return (
    <>
      {/* Overlay do painel Mais */}
      {showMore && (
        <div
          className="mobile-more-overlay"
          onClick={() => setShowMore(false)}
        />
      )}

      {/* Painel Mais */}
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

          {/* Botão Sair */}
          <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px 4px' }}>
            <button
              className="mobile-more-item"
              style={{ color: 'var(--danger)', width: '100%' }}
              onClick={() => { setShowMore(false); setShowLogoutConfirm(true) }}
            >
              <LogOut size={22} />
              <span>Sair</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal de confirmação de logout */}
      {showLogoutConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#fed7d7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <LogOut size={20} color="var(--danger)" />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', margin: 0 }}>Sair do sistema?</h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
              Você será desconectado e precisará fazer login novamente.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowLogoutConfirm(false)}>Cancelar</button>
              <button
                className="btn btn-sm"
                style={{ background: 'var(--danger)', color: '#fff', border: 'none' }}
                onClick={() => { setShowLogoutConfirm(false); logout() }}
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navbar inferior */}
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
