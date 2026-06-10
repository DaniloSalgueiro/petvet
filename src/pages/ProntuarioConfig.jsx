import { useState } from 'react'
import { Plus, X, Settings } from 'lucide-react'
import { usePersistentState } from '../hooks/usePersistentState'
import { DEFAULT_PRONTUARIO_CONFIG, DEFAULT_GRAVACAO_CONFIG, SECTIONS_CONFIGURABLES, TIPOS_CONSULTA_DEFAULT } from './Prontuario'
import CropModal from '../components/ui/CropModal'
import PhotoUploadButtons from '../components/ui/PhotoUploadButtons'

export const DEFAULT_CLINICA_CONFIG = {
  nome: 'Emporium Vazpet & Tatá Bichos',
  endereco: '',
  telefone: '',
  email: '',
  cnpj: '',
  logoEmporium: null,
  logoTata: null,
}

function buildDefaultSectionConfig(tipos) {
  const cfg = {}
  for (const t of tipos) {
    cfg[t] = Object.fromEntries(SECTIONS_CONFIGURABLES.map(s => [s.id, { visible: true }]))
  }
  return cfg
}

export default function ProntuarioConfigPage() {
  const [config, setConfig] = usePersistentState('petvet-prontuario-config', DEFAULT_PRONTUARIO_CONFIG)
  const [clinica, setClinica] = usePersistentState('petvet-clinica-config', DEFAULT_CLINICA_CONFIG)
  const [gravacaoConfig, setGravacaoConfig] = usePersistentState('petvet-config-gravacao', DEFAULT_GRAVACAO_CONFIG)
  const [comandosVozCustom, setComandosVozCustom] = usePersistentState('petvet-comandos-voz', [])
  const [newTipo, setNewTipo] = useState('')
  const [cropSrc, setCropSrc] = useState(null)
  const [cropField, setCropField] = useState(null)
  const [novoComando, setNovoComando] = useState({ frase: '', campo: '', label: '', tipo: 'texto' })

  function addComandoVoz() {
    const frase = novoComando.frase.trim()
    const campo = novoComando.campo.trim()
    const label = novoComando.label.trim() || frase
    if (!frase || !campo) return
    setComandosVozCustom(list => [...(list ?? []), { id: `custom-${Date.now()}`, frases: [frase], campo, label, tipo: novoComando.tipo }])
    setNovoComando({ frase: '', campo: '', label: '', tipo: 'texto' })
  }

  function removeComandoVoz(id) {
    setComandosVozCustom(list => (list ?? []).filter(c => c.id !== id))
  }

  function handleLogoFile(field, file) {
    const reader = new FileReader()
    reader.onload = ev => { setCropSrc(ev.target.result); setCropField(field) }
    reader.readAsDataURL(file)
  }

  function handleLogoUpload(field, e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    handleLogoFile(field, file)
  }

  function toggleSection(tipo, sectionId) {
    setConfig(prev => {
      const typeConf = prev.sectionConfig?.[tipo] ?? Object.fromEntries(SECTIONS_CONFIGURABLES.map(s => [s.id, { visible: true }]))
      return {
        ...prev,
        sectionConfig: {
          ...prev.sectionConfig,
          [tipo]: {
            ...typeConf,
            [sectionId]: { visible: !(typeConf[sectionId]?.visible !== false) },
          },
        },
      }
    })
  }

  function addTipo() {
    const t = newTipo.trim()
    if (!t || config.tipos.includes(t)) return
    setConfig(prev => ({
      tipos: [...prev.tipos, t],
      sectionConfig: {
        ...prev.sectionConfig,
        [t]: Object.fromEntries(SECTIONS_CONFIGURABLES.map(s => [s.id, { visible: true }])),
      },
    }))
    setNewTipo('')
  }

  function removeTipo(tipo) {
    if (TIPOS_CONSULTA_DEFAULT.includes(tipo)) return
    setConfig(prev => {
      const sc = { ...prev.sectionConfig }
      delete sc[tipo]
      return { tipos: prev.tipos.filter(t => t !== tipo), sectionConfig: sc }
    })
  }

  function resetToDefault() {
    setConfig(DEFAULT_PRONTUARIO_CONFIG)
  }

  const tipos = config?.tipos ?? TIPOS_CONSULTA_DEFAULT

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Configuração de Prontuário</h2>
          <p className="page-subtitle">Defina quais seções aparecem por tipo de consulta</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={resetToDefault}>
          <Settings size={14} /> Restaurar padrão
        </button>
      </div>

      {/* Adicionar tipo */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 10 }}>Tipos de consulta</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          {tipos.map(t => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 20, fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{t}</span>
              {!TIPOS_CONSULTA_DEFAULT.includes(t) && (
                <button onClick={() => removeTipo(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0, lineHeight: 1, display: 'flex' }}>
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, maxWidth: 400 }}>
          <input className="form-input" placeholder="Novo tipo..." value={newTipo} onChange={e => setNewTipo(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTipo()} />
          <button className="btn btn-outline btn-sm" onClick={addTipo} disabled={!newTipo.trim()}>
            <Plus size={14} /> Adicionar
          </button>
        </div>
      </div>

      {/* Matriz de visibilidade */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Seções visíveis por tipo de consulta</p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>Marque as seções que devem aparecer para cada tipo. A seção "Tipo de Consulta" é sempre visível.</p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>
                  Tipo de Consulta
                </th>
                {SECTIONS_CONFIGURABLES.map(s => (
                  <th key={s.id} style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', minWidth: 100 }}>
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tipos.map((tipo, idx) => {
                const typeConf = config?.sectionConfig?.[tipo] ?? Object.fromEntries(SECTIONS_CONFIGURABLES.map(s => [s.id, { visible: true }]))
                return (
                  <tr key={tipo} style={{ background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                    <td style={{ padding: '12px 20px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {tipo}
                    </td>
                    {SECTIONS_CONFIGURABLES.map(s => {
                      const visible = typeConf[s.id]?.visible !== false
                      return (
                        <td key={s.id} style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                          <label style={{ display: 'inline-flex', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={visible}
                              onChange={() => toggleSection(tipo, s.id)}
                              style={{ width: 18, height: 18, accentColor: 'var(--teal)', cursor: 'pointer' }}
                            />
                          </label>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dados da Clínica para Impressão */}
      <div className="card" style={{ padding: '20px' }}>
        <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: 16 }}>Dados da Clínica para Impressão</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Nome da clínica</label>
            <input className="form-input" value={clinica.nome ?? ''} onChange={e => setClinica(c => ({ ...c, nome: e.target.value }))} placeholder="Ex: Emporium Vazpet & Tatá Bichos" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Endereço completo</label>
            <input className="form-input" value={clinica.endereco ?? ''} onChange={e => setClinica(c => ({ ...c, endereco: e.target.value }))} placeholder="Rua, número, bairro, cidade/UF" />
          </div>
          <div className="form-group">
            <label className="form-label">Telefone</label>
            <input className="form-input" value={clinica.telefone ?? ''} onChange={e => setClinica(c => ({ ...c, telefone: e.target.value }))} placeholder="(11) 99999-9999" />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input className="form-input" value={clinica.email ?? ''} onChange={e => setClinica(c => ({ ...c, email: e.target.value }))} placeholder="contato@clinica.com.br" />
          </div>
          <div className="form-group">
            <label className="form-label">CNPJ</label>
            <input className="form-input" value={clinica.cnpj ?? ''} onChange={e => setClinica(c => ({ ...c, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px', marginTop: 14 }}>
          {[
            { field: 'logoEmporium', label: 'Logo Emporium Vazpet' },
            { field: 'logoTata', label: 'Logo Tatá Bichos' },
          ].map(({ field, label }) => (
            <div key={field} className="form-group">
              <label className="form-label">{label}</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {clinica[field] && <img src={clinica[field]} alt={label} style={{ height: 48, maxWidth: 120, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0 }} />}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <PhotoUploadButtons
                    onFile={file => handleLogoFile(field, file)}
                    hasPhoto={!!clinica[field]}
                    label="imagem"
                  />
                  {clinica[field] && <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setClinica(c => ({ ...c, [field]: null }))}>Remover</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Configurações de Gravação */}
      <div className="card" style={{ padding: '20px' }}>
        <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: 16 }}>🎙️ Configurações de Gravação</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
          <div className="form-group">
            <label className="form-label">Idioma do reconhecimento de voz</label>
            <select className="form-select" value={gravacaoConfig.idioma ?? 'pt-BR'} onChange={e => setGravacaoConfig(c => ({ ...c, idioma: e.target.value }))}>
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en-US">English (US)</option>
              <option value="es-ES">Español</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Qualidade do áudio</label>
            <select className="form-select" value={gravacaoConfig.qualidadeAudio ?? 'media'} onChange={e => setGravacaoConfig(c => ({ ...c, qualidadeAudio: e.target.value }))}>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Sensibilidade do microfone: {gravacaoConfig.sensibilidade ?? 1}x</label>
            <input type="range" min="0.5" max="3" step="0.1" value={gravacaoConfig.sensibilidade ?? 1}
              onChange={e => setGravacaoConfig(c => ({ ...c, sensibilidade: Number(e.target.value) }))}
              style={{ width: '100%', accentColor: 'var(--teal)' }} />
          </div>
          <div className="form-group">
            <label className="form-label">Confirmar antes de preencher campo</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Não', 'Sim'].map(o => {
                const sel = (gravacaoConfig.confirmarAntes ?? false) === (o === 'Sim')
                return (
                  <button key={o} type="button" className={sel ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                    onClick={() => setGravacaoConfig(c => ({ ...c, confirmarAntes: o === 'Sim' }))}>
                    {o}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Salvar áudio automaticamente</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Não', 'Sim'].map(o => {
                const sel = (gravacaoConfig.salvarAudioAuto ?? true) === (o === 'Sim')
                return (
                  <button key={o} type="button" className={sel ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                    onClick={() => setGravacaoConfig(c => ({ ...c, salvarAudioAuto: o === 'Sim' }))}>
                    {o}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <hr className="divider" style={{ margin: '18px 0' }} />

        <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 10 }}>Comandos de voz personalizados</p>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 12 }}>
          Crie atalhos de voz para preencher campos específicos. Ex: frase "adicionar antipulgas" preenchendo o campo "derma.antipulgas".
        </p>

        {(comandosVozCustom ?? []).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {comandosVozCustom.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.8125rem' }}>
                <span style={{ flex: 1 }}>
                  <strong>"{c.frases?.[0]}"</strong> → <code>{c.campo}</code> <span style={{ color: 'var(--text-muted)' }}>({c.label}, {c.tipo})</span>
                </span>
                <button onClick={() => removeComandoVoz(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0, lineHeight: 1, display: 'flex' }}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
          <div className="form-group">
            <label className="form-label">Frase de comando</label>
            <input className="form-input" placeholder='Ex: "adicionar antipulgas"' value={novoComando.frase} onChange={e => setNovoComando(c => ({ ...c, frase: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Campo de destino</label>
            <input className="form-input" placeholder="Ex: derma.antipulgas" value={novoComando.campo} onChange={e => setNovoComando(c => ({ ...c, campo: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Rótulo</label>
            <input className="form-input" placeholder="Ex: Antipulgas" value={novoComando.label} onChange={e => setNovoComando(c => ({ ...c, label: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <select className="form-select" value={novoComando.tipo} onChange={e => setNovoComando(c => ({ ...c, tipo: e.target.value }))}>
              <option value="texto">Texto</option>
              <option value="numero">Número</option>
              <option value="add-array">Lista (adicionar item)</option>
            </select>
          </div>
          <button className="btn btn-outline btn-sm" onClick={addComandoVoz} disabled={!novoComando.frase.trim() || !novoComando.campo.trim()}>
            <Plus size={14} /> Adicionar
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 16px', background: 'var(--teal-light)', borderRadius: 8, borderLeft: '3px solid var(--teal)' }}>
        <p style={{ fontSize: '0.8125rem', color: 'var(--teal-dark)', margin: 0 }}>
          As alterações são salvas automaticamente e aplicadas imediatamente em novos prontuários.
        </p>
      </div>

      {cropSrc && (
        <CropModal
          src={cropSrc}
          onSave={dataUrl => { setClinica(c => ({ ...c, [cropField]: dataUrl })); setCropSrc(null); setCropField(null) }}
          onClose={() => { setCropSrc(null); setCropField(null) }}
        />
      )}
    </div>
  )
}
