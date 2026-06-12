import { useState, useMemo } from 'react'
import { Search, Plus, Minus, Trash2, ShoppingCart, X, Check, Printer } from 'lucide-react'
import Modal from '../components/ui/Modal'
import AccessDenied from '../components/ui/AccessDenied'
import { TUTORES, PETS, PRODUTOS, SERVICOS_CATALOGO, LANCAMENTOS } from '../data/mock'
import { normIncludes } from '../utils/normalizeText'
import { usePersistentState } from '../hooks/usePersistentState'
import { useAuth } from '../context/AuthContext'

const PAYMENT_METHODS = [
  { id: 'pix',     label: 'PIX' },
  { id: 'debito',  label: 'Cartão Débito' },
  { id: 'credito', label: 'Cartão Crédito' },
  { id: 'dinheiro',label: 'Dinheiro' },
  { id: 'parcelado',label: 'Parcelado' },
]

const CATALOG_CATS = ['Produtos', 'Serviços', 'Consultas']

function fmtBRL(v) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function fmtDate(iso) {
  return new Date(iso + 'T00:00').toLocaleDateString('pt-BR')
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function yesterdayISO() {
  const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]
}

function daysAgoISO(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]
}

/**
 * Busca preço em ordem de prioridade: Protocolo/Estoque/Catálogo/Bulário
 * Retorna { price: Number, source: string, domFallback?: boolean } ou null.
 * Para consulta/servico domiciliar: tenta petvet-servicos-domicilio antes do catálogo.
 */
function buscarPreco(searchName, tipo, produtosList, tipoAtendimento = 'presencial') {
  const toNum = v => { const n = Number(v); return isNaN(n) || n <= 0 ? null : n }
  const matchProd = name => produtosList.find(p =>
    normIncludes(p.name, name) || normIncludes(name, p.name)
  )
  const getSvcs = () => {
    try { return JSON.parse(localStorage.getItem('petvet-catalogo') ?? '[]') } catch { return [] }
  }
  const getDomSvcs = () => {
    try { return JSON.parse(localStorage.getItem('petvet-servicos-domicilio') ?? '[]') } catch { return [] }
  }
  const matchServ = name => getSvcs().find(s =>
    normIncludes(s.name, name) || normIncludes(name, s.name)
  )
  const matchDomServ = name => getDomSvcs().find(s =>
    normIncludes(s.name, name) || normIncludes(name, s.name)
  )

  if (tipo === 'consulta') {
    if (tipoAtendimento === 'domiciliar') {
      const domSrv = matchDomServ(searchName)
      const dv = toNum(domSrv?.price)
      if (dv !== null) return { price: dv, source: 'Domiciliar' }
      const srv = matchServ(searchName)
      const sv = toNum(srv?.price)
      if (sv !== null) return { price: sv, source: 'Serviço', domFallback: true }
      return null
    }
    const srv = matchServ(searchName)
    const sv = toNum(srv?.price)
    if (sv !== null) return { price: sv, source: 'Serviço' }
    return null
  }

  if (tipo === 'vacina') {
    try {
      const protocols = JSON.parse(localStorage.getItem('petvet-vac-protocols') ?? '[]')
      const proto = protocols.find(p =>
        normIncludes(p.name, searchName) || normIncludes(searchName, p.name)
      )
      const pv = toNum(proto?.precoTotal)
      if (pv !== null) return { price: pv, source: 'Protocolo', proto }
    } catch {}
    const prod = matchProd(searchName)
    const pv = toNum(prod?.salePrice ?? prod?.price)
    if (pv !== null) return { price: pv, source: 'Estoque' }
    return null
  }

  if (tipo === 'aplicacao') {
    const prod = matchProd(searchName)
    const pv = toNum(prod?.salePrice ?? prod?.price)
    if (pv !== null) return { price: pv, source: 'Estoque' }
    try {
      const bulario = JSON.parse(localStorage.getItem('petvet-bulario') ?? '[]')
      const bula = bulario.find(m =>
        normIncludes(m.nomeComercial ?? '', searchName) || normIncludes(searchName, m.nomeComercial ?? '') ||
        normIncludes(m.nomeGenerico ?? '', searchName) || normIncludes(searchName, m.nomeGenerico ?? '')
      )
      const bv = toNum(bula?.price ?? bula?.preco)
      if (bv !== null) return { price: bv, source: 'Bulário' }
    } catch {}
    return null
  }

  if (tipo === 'prescricao') {
    const prod = matchProd(searchName)
    const pv = toNum(prod?.salePrice ?? prod?.price)
    if (pv !== null) return { price: pv, source: 'Estoque' }
    return null
  }

  if (tipo === 'servico') {
    if (tipoAtendimento === 'domiciliar') {
      const domSrv = matchDomServ(searchName)
      const dv = toNum(domSrv?.price)
      if (dv !== null) return { price: dv, source: 'Domiciliar' }
      const srv = matchServ(searchName)
      const sv = toNum(srv?.price)
      if (sv !== null) return { price: sv, source: 'Serviço', domFallback: true }
      return null
    }
    const srv = matchServ(searchName)
    const sv = toNum(srv?.price)
    if (sv !== null) return { price: sv, source: 'Serviço' }
    return null
  }

  return null
}

export default function PDVPage({ navigateTo }) {
  const { hasPermission } = useAuth()
  const [tutor, setTutor] = useState(null)
  const [tutorSearch, setTutorSearch] = useState('')
  const [showTutorDropdown, setShowTutorDropdown] = useState(false)
  const [cart, setCart] = useState([])
  const [catalogTab, setCatalogTab] = useState('Produtos')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [globalDiscount, setGlobalDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState(null)
  const [installments, setInstallments] = useState(2)
  const [juros, setJuros] = useState(0)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [receiptData, setReceiptData] = useState(null)
  const [produtos, setProdutos] = usePersistentState('petvet-produtos', PRODUTOS)
  const [servicos] = usePersistentState('petvet-catalogo', SERVICOS_CATALOGO)
  const [servicosDomicilio] = usePersistentState('petvet-servicos-domicilio', [])
  const [tipoAtend, setTipoAtend] = useState('presencial')
  const [tipoAtendDetected, setTipoAtendDetected] = useState(false)
  const [lancamentos, setLancamentos] = usePersistentState('petvet-lancamentos', LANCAMENTOS)
  const [vendas, setVendas] = usePersistentState('petvet-vendas', [])
  const [prontuarioSugg, setProntuarioSugg] = useState(null)
  const [showPrModal, setShowPrModal] = useState(false)
  const [suggestedItems, setSuggestedItems] = useState([])
  const [activePetId, setActivePetId] = useState(null)
  const [prActiveDate, setPrActiveDate] = useState(todayISO)
  const [expandedDates, setExpandedDates] = useState(() => new Set([todayISO()]))
  const [expandedProtos, setExpandedProtos] = useState(() => new Set())
  const [showPeriodPicker, setShowPeriodPicker] = useState(false)
  const [prPeriodFrom, setPrPeriodFrom] = useState('')
  const [prPeriodTo, setPrPeriodTo] = useState('')

  const tutorResults = tutorSearch.length >= 2
    ? TUTORES.filter(t => normIncludes(t.name, tutorSearch) || t.cpf.includes(tutorSearch))
    : []

  // Catalog items for the selected tab
  const catalogItems = useMemo(() => {
    let items = []
    if (catalogTab === 'Produtos') {
      items = produtos
        .filter(p => p.salePrice > 0 && p.quantity > 0)
        .map(p => ({ id: p.id, name: p.name, category: p.category, price: p.salePrice, unit: p.unit, stock: p.quantity, source: 'produto' }))
    } else {
      const baseFilter = catalogTab === 'Serviços'
        ? s => s.price > 0 && s.category !== 'Consulta'
        : s => s.category === 'Consulta'
      const baseServicos = servicos.filter(baseFilter)

      if (tipoAtend === 'domiciliar') {
        const domList = Array.isArray(servicosDomicilio) ? servicosDomicilio : []
        items = baseServicos.map(s => {
          const domSvc = domList.find(d => normIncludes(d.name, s.name) || normIncludes(s.name, d.name))
          if (domSvc) {
            return { id: domSvc.id ?? `dom-${domSvc.name}`, name: domSvc.name, category: domSvc.category, price: domSvc.price, unit: 'un', stock: 999, source: 'servico', domSource: 'domiciliar' }
          }
          return { id: s.id ?? `svc-${s.name}`, name: s.name, category: s.category, price: s.price, unit: 'un', stock: 999, source: 'servico', domSource: 'fallback' }
        })
      } else {
        items = baseServicos.map(s => ({ id: s.id ?? `svc-${s.name}`, name: s.name, category: s.category, price: s.price, unit: 'un', stock: 999, source: 'servico' }))
      }
    }
    if (catalogSearch) {
      items = items.filter(i => normIncludes(i.name, catalogSearch) || normIncludes(i.category, catalogSearch))
    }
    return items
  }, [catalogTab, catalogSearch, produtos, servicos, servicosDomicilio, tipoAtend])

  function buildProntuarioSugg(tutorObj, { dateFrom, dateTo } = {}) {
    try {
      const all = JSON.parse(localStorage.getItem('petvet-prontuarios') ?? '[]')
      const tutorPets = PETS.filter(p => p.tutorId === tutorObj.id)
      const today = todayISO()
      const from = dateFrom ?? daysAgoISO(30)
      const to = dateTo ?? today

      // Para cada pet, pega TODOS os prontuários não-cancelados no intervalo
      const petsWithPrs = tutorPets.flatMap(pet => {
        const prs = all
          .filter(pr => pr.petId === pet.id && pr.status !== 'cancelado' && pr.date >= from && pr.date <= to)
          .sort((a, b) => b.date.localeCompare(a.date))
        return prs.length ? [{ pet, prs }] : []
      })
      if (!petsWithPrs.length) return null

      const mkItem = (found, base) => ({
        ...base,
        price: found?.price ?? 0,
        editPrice: found ? String(found.price) : '',
        priceSource: found?.source ?? null,
        proto: found?.proto ?? null,
        domFallback: found?.domFallback ?? false,
      })

      const agendamentos = (() => {
        try { return JSON.parse(localStorage.getItem('petvet-agendamentos') ?? '[]') } catch { return [] }
      })()

      const allItems = []
      for (const { pet, prs } of petsWithPrs) {
        for (const pr of prs) {
          const prDate = pr.date
          const isToday = prDate === today

          const apt = agendamentos.find(a => a.petId === pet.id && a.date === prDate)
          const tipoAtend = apt?.tipoAtendimento ?? 'presencial'

          const consultaNome = pr.tipoConsulta ?? 'Consulta Clínica Geral'
          allItems.push(mkItem(
            buscarPreco(consultaNome, 'consulta', produtos, tipoAtend),
            { id: `pr-consulta-${pr.id}`, name: consultaNome, origin: 'Consulta', petId: pet.id, petName: pet.name, prDate, checked: isToday }
          ))

          for (let i = 0; i < (pr.vacinasAplicadas ?? []).length; i++) {
            const v = pr.vacinasAplicadas[i]
            const nome = v.vacina === 'Outra' ? (v.vacinaOutra || 'Vacina') : (v.vacina || 'Vacina')
            allItems.push(mkItem(
              buscarPreco(nome, 'vacina', produtos),
              { id: `pr-vacina-${pr.id}-${i}`, name: nome, origin: 'Vacina', petId: pet.id, petName: pet.name, prDate, checked: isToday }
            ))
          }

          for (let i = 0; i < (pr.aplicacoes ?? []).length; i++) {
            const a = pr.aplicacoes[i]
            const displayName = [a.nome, a.dose].filter(Boolean).join(' — ') || 'Aplicação'
            allItems.push(mkItem(
              buscarPreco(a.nome || displayName, 'aplicacao', produtos),
              { id: `pr-apl-${pr.id}-${i}`, name: displayName, origin: 'Aplicação', petId: pet.id, petName: pet.name, prDate, checked: isToday }
            ))
          }

          for (let i = 0; i < (pr.prescricao?.medicamentos ?? []).length; i++) {
            const m = pr.prescricao.medicamentos[i]
            if (!m.nome) continue
            allItems.push(mkItem(
              buscarPreco(m.nome, 'prescricao', produtos),
              { id: `pr-med-${pr.id}-${i}`, name: [m.nome, m.dose].filter(Boolean).join(' — '), origin: 'Prescrição', petId: pet.id, petName: pet.name, prDate, checked: false }
            ))
          }

          for (let i = 0; i < (pr.procedimentos ?? []).length; i++) {
            const proc = pr.procedimentos[i]
            const nome = proc.servicoId === '__outro' ? proc.nome : (proc.nome || proc.servicoId || '')
            if (!nome) continue
            const vetSuffix = proc.vetNome ? ` — Dr(a). ${proc.vetNome}` : ''
            const displayName = nome + vetSuffix
            const priceFound = proc.preco > 0
              ? { price: Number(proc.preco), source: 'Cirurgia' }
              : buscarPreco(nome, 'servico', produtos, tipoAtend)
            allItems.push(mkItem(
              priceFound,
              { id: `pr-cirurgia-${pr.id}-${i}`, name: displayName, origin: 'Cirurgia', petId: pet.id, petName: pet.name, prDate, checked: isToday }
            ))
          }
        }
      }

      if (!allItems.length) return null
      const uniquePets = [...new Map(petsWithPrs.map(x => [x.pet.id, x.pet])).values()]
      return { pets: uniquePets, items: allItems }
    } catch { return null }
  }

  function selectTutor(t) {
    const today = todayISO()
    setTutor(t)
    setTutorSearch('')
    setShowTutorDropdown(false)
    const sugg = buildProntuarioSugg(t)
    setProntuarioSugg(sugg)
    setSuggestedItems(sugg?.items ?? [])
    setActivePetId(sugg?.pets?.[0]?.id ?? null)
    setPrActiveDate(today)
    setExpandedDates(new Set([today]))
    setExpandedProtos(new Set())
    setShowPeriodPicker(false)
    setPrPeriodFrom('')
    setPrPeriodTo('')
    // Detect tipoAtendimento from today's agendamento
    try {
      const apts = JSON.parse(localStorage.getItem('petvet-agendamentos') ?? '[]')
      const allPetsRaw = JSON.parse(localStorage.getItem('petvet-pets') ?? '[]')
      const petIds = new Set((Array.isArray(allPetsRaw) ? allPetsRaw : PETS).filter(p => p.tutorId === t.id).map(p => p.id))
      const todayApt = apts.find(a => a.date === today && petIds.has(a.petId))
      if (todayApt?.tipoAtendimento) {
        setTipoAtend(todayApt.tipoAtendimento)
        setTipoAtendDetected(true)
      } else {
        setTipoAtendDetected(false)
      }
    } catch { setTipoAtendDetected(false) }
  }

  function clearTutor() {
    setTutor(null)
    setTutorSearch('')
    setProntuarioSugg(null)
    setSuggestedItems([])
    setActivePetId(null)
    setShowPrModal(false)
    setShowPeriodPicker(false)
    setExpandedProtos(new Set())
    setTipoAtend('presencial')
    setTipoAtendDetected(false)
  }

  function toggleSuggItem(id) {
    setSuggestedItems(prev => prev.map(it => it.id === id ? { ...it, checked: !it.checked } : it))
  }

  function updateSuggPrice(id, val) {
    setSuggestedItems(prev => prev.map(it => it.id === id ? { ...it, editPrice: val } : it))
  }

  function toggleAllForDate(date, filterPetId) {
    const groupItems = suggestedItems.filter(it => it.prDate === date && (!filterPetId || it.petId === filterPetId))
    const allChecked = groupItems.every(it => it.checked)
    const ids = new Set(groupItems.map(it => it.id))
    setSuggestedItems(prev => prev.map(it => ids.has(it.id) ? { ...it, checked: !allChecked } : it))
  }

  function toggleDateExpand(date) {
    setExpandedDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  function handleSearchPeriod() {
    if (!tutor || !prPeriodFrom || !prPeriodTo) return
    const sugg = buildProntuarioSugg(tutor, { dateFrom: prPeriodFrom, dateTo: prPeriodTo })
    setProntuarioSugg(sugg)
    setSuggestedItems(sugg?.items ?? [])
    const dates = new Set((sugg?.items ?? []).map(it => it.prDate))
    setExpandedDates(dates)
    setShowPeriodPicker(false)
  }

  function addSuggestedToCart() {
    suggestedItems.filter(it => it.checked).forEach(it => {
      const price = it.editPrice !== '' ? Number(it.editPrice) : it.price
      addToCart({ id: it.id, name: it.name, category: it.origin, price, unit: 'un', stock: 999, source: 'servico' })
    })
    setShowPrModal(false)
  }

  function addToCart(item) {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) {
        if (existing.qty >= item.stock) return prev
        return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      }
      return [...prev, { ...item, qty: 1, discount: 0 }]
    })
  }

  function updateQty(id, delta) {
    setCart(prev => prev.map(c => {
      if (c.id !== id) return c
      const newQty = c.qty + delta
      if (newQty <= 0) return null
      if (newQty > c.stock) return c
      return { ...c, qty: newQty }
    }).filter(Boolean))
  }

  function removeFromCart(id) {
    setCart(prev => prev.filter(c => c.id !== id))
  }

  function updateItemDiscount(id, value) {
    const v = Math.max(0, Math.min(100, Number(value)))
    setCart(prev => prev.map(c => c.id === id ? { ...c, discount: v } : c))
  }

  const rawSubtotal = cart.reduce((s, c) => s + c.price * c.qty, 0)
  const itemDiscountTotal = cart.reduce((s, c) => s + c.price * c.qty * (c.discount / 100), 0)
  const subtotal = rawSubtotal - itemDiscountTotal
  const globalDiscountAmount = subtotal * (globalDiscount / 100)
  const totalBeforeJuros = subtotal - globalDiscountAmount
  const jurosAmount = totalBeforeJuros * (juros / 100)
  const total = totalBeforeJuros + jurosAmount

  function finalize() {
    if (!paymentMethod || cart.length === 0) return
    const receipt = {
      num: `PDV-${Date.now()}`,
      date: new Date().toLocaleString('pt-BR'),
      tutor: tutor?.name ?? 'Cliente avulso',
      items: cart.map(c => ({ ...c })),
      rawSubtotal,
      itemDiscountTotal,
      subtotal,
      globalDiscount,
      globalDiscountAmount,
      juros,
      jurosAmount,
      total,
      paymentMethod: PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label ?? paymentMethod,
      methodId: paymentMethod,
      installments: paymentMethod === 'parcelado' ? installments : null,
    }
    setReceiptData(receipt)
    setShowReceiptModal(true)
  }

  function confirmPayment() {
    if (!receiptData) return
    // Deduct stock for products
    setProdutos(prev => prev.map(p => {
      const cartItem = cart.find(c => c.id === p.id && c.source === 'produto')
      if (!cartItem) return p
      return { ...p, quantity: Math.max(0, p.quantity - cartItem.qty) }
    }))
    // Log to financeiro
    const methodMap = { pix: 'PIX', debito: 'Débito', credito: 'Cartão', parcelado: 'Cartão', dinheiro: 'Dinheiro' }
    setLancamentos(prev => [...prev, {
      id: `pdv-${Date.now()}`,
      type: 'receita',
      category: 'Produtos',
      date: new Date().toISOString().split('T')[0],
      value: receiptData.total,
      description: `PDV — ${receiptData.tutor} — ${receiptData.items.length} item(s)`,
      method: methodMap[receiptData.methodId] ?? receiptData.paymentMethod,
      status: 'recebido',
    }])
    // Save to vendas history
    setVendas(prev => [...prev, receiptData])
    // Clear cart
    setCart([])
    setTutor(null)
    setTutorSearch('')
    setGlobalDiscount(0)
    setPaymentMethod(null)
    setInstallments(2)
    setJuros(0)
    setShowReceiptModal(false)
    setReceiptData(null)
  }

  function editSale() {
    setShowReceiptModal(false)
    setReceiptData(null)
  }

  if (!hasPermission('pdv', 'view')) {
    return <AccessDenied title="PDV" />
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">PDV — Ponto de Venda</h2>
          <p className="page-subtitle">Venda rápida com emissão de recibo</p>
        </div>
      </div>

      <div className="pdv-main-grid">
        {/* LEFT: Catalog */}
        <div className="pdv-catalog-section">
          {/* Tutor selector */}
          <div className="card" style={{ padding: '14px 16px', position: 'relative' }}>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 8 }}>Cliente / Tutor</p>
            {tutor ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{tutor.name}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tutor.cpf} · {tutor.phone}</p>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={clearTutor}><X size={14} /></button>
                </div>
                {prontuarioSugg && (() => {
                  const today = todayISO()
                  const yesterday = yesterdayISO()
                  const dateMap = {}
                  prontuarioSugg.items.forEach(it => { dateMap[it.prDate] = (dateMap[it.prDate] ?? 0) + 1 })
                  const parts = Object.entries(dateMap)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([date, cnt]) => {
                      const label = date === today ? 'hoje' : date === yesterday ? 'ontem' : fmtDate(date)
                      return `${cnt} ${cnt === 1 ? 'item' : 'itens'} de ${label}`
                    })
                  const badgeText = parts.slice(0, 2).join(' · ') + (parts.length > 2 ? ` +${parts.length - 2}` : '')
                  return (
                    <button
                      onClick={() => setShowPrModal(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #16a34a', background: '#f0fdf4', cursor: 'pointer', color: '#15803d', fontWeight: 600, fontSize: '0.8125rem' }}
                    >
                      <span>🩺</span>
                      <span style={{ flex: 1 }}>{badgeText}</span>
                      <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>Revisar →</span>
                    </button>
                  )
                })()}
              </>
            ) : (
              <>
                <div style={{ position: 'relative' }}>
                  <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    className="form-input"
                    style={{ paddingLeft: 34 }}
                    placeholder="Buscar tutor por nome ou CPF... (opcional)"
                    value={tutorSearch}
                    onChange={e => { setTutorSearch(e.target.value); setShowTutorDropdown(true) }}
                    onFocus={() => setShowTutorDropdown(true)}
                    onBlur={() => setTimeout(() => setShowTutorDropdown(false), 200)}
                  />
                  {showTutorDropdown && tutorResults.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 100, maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                      {tutorResults.map(t => (
                        <div
                          key={t.id}
                          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                          onMouseDown={() => selectTutor(t)}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}
                        >
                          <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{t.name}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.cpf} · {t.phone}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <select
                  className="form-select"
                  style={{ marginTop: 8 }}
                  value=""
                  onChange={e => {
                    const found = TUTORES.find(t => t.id === e.target.value)
                    if (found) selectTutor(found)
                  }}
                >
                  <option value="">— ou selecione da lista completa —</option>
                  {TUTORES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </>
            )}
          </div>

          {/* Catalog tabs */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
              {CATALOG_CATS.map(tab => (
                <button
                  key={tab}
                  onClick={() => { setCatalogTab(tab); setCatalogSearch('') }}
                  style={{
                    flex: 1, padding: '10px 8px', border: 'none', background: 'none', cursor: 'pointer',
                    fontWeight: 600, fontSize: '0.875rem',
                    color: catalogTab === tab ? 'var(--teal)' : 'var(--text-muted)',
                    borderBottom: catalogTab === tab ? '2px solid var(--teal)' : '2px solid transparent',
                    transition: 'color 150ms',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tipo de atendimento toggle */}
            <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Atendimento:</span>
              {[
                { id: 'presencial', label: '🏥 Consultório' },
                { id: 'domiciliar', label: '🏠 Domicílio' },
              ].map(({ id, label }) => (
                <button key={id} onClick={() => { setTipoAtend(id); setTipoAtendDetected(false) }}
                  style={{
                    fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                    background: tipoAtend === id ? (id === 'domiciliar' ? '#fef3c7' : 'var(--teal-light)') : 'var(--surface-2)',
                    color: tipoAtend === id ? (id === 'domiciliar' ? '#92400e' : 'var(--teal-dark, var(--teal))') : 'var(--text-muted)',
                    boxShadow: tipoAtend === id ? 'var(--shadow-sm)' : 'none',
                  }}>{label}</button>
              ))}
              {tipoAtendDetected && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>detectado automaticamente</span>}
            </div>

            <div style={{ padding: '12px 14px' }}>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Buscar no consultório..." value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                {catalogItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${item.domSource === 'fallback' ? '#fbbf24' : 'var(--border)'}`, background: 'var(--surface)', cursor: 'pointer', transition: 'all 150ms' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--teal)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = item.domSource === 'fallback' ? '#fbbf24' : 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4, marginBottom: 2 }}>
                      <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)', flex: 1, lineHeight: 1.3 }}>{item.name}</p>
                      {item.domSource === 'domiciliar' && <span style={{ fontSize: '0.6rem', background: '#fef3c7', color: '#92400e', padding: '1px 4px', borderRadius: 3, flexShrink: 0 }}>🏠 Dom.</span>}
                      {item.domSource === 'fallback' && <span style={{ fontSize: '0.6rem', background: '#fef3c7', color: '#b45309', padding: '1px 4px', borderRadius: 3, flexShrink: 0 }}>⚠️ Preço consultório</span>}
                    </div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>{item.category}{item.source === 'produto' ? ` · Estq: ${item.stock}` : ''}</p>
                    <p style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--teal)' }}>{fmtBRL(item.price)}</p>
                  </button>
                ))}
                {catalogItems.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', gridColumn: '1 / -1', textAlign: 'center', padding: '24px 0' }}>
                    Nenhum item encontrado
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Cart + Payment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 16 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingCart size={16} style={{ color: 'var(--teal)' }} />
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Carrinho</span>
              {cart.length > 0 && <span className="badge badge-teal">{cart.reduce((s, c) => s + c.qty, 0)} itens</span>}
              {cart.length > 0 && <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setCart([])}><Trash2 size={13} /></button>}
            </div>

            {cart.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                <ShoppingCart size={28} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <p>Carrinho vazio</p>
                <p style={{ fontSize: '0.75rem' }}>Clique nos itens do consultório para adicionar</p>
              </div>
            ) : (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {cart.map(item => (
                  <div key={item.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>{item.name}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>{fmtBRL(item.price)} / {item.unit}</p>
                      </div>
                      <button className="btn btn-ghost" style={{ padding: 4 }} onClick={() => removeFromCart(item.id)}>
                        <X size={12} style={{ color: 'var(--text-muted)' }} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                        <button style={{ padding: '3px 8px', border: 'none', background: 'var(--surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => updateQty(item.id, -1)}>
                          <Minus size={11} />
                        </button>
                        <span style={{ padding: '3px 10px', fontSize: '0.8125rem', fontWeight: 700 }}>{item.qty}</span>
                        <button style={{ padding: '3px 8px', border: 'none', background: 'var(--surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => updateQty(item.id, 1)}>
                          <Plus size={11} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Desc %</span>
                        <input
                          type="number" min="0" max="100"
                          style={{ width: 52, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 5, fontSize: '0.8rem', textAlign: 'center', background: 'var(--surface)', color: 'var(--text-primary)' }}
                          value={item.discount}
                          onChange={e => updateItemDiscount(item.id, e.target.value)}
                        />
                      </div>
                      <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--teal)', whiteSpace: 'nowrap' }}>
                        {fmtBRL(item.price * item.qty * (1 - item.discount / 100))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals + Payment */}
          {cart.length > 0 && (
            <div className="card pdv-cart-footer">
              {itemDiscountTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal bruto</span>
                  <span style={{ fontWeight: 600 }}>{fmtBRL(rawSubtotal)}</span>
                </div>
              )}
              {itemDiscountTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--danger)' }}>
                  <span>Desc. por item</span>
                  <span>− {fmtBRL(itemDiscountTotal)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                <span style={{ fontWeight: 600 }}>{fmtBRL(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Desc. geral (%)</span>
                <input
                  type="number" min="0" max="100"
                  style={{ width: 64, padding: '5px 8px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', textAlign: 'center', background: 'var(--surface)', color: 'var(--text-primary)' }}
                  value={globalDiscount}
                  onChange={e => setGlobalDiscount(Math.max(0, Math.min(100, Number(e.target.value))))}
                />
              </div>
              {globalDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--danger)' }}>
                  <span>Desconto ({globalDiscount}%)</span>
                  <span>− {fmtBRL(globalDiscountAmount)}</span>
                </div>
              )}

              <div>
                <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Forma de pagamento</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {PAYMENT_METHODS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setPaymentMethod(m.id)
                        try {
                          const saved = JSON.parse(localStorage.getItem('petvet-payment-rates') ?? '{}')
                          setJuros(saved[m.id] ?? 0)
                        } catch { setJuros(0) }
                      }}
                      className={paymentMethod === m.id ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                      style={{ fontSize: '0.75rem' }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {['debito', 'credito', 'parcelado'].includes(paymentMethod) && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Juros (%)</span>
                  <input
                    type="number" min="0" max="50" step="0.5"
                    style={{ width: 64, padding: '5px 8px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', textAlign: 'center', background: 'var(--surface)', color: 'var(--text-primary)' }}
                    value={juros}
                    onChange={e => setJuros(Math.max(0, Math.min(50, Number(e.target.value))))}
                  />
                </div>
              )}
              {juros > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--warning)' }}>
                  <span>Juros ({juros}%)</span>
                  <span>+ {fmtBRL(jurosAmount)}</span>
                </div>
              )}

              {paymentMethod === 'parcelado' && (
                <div className="form-group">
                  <label className="form-label">Parcelas</label>
                  <select className="form-select" value={installments} onChange={e => setInstallments(Number(e.target.value))}>
                    {[2, 3, 4, 5, 6, 10, 12].map(n => (
                      <option key={n} value={n}>{n}x de {fmtBRL(total / n)}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border)', paddingTop: 10, fontWeight: 800 }}>
                <span style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>TOTAL</span>
                <span style={{ fontSize: '1.25rem', color: 'var(--teal)' }}>{fmtBRL(total)}</span>
              </div>

              <button
                className="btn btn-primary btn-full btn-lg"
                disabled={!paymentMethod || !hasPermission('pdv', 'edit')}
                onClick={finalize}
              >
                <Check size={18} /> Finalizar Venda
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Prontuário Suggestions Modal */}
      {showPrModal && prontuarioSugg && (() => {
        const today = todayISO()
        const yesterday = yesterdayISO()
        const multiplePets = prontuarioSugg.pets.length > 1
        const filterPetId = multiplePets ? activePetId : null

        // Agrupar por data (respeitando filtro de pet)
        const groupMap = {}
        for (const it of suggestedItems) {
          if (filterPetId && it.petId !== filterPetId) continue
          if (!groupMap[it.prDate]) groupMap[it.prDate] = []
          groupMap[it.prDate].push(it)
        }
        const dateGroups = Object.entries(groupMap)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, items]) => ({ date, items }))

        const checkedCount = suggestedItems.filter(it => it.checked).length

        const ORIGIN_COLOR = {
          Consulta:   { bg: '#e0f2fe', color: '#0369a1' },
          Vacina:     { bg: '#dcfce7', color: '#15803d' },
          Aplicação:  { bg: '#fef9c3', color: '#854d0e' },
          Prescrição: { bg: '#f3e8ff', color: '#7e22ce' },
          Cirurgia:   { bg: '#fee2e2', color: '#b91c1c' },
        }

        const dateLabelFull = date =>
          date === today    ? `Hoje — ${fmtDate(date)}` :
          date === yesterday? `Ontem — ${fmtDate(date)}` :
                              `📅 ${fmtDate(date)}`

        const renderItem = item => {
          const oc = ORIGIN_COLOR[item.origin] ?? { bg: 'var(--surface-2)', color: 'var(--text-secondary)' }
          const isExpProto = !!item.proto && expandedProtos.has(item.id)
          const toggleProtoExpand = e => {
            e.stopPropagation()
            setExpandedProtos(prev => {
              const next = new Set(prev)
              if (next.has(item.id)) next.delete(item.id)
              else next.add(item.id)
              return next
            })
          }
          const borderColor = item.checked ? 'var(--teal)' : 'var(--border)'
          const protoSubItems = item.proto ? [
            ...(item.proto.vacinas ?? []).map(v => ({ nome: v.nome || 'Vacina', tipo: 'Vacina', total: (Number(v.precoUnit) || 0) * (Number(v.qtd) || 1) })),
            ...(item.proto.medicamentos ?? []).map(m => ({ nome: m.nome || 'Medicamento', tipo: 'Medicamento', total: (Number(m.precoUnit) || 0) * (Number(m.qtd) || 1) })),
            ...(item.proto.servicos ?? []).map(s => ({ nome: s.nome || 'Serviço', tipo: 'Serviço', total: (Number(s.precoUnit) || 0) * (Number(s.qtd) || 1) })),
          ] : []
          return (
            <div key={item.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: item.proto && isExpProto ? '8px 8px 0 0' : 8, border: `1.5px solid ${borderColor}`, borderBottom: item.proto && isExpProto ? '1px dashed var(--border)' : `1.5px solid ${borderColor}`, background: item.checked ? 'var(--teal-light)' : 'var(--surface-2)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={item.checked} onChange={() => toggleSuggItem(item.id)} style={{ accentColor: 'var(--teal)', width: 15, height: 15, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: item.checked ? 600 : 400, color: 'var(--text-primary)', lineHeight: 1.3, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                    {multiplePets && !filterPetId && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.petName}</span>}
                  </div>
                  <span style={{ padding: '2px 7px', borderRadius: 10, fontSize: '0.68rem', fontWeight: 700, background: oc.bg, color: oc.color, flexShrink: 0, whiteSpace: 'nowrap' }}>{item.origin}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                    {item.domFallback && <span title="Preço domiciliar não cadastrado — usando preço do catálogo" style={{ fontSize: '0.62rem', padding: '1px 4px', borderRadius: 5, background: '#fef3c7', color: '#92400e', border: '1px solid #fbbf24', lineHeight: 1.4 }}>⚠️ sem dom.</span>}
                    {item.priceSource && <span style={{ fontSize: '0.62rem', padding: '1px 4px', borderRadius: 5, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)', lineHeight: 1.4 }}>{item.priceSource}</span>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>R$</span>
                      <input
                        type="number" min="0" step="0.01"
                        value={item.editPrice} placeholder="Informar"
                        onClick={e => e.stopPropagation()}
                        onChange={e => { e.stopPropagation(); updateSuggPrice(item.id, e.target.value) }}
                        style={{ width: 66, padding: '2px 5px', border: `1px solid ${item.editPrice === '' ? 'var(--warning)' : 'var(--border)'}`, borderRadius: 5, fontSize: '0.78rem', textAlign: 'right', background: 'var(--surface)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </div>
                </label>
                {item.proto && (
                  <button
                    onClick={toggleProtoExpand}
                    title={isExpProto ? 'Ocultar itens do protocolo' : 'Ver itens do protocolo'}
                    style={{ padding: '5px 8px', border: `1.5px solid ${borderColor}`, borderRadius: 7, background: isExpProto ? 'var(--teal-light)' : 'var(--surface-2)', fontSize: '0.68rem', cursor: 'pointer', color: isExpProto ? 'var(--teal)' : 'var(--text-muted)', flexShrink: 0, lineHeight: 1, fontWeight: 700 }}
                  >
                    {isExpProto ? '▲' : '▼'}
                  </button>
                )}
              </div>
              {item.proto && isExpProto && (
                <div style={{ border: `1.5px solid ${borderColor}`, borderTop: 'none', borderRadius: '0 0 8px 8px', background: 'var(--surface)', padding: '6px 12px 8px' }}>
                  {protoSubItems.length === 0
                    ? <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Protocolo sem itens detalhados.</p>
                    : protoSubItems.map((sub, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '3px 0', borderBottom: idx < protoSubItems.length - 1 ? '1px dashed var(--border)' : 'none' }}>
                        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>↳</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.nome}</span>
                        <span style={{ opacity: 0.55, whiteSpace: 'nowrap', fontSize: '0.68rem' }}>{sub.tipo}</span>
                        {sub.total > 0 && <span style={{ fontWeight: 600, color: 'var(--teal)', whiteSpace: 'nowrap' }}>R$ {sub.total.toFixed(2)}</span>}
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          )
        }

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 580, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>

              {/* Header */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.1rem' }}>🩺</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>Itens do Atendimento</p>
                  <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>Prontuários de {tutor?.name}</p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowPrModal(false)}><X size={15} /></button>
              </div>

              {/* Filtro de data */}
              <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Exibindo:</span>
                <input
                  type="date"
                  value={prActiveDate}
                  className="form-input"
                  style={{ flex: 1, minWidth: 130, padding: '4px 8px', fontSize: '0.8rem' }}
                  onChange={e => {
                    setPrActiveDate(e.target.value)
                    setExpandedDates(new Set([e.target.value]))
                  }}
                />
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => { const t = todayISO(); setPrActiveDate(t); setExpandedDates(new Set([t])) }}
                  style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}
                >
                  Hoje
                </button>
              </div>

              {/* Pet chips (múltiplos pets) */}
              {multiplePets && (
                <div style={{ padding: '8px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setActivePetId(null)}
                    style={{ padding: '3px 12px', borderRadius: 16, border: `1.5px solid ${!filterPetId ? 'var(--teal)' : 'var(--border)'}`, background: !filterPetId ? 'var(--teal-light)' : 'var(--surface-2)', color: !filterPetId ? 'var(--teal)' : 'var(--text-secondary)', fontWeight: !filterPetId ? 700 : 400, fontSize: '0.78rem', cursor: 'pointer' }}
                  >Todos</button>
                  {prontuarioSugg.pets.map(pet => (
                    <button
                      key={pet.id}
                      onClick={() => setActivePetId(pet.id)}
                      style={{ padding: '3px 12px', borderRadius: 16, border: `1.5px solid ${filterPetId === pet.id ? 'var(--teal)' : 'var(--border)'}`, background: filterPetId === pet.id ? 'var(--teal-light)' : 'var(--surface-2)', color: filterPetId === pet.id ? 'var(--teal)' : 'var(--text-secondary)', fontWeight: filterPetId === pet.id ? 700 : 400, fontSize: '0.78rem', cursor: 'pointer' }}
                    >
                      {pet.photo && <img src={pet.photo} alt="" style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover', marginRight: 4, verticalAlign: 'middle' }} />}
                      {pet.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Grupos por data */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {dateGroups.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '20px 0' }}>
                    Nenhum atendimento encontrado neste período.
                  </p>
                )}
                {dateGroups.map(({ date, items: groupItems }) => {
                  const isExp = expandedDates.has(date)
                  const allCk = groupItems.every(it => it.checked)
                  const someCk = groupItems.some(it => it.checked)
                  const isToday = date === today
                  const isYest = date === yesterday
                  return (
                    <div key={date} style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                      {/* Cabeçalho do grupo */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: isToday ? 'var(--teal-light)' : 'var(--surface-2)', borderBottom: isExp ? '1px solid var(--border)' : 'none' }}>
                        <input
                          type="checkbox"
                          checked={someCk}
                          onChange={() => toggleAllForDate(date, filterPetId)}
                          style={{ accentColor: 'var(--teal)', width: 15, height: 15, flexShrink: 0, opacity: someCk && !allCk ? 0.6 : 1 }}
                        />
                        <button
                          onClick={() => toggleDateExpand(date)}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                        >
                          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: isToday ? 'var(--teal)' : 'var(--text-primary)' }}>
                            {isToday ? '📅 Hoje' : isYest ? '📅 Ontem' : '📅'} — {fmtDate(date)}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--surface)', padding: '1px 6px', borderRadius: 10, border: '1px solid var(--border)' }}>
                            {groupItems.length} item(s)
                          </span>
                          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isExp ? '▲' : '▼'}</span>
                        </button>
                        <span style={{ fontSize: '0.72rem', color: isToday ? 'var(--teal)' : 'var(--text-muted)', fontWeight: someCk ? 600 : 400 }}>
                          {someCk ? `${groupItems.filter(it => it.checked).length}/${groupItems.length} sel.` : 'Selecionar todos'}
                        </span>
                      </div>
                      {/* Itens do grupo */}
                      {isExp && (
                        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {groupItems.map(renderItem)}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Ver outros períodos */}
                <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <button
                    onClick={() => setShowPeriodPicker(v => !v)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--surface-2)', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}
                  >
                    <span>🔍</span>
                    <span style={{ flex: 1, textAlign: 'left' }}>Ver outros períodos</span>
                    <span>{showPeriodPicker ? '▲' : '▼'}</span>
                  </button>
                  {showPeriodPicker && (
                    <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <input type="date" value={prPeriodFrom} onChange={e => setPrPeriodFrom(e.target.value)} className="form-input" style={{ flex: 1, minWidth: 120, padding: '4px 8px', fontSize: '0.8rem' }} />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>até</span>
                      <input type="date" value={prPeriodTo} onChange={e => setPrPeriodTo(e.target.value)} className="form-input" style={{ flex: 1, minWidth: 120, padding: '4px 8px', fontSize: '0.8rem' }} />
                      <button className="btn btn-outline btn-sm" onClick={handleSearchPeriod} disabled={!prPeriodFrom || !prPeriodTo} style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>Buscar</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flex: 1 }}>{checkedCount} item(s) selecionado(s)</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowPrModal(false)}>Fechar</button>
                <button className="btn btn-primary btn-sm" disabled={checkedCount === 0} onClick={addSuggestedToCart}>
                  Adicionar ao carrinho
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Receipt Modal */}
      {receiptData && (
        <Modal isOpen={showReceiptModal} onClose={editSale} title="Recibo de Venda" size="md" closeOnOverlay={false}
          footer={
            <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={editSale}>✏️ Editar lançamento</button>
              <button className="btn btn-outline btn-sm" onClick={() => window.print()}><Printer size={14} /> Imprimir recibo</button>
              <button className="btn btn-primary btn-sm" onClick={confirmPayment}>✅ Pagamento realizado</button>
            </div>
          }>
          <div style={{ fontFamily: 'monospace', fontSize: '0.8125rem', lineHeight: 1.7, color: 'var(--text-primary)' }}>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <p style={{ fontWeight: 800, fontSize: '1rem' }}>EMPORIUM VAZPET · TATÁ BICHOS</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>PetVet Sistema</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{receiptData.date}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Nº {receiptData.num}</p>
            </div>

            <div style={{ borderTop: '1px dashed var(--border)', borderBottom: '1px dashed var(--border)', padding: '8px 0', marginBottom: 8 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>CLIENTE: {receiptData.tutor}</p>
            </div>

            {receiptData.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.qty}x {item.name}{item.discount > 0 ? ` (-${item.discount}%)` : ''}
                </span>
                <span style={{ flexShrink: 0 }}>{fmtBRL(item.price * item.qty * (1 - item.discount / 100))}</span>
              </div>
            ))}

            <div style={{ borderTop: '1px dashed var(--border)', marginTop: 8, paddingTop: 8 }}>
              {receiptData.itemDiscountTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal bruto</span><span>{fmtBRL(receiptData.rawSubtotal)}</span>
                </div>
              )}
              {receiptData.itemDiscountTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                  <span>Desc. por item</span><span>− {fmtBRL(receiptData.itemDiscountTotal)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal</span><span>{fmtBRL(receiptData.subtotal)}</span>
              </div>
              {receiptData.globalDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                  <span>Desconto ({receiptData.globalDiscount}%)</span><span>− {fmtBRL(receiptData.globalDiscountAmount)}</span>
                </div>
              )}
              {receiptData.juros > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warning)' }}>
                  <span>Juros ({receiptData.juros}%)</span><span>+ {fmtBRL(receiptData.jurosAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.9375rem', marginTop: 4 }}>
                <span>TOTAL</span><span>{fmtBRL(receiptData.total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginTop: 6 }}>
                <span>Pagamento</span>
                <span>{receiptData.paymentMethod}{receiptData.installments ? ` — ${receiptData.installments}x de ${fmtBRL(receiptData.total / receiptData.installments)}` : ''}</span>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: 16, color: 'var(--text-muted)', fontSize: '0.72rem' }}>
              <p>Obrigado pela preferência!</p>
              <p>Volte sempre 🐾</p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
