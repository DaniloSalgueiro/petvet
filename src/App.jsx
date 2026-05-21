import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import MobileNav from './components/MobileNav'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PetsPage from './pages/Pets'
import ProntuarioPage from './pages/Prontuario'
import AgendaPage from './pages/Agenda'
import EstoquePage from './pages/Estoque'
import ServicosPage from './pages/Servicos'
import FinanceiroPage from './pages/Financeiro'
import UsuariosPage from './pages/Usuarios'
import PDVPage from './pages/PDV'
import VacinaProtocoloPage from './pages/VacinaProtocolo'
import ChangePassword from './pages/ChangePassword'
import FuncionariosPage from './pages/Funcionarios'
import ProntuarioConfigPage from './pages/ProntuarioConfig'
import RacasPage from './pages/Racas'
import BularioPage from './pages/Bulario'
import RelatoriosPage from './pages/Relatorios'

function AppShell() {
  const { user, mustChangePassword } = useAuth()
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [navParams, setNavParams] = useState({})

  function navigateTo(page, params = {}) {
    setCurrentPage(page)
    setNavParams(params)
  }

  if (!user) return <Login />
  if (mustChangePassword) return <ChangePassword />

  return (
    <div className="app-shell">
      <Sidebar currentPage={currentPage} onNavigate={p => navigateTo(p)} />
      <div className="main-content">
        <Header currentPage={currentPage} />
        <PageRouter page={currentPage} navParams={navParams} navigateTo={navigateTo} />
      </div>
      <MobileNav currentPage={currentPage} onNavigate={p => navigateTo(p)} />
    </div>
  )
}

function PageRouter({ page, navParams, navigateTo }) {
  switch (page) {
    case 'dashboard':  return <Dashboard navigateTo={navigateTo} />
    case 'pets':       return <PetsPage navigateTo={navigateTo} navParams={navParams} />
    case 'prontuario': return <ProntuarioPage navParams={navParams} navigateTo={navigateTo} />
    case 'agenda':     return <AgendaPage navParams={navParams} />
    case 'estoque':    return <EstoquePage />
    case 'servicos':   return <ServicosPage />
    case 'financeiro': return <FinanceiroPage />
    case 'usuarios':   return <UsuariosPage />
    case 'pdv':               return <PDVPage navigateTo={navigateTo} />
    case 'vacinaprotocolo':   return <VacinaProtocoloPage />
    case 'funcionarios':      return <FuncionariosPage />
    case 'prontuario-config': return <ProntuarioConfigPage />
    case 'racas':             return <RacasPage />
    case 'bulario':           return <BularioPage />
    case 'relatorios':        return <RelatoriosPage />
    default:                  return <Dashboard navigateTo={navigateTo} />
  }
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  )
}
