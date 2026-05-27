import { useState } from 'react'
import { Plus, Users, DollarSign, CheckCircle, X, Edit2, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { maskCPF, maskRG, maskPhone } from '../utils/masks'
import Modal from '../components/ui/Modal'
import ConfirmModal from '../components/ui/ConfirmModal'
import { usePersistentState } from '../hooks/usePersistentState'
import { useAuth } from '../context/AuthContext'

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

// Tabela progressiva INSS 2024
function calcINSS(salario) {
  const s = parseFloat(salario) || 0
  const faixas = [
    { max: 1412.00,  rate: 0.075 },
    { max: 2666.68,  rate: 0.09  },
    { max: 4000.03,  rate: 0.12  },
    { max: 7786.02,  rate: 0.14  },
  ]
  let inss = 0, prev = 0
  for (const f of faixas) {
    if (s <= prev) break
    inss += (Math.min(s, f.max) - prev) * f.rate
    prev = f.max
  }
  return Math.round(inss * 100) / 100
}
function calcFGTS(salario) { return Math.round(parseFloat(salario || 0) * 0.08 * 100) / 100 }
function num(v) { return parseFloat(v) || 0 }

function calcSalario(f) {
  const base        = num(f.salarioBase)
  const vr          = num(f.vr)
  const va          = num(f.va)
  const plano       = f.planoSaude === 'Sim' ? num(f.planoSaudeValor) : 0
  const premiacao   = num(f.premiacao)
  const adiantamento= num(f.adiantamento)
  const outDesc     = num(f.outrosDescontos)
  const outBenef    = num(f.outrosBeneficios)
  const inss        = calcINSS(base)
  const fgts        = calcFGTS(base)
  const totalBeneficios = vr + va + plano + outBenef
  const totalDescontos  = inss + adiantamento + outDesc
  const liquido         = base + premiacao + totalBeneficios - totalDescontos
  return { base, vr, va, plano, premiacao, adiantamento, outDesc, outBenef, inss, fgts, totalBeneficios, totalDescontos, liquido }
}

function fmt(v) { return `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` }

const EMPTY_FUNC = {
  nome: '', cargo: '', cpf: '', rg: '', phone: '',
  salarioBase: '', vr: '', va: '',
  planoSaude: 'Não', planoSaudeValor: '',
  premiacao: '', adiantamento: '', outrosDescontos: '', outrosBeneficios: '',
  ativo: true, apareceAgenda: false,
}

export default function FuncionariosPage() {
  const { hasRole } = useAuth()
  const hoje = new Date('2026-05-16')
  const [funcionarios, setFuncionarios] = usePersistentState('petvet-funcionarios', [])
  const [lancamentos, setLancamentos]   = usePersistentState('petvet-lancamentos', [])
  const [pagamentos, setPagamentos]     = usePersistentState('petvet-func-pagamentos', [])
  const [selectedYear,  setSelectedYear]  = useState(hoje.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(hoje.getMonth())
  const [showModal,    setShowModal]    = useState(false)
  const [editing,      setEditing]      = useState(null)
  const [form,         setForm]         = useState(EMPTY_FUNC)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [expanded,     setExpanded]     = useState({})
  const [payModal,     setPayModal]     = useState(null)
  const [payDate,      setPayDate]      = useState('')

  function openAdd()  { setEditing(null); setForm(EMPTY_FUNC); setShowModal(true) }
  function openEdit(f){ setEditing(f); setForm({ ...EMPTY_FUNC, ...f }); setShowModal(true) }

  function save() {
    if (!form.nome) return
    if (editing) {
      setFuncionarios(prev => prev.map(f => f.id === editing.id ? { ...form, id: f.id } : f))
    } else {
      setFuncionarios(prev => [...prev, { ...form, id: `func${Date.now()}` }])
    }
    setShowModal(false)
  }

  function marcarPago(func, dataPagamento) {
    const key = `${func.id}-${selectedYear}-${selectedMonth}`
    const jaExiste = pagamentos.find(p => p.key === key)
    if (jaExiste) return

    const calc = calcSalario(func)
    const pagamento = {
      id: `pag${Date.now()}`, key,
      funcionarioId: func.id,
      mes: selectedMonth, ano: selectedYear,
      salarioBase: calc.base, premiacao: calc.premiacao,
      totalBeneficios: calc.totalBeneficios, totalDescontos: calc.totalDescontos,
      inss: calc.inss, fgts: calc.fgts,
      salarioLiquido: calc.liquido,
      dataPagamento,
    }
    setPagamentos(prev => [...prev, pagamento])

    const dataLan = dataPagamento || `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
    setLancamentos(prev => [...prev, {
      id: `flan${Date.now()}`,
      type: 'despesa',
      category: 'Pessoal',
      date: dataLan,
      value: calc.liquido,
      description: `Folha - ${func.nome} — ${MONTHS_PT[selectedMonth]}/${selectedYear}`,
      method: 'TED',
      status: 'pago',
    }])
  }

  function isPago(funcId) {
    const key = `${funcId}-${selectedYear}-${selectedMonth}`
    return !!pagamentos.find(p => p.key === key)
  }

  function getPagamento(funcId) {
    const key = `${funcId}-${selectedYear}-${selectedMonth}`
    return pagamentos.find(p => p.key === key)
  }

  function historicoPagamentos(funcId) {
    return pagamentos.filter(p => p.funcionarioId === funcId).sort((a, b) => b.ano - a.ano || b.mes - a.mes)
  }

  const totalFolha = funcionarios.filter(f => f.ativo !== false).reduce((s, f) => s + calcSalario(f).liquido, 0)
  const pagosMes   = funcionarios.filter(f => isPago(f.id)).length

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Funcionários</h2>
          <p className="page-subtitle">{funcionarios.length} funcionários cadastrados</p>
        </div>
        {hasRole('admin') && (
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Novo Funcionário</button>
        )}
      </div>

      {/* Seletor de competência */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="form-select" style={{ width: 160 }} value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
          {MONTHS_PT.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select className="form-select" style={{ width: 100 }} value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
          {[2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
        </select>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginLeft: 8 }}>Competência selecionada</span>
      </div>

      {/* Resumo */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon stat-icon-teal"><Users size={20} /></div>
          <div><div className="stat-value">{funcionarios.filter(f => f.ativo !== false).length}</div><div className="stat-label">Funcionários ativos</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fed7d7', color: '#c53030' }}><DollarSign size={20} /></div>
          <div><div className="stat-value">{fmt(totalFolha)}</div><div className="stat-label">Total folha bruta (líquida)</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-success"><CheckCircle size={20} /></div>
          <div><div className="stat-value">{pagosMes} / {funcionarios.length}</div><div className="stat-label">Pagos neste mês</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-warning"><DollarSign size={20} /></div>
          <div>
            <div className="stat-value">{fmt(funcionarios.reduce((s, f) => s + calcFGTS(f.salarioBase), 0))}</div>
            <div className="stat-label">FGTS total a recolher</div>
          </div>
        </div>
      </div>

      {funcionarios.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
          <Users size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ fontWeight: 600 }}>Nenhum funcionário cadastrado</p>
          <p style={{ fontSize: '0.875rem', marginTop: 4 }}>Clique em "Novo Funcionário" para começar.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {funcionarios.map(func => {
            const calc  = calcSalario(func)
            const pago  = isPago(func.id)
            const pag   = getPagamento(func.id)
            const hist  = historicoPagamentos(func.id)
            const open  = expanded[func.id]
            return (
              <div key={func.id} className="card" style={{ padding: '16px 20px' }}>
                {/* Cabeçalho do card */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{func.nome}</p>
                      <span className="badge badge-neutral">{func.cargo}</span>
                      {func.ativo === false && <span className="badge badge-danger">Inativo</span>}
                      {pago && <span className="badge badge-success">Pago — {MONTHS_PT[selectedMonth]}</span>}
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      Salário base: <strong>{fmt(calc.base)}</strong>
                      {calc.premiacao > 0 && <> · Premiação: <strong>{fmt(calc.premiacao)}</strong></>}
                    </p>
                  </div>

                  {/* Salário líquido e ações */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, minWidth: 160 }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Salário líquido</p>
                      <p style={{ fontSize: '1.375rem', fontWeight: 800, color: pago ? 'var(--success)' : 'var(--text-primary)' }}>{fmt(calc.liquido)}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {hasRole('admin') && !pago && (
                        <button className="btn btn-primary btn-sm" onClick={() => { setPayModal({ func }); setPayDate(new Date().toISOString().slice(0, 10)) }}>
                          <CheckCircle size={14} /> Marcar como pago
                        </button>
                      )}
                      {hasRole('admin') && (
                        <>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(func)}><Edit2 size={13} /></button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setDeleteTarget(func)}><Trash2 size={13} /></button>
                        </>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(prev => ({ ...prev, [func.id]: !open }))}>
                        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Detalhes expandidos */}
                {open && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 14 }}>
                      <CalcRow label="Salário base"        value={calc.base}      />
                      <CalcRow label="Premiação"           value={calc.premiacao} />
                      <CalcRow label="VR (Refeição)"       value={calc.vr}        type="benef" />
                      <CalcRow label="VA (Alimentação)"    value={calc.va}        type="benef" />
                      {func.planoSaude === 'Sim' && <CalcRow label="Plano de saúde" value={calc.plano} type="benef" />}
                      {calc.outBenef > 0 && <CalcRow label="Outros benefícios" value={calc.outBenef} type="benef" />}
                      <CalcRow label="INSS (descontado)" value={calc.inss}           type="desc" />
                      <CalcRow label="FGTS (8%)"         value={calc.fgts}           type="info" note="Recolhido pelo empregador" />
                      {calc.adiantamento > 0 && <CalcRow label="Adiantamento"   value={calc.adiantamento} type="desc" />}
                      {calc.outDesc > 0     && <CalcRow label="Outros descontos" value={calc.outDesc}    type="desc" />}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 8, marginBottom: 14 }}>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total benefícios</p>
                        <p style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(calc.totalBeneficios)}</p>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total descontos</p>
                        <p style={{ fontWeight: 700, color: 'var(--danger)' }}>{fmt(calc.totalDescontos)}</p>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Salário líquido</p>
                        <p style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--teal-dark)' }}>{fmt(calc.liquido)}</p>
                      </div>
                    </div>

                    {/* Histórico de pagamentos */}
                    {hist.length > 0 && (
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Histórico de pagamentos</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {hist.slice(0, 6).map(h => (
                            <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
                              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{MONTHS_PT[h.mes]} {h.ano}</span>
                              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pago em {new Date(h.dataPagamento + 'T00:00').toLocaleDateString('pt-BR')}</span>
                                <span style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(h.salarioLiquido)}</span>
                                <span className="badge badge-success">Pago</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Funcionário */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Funcionário' : 'Novo Funcionário'} size="lg"
        footer={<><button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={save}>Salvar</button></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Nome completo *</label>
            <input className="form-input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome do funcionário" />
          </div>
          <div className="form-group">
            <label className="form-label">Cargo</label>
            <input className="form-input" value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Ex: Veterinário, Atendente, Banhista" />
          </div>
          <div className="form-group">
            <label className="form-label">CPF</label>
            <input className="form-input" value={form.cpf ?? ''} onChange={e => setForm(f => ({ ...f, cpf: maskCPF(e.target.value) }))} placeholder="000.000.000-00" />
          </div>
          <div className="form-group">
            <label className="form-label">RG</label>
            <input className="form-input" value={form.rg ?? ''} onChange={e => setForm(f => ({ ...f, rg: maskRG(e.target.value) }))} placeholder="00.000.000-0" />
          </div>
          <div className="form-group">
            <label className="form-label">Telefone</label>
            <input className="form-input" value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: maskPhone(e.target.value) }))} placeholder="(11) 99999-9999" />
          </div>
          <div className="form-group">
            <label className="form-label">Salário base (R$)</label>
            <input type="number" step="0.01" className="form-input" value={form.salarioBase} onChange={e => setForm(f => ({ ...f, salarioBase: e.target.value }))} placeholder="0,00" />
          </div>

          <div className="form-group">
            <label className="form-label">VR — Vale Refeição (R$/mês)</label>
            <input type="number" step="0.01" className="form-input" value={form.vr} onChange={e => setForm(f => ({ ...f, vr: e.target.value }))} placeholder="0,00" />
          </div>
          <div className="form-group">
            <label className="form-label">VA — Vale Alimentação (R$/mês)</label>
            <input type="number" step="0.01" className="form-input" value={form.va} onChange={e => setForm(f => ({ ...f, va: e.target.value }))} placeholder="0,00" />
          </div>

          <div className="form-group">
            <label className="form-label">Plano de saúde</label>
            <select className="form-select" value={form.planoSaude} onChange={e => setForm(f => ({ ...f, planoSaude: e.target.value }))}>
              <option>Não</option><option>Sim</option>
            </select>
          </div>
          {form.planoSaude === 'Sim' && (
            <div className="form-group">
              <label className="form-label">Valor plano (R$/mês)</label>
              <input type="number" step="0.01" className="form-input" value={form.planoSaudeValor} onChange={e => setForm(f => ({ ...f, planoSaudeValor: e.target.value }))} placeholder="0,00" />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Premiação mensal (R$)</label>
            <input type="number" step="0.01" className="form-input" value={form.premiacao} onChange={e => setForm(f => ({ ...f, premiacao: e.target.value }))} placeholder="0,00" />
          </div>
          <div className="form-group">
            <label className="form-label">Adiantamento (R$)</label>
            <input type="number" step="0.01" className="form-input" value={form.adiantamento} onChange={e => setForm(f => ({ ...f, adiantamento: e.target.value }))} placeholder="0,00" />
          </div>
          <div className="form-group">
            <label className="form-label">Outros descontos (R$)</label>
            <input type="number" step="0.01" className="form-input" value={form.outrosDescontos} onChange={e => setForm(f => ({ ...f, outrosDescontos: e.target.value }))} placeholder="0,00" />
          </div>
          <div className="form-group">
            <label className="form-label">Outros benefícios (R$)</label>
            <input type="number" step="0.01" className="form-input" value={form.outrosBeneficios} onChange={e => setForm(f => ({ ...f, outrosBeneficios: e.target.value }))} placeholder="0,00" />
          </div>

          {/* Preview calculado */}
          {form.salarioBase && (
            <div style={{ gridColumn: '1 / -1', padding: '12px 16px', background: 'var(--teal-light)', borderRadius: 8, borderLeft: '3px solid var(--teal)' }}>
              {(() => {
                const c = calcSalario(form)
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: '0.8125rem' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>INSS: </span><strong style={{ color: 'var(--danger)' }}>{fmt(c.inss)}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>FGTS: </span><strong>{fmt(c.fgts)}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Total benefícios: </span><strong style={{ color: 'var(--success)' }}>{fmt(c.totalBeneficios)}</strong></div>
                    <div style={{ gridColumn: '1 / -1', paddingTop: 6, borderTop: '1px solid var(--teal)', marginTop: 4 }}>
                      <span style={{ color: 'var(--teal-dark)', fontWeight: 600 }}>Salário líquido estimado: </span>
                      <strong style={{ fontSize: '1rem', color: 'var(--teal-dark)' }}>{fmt(c.liquido)}</strong>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.ativo === false ? 'Inativo' : 'Ativo'} onChange={e => setForm(f => ({ ...f, ativo: e.target.value === 'Ativo' }))}>
              <option>Ativo</option><option>Inativo</option>
            </select>
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={!!form.apareceAgenda}
                onChange={e => setForm(f => ({ ...f, apareceAgenda: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: 'var(--teal)', cursor: 'pointer' }}
              />
              Aparece na agenda como banhista/tosador
            </label>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, marginLeft: 26 }}>
              Quando marcado, este funcionário aparecerá no seletor de banhista/tosador ao criar agendamentos de banho e tosa.
            </p>
          </div>
        </div>
      </Modal>

      {/* Modal data de pagamento */}
      <Modal isOpen={!!payModal} onClose={() => setPayModal(null)} title="Confirmar Pagamento" size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setPayModal(null)}>Cancelar</button>
            <button className="btn btn-primary" disabled={!payDate} onClick={() => { marcarPago(payModal.func, payDate); setPayModal(null) }}>
              <CheckCircle size={14} /> Confirmar pagamento
            </button>
          </>
        }>
        {payModal && (() => {
          const c = calcSalario(payModal.func)
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Confirmar pagamento de <strong>{payModal.func.nome}</strong> referente a{' '}
                <strong>{MONTHS_PT[selectedMonth]}/{selectedYear}</strong>?
              </p>
              <div className="form-group">
                <label className="form-label">Data do pagamento *</label>
                <input type="date" className="form-input" value={payDate} onChange={e => setPayDate(e.target.value)} />
              </div>
              <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Salário líquido:</span>
                <strong style={{ color: 'var(--teal-dark)' }}>{fmt(c.liquido)}</strong>
              </div>
            </div>
          )
        })()}
      </Modal>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => { setFuncionarios(prev => prev.filter(f => f.id !== deleteTarget.id)); setDeleteTarget(null) }}
        message={`Excluir funcionário "${deleteTarget?.nome}"? O histórico de pagamentos será mantido.`} />
    </div>
  )
}

function CalcRow({ label, value, type, note }) {
  const colors = { benef: 'var(--success)', desc: 'var(--danger)', info: 'var(--text-muted)' }
  const prefix = { benef: '+', desc: '−', info: '' }
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8125rem' }}>
      <div>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        {note && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{note}</div>}
      </div>
      <span style={{ fontWeight: 700, color: colors[type] ?? 'var(--text-primary)', whiteSpace: 'nowrap', marginLeft: 8 }}>
        {prefix[type] ?? ''}{fmt(value)}
      </span>
    </div>
  )
}
