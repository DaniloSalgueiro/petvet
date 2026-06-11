import { useState, useMemo, Fragment } from 'react'
import { Plus, Search, Trash2, Pencil, Check, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Download, AlertTriangle } from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmModal from '../components/ui/ConfirmModal'
import Tabs from '../components/ui/Tabs'
import { usePersistentState } from '../hooks/usePersistentState'
import { useAuth } from '../context/AuthContext'
import { TUTORES } from '../data/mock'
import { normIncludes } from '../utils/normalizeText'
import {
  CATEGORIAS_CONTAS_PAGAR, CATEGORIAS_CONTAS_RECEBER, FORMAS_PAGAMENTO, PERIODICIDADES,
  fmt, todayISO, addDays,
  gerarParcelas, gerarParcelasRecorrentes, recalcStatusParcelas,
  lancarFinanceiro, exportCSV,
} from '../utils/contas'

const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const EMPTY_PAGAR = {
  descricao: '', fornecedor: '', categoria: 'Fornecedores',
  valorTotal: '', numParcelas: 1, formaPagamento: 'Boleto',
  dataPrimeiroVencimento: todayISO(),
  recorrente: false, periodicidade: 'Mensal', dataFim: '',
  notaFiscalId: '', observacoes: '',
}

const EMPTY_RECEBER = {
  descricao: '', clienteId: '', categoria: 'Consultas',
  valorTotal: '', numParcelas: 1, dataPrimeiroVencimento: todayISO(),
  vendaId: '', observacoes: '',
}

function statusBadgeClass(status) {
  switch (status) {
    case 'Pago': return 'badge-success'
    case 'Pendente': return 'badge-warning'
    case 'Vencido': return 'badge-danger'
    case 'Negociado': return 'badge-neutral'
    default: return 'badge-neutral'
  }
}

function statusGeral(parcelas) {
  const ps = recalcStatusParcelas(parcelas)
  if (ps.every(p => p.status === 'Pago')) return 'Pago'
  if (ps.some(p => p.status === 'Vencido')) return 'Vencido'
  return 'Pendente'
}

function fmtData(d) {
  if (!d) return '-'
  return new Date(d + 'T00:00').toLocaleDateString('pt-BR')
}

export default function ContasPagarPage() {
  const { hasPermission } = useAuth()
  const canEdit = hasPermission('contas-pagar', 'edit')
  const canDelete = hasPermission('contas-pagar', 'delete')

  const [activeTab, setActiveTab] = useState('dashboard')
  const [contasPagar, setContasPagar] = usePersistentState('petvet-contas-pagar', [])
  const [contasReceber, setContasReceber] = usePersistentState('petvet-contas-receber', [])
  const [notasEntrada] = usePersistentState('petvet-notas-entrada', [])
  const [vendas] = usePersistentState('petvet-vendas', [])
  const [tutores] = usePersistentState('petvet-tutores', TUTORES)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [expandedId, setExpandedId] = useState(null)

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_PAGAR)
  const [formReceber, setFormReceber] = useState(EMPTY_RECEBER)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [pagamentoTarget, setPagamentoTarget] = useState(null)
  const [pagamentoForm, setPagamentoForm] = useState({ data: todayISO(), valor: 0 })

  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'pagar', label: 'A Pagar', count: contasPagar.length },
    { id: 'receber', label: 'A Receber', count: contasReceber.length },
  ]

  function set(key, value) { setForm(prev => ({ ...prev, [key]: value })) }
  function setR(key, value) { setFormReceber(prev => ({ ...prev, [key]: value })) }

  function closeModal() {
    setShowModal(false)
    setEditingId(null)
    setForm(EMPTY_PAGAR)
    setFormReceber(EMPTY_RECEBER)
  }

  function openNew() {
    setEditingId(null)
    setForm(EMPTY_PAGAR)
    setFormReceber(EMPTY_RECEBER)
    setShowModal(true)
  }

  function openEdit(conta) {
    setEditingId(conta.id)
    if (activeTab === 'pagar') setForm({ ...EMPTY_PAGAR, ...conta })
    else setFormReceber({ ...EMPTY_RECEBER, ...conta })
    setShowModal(true)
  }

  // ---- Salvar conta a pagar ----
  function salvarPagar() {
    const valorTotal = Number(form.valorTotal) || 0
    const id = editingId ?? `cp${Date.now()}`
    let parcelas = form.recorrente
      ? gerarParcelasRecorrentes({ valorTotal, dataInicio: form.dataPrimeiroVencimento, dataFim: form.dataFim || null, periodicidade: form.periodicidade })
      : gerarParcelas({ valorTotal, numParcelas: form.numParcelas, dataPrimeiroVencimento: form.dataPrimeiroVencimento, periodicidade: 'Mensal' })

    if (editingId) {
      const old = contasPagar.find(c => c.id === editingId)
      parcelas = parcelas.map((p, i) => old?.parcelas?.[i]?.status === 'Pago' ? old.parcelas[i] : p)
    }

    const conta = { ...form, id, valorTotal, parcelas }
    setContasPagar(prev => editingId ? prev.map(c => c.id === editingId ? conta : c) : [...prev, conta])
    closeModal()
  }

  // ---- Salvar conta a receber ----
  function salvarReceber() {
    const valorTotal = Number(formReceber.valorTotal) || 0
    const id = editingId ?? `cr${Date.now()}`
    let parcelas = gerarParcelas({ valorTotal, numParcelas: formReceber.numParcelas, dataPrimeiroVencimento: formReceber.dataPrimeiroVencimento, periodicidade: 'Mensal' })

    if (editingId) {
      const old = contasReceber.find(c => c.id === editingId)
      parcelas = parcelas.map((p, i) => old?.parcelas?.[i]?.status === 'Pago' ? old.parcelas[i] : p)
    }

    const cliente = tutores.find(t => t.id === formReceber.clienteId)
    const conta = { ...formReceber, id, valorTotal, parcelas, clienteNome: cliente?.name || '' }
    setContasReceber(prev => editingId ? prev.map(c => c.id === editingId ? conta : c) : [...prev, conta])
    closeModal()
  }

  function confirmDelete() {
    if (!deleteTarget) return
    if (deleteTarget.tipo === 'pagar') setContasPagar(prev => prev.filter(c => c.id !== deleteTarget.id))
    else setContasReceber(prev => prev.filter(c => c.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  // ---- Marcar parcela como paga/recebida ----
  function abrirPagamento(conta, parcela, tipo) {
    setPagamentoTarget({ conta, parcela, tipo })
    setPagamentoForm({ data: todayISO(), valor: parcela.valor })
  }

  function confirmarPagamento() {
    const { conta, parcela, tipo } = pagamentoTarget
    const setFn = tipo === 'pagar' ? setContasPagar : setContasReceber
    setFn(prev => prev.map(c => c.id !== conta.id ? c : {
      ...c,
      parcelas: c.parcelas.map(p => p.numero === parcela.numero ? { ...p, status: 'Pago', dataPagamento: pagamentoForm.data, valorPago: Number(pagamentoForm.valor) } : p),
    }))
    lancarFinanceiro({
      type: tipo === 'pagar' ? 'despesa' : 'receita',
      category: conta.categoria,
      date: pagamentoForm.data,
      value: Number(pagamentoForm.valor),
      description: `${conta.descricao} - parcela ${parcela.numero}/${conta.parcelas.length}`,
      method: conta.formaPagamento || 'PIX',
      status: tipo === 'pagar' ? 'pago' : 'recebido',
    })
    setPagamentoTarget(null)
  }

  // ---- Listas filtradas ----
  const filteredPagar = contasPagar.filter(c => {
    const matchSearch = !search || normIncludes(c.descricao, search) || normIncludes(c.fornecedor, search)
    const matchStatus = statusFilter === 'todos' || statusGeral(c.parcelas) === statusFilter
    return matchSearch && matchStatus
  })

  const filteredReceber = contasReceber.filter(c => {
    const matchSearch = !search || normIncludes(c.descricao, search) || normIncludes(c.clienteNome, search)
    const matchStatus = statusFilter === 'todos' || statusGeral(c.parcelas) === statusFilter
    return matchSearch && matchStatus
  })

  // ---- Dashboard ----
  const hoje = todayISO()
  const em7dias = addDays(hoje, 7)
  const em30dias = addDays(hoje, 30)
  const mesAtual = hoje.slice(0, 7)

  const parcelasPagarFlat = useMemo(() =>
    contasPagar.flatMap(c => recalcStatusParcelas(c.parcelas).map(p => ({ ...p, conta: c }))),
    [contasPagar])

  const parcelasReceberFlat = useMemo(() =>
    contasReceber.flatMap(c => recalcStatusParcelas(c.parcelas).map(p => ({ ...p, conta: c }))),
    [contasReceber])

  const aPagarHoje = parcelasPagarFlat.filter(p => p.status !== 'Pago' && p.vencimento === hoje)
  const aPagarSemana = parcelasPagarFlat.filter(p => p.status !== 'Pago' && p.vencimento >= hoje && p.vencimento <= em7dias)
  const vencidas = parcelasPagarFlat.filter(p => p.status === 'Vencido')
  const aReceberMes = parcelasReceberFlat.filter(p => p.status !== 'Pago' && p.vencimento.slice(0, 7) === mesAtual)
  const recebidasMes = parcelasReceberFlat.filter(p => p.status === 'Pago' && (p.dataPagamento || '').slice(0, 7) === mesAtual)

  const proximos30 = [...parcelasPagarFlat.map(p => ({ ...p, tipo: 'pagar' })), ...parcelasReceberFlat.map(p => ({ ...p, tipo: 'receber' }))]
    .filter(p => p.status !== 'Pago' && p.vencimento >= hoje && p.vencimento <= em30dias)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))

  // ---- Mini calendário ----
  const calYear = calMonth.getFullYear()
  const calMonthIdx = calMonth.getMonth()
  const firstDay = new Date(calYear, calMonthIdx, 1)
  const daysInMonth = new Date(calYear, calMonthIdx + 1, 0).getDate()
  const startWeekday = firstDay.getDay()

  function diaCor(dateStr) {
    const itens = [...parcelasPagarFlat, ...parcelasReceberFlat].filter(p => p.vencimento === dateStr)
    if (!itens.length) return null
    if (itens.some(p => p.status === 'Vencido')) return 'var(--danger)'
    if (itens.some(p => p.status === 'Pendente' && (dateStr === hoje || dateStr === addDays(hoje, 1)))) return '#d69e2e'
    if (itens.some(p => p.status === 'Pendente')) return 'var(--teal)'
    if (itens.every(p => p.status === 'Pago')) return 'var(--success)'
    return null
  }

  const calendarCells = []
  for (let i = 0; i < startWeekday; i++) calendarCells.push(null)
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Contas a Pagar e Receber</h2>
          <p className="page-subtitle">Controle de obrigações financeiras e recebimentos</p>
        </div>
        {canEdit && activeTab !== 'dashboard' && (
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={16} /> Nova Conta
          </button>
        )}
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={t => { setActiveTab(t); setStatusFilter('todos'); setSearch(''); setExpandedId(null) }} />

      {/* DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 14 }}>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#fed7d7', color: '#c53030' }}><AlertTriangle size={20} /></div>
              <div><div className="stat-value" style={{ color: 'var(--danger)' }}>{fmt(aPagarHoje.reduce((s, p) => s + p.valor, 0))}</div><div className="stat-label">A pagar hoje ({aPagarHoje.length})</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-magenta"><AlertTriangle size={20} /></div>
              <div><div className="stat-value">{fmt(aPagarSemana.reduce((s, p) => s + p.valor, 0))}</div><div className="stat-label">A pagar esta semana ({aPagarSemana.length})</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#fed7d7', color: '#9b2c2c' }}><AlertTriangle size={20} /></div>
              <div><div className="stat-value" style={{ color: 'var(--danger)' }}>{fmt(vencidas.reduce((s, p) => s + p.valor, 0))}</div><div className="stat-label">Vencidas ({vencidas.length})</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-teal"><Check size={20} /></div>
              <div><div className="stat-value">{fmt(aReceberMes.reduce((s, p) => s + p.valor, 0))}</div><div className="stat-label">A receber este mês ({aReceberMes.length})</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-success"><Check size={20} /></div>
              <div><div className="stat-value" style={{ color: 'var(--success)' }}>{fmt(recebidasMes.reduce((s, p) => s + (p.valorPago ?? p.valor), 0))}</div><div className="stat-label">Recebidas este mês ({recebidasMes.length})</div></div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 16 }} className="form-grid-2">
            {/* Calendário */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setCalMonth(new Date(calYear, calMonthIdx - 1, 1))}><ChevronLeft size={16} /></button>
                <strong style={{ fontFamily: "'Playfair Display', serif" }}>{MONTHS_PT[calMonthIdx]} {calYear}</strong>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setCalMonth(new Date(calYear, calMonthIdx + 1, 1))}><ChevronRight size={16} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, fontSize: '0.7rem', textAlign: 'center', color: 'var(--text-muted)', marginBottom: 4 }}>
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {calendarCells.map((d, i) => {
                  if (!d) return <div key={i} />
                  const dateStr = `${calYear}-${String(calMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                  const cor = diaCor(dateStr)
                  return (
                    <div key={i} style={{ position: 'relative', textAlign: 'center', fontSize: '0.8125rem', padding: '6px 0', borderRadius: 6, background: dateStr === hoje ? 'var(--surface-2)' : 'transparent', fontWeight: dateStr === hoje ? 700 : 400 }}>
                      {d}
                      {cor && <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 6, height: 6, borderRadius: '50%', background: cor }} />}
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }} /> Vencidas</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d69e2e', display: 'inline-block' }} /> Vence hoje/amanhã</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal)', display: 'inline-block' }} /> A vencer</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} /> Pagas</span>
              </div>
            </div>

            {/* Próximos 30 dias */}
            <div className="card">
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, marginBottom: 12 }}>Próximos 30 dias</h3>
              {proximos30.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nenhum vencimento nos próximos 30 dias</p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th style={{ textAlign: 'right' }}>Valor</th><th>Status</th></tr></thead>
                    <tbody>
                      {proximos30.map((p, i) => (
                        <tr key={i}>
                          <td>{fmtData(p.vencimento)}</td>
                          <td>{p.conta.descricao}</td>
                          <td>{p.tipo === 'pagar' ? 'A Pagar' : 'A Receber'}</td>
                          <td style={{ textAlign: 'right' }}>{fmt(p.valor)}</td>
                          <td><span className={`badge ${statusBadgeClass(p.status)}`}>{p.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* A PAGAR */}
      {activeTab === 'pagar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
          <Filtros search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            onExport={() => {
              const headers = ['Descrição', 'Fornecedor', 'Categoria', 'Valor Total', 'Parcelas', 'Status', 'Próximo Vencimento']
              const rows = filteredPagar.map(c => {
                const ps = recalcStatusParcelas(c.parcelas)
                const proxima = ps.find(p => p.status !== 'Pago')
                return [c.descricao, c.fornecedor, c.categoria, c.valorTotal.toFixed(2).replace('.', ','), `${ps.filter(p => p.status === 'Pago').length}/${ps.length}`, statusGeral(c.parcelas), proxima ? fmtData(proxima.vencimento) : '-']
              })
              exportCSV('contas-a-pagar', headers, rows)
            }} />

          <ContasTable
            contas={filteredPagar}
            tipo="pagar"
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={openEdit}
            onDelete={c => setDeleteTarget({ id: c.id, tipo: 'pagar' })}
            onPagar={(conta, parcela) => abrirPagamento(conta, parcela, 'pagar')}
            colDescricao="Fornecedor/Credor"
            getNome={c => c.fornecedor}
          />
        </div>
      )}

      {/* A RECEBER */}
      {activeTab === 'receber' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
          <Filtros search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            onExport={() => {
              const headers = ['Descrição', 'Cliente', 'Categoria', 'Valor Total', 'Parcelas', 'Status', 'Próximo Vencimento']
              const rows = filteredReceber.map(c => {
                const ps = recalcStatusParcelas(c.parcelas)
                const proxima = ps.find(p => p.status !== 'Pago')
                return [c.descricao, c.clienteNome, c.categoria, c.valorTotal.toFixed(2).replace('.', ','), `${ps.filter(p => p.status === 'Pago').length}/${ps.length}`, statusGeral(c.parcelas), proxima ? fmtData(proxima.vencimento) : '-']
              })
              exportCSV('contas-a-receber', headers, rows)
            }} />

          <ContasTable
            contas={filteredReceber}
            tipo="receber"
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={openEdit}
            onDelete={c => setDeleteTarget({ id: c.id, tipo: 'receber' })}
            onPagar={(conta, parcela) => abrirPagamento(conta, parcela, 'receber')}
            colDescricao="Cliente/Devedor"
            getNome={c => c.clienteNome}
          />
        </div>
      )}

      {/* Modal Conta a Pagar */}
      {showModal && activeTab === 'pagar' && (
        <Modal isOpen={showModal} onClose={closeModal} title={editingId ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'} size="lg"
          footer={<>
            <button className="btn btn-outline" onClick={closeModal}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvarPagar}>Salvar</button>
          </>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Descrição</label>
              <input className="form-input" value={form.descricao} onChange={e => set('descricao', e.target.value)} />
            </div>

            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Fornecedor/Credor</label>
                <input className="form-input" value={form.fornecedor} onChange={e => set('fornecedor', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Categoria</label>
                <select className="form-select" value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                  {CATEGORIAS_CONTAS_PAGAR.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Valor total</label>
                <input type="number" step="0.01" className="form-input" value={form.valorTotal} onChange={e => set('valorTotal', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Número de parcelas</label>
                <input type="number" min={1} max={60} className="form-input" disabled={form.recorrente} value={form.numParcelas} onChange={e => set('numParcelas', Math.min(60, Math.max(1, Number(e.target.value) || 1)))} />
              </div>
              <div className="form-group">
                <label className="form-label">Forma de pagamento</label>
                <select className="form-select" value={form.formaPagamento} onChange={e => set('formaPagamento', e.target.value)}>
                  {FORMAS_PAGAMENTO.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Data do primeiro vencimento</label>
              <input type="date" className="form-input" style={{ maxWidth: 200 }} value={form.dataPrimeiroVencimento} onChange={e => set('dataPrimeiroVencimento', e.target.value)} />
            </div>

            {/* Recorrência */}
            <div className="card" style={{ padding: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                <div onClick={() => set('recorrente', !form.recorrente)} style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: form.recorrente ? 'var(--teal)' : 'var(--border)',
                  position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0,
                }}>
                  <div style={{ position: 'absolute', top: 3, left: form.recorrente ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Conta recorrente</span>
              </label>

              {form.recorrente && (
                <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Periodicidade</label>
                    <select className="form-select" value={form.periodicidade} onChange={e => set('periodicidade', e.target.value)}>
                      {PERIODICIDADES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Data fim (opcional)</label>
                    <input type="date" className="form-input" value={form.dataFim} onChange={e => set('dataFim', e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Vinculada à NF de entrada (opcional)</label>
              <select className="form-select" value={form.notaFiscalId} onChange={e => set('notaFiscalId', e.target.value)}>
                <option value="">Nenhuma</option>
                {notasEntrada.map(n => <option key={n.id} value={n.id}>{n.numero} - {n.fornecedor}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Observações</label>
              <textarea className="form-textarea" rows={3} value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Conta a Receber */}
      {showModal && activeTab === 'receber' && (
        <Modal isOpen={showModal} onClose={closeModal} title={editingId ? 'Editar Conta a Receber' : 'Nova Conta a Receber'} size="lg"
          footer={<>
            <button className="btn btn-outline" onClick={closeModal}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvarReceber}>Salvar</button>
          </>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Descrição</label>
              <input className="form-input" value={formReceber.descricao} onChange={e => setR('descricao', e.target.value)} />
            </div>

            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Cliente/Devedor</label>
                <select className="form-select" value={formReceber.clienteId} onChange={e => setR('clienteId', e.target.value)}>
                  <option value="">Selecione...</option>
                  {tutores.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Categoria</label>
                <select className="form-select" value={formReceber.categoria} onChange={e => setR('categoria', e.target.value)}>
                  {CATEGORIAS_CONTAS_RECEBER.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Valor total</label>
                <input type="number" step="0.01" className="form-input" value={formReceber.valorTotal} onChange={e => setR('valorTotal', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Número de parcelas</label>
                <input type="number" min={1} max={60} className="form-input" value={formReceber.numParcelas} onChange={e => setR('numParcelas', Math.min(60, Math.max(1, Number(e.target.value) || 1)))} />
              </div>
              <div className="form-group">
                <label className="form-label">Data do 1º vencimento</label>
                <input type="date" className="form-input" value={formReceber.dataPrimeiroVencimento} onChange={e => setR('dataPrimeiroVencimento', e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Vinculada a venda PDV (opcional)</label>
              <select className="form-select" value={formReceber.vendaId} onChange={e => setR('vendaId', e.target.value)}>
                <option value="">Nenhuma</option>
                {vendas.map(v => <option key={v.num} value={v.num}>{v.num} - {fmt(v.total)} - {v.tutor}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Observações</label>
              <textarea className="form-textarea" rows={3} value={formReceber.observacoes} onChange={e => setR('observacoes', e.target.value)} />
            </div>
          </div>
        </Modal>
      )}

      {/* Modal pagamento/recebimento */}
      <Modal isOpen={!!pagamentoTarget} onClose={() => setPagamentoTarget(null)} title={pagamentoTarget?.tipo === 'pagar' ? 'Confirmar pagamento' : 'Confirmar recebimento'} size="sm"
        footer={<>
          <button className="btn btn-outline" onClick={() => setPagamentoTarget(null)}>Cancelar</button>
          <button className="btn btn-primary" onClick={confirmarPagamento}>Confirmar</button>
        </>}>
        {pagamentoTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {pagamentoTarget.conta.descricao} — parcela {pagamentoTarget.parcela.numero}/{pagamentoTarget.conta.parcelas.length}
            </p>
            <div className="form-group">
              <label className="form-label">Data {pagamentoTarget.tipo === 'pagar' ? 'do pagamento' : 'do recebimento'}</label>
              <input type="date" className="form-input" value={pagamentoForm.data} onChange={e => setPagamentoForm(prev => ({ ...prev, data: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Valor {pagamentoTarget.tipo === 'pagar' ? 'pago' : 'recebido'}</label>
              <input type="number" step="0.01" className="form-input" value={pagamentoForm.valor} onChange={e => setPagamentoForm(prev => ({ ...prev, valor: e.target.value }))} />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        message="Tem certeza que deseja excluir esta conta?"
      />
    </div>
  )
}

function Filtros({ search, setSearch, statusFilter, setStatusFilter, onExport }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input className="form-input" style={{ paddingLeft: 34 }} placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <select className="form-select" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
        <option value="todos">Todos os status</option>
        <option value="Pendente">Pendente</option>
        <option value="Pago">Pago</option>
        <option value="Vencido">Vencido</option>
      </select>
      <button className="btn btn-outline btn-sm" onClick={onExport}>
        <Download size={14} /> Exportar CSV
      </button>
    </div>
  )
}

function ContasTable({ contas, tipo, expandedId, setExpandedId, canEdit, canDelete, onEdit, onDelete, onPagar, colDescricao, getNome }) {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th></th><th>Descrição</th><th>{colDescricao}</th><th>Categoria</th>
            <th style={{ textAlign: 'right' }}>Valor Total</th><th>Parcelas</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {contas.length === 0 && (
            <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Nenhuma conta cadastrada</td></tr>
          )}
          {contas.map(c => {
            const ps = recalcStatusParcelas(c.parcelas)
            const pagas = ps.filter(p => p.status === 'Pago').length
            const expanded = expandedId === c.id
            return (
              <Fragment key={c.id}>
                <tr>
                  <td>
                    <button className="btn btn-ghost btn-sm btn-icon" style={{ padding: 2 }} onClick={() => setExpandedId(expanded ? null : c.id)}>
                      {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </td>
                  <td>{c.descricao}</td>
                  <td>{getNome(c)}</td>
                  <td>{c.categoria}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(c.valorTotal)}</td>
                  <td>{pagas}/{ps.length}</td>
                  <td><span className={`badge ${statusBadgeClass(statusGeral(c.parcelas))}`}>{statusGeral(c.parcelas)}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      {canEdit && (
                        <button className="btn btn-ghost btn-sm btn-icon" style={{ padding: 4 }} onClick={() => onEdit(c)} title="Editar">
                          <Pencil size={14} />
                        </button>
                      )}
                      {canDelete && (
                        <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)', padding: 4 }} onClick={() => onDelete(c)} title="Excluir">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={8} style={{ background: 'var(--surface-2)', padding: '10px 16px' }}>
                      <table style={{ width: '100%' }}>
                        <thead>
                          <tr style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <th style={{ textAlign: 'left' }}>Parcela</th><th style={{ textAlign: 'left' }}>Vencimento</th>
                            <th style={{ textAlign: 'right' }}>Valor</th><th>Status</th><th>Pagamento</th><th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {ps.map(p => (
                            <tr key={p.numero}>
                              <td>{p.numero}/{ps.length}</td>
                              <td>{fmtData(p.vencimento)}</td>
                              <td style={{ textAlign: 'right' }}>{fmt(p.valor)}</td>
                              <td><span className={`badge ${statusBadgeClass(p.status)}`}>{p.status}</span></td>
                              <td>{p.dataPagamento ? `${fmtData(p.dataPagamento)} — ${fmt(p.valorPago)}` : '-'}</td>
                              <td>
                                {p.status !== 'Pago' && canEdit && (
                                  <button className="btn btn-outline btn-sm" onClick={() => onPagar(c, p)}>
                                    <Check size={13} /> {tipo === 'pagar' ? 'Marcar como pago' : 'Marcar como recebido'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
