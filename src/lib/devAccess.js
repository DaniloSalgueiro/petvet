// Módulos que o role 'dev' pode acessar sem autorização do cliente
export const DEV_MODULOS_PERMITIDOS = [
  'configuracoes',
  'prontuario-config',
  'racas',
  'bulario',
  'dashboard',
]

// Módulos bloqueados para dev (dados pessoais / clínicos / financeiros)
export const DEV_MODULOS_BLOQUEADOS = [
  'pets',
  'prontuario',
  'financeiro',
  'pdv',
  'usuarios',
  'funcionarios',
  'agenda',
  'relatorios',
  'contabilidade',
  'crm',
  'estoque',
  'servicos',
  'vacinaprotocolo',
]

export const SUPORTE_KEY   = 'petvet-suporte-ativo'
export const DEV_LOG_KEY   = 'petvet-dev-access-log'

// Retorna o objeto de suporte {ativo, ativadoEm, expiracao, ativadoPor} ou null
export function getSuporteData() {
  try { return JSON.parse(localStorage.getItem(SUPORTE_KEY) ?? 'null') } catch { return null }
}

// Verifica se o modo suporte está ativo E dentro da validade
export function isSuporteAtivo() {
  const d = getSuporteData()
  if (!d || !d.ativo) return false
  return new Date(d.expiracao) > new Date()
}

// Decide se um usuário dev pode acessar o módulo (permissão própria ou suporte ativo)
export function devPodeAcessar(modulo) {
  if (DEV_MODULOS_PERMITIDOS.includes(modulo)) return true
  return isSuporteAtivo()
}

// Registra acesso dev no log (persiste no localStorage para o admin ver)
export function registrarAcessoDev(modulo, userName) {
  try {
    const log = JSON.parse(localStorage.getItem(DEV_LOG_KEY) ?? '[]')
    log.unshift({
      modulo,
      usuario: userName || 'dev',
      timestamp: new Date().toISOString(),
      suporteAtivo: isSuporteAtivo(),
    })
    localStorage.setItem(DEV_LOG_KEY, JSON.stringify(log.slice(0, 200)))
  } catch {}
}

// Ativa o modo suporte por 24h
export function ativarSuporte(ativadoPor) {
  const agora = new Date()
  const expiracao = new Date(agora.getTime() + 24 * 60 * 60 * 1000)
  const data = {
    ativo: true,
    ativadoEm: agora.toISOString(),
    expiracao: expiracao.toISOString(),
    ativadoPor: ativadoPor || 'admin',
  }
  localStorage.setItem(SUPORTE_KEY, JSON.stringify(data))
  return data
}

// Revoga o modo suporte
export function revogarSuporte() {
  const d = getSuporteData()
  if (d) localStorage.setItem(SUPORTE_KEY, JSON.stringify({ ...d, ativo: false }))
}
