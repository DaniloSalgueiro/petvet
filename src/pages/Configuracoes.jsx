import { useState, useEffect, useRef } from 'react'
import { RotateCcw, Save, MessageCircle, History, Settings2, Trash2, Lock, Unlock, Calculator, AlertTriangle, Shield, ShieldOff, ShieldCheck, X, Bell } from 'lucide-react'
import { DEFAULT_PLANOS } from '../lib/planos'
import { SUPORTE_KEY, DEV_LOG_KEY, getSuporteData, isSuporteAtivo, ativarSuporte, revogarSuporte } from '../lib/devAccess'
import SSLogo from '../components/SSLogo'
import { useIdentidade, DEFAULT_IDENTIDADE } from '../context/IdentidadeContext'
import { useAuth } from '../context/AuthContext'
import { DEFAULT_FOLLOWUP_CONFIG } from '../context/FollowupContext'
import { syncToSupabase, syncAll } from '../hooks/useSupabaseSync'
import { uploadIconePWA } from '../lib/supabase'
import { injectManifest } from '../lib/pwa'
import CropModal from '../components/ui/CropModal'
import PhotoUploadButtons from '../components/ui/PhotoUploadButtons'
import ConfirmModal from '../components/ui/ConfirmModal'

export const PLANOS_MODULOS = {
  basico: ['dashboard','pets','prontuario','agenda','configuracoes'],
  plus:   ['dashboard','pets','prontuario','agenda','vacinaprotocolo','bulario','estoque','servicos','configuracoes'],
  pro:    null, // null = todos os módulos
}

export const PLANO_LABELS = {
  basico: 'Básico',
  plus:   'Plus',
  pro:    'Pro',
}

const PLANO_MODULOS_DESCRICAO = {
  basico: ['Dashboard','Pets & Tutores','Prontuário','Agenda'],
  plus:   ['+ Protocolo de Vacinas','Bulário','Estoque','Serviços'],
  pro:    ['+ PDV','Financeiro','Relatórios','Controle de Acesso','Funcionários','Config. Prontuário'],
}

// Todos os módulos disponíveis para configuração de planos
const ALL_MODULES_CONFIG = [
  { id: 'dashboard',         label: 'Dashboard' },
  { id: 'pets',              label: 'Pets & Tutores' },
  { id: 'prontuario',        label: 'Prontuário' },
  { id: 'agenda',            label: 'Agenda' },
  { id: 'estoque',           label: 'Estoque' },
  { id: 'servicos',          label: 'Serviços' },
  { id: 'financeiro',        label: 'Financeiro' },
  { id: 'pdv',               label: 'PDV' },
  { id: 'vacinaprotocolo',   label: 'Protocolo de Vacinas' },
  { id: 'bulario',           label: 'Bulário' },
  { id: 'racas',             label: 'Raças' },
  { id: 'funcionarios',      label: 'Funcionários' },
  { id: 'usuarios',          label: 'Usuários' },
  { id: 'relatorios',        label: 'Relatórios' },
  { id: 'contabilidade',     label: 'Contabilidade' },
  { id: 'crm',               label: 'CRM' },
  { id: 'prontuario-config', label: 'Config. Prontuário' },
  { id: 'configuracoes',     label: 'Configurações' },
]

const DEPENDENCIAS = {
  'prontuario':        ['pets'],
  'pdv':               ['estoque', 'servicos', 'financeiro'],
  'financeiro':        ['pdv'],
  'relatorios':        ['financeiro', 'pets', 'agenda'],
  'contabilidade':     ['financeiro'],
  'crm':               ['pets', 'financeiro', 'pdv'],
  'vacinaprotocolo':   ['pets', 'bulario'],
  'funcionarios':      ['financeiro'],
  'prontuario-config': ['prontuario'],
}

// Hierarquia de planos: módulo no Básico deve estar no Plus e Pro; módulo no Plus deve estar no Pro
function validateHierarquia(draft) {
  const warnings = []
  const basico = draft.basico || []
  const plus   = draft.plus   || []
  for (const id of basico) {
    if (!plus.includes(id)) warnings.push(`"${ALL_MODULES_CONFIG.find(m=>m.id===id)?.label || id}" está no Básico mas não no Plus`)
  }
  // Pro = null = tudo incluído — não precisa checar
  return warnings
}

// Retorna quais módulos dependem de um dado moduleId
function getDependentes(moduleId) {
  return Object.entries(DEPENDENCIAS)
    .filter(([, deps]) => deps.includes(moduleId))
    .map(([mod]) => ALL_MODULES_CONFIG.find(m => m.id === mod)?.label || mod)
}

const DEFAULT_PLANOS_ARRAY = [
  { id: 'basico', nome: 'Básico', cor: '#888888', modulos: [...(DEFAULT_PLANOS.basico || [])] },
  { id: 'plus',   nome: 'Plus',   cor: '#1e40af', modulos: [...(DEFAULT_PLANOS.plus   || [])] },
  { id: 'pro',    nome: 'Pro',    cor: '#27B5AC', modulos: null },
]

function loadPlanosDraft() {
  try {
    const cfg = JSON.parse(localStorage.getItem(SS_CONFIG_KEY) ?? '{}')
    if (Array.isArray(cfg.planos) && cfg.planos.length > 0) return cfg.planos
    if (cfg.planosCustom) return [
      { id: 'basico', nome: 'Básico', cor: '#888888', modulos: cfg.planosCustom.basico || DEFAULT_PLANOS.basico },
      { id: 'plus',   nome: 'Plus',   cor: '#1e40af', modulos: cfg.planosCustom.plus   || DEFAULT_PLANOS.plus   },
      { id: 'pro',    nome: 'Pro',    cor: '#27B5AC', modulos: null },
    ]
    return DEFAULT_PLANOS_ARRAY.map(p => ({ ...p, modulos: p.modulos ? [...p.modulos] : null }))
  } catch {
    return DEFAULT_PLANOS_ARRAY.map(p => ({ ...p, modulos: p.modulos ? [...p.modulos] : null }))
  }
}

function loadNovidades() {
  try { return JSON.parse(localStorage.getItem('petvet-login-novidades') ?? '[]') }
  catch { return [] }
}

function getPlanoNome(planoId) {
  try {
    const cfg = JSON.parse(localStorage.getItem(SS_CONFIG_KEY) ?? '{}')
    if (Array.isArray(cfg.planos)) { const p = cfg.planos.find(pl => pl.id === planoId); if (p) return p.nome }
  } catch {}
  return PLANO_LABELS[planoId] || planoId || 'Pro'
}

// Hierarquia: cada plano deve ter ao menos os módulos do anterior
function validateHierarquiaArr(planos) {
  const warnings = []
  for (let i = 0; i < planos.length - 1; i++) {
    const curr = planos[i]; const next = planos[i + 1]
    if (!curr.modulos || next.modulos === null) continue
    for (const id of curr.modulos)
      if (!next.modulos.includes(id))
        warnings.push(`"${ALL_MODULES_CONFIG.find(m=>m.id===id)?.label||id}" está em "${curr.nome}" mas não em "${next.nome}"`)
  }
  return warnings
}

const FOLLOWUP_KEY       = 'petvet-followup-config'
const FOLLOWUP_QUEUE_KEY = 'petvet-followup-queue'
const SS_CONFIG_KEY      = 'petvet-ss-config'
const DEV_UNLOCKED_KEY   = 'petvet-dev-unlocked-at'
const DEV_TIMEOUT_MS     = 30 * 60 * 1000
const DEV_PASSWORD_KEY   = 'petvet-dev-password'

// Senha padrão como char codes — não aparece em texto claro no bundle
const SENHA_PADRAO = [100,78,76,64,56,57,48,49].map(c => String.fromCharCode(c)).join('')

function getDevPwdHash() {
  // Lê direto de petvet-dev-password (string btoa).
  // Fallback: btoa da senha padrão.
  return localStorage.getItem(DEV_PASSWORD_KEY) || btoa(SENHA_PADRAO)
}

function checkDevPwd(pwd) {
  return btoa(pwd) === getDevPwdHash()
}

function initDevPassword() {
  if (!localStorage.getItem(DEV_PASSWORD_KEY)) {
    localStorage.setItem(DEV_PASSWORD_KEY, btoa(SENHA_PADRAO))
  }
}

function loadSsConfig() {
  const defaults = {
    nome: 'Salgueiro Systems', versao: 'v1.0.0',
    descricao: 'Sistema completo de gestão para petshops e clínicas veterinárias. Desenvolvido por Salgueiro Systems para oferecer controle total de prontuários, agendamentos, estoque, PDV e financeiro.',
    poweredBy: 'Salgueiro Systems', logo: null,
    site: '', whatsapp: '', email: '',
  }
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(SS_CONFIG_KEY) ?? '{}') } }
  catch { return { ...defaults } }
}
function isDevUnlocked() {
  const ts = sessionStorage.getItem(DEV_UNLOCKED_KEY)
  return !!ts && Date.now() - Number(ts) < DEV_TIMEOUT_MS
}
function devMinLeft() {
  const ts = sessionStorage.getItem(DEV_UNLOCKED_KEY)
  if (!ts) return 0
  return Math.max(0, Math.ceil((DEV_TIMEOUT_MS - (Date.now() - Number(ts))) / 60000))
}
const TEMPO_OPTIONS = [
  { value: 30,   label: '30 minutos' },
  { value: 60,   label: '1 hora' },
  { value: 120,  label: '2 horas' },
  { value: 1440, label: '24 horas' },
]

const FISCAL_KEY = 'petvet-config-fiscal'
const DEFAULT_FISCAL = {
  regimeTributario: 'simples', tipoAtividade: 'misto',
  cnpj: '', inscricaoEstadual: '', inscricaoMunicipal: '', cnae: '',
  aliquotaISS: 5, aliquotaICMS: 12, aliquotaPIS: 0.65,
  aliquotaCOFINS: 3, aliquotaCSLL: 9, aliquotaIRPJ: 15,
  emissaoNF: 'nao_emite', numContador: '',
}
function loadFiscalConfig() {
  try { return { ...DEFAULT_FISCAL, ...JSON.parse(localStorage.getItem(FISCAL_KEY) ?? '{}') } }
  catch { return { ...DEFAULT_FISCAL } }
}
function maskCNPJ(v) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})$/, '$1.$2.$3/$4')
    .replace(/^(\d{2})(\d{3})(\d{3})$/, '$1.$2.$3/')
    .replace(/^(\d{2})(\d{3})$/, '$1.$2.')
    .replace(/^(\d{2})$/, '$1.')
}

const ALERTAS_KEY = 'petvet-config-alertas'
const DEFAULT_ALERTAS_CONFIG = {
  antecedencias: [1, 3, 7],
  canalSistema: true,
  canalBanner: false,
  canalWhatsapp: false,
  whatsappNumero: '',
  horario: '09:00',
  repetirVencidas: 'Todo dia',
}
function loadAlertasConfig() {
  try { return { ...DEFAULT_ALERTAS_CONFIG, ...JSON.parse(localStorage.getItem(ALERTAS_KEY) ?? '{}') } }
  catch { return { ...DEFAULT_ALERTAS_CONFIG } }
}


function loadFollowupConfig() {
  try { return { ...DEFAULT_FOLLOWUP_CONFIG, ...JSON.parse(localStorage.getItem(FOLLOWUP_KEY) ?? '{}') } }
  catch { return { ...DEFAULT_FOLLOWUP_CONFIG } }
}
function loadFollowupQueue() {
  try { return JSON.parse(localStorage.getItem(FOLLOWUP_QUEUE_KEY) ?? '[]') } catch { return [] }
}
function fmtDT(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}


export default function ConfiguracoesPage() {
  const { identidade, setIdentidade, resetIdentidade } = useIdentidade()
  const { hasRole, user } = useAuth()
  const [draft, setDraft] = useState(() => ({ ...identidade }))
  const [cropSrc, setCropSrc] = useState(null)
  const [cropField, setCropField] = useState(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [pwaSavedMsg, setPwaSavedMsg] = useState(false)
  const [followupCfg, setFollowupCfg] = useState(loadFollowupConfig)
  const [followupSaved, setFollowupSaved] = useState(false)
  const [followupTab, setFollowupTab] = useState('config')
  const [histFilter, setHistFilter] = useState({ from: '', to: '' })
  const [queue, setQueue] = useState(loadFollowupQueue)
  const [newLinkGoogle, setNewLinkGoogle] = useState('')
  const [newLinkInsta, setNewLinkInsta] = useState('')
  const [ssCfg, setSsCfg] = useState(loadSsConfig)
  const [ssSaved, setSsSaved] = useState(false)
  const [devUnlocked, setDevUnlocked] = useState(isDevUnlocked)
  const [devMinutes, setDevMinutes] = useState(devMinLeft)
  const [showDevModal, setShowDevModal] = useState(false)
  const [devPwd, setDevPwd] = useState('')
  const [devPwdError, setDevPwdError] = useState('')
  const [devToast, setDevToast] = useState(false)
  const [changePwd, setChangePwd] = useState({ atual: '', nova: '', confirma: '' })
  const [changePwdMsg, setChangePwdMsg] = useState('')
  const [ssCropSrc, setSsCropSrc] = useState(null)
  const ssLogoInputRef = useRef(null)
  const [fiscalCfg, setFiscalCfg] = useState(loadFiscalConfig)
  const [fiscalSaved, setFiscalSaved] = useState(false)
  const [alertasCfg, setAlertasCfg] = useState(loadAlertasConfig)
  const [alertasSaved, setAlertasSaved] = useState(false)
  const [devTab, setDevTab] = useState('config')
  const [planosDraft, setPlanosDraft] = useState(loadPlanosDraft)
  const [planosSaved, setPlanosSaved] = useState(false)
  const [depWarnings, setDepWarnings] = useState([])
  const [showDepModal, setShowDepModal] = useState(false)
  const [pendingSavePlanos, setPendingSavePlanos] = useState(false)
  const [novidades, setNovidades] = useState(loadNovidades)
  const [novidadesSaved, setNovidadesSaved] = useState(false)
  const [syncCloudMsg, setSyncCloudMsg] = useState('')
  const [showResetPwdConfirm, setShowResetPwdConfirm] = useState(false)
  const [resetPwdMsg, setResetPwdMsg] = useState('')
  const [suporteData, setSuporteData] = useState(getSuporteData)
  const [devLog, setDevLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem(DEV_LOG_KEY) ?? '[]') } catch { return [] }
  })

  // Ref para guardar a identidade salva mais recente (usada no cleanup)
  const savedRef = useRef(identidade)
  useEffect(() => { savedRef.current = identidade }, [identidade])

  // Inicializa draft quando identidade do contexto mudar externamente
  useEffect(() => {
    setDraft(prev => ({ ...prev }))
  }, []) // só na montagem

  // Aplica cores em tempo real a partir do draft
  useEffect(() => {
    document.documentElement.style.setProperty('--teal', draft.corPrimaria)
    document.documentElement.style.setProperty('--magenta', draft.corDestaque)
  }, [draft.corPrimaria, draft.corDestaque])

  // Ao desmontar (navegar sem salvar), reverte para as cores salvas
  useEffect(() => {
    return () => {
      document.documentElement.style.setProperty('--teal', savedRef.current.corPrimaria)
      document.documentElement.style.setProperty('--magenta', savedRef.current.corDestaque)
    }
  }, [])

  // Garante que a senha padrão existe no localStorage na primeira montagem
  useEffect(() => { initDevPassword() }, [])

  // Timer: verifica expiração do acesso dev a cada 60s
  useEffect(() => {
    if (!devUnlocked) return
    const id = setInterval(() => {
      if (!isDevUnlocked()) {
        sessionStorage.removeItem(DEV_UNLOCKED_KEY)
        setDevUnlocked(false)
        setDevToast(true)
        setTimeout(() => setDevToast(false), 4500)
      } else {
        setDevMinutes(devMinLeft())
      }
    }, 60000)
    return () => clearInterval(id)
  }, [devUnlocked])

  function handleSave() {
    setIdentidade({ ...draft })
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2500)
  }

  async function handleSavePWA() {
    const updated = { ...draft }

    if (updated.iconePWA?.startsWith('data:image')) {
      const url = await uploadIconePWA(updated.iconePWA)
      if (url) updated.iconePWAUrl = url
    } else if (!updated.iconePWA) {
      updated.iconePWAUrl = null
    }

    setIdentidade(updated)
    setDraft(updated)
    await syncToSupabase('petvet-identidade', updated)
    injectManifest(updated)

    setPwaSavedMsg(true)
    setTimeout(() => setPwaSavedMsg(false), 6000)
  }

  function handleReset() {
    resetIdentidade()
    setDraft({ ...DEFAULT_IDENTIDADE })
    setShowResetConfirm(false)
  }

  async function handleSyncAll() {
    setSyncCloudMsg('Sincronizando...')
    const { sucesso, erro } = await syncAll()
    setSyncCloudMsg(erro === 0 ? `✓ ${sucesso} chaves sincronizadas` : `⚠️ ${sucesso} ok, ${erro} erros`)
    setTimeout(() => setSyncCloudMsg(''), 4000)
  }

  function handleSaveFollowup() {
    localStorage.setItem(FOLLOWUP_KEY, JSON.stringify(followupCfg))
    setFollowupSaved(true)
    setTimeout(() => setFollowupSaved(false), 2500)
  }

  function setCfg(field, value) { setFollowupCfg(c => ({ ...c, [field]: value })) }

  function addLinkGoogle() {
    const v = newLinkGoogle.trim()
    if (!v) return
    setCfg('linksGoogle', [...(followupCfg.linksGoogle || []), v])
    setNewLinkGoogle('')
  }
  function removeLinkGoogle(i) { setCfg('linksGoogle', followupCfg.linksGoogle.filter((_, idx) => idx !== i)) }

  function addLinkInsta() {
    const v = newLinkInsta.trim()
    if (!v) return
    setCfg('linksInstagram', [...(followupCfg.linksInstagram || []), v])
    setNewLinkInsta('')
  }
  function removeLinkInsta(i) { setCfg('linksInstagram', followupCfg.linksInstagram.filter((_, idx) => idx !== i)) }

  function buildPreview() {
    let identidade = {}
    try { identidade = JSON.parse(localStorage.getItem('petvet-identidade') ?? '{}') } catch {}
    const clinica = identidade.nomeP || draft.nomeP || 'Emporium Vazpet'
    const g = (followupCfg.linksGoogle || []).join('\n') || '(links do Google aqui)'
    const i = (followupCfg.linksInstagram || []).join('\n') || '(links do Instagram aqui)'
    return (followupCfg.mensagemModelo || '')
      .replace(/\{tutor\}/g, 'João')
      .replace(/\{pet\}/g, 'Rex')
      .replace(/\{clinica\}/g, clinica)
      .replace(/\{links_google\}/g, g)
      .replace(/\{links_instagram\}/g, i)
  }

  function getHistoricoFiltrado() {
    let list = queue.filter(q => q.enviado)
    if (histFilter.from) list = list.filter(q => q.enviadoEm && q.enviadoEm >= histFilter.from)
    if (histFilter.to)   list = list.filter(q => q.enviadoEm && q.enviadoEm <= histFilter.to + 'T23:59:59')
    return list.sort((a, b) => (b.enviadoEm || '').localeCompare(a.enviadoEm || ''))
  }

  function handleReenviar(item) {
    let identidade = {}
    try { identidade = JSON.parse(localStorage.getItem('petvet-identidade') ?? '{}') } catch {}
    const cfg = loadFollowupConfig()
    const clinica = identidade.nomeP || 'Emporium Vazpet'
    const g = (cfg.linksGoogle || []).join('\n')
    const i = (cfg.linksInstagram || []).join('\n')
    const msg = (cfg.mensagemModelo || '')
      .replace(/\{tutor\}/g, item.tutorNome || 'Tutor')
      .replace(/\{pet\}/g, item.petNome || 'Pet')
      .replace(/\{clinica\}/g, clinica)
      .replace(/\{links_google\}/g, g)
      .replace(/\{links_instagram\}/g, i)
    const digits = (item.tutorTelefone || '').replace(/\D/g, '')
    const phone = digits.startsWith('55') && digits.length >= 12 ? digits : '55' + digits
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  async function handleSaveSsCfg() {
    const toSave = { ...ssCfg, _updatedAt: Date.now() }
    setSsCfg(toSave)
    localStorage.setItem(SS_CONFIG_KEY, JSON.stringify(toSave))
    window.dispatchEvent(new Event('petvet-ss-updated'))
    await syncToSupabase(SS_CONFIG_KEY, toSave)
    setSsSaved(true)
    setTimeout(() => setSsSaved(false), 2500)
  }

  function doSavePlanos() {
    const prev = JSON.parse(localStorage.getItem(SS_CONFIG_KEY) ?? '{}')
    localStorage.setItem(SS_CONFIG_KEY, JSON.stringify({ ...prev, planos: planosDraft }))
    window.dispatchEvent(new Event('petvet-ss-updated'))
    setPlanosSaved(true)
    setTimeout(() => setPlanosSaved(false), 2500)
    setShowDepModal(false)
    setPendingSavePlanos(false)
  }

  function handleSavePlanos() {
    const warnings = validateHierarquiaArr(planosDraft)
    if (warnings.length > 0) { setDepWarnings(warnings); setShowDepModal(true); setPendingSavePlanos(true); return }
    doSavePlanos()
  }

  function handleSaveNovidades() {
    localStorage.setItem('petvet-login-novidades', JSON.stringify(novidades))
    window.dispatchEvent(new Event('petvet-novidades-updated'))
    setNovidadesSaved(true)
    setTimeout(() => setNovidadesSaved(false), 2500)
  }

  function toggleModuloPlano(planoIdx, moduleId, checked) {
    setPlanosDraft(prev => {
      const arr = [...prev]
      const p = { ...arr[planoIdx] }
      if (p.modulos === null) return prev
      const mods = [...p.modulos]
      if (checked) { if (!mods.includes(moduleId)) mods.push(moduleId) }
      else { const idx = mods.indexOf(moduleId); if (idx > -1) mods.splice(idx, 1) }
      p.modulos = mods; arr[planoIdx] = p; return arr
    })
  }

  function handleSaveFiscal() {
    localStorage.setItem(FISCAL_KEY, JSON.stringify(fiscalCfg))
    setFiscalSaved(true)
    setTimeout(() => setFiscalSaved(false), 2500)
  }

  function toggleAntecedencia(dias) {
    setAlertasCfg(c => {
      const atual = c.antecedencias || []
      const novo = atual.includes(dias) ? atual.filter(d => d !== dias) : [...atual, dias].sort((a, b) => a - b)
      return { ...c, antecedencias: novo }
    })
  }

  function handleSaveAlertas() {
    localStorage.setItem(ALERTAS_KEY, JSON.stringify(alertasCfg))
    window.dispatchEvent(new CustomEvent('supabase-sync', { detail: { key: ALERTAS_KEY } }))
    setAlertasSaved(true)
    setTimeout(() => setAlertasSaved(false), 2500)
  }

  function handleAtivarSuporte() {
    const data = ativarSuporte(user?.name || 'admin')
    setSuporteData(data)
  }

  function handleRevogarSuporte() {
    revogarSuporte()
    setSuporteData(getSuporteData())
  }

  function refreshDevLog() {
    try { setDevLog(JSON.parse(localStorage.getItem(DEV_LOG_KEY) ?? '[]')) } catch {}
  }

  function handleDevAuth() {
    if (checkDevPwd(devPwd)) {
      sessionStorage.setItem(DEV_UNLOCKED_KEY, String(Date.now()))
      setDevUnlocked(true)
      setDevMinutes(30)
      setShowDevModal(false)
      setDevPwd('')
      setDevPwdError('')
    } else {
      setDevPwdError('Senha incorreta. Tente a senha padrão ou use "Resetar para padrão".')
      setDevPwd('')
    }
  }

  function handleDevLock() {
    sessionStorage.removeItem(DEV_UNLOCKED_KEY)
    setDevUnlocked(false)
    setDevMinutes(0)
  }

  function handleResetDevPwd() {
    localStorage.setItem(DEV_PASSWORD_KEY, btoa(SENHA_PADRAO))
    setShowResetPwdConfirm(false)
    setResetPwdMsg('✓ Senha resetada para o padrão. Use a senha padrão para entrar.')
    setTimeout(() => setResetPwdMsg(''), 6000)
  }

  function handleChangeDevPwd() {
    if (!checkDevPwd(changePwd.atual)) { setChangePwdMsg('Senha atual incorreta'); return }
    if (changePwd.nova.length < 8) { setChangePwdMsg('Nova senha deve ter pelo menos 8 caracteres'); return }
    if (changePwd.nova !== changePwd.confirma) { setChangePwdMsg('Nova senha e confirmação não coincidem'); return }
    localStorage.setItem(DEV_PASSWORD_KEY, btoa(changePwd.nova))
    setChangePwd({ atual: '', nova: '', confirma: '' })
    setChangePwdMsg('✓ Senha alterada com sucesso')
    setTimeout(() => setChangePwdMsg(''), 3500)
  }

  function handleSsLogoFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => setSsCropSrc(e.target.result)
    reader.readAsDataURL(file)
  }

  function handleLogoFile(field, file) {
    const reader = new FileReader()
    reader.onload = e => { setCropSrc(e.target.result); setCropField(field) }
    reader.readAsDataURL(file)
  }

  function set(field, value) {
    setDraft(d => ({ ...d, [field]: value }))
  }

  return (
    <div className="page cfg-page-scroll">
      <div className="page-header cfg-page-header">
        <div>
          <h2 className="page-title">Configurações</h2>
          <p className="page-subtitle">Identidade visual e preferências do sistema</p>
        </div>
        <div className="cfg-action-row">
          <button className="btn btn-outline btn-sm" onClick={() => setShowResetConfirm(true)}>
            <RotateCcw size={14} /> Restaurar padrões
          </button>
          <button className="btn btn-outline btn-sm" onClick={handleSyncAll} title="Enviar todos os dados do navegador para o Supabase">
            ☁️ {syncCloudMsg || 'Sincronizar nuvem'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>
            <Save size={14} /> {savedMsg ? 'Salvo!' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      {/* Preview em tempo real */}
      <div className="card" style={{ padding: '20px' }}>
        <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: 16 }}>
          Preview em tempo real
        </p>
        <div className="cfg-preview-row">
          <div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>Sidebar</p>
            <SidebarPreview draft={draft} />
          </div>
          <div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>Tela de login</p>
            <LoginPreview draft={draft} />
          </div>
        </div>
      </div>

      {/* Texto e identidade */}
      <div className="card" style={{ padding: '20px' }}>
        <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: 16 }}>
          Texto e identidade
        </p>
        <div className="cfg-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
          <div className="form-group">
            <label className="form-label">Nome principal</label>
            <input
              className="form-input"
              value={draft.nomeP}
              onChange={e => set('nomeP', e.target.value)}
              placeholder="Ex: Emporium Vazpet"
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sidebar, login e aba do browser</span>
          </div>
          <div className="form-group">
            <label className="form-label">Nome secundário / subtítulo</label>
            <input
              className="form-input"
              value={draft.nomeS}
              onChange={e => set('nomeS', e.target.value)}
              placeholder="Ex: + Tatá Bichos"
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Abaixo do nome principal</span>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Slogan / tagline</label>
            <input
              className="form-input"
              value={draft.slogan}
              onChange={e => set('slogan', e.target.value)}
              placeholder="Ex: Sistema de gestão"
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Exibido abaixo do subtítulo na tela de login</span>
          </div>
        </div>
      </div>

      {/* Logos */}
      <div className="card" style={{ padding: '20px' }}>
        <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: 4 }}>Logos</p>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 16 }}>
          Usadas na sidebar, tela de login e documentos impressos. Independentes do ícone do app.
        </p>
        <div className="cfg-logos-grid cfg-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
          {[
            { field: 'logoP', label: 'Logo principal (Emporium Vazpet)' },
            { field: 'logoS', label: 'Logo secundária (Tatá Bichos)' },
          ].map(({ field, label }) => (
            <div key={field} className="form-group">
              <label className="form-label">{label}</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {draft[field] && (
                  <img
                    src={draft[field]}
                    alt={label}
                    style={{ height: 52, maxWidth: 120, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0 }}
                  />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <PhotoUploadButtons
                    onFile={file => handleLogoFile(field, file)}
                    hasPhoto={!!draft[field]}
                    label="logo"
                  />
                  {draft[field] && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => set(field, null)}
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* App PWA */}
      <div className="card" style={{ padding: '20px' }}>
        <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: 4 }}>
          📱 Configurações do App (PWA)
        </p>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 16 }}>
          Aparece quando o app é instalado na tela inicial do celular
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Nomes */}
          <div className="cfg-grid-2-sm" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nome completo do app</label>
              <input
                className="form-input"
                value={draft.nomeCompleto ?? draft.nomeP ?? ''}
                onChange={e => set('nomeCompleto', e.target.value)}
                placeholder="Ex: Emporium Vazpet + Tatá Bichos"
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Exibido ao instalar e nas configurações do celular</span>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Nome abreviado
                <span style={{ fontSize: '0.72rem', fontWeight: 400, color: (draft.nomeAbreviado?.length ?? 0) > 10 ? 'var(--danger)' : 'var(--text-muted)' }}>
                  ({draft.nomeAbreviado?.length ?? 0}/12)
                </span>
              </label>
              <input
                className="form-input"
                value={draft.nomeAbreviado ?? ''}
                onChange={e => set('nomeAbreviado', e.target.value.slice(0, 12))}
                placeholder="Ex: PetVet"
                maxLength={12}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Aparece embaixo do ícone na tela inicial</span>
            </div>
          </div>

          {/* Cor do tema */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Cor do tema</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="color"
                value={draft.corPrimaria}
                onChange={e => set('corPrimaria', e.target.value)}
                style={{ width: 44, height: 44, border: '1.5px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 3, flexShrink: 0 }}
              />
              <input
                className="form-input"
                value={draft.corPrimaria}
                onChange={e => set('corPrimaria', e.target.value)}
                placeholder="#27B5AC"
                style={{ fontFamily: 'monospace', maxWidth: 140 }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Aparece na barra de status do celular quando o app está aberto</span>
            </div>
          </div>

          {/* Ícone do app */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Ícone do app</label>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              Exclusivo para o ícone na tela inicial do celular. Independente das logos do sistema.
              {!draft.iconePWA && !draft.iconePWAUrl && draft.logoP && (
                <span style={{ color: 'var(--teal-dark)', fontStyle: 'italic' }}> (usando logo principal como fallback)</span>
              )}
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {(draft.iconePWAUrl || draft.iconePWA) ? (
                <img
                  src={draft.iconePWAUrl || draft.iconePWA}
                  alt="Ícone do app"
                  style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 12, border: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface-2)' }}
                />
              ) : draft.logoP ? (
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img
                    src={draft.logoP}
                    alt="Fallback: logo principal"
                    style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 12, border: `2px dashed ${draft.corPrimaria}`, background: 'var(--surface-2)', opacity: 0.6 }}
                  />
                  <span style={{ position: 'absolute', bottom: -6, left: 0, right: 0, textAlign: 'center', fontSize: '0.6rem', color: 'var(--text-muted)' }}>fallback</span>
                </div>
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: 12, background: `${draft.corPrimaria}22`, border: `2px dashed ${draft.corPrimaria}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', flexShrink: 0 }}>
                  📱
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <PhotoUploadButtons
                  onFile={file => handleLogoFile('iconePWA', file)}
                  hasPhoto={!!draft.iconePWA}
                  label="ícone"
                />
                {(draft.iconePWA || draft.iconePWAUrl) && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--danger)' }}
                    onClick={() => { set('iconePWA', null); set('iconePWAUrl', null) }}
                  >
                    Remover ícone
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Botão salvar dedicado */}
          <div className="cfg-action-row" style={{ justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            {pwaSavedMsg && (
              <span style={{ fontSize: '0.8125rem', color: '#276749', flex: 1 }}>
                ✅ Salvo! Reinstale o app na tela inicial para aplicar o novo ícone.
              </span>
            )}
            <button className="btn btn-primary btn-sm" onClick={handleSavePWA}>
              <Save size={14} /> Salvar e sincronizar
            </button>
          </div>
        </div>
      </div>

      {/* Cores */}
      <div className="card" style={{ padding: '20px' }}>
        <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: 4 }}>
          Cores do sistema
        </p>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 16 }}>
          Aplicadas em toda a interface em tempo real ao alterar
        </p>
        <div className="cfg-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
          <div className="form-group">
            <label className="form-label">Cor primária</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="color"
                value={draft.corPrimaria}
                onChange={e => set('corPrimaria', e.target.value)}
                style={{ width: 44, height: 44, border: '1.5px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 3, flexShrink: 0 }}
              />
              <input
                className="form-input"
                value={draft.corPrimaria}
                onChange={e => set('corPrimaria', e.target.value)}
                placeholder="#27B5AC"
                style={{ fontFamily: 'monospace' }}
              />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Atualiza --teal em tempo real</span>
          </div>
          <div className="form-group">
            <label className="form-label">Cor de destaque</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="color"
                value={draft.corDestaque}
                onChange={e => set('corDestaque', e.target.value)}
                style={{ width: 44, height: 44, border: '1.5px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 3, flexShrink: 0 }}
              />
              <input
                className="form-input"
                value={draft.corDestaque}
                onChange={e => set('corDestaque', e.target.value)}
                placeholder="#DE098D"
                style={{ fontFamily: 'monospace' }}
              />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Atualiza --magenta em tempo real</span>
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1, height: 10, borderRadius: 5, background: `linear-gradient(90deg, ${draft.corPrimaria}, ${draft.corDestaque})` }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Gradiente aplicado</span>
        </div>
      </div>

      {/* Follow-up Pós-Consulta */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: 2 }}>Follow-up Pós-Consulta</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Envio automático de mensagem WhatsApp após consulta concluída</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`btn btn-sm ${followupTab === 'config' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFollowupTab('config')}
            >
              <Settings2 size={14} /> Configurar
            </button>
            <button
              className={`btn btn-sm ${followupTab === 'historico' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setFollowupTab('historico'); setQueue(loadFollowupQueue()) }}
            >
              <History size={14} /> Histórico
            </button>
          </div>
        </div>

        {followupTab === 'config' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Toggle ativo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                <div
                  onClick={() => setCfg('ativo', !followupCfg.ativo)}
                  style={{
                    width: 44, height: 24, borderRadius: 12,
                    background: followupCfg.ativo ? 'var(--teal)' : 'var(--border)',
                    position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3, left: followupCfg.ativo ? 23 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.25)',
                  }} />
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {followupCfg.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 24, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={followupCfg.somAtivo}
                  onChange={e => setCfg('somAtivo', e.target.checked)}
                />
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Som de notificação</span>
              </label>
            </div>

            {/* Tempo */}
            <div className="form-group" style={{ maxWidth: 260 }}>
              <label className="form-label">Enviar após conclusão</label>
              <select
                className="form-input"
                value={followupCfg.tempoMinutos}
                onChange={e => setCfg('tempoMinutos', Number(e.target.value))}
              >
                {TEMPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Links Google */}
            <div className="form-group">
              <label className="form-label">Links do Google (avaliações)</label>
              {(followupCfg.linksGoogle || []).map((l, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeLinkGoogle(i)} style={{ color: 'var(--danger)', padding: '2px 6px' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input
                  className="form-input"
                  placeholder="https://g.page/r/..."
                  value={newLinkGoogle}
                  onChange={e => setNewLinkGoogle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addLinkGoogle()}
                />
                <button className="btn btn-outline btn-sm" onClick={addLinkGoogle}>Adicionar</button>
              </div>
            </div>

            {/* Links Instagram */}
            <div className="form-group">
              <label className="form-label">Links do Instagram</label>
              {(followupCfg.linksInstagram || []).map((l, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeLinkInsta(i)} style={{ color: 'var(--danger)', padding: '2px 6px' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input
                  className="form-input"
                  placeholder="https://instagram.com/..."
                  value={newLinkInsta}
                  onChange={e => setNewLinkInsta(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addLinkInsta()}
                />
                <button className="btn btn-outline btn-sm" onClick={addLinkInsta}>Adicionar</button>
              </div>
            </div>

            {/* Mensagem modelo */}
            <div className="form-group">
              <label className="form-label">Mensagem modelo</label>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                Variáveis: <code>{'{tutor}'}</code> <code>{'{pet}'}</code> <code>{'{clinica}'}</code> <code>{'{links_google}'}</code> <code>{'{links_instagram}'}</code>
              </p>
              <textarea
                className="form-input"
                rows={7}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
                value={followupCfg.mensagemModelo}
                onChange={e => setCfg('mensagemModelo', e.target.value)}
              />
            </div>

            {/* Preview */}
            <div>
              <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Preview (tutor: João, pet: Rex)</p>
              <div style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8,
                padding: '12px 14px', fontSize: '0.8125rem', color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap', lineHeight: 1.6,
              }}>
                {buildPreview()}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary btn-sm" onClick={handleSaveFollowup}>
                <Save size={14} /> {followupSaved ? 'Salvo!' : 'Salvar configuração'}
              </button>
            </div>
          </div>
        )}

        {followupTab === 'historico' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Filtro por período */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">De</label>
                <input type="date" className="form-input" style={{ width: 150 }} value={histFilter.from} onChange={e => setHistFilter(f => ({ ...f, from: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Até</label>
                <input type="date" className="form-input" style={{ width: 150 }} value={histFilter.to} onChange={e => setHistFilter(f => ({ ...f, to: e.target.value }))} />
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setHistFilter({ from: '', to: '' })}>Limpar</button>
            </div>

            {getHistoricoFiltrado().length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Nenhum follow-up enviado no período
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      {['Tutor', 'Pet', 'Concluído em', 'Enviado em', 'Enviado por', ''].map(h => (
                        <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getHistoricoFiltrado().map(item => (
                      <tr key={item.agendamentoId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>{item.tutorNome || '—'}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>{item.petNome || '—'}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{fmtDT(item.concluidoEm)}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{fmtDT(item.enviadoEm)}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{item.enviadoPor || '—'}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleReenviar(item)} title="Reenviar WhatsApp">
                            <MessageCircle size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Configurações Fiscais e Contábeis */}
      {(hasRole('admin')) && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Calculator size={18} style={{ color: 'var(--teal)' }} />
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', margin: 0 }}>
                Configurações Fiscais e Contábeis
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>Admin only — usado pelo módulo Contabilidade</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 1. Regime Tributário */}
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 10 }}>1. Regime Tributário</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { val: 'mei',              label: 'MEI — Microempreendedor Individual' },
                  { val: 'simples',          label: 'Simples Nacional' },
                  { val: 'lucro_presumido',  label: 'Lucro Presumido' },
                  { val: 'lucro_real',       label: 'Lucro Real' },
                  { val: 'isento',           label: 'Isento / Sem fins lucrativos' },
                ].map(opt => (
                  <label key={opt.val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input type="radio" name="regime" value={opt.val}
                      checked={fiscalCfg.regimeTributario === opt.val}
                      onChange={() => setFiscalCfg(f => ({ ...f, regimeTributario: opt.val }))}/>
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* 2. Tipo de Atividade */}
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 10 }}>2. Tipo de Atividade</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { val: 'servicos', label: 'Prestação de Serviços (ISS)' },
                  { val: 'comercio', label: 'Comércio (ICMS)' },
                  { val: 'misto',    label: 'Misto — Serviços + Comércio' },
                ].map(opt => (
                  <label key={opt.val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input type="radio" name="atividade" value={opt.val}
                      checked={fiscalCfg.tipoAtividade === opt.val}
                      onChange={() => setFiscalCfg(f => ({ ...f, tipoAtividade: opt.val }))}/>
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* 3. Dados Fiscais */}
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 10 }}>3. Dados Fiscais</p>
              <div className="cfg-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">CNPJ</label>
                  <input className="form-input" value={fiscalCfg.cnpj}
                    onChange={e => setFiscalCfg(f => ({ ...f, cnpj: maskCNPJ(e.target.value) }))}
                    placeholder="00.000.000/0000-00" maxLength={18}/>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Inscrição Estadual</label>
                  <input className="form-input" value={fiscalCfg.inscricaoEstadual}
                    onChange={e => setFiscalCfg(f => ({ ...f, inscricaoEstadual: e.target.value }))}
                    placeholder="Inscrição Estadual"/>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Inscrição Municipal</label>
                  <input className="form-input" value={fiscalCfg.inscricaoMunicipal}
                    onChange={e => setFiscalCfg(f => ({ ...f, inscricaoMunicipal: e.target.value }))}
                    placeholder="Inscrição Municipal"/>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">CNAE (código da atividade)</label>
                  <input className="form-input" value={fiscalCfg.cnae}
                    onChange={e => setFiscalCfg(f => ({ ...f, cnae: e.target.value }))}
                    placeholder="Ex: 7500-1/00"/>
                </div>
              </div>
              {/* Alíquotas: 2 colunas mesmo em mobile (campos curtos) */}
              <div className="cfg-aliq-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', marginTop: 12 }}>
                {[
                  { field: 'aliquotaISS',    label: 'Alíquota ISS %',    def: 5     },
                  { field: 'aliquotaICMS',   label: 'Alíquota ICMS %',   def: 12    },
                  { field: 'aliquotaPIS',    label: 'Alíquota PIS %',    def: 0.65  },
                  { field: 'aliquotaCOFINS', label: 'Alíquota COFINS %', def: 3     },
                  { field: 'aliquotaCSLL',   label: 'Alíquota CSLL %',   def: 9     },
                  { field: 'aliquotaIRPJ',   label: 'Alíquota IRPJ %',   def: 15    },
                ].map(f => (
                  <div key={f.field} className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{f.label}</label>
                    <input type="number" step="0.01" min={0} max={100} className="form-input"
                      value={fiscalCfg[f.field] ?? f.def}
                      onChange={e => setFiscalCfg(c => ({ ...c, [f.field]: Number(e.target.value) }))}
                      placeholder={String(f.def)}/>
                  </div>
                ))}
              </div>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">WhatsApp do contador</label>
                <input className="form-input" value={fiscalCfg.numContador || ''}
                  onChange={e => setFiscalCfg(f => ({ ...f, numContador: e.target.value }))}
                  placeholder="(11) 99999-9999"/>
              </div>
            </div>

            {/* 4. Emissão de Nota Fiscal */}
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 10 }}>4. Emissão de Nota Fiscal</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { val: 'nao_emite', label: 'Não emite nota fiscal' },
                  { val: 'nfse',      label: 'NFS-e (Nota Fiscal de Serviço Eletrônica)' },
                  { val: 'nfe',       label: 'NF-e (Nota Fiscal de Produto)' },
                  { val: 'nfce',      label: 'NFC-e (Nota Fiscal ao Consumidor)' },
                  { val: 'cupom',     label: 'Cupom Fiscal' },
                ].map(opt => (
                  <label key={opt.val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input type="radio" name="emissaoNF" value={opt.val}
                      checked={fiscalCfg.emissaoNF === opt.val}
                      onChange={() => setFiscalCfg(f => ({ ...f, emissaoNF: opt.val }))}/>
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="cfg-action-row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
              {fiscalSaved && (
                <span style={{ fontSize: '0.8125rem', color: '#276749' }}>✓ Configurações fiscais salvas!</span>
              )}
              <button className="btn btn-primary btn-sm" onClick={handleSaveFiscal}>
                <Save size={14} /> Salvar configurações fiscais
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alertas de Pagamentos */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Bell size={18} style={{ color: 'var(--teal)' }} />
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', margin: 0 }}>
              Alertas de Pagamentos
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>Notificações de contas a pagar e a receber</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 1. Antecedência */}
          <div>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 10 }}>1. Avisar com quantos dias de antecedência</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[1, 3, 7, 15, 30].map(dias => {
                const ativo = (alertasCfg.antecedencias || []).includes(dias)
                return (
                  <button key={dias} type="button" onClick={() => toggleAntecedencia(dias)}
                    className={`btn btn-sm ${ativo ? 'btn-primary' : 'btn-outline'}`}>
                    {dias} {dias === 1 ? 'dia' : 'dias'} antes
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. Canais de notificação */}
          <div>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 10 }}>2. Canais de notificação</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'not-allowed', userSelect: 'none', opacity: 0.7 }}>
                <div style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: 'var(--teal)',
                  position: 'relative', flexShrink: 0,
                }}>
                  <div style={{ position: 'absolute', top: 3, left: 23, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Sino do sistema (sempre ativo)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                <div onClick={() => setAlertasCfg(c => ({ ...c, canalBanner: !c.canalBanner }))} style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: alertasCfg.canalBanner ? 'var(--teal)' : 'var(--border)',
                  position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0,
                }}>
                  <div style={{ position: 'absolute', top: 3, left: alertasCfg.canalBanner ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Banner no painel</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                <div onClick={() => setAlertasCfg(c => ({ ...c, canalWhatsapp: !c.canalWhatsapp }))} style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: alertasCfg.canalWhatsapp ? 'var(--teal)' : 'var(--border)',
                  position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0,
                }}>
                  <div style={{ position: 'absolute', top: 3, left: alertasCfg.canalWhatsapp ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>WhatsApp</span>
              </label>

              {alertasCfg.canalWhatsapp && (
                <div className="form-group" style={{ marginBottom: 0, marginLeft: 54 }}>
                  <label className="form-label">Número do WhatsApp</label>
                  <input className="form-input" value={alertasCfg.whatsappNumero || ''}
                    onChange={e => setAlertasCfg(c => ({ ...c, whatsappNumero: e.target.value }))}
                    placeholder="(11) 99999-9999"/>
                </div>
              )}
            </div>
          </div>

          {/* 3 e 4. Horário e repetição */}
          <div className="cfg-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">3. Horário do aviso diário</label>
              <input type="time" className="form-input" value={alertasCfg.horario || '09:00'}
                onChange={e => setAlertasCfg(c => ({ ...c, horario: e.target.value }))}/>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">4. Repetir aviso de contas vencidas</label>
              <select className="form-input" value={alertasCfg.repetirVencidas || 'Todo dia'}
                onChange={e => setAlertasCfg(c => ({ ...c, repetirVencidas: e.target.value }))}>
                <option value="Todo dia">Todo dia</option>
                <option value="A cada 3 dias">A cada 3 dias</option>
                <option value="Semanalmente">Semanalmente</option>
              </select>
            </div>
          </div>

          <div className="cfg-action-row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
            {alertasSaved && (
              <span style={{ fontSize: '0.8125rem', color: '#276749' }}>✓ Configurações de alertas salvas!</span>
            )}
            <button className="btn btn-primary btn-sm" onClick={handleSaveAlertas}>
              <Save size={14} /> Salvar configurações de alertas
            </button>
          </div>
        </div>
      </div>

      {/* Toast expiração dev */}
      {devToast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1300, background: '#1a1a1a', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: '0.875rem', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Lock size={16} /> Sessão do desenvolvedor expirada — edição bloqueada
        </div>
      )}

      {/* Sobre o Sistema */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', margin: 0 }}>Sobre o Sistema</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {devUnlocked ? (
              <>
                <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 20, background: '#e8f5e9', color: '#2e7d32', fontWeight: 600, border: '1px solid #a5d6a7' }}>
                  ✓ Autenticado — {devMinutes} min restantes
                </span>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={handleDevLock}>
                  <Lock size={13} /> Bloquear agora
                </button>
              </>
            ) : (
              <>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Lock size={12} /> Protegido pelo desenvolvedor
                </span>
                <button className="btn btn-outline btn-sm" onClick={() => setShowDevModal(true)}>
                  <Lock size={13} /> Editar (acesso restrito)
                </button>
              </>
            )}
          </div>
        </div>

        {!devUnlocked ? (
          /* ESTADO BLOQUEADO — somente leitura */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minWidth: 100 }}>
                <SSLogo size={56} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Playfair Display', serif" }}>{ssCfg.nome}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{ssCfg.versao}</div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 10px' }}>{ssCfg.descricao}</p>
                {ssCfg.site && <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>🌐 {ssCfg.site}</div>}
                {ssCfg.whatsapp && <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>📱 {ssCfg.whatsapp}</div>}
                {ssCfg.email && <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>✉️ {ssCfg.email}</div>}
                <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 12, background: 'var(--teal-light)', border: '1px solid var(--teal)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--teal-dark)' }}>
                  Plano {getPlanoNome(ssCfg.plano ?? 'pro')}
                </div>
              </div>
            </div>

            {/* Botão de reset de senha — visível sem autenticação */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {resetPwdMsg ? (
                <p style={{ fontSize: '0.8125rem', color: '#276749', fontWeight: 600, margin: 0 }}>{resetPwdMsg}</p>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
                  onClick={() => setShowResetPwdConfirm(true)}
                >
                  🔑 Esqueci a senha — Resetar para padrão
                </button>
              )}
            </div>
          </div>
        ) : (
          /* ESTADO DESBLOQUEADO — formulário de edição */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Sub-abas da seção dev */}
            <div className="cfg-dev-tabs" style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--border)', paddingBottom: 0 }}>
              {[
                { id: 'config', label: 'Configurações do Sistema' },
                { id: 'planos', label: 'Configurar Planos' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setDevTab(t.id)}
                  style={{
                    padding: '8px 16px', background: 'transparent', border: 'none',
                    borderBottom: devTab === t.id ? '2px solid var(--teal)' : '2px solid transparent',
                    marginBottom: '-2px', fontSize: '0.875rem', fontWeight: 600,
                    color: devTab === t.id ? 'var(--teal)' : 'var(--text-muted)',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {devTab === 'planos' ? (
              /* ── Configurar Planos (dinâmico) ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                  Configure planos e módulos de forma dinâmica. Cada plano deve ser um superconjunto do anterior (hierarquia).
                  O último plano com <strong>null</strong> inclui todos os módulos.
                </p>

                {planosDraft.length < 10 && (
                  <button className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }}
                    onClick={() => {
                      const prev = planosDraft[planosDraft.length - 2]
                      const newMods = prev?.modulos ? [...prev.modulos] : [...(DEFAULT_PLANOS.plus || [])]
                      setPlanosDraft(d => {
                        const a = [...d]
                        a.splice(a.length - 1, 0, { id: `plano_${Date.now()}`, nome: 'Novo Plano', cor: '#7c3aed', modulos: newMods })
                        return a
                      })
                    }}>
                    + Adicionar plano
                  </button>
                )}

                {/* Tabela módulos × planos dinâmicos */}
                <div className="cfg-table-scroll cfg-planos-table-wrap"
                  style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <table style={{ width: '100%', minWidth: Math.max(400, planosDraft.length * 110 + 160), borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border)' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-primary)', fontWeight: 700, minWidth: 160 }}>Módulo</th>
                        {planosDraft.map((p, pi) => (
                          <th key={p.id} style={{ padding: '8px 6px', textAlign: 'center', width: 110 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              <div style={{ display: 'flex', gap: 2 }}>
                                <button className="btn btn-ghost btn-sm" style={{ padding: '1px 5px', fontSize: '0.65rem' }}
                                  disabled={pi === 0}
                                  onClick={() => setPlanosDraft(d => { const a=[...d];[a[pi-1],a[pi]]=[a[pi],a[pi-1]];return a })}>↑</button>
                                <button className="btn btn-ghost btn-sm" style={{ padding: '1px 5px', fontSize: '0.65rem' }}
                                  disabled={pi === planosDraft.length - 1}
                                  onClick={() => setPlanosDraft(d => { const a=[...d];[a[pi],a[pi+1]]=[a[pi+1],a[pi]];return a })}>↓</button>
                                {planosDraft.length > 1 && (
                                  <button className="btn btn-ghost btn-sm" style={{ padding: '1px 5px', fontSize: '0.65rem', color: 'var(--danger)' }}
                                    onClick={() => { if (window.confirm(`Excluir plano "${p.nome}"?`)) setPlanosDraft(d => d.filter((_,i) => i !== pi)) }}>✕</button>
                                )}
                              </div>
                              <input value={p.nome}
                                onChange={e => setPlanosDraft(d => { const a=[...d];a[pi]={...a[pi],nome:e.target.value};return a })}
                                style={{ width: 88, textAlign: 'center', border: `2px solid ${p.cor||'var(--border)'}`, borderRadius: 6, padding: '2px 4px', fontSize: '0.75rem', fontWeight: 700, color: p.cor||'var(--text-primary)', background: 'var(--surface)' }} />
                              <input type="color" value={p.cor || '#888888'}
                                onChange={e => setPlanosDraft(d => { const a=[...d];a[pi]={...a[pi],cor:e.target.value};return a })}
                                style={{ width: 24, height: 20, border: 'none', cursor: 'pointer', padding: 0, background: 'none' }} />
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ALL_MODULES_CONFIG.map((mod, mi) => (
                        <tr key={mod.id} style={{ borderBottom: '1px solid var(--border)', background: mi % 2 === 0 ? 'transparent' : 'var(--surface-2)' }}>
                          <td style={{ padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 500, minWidth: 160 }}>
                            {mod.label}
                            {DEPENDENCIAS[mod.id] && (
                              <span style={{ marginLeft: 6, fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                dep: {DEPENDENCIAS[mod.id].map(d => ALL_MODULES_CONFIG.find(m=>m.id===d)?.label||d).join(', ')}
                              </span>
                            )}
                          </td>
                          {planosDraft.map((p, pi) => (
                            <td key={p.id} style={{ padding: '8px', textAlign: 'center', width: 110 }}>
                              {p.modulos === null ? (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>✓ sempre</span>
                              ) : (
                                <label className="cfg-checkbox-touch">
                                  <input type="checkbox" checked={p.modulos.includes(mod.id)}
                                    onChange={e => toggleModuloPlano(pi, mod.id, e.target.checked)} />
                                </label>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="cfg-scroll-hint" style={{ display: 'none' }}>← Role para ver todos os planos →</p>

                {/* Toggle ilimitado para o último plano */}
                <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, fontSize: '0.8125rem', border: '1px solid var(--border)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox"
                      checked={planosDraft[planosDraft.length - 1]?.modulos === null}
                      onChange={e => setPlanosDraft(d => { const a=[...d]; const last={...a[a.length-1]}; last.modulos = e.target.checked ? null : [...(DEFAULT_PLANOS.plus||[])]; a[a.length-1]=last; return a })}
                      style={{ accentColor: 'var(--teal)' }} />
                    Plano <strong style={{ margin: '0 4px' }}>{planosDraft[planosDraft.length - 1]?.nome}</strong> inclui TODOS os módulos (ilimitado)
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setPlanosDraft(loadPlanosDraft())}>Descartar alterações</button>
                  {planosSaved && <span style={{ fontSize: '0.8125rem', color: '#276749' }}>✓ Planos salvos!</span>}
                  <button className="btn btn-primary btn-sm" onClick={handleSavePlanos}><Save size={14} /> Salvar planos</button>
                </div>

                <div style={{ padding: '10px 14px', background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, fontSize: '0.8125rem', color: '#713f12' }}>
                  ⚠️ Alterações afetam o que cada cliente vê na sidebar imediatamente após salvar. O plano ativo permanece o mesmo.
                </div>
              </div>
            ) : (
              /* ── Configurações do Sistema (conteúdo existente) ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Logo */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Logo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <SSLogo size={56} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => ssLogoInputRef.current?.click()}>
                    📁 Carregar imagem
                  </button>
                  {ssCfg.logo && (
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                      onClick={() => {
                        const novo = { ...ssCfg, logo: null, _updatedAt: Date.now() }
                        setSsCfg(novo)
                        localStorage.setItem(SS_CONFIG_KEY, JSON.stringify(novo))
                        syncToSupabase(SS_CONFIG_KEY, novo)
                        window.dispatchEvent(new Event('petvet-ss-updated'))
                      }}>
                      Remover logo
                    </button>
                  )}
                  <input ref={ssLogoInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => handleSsLogoFile(e.target.files?.[0])} />
                </div>
              </div>
            </div>

            <div className="cfg-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0 16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nome do sistema</label>
                <input className="form-input" value={ssCfg.nome} onChange={e => setSsCfg(c => ({ ...c, nome: e.target.value }))} placeholder="Salgueiro Systems" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Versão</label>
                <input className="form-input" style={{ width: 100 }} value={ssCfg.versao} onChange={e => setSsCfg(c => ({ ...c, versao: e.target.value }))} placeholder="v1.0.0" />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Descrição</label>
              <textarea className="form-input" rows={3} style={{ resize: 'vertical' }} value={ssCfg.descricao} onChange={e => setSsCfg(c => ({ ...c, descricao: e.target.value }))} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Texto "Powered by" (sidebar)</label>
              <input className="form-input" value={ssCfg.poweredBy} onChange={e => setSsCfg(c => ({ ...c, poweredBy: e.target.value }))} placeholder="Salgueiro Systems" />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Plano ativo</label>
              <select className="form-select" value={ssCfg.plano ?? 'pro'} onChange={e => setSsCfg(c => ({ ...c, plano: e.target.value }))}>
                <option value="basico">Básico — Dashboard, Pets, Prontuário, Agenda</option>
                <option value="plus">Plus — + Vacinas, Bulário, Estoque, Serviços</option>
                <option value="pro">Pro — Todos os módulos</option>
              </select>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {Object.entries(PLANO_MODULOS_DESCRICAO).map(([plano, items]) => {
                  const ativo = (ssCfg.plano ?? 'pro') === plano
                  return (
                    <div key={plano} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, opacity: ativo ? 1 : 0.45 }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: ativo ? 'var(--teal-light)' : 'var(--surface-2)', color: ativo ? 'var(--teal-dark)' : 'var(--text-muted)', flexShrink: 0, marginTop: 1 }}>
                        {PLANO_LABELS[plano]}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{items.join(' · ')}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="cfg-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Site</label>
                <input className="form-input" value={ssCfg.site} onChange={e => setSsCfg(c => ({ ...c, site: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">WhatsApp</label>
                <input className="form-input" value={ssCfg.whatsapp} onChange={e => setSsCfg(c => ({ ...c, whatsapp: e.target.value }))} placeholder="(11) 9..." />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">E-mail</label>
                <input className="form-input" type="email" value={ssCfg.email} onChange={e => setSsCfg(c => ({ ...c, email: e.target.value }))} placeholder="suporte@..." />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary btn-sm" onClick={handleSaveSsCfg}>
                <Save size={14} /> {ssSaved ? 'Salvo!' : 'Salvar alterações'}
              </button>
            </div>

            {/* Alterar senha */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Alterar senha do desenvolvedor</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 10 }}>Mínimo 8 caracteres.</p>
              <div className="cfg-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 12px', marginBottom: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Senha atual</label>
                  <input className="form-input" type="password" value={changePwd.atual}
                    onChange={e => setChangePwd(p => ({ ...p, atual: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Nova senha</label>
                  <input className="form-input" type="password" value={changePwd.nova} minLength={8}
                    onChange={e => setChangePwd(p => ({ ...p, nova: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Confirmar nova senha</label>
                  <input className="form-input" type="password" value={changePwd.confirma}
                    onChange={e => setChangePwd(p => ({ ...p, confirma: e.target.value }))} />
                </div>
              </div>
              {changePwdMsg && (
                <p style={{ fontSize: '0.8125rem', color: changePwdMsg.startsWith('✓') ? 'var(--success)' : 'var(--danger)', marginBottom: 8 }}>{changePwdMsg}</p>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-outline btn-sm" onClick={handleChangeDevPwd}>Alterar senha</button>
              </div>
            </div>
          </div>
            )}  {/* fim devTab === 'config' */}
          </div>
        )}
      </div>

      {/* Novidades na tela de login — admin only */}
      {hasRole('admin') && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.25rem' }}>✨</span>
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', margin: 0 }}>Novidades na tela de login</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>Exibido no painel esquerdo da tela de login (máx. 5 itens)</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {novidadesSaved && <span style={{ fontSize: '0.8125rem', color: '#276749', fontWeight: 600 }}>✓ Salvo!</span>}
              <button className="btn btn-primary btn-sm" onClick={handleSaveNovidades}><Save size={14} /> Salvar</button>
            </div>
          </div>

          {novidades.length === 0 && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 12 }}>
              Nenhuma novidade configurada — a seção não aparecerá na tela de login.
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {novidades.map((n, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '44px 1fr 1fr auto', gap: 8, alignItems: 'center', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <input value={n.icone || '✨'}
                  onChange={e => setNovidades(arr => { const a=[...arr]; a[i]={...a[i],icone:e.target.value}; return a })}
                  style={{ width: 40, textAlign: 'center', fontSize: '1.25rem', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 2px', background: 'var(--surface)' }}
                  maxLength={2} title="Emoji/ícone" />
                <input className="form-input" value={n.titulo || ''}
                  onChange={e => setNovidades(arr => { const a=[...arr]; a[i]={...a[i],titulo:e.target.value}; return a })}
                  placeholder="Título" />
                <input className="form-input" value={n.descricao || ''}
                  onChange={e => setNovidades(arr => { const a=[...arr]; a[i]={...a[i],descricao:e.target.value}; return a })}
                  placeholder="Descrição curta" />
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                  onClick={() => setNovidades(arr => arr.filter((_,j) => j !== i))}><X size={14} /></button>
              </div>
            ))}
          </div>

          {novidades.length < 5 && (
            <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }}
              onClick={() => setNovidades(arr => [...arr, { icone: '✨', titulo: '', descricao: '' }])}>
              + Adicionar novidade
            </button>
          )}
        </div>
      )}

      {/* Suporte Técnico — apenas admin */}
      {hasRole('admin') && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            {isSuporteAtivo() ? <ShieldCheck size={18} color="#166534"/> : <Shield size={18} style={{ color: 'var(--teal)' }}/>}
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', margin: 0 }}>
                Suporte Técnico
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                Autorize temporariamente o acesso do desenvolvedor para fins de suporte
              </p>
            </div>
          </div>

          {(() => {
            const suporteAtivo = isSuporteAtivo()
            const expiracao = suporteData?.expiracao ? new Date(suporteData.expiracao) : null
            const expiracaoStr = expiracao
              ? expiracao.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
              : null

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {suporteAtivo ? (
                  <div style={{ padding: '12px 16px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <ShieldCheck size={20} color="#166534" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#166534', marginBottom: 4 }}>
                        Acesso técnico autorizado
                      </p>
                      <p style={{ fontSize: '0.8125rem', color: '#166534', marginBottom: 0 }}>
                        O desenvolvedor tem acesso completo temporariamente.<br/>
                        Expira em: <strong>{expiracaoStr}</strong>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '12px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>
                      Modo suporte inativo
                    </p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      Ao autorizar, o desenvolvedor (Salgueiro Systems) terá acesso temporário de
                      <strong> 24 horas</strong> a todos os módulos do sistema para realizar suporte técnico.
                      Todos os acessos serão registrados em log.
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {suporteAtivo ? (
                    <button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff', border: 'none', gap: 6, display: 'flex', alignItems: 'center' }}
                      onClick={handleRevogarSuporte}>
                      <ShieldOff size={14} /> Revogar acesso agora
                    </button>
                  ) : (
                    <button className="btn btn-primary btn-sm" onClick={handleAtivarSuporte}>
                      <ShieldCheck size={14} /> Autorizar acesso temporário (24h)
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={refreshDevLog}>
                    Atualizar log
                  </button>
                </div>

                {/* Log de acessos dev */}
                {devLog.length > 0 && (
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 8 }}>
                      Log de acessos do desenvolvedor
                    </p>
                    <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                            {['Módulo','Data/Hora','Com suporte'].map(h => (
                              <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {devLog.slice(0, 50).map((entry, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '5px 10px', color: 'var(--text-primary)', fontWeight: 500 }}>{entry.modulo}</td>
                              <td style={{ padding: '5px 10px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                                {entry.timestamp ? new Date(entry.timestamp).toLocaleString('pt-BR') : '—'}
                              </td>
                              <td style={{ padding: '5px 10px' }}>
                                <span style={{ fontSize: '0.7rem', padding: '1px 8px', borderRadius: 10, fontWeight: 600,
                                  background: entry.suporteAtivo ? '#dcfce7' : 'var(--surface-2)',
                                  color: entry.suporteAtivo ? '#166534' : 'var(--text-muted)' }}>
                                  {entry.suporteAtivo ? 'Sim' : 'Não'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', marginTop: 8 }}
                      onClick={() => { localStorage.removeItem(DEV_LOG_KEY); setDevLog([]) }}>
                      Limpar log
                    </button>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Aviso LGPD */}
      <div style={{ padding: '16px 20px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, borderLeft: '4px solid #3b82f6' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Shield size={18} color="#1d4ed8" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1d4ed8', marginBottom: 6 }}>
              ℹ️ Conformidade LGPD
            </p>
            <p style={{ fontSize: '0.8125rem', color: '#1e3a8a', lineHeight: 1.7, margin: 0 }}>
              Este sistema foi desenvolvido seguindo as diretrizes da <strong>Lei Geral de Proteção de Dados (Lei 13.709/2018)</strong>.
              O acesso do desenvolvedor é restrito a configurações técnicas.
              Dados clínicos, pessoais e financeiros são de responsabilidade exclusiva do operador da clínica.
              Para suporte técnico que envolva dados, o cliente deve autorizar formalmente através do <strong>Modo Suporte</strong> acima.
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 16px', background: 'var(--teal-light)', borderRadius: 8, borderLeft: '3px solid var(--teal)' }}>
        <p style={{ fontSize: '0.8125rem', color: 'var(--teal-dark)', margin: 0 }}>
          Clique em <strong>Salvar alterações</strong> para persistir as configurações.
          O preview e as cores da interface refletem as mudanças em tempo real.
        </p>
      </div>

      {/* Modal de aviso de dependências */}
      {showDepModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>⚠️</div>
              <div>
                <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: 6 }}>
                  Atenção — Possível rompimento de hierarquia
                </p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                  As seguintes inconsistências foram detectadas na configuração:
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {depWarnings.map((w, i) => (
                    <li key={i} style={{ fontSize: '0.875rem', color: 'var(--danger)' }}>{w}</li>
                  ))}
                </ul>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 12 }}>
                  Recomendação: módulos no Básico devem aparecer também no Plus para garantir hierarquia correta.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowDepModal(false); setPendingSavePlanos(false) }}>
                Cancelar
              </button>
              <button className="btn btn-primary btn-sm" onClick={doSavePlanos}>
                Salvar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleReset}
        message="Restaurar todos os valores para os padrões originais? Esta ação não pode ser desfeita."
      />

      {cropSrc && (
        <CropModal
          src={cropSrc}
          shape="rect"
          onSave={dataUrl => {
            set(cropField, dataUrl)
            setCropSrc(null)
            setCropField(null)
          }}
          onClose={() => {
            setCropSrc(null)
            setCropField(null)
          }}
        />
      )}

      {ssCropSrc && (
        <CropModal
          src={ssCropSrc}
          shape="rect"
          onSave={dataUrl => {
            const novo = { ...ssCfg, logo: dataUrl, _updatedAt: Date.now() }
            setSsCfg(novo)
            localStorage.setItem(SS_CONFIG_KEY, JSON.stringify(novo))
            syncToSupabase(SS_CONFIG_KEY, novo)
            window.dispatchEvent(new Event('petvet-ss-updated'))
            setSsCropSrc(null)
          }}
          onClose={() => setSsCropSrc(null)}
        />
      )}

      {showDevModal && (
        <div style={{ position:'fixed', inset:0, zIndex:1200, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div className="card" style={{ width:'100%', maxWidth:400, padding:28, display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'1.5rem', marginBottom:6 }}>🔐</div>
              <p style={{ fontWeight:700, fontSize:'1rem', color:'var(--text-primary)', marginBottom:4 }}>Acesso restrito — Salgueiro Systems</p>
              <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>Esta seção é protegida. Digite a senha do desenvolvedor para continuar.</p>
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Senha do desenvolvedor</label>
              <input
                className="form-input"
                type="password"
                value={devPwd}
                onChange={e => { setDevPwd(e.target.value); setDevPwdError('') }}
                onKeyDown={e => e.key === 'Enter' && handleDevAuth()}
                autoFocus
                placeholder="••••••••"
              />
              {devPwdError && (
                <p style={{ fontSize:'0.8125rem', color:'var(--danger)', marginTop:4, marginBottom:0 }}>{devPwdError}</p>
              )}
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'space-between', alignItems:'center', flexWrap:'wrap' }}>
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize:'0.75rem', color:'var(--text-muted)', padding:'4px 8px' }}
                onClick={() => {
                  setShowDevModal(false)
                  setDevPwd('')
                  setDevPwdError('')
                  setShowResetPwdConfirm(true)
                }}
              >
                🔑 Esqueci a senha — Resetar para padrão
              </button>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { setShowDevModal(false); setDevPwd(''); setDevPwdError('') }}>Cancelar</button>
                <button className="btn btn-primary btn-sm" onClick={handleDevAuth}>
                  <Unlock size={14} /> Verificar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmação reset senha */}
      {showResetPwdConfirm && (
        <div style={{ position:'fixed', inset:0, zIndex:1200, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div className="card" style={{ width:'100%', maxWidth:380, padding:28, display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
              <div style={{ fontSize:'1.5rem', flexShrink:0 }}>🔑</div>
              <div>
                <p style={{ fontWeight:700, fontSize:'1rem', color:'var(--text-primary)', marginBottom:6 }}>Resetar senha do desenvolvedor?</p>
                <p style={{ fontSize:'0.875rem', color:'var(--text-muted)' }}>
                  A senha será redefinida para o padrão do sistema.<br/>
                  Você precisará usar a senha padrão para entrar.
                </p>
              </div>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowResetPwdConfirm(false)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={handleResetDevPwd}>
                Resetar senha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------
// Componentes de preview
// -------------------------------------------------------

const PET_PATH = 'M4.5 9a3.5 3.5 0 1 1 7 0A3.5 3.5 0 0 1 4.5 9zm12 0a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0zM1 19.5C1 16.46 3.46 14 6.5 14h11c3.04 0 5.5 2.46 5.5 5.5v.5H1v-.5z'

function SidebarPreview({ draft }) {
  return (
    <div style={{
      width: 172,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
      userSelect: 'none',
      pointerEvents: 'none',
    }}>
      {/* Logo area */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {draft.logoP ? (
            <img src={draft.logoP} alt="" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 6, flexShrink: 0 }} />
          ) : (
            <div style={{ width: 28, height: 28, borderRadius: 6, background: `${draft.corPrimaria}22`, border: `1.5px solid ${draft.corPrimaria}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: draft.corPrimaria, fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
              {(draft.nomeP.replace(/^\W+/, '') || 'E')[0].toUpperCase()}
            </div>
          )}
          {draft.logoS ? (
            <img src={draft.logoS} alt="" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 6, flexShrink: 0 }} />
          ) : (
            <div style={{ width: 28, height: 28, borderRadius: 6, background: `${draft.corDestaque}22`, border: `1.5px solid ${draft.corDestaque}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: draft.corDestaque, fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
              {(draft.nomeS.replace(/^\W+/, '') || 'T')[0].toUpperCase()}
            </div>
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {draft.nomeP || 'Nome principal'}
          </div>
          <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {draft.nomeS || 'Subtítulo'}
          </div>
        </div>
      </div>
      {/* Nav items mockup */}
      {['Dashboard', 'Pets & Tutores', 'Prontuário', 'Agenda', 'PDV'].map((item, i) => (
        <div key={item} style={{
          padding: '6px 12px',
          fontSize: '0.625rem',
          color: i === 0 ? draft.corPrimaria : 'var(--text-secondary)',
          background: i === 0 ? `${draft.corPrimaria}1A` : 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          fontWeight: i === 0 ? 600 : 400,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: i === 0 ? draft.corPrimaria : 'var(--border)', flexShrink: 0 }} />
          {item}
        </div>
      ))}
    </div>
  )
}

function LoginPreview({ draft }) {
  return (
    <div style={{
      width: 204,
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '16px 14px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      boxShadow: 'var(--shadow-sm)',
      userSelect: 'none',
      pointerEvents: 'none',
    }}>
      {/* Logo + nome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {draft.logoP ? (
            <img src={draft.logoP} alt="" style={{ width: 38, height: 38, objectFit: 'contain', borderRadius: 8, flexShrink: 0 }} />
          ) : (
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${draft.corPrimaria}22`, border: `2px solid ${draft.corPrimaria}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: draft.corPrimaria, fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
              {(draft.nomeP.replace(/^\W+/, '') || 'E')[0].toUpperCase()}
            </div>
          )}
          {draft.logoS ? (
            <img src={draft.logoS} alt="" style={{ width: 38, height: 38, objectFit: 'contain', borderRadius: 8, flexShrink: 0 }} />
          ) : (
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${draft.corDestaque}22`, border: `2px solid ${draft.corDestaque}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: draft.corDestaque, fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
              {(draft.nomeS.replace(/^\W+/, '') || 'T')[0].toUpperCase()}
            </div>
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {draft.nomeP || 'Nome principal'}
          </div>
          <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {draft.nomeS || 'Subtítulo'}
          </div>
        </div>
      </div>
      {/* Slogan */}
      {draft.slogan && (
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic' }}>
          {draft.slogan}
        </div>
      )}
      {/* Separador colorido */}
      <div style={{ width: '100%', height: 4, borderRadius: 2, background: `linear-gradient(90deg, ${draft.corPrimaria}, ${draft.corDestaque})` }} />
      {/* Campos mockup */}
      <div style={{ width: '100%', height: 26, borderRadius: 5, background: 'var(--surface-2)', border: '1px solid var(--border)' }} />
      <div style={{ width: '100%', height: 26, borderRadius: 5, background: 'var(--surface-2)', border: '1px solid var(--border)' }} />
      {/* Botão mockup */}
      <div style={{ width: '100%', height: 32, borderRadius: 5, background: `linear-gradient(135deg, ${draft.corPrimaria}, ${draft.corDestaque})` }} />
    </div>
  )
}
