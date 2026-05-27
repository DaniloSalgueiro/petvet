import { useState } from 'react'
import { Plus, TrendingUp, TrendingDown, DollarSign, Search, Settings, Trash2, Download } from 'lucide-react'
import Tabs from '../components/ui/Tabs'
import Modal from '../components/ui/Modal'
import ConfirmModal from '../components/ui/ConfirmModal'
import { LANCAMENTOS } from '../data/mock'
import { useAuth } from '../context/AuthContext'
import { normIncludes } from '../utils/normalizeText'
import { usePersistentState } from '../hooks/usePersistentState'

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const CATS_RECEITA = ['Consultas', 'Cirurgia', 'Vacinas', 'Banho & Tosa', 'Exames', 'Produtos', 'Hospedagem', 'Outros']
const CATS_DESPESA = ['Pessoal', 'Medicamentos', 'Aluguel', 'Fornecedores', 'Utilidades', 'Marketing', 'Manutenção', 'Outros']
const METHODS = ['PIX', 'Cartão', 'Dinheiro', 'Boleto', 'TED', 'Débito']

// rates é um objeto { categoria: percentual } para cada categoria de receita
const COMISSOES_CONFIG = [
  { id: 'c1', name: 'Dra. Tatiana Borges', type: 'veterinario', rates: { Consultas: 30, Cirurgia: 30, Vacinas: 20, 'Banho & Tosa': 0, Exames: 25, Produtos: 0, Hospedagem: 0, Outros: 0 } },
  { id: 'c2', name: 'Dr. Carlos Menezes',  type: 'veterinario', rates: { Consultas: 30, Cirurgia: 35, Vacinas: 20, 'Banho & Tosa': 0, Exames: 25, Produtos: 0, Hospedagem: 0, Outros: 0 } },
  { id: 'c3', name: 'Emporium Vazpet',     type: 'socio',       rates: { Consultas: 10, Cirurgia: 10, Vacinas: 10, 'Banho & Tosa': 10, Exames: 10, Produtos: 10, Hospedagem: 10, Outros: 10 } },
  { id: 'c4', name: 'Tatá Bichos',         type: 'socio',       rates: { Consultas: 0,  Cirurgia: 0,  Vacinas: 0,  'Banho & Tosa': 60, Exames: 0,  Produtos: 20, Hospedagem: 40, Outros: 0  } },
]

const EMPTY_RATES = Object.fromEntries(CATS_RECEITA.map(c => [c, 0]))

const EMPTY_LAN = { type: 'receita', category: 'Consultas', date: '2026-05-14', value: '', description: '', method: 'PIX', status: 'recebido' }

const DEFAULT_PAYMENT_RATES = { pix: 0, debito: 0, credito: 2.5, parcelado: 1.99, dinheiro: 0 }
const PAYMENT_LABELS = { pix: 'PIX', debito: 'Cartão de Débito', credito: 'Cartão de Crédito', parcelado: 'Parcelado', dinheiro: 'Dinheiro' }

function fmt(v) { return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` }

function exportCSV(filename, headers, rows) {
  const bom = '﻿'
  const lines = [headers.join(';'), ...rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))]
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename + '.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function FinanceiroPage() {
  const { hasRole, hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState('dre')
  const [lancamentos, setLancamentos] = usePersistentState('petvet-lancamentos', LANCAMENTOS)
  const [comissoesConfig, setComissoesConfig] = usePersistentState('petvet-comissoes', COMISSOES_CONFIG)
  const [paymentRates, setPaymentRates] = usePersistentState('petvet-payment-rates', DEFAULT_PAYMENT_RATES)
  const [selectedYear, setSelectedYear] = useState(2026)
  const [selectedMonth, setSelectedMonth] = useState(4) // 0-indexed = maio
  const [typeFilter, setTypeFilter] = useState('todos')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_LAN)
  const [comissaoPaga, setComissaoPaga] = useState({})
  const [showComissaoModal, setShowComissaoModal] = useState(false)
  const [editingComissao, setEditingComissao] = useState(null)
  const [comissaoForm, setComissaoForm] = useState({ name: '', type: 'veterinario', rates: { ...EMPTY_RATES } })
  const [showPaymentSettingsModal, setShowPaymentSettingsModal] = useState(false)
  const [paymentRatesForm, setPaymentRatesForm] = useState({ ...DEFAULT_PAYMENT_RATES })
  const [deleteTarget, setDeleteTarget] = useState(null)

  const currentMonthLans = lancamentos.filter(l => {
    const d = new Date(l.date + 'T00:00')
    return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth
  })

  function sumByCategory(type) {
    const cats = type === 'receita' ? CATS_RECEITA : CATS_DESPESA
    return cats.map(cat => {
      const total = currentMonthLans.filter(l => l.type === type && l.category === cat && l.status !== 'cancelado').reduce((s, l) => s + Number(l.value), 0)
      return { cat, total }
    }).filter(r => r.total > 0)
  }

  const receitaRows = sumByCategory('receita')
  const despesaRows = sumByCategory('despesa')
  const totalReceitas = receitaRows.reduce((s, r) => s + r.total, 0)
  const totalDespesas = despesaRows.reduce((s, r) => s + r.total, 0)
  const resultado = totalReceitas - totalDespesas
  const margem = totalReceitas > 0 ? (resultado / totalReceitas * 100).toFixed(1) : 0

  const filteredLans = lancamentos.filter(l => {
    const matchType = typeFilter === 'todos' || l.type === typeFilter
    const matchSearch = !search || normIncludes(l.description, search) || normIncludes(l.category, search) || normIncludes(l.method, search)
    return matchType && matchSearch
  }).sort((a, b) => b.date.localeCompare(a.date))

  function saveLan() {
    setLancamentos(prev => [...prev, { ...form, id: `f${Date.now()}`, value: Number(form.value) }])
    setShowModal(false)
    setForm(EMPTY_LAN)
  }

  function comissaoKey(id) { return `${id}-${selectedYear}-${selectedMonth}` }
  function togglePago(id) {
    const key = comissaoKey(id)
    setComissaoPaga(prev => ({ ...prev, [key]: !prev[key] }))
  }
  function calcComissao(cfg) {
    return CATS_RECEITA.reduce((total, cat) => {
      const rate = cfg.rates?.[cat] ?? 0
      if (!rate) return total
      const base = currentMonthLans
        .filter(l => l.type === 'receita' && l.category === cat && l.status === 'recebido')
        .reduce((s, l) => s + Number(l.value), 0)
      return total + base * (rate / 100)
    }, 0)
  }

  function calcComissaoByCategory(cfg) {
    return CATS_RECEITA.map(cat => {
      const rate = cfg.rates?.[cat] ?? 0
      const base = currentMonthLans
        .filter(l => l.type === 'receita' && l.category === cat && l.status === 'recebido')
        .reduce((s, l) => s + Number(l.value), 0)
      return { cat, base, rate, valor: base * (rate / 100) }
    }).filter(r => r.rate > 0 || r.base > 0)
  }

  const tabs = [
    { id: 'dre',        label: 'DRE' },
    { id: 'lancamentos',label: 'Lançamentos', count: lancamentos.length },
    { id: 'comissoes',  label: 'Comissões' },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Financeiro</h2>
          <p className="page-subtitle">Demonstrativo e controle de lançamentos</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hasPermission('financeiro', 'edit') && (
            <button className="btn btn-outline btn-sm" onClick={() => { setPaymentRatesForm({ ...paymentRates }); setShowPaymentSettingsModal(true) }}>
              <Settings size={15} /> Configurações
            </button>
          )}
          {activeTab === 'lancamentos' && hasPermission('financeiro', 'edit') && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Novo Lançamento</button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon stat-icon-success"><TrendingUp size={20} /></div>
          <div><div className="stat-value" style={{ color: 'var(--success)' }}>{fmt(totalReceitas)}</div><div className="stat-label">Receitas no mês</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fed7d7', color: '#c53030' }}><TrendingDown size={20} /></div>
          <div><div className="stat-value" style={{ color: 'var(--danger)' }}>{fmt(totalDespesas)}</div><div className="stat-label">Despesas no mês</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-teal"><DollarSign size={20} /></div>
          <div>
            <div className="stat-value" style={{ color: resultado >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(resultado)}</div>
            <div className="stat-label">Resultado líquido</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-magenta"><TrendingUp size={20} /></div>
          <div><div className="stat-value">{margem}%</div><div className="stat-label">Margem de lucro</div></div>
        </div>
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* DRE */}
      {activeTab === 'dre' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Month selector */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="form-select" style={{ width: 160 }} value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
              {MONTHS_PT.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select className="form-select" style={{ width: 100 }} value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
              {[2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Receitas */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <TrendingUp size={18} style={{ color: 'var(--success)' }} />
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, color: 'var(--text-primary)' }}>Receitas</h3>
              </div>
              {receitaRows.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Sem receitas neste período</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {receitaRows.map(r => (
                    <DRERow key={r.cat} label={r.cat} value={r.total} total={totalReceitas} color="var(--success)" />
                  ))}
                  <div style={{ borderTop: '2px solid var(--border)', paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                    <span style={{ color: 'var(--text-primary)' }}>TOTAL RECEITAS</span>
                    <span style={{ color: 'var(--success)' }}>{fmt(totalReceitas)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Despesas */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <TrendingDown size={18} style={{ color: 'var(--danger)' }} />
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, color: 'var(--text-primary)' }}>Despesas</h3>
              </div>
              {despesaRows.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Sem despesas neste período</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {despesaRows.map(r => (
                    <DRERow key={r.cat} label={r.cat} value={r.total} total={totalDespesas} color="var(--danger)" />
                  ))}
                  <div style={{ borderTop: '2px solid var(--border)', paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                    <span style={{ color: 'var(--text-primary)' }}>TOTAL DESPESAS</span>
                    <span style={{ color: 'var(--danger)' }}>{fmt(totalDespesas)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Resultado */}
          <div className="card" style={{ borderLeft: `4px solid ${resultado >= 0 ? 'var(--success)' : 'var(--danger)'}`, padding: '18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                  Resultado — {MONTHS_PT[selectedMonth]} {selectedYear}
                </p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Margem de lucro: <strong>{margem}%</strong>
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '1.75rem', fontWeight: 800, color: resultado >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {resultado >= 0 ? '+' : ''}{fmt(resultado)}
                </p>
              </div>
            </div>
            {/* Progress bar */}
            {totalReceitas > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (totalDespesas / totalReceitas) * 100)}%`, background: resultado >= 0 ? 'var(--success)' : 'var(--danger)', borderRadius: 99, transition: 'width 500ms ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>Despesas: {totalReceitas > 0 ? (totalDespesas / totalReceitas * 100).toFixed(0) : 0}% das receitas</span>
                  <span>Lucro: {margem}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LANÇAMENTOS */}
      {activeTab === 'lancamentos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" style={{ paddingLeft: 34 }} placeholder="Buscar lançamento..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {['todos', 'receita', 'despesa'].map(t => (
              <button key={t} className={t === typeFilter ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'} onClick={() => setTypeFilter(t)}>
                {t === 'todos' ? 'Todos' : t === 'receita' ? 'Receitas' : 'Despesas'}
              </button>
            ))}
            <button className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}
              onClick={() => {
                const headers = ['Data', 'Tipo', 'Categoria', 'Descrição', 'Método', 'Status', 'Valor']
                const rows = filteredLans.map(l => [
                  new Date(l.date + 'T00:00').toLocaleDateString('pt-BR'),
                  l.type === 'receita' ? 'Receita' : 'Despesa',
                  l.category, l.description, l.method, l.status,
                  Number(l.value).toFixed(2).replace('.', ','),
                ])
                exportCSV('lancamentos', headers, rows)
              }}>
              <Download size={14} /> Exportar CSV
            </button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Método</th><th>Status</th><th style={{ textAlign: 'right' }}>Valor</th>{hasPermission('financeiro', 'delete') && <th></th>}</tr>
              </thead>
              <tbody>
                {filteredLans.map(l => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>{new Date(l.date + 'T00:00').toLocaleDateString('pt-BR')}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.type === 'receita' ? 'var(--success)' : 'var(--danger)', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{l.description}</span>
                      </div>
                    </td>
                    <td><span className="badge badge-neutral">{l.category}</span></td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{l.method}</td>
                    <td><span className={`badge ${l.status === 'recebido' || l.status === 'pago' ? 'badge-success' : l.status === 'pendente' ? 'badge-warning' : 'badge-neutral'}`}>{l.status}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: l.type === 'receita' ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                      {l.type === 'receita' ? '+' : '−'} {fmt(l.value)}
                    </td>
                    {hasPermission('financeiro', 'delete') && (
                      <td>
                        <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)', padding: 4 }} onClick={() => setDeleteTarget(l)} title="Excluir">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* COMISSÕES */}
      {activeTab === 'comissoes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="form-select" style={{ width: 160 }} value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
              {MONTHS_PT.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select className="form-select" style={{ width: 100 }} value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
              {[2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
            </select>
            {hasPermission('financeiro', 'edit') && (
              <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setEditingComissao(null); setComissaoForm({ name: '', type: 'veterinario', rates: { ...EMPTY_RATES } }); setShowComissaoModal(true) }}>
                <Plus size={14} /> Configurar
              </button>
            )}
          </div>

          {comissoesConfig.map(cfg => {
            const valor = calcComissao(cfg)
            const pago = comissaoPaga[comissaoKey(cfg.id)] ?? false
            const byCategory = calcComissaoByCategory(cfg)
            const typeLabel = { veterinario: 'Veterinário', socio: 'Sócio', banhista: 'Banhista' }
            const typeBadge = { veterinario: 'badge-teal', socio: 'badge-magenta', banhista: 'badge-warning' }
            return (
              <div key={cfg.id} className="card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                      <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{cfg.name}</p>
                      <span className={`badge ${typeBadge[cfg.type] ?? 'badge-neutral'}`}>{typeLabel[cfg.type] ?? cfg.type}</span>
                      {pago && <span className="badge badge-success">Pago</span>}
                      {hasPermission('financeiro', 'edit') && (
                        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setEditingComissao(cfg); setComissaoForm({ name: cfg.name, type: cfg.type, rates: { ...EMPTY_RATES, ...cfg.rates } }); setShowComissaoModal(true) }}>
                          Editar taxas
                        </button>
                      )}
                    </div>

                    {/* Tabela por categoria */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6, marginBottom: 10 }}>
                      {byCategory.filter(r => r.rate > 0).map(r => (
                        <div key={r.cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--surface-2)', borderRadius: 6, fontSize: '0.8125rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{r.cat} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({r.rate}%)</span></span>
                          <span style={{ fontWeight: 700, color: 'var(--teal)' }}>{fmt(r.valor)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 160 }}>
                    <p style={{ fontWeight: 800, fontSize: '1.25rem', color: pago ? 'var(--success)' : 'var(--text-primary)' }}>{fmt(valor)}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 10 }}>comissão do período</p>
                    {hasPermission('financeiro', 'edit') && (
                      <button className={pago ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm'} onClick={() => togglePago(cfg.id)}>
                        {pago ? 'Desfazer' : 'Marcar como pago'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Total comissões */}
          <div className="card" style={{ padding: '14px 20px', borderLeft: '4px solid var(--magenta)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Total de comissões — {MONTHS_PT[selectedMonth]} {selectedYear}</p>
            <p style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--magenta)' }}>
              {fmt(comissoesConfig.reduce((s, cfg) => s + calcComissao(cfg), 0))}
            </p>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => setLancamentos(prev => prev.filter(l => l.id !== deleteTarget.id))}
        message="O item será excluído permanentemente. Confirmar?"
      />

      {/* Modal Comissão Config */}
      <Modal isOpen={showComissaoModal} onClose={() => setShowComissaoModal(false)} title="Configurar Comissão" size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowComissaoModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={() => {
              if (editingComissao) {
                setComissoesConfig(prev => prev.map(c => c.id === editingComissao.id ? { ...comissaoForm, id: c.id } : c))
              } else {
                setComissoesConfig(prev => [...prev, { ...comissaoForm, id: `c${Date.now()}` }])
              }
              setShowComissaoModal(false)
            }}>Salvar</button>
          </>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Nome</label>
            <input className="form-input" value={comissaoForm.name} onChange={e => setComissaoForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do veterinário, sócio ou banhista" />
          </div>
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <select className="form-select" value={comissaoForm.type} onChange={e => setComissaoForm(f => ({ ...f, type: e.target.value }))}>
              <option value="veterinario">Veterinário</option>
              <option value="socio">Sócio</option>
              <option value="banhista">Banhista</option>
            </select>
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Taxa por categoria (%)</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {CATS_RECEITA.map(cat => (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--text-secondary)', minWidth: 0 }}>{cat}</span>
                  <input
                    type="number" min="0" max="100"
                    style={{ width: 56, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8125rem', textAlign: 'center', background: 'var(--surface)', color: 'var(--text-primary)' }}
                    value={comissaoForm.rates[cat] ?? 0}
                    onChange={e => setComissaoForm(f => ({ ...f, rates: { ...f.rates, [cat]: Math.max(0, Math.min(100, Number(e.target.value))) } }))}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: 12 }}>%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Payment Settings Modal */}
      <Modal isOpen={showPaymentSettingsModal} onClose={() => setShowPaymentSettingsModal(false)} title="Configurações de Pagamento" size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowPaymentSettingsModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={() => { setPaymentRates({ ...paymentRatesForm }); setShowPaymentSettingsModal(false) }}>Salvar</button>
          </>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 4 }}>
            Defina a taxa de juros padrão por forma de pagamento. Os valores são carregados automaticamente no PDV.
          </p>
          {Object.keys(DEFAULT_PAYMENT_RATES).map(key => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{PAYMENT_LABELS[key]}</span>
              <input
                type="number" min="0" max="100" step="0.1"
                style={{ width: 72, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', textAlign: 'center', background: 'var(--surface)', color: 'var(--text-primary)' }}
                value={paymentRatesForm[key] ?? 0}
                onChange={e => setPaymentRatesForm(f => ({ ...f, [key]: Math.max(0, Number(e.target.value)) }))}
              />
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', width: 12 }}>%</span>
            </div>
          ))}
        </div>
      </Modal>

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Novo Lançamento" size="md"
        footer={<><button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={saveLan}>Salvar</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, category: e.target.value === 'receita' ? 'Consultas' : 'Pessoal' }))}>
                <option value="receita">Receita</option>
                <option value="despesa">Despesa</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {(form.type === 'receita' ? CATS_RECEITA : CATS_DESPESA).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrição do lançamento" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Data</label>
              <input type="date" className="form-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Valor (R$)</label>
              <input type="number" step="0.01" className="form-input" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="0,00" />
            </div>
            <div className="form-group">
              <label className="form-label">Método</label>
              <select className="form-select" value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                {METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {['recebido', 'pendente', 'pago', 'cancelado'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function DRERow({ label, value, total, color }) {
  const pct = total > 0 ? (value / total * 100).toFixed(0) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 6 }}>{pct}%</span>
        </span>
      </div>
      <div style={{ height: 5, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, opacity: 0.7 }} />
      </div>
    </div>
  )
}
