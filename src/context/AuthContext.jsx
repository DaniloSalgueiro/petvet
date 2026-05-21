import { createContext, useContext, useState, useEffect } from 'react'
import { USUARIOS } from '../data/mock'

const AuthContext = createContext(null)
const DEFAULT_PASSWORD = '123456'

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

function initializeAuthStorage() {
  // Garante que todos os usuários do mock estão no storage (corrige dados corrompidos/desatualizados)
  try {
    const storedRaw = localStorage.getItem('petvet-usuarios')
    if (storedRaw) {
      const stored = JSON.parse(storedRaw)
      if (!Array.isArray(stored)) throw new Error('invalid')
      const storedById = Object.fromEntries(stored.map(u => [u.id, u]))
      const missingMockUser = USUARIOS.some(u => !storedById[u.id])
      if (missingMockUser) {
        const extra = stored.filter(u => !USUARIOS.find(m => m.id === u.id))
        localStorage.setItem('petvet-usuarios', JSON.stringify([...USUARIOS, ...extra]))
      }
    }
  } catch {
    localStorage.removeItem('petvet-usuarios')
  }

  // Garante que todos os usuários têm uma entrada válida no mapa de senhas
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
  // Remove entradas órfãs de usuários que não existem mais
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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getSessionUser())
  const [mustChangePassword, setMustChangePassword] = useState(false)

  useEffect(() => { initializeAuthStorage() }, [])

  function login(email, password) {
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

    const sessionUser = { ...found }
    setUser(sessionUser)
    setMustChangePassword(isFirst)
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser)) } catch {}
    return true
  }

  function logout() {
    setUser(null)
    setMustChangePassword(false)
    try { sessionStorage.removeItem(SESSION_KEY) } catch {}
  }

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

  function changePassword(newPassword) {
    if (!user) return
    const map = getPasswordMap()
    map[user.id] = { password: newPassword, firstLogin: false }
    savePasswordMap(map)
    setMustChangePassword(false)
  }

  function resetPassword(userId) {
    const map = getPasswordMap()
    map[userId] = { password: DEFAULT_PASSWORD, firstLogin: true }
    savePasswordMap(map)
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
