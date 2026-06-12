import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2, AlertTriangle, X } from 'lucide-react'
import Modal from '../components/ui/Modal'
import AccessDenied from '../components/ui/AccessDenied'
import ConfirmModal from '../components/ui/ConfirmModal'
import EnderecoFields from '../components/ui/EnderecoFields'
import MapaModal from '../components/ui/MapaModal'
import { AGENDAMENTOS, PETS, TUTORES } from '../data/mock'
import { getVeterinarios, findVetById } from '../utils/getVeterinarios'
import { useAuth } from '../context/AuthContext'
import { usePersistentState } from '../hooks/usePersistentState'
import { useFollowup } from '../context/FollowupContext'
import { normIncludes } from '../utils/normalizeText'
import { EMPTY_ENDERECO, getEnderecoObj, montarEnderecoMapa, enderecoCompleto } from '../utils/endereco'

const BATH_TYPES = ['banho', 'sobanho', 'tosa']

const TYPE_CONFIG = {
  consulta:  { label: 'Consulta',     color: '#27B5AC', bg: '#d4f0ee' },
  retorno:   { label: 'Retorno',      color: '#f6820c', bg: '#fde8c8' },
  cirurgia:  { label: 'Cirurgia',     color: '#e53e3e', bg: '#fed7d7' },
  vacina:    { label: 'Vacina',       color: '#3182ce', bg: '#bee3f8' },
  banho:     { label: 'Banho & Tosa', color: '#DE098D', bg: '#fce4f3' },
  sobanho:   { label: 'Banho',        color: '#0ea5e9', bg: '#e0f2fe' },
  tosa:      { label: 'Tosa',         color: '#8b5cf6', bg: '#ede9fe' },
  outros:    { label: 'Outros',       color: '#718096', bg: '#edf2f7' },
}

const STATUS_CONFIG = {
  agendado:         { label: 'Agendado',       color: 'neutral' },
  confirmado:       { label: 'Confirmado',     color: 'teal' },
  'em-atendimento': { label: 'Em atendimento', color: 'warning' },
  concluido:        { label: 'Concluído',       color: 'success' },
  cancelado:        { label: 'Cancelado',       color: 'danger' },
}

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const EMPTY_APT = {
  petId: '', tutorId: '', vetId: '', banistaId: '',
  date: '', time: '09:00', duration: 30,
  type: 'consulta', status: 'agendado', notes: '',
  tipoAtendimento: 'presencial', endereco: { ...EMPTY_ENDERECO },
}

// Normaliza o endereço do agendamento, suportando o formato antigo (string em enderecoAtendimento)
function getAptEndereco(apt) {
  if (apt?.endereco && typeof apt.endereco === 'object') return apt.endereco
  return getEnderecoObj(apt?.enderecoAtendimento ?? '')
}

function dateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function isToday(y, m, d) {
  return dateStr(y, m, d) === '2026-05-14'
}

function timeToMinutes(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// ── Barra de filtros reutilizável ────────────────────────────────────────────
function FiltroBarra({ statusFilter, setStatusFilter, typeFilter, setTypeFilter, profFilter, setProfFilter, vets, banhistas, hasActive, onClear, count, compact }) {
  const selectStyle = { fontSize: '0.78rem', padding: '5px 8px', height: 34 }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {/* Status */}
        <select
          className="form-select"
          style={selectStyle}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="todos">Todos os status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        {/* Tipo */}
        <select
          className="form-select"
          style={selectStyle}
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="todos">Todos os tipos</option>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        {/* Profissional */}
        <select
          className="form-select"
          style={selectStyle}
          value={profFilter}
          onChange={e => setProfFilter(e.target.value)}
        >
          <option value="todos">Todos os profissionais</option>
          {vets.length > 0 && (
            <optgroup label="Veterinários">
              {vets.map(v => (
                <option key={`vet:${v.id}`} value={`vet:${v.id}`}>{v.name}</option>
              ))}
            </optgroup>
          )}
          {banhistas.length > 0 && (
            <optgroup label="Banhistas / Tosadores">
              {banhistas.map(b => (
                <option key={`ban:${b.id}`} value={`ban:${b.id}`}>{b.nome}</option>
              ))}
            </optgroup>
          )}
        </select>

        {hasActive && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClear}
            title="Limpar filtros"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', height: 34, padding: '0 10px' }}
          >
            <X size={12} /> Limpar
          </button>
        )}
      </div>

      {/* Contador */}
      <p style={{ fontSize: '0.75rem', color: hasActive ? 'var(--teal)' : 'var(--text-muted)', fontWeight: hasActive ? 600 : 400 }}>
        {count} agendamento{count !== 1 ? 's' : ''}{hasActive ? ' (filtrado)' : ''}
      </p>
    </div>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

export default function AgendaPage({ navParams = {} }) {
  const { hasRole, hasPermission } = useAuth()
  const { enqueueFollowup } = useFollowup()
  const today = new Date('2026-05-14')
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState(today.getDate())
  const [rawAgendamentos, setAgendamentos] = usePersistentState('petvet-agendamentos', AGENDAMENTOS)
  const [funcionarios] = usePersistentState('petvet-funcionarios', [])
  const [petsLS] = usePersistentState('petvet-pets', PETS)
  const [tutoresLS] = usePersistentState('petvet-tutores', TUTORES)
  const [petSearch, setPetSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingApt, setEditingApt] = useState(null)
  const [form, setForm] = useState(EMPTY_APT)
  const [statusFilter, setStatusFilter] = useState('todos')
  const [typeFilter, setTypeFilter] = useState('todos')
  const [profFilter, setProfFilter] = useState('todos')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [mobileView, setMobileView] = useState('lista')
  const [conflictWarning, setConflictWarning] = useState(null)
  const [mapModalEndereco, setMapModalEndereco] = useState(null)
  const timeInputRef = useRef(null)

  const agendamentos = Array.isArray(rawAgendamentos) ? rawAgendamentos : []
  const vets = getVeterinarios()
  const banhistas = (funcionarios || []).filter(f => f.apareceAgenda && f.ativo !== false)
  const hasActiveFilters = statusFilter !== 'todos' || typeFilter !== 'todos' || profFilter !== 'todos'

  const allPetsList = [...PETS, ...(Array.isArray(petsLS) ? petsLS.filter(p => !PETS.find(mp => mp.id === p.id)) : [])]
  const allTutoresList = [...TUTORES, ...(Array.isArray(tutoresLS) ? tutoresLS.filter(t => !TUTORES.find(mt => mt.id === t.id)) : [])]
  const petsMap = new Map(allPetsList.map(p => [p.id, p]))
  const tutoresMap = new Map(allTutoresList.map(t => [t.id, t]))
  const getPetByIdComp = id => (id ? petsMap.get(id) ?? null : null)
  const getTutorByIdComp = id => (id ? tutoresMap.get(id) ?? null : null)

  function clearFilters() {
    setStatusFilter('todos')
    setTypeFilter('todos')
    setProfFilter('todos')
  }

  // Aplica os 3 filtros combinados (AND)
  function applyFilters(apts) {
    let result = apts
    if (statusFilter !== 'todos')
      result = result.filter(a => a.status === statusFilter)
    if (typeFilter !== 'todos')
      result = result.filter(a => a.type === typeFilter)
    if (profFilter !== 'todos') {
      const [pt, pid] = profFilter.split(':')
      result = result.filter(a =>
        pt === 'vet' ? a.vetId === pid : a.banistaId === pid
      )
    }
    return result
  }

  useEffect(() => {
    if (navParams.petId && navParams.openNew) {
      setEditingApt(null)
      setForm({
        ...EMPTY_APT,
        petId: navParams.petId,
        type: navParams.type ?? 'consulta',
        date: dateStr(today.getFullYear(), today.getMonth(), today.getDate()),
      })
      const allPetsM = Array.isArray(petsLS) ? petsLS : PETS
      const pet = allPetsM.find(p => p.id === navParams.petId)
      setPetSearch(pet?.name ?? '')
      setShowModal(true)
    }
  }, [navParams.petId, navParams.openNew, navParams.type])

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
    const raw = agendamentos.filter(a => a?.date === dateStr(year, month, selectedDay))
    return applyFilters(raw).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
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
    setPetSearch('')
    setShowModal(true)
  }

  function openEdit(apt) {
    setEditingApt(apt)
    setForm({ ...apt, endereco: getAptEndereco(apt) })
    const allPetsM = Array.isArray(petsLS) ? petsLS : PETS
    const pet = allPetsM.find(p => p.id === apt.petId)
    setPetSearch(pet?.name ?? '')
    setShowModal(true)
  }

  function handleTypeChange(newType) {
    const wasBath = BATH_TYPES.includes(form.type)
    const isBath = BATH_TYPES.includes(newType)
    setForm(f => ({
      ...f,
      type: newType,
      vetId: isBath ? '' : (wasBath ? '' : f.vetId),
      banistaId: !isBath ? '' : f.banistaId,
    }))
  }

  function findConflict(data) {
    const isBath = BATH_TYPES.includes(data.type)
    const profId = isBath ? data.banistaId : data.vetId
    const profField = isBath ? 'banistaId' : 'vetId'
    if (!profId || !data.date || !data.time) return null
    const formStart = timeToMinutes(data.time)
    const formEnd = formStart + (data.duration || 30)
    return agendamentos.find(a => {
      if (a.date !== data.date) return false
      if (a[profField] !== profId) return false
      if (editingApt && a.id === editingApt.id) return false
      if (a.status === 'cancelado') return false
      const aptStart = timeToMinutes(a.time)
      const aptEnd = aptStart + (a.duration || 30)
      return formStart < aptEnd && aptStart < formEnd
    }) ?? null
  }

  function doSave(data) {
    if (editingApt) {
      setAgendamentos(prev => prev.map(a => a.id === editingApt.id ? { ...data, id: editingApt.id } : a))
    } else {
      setAgendamentos(prev => [...prev, { ...data, id: `a${Date.now()}` }])
    }
    setShowModal(false)
    setConflictWarning(null)
  }

  function saveApt() {
    const pet = getPetByIdComp(form.petId)
    const tutor = pet ? getTutorByIdComp(pet.tutorId) : null
    const data = {
      ...form,
      petName: pet?.name ?? form.petName ?? '',
      petSpecies: pet?.species ?? form.petSpecies ?? '',
      tutorId: pet?.tutorId ?? form.tutorId ?? '',
      tutorName: tutor?.name ?? form.tutorName ?? '',
      tutorPhone: tutor?.phone ?? form.tutorPhone ?? '',
    }
    const conflict = findConflict(data)
    if (conflict) {
      setShowModal(false)
      setConflictWarning({ data, conflict })
      return
    }
    doSave(data)
  }

  function handleVoltarCorrigir() {
    setConflictWarning(null)
    setShowModal(true)
    setTimeout(() => timeInputRef.current?.focus(), 150)
  }

  function updateStatus(id, newStatus) {
    setAgendamentos(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, status: newStatus } : a)
      if (newStatus === 'concluido') {
        const apt = updated.find(a => a.id === id)
        if (apt) enqueueFollowup(apt)
      }
      return updated
    })
  }

  function getProfissionalName(apt) {
    const isBath = BATH_TYPES.includes(apt.type)
    if (isBath && apt.banistaId) {
      const b = (funcionarios || []).find(f => f.id === apt.banistaId)
      return b ? `Banhista: ${b.nome}` : null
    }
    if (!isBath && apt.vetId) {
      const v = findVetById(apt.vetId)
      return v ? `Dr(a). ${v.name}` : null
    }
    return null
  }

  const selectedApts = getAptsForSelected()
  const selectedDateLabel = `${selectedDay} de ${MONTHS_PT[month]} de ${year}`
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthApts = applyFilters(
    agendamentos.filter(a => a?.date?.startsWith(monthPrefix))
  ).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.time ?? '').localeCompare(b.time ?? ''))

  const isBathForm = BATH_TYPES.includes(form.type)

  const filtroBarra = (
    <FiltroBarra
      statusFilter={statusFilter} setStatusFilter={setStatusFilter}
      typeFilter={typeFilter} setTypeFilter={setTypeFilter}
      profFilter={profFilter} setProfFilter={setProfFilter}
      vets={vets}
      banhistas={banhistas}
      hasActive={hasActiveFilters}
      onClear={clearFilters}
      count={selectedApts.length}
    />
  )

  const filtroBarraMes = (
    <FiltroBarra
      statusFilter={statusFilter} setStatusFilter={setStatusFilter}
      typeFilter={typeFilter} setTypeFilter={setTypeFilter}
      profFilter={profFilter} setProfFilter={setProfFilter}
      vets={vets}
      banhistas={banhistas}
      hasActive={hasActiveFilters}
      onClear={clearFilters}
      count={monthApts.length}
    />
  )

  if (!hasPermission('agenda', 'view')) {
    return <AccessDenied title="Agenda" />
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Agenda</h2>
          <p className="page-subtitle">{agendamentos.filter(a => a?.date === '2026-05-14').length} agendamentos hoje</p>
        </div>
        {hasPermission('agenda', 'edit') && (
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

      {/* Vista Lista mobile — com filtros */}
      {mobileView === 'lista' && (
        <div className="agenda-list-mobile">
          {/* Filtros da lista */}
          <div className="card" style={{ padding: '12px 14px', marginBottom: 8 }}>
            {filtroBarraMes}
          </div>

          {monthApts.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {hasActiveFilters
                ? 'Nenhum agendamento com os filtros selecionados.'
                : `Nenhum agendamento em ${MONTHS_PT[month]}.`}
            </div>
          ) : (
            <div className="agenda-list-items" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {monthApts.map(apt => {
                const pet = getPetByIdComp(apt.petId)
                const tutor = apt.tutorId ? getTutorByIdComp(apt.tutorId) : (pet ? getTutorByIdComp(pet.tutorId) : null)
                const petName = apt.petName || pet?.name || '?'
                const tutorName = apt.tutorName || tutor?.name || '—'
                const cfg = TYPE_CONFIG[apt.type] ?? TYPE_CONFIG.outros
                const stCfg = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.agendado
                const profName = getProfissionalName(apt)
                return (
                  <div
                    key={apt.id}
                    className="card"
                    style={{ padding: '12px 14px', borderLeft: `3px solid ${cfg.color}`, cursor: hasPermission('agenda', 'edit') ? 'pointer' : 'default' }}
                    onClick={() => hasPermission('agenda', 'edit') && openEdit(apt)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                          {apt.date.split('-').reverse().join('/')} {apt.time} · {petName}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {cfg.label} · {tutorName}{profName ? ` · ${profName}` : ''}
                        </p>
                        {apt.tipoAtendimento === 'domiciliar' && montarEnderecoMapa(getAptEndereco(apt)) && (
                          <p style={{ fontSize: '0.72rem', color: 'var(--teal)', marginTop: 1, cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={e => { e.stopPropagation(); setMapModalEndereco(getAptEndereco(apt)) }}>
                            📍 {montarEnderecoMapa(getAptEndereco(apt))}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                        {apt.tipoAtendimento === 'domiciliar' && (
                          <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: 4, background: '#e6f0ff', color: '#1a5fb4', fontWeight: 600, border: '1px solid #a3c3ef' }}>🏠 Dom.</span>
                        )}
                        <span className={`badge badge-${stCfg.color}`} style={{ fontSize: '0.65rem' }}>{stCfg.label}</span>
                      </div>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <button className="btn btn-ghost btn-icon" onClick={prevMonth}><ChevronLeft size={18} /></button>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
              {MONTHS_PT[month]} {year}
            </h3>
            <button className="btn btn-ghost btn-icon" onClick={nextMonth}><ChevronRight size={18} /></button>
          </div>

          {/* Legenda de tipos */}
          <div style={{ display: 'flex', gap: 12, padding: '8px 20px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: cfg.color, display: 'inline-block' }} />
                {cfg.label}
              </span>
            ))}
          </div>

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
                              {a.time} {a.petName || getPetByIdComp(a.petId)?.name || '?'}
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
            {/* Cabeçalho do dia */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {selectedDateLabel}
              </h3>
              {hasPermission('agenda', 'edit') && (
                <button className="btn btn-primary btn-sm btn-icon" onClick={openNew} title="Novo agendamento">
                  <Plus size={15} />
                </button>
              )}
            </div>

            {/* Filtros do painel do dia */}
            <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              {filtroBarra}
            </div>

            {selectedApts.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem', padding: '20px 0' }}>
                {hasActiveFilters ? 'Nenhum resultado com os filtros.' : 'Nenhum agendamento'}
              </p>
            ) : (
              <div className="agenda-day-items" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedApts.map(apt => {
                  const pet = getPetByIdComp(apt.petId)
                  const tutor = apt.tutorId ? getTutorByIdComp(apt.tutorId) : (pet ? getTutorByIdComp(pet.tutorId) : null)
                  const petName = apt.petName || pet?.name || '?'
                  const tutorName = apt.tutorName || tutor?.name || '—'
                  const cfg = TYPE_CONFIG[apt.type] ?? TYPE_CONFIG.outros
                  const stCfg = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.agendado
                  const profName = getProfissionalName(apt)
                  return (
                    <div
                      key={apt.id}
                      style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--surface-2)', borderLeft: `3px solid ${cfg.color}`, cursor: hasPermission('agenda', 'edit') ? 'pointer' : 'default' }}
                      onClick={() => hasPermission('agenda', 'edit') && openEdit(apt)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{apt.time} · {petName}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {apt.tipoAtendimento === 'domiciliar' && (
                            <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: 4, background: '#e6f0ff', color: '#1a5fb4', fontWeight: 600, border: '1px solid #a3c3ef' }}>🏠 Dom.</span>
                          )}
                          <span className={`badge badge-${stCfg.color}`} style={{ fontSize: '0.65rem' }}>{stCfg.label}</span>
                          {hasPermission('agenda', 'delete') && (
                            <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)', padding: 2 }}
                              onClick={e => { e.stopPropagation(); setDeleteTarget(apt) }} title="Excluir">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {cfg.label} · {tutorName}
                        {profName && <span style={{ color: 'var(--text-secondary)' }}> · {profName}</span>}
                      </div>
                      {apt.tipoAtendimento === 'domiciliar' && montarEnderecoMapa(getAptEndereco(apt)) && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--teal)', marginTop: 2, cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={e => { e.stopPropagation(); setMapModalEndereco(getAptEndereco(apt)) }}>
                          📍 {montarEnderecoMapa(getAptEndereco(apt))}
                        </div>
                      )}
                      {apt.status === 'agendado' && hasPermission('agenda', 'edit') && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                          <button className="btn btn-outline btn-sm" style={{ fontSize: '0.7rem', padding: '3px 8px' }} onClick={e => { e.stopPropagation(); updateStatus(apt.id, 'confirmado') }}>Confirmar</button>
                          <button className="btn btn-outline-danger btn-sm" style={{ fontSize: '0.7rem', padding: '3px 8px' }} onClick={e => { e.stopPropagation(); updateStatus(apt.id, 'cancelado') }}>Cancelar</button>
                        </div>
                      )}
                      {apt.status === 'confirmado' && hasPermission('agenda', 'edit') && (
                        <button className="btn btn-primary btn-sm" style={{ fontSize: '0.7rem', padding: '3px 10px', marginTop: 6 }} onClick={e => { e.stopPropagation(); updateStatus(apt.id, 'em-atendimento') }}>
                          Iniciar atendimento
                        </button>
                      )}
                      {apt.status === 'em-atendimento' && hasPermission('agenda', 'edit') && (
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

      {mapModalEndereco && (
        <MapaModal endereco={mapModalEndereco} onClose={() => setMapModalEndereco(null)} />
      )}

      {/* Modal de conflito de horário — z-index 9999, nunca simultâneo com o form */}
      {conflictWarning && (() => {
        const apt = conflictWarning.conflict
        const isBath = BATH_TYPES.includes(conflictWarning.data.type)
        const profId = isBath ? conflictWarning.data.banistaId : conflictWarning.data.vetId
        const profName = isBath
          ? ((funcionarios || []).find(f => f.id === profId)?.nome ?? 'Banhista')
          : (findVetById(profId)?.name ?? 'Veterinário')
        return (
          <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '24px',
          }}>
            <div style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              width: '100%', maxWidth: 440,
              display: 'flex', flexDirection: 'column',
              animation: 'modalIn 150ms ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
                <AlertTriangle size={20} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Playfair Display', serif" }}>
                  Conflito de horário
                </h3>
              </div>
              <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ padding: '12px 14px', background: 'rgba(214,158,46,0.1)', border: '1px solid rgba(214,158,46,0.3)', borderRadius: 8, fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  <strong>{profName}</strong> já tem um agendamento às <strong>{apt.time}</strong> neste dia
                  {apt.type && TYPE_CONFIG[apt.type] ? ` (${TYPE_CONFIG[apt.type].label})` : ''}.
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Escolha outro horário ou profissional, ou cancele para descartar.
                </p>
              </div>
              <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn btn-ghost" onClick={() => setConflictWarning(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleVoltarCorrigir}>Voltar e corrigir</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal de agendamento */}
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
            {(() => {
              const allPetsM = Array.isArray(petsLS) ? petsLS : PETS
              const allTutoresM = Array.isArray(tutoresLS) ? tutoresLS : TUTORES
              const sortedPetsM = [...allPetsM].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR'))
              const filteredPetsM = petSearch.trim()
                ? sortedPetsM.filter(p => {
                    const t = allTutoresM.find(tt => tt.id === p.tutorId)
                    return normIncludes(p.name ?? '', petSearch) || normIncludes(t?.name ?? '', petSearch) || normIncludes(p.breed ?? '', petSearch)
                  })
                : sortedPetsM
              const selPetM = allPetsM.find(p => p.id === form.petId)
              const selTutorM = selPetM ? allTutoresM.find(t => t.id === selPetM.tutorId) : null
              const SPECIES_EMOJI = { 'Cão': '🐶', 'Gato': '🐱', 'Peixe': '🐟', 'Pássaro': '🐦', 'Coelho': '🐰', 'Réptil': '🦎', 'Outro': '🐾' }
              return (
                <>
                  <input className="form-input" placeholder="Digite o nome do pet ou tutor..."
                    value={petSearch} onChange={e => setPetSearch(e.target.value)}
                    style={{ marginBottom: 4 }} />
                  <select className="form-select" value={form.petId}
                    onChange={e => {
                      const pet = sortedPetsM.find(p => p.id === e.target.value)
                      setForm(f => ({ ...f, petId: e.target.value }))
                      if (pet) setPetSearch(pet.name)
                    }}>
                    <option value="">Selecione</option>
                    {filteredPetsM.map(p => {
                      const t = allTutoresM.find(tt => tt.id === p.tutorId)
                      const emoji = SPECIES_EMOJI[p.species] ?? '🐾'
                      return <option key={p.id} value={p.id}>{emoji} {p.name} — {p.breed ?? p.species ?? ''} · Tutor: {t?.name ?? '—'}</option>
                    })}
                  </select>
                  {petSearch.trim() && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{filteredPetsM.length} pet{filteredPetsM.length !== 1 ? 's' : ''} encontrado{filteredPetsM.length !== 1 ? 's' : ''}</span>}
                  {selTutorM && <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Tutor: <strong>{selTutorM.name}</strong>{selTutorM.phone ? ` · ${selTutorM.phone}` : ''}</p>}
                </>
              )
            })()}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Data *</label>
              <input type="date" className="form-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Horário *</label>
              <input ref={timeInputRef} type="time" className="form-input" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={form.type} onChange={e => handleTypeChange(e.target.value)}>
                {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Duração (min)</label>
              <input type="number" className="form-input" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: Number(e.target.value) }))} />
            </div>
          </div>

          {isBathForm ? (
            <div className="form-group">
              <label className="form-label">Banhista / Tosador</label>
              {banhistas.length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 6 }}>
                  Nenhum funcionário marcado como banhista/tosador. Vá em Funcionários e marque a opção "Aparece na agenda".
                </p>
              ) : (
                <select className="form-select" value={form.banistaId} onChange={e => setForm(f => ({ ...f, banistaId: e.target.value }))}>
                  <option value="">Selecione</option>
                  {banhistas.map(b => <option key={b.id} value={b.id}>{b.nome}{b.cargo ? ` — ${b.cargo}` : ''}</option>)}
                </select>
              )}
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Veterinário</label>
              <select className="form-select" value={form.vetId} onChange={e => setForm(f => ({ ...f, vetId: e.target.value }))}>
                <option value="">Selecione</option>
                {vets.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          )}

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

          <div className="form-group">
            <label className="form-label">Tipo de atendimento</label>
            <div style={{ display: 'flex', gap: 20 }}>
              {[{ v: 'presencial', l: '🏥 Presencial' }, { v: 'domiciliar', l: '🏠 Domiciliar' }].map(({ v, l }) => (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  <input type="radio" checked={(form.tipoAtendimento ?? 'presencial') === v}
                    onChange={() => setForm(f => {
                      const allPets = Array.isArray(petsLS) ? petsLS : PETS
                      const allTutores = Array.isArray(tutoresLS) ? tutoresLS : TUTORES
                      const tutor = allTutores.find(t => t.id === allPets.find(p => p.id === f.petId)?.tutorId)
                      return { ...f, tipoAtendimento: v, endereco: v === 'domiciliar' ? getEnderecoObj(tutor?.endereco ?? tutor?.address ?? '') : f.endereco }
                    })} />
                  {l}
                </label>
              ))}
            </div>
          </div>

          {form.tipoAtendimento === 'domiciliar' && (
            <div className="form-group">
              <label className="form-label">Endereço de atendimento</label>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>
                Pré-preenchido com o endereço cadastrado do tutor. Pode ser editado apenas para este agendamento, sem alterar o cadastro.
              </p>
              <EnderecoFields value={form.endereco} onChange={endereco => setForm(f => ({ ...f, endereco }))} />
              <div style={{ marginTop: 8, fontSize: '0.8125rem' }}>
                {enderecoCompleto(form.endereco) ? (
                  <span style={{ color: 'var(--success)' }}>✅ Endereço completo</span>
                ) : (
                  <span style={{ color: 'var(--warning)' }}>⚠️ Endereço incompleto — preencha ao menos rua, número e cidade</span>
                )}
              </div>
              <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 8 }}
                onClick={() => setMapModalEndereco(form.endereco)}>
                📍 Ver no mapa
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
