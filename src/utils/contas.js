// Utilitários compartilhados pelos módulos de Notas Fiscais e Contas a Pagar/Receber

export const CATEGORIAS_NF_ENTRADA = ['Medicamentos', 'Produtos pet shop', 'Equipamentos', 'Material escritório', 'Serviços', 'Outros']
export const FORMAS_PAGAMENTO = ['À vista', 'Boleto', 'Cartão', 'Pix', 'Parcelado']
export const CONDICOES_PAGAMENTO = ['À vista', '30 dias', '60 dias', '30/60', '30/60/90', 'Outro']
export const STATUS_NF = ['Pendente', 'Pago', 'Vencido', 'Cancelado']
export const STATUS_PARCELA = ['Pendente', 'Pago', 'Vencido', 'Negociado']
export const PERIODICIDADES = ['Semanal', 'Mensal', 'Trimestral', 'Anual']

export const CATEGORIAS_CONTAS_PAGAR = ['Fornecedores', 'Pessoal', 'Aluguel', 'Utilidades', 'Marketing', 'Manutenção', 'Impostos', 'Medicamentos', 'Outros']
export const CATEGORIAS_CONTAS_RECEBER = ['Consultas', 'Cirurgia', 'Vacinas', 'Banho & Tosa', 'Exames', 'Produtos', 'Hospedagem', 'Outros']

export function fmt(v) {
  return `R$ ${Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00')
  d.setDate(d.getDate() + Number(days))
  return d.toISOString().slice(0, 10)
}

export function addMonths(dateStr, months) {
  const d = new Date(dateStr + 'T00:00')
  d.setMonth(d.getMonth() + Number(months))
  return d.toISOString().slice(0, 10)
}

export function maskCNPJ(v) {
  const d = (v ?? '').replace(/\D/g, '').slice(0, 14)
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})$/, '$1.$2.$3/$4')
    .replace(/^(\d{2})(\d{3})(\d{3})$/, '$1.$2.$3/')
    .replace(/^(\d{2})(\d{3})$/, '$1.$2.')
    .replace(/^(\d{2})$/, '$1.')
}

export function maskChaveNFe(v) {
  const d = (v ?? '').replace(/\D/g, '').slice(0, 44)
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

// Calcula a data de vencimento e a quantidade de parcelas a partir da condição de pagamento
export function condicaoParaParcelas(condicao) {
  switch (condicao) {
    case 'À vista': return [0]
    case '30 dias': return [30]
    case '60 dias': return [60]
    case '30/60': return [30, 60]
    case '30/60/90': return [30, 60, 90]
    default: return [30]
  }
}

// Gera a lista de parcelas de uma conta
export function gerarParcelas({ valorTotal, numParcelas, dataPrimeiroVencimento, periodicidade = 'Mensal' }) {
  const n = Math.max(1, Number(numParcelas) || 1)
  const valorParcela = Math.round((Number(valorTotal) / n) * 100) / 100
  const parcelas = []
  let acumulado = 0
  for (let i = 0; i < n; i++) {
    const valor = i === n - 1 ? Math.round((Number(valorTotal) - acumulado) * 100) / 100 : valorParcela
    acumulado += valor
    const vencimento = i === 0
      ? dataPrimeiroVencimento
      : avancarPeriodo(dataPrimeiroVencimento, i, periodicidade)
    parcelas.push({ numero: i + 1, valor, vencimento, status: 'Pendente', dataPagamento: null, valorPago: null })
  }
  return parcelas
}

// Gera parcelas a partir de uma lista de offsets em dias (ex: condicaoParaParcelas)
export function gerarParcelasPorDias({ valorTotal, dias, dataBase }) {
  const n = Math.max(1, dias.length)
  const valorParcela = Math.round((Number(valorTotal) / n) * 100) / 100
  const parcelas = []
  let acumulado = 0
  for (let i = 0; i < n; i++) {
    const valor = i === n - 1 ? Math.round((Number(valorTotal) - acumulado) * 100) / 100 : valorParcela
    acumulado += valor
    parcelas.push({ numero: i + 1, valor, vencimento: addDays(dataBase, dias[i]), status: 'Pendente', dataPagamento: null, valorPago: null })
  }
  return parcelas
}

function avancarPeriodo(dataBase, vezes, periodicidade) {
  switch (periodicidade) {
    case 'Semanal': return addDays(dataBase, 7 * vezes)
    case 'Trimestral': return addMonths(dataBase, 3 * vezes)
    case 'Anual': return addMonths(dataBase, 12 * vezes)
    case 'Mensal':
    default: return addMonths(dataBase, vezes)
  }
}

// Gera as parcelas de uma conta recorrente entre dataInicio e dataFim (ou 12 ocorrências se sem fim)
export function gerarParcelasRecorrentes({ valorTotal, dataInicio, dataFim, periodicidade = 'Mensal' }) {
  const parcelas = []
  const limite = dataFim || avancarPeriodo(dataInicio, 12, periodicidade)
  for (let i = 0; i < 60; i++) {
    const vencimento = i === 0 ? dataInicio : avancarPeriodo(dataInicio, i, periodicidade)
    if (vencimento > limite) break
    parcelas.push({ numero: i + 1, valor: Number(valorTotal), vencimento, status: 'Pendente', dataPagamento: null, valorPago: null })
  }
  return parcelas.length ? parcelas : [{ numero: 1, valor: Number(valorTotal), vencimento: dataInicio, status: 'Pendente', dataPagamento: null, valorPago: null }]
}

// Atualiza o status das parcelas pendentes que já venceram para 'Vencido'
export function recalcStatusParcelas(parcelas) {
  const hoje = todayISO()
  return (parcelas ?? []).map(p => {
    if (p.status === 'Pendente' && p.vencimento < hoje) return { ...p, status: 'Vencido' }
    return p
  })
}

// Lança um movimento no Financeiro (petvet-lancamentos), persistido diretamente no localStorage
export function lancarFinanceiro({ type, category, date, value, description, method = 'Boleto', status }) {
  try {
    const atual = JSON.parse(localStorage.getItem('petvet-lancamentos') ?? '[]')
    const novo = {
      id: `f${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      type, category, date, value: Number(value), description, method,
      status: status ?? (type === 'receita' ? 'recebido' : 'pago'),
    }
    localStorage.setItem('petvet-lancamentos', JSON.stringify([...atual, novo]))
    return novo
  } catch {
    return null
  }
}

export function exportCSV(filename, headers, rows) {
  const bom = '﻿'
  const lines = [headers.join(';'), ...rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))]
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename + '.csv'; a.click()
  URL.revokeObjectURL(url)
}

export function blobToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
