import { createContext, useContext, useState, useEffect } from 'react'
import { loadFromSupabase, syncToSupabase } from '../hooks/useSupabaseSync'

export const DEFAULT_IDENTIDADE = {
  nomeP: 'Emporium Vazpet',
  nomeS: '+ Tatá Bichos',
  slogan: 'Sistema de gestão',
  logoP: null,
  logoS: null,
  corPrimaria: '#27B5AC',
  corDestaque: '#DE098D',
}

const STORAGE_KEY = 'petvet-identidade'

function load() {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    return s ? { ...DEFAULT_IDENTIDADE, ...JSON.parse(s) } : { ...DEFAULT_IDENTIDADE }
  } catch { return { ...DEFAULT_IDENTIDADE } }
}

function applyColors(corPrimaria, corDestaque) {
  const r = document.documentElement
  r.style.setProperty('--teal', corPrimaria)
  r.style.setProperty('--magenta', corDestaque)
}

const IdentidadeContext = createContext(null)

export function IdentidadeProvider({ children }) {
  const [identidade, setIdState] = useState(load)

  useEffect(() => {
    applyColors(identidade.corPrimaria, identidade.corDestaque)
  }, [identidade.corPrimaria, identidade.corDestaque])

  useEffect(() => {
    document.title = identidade.nomeP
  }, [identidade.nomeP])

  // Busca do Supabase na montagem — com proteção por timestamp para não apagar logos locais
  useEffect(() => {
    loadFromSupabase(STORAGE_KEY).then(result => {
      if (!result.ok || !result.data || typeof result.data !== 'object' || Array.isArray(result.data)) return

      const supabaseTime = result.data._updatedAt || 0
      let localTime = 0
      try {
        const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
        localTime = local?._updatedAt || 0
      } catch {}

      if (supabaseTime >= localTime) {
        // Supabase é mais recente ou igual — usar dados do Supabase
        const merged = { ...DEFAULT_IDENTIDADE, ...result.data }
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)) } catch {}
        setIdState(merged)
      } else {
        // Local é mais recente — NÃO sobrescrever; empurrar local para Supabase
        try {
          const localData = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
          if (localData) syncToSupabase(STORAGE_KEY, localData).catch(() => {})
        } catch {}
      }
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function setIdentidade(updater) {
    setIdState(prev => {
      const raw  = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      // Sempre stampa o momento do save — usado para resolver conflitos Supabase vs local
      const next = { ...raw, _updatedAt: Date.now() }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      syncToSupabase(STORAGE_KEY, next)
      return next
    })
  }

  function resetIdentidade() {
    const next = { ...DEFAULT_IDENTIDADE, _updatedAt: Date.now() }
    setIdState(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
    syncToSupabase(STORAGE_KEY, next)
  }

  return (
    <IdentidadeContext.Provider value={{ identidade, setIdentidade, resetIdentidade }}>
      {children}
    </IdentidadeContext.Provider>
  )
}

export function useIdentidade() {
  const ctx = useContext(IdentidadeContext)
  if (!ctx) throw new Error('useIdentidade deve ser usado dentro de IdentidadeProvider')
  return ctx
}
