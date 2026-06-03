import { useState, useMemo } from 'react'
import {
  Plus, Edit2, Trash2, Download, Save, ChevronRight, ChevronDown,
  Building2, AlertCircle, FileText, Printer, MessageCircle, Check,
  BookOpen, TrendingUp, Layers, ReceiptText, Percent, X,
} from 'lucide-react'
import Tabs from '../components/ui/Tabs'
import Modal from '../components/ui/Modal'
import ConfirmModal from '../components/ui/ConfirmModal'
import { usePersistentState } from '../hooks/usePersistentState'
import { useAuth } from '../context/AuthContext'

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function fmt(v) { return `R$ ${Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}` }
function fmtDate(iso) { if (!iso) return '—'; try { return new Date(iso+'T00:00').toLocaleDateString('pt-BR') } catch { return iso } }
function todayISO() { return new Date().toISOString().split('T')[0] }
function nowYM() { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() } }

function exportCSV(filename, headers, rows) {
  const bom = '﻿'
  const lines = [headers.join(';'), ...rows.map(r => r.map(c => `"${String(c??'').replace(/"/g,'""')}"`).join(';'))]
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename + '.csv'; a.click()
  URL.revokeObjectURL(url)
}

// ── Default data ─────────────────────────────────────────────────────────────

const DEFAULT_PLANO = [
  { id:'1',     codigo:'1',     nome:'RECEITAS',                    tipo:'grupo',    nivel:1, pai:null  },
  { id:'1.1',   codigo:'1.1',   nome:'Receitas de Serviços Veterinários', tipo:'grupo', nivel:2, pai:'1' },
  { id:'1.1.1', codigo:'1.1.1', nome:'Consultas Clínicas',          tipo:'analitica',nivel:3, pai:'1.1' },
  { id:'1.1.2', codigo:'1.1.2', nome:'Cirurgias',                   tipo:'analitica',nivel:3, pai:'1.1' },
  { id:'1.1.3', codigo:'1.1.3', nome:'Exames e Diagnósticos',       tipo:'analitica',nivel:3, pai:'1.1' },
  { id:'1.1.4', codigo:'1.1.4', nome:'Vacinas e Aplicações',        tipo:'analitica',nivel:3, pai:'1.1' },
  { id:'1.1.5', codigo:'1.1.5', nome:'Internação e Monitoramento',  tipo:'analitica',nivel:3, pai:'1.1' },
  { id:'1.2',   codigo:'1.2',   nome:'Receitas de Pet Shop',        tipo:'grupo',    nivel:2, pai:'1'   },
  { id:'1.2.1', codigo:'1.2.1', nome:'Venda de Produtos',           tipo:'analitica',nivel:3, pai:'1.2' },
  { id:'1.2.2', codigo:'1.2.2', nome:'Banho e Tosa',                tipo:'analitica',nivel:3, pai:'1.2' },
  { id:'1.2.3', codigo:'1.2.3', nome:'Hospedagem',                  tipo:'analitica',nivel:3, pai:'1.2' },
  { id:'1.3',   codigo:'1.3',   nome:'Outras Receitas',             tipo:'grupo',    nivel:2, pai:'1'   },
  { id:'1.3.1', codigo:'1.3.1', nome:'Receitas Financeiras',        tipo:'analitica',nivel:3, pai:'1.3' },
  { id:'1.3.2', codigo:'1.3.2', nome:'Outras',                      tipo:'analitica',nivel:3, pai:'1.3' },
  { id:'2',     codigo:'2',     nome:'DESPESAS',                    tipo:'grupo',    nivel:1, pai:null  },
  { id:'2.1',   codigo:'2.1',   nome:'Custos Operacionais',         tipo:'grupo',    nivel:2, pai:'2'   },
  { id:'2.1.1', codigo:'2.1.1', nome:'Medicamentos e Insumos',      tipo:'analitica',nivel:3, pai:'2.1' },
  { id:'2.1.2', codigo:'2.1.2', nome:'Material de Consumo',         tipo:'analitica',nivel:3, pai:'2.1' },
  { id:'2.1.3', codigo:'2.1.3', nome:'Equipamentos e Manutenção',   tipo:'analitica',nivel:3, pai:'2.1' },
  { id:'2.2',   codigo:'2.2',   nome:'Despesas com Pessoal',        tipo:'grupo',    nivel:2, pai:'2'   },
  { id:'2.2.1', codigo:'2.2.1', nome:'Salários e Encargos',         tipo:'analitica',nivel:3, pai:'2.2' },
  { id:'2.2.2', codigo:'2.2.2', nome:'Pró-labore',                  tipo:'analitica',nivel:3, pai:'2.2' },
  { id:'2.2.3', codigo:'2.2.3', nome:'Comissões',                   tipo:'analitica',nivel:3, pai:'2.2' },
  { id:'2.2.4', codigo:'2.2.4', nome:'Benefícios',                  tipo:'analitica',nivel:3, pai:'2.2' },
  { id:'2.3',   codigo:'2.3',   nome:'Despesas Administrativas',    tipo:'grupo',    nivel:2, pai:'2'   },
  { id:'2.3.1', codigo:'2.3.1', nome:'Aluguel',                     tipo:'analitica',nivel:3, pai:'2.3' },
  { id:'2.3.2', codigo:'2.3.2', nome:'Energia Elétrica',            tipo:'analitica',nivel:3, pai:'2.3' },
  { id:'2.3.3', codigo:'2.3.3', nome:'Água e Esgoto',               tipo:'analitica',nivel:3, pai:'2.3' },
  { id:'2.3.4', codigo:'2.3.4', nome:'Internet e Telefone',         tipo:'analitica',nivel:3, pai:'2.3' },
  { id:'2.3.5', codigo:'2.3.5', nome:'Sistema e Software',          tipo:'analitica',nivel:3, pai:'2.3' },
  { id:'2.3.6', codigo:'2.3.6', nome:'Contabilidade',               tipo:'analitica',nivel:3, pai:'2.3' },
  { id:'2.3.7', codigo:'2.3.7', nome:'Marketing e Publicidade',     tipo:'analitica',nivel:3, pai:'2.3' },
  { id:'2.3.8', codigo:'2.3.8', nome:'Outras Administrativas',      tipo:'analitica',nivel:3, pai:'2.3' },
  { id:'2.4',   codigo:'2.4',   nome:'Impostos e Tributos',         tipo:'grupo',    nivel:2, pai:'2'   },
  { id:'2.4.1', codigo:'2.4.1', nome:'ISS',                         tipo:'analitica',nivel:3, pai:'2.4' },
  { id:'2.4.2', codigo:'2.4.2', nome:'ICMS',                        tipo:'analitica',nivel:3, pai:'2.4' },
  { id:'2.4.3', codigo:'2.4.3', nome:'PIS',                         tipo:'analitica',nivel:3, pai:'2.4' },
  { id:'2.4.4', codigo:'2.4.4', nome:'COFINS',                      tipo:'analitica',nivel:3, pai:'2.4' },
  { id:'2.4.5', codigo:'2.4.5', nome:'CSLL',                        tipo:'analitica',nivel:3, pai:'2.4' },
  { id:'2.4.6', codigo:'2.4.6', nome:'IRPJ',                        tipo:'analitica',nivel:3, pai:'2.4' },
  { id:'2.4.7', codigo:'2.4.7', nome:'Simples Nacional',            tipo:'analitica',nivel:3, pai:'2.4' },
  { id:'2.4.8', codigo:'2.4.8', nome:'Outros Tributos',             tipo:'analitica',nivel:3, pai:'2.4' },
]

const DEFAULT_CENTROS = [
  { id:'cc1', nome:'Consultório',   cor:'#27B5AC', ativo:true },
  { id:'cc2', nome:'Pet Shop',      cor:'#DE098D', ativo:true },
  { id:'cc3', nome:'Banho/Tosa',    cor:'#7C3AED', ativo:true },
  { id:'cc4', nome:'Hospedagem',    cor:'#D97706', ativo:true },
  { id:'cc5', nome:'Administrativo',cor:'#64748B', ativo:true },
]

// Map of financeiro categories → accounting categories
const CAT_MAP_RECEITA = {
  'Consultas':    '1.1.1',
  'Cirurgia':     '1.1.2',
  'Exames':       '1.1.3',
  'Vacinas':      '1.1.4',
  'Hospedagem':   '1.2.3',
  'Produtos':     '1.2.1',
  'Banho & Tosa': '1.2.2',
  'Outros':       '1.3.2',
}
const CAT_MAP_DESPESA = {
  'Medicamentos': '2.1.1',
  'Pessoal':      '2.2.1',
  'Aluguel':      '2.3.1',
  'Utilidades':   '2.3.2',
  'Marketing':    '2.3.7',
  'Manutenção':   '2.1.3',
  'Fornecedores': '2.1.2',
  'Outros':       '2.3.8',
}
const CAT_MAP_PESSOAL = ['Pessoal']
const CAT_MAP_ADMIN   = ['Aluguel','Utilidades','Marketing','Manutenção','Fornecedores','Outros']
const CAT_MAP_CSP     = ['Medicamentos','Fornecedores']

function loadFiscal() {
  try { return { ...DEFAULT_FISCAL_CFG, ...JSON.parse(localStorage.getItem('petvet-config-fiscal')||'{}') } }
  catch { return { ...DEFAULT_FISCAL_CFG } }
}
const DEFAULT_FISCAL_CFG = {
  regimeTributario:'simples', tipoAtividade:'misto',
  cnpj:'', inscricaoEstadual:'', inscricaoMunicipal:'', cnae:'',
  aliquotaISS:5, aliquotaICMS:12, aliquotaPIS:0.65,
  aliquotaCOFINS:3, aliquotaCSLL:9, aliquotaIRPJ:15,
  emissaoNF:'nao_emite',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function YearMonthPicker({ year, month, onChange }) {
  const years = []
  const y0 = new Date().getFullYear()
  for (let y = y0; y >= y0 - 4; y--) years.push(y)
  return (
    <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
      <select className="form-input" style={{ width:90 }} value={year}
        onChange={e => onChange(Number(e.target.value), month)}>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <select className="form-input" style={{ width:130 }} value={month}
        onChange={e => onChange(year, Number(e.target.value))}>
        {MONTHS_PT.map((m,i) => <option key={i} value={i}>{m}</option>)}
      </select>
    </div>
  )
}

// ── Tab: Plano de Contas ──────────────────────────────────────────────────────

function PlanoContas() {
  const [plano, setPlano] = usePersistentState('petvet-plano-contas', DEFAULT_PLANO)
  const [expanded, setExpanded] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ codigo:'', nome:'', tipo:'analitica', nivel:3, pai:'' })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [search, setSearch] = useState('')

  const filtered = search
    ? plano.filter(i => i.nome.toLowerCase().includes(search.toLowerCase()) || i.codigo.includes(search))
    : plano

  function toggleExpand(id) { setExpanded(e => ({ ...e, [id]: !e[id] })) }

  function openAdd(pai = null, nivel = 1) {
    setEditItem(null)
    setForm({ codigo:'', nome:'', tipo: nivel >= 3 ? 'analitica' : 'grupo', nivel, pai: pai || '' })
    setShowModal(true)
  }

  function openEdit(item) {
    setEditItem(item)
    setForm({ codigo: item.codigo, nome: item.nome, tipo: item.tipo, nivel: item.nivel, pai: item.pai || '' })
    setShowModal(true)
  }

  function handleSave() {
    if (!form.codigo.trim() || !form.nome.trim()) return
    if (editItem) {
      setPlano(p => p.map(i => i.id === editItem.id ? { ...i, ...form, pai: form.pai || null } : i))
    } else {
      setPlano(p => [...p, { id: form.codigo, ...form, pai: form.pai || null }])
    }
    setShowModal(false)
  }

  function handleDelete(id) {
    setPlano(p => p.filter(i => i.id !== id && i.pai !== id))
    setDeleteTarget(null)
  }

  function handleReset() {
    setPlano(DEFAULT_PLANO)
  }

  // Render tree
  function renderTree(items, paiId = null, depth = 0) {
    return items.filter(i => i.pai === paiId).map(item => {
      const children = items.filter(i => i.pai === item.id)
      const hasChildren = children.length > 0
      const isExpanded = expanded[item.id] !== false
      const indent = depth * 20
      const isGrupo = item.tipo === 'grupo'
      return (
        <div key={item.id}>
          <div style={{
            display:'flex', alignItems:'center', gap:6,
            padding:'6px 10px', borderBottom:'1px solid var(--border)',
            paddingLeft: 10 + indent,
            background: depth === 0 ? 'var(--surface-2)' : 'transparent',
          }}>
            {hasChildren ? (
              <button style={{ background:'none',border:'none',cursor:'pointer',padding:2,color:'var(--text-muted)',flexShrink:0 }}
                onClick={() => toggleExpand(item.id)}>
                {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
              </button>
            ) : (
              <div style={{ width:18, flexShrink:0 }} />
            )}
            <span style={{ fontFamily:'monospace', fontSize:'0.75rem', color:'var(--text-muted)', minWidth:60, flexShrink:0 }}>
              {item.codigo}
            </span>
            <span style={{ flex:1, fontSize:'0.875rem', fontWeight: depth < 2 ? 700 : 400, color:'var(--text-primary)' }}>
              {item.nome}
            </span>
            <span style={{
              fontSize:'0.7rem', padding:'1px 8px', borderRadius:10,
              background: isGrupo ? 'var(--surface-2)' : 'var(--teal-light)',
              color: isGrupo ? 'var(--text-muted)' : 'var(--teal-dark)',
              fontWeight:600, flexShrink:0,
            }}>
              {isGrupo ? 'Grupo' : 'Analítica'}
            </span>
            <button className="btn btn-ghost btn-icon" style={{ padding:4 }} onClick={() => openEdit(item)}>
              <Edit2 size={13}/>
            </button>
            <button className="btn btn-ghost btn-icon" style={{ padding:4, color:'var(--danger)' }}
              onClick={() => setDeleteTarget(item)}>
              <Trash2 size={13}/>
            </button>
          </div>
          {hasChildren && isExpanded && renderTree(items, item.id, depth + 1)}
        </div>
      )
    })
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <input className="form-input" placeholder="Buscar conta..." style={{ maxWidth:240 }}
          value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-primary btn-sm" onClick={() => openAdd(null, 1)}>
          <Plus size={14}/> Nova conta
        </button>
        <button className="btn btn-ghost btn-sm" onClick={handleReset}
          title="Restaurar plano de contas padrão">
          Restaurar padrão
        </button>
        <button className="btn btn-outline btn-sm" onClick={() =>
          exportCSV('plano-contas', ['Código','Nome','Tipo','Nível','Conta pai'],
            plano.map(i => [i.codigo, i.nome, i.tipo, i.nivel, i.pai || '']))
        }>
          <Download size={14}/> CSV
        </button>
      </div>

      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'8px 10px', background:'var(--surface-2)', borderBottom:'2px solid var(--border)', display:'flex', gap:10 }}>
          <span style={{ width:24, flexShrink:0 }}/>
          <span style={{ minWidth:60, fontSize:'0.75rem', fontWeight:700, color:'var(--text-muted)' }}>Código</span>
          <span style={{ flex:1, fontSize:'0.75rem', fontWeight:700, color:'var(--text-muted)' }}>Nome</span>
          <span style={{ minWidth:80, fontSize:'0.75rem', fontWeight:700, color:'var(--text-muted)' }}>Tipo</span>
          <span style={{ width:60 }}/>
        </div>
        {search ? (
          filtered.map(item => (
            <div key={item.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 10px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ width:18 }}/>
              <span style={{ fontFamily:'monospace', fontSize:'0.75rem', color:'var(--text-muted)', minWidth:60 }}>{item.codigo}</span>
              <span style={{ flex:1, fontSize:'0.875rem', color:'var(--text-primary)' }}>{item.nome}</span>
              <span style={{ fontSize:'0.7rem', padding:'1px 8px', borderRadius:10, background:'var(--surface-2)', color:'var(--text-muted)', fontWeight:600 }}>
                {item.tipo === 'grupo' ? 'Grupo' : 'Analítica'}
              </span>
              <button className="btn btn-ghost btn-icon" style={{ padding:4 }} onClick={() => openEdit(item)}><Edit2 size={13}/></button>
              <button className="btn btn-ghost btn-icon" style={{ padding:4, color:'var(--danger)' }} onClick={() => setDeleteTarget(item)}><Trash2 size={13}/></button>
            </div>
          ))
        ) : renderTree(plano, null, 0)}
      </div>

      {showModal && (
        <Modal title={editItem ? 'Editar conta' : 'Nova conta'} onClose={() => setShowModal(false)}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Código</label>
                <input className="form-input" value={form.codigo} onChange={e => setForm(f=>({...f,codigo:e.target.value}))} placeholder="Ex: 1.1.1"/>
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Tipo</label>
                <select className="form-input" value={form.tipo} onChange={e => setForm(f=>({...f,tipo:e.target.value}))}>
                  <option value="grupo">Grupo (sintética)</option>
                  <option value="analitica">Analítica</option>
                </select>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Nome da conta</label>
              <input className="form-input" value={form.nome} onChange={e => setForm(f=>({...f,nome:e.target.value}))} placeholder="Nome da conta"/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Nível</label>
                <input type="number" className="form-input" min={1} max={5} value={form.nivel} onChange={e => setForm(f=>({...f,nivel:Number(e.target.value)}))}/>
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Conta pai (código)</label>
                <input className="form-input" value={form.pai} onChange={e => setForm(f=>({...f,pai:e.target.value}))} placeholder="Ex: 1.1"/>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave}>
                <Save size={14}/> Salvar
              </button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget?.id)}
        message={`Excluir a conta "${deleteTarget?.nome}" e todas as subcontas?`}
      />
    </div>
  )
}

// ── Tab: Livro Caixa ──────────────────────────────────────────────────────────

function LivroCaixa() {
  const ym = nowYM()
  const [year, setYear]   = useState(ym.year)
  const [month, setMonth] = useState(ym.month)
  const [saldoInicial, setSaldoInicial] = usePersistentState('petvet-saldo-inicial', {})

  const lancamentos = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('petvet-lancamentos')||'[]') } catch { return [] }
  }, [])
  const vendas = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('petvet-vendas')||'[]') } catch { return [] }
  }, [])

  const saldoKey = `${year}-${String(month).padStart(2,'0')}`
  const saldoIni = Number(saldoInicial[saldoKey] || 0)

  const movimentos = useMemo(() => {
    const all = []
    // From lancamentos
    for (const l of lancamentos) {
      const d = new Date(l.date + 'T00:00')
      if (d.getFullYear() !== year || d.getMonth() !== month) continue
      if (l.status === 'cancelado') continue
      all.push({
        id: l.id, date: l.date, historico: l.description || l.category,
        entrada: l.type === 'receita' ? Number(l.value||0) : 0,
        saida:   l.type === 'despesa' ? Number(l.value||0) : 0,
        source: 'lancamento',
      })
    }
    // From vendas (PDV)
    for (const v of vendas) {
      // date may be locale string; try to parse
      let iso = ''
      try {
        const parts = v.date?.match(/(\d{2})\/(\d{2})\/(\d{4})/)
        if (parts) iso = `${parts[3]}-${parts[2]}-${parts[1]}`
        else iso = v.date?.split(',')[0] || ''
      } catch {}
      if (!iso) continue
      const d = new Date(iso + 'T00:00')
      if (isNaN(d) || d.getFullYear() !== year || d.getMonth() !== month) continue
      all.push({
        id: v.num, date: iso, historico: `PDV — ${v.tutor || 'Avulso'}`,
        entrada: Number(v.total||0), saida: 0, source: 'pdv',
      })
    }
    return all.sort((a,b) => a.date.localeCompare(b.date))
  }, [lancamentos, vendas, year, month])

  const rows = useMemo(() => {
    let saldo = saldoIni
    return movimentos.map(m => {
      saldo += m.entrada - m.saida
      return { ...m, saldo }
    })
  }, [movimentos, saldoIni])

  const totalEntradas = movimentos.reduce((s,m)=>s+m.entrada, 0)
  const totalSaidas   = movimentos.reduce((s,m)=>s+m.saida,   0)
  const saldoFinal    = saldoIni + totalEntradas - totalSaidas

  function handleExportCSV() {
    exportCSV(`livro-caixa-${year}-${String(month+1).padStart(2,'0')}`,
      ['Data','Histórico','Entrada','Saída','Saldo'],
      [
        ['','Saldo inicial','','',saldoIni.toFixed(2)],
        ...rows.map(r => [
          fmtDate(r.date), r.historico,
          r.entrada > 0 ? r.entrada.toFixed(2) : '',
          r.saida   > 0 ? r.saida.toFixed(2)   : '',
          r.saldo.toFixed(2),
        ]),
        ['','SALDO FINAL','','',saldoFinal.toFixed(2)],
      ]
    )
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <YearMonthPicker year={year} month={month} onChange={(y,m)=>{ setYear(y); setMonth(m) }}/>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <label className="form-label" style={{ marginBottom:0, whiteSpace:'nowrap' }}>Saldo inicial (R$)</label>
          <input type="number" className="form-input" style={{ width:120 }}
            value={saldoInicial[saldoKey]||''}
            placeholder="0,00"
            onChange={e => setSaldoInicial(prev => ({...prev,[saldoKey]:e.target.value}))}
          />
        </div>
        <button className="btn btn-outline btn-sm" onClick={handleExportCSV}><Download size={14}/> CSV</button>
        <button className="btn btn-outline btn-sm" onClick={handlePrint}><Printer size={14}/> Imprimir</button>
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:10 }}>
        {[
          { label:'Saldo inicial',  value: saldoIni,      color:'var(--text-primary)' },
          { label:'Total entradas', value: totalEntradas,  color:'#22c55e'  },
          { label:'Total saídas',   value: totalSaidas,    color:'#ef4444'  },
          { label:'Saldo final',    value: saldoFinal,     color: saldoFinal >= 0 ? '#22c55e' : '#ef4444' },
        ].map(c => (
          <div key={c.label} className="card" style={{ padding:'12px 16px' }}>
            <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:4 }}>{c.label}</div>
            <div style={{ fontSize:'1.1rem', fontWeight:700, color:c.color }}>{fmt(c.value)}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8125rem' }}>
          <thead>
            <tr style={{ background:'var(--surface-2)', borderBottom:'2px solid var(--border)' }}>
              {['Data','Histórico','Entrada','Saída','Saldo'].map(h => (
                <th key={h} style={{ padding:'8px 12px', textAlign: h==='Histórico' ? 'left' : 'right', color:'var(--text-muted)', fontWeight:700, whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom:'1px solid var(--border)', background:'var(--surface-2)' }}>
              <td style={{ padding:'6px 12px', color:'var(--text-muted)' }}>—</td>
              <td style={{ padding:'6px 12px', color:'var(--text-primary)', fontWeight:600 }}>Saldo inicial</td>
              <td/>
              <td/>
              <td style={{ padding:'6px 12px', textAlign:'right', fontWeight:700, color:'var(--text-primary)' }}>{fmt(saldoIni)}</td>
            </tr>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding:'24px', textAlign:'center', color:'var(--text-muted)' }}>
                  Nenhuma movimentação no período
                </td>
              </tr>
            ) : rows.map(r => (
              <tr key={r.id} style={{ borderBottom:'1px solid var(--border)' }}>
                <td style={{ padding:'6px 12px', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{fmtDate(r.date)}</td>
                <td style={{ padding:'6px 12px', color:'var(--text-primary)' }}>{r.historico}</td>
                <td style={{ padding:'6px 12px', textAlign:'right', color:'#22c55e', fontFamily:'monospace' }}>
                  {r.entrada > 0 ? fmt(r.entrada) : ''}
                </td>
                <td style={{ padding:'6px 12px', textAlign:'right', color:'#ef4444', fontFamily:'monospace' }}>
                  {r.saida > 0 ? fmt(r.saida) : ''}
                </td>
                <td style={{ padding:'6px 12px', textAlign:'right', fontWeight:600, fontFamily:'monospace',
                  color: r.saldo >= 0 ? 'var(--text-primary)' : '#ef4444' }}>
                  {fmt(r.saldo)}
                </td>
              </tr>
            ))}
            <tr style={{ borderTop:'2px solid var(--border)', background:'var(--surface-2)' }}>
              <td/>
              <td style={{ padding:'8px 12px', fontWeight:700, color:'var(--text-primary)' }}>SALDO FINAL</td>
              <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, color:'#22c55e', fontFamily:'monospace' }}>{fmt(totalEntradas)}</td>
              <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, color:'#ef4444', fontFamily:'monospace' }}>{fmt(totalSaidas)}</td>
              <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, fontFamily:'monospace',
                color: saldoFinal >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(saldoFinal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab: DRE ──────────────────────────────────────────────────────────────────

function DRE() {
  const ym = nowYM()
  const [year, setYear]   = useState(ym.year)
  const [month, setMonth] = useState(ym.month)
  const fiscal = loadFiscal()

  const lancamentos = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('petvet-lancamentos')||'[]') } catch { return [] }
  }, [])
  const vendas = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('petvet-vendas')||'[]') } catch { return [] }
  }, [])

  const { rec, desp } = useMemo(() => {
    const rec = {}, desp = {}
    for (const l of lancamentos) {
      const d = new Date(l.date+'T00:00')
      if (d.getFullYear()!==year || d.getMonth()!==month) continue
      if (l.status==='cancelado') continue
      const val = Number(l.value||0)
      if (l.type==='receita') rec[l.category] = (rec[l.category]||0) + val
      else desp[l.category] = (desp[l.category]||0) + val
    }
    // Add PDV vendas
    for (const v of vendas) {
      try {
        const parts = v.date?.match(/(\d{2})\/(\d{2})\/(\d{4})/)
        if (!parts) continue
        const iso = `${parts[3]}-${parts[2]}-${parts[1]}`
        const d = new Date(iso+'T00:00')
        if (d.getFullYear()!==year || d.getMonth()!==month) continue
        rec['Produtos'] = (rec['Produtos']||0) + Number(v.total||0)
      } catch {}
    }
    return { rec, desp }
  }, [lancamentos, vendas, year, month])

  const recServicos = Object.entries(rec)
    .filter(([c]) => !['Produtos','Banho & Tosa','Hospedagem'].includes(c))
    .reduce((s,[,v])=>s+v, 0)
  const recVendas   = (rec['Produtos']||0) + (rec['Banho & Tosa']||0) + (rec['Hospedagem']||0)
  const recBruta    = recServicos + recVendas

  const alISS    = Number(fiscal.aliquotaISS   ||0) / 100
  const alICMS   = Number(fiscal.aliquotaICMS  ||0) / 100
  const alPIS    = Number(fiscal.aliquotaPIS   ||0) / 100
  const alCOFINS = Number(fiscal.aliquotaCOFINS||0) / 100
  const alCSLL   = Number(fiscal.aliquotaCSLL  ||0) / 100
  const alIRPJ   = Number(fiscal.aliquotaIRPJ  ||0) / 100

  const issVal    = recServicos * alISS
  const icmsVal   = recVendas   * alICMS
  const pisVal    = recBruta    * alPIS
  const cofinsVal = recBruta    * alCOFINS
  const dedTotal  = issVal + icmsVal + pisVal + cofinsVal

  const recLiquida = recBruta - dedTotal

  const csp = CAT_MAP_CSP.reduce((s,c)=>s+(desp[c]||0), 0)
  const cmv = desp['Fornecedores'] || 0

  const lucroBruto = recLiquida - csp - cmv

  const despPessoal = CAT_MAP_PESSOAL.reduce((s,c)=>s+(desp[c]||0), 0)
  const despAdmin   = CAT_MAP_ADMIN.reduce((s,c)=>s+(desp[c]||0), 0)
  const despOper    = despPessoal + despAdmin

  const ebitda   = lucroBruto - despOper
  const deprec   = 0
  const ebit     = ebitda - deprec
  const resFin   = 0
  const lair     = ebit + resFin

  const csllVal  = fiscal.regimeTributario === 'lucro_presumido' ? lair * alCSLL : 0
  const irpjVal  = fiscal.regimeTributario === 'lucro_presumido' ? lair * alIRPJ : 0
  const lucroLiq = lair - csllVal - irpjVal

  const rows = [
    { label:'(+) Receita Bruta de Serviços', val: recServicos,  indent:0, sign:1,  bold:false },
    { label:'(+) Receita Bruta de Vendas',   val: recVendas,    indent:0, sign:1,  bold:false },
    { label:'(-) ISS',                        val: issVal,       indent:1, sign:-1, bold:false },
    { label:'(-) ICMS',                       val: icmsVal,      indent:1, sign:-1, bold:false },
    { label:'(-) PIS',                        val: pisVal,       indent:1, sign:-1, bold:false },
    { label:'(-) COFINS',                     val: cofinsVal,    indent:1, sign:-1, bold:false },
    { label:'(=) Receita Líquida',            val: recLiquida,   indent:0, sign:1,  bold:true, result:true },
    { label:'(-) Custo dos Serviços (CSP)',   val: csp,          indent:1, sign:-1, bold:false },
    { label:'(-) Custo das Mercadorias (CMV)',val: cmv,          indent:1, sign:-1, bold:false },
    { label:'(=) Lucro Bruto',                val: lucroBruto,   indent:0, sign:1,  bold:true, result:true },
    { label:'(-) Despesas com Pessoal',       val: despPessoal,  indent:1, sign:-1, bold:false },
    { label:'(-) Despesas Administrativas',   val: despAdmin,    indent:1, sign:-1, bold:false },
    { label:'(=) EBITDA',                     val: ebitda,       indent:0, sign:1,  bold:true, result:true },
    { label:'(-) Depreciação/Amortização',    val: deprec,       indent:1, sign:-1, bold:false },
    { label:'(=) EBIT / Lucro Operacional',   val: ebit,         indent:0, sign:1,  bold:true, result:true },
    { label:'(+/-) Resultado Financeiro',     val: resFin,       indent:1, sign:1,  bold:false },
    { label:'(=) LAIR',                       val: lair,         indent:0, sign:1,  bold:true, result:true },
    { label:'(-) IRPJ',                       val: irpjVal,      indent:1, sign:-1, bold:false },
    { label:'(-) CSLL',                       val: csllVal,      indent:1, sign:-1, bold:false },
    { label:'(=) LUCRO LÍQUIDO',              val: lucroLiq,     indent:0, sign:1,  bold:true, result:true, highlight:true },
  ]

  function handleExportCSV() {
    exportCSV(`dre-${year}-${String(month+1).padStart(2,'0')}`,
      ['Descrição','Valor (R$)'],
      rows.map(r => [r.label, r.val.toFixed(2)])
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <YearMonthPicker year={year} month={month} onChange={(y,m)=>{ setYear(y); setMonth(m) }}/>
        <button className="btn btn-outline btn-sm" onClick={handleExportCSV}><Download size={14}/> CSV</button>
        <button className="btn btn-outline btn-sm" onClick={() => window.print()}><Printer size={14}/> Imprimir</button>
      </div>
      {fiscal.regimeTributario !== 'lucro_presumido' && (
        <div style={{ padding:'10px 14px', background:'#fef9c3', border:'1px solid #fde047', borderRadius:8, fontSize:'0.8125rem', color:'#713f12' }}>
          <AlertCircle size={14} style={{ marginRight:6, verticalAlign:'middle' }}/>
          IRPJ e CSLL calculados apenas para Lucro Presumido. Regime atual: <strong>{fiscal.regimeTributario}</strong>
        </div>
      )}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'10px 16px', background:'var(--teal)', color:'#fff', fontWeight:700 }}>
          DRE — {MONTHS_PT[month]} {year}
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.875rem' }}>
          <tbody>
            {rows.map((r,i) => (
              <tr key={i} style={{
                borderBottom:'1px solid var(--border)',
                background: r.highlight ? 'var(--teal-light)' : r.result ? 'var(--surface-2)' : 'transparent',
              }}>
                <td style={{ padding:`${r.result?'10px':'6px'} 16px`, paddingLeft: 16 + r.indent * 20,
                  fontWeight: r.bold ? 700 : 400, color: r.highlight ? 'var(--teal-dark)' : 'var(--text-primary)' }}>
                  {r.label}
                </td>
                <td style={{ padding:'6px 16px', textAlign:'right', fontWeight: r.bold ? 700 : 400,
                  fontFamily:'monospace', whiteSpace:'nowrap',
                  color: r.highlight ? 'var(--teal-dark)' : r.val < 0 ? '#ef4444' : r.val === 0 ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                  {r.val === 0 ? '—' : fmt(Math.abs(r.val))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab: Centro de Custos ─────────────────────────────────────────────────────

function CentroCustos() {
  const ym = nowYM()
  const [year, setYear]   = useState(ym.year)
  const [month, setMonth] = useState(ym.month)
  const [centros, setCentros] = usePersistentState('petvet-centro-custos', DEFAULT_CENTROS)
  const [showModal, setShowModal] = useState(false)
  const [editCentro, setEditCentro] = useState(null)
  const [form, setForm] = useState({ nome:'', cor:'#27B5AC', ativo:true })
  const [deleteTarget, setDeleteTarget] = useState(null)

  const lancamentos = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('petvet-lancamentos')||'[]') } catch { return [] }
  }, [])

  // Mapeamento automático de categorias → centro
  const catToCentro = {
    'Consultas':'cc1','Cirurgia':'cc1','Exames':'cc1','Vacinas':'cc1','Internação':'cc1',
    'Produtos':'cc2','Banho & Tosa':'cc3','Hospedagem':'cc4',
    'Pessoal':'cc5','Aluguel':'cc5','Utilidades':'cc5','Marketing':'cc5',
    'Medicamentos':'cc1','Fornecedores':'cc2','Manutenção':'cc5','Outros':'cc5',
  }

  const data = useMemo(() => {
    const result = {}
    centros.forEach(c => { result[c.id] = { receitas:0, despesas:0 } })
    for (const l of lancamentos) {
      const d = new Date(l.date+'T00:00')
      if (d.getFullYear()!==year || d.getMonth()!==month) continue
      if (l.status==='cancelado') continue
      const centroId = l.centroId || catToCentro[l.category] || 'cc5'
      if (!result[centroId]) continue
      const val = Number(l.value||0)
      if (l.type==='receita') result[centroId].receitas += val
      else result[centroId].despesas += val
    }
    return result
  }, [lancamentos, centros, year, month])

  const totalRec  = centros.reduce((s,c)=>s+(data[c.id]?.receitas||0), 0)
  const totalDesp = centros.reduce((s,c)=>s+(data[c.id]?.despesas||0), 0)

  function openAdd() { setEditCentro(null); setForm({ nome:'', cor:'#27B5AC', ativo:true }); setShowModal(true) }
  function openEdit(c) { setEditCentro(c); setForm({ nome:c.nome, cor:c.cor, ativo:c.ativo }); setShowModal(true) }
  function handleSave() {
    if (!form.nome.trim()) return
    if (editCentro) setCentros(p => p.map(c => c.id===editCentro.id ? { ...c,...form } : c))
    else setCentros(p => [...p, { id:`cc${Date.now()}`, ...form }])
    setShowModal(false)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <YearMonthPicker year={year} month={month} onChange={(y,m)=>{ setYear(y); setMonth(m) }}/>
        <button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={14}/> Novo centro</button>
        <button className="btn btn-outline btn-sm" onClick={() =>
          exportCSV(`centros-${year}-${String(month+1).padStart(2,'0')}`,
            ['Centro','Receitas','Despesas','Resultado'],
            centros.map(c=>[c.nome, (data[c.id]?.receitas||0).toFixed(2),(data[c.id]?.despesas||0).toFixed(2),((data[c.id]?.receitas||0)-(data[c.id]?.despesas||0)).toFixed(2)])
          )
        }><Download size={14}/> CSV</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))', gap:12 }}>
        {centros.map(c => {
          const rec  = data[c.id]?.receitas  || 0
          const desp = data[c.id]?.despesas  || 0
          const res  = rec - desp
          const pct  = totalRec > 0 ? (rec/totalRec*100) : 0
          return (
            <div key={c.id} className="card" style={{ padding:'14px 16px', borderTop:`3px solid ${c.cor}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span style={{ fontWeight:700, color:'var(--text-primary)' }}>{c.nome}</span>
                <div style={{ display:'flex', gap:4 }}>
                  <button className="btn btn-ghost btn-icon" style={{ padding:3 }} onClick={()=>openEdit(c)}><Edit2 size={12}/></button>
                  <button className="btn btn-ghost btn-icon" style={{ padding:3, color:'var(--danger)' }} onClick={()=>setDeleteTarget(c)}><Trash2 size={12}/></button>
                </div>
              </div>
              <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:4 }}>Receitas</div>
              <div style={{ fontWeight:700, color:'#22c55e', marginBottom:8 }}>{fmt(rec)}</div>
              <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:4 }}>Despesas</div>
              <div style={{ fontWeight:700, color:'#ef4444', marginBottom:8 }}>{fmt(desp)}</div>
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:8, display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>Resultado</span>
                <span style={{ fontWeight:700, color: res>=0 ? '#22c55e' : '#ef4444' }}>{fmt(res)}</span>
              </div>
              <div style={{ marginTop:8, height:6, borderRadius:3, background:'var(--border)' }}>
                <div style={{ width:`${pct}%`, height:'100%', borderRadius:3, background:c.cor, transition:'width .3s' }}/>
              </div>
              <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginTop:3 }}>{pct.toFixed(1)}% da receita total</div>
            </div>
          )
        })}
      </div>

      {/* Comparativo */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'10px 16px', fontWeight:700, color:'var(--text-primary)', borderBottom:'1px solid var(--border)' }}>
          Comparativo entre centros
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8125rem' }}>
          <thead>
            <tr style={{ borderBottom:'2px solid var(--border)', background:'var(--surface-2)' }}>
              {['Centro','Receitas','Despesas','Resultado','% Receita'].map(h=>(
                <th key={h} style={{ padding:'8px 12px', textAlign: h==='Centro' ? 'left' : 'right', color:'var(--text-muted)', fontWeight:700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {centros.map(c => {
              const rec  = data[c.id]?.receitas||0
              const desp = data[c.id]?.despesas||0
              const res  = rec - desp
              const pct  = totalRec > 0 ? (rec/totalRec*100) : 0
              return (
                <tr key={c.id} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'8px 12px', display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:12, height:12, borderRadius:'50%', background:c.cor, flexShrink:0 }}/>
                    {c.nome}
                  </td>
                  <td style={{ padding:'8px 12px', textAlign:'right', color:'#22c55e', fontFamily:'monospace' }}>{fmt(rec)}</td>
                  <td style={{ padding:'8px 12px', textAlign:'right', color:'#ef4444', fontFamily:'monospace' }}>{fmt(desp)}</td>
                  <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:600, fontFamily:'monospace', color: res>=0?'#22c55e':'#ef4444' }}>{fmt(res)}</td>
                  <td style={{ padding:'8px 12px', textAlign:'right', color:'var(--text-muted)' }}>{pct.toFixed(1)}%</td>
                </tr>
              )
            })}
            <tr style={{ borderTop:'2px solid var(--border)', background:'var(--surface-2)', fontWeight:700 }}>
              <td style={{ padding:'8px 12px' }}>TOTAL</td>
              <td style={{ padding:'8px 12px', textAlign:'right', color:'#22c55e', fontFamily:'monospace' }}>{fmt(totalRec)}</td>
              <td style={{ padding:'8px 12px', textAlign:'right', color:'#ef4444', fontFamily:'monospace' }}>{fmt(totalDesp)}</td>
              <td style={{ padding:'8px 12px', textAlign:'right', fontFamily:'monospace', color: (totalRec-totalDesp)>=0?'#22c55e':'#ef4444' }}>{fmt(totalRec-totalDesp)}</td>
              <td style={{ padding:'8px 12px', textAlign:'right', color:'var(--text-muted)' }}>100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editCentro ? 'Editar centro de custo' : 'Novo centro de custo'} onClose={()=>setShowModal(false)}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Nome</label>
              <input className="form-input" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder="Ex: Consultório"/>
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Cor identificadora</label>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <input type="color" value={form.cor} onChange={e=>setForm(f=>({...f,cor:e.target.value}))}
                  style={{ width:44, height:44, border:'1.5px solid var(--border)', borderRadius:6, cursor:'pointer', padding:3 }}/>
                <input className="form-input" value={form.cor} onChange={e=>setForm(f=>({...f,cor:e.target.value}))}
                  style={{ fontFamily:'monospace', maxWidth:120 }}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave}><Save size={14}/> Salvar</button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmModal isOpen={!!deleteTarget} onClose={()=>setDeleteTarget(null)}
        onConfirm={()=>{ setCentros(p=>p.filter(c=>c.id!==deleteTarget.id)); setDeleteTarget(null) }}
        message={`Excluir o centro de custo "${deleteTarget?.nome}"?`}/>
    </div>
  )
}

// ── Tab: Conciliação Bancária ─────────────────────────────────────────────────

function ConciliacaoBancaria() {
  const ym = nowYM()
  const [year, setYear]   = useState(ym.year)
  const [month, setMonth] = useState(ym.month)
  const [contas, setContas] = usePersistentState('petvet-contas-bancarias', [])
  const [extrato, setExtrato] = usePersistentState('petvet-extrato-bancario', [])
  const [showContaModal, setShowContaModal] = useState(false)
  const [editConta, setEditConta] = useState(null)
  const [contaForm, setContaForm] = useState({ banco:'', agencia:'', conta:'', tipo:'corrente', saldoAtual:'' })
  const [deleteContaTarget, setDeleteContaTarget] = useState(null)
  const [selectedContaId, setSelectedContaId] = useState('')
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)

  const lancamentos = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('petvet-lancamentos')||'[]') } catch { return [] }
  }, [])

  const movimentosPeriodo = useMemo(() => {
    return lancamentos.filter(l => {
      const d = new Date(l.date+'T00:00')
      return d.getFullYear()===year && d.getMonth()===month && l.status!=='cancelado'
    })
  }, [lancamentos, year, month])

  const saldoContabil = movimentosPeriodo.reduce((s,l) => {
    const v = Number(l.value||0)
    return s + (l.type==='receita' ? v : -v)
  }, 0)

  const extratoFiltrado = extrato.filter(e => {
    if (!selectedContaId || e.contaId !== selectedContaId) return false
    const d = new Date(e.date+'T00:00')
    return d.getFullYear()===year && d.getMonth()===month
  })

  const saldoBancario = extratoFiltrado.reduce((s,e) => s + Number(e.valor||0), 0)

  function openAddConta() { setEditConta(null); setContaForm({ banco:'', agencia:'', conta:'', tipo:'corrente', saldoAtual:'' }); setShowContaModal(true) }
  function openEditConta(c) { setEditConta(c); setContaForm({ banco:c.banco, agencia:c.agencia, conta:c.conta, tipo:c.tipo, saldoAtual:c.saldoAtual }); setShowContaModal(true) }
  function saveConta() {
    if (!contaForm.banco) return
    if (editConta) setContas(p=>p.map(c=>c.id===editConta.id?{...c,...contaForm}:c))
    else setContas(p=>[...p, { id:`bc${Date.now()}`, ...contaForm }])
    setShowContaModal(false)
  }

  function handleImport() {
    if (!selectedContaId || !importText.trim()) return
    const lines = importText.trim().split('\n').filter(Boolean)
    const newItems = []
    for (const line of lines) {
      const parts = line.split(/[,;|\t]/).map(s=>s.trim().replace(/"/g,''))
      if (parts.length < 3) continue
      const [dateStr, hist, valStr] = parts
      const dateParts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/)
      const iso = dateParts ? `${dateParts[3]}-${dateParts[2]}-${dateParts[1]}` : dateStr
      const valor = parseFloat(valStr.replace(/[^\d.,-]/g,'').replace(',','.'))
      if (isNaN(valor)) continue
      newItems.push({ id:`ex${Date.now()}-${Math.random()}`, contaId:selectedContaId, date:iso, historico:hist, valor })
    }
    setExtrato(p=>[...p, ...newItems])
    setImportText('')
    setShowImport(false)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <YearMonthPicker year={year} month={month} onChange={(y,m)=>{ setYear(y); setMonth(m) }}/>
        <button className="btn btn-primary btn-sm" onClick={openAddConta}><Plus size={14}/> Nova conta bancária</button>
      </div>

      {/* Contas bancárias cadastradas */}
      {contas.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:10 }}>
          {contas.map(c => (
            <div key={c.id} className="card" style={{ padding:'12px 16px', border: selectedContaId===c.id ? '2px solid var(--teal)' : '1px solid var(--border)', cursor:'pointer' }}
              onClick={()=>setSelectedContaId(c.id)}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <div>
                  <div style={{ fontWeight:700, color:'var(--text-primary)' }}>{c.banco}</div>
                  <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>Ag: {c.agencia} · CC: {c.conta}</div>
                  <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', textTransform:'capitalize' }}>{c.tipo}</div>
                </div>
                <div style={{ display:'flex', gap:4 }}>
                  <button className="btn btn-ghost btn-icon" style={{ padding:3 }} onClick={e=>{e.stopPropagation();openEditConta(c)}}><Edit2 size={12}/></button>
                  <button className="btn btn-ghost btn-icon" style={{ padding:3, color:'var(--danger)' }} onClick={e=>{e.stopPropagation();setDeleteContaTarget(c)}}><Trash2 size={12}/></button>
                </div>
              </div>
              {selectedContaId===c.id && (
                <div style={{ marginTop:4, fontSize:'0.75rem', color:'var(--teal)', fontWeight:600 }}>Conta selecionada</div>
              )}
            </div>
          ))}
        </div>
      )}

      {contas.length === 0 && (
        <div className="card" style={{ padding:'32px', textAlign:'center', color:'var(--text-muted)' }}>
          <Building2 size={32} style={{ marginBottom:8, opacity:0.4 }}/>
          <p>Nenhuma conta bancária cadastrada.<br/>Clique em "Nova conta bancária" para começar.</p>
        </div>
      )}

      {selectedContaId && (
        <>
          {/* Summary */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10 }}>
            {[
              { label:'Saldo contábil', val: saldoContabil, color: saldoContabil>=0?'#22c55e':'#ef4444' },
              { label:'Saldo bancário', val: saldoBancario, color: saldoBancario>=0?'#22c55e':'#ef4444' },
              { label:'Diferença',       val: saldoContabil-saldoBancario, color: Math.abs(saldoContabil-saldoBancario) < 0.01 ? '#22c55e' : '#f59e0b' },
            ].map(c=>(
              <div key={c.label} className="card" style={{ padding:'12px 16px' }}>
                <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:4 }}>{c.label}</div>
                <div style={{ fontWeight:700, color:c.color }}>{fmt(c.val)}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-outline btn-sm" onClick={()=>setShowImport(true)}>
              <FileText size={14}/> Importar extrato
            </button>
            <button className="btn btn-ghost btn-sm" onClick={()=>setExtrato(p=>p.filter(e=>e.contaId!==selectedContaId))}
              style={{ color:'var(--danger)' }}>
              Limpar extrato
            </button>
          </div>

          {showImport && (
            <div className="card" style={{ padding:'16px' }}>
              <p style={{ fontSize:'0.875rem', fontWeight:600, marginBottom:8 }}>
                Importar extrato (CSV)
              </p>
              <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:8 }}>
                Formato: data (dd/mm/aaaa), histórico, valor (positivo=entrada, negativo=saída). Separador: vírgula, ponto-e-vírgula ou tab.
              </p>
              <textarea className="form-input" rows={6} style={{ fontFamily:'monospace', fontSize:'0.8125rem' }}
                value={importText} onChange={e=>setImportText(e.target.value)}
                placeholder="01/05/2026;PIX recebido;500.00&#10;05/05/2026;Aluguel;-2000.00"/>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:10 }}>
                <button className="btn btn-ghost btn-sm" onClick={()=>setShowImport(false)}>Cancelar</button>
                <button className="btn btn-primary btn-sm" onClick={handleImport}>Importar</button>
              </div>
            </div>
          )}

          {/* Extrato */}
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ padding:'10px 16px', fontWeight:700, borderBottom:'1px solid var(--border)', color:'var(--text-primary)' }}>
              Extrato importado — {MONTHS_PT[month]} {year}
            </div>
            {extratoFiltrado.length === 0 ? (
              <div style={{ padding:'24px', textAlign:'center', color:'var(--text-muted)', fontSize:'0.875rem' }}>
                Nenhum lançamento importado para este período
              </div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid var(--border)', background:'var(--surface-2)' }}>
                    {['Data','Histórico','Valor'].map(h=>(
                      <th key={h} style={{ padding:'8px 12px', textAlign: h==='Valor'?'right':'left', color:'var(--text-muted)', fontWeight:700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {extratoFiltrado.map(e=>(
                    <tr key={e.id} style={{ borderBottom:'1px solid var(--border)' }}>
                      <td style={{ padding:'6px 12px', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{fmtDate(e.date)}</td>
                      <td style={{ padding:'6px 12px', color:'var(--text-primary)' }}>{e.historico}</td>
                      <td style={{ padding:'6px 12px', textAlign:'right', fontFamily:'monospace', fontWeight:600,
                        color: Number(e.valor)>=0 ? '#22c55e' : '#ef4444' }}>
                        {fmt(e.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Lancamentos contábeis do período */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'10px 16px', fontWeight:700, borderBottom:'1px solid var(--border)', color:'var(--text-primary)' }}>
          Lançamentos contábeis — {MONTHS_PT[month]} {year}
        </div>
        {movimentosPeriodo.length === 0 ? (
          <div style={{ padding:'24px', textAlign:'center', color:'var(--text-muted)', fontSize:'0.875rem' }}>
            Nenhum lançamento no período
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom:'2px solid var(--border)', background:'var(--surface-2)' }}>
                {['Data','Descrição','Tipo','Valor'].map(h=>(
                  <th key={h} style={{ padding:'8px 12px', textAlign:h==='Valor'?'right':'left', color:'var(--text-muted)', fontWeight:700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movimentosPeriodo.map(l=>(
                <tr key={l.id} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'6px 12px', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{fmtDate(l.date)}</td>
                  <td style={{ padding:'6px 12px', color:'var(--text-primary)' }}>{l.description || l.category}</td>
                  <td style={{ padding:'6px 12px' }}>
                    <span style={{ fontSize:'0.75rem', padding:'1px 8px', borderRadius:10, fontWeight:600,
                      background: l.type==='receita' ? '#dcfce7' : '#fee2e2',
                      color: l.type==='receita' ? '#166534' : '#991b1b' }}>
                      {l.type==='receita' ? 'Receita' : 'Despesa'}
                    </span>
                  </td>
                  <td style={{ padding:'6px 12px', textAlign:'right', fontFamily:'monospace',
                    color: l.type==='receita' ? '#22c55e' : '#ef4444' }}>{fmt(l.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showContaModal && (
        <Modal title={editConta?'Editar conta':'Nova conta bancária'} onClose={()=>setShowContaModal(false)}>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Banco</label>
                <input className="form-input" value={contaForm.banco} onChange={e=>setContaForm(f=>({...f,banco:e.target.value}))} placeholder="Ex: Banco do Brasil"/>
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Tipo</label>
                <select className="form-input" value={contaForm.tipo} onChange={e=>setContaForm(f=>({...f,tipo:e.target.value}))}>
                  <option value="corrente">Conta Corrente</option>
                  <option value="poupanca">Conta Poupança</option>
                  <option value="pix">Conta PIX</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Agência</label>
                <input className="form-input" value={contaForm.agencia} onChange={e=>setContaForm(f=>({...f,agencia:e.target.value}))} placeholder="0001"/>
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Conta</label>
                <input className="form-input" value={contaForm.conta} onChange={e=>setContaForm(f=>({...f,conta:e.target.value}))} placeholder="12345-6"/>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowContaModal(false)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={saveConta}><Save size={14}/> Salvar</button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmModal isOpen={!!deleteContaTarget} onClose={()=>setDeleteContaTarget(null)}
        onConfirm={()=>{ setContas(p=>p.filter(c=>c.id!==deleteContaTarget.id)); setDeleteContaTarget(null) }}
        message={`Excluir a conta "${deleteContaTarget?.banco} - ${deleteContaTarget?.conta}"?`}/>
    </div>
  )
}

// ── Tab: Impostos ─────────────────────────────────────────────────────────────

const SIMPLES_FAIXAS = [
  { ate:180000,  al:0.04,  desc:'até R$ 180 mil' },
  { ate:360000,  al:0.073, desc:'R$ 180k – R$ 360k' },
  { ate:720000,  al:0.095, desc:'R$ 360k – R$ 720k' },
  { ate:1800000, al:0.107, desc:'R$ 720k – R$ 1,8M' },
  { ate:3600000, al:0.143, desc:'R$ 1,8M – R$ 3,6M' },
  { ate:4800000, al:0.19,  desc:'R$ 3,6M – R$ 4,8M' },
]

function calcSimples(faturamentoAnual, receitaMes) {
  const faixa = SIMPLES_FAIXAS.find(f => faturamentoAnual <= f.ate) || SIMPLES_FAIXAS[SIMPLES_FAIXAS.length-1]
  return receitaMes * faixa.al
}

function Impostos() {
  const ym = nowYM()
  const [year, setYear]   = useState(ym.year)
  const [month, setMonth] = useState(ym.month)
  const [histPagos, setHistPagos] = usePersistentState('petvet-impostos-hist', [])
  const [faturamentoAnual, setFaturamentoAnual] = useState(360000)
  const fiscal = loadFiscal()

  const lancamentos = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('petvet-lancamentos')||'[]') } catch { return [] }
  }, [])

  const receitaMes = useMemo(() => {
    return lancamentos.filter(l => {
      const d = new Date(l.date+'T00:00')
      return d.getFullYear()===year && d.getMonth()===month && l.type==='receita' && l.status!=='cancelado'
    }).reduce((s,l)=>s+Number(l.value||0), 0)
  }, [lancamentos, year, month])

  const apuracao = useMemo(() => {
    const regime = fiscal.regimeTributario
    const alISS    = Number(fiscal.aliquotaISS   ||0)/100
    const alICMS   = Number(fiscal.aliquotaICMS  ||0)/100
    const alPIS    = Number(fiscal.aliquotaPIS   ||0)/100
    const alCOFINS = Number(fiscal.aliquotaCOFINS||0)/100
    const alCSLL   = Number(fiscal.aliquotaCSLL  ||0)/100
    const alIRPJ   = Number(fiscal.aliquotaIRPJ  ||0)/100

    if (regime === 'simples') {
      const das = calcSimples(faturamentoAnual, receitaMes)
      return [{ tributo:'DAS / Simples Nacional', base:receitaMes, aliquota:null, valor:das, vence:`20/${String(month+2).padStart(2,'0')}/${year}` }]
    }
    if (regime === 'mei') {
      return [{ tributo:'DASMEI (fixo mensal)', base:0, aliquota:null, valor:76.90, vence:`20/${String(month+2).padStart(2,'0')}/${year}` }]
    }
    if (regime === 'lucro_presumido') {
      const lucroPresumido = receitaMes * 0.32
      return [
        { tributo:'ISS',    base:receitaMes, aliquota:alISS*100,    valor:receitaMes*alISS,    vence:'Varia por município' },
        { tributo:'ICMS',   base:receitaMes, aliquota:alICMS*100,   valor:receitaMes*alICMS,   vence:'Dia 15 do mês seguinte' },
        { tributo:'PIS',    base:receitaMes, aliquota:alPIS*100,    valor:receitaMes*alPIS,    vence:'Último dia útil do mês' },
        { tributo:'COFINS', base:receitaMes, aliquota:alCOFINS*100, valor:receitaMes*alCOFINS, vence:'Último dia útil do mês' },
        { tributo:'CSLL',   base:lucroPresumido, aliquota:alCSLL*100, valor:lucroPresumido*alCSLL, vence:'Trimestral' },
        { tributo:'IRPJ',   base:lucroPresumido, aliquota:alIRPJ*100, valor:lucroPresumido*alIRPJ, vence:'Trimestral' },
      ]
    }
    // isento
    return [{ tributo:'Isento / Sem fins lucrativos', base:0, aliquota:null, valor:0, vence:'—' }]
  }, [fiscal, receitaMes, faturamentoAnual, year, month])

  const totalImpostos = apuracao.reduce((s,a)=>s+a.valor, 0)
  const jaKey = `${year}-${String(month).padStart(2,'0')}`
  const pago = histPagos.find(h=>h.periodo===jaKey)

  function marcarPago() {
    if (pago) {
      setHistPagos(p=>p.filter(h=>h.periodo!==jaKey))
    } else {
      setHistPagos(p=>[...p, { periodo:jaKey, mes:MONTHS_PT[month], ano:year, valor:totalImpostos, dataPagamento:todayISO() }])
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <YearMonthPicker year={year} month={month} onChange={(y,m)=>{ setYear(y); setMonth(m) }}/>
        {fiscal.regimeTributario === 'simples' && (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <label className="form-label" style={{ marginBottom:0, whiteSpace:'nowrap' }}>Faturamento anual (R$):</label>
            <input type="number" className="form-input" style={{ width:140 }} value={faturamentoAnual}
              onChange={e=>setFaturamentoAnual(Number(e.target.value))} placeholder="360000"/>
          </div>
        )}
      </div>

      {/* Regime info */}
      <div style={{ padding:'10px 14px', background:'var(--teal-light)', border:'1px solid var(--teal)', borderRadius:8, fontSize:'0.8125rem', color:'var(--teal-dark)' }}>
        <strong>Regime tributário:</strong> {
          { simples:'Simples Nacional', mei:'MEI', lucro_presumido:'Lucro Presumido', lucro_real:'Lucro Real', isento:'Isento' }[fiscal.regimeTributario] || fiscal.regimeTributario
        } · Receita do mês: {fmt(receitaMes)}
      </div>

      {/* Apuração */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'10px 16px', fontWeight:700, borderBottom:'1px solid var(--border)', color:'var(--text-primary)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          Apuração — {MONTHS_PT[month]} {year}
          <button
            className={`btn btn-sm ${pago ? 'btn-outline' : 'btn-primary'}`}
            onClick={marcarPago}
            style={{ fontSize:'0.75rem', display:'flex', alignItems:'center', gap:6 }}>
            {pago ? <><X size={13}/> Desfazer pago</> : <><Check size={13}/> Marcar como pago</>}
          </button>
        </div>
        {pago && (
          <div style={{ padding:'8px 16px', background:'#dcfce7', borderBottom:'1px solid #86efac', fontSize:'0.8125rem', color:'#166534', display:'flex', alignItems:'center', gap:6 }}>
            <Check size={14}/> Impostos pagos em {fmtDate(pago.dataPagamento)}
          </div>
        )}
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.875rem' }}>
          <thead>
            <tr style={{ borderBottom:'2px solid var(--border)', background:'var(--surface-2)' }}>
              {['Tributo','Base de cálculo','Alíquota','Valor','Vencimento'].map(h=>(
                <th key={h} style={{ padding:'8px 12px', textAlign: h==='Tributo'||h==='Vencimento'?'left':'right', color:'var(--text-muted)', fontWeight:700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {apuracao.map((a,i)=>(
              <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                <td style={{ padding:'8px 12px', fontWeight:600, color:'var(--text-primary)' }}>{a.tributo}</td>
                <td style={{ padding:'8px 12px', textAlign:'right', fontFamily:'monospace', color:'var(--text-muted)' }}>
                  {a.base > 0 ? fmt(a.base) : '—'}
                </td>
                <td style={{ padding:'8px 12px', textAlign:'right', color:'var(--text-muted)' }}>
                  {a.aliquota != null ? `${a.aliquota.toFixed(2)}%` : '—'}
                </td>
                <td style={{ padding:'8px 12px', textAlign:'right', fontFamily:'monospace', fontWeight:700, color:'#ef4444' }}>
                  {a.valor > 0 ? fmt(a.valor) : '—'}
                </td>
                <td style={{ padding:'8px 12px', color:'var(--text-muted)', fontSize:'0.8125rem' }}>{a.vence}</td>
              </tr>
            ))}
            <tr style={{ borderTop:'2px solid var(--border)', background:'var(--surface-2)' }}>
              <td colSpan={3} style={{ padding:'8px 12px', fontWeight:700 }}>TOTAL</td>
              <td style={{ padding:'8px 12px', textAlign:'right', fontFamily:'monospace', fontWeight:700, color:'#ef4444' }}>{fmt(totalImpostos)}</td>
              <td/>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Tabela Simples Nacional */}
      {fiscal.regimeTributario === 'simples' && (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'10px 16px', fontWeight:700, borderBottom:'1px solid var(--border)', color:'var(--text-primary)' }}>
            Tabela Simples Nacional 2024 — Anexo III (Serviços)
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom:'2px solid var(--border)', background:'var(--surface-2)' }}>
                {['Faixa de receita bruta anual','Alíquota efetiva'].map(h=>(
                  <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'var(--text-muted)', fontWeight:700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SIMPLES_FAIXAS.map((f,i)=>{
                const ativa = faturamentoAnual <= f.ate && (i===0 || faturamentoAnual > SIMPLES_FAIXAS[i-1].ate)
                return (
                  <tr key={i} style={{ borderBottom:'1px solid var(--border)', background: ativa ? 'var(--teal-light)' : 'transparent' }}>
                    <td style={{ padding:'6px 12px', color: ativa ? 'var(--teal-dark)' : 'var(--text-primary)', fontWeight: ativa ? 700 : 400 }}>{f.desc}{ativa ? ' ← atual' : ''}</td>
                    <td style={{ padding:'6px 12px', fontWeight: ativa ? 700 : 400, color: ativa ? 'var(--teal-dark)' : 'var(--text-primary)' }}>{(f.al*100).toFixed(1)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Histórico */}
      {histPagos.length > 0 && (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'10px 16px', fontWeight:700, borderBottom:'1px solid var(--border)', color:'var(--text-primary)' }}>Histórico de pagamentos</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom:'2px solid var(--border)', background:'var(--surface-2)' }}>
                {['Período','Data de pagamento','Valor total'].map(h=>(
                  <th key={h} style={{ padding:'8px 12px', textAlign: h==='Valor total'?'right':'left', color:'var(--text-muted)', fontWeight:700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...histPagos].sort((a,b)=>b.periodo.localeCompare(a.periodo)).map((h,i)=>(
                <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'6px 12px', color:'var(--text-primary)' }}>{h.mes} {h.ano}</td>
                  <td style={{ padding:'6px 12px', color:'var(--text-muted)' }}>{fmtDate(h.dataPagamento)}</td>
                  <td style={{ padding:'6px 12px', textAlign:'right', fontFamily:'monospace', fontWeight:600, color:'#ef4444' }}>{fmt(h.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Tab: Relatório Contador ───────────────────────────────────────────────────

function RelatorioContador() {
  const ym = nowYM()
  const [year, setYear]   = useState(ym.year)
  const [month, setMonth] = useState(ym.month)
  const [numContador, setNumContador] = useState(() => {
    try { return JSON.parse(localStorage.getItem('petvet-config-fiscal')||'{}').numContador || '' } catch { return '' } })
  const [historico, setHistorico] = usePersistentState('petvet-relatorio-contador-hist', [])

  const lancamentos = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('petvet-lancamentos')||'[]') } catch { return [] }
  }, [])
  const fiscal = loadFiscal()

  const periodo = lancamentos.filter(l => {
    const d = new Date(l.date+'T00:00')
    return d.getFullYear()===year && d.getMonth()===month && l.status!=='cancelado'
  })

  const recTotal  = periodo.filter(l=>l.type==='receita').reduce((s,l)=>s+Number(l.value||0),0)
  const despTotal = periodo.filter(l=>l.type==='despesa').reduce((s,l)=>s+Number(l.value||0),0)

  const recPorCat = {}
  const despPorCat = {}
  for (const l of periodo) {
    if (l.type==='receita') recPorCat[l.category]  = (recPorCat[l.category] ||0)+Number(l.value||0)
    else                     despPorCat[l.category] = (despPorCat[l.category]||0)+Number(l.value||0)
  }

  function buildTextoRelatorio() {
    let identidade = {}
    try { identidade = JSON.parse(localStorage.getItem('petvet-identidade')||'{}') } catch {}
    const clinica = identidade.nomeP || 'Clínica PetVet'
    const m = MONTHS_PT[month]
    const lines = [
      `RELATÓRIO MENSAL PARA CONTADOR`,
      `${clinica}`,
      `Período: ${m} ${year}`,
      `CNPJ: ${fiscal.cnpj || 'Não informado'}`,
      `Regime: ${{ simples:'Simples Nacional', mei:'MEI', lucro_presumido:'Lucro Presumido', lucro_real:'Lucro Real', isento:'Isento' }[fiscal.regimeTributario] || fiscal.regimeTributario}`,
      ``,
      `──────────────────────────────────`,
      `FATURAMENTO POR CATEGORIA`,
      `──────────────────────────────────`,
      ...Object.entries(recPorCat).map(([c,v]) => `${c.padEnd(24)} R$ ${v.toFixed(2)}`),
      `${'TOTAL RECEITAS'.padEnd(24)} R$ ${recTotal.toFixed(2)}`,
      ``,
      `──────────────────────────────────`,
      `DESPESAS POR CATEGORIA`,
      `──────────────────────────────────`,
      ...Object.entries(despPorCat).map(([c,v]) => `${c.padEnd(24)} R$ ${v.toFixed(2)}`),
      `${'TOTAL DESPESAS'.padEnd(24)} R$ ${despTotal.toFixed(2)}`,
      ``,
      `──────────────────────────────────`,
      `RESUMO`,
      `──────────────────────────────────`,
      `Receita bruta:             R$ ${recTotal.toFixed(2)}`,
      `Despesas totais:           R$ ${despTotal.toFixed(2)}`,
      `Resultado:                 R$ ${(recTotal-despTotal).toFixed(2)}`,
      ``,
      `Relatório gerado em ${new Date().toLocaleDateString('pt-BR')} via sistema PetVet.`,
    ]
    return lines.join('\n')
  }

  function handleGerar() {
    const texto = buildTextoRelatorio()
    const blob = new Blob([texto], { type:'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-contador-${year}-${String(month+1).padStart(2,'0')}.txt`
    a.click()
    URL.revokeObjectURL(url)
    const hist = { id:`rc${Date.now()}`, periodo:`${MONTHS_PT[month]} ${year}`, geradoEm:new Date().toISOString(), recTotal, despTotal }
    setHistorico(p=>[hist, ...p.slice(0,19)])
  }

  function handleWhatsApp() {
    if (!numContador) { alert('Informe o número do contador'); return }
    const texto = buildTextoRelatorio()
    const digits = numContador.replace(/\D/g,'')
    const phone = digits.startsWith('55') && digits.length >= 12 ? digits : '55'+digits
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(texto)}`, '_blank')
    const hist = { id:`rc${Date.now()}`, periodo:`${MONTHS_PT[month]} ${year}`, geradoEm:new Date().toISOString(), enviadoWhats:true, recTotal, despTotal }
    setHistorico(p=>[hist, ...p.slice(0,19)])
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <YearMonthPicker year={year} month={month} onChange={(y,m)=>{ setYear(y); setMonth(m) }}/>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <label className="form-label" style={{ marginBottom:0, whiteSpace:'nowrap' }}>WhatsApp contador:</label>
          <input className="form-input" style={{ width:180 }} value={numContador} placeholder="(11) 99999-9999"
            onChange={e => {
              const v = e.target.value
              setNumContador(v)
              try {
                const cfg = JSON.parse(localStorage.getItem('petvet-config-fiscal')||'{}')
                localStorage.setItem('petvet-config-fiscal', JSON.stringify({...cfg, numContador:v}))
              } catch {}
            }}
          />
        </div>
      </div>

      {/* Preview */}
      <div className="card" style={{ padding:'16px' }}>
        <pre style={{ fontSize:'0.8125rem', fontFamily:'monospace', color:'var(--text-primary)', whiteSpace:'pre-wrap', lineHeight:1.7, margin:0 }}>
          {buildTextoRelatorio()}
        </pre>
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <button className="btn btn-primary" onClick={handleGerar}>
          <Download size={16}/> Gerar relatório {MONTHS_PT[month]}/{year}
        </button>
        <button className="btn btn-outline" onClick={handleWhatsApp}>
          <MessageCircle size={16}/> Enviar por WhatsApp
        </button>
        <button className="btn btn-outline btn-sm" onClick={() =>
          exportCSV(`relatorio-contador-${year}-${String(month+1).padStart(2,'0')}`,
            ['Categoria','Tipo','Valor'],
            [
              ...Object.entries(recPorCat).map(([c,v])=>[c,'Receita',v.toFixed(2)]),
              ...Object.entries(despPorCat).map(([c,v])=>[c,'Despesa',v.toFixed(2)]),
            ]
          )
        }><Download size={14}/> CSV</button>
      </div>

      {/* Histórico */}
      {historico.length > 0 && (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'10px 16px', fontWeight:700, borderBottom:'1px solid var(--border)', color:'var(--text-primary)' }}>Histórico de relatórios</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom:'2px solid var(--border)', background:'var(--surface-2)' }}>
                {['Período','Gerado em','Receitas','Despesas','Canal'].map(h=>(
                  <th key={h} style={{ padding:'8px 12px', textAlign: ['Receitas','Despesas'].includes(h)?'right':'left', color:'var(--text-muted)', fontWeight:700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historico.map(h=>(
                <tr key={h.id} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'6px 12px', color:'var(--text-primary)', fontWeight:600 }}>{h.periodo}</td>
                  <td style={{ padding:'6px 12px', color:'var(--text-muted)' }}>{h.geradoEm ? new Date(h.geradoEm).toLocaleString('pt-BR') : '—'}</td>
                  <td style={{ padding:'6px 12px', textAlign:'right', fontFamily:'monospace', color:'#22c55e' }}>{fmt(h.recTotal)}</td>
                  <td style={{ padding:'6px 12px', textAlign:'right', fontFamily:'monospace', color:'#ef4444' }}>{fmt(h.despTotal)}</td>
                  <td style={{ padding:'6px 12px', color:'var(--text-muted)' }}>{h.enviadoWhats ? 'WhatsApp' : 'Download'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS = [
  { id:'plano-contas',   label:'Plano de Contas',      icon:<BookOpen size={15}/> },
  { id:'livro-caixa',    label:'Livro Caixa',           icon:<ReceiptText size={15}/> },
  { id:'dre',            label:'DRE',                   icon:<TrendingUp size={15}/> },
  { id:'centro-custos',  label:'Centro de Custos',      icon:<Layers size={15}/> },
  { id:'conciliacao',    label:'Conciliação Bancária',  icon:<Building2 size={15}/> },
  { id:'impostos',       label:'Impostos',              icon:<Percent size={15}/> },
  { id:'relatorio',      label:'Relatório Contador',    icon:<FileText size={15}/> },
]

export default function ContabilidadePage() {
  const [activeTab, setActiveTab] = useState('plano-contas')

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Contabilidade</h2>
          <p className="page-subtitle">Gestão contábil e fiscal</p>
        </div>
      </div>

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <div style={{ marginTop:16 }}>
        {activeTab === 'plano-contas'  && <PlanoContas />}
        {activeTab === 'livro-caixa'   && <LivroCaixa />}
        {activeTab === 'dre'           && <DRE />}
        {activeTab === 'centro-custos' && <CentroCustos />}
        {activeTab === 'conciliacao'   && <ConciliacaoBancaria />}
        {activeTab === 'impostos'      && <Impostos />}
        {activeTab === 'relatorio'     && <RelatorioContador />}
      </div>
    </div>
  )
}
