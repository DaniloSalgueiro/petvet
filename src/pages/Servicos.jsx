import { useState } from 'react'
import { Plus, Search, Clock, DollarSign, Trash2 } from 'lucide-react'
import Tabs from '../components/ui/Tabs'
import Modal from '../components/ui/Modal'
import AccessDenied from '../components/ui/AccessDenied'
import ConfirmModal from '../components/ui/ConfirmModal'
import { SERVICOS_CATALOGO, HOSPEDAGENS, AGENDAMENTOS, PETS, TUTORES, getPetById, getTutorById } from '../data/mock'
import { useAuth } from '../context/AuthContext'
import { normIncludes } from '../utils/normalizeText'
import { usePersistentState } from '../hooks/usePersistentState'

const CAT_COLORS = {
  'Consulta':     { bg: '#d4f0ee', color: '#1d8f88' },
  'Cirurgia':     { bg: '#fed7d7', color: '#c53030' },
  'Vacina':       { bg: '#bee3f8', color: '#2c5282' },
  'Banho & Tosa': { bg: '#fce4f3', color: '#b5076f' },
  'Exame':        { bg: '#fefcbf', color: '#744210' },
  'Hospedagem':   { bg: '#c6f6d5', color: '#276749' },
}

const STATUS_CONFIG = {
  agendado:        { label: 'Agendado',       color: 'neutral' },
  confirmado:      { label: 'Confirmado',     color: 'teal' },
  'em-atendimento':{ label: 'Em atendimento', color: 'warning' },
  concluido:       { label: 'Concluído',      color: 'success' },
  cancelado:       { label: 'Cancelado',      color: 'danger' },
}

const EMPTY_SVC = { name: '', category: 'Consulta', duration: 30, price: '' }
const EMPTY_HOSP = { petId: '', tutorId: '', checkIn: '', checkOut: '', dailyRate: 80, observations: '' }

export default function ServicosPage() {
  const { hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState('fila')
  const [agendamentos, setAgendamentos] = usePersistentState('petvet-svc-agendamentos', AGENDAMENTOS)
  const [catalogo, setCatalogo] = usePersistentState('petvet-catalogo', SERVICOS_CATALOGO)
  const [domicilio, setDomicilio] = usePersistentState('petvet-servicos-domicilio', [])
  const [hospedagens, setHospedagens] = usePersistentState('petvet-hospedagens', HOSPEDAGENS)
  const [searchCat, setSearchCat] = useState('')
  const [searchDom, setSearchDom] = useState('')
  const [showSvcModal, setShowSvcModal] = useState(false)
  const [showDomModal, setShowDomModal] = useState(false)
  const [showHospModal, setShowHospModal] = useState(false)
  const [editingSvc, setEditingSvc] = useState(null)
  const [editingDom, setEditingDom] = useState(null)
  const [editingHosp, setEditingHosp] = useState(null)
  const [svcForm, setSvcForm] = useState(EMPTY_SVC)
  const [domForm, setDomForm] = useState(EMPTY_SVC)
  const [hospForm, setHospForm] = useState(EMPTY_HOSP)
  const [showDomPrompt, setShowDomPrompt] = useState(false)
  const [lastSavedSvc, setLastSavedSvc] = useState(null)
  const [deleteDomTarget, setDeleteDomTarget] = useState(null)
  const [hospPetSearch, setHospPetSearch] = useState('')
  const [petsLS] = usePersistentState('petvet-pets', PETS)
  const [tutoresLS] = usePersistentState('petvet-tutores', TUTORES)

  // Appointment action modal
  const [selectedApt, setSelectedApt] = useState(null)
  const [showAptModal, setShowAptModal] = useState(false)
  const [aptObs, setAptObs] = useState('')

  const [deleteAptTarget, setDeleteAptTarget] = useState(null)
  const [deleteSvcTarget, setDeleteSvcTarget] = useState(null)
  const [deleteHospTarget, setDeleteHospTarget] = useState(null)

  const hoje = agendamentos.filter(a => a.date === '2026-05-14').sort((a, b) => a.time.localeCompare(b.time))
  const hospAtivas = hospedagens.filter(h => h.status === 'ativo')

  const filteredCat = catalogo
    .filter(s => !searchCat || normIncludes(s.name, searchCat) || normIncludes(s.category, searchCat))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  const filteredDom = domicilio
    .filter(s => !searchDom || normIncludes(s.name, searchDom) || normIncludes(s.category, searchDom))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  function openEditSvc(svc) { setEditingSvc(svc); setSvcForm({ ...svc }); setShowSvcModal(true) }
  function openAddSvc() { setEditingSvc(null); setSvcForm(EMPTY_SVC); setShowSvcModal(true) }
  function saveSvc() {
    const sort = arr => [...arr].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    if (editingSvc) {
      setCatalogo(prev => sort(prev.map(s => s.id === editingSvc.id ? { ...svcForm, id: editingSvc.id } : s)))
    } else {
      const newSvc = { ...svcForm, id: `s${Date.now()}` }
      setCatalogo(prev => sort([...prev, newSvc]))
      setLastSavedSvc(newSvc)
      setShowDomPrompt(true)
    }
    setShowSvcModal(false)
  }

  function openEditDom(svc) { setEditingDom(svc); setDomForm({ ...svc }); setShowDomModal(true) }
  function openAddDom() { setEditingDom(null); setDomForm(EMPTY_SVC); setShowDomModal(true) }
  function saveDom() {
    const sort = arr => [...arr].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    if (editingDom) setDomicilio(prev => sort(prev.map(s => s.id === editingDom.id ? { ...domForm, id: editingDom.id } : s)))
    else setDomicilio(prev => sort([...prev, { ...domForm, id: `d${Date.now()}` }]))
    setShowDomModal(false)
  }

  function openAddHosp() { setEditingHosp(null); setHospForm(EMPTY_HOSP); setShowHospModal(true) }
  function openEditHosp(h) { setEditingHosp(h); setHospForm({ ...h }); setShowHospModal(true) }
  function saveHosp() {
    const allPets = Array.isArray(petsLS) ? petsLS : PETS
    const data = { ...hospForm, tutorId: allPets.find(p => p.id === hospForm.petId)?.tutorId ?? '', status: 'ativo' }
    if (editingHosp) setHospedagens(prev => prev.map(h => h.id === editingHosp.id ? { ...data, id: editingHosp.id } : h))
    else setHospedagens(prev => [...prev, { ...data, id: `h${Date.now()}` }])
    setShowHospModal(false)
  }

  function checkOut(id) {
    setHospedagens(prev => prev.map(h => h.id === id ? { ...h, status: 'concluido' } : h))
  }

  function openAptModal(apt) {
    setSelectedApt(apt)
    setAptObs(apt.notes ?? '')
    setShowAptModal(true)
  }

  function updateAptStatus(newStatus) {
    setAgendamentos(prev => prev.map(a =>
      a.id === selectedApt.id ? { ...a, status: newStatus, notes: aptObs } : a
    ))
    setSelectedApt(prev => ({ ...prev, status: newStatus }))
  }

  function saveAptObs() {
    setAgendamentos(prev => prev.map(a =>
      a.id === selectedApt.id ? { ...a, notes: aptObs } : a
    ))
    setShowAptModal(false)
  }

  function diarias(checkIn, checkOut) {
    const diff = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 0
  }

  const tabs = [
    { id: 'fila',      label: 'Fila do Dia',  count: hoje.length },
    { id: 'catalogo',  label: '🏥 Consultório', count: catalogo.length },
    { id: 'domicilio', label: '🏠 Domicílio', count: domicilio.length },
    { id: 'hospedagem',label: 'Hospedagem',   count: hospAtivas.length },
  ]

  if (!hasPermission('servicos', 'view')) {
    return <AccessDenied title="Serviços" />
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Serviços</h2>
          <p className="page-subtitle">Fila do dia, consultório e hospedagem</p>
        </div>
        {activeTab === 'catalogo' && hasPermission('servicos', 'edit') && (
          <button className="btn btn-primary" onClick={openAddSvc}><Plus size={16} /> Novo Serviço</button>
        )}
        {activeTab === 'domicilio' && hasPermission('servicos', 'edit') && (
          <button className="btn btn-primary" onClick={openAddDom}><Plus size={16} /> Novo Serviço Domiciliar</button>
        )}
        {activeTab === 'hospedagem' && hasPermission('servicos', 'edit') && (
          <button className="btn btn-primary" onClick={openAddHosp}><Plus size={16} /> Nova Hospedagem</button>
        )}
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* FILA DO DIA */}
      {activeTab === 'fila' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {hoje.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '2rem' }}>📋</p>
              <p style={{ fontWeight: 600, marginTop: 8 }}>Nenhum serviço hoje</p>
            </div>
          )}
          {hoje.map((apt, idx) => {
            const pet = getPetById(apt.petId)
            const tutor = pet ? getTutorById(pet.tutorId) : null
            const stCfg = STATUS_CONFIG[apt.status]
            const typeLabel = { consulta: 'Consulta', retorno: 'Retorno', cirurgia: 'Cirurgia', vacina: 'Vacinação', banho: 'Banho & Tosa', outros: 'Outros' }[apt.type] ?? apt.type
            const catCfg = CAT_COLORS[typeLabel] ?? { bg: 'var(--surface-2)', color: 'var(--text-muted)' }

            return (
              <div
                key={apt.id}
                className="card"
                style={{ padding: '14px 18px', display: 'flex', gap: 16, alignItems: 'center', cursor: 'pointer', transition: 'box-shadow 150ms' }}
                onClick={() => openAptModal(apt)}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
              >
                <div style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--teal-light)', color: 'var(--teal)', fontWeight: 800, fontSize: '0.9375rem', flexShrink: 0 }}>
                  {String(idx + 1).padStart(2, '0')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{apt.time} — {pet?.name ?? '?'}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, background: catCfg.bg, color: catCfg.color }}>{typeLabel}</span>
                    <span className={`badge badge-${stCfg.color}`}>{stCfg.label}</span>
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 3 }}>
                    {pet?.breed} · Tutor: {tutor?.name ?? '—'}
                    {apt.notes && ` · ${apt.notes}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{apt.duration}min</span>
                  {hasPermission('servicos', 'delete') && (
                    <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)', padding: 2 }}
                      onClick={e => { e.stopPropagation(); setDeleteAptTarget(apt) }} title="Excluir">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CONSULTÓRIO */}
      {activeTab === 'catalogo' && (
        <>
          <div style={{ position: 'relative', maxWidth: 400 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="form-input" style={{ paddingLeft: 34 }} placeholder="Buscar serviço..." value={searchCat} onChange={e => setSearchCat(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {filteredCat.map(svc => {
              const cfg = CAT_COLORS[svc.category] ?? { bg: 'var(--surface-2)', color: 'var(--text-muted)' }
              return (
                <div key={svc.id} className="card" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 4 }}>{svc.name}</p>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600, background: cfg.bg, color: cfg.color }}>{svc.category}</span>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--teal)' }}>
                        {svc.price > 0 ? `R$ ${svc.price.toFixed(2)}` : 'Interno'}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{svc.duration >= 60 ? `${Math.floor(svc.duration / 60)}h${svc.duration % 60 > 0 ? svc.duration % 60 + 'min' : ''}` : `${svc.duration}min`}</p>
                    </div>
                  </div>
                  {hasPermission('servicos', 'edit') && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditSvc(svc)}>Editar</button>
                      <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setDeleteSvcTarget(svc)} title="Excluir">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* DOMICÍLIO */}
      {activeTab === 'domicilio' && (
        <>
          <div style={{ position: 'relative', maxWidth: 400 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="form-input" style={{ paddingLeft: 34 }} placeholder="Buscar serviço domiciliar..." value={searchDom} onChange={e => setSearchDom(e.target.value)} />
          </div>
          {filteredDom.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '2rem' }}>🏠</p>
              <p style={{ fontWeight: 600, marginTop: 8 }}>Nenhum serviço domiciliar cadastrado</p>
              <p style={{ fontSize: '0.8125rem', marginTop: 4 }}>Adicione serviços com preços independentes para atendimentos em domicílio.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {filteredDom.map(svc => {
                const cfg = CAT_COLORS[svc.category] ?? { bg: 'var(--surface-2)', color: 'var(--text-muted)' }
                return (
                  <div key={svc.id} className="card" style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 4 }}>{svc.name}</p>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600, background: cfg.bg, color: cfg.color }}>{svc.category}</span>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--teal)' }}>
                          {svc.price > 0 ? `R$ ${svc.price.toFixed(2)}` : 'Interno'}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{svc.duration >= 60 ? `${Math.floor(svc.duration / 60)}h${svc.duration % 60 > 0 ? svc.duration % 60 + 'min' : ''}` : `${svc.duration}min`}</p>
                      </div>
                    </div>
                    {hasPermission('servicos', 'edit') && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditDom(svc)}>Editar</button>
                        <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setDeleteDomTarget(svc)} title="Excluir">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* HOSPEDAGEM */}
      {activeTab === 'hospedagem' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="stat-card">
              <div className="stat-icon stat-icon-teal"><DollarSign size={20} /></div>
              <div><div className="stat-value">{hospAtivas.length}</div><div className="stat-label">Pets hospedados agora</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-success"><DollarSign size={20} /></div>
              <div>
                <div className="stat-value">
                  R$ {hospAtivas.reduce((s, h) => {
                    const dias = diarias(h.checkIn, '2026-05-14')
                    return s + h.dailyRate * dias
                  }, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="stat-label">Receita em aberto</div>
              </div>
            </div>
          </div>

          <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginTop: 4 }}>
            Hospedagens Ativas
          </h3>
          {hospAtivas.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
              Nenhum pet hospedado no momento.
            </div>
          )}
          {hospAtivas.map(h => {
            const pet = getPetById(h.petId)
            const tutor = getTutorById(h.tutorId)
            const dias = diarias(h.checkIn, h.checkOut)
            const diasDecorridos = diarias(h.checkIn, '2026-05-14')
            return (
              <div key={h.id} className="card" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{pet?.name ?? '?'} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.875rem' }}>({pet?.breed})</span></p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>Tutor: {tutor?.name ?? '—'} · Check-in: {new Date(h.checkIn + 'T00:00').toLocaleDateString('pt-BR')} · Check-out previsto: {new Date(h.checkOut + 'T00:00').toLocaleDateString('pt-BR')}</p>
                    {h.observations && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>{h.observations}</p>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontWeight: 800, color: 'var(--teal)', fontSize: '1.05rem' }}>R$ {(h.dailyRate * diasDecorridos).toFixed(2)}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{diasDecorridos} de {dias} diárias</p>
                    {hasPermission('servicos', 'edit') && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => checkOut(h.id)}>Check-out</button>
                        {hasPermission('servicos', 'delete') && (
                          <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setDeleteHospTarget(h)} title="Excluir">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginTop: 8 }}>
            Histórico
          </h3>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Pet</th><th>Tutor</th><th>Check-in</th><th>Check-out</th><th>Diárias</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {hospedagens.filter(h => h.status === 'concluido').map(h => {
                  const pet = getPetById(h.petId)
                  const tutor = getTutorById(h.tutorId)
                  const dias = diarias(h.checkIn, h.checkOut)
                  return (
                    <tr key={h.id}>
                      <td style={{ fontWeight: 600 }}>{pet?.name ?? '—'}</td>
                      <td>{tutor?.name ?? '—'}</td>
                      <td>{new Date(h.checkIn + 'T00:00').toLocaleDateString('pt-BR')}</td>
                      <td>{new Date(h.checkOut + 'T00:00').toLocaleDateString('pt-BR')}</td>
                      <td>{dias}</td>
                      <td style={{ fontWeight: 700, color: 'var(--teal)' }}>R$ {(h.dailyRate * dias).toFixed(2)}</td>
                      <td><span className="badge badge-success">Concluído</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Atendimento */}
      {selectedApt && (() => {
        const apt = agendamentos.find(a => a.id === selectedApt.id) ?? selectedApt
        const pet = getPetById(apt.petId)
        const tutor = pet ? getTutorById(pet.tutorId) : null
        const stCfg = STATUS_CONFIG[apt.status]
        const typeLabel = { consulta: 'Consulta', retorno: 'Retorno', cirurgia: 'Cirurgia', vacina: 'Vacinação', banho: 'Banho & Tosa', outros: 'Outros' }[apt.type] ?? apt.type

        return (
          <Modal isOpen={showAptModal} onClose={() => setShowAptModal(false)} title={`${apt.time} — ${pet?.name ?? '?'}`} size="md"
            footer={
              <>
                <button className="btn btn-ghost" onClick={() => setShowAptModal(false)}>Fechar</button>
                <button className="btn btn-primary" onClick={saveAptObs}>Salvar observações</button>
              </>
            }>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{typeLabel}</span>
                <span className={`badge badge-${stCfg.color}`}>{stCfg.label}</span>
                {tutor && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tutor: {tutor.name}</span>}
              </div>

              <div>
                <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 8 }}>Ações</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={apt.status !== 'agendado'}
                    onClick={() => updateAptStatus('confirmado')}
                  >
                    Confirmar chegada
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={apt.status !== 'confirmado'}
                    onClick={() => updateAptStatus('em-atendimento')}
                  >
                    Iniciar atendimento
                  </button>
                  <button
                    className="btn btn-accent btn-sm"
                    disabled={apt.status !== 'em-atendimento'}
                    onClick={() => { updateAptStatus('concluido'); setShowAptModal(false) }}
                  >
                    Concluir
                  </button>
                  <button
                    className="btn btn-outline-danger btn-sm"
                    disabled={apt.status === 'concluido' || apt.status === 'cancelado'}
                    onClick={() => { updateAptStatus('cancelado'); setShowAptModal(false) }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Observações</label>
                <textarea
                  className="form-textarea"
                  value={aptObs}
                  onChange={e => setAptObs(e.target.value)}
                  placeholder="Anotações sobre o atendimento..."
                  style={{ minHeight: 80 }}
                />
              </div>
            </div>
          </Modal>
        )
      })()}

      <ConfirmModal
        isOpen={!!deleteAptTarget}
        onClose={() => setDeleteAptTarget(null)}
        onConfirm={() => setAgendamentos(prev => prev.filter(a => a.id !== deleteAptTarget.id))}
        message="O item será excluído permanentemente. Confirmar?"
      />
      <ConfirmModal
        isOpen={!!deleteSvcTarget}
        onClose={() => setDeleteSvcTarget(null)}
        onConfirm={() => setCatalogo(prev => prev.filter(s => s.id !== deleteSvcTarget.id))}
        message={`Excluir serviço "${deleteSvcTarget?.name}"? O item será excluído permanentemente. Confirmar?`}
      />
      <ConfirmModal
        isOpen={!!deleteDomTarget}
        onClose={() => setDeleteDomTarget(null)}
        onConfirm={() => setDomicilio(prev => prev.filter(s => s.id !== deleteDomTarget.id))}
        message={`Excluir serviço domiciliar "${deleteDomTarget?.name}"? O item será excluído permanentemente. Confirmar?`}
      />
      <ConfirmModal
        isOpen={!!deleteHospTarget}
        onClose={() => setDeleteHospTarget(null)}
        onConfirm={() => setHospedagens(prev => prev.filter(h => h.id !== deleteHospTarget.id))}
        message="O item será excluído permanentemente. Confirmar?"
      />

      {/* Prompt: adicionar versão domiciliar */}
      {showDomPrompt && lastSavedSvc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ maxWidth: 420, width: '100%', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Adicionar versão domiciliar?</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Deseja cadastrar também <strong>{lastSavedSvc.name}</strong> com preço diferente para atendimentos domiciliares?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDomPrompt(false)}>Não, obrigado</button>
              <button className="btn btn-primary btn-sm" onClick={() => {
                setShowDomPrompt(false)
                setEditingDom(null)
                setDomForm({ ...lastSavedSvc, id: undefined, price: '' })
                setShowDomModal(true)
              }}>Sim, cadastrar versão domiciliar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modais */}
      <Modal isOpen={showSvcModal} onClose={() => setShowSvcModal(false)} title={editingSvc ? 'Editar Serviço' : 'Novo Serviço'} size="sm"
        footer={<><button className="btn btn-ghost" onClick={() => setShowSvcModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={saveSvc}>Salvar</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={svcForm.name} onChange={e => setSvcForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Categoria</label>
            <select className="form-select" value={svcForm.category} onChange={e => setSvcForm(f => ({ ...f, category: e.target.value }))}>
              {Object.keys(CAT_COLORS).map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group"><label className="form-label">Duração (min)</label><input type="number" className="form-input" value={svcForm.duration} onChange={e => setSvcForm(f => ({ ...f, duration: Number(e.target.value) }))} /></div>
            <div className="form-group"><label className="form-label">Preço (R$)</label><input type="number" step="0.01" className="form-input" value={svcForm.price} onChange={e => setSvcForm(f => ({ ...f, price: Number(e.target.value) }))} /></div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showDomModal} onClose={() => setShowDomModal(false)} title={editingDom ? 'Editar Serviço Domiciliar' : 'Novo Serviço Domiciliar'} size="sm"
        footer={<><button className="btn btn-ghost" onClick={() => setShowDomModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={saveDom}>Salvar</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={domForm.name} onChange={e => setDomForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Categoria</label>
            <select className="form-select" value={domForm.category} onChange={e => setDomForm(f => ({ ...f, category: e.target.value }))}>
              {Object.keys(CAT_COLORS).map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group"><label className="form-label">Duração (min)</label><input type="number" className="form-input" value={domForm.duration} onChange={e => setDomForm(f => ({ ...f, duration: Number(e.target.value) }))} /></div>
            <div className="form-group"><label className="form-label">Preço domiciliar (R$)</label><input type="number" step="0.01" className="form-input" value={domForm.price} onChange={e => setDomForm(f => ({ ...f, price: Number(e.target.value) }))} /></div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showHospModal} onClose={() => setShowHospModal(false)} title="Nova Hospedagem" size="md"
        footer={<><button className="btn btn-ghost" onClick={() => setShowHospModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={saveHosp}>Salvar</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group"><label className="form-label">Pet</label>
            {(() => {
              const allPetsH = Array.isArray(petsLS) ? petsLS : PETS
              const allTutoresH = Array.isArray(tutoresLS) ? tutoresLS : TUTORES
              const sortedPetsH = [...allPetsH].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR'))
              const filteredPetsH = hospPetSearch.trim()
                ? sortedPetsH.filter(p => {
                    const t = allTutoresH.find(tt => tt.id === p.tutorId)
                    return normIncludes(p.name ?? '', hospPetSearch) || normIncludes(t?.name ?? '', hospPetSearch)
                  })
                : sortedPetsH
              const selPet = allPetsH.find(p => p.id === hospForm.petId)
              const selTutor = selPet ? allTutoresH.find(t => t.id === selPet.tutorId) : null
              return (
                <>
                  <input className="form-input" placeholder="Digite o nome do pet ou tutor..."
                    value={hospPetSearch} onChange={e => setHospPetSearch(e.target.value)}
                    style={{ marginBottom: 4 }} />
                  <select className="form-select" value={hospForm.petId}
                    onChange={e => {
                      const pet = sortedPetsH.find(p => p.id === e.target.value)
                      setHospForm(f => ({ ...f, petId: e.target.value }))
                      if (pet) setHospPetSearch(pet.name)
                    }}>
                    <option value="">Selecione</option>
                    {filteredPetsH.map(p => {
                      const t = allTutoresH.find(tt => tt.id === p.tutorId)
                      return <option key={p.id} value={p.id}>{p.name}{t ? ` (${t.name})` : ''}</option>
                    })}
                  </select>
                  {hospPetSearch.trim() && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{filteredPetsH.length} pet{filteredPetsH.length !== 1 ? 's' : ''} encontrado{filteredPetsH.length !== 1 ? 's' : ''}</span>}
                  {selTutor && <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Tutor: <strong>{selTutor.name}</strong>{selTutor.phone ? ` · ${selTutor.phone}` : ''}</p>}
                </>
              )
            })()}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group"><label className="form-label">Check-in</label><input type="date" className="form-input" value={hospForm.checkIn} onChange={e => setHospForm(f => ({ ...f, checkIn: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Check-out previsto</label><input type="date" className="form-input" value={hospForm.checkOut} onChange={e => setHospForm(f => ({ ...f, checkOut: e.target.value }))} /></div>
          </div>
          <div className="form-group"><label className="form-label">Diária (R$)</label><input type="number" step="0.01" className="form-input" value={hospForm.dailyRate} onChange={e => setHospForm(f => ({ ...f, dailyRate: Number(e.target.value) }))} /></div>
          <div className="form-group"><label className="form-label">Observações</label><textarea className="form-textarea" value={hospForm.observations} onChange={e => setHospForm(f => ({ ...f, observations: e.target.value }))} style={{ minHeight: 60 }} /></div>
        </div>
      </Modal>
    </div>
  )
}
