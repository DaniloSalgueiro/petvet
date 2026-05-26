import { useState, useEffect, useRef } from 'react'
import { RotateCcw, Save, MessageCircle, History, Settings2, Trash2 } from 'lucide-react'
import { useIdentidade, DEFAULT_IDENTIDADE } from '../context/IdentidadeContext'
import { DEFAULT_FOLLOWUP_CONFIG } from '../context/FollowupContext'
import CropModal from '../components/ui/CropModal'
import PhotoUploadButtons from '../components/ui/PhotoUploadButtons'
import ConfirmModal from '../components/ui/ConfirmModal'

const FOLLOWUP_KEY  = 'petvet-followup-config'
const FOLLOWUP_QUEUE_KEY = 'petvet-followup-queue'
const TEMPO_OPTIONS = [
  { value: 30,   label: '30 minutos' },
  { value: 60,   label: '1 hora' },
  { value: 120,  label: '2 horas' },
  { value: 1440, label: '24 horas' },
]

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

const TABELA_FIELDS = [
  { key: 'Consulta Clínica Geral',   label: 'Consulta Clínica Geral' },
  { key: 'Consulta Dermatológica',   label: 'Consulta Dermatológica' },
  { key: 'Consulta Canábica',        label: 'Consulta Canábica' },
  { key: 'Retorno',                  label: 'Retorno' },
  { key: 'Vacina (por dose)',        label: 'Vacina (por dose)' },
  { key: 'Aplicação',               label: 'Aplicação (por procedimento)' },
]

function loadTabela() {
  try { return JSON.parse(localStorage.getItem('petvet-tabela-precos') ?? '{}') } catch { return {} }
}

export default function ConfiguracoesPage() {
  const { identidade, setIdentidade, resetIdentidade } = useIdentidade()
  const [draft, setDraft] = useState(() => ({ ...identidade }))
  const [cropSrc, setCropSrc] = useState(null)
  const [cropField, setCropField] = useState(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [tabela, setTabela] = useState(loadTabela)
  const [tabelaSaved, setTabelaSaved] = useState(false)
  const [followupCfg, setFollowupCfg] = useState(loadFollowupConfig)
  const [followupSaved, setFollowupSaved] = useState(false)
  const [followupTab, setFollowupTab] = useState('config')
  const [histFilter, setHistFilter] = useState({ from: '', to: '' })
  const [queue, setQueue] = useState(loadFollowupQueue)
  const [newLinkGoogle, setNewLinkGoogle] = useState('')
  const [newLinkInsta, setNewLinkInsta] = useState('')

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

  function handleSave() {
    setIdentidade({ ...draft })
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2500)
  }

  function handleReset() {
    resetIdentidade()
    setDraft({ ...DEFAULT_IDENTIDADE })
    setShowResetConfirm(false)
  }

  function handleSaveTabela() {
    localStorage.setItem('petvet-tabela-precos', JSON.stringify(tabela))
    setTabelaSaved(true)
    setTimeout(() => setTabelaSaved(false), 2500)
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

  function handleLogoFile(field, file) {
    const reader = new FileReader()
    reader.onload = e => { setCropSrc(e.target.result); setCropField(field) }
    reader.readAsDataURL(file)
  }

  function set(field, value) {
    setDraft(d => ({ ...d, [field]: value }))
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Configurações</h2>
          <p className="page-subtitle">Identidade visual e preferências do sistema</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={() => setShowResetConfirm(true)}>
            <RotateCcw size={14} /> Restaurar padrões
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
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
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
          Usadas na sidebar, tela de login e documentos impressos
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
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

      {/* Cores */}
      <div className="card" style={{ padding: '20px' }}>
        <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: 4 }}>
          Cores do sistema
        </p>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 16 }}>
          Aplicadas em toda a interface em tempo real ao alterar
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
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

      {/* Tabela de Preços */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: 2 }}>Tabela de Preços</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Usada para sugerir valores automaticamente no PDV ao selecionar tutor</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleSaveTabela}>
            <Save size={14} /> {tabelaSaved ? 'Salvo!' : 'Salvar tabela'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px 20px' }}>
          {TABELA_FIELDS.map(({ key, label }) => (
            <div key={key} className="form-group">
              <label className="form-label">{label}</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.875rem', pointerEvents: 'none' }}>R$</span>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  style={{ paddingLeft: 30 }}
                  value={tabela[key] ?? ''}
                  placeholder="0,00"
                  onChange={e => setTabela(t => ({ ...t, [key]: e.target.value }))}
                />
              </div>
            </div>
          ))}
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

      <div style={{ padding: '12px 16px', background: 'var(--teal-light)', borderRadius: 8, borderLeft: '3px solid var(--teal)' }}>
        <p style={{ fontSize: '0.8125rem', color: 'var(--teal-dark)', margin: 0 }}>
          Clique em <strong>Salvar alterações</strong> para persistir as configurações.
          O preview e as cores da interface refletem as mudanças em tempo real.
        </p>
      </div>

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
