import { useState } from 'react'
import { Plus, Search, Trash2, Pencil, Paperclip, Download, ExternalLink } from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmModal from '../components/ui/ConfirmModal'
import Tabs from '../components/ui/Tabs'
import { usePersistentState } from '../hooks/usePersistentState'
import { useAuth } from '../context/AuthContext'
import { TUTORES, PRODUTOS } from '../data/mock'
import { normIncludes, norm } from '../utils/normalizeText'
import {
  CATEGORIAS_NF_ENTRADA, FORMAS_PAGAMENTO, CONDICOES_PAGAMENTO, STATUS_NF,
  fmt, todayISO, addDays, maskCNPJ, maskChaveNFe, condicaoParaParcelas,
  gerarParcelasPorDias, lancarFinanceiro, exportCSV, blobToDataUrl,
} from '../utils/contas'

const FISCAL_KEY = 'petvet-config-fiscal'

const CATEGORIA_FINANCEIRO_MAP = {
  'Medicamentos': 'Medicamentos',
  'Produtos pet shop': 'Fornecedores',
  'Equipamentos': 'Manutenção',
  'Material escritório': 'Utilidades',
  'Serviços': 'Fornecedores',
  'Outros': 'Outros',
}

const EMPTY_ENTRADA = {
  numero: '', serie: '', chaveAcesso: '',
  dataEmissao: todayISO(), dataEntrada: todayISO(),
  fornecedor: '', fornecedorCnpj: '',
  valorTotal: '', valorDesconto: '', valorFrete: '', valorImpostos: '',
  categoria: 'Medicamentos', formaPagamento: 'Boleto', condicaoPagamento: '30 dias',
  status: 'Pendente', observacoes: '', anexo: null,
  darEntradaEstoque: false, itensEstoque: [],
}

const EMPTY_ITEM_ESTOQUE = { produto: '', quantidade: '', custoUnitario: '' }

const EMPTY_SAIDA = {
  numero: '', dataEmissao: todayISO(), tomadorId: '', discriminacao: '',
  valorTotal: '', aliquotaIss: 5, status: 'Emitida', link: '', observacoes: '',
}

function calcLiquidoEntrada(f) {
  const total = Number(f.valorTotal) || 0
  const desc = Number(f.valorDesconto) || 0
  const frete = Number(f.valorFrete) || 0
  const imp = Number(f.valorImpostos) || 0
  return Math.max(0, Math.round((total - desc + frete + imp) * 100) / 100)
}

function calcSaida(f) {
  const total = Number(f.valorTotal) || 0
  const aliq = Number(f.aliquotaIss) || 0
  const valorIss = Math.round(total * (aliq / 100) * 100) / 100
  const valorLiquido = Math.round((total - valorIss) * 100) / 100
  return { valorIss, valorLiquido }
}

function statusBadgeClass(status) {
  switch (status) {
    case 'Pago':
    case 'Emitida':
      return 'badge-success'
    case 'Pendente':
      return 'badge-warning'
    case 'Vencido':
      return 'badge-danger'
    case 'Cancelado':
      return 'badge-neutral'
    default:
      return 'badge-neutral'
  }
}

export default function NotasFiscaisPage() {
  const { hasPermission } = useAuth()
  const canEdit = hasPermission('notas-fiscais', 'edit')
  const canDelete = hasPermission('notas-fiscais', 'delete')

  const [activeTab, setActiveTab] = useState('entrada')
  const [notasEntrada, setNotasEntrada] = usePersistentState('petvet-notas-entrada', [])
  const [notasSaida, setNotasSaida] = usePersistentState('petvet-notas-saida', [])
  const [fornecedores, setFornecedores] = usePersistentState('petvet-fornecedores', [])
  const [, setContasPagar] = usePersistentState('petvet-contas-pagar', [])
  const [tutores] = usePersistentState('petvet-tutores', TUTORES)
  const [, setProdutos] = usePersistentState('petvet-produtos', PRODUTOS)
  const [fiscalConfig] = usePersistentState(FISCAL_KEY, { aliquotaISS: 5 })

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_ENTRADA)
  const [formSaida, setFormSaida] = useState({ ...EMPTY_SAIDA, aliquotaIss: fiscalConfig?.aliquotaISS ?? 5 })
  const [deleteTarget, setDeleteTarget] = useState(null)

  const tabs = [
    { id: 'entrada', label: 'Notas de Entrada', count: notasEntrada.length },
    { id: 'saida', label: 'Notas de Saída', count: notasSaida.length },
  ]

  function set(key, value) { setForm(prev => ({ ...prev, [key]: value })) }
  function setS(key, value) { setFormSaida(prev => ({ ...prev, [key]: value })) }

  function closeModal() {
    setShowModal(false)
    setEditingId(null)
    setForm(EMPTY_ENTRADA)
    setFormSaida({ ...EMPTY_SAIDA, aliquotaIss: fiscalConfig?.aliquotaISS ?? 5 })
  }

  function openNew() {
    setEditingId(null)
    setForm(EMPTY_ENTRADA)
    setFormSaida({ ...EMPTY_SAIDA, aliquotaIss: fiscalConfig?.aliquotaISS ?? 5 })
    setShowModal(true)
  }

  function openEdit(nf) {
    setEditingId(nf.id)
    if (activeTab === 'entrada') setForm({ ...EMPTY_ENTRADA, ...nf })
    else setFormSaida({ ...EMPTY_SAIDA, ...nf })
    setShowModal(true)
  }

  // ---- Itens de estoque (entrada) ----
  function addItemEstoque() {
    set('itensEstoque', [...form.itensEstoque, { ...EMPTY_ITEM_ESTOQUE }])
  }
  function updateItemEstoque(idx, key, value) {
    const itens = form.itensEstoque.map((it, i) => i === idx ? { ...it, [key]: value } : it)
    set('itensEstoque', itens)
  }
  function removeItemEstoque(idx) {
    set('itensEstoque', form.itensEstoque.filter((_, i) => i !== idx))
  }

  // ---- Anexo ----
  async function handleAnexo(e, isEntrada) {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await blobToDataUrl(file)
    const anexo = { nome: file.name, tipo: file.type, dataUrl }
    if (isEntrada) set('anexo', anexo)
    else setS('anexo', anexo)
  }

  // ---- Salvar NF de entrada ----
  function salvarEntrada() {
    const valorLiquido = calcLiquidoEntrada(form)
    const dias = condicaoParaParcelas(form.condicaoPagamento)
    const dataVencimento = addDays(form.dataEntrada, dias[0])
    const id = editingId ?? `nfe${Date.now()}`

    const nf = {
      ...form,
      id,
      valorTotal: Number(form.valorTotal) || 0,
      valorDesconto: Number(form.valorDesconto) || 0,
      valorFrete: Number(form.valorFrete) || 0,
      valorImpostos: Number(form.valorImpostos) || 0,
      valorLiquido,
      dataVencimento,
    }

    setNotasEntrada(prev => editingId ? prev.map(n => n.id === editingId ? nf : n) : [...prev, nf])

    // cadastra fornecedor se novo
    if (form.fornecedor && !fornecedores.some(f => norm(f.nome) === norm(form.fornecedor))) {
      setFornecedores(prev => [...prev, { id: `forn${Date.now()}`, nome: form.fornecedor, cnpj: form.fornecedorCnpj }])
    }

    if (!editingId) {
      // lança despesa no Financeiro
      lancarFinanceiro({
        type: 'despesa',
        category: CATEGORIA_FINANCEIRO_MAP[form.categoria] || 'Outros',
        date: form.dataEntrada,
        value: valorLiquido,
        description: `NF ${form.numero} - ${form.fornecedor}`,
        method: form.formaPagamento,
        status: form.status === 'Pago' ? 'pago' : 'pendente',
      })

      // gera conta a pagar com parcelas
      const parcelas = gerarParcelasPorDias({ valorTotal: valorLiquido, dias, dataBase: form.dataEntrada })
      if (form.status === 'Pago') {
        parcelas.forEach(p => { p.status = 'Pago'; p.dataPagamento = form.dataEntrada; p.valorPago = p.valor })
      }
      setContasPagar(prev => [...prev, {
        id: `cp${Date.now()}`,
        descricao: `NF ${form.numero} - ${form.fornecedor}`,
        fornecedor: form.fornecedor,
        categoria: form.categoria,
        valorTotal: valorLiquido,
        formaPagamento: form.formaPagamento,
        parcelas,
        recorrente: false,
        notaFiscalId: id,
        observacoes: form.observacoes,
      }])

      // entrada automática no estoque
      if (form.darEntradaEstoque && form.itensEstoque.length) {
        setProdutos(prev => {
          const next = [...prev]
          form.itensEstoque.forEach(item => {
            if (!item.produto) return
            const qtd = Number(item.quantidade) || 0
            const custo = Number(item.custoUnitario) || 0
            const idx = next.findIndex(p => norm(p.name) === norm(item.produto))
            if (idx >= 0) {
              next[idx] = { ...next[idx], quantity: (Number(next[idx].quantity) || 0) + qtd, costPrice: custo || next[idx].costPrice }
            } else {
              next.push({
                id: `e${Date.now()}${Math.random().toString(36).slice(2, 5)}`,
                name: item.produto, category: form.categoria, quantity: qtd, unit: 'un',
                minStock: 5, expiryDate: '', supplier: form.fornecedor,
                costPrice: custo, salePrice: custo, location: '-',
              })
            }
          })
          return next
        })
      }
    }

    closeModal()
  }

  // ---- Salvar NF de saída ----
  function salvarSaida() {
    const { valorIss, valorLiquido } = calcSaida(formSaida)
    const tomador = tutores.find(t => t.id === formSaida.tomadorId)
    const id = editingId ?? `nfs${Date.now()}`

    const nf = {
      ...formSaida,
      id,
      valorTotal: Number(formSaida.valorTotal) || 0,
      aliquotaIss: Number(formSaida.aliquotaIss) || 0,
      valorIss,
      valorLiquido,
      tomadorNome: tomador?.name || '',
    }

    setNotasSaida(prev => editingId ? prev.map(n => n.id === editingId ? nf : n) : [...prev, nf])

    if (!editingId && formSaida.status === 'Emitida') {
      lancarFinanceiro({
        type: 'receita',
        category: 'Outros',
        date: formSaida.dataEmissao,
        value: valorLiquido,
        description: `NFS-e ${formSaida.numero} - ${tomador?.name || 'Cliente'}`,
        method: 'Boleto',
        status: 'recebido',
      })
    }

    closeModal()
  }

  function confirmDelete() {
    if (!deleteTarget) return
    if (deleteTarget.tipo === 'entrada') setNotasEntrada(prev => prev.filter(n => n.id !== deleteTarget.id))
    else setNotasSaida(prev => prev.filter(n => n.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  // ---- Listas filtradas ----
  const filteredEntrada = notasEntrada.filter(n => {
    const matchSearch = !search || normIncludes(n.numero, search) || normIncludes(n.fornecedor, search)
    const matchStatus = statusFilter === 'todos' || n.status === statusFilter
    return matchSearch && matchStatus
  }).sort((a, b) => (b.dataEntrada || '').localeCompare(a.dataEntrada || ''))

  const filteredSaida = notasSaida.filter(n => {
    const matchSearch = !search || normIncludes(n.numero, search) || normIncludes(n.tomadorNome, search)
    const matchStatus = statusFilter === 'todos' || n.status === statusFilter
    return matchSearch && matchStatus
  }).sort((a, b) => (b.dataEmissao || '').localeCompare(a.dataEmissao || ''))

  const statusOptions = activeTab === 'entrada' ? STATUS_NF : ['Emitida', 'Cancelada']

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Notas Fiscais</h2>
          <p className="page-subtitle">Notas de entrada (compras) e notas de saída (NFS-e)</p>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={openNew}>
              <Plus size={16} /> Nova Nota
            </button>
          </div>
        )}
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={t => { setActiveTab(t); setStatusFilter('todos'); setSearch('') }} />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', margin: '14px 0' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-input" style={{ paddingLeft: 34 }} placeholder={activeTab === 'entrada' ? 'Buscar por número ou fornecedor...' : 'Buscar por número ou tomador...'} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="todos">Todos os status</option>
          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn btn-outline btn-sm" onClick={() => {
          if (activeTab === 'entrada') {
            const headers = ['Número', 'Série', 'Fornecedor', 'Emissão', 'Entrada', 'Vencimento', 'Categoria', 'Valor Total', 'Valor Líquido', 'Status']
            const rows = filteredEntrada.map(n => [n.numero, n.serie, n.fornecedor, n.dataEmissao, n.dataEntrada, n.dataVencimento, n.categoria, n.valorTotal.toFixed(2).replace('.', ','), n.valorLiquido.toFixed(2).replace('.', ','), n.status])
            exportCSV('notas-entrada', headers, rows)
          } else {
            const headers = ['Número', 'Tomador', 'Emissão', 'Valor Total', 'ISS', 'Valor Líquido', 'Status']
            const rows = filteredSaida.map(n => [n.numero, n.tomadorNome, n.dataEmissao, n.valorTotal.toFixed(2).replace('.', ','), n.valorIss.toFixed(2).replace('.', ','), n.valorLiquido.toFixed(2).replace('.', ','), n.status])
            exportCSV('notas-saida', headers, rows)
          }
        }}>
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      {activeTab === 'entrada' && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Número</th><th>Fornecedor</th><th>Emissão</th><th>Vencimento</th>
                <th>Categoria</th><th style={{ textAlign: 'right' }}>Valor Líquido</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filteredEntrada.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Nenhuma nota de entrada cadastrada</td></tr>
              )}
              {filteredEntrada.map(n => (
                <tr key={n.id}>
                  <td>{n.numero}{n.serie ? `/${n.serie}` : ''}</td>
                  <td>{n.fornecedor}</td>
                  <td>{n.dataEmissao ? new Date(n.dataEmissao + 'T00:00').toLocaleDateString('pt-BR') : '-'}</td>
                  <td>{n.dataVencimento ? new Date(n.dataVencimento + 'T00:00').toLocaleDateString('pt-BR') : '-'}</td>
                  <td>{n.categoria}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(n.valorLiquido)}</td>
                  <td><span className={`badge ${statusBadgeClass(n.status)}`}>{n.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      {n.anexo && (
                        <a className="btn btn-ghost btn-sm btn-icon" href={n.anexo.dataUrl} download={n.anexo.nome} title="Baixar anexo" style={{ padding: 4 }}>
                          <Paperclip size={14} />
                        </a>
                      )}
                      {canEdit && (
                        <button className="btn btn-ghost btn-sm btn-icon" style={{ padding: 4 }} onClick={() => openEdit(n)} title="Editar">
                          <Pencil size={14} />
                        </button>
                      )}
                      {canDelete && (
                        <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)', padding: 4 }} onClick={() => setDeleteTarget({ id: n.id, tipo: 'entrada' })} title="Excluir">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'saida' && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Número</th><th>Tomador</th><th>Emissão</th>
                <th style={{ textAlign: 'right' }}>Valor Total</th><th style={{ textAlign: 'right' }}>ISS</th>
                <th style={{ textAlign: 'right' }}>Valor Líquido</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filteredSaida.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Nenhuma nota de saída cadastrada</td></tr>
              )}
              {filteredSaida.map(n => (
                <tr key={n.id}>
                  <td>{n.numero}</td>
                  <td>{n.tomadorNome || '-'}</td>
                  <td>{n.dataEmissao ? new Date(n.dataEmissao + 'T00:00').toLocaleDateString('pt-BR') : '-'}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(n.valorTotal)}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(n.valorIss)}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(n.valorLiquido)}</td>
                  <td><span className={`badge ${statusBadgeClass(n.status)}`}>{n.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      {n.link && (
                        <a className="btn btn-ghost btn-sm btn-icon" href={n.link} target="_blank" rel="noreferrer" title="Ver NFS-e" style={{ padding: 4 }}>
                          <ExternalLink size={14} />
                        </a>
                      )}
                      {canEdit && (
                        <button className="btn btn-ghost btn-sm btn-icon" style={{ padding: 4 }} onClick={() => openEdit(n)} title="Editar">
                          <Pencil size={14} />
                        </button>
                      )}
                      {canDelete && (
                        <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)', padding: 4 }} onClick={() => setDeleteTarget({ id: n.id, tipo: 'saida' })} title="Excluir">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal NF de entrada */}
      {showModal && activeTab === 'entrada' && (
        <Modal isOpen={showModal} onClose={closeModal} title={editingId ? 'Editar Nota de Entrada' : 'Nova Nota de Entrada'} size="lg"
          footer={<>
            <button className="btn btn-outline" onClick={closeModal}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvarEntrada}>Salvar</button>
          </>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Número da NF</label>
                <input className="form-input" value={form.numero} onChange={e => set('numero', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Série</label>
                <input className="form-input" value={form.serie} onChange={e => set('serie', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Chave de acesso (NFe)</label>
                <input className="form-input" value={form.chaveAcesso} onChange={e => set('chaveAcesso', maskChaveNFe(e.target.value))} placeholder="0000 0000 0000 0000 ..." />
              </div>
            </div>

            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Data de emissão</label>
                <input type="date" className="form-input" value={form.dataEmissao} onChange={e => set('dataEmissao', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Data de entrada</label>
                <input type="date" className="form-input" value={form.dataEntrada} onChange={e => set('dataEntrada', e.target.value)} />
              </div>
            </div>

            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Fornecedor</label>
                <input className="form-input" list="fornecedores-list" value={form.fornecedor}
                  onChange={e => set('fornecedor', e.target.value)}
                  onBlur={() => {
                    const match = fornecedores.find(f => norm(f.nome) === norm(form.fornecedor))
                    if (match && !form.fornecedorCnpj) set('fornecedorCnpj', match.cnpj || '')
                  }} />
                <datalist id="fornecedores-list">
                  {fornecedores.map(f => <option key={f.id} value={f.nome} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label className="form-label">CNPJ do fornecedor</label>
                <input className="form-input" value={form.fornecedorCnpj} onChange={e => set('fornecedorCnpj', maskCNPJ(e.target.value))} placeholder="00.000.000/0000-00" />
              </div>
            </div>

            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Valor total</label>
                <input type="number" step="0.01" className="form-input" value={form.valorTotal} onChange={e => set('valorTotal', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Valor desconto</label>
                <input type="number" step="0.01" className="form-input" value={form.valorDesconto} onChange={e => set('valorDesconto', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Valor frete</label>
                <input type="number" step="0.01" className="form-input" value={form.valorFrete} onChange={e => set('valorFrete', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Valor impostos</label>
                <input type="number" step="0.01" className="form-input" value={form.valorImpostos} onChange={e => set('valorImpostos', e.target.value)} />
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Valor líquido</span>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--teal-dark)' }}>{fmt(calcLiquidoEntrada(form))}</span>
            </div>

            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Categoria</label>
                <select className="form-select" value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                  {CATEGORIAS_NF_ENTRADA.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Forma de pagamento</label>
                <select className="form-select" value={form.formaPagamento} onChange={e => set('formaPagamento', e.target.value)}>
                  {FORMAS_PAGAMENTO.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Condição de pagamento</label>
                <select className="form-select" value={form.condicaoPagamento} onChange={e => set('condicaoPagamento', e.target.value)}>
                  {CONDICOES_PAGAMENTO.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Data de vencimento</label>
                <input className="form-input" disabled value={new Date(addDays(form.dataEntrada, condicaoParaParcelas(form.condicaoPagamento)[0]) + 'T00:00').toLocaleDateString('pt-BR')} />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUS_NF.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Observações</label>
              <textarea className="form-textarea" rows={3} value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Anexo da NF (PDF ou imagem)</label>
              <input type="file" className="form-input" accept="application/pdf,image/*" onChange={e => handleAnexo(e, true)} />
              {form.anexo && <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{form.anexo.nome}</span>}
            </div>

            {/* Entrada em estoque */}
            <div className="card" style={{ padding: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                <div onClick={() => set('darEntradaEstoque', !form.darEntradaEstoque)} style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: form.darEntradaEstoque ? 'var(--teal)' : 'var(--border)',
                  position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0,
                }}>
                  <div style={{ position: 'absolute', top: 3, left: form.darEntradaEstoque ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Dar entrada automática no estoque</span>
              </label>

              {form.darEntradaEstoque && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <datalist id="produtos-list">
                    {PRODUTOS.map(p => <option key={p.id} value={p.name} />)}
                  </datalist>
                  {form.itensEstoque.map((item, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                      <input className="form-input" placeholder="Produto" list="produtos-list" value={item.produto} onChange={e => updateItemEstoque(idx, 'produto', e.target.value)} />
                      <input type="number" className="form-input" placeholder="Quantidade" value={item.quantidade} onChange={e => updateItemEstoque(idx, 'quantidade', e.target.value)} />
                      <input type="number" step="0.01" className="form-input" placeholder="Custo unitário" value={item.custoUnitario} onChange={e => updateItemEstoque(idx, 'custoUnitario', e.target.value)} />
                      <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => removeItemEstoque(idx)}><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <button className="btn btn-outline btn-sm" onClick={addItemEstoque} style={{ alignSelf: 'flex-start' }}><Plus size={14} /> Adicionar item</button>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal NF de saída */}
      {showModal && activeTab === 'saida' && (
        <Modal isOpen={showModal} onClose={closeModal} title={editingId ? 'Editar Nota de Saída' : 'Nova Nota de Saída (NFS-e)'} size="lg"
          footer={<>
            <button className="btn btn-outline" onClick={closeModal}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvarSaida}>Salvar</button>
          </>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Número</label>
                <input className="form-input" value={formSaida.numero} onChange={e => setS('numero', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Data de emissão</label>
                <input type="date" className="form-input" value={formSaida.dataEmissao} onChange={e => setS('dataEmissao', e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tomador</label>
              <select className="form-select" value={formSaida.tomadorId} onChange={e => setS('tomadorId', e.target.value)}>
                <option value="">Selecione...</option>
                {tutores.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Discriminação dos serviços</label>
              <textarea className="form-textarea" rows={3} value={formSaida.discriminacao} onChange={e => setS('discriminacao', e.target.value)} />
            </div>

            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Valor total</label>
                <input type="number" step="0.01" className="form-input" value={formSaida.valorTotal} onChange={e => setS('valorTotal', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Alíquota ISS (%)</label>
                <input type="number" step="0.01" className="form-input" value={formSaida.aliquotaIss} onChange={e => setS('aliquotaIss', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Valor ISS</label>
                <input className="form-input" disabled value={fmt(calcSaida(formSaida).valorIss)} />
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Valor líquido</span>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--teal-dark)' }}>{fmt(calcSaida(formSaida).valorLiquido)}</span>
            </div>

            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={formSaida.status} onChange={e => setS('status', e.target.value)}>
                  <option value="Emitida">Emitida</option>
                  <option value="Cancelada">Cancelada</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Link da NFS-e</label>
                <input className="form-input" value={formSaida.link} onChange={e => setS('link', e.target.value)} placeholder="https://..." />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Observações</label>
              <textarea className="form-textarea" rows={3} value={formSaida.observacoes} onChange={e => setS('observacoes', e.target.value)} />
            </div>
          </div>
        </Modal>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        message="Tem certeza que deseja excluir esta nota fiscal?"
      />
    </div>
  )
}
