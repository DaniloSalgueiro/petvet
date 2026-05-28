import { useState, useEffect } from 'react'
import { loadAll, loadFromSupabase } from './hooks/useSupabaseSync'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { IdentidadeProvider } from './context/IdentidadeContext'
import { FollowupProvider } from './context/FollowupContext'
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
import ConfiguracoesPage from './pages/Configuracoes'

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

const PLANOS_MODULOS = {
  basico: ['dashboard','pets','prontuario','agenda','configuracoes'],
  plus:   ['dashboard','pets','prontuario','agenda','vacinaprotocolo','bulario','estoque','servicos','configuracoes'],
  pro:    null,
}

const PAGE_NAMES = {
  estoque: 'Estoque', servicos: 'Serviços', financeiro: 'Financeiro',
  usuarios: 'Usuários', pdv: 'PDV', vacinaprotocolo: 'Vacinas',
  funcionarios: 'Funcionários', 'prontuario-config': 'Config. Prontuário',
  racas: 'Raças', bulario: 'Bulário', relatorios: 'Relatórios',
}

function getPlano() {
  try { return JSON.parse(localStorage.getItem('petvet-ss-config') ?? '{}').plano || 'pro' }
  catch { return 'pro' }
}

function ModuloNaoDisponivel({ name }) {
  return (
    <div className="page">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '3rem' }}>🔒</div>
        <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{name || 'Módulo'} não disponível</p>
        <p style={{ fontSize: '0.875rem' }}>Este módulo não está incluído no plano atual.<br/>Entre em contato com a Salgueiro Systems para fazer upgrade.</p>
      </div>
    </div>
  )
}

function PageRouter({ page, navParams, navigateTo }) {
  const plano = getPlano()
  const modulosAtivos = PLANOS_MODULOS[plano] ?? null

  if (modulosAtivos && !modulosAtivos.includes(page)) {
    return <ModuloNaoDisponivel name={PAGE_NAMES[page] ?? page} />
  }

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
    case 'configuracoes':     return <ConfiguracoesPage />
    default:                  return <Dashboard navigateTo={navigateTo} />
  }
}

const CRITICAL_KEYS = [
  'petvet-pets',
  'petvet-tutores',
  'petvet-agendamentos',
  'petvet-prontuarios',
]

export default function App() {
  // Carga inicial: traz todos os dados do Supabase de uma vez (1 query)
  useEffect(() => {
    loadAll()
  }, [])

  // Sincronização periódica dos dados críticos a cada 30s.
  // Dispara evento supabase-sync quando detecta mudança para atualizar useCloudState.
  useEffect(() => {
    const interval = setInterval(async () => {
      for (const key of CRITICAL_KEYS) {
        const result = await loadFromSupabase(key)
        if (!result.ok || result.data === null) continue
        let local = null
        try { local = JSON.parse(localStorage.getItem(key) ?? 'null') } catch {}
        if (JSON.stringify(result.data) !== JSON.stringify(local)) {
          try { localStorage.setItem(key, JSON.stringify(result.data)) } catch {}
          window.dispatchEvent(new CustomEvent('supabase-sync', { detail: { key } }))
        }
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  return (
    <IdentidadeProvider>
      <ThemeProvider>
        <AuthProvider>
          <FollowupProvider>
            <AppShell />
          </FollowupProvider>
        </AuthProvider>
      </ThemeProvider>
    </IdentidadeProvider>
  )
}
