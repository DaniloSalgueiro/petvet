// eslint-disable-next-line no-misleading-character-class
const DIACRITICS = /[̀-ͯ]/g

export function norm(text) {
  return String(text ?? '').normalize('NFD').replace(DIACRITICS, '').toLowerCase()
}

export function normIncludes(haystack, needle) {
  if (!needle) return true
  return norm(haystack).includes(norm(needle))
}
