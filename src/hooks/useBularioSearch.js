import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { normIncludes } from '../utils/normalizeText'

// Converte snake_case do Supabase para camelCase do sistema
function mapFromSupabase(row) {
  return {
    id:                   row.id,
    registroMapa:         row.registro_mapa,
    nomeComercial:        row.nome_comercial,
    nomeGenerico:         row.nome_generico,
    fabricante:           row.fabricante,
    categoria:            row.categoria || 'Outros',
    subCategoria:         row.sub_categoria,
    apresentacao:         row.apresentacao,
    concentracao:         row.concentracao,
    classeTerapeutica:    row.classe_terapeutica,
    indicacoes:           row.indicacoes,
    contraindicacoes:     row.contraindicacoes,
    doseCao:              row.dose_cao,
    doseGato:             row.dose_gato,
    doseCaoCalculo:       row.dose_cao_calculo,
    doseGatoCalculo:      row.dose_gato_calculo,
    doseOutros:           row.dose_outros,
    via:                  row.via,
    frequencia:           row.frequencia,
    duracao:              row.duracao,
    efeitosAdversos:      row.efeitos_adversos,
    interacoes:           row.interacoes,
    observacoes:          row.observacoes,
    periodoCarencia:      row.periodo_carencia,
    prescricaoVeterinaria: row.prescricao_veterinaria,
    controlado:           row.controlado,
    foto:                 row.foto_url || null,
    fonte:                row.fonte || 'MAPA',
  }
}

function localFallback(query) {
  try {
    const local = JSON.parse(localStorage.getItem('petvet-bulario') || '[]')
    return local
      .filter(m =>
        normIncludes(m.nomeComercial, query) ||
        normIncludes(m.nomeGenerico, query)   ||
        normIncludes(m.indicacoes, query)
      )
      .slice(0, 20)
  } catch { return [] }
}

export function useBularioSearch() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [source, setSource]   = useState('local') // 'supabase' | 'local'

  const search = useCallback(async (query) => {
    if (!query || query.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('bulario_completo')
        .select('*')
        .or(`nome_comercial.ilike.%${query}%,nome_generico.ilike.%${query}%,indicacoes.ilike.%${query}%`)
        .limit(20)
        .order('nome_comercial')

      if (!error && data && data.length > 0) {
        setResults(data.map(mapFromSupabase))
        setSource('supabase')
      } else {
        // Supabase sem resultados ou tabela não existe → busca local
        setResults(localFallback(query))
        setSource('local')
      }
    } catch {
      setResults(localFallback(query))
      setSource('local')
    }
    setLoading(false)
  }, [])

  return { results, loading, search, source }
}

// Busca contagem total da tabela Supabase (fire-and-forget)
export async function getBularioCount() {
  try {
    const { count, error } = await supabase
      .from('bulario_completo')
      .select('*', { count: 'exact', head: true })
    if (!error && count !== null) return count
  } catch {}
  return null
}
