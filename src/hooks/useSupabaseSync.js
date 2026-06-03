import { supabase } from '../lib/supabase'

// Todas as chaves do localStorage que devem ser sincronizadas
const SYNC_KEYS = [
  'petvet-pets',
  'petvet-tutores',
  'petvet-usuarios',
  'petvet-agendamentos',
  'petvet-prontuarios',
  'petvet-estoque',
  'petvet-catalogo',
  'petvet-catalogo-domicilio',
  'petvet-funcionarios',
  'petvet-lancamentos',
  'petvet-vac-protocols',
  'petvet-vac-applications',
  'petvet-racas',
  'petvet-bulario',
  'petvet-vendas',
  'petvet-ss-config',
  'petvet-prontuario-config',
  'petvet-identidade',
  'petvet-followup-queue',
  'petvet-passwords',
  'petvet-config-fiscal',
  'petvet-plano-contas',
  'petvet-saldo-inicial',
  'petvet-centro-custos',
  'petvet-contas-bancarias',
  'petvet-extrato-bancario',
  'petvet-impostos-hist',
  'petvet-relatorio-contador-hist',
  'petvet-crm-config',
  'petvet-crm-contatos',
]

function isEmptyValue(val) {
  if (val === null || val === undefined) return true
  if (Array.isArray(val)) return val.length === 0
  if (typeof val === 'object') return Object.keys(val).length === 0
  return false
}

/**
 * Busca TODAS as chaves de uma vez do Supabase e atualiza o localStorage.
 * Bidirecional: chaves presentes no localStorage mas ausentes no Supabase
 * são salvas no Supabase em um único upsert em lote.
 * @returns {{ [key: string]: any }} mapa com os valores encontrados no Supabase
 */
export async function loadAll() {
  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('key, value')
      .in('key', SYNC_KEYS)

    if (error) throw error

    // Atualiza localStorage com dados do Supabase
    const foundKeys = new Set()
    const result = {}
    for (const row of (data || [])) {
      result[row.key] = row.value
      foundKeys.add(row.key)
      try { localStorage.setItem(row.key, JSON.stringify(row.value)) } catch {}
    }

    // Chaves ausentes no Supabase mas presentes no localStorage → upsert em lote
    const missingRows = []
    for (const key of SYNC_KEYS) {
      if (foundKeys.has(key)) continue
      const raw = localStorage.getItem(key)
      if (raw === null) continue
      try {
        const value = JSON.parse(raw)
        if (!isEmptyValue(value)) {
          missingRows.push({ key, value, updated_at: new Date().toISOString() })
        }
      } catch {}
    }

    if (missingRows.length > 0) {
      await supabase
        .from('app_state')
        .upsert(missingRows, { onConflict: 'key' })
        .catch(e => console.warn('[PetVet] loadAll upsert missing:', e.message))
      console.log(`[PetVet] loadAll: ${missingRows.length} chave(s) do localStorage salvas no Supabase`)
    }

    console.log(`[PetVet] loadAll: ${(data || []).length}/${SYNC_KEYS.length} chaves carregadas do Supabase`)
    return result
  } catch (e) {
    console.warn('[PetVet] loadAll erro:', e.message)
    return {}
  }
}

/**
 * Upsert de uma chave/valor no Supabase (tabela app_state).
 * @param {string} key  - chave do localStorage
 * @param {any}    data - valor já parseado (armazenado como JSONB)
 */
export async function syncToSupabase(key, data) {
  try {
    const { error } = await supabase
      .from('app_state')
      .upsert(
        { key, value: data, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
    if (error) throw error
    return { ok: true }
  } catch (e) {
    console.warn(`[Supabase] syncToSupabase("${key}"):`, e.message)
    return { ok: false, error: e.message }
  }
}

/**
 * Busca o valor de uma chave no Supabase.
 * @param {string} key - chave do localStorage
 */
export async function loadFromSupabase(key) {
  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    if (error) throw error
    return { ok: true, data: data?.value ?? null }
  } catch (e) {
    console.warn(`[Supabase] loadFromSupabase("${key}"):`, e.message)
    return { ok: false, data: null }
  }
}

/**
 * Sincroniza TODOS os dados do localStorage para o Supabase.
 * Pode ser chamado manualmente ou pela migração inicial.
 * @returns {{ sucesso: number, erro: number, detalhes: Array }}
 */
export async function syncAll() {
  console.group('[PetVet] syncAll — iniciando sync do localStorage → Supabase')
  console.log('Chaves a sincronizar:', SYNC_KEYS)

  const detalhes = []
  let sucesso = 0
  let erro = 0

  for (const key of SYNC_KEYS) {
    const raw = localStorage.getItem(key)
    if (raw === null) {
      console.log(`  ⏭  ${key} — não encontrada no localStorage, pulando`)
      continue
    }

    let value
    try {
      value = JSON.parse(raw)
    } catch (e) {
      console.warn(`  ✗  ${key} — JSON inválido:`, e.message)
      detalhes.push({ key, ok: false, error: `JSON inválido: ${e.message}` })
      erro++
      continue
    }

    const tamanho = Array.isArray(value) ? `${value.length} itens` : typeof value
    console.log(`  ↑  ${key} (${tamanho}) — enviando...`)

    const result = await syncToSupabase(key, value)
    if (result.ok) {
      console.log(`  ✓  ${key} — salvo`)
      sucesso++
    } else {
      console.warn(`  ✗  ${key} — erro:`, result.error)
      erro++
    }
    detalhes.push({ key, ...result })
  }

  console.log(`\n[PetVet] syncAll concluído — sucesso: ${sucesso}, erro: ${erro}`)
  console.groupEnd()

  return { sucesso, erro, detalhes }
}

/**
 * Migração única do localStorage para o Supabase.
 * Verifica flag 'petvet-migrated' para não repetir.
 * Exposto em window.migrateLocalStorageToSupabase() para uso no console do browser.
 *
 * Para forçar re-migração: localStorage.removeItem('petvet-migrated')
 *
 * @returns {{ skipped: boolean, sucesso?: number, erro?: number, detalhes?: Array }}
 */
export async function migrateLocalStorageToSupabase() {
  if (localStorage.getItem('petvet-migrated') === 'true') {
    console.warn('[PetVet] Migração já realizada. Para repetir: localStorage.removeItem("petvet-migrated")')
    return { skipped: true, reason: 'Migração já realizada anteriormente.' }
  }

  console.log('[PetVet] Iniciando migração localStorage → Supabase...')
  console.time('[PetVet] Migração total')

  const { sucesso, erro, detalhes } = await syncAll()

  console.timeEnd('[PetVet] Migração total')

  if (erro === 0) {
    localStorage.setItem('petvet-migrated', 'true')
    console.log('[PetVet] ✅ Migração concluída com sucesso! Flag petvet-migrated definida.')
  } else {
    console.warn(`[PetVet] ⚠️  Migração concluída com ${erro} erro(s). Flag NÃO definida — corrija e tente novamente.`)
    console.table(detalhes.filter(d => !d.ok))
  }

  return { skipped: false, sucesso, erro, detalhes }
}
