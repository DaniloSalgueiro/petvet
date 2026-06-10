import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Substituto drop-in para usePersistentState.
 * API idêntica: const [state, setState] = useCloudState(key, initialValue)
 * Retorna um terceiro valor opcional: syncStatus ('idle'|'pending'|'synced'|'error'|'offline')
 *
 * Comportamento:
 * 1. Inicializa do localStorage instantaneamente (sem flash)
 * 2. Busca do Supabase em background e atualiza se houver dados
 * 3. Se Supabase estiver vazio mas há dados locais: salva no Supabase imediatamente
 * 4. Salva no Supabase com debounce de 800ms a cada mudança de estado
 * 5. Sempre mantém o localStorage atualizado como cache offline
 */

function isEmptyValue(val) {
  if (val === null || val === undefined) return true
  if (Array.isArray(val)) return val.length === 0
  if (typeof val === 'object') return Object.keys(val).length === 0
  return false
}

export function useCloudState(key, initialValue) {
  // Inicialização síncrona do localStorage — render imediato sem esperar Supabase
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored !== null ? JSON.parse(stored) : initialValue
    } catch {
      return initialValue
    }
  })

  const [syncStatus, setSyncStatus] = useState('idle')
  const mountedRef    = useRef(true)
  const saveTimerRef  = useRef(null)
  const isInitialRef  = useRef(true)   // true até o primeiro efeito de save passar
  const fromCloudRef  = useRef(false)  // true quando setState veio do Supabase
  const stateRef      = useRef(state)  // sempre reflete o valor mais recente

  useEffect(() => { stateRef.current = state }, [state])

  // ── Escuta evento de sync periódico do App.jsx ────────────────────────────
  useEffect(() => {
    function handleSync(e) {
      if (e.detail?.key !== key) return
      try {
        const updated = JSON.parse(localStorage.getItem(key))
        if (updated !== null) {
          fromCloudRef.current = true
          setState(updated)
        }
      } catch {}
    }
    window.addEventListener('supabase-sync', handleSync)
    return () => window.removeEventListener('supabase-sync', handleSync)
  }, [key])

  // ── Busca do Supabase na montagem ──────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true

    supabase
      .from('app_state')
      .select('value')
      .eq('key', key)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!mountedRef.current) return
        if (!error && data?.value !== undefined && data.value !== null) {
          // Comparar timestamps antes de sobrescrever dados locais
          const supabaseTime = data.value?._updatedAt || 0
          const localTime    = stateRef.current?._updatedAt || 0

          if (supabaseTime >= localTime) {
            // Supabase é mais recente ou igual — atualizar local
            fromCloudRef.current = true
            setState(data.value)
            try { localStorage.setItem(key, JSON.stringify(data.value)) } catch {}
          } else {
            // Local é mais recente — empurrar local para Supabase (fire-and-forget)
            const val = stateRef.current
            if (!isEmptyValue(val)) {
              supabase.from('app_state').upsert(
                { key, value: val, updated_at: new Date().toISOString() },
                { onConflict: 'key' }
              ).catch(() => {})
            }
          }
        } else if (!error) {
          // Supabase conectado mas sem dados para esta chave:
          // persiste o valor atual (localStorage ou initialValue) para outros dispositivos
          const val = stateRef.current
          if (!isEmptyValue(val)) {
            supabase.from('app_state').upsert(
              { key, value: val, updated_at: new Date().toISOString() },
              { onConflict: 'key' }
            ).catch(() => {})
          }
        }
        setSyncStatus('synced')
      })
      .catch(() => {
        if (mountedRef.current) setSyncStatus('offline')
      })

    return () => { mountedRef.current = false }
  }, [key])

  // ── Salva no localStorage + Supabase (debounced) a cada mudança ────────────
  useEffect(() => {
    // Sempre atualiza localStorage imediatamente
    try { localStorage.setItem(key, JSON.stringify(state)) } catch {}

    // Primeira execução (montagem inicial): não salva no Supabase
    if (isInitialRef.current) {
      isInitialRef.current = false
      return
    }

    // Dado veio do Supabase: não re-salva (evita round-trip desnecessário)
    if (fromCloudRef.current) {
      fromCloudRef.current = false
      setSyncStatus('synced')
      return
    }

    // Salva no Supabase com debounce
    setSyncStatus('pending')
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return
      try {
        const { error } = await supabase
          .from('app_state')
          .upsert(
            { key, value: state, updated_at: new Date().toISOString() },
            { onConflict: 'key' }
          )
        if (mountedRef.current) {
          setSyncStatus(error ? 'error' : 'synced')
        }
      } catch {
        if (mountedRef.current) setSyncStatus('offline')
      }
    }, 800)

    return () => clearTimeout(saveTimerRef.current)
  }, [key, state])

  return [state, setState, syncStatus]
}
