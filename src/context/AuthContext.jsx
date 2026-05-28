import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { loadFromSupabase, syncToSupabase } from '../hooks/useSupabaseSync'
import { USUARIOS } from '../data/mock'

const AuthContext = createContext(null)
const DEFAULT_PASSWORD = '123456'
const DELETED_KEY = 'petvet-usuarios-deletados'

function getDeletedIds() {
  try { return new Set(JSON.parse(localStorage.getItem(DELETED_KEY) ?? '[]')) } catch { return new Set() }
}

export function markUserDeleted(id) {
  try {
    const ids = JSON.parse(localStorage.getItem(DELETED_KEY) ?? '[]')
    if (!ids.includes(id)) localStorage.setItem(DELETED_KEY, JSON.stringify([...ids, id]))
  } catch {}
}

function getStoredUsers() {
  try {
    const s = localStorage.getItem('petvet-usuarios')
    return s ? JSON.parse(s) : USUARIOS
  } catch { return USUARIOS }
}

function getPasswordMap() {
  try {
    const s = localStorage.getItem('petvet-passwords')
    const parsed = s ? JSON.parse(s) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch { return {} }
}

function savePasswordMap(map) {
  try { localStorage.setItem('petvet-passwords', JSON.stringify(map)) } catch {}
}

// Busca petvet-passwords do Supabase e atualiza localStorage se dados forem válidos.
// Retorna o mapa mais recente (Supabase ou localStorage como fallback).
async function fetchAndMergePasswords() {
  try {
    const result = await loadFromSupabase('petvet-passwords')
    if (result.ok && result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
      savePasswordMap(result.data)
      return result.data
    }
  } catch {}
  return getPasswordMap()
}

function initializeAuthStorage() {
  try {
    const storedRaw = localStorage.getItem('petvet-usuarios')
    if (storedRaw) {
      const stored = JSON.parse(storedRaw)
      if (!Array.isArray(stored)) throw new Error('invalid')
      const storedById = Object.fromEntries(stored.map(u => [u.id, u]))
      const deletedIds = getDeletedIds()
      const activeMockUsers = USUARIOS.filter(u => !deletedIds.has(u.id))
      const missingMockUser = activeMockUsers.some(u => !storedById[u.id])
      if (missingMockUser) {
        const extra = stored.filter(u => !USUARIOS.find(m => m.id === u.id))
        localStorage.setItem('petvet-usuarios', JSON.stringify([...activeMockUsers, ...extra]))
      }
    }
  } catch {
    localStorage.removeItem('petvet-usuarios')
  }

  const users = getStoredUsers()
  const map = getPasswordMap()
  const validIds = new Set(users.map(u => u.id))
  let changed = false
  for (const u of users) {
    if (!map[u.id] || typeof map[u.id].password !== 'string') {
      map[u.id] = { password: DEFAULT_PASSWORD, firstLogin: u.firstLogin !== false }
      changed = true
    }
  }
  for (const id of Object.keys(map)) {
    if (!validIds.has(id)) { delete map[id]; changed = true }
  }
  if (changed) savePasswordMap(map)
}

const SESSION_KEY = 'petvet-session-user'

function getSessionUser() {
  try {
    const s = sessionStorage.getItem(SESSION_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

function saveSession(user) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)) } catch {}
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch {}
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getSessionUser())
  const [mustChangePassword, setMustChangePassword] = useState(false)

  useEffect(() => {
    initializeAuthStorage()
    // Sincroniza senhas do Supabase na inicialização (atualiza localStorage com dados mais recentes)
    fetchAndMergePasswords()

    // Ouve mudanças de sessão do Supabase (ex: expiração, logout externo)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setMustChangePassword(false)
        clearSession()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Login: tenta Supabase Auth primeiro, cai no localStorage se falhar ──────
  async function login(email, password) {
    // Tentativa 1: Supabase Auth
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (!error && data.user) {
        const users = getStoredUsers()
        const found = users.find(u => u.email?.toLowerCase() === email.toLowerCase())
        if (found && found.active !== false) {
          setUser(found)
          setMustChangePassword(false)
          saveSession(found)
          return true
        }
      }
    } catch {}

    // Tentativa 2: busca senhas atualizadas do Supabase antes de autenticar localmente
    await fetchAndMergePasswords()
    return loginLegacy(email, password)
  }

  function loginLegacy(email, password) {
    const users = getStoredUsers()
    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase())
    if (!found || found.active === false) return false

    const map = getPasswordMap()
    const entry = map[found.id]
    const storedPwd = entry?.password ?? DEFAULT_PASSWORD
    const isFirst = entry === undefined
      ? (found.firstLogin !== false)
      : (entry.firstLogin ?? true)

    if (password !== storedPwd) return false

    setUser(found)
    setMustChangePassword(isFirst)
    saveSession(found)
    return true
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  async function logout() {
    setUser(null)
    setMustChangePassword(false)
    clearSession()
    try { await supabase.auth.signOut() } catch {}
  }

  // ── Permissões ─────────────────────────────────────────────────────────────
  function hasRole(...roles) {
    return user && roles.includes(user.role)
  }

  function hasPermission(module, level = 'view') {
    if (!user) return false
    if (user.role === 'admin') return true
    const perm = user.permissions?.[module]
    if (perm === undefined || perm === null) return false
    if (typeof perm === 'boolean') return perm
    if (typeof perm === 'object') return perm[level] ?? false
    return false
  }

  // ── Troca de senha ─────────────────────────────────────────────────────────
  async function changePassword(newPassword) {
    if (!user) return
    const map = getPasswordMap()
    map[user.id] = { password: newPassword, firstLogin: false }
    savePasswordMap(map)
    setMustChangePassword(false)
    // Sincroniza com Supabase (fire-and-forget para não bloquear o UI)
    syncToSupabase('petvet-passwords', map)
    // Atualiza no Supabase Auth se a sessão for do Supabase
    try { await supabase.auth.updateUser({ password: newPassword }) } catch {}
  }

  function resetPassword(userId) {
    const map = getPasswordMap()
    map[userId] = { password: DEFAULT_PASSWORD, firstLogin: true }
    savePasswordMap(map)
    // Sincroniza com Supabase (fire-and-forget)
    syncToSupabase('petvet-passwords', map)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, hasRole, hasPermission, changePassword, resetPassword, mustChangePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
