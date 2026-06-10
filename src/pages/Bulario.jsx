import { useState, useEffect, useMemo, useRef } from 'react'
import { Search, Plus, X, ChevronRight, Trash2, RefreshCw, Database } from 'lucide-react'
import Modal from '../components/ui/Modal'
import CropModal from '../components/ui/CropModal'
import PhotoUploadButtons from '../components/ui/PhotoUploadButtons'
import ConfirmModal from '../components/ui/ConfirmModal'
import ImportadorMapa from '../components/ImportadorMapa'
import { useAuth } from '../context/AuthContext'
import { normIncludes } from '../utils/normalizeText'
import { usePersistentState } from '../hooks/usePersistentState'
import { syncToSupabase } from '../hooks/useSupabaseSync'
import { useBularioSearch, getBularioCount } from '../hooks/useBularioSearch'
import { BULARIO_INICIAL } from '../data/bulario'

const CATEGORIAS = [
  'Antibióticos', 'Analgésicos/Anti-inflamatórios', 'Corticoides', 'Gastroentérologia',
  'Cardiovascular', 'Neurológico', 'Dermatológico', 'Antiparasitários', 'Respiratório',
  'Hormonal/Reprodutivo', 'Oftálmico', 'Otológico', 'Anestésico/Sedativo',
  'Suplemento/Nutricional', 'Cannabis/Fitoterápico', 'Oncológico', 'Outros',
]

const EMPTY_MED = {
  nomeComercial: '', nomeGenerico: '', fabricante: '', apresentacao: '', concentracao: '',
  indicacoes: '', contraindicacoes: '',
  doseCao: '', doseGato: '', doseOutros: '',
  doseCaoCalculo: '', doseGatoCalculo: '',
  via: '', frequencia: '', duracao: '',
  efeitosAdversos: '', interacoes: '', observacoes: '',
  periodoCarencia: '', prescricaoVeterinaria: true, controlado: false,
  categoria: 'Antibióticos', foto: null,
  fonte: 'manual', registroMapa: '',
}

export default function BularioPage() {
  const { hasRole } = useAuth()
  const isAdmin = hasRole('admin')

  const [storedBulario, setStoredBulario] = usePersistentState('petvet-bulario', BULARIO_INICIAL)
  const bulario = useMemo(() => {
    if (!Array.isArray(storedBulario) || storedBulario.length < 397) return BULARIO_INICIAL
    return storedBulario
  }, [storedBulario])

  const [search, setSearch]           = useState('')
  const [catFilter, setCatFilter]     = useState('Todas')
  const [selected, setSelected]       = useState(null)
  const [showForm, setShowForm]       = useState(false)
  const [editing, setEditing]         = useState(null)
  const [form, setForm]               = useState(EMPTY_MED)
  const [cropSrc, setCropSrc]         = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showImport, setShowImport]   = useState(false)
  const [supabaseCount, setSupabaseCount] = useState(null)

  const searchDebounce = useRef(null)
  const { results: supabaseResults, loading: sbLoading, search: sbSearch, source } = useBularioSearch()

  // Seed inicial
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('petvet-bulario') || '[]')
    if (!Array.isArray(stored) || stored.length < 397) {
      localStorage.setItem('petvet-bulario', JSON.stringify(BULARIO_INICIAL))
      setStoredBulario(BULARIO_INICIAL)
      syncToSupabase('petvet-bulario', BULARIO_INICIAL)
    }
  }, []) // eslint-disable-line

  // Busca contagem do Supabase na montagem
  useEffect(() => {
    getBularioCount().then(c => { if (c !== null) setSupabaseCount(c) })
  }, [])

  // Debounce busca Supabase ao digitar
  useEffect(() => {
    clearTimeout(searchDebounce.current)
    if (search.length >= 2) {
      searchDebounce.current = setTimeout(() => sbSearch(search), 350)
    }
    return () => clearTimeout(searchDebounce.current)
  }, [search, sbSearch])

  // Resultados: mescla local + Supabase removendo duplicatas por nome
  const filtered = useMemo(() => {
    if (search.length >= 2 && supabaseResults.length > 0) {
      // Supabase tem resultados → mostra esses
      const sbNames = new Set(supabaseResults.map(m => m.nomeComercial?.toLowerCase()))
      const localExtra = bulario.filter(m => {
        const matchCat = catFilter === 'Todas' || m.categoria === catFilter
        const matchSearch = normIncludes(m.nomeComercial, search) || normIncludes(m.nomeGenerico, search)
        return matchCat && matchSearch && !sbNames.has(m.nomeComercial?.toLowerCase())
      })
      return [...supabaseResults, ...localExtra].slice(0, 40)
    }
    // Busca local (sem Supabase ou busca curta)
    return bulario
      .filter(m => {
        const matchCat    = catFilter === 'Todas' || m.categoria === catFilter
        const matchSearch = !search || normIncludes(m.nomeComercial, search) || normIncludes(m.nomeGenerico, search) || normIncludes(m.indicacoes, search)
        return matchCat && matchSearch
      })
      .sort((a, b) => a.nomeComercial.localeCompare(b.nomeComercial, 'pt-BR'))
  }, [search, supabaseResults, bulario, catFilter])

  function openNew()   { setEditing(null); setForm(EMPTY_MED); setShowForm(true) }
  function openEdit(m) { setEditing(m); setForm({ ...EMPTY_MED, ...m }); setShowForm(true) }
  function handleFotoFile(file) {
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result)
    reader.readAsDataURL(file)
  }

  function save() {
    if (!form.nomeComercial) return
    const sort = arr => [...arr].sort((a, b) => a.nomeComercial.localeCompare(b.nomeComercial, 'pt-BR'))
    if (editing) {
      setStoredBulario(sort(bulario.map(m => m.id === editing.id ? { ...form, id: editing.id } : m)))
    } else {
      setStoredBulario(sort([...bulario, { ...form, id: `b${Date.now()}` }]))
    }
    setShowForm(false)
  }

  const cats = ['Todas', ...CATEGORIAS]
  const countLabel = supabaseCount !== null
    ? `${bulario.length} locais · ${supabaseCount} no banco Supabase`
    : `${bulario.length} medicamentos cadastrados`

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Bulário Veterinário</h2>
          <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {supabaseCount !== null && <Database size={13} style={{ color: 'var(--teal)' }} />}
            {countLabel}
            {source === 'supabase' && search.length >= 2 && (
              <span style={{ fontSize: '0.7rem', background: 'var(--teal-light)', color: 'var(--teal-dark)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                Supabase
              </span>
            )}
            {sbLoading && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>buscando…</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isAdmin && (
            <button className="btn btn-outline btn-sm" onClick={() => setShowImport(true)} title="Importar medicamentos do CSV do MAPA">
              <RefreshCw size={14} /> Importar MAPA
            </button>
          )}
          {hasRole('admin', 'veterinario') && (
            <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Novo Medicamento</button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-input" style={{ paddingLeft: 38 }}
            placeholder="Buscar por nome comercial, genérico ou indicação…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 200 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          {cats.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Ficha completa */}
      {selected && (
        <div className="card" style={{ position: 'relative' }}>
          <button className="btn btn-ghost btn-sm" style={{ position: 'absolute', top: 16, right: 16 }} onClick={() => setSelected(null)}><X size={16} /></button>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {selected.foto && <img src={selected.foto} alt="" style={{ width: 120, height: 120, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>{selected.nomeComercial}</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{selected.nomeGenerico}</span>
                <span className="badge badge-neutral">{selected.categoria}</span>
                {selected.fonte === 'MAPA' && <span className="badge badge-teal" style={{ fontSize: '0.7rem' }}>MAPA</span>}
                {selected.controlado && <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>Controlado</span>}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {selected.fabricante && <span>{selected.fabricante} · </span>}
                {selected.apresentacao && <span>{selected.apresentacao}</span>}
                {selected.concentracao && <span> · {selected.concentracao}</span>}
                {selected.registroMapa && <span> · Reg. MAPA: {selected.registroMapa}</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px 24px', marginTop: 16 }}>
            {[
              ['Indicações',            selected.indicacoes],
              ['Contraindicações',      selected.contraindicacoes],
              ['Dose — Cão',            selected.doseCao || selected.doseCaoCalculo],
              ['Dose — Gato',           selected.doseGato || selected.doseGatoCalculo],
              ['Dose — Outros',         selected.doseOutros],
              ['Via de administração',  selected.via],
              ['Frequência',            selected.frequencia],
              ['Tempo de tratamento',   selected.duracao || selected.tempoPtto],
              ['Período de carência',   selected.periodoCarencia],
              ['Efeitos adversos',      selected.efeitosAdversos],
              ['Interações',            selected.interacoes],
              ['Observações',           selected.observacoes],
            ].filter(([, v]) => v).map(([label, val]) => (
              <div key={label}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 4px' }}>{label}</p>
                <p style={{ fontSize: '0.875rem', margin: 0, lineHeight: 1.6 }}>{val}</p>
              </div>
            ))}
          </div>
          {hasRole('admin', 'veterinario') && !selected.fonte?.includes('MAPA') && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => { setDeleteTarget(selected); setSelected(null) }}><Trash2 size={14} /> Excluir</button>
              <button className="btn btn-outline btn-sm" onClick={() => { openEdit(selected); setSelected(null) }}>Editar</button>
            </div>
          )}
        </div>
      )}

      {/* Lista */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {filtered.map(m => (
          <div key={m.id} className="card" style={{ cursor: 'pointer', padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', transition: 'box-shadow 150ms' }}
            onClick={() => setSelected(m)}>
            {m.foto
              ? <img src={m.foto} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.4rem' }}>💊</div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nomeComercial}</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nomeGenerico}</p>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{m.categoria}</span>
                {m.fonte === 'MAPA' && <span className="badge badge-teal" style={{ fontSize: '0.7rem' }}>MAPA</span>}
                {m.controlado && <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>Controlado</span>}
              </div>
            </div>
            <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 4 }} />
          </div>
        ))}
        {filtered.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', gridColumn: '1/-1', padding: '24px 0', textAlign: 'center' }}>Nenhum medicamento encontrado.</p>
        )}
      </div>

      {/* Modal formulário */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? 'Editar Medicamento' : 'Novo Medicamento'} size="lg"
        footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
          <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={!form.nomeComercial}>Salvar</button>
        </div>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
          <div className="form-group">
            <label className="form-label">Nome comercial *</label>
            <input className="form-input" value={form.nomeComercial} onChange={e => setForm(f => ({ ...f, nomeComercial: e.target.value }))} placeholder="Ex: Apoquel" />
          </div>
          <div className="form-group">
            <label className="form-label">Nome genérico (princípio ativo)</label>
            <input className="form-input" value={form.nomeGenerico} onChange={e => setForm(f => ({ ...f, nomeGenerico: e.target.value }))} placeholder="Ex: Oclacitinibe" />
          </div>
          <div className="form-group">
            <label className="form-label">Fabricante</label>
            <input className="form-input" value={form.fabricante} onChange={e => setForm(f => ({ ...f, fabricante: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Categoria</label>
            <select className="form-select" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Apresentação</label>
            <input className="form-input" value={form.apresentacao} onChange={e => setForm(f => ({ ...f, apresentacao: e.target.value }))} placeholder="Ex: Comprimidos 50mg" />
          </div>
          <div className="form-group">
            <label className="form-label">Concentração</label>
            <input className="form-input" value={form.concentracao} onChange={e => setForm(f => ({ ...f, concentracao: e.target.value }))} placeholder="Ex: 50 mg" />
          </div>
          <div className="form-group">
            <label className="form-label">Registro MAPA</label>
            <input className="form-input" value={form.registroMapa} onChange={e => setForm(f => ({ ...f, registroMapa: e.target.value }))} placeholder="Ex: 04.4.0000000-0" />
          </div>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="form-label">Flags</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.controlado} onChange={e => setForm(f => ({ ...f, controlado: e.target.checked }))} style={{ accentColor: 'var(--teal)' }} />
              Receituário especial (controlado)
            </label>
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Indicações</label>
            <textarea className="form-textarea" value={form.indicacoes} onChange={e => setForm(f => ({ ...f, indicacoes: e.target.value }))} style={{ minHeight: 72 }} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Contraindicações</label>
            <textarea className="form-textarea" value={form.contraindicacoes} onChange={e => setForm(f => ({ ...f, contraindicacoes: e.target.value }))} style={{ minHeight: 60 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Dose — Cão (texto)</label>
            <input className="form-input" value={form.doseCao} onChange={e => setForm(f => ({ ...f, doseCao: e.target.value }))} placeholder="Ex: 5 mg/kg" />
          </div>
          <div className="form-group">
            <label className="form-label">Dose — Cão (fórmula)</label>
            <input className="form-input" value={form.doseCaoCalculo} onChange={e => setForm(f => ({ ...f, doseCaoCalculo: e.target.value }))} placeholder="Ex: 5mg/kg" />
          </div>
          <div className="form-group">
            <label className="form-label">Dose — Gato (texto)</label>
            <input className="form-input" value={form.doseGato} onChange={e => setForm(f => ({ ...f, doseGato: e.target.value }))} placeholder="Ex: 2,5 mg/kg" />
          </div>
          <div className="form-group">
            <label className="form-label">Dose — Gato (fórmula)</label>
            <input className="form-input" value={form.doseGatoCalculo} onChange={e => setForm(f => ({ ...f, doseGatoCalculo: e.target.value }))} placeholder="Ex: 2.5mg/kg" />
          </div>
          <div className="form-group">
            <label className="form-label">Dose — Outros</label>
            <input className="form-input" value={form.doseOutros} onChange={e => setForm(f => ({ ...f, doseOutros: e.target.value }))} placeholder="Ex: Aves: 10 mg/kg" />
          </div>
          <div className="form-group">
            <label className="form-label">Via de administração</label>
            <input className="form-input" value={form.via} onChange={e => setForm(f => ({ ...f, via: e.target.value }))} placeholder="VO, SC, IM, IV..." />
          </div>
          <div className="form-group">
            <label className="form-label">Frequência usual</label>
            <input className="form-input" value={form.frequencia} onChange={e => setForm(f => ({ ...f, frequencia: e.target.value }))} placeholder="Ex: 2x ao dia" />
          </div>
          <div className="form-group">
            <label className="form-label">Tempo de tratamento</label>
            <input className="form-input" value={form.duracao} onChange={e => setForm(f => ({ ...f, duracao: e.target.value }))} placeholder="Ex: 7–14 dias" />
          </div>
          <div className="form-group">
            <label className="form-label">Período de carência</label>
            <input className="form-input" value={form.periodoCarencia} onChange={e => setForm(f => ({ ...f, periodoCarencia: e.target.value }))} placeholder="Ex: 30 dias" />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Efeitos adversos</label>
            <textarea className="form-textarea" value={form.efeitosAdversos} onChange={e => setForm(f => ({ ...f, efeitosAdversos: e.target.value }))} style={{ minHeight: 60 }} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Interações medicamentosas</label>
            <textarea className="form-textarea" value={form.interacoes} onChange={e => setForm(f => ({ ...f, interacoes: e.target.value }))} style={{ minHeight: 60 }} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Observações</label>
            <textarea className="form-textarea" value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} style={{ minHeight: 60 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Foto</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {form.foto && <img src={form.foto} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <PhotoUploadButtons onFile={handleFotoFile} hasPhoto={!!form.foto} label="foto" />
                {form.foto && <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setForm(f => ({ ...f, foto: null }))}>Remover</button>}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {cropSrc && (
        <CropModal src={cropSrc}
          onSave={b64 => { setForm(f => ({ ...f, foto: b64 })); setCropSrc(null) }}
          onClose={() => setCropSrc(null)} />
      )}

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => { setStoredBulario(bulario.filter(m => m.id !== deleteTarget.id)); setDeleteTarget(null) }}
        message={`Excluir "${deleteTarget?.nomeComercial}" do bulário? Esta ação não pode ser desfeita.`} />

      {showImport && <ImportadorMapa onClose={() => { setShowImport(false); getBularioCount().then(c => { if (c !== null) setSupabaseCount(c) }) }} />}
    </div>
  )
}
