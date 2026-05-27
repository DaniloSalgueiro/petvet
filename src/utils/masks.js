export function maskCPF(v) {
  const n = String(v).replace(/\D/g, '').slice(0, 11)
  if (n.length <= 3) return n
  if (n.length <= 6) return `${n.slice(0,3)}.${n.slice(3)}`
  if (n.length <= 9) return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6)}`
  return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9)}`
}

export function maskRG(v) {
  const n = String(v).replace(/\D/g, '').slice(0, 9)
  if (n.length <= 2) return n
  if (n.length <= 5) return `${n.slice(0,2)}.${n.slice(2)}`
  if (n.length <= 8) return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5)}`
  return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}-${n.slice(8)}`
}

export function maskPhone(v) {
  const n = String(v).replace(/\D/g, '').slice(0, 11)
  if (n.length <= 2) return n.length ? `(${n}` : ''
  if (n.length <= 6) return `(${n.slice(0,2)}) ${n.slice(2)}`
  if (n.length <= 10) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`
  return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`
}

export function maskCEP(v) {
  const n = String(v).replace(/\D/g, '').slice(0, 8)
  if (n.length <= 5) return n
  return `${n.slice(0,5)}-${n.slice(5)}`
}
