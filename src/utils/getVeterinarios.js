import { VETS } from '../data/mock'

function toVetShape(u) {
  return { id: u.id, name: u.name, crmv: u.crmv || '', mapa: u.mapa || '', specialty: u.specialty || '' }
}

function getStoredUsers() {
  try {
    const stored = JSON.parse(localStorage.getItem('petvet-usuarios') ?? 'null')
    return Array.isArray(stored) ? stored : null
  } catch { return null }
}

// Usado nos selects de escolha — apenas veterinários (não admin)
export function getVeterinarios() {
  const stored = getStoredUsers()
  if (stored && stored.length > 0) {
    const vets = stored
      .filter(u => u.active !== false && u.role === 'veterinario')
      .map(toVetShape)
    if (vets.length > 0) return vets
  }
  return VETS
}

// Usado para exibição de registros históricos — busca qualquer usuário pelo id
export function findVetById(id) {
  if (!id) return null
  const stored = getStoredUsers()
  if (stored) {
    const u = stored.find(x => x.id === id)
    if (u) return toVetShape(u)
  }
  return VETS.find(v => v.id === id) ?? null
}
