import { createContext, useContext, useState, useEffect } from 'react'

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

  function setIdentidade(updater) {
    setIdState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  function resetIdentidade() {
    setIdState({ ...DEFAULT_IDENTIDADE })
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
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
