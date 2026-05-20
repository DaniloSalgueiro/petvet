import { useState, useMemo } from 'react'
import {
  Users, FileText, Calendar, Package, Home,
  DollarSign, Briefcase, TrendingUp, Printer, Download, ChevronLeft,
} from 'lucide-react'
import {
  PETS as PD, TUTORES as TD, VETS,
  PRONTUARIOS as PRD, AGENDAMENTOS as AGD,
  HOSPEDAGENS as HD, PRODUTOS as PROD,
  LANCAMENTOS as LD,
} from '../data/mock'
import { useAuth } from '../context/AuthContext'
import { normIncludes } from '../utils/normalizeText'

function usePersistentState(key, def) {
  const [v, setV] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def } catch { return def }
  })
  const set = nv => {
    const next = typeof nv === 'function' ? nv(v) : nv
    setV(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch {}
  }
  return [v, set]
}

function useFilters(id, defs) {
  const key = `petvet-rfilters-${id}`
  const [f, setF] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? { ...defs, ...JSON.parse(s) } : defs } catch { return defs }
  })
  const set = (k, val) => setF(prev => {
    const next = { ...prev, [k]: val }
    try { localStorage.setItem(key, JSON.stringify(next)) } catch {}
    return next
  })
  return [f, set]
}

const R = v => `R$ ${Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtD = d => { if (!d) return '—'; try { return new Date(d + 'T12:00').toLocaleDateString('pt-BR') } catch { return d } }
const today = () => new Date().toISOString().slice(0, 10)
const thisMonth = () => new Date().toISOString().slice(0, 7)
const thisYear = () => String(new Date().getFullYear())
const MES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const TYPE_LBL = { consulta:'Consulta', retorno:'Retorno', banho:'Banho & Tosa', cirurgia:'Cirurgia', vacina:'Vacina', outro:'Outro' }
const STATUS_LBL = { agendado:'Agendado', confirmado:'Confirmado', 'em-atendimento':'Em Atendimento', concluido:'Concluído', cancelado:'Cancelado' }

function printReport(title, html) {
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>
body{font-family:Arial,sans-serif;padding:20px;font-size:12px}@page{size:A4;margin:15mm}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}
th{background:#f5f5f5;font-weight:bold}h1{font-size:15px;margin-bottom:4px}.meta{color:#888;font-size:11px;margin-bottom:12px}
</style></head><body><h1>${title}</h1><div class="meta">Emitido em: ${new Date().toLocaleString('pt-BR')}</div>${html}</body></html>`)
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300)
}

function exportCSV(filename, headers, rows) {
  const bom = '﻿'
  const lines = [headers.join(';'), ...rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))]
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename + '.csv'; a.click()
  URL.revokeObjectURL(url)
}

function Tbl({ heads, rows, empty = 'Nenhum resultado.' }) {
  if (!rows.length) return <p style={{ textAlign:'center', color:'var(--text-secondary)', padding:24 }}>{empty}</p>
  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.875rem' }}>
        <thead>
          <tr style={{ borderBottom:'2px solid var(--border)' }}>
            {heads.map(h => <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontWeight:600, color:'var(--text-secondary)', fontSize:'0.78rem', textTransform:'uppercase', letterSpacing:'0.04em' }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom:'1px solid var(--border)', background: i%2 ? 'var(--bg-secondary,#fafafa)' : 'transparent' }}>
              {row.map((c, j) => <td key={j} style={{ padding:'8px 12px' }}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ActBar({ count, onPrint, onCSV }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
      <span style={{ fontSize:'0.85rem', color:'var(--text-secondary)' }}>{count} resultado{count !== 1 ? 's' : ''}</span>
      <div style={{ display:'flex', gap:8 }}>
        <button className="btn btn-ghost btn-sm" onClick={onPrint} style={{ display:'flex', alignItems:'center', gap:5 }}><Printer size={14}/>Imprimir</button>
        <button className="btn btn-ghost btn-sm" onClick={onCSV} style={{ display:'flex', alignItems:'center', gap:5 }}><Download size={14}/>CSV</button>
      </div>
    </div>
  )
}

function Fil({ children }) {
  return <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16, padding:'12px 16px', background:'var(--bg-secondary,#f8f9fa)', borderRadius:8, alignItems:'flex-end' }}>{children}</div>
}

function Inp({ label, style: s, ...props }) {
  return (
    <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'0.8rem', color:'var(--text-secondary)', fontWeight:500 }}>
      {label}
      <input className="input input-sm" style={{ minWidth:140, ...s }} {...props} />
    </label>
  )
}

function Sel({ label, children, ...props }) {
  return (
    <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'0.8rem', color:'var(--text-secondary)', fontWeight:500 }}>
      {label}
      <select className="input input-sm" style={{ minWidth:140 }} {...props}>{children}</select>
    </label>
  )
}

function BarChart({ data, color = '#2196F3' }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ overflowX:'auto', padding:'8px 0' }}>
      <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:200, minWidth: data.length * 44 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, minWidth:36 }}>
            <div style={{ fontSize:'0.75rem', fontWeight:600, color:'#444' }}>{d.value}</div>
            <div style={{ width:'100%', background:color, borderRadius:'4px 4px 0 0', height: Math.max((d.value/max)*150, d.value>0?4:0) }} />
            <div style={{ fontSize:'0.7rem', color:'var(--text-secondary)', whiteSpace:'nowrap' }}>{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCards({ items }) {
  return (
    <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:16 }}>
      {items.map(s => (
        <div key={s.label} style={{ background: s.highlight ? '#4CAF50' : 'var(--bg-secondary,#f5f5f5)', color: s.highlight ? '#fff' : 'inherit', borderRadius:10, padding:'16px 24px', minWidth:140 }}>
          <div style={{ fontSize:'0.8rem', opacity:0.8 }}>{s.label}</div>
          <div style={{ fontSize:'1.5rem', fontWeight:700 }}>{s.value}</div>
        </div>
      ))}
    </div>
  )
}

// ── categories + report metadata ─────────────────────────────────────────────

const CATEGORIES = [
  { id:'pets-tutores', label:'Pets & Tutores',    icon:Users,      color:'#4CAF50', bg:'#e8f5e9' },
  { id:'prontuarios',  label:'Prontuários',        icon:FileText,   color:'#2196F3', bg:'#e3f2fd' },
  { id:'agenda',       label:'Agenda',              icon:Calendar,   color:'#FF9800', bg:'#fff3e0' },
  { id:'estoque',      label:'Estoque',             icon:Package,    color:'#9C27B0', bg:'#f3e5f5' },
  { id:'hospedagem',   label:'Hospedagem',          icon:Home,       color:'#00BCD4', bg:'#e0f7fa' },
  { id:'financeiro',   label:'Financeiro & PDV',    icon:DollarSign, color:'#E91E63', bg:'#fce4ec', adminOnly:true },
  { id:'funcionarios', label:'Funcionários',        icon:Briefcase,  color:'#795548', bg:'#efebe9', adminOnly:true },
  { id:'indicadores',  label:'Indicadores Gerais',  icon:TrendingUp, color:'#607D8B', bg:'#eceff1' },
]

const RMETA = {
  'pets-tutores': [
    { id:'lista-tutores',    label:'Lista de Tutores',          desc:'Todos os tutores cadastrados' },
    { id:'lista-pets',       label:'Lista de Pets',             desc:'Todos os pets por espécie e tutor' },
    { id:'retorno-pendente', label:'Retorno Pendente',          desc:'Pets com consulta de retorno a vencer' },
    { id:'aniversariantes',  label:'Aniversariantes',           desc:'Pets que fazem aniversário no mês' },
  ],
  'prontuarios': [
    { id:'pront-por-pet',     label:'Por Pet',                   desc:'Histórico de prontuários de um pet' },
    { id:'pront-por-tutor',   label:'Por Tutor',                 desc:'Prontuários agrupados por tutor' },
    { id:'pront-por-vet',     label:'Por Veterinário',           desc:'Atendimentos por veterinário' },
    { id:'pront-por-periodo', label:'Por Período',               desc:'Prontuários em um intervalo de datas' },
    { id:'pront-por-tipo',    label:'Por Diagnóstico / Queixa',  desc:'Busca por texto em diagnóstico' },
  ],
  'agenda': [
    { id:'agenda-dia',    label:'Agenda do Dia',       desc:'Todos os agendamentos de uma data' },
    { id:'agenda-mes',    label:'Agenda do Mês',       desc:'Agendamentos de um mês específico' },
    { id:'agenda-ano',    label:'Resumo Anual',        desc:'Gráfico de atendimentos por mês' },
    { id:'taxa-ocupacao', label:'Taxa de Ocupação',    desc:'Ocupação da agenda no período' },
    { id:'agenda-status', label:'Por Status',          desc:'Agendamentos filtrados por status' },
  ],
  'estoque': [
    { id:'estoque-total',     label:'Estoque Total',        desc:'Todos os produtos com saldos atuais' },
    { id:'produtos-vencidos', label:'Produtos Vencidos',    desc:'Produtos com validade expirada' },
    { id:'produtos-a-vencer', label:'A Vencer',             desc:'Produtos próximos do vencimento' },
    { id:'estoque-minimo',    label:'Abaixo do Mínimo',     desc:'Produtos com estoque crítico' },
    { id:'movimentacao',      label:'Movimentação',         desc:'Despesas de estoque por período' },
  ],
  'hospedagem': [
    { id:'hosp-dia',     label:'Ativas Hoje',    desc:'Hospedagens em andamento hoje' },
    { id:'hosp-mes',     label:'Do Mês',         desc:'Hospedagens de um mês específico' },
    { id:'hosp-ano',     label:'Resumo Anual',   desc:'Receita de hospedagem por mês' },
    { id:'hosp-por-pet', label:'Por Pet',        desc:'Histórico de hospedagens de um pet' },
  ],
  'financeiro': [
    { id:'fin-periodo',       label:'Receitas e Despesas',    desc:'Fluxo financeiro por período' },
    { id:'dre-mensal',        label:'DRE Mensal',             desc:'Demonstração de resultados do mês' },
    { id:'pdv-periodo',       label:'Vendas PDV',             desc:'Vendas do ponto de venda no período' },
    { id:'produtos-vendidos', label:'Produtos Mais Vendidos', desc:'Ranking de produtos pelo PDV' },
    { id:'comissoes',         label:'Comissões',              desc:'Comissões estimadas por veterinário' },
    { id:'inadimplencia',     label:'Inadimplência',          desc:'Lançamentos com pagamento pendente' },
  ],
  'funcionarios': [
    { id:'folha-pagamento', label:'Folha de Pagamento',      desc:'Resumo da folha em um mês/ano' },
    { id:'hist-pagamentos', label:'Histórico de Pagamentos', desc:'Pagamentos realizados por funcionário' },
  ],
  'indicadores': [
    { id:'ticket-medio',   label:'Ticket Médio',               desc:'Ticket médio por período' },
    { id:'servicos-top',   label:'Serviços Mais Realizados',   desc:'Ranking de tipos de atendimento' },
    { id:'vet-top',        label:'Performance por Veterinário', desc:'Atendimentos e receita por vet' },
    { id:'novos-pets-mes', label:'Novos Pets por Mês',         desc:'Gráfico de primeiros atendimentos' },
    { id:'taxa-retorno',   label:'Taxa de Retorno',            desc:'Percentual de pets com retorno' },
  ],
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const { hasRole } = useAuth()
  const [cat, setCat] = useState(null)
  const [rep, setRep] = useState(null)

  const [pets]         = usePersistentState('petvet-pets', PD)
  const [tutores]      = usePersistentState('petvet-tutores', TD)
  const [prontuarios]  = usePersistentState('petvet-prontuarios', PRD)
  const [agendamentos] = usePersistentState('petvet-agendamentos', AGD)
  const [produtos]     = usePersistentState('petvet-produtos', PROD)
  const [lancamentos]  = usePersistentState('petvet-lancamentos', LD)
  const [vendas]       = usePersistentState('petvet-vendas', [])
  const [funcionarios] = usePersistentState('petvet-funcionarios', [])
  const [pagamentos]   = usePersistentState('petvet-func-pagamentos', [])
  const [hospedagens]  = usePersistentState('petvet-hospedagens', HD)
  const allData = { pets, tutores, prontuarios, agendamentos, produtos, lancamentos, vendas, funcionarios, pagamentos, hospedagens }

  const cats = CATEGORIES.filter(c => !c.adminOnly || hasRole('admin'))
  const catObj = CATEGORIES.find(c => c.id === cat)

  function back() { rep ? setRep(null) : setCat(null) }

  const titleParts = ['Relatórios', catObj?.label, rep ? RMETA[cat]?.find(r => r.id === rep)?.label : null].filter(Boolean)

  return (
    <div style={{ padding:'24px', maxWidth:1200 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        {cat && (
          <button className="btn btn-ghost btn-sm" onClick={back} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <ChevronLeft size={16}/>Voltar
          </button>
        )}
        <h1 style={{ margin:0, fontSize:'1.4rem', fontWeight:700 }}>{titleParts.join(' › ')}</h1>
      </div>

      {!cat && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:16 }}>
          {cats.map(c => {
            const Icon = c.icon
            const n = RMETA[c.id]?.length ?? 0
            return (
              <button key={c.id} onClick={() => { setCat(c.id); setRep(null) }}
                style={{ background:c.bg, border:`2px solid ${c.color}30`, borderRadius:12, padding:'20px 16px', cursor:'pointer', textAlign:'left', transition:'transform 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}
              >
                <div style={{ width:40, height:40, borderRadius:10, background:c.color, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}>
                  <Icon size={20} color="#fff"/>
                </div>
                <div style={{ fontWeight:700, fontSize:'0.95rem' }}>{c.label}</div>
                <div style={{ fontSize:'0.8rem', color:'#888', marginTop:4 }}>{n} relatório{n!==1?'s':''}</div>
              </button>
            )
          })}
        </div>
      )}

      {cat && !rep && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
          {RMETA[cat]?.map(r => (
            <button key={r.id} onClick={() => setRep(r.id)}
              style={{ background:'var(--card-bg,white)', border:'1px solid var(--border)', borderRadius:10, padding:'16px 18px', cursor:'pointer', textAlign:'left', borderLeft:`4px solid ${catObj?.color}`, transition:'box-shadow 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow='none'}
            >
              <div style={{ fontWeight:600, marginBottom:4 }}>{r.label}</div>
              <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)' }}>{r.desc}</div>
            </button>
          ))}
        </div>
      )}

      {rep && <ReportView id={rep} data={allData} />}
    </div>
  )
}

// ── report router ─────────────────────────────────────────────────────────────

function ReportView({ id, data }) {
  const { pets, tutores, prontuarios, agendamentos, produtos, lancamentos, vendas, funcionarios, pagamentos, hospedagens } = data
  switch (id) {
    case 'lista-tutores':    return <RListaTutores tutores={tutores} pets={pets} />
    case 'lista-pets':       return <RListaPets pets={pets} tutores={tutores} />
    case 'retorno-pendente': return <RRetornoPendente prontuarios={prontuarios} pets={pets} tutores={tutores} />
    case 'aniversariantes':  return <RAniversariantes pets={pets} tutores={tutores} />
    case 'pront-por-pet':    return <RProntPorPet prontuarios={prontuarios} pets={pets} />
    case 'pront-por-tutor':  return <RProntPorTutor prontuarios={prontuarios} pets={pets} tutores={tutores} />
    case 'pront-por-vet':    return <RProntPorVet prontuarios={prontuarios} pets={pets} tutores={tutores} />
    case 'pront-por-periodo':return <RProntPorPeriodo prontuarios={prontuarios} pets={pets} tutores={tutores} />
    case 'pront-por-tipo':   return <RProntPorTipo prontuarios={prontuarios} pets={pets} tutores={tutores} />
    case 'agenda-dia':       return <RAgendaDia agendamentos={agendamentos} pets={pets} tutores={tutores} />
    case 'agenda-mes':       return <RAgendaMes agendamentos={agendamentos} pets={pets} tutores={tutores} />
    case 'agenda-ano':       return <RAgendaAno agendamentos={agendamentos} />
    case 'taxa-ocupacao':    return <RTaxaOcupacao agendamentos={agendamentos} />
    case 'agenda-status':    return <RAgendaStatus agendamentos={agendamentos} pets={pets} tutores={tutores} />
    case 'estoque-total':    return <REstoqueTotal produtos={produtos} />
    case 'produtos-vencidos':return <RProdutosVencidos produtos={produtos} />
    case 'produtos-a-vencer':return <RProdutosAVencer produtos={produtos} />
    case 'estoque-minimo':   return <REstoqueMinimo produtos={produtos} />
    case 'movimentacao':     return <RMovimentacao lancamentos={lancamentos} />
    case 'hosp-dia':         return <RHospDia hospedagens={hospedagens} pets={pets} tutores={tutores} />
    case 'hosp-mes':         return <RHospMes hospedagens={hospedagens} pets={pets} tutores={tutores} />
    case 'hosp-ano':         return <RHospAno hospedagens={hospedagens} />
    case 'hosp-por-pet':     return <RHospPorPet hospedagens={hospedagens} pets={pets} tutores={tutores} />
    case 'fin-periodo':      return <RFinPeriodo lancamentos={lancamentos} />
    case 'dre-mensal':       return <RDRE lancamentos={lancamentos} />
    case 'pdv-periodo':      return <RPDVPeriodo vendas={vendas} />
    case 'produtos-vendidos':return <RProdutosVendidos vendas={vendas} />
    case 'comissoes':        return <RComissoes lancamentos={lancamentos} />
    case 'inadimplencia':    return <RInadimplencia lancamentos={lancamentos} />
    case 'folha-pagamento':  return <RFolha pagamentos={pagamentos} funcionarios={funcionarios} />
    case 'hist-pagamentos':  return <RHistPagamentos pagamentos={pagamentos} funcionarios={funcionarios} />
    case 'ticket-medio':     return <RTicketMedio lancamentos={lancamentos} vendas={vendas} />
    case 'servicos-top':     return <RServicosTop agendamentos={agendamentos} />
    case 'vet-top':          return <RVetTop agendamentos={agendamentos} prontuarios={prontuarios} lancamentos={lancamentos} />
    case 'novos-pets-mes':   return <RNovosPetsMes agendamentos={agendamentos} />
    case 'taxa-retorno':     return <RTaxaRetorno prontuarios={prontuarios} />
    default: return null
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function toPet(pets, id) { return pets.find(p => p.id === id) }
function toTutor(tutores, id) { return tutores.find(t => t.id === id) }
function toVet(id) { return VETS.find(v => v.id === id) }
function calcDiarias(h) {
  const ci = new Date(h.checkIn + 'T12:00'), co = new Date(h.checkOut + 'T12:00')
  return Math.max(1, Math.round((co - ci) / 86400000))
}
function vendaDate(v) {
  try { const [d, m, y] = v.date.split('/'); return `${y}-${m}-${d}` } catch { return v.date }
}
function tblHtml(heads, rows) {
  return `<table><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`
}

// ── Pets & Tutores ────────────────────────────────────────────────────────────

function RListaTutores({ tutores, pets }) {
  const [f, set] = useFilters('lista-tutores', { q:'' })
  const rows = useMemo(() => tutores.filter(t => normIncludes(t.name, f.q) || normIncludes(t.cpf, f.q)), [tutores, f])
  const heads = ['Nome','CPF','Telefone','E-mail','Pets','Endereço']
  const tblRows = rows.map(t => [t.name, t.cpf, t.phone, t.email, pets.filter(p=>p.tutorId===t.id).map(p=>p.name).join(', ')||'—', t.address||'—'])
  return <>
    <Fil><Inp label="Buscar nome ou CPF" value={f.q} onChange={e=>set('q',e.target.value)} placeholder="Digite..."/></Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Lista de Tutores', tblHtml(heads,tblRows))} onCSV={()=>exportCSV('lista-tutores',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows}/>
  </>
}

function RListaPets({ pets, tutores }) {
  const [f, set] = useFilters('lista-pets', { q:'', especie:'', tutorId:'' })
  const rows = useMemo(() => pets.filter(p =>
    (normIncludes(p.name, f.q) || normIncludes(p.breed, f.q)) &&
    (!f.especie || p.species === f.especie) && (!f.tutorId || p.tutorId === f.tutorId)
  ), [pets, f])
  const especies = [...new Set(pets.map(p => p.species))]
  const heads = ['Pet','Espécie','Raça','Sexo','Tutor','Nascimento','Vacinação','Vermifugação']
  const tblRows = rows.map(p => [p.name, p.species, p.breed, p.sex==='M'?'Macho':'Fêmea', toTutor(tutores,p.tutorId)?.name??'—', fmtD(p.birthDate), p.vacinacao, p.vermifugacao])
  return <>
    <Fil>
      <Inp label="Buscar nome ou raça" value={f.q} onChange={e=>set('q',e.target.value)} placeholder="Nome ou raça"/>
      <Sel label="Espécie" value={f.especie} onChange={e=>set('especie',e.target.value)}>
        <option value="">Todas</option>
        {especies.map(e=><option key={e} value={e}>{e}</option>)}
      </Sel>
      <Sel label="Tutor" value={f.tutorId} onChange={e=>set('tutorId',e.target.value)}>
        <option value="">Todos</option>
        {tutores.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
      </Sel>
    </Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Lista de Pets',tblHtml(heads,tblRows))} onCSV={()=>exportCSV('lista-pets',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows}/>
  </>
}

function RRetornoPendente({ prontuarios, pets, tutores }) {
  const [f, set] = useFilters('retorno-pendente', { ate:'' })
  const t0 = today()
  const rows = useMemo(() => prontuarios
    .filter(pr => pr.prescricao?.retorno && pr.prescricao.retorno >= t0 && (!f.ate || pr.prescricao.retorno <= f.ate))
    .sort((a,b) => a.prescricao.retorno.localeCompare(b.prescricao.retorno)), [prontuarios, f])
  const heads = ['Pet','Tutor','Veterinário','Data Consulta','Data Retorno','Queixa']
  const tblRows = rows.map(pr => {
    const pet = toPet(pets, pr.petId); const tut = toTutor(tutores, pet?.tutorId)
    return [pet?.name??'—', tut?.name??'—', toVet(pr.vetId)?.name??'—', fmtD(pr.date), fmtD(pr.prescricao.retorno), pr.anamnese?.queixa??'—']
  })
  return <>
    <Fil><Inp label="Retorno até" type="date" value={f.ate} onChange={e=>set('ate',e.target.value)}/></Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Retorno Pendente',tblHtml(heads,tblRows))} onCSV={()=>exportCSV('retorno-pendente',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows}/>
  </>
}

function RAniversariantes({ pets, tutores }) {
  const [f, set] = useFilters('aniversariantes', { mes:thisMonth() })
  const month = parseInt(f.mes.split('-')[1])
  const rows = useMemo(() => pets.filter(p => p.birthDate && new Date(p.birthDate+'T12:00').getMonth()+1 === month)
    .sort((a,b) => a.birthDate.slice(8).localeCompare(b.birthDate.slice(8))), [pets, month])
  const heads = ['Pet','Espécie','Raça','Data Nasc.','Dia','Tutor','Contato']
  const tblRows = rows.map(p => { const t = toTutor(tutores, p.tutorId); return [p.name, p.species, p.breed, fmtD(p.birthDate), p.birthDate.slice(8), t?.name??'—', t?.phone??'—'] })
  return <>
    <Fil><Inp label="Mês" type="month" value={f.mes} onChange={e=>set('mes',e.target.value)}/></Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Aniversariantes',tblHtml(heads,tblRows))} onCSV={()=>exportCSV('aniversariantes',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows}/>
  </>
}

// ── Prontuários ───────────────────────────────────────────────────────────────

function RProntPorPet({ prontuarios, pets }) {
  const [f, set] = useFilters('pront-por-pet', { petId:'' })
  const rows = useMemo(() => (f.petId ? prontuarios.filter(pr=>pr.petId===f.petId) : prontuarios)
    .sort((a,b)=>b.date.localeCompare(a.date)), [prontuarios, f])
  const heads = ['Data','Pet','Veterinário','Queixa','Diagnóstico','Retorno']
  const tblRows = rows.map(pr => [fmtD(pr.date), toPet(pets,pr.petId)?.name??'—', toVet(pr.vetId)?.name??'—', pr.anamnese?.queixa??'—', pr.diagnostico?.definitivo||pr.diagnostico?.presuntivo||'—', fmtD(pr.prescricao?.retorno)])
  return <>
    <Fil>
      <Sel label="Pet" value={f.petId} onChange={e=>set('petId',e.target.value)}>
        <option value="">Todos</option>
        {pets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </Sel>
    </Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Prontuários por Pet',tblHtml(heads,tblRows))} onCSV={()=>exportCSV('pront-por-pet',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows}/>
  </>
}

function RProntPorTutor({ prontuarios, pets, tutores }) {
  const [f, set] = useFilters('pront-por-tutor', { tutorId:'' })
  const rows = useMemo(() => {
    const petIds = f.tutorId ? pets.filter(p=>p.tutorId===f.tutorId).map(p=>p.id) : null
    return (petIds ? prontuarios.filter(pr=>petIds.includes(pr.petId)) : prontuarios).sort((a,b)=>b.date.localeCompare(a.date))
  }, [prontuarios, pets, f])
  const heads = ['Data','Tutor','Pet','Veterinário','Queixa','Diagnóstico']
  const tblRows = rows.map(pr => {
    const pet = toPet(pets, pr.petId); const tut = toTutor(tutores, pet?.tutorId)
    return [fmtD(pr.date), tut?.name??'—', pet?.name??'—', toVet(pr.vetId)?.name??'—', pr.anamnese?.queixa??'—', pr.diagnostico?.definitivo||pr.diagnostico?.presuntivo||'—']
  })
  return <>
    <Fil>
      <Sel label="Tutor" value={f.tutorId} onChange={e=>set('tutorId',e.target.value)}>
        <option value="">Todos</option>
        {tutores.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
      </Sel>
    </Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Prontuários por Tutor',tblHtml(heads,tblRows))} onCSV={()=>exportCSV('pront-por-tutor',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows}/>
  </>
}

function RProntPorVet({ prontuarios, pets, tutores }) {
  const [f, set] = useFilters('pront-por-vet', { vetId:'' })
  const rows = useMemo(() => (f.vetId ? prontuarios.filter(pr=>pr.vetId===f.vetId) : prontuarios)
    .sort((a,b)=>b.date.localeCompare(a.date)), [prontuarios, f])
  const heads = ['Data','Veterinário','Pet','Tutor','Queixa','Diagnóstico']
  const tblRows = rows.map(pr => {
    const pet = toPet(pets, pr.petId); const tut = toTutor(tutores, pet?.tutorId)
    return [fmtD(pr.date), toVet(pr.vetId)?.name??'—', pet?.name??'—', tut?.name??'—', pr.anamnese?.queixa??'—', pr.diagnostico?.definitivo||pr.diagnostico?.presuntivo||'—']
  })
  return <>
    <Fil>
      <Sel label="Veterinário" value={f.vetId} onChange={e=>set('vetId',e.target.value)}>
        <option value="">Todos</option>
        {VETS.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
      </Sel>
    </Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Prontuários por Veterinário',tblHtml(heads,tblRows))} onCSV={()=>exportCSV('pront-por-vet',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows}/>
  </>
}

function RProntPorPeriodo({ prontuarios, pets, tutores }) {
  const [f, set] = useFilters('pront-por-periodo', { de:thisMonth()+'-01', ate:today() })
  const rows = useMemo(() => prontuarios.filter(pr=>pr.date>=f.de && pr.date<=f.ate).sort((a,b)=>b.date.localeCompare(a.date)), [prontuarios, f])
  const heads = ['Data','Pet','Tutor','Veterinário','Queixa','Diagnóstico']
  const tblRows = rows.map(pr => {
    const pet = toPet(pets, pr.petId); const tut = toTutor(tutores, pet?.tutorId)
    return [fmtD(pr.date), pet?.name??'—', tut?.name??'—', toVet(pr.vetId)?.name??'—', pr.anamnese?.queixa??'—', pr.diagnostico?.definitivo||pr.diagnostico?.presuntivo||'—']
  })
  return <>
    <Fil>
      <Inp label="De" type="date" value={f.de} onChange={e=>set('de',e.target.value)}/>
      <Inp label="Até" type="date" value={f.ate} onChange={e=>set('ate',e.target.value)}/>
    </Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Prontuários por Período',tblHtml(heads,tblRows))} onCSV={()=>exportCSV('pront-por-periodo',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows}/>
  </>
}

function RProntPorTipo({ prontuarios, pets, tutores }) {
  const [f, set] = useFilters('pront-por-tipo', { q:'' })
  const rows = useMemo(() => prontuarios.filter(pr =>
    normIncludes(pr.anamnese?.queixa, f.q) || normIncludes(pr.diagnostico?.presuntivo, f.q) ||
    normIncludes(pr.diagnostico?.definitivo, f.q) || normIncludes(pr.diagnostico?.diferencial, f.q)
  ).sort((a,b)=>b.date.localeCompare(a.date)), [prontuarios, f])
  const heads = ['Data','Pet','Tutor','Queixa','Diag. Presuntivo','Diag. Definitivo']
  const tblRows = rows.map(pr => {
    const pet = toPet(pets, pr.petId); const tut = toTutor(tutores, pet?.tutorId)
    return [fmtD(pr.date), pet?.name??'—', tut?.name??'—', pr.anamnese?.queixa??'—', pr.diagnostico?.presuntivo??'—', pr.diagnostico?.definitivo??'—']
  })
  return <>
    <Fil><Inp label="Buscar em queixa ou diagnóstico" value={f.q} onChange={e=>set('q',e.target.value)} placeholder="Ex: dermatite, cardio..." style={{minWidth:280}}/></Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Prontuários por Diagnóstico',tblHtml(heads,tblRows))} onCSV={()=>exportCSV('pront-por-tipo',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows}/>
  </>
}

// ── Agenda ────────────────────────────────────────────────────────────────────

function RAgendaDia({ agendamentos, pets, tutores }) {
  const [f, set] = useFilters('agenda-dia', { dia:today() })
  const rows = useMemo(() => agendamentos.filter(a=>a.date===f.dia).sort((a,b)=>a.time.localeCompare(b.time)), [agendamentos, f])
  const heads = ['Hora','Pet','Tutor','Veterinário','Tipo','Status','Obs']
  const tblRows = rows.map(a => [a.time, toPet(pets,a.petId)?.name??'—', toTutor(tutores,a.tutorId)?.name??'—', toVet(a.vetId)?.name??'—', TYPE_LBL[a.type]??a.type, STATUS_LBL[a.status]??a.status, a.notes||'—'])
  return <>
    <Fil><Inp label="Data" type="date" value={f.dia} onChange={e=>set('dia',e.target.value)}/></Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Agenda do Dia — '+fmtD(f.dia),tblHtml(heads,tblRows))} onCSV={()=>exportCSV('agenda-dia',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows}/>
  </>
}

function RAgendaMes({ agendamentos, pets, tutores }) {
  const [f, set] = useFilters('agenda-mes', { mes:thisMonth(), tipo:'', status:'' })
  const rows = useMemo(() => agendamentos
    .filter(a => a.date.slice(0,7)===f.mes && (!f.tipo||a.type===f.tipo) && (!f.status||a.status===f.status))
    .sort((a,b)=>a.date===b.date?a.time.localeCompare(b.time):a.date.localeCompare(b.date)), [agendamentos, f])
  const heads = ['Data','Hora','Pet','Tutor','Tipo','Status']
  const tblRows = rows.map(a => [fmtD(a.date), a.time, toPet(pets,a.petId)?.name??'—', toTutor(tutores,a.tutorId)?.name??'—', TYPE_LBL[a.type]??a.type, STATUS_LBL[a.status]??a.status])
  return <>
    <Fil>
      <Inp label="Mês" type="month" value={f.mes} onChange={e=>set('mes',e.target.value)}/>
      <Sel label="Tipo" value={f.tipo} onChange={e=>set('tipo',e.target.value)}>
        <option value="">Todos</option>
        {Object.entries(TYPE_LBL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
      </Sel>
      <Sel label="Status" value={f.status} onChange={e=>set('status',e.target.value)}>
        <option value="">Todos</option>
        {Object.entries(STATUS_LBL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
      </Sel>
    </Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Agenda do Mês',tblHtml(heads,tblRows))} onCSV={()=>exportCSV('agenda-mes',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows}/>
  </>
}

function RAgendaAno({ agendamentos }) {
  const [f, set] = useFilters('agenda-ano', { ano:thisYear() })
  const data = useMemo(() => {
    const counts = Array(12).fill(0)
    agendamentos.filter(a=>a.date.startsWith(f.ano)).forEach(a=>{ counts[parseInt(a.date.slice(5,7))-1]++ })
    return counts.map((v,i)=>({ label:MES[i], value:v }))
  }, [agendamentos, f])
  const total = data.reduce((s,d)=>s+d.value, 0)
  const heads = ['Mês','Atendimentos']
  const tblRows = data.map(d=>[d.label, d.value])
  return <>
    <Fil><Inp label="Ano" type="number" min="2020" max="2030" value={f.ano} onChange={e=>set('ano',e.target.value)} style={{maxWidth:100}}/></Fil>
    <ActBar count={total} onPrint={()=>printReport('Resumo Anual — '+f.ano,tblHtml(heads,tblRows))} onCSV={()=>exportCSV('agenda-ano',heads,tblRows)}/>
    <BarChart data={data} color="#FF9800"/>
  </>
}

function RTaxaOcupacao({ agendamentos }) {
  const [f, set] = useFilters('taxa-ocupacao', { mes:thisMonth() })
  const stats = useMemo(() => {
    const month = agendamentos.filter(a=>a.date.slice(0,7)===f.mes)
    const byStatus = {}
    month.forEach(a=>{ byStatus[a.status] = (byStatus[a.status]??0)+1 })
    return { total:month.length, byStatus }
  }, [agendamentos, f])
  const heads = ['Status','Qtd','%']
  const tblRows = Object.entries(stats.byStatus).map(([k,v])=>[STATUS_LBL[k]??k, v, stats.total?((v/stats.total)*100).toFixed(1)+'%':'0%'])
  return <>
    <Fil><Inp label="Mês" type="month" value={f.mes} onChange={e=>set('mes',e.target.value)}/></Fil>
    <ActBar count={stats.total} onPrint={()=>printReport('Taxa de Ocupação',tblHtml(heads,tblRows))} onCSV={()=>exportCSV('taxa-ocupacao',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows}/>
  </>
}

function RAgendaStatus({ agendamentos, pets, tutores }) {
  const [f, set] = useFilters('agenda-status', { status:'agendado', mes:thisMonth() })
  const rows = useMemo(() => agendamentos
    .filter(a=>(!f.status||a.status===f.status) && a.date.slice(0,7)===f.mes)
    .sort((a,b)=>a.date===b.date?a.time.localeCompare(b.time):a.date.localeCompare(b.date)), [agendamentos, f])
  const heads = ['Data','Hora','Pet','Tutor','Tipo','Status']
  const tblRows = rows.map(a=>[fmtD(a.date), a.time, toPet(pets,a.petId)?.name??'—', toTutor(tutores,a.tutorId)?.name??'—', TYPE_LBL[a.type]??a.type, STATUS_LBL[a.status]??a.status])
  return <>
    <Fil>
      <Inp label="Mês" type="month" value={f.mes} onChange={e=>set('mes',e.target.value)}/>
      <Sel label="Status" value={f.status} onChange={e=>set('status',e.target.value)}>
        <option value="">Todos</option>
        {Object.entries(STATUS_LBL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
      </Sel>
    </Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Agenda por Status',tblHtml(heads,tblRows))} onCSV={()=>exportCSV('agenda-status',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows}/>
  </>
}

// ── Estoque ───────────────────────────────────────────────────────────────────

function REstoqueTotal({ produtos }) {
  const [f, set] = useFilters('estoque-total', { q:'', cat:'' })
  const cats = [...new Set(produtos.map(p=>p.category))]
  const rows = useMemo(() => produtos.filter(p=>normIncludes(p.name,f.q)&&(!f.cat||p.category===f.cat)), [produtos, f])
  const heads = ['Nome','Categoria','Qtd','Un.','Mínimo','Validade','Local','Custo','Venda']
  const tblRows = rows.map(p=>[p.name, p.category, p.quantity, p.unit, p.minStock, fmtD(p.expiryDate), p.location, R(p.costPrice), p.salePrice>0?R(p.salePrice):'—'])
  return <>
    <Fil>
      <Inp label="Buscar produto" value={f.q} onChange={e=>set('q',e.target.value)} placeholder="Nome..."/>
      <Sel label="Categoria" value={f.cat} onChange={e=>set('cat',e.target.value)}>
        <option value="">Todas</option>
        {cats.map(c=><option key={c} value={c}>{c}</option>)}
      </Sel>
    </Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Estoque Total',tblHtml(heads,tblRows))} onCSV={()=>exportCSV('estoque-total',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows}/>
  </>
}

function RProdutosVencidos({ produtos }) {
  const t0 = today()
  const rows = useMemo(() => produtos.filter(p=>p.expiryDate&&p.expiryDate<t0).sort((a,b)=>a.expiryDate.localeCompare(b.expiryDate)), [produtos])
  const heads = ['Nome','Categoria','Qtd','Un.','Validade','Local']
  const tblRows = rows.map(p=>[p.name, p.category, p.quantity, p.unit, fmtD(p.expiryDate), p.location])
  return <>
    <ActBar count={rows.length} onPrint={()=>printReport('Produtos Vencidos',tblHtml(heads,tblRows))} onCSV={()=>exportCSV('produtos-vencidos',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows} empty="Nenhum produto vencido."/>
  </>
}

function RProdutosAVencer({ produtos }) {
  const [f, set] = useFilters('produtos-a-vencer', { dias:'30' })
  const rows = useMemo(() => {
    const t0 = today()
    const lim = new Date(); lim.setDate(lim.getDate()+parseInt(f.dias||30))
    const limStr = lim.toISOString().slice(0,10)
    return produtos.filter(p=>p.expiryDate&&p.expiryDate>=t0&&p.expiryDate<=limStr).sort((a,b)=>a.expiryDate.localeCompare(b.expiryDate))
  }, [produtos, f])
  const heads = ['Nome','Categoria','Qtd','Un.','Validade','Local']
  const tblRows = rows.map(p=>[p.name, p.category, p.quantity, p.unit, fmtD(p.expiryDate), p.location])
  return <>
    <Fil>
      <Sel label="Vencer em" value={f.dias} onChange={e=>set('dias',e.target.value)}>
        {[7,15,30,60,90].map(d=><option key={d} value={d}>{d} dias</option>)}
      </Sel>
    </Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Produtos a Vencer',tblHtml(heads,tblRows))} onCSV={()=>exportCSV('produtos-a-vencer',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows} empty="Nenhum produto a vencer nesse prazo."/>
  </>
}

function REstoqueMinimo({ produtos }) {
  const rows = useMemo(() => produtos.filter(p=>p.quantity<=p.minStock).sort((a,b)=>a.quantity-b.quantity), [produtos])
  const heads = ['Nome','Categoria','Qtd Atual','Qtd Mínima','Un.','Local']
  const tblRows = rows.map(p=>[p.name, p.category, p.quantity, p.minStock, p.unit, p.location])
  return <>
    <ActBar count={rows.length} onPrint={()=>printReport('Estoque Abaixo do Mínimo',tblHtml(heads,tblRows))} onCSV={()=>exportCSV('estoque-minimo',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows} empty="Nenhum produto abaixo do mínimo."/>
  </>
}

function RMovimentacao({ lancamentos }) {
  const [f, set] = useFilters('movimentacao', { de:thisMonth()+'-01', ate:today() })
  const rows = useMemo(() => lancamentos
    .filter(l=>l.type==='despesa'&&['Medicamentos','Fornecedores','Material'].includes(l.category)&&l.date>=f.de&&l.date<=f.ate)
    .sort((a,b)=>b.date.localeCompare(a.date)), [lancamentos, f])
  const total = rows.reduce((s,l)=>s+l.value, 0)
  const heads = ['Data','Categoria','Descrição','Método','Status','Valor']
  const tblRows = rows.map(l=>[fmtD(l.date), l.category, l.description, l.method, l.status, R(l.value)])
  return <>
    <Fil>
      <Inp label="De" type="date" value={f.de} onChange={e=>set('de',e.target.value)}/>
      <Inp label="Até" type="date" value={f.ate} onChange={e=>set('ate',e.target.value)}/>
    </Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Movimentação',tblHtml(heads,tblRows)+`<p><strong>Total: ${R(total)}</strong></p>`)} onCSV={()=>exportCSV('movimentacao',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows}/>
    {rows.length>0 && <div style={{textAlign:'right',fontWeight:700,padding:'10px 12px',borderTop:'2px solid var(--border)'}}>Total: {R(total)}</div>}
  </>
}

// ── Hospedagem ────────────────────────────────────────────────────────────────

function RHospDia({ hospedagens, pets, tutores }) {
  const t0 = today()
  const rows = useMemo(() => hospedagens.filter(h=>h.status==='ativo'&&h.checkIn<=t0&&h.checkOut>=t0), [hospedagens])
  const heads = ['Pet','Espécie','Tutor','Check-in','Check-out','Diárias','Valor/Dia','Total Previsto']
  const tblRows = rows.map(h => {
    const pet = toPet(pets,h.petId); const n = calcDiarias(h)
    return [pet?.name??'—', pet?.species??'—', toTutor(tutores,h.tutorId)?.name??'—', fmtD(h.checkIn), fmtD(h.checkOut), n, R(h.dailyRate), R(h.dailyRate*n)]
  })
  return <>
    <ActBar count={rows.length} onPrint={()=>printReport('Hospedagens Ativas',tblHtml(heads,tblRows))} onCSV={()=>exportCSV('hosp-dia',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows} empty="Nenhuma hospedagem ativa hoje."/>
  </>
}

function RHospMes({ hospedagens, pets, tutores }) {
  const [f, set] = useFilters('hosp-mes', { mes:thisMonth() })
  const rows = useMemo(() => hospedagens.filter(h=>h.checkIn.slice(0,7)===f.mes||h.checkOut.slice(0,7)===f.mes), [hospedagens, f])
  const heads = ['Pet','Tutor','Check-in','Check-out','Diárias','Total','Status']
  const tblRows = rows.map(h => {
    const n = calcDiarias(h)
    return [toPet(pets,h.petId)?.name??'—', toTutor(tutores,h.tutorId)?.name??'—', fmtD(h.checkIn), fmtD(h.checkOut), n, R(h.dailyRate*n), h.status==='ativo'?'Ativo':'Concluído']
  })
  return <>
    <Fil><Inp label="Mês" type="month" value={f.mes} onChange={e=>set('mes',e.target.value)}/></Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Hospedagens do Mês',tblHtml(heads,tblRows))} onCSV={()=>exportCSV('hosp-mes',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows}/>
  </>
}

function RHospAno({ hospedagens }) {
  const [f, set] = useFilters('hosp-ano', { ano:thisYear() })
  const data = useMemo(() => {
    const totals = Array(12).fill(0)
    hospedagens.filter(h=>h.checkIn.startsWith(f.ano)).forEach(h=>{ totals[parseInt(h.checkIn.slice(5,7))-1] += h.dailyRate*calcDiarias(h) })
    return totals.map((v,i)=>({ label:MES[i], value:Math.round(v) }))
  }, [hospedagens, f])
  const total = hospedagens.filter(h=>h.checkIn.startsWith(f.ano)).reduce((s,h)=>s+h.dailyRate*calcDiarias(h), 0)
  const heads = ['Mês','Receita (R$)']
  const tblRows = data.map(d=>[d.label, d.value.toFixed(2)])
  return <>
    <Fil><Inp label="Ano" type="number" min="2020" max="2030" value={f.ano} onChange={e=>set('ano',e.target.value)} style={{maxWidth:100}}/></Fil>
    <ActBar count={hospedagens.filter(h=>h.checkIn.startsWith(f.ano)).length} onPrint={()=>printReport('Hospedagens Anual',tblHtml(heads,tblRows)+`<p><strong>Total: ${R(total)}</strong></p>`)} onCSV={()=>exportCSV('hosp-ano',heads,tblRows)}/>
    <BarChart data={data} color="#00BCD4"/>
    <div style={{textAlign:'right',fontWeight:700,padding:'10px 12px'}}>Total: {R(total)}</div>
  </>
}

function RHospPorPet({ hospedagens, pets, tutores }) {
  const [f, set] = useFilters('hosp-por-pet', { petId:'' })
  const rows = useMemo(() => (f.petId?hospedagens.filter(h=>h.petId===f.petId):hospedagens).sort((a,b)=>b.checkIn.localeCompare(a.checkIn)), [hospedagens, f])
  const heads = ['Pet','Tutor','Check-in','Check-out','Diárias','Total','Status']
  const tblRows = rows.map(h => {
    const n = calcDiarias(h)
    return [toPet(pets,h.petId)?.name??'—', toTutor(tutores,h.tutorId)?.name??'—', fmtD(h.checkIn), fmtD(h.checkOut), n, R(h.dailyRate*n), h.status==='ativo'?'Ativo':'Concluído']
  })
  return <>
    <Fil>
      <Sel label="Pet" value={f.petId} onChange={e=>set('petId',e.target.value)}>
        <option value="">Todos</option>
        {pets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </Sel>
    </Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Hospedagens por Pet',tblHtml(heads,tblRows))} onCSV={()=>exportCSV('hosp-por-pet',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows}/>
  </>
}

// ── Financeiro ────────────────────────────────────────────────────────────────

function RFinPeriodo({ lancamentos }) {
  const [f, set] = useFilters('fin-periodo', { de:thisMonth()+'-01', ate:today(), tipo:'' })
  const rows = useMemo(() => lancamentos.filter(l=>l.date>=f.de&&l.date<=f.ate&&(!f.tipo||l.type===f.tipo)).sort((a,b)=>b.date.localeCompare(a.date)), [lancamentos, f])
  const receita = rows.filter(l=>l.type==='receita').reduce((s,l)=>s+l.value, 0)
  const despesa = rows.filter(l=>l.type==='despesa').reduce((s,l)=>s+l.value, 0)
  const heads = ['Data','Tipo','Categoria','Descrição','Método','Status','Valor']
  const tblRows = rows.map(l=>[fmtD(l.date), l.type==='receita'?'Receita':'Despesa', l.category, l.description, l.method, l.status, R(l.value)])
  return <>
    <Fil>
      <Inp label="De" type="date" value={f.de} onChange={e=>set('de',e.target.value)}/>
      <Inp label="Até" type="date" value={f.ate} onChange={e=>set('ate',e.target.value)}/>
      <Sel label="Tipo" value={f.tipo} onChange={e=>set('tipo',e.target.value)}>
        <option value="">Todos</option>
        <option value="receita">Receitas</option>
        <option value="despesa">Despesas</option>
      </Sel>
    </Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Receitas e Despesas',tblHtml(heads,tblRows)+`<p>Receitas: ${R(receita)} | Despesas: ${R(despesa)} | <strong>Saldo: ${R(receita-despesa)}</strong></p>`)} onCSV={()=>exportCSV('fin-periodo',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows}/>
    {rows.length>0 && (
      <div style={{display:'flex',gap:24,padding:'12px 12px',borderTop:'2px solid var(--border)',justifyContent:'flex-end',flexWrap:'wrap'}}>
        <span>Receitas: <strong style={{color:'#4CAF50'}}>{R(receita)}</strong></span>
        <span>Despesas: <strong style={{color:'#f44336'}}>{R(despesa)}</strong></span>
        <span>Saldo: <strong style={{color:receita-despesa>=0?'#4CAF50':'#f44336'}}>{R(receita-despesa)}</strong></span>
      </div>
    )}
  </>
}

function RDRE({ lancamentos }) {
  const [f, set] = useFilters('dre-mensal', { mes:thisMonth() })
  const { rCats, dCats, totalR, totalD } = useMemo(() => {
    const month = lancamentos.filter(l=>l.date.slice(0,7)===f.mes)
    const byCat = arr => arr.reduce((acc,l)=>{ acc[l.category]=(acc[l.category]??0)+l.value; return acc }, {})
    const rec = month.filter(l=>l.type==='receita')
    const des = month.filter(l=>l.type==='despesa')
    return { rCats:byCat(rec), dCats:byCat(des), totalR:rec.reduce((s,l)=>s+l.value,0), totalD:des.reduce((s,l)=>s+l.value,0) }
  }, [lancamentos, f])
  const rows = [
    ...Object.entries(rCats).map(([k,v])=>[k, R(v), '—']),
    ['TOTAL RECEITAS', R(totalR), ''],
    ...Object.entries(dCats).map(([k,v])=>['↳ '+k, '—', R(v)]),
    ['TOTAL DESPESAS', '', R(totalD)],
    ['RESULTADO', R(totalR-totalD), ''],
  ]
  const heads = ['Categoria','Receita','Despesa']
  return <>
    <Fil><Inp label="Mês" type="month" value={f.mes} onChange={e=>set('mes',e.target.value)}/></Fil>
    <ActBar count={Object.keys(rCats).length+Object.keys(dCats).length} onPrint={()=>printReport('DRE Mensal — '+f.mes,tblHtml(heads,rows))} onCSV={()=>exportCSV('dre-mensal',heads,rows)}/>
    <Tbl heads={heads} rows={rows}/>
  </>
}

function RPDVPeriodo({ vendas }) {
  const [f, set] = useFilters('pdv-periodo', { de:thisMonth()+'-01', ate:today() })
  const rows = useMemo(() => vendas.filter(v=>{ const d=vendaDate(v); return d>=f.de&&d<=f.ate }).sort((a,b)=>b.num-a.num), [vendas, f])
  const total = rows.reduce((s,v)=>s+(v.total??0), 0)
  const heads = ['Nº','Data','Tutor','Itens','Método','Total']
  const tblRows = rows.map(v=>[v.num, v.date, v.tutor??'—', v.items?.length??0, v.paymentMethod??'—', R(v.total)])
  return <>
    <Fil>
      <Inp label="De" type="date" value={f.de} onChange={e=>set('de',e.target.value)}/>
      <Inp label="Até" type="date" value={f.ate} onChange={e=>set('ate',e.target.value)}/>
    </Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Vendas PDV',tblHtml(heads,tblRows)+`<p><strong>Total: ${R(total)}</strong></p>`)} onCSV={()=>exportCSV('pdv-periodo',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows}/>
    {rows.length>0 && <div style={{textAlign:'right',fontWeight:700,padding:'10px 12px',borderTop:'2px solid var(--border)'}}>Total: {R(total)}</div>}
  </>
}

function RProdutosVendidos({ vendas }) {
  const [f, set] = useFilters('produtos-vendidos', { de:thisMonth()+'-01', ate:today() })
  const rows = useMemo(() => {
    const map = {}
    vendas.forEach(v => {
      const d = vendaDate(v)
      if (d<f.de||d>f.ate) return
      ;(v.items??[]).forEach(it => {
        if (!map[it.name]) map[it.name] = { name:it.name, cat:it.category??'—', qty:0, total:0 }
        map[it.name].qty += it.qty??1
        map[it.name].total += (it.price??0)*(it.qty??1)
      })
    })
    return Object.values(map).sort((a,b)=>b.qty-a.qty)
  }, [vendas, f])
  const heads = ['Produto','Categoria','Qtd Vendida','Total']
  const tblRows = rows.map(r=>[r.name, r.cat, r.qty, R(r.total)])
  return <>
    <Fil>
      <Inp label="De" type="date" value={f.de} onChange={e=>set('de',e.target.value)}/>
      <Inp label="Até" type="date" value={f.ate} onChange={e=>set('ate',e.target.value)}/>
    </Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Produtos Mais Vendidos',tblHtml(heads,tblRows))} onCSV={()=>exportCSV('produtos-vendidos',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows} empty="Nenhuma venda no período."/>
  </>
}

function RComissoes({ lancamentos }) {
  const [f, set] = useFilters('comissoes', { mes:thisMonth() })
  const rows = useMemo(() => {
    const month = lancamentos.filter(l=>l.type==='receita'&&l.date.slice(0,7)===f.mes&&l.status==='recebido')
    return VETS.map(v => {
      const sub = month.filter(l=>l.description?.toLowerCase().includes(v.name.split(' ').pop()?.toLowerCase())).reduce((s,l)=>s+l.value, 0)
      return sub>0 ? { vet:v.name, sub, c10:sub*0.1, c15:sub*0.15 } : null
    }).filter(Boolean)
  }, [lancamentos, f])
  const heads = ['Veterinário','Subtotal','Comissão 10%','Comissão 15%']
  const tblRows = rows.map(r=>[r.vet, R(r.sub), R(r.c10), R(r.c15)])
  return <>
    <Fil><Inp label="Mês" type="month" value={f.mes} onChange={e=>set('mes',e.target.value)}/></Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Comissões',tblHtml(heads,tblRows))} onCSV={()=>exportCSV('comissoes',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows} empty="Nenhuma receita recebida no mês."/>
  </>
}

function RInadimplencia({ lancamentos }) {
  const [f, set] = useFilters('inadimplencia', { de:'', ate:'' })
  const rows = useMemo(() => lancamentos.filter(l=>l.type==='receita'&&l.status==='pendente'&&(!f.de||l.date>=f.de)&&(!f.ate||l.date<=f.ate)).sort((a,b)=>a.date.localeCompare(b.date)), [lancamentos, f])
  const total = rows.reduce((s,l)=>s+l.value, 0)
  const heads = ['Data','Categoria','Descrição','Método','Valor']
  const tblRows = rows.map(l=>[fmtD(l.date), l.category, l.description, l.method, R(l.value)])
  return <>
    <Fil>
      <Inp label="De" type="date" value={f.de} onChange={e=>set('de',e.target.value)}/>
      <Inp label="Até" type="date" value={f.ate} onChange={e=>set('ate',e.target.value)}/>
    </Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Inadimplência',tblHtml(heads,tblRows)+`<p><strong>Total em aberto: ${R(total)}</strong></p>`)} onCSV={()=>exportCSV('inadimplencia',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows} empty="Nenhum lançamento pendente."/>
    {rows.length>0 && <div style={{textAlign:'right',fontWeight:700,padding:'10px 12px',borderTop:'2px solid var(--border)',color:'#f44336'}}>Total em aberto: {R(total)}</div>}
  </>
}

// ── Funcionários ──────────────────────────────────────────────────────────────

function RFolha({ pagamentos, funcionarios }) {
  const [f, set] = useFilters('folha-pagamento', { mes:thisMonth() })
  const [ano, mes] = f.mes.split('-')
  const rows = useMemo(() => pagamentos
    .filter(p=>String(p.ano)===ano&&String(p.mes).padStart(2,'0')===mes)
    .map(p => {
      const fn = funcionarios.find(fn=>fn.id===p.funcionarioId)
      return { nome:fn?.nome??fn?.name??p.funcionarioId, salarioBase:p.salarioBase, premiacao:p.premiacao??0, beneficios:p.totalBeneficios??0, descontos:p.totalDescontos??0, inss:p.inss??0, fgts:p.fgts??0, liquido:p.salarioLiquido??0 }
    }), [pagamentos, funcionarios, ano, mes])
  const totalLiq = rows.reduce((s,r)=>s+r.liquido, 0)
  const heads = ['Funcionário','Salário Base','Premiação','Benefícios','Descontos','INSS','FGTS','Líquido']
  const tblRows = rows.map(r=>[r.nome, R(r.salarioBase), R(r.premiacao), R(r.beneficios), R(r.descontos), R(r.inss), R(r.fgts), R(r.liquido)])
  return <>
    <Fil><Inp label="Mês" type="month" value={f.mes} onChange={e=>set('mes',e.target.value)}/></Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Folha de Pagamento',tblHtml(heads,tblRows)+`<p><strong>Total Folha: ${R(totalLiq)}</strong></p>`)} onCSV={()=>exportCSV('folha-pagamento',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows} empty="Nenhum pagamento registrado neste mês."/>
    {rows.length>0 && <div style={{textAlign:'right',fontWeight:700,padding:'10px 12px',borderTop:'2px solid var(--border)'}}>Total Folha: {R(totalLiq)}</div>}
  </>
}

function RHistPagamentos({ pagamentos, funcionarios }) {
  const [f, set] = useFilters('hist-pagamentos', { funcId:'' })
  const rows = useMemo(() => (f.funcId?pagamentos.filter(p=>p.funcionarioId===f.funcId):pagamentos).sort((a,b)=>b.ano!==a.ano?b.ano-a.ano:b.mes-a.mes), [pagamentos, f])
  const heads = ['Funcionário','Mês','Ano','Salário Base','Salário Líquido','Data Pagamento']
  const tblRows = rows.map(p => {
    const fn = funcionarios.find(fn=>fn.id===p.funcionarioId)
    return [fn?.nome??fn?.name??p.funcionarioId, p.mes, p.ano, R(p.salarioBase), R(p.salarioLiquido??0), fmtD(p.dataPagamento)]
  })
  return <>
    <Fil>
      <Sel label="Funcionário" value={f.funcId} onChange={e=>set('funcId',e.target.value)}>
        <option value="">Todos</option>
        {funcionarios.map(fn=><option key={fn.id} value={fn.id}>{fn.nome??fn.name}</option>)}
      </Sel>
    </Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Histórico de Pagamentos',tblHtml(heads,tblRows))} onCSV={()=>exportCSV('hist-pagamentos',heads,tblRows)}/>
    <Tbl heads={heads} rows={tblRows} empty="Nenhum histórico de pagamento encontrado."/>
  </>
}

// ── Indicadores ───────────────────────────────────────────────────────────────

function RTicketMedio({ lancamentos, vendas }) {
  const [f, set] = useFilters('ticket-medio', { de:thisMonth()+'-01', ate:today() })
  const stats = useMemo(() => {
    const rec = lancamentos.filter(l=>l.type==='receita'&&l.status==='recebido'&&l.date>=f.de&&l.date<=f.ate)
    const vend = vendas.filter(v=>{ const d=vendaDate(v); return d>=f.de&&d<=f.ate })
    const total = rec.reduce((s,l)=>s+l.value,0) + vend.reduce((s,v)=>s+(v.total??0),0)
    const count = rec.length + vend.length
    return { total, count, ticket: count>0 ? total/count : 0 }
  }, [lancamentos, vendas, f])
  return <>
    <Fil>
      <Inp label="De" type="date" value={f.de} onChange={e=>set('de',e.target.value)}/>
      <Inp label="Até" type="date" value={f.ate} onChange={e=>set('ate',e.target.value)}/>
    </Fil>
    <StatCards items={[
      { label:'Transações', value:stats.count },
      { label:'Receita Total', value:R(stats.total) },
      { label:'Ticket Médio', value:R(stats.ticket), highlight:true },
    ]}/>
  </>
}

function RServicosTop({ agendamentos }) {
  const [f, set] = useFilters('servicos-top', { mes:thisMonth() })
  const rows = useMemo(() => {
    const map = {}
    agendamentos.filter(a=>a.date.slice(0,7)===f.mes&&a.status!=='cancelado').forEach(a=>{ map[a.type]=(map[a.type]??0)+1 })
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([type,count],i)=>[i+1, TYPE_LBL[type]??type, count])
  }, [agendamentos, f])
  const heads = ['#','Tipo','Qtd']
  return <>
    <Fil><Inp label="Mês" type="month" value={f.mes} onChange={e=>set('mes',e.target.value)}/></Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Serviços Mais Realizados',tblHtml(heads,rows))} onCSV={()=>exportCSV('servicos-top',heads,rows)}/>
    <Tbl heads={heads} rows={rows}/>
  </>
}

function RVetTop({ agendamentos, prontuarios, lancamentos }) {
  const [f, set] = useFilters('vet-top', { mes:thisMonth() })
  const rows = useMemo(() => {
    const agMes = agendamentos.filter(a=>a.date.slice(0,7)===f.mes&&a.status!=='cancelado')
    const lancMes = lancamentos.filter(l=>l.type==='receita'&&l.date.slice(0,7)===f.mes)
    return VETS.map(v => {
      const atend = agMes.filter(a=>a.vetId===v.id).length
      const prMes = prontuarios.filter(pr=>pr.vetId===v.id&&pr.date.slice(0,7)===f.mes).length
      const recEst = lancMes.filter(l=>l.description?.toLowerCase().includes(v.name.split(' ').pop()?.toLowerCase())).reduce((s,l)=>s+l.value, 0)
      return [v.name, v.specialty, atend, prMes, R(recEst)]
    })
  }, [agendamentos, prontuarios, lancamentos, f])
  const heads = ['Veterinário','Especialidade','Agendamentos','Prontuários','Receita Est.']
  return <>
    <Fil><Inp label="Mês" type="month" value={f.mes} onChange={e=>set('mes',e.target.value)}/></Fil>
    <ActBar count={rows.length} onPrint={()=>printReport('Performance por Veterinário',tblHtml(heads,rows))} onCSV={()=>exportCSV('vet-top',heads,rows)}/>
    <Tbl heads={heads} rows={rows}/>
  </>
}

function RNovosPetsMes({ agendamentos }) {
  const [f, set] = useFilters('novos-pets-mes', { ano:thisYear() })
  const data = useMemo(() => {
    const first = {}
    agendamentos.filter(a=>a.date.startsWith(f.ano)).sort((a,b)=>a.date.localeCompare(b.date)).forEach(a=>{
      if (!first[a.petId]) first[a.petId] = parseInt(a.date.slice(5,7))-1
    })
    const counts = Array(12).fill(0)
    Object.values(first).forEach(m=>{ counts[m]++ })
    return counts.map((v,i)=>({ label:MES[i], value:v }))
  }, [agendamentos, f])
  const total = data.reduce((s,d)=>s+d.value, 0)
  const heads = ['Mês','Novos Pets']
  const tblRows = data.map(d=>[d.label, d.value])
  return <>
    <Fil><Inp label="Ano" type="number" min="2020" max="2030" value={f.ano} onChange={e=>set('ano',e.target.value)} style={{maxWidth:100}}/></Fil>
    <ActBar count={total} onPrint={()=>printReport('Novos Pets por Mês — '+f.ano,tblHtml(heads,tblRows))} onCSV={()=>exportCSV('novos-pets-mes',heads,tblRows)}/>
    <BarChart data={data} color="#607D8B"/>
  </>
}

function RTaxaRetorno({ prontuarios }) {
  const [f, set] = useFilters('taxa-retorno', { de:thisMonth()+'-01', ate:today() })
  const stats = useMemo(() => {
    const period = prontuarios.filter(pr=>pr.date>=f.de&&pr.date<=f.ate)
    const totalPets = new Set(period.map(pr=>pr.petId)).size
    const withRet = new Set(period.filter(pr=>pr.prescricao?.retorno&&pr.prescricao.retorno>pr.date).map(pr=>pr.petId)).size
    return { total:period.length, totalPets, withRet, taxa: totalPets>0?((withRet/totalPets)*100).toFixed(1):'0.0' }
  }, [prontuarios, f])
  return <>
    <Fil>
      <Inp label="De" type="date" value={f.de} onChange={e=>set('de',e.target.value)}/>
      <Inp label="Até" type="date" value={f.ate} onChange={e=>set('ate',e.target.value)}/>
    </Fil>
    <StatCards items={[
      { label:'Prontuários no período', value:stats.total },
      { label:'Pets atendidos', value:stats.totalPets },
      { label:'Com retorno prescrito', value:stats.withRet },
      { label:'Taxa de Retorno', value:stats.taxa+'%', highlight:true },
    ]}/>
  </>
}
