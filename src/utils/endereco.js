export const EMPTY_ENDERECO = {
  rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '',
}

// Normaliza qualquer formato de endereço (string antiga ou objeto novo) em objeto.
export function getEnderecoObj(value) {
  if (value && typeof value === 'object') return { ...EMPTY_ENDERECO, ...value }
  if (typeof value === 'string' && value.trim()) return { ...EMPTY_ENDERECO, rua: value.trim() }
  return { ...EMPTY_ENDERECO }
}

// Monta string de endereço otimizada para busca em mapas.
export function montarEnderecoMapa(end) {
  if (!end) return ''
  const partes = [end.rua, end.numero, end.complemento, end.bairro, end.cidade, end.estado, 'Brasil'].filter(Boolean)
  return partes.join(', ')
}

// Retorna o endereço do tutor como string, independente do formato (antigo ou novo).
export function getEnderecoString(tutor) {
  if (!tutor) return ''
  if (tutor.endereco && typeof tutor.endereco === 'object') {
    const { rua, numero, complemento, bairro, cidade, estado, cep } = tutor.endereco
    const partes = [rua, numero, complemento, bairro, cidade, estado].filter(Boolean)
    let str = partes.join(', ')
    if (cep) str += (str ? ' — ' : '') + `CEP ${cep}`
    return str
  }
  if (typeof tutor.address === 'string') return tutor.address
  return ''
}

// Endereço considerado completo se rua, número e cidade estiverem preenchidos.
export function enderecoCompleto(end) {
  return !!(end?.rua && end?.numero && end?.cidade)
}

// Indica se o tutor ainda está no formato antigo (endereço como string solta).
export function enderecoFoiMigrado(tutor) {
  return !tutor?.endereco && typeof tutor?.address === 'string' && tutor.address.trim() !== ''
}
