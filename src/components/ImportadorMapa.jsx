import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'
import { X, Upload, CheckCircle, AlertCircle } from 'lucide-react'

// Tenta identificar o valor de uma coluna usando vários nomes possíveis
function col(row, ...keys) {
  for (const k of keys) {
    const found = Object.keys(row).find(r => r.trim().toLowerCase() === k.toLowerCase())
    if (found && row[found]?.toString().trim()) return row[found].toString().trim()
  }
  return ''
}

// Infere categoria pelo princípio ativo / indicação
function inferCategoria(gen = '', ind = '') {
  const s = `${gen} ${ind}`.toLowerCase()
  if (/antibiot|penicil|amoxici|cefal|tetracicl|enroflo|marbofl|azitro|cipro|doxicicl|ampicil/.test(s)) return 'Antibióticos'
  if (/antipara|ivermect|milbemicin|pirazenam|fenbendaz|praziquan|selamect|fipronil|imidacloprid/.test(s)) return 'Antiparasitários'
  if (/anti-inflam|analges|meloxicam|carprofen|grapiprant|dipirona|tramadol|buprenorf/.test(s)) return 'Analgésicos/Anti-inflamatórios'
  if (/corticoid|prednisolon|dexametazon|betametazon/.test(s)) return 'Corticoides'
  if (/gastrointestinal|antiemétic|metoclopra|ondansetr|omeprazol|sucralfato|lactulose|ranitidina/.test(s)) return 'Gastroentérologia'
  if (/cardiovasc|enalapril|furosemi|atenolol|amlodipina|digoxina|pimobedan/.test(s)) return 'Cardiovascular'
  if (/neurológ|fenobarbital|brometo|gabapentin|diazepam|midazolam/.test(s)) return 'Neurológico'
  if (/dermatolog|clobetasol|ciclosporina|oclacitinib|lokivetmab/.test(s)) return 'Dermatológico'
  if (/anestés|sedativ|acepromazin|ketamina|propofol|isofluran|medetom/.test(s)) return 'Anestésico/Sedativo'
  if (/hormonal|reprodut|oxitocin|progesteron|testosteron/.test(s)) return 'Hormonal/Reprodutivo'
  if (/oftalm|dorzolamid|timolol|latanoprost/.test(s)) return 'Oftálmico'
  if (/otológ|clotrimazol|fluocinolona/.test(s)) return 'Otológico'
  if (/suplemento|nutri|vitamina|aminoácid/.test(s)) return 'Suplemento/Nutricional'
  if (/oncológ|quimio|vincristin|ciclofosfam/.test(s)) return 'Oncológico'
  if (/cannabis|fitoter|cbd|cbda/.test(s)) return 'Cannabis/Fitoterápico'
  return 'Outros'
}

// Mapeia uma linha do CSV do MAPA para a estrutura do bulario_completo
function mapRow(row) {
  const nomeComercial = col(row, 'PRODUTO', 'NOME DO PRODUTO', 'NOME COMERCIAL', 'DENOMINAÇÃO', 'nome_comercial', 'produto')
  const nomeGenerico  = col(row, 'PRINCÍPIO ATIVO', 'PRINCIPIO ATIVO', 'SUBSTÂNCIA', 'SUBSTANCIA', 'IFA', 'nome_generico', 'principio_ativo')
  const fabricante    = col(row, 'EMPRESA', 'FABRICANTE', 'TITULAR', 'DETENTOR DO REGISTRO', 'empresa', 'fabricante')
  const registroMapa  = col(row, 'REGISTRO', 'Nº REGISTRO', 'NUMERO DE REGISTRO', 'NUM_REGISTRO', 'registro', 'numero_registro')
  const apresentacao  = col(row, 'FORMA FARMACÊUTICA', 'FORMA FARMACEUTICA', 'FORMULAÇÃO', 'FORMULACAO', 'apresentacao')
  const concentracao  = col(row, 'CONCENTRAÇÃO', 'CONCENTRACAO', 'TEOR', 'concentracao')
  const via           = col(row, 'VIA DE ADMINISTRAÇÃO', 'VIA ADMINISTRACAO', 'VIA', 'via')
  const indicacoes    = col(row, 'INDICAÇÃO', 'INDICACAO', 'INDICAÇÕES', 'INDICACOES', 'ESPÉCIE ALVO', 'ESPECIE ALVO', 'indicacao')
  const contraindicacoes = col(row, 'CONTRAINDICAÇÃO', 'CONTRAINDICACAO', 'CONTRAINDICAÇÕES', 'contraindicacao')
  const observacoes   = col(row, 'OBSERVAÇÕES', 'OBSERVACOES', 'RESTRIÇÕES', 'RESTRICOES', 'POSOLOGIA', 'observacoes')
  const carencia      = col(row, 'PERÍODO DE CARÊNCIA', 'PERIODO DE CARENCIA', 'CARENCIA', 'periodo_carencia')

  if (!nomeComercial) return null

  return {
    id:                    `mapa_${registroMapa || nomeComercial.replace(/\s+/g,'_').toLowerCase()}_${Date.now()}`,
    registro_mapa:         registroMapa,
    nome_comercial:        nomeComercial,
    nome_generico:         nomeGenerico,
    fabricante,
    categoria:             inferCategoria(nomeGenerico, indicacoes),
    sub_categoria:         '',
    apresentacao,
    concentracao,
    classe_terapeutica:    '',
    indicacoes,
    contraindicacoes,
    dose_cao:              '',
    dose_gato:             '',
    dose_cao_calculo:      '',
    dose_gato_calculo:     '',
    dose_outros:           '',
    via,
    frequencia:            '',
    duracao:               '',
    efeitos_adversos:      '',
    interacoes:            '',
    observacoes,
    periodo_carencia:      carencia,
    prescricao_veterinaria: true,
    controlado:            false,
    foto_url:              null,
    fonte:                 'MAPA',
  }
}

const BATCH_SIZE = 100

export default function ImportadorMapa({ onClose }) {
  const fileRef  = useRef(null)
  const [step, setStep]         = useState('idle')   // idle | preview | importing | done | error
  const [parsed, setParsed]     = useState([])        // todos os mapeados
  const [existing, setExisting] = useState([])        // nomes já no Supabase
  const [progress, setProgress] = useState(0)
  const [imported, setImported] = useState(0)
  const [errMsg, setErrMsg]     = useState('')

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setStep('preview')

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: async ({ data }) => {
        const rows = data.map(mapRow).filter(Boolean)
        setParsed(rows)

        // Busca nomes já existentes no Supabase
        try {
          const nomes = rows.map(r => r.nome_comercial)
          const { data: found } = await supabase
            .from('bulario_completo')
            .select('nome_comercial')
            .in('nome_comercial', nomes.slice(0, 500))
          setExisting((found || []).map(r => r.nome_comercial))
        } catch { setExisting([]) }
      },
      error: (err) => { setErrMsg(err.message); setStep('error') }
    })
  }

  async function handleImport() {
    const novos = parsed.filter(r => !existing.includes(r.nome_comercial))
    if (novos.length === 0) { setStep('done'); setImported(0); return }

    setStep('importing')
    setProgress(0)
    let total = 0

    for (let i = 0; i < novos.length; i += BATCH_SIZE) {
      const batch = novos.slice(i, i + BATCH_SIZE)
      const { error } = await supabase
        .from('bulario_completo')
        .upsert(batch, { onConflict: 'id' })
      if (error) { setErrMsg(error.message); setStep('error'); return }
      total += batch.length
      setProgress(Math.round((total / novos.length) * 100))
    }

    setImported(total)
    setStep('done')
  }

  const novosCount = parsed.length - existing.length

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20, boxShadow: 'var(--shadow-lg)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '1.125rem', color: 'var(--text-primary)', margin: 0 }}>
            📥 Importar do MAPA (CSV)
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Instruções */}
        {step === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '14px 16px', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <p style={{ fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>Como obter o arquivo CSV do MAPA:</p>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                <li>Acesse <strong>gov.br/agricultura</strong> → Insumos Agropecuários → Produtos Veterinários → Bases de dados</li>
                <li>Baixe o arquivo <strong>CSV de produtos veterinários registrados</strong></li>
                <li>Arraste o arquivo abaixo ou clique em "Selecionar arquivo"</li>
              </ol>
            </div>

            <div
              style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s' }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { fileRef.current.files = e.dataTransfer.files; handleFile({ target: { files: [f] } }) } }}
            >
              <Upload size={28} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
              <p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>Arraste o CSV aqui</p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>ou clique para selecionar (.csv)</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFile} />
          </div>
        )}

        {/* Preview */}
        {step === 'preview' && parsed.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: 'Encontrados', value: parsed.length, color: 'var(--text-primary)' },
                { label: 'Já cadastrados', value: existing.length, color: 'var(--text-muted)' },
                { label: 'Novos', value: novosCount, color: '#166534' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color, margin: 0 }}>{value}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Amostra */}
            <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {parsed.slice(0, 8).map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', alignItems: 'center' }}>
                  <span style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome_comercial}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>{r.categoria}</span>
                  {existing.includes(r.nome_comercial) && <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 4 }}>existente</span>}
                </div>
              ))}
              {parsed.length > 8 && <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', padding: '8px' }}>... e mais {parsed.length - 8} medicamentos</p>}
            </div>

            {novosCount === 0
              ? <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Todos os medicamentos já estão cadastrados.</p>
              : <button className="btn btn-primary" onClick={handleImport}>
                  Importar {novosCount} novos medicamentos para o Supabase
                </button>
            }
          </div>
        )}

        {step === 'preview' && parsed.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Nenhum medicamento reconhecido no arquivo. Verifique se é um CSV do MAPA/SIGVET.
          </p>
        )}

        {/* Progresso */}
        {step === 'importing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <p style={{ fontWeight: 600, margin: 0 }}>Importando medicamentos…</p>
            <div style={{ width: '100%', height: 10, background: 'var(--surface-2)', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'var(--teal)', borderRadius: 5, transition: 'width 0.3s' }} />
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>{progress}%</p>
          </div>
        )}

        {/* Concluído */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <CheckCircle size={40} color="#166534" />
            <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', margin: 0 }}>
              {imported > 0 ? `${imported} medicamentos importados com sucesso!` : 'Nenhum novo medicamento para importar.'}
            </p>
            <button className="btn btn-primary" onClick={onClose}>Fechar</button>
          </div>
        )}

        {/* Erro */}
        {step === 'error' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <AlertCircle size={40} color="var(--danger)" />
            <p style={{ fontWeight: 600, color: 'var(--danger)', margin: 0 }}>Erro na importação</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>{errMsg}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setStep('idle')}>Tentar novamente</button>
              <button className="btn btn-ghost" onClick={onClose}>Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
