export function calcularIdade(birthDate) {
  if (!birthDate) return '—'
  const birth = new Date(birthDate + 'T00:00')
  const now = new Date()

  let years = now.getFullYear() - birth.getFullYear()
  let months = now.getMonth() - birth.getMonth()
  const days = now.getDate() - birth.getDate()

  if (days < 0) months--
  if (months < 0) { years--; months += 12 }

  if (years === 0 && months === 0) return 'menos de 1 mês'
  return `${years}a ${months}m`
}
