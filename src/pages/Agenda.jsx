import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Trash2 } from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmModal from '../components/ui/ConfirmModal'
import { AGENDAMENTOS, PETS, TUTORES, VETS, getPetById, getTutorById } from '../data/mock'
import { useAuth } from '../context/AuthContext'
import { usePersistentState } from '../hooks/usePersistentState'

const TYPE_CONFIG = {
  consulta:        { label: 'Consulta',       color: '#27B5AC', bg: '#d4f0ee' },
  retorno:         { label: 'Retorno',         color: '#f6820c', bg: '#fde8c8' },
  cirurgia:        { label: 'Cirurgia',        color: '#e53e3e', bg: '#fed7d7' },
  vacina:          { label: 'Vacina',          color: '#3182ce', bg: '#bee3f8' },
  banho:           { label: 'Banho & Tosa',    color: '#DE098D', bg: '#fce4f3' },
  outros:          { label: 'Outros',          color: '#718096', bg: '#edf2f7' },
}

const STATUS_CONFIG = {
  agendado:        { label: 'Agendado',        color: 'neutral' },
  confirmado:      { label: 'Confirmado',      color: 'teal' },
  'em-atendimento':{ label: 'Em atendimento', color: 'warning' },
  concluido:       { label: 'Concluído',       color: 'success' },
  cancelado:       { label: 'Cancelado',       color: 'danger' },
}

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const EMPTY_APT = { petId: '', tutorId: '', vetId: '', date: '', time: '09:00', duration: 30, type: 'consulta', status: 'agendado', notes: '' }

function dateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function isToday(y, m, d) {
  return dateStr(y, m, d) === '2026-05-14'
}

export default function AgendaPage({ navParams = {} }) {
  const { hasRole } = useAuth()
  const today = new Date('2026-05-14')
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState(today.getDate())
  const [rawAgendamentos, setAgendamentos] = usePersistentState('petvet-agendamentos', AGENDAMENTOS)
  const [showModal, setShowModal] = useState(false)
  const [editingApt, setEditingApt] = useState(null)
  const [form, setForm] = useState(EMPTY_APT)
  const [statusFilter, setStatusFilter] = useState('todos')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [mobileView, setMobileView] = useState('lista')

  // Garante que agendamentos é sempre um array válido
  const agendamentos = Array.isArray(rawAgendamentos) ? rawAgendamentos : []

  useEffect(() => {
    if (navParams.petId && navParams.openNew) {
      setEditingApt(null)
      setForm({
        ...EMPTY_APT,
        petId: navParams.petId,
        type: navParams.type ?? 'consulta',
        date: dateStr(today.getFullYear(), today.getMonth(), today.getDate()),
      })
      setShowModal(true)
    }
  }, [navParams.petId, navParams.openNew, navParams.type])

  // Calendar grid
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function getAptsForDay(d) {
    return agendamentos.filter(a => a?.date === dateStr(year, month, d))
  }

  function getAptsForSelected() {
    let apts = agendamentos.filter(a => a?.date === dateStr(year, month, selectedDay))
    if (statusFilter !== 'todos') apts = apts.filter(a => a.status === statusFilter)
    return apts.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
    setSelectedDay(1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
    setSelectedDay(1)
  }

  function openNew() {
    setEditingApt(null)
    setForm({ ...EMPTY_APT, date: dateStr(year, month, selectedDay) })
    setShowModal(true)
  }

  function openEdit(apt) {
    setEditingApt(apt)
    setForm({ ...apt })
    setShowModal(true)
  }

  function saveApt() {
    const data = {
      ...form,
      tutorId: PETS.find(p => p.id === form.petId)?.tutorId ?? form.tutorId,
    }
    if (editingApt) {
      setAgendamentos(prev => prev.map(a => a.id === editingApt.id ? { ...data, id: editingApt.id } : a))
    } else {
      setAgendamentos(prev => [...prev, { ...data, id: `a${Date.now()}` }])
    }
    setShowModal(false)
  }

  function updateStatus(id, newStatus) {
    setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a))
  }

  const selectedApts = getAptsForSelected()
  const selectedDateLabel = `${selectedDay} de ${MONTHS_PT[month]} de ${year}`

  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthApts = agendamentos
    .filter(a => a?.date?.startsWith(monthPrefix))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.time ?? '').localeCompare(b.time ?? ''))

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Agenda</h2>
          <p className="page-subtitle">{agendamentos.filter(a => a?.date === '2026-05-14').length} agendamentos hoje</p>
        </div>
        {hasRole('admin', 'atendente', 'veterinario') && (
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={16} /> Novo Agendamento
          </button>
        )}
      </div>

      {/* Toggle calendário/lista — visível só em mobile via CSS */}
      <div className="agenda-toggle-view">
        <button
          className={mobileView === 'lista' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
          onClick={() => setMobileView('lista')}
        >
          📋 Lista
        </button>
        <button
          className={mobileView === 'calendar' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
          onClick={() => setMobileView('calendar')}
        >
          📅 Calendário
        </button>
      </div>

      {/* Vista Lista mobile */}
      {mobileView === 'lista' && (
        <div className="agenda-list-mobile">
          {monthApts.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Nenhum agendamento em {MONTHS_PT[month]}.
            </div>
          ) : (
            <div className="agenda-list-items" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {monthApts.map(apt => {
                const pet = getPetById(apt.petId)
                const tutor = pet ? getTutorById(pet.tutorId) : null
                const cfg = TYPE_CONFIG[apt.type] ?? TYPE_CONFIG.outros
                const stCfg = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.agendado
                return (
                  <div
                    key={apt.id}
                    className="card"
                    style={{ padding: '12px 14px', borderLeft: `3px solid ${cfg.color}`, cursor: hasRole('admin', 'atendente', 'veterinario') ? 'pointer' : 'default' }}
                    onClick={() => hasRole('admin', 'atendente', 'veterinario') && openEdit(apt)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                          {apt.date.split('-').reverse().join('/')} {apt.time} · {pet?.name ?? '?'}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {cfg.label} · {tutor?.name ?? '—'}
                        </p>
                      </div>
                      <span className={`badge badge-${stCfg.color}`} style={{ fontSize: '0.65rem', flexShrink: 0 }}>{stCfg.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className={`agenda-main-grid${mobileView === 'lista' ? ' agenda-desktop-only' : ''}`}>
        {/* CALENDAR */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <button className="btn btn-ghost btn-icon" onClick={prevMonth}><ChevronLeft size={18} /></button>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
              {MONTHS_PT[month]} {year}
            </h3>
            <button className="btn btn-ghost btn-icon" onClick={nextMonth}><ChevronRight size={18} /></button>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, padding: '8px 20px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: cfg.color, display: 'inline-block' }} />
                {cfg.label}
              </span>
            ))}
          </div>

          {/* Grid header + Days — scroll horizontal em mobile */}
          <div className="agenda-cal-scroll">
            <div className="agenda-cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {WEEK_DAYS.map(d => (
                <div key={d} style={{ textAlign: 'center', padding: '8px 4px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)', background: 'var(--surface-2)', textTransform: 'uppercase' }}>
                  {d}
                </div>
              ))}
            </div>

            <div className="agenda-cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {cells.map((day, idx) => {
                const apts = day ? getAptsForDay(day) : []
                const isSel = day === selectedDay
                const todayCell = isToday(year, month, day)

                return (
                  <div
                    key={idx}
                    className={`agenda-cal-cell${!day ? ' empty' : ''}`}
                    onClick={() => day && setSelectedDay(day)}
                    style={{
                      background: !day ? 'var(--surface-2)' : isSel ? 'rgba(39,181,172,0.06)' : 'var(--surface)',
                      boxShadow: isSel ? 'inset 0 0 0 2px var(--teal)' : 'none',
                    }}
                    onMouseEnter={e => { if (day && !isSel) e.currentTarget.style.background = 'var(--surface-2)' }}
                    onMouseLeave={e => { if (day) e.currentTarget.style.background = isSel ? 'rgba(39,181,172,0.06)' : 'var(--surface)' }}
                  >
                    {day && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 3 }}>
                          <span style={{
                            width: 22, height: 22, borderRadius: '50%',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.8125rem', fontWeight: todayCell ? 800 : 500,
                            background: todayCell ? 'var(--teal)' : 'transparent',
                            color: todayCell ? '#fff' : 'var(--text-primary)',
                          }}>
                            {day}
                          </span>
                        </div>
                        {apts.slice(0, 3).map(a => {
                          const cfg = TYPE_CONFIG[a.type] ?? TYPE_CONFIG.outros
                          return (
                            <div key={a.id} style={{
                              fontSize: '0.65rem', padding: '1px 3px', borderRadius: 3, marginBottom: 2,
                              background: cfg.bg, color: cfg.color, fontWeight: 600,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              borderLeft: `2px solid ${cfg.color}`,
                            }}>
                              {a.time} {getPetById(a.petId)?.name ?? '?'}
                            </div>
                          )
                        })}
                        {apts.length > 3 && (
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            +{apts.length - 3}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* DAY PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 80 }}>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {selectedDateLabel}
              </h3>
              {hasRole('admin', 'atendente', 'veterinario') && (
                <button className="btn btn-primary btn-sm btn-icon" onClick={openNew} title="Novo agendamento">
                  <Plus size={15} />
                </button>
              )}
            </div>

            <select className="form-select" style={{ marginBottom: 10, fontSize: '0.8rem' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="todos">Todos os status</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>

            {selectedApts.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem', padding: '20px 0' }}>
                Nenhum agendamento
              </p>
            ) : (
              <div className="agenda-day-items" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedApts.map(apt => {
                  const pet = getPetById(apt.petId)
                  const tutor = pet ? getTutorById(pet.tutorId) : null
                  const cfg = TYPE_CONFIG[apt.type] ?? TYPE_CONFIG.outros
                  const stCfg = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.agendado
                  return (
                    <div
                      key={apt.id}
                      style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--surface-2)', borderLeft: `3px solid ${cfg.color}`, cursor: hasRole('admin', 'atendente', 'veterinario') ? 'pointer' : 'default' }}
                      onClick={() => hasRole('admin', 'atendente', 'veterinario') && openEdit(apt)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{apt.time} · {pet?.name ?? '?'}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span className={`badge badge-${stCfg.color}`} style={{ fontSize: '0.65rem' }}>{stCfg.label}</span>
                          {hasRole('admin') && (
                            <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)', padding: 2 }}
                              onClick={e => { e.stopPropagation(); setDeleteTarget(apt) }} title="Excluir">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{cfg.label} · {tutor?.name ?? '—'}</div>
                      {apt.status === 'agendado' && hasRole('admin', 'atendente') && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                          <button className="btn btn-outline btn-sm" style={{ fontSize: '0.7rem', padding: '3px 8px' }} onClick={e => { e.stopPropagation(); updateStatus(apt.id, 'confirmado') }}>Confirmar</button>
                          <button className="btn btn-outline-danger btn-sm" style={{ fontSize: '0.7rem', padding: '3px 8px' }} onClick={e => { e.stopPropagation(); updateStatus(apt.id, 'cancelado') }}>Cancelar</button>
                        </div>
                      )}
                      {apt.status === 'confirmado' && hasRole('admin', 'atendente', 'veterinario') && (
                        <button className="btn btn-primary btn-sm" style={{ fontSize: '0.7rem', padding: '3px 10px', marginTop: 6 }} onClick={e => { e.stopPropagation(); updateStatus(apt.id, 'em-atendimento') }}>
                          Iniciar atendimento
                        </button>
                      )}
                      {apt.status === 'em-atendimento' && hasRole('admin', 'veterinario') && (
                        <button className="btn btn-primary btn-sm" style={{ fontSize: '0.7rem', padding: '3px 10px', marginTop: 6, background: 'var(--success)', borderColor: 'var(--success)' }} onClick={e => { e.stopPropagation(); updateStatus(apt.id, 'concluido') }}>
                          Concluir
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => setAgendamentos(prev => prev.filter(a => a.id !== deleteTarget.id))}
        message="O item será excluído permanentemente. Confirmar?"
      />

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingApt ? 'Editar Agendamento' : 'Novo Agendamento'}
        size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={saveApt}>Salvar</button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Pet *</label>
            <select className="form-select" value={form.petId} onChange={e => setForm(f => ({ ...f, petId: e.target.value }))}>
              <option value="">Selecione</option>
              {PETS.map(p => {
                const t = getTutorById(p.tutorId)
                return <option key={p.id} value={p.id}>{p.name} ({t?.name ?? ''})</option>
              })}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Data *</label>
              <input type="date" className="form-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Horário *</label>
              <input type="time" className="form-input" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Duração (min)</label>
              <input type="number" className="form-input" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Veterinário</label>
            <select className="form-select" value={form.vetId} onChange={e => setForm(f => ({ ...f, vetId: e.target.value }))}>
              <option value="">Selecione</option>
              {VETS.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observações do agendamento..." style={{ minHeight: 60 }} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
