import { useState, useMemo, useRef } from 'react'
import { Search, Plus, ChevronRight, X, Edit2, AlertCircle, Loader2, Sparkles, Trash2, Download } from 'lucide-react'
import Modal from '../components/ui/Modal'
import AccessDenied from '../components/ui/AccessDenied'
import { PETS, TUTORES, AGENDAMENTOS, PRONTUARIOS, getTutorById } from '../data/mock'
import { findVetById } from '../utils/getVeterinarios'
import { calcularIdade } from '../utils/calcularIdade'
import { useAuth } from '../context/AuthContext'
import { normIncludes, norm } from '../utils/normalizeText'
import { useAISearch } from '../hooks/useAISearch'
import { usePersistentState } from '../hooks/usePersistentState'
import { maskCPF, maskRG, maskPhone } from '../utils/masks'
import ConfirmModal from '../components/ui/ConfirmModal'
import CropModal from '../components/ui/CropModal'
import PhotoUploadButtons from '../components/ui/PhotoUploadButtons'
import EnderecoFields from '../components/ui/EnderecoFields'
import { RACAS_INICIAIS } from '../data/racas'
import { EMPTY_ENDERECO, getEnderecoObj, getEnderecoString, enderecoFoiMigrado } from '../utils/endereco'

const SPECIES_ICON = { 'Cão': '🐕', 'Gato': '🐈', 'Peixe': '🐠', 'Pássaro': '🦜', 'Coelho': '🐇' }

function exportCSV(filename, headers, rows) {
  const bom = '﻿'
  const lines = [headers.join(';'), ...rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))]
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename + '.csv'; a.click()
  URL.revokeObjectURL(url)
}
const SEX_LABEL = { M: 'Macho', F: 'Fêmea' }
const VAC_COLOR = { 'Em dia': 'success', 'Atrasada': 'danger', 'N/A': 'neutral' }


function localSearch(query, pets, tutores) {
  const q = norm(query)
  if (!q) return { results: pets, label: null }
  let filtered = pets
  let label = null
  if (/\bcao\b|\bcaes\b|\bcanino/.test(q)) { filtered = filtered.filter(p => p.species === 'Cão'); label = 'Cães' }
  else if (/\bgato\b|\bgatos\b|\bfelino/.test(q)) { filtered = filtered.filter(p => p.species === 'Gato'); label = 'Gatos' }
  if (/\bmacho\b|\bmachos\b/.test(q)) { filtered = filtered.filter(p => p.sex === 'M'); label = (label ? label + ' machos' : 'Machos') }
  else if (/\bfemea\b|\bfemeas\b/.test(q)) { filtered = filtered.filter(p => p.sex === 'F'); label = (label ? label + ' fêmeas' : 'Fêmeas') }
  if (/\bvacinacao\s*atrasada\b|\bvacina\s*atrasada\b/.test(q)) { filtered = filtered.filter(p => p.vacinacao === 'Atrasada'); label = 'Vacinação atrasada' }
  if (/\bfilhote\b|\bfilhotes\b/.test(q)) { filtered = filtered.filter(p => (new Date('2026-05-14') - new Date(p.birthDate)) / 31557600000 < 1); label = 'Filhotes' }
  if (/\bidoso\b|\bidosa\b/.test(q)) { filtered = filtered.filter(p => (new Date('2026-05-14') - new Date(p.birthDate)) / 31557600000 >= 7); label = 'Pacientes idosos' }
  if (!label) {
    filtered = filtered.filter(p => {
      const tutor = tutores.find(t => t.id === p.tutorId)
      return normIncludes(p.name, query) || normIncludes(p.breed, query) || normIncludes(p.species, query) || normIncludes(tutor?.name, query)
    })
  }
  return { results: filtered, label }
}

const EMPTY_PET = {
  name: '', species: 'Cão', breed: '', birthDate: '', weight: '', sex: 'M',
  color: '', microchip: '', tutorId: '', observations: '', vacinacao: 'Em dia',
  vermifugacao: 'Em dia', castrado: 'Não', planoSaude: 'Não', planoNome: '',
  planoCarteirinha: '', foto: null,
}
const EMPTY_TUTOR = { name: '', cpf: '', rg: '', phone: '', email: '', endereco: { ...EMPTY_ENDERECO } }

export default function PetsPage({ navigateTo, navParams }) {
  const { hasRole, hasPermission } = useAuth()
  const [pets, setPets] = usePersistentState('petvet-pets', PETS)
  const [tutores, setTutores] = usePersistentState('petvet-tutores', TUTORES)
  const [view, setView] = useState('list')
  const [selectedPet, setSelectedPet] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [aiQuery, setAiQuery] = useState('')
  const [showPetModal, setShowPetModal] = useState(false)
  const [showTutorModal, setShowTutorModal] = useState(false)
  const [editingPet, setEditingPet] = useState(null)
  const [editingTutor, setEditingTutor] = useState(null)
  const [petForm, setPetForm] = useState(EMPTY_PET)
  const [tutorForm, setTutorForm] = useState(EMPTY_TUTOR)
  const [newTutorForPet, setNewTutorForPet] = useState(null)
  const [showAddPetPrompt, setShowAddPetPrompt] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteTutorTarget, setDeleteTutorTarget] = useState(null)
  const [dupWarn, setDupWarn] = useState('')
  const [tutorDupWarn, setTutorDupWarn] = useState('')
  const [addressMigrated, setAddressMigrated] = useState(false)
  const [pageTab, setPageTab] = useState('pets')
  const [tutorSearch, setTutorSearch] = useState('')
  const [storedRacas] = usePersistentState('petvet-racas', RACAS_INICIAIS)
  const racas = useMemo(() => {
    const raw = Array.isArray(storedRacas) && storedRacas.length >= 150 ? storedRacas : RACAS_INICIAIS
    return raw.map(r => r.species === 'Outros' ? { ...r, species: 'Outro' } : r)
  }, [storedRacas])

  const dataForPrompt = useMemo(() => JSON.stringify(
    pets.map(p => ({ id: p.id, name: p.name, species: p.species, breed: p.breed, sex: p.sex, vacinacao: p.vacinacao, birthDate: p.birthDate, tutor: tutores.find(t => t.id === p.tutorId)?.name }))
  ), [pets, tutores])

  const { aiLoading, aiLabel, aiIds, aiError, search: runAISearch, reset: resetAI } = useAISearch({ entityType: 'pets', dataForPrompt })
  const { results: localResults, label: localLabel } = localSearch(searchQuery, pets, tutores)
  const tutoresFiltrados = useMemo(() => {
    const result = !tutorSearch.trim() ? tutores : tutores.filter(t => normIncludes(t.name, tutorSearch) || normIncludes(t.cpf, tutorSearch) || normIncludes(t.email, tutorSearch))
    return [...result].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [tutores, tutorSearch])
  const filteredPets = aiIds !== null ? pets.filter(p => aiIds.includes(p.id)) : localResults
  const activeLabel = aiIds !== null ? aiLabel : localLabel

  function handleSearchChange(v) { setSearchQuery(v); if (!v) resetAI() }
  function clearAll() { setSearchQuery(''); setAiQuery(''); resetAI() }
  function openPetDetail(pet) { setSelectedPet(pet); setView('detail') }
  function openAddPet() { setEditingPet(null); setPetForm(EMPTY_PET); setDupWarn(''); setShowPetModal(true) }
  function openEditPet(pet) { setEditingPet(pet); setPetForm({ ...EMPTY_PET, ...pet }); setDupWarn(''); setShowPetModal(true) }

  function openEditTutor(t) {
    setEditingTutor(t)
    setTutorForm({ ...EMPTY_TUTOR, ...t, endereco: getEnderecoObj(t.endereco ?? t.address) })
    setAddressMigrated(enderecoFoiMigrado(t))
    setTutorDupWarn('')
    setShowTutorModal(true)
  }
  function openNewTutor() {
    setEditingTutor(null)
    setTutorForm(EMPTY_TUTOR)
    setAddressMigrated(false)
    setTutorDupWarn('')
    setShowTutorModal(true)
  }

  function savePet() {
    if (!petForm.name || !petForm.tutorId) return
    if (!editingPet) {
      const dup = pets.find(p => norm(p.name) === norm(petForm.name) && p.tutorId === petForm.tutorId)
      if (dup) { setDupWarn(`Pet "${dup.name}" já está cadastrado para este tutor. Deseja continuar mesmo assim?`); return }
    }
    doSavePet()
  }

  function doSavePet() {
    const sort = arr => [...arr].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    if (editingPet) {
      setPets(prev => sort(prev.map(p => p.id === editingPet.id ? { ...petForm, id: editingPet.id } : p)))
      if (selectedPet?.id === editingPet.id) setSelectedPet({ ...petForm, id: editingPet.id })
    } else {
      setPets(prev => sort([...prev, { ...petForm, id: `p${Date.now()}` }]))
    }
    setShowPetModal(false); setDupWarn('')
  }

  function saveTutor() {
    if (!tutorForm.name) return
    const otherId = editingTutor?.id
    const dupCpf   = tutorForm.cpf   && tutores.find(t => t.id !== otherId && t.cpf === tutorForm.cpf)
    const dupEmail = tutorForm.email && tutores.find(t => t.id !== otherId && t.email?.toLowerCase() === tutorForm.email.toLowerCase())
    const dupNome  = tutores.find(t => t.id !== otherId && norm(t.name) === norm(tutorForm.name))
    if (dupCpf)   { setTutorDupWarn(`Já existe tutor com CPF ${tutorForm.cpf}.`); return }
    if (dupEmail) { setTutorDupWarn(`Já existe tutor com e-mail ${tutorForm.email}.`); return }
    if (dupNome)  { setTutorDupWarn(`Já existe tutor com nome similar: "${dupNome.name}". Deseja continuar mesmo assim?`); return }
    doSaveTutor()
  }

  function doSaveTutor() {
    const sort = arr => [...arr].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    if (editingTutor) {
      setTutores(prev => sort(prev.map(t => t.id === editingTutor.id ? { ...tutorForm, id: editingTutor.id } : t)))
      setShowTutorModal(false); setTutorDupWarn('')
    } else {
      const newTutor = { ...tutorForm, id: `t${Date.now()}` }
      setTutores(prev => sort([...prev, newTutor]))
      setPetForm(f => ({ ...f, tutorId: newTutor.id }))
      setNewTutorForPet(newTutor)
      setShowTutorModal(false); setTutorDupWarn('')
      setShowAddPetPrompt(true)
    }
  }

  if (!hasPermission('pets', 'view')) {
    return <AccessDenied title="Pets & Tutores" />
  }

  return (
    <>
      {view === 'detail' && selectedPet ? (
        <PetDetail pet={selectedPet} tutores={tutores} onBack={() => setView('list')} onEdit={() => openEditPet(selectedPet)} hasRole={hasRole} hasPermission={hasPermission} navigateTo={navigateTo} onDeleteTutor={setDeleteTutorTarget} onDeletePet={setDeleteTarget}
          onEditTutor={openEditTutor} />
      ) : (
      <div className="page">
        <div className="page-header">
          <div>
            <h2 className="page-title">Pets & Tutores</h2>
            <p className="page-subtitle">{pageTab === 'pets' ? `${pets.length} animais cadastrados` : `${tutores.length} tutores cadastrados`}</p>
          </div>
          {hasPermission('pets', 'edit') && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-outline btn-sm" onClick={openNewTutor}>
                <Plus size={15} /> Novo Tutor
              </button>
              {pageTab === 'pets' && (
                <button className="btn btn-primary" onClick={openAddPet}>
                  <Plus size={16} /> Novo Pet
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', padding: 4, borderRadius: 8, width: 'fit-content' }}>
          <button className={`btn btn-sm ${pageTab === 'pets' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPageTab('pets')}>
            Pets ({pets.length})
          </button>
          <button className={`btn btn-sm ${pageTab === 'tutores' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPageTab('tutores')}>
            Tutores ({tutores.length})
          </button>
        </div>

        {pageTab === 'tutores' && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="form-input" style={{ paddingLeft: 38 }} placeholder="Buscar por nome, CPF ou e-mail..."
                  value={tutorSearch} onChange={e => setTutorSearch(e.target.value)} />
              </div>
              <button className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
                onClick={() => {
                  const headers = ['Nome', 'CPF', 'RG', 'Telefone', 'E-mail', 'Endereço', 'Pets']
                  const rows = tutoresFiltrados.map(t => [t.name, t.cpf ?? '', t.rg ?? '', t.phone ?? '', t.email ?? '', getEnderecoString(t), pets.filter(p => p.tutorId === t.id).map(p => p.name).join(', ')])
                  exportCSV('tutores', headers, rows)
                }}>
                <Download size={14} /> Exportar CSV
              </button>
            </div>
            {tutoresFiltrados.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                <p style={{ fontWeight: 600 }}>Nenhum tutor encontrado</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Nome</th><th>RG</th><th>CPF</th><th>Telefone</th><th>E-mail</th><th>Pets</th><th></th></tr></thead>
                  <tbody>
                    {tutoresFiltrados.map(t => {
                      const petCount = pets.filter(p => p.tutorId === t.id).length
                      return (
                        <tr key={t.id}>
                          <td style={{ fontWeight: 600 }}>{t.name}</td>
                          <td>{t.rg || '—'}</td>
                          <td>{t.cpf || '—'}</td>
                          <td>{t.phone || '—'}</td>
                          <td>{t.email || '—'}</td>
                          <td><span className="badge badge-teal">{petCount} pet{petCount !== 1 ? 's' : ''}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {hasPermission('pets', 'edit') && (
                                <button className="btn btn-outline btn-sm" onClick={() => openEditTutor(t)}>
                                  <Edit2 size={13} /> Editar
                                </button>
                              )}
                              {hasPermission('pets', 'delete') && (
                                <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setDeleteTutorTarget(t)} title="Excluir tutor">
                                  <X size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {pageTab === 'pets' && (<>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 600 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="form-input" style={{ paddingLeft: 38 }} placeholder='Nome, raça, espécie, tutor...' value={searchQuery} onChange={e => handleSearchChange(e.target.value)} />
            {(searchQuery || aiIds) && (
              <button style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={clearAll}><X size={14} /></button>
            )}
          </div>
          <button className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
            onClick={() => {
              const fmtD = d => { try { return d ? new Date(d + 'T12:00').toLocaleDateString('pt-BR') : '—' } catch { return d ?? '—' } }
              const headers = ['Nome', 'Espécie', 'Raça', 'Sexo', 'Tutor', 'Nascimento', 'Vacinação', 'Vermifugação', 'Castrado']
              const rows = filteredPets.map(p => {
                const t = tutores.find(tt => tt.id === p.tutorId)
                return [p.name, p.species, p.breed ?? '', p.sex === 'M' ? 'Macho' : 'Fêmea', t?.name ?? '—', fmtD(p.birthDate), p.vacinacao ?? '', p.vermifugacao ?? '', p.castrado ?? '']
              })
              exportCSV('pets', headers, rows)
            }}>
            <Download size={14} /> Exportar CSV
          </button>
        </div>

        {activeLabel && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge badge-magenta">{activeLabel}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{filteredPets.length} resultado{filteredPets.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        {filteredPets.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '2rem' }}>🐾</p>
            <p style={{ fontWeight: 600, marginTop: 8 }}>Nenhum pet encontrado</p>
            <p style={{ fontSize: '0.875rem' }}>Tente ajustar a busca ou cadastre um novo pet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {[...filteredPets].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(pet => {
              const tutor = tutores.find(t => t.id === pet.tutorId)
              return (
                <div key={pet.id} className="card" style={{ cursor: 'pointer', transition: 'box-shadow 150ms ease', padding: '16px' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
                  onClick={() => openPetDetail(pet)}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg, var(--teal-light), var(--magenta-light))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {pet.foto
                        ? <img src={pet.foto} alt={pet.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '1.6rem' }}>{SPECIES_ICON[pet.species] ?? '🐾'}</span>
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{pet.name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>• {calcularIdade(pet.birthDate)}</span>
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 1 }}>{pet.breed} · {SEX_LABEL[pet.sex]}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Tutor: {tutor?.name ?? '—'}</div>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 4 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className={`badge badge-${VAC_COLOR[pet.vacinacao]}`}>Vacina: {pet.vacinacao}</span>
                    {pet.castrado === 'Sim' && <span className="badge badge-teal">Castrado</span>}
                    {pet.weight && <span className="badge badge-neutral">{pet.weight} kg</span>}
                    {hasPermission('pets', 'delete') && (
                      <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', color: 'var(--danger)', padding: '2px 6px' }}
                        onClick={e => { e.stopPropagation(); setDeleteTarget(pet) }} title="Excluir pet">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        </>)}
      </div>
      )}

      {/* Datalists para raças (dinâmico via petvet-racas) */}
      {['Cão', 'Gato', 'Outro'].map(sp => (
        <datalist key={sp} id={`breeds-${sp}`}>
          {racas.filter(r => r.species === sp).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(r => <option key={r.id} value={r.name} />)}
        </datalist>
      ))}
      {/* Alias para espécies mapeadas no formulário */}
      <datalist id="breeds-Peixe"><option value="Peixe" /></datalist>
      <datalist id="breeds-Pássaro">
        {racas.filter(r => r.species === 'Outro' && ['Calopsita','Periquito','Papagaio','Arara','Canário'].includes(r.name)).map(r => <option key={r.id} value={r.name} />)}
      </datalist>
      <datalist id="breeds-Coelho"><option value="Coelho" /></datalist>
      <datalist id="breeds-Réptil">
        {racas.filter(r => r.species === 'Outro' && ['Iguana','Jabuti','Cobra','Lagarto','Tartaruga'].includes(r.name)).map(r => <option key={r.id} value={r.name} />)}
      </datalist>

      {/* Modal Pet */}
      <Modal isOpen={showPetModal} onClose={() => setShowPetModal(false)} title={editingPet ? 'Editar Pet' : 'Novo Pet'} size="lg"
        footer={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            {dupWarn && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(229,62,62,0.07)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px' }}>
                <AlertCircle size={15} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.8125rem', color: 'var(--danger)', flex: 1 }}>{dupWarn}</span>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => { setDupWarn(''); doSavePet() }}>Salvar mesmo assim</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowPetModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={savePet}>Salvar</button>
            </div>
          </div>
        }>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
          {/* Foto */}
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Foto do pet</label>
            <PhotoUpload value={petForm.foto} onChange={v => setPetForm(f => ({ ...f, foto: v }))} />
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Nome do pet *</label>
            <input className="form-input" value={petForm.name} onChange={e => setPetForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do animal" />
          </div>
          <div className="form-group">
            <label className="form-label">Espécie</label>
            <select className="form-select" value={petForm.species} onChange={e => setPetForm(f => ({ ...f, species: e.target.value, breed: '' }))}>
              {['Cão', 'Gato', 'Peixe', 'Pássaro', 'Coelho', 'Réptil', 'Outro'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Raça</label>
            <input
              list={`breeds-${petForm.species}`}
              className="form-input"
              value={petForm.breed}
              onChange={e => setPetForm(f => ({ ...f, breed: e.target.value }))}
              placeholder="Digite ou selecione..."
            />
          </div>
          <div className="form-group">
            <label className="form-label">Data de nascimento</label>
            <input type="date" className="form-input" value={petForm.birthDate} onChange={e => setPetForm(f => ({ ...f, birthDate: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Peso (kg)</label>
            <input type="number" step="0.1" className="form-input" value={petForm.weight} onChange={e => setPetForm(f => ({ ...f, weight: e.target.value }))} placeholder="0.0" />
          </div>
          <div className="form-group">
            <label className="form-label">Sexo</label>
            <select className="form-select" value={petForm.sex} onChange={e => setPetForm(f => ({ ...f, sex: e.target.value }))}>
              <option value="M">Macho</option><option value="F">Fêmea</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Castrado</label>
            <select className="form-select" value={petForm.castrado ?? 'Não'} onChange={e => setPetForm(f => ({ ...f, castrado: e.target.value }))}>
              <option>Não</option><option>Sim</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Pelagem / Cor</label>
            <input className="form-input" value={petForm.color} onChange={e => setPetForm(f => ({ ...f, color: e.target.value }))} placeholder="Ex: Caramelo" />
          </div>
          <div className="form-group">
            <label className="form-label">Microchip</label>
            <input className="form-input" value={petForm.microchip} onChange={e => setPetForm(f => ({ ...f, microchip: e.target.value }))} placeholder="Número do chip" />
          </div>
          {/* Plano de saúde */}
          <div className="form-group">
            <label className="form-label">Plano de saúde</label>
            <select className="form-select" value={petForm.planoSaude ?? 'Não'} onChange={e => setPetForm(f => ({ ...f, planoSaude: e.target.value }))}>
              <option>Não</option><option>Sim</option>
            </select>
          </div>
          {petForm.planoSaude === 'Sim' && (
            <>
              <div className="form-group">
                <label className="form-label">Nome do plano</label>
                <input className="form-input" value={petForm.planoNome ?? ''} onChange={e => setPetForm(f => ({ ...f, planoNome: e.target.value }))} placeholder="Ex: PetPlan" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Número da carteirinha</label>
                <input className="form-input" value={petForm.planoCarteirinha ?? ''} onChange={e => setPetForm(f => ({ ...f, planoCarteirinha: e.target.value }))} placeholder="Número ou código do beneficiário" />
              </div>
            </>
          )}

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Tutor *</label>
            <TutorSearchField tutores={tutores} value={petForm.tutorId} onChange={id => setPetForm(f => ({ ...f, tutorId: id }))} onAddNew={openNewTutor} />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Observações</label>
            <textarea className="form-textarea" value={petForm.observations} onChange={e => setPetForm(f => ({ ...f, observations: e.target.value }))} placeholder="Alergias, comportamento, medicações contínuas..." style={{ minHeight: 72, resize: 'none', overflowY: 'auto', maxHeight: 140 }} />
          </div>
        </div>
      </Modal>

      {/* Modal Tutor */}
      <Modal isOpen={showTutorModal} onClose={() => setShowTutorModal(false)} title={editingTutor ? 'Editar Tutor' : 'Novo Tutor'} size="md"
        footer={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            {tutorDupWarn && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(229,62,62,0.07)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px' }}>
                <AlertCircle size={15} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.8125rem', color: 'var(--danger)', flex: 1 }}>{tutorDupWarn}</span>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => { setTutorDupWarn(''); doSaveTutor() }}>Salvar mesmo assim</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowTutorModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveTutor}>Salvar Tutor</button>
            </div>
          </div>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Nome completo *</label>
            <input className="form-input" value={tutorForm.name} onChange={e => setTutorForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do responsável" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">CPF</label>
              <input className="form-input" value={tutorForm.cpf} onChange={e => setTutorForm(f => ({ ...f, cpf: maskCPF(e.target.value) }))} placeholder="000.000.000-00" />
            </div>
            <div className="form-group">
              <label className="form-label">RG</label>
              <input className="form-input" value={tutorForm.rg ?? ''} onChange={e => setTutorForm(f => ({ ...f, rg: maskRG(e.target.value) }))} placeholder="00.000.000-0" />
            </div>
            <div className="form-group">
              <label className="form-label">Telefone</label>
              <input className="form-input" value={tutorForm.phone} onChange={e => setTutorForm(f => ({ ...f, phone: maskPhone(e.target.value) }))} placeholder="(11) 99999-9999" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input type="email" className="form-input" value={tutorForm.email} onChange={e => setTutorForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
          </div>
          {addressMigrated && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(214,158,46,0.1)', border: '1px solid var(--warning)', borderRadius: 8, padding: '10px 14px' }}>
              <AlertCircle size={15} style={{ color: 'var(--warning)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>Endereço importado do formato antigo. Revise os campos abaixo.</span>
            </div>
          )}
          <EnderecoFields value={tutorForm.endereco} onChange={endereco => setTutorForm(f => ({ ...f, endereco }))} />
        </div>
      </Modal>

      <Modal isOpen={showAddPetPrompt} onClose={() => setShowAddPetPrompt(false)} title="Tutor cadastrado!" size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowAddPetPrompt(false)}>Fazer isso depois</button>
            <button className="btn btn-primary" onClick={() => {
              setShowAddPetPrompt(false)
              setPetForm({ ...EMPTY_PET, tutorId: newTutorForPet?.id ?? '' })
              setEditingPet(null); setDupWarn('')
              setShowPetModal(true)
            }}><Plus size={15} /> Adicionar pet agora</button>
          </>
        }>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Tutor <strong>{newTutorForPet?.name}</strong> cadastrado. Deseja cadastrar um pet agora?
        </p>
      </Modal>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => { setPets(prev => prev.filter(p => p.id !== deleteTarget.id)); if (selectedPet?.id === deleteTarget.id) setView('list'); setDeleteTarget(null) }}
        message={`Excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`} />

      <ConfirmModal isOpen={!!deleteTutorTarget} onClose={() => setDeleteTutorTarget(null)}
        onConfirm={() => { setTutores(prev => prev.filter(t => t.id !== deleteTutorTarget.id)); setDeleteTutorTarget(null); setView('list') }}
        message={`Excluir tutor "${deleteTutorTarget?.name}"? Os pets vinculados ficarão sem tutor. Confirmar?`} />
    </>
  )
}

// ---- PET DETAIL ----
function PetDetail({ pet, tutores, onBack, onEdit, hasRole, hasPermission, navigateTo, onDeleteTutor, onDeletePet, onEditTutor }) {
  const tutor = tutores.find(t => t.id === pet.tutorId)
  const consultas = AGENDAMENTOS.filter(a => a.petId === pet.id).sort((a, b) => b.date.localeCompare(a.date))
  const pronts = PRONTUARIOS.filter(p => p.petId === pet.id)
  return (
    <div className="page">
      <div className="page-header no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>← Voltar</button>
          <div>
            <h2 className="page-title">{SPECIES_ICON[pet.species] ?? '🐾'} {pet.name}</h2>
            <p className="page-subtitle">{pet.breed} · {pet.species} · {calcularIdade(pet.birthDate)}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {navigateTo && (
            <>
              <button className="btn btn-outline btn-sm" onClick={() => navigateTo('prontuario', { petId: pet.id })}>Ver prontuário</button>
              <button className="btn btn-outline btn-sm" onClick={() => navigateTo('agenda', { petId: pet.id, openNew: true, type: 'consulta' })}>Agendar consulta</button>
              <button className="btn btn-outline btn-sm" onClick={() => navigateTo('agenda', { petId: pet.id, openNew: true, type: 'banho' })}>Agendar serviço</button>
            </>
          )}
          {hasPermission('pets', 'edit') && (
            <button className="btn btn-outline btn-sm" onClick={onEdit}><Edit2 size={14} /> Editar</button>
          )}
          {hasPermission('pets', 'delete') && onDeletePet && (
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => onDeletePet(pet)}><Trash2 size={14} /></button>
          )}
        </div>
      </div>

      <div className="pet-detail-grid">
        <div className="card">
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
            {pet.foto && (
              <img src={pet.foto} alt={pet.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, flexShrink: 0, border: '2px solid var(--border)' }} />
            )}
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>Informações do Pet</h3>
          </div>
          <InfoRow label="Espécie" value={pet.species} />
          <InfoRow label="Raça" value={pet.breed || '—'} />
          <InfoRow label="Idade" value={calcularIdade(pet.birthDate)} />
          <InfoRow label="Sexo" value={SEX_LABEL[pet.sex]} />
          <InfoRow label="Castrado" value={pet.castrado ?? 'Não informado'} />
          <InfoRow label="Peso" value={`${pet.weight} kg`} />
          <InfoRow label="Cor / Pelagem" value={pet.color} />
          <InfoRow label="Microchip" value={pet.microchip || 'Não cadastrado'} />
          <InfoRow label="Vacinação" value={<span className={`badge badge-${VAC_COLOR[pet.vacinacao]}`}>{pet.vacinacao}</span>} />
          <InfoRow label="Vermifugação" value={<span className={`badge badge-${VAC_COLOR[pet.vermifugacao]}`}>{pet.vermifugacao}</span>} />
          {pet.planoSaude === 'Sim' && (
            <>
              <InfoRow label="Plano de saúde" value={<span className="badge badge-teal">Sim</span>} />
              {pet.planoNome && <InfoRow label="Plano" value={pet.planoNome} />}
              {pet.planoCarteirinha && <InfoRow label="Carteirinha" value={pet.planoCarteirinha} />}
            </>
          )}
          {pet.observations && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 8, borderLeft: '3px solid var(--teal)' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
                <AlertCircle size={13} style={{ display: 'inline', marginRight: 5 }} />{pet.observations}
              </p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="pet-tutor-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>Responsável (Tutor)</h3>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {tutor && hasPermission('pets', 'edit') && onEditTutor && (
                <button className="btn btn-outline btn-sm" onClick={() => onEditTutor(tutor)}>✏️ Editar tutor</button>
              )}
              {tutor && hasPermission('pets', 'delete') && (
                <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => onDeleteTutor(tutor)}><X size={14} /></button>
              )}
            </div>
          </div>
          {tutor ? (
            <>
              <InfoRow label="Nome" value={tutor.name} />
              <InfoRow label="CPF" value={tutor.cpf} />
              {tutor.rg && <InfoRow label="RG" value={tutor.rg} />}
              <InfoRow label="Telefone" value={tutor.phone} />
              <InfoRow label="E-mail" value={tutor.email} />
              <InfoRow label="Endereço" value={getEnderecoString(tutor) || '—'} />
            </>
          ) : <p style={{ color: 'var(--text-muted)' }}>Tutor não encontrado</p>}
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.9375rem', fontWeight: 700, marginBottom: 14, color: 'var(--text-primary)' }}>
          Histórico de Atendimentos ({consultas.length})
        </h3>
        {consultas.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nenhum atendimento registrado.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Data</th><th>Tipo</th><th>Veterinário</th><th>Status</th></tr></thead>
              <tbody>
                {consultas.map(a => (
                  <tr key={a.id}>
                    <td>{new Date(a.date + 'T00:00').toLocaleDateString('pt-BR')}</td>
                    <td style={{ textTransform: 'capitalize' }}>{a.type}</td>
                    <td>{findVetById(a.vetId)?.name ?? '—'}</td>
                    <td><span className={`badge badge-${STATUS_COLOR[a.status]}`}>{STATUS_LABEL[a.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.9375rem', fontWeight: 700, marginBottom: 14, color: 'var(--text-primary)' }}>
          Prontuários ({pronts.length})
        </h3>
        {pronts.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nenhum prontuário registrado.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pronts.map(pr => (
              <div key={pr.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, cursor: navigateTo ? 'pointer' : 'default' }}
                onClick={() => navigateTo && navigateTo('prontuario', { prontuarioId: pr.id })}
                onMouseEnter={e => navigateTo && (e.currentTarget.style.background = 'var(--border)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-2)')}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{new Date(pr.date + 'T00:00').toLocaleDateString('pt-BR')}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 10 }}>{pr.diagnostico.definitivo || pr.diagnostico.presuntivo}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge badge-teal">{findVetById(pr.vetId)?.name ?? '—'}</span>
                  {navigateTo && <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', textAlign: 'right', maxWidth: '60%' }}>{value ?? '—'}</span>
    </div>
  )
}

function TutorSearchField({ tutores, value, onChange, onAddNew }) {
  const [query, setQuery] = useState('')
  const filtered = query.trim()
    ? tutores.filter(t => normIncludes(t.name, query) || normIncludes(t.cpf, query) || normIncludes(t.email, query))
    : tutores
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input className="form-input" placeholder="Filtrar por nome, CPF ou e-mail..." value={query} onChange={e => setQuery(e.target.value)} />
      <div style={{ display: 'flex', gap: 8 }}>
        <select className="form-select" value={value} onChange={e => { onChange(e.target.value); setQuery('') }}>
          <option value="">Selecione o tutor</option>
          {filtered.map(t => <option key={t.id} value={t.id}>{t.name}{t.cpf ? ` — ${t.cpf}` : ''}</option>)}
        </select>
        <button type="button" className="btn btn-outline btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={onAddNew}>
          <Plus size={14} /> Novo
        </button>
      </div>
    </div>
  )
}

function PhotoUpload({ value, onChange }) {
  const [cropSrc, setCropSrc] = useState(null)

  function handleFile(file) {
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result)
    reader.readAsDataURL(file)
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {value
          ? <img src={value} alt="Foto" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, border: '2px solid var(--border)', flexShrink: 0 }} />
          : <div style={{ width: 72, height: 72, borderRadius: 10, background: 'var(--surface-2)', border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', flexShrink: 0 }}>🐾</div>
        }
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <PhotoUploadButtons onFile={handleFile} hasPhoto={!!value} label="foto" />
          {value && <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => onChange(null)}>Remover</button>}
        </div>
      </div>
      {cropSrc && (
        <CropModal src={cropSrc}
          onSave={b64 => { onChange(b64); setCropSrc(null) }}
          onClose={() => setCropSrc(null)} />
      )}
    </>
  )
}


const STATUS_LABEL = { agendado: 'Agendado', confirmado: 'Confirmado', 'em-atendimento': 'Em atendimento', concluido: 'Concluído', cancelado: 'Cancelado' }
const STATUS_COLOR = { agendado: 'neutral', confirmado: 'teal', 'em-atendimento': 'warning', concluido: 'success', cancelado: 'danger' }
