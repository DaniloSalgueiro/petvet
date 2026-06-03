import { useState, useMemo } from 'react'
import {
  Users, TrendingUp, MessageCircle, Star, Clock, ShoppingBag,
  Search, Download, Filter, ChevronDown, ChevronUp, X, Check,
  BarChart2, FileText, Calendar, AlertTriangle,
} from 'lucide-react'
import Tabs from '../components/ui/Tabs'
import { usePersistentState } from '../hooks/usePersistentState'

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function fmt(v) { return `R$ ${Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}` }
function fmtDate(iso) { if (!iso) return '—'; try { return new Date(iso+'T00:00').toLocaleDateString('pt-BR') } catch { return iso } }
function todayISO() { return new Date().toISOString().split('T')[0] }
function diffDays(isoA, isoB) {
  const msPerDay = 86400000
  return Math.round((new Date(isoB+'T00:00') - new Date(isoA+'T00:00')) / msPerDay)
}

function exportCSV(filename, headers, rows) {
  const bom = '﻿'
  const lines = [headers.join(';'), ...rows.map(r => r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(';'))]
  const blob = new Blob([bom+lines.join('\n')], { type:'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href=url; a.download=filename+'.csv'; a.click()
  URL.revokeObjectURL(url)
}

// ── Client classification ─────────────────────────────────────────────────────

const DEFAULT_CRM_CONFIG = {
  thresholdVIP: 500,           // gasto em 90 dias para ser VIP
  thresholdFrequente: 30,      // visita a cada X dias
  thresholdRisco: 90,          // sem visita há X dias
  thresholdInativo: 180,       // sem visita há X dias
  msgInativo: 'Olá, {tutor}! Saudades de vocês! Faz {dias} dias que {pet} não nos visita. Que tal agendar uma consulta? 🐾',
  msgAniversario: 'Feliz aniversário para {pet}! 🎂🐾 Parabéns pelo dia especial! Esperamos vocês em breve!',
  msgVacina: 'Olá, {tutor}! Lembrete: a vacina de {pet} vence em {dias} dias. Agende já! 💉',
  msgVIP: 'Olá, {tutor}! Como cliente VIP, temos uma oferta especial para você e {pet}. Entre em contato! ⭐',
}

const BADGE_CONFIG = {
  vip:       { label:'VIP',            color:'#166534', bg:'#dcfce7', emoji:'🟢' },
  frequente: { label:'Frequente',      color:'#1e40af', bg:'#dbeafe', emoji:'🔵' },
  regular:   { label:'Regular',        color:'#92400e', bg:'#fef3c7', emoji:'🟡' },
  risco:     { label:'Em risco',       color:'#9a3412', bg:'#ffedd5', emoji:'🟠' },
  inativo:   { label:'Inativo',        color:'#7f1d1d', bg:'#fee2e2', emoji:'🔴' },
  novo:      { label:'Novo',           color:'#374151', bg:'#f3f4f6', emoji:'⚪' },
}

function classificarCliente(diasSemVisita, gastoUltimos90, config, diasCadastrado) {
  if (diasCadastrado < 30) return 'novo'
  if (diasSemVisita > config.thresholdInativo) return 'inativo'
  if (diasSemVisita > config.thresholdRisco) return 'risco'
  if (gastoUltimos90 >= config.thresholdVIP) return 'vip'
  if (diasSemVisita <= config.thresholdFrequente) return 'frequente'
  return 'regular'
}

function Badge({ tipo }) {
  const cfg = BADGE_CONFIG[tipo] || BADGE_CONFIG.regular
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'2px 10px', borderRadius:10, fontSize:'0.72rem', fontWeight:700,
      color:cfg.color, background:cfg.bg,
    }}>
      {cfg.emoji} {cfg.label}
    </span>
  )
}

// ── Data aggregation ──────────────────────────────────────────────────────────

function useCRMData(crmConfig) {
  const tutores = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('petvet-tutores')||'[]') } catch { return [] }
  }, [])
  const pets = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('petvet-pets')||'[]') } catch { return [] }
  }, [])
  const prontuarios = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('petvet-prontuarios')||'[]') } catch { return [] }
  }, [])
  const agendamentos = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('petvet-agendamentos')||'[]') } catch { return [] }
  }, [])
  const vendas = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('petvet-vendas')||'[]') } catch { return [] }
  }, [])

  const today = todayISO()

  const clientesProcessados = useMemo(() => {
    return tutores.map(t => {
      const meusPets = pets.filter(p => p.tutorId === t.id)
      const meusAgends = agendamentos.filter(a => a.tutorId===t.id && a.status==='concluido')
      const meusProns  = prontuarios.filter(p => meusPets.some(mp => mp.id===p.petId))
      const datasClinicos = [
        ...meusAgends.map(a => a.date),
        ...meusProns.map(p => p.date),
      ].filter(Boolean).sort()

      const ultimaVisita = datasClinicos[datasClinicos.length - 1] || null
      const diasSemVisita = ultimaVisita ? diffDays(ultimaVisita, today) : 9999

      // Compras no PDV por nome do tutor
      const minhasVendas = vendas.filter(v => {
        const nomes = [t.name, t.nome].filter(Boolean).map(n=>n.toLowerCase())
        return nomes.some(n => (v.tutor||'').toLowerCase().includes(n) || n.includes((v.tutor||'').toLowerCase()))
      })

      const parseSaleDate = v => {
        try {
          const m = v.date?.match(/(\d{2})\/(\d{2})\/(\d{4})/)
          return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
        } catch { return '' }
      }

      const gasto90 = minhasVendas.filter(v => {
        const d = parseSaleDate(v)
        return d && diffDays(d, today) <= 90
      }).reduce((s,v)=>s+Number(v.total||0), 0)

      const gastoTotal = minhasVendas.reduce((s,v)=>s+Number(v.total||0), 0)

      // Frequência média
      let frequenciaMedia = null
      if (datasClinicos.length >= 2) {
        const intervals = []
        for (let i=1; i<datasClinicos.length; i++) {
          intervals.push(diffDays(datasClinicos[i-1], datasClinicos[i]))
        }
        frequenciaMedia = Math.round(intervals.reduce((s,v)=>s+v,0) / intervals.length)
      }

      const dataCadastro = t.createdAt || null
      const diasCadastrado = dataCadastro ? diffDays(dataCadastro, today) : 365
      const classificacao = classificarCliente(diasSemVisita, gasto90, crmConfig, diasCadastrado)

      // Melhor mês de visita
      const visitasPorMes = {}
      for (const d of datasClinicos) {
        const m = d?.slice(5,7)
        if (m) visitasPorMes[m] = (visitasPorMes[m]||0) + 1
      }
      const melhorMes = Object.entries(visitasPorMes).sort((a,b)=>b[1]-a[1])[0]?.[0]

      return {
        ...t,
        nome: t.name || t.nome || 'Sem nome',
        pets: meusPets,
        ultimaVisita,
        diasSemVisita,
        gasto90,
        gastoTotal,
        totalAtendimentos: datasClinicos.length,
        totalCompras: minhasVendas.length,
        frequenciaMedia,
        classificacao,
        melhorMes: melhorMes ? MONTHS_SHORT[Number(melhorMes)-1] : null,
        vendaRecent: minhasVendas.length > 0,
        dataCadastro,
        datasClinicos,
      }
    })
  }, [tutores, pets, prontuarios, agendamentos, vendas, crmConfig, today])

  return clientesProcessados
}

// ── Tab: Dashboard CRM ────────────────────────────────────────────────────────

function DashboardCRM({ clientes }) {
  const today = todayISO()
  const thisMonth = today.slice(0,7)

  const ativos    = clientes.filter(c=>c.diasSemVisita<=90).length
  const novos     = clientes.filter(c=>c.classificacao==='novo').length
  const risco     = clientes.filter(c=>c.classificacao==='risco').length
  const inativos  = clientes.filter(c=>c.classificacao==='inativo').length

  const total = clientes.length
  const retencao = total > 0 ? Math.round(ativos/total*100) : 0
  const ltv = total > 0 ? clientes.reduce((s,c)=>s+c.gastoTotal,0) / total : 0
  const ticketMedio = (() => {
    const totalCompras = clientes.reduce((s,c)=>s+c.totalCompras,0)
    const totalGasto   = clientes.reduce((s,c)=>s+c.gastoTotal,0)
    return totalCompras > 0 ? totalGasto/totalCompras : 0
  })()

  // Novos clientes por mês (últimos 12)
  const meses12 = []
  for (let i=11; i>=0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth()-i)
    meses12.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
  }

  // Distribution por classificação
  const distrib = {}
  for (const c of clientes) distrib[c.classificacao] = (distrib[c.classificacao]||0)+1

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* KPI cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10 }}>
        {[
          { label:'Clientes ativos',   val:ativos,    sub:'visitaram nos últimos 90 dias',    color:'#22c55e' },
          { label:'Clientes novos',    val:novos,     sub:'cadastrados há menos de 30 dias',  color:'var(--teal)' },
          { label:'Em risco',          val:risco,     sub:'90–180 dias sem visita',            color:'#f59e0b' },
          { label:'Inativos',          val:inativos,  sub:'mais de 180 dias sem visita',       color:'#ef4444' },
          { label:'Taxa de retenção',  val:`${retencao}%`, sub:'clientes ativos / total',     color:'var(--teal)' },
          { label:'LTV médio',         val:fmt(ltv),  sub:'lifetime value médio',              color:'var(--text-primary)' },
          { label:'Ticket médio',      val:fmt(ticketMedio), sub:'por compra no PDV',         color:'var(--text-primary)' },
        ].map(c=>(
          <div key={c.label} className="card" style={{ padding:'12px 16px' }}>
            <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:4 }}>{c.label}</div>
            <div style={{ fontSize:'1.25rem', fontWeight:700, color:c.color }}>{c.val}</div>
            <div style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Distribuição por classificação */}
      <div className="card" style={{ padding:'16px' }}>
        <p style={{ fontWeight:700, fontSize:'0.9375rem', color:'var(--text-primary)', marginBottom:14 }}>Distribuição por classificação</p>
        {Object.entries(BADGE_CONFIG).map(([tipo, cfg])=>{
          const n = distrib[tipo]||0
          const pct = total > 0 ? n/total*100 : 0
          return (
            <div key={tipo} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <span style={{ width:90, fontSize:'0.8125rem', display:'flex', alignItems:'center', gap:4 }}>
                {cfg.emoji} {cfg.label}
              </span>
              <div style={{ flex:1, height:18, borderRadius:4, background:'var(--border)', overflow:'hidden' }}>
                <div style={{ width:`${pct}%`, height:'100%', background:cfg.bg, border:`1px solid ${cfg.color}40`, transition:'width .4s', minWidth: pct>0?'4px':0 }}/>
              </div>
              <span style={{ minWidth:30, textAlign:'right', fontSize:'0.8125rem', fontWeight:600, color:cfg.color }}>{n}</span>
              <span style={{ minWidth:36, fontSize:'0.75rem', color:'var(--text-muted)' }}>{pct.toFixed(0)}%</span>
            </div>
          )
        })}
      </div>

      {/* Top 5 VIPs */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'10px 16px', fontWeight:700, borderBottom:'1px solid var(--border)', color:'var(--text-primary)' }}>
          Top clientes por LTV
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8125rem' }}>
          <thead>
            <tr style={{ borderBottom:'2px solid var(--border)', background:'var(--surface-2)' }}>
              {['#','Cliente','Pets','Total gasto','Atendimentos','Classificação'].map(h=>(
                <th key={h} style={{ padding:'8px 12px', textAlign: h==='Total gasto'||h==='Atendimentos'?'right':'left', color:'var(--text-muted)', fontWeight:700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...clientes].sort((a,b)=>b.gastoTotal-a.gastoTotal).slice(0,10).map((c,i)=>(
              <tr key={c.id} style={{ borderBottom:'1px solid var(--border)' }}>
                <td style={{ padding:'8px 12px', color:'var(--text-muted)', fontWeight:700 }}>{i+1}</td>
                <td style={{ padding:'8px 12px', color:'var(--text-primary)', fontWeight:600 }}>{c.nome}</td>
                <td style={{ padding:'8px 12px', color:'var(--text-muted)', fontSize:'0.75rem' }}>{c.pets.map(p=>p.name||p.nome).join(', ')||'—'}</td>
                <td style={{ padding:'8px 12px', textAlign:'right', fontFamily:'monospace', color:'var(--text-primary)' }}>{fmt(c.gastoTotal)}</td>
                <td style={{ padding:'8px 12px', textAlign:'right', color:'var(--text-muted)' }}>{c.totalAtendimentos}</td>
                <td style={{ padding:'8px 12px' }}><Badge tipo={c.classificacao}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab: Lista de clientes ────────────────────────────────────────────────────

function ListaClientes({ clientes, crmConfig }) {
  const [search, setSearch] = useState('')
  const [filtroClass, setFiltroClass] = useState('todos')
  const [filtroEspecie, setFiltroEspecie] = useState('')
  const [sortBy, setSortBy] = useState('nome')
  const [sortDir, setSortDir] = useState('asc')
  const [selectedCliente, setSelectedCliente] = useState(null)
  const [contatos, setContatos] = usePersistentState('petvet-crm-contatos', [])

  const filtered = useMemo(() => {
    let list = clientes
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.nome.toLowerCase().includes(q) ||
        (c.cpf||'').includes(q) ||
        c.pets.some(p => (p.name||p.nome||'').toLowerCase().includes(q))
      )
    }
    if (filtroClass !== 'todos') list = list.filter(c=>c.classificacao===filtroClass)
    if (filtroEspecie) list = list.filter(c=>c.pets.some(p=>p.species===filtroEspecie))
    return [...list].sort((a,b)=>{
      let va, vb
      if (sortBy==='nome') { va=a.nome; vb=b.nome }
      else if (sortBy==='ultimaVisita') { va=a.ultimaVisita||''; vb=b.ultimaVisita||'' }
      else if (sortBy==='gastoTotal') { va=a.gastoTotal; vb=b.gastoTotal }
      else { va=a.diasSemVisita; vb=b.diasSemVisita }
      if (typeof va==='string') return sortDir==='asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      return sortDir==='asc' ? va-vb : vb-va
    })
  }, [clientes, search, filtroClass, filtroEspecie, sortBy, sortDir])

  const especies = [...new Set(clientes.flatMap(c=>c.pets.map(p=>p.species)).filter(Boolean))]

  function toggleSort(field) {
    if (sortBy===field) setSortDir(d=>d==='asc'?'desc':'asc')
    else { setSortBy(field); setSortDir('asc') }
  }
  function SortIcon({ field }) {
    if (sortBy!==field) return null
    return sortDir==='asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>
  }

  function buildMsg(tipo, cliente) {
    const cfg = crmConfig
    const pet  = cliente.pets[0]
    const nome = cliente.nome
    const petNome = pet?.name || pet?.nome || 'seu pet'
    const dias = cliente.diasSemVisita
    let msg = ''
    if (tipo==='inativo') msg = cfg.msgInativo
    else if (tipo==='aniversario') msg = cfg.msgAniversario
    else if (tipo==='vip') msg = cfg.msgVIP
    else msg = cfg.msgInativo
    return msg
      .replace(/\{tutor\}/g, nome)
      .replace(/\{pet\}/g, petNome)
      .replace(/\{dias\}/g, String(dias))
  }

  function enviarWhatsApp(cliente, tipoMsg) {
    const telefone = (cliente.phone || cliente.celular || cliente.telefone || '').replace(/\D/g,'')
    if (!telefone) { alert('Cliente sem telefone cadastrado'); return }
    const phone = telefone.startsWith('55') && telefone.length>=12 ? telefone : '55'+telefone
    const msg = buildMsg(tipoMsg, cliente)
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
    // Register contact
    setContatos(p=>[...p, { id:`ct${Date.now()}`, tutorId:cliente.id, tipo:tipoMsg, mensagem:msg, dataMensagem:new Date().toISOString() }])
  }

  function marcarContatado(clienteId) {
    setContatos(p=>[...p, { id:`ct${Date.now()}`, tutorId:clienteId, tipo:'manual', mensagem:'', dataMensagem:new Date().toISOString() }])
  }

  function handleExportCSV() {
    exportCSV('clientes-crm',
      ['Nome','CPF','Telefone','Pets','Classificação','Última visita','Dias sem visita','Gasto total','Atendimentos'],
      filtered.map(c=>[
        c.nome, c.cpf||'', c.phone||c.telefone||'',
        c.pets.map(p=>p.name||p.nome).join(', '),
        BADGE_CONFIG[c.classificacao]?.label||c.classificacao,
        c.ultimaVisita ? fmtDate(c.ultimaVisita) : 'Nunca',
        c.diasSemVisita===9999?'Nunca':c.diasSemVisita,
        c.gastoTotal.toFixed(2), c.totalAtendimentos,
      ])
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Filters */}
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <Search size={15} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
          <input className="form-input" style={{ paddingLeft:34 }} placeholder="Buscar por nome, CPF ou pet..."
            value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="form-input" style={{ width:160 }} value={filtroClass}
          onChange={e=>setFiltroClass(e.target.value)}>
          <option value="todos">Todas classificações</option>
          {Object.entries(BADGE_CONFIG).map(([k,v])=>(
            <option key={k} value={k}>{v.emoji} {v.label}</option>
          ))}
        </select>
        {especies.length > 0 && (
          <select className="form-input" style={{ width:130 }} value={filtroEspecie}
            onChange={e=>setFiltroEspecie(e.target.value)}>
            <option value="">Todas espécies</option>
            {especies.map(e=><option key={e} value={e}>{e}</option>)}
          </select>
        )}
        <button className="btn btn-outline btn-sm" onClick={handleExportCSV}><Download size={14}/> CSV</button>
      </div>

      <div style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>{filtered.length} clientes</div>

      {/* Table */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8125rem', minWidth:760 }}>
            <thead>
              <tr style={{ borderBottom:'2px solid var(--border)', background:'var(--surface-2)' }}>
                {[
                  { label:'Cliente', field:'nome' },
                  { label:'Pets', field:null },
                  { label:'Classificação', field:null },
                  { label:'Última visita', field:'ultimaVisita' },
                  { label:'Gasto total', field:'gastoTotal' },
                  { label:'Frequência', field:'diasSemVisita' },
                  { label:'Ações', field:null },
                ].map(h=>(
                  <th key={h.label} style={{ padding:'8px 12px', textAlign:'left', color:'var(--text-muted)', fontWeight:700,
                    cursor: h.field?'pointer':'default', userSelect:'none', whiteSpace:'nowrap' }}
                    onClick={()=>h.field && toggleSort(h.field)}>
                    {h.label} {h.field && <SortIcon field={h.field}/>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 ? (
                <tr><td colSpan={7} style={{ padding:'32px', textAlign:'center', color:'var(--text-muted)' }}>Nenhum cliente encontrado</td></tr>
              ) : filtered.map(c=>(
                <tr key={c.id} style={{ borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                  onClick={()=>setSelectedCliente(c)}>
                  <td style={{ padding:'10px 12px' }}>
                    <div style={{ fontWeight:600, color:'var(--text-primary)' }}>{c.nome}</div>
                    {(c.phone||c.telefone) && <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{c.phone||c.telefone}</div>}
                  </td>
                  <td style={{ padding:'10px 12px', color:'var(--text-muted)', fontSize:'0.75rem' }}>
                    {c.pets.slice(0,3).map(p=>p.name||p.nome).join(', ')}
                    {c.pets.length>3 && ` +${c.pets.length-3}`}
                  </td>
                  <td style={{ padding:'10px 12px' }}><Badge tipo={c.classificacao}/></td>
                  <td style={{ padding:'10px 12px', color:'var(--text-muted)', whiteSpace:'nowrap' }}>
                    {c.ultimaVisita ? (
                      <>
                        <div>{fmtDate(c.ultimaVisita)}</div>
                        <div style={{ fontSize:'0.72rem' }}>há {c.diasSemVisita} dias</div>
                      </>
                    ) : 'Nunca visitou'}
                  </td>
                  <td style={{ padding:'10px 12px', fontFamily:'monospace', color:'var(--text-primary)', fontWeight:600 }}>
                    {fmt(c.gastoTotal)}
                  </td>
                  <td style={{ padding:'10px 12px', color:'var(--text-muted)', fontSize:'0.75rem' }}>
                    {c.frequenciaMedia ? `a cada ${c.frequenciaMedia} dias` : '—'}
                  </td>
                  <td style={{ padding:'10px 12px' }}>
                    <div style={{ display:'flex', gap:4 }} onClick={e=>e.stopPropagation()}>
                      <button className="btn btn-ghost btn-icon" title="Enviar WhatsApp"
                        style={{ padding:5, color:'#22c55e' }}
                        onClick={()=>enviarWhatsApp(c, c.classificacao==='inativo'||c.classificacao==='risco' ? 'inativo' : 'vip')}>
                        <MessageCircle size={14}/>
                      </button>
                      <button className="btn btn-ghost btn-icon" title="Marcar como contatado"
                        style={{ padding:5, color:'var(--teal)' }}
                        onClick={()=>marcarContatado(c.id)}>
                        <Check size={14}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Perfil do cliente (modal-style) */}
      {selectedCliente && (
        <ClientePerfil cliente={selectedCliente} contatos={contatos} onClose={()=>setSelectedCliente(null)}
          enviarWhatsApp={enviarWhatsApp}/>
      )}
    </div>
  )
}

// ── Perfil completo do cliente ────────────────────────────────────────────────

function ClientePerfil({ cliente, contatos, onClose, enviarWhatsApp }) {
  const c = cliente
  const meusContatos = contatos.filter(ct=>ct.tutorId===c.id)
  const ultimoContato = meusContatos.sort((a,b)=>b.dataMensagem.localeCompare(a.dataMensagem))[0]

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1200, display:'flex', alignItems:'flex-start', justifyContent:'flex-end', padding:16 }}
      onClick={onClose}>
      <div style={{ width:'100%', maxWidth:520, background:'var(--surface)', borderRadius:16, boxShadow:'var(--shadow-lg)', overflow:'auto', maxHeight:'calc(100vh - 32px)' }}
        onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontWeight:700, fontSize:'1.0625rem', color:'var(--text-primary)' }}>{c.nome}</div>
            <div style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginTop:2 }}>
              {c.cpf && <span style={{ marginRight:12 }}>{c.cpf}</span>}
              {(c.phone||c.telefone) && <span>{c.phone||c.telefone}</span>}
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <Badge tipo={c.classificacao}/>
            <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18}/></button>
          </div>
        </div>

        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:16 }}>
          {/* Dados cadastrais */}
          <div>
            <p style={{ fontWeight:700, fontSize:'0.875rem', color:'var(--text-primary)', marginBottom:8 }}>Dados cadastrais</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:'0.8125rem' }}>
              {[
                ['Email',    c.email||'—'],
                ['Endereço', c.address||c.endereco||'—'],
                ['Cadastro', c.dataCadastro ? fmtDate(c.dataCadastro) : '—'],
                ['Tempo cliente', c.dataCadastro ? `${Math.floor(diffDays(c.dataCadastro, todayISO())/30)} meses` : '—'],
              ].map(([k,v])=>(
                <div key={k}>
                  <div style={{ color:'var(--text-muted)', fontSize:'0.72rem' }}>{k}</div>
                  <div style={{ color:'var(--text-primary)', fontWeight:500, wordBreak:'break-all' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Pets */}
          <div>
            <p style={{ fontWeight:700, fontSize:'0.875rem', color:'var(--text-primary)', marginBottom:8 }}>Pets ({c.pets.length})</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {c.pets.map(p=>(
                <div key={p.id} style={{ display:'flex', gap:10, alignItems:'center', padding:'8px 12px', background:'var(--surface-2)', borderRadius:8 }}>
                  {p.foto ? (
                    <img src={p.foto} alt={p.name||p.nome} style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/>
                  ) : (
                    <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--teal-light)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--teal)', fontWeight:700, fontSize:'1rem', flexShrink:0 }}>
                      {(p.name||p.nome||'?')[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight:600, fontSize:'0.875rem', color:'var(--text-primary)' }}>{p.name||p.nome}</div>
                    <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>
                      {p.species} {p.breed && `· ${p.breed}`} {p.birthDate && `· ${new Date().getFullYear() - new Date(p.birthDate).getFullYear()} anos`}
                    </div>
                    <div style={{ fontSize:'0.72rem' }}>
                      <span style={{ color: p.vacinacao==='Em dia'?'#22c55e':'#f59e0b', fontWeight:600 }}>Vacinas: {p.vacinacao||'—'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Histórico financeiro */}
          <div>
            <p style={{ fontWeight:700, fontSize:'0.875rem', color:'var(--text-primary)', marginBottom:8 }}>Histórico financeiro</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:'0.8125rem' }}>
              {[
                ['LTV (total gasto)',     fmt(c.gastoTotal)],
                ['Gasto últimos 90d',     fmt(c.gasto90)],
                ['Total atendimentos',    String(c.totalAtendimentos)],
                ['Compras no PDV',        String(c.totalCompras)],
              ].map(([k,v])=>(
                <div key={k} style={{ padding:'8px 12px', background:'var(--surface-2)', borderRadius:8 }}>
                  <div style={{ color:'var(--text-muted)', fontSize:'0.72rem' }}>{k}</div>
                  <div style={{ fontWeight:700, color:'var(--text-primary)' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Frequência e engajamento */}
          <div>
            <p style={{ fontWeight:700, fontSize:'0.875rem', color:'var(--text-primary)', marginBottom:8 }}>Frequência e engajamento</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:'0.8125rem' }}>
              {[
                ['Última visita',        c.ultimaVisita ? `há ${c.diasSemVisita} dias` : 'Nunca'],
                ['Frequência média',     c.frequenciaMedia ? `a cada ${c.frequenciaMedia} dias` : '—'],
                ['Melhor mês',           c.melhorMes || '—'],
                ['Último contato CRM',   ultimoContato ? new Date(ultimoContato.dataMensagem).toLocaleDateString('pt-BR') : 'Nunca'],
              ].map(([k,v])=>(
                <div key={k} style={{ padding:'8px 12px', background:'var(--surface-2)', borderRadius:8 }}>
                  <div style={{ color:'var(--text-muted)', fontSize:'0.72rem' }}>{k}</div>
                  <div style={{ fontWeight:600, color:'var(--text-primary)' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Ações */}
          <div>
            <p style={{ fontWeight:700, fontSize:'0.875rem', color:'var(--text-primary)', marginBottom:8 }}>Enviar mensagem</p>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {[
                { tipo:'inativo',      label:'Reengajamento',  show: c.classificacao==='inativo'||c.classificacao==='risco' },
                { tipo:'aniversario',  label:'Aniversário pet', show:true },
                { tipo:'vip',          label:'Oferta VIP',     show: c.classificacao==='vip' },
              ].filter(a=>a.show).map(a=>(
                <button key={a.tipo} className="btn btn-outline btn-sm"
                  style={{ color:'#22c55e', borderColor:'#22c55e' }}
                  onClick={()=>enviarWhatsApp(c, a.tipo)}>
                  <MessageCircle size={13}/> {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Histórico contatos */}
          {meusContatos.length>0 && (
            <div>
              <p style={{ fontWeight:700, fontSize:'0.875rem', color:'var(--text-primary)', marginBottom:8 }}>Histórico de contatos CRM</p>
              {[...meusContatos].sort((a,b)=>b.dataMensagem.localeCompare(a.dataMensagem)).slice(0,5).map(ct=>(
                <div key={ct.id} style={{ padding:'6px 12px', background:'var(--surface-2)', borderRadius:6, marginBottom:4, fontSize:'0.75rem', color:'var(--text-muted)' }}>
                  {new Date(ct.dataMensagem).toLocaleString('pt-BR')} · {ct.tipo||'manual'}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tab: Relatórios CRM ───────────────────────────────────────────────────────

function RelatoriosCRM({ clientes }) {
  const today = todayISO()
  const thisMonth = today.slice(5,7)
  const thisYear  = today.slice(0,4)

  const pets = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('petvet-pets')||'[]') } catch { return [] }
  }, [])

  // Aniversariantes do mês — pets
  const anivPets = pets.filter(p => {
    if (!p.birthDate) return false
    return p.birthDate.slice(5,7) === thisMonth
  }).map(p => {
    const t = clientes.find(c => c.pets.some(cp => cp.id===p.id))
    return { ...p, nomeDisplay:p.name||p.nome||'', tutor:t?.nome||'—', telefone:t?.phone||t?.telefone||'' }
  })

  // RFM simplificado
  const rfm = useMemo(() => {
    return clientes.map(c => {
      const r = c.diasSemVisita===9999 ? 0 : Math.max(0, 5 - Math.floor(c.diasSemVisita/30))
      const f = Math.min(5, c.totalAtendimentos)
      const m = c.gastoTotal>=1000?5 : c.gastoTotal>=500?4 : c.gastoTotal>=200?3 : c.gastoTotal>=50?2 : c.gastoTotal>0?1:0
      const score = r+f+m
      return { ...c, rfmR:r, rfmF:f, rfmM:m, rfmScore:score }
    })
  }, [clientes])

  // Retenção por mês
  const retencao = useMemo(() => {
    const meses = []
    for (let i=5; i>=0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth()-i)
      const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      const visitaram = clientes.filter(c =>
        c.datasClinicos.some(v=>v && v.startsWith(ym))
      ).length
      meses.push({ ym, mes:MONTHS_SHORT[d.getMonth()], visitaram, total:clientes.length })
    }
    return meses
  }, [clientes])

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Aniversariantes */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'10px 16px', fontWeight:700, borderBottom:'1px solid var(--border)', color:'var(--text-primary)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          Aniversariantes do mês — Pets ({MONTHS_PT[Number(thisMonth)-1]})
          <button className="btn btn-ghost btn-sm" onClick={()=>
            exportCSV('aniversariantes', ['Pet','Espécie','Data','Tutor','Telefone'],
              anivPets.map(p=>[p.nomeDisplay, p.species||'', p.birthDate||'', p.tutor, p.telefone]))
          }><Download size={13}/> CSV</button>
        </div>
        {anivPets.length===0 ? (
          <div style={{ padding:'24px', textAlign:'center', color:'var(--text-muted)', fontSize:'0.875rem' }}>Nenhum aniversariante este mês</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom:'2px solid var(--border)', background:'var(--surface-2)' }}>
                {['Pet','Espécie','Data aniversário','Tutor','Telefone','WhatsApp'].map(h=>(
                  <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'var(--text-muted)', fontWeight:700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {anivPets.map(p=>(
                <tr key={p.id} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'6px 12px', fontWeight:600, color:'var(--text-primary)' }}>{p.nomeDisplay}</td>
                  <td style={{ padding:'6px 12px', color:'var(--text-muted)' }}>{p.species||'—'}</td>
                  <td style={{ padding:'6px 12px', color:'var(--text-muted)' }}>
                    {p.birthDate ? new Date(p.birthDate+'T00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) : '—'}
                  </td>
                  <td style={{ padding:'6px 12px', color:'var(--text-primary)' }}>{p.tutor}</td>
                  <td style={{ padding:'6px 12px', color:'var(--text-muted)', fontFamily:'monospace' }}>{p.telefone||'—'}</td>
                  <td style={{ padding:'6px 12px' }}>
                    {p.telefone && (
                      <button className="btn btn-ghost btn-icon" style={{ padding:4, color:'#22c55e' }} onClick={()=>{
                        const tel = p.telefone.replace(/\D/g,'')
                        const phone = tel.startsWith('55')&&tel.length>=12?tel:'55'+tel
                        const msg = `Feliz aniversário para ${p.nomeDisplay}! 🎂🐾 Parabéns pelo dia especial!`
                        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
                      }}><MessageCircle size={14}/></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Retenção mensal */}
      <div className="card" style={{ padding:'16px' }}>
        <p style={{ fontWeight:700, fontSize:'0.9375rem', color:'var(--text-primary)', marginBottom:12 }}>Retenção mensal (últimos 6 meses)</p>
        <div style={{ display:'flex', gap:8, alignItems:'flex-end', height:120 }}>
          {retencao.map(r=>{
            const pct = r.total>0 ? r.visitaram/r.total*100 : 0
            return (
              <div key={r.ym} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:600 }}>{pct.toFixed(0)}%</div>
                <div style={{ width:'100%', background:'var(--teal)', borderRadius:'4px 4px 0 0', minHeight:4,
                  height:`${Math.max(pct,2)}px`, maxHeight:90, transition:'height .3s' }}/>
                <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{r.mes}</div>
                <div style={{ fontSize:'0.68rem', color:'var(--text-muted)' }}>{r.visitaram}/{r.total}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* RFM */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'10px 16px', fontWeight:700, borderBottom:'1px solid var(--border)', color:'var(--text-primary)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          Análise RFM — Recência, Frequência, Monetário
          <button className="btn btn-ghost btn-sm" onClick={()=>
            exportCSV('rfm', ['Cliente','Recência (R)','Frequência (F)','Monetário (M)','Score'],
              [...rfm].sort((a,b)=>b.rfmScore-a.rfmScore).map(c=>[c.nome,c.rfmR,c.rfmF,c.rfmM,c.rfmScore]))
          }><Download size={13}/> CSV</button>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8125rem', minWidth:600 }}>
            <thead>
              <tr style={{ borderBottom:'2px solid var(--border)', background:'var(--surface-2)' }}>
                {['Cliente','Recência (R)','Frequência (F)','Monetário (M)','Score','Classificação'].map(h=>(
                  <th key={h} style={{ padding:'8px 12px', textAlign: ['Recência (R)','Frequência (F)','Monetário (M)','Score'].includes(h)?'center':'left', color:'var(--text-muted)', fontWeight:700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...rfm].sort((a,b)=>b.rfmScore-a.rfmScore).slice(0,20).map(c=>(
                <tr key={c.id} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'6px 12px', fontWeight:600, color:'var(--text-primary)' }}>{c.nome}</td>
                  <td style={{ padding:'6px 12px', textAlign:'center' }}>
                    <RFMDot val={c.rfmR}/>
                  </td>
                  <td style={{ padding:'6px 12px', textAlign:'center' }}>
                    <RFMDot val={c.rfmF}/>
                  </td>
                  <td style={{ padding:'6px 12px', textAlign:'center' }}>
                    <RFMDot val={c.rfmM}/>
                  </td>
                  <td style={{ padding:'6px 12px', textAlign:'center', fontWeight:700, color:'var(--text-primary)' }}>{c.rfmScore}</td>
                  <td style={{ padding:'6px 12px' }}><Badge tipo={c.classificacao}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clientes em risco */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'10px 16px', fontWeight:700, borderBottom:'1px solid var(--border)', color:'var(--text-primary)', display:'flex', alignItems:'center', gap:8 }}>
          <AlertTriangle size={16} color="#f59e0b"/> Clientes em risco de churn
          <button className="btn btn-ghost btn-sm" style={{ marginLeft:'auto' }} onClick={()=>
            exportCSV('clientes-risco', ['Nome','Telefone','Última visita','Dias sem visita'],
              clientes.filter(c=>c.classificacao==='risco'||c.classificacao==='inativo')
                .map(c=>[c.nome, c.phone||c.telefone||'', c.ultimaVisita?fmtDate(c.ultimaVisita):'Nunca', c.diasSemVisita===9999?'N/A':c.diasSemVisita]))
          }><Download size={13}/> CSV</button>
        </div>
        {clientes.filter(c=>c.classificacao==='risco'||c.classificacao==='inativo').length===0 ? (
          <div style={{ padding:'24px', textAlign:'center', color:'var(--text-muted)', fontSize:'0.875rem' }}>Nenhum cliente em risco</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom:'2px solid var(--border)', background:'var(--surface-2)' }}>
                {['Cliente','Classificação','Última visita','Dias sem visita','Ação'].map(h=>(
                  <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'var(--text-muted)', fontWeight:700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientes.filter(c=>c.classificacao==='risco'||c.classificacao==='inativo')
                .sort((a,b)=>b.diasSemVisita-a.diasSemVisita).map(c=>(
                  <tr key={c.id} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'8px 12px', fontWeight:600, color:'var(--text-primary)' }}>{c.nome}</td>
                    <td style={{ padding:'8px 12px' }}><Badge tipo={c.classificacao}/></td>
                    <td style={{ padding:'8px 12px', color:'var(--text-muted)' }}>{c.ultimaVisita?fmtDate(c.ultimaVisita):'Nunca'}</td>
                    <td style={{ padding:'8px 12px', fontWeight:700, color:'#ef4444' }}>{c.diasSemVisita===9999?'N/A':c.diasSemVisita}</td>
                    <td style={{ padding:'8px 12px' }}>
                      {(c.phone||c.telefone) && (
                        <button className="btn btn-outline btn-sm" style={{ fontSize:'0.72rem', color:'#22c55e', borderColor:'#22c55e' }}
                          onClick={()=>{
                            const tel=(c.phone||c.telefone||'').replace(/\D/g,'')
                            const phone=tel.startsWith('55')&&tel.length>=12?tel:'55'+tel
                            const petNome=(c.pets[0]?.name||c.pets[0]?.nome||'seu pet')
                            const msg=`Olá, ${c.nome}! Saudades de vocês! Faz ${c.diasSemVisita} dias que ${petNome} não nos visita. Que tal agendar? 🐾`
                            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
                          }}>
                          <MessageCircle size={12}/> WhatsApp
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function RFMDot({ val }) {
  const colors = ['#e5e7eb','#fca5a5','#fdba74','#fcd34d','#86efac','#4ade80']
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:2 }}>
      {[1,2,3,4,5].map(i=>(
        <span key={i} style={{ width:8, height:8, borderRadius:'50%', background: i<=val ? colors[val] : 'var(--border)' }}/>
      ))}
    </span>
  )
}

// ── Tab: Configurações CRM ────────────────────────────────────────────────────

function ConfigCRM({ crmConfig, setCrmConfig }) {
  const [form, setForm] = useState({ ...crmConfig })
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setCrmConfig(form)
    setSaved(true)
    setTimeout(()=>setSaved(false), 2500)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:640 }}>
      <div className="card" style={{ padding:'16px' }}>
        <p style={{ fontWeight:700, fontSize:'0.9375rem', color:'var(--text-primary)', marginBottom:14 }}>Regras de classificação</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          {[
            { field:'thresholdVIP',       label:'LTV 90 dias para VIP (R$)',      unit:'R$' },
            { field:'thresholdFrequente', label:'Frequência máx para Frequente (dias)', unit:'dias' },
            { field:'thresholdRisco',     label:'Dias sem visita = Em risco',      unit:'dias' },
            { field:'thresholdInativo',   label:'Dias sem visita = Inativo',       unit:'dias' },
          ].map(f=>(
            <div key={f.field} className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">{f.label}</label>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <input type="number" className="form-input" value={form[f.field]}
                  onChange={e=>setForm(prev=>({...prev,[f.field]:Number(e.target.value)}))}/>
                <span style={{ fontSize:'0.8125rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{f.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding:'16px' }}>
        <p style={{ fontWeight:700, fontSize:'0.9375rem', color:'var(--text-primary)', marginBottom:14 }}>Mensagens modelo WhatsApp</p>
        <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:12 }}>
          Variáveis: <code>{'{tutor}'}</code> <code>{'{pet}'}</code> <code>{'{dias}'}</code>
        </p>
        {[
          { field:'msgInativo',     label:'Reengajamento (cliente inativo/em risco)' },
          { field:'msgAniversario', label:'Aniversário do pet' },
          { field:'msgVIP',        label:'Oferta VIP' },
        ].map(f=>(
          <div key={f.field} className="form-group">
            <label className="form-label">{f.label}</label>
            <textarea className="form-input" rows={3} style={{ resize:'vertical', fontFamily:'inherit' }}
              value={form[f.field]} onChange={e=>setForm(prev=>({...prev,[f.field]:e.target.value}))}/>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button className="btn btn-primary" onClick={handleSave}>
          <TrendingUp size={15}/> {saved ? 'Salvo!' : 'Salvar configurações CRM'}
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS = [
  { id:'dashboard', label:'Dashboard', icon:<BarChart2 size={15}/> },
  { id:'clientes',  label:'Clientes',  icon:<Users size={15}/> },
  { id:'relatorios',label:'Relatórios',icon:<FileText size={15}/> },
  { id:'config',    label:'Configurações', icon:<Star size={15}/> },
]

export default function CRMPage() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [crmConfig, setCrmConfig] = usePersistentState('petvet-crm-config', DEFAULT_CRM_CONFIG)

  const clientes = useCRMData(crmConfig)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">CRM — Clientes</h2>
          <p className="page-subtitle">Relacionamento, retenção e engajamento de clientes</p>
        </div>
        <div style={{ fontSize:'0.8125rem', color:'var(--text-muted)', alignSelf:'center' }}>
          {clientes.length} clientes cadastrados
        </div>
      </div>

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab}/>

      <div style={{ marginTop:16 }}>
        {activeTab==='dashboard'  && <DashboardCRM clientes={clientes}/>}
        {activeTab==='clientes'   && <ListaClientes clientes={clientes} crmConfig={crmConfig}/>}
        {activeTab==='relatorios' && <RelatoriosCRM clientes={clientes}/>}
        {activeTab==='config'     && <ConfigCRM crmConfig={crmConfig} setCrmConfig={setCrmConfig}/>}
      </div>
    </div>
  )
}
