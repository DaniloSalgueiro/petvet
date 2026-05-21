import { useState, useMemo } from 'react'
import { Search, Plus, Minus, Trash2, ShoppingCart, X, Check, Printer } from 'lucide-react'
import Modal from '../components/ui/Modal'
import { TUTORES, PRODUTOS, SERVICOS_CATALOGO, LANCAMENTOS } from '../data/mock'
import { normIncludes } from '../utils/normalizeText'
import { usePersistentState } from '../hooks/usePersistentState'

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

export default function PDVPage({ navigateTo }) {
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
  const [lancamentos, setLancamentos] = usePersistentState('petvet-lancamentos', LANCAMENTOS)
  const [vendas, setVendas] = usePersistentState('petvet-vendas', [])

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
    } else if (catalogTab === 'Serviços') {
      items = SERVICOS_CATALOGO
        .filter(s => s.price > 0 && !['Consulta'].includes(s.category))
        .map(s => ({ id: s.id, name: s.name, category: s.category, price: s.price, unit: 'un', stock: 999, source: 'servico' }))
    } else {
      items = SERVICOS_CATALOGO
        .filter(s => s.category === 'Consulta')
        .map(s => ({ id: s.id, name: s.name, category: s.category, price: s.price, unit: 'un', stock: 999, source: 'servico' }))
    }
    if (catalogSearch) {
      items = items.filter(i => normIncludes(i.name, catalogSearch) || normIncludes(i.category, catalogSearch))
    }
    return items
  }, [catalogTab, catalogSearch, produtos])

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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{tutor.name}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tutor.cpf} · {tutor.phone}</p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => { setTutor(null); setTutorSearch('') }}><X size={14} /></button>
              </div>
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
                          onMouseDown={() => { setTutor(t); setTutorSearch(''); setShowTutorDropdown(false) }}
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
                    if (found) { setTutor(found); setTutorSearch(''); setShowTutorDropdown(false) }
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

            <div style={{ padding: '12px 14px' }}>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Buscar no catálogo..." value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                {catalogItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', transition: 'all 150ms' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--teal)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
                  >
                    <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)', marginBottom: 2 }}>{item.name}</p>
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
                <p style={{ fontSize: '0.75rem' }}>Clique nos itens do catálogo para adicionar</p>
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
                disabled={!paymentMethod}
                onClick={finalize}
              >
                <Check size={18} /> Finalizar Venda
              </button>
            </div>
          )}
        </div>
      </div>

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
