import { useState } from 'react'
import { Syringe, Plus, Trash2, Check } from 'lucide-react'
import Tabs from '../components/ui/Tabs'
import Modal from '../components/ui/Modal'
import { PETS } from '../data/mock'
import { getVeterinarios } from '../utils/getVeterinarios'
import { useAuth } from '../context/AuthContext'
import { usePersistentState } from '../hooks/usePersistentState'
import { normIncludes } from '../utils/normalizeText'
import ConfirmModal from '../components/ui/ConfirmModal'

const TODAY = '2026-05-15'

const INITIAL_PROTOCOLS = [
  { id: 'vp1', species: 'Cão',  name: 'V8/V10 – Múltipla',      doses: 3, intervalDays: 21,   annualBooster: true,  minAgeMonths: 2 },
  { id: 'vp2', species: 'Cão',  name: 'Antirrábica',             doses: 1, intervalDays: null,  annualBooster: true,  minAgeMonths: 3 },
  { id: 'vp3', species: 'Cão',  name: 'Gripe Canina (Bb+Pi2)',   doses: 2, intervalDays: 21,   annualBooster: true,  minAgeMonths: 3 },
  { id: 'vp4', species: 'Cão',  name: 'Leishmaniose (CanLeish)', doses: 3, intervalDays: 21,   annualBooster: true,  minAgeMonths: 4 },
  { id: 'vp5', species: 'Gato', name: 'Tríplice Felina (V3)',    doses: 3, intervalDays: 21,   annualBooster: true,  minAgeMonths: 2 },
  { id: 'vp6', species: 'Gato', name: 'Antirrábica Felina',      doses: 1, intervalDays: null,  annualBooster: true,  minAgeMonths: 3 },
  { id: 'vp7', species: 'Gato', name: 'FeLV – Leucemia Felina',  doses: 2, intervalDays: 21,   annualBooster: true,  minAgeMonths: 3 },
]

const INITIAL_APPLICATIONS = [
  { id: 'ap1', protocolId: 'vp1', petId: 'p1', date: '2026-01-10', dose: 1, lot: 'L001-26', vet: 'Dra. Tatiana Borges', notes: '' },
  { id: 'ap2', protocolId: 'vp1', petId: 'p1', date: '2026-01-31', dose: 2, lot: 'L001-26', vet: 'Dra. Tatiana Borges', notes: '' },
  { id: 'ap3', protocolId: 'vp2', petId: 'p1', date: '2026-02-15', dose: 1, lot: 'L007-25', vet: 'Dra. Tatiana Borges', notes: 'Reforço anual' },
  { id: 'ap4', protocolId: 'vp5', petId: 'p2', date: '2025-03-01', dose: 1, lot: 'L004-25', vet: 'Dra. Tatiana Borges', notes: '' },
  { id: 'ap5', protocolId: 'vp5', petId: 'p2', date: '2025-03-22', dose: 2, lot: 'L004-25', vet: 'Dra. Tatiana Borges', notes: '' },
  { id: 'ap6', protocolId: 'vp5', petId: 'p2', date: '2025-04-12', dose: 3, lot: 'L004-25', vet: 'Dra. Tatiana Borges', notes: '' },
  { id: 'ap7', protocolId: 'vp6', petId: 'p2', date: '2025-04-12', dose: 1, lot: 'L008-25', vet: 'Dra. Tatiana Borges', notes: '' },
]

const EMPTY_PROTO = { name: '', species: 'Cão', doses: 1, intervalDays: 21, annualBooster: true, minAgeMonths: 2 }
const EMPTY_APP   = { protocolId: '', petId: '', date: TODAY, dose: 1, lot: '', vet: '', notes: '' }

function getCompliance(petId, protocol, applications) {
  const petApps = applications
    .filter(a => a.petId === petId && a.protocolId === protocol.id)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (petApps.length === 0) {
    return { status: 'pending', label: 'Pendente', color: 'neutral', lastDate: null, nextDue: null, applied: 0 }
  }

  const lastApp = petApps[petApps.length - 1]
  const applied = petApps.length

  if (applied < protocol.doses) {
    let nextDue = null
    if (protocol.intervalDays) {
      const d = new Date(lastApp.date + 'T00:00')
      d.setDate(d.getDate() + protocol.intervalDays)
      nextDue = d.toISOString().split('T')[0]
    }
    return { status: 'incomplete', label: `${applied}/${protocol.doses} doses`, color: 'warning', lastDate: lastApp.date, nextDue, applied }
  }

  if (!protocol.annualBooster) {
    return { status: 'complete', label: 'Completo', color: 'success', lastDate: lastApp.date, nextDue: null, applied }
  }

  const todayDate = new Date(TODAY + 'T00:00')
  const lastDate  = new Date(lastApp.date + 'T00:00')
  const nextBooster = new Date(lastDate)
  nextBooster.setFullYear(nextBooster.getFullYear() + 1)
  const nextDue = nextBooster.toISOString().split('T')[0]

  if (todayDate > nextBooster) {
    const daysLate = Math.round((todayDate - nextBooster) / 864e5)
    return { status: 'overdue', label: `Vencida há ${daysLate}d`, color: 'danger', lastDate: lastApp.date, nextDue, applied }
  }

  const daysLeft = Math.round((nextBooster - todayDate) / 864e5)
  if (daysLeft <= 30) {
    return { status: 'due-soon', label: `Reforço em ${daysLeft}d`, color: 'warning', lastDate: lastApp.date, nextDue, applied }
  }

  return { status: 'up-to-date', label: 'Em dia', color: 'success', lastDate: lastApp.date, nextDue, applied }
}

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00').toLocaleDateString('pt-BR')
}

export default function VacinaProtocoloPage() {
  const { hasRole } = useAuth()
  const [protocols, setProtocols]       = usePersistentState('petvet-vac-protocols', INITIAL_PROTOCOLS)
  const [applications, setApplications] = usePersistentState('petvet-vac-apps', INITIAL_APPLICATIONS)
  const [activeTab, setActiveTab]     = useState('protocolos')
  const [selectedPetId, setSelectedPetId] = useState('')

  const [showProtoModal, setShowProtoModal] = useState(false)
  const [editingProto, setEditingProto]     = useState(null)
  const [protoForm, setProtoForm]           = useState(EMPTY_PROTO)

  const [showAppModal, setShowAppModal] = useState(false)
  const [appForm, setAppForm]           = useState(EMPTY_APP)
  const [appPetSearch, setAppPetSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteAppTarget, setDeleteAppTarget] = useState(null)

  function openAddProto() { setEditingProto(null); setProtoForm(EMPTY_PROTO); setShowProtoModal(true) }
  function openEditProto(p) { setEditingProto(p); setProtoForm({ ...p }); setShowProtoModal(true) }
  function saveProto() {
    if (!protoForm.name) return
    if (editingProto) {
      setProtocols(prev => prev.map(p => p.id === editingProto.id ? { ...protoForm, id: editingProto.id } : p))
    } else {
      setProtocols(prev => [...prev, { ...protoForm, id: `vp${Date.now()}` }])
    }
    setShowProtoModal(false)
  }
  function deleteProto(id) {
    setProtocols(prev => prev.filter(p => p.id !== id))
    setApplications(prev => prev.filter(a => a.protocolId !== id))
  }

  function openApply(protocolId = '', petId = '') {
    setAppForm({ ...EMPTY_APP, protocolId, petId: petId || selectedPetId })
    setShowAppModal(true)
  }
  function saveApp() {
    if (!appForm.protocolId || !appForm.petId || !appForm.date) return
    setApplications(prev => [...prev, { ...appForm, id: `ap${Date.now()}` }])
    setShowAppModal(false)
  }

  const selectedPet = PETS.find(p => p.id === selectedPetId)
  const eligibleProtocols = selectedPet
    ? protocols.filter(p => p.species === selectedPet.species)
    : []
  const vaccPets = PETS.filter(p => p.species === 'Cão' || p.species === 'Gato')

  const tabs = [
    { id: 'protocolos', label: 'Protocolos', count: protocols.length },
    { id: 'aplicacoes', label: 'Aplicações por Pet' },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Protocolo de Vacinas</h2>
          <p className="page-subtitle">Calendário vacinal e controle de aplicações</p>
        </div>
        {activeTab === 'protocolos' && hasRole('admin', 'veterinario') && (
          <button className="btn btn-primary" onClick={openAddProto}><Plus size={16} /> Novo Protocolo</button>
        )}
        {activeTab === 'aplicacoes' && hasRole('admin', 'veterinario', 'atendente') && (
          <button className="btn btn-primary" onClick={() => openApply()}><Syringe size={16} /> Registrar Aplicação</button>
        )}
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* PROTOCOLOS */}
      {activeTab === 'protocolos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {['Cão', 'Gato'].map(species => {
            const speciesProtos = protocols.filter(p => p.species === species)
            return (
              <div key={species} className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, color: 'var(--text-primary)' }}>{species}</h3>
                  <span className="badge badge-neutral">{speciesProtos.length} protocolos</span>
                </div>
                {speciesProtos.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nenhum protocolo cadastrado para esta espécie.</p>
                ) : (
                  <div className="table-wrapper" style={{ margin: 0 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Vacina</th><th>Doses</th><th>Intervalo</th><th>Reforço anual</th><th>Idade mín.</th>
                          {hasRole('admin', 'veterinario') && <th>Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {speciesProtos.map(p => (
                          <tr key={p.id}>
                            <td style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{p.name}</td>
                            <td>{p.doses}x</td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{p.intervalDays ? `${p.intervalDays} dias` : '—'}</td>
                            <td>
                              {p.annualBooster
                                ? <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={10} /> Sim</span>
                                : <span className="badge badge-neutral">Não</span>}
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{p.minAgeMonths} meses</td>
                            {hasRole('admin', 'veterinario') && (
                              <td>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button className="btn btn-outline btn-sm" onClick={() => openEditProto(p)}>Editar</button>
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    style={{ color: 'var(--danger)' }}
                                    onClick={() => setDeleteTarget(p)}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* APLICAÇÕES */}
      {activeTab === 'aplicacoes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: '14px 16px' }}>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Selecionar pet</p>
            <PetSearchSelect pets={vaccPets} value={selectedPetId} onChange={setSelectedPetId} />
          </div>

          {!selectedPet && (
            <div className="card" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-muted)' }}>
              <Syringe size={32} style={{ margin: '0 auto 12px', opacity: 0.25 }} />
              <p>Selecione um pet para visualizar o status vacinal</p>
            </div>
          )}

          {selectedPet && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#d4f0ee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Syringe size={20} style={{ color: 'var(--teal)' }} />
                </div>
                <div>
                  <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>{selectedPet.name}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{selectedPet.species} · {selectedPet.breed}</p>
                </div>
              </div>

              {eligibleProtocols.length === 0 ? (
                <div className="card" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '20px' }}>
                  Nenhum protocolo cadastrado para {selectedPet.species}.
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Vacina</th><th>Status</th><th>Doses</th><th>Última aplicação</th><th>Próximo reforço</th><th>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eligibleProtocols.map(proto => {
                        const c = getCompliance(selectedPetId, proto, applications)
                        return (
                          <tr key={proto.id}>
                            <td style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{proto.name}</td>
                            <td><span className={`badge badge-${c.color}`}>{c.label}</span></td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{c.applied}/{proto.doses}</td>
                            <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{fmtDate(c.lastDate)}</td>
                            <td style={{ fontSize: '0.8125rem', color: c.status === 'overdue' ? 'var(--danger)' : 'var(--text-muted)' }}>
                              {fmtDate(c.nextDue)}
                            </td>
                            <td>
                              <button className="btn btn-outline btn-sm" onClick={() => openApply(proto.id, selectedPetId)}>
                                {c.status === 'up-to-date' || c.status === 'overdue' ? 'Reforço' : 'Aplicar'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {applications.filter(a => a.petId === selectedPetId).length > 0 && (
                <div className="card">
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, fontSize: '0.9375rem' }}>
                    Histórico de aplicações
                  </h3>
                  <div className="table-wrapper" style={{ margin: 0 }}>
                    <table>
                      <thead>
                        <tr><th>Data</th><th>Vacina</th><th>Dose</th><th>Lote</th><th>Veterinário</th><th></th></tr>
                      </thead>
                      <tbody>
                        {applications
                          .filter(a => a.petId === selectedPetId)
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map(a => {
                            const proto = protocols.find(p => p.id === a.protocolId)
                            return (
                              <tr key={a.id}>
                                <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{fmtDate(a.date)}</td>
                                <td style={{ fontWeight: 600, fontSize: '0.875rem' }}>{proto?.name ?? '—'}</td>
                                <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{a.dose}ª dose</td>
                                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--teal)' }}>{a.lot || '—'}</td>
                                <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{a.vet || '—'}</td>
                                <td>
                                  {hasRole('admin', 'veterinario') && (
                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setDeleteAppTarget(a)}>
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal Protocolo */}
      <Modal
        isOpen={showProtoModal}
        onClose={() => setShowProtoModal(false)}
        title={editingProto ? 'Editar Protocolo' : 'Novo Protocolo'}
        size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowProtoModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={saveProto}>Salvar</button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Nome da vacina *</label>
            <input className="form-input" value={protoForm.name} onChange={e => setProtoForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Antirrábica, V8/V10..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Espécie</label>
              <select className="form-select" value={protoForm.species} onChange={e => setProtoForm(f => ({ ...f, species: e.target.value }))}>
                <option>Cão</option>
                <option>Gato</option>
                <option>Outros</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nº de doses</label>
              <input type="number" min="1" max="5" className="form-input" value={protoForm.doses} onChange={e => setProtoForm(f => ({ ...f, doses: Number(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Intervalo entre doses (dias)</label>
              <input type="number" min="0" className="form-input" value={protoForm.intervalDays ?? ''} onChange={e => setProtoForm(f => ({ ...f, intervalDays: e.target.value ? Number(e.target.value) : null }))} placeholder="Ex: 21" />
            </div>
            <div className="form-group">
              <label className="form-label">Idade mínima (meses)</label>
              <input type="number" min="0" className="form-input" value={protoForm.minAgeMonths} onChange={e => setProtoForm(f => ({ ...f, minAgeMonths: Number(e.target.value) }))} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={protoForm.annualBooster}
              style={{ accentColor: 'var(--teal)', width: 16, height: 16 }}
              onChange={e => setProtoForm(f => ({ ...f, annualBooster: e.target.checked }))}
            />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Requer reforço anual</span>
          </label>
        </div>
      </Modal>

      {/* Modal Aplicação */}
      <Modal
        isOpen={showAppModal}
        onClose={() => setShowAppModal(false)}
        title="Registrar Aplicação"
        size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowAppModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={saveApp}>Registrar</button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Pet</label>
            <input
              className="form-input"
              placeholder="Digitar nome ou raça para filtrar..."
              value={appPetSearch}
              onChange={e => setAppPetSearch(e.target.value)}
              style={{ marginBottom: 6 }}
            />
            <select className="form-select" value={appForm.petId} onChange={e => { setAppForm(f => ({ ...f, petId: e.target.value })); setAppPetSearch('') }}>
              <option value="">— Selecione —</option>
              {vaccPets
                .filter(p => !appPetSearch || normIncludes(p.name, appPetSearch) || normIncludes(p.breed, appPetSearch))
                .map(p => <option key={p.id} value={p.id}>{p.name} ({p.species} · {p.breed})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Protocolo / Vacina</label>
            <select className="form-select" value={appForm.protocolId} onChange={e => setAppForm(f => ({ ...f, protocolId: e.target.value }))}>
              <option value="">— Selecione —</option>
              {protocols
                .filter(p => !appForm.petId || p.species === (PETS.find(pt => pt.id === appForm.petId)?.species))
                .map(p => <option key={p.id} value={p.id}>{p.name} ({p.species})</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Data da aplicação</label>
              <input type="date" className="form-input" value={appForm.date} onChange={e => setAppForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Nº da dose</label>
              <input type="number" min="1" max="10" className="form-input" value={appForm.dose} onChange={e => setAppForm(f => ({ ...f, dose: Number(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Lote</label>
              <input className="form-input" value={appForm.lot} onChange={e => setAppForm(f => ({ ...f, lot: e.target.value }))} placeholder="Nº do lote" />
            </div>
            <div className="form-group">
              <label className="form-label">Veterinário</label>
              <select className="form-select" value={appForm.vet} onChange={e => setAppForm(f => ({ ...f, vet: e.target.value }))}>
                <option value="">— Selecione —</option>
                {getVeterinarios().map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <input className="form-input" value={appForm.notes} onChange={e => setAppForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional" />
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        key="proto-del"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { deleteProto(deleteTarget.id); setDeleteTarget(null) }}
        message={`Excluir protocolo "${deleteTarget?.name}"? Todas as aplicações vinculadas também serão removidas.`}
      />
      <ConfirmModal
        isOpen={!!deleteAppTarget}
        onClose={() => setDeleteAppTarget(null)}
        onConfirm={() => { setApplications(prev => prev.filter(a => a.id !== deleteAppTarget.id)); setDeleteAppTarget(null) }}
        message="Esta aplicação será excluída permanentemente. Confirmar?"
      />
    </div>
  )
}

function PetSearchSelect({ pets, value, onChange }) {
  const [search, setSearch] = useState('')
  const filtered = pets.filter(p => !search || normIncludes(p.name, search) || normIncludes(p.breed, search))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input className="form-input" placeholder="Digitar nome para filtrar..." value={search} onChange={e => setSearch(e.target.value)} />
      <select className="form-select" value={value} onChange={e => { onChange(e.target.value); setSearch('') }}>
        <option value="">— Selecione um pet —</option>
        {filtered.map(p => <option key={p.id} value={p.id}>{p.name} ({p.species} · {p.breed})</option>)}
      </select>
    </div>
  )
}
