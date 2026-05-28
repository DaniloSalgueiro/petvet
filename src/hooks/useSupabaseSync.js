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
]

/**
 * Upsert de uma chave/valor no Supabase (tabela app_state)
 * @param {string} key - chave do localStorage
 * @param {any} data - valor a salvar (será armazenado como JSONB)
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
 * Busca o valor de uma chave no Supabase
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
 * Chamado na migração inicial ou para forçar re-sync.
 */
export async function syncAll() {
  const results = []
  for (const key of SYNC_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) continue
      const value = JSON.parse(raw)
      const result = await syncToSupabase(key, value)
      results.push({ key, ...result })
    } catch (e) {
      results.push({ key, ok: false, error: e.message })
    }
  }
  return results
}

/**
 * Migração única do localStorage para o Supabase.
 * Verifica flag 'petvet-migrated' para não repetir.
 */
export async function migrateLocalStorageToSupabase() {
  if (localStorage.getItem('petvet-migrated') === 'true') {
    return { skipped: true, reason: 'Migração já realizada anteriormente.' }
  }
  const results = await syncAll()
  const ok = results.every(r => r.ok)
  if (ok) {
    localStorage.setItem('petvet-migrated', 'true')
  }
  return { skipped: false, results, ok }
}
