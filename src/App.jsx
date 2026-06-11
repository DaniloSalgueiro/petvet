import { useState, useEffect } from 'react'
import { loadAll, loadFromSupabase } from './hooks/useSupabaseSync'
import { injectManifest } from './lib/pwa'
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
import ContabilidadePage from './pages/Contabilidade'
import CRMPage from './pages/CRM'
import NotasFiscaisPage from './pages/NotasFiscais'
import ContasPagarPage from './pages/ContasPagar'

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
        <Header currentPage={currentPage} onNavigate={p => navigateTo(p)} />
        <PageRouter page={currentPage} navParams={navParams} navigateTo={navigateTo} />
      </div>
      <MobileNav currentPage={currentPage} onNavigate={p => navigateTo(p)} />
    </div>
  )
}

import { DEFAULT_PLANOS } from './lib/planos'
import { devPodeAcessar, registrarAcessoDev } from './lib/devAccess'

const PAGE_NAMES = {
  estoque: 'Estoque', servicos: 'Serviços', financeiro: 'Financeiro',
  usuarios: 'Usuários', pdv: 'PDV', vacinaprotocolo: 'Vacinas',
  funcionarios: 'Funcionários', 'prontuario-config': 'Config. Prontuário',
  racas: 'Raças', bulario: 'Bulário', relatorios: 'Relatórios',
  contabilidade: 'Contabilidade', crm: 'CRM',
  'notas-fiscais': 'Notas Fiscais', 'contas-pagar': 'Contas a Pagar',
}

function getSsCfg() {
  try { return JSON.parse(localStorage.getItem('petvet-ss-config') ?? '{}') } catch { return {} }
}
function getPlano() {
  return getSsCfg().plano || 'pro'
}
function getModulosAtivos() {
  const cfg = getSsCfg()
  const planoId = cfg.plano || 'pro'
  // Novo formato: array de planos em cfg.planos
  if (Array.isArray(cfg.planos) && cfg.planos.length > 0) {
    const plano = cfg.planos.find(p => p.id === planoId) ?? cfg.planos[cfg.planos.length - 1]
    return plano?.modulos ?? null
  }
  // Legado: objeto { basico, plus } em cfg.planosCustom
  const planos = cfg.planosCustom || DEFAULT_PLANOS
  return planos[planoId] ?? null
}

function PageRouter({ page, navParams, navigateTo }) {
  const { user } = useAuth()
  const isDevUser = user?.role === 'dev'
  const modulosAtivos = getModulosAtivos()

  // Proteção de rota para usuário dev — LGPD
  if (isDevUser && !devPodeAcessar(page)) {
    return (
      <div className="page">
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:300, gap:14, textAlign:'center', padding:24 }}>
          <div style={{ fontSize:'3rem' }}>🔒</div>
          <p style={{ fontWeight:700, fontSize:'1rem', color:'var(--text-primary)' }}>
            Módulo restrito — Modo Desenvolvedor
          </p>
          <p style={{ fontSize:'0.875rem', color:'var(--text-muted)', maxWidth:420, lineHeight:1.7 }}>
            Este módulo contém dados do cliente e não está acessível no modo desenvolvedor.<br/>
            Para acesso a dados, solicite autorização formal ao cliente através da seção<br/>
            <strong>Configurações → Suporte Técnico</strong>.
          </p>
          <button className="btn btn-outline btn-sm" onClick={() => navigateTo('dashboard')}>
            Voltar ao início
          </button>
        </div>
      </div>
    )
  }

  // Registrar acesso dev no log
  if (isDevUser) registrarAcessoDev(page, user?.name)

  if (modulosAtivos && !modulosAtivos.includes(page)) {
    // Página bloqueada por plano — fallback
    const name = PAGE_NAMES[page] ?? page
    return (
      <div className="page">
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:300, gap:12, textAlign:'center', color:'var(--text-muted)' }}>
          <div style={{ fontSize:'3rem' }}>🔒</div>
          <p style={{ fontWeight:700, fontSize:'1rem', color:'var(--text-primary)' }}>{name} não disponível</p>
          <p style={{ fontSize:'0.875rem' }}>Este módulo não está incluído no plano atual.<br/>Entre em contato com a Salgueiro Systems para fazer upgrade.</p>
        </div>
      </div>
    )
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
    case 'contabilidade':     return <ContabilidadePage />
    case 'crm':               return <CRMPage />
    case 'notas-fiscais':     return <NotasFiscaisPage />
    case 'contas-pagar':      return <ContasPagarPage />
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
  // Injeta manifest dinamicamente com dados do localStorage
  useEffect(() => {
    try {
      const identidade = JSON.parse(localStorage.getItem('petvet-identidade') || '{}')
      injectManifest(identidade)
    } catch {}

    const onStorage = (e) => {
      if (e.key === 'petvet-identidade') {
        try { injectManifest(JSON.parse(e.newValue || '{}')) } catch {}
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Carga inicial: traz todos os dados do Supabase (bidirecional — 2 queries total)
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('petvet-sync', { detail: { status: 'syncing' } }))
    loadAll()
      .then(() => window.dispatchEvent(new CustomEvent('petvet-sync', { detail: { status: 'synced' } })))
      .catch(() => window.dispatchEvent(new CustomEvent('petvet-sync', { detail: { status: 'error' } })))
  }, [])

  // Verifica contas a pagar vencidas/a vencer e dispara alertas financeiros
  useEffect(() => {
    const verificarVencimentos = () => {
      const config = JSON.parse(localStorage.getItem('petvet-config-alertas') || '{}')
      const antecedencias = config.antecedencias || [1, 3, 7]
      const hoje = new Date()
      const contas = JSON.parse(localStorage.getItem('petvet-contas-pagar') || '[]')
      const alertas = []
      contas.forEach(conta => {
        conta.parcelas?.forEach(parcela => {
          if (parcela.status === 'Pendente') {
            const venc = new Date(parcela.vencimento)
            const diffDias = Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24))
            if (diffDias < 0) {
              alertas.push({ tipo: 'vencida', conta, parcela, diasAtraso: Math.abs(diffDias) })
            } else if (antecedencias.includes(diffDias)) {
              alertas.push({ tipo: 'vencendo', conta, parcela, diasRestantes: diffDias })
            }
          }
        })
      })
      if (alertas.length > 0) {
        localStorage.setItem('petvet-alertas-pendentes', JSON.stringify(alertas))
        window.dispatchEvent(new CustomEvent('alertas-financeiros', { detail: alertas }))
      } else {
        localStorage.removeItem('petvet-alertas-pendentes')
        window.dispatchEvent(new CustomEvent('alertas-financeiros', { detail: alertas }))
      }
    }

    verificarVencimentos()
    const interval = setInterval(verificarVencimentos, 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Sincronização periódica dos dados críticos a cada 60s.
  // Dispara evento supabase-sync quando detecta mudança para atualizar useCloudState.
  useEffect(() => {
    const interval = setInterval(async () => {
      window.dispatchEvent(new CustomEvent('petvet-sync', { detail: { status: 'syncing' } }))
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
      window.dispatchEvent(new CustomEvent('petvet-sync', { detail: { status: 'synced' } }))
    }, 60000)

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
