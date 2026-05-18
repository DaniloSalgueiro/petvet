import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, AlertCircle } from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmModal from '../components/ui/ConfirmModal'
import { usePersistentState } from '../hooks/usePersistentState'
import { useAuth } from '../context/AuthContext'
import { norm } from '../utils/normalizeText'
import { RACAS_INICIAIS } from '../data/racas'

export { RACAS_INICIAIS }

const SPECIES_TABS = ['Cão', 'Gato', 'Outro']
const EMPTY_RACA = { name: '', species: 'Cão' }

export default function RacasPage() {
  const { hasRole } = useAuth()
  const [racas, setRacas] = usePersistentState('petvet-racas', RACAS_INICIAIS)
  const [activeSpecies, setActiveSpecies] = useState('Cão')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_RACA)
  const [dupWarn, setDupWarn] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  // Migrate: force full list if stored data is incomplete (< 150) or has old 'Outros' species
  useEffect(() => {
    if (racas.length < 150) {
      setRacas(RACAS_INICIAIS)
    } else if (racas.some(r => r.species === 'Outros')) {
      setRacas(prev => prev.map(r => r.species === 'Outros' ? { ...r, species: 'Outro' } : r))
    }
  }, [])

  const filtered = racas
    .filter(r => r.species === activeSpecies)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY_RACA, species: activeSpecies })
    setDupWarn('')
    setShowModal(true)
  }

  function openEdit(r) {
    setEditing(r)
    setForm({ name: r.name, species: r.species })
    setDupWarn('')
    setShowModal(true)
  }

  function save() {
    if (!form.name.trim()) return
    const dup = racas.find(r =>
      r.id !== editing?.id &&
      norm(r.name) === norm(form.name) &&
      r.species === form.species
    )
    if (dup) { setDupWarn(`"${dup.name}" já está cadastrado para ${form.species}.`); return }
    if (editing) {
      setRacas(prev => prev.map(r => r.id === editing.id ? { ...r, name: form.name.trim(), species: form.species } : r))
    } else {
      setRacas(prev => [...prev, { ...form, name: form.name.trim(), id: `r${Date.now()}` }])
    }
    setShowModal(false)
    setDupWarn('')
    setActiveSpecies(form.species)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Raças</h2>
          <p className="page-subtitle">{racas.length} raças cadastradas</p>
        </div>
        {hasRole('admin') && (
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Nova Raça
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', padding: 4, borderRadius: 8, width: 'fit-content' }}>
        {SPECIES_TABS.map(sp => (
          <button key={sp} className={`btn btn-sm ${activeSpecies === sp ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveSpecies(sp)}>
            {sp} ({racas.filter(r => r.species === sp).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
          <p>Nenhuma raça cadastrada para <strong>{activeSpecies}</strong>.</p>
          {hasRole('admin') && (
            <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={openAdd}>
              <Plus size={14} /> Adicionar primeira raça
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {filtered.map(r => (
            <div key={r.id} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{r.name}</span>
              {hasRole('admin') && (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(r)} title="Editar">
                    <Edit2 size={13} />
                  </button>
                  <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setDeleteTarget(r)} title="Excluir">
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editing ? 'Editar Raça' : 'Nova Raça'} size="sm"
        footer={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            {dupWarn && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(229,62,62,0.07)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px' }}>
                <AlertCircle size={15} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.8125rem', color: 'var(--danger)' }}>{dupWarn}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Salvar</button>
            </div>
          </div>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Nome da raça *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Labrador Retriever" onKeyDown={e => e.key === 'Enter' && save()} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Espécie</label>
            <select className="form-select" value={form.species} onChange={e => setForm(f => ({ ...f, species: e.target.value }))}>
              {SPECIES_TABS.map(sp => <option key={sp}>{sp}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => { setRacas(prev => prev.filter(r => r.id !== deleteTarget.id)); setDeleteTarget(null) }}
        message={`Excluir a raça "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`} />
    </div>
  )
}
