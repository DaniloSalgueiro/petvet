import { useState, useCallback } from 'react'

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

export function useAISearch({ entityType, dataForPrompt }) {
  const [aiLoading, setAiLoading] = useState(false)
  const [aiLabel, setAiLabel]   = useState(null)
  const [aiIds, setAiIds]       = useState(null)
  const [aiError, setAiError]   = useState(null)
  const hasKey = Boolean(API_KEY)

  const search = useCallback(async (query) => {
    setAiIds(null)
    setAiLabel(null)
    setAiError(null)
    const q = query?.trim() ?? ''
    if (q.length < 3) return

    if (!API_KEY) {
      setAiError('Chave da API não configurada. Adicione VITE_ANTHROPIC_API_KEY no arquivo .env e reinicie o servidor.')
      return
    }

    setAiLoading(true)
    try {
      const systemPrompt = `Você é um assistente de busca de uma clínica veterinária PetVet.
Dados disponíveis: ${dataForPrompt}
Retorne APENAS um objeto JSON com os IDs que correspondem à busca do usuário.
Formato obrigatório: {"ids": ["id1", "id2"], "label": "descrição curta do filtro aplicado"}`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 512,
          messages: [{ role: 'user', content: `Busca: "${q}"` }],
          system: systemPrompt,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg = body?.error?.message ?? `Erro HTTP ${res.status}`
        console.error('[useAISearch] API error:', res.status, body)
        throw new Error(msg)
      }

      const data = await res.json()
      const text = data.content?.[0]?.text ?? ''
      console.log('[useAISearch] resposta:', text)

      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        setAiIds(Array.isArray(parsed.ids) ? parsed.ids : [])
        setAiLabel(parsed.label ?? q)
      } else {
        console.error('[useAISearch] resposta sem JSON:', text)
        setAiError('Resposta inesperada da IA. Tente novamente.')
      }
    } catch (err) {
      console.error('[useAISearch] Erro:', err)
      setAiError(err.message ?? 'Erro ao conectar com a IA')
    } finally {
      setAiLoading(false)
    }
  }, [dataForPrompt])

  const reset = useCallback(() => {
    setAiIds(null)
    setAiLabel(null)
    setAiError(null)
  }, [])

  return { aiLoading, aiLabel, aiIds, aiError, hasKey, search, reset }
}
