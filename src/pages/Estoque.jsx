import { useState } from 'react'
import { Plus, Search, AlertTriangle, X, Package, Trash2 } from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmModal from '../components/ui/ConfirmModal'
import CropModal from '../components/ui/CropModal'
import PhotoUploadButtons from '../components/ui/PhotoUploadButtons'
import { PRODUTOS, getDaysUntilExpiry } from '../data/mock'
import { useAuth } from '../context/AuthContext'
import { normIncludes, norm } from '../utils/normalizeText'
import { usePersistentState } from '../hooks/usePersistentState'

const CATEGORIES = ['Todos', 'Medicamento', 'Vacina', 'Dermatologia', 'Nutrição', 'Anestésico', 'Material']

const EMPTY_PROD = {
  name: '', category: 'Medicamento', quantity: '', unit: 'comp',
  minStock: '', expiryDate: '', supplier: '', costPrice: '', salePrice: '', location: '',
  foto: null,
}

function expiryStatus(dateStr) {
  const days = getDaysUntilExpiry(dateStr)
  if (days < 0) return { label: 'Vencido', color: 'danger', urgent: true }
  if (days <= 15) return { label: `Vence em ${days}d`, color: 'danger', urgent: true }
  if (days <= 30) return { label: `Vence em ${days}d`, color: 'warning', urgent: true }
  if (days <= 60) return { label: `Vence em ${days}d`, color: 'warning', urgent: false }
  return { label: `${days}d`, color: 'neutral', urgent: false }
}

function stockStatus(qty, min) {
  if (qty <= 0) return { label: 'Zerado', color: 'danger' }
  if (qty <= min) return { label: 'Crítico', color: 'danger' }
  if (qty <= min * 1.5) return { label: 'Baixo', color: 'warning' }
  return { label: 'OK', color: 'success' }
}

export default function EstoquePage() {
  const { hasRole } = useAuth()
  const [produtos, setProdutos] = usePersistentState('petvet-produtos', PRODUTOS)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todos')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_PROD)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [dupWarn, setDupWarn] = useState('')
  const [cropSrc, setCropSrc] = useState(null)


  const filtered = produtos
    .filter(p => {
      const matchCat = category === 'Todos' || p.category === category
      const matchSearch = !search || normIncludes(p.name, search) || normIncludes(p.supplier, search) || normIncludes(p.category, search)
      return matchCat && matchSearch
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  const alerts = produtos.filter(p => {
    const days = getDaysUntilExpiry(p.expiryDate)
    return days <= 30 || p.quantity <= p.minStock
  }).sort((a, b) => getDaysUntilExpiry(a.expiryDate) - getDaysUntilExpiry(b.expiryDate))

  function openAdd() {
    setEditing(null); setForm(EMPTY_PROD); setDupWarn(''); setShowModal(true)
  }

  function openEdit(p) {
    setEditing(p); setForm({ ...EMPTY_PROD, ...p }); setDupWarn(''); setShowModal(true)
  }

  function handleFotoFile(file) {
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result)
    reader.readAsDataURL(file)
  }

  function save() {
    if (!form.name) return
    if (!editing) {
      const dup = produtos.find(p => norm(p.name) === norm(form.name))
      if (dup) { setDupWarn(`Produto "${dup.name}" já está cadastrado.`); return }
    }
    doSave()
  }

  function doSave() {
    const sort = arr => [...arr].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    if (editing) {
      setProdutos(prev => sort(prev.map(p => p.id === editing.id ? { ...form, id: editing.id } : p)))
    } else {
      setProdutos(prev => sort([...prev, { ...form, id: `e${Date.now()}` }]))
    }
    setShowModal(false); setDupWarn('')
  }

  function adjustQty(id, delta) {
    setProdutos(prev => prev.map(p => p.id === id ? { ...p, quantity: Math.max(0, p.quantity + delta) } : p))
  }

  const totalItens = produtos.reduce((s, p) => s + p.quantity, 0)
  const expiringSoon = produtos.filter(p => getDaysUntilExpiry(p.expiryDate) <= 30).length
  const belowMin = produtos.filter(p => p.quantity <= p.minStock).length

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Estoque</h2>
          <p className="page-subtitle">{produtos.length} produtos cadastrados</p>
        </div>
        {hasRole('admin', 'atendente') && (
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Novo Produto
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon stat-icon-teal"><Package size={20} /></div>
          <div><div className="stat-value">{totalItens}</div><div className="stat-label">Unidades em estoque</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-warning"><AlertTriangle size={20} /></div>
          <div><div className="stat-value">{expiringSoon}</div><div className="stat-label">Vencendo em 30 dias</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fed7d7', color: '#c53030' }}><AlertTriangle size={20} /></div>
          <div><div className="stat-value">{belowMin}</div><div className="stat-label">Abaixo do mínimo</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-success"><Package size={20} /></div>
          <div><div className="stat-value">{produtos.length - belowMin}</div><div className="stat-label">Produtos OK</div></div>
        </div>
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--danger)', background: 'rgba(229,62,62,0.04)', padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />
            <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '0.875rem' }}>Alertas de Estoque ({alerts.length})</span>
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alerts.map(p => {
              const exp = expiryStatus(p.expiryDate)
              const stk = stockStatus(p.quantity, p.minStock)
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface)', borderRadius: 8, gap: 12 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{p.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>{p.location}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {exp.urgent && <span className={`badge badge-${exp.color}`}>{exp.label}</span>}
                    {p.quantity <= p.minStock && <span className={`badge badge-${stk.color}`}>Estoque: {p.quantity} {p.unit}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: 240 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-input" style={{ paddingLeft: 34 }} placeholder="Buscar produto ou fornecedor" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cat === category ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Produto</th><th>Categoria</th><th>Local</th>
              <th>Qtd</th><th>Mín</th><th>Status</th><th>Validade</th>
              {hasRole('admin', 'atendente') && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const exp = expiryStatus(p.expiryDate)
              const stk = stockStatus(p.quantity, p.minStock)
              return (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {p.foto
                        ? <img src={p.foto} alt={p.name} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: '1px solid var(--border)' }} />
                        : <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Package size={16} style={{ color: 'var(--text-muted)' }} /></div>
                      }
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.supplier}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge badge-neutral">{p.category}</span></td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--teal)' }}>{p.location}</td>
                  <td style={{ fontWeight: 700 }}>{p.quantity} {p.unit}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{p.minStock}</td>
                  <td><span className={`badge badge-${stk.color}`}>{stk.label}</span></td>
                  <td>
                    <span className={`badge badge-${exp.color}`}>{p.expiryDate === '' ? 'N/D' : new Date(p.expiryDate + 'T00:00').toLocaleDateString('pt-BR')}</span>
                  </td>
                  {hasRole('admin', 'atendente') && (
                    <td>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button className="btn btn-ghost btn-sm btn-icon" style={{ padding: '3px 8px', fontSize: '0.85rem', fontWeight: 700 }} onClick={() => adjustQty(p.id, -1)}>−</button>
                        <button className="btn btn-ghost btn-sm btn-icon" style={{ padding: '3px 8px', fontSize: '0.85rem', fontWeight: 700 }} onClick={() => adjustQty(p.id, 1)}>+</button>
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>Editar</button>
                        <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)', padding: '3px 6px' }} onClick={() => setDeleteTarget(p)} title="Excluir">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => setProdutos(prev => prev.filter(p => p.id !== deleteTarget.id))}
        message={`Excluir "${deleteTarget?.name}"? O item será excluído permanentemente. Confirmar?`}
      />

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Editar Produto' : 'Novo Produto'}
        size="lg"
        footer={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            {dupWarn && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(229,62,62,0.07)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--danger)', flex: 1 }}>{dupWarn}</span>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => { setDupWarn(''); doSave() }}>Salvar mesmo assim</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Salvar</button>
            </div>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
          {/* Foto */}
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Foto do produto</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {form.foto
                ? <img src={form.foto} alt="Foto" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '2px solid var(--border)' }} />
                : <div style={{ width: 64, height: 64, borderRadius: 8, background: 'var(--surface-2)', border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={22} style={{ color: 'var(--text-muted)' }} /></div>
              }
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <PhotoUploadButtons onFile={handleFotoFile} hasPhoto={!!form.foto} label="foto" />
                {form.foto && <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setForm(f => ({ ...f, foto: null }))}>Remover</button>}
              </div>
            </div>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Nome do produto *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo do produto" />
          </div>
          <div className="form-group">
            <label className="form-label">Categoria</label>
            <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.filter(c => c !== 'Todos').map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Fornecedor</label>
            <input className="form-input" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Quantidade</label>
            <input type="number" className="form-input" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Unidade</label>
            <select className="form-select" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
              {['comp', 'frasco', 'dose', 'pacote', 'caixa', 'un', 'mL', 'g'].map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Estoque mínimo</label>
            <input type="number" className="form-input" value={form.minStock} onChange={e => setForm(f => ({ ...f, minStock: Number(e.target.value) }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Data de validade</label>
            <input type="date" className="form-input" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Preço de custo (R$)</label>
            <input type="number" step="0.01" className="form-input" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: Number(e.target.value) }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Preço de venda (R$)</label>
            <input type="number" step="0.01" className="form-input" value={form.salePrice} onChange={e => setForm(f => ({ ...f, salePrice: Number(e.target.value) }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Localização</label>
            <input className="form-input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Ex: A1, FRIG, COFRE" />
          </div>
        </div>
      </Modal>

      {cropSrc && (
        <CropModal src={cropSrc}
          onSave={b64 => { setForm(f => ({ ...f, foto: b64 })); setCropSrc(null) }}
          onClose={() => setCropSrc(null)} />
      )}
    </div>
  )
}
