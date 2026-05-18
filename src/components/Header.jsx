import { Sun, Moon, Bell } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

const PAGE_TITLES = {
  dashboard:  'Dashboard',
  pets:       'Pets & Tutores',
  prontuario: 'Prontuário',
  agenda:     'Agenda',
  estoque:    'Estoque',
  servicos:   'Serviços',
  financeiro: 'Financeiro',
  usuarios:   'Gestão de Usuários',
}

export default function Header({ currentPage, actions }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="top-header">
      <h1 className="header-title">{PAGE_TITLES[currentPage] ?? ''}</h1>

      <div className="header-actions">
        {actions}

        <button className="btn btn-ghost btn-icon" title="Notificações">
          <Bell size={18} />
        </button>

        <button
          className="btn btn-ghost btn-icon"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </header>
  )
}
