import { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { maskCEP } from '../../utils/masks'
import { EMPTY_ENDERECO } from '../../utils/endereco'

export default function EnderecoFields({ value, onChange }) {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const end = { ...EMPTY_ENDERECO, ...(value ?? {}) }

  function set(field, v) {
    onChange({ ...end, [field]: v })
  }

  async function buscarCep(cepValue) {
    const digits = (cepValue ?? end.cep ?? '').replace(/\D/g, '')
    if (digits.length !== 8) return
    setLoading(true); setErro('')
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()
      if (data.erro) { setErro('CEP não encontrado.'); return }
      onChange({
        ...end,
        rua: data.logradouro || end.rua,
        bairro: data.bairro || end.bairro,
        cidade: data.localidade || end.cidade,
        estado: data.uf || end.estado,
      })
    } catch {
      setErro('Não foi possível buscar o CEP. Verifique sua conexão.')
    } finally {
      setLoading(false)
    }
  }

  function handleCepChange(v) {
    const masked = maskCEP(v)
    set('cep', masked)
    if (masked.replace(/\D/g, '').length === 8) buscarCep(masked)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 14 }}>
        <div className="form-group">
          <label className="form-label">CEP</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="form-input" value={end.cep} onChange={e => handleCepChange(e.target.value)} placeholder="00000-000" maxLength={9} />
            <button type="button" className="btn btn-outline btn-sm btn-icon" onClick={() => buscarCep()} disabled={loading} title="Buscar endereço pelo CEP">
              {loading ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Search size={14} />}
            </button>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Rua / Logradouro</label>
          <input className="form-input" value={end.rua} onChange={e => set('rua', e.target.value)} placeholder="Rua, Avenida..." />
        </div>
      </div>
      {erro && <p style={{ fontSize: '0.75rem', color: 'var(--danger)', margin: '-8px 0 0' }}>{erro}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 14 }}>
        <div className="form-group">
          <label className="form-label">Número</label>
          <input className="form-input" value={end.numero} onChange={e => set('numero', e.target.value)} placeholder="Nº" />
        </div>
        <div className="form-group">
          <label className="form-label">Complemento</label>
          <input className="form-input" value={end.complemento} onChange={e => set('complemento', e.target.value)} placeholder="Apto, bloco, casa..." />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 14 }}>
        <div className="form-group">
          <label className="form-label">Bairro</label>
          <input className="form-input" value={end.bairro} onChange={e => set('bairro', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Cidade</label>
          <input className="form-input" value={end.cidade} onChange={e => set('cidade', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">UF</label>
          <input className="form-input" value={end.estado} onChange={e => set('estado', e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" maxLength={2} />
        </div>
      </div>
    </div>
  )
}
