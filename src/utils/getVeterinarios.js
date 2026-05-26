import { VETS } from '../data/mock'

export function getVeterinarios() {
  try {
    const stored = JSON.parse(localStorage.getItem('petvet-usuarios') ?? 'null')
    if (Array.isArray(stored) && stored.length > 0) {
      const vets = stored.filter(
        u => u.active !== false && (u.role === 'veterinario' || u.role === 'admin')
      ).map(u => ({
        id:        u.id,
        name:      u.name,
        crmv:      u.crmv  || '',
        mapa:      u.mapa  || '',
        specialty: u.specialty || '',
      }))
      if (vets.length > 0) return vets
    }
  } catch {}
  return VETS
}

export function findVetById(id) {
  if (!id) return null
  return getVeterinarios().find(v => v.id === id) ?? null
}
