// Utility: generate complete prontuário print HTML document
// Called from Prontuario.jsx — opens a new window with all filled sections

function calcIdade(birthDate) {
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

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00').toLocaleDateString('pt-BR')
}

function fmtMapa(m) { return m ? m.replace(/^mapa[-\s]*/i, '') : '' }

// ---- Vitals classify ----
function classifyTemp(val) {
  const v = parseFloat(val); if (isNaN(v) || !val) return null
  if (v < 38)     return { label: 'Hipotermia',         color: '#3182ce' }
  if (v <= 39.4)  return { label: 'Normotermia',         color: '#38a169' }
  if (v <= 40)    return { label: 'Hipertermia / Febre', color: '#d69e2e' }
  return              { label: 'Febre / Urgência',    color: '#e53e3e' }
}
function classifyFC(val, especie) {
  const v = parseFloat(val); if (isNaN(v) || !val) return null
  if (especie === 'Cão') {
    if (v < 60)   return { label: 'Bradicardia',  color: '#e53e3e' }
    if (v <= 120) return { label: 'Normocárdico', color: '#38a169' }
    return            { label: 'Taquicardia',     color: '#d69e2e' }
  }
  if (especie === 'Gato') {
    if (v < 120)  return { label: 'Bradicardia',  color: '#e53e3e' }
    if (v <= 240) return { label: 'Normocárdico', color: '#38a169' }
    return            { label: 'Taquicardia',     color: '#d69e2e' }
  }
  return null
}
function classifyFR(val, especie) {
  const v = parseFloat(val); if (isNaN(v) || !val) return null
  if (especie === 'Cão') {
    if (v < 12)  return { label: 'Dispneia',    color: '#e53e3e' }
    if (v <= 30) return { label: 'Normopneico', color: '#38a169' }
    return           { label: 'Taquipneia',    color: '#d69e2e' }
  }
  if (especie === 'Gato') {
    if (v < 20)  return { label: 'Dispneia',    color: '#e53e3e' }
    if (v <= 30) return { label: 'Normopneico', color: '#38a169' }
    return           { label: 'Taquipneia',    color: '#d69e2e' }
  }
  return null
}
function classifyGlicemia(val, especie) {
  const v = parseFloat(val); if (isNaN(v) || !val) return null
  if (especie === 'Cão') {
    if (v < 60)   return { label: 'Hipoglicemia',    color: '#e53e3e' }
    if (v <= 110) return { label: 'Normoglicêmico',  color: '#38a169' }
    if (v <= 200) return { label: 'Pré-diabético',   color: '#d69e2e' }
    return            { label: 'Hiperglicêmico',     color: '#e53e3e' }
  }
  if (especie === 'Gato') {
    if (v < 70)   return { label: 'Hipoglicemia',    color: '#e53e3e' }
    if (v <= 150) return { label: 'Normoglicêmico',  color: '#38a169' }
    if (v <= 200) return { label: 'Pré-diabético',   color: '#d69e2e' }
    return            { label: 'Hiperglicêmico',     color: '#e53e3e' }
  }
  return null
}

function badge(label, color) {
  return `<span style="display:inline-block;padding:1px 8px;border-radius:10px;font-size:10px;font-weight:700;color:#fff;background:${color};margin-left:6px">${label}</span>`
}

// ---- HTML helpers ----
function sectionHeader(title) {
  return `<div style="font-size:13px;font-weight:700;color:#1a3a6b;border-bottom:2px solid #1a3a6b;padding-bottom:4px;margin:20px 0 12px;text-transform:uppercase;letter-spacing:0.5px;page-break-after:avoid">${title}</div>`
}
function row2(label, value) {
  if (!value && value !== 0) return ''
  return `<div style="display:flex;gap:8px;margin-bottom:4px"><span style="font-weight:600;color:#444;min-width:160px;font-size:11px">${label}:</span><span style="color:#111;font-size:11px">${value}</span></div>`
}
function table(headers, rows, cellStyle = '') {
  if (!rows.length) return ''
  const th = headers.map(h => `<th style="padding:5px 8px;background:#1a3a6b;color:#fff;font-size:11px;text-align:left;white-space:nowrap">${h}</th>`).join('')
  const tbody = rows.map(cells =>
    `<tr>${cells.map(c => `<td style="padding:5px 8px;border-bottom:1px solid #e0e0e0;font-size:11px;${cellStyle}">${c ?? '—'}</td>`).join('')}</tr>`
  ).join('')
  return `<table style="width:100%;border-collapse:collapse;border:1px solid #ccc;margin-bottom:12px;page-break-inside:avoid"><thead><tr>${th}</tr></thead><tbody>${tbody}</tbody></table>`
}
function chip(text) {
  return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;border:1px solid #ccc;font-size:10px;margin:2px">${text}</span>`
}

// ---- Exam groups: simplified label resolution ----
function getExamSummary(solicitacaoExames, examGroups) {
  if (!examGroups?.length || !solicitacaoExames || !Object.keys(solicitacaoExames).length) return ''
  const lines = []
  for (const group of examGroups) {
    const groupLines = []
    if (group.layout === 'endocrinologia') {
      if (solicitacaoExames['endo_painel_red']) groupLines.push('Painel Androgênico — Reduzido')
      if (solicitacaoExames['endo_painel_comp']) groupLines.push('Painel Androgênico — Completo')
      for (const h of (group.hormones ?? [])) {
        const selMethods = (group.methods ?? []).filter(m => solicitacaoExames[`endo_${h.id}_${m}`])
        if (selMethods.length > 0) groupLines.push(`${h.label} — ${selMethods.join(', ')}`)
      }
      if (solicitacaoExames['endo_outro_exame']) {
        const method = solicitacaoExames['endo_outro_metodo'] || ''
        groupLines.push(method ? `Outro: ${solicitacaoExames['endo_outro_exame']} — Método: ${method}` : `Outro: ${solicitacaoExames['endo_outro_exame']}`)
      }
    } else if (group.layout === 'pcr') {
      if (solicitacaoExames['pcr_agente']) groupLines.push(`Agente Qualitativo: ${solicitacaoExames['pcr_agente']}`)
      if (solicitacaoExames['pcr_agente_quant']) groupLines.push(`Agente Quantitativo: ${solicitacaoExames['pcr_agente_quant']}`)
      if (solicitacaoExames['pcr_painel']) groupLines.push(`Painel: ${solicitacaoExames['pcr_painel']}`)
    } else if (group.layout === 'radiografico') {
      for (const r of (group.regions ?? [])) {
        const selPos = r.positions.filter(p => solicitacaoExames[`${r.id}__${p}`])
        if (selPos.length) groupLines.push(`${r.label}: ${selPos.join(', ')}`)
      }
      if (solicitacaoExames['rad_suspeita']) groupLines.push(`Suspeita Clínica: ${solicitacaoExames['rad_suspeita']}`)
    } else {
      for (const item of (group.items ?? [])) {
        if (item.type === 'check+subs') {
          const selSubs = (item.subs ?? []).filter(s => solicitacaoExames[`${item.id}__${s.id}`]).map(s => s.label)
          if (selSubs.length) groupLines.push(`${item.label}: ${selSubs.join(', ')}`)
        } else if (item.type === 'check+diag' && solicitacaoExames[item.id]) {
          groupLines.push(item.label)
        } else if (item.type === 'check+text' && solicitacaoExames[item.id]) {
          const txt = typeof solicitacaoExames[item.id] === 'string' ? solicitacaoExames[item.id] : ''
          groupLines.push(txt ? `${item.label}: ${txt}` : item.label)
        } else if (item.type === 'check+field' && solicitacaoExames[item.id]) {
          const fv = solicitacaoExames[`${item.id}__${item.fieldKey}`] ?? ''
          groupLines.push(fv ? `${item.label} (${item.fieldLabel}: ${fv})` : item.label)
        } else if (!item.type && solicitacaoExames[item.id]) {
          groupLines.push(item.label)
        }
      }
      for (const extra of (group.extras ?? [])) {
        if (extra.type !== 'check' && solicitacaoExames[extra.id]) {
          groupLines.push(`${extra.label}: ${solicitacaoExames[extra.id]}`)
        }
      }
    }
    if (groupLines.length) {
      lines.push({ group: group.label, items: groupLines })
    }
  }
  if (!lines.length) return ''
  return lines.map(g => `
    <div style="margin-bottom:10px;page-break-inside:avoid">
      <div style="font-weight:700;font-size:11px;border-bottom:1px solid #bbb;padding-bottom:3px;margin-bottom:5px;color:#333">${g.group}</div>
      ${g.items.map(it => `<div style="font-size:11px;padding-left:12px;margin:2px 0">✓ ${it}</div>`).join('')}
    </div>`).join('')
}

// ---- Main export ----
export function generateProntuarioPrint({ form, petInfo, tutorInfo, vetInfo, signatureData, examGroups = [] }) {
  const clinica = (() => { try { return JSON.parse(localStorage.getItem('petvet-clinica-config') ?? 'null') } catch { return null } })() ?? {}
  const cNome = clinica.nome || 'Emporium Vazpet & Tatá Bichos'
  const ssNome = (() => { try { const c = JSON.parse(localStorage.getItem('petvet-ss-config') ?? '{}'); return c.nome || 'Salgueiro Systems' } catch { return 'Salgueiro Systems' } })()
  const cEndereco = clinica.endereco || ''
  const cTelefone = clinica.telefone || ''
  const cEmail = clinica.email || ''
  const logoHtml = [clinica.logoEmporium, clinica.logoTata].filter(Boolean)
    .map(src => `<img src="${src}" style="max-height:50px;max-width:80px;object-fit:contain;" />`)
    .join('')

  const especie = form.vitals?.especie ?? petInfo?.species ?? 'Cão'
  const dateStr = fmtDate(form.date)
  const prId = form.id ?? '—'

  // ---- HEADER ----
  const header = `
    <div style="text-align:center;border-bottom:2px solid #1a3a6b;padding-bottom:12px;margin-bottom:16px">
      ${logoHtml ? `<div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:8px">${logoHtml}</div>` : ''}
      <div style="font-size:16px;font-weight:800;color:#1a3a6b;margin-bottom:2px">${cNome}</div>
      ${cEndereco ? `<div style="font-size:10px;color:#555;margin-bottom:1px">${cEndereco}</div>` : ''}
      <div style="font-size:10px;color:#555">${[cTelefone, cEmail].filter(Boolean).join(' · ')}</div>
    </div>
    <div style="text-align:center;margin-bottom:14px">
      <div style="font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1a3a6b">Prontuário Veterinário</div>
      <div style="font-size:11px;color:#666;margin-top:4px">
        Data: <strong>${dateStr}</strong>
        ${prId !== '—' ? ` &nbsp;|&nbsp; Nº: <strong>${prId}</strong>` : ''}
        &nbsp;|&nbsp; Tipo: <strong>${form.tipoConsulta ?? '—'}</strong>
        &nbsp;|&nbsp; Status: <strong>${({ aguardando:'Aguardando', confirmado:'Confirmado', 'em-atendimento':'Em Atendimento', concluido:'Concluído', cancelado:'Cancelado' })[form.status] ?? form.status ?? '—'}</strong>
      </div>
    </div>`

  // ---- IDENTIFICAÇÃO ----
  const identificacao = sectionHeader('Identificação do Paciente') + `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin-bottom:8px">
      <div>
        <div style="font-weight:700;font-size:11px;color:#1a3a6b;margin-bottom:6px">ANIMAL</div>
        ${row2('Nome', petInfo?.name)}
        ${row2('Espécie', petInfo?.species)}
        ${row2('Raça', petInfo?.breed)}
        ${row2('Sexo', petInfo?.sex === 'M' ? 'Macho' : petInfo?.sex === 'F' ? 'Fêmea' : petInfo?.sex)}
        ${row2('Nascimento', fmtDate(petInfo?.birthDate))}
        ${row2('Idade', calcIdade(petInfo?.birthDate))}
        ${row2('Peso', petInfo?.weight ? `${petInfo.weight} kg` : null)}
        ${row2('Cor / Pelagem', petInfo?.color)}
        ${row2('Microchip', petInfo?.microchip || null)}
      </div>
      <div>
        <div style="font-weight:700;font-size:11px;color:#1a3a6b;margin-bottom:6px">TUTOR / RESPONSÁVEL</div>
        ${row2('Nome', tutorInfo?.name)}
        ${row2('Telefone', tutorInfo?.phone)}
        ${row2('CPF', tutorInfo?.cpf)}
        ${row2('E-mail', tutorInfo?.email)}
        <div style="margin-top:12px;font-weight:700;font-size:11px;color:#1a3a6b;margin-bottom:6px">MÉDICO VETERINÁRIO</div>
        ${row2('Nome', vetInfo?.name)}
        ${row2('CRMV', vetInfo?.crmv)}
        ${vetInfo?.mapa ? row2('MAPA', fmtMapa(vetInfo.mapa)) : ''}
      </div>
    </div>`

  // ---- ANAMNESE ----
  let anamnese = ''
  const a = form.anamnese ?? {}
  if (a.queixa || a.historiaAtual || a.historicoPrevio) {
    anamnese = sectionHeader('Anamnese') +
      (a.queixa ? `<div style="margin-bottom:8px"><span style="font-weight:600;font-size:11px">Queixa principal / Tempo de evolução:</span><div style="margin-top:3px;font-size:11px;color:#333;background:#f8f8f8;padding:6px 10px;border-radius:4px;border-left:3px solid #1a3a6b">${a.queixa}</div></div>` : '') +
      (a.historiaAtual ? `<div style="margin-bottom:8px"><span style="font-weight:600;font-size:11px">Histórico:</span><div style="margin-top:3px;font-size:11px;color:#333;background:#f8f8f8;padding:6px 10px;border-radius:4px;border-left:3px solid #1a3a6b">${a.historiaAtual}</div></div>` : '') +
      (a.historicoPrevio ? `<div style="margin-bottom:8px"><span style="font-weight:600;font-size:11px">Cirurgias / histórico anterior:</span><div style="margin-top:3px;font-size:11px;color:#333;background:#f8f8f8;padding:6px 10px;border-radius:4px;border-left:3px solid #1a3a6b">${a.historicoPrevio}</div></div>` : '') +
      `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px 16px;font-size:11px;margin-bottom:6px">
        ${row2('Status vacinal', a.statusVacinal)}
        ${row2('Acesso à rua', a.acesRua)}
        ${row2('Contato c/ animais', a.contatoAnimais)}
        ${a.contatoAnimaisDesc ? row2('Desc. contato', a.contatoAnimaisDesc) : ''}
        ${row2('Vômito', a.vomito)}
        ${a.vomito === 'Sim' && a.vomitoDesc ? row2('Desc. vômito', a.vomitoDesc) : ''}
        ${row2('Diarreia', a.diarreia)}
        ${a.diarreia === 'Sim' && a.diarreiaDesc ? row2('Desc. diarreia', a.diarreiaDesc) : ''}
        ${row2('Alimentação', a.alimentacao)}
        ${a.alimentacaoOutro ? row2('Obs. alimentação', a.alimentacaoOutro) : ''}
        ${row2('Antipulgas', a.antipulgas)}
        ${a.antipulgas === 'Sim' && a.antipulgasProduto ? row2('Produto', a.antipulgasProduto) : ''}
        ${row2('Medicamentos prévios', a.medicamentosPrevios)}
        ${a.medicamentosPrevios === 'Sim' && a.medicamentosPreviosDesc ? row2('Quais', a.medicamentosPreviosDesc) : ''}
      </div>`
  }

  // ---- DERMA ----
  let derma = ''
  const d = form.derma ?? {}
  const isDerma = (form.tipoConsulta ?? '').toLowerCase().includes('dermatológ') || (form.tipoConsulta ?? '').toLowerCase().includes('derma')
  if (isDerma && (d.queixa || d.tratamentosAnteriores)) {
    const dArr = k => { const v = d[k] ?? []; return Array.isArray(v) ? v : [] }
    derma = sectionHeader('Dermatologia') +
      (d.queixa ? `<div style="margin-bottom:8px"><span style="font-weight:600;font-size:11px">Queixa / Evolução:</span><div style="margin-top:3px;font-size:11px;background:#f8f8f8;padding:6px 10px;border-radius:4px;border-left:3px solid #27B5AC">${d.queixa}</div></div>` : '') +
      (d.sazonalidade ? `<div style="margin-bottom:8px"><span style="font-weight:600;font-size:11px">Sazonalidade:</span><div style="margin-top:3px;font-size:11px;background:#f8f8f8;padding:6px 10px;border-radius:4px">${d.sazonalidade}</div></div>` : '') +
      (d.tratamentosAnteriores ? `<div style="margin-bottom:8px"><span style="font-weight:600;font-size:11px">Tratamentos anteriores:</span><div style="margin-top:3px;font-size:11px;background:#f8f8f8;padding:6px 10px;border-radius:4px">${d.tratamentosAnteriores}</div></div>` : '') +
      `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px 16px;font-size:11px;margin-bottom:8px">
        ${row2('Melhora c/ tratamentos', d.melhoraTratamentos)} ${d.melhoraTratamentos === 'Sim' && d.melhoraTratamentosDesc ? row2('Qual', d.melhoraTratamentosDesc) : ''}
        ${row2('Outra doença', d.outraDoenca)} ${d.outraDoenca === 'Sim' && d.outraDoencaDesc ? row2('Qual', d.outraDoencaDesc) : ''}
        ${row2('Acesso à rua', d.acesRua)}
        ${row2('Contato c/ animais', d.contatoAnimais)}
        ${row2('Animais c/ prob. pele', d.animaisComProblema)}
        ${row2('Humano c/ problema', d.humanoComProblema)}
        ${row2('Frequência de banhos', d.frequenciaBanhos === 'Outro' ? d.frequenciaBanhosCustom : d.frequenciaBanhos)}
        ${row2('Vômito', d.vomito)} ${d.vomito === 'Sim' && d.vomitoDesc ? row2('Desc.', d.vomitoDesc) : ''}
        ${row2('Diarreia', d.diarreia)} ${d.diarreia === 'Sim' && d.diarreiaDesc ? row2('Desc.', d.diarreiaDesc) : ''}
        ${row2('Alimentação', d.alimentacao)} ${d.alimentacaoDesc ? row2('Obs.', d.alimentacaoDesc) : ''}
        ${row2('Antipulgas', d.antipulgas)} ${d.antipulgas === 'Sim' && d.antipulgasProduto ? row2('Produto', d.antipulgasProduto) : ''}
        ${row2('Medicamentos prévios', d.medicamentosPrevios)} ${d.medicamentosPrevios === 'Sim' && d.medicamentosPreviosDesc ? row2('Quais', d.medicamentosPreviosDesc) : ''}
      </div>` +
      (d.pruridoIntensidade ? `<div style="font-size:11px;margin-bottom:6px"><strong>Intensidade do prurido:</strong> ${d.pruridoIntensidade}/10</div>` : '') +
      (dArr('comoSeCoca').length ? `<div style="font-size:11px;margin-bottom:6px"><strong>Como se coça:</strong> ${dArr('comoSeCoca').map(chip).join(' ')}</div>` : '') +
      (dArr('apareceuPrimeiro').length ? `<div style="font-size:11px;margin-bottom:6px"><strong>Onde apareceu primeiro:</strong> ${dArr('apareceuPrimeiro').map(chip).join(' ')}</div>` : '') +
      (dArr('habitacao').length ? `<div style="font-size:11px;margin-bottom:6px"><strong>Habitação:</strong> ${dArr('habitacao').map(chip).join(' ')}</div>` : '') +
      (dArr('tiposLesao').length ? `<div style="font-size:11px;margin-bottom:6px"><strong>Tipos de lesão:</strong> ${dArr('tiposLesao').map(chip).join(' ')}</div>` : '') +
      `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px 16px;font-size:11px;margin-bottom:8px">
        ${d.raspado ? row2('Raspado', d.raspado) : ''} ${d.raspadoDesc ? row2('Desc. raspado', d.raspadoDesc) : ''}
        ${dArr('citologia').length ? row2('Citologia', dArr('citologia').join(', ')) : ''}
        ${d.fitaAcetato ? row2('Fita acetato', d.fitaAcetato) : ''}
        ${dArr('tricograma').length ? row2('Tricograma', dArr('tricograma').join(', ')) : ''}
        ${d.lampadaWood ? row2('Lâmpada Wood', d.lampadaWood) : ''}
        ${d.culturaAntibiograma ? row2('Cultura antibiograma', d.culturaAntibiograma) : ''}
        ${d.reflexoOtopodal ? row2('Reflexo otopodal', d.reflexoOtopodal) : ''}
        ${d.biopsia ? row2('Biópsia', d.biopsia) : ''}
        ${d.outroExame ? row2('Outro exame', d.outroExame) : ''}
        ${d.observacoes ? row2('Observações', d.observacoes) : ''}
      </div>` +
      (d.mapaCanvasData ? `<div style="margin-bottom:8px"><div style="font-weight:600;font-size:11px;margin-bottom:4px">Mapa Corporal:</div><img src="${d.mapaCanvasData}" style="max-width:300px;border:1px solid #ccc;border-radius:4px" /></div>` : '')
  }

  // ---- CANNABIS ----
  let cannabis = ''
  const c = form.cannabis ?? {}
  const isCannabis = (form.tipoConsulta ?? '').toLowerCase().includes('canáb') || (form.tipoConsulta ?? '').toLowerCase().includes('cannab')
  if (isCannabis && (c.queixa || c.historico)) {
    const cArr = k => { const v = c[k] ?? []; return Array.isArray(v) ? v : [] }
    cannabis = sectionHeader('Cannabis Medicinal') +
      (c.queixa ? `<div style="margin-bottom:8px"><span style="font-weight:600;font-size:11px">Queixa / Indicação:</span><div style="margin-top:3px;font-size:11px;background:#f8f8f8;padding:6px 10px;border-radius:4px;border-left:3px solid #9C27B0">${c.queixa}</div></div>` : '') +
      (c.historico ? `<div style="margin-bottom:8px"><span style="font-weight:600;font-size:11px">Histórico:</span><div style="margin-top:3px;font-size:11px;background:#f8f8f8;padding:6px 10px;border-radius:4px">${c.historico}</div></div>` : '') +
      (cArr('comorbidades').length ? `<div style="font-size:11px;margin-bottom:6px"><strong>Comorbidades:</strong> ${cArr('comorbidades').map(chip).join(' ')}${c.comorbidadesOutras ? `, ${c.comorbidadesOutras}` : ''}</div>` : '') +
      `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px 16px;font-size:11px;margin-bottom:8px">
        ${c.triaDor ? row2('Dor (VAS 0–10)', c.triaDor) : ''}
        ${c.triaConvulsoes ? row2('Convulsões', c.triaConvulsoes) : ''}
        ${c.triaConvulsoesFreq ? row2('Freq. convulsões', c.triaConvulsoesFreq) : ''}
        ${c.triaAnsiedade ? row2('Ansiedade (0–10)', c.triaAnsiedade) : ''}
        ${c.triaSono ? row2('Sono (0–10)', c.triaSono) : ''}
        ${c.triaApetite ? row2('Apetite (0–10)', c.triaApetite) : ''}
        ${c.medsContinuos ? row2('Medicamentos contínuos', c.medsContinuos) : ''}
        ${row2('Já usou cannabis?', c.usouCannabis)}
        ${c.usouCannabisResp ? row2('Resp. anterior', c.usouCannabisResp) : ''}
        ${row2('Estresse ambiental', c.estresseAmbiental)}
        ${row2('Comportamento social', c.comportamentoSocial)}
        ${c.expectativasTutor ? row2('Expectativas do tutor', c.expectativasTutor) : ''}
        ${c.indicacao ? row2('Indicação terapêutica', c.indicacao) : ''}
        ${c.produto ? row2('Produto', c.produto) : ''}
        ${c.concentracao ? row2('Concentração', c.concentracao) : ''}
        ${c.doseKg ? row2('Dose / kg', c.doseKg) : ''}
        ${c.doseTotal ? row2('Dose total', c.doseTotal) : ''}
        ${row2('Via', c.via)}
        ${c.frequencia ? row2('Frequência', c.frequencia) : ''}
        ${c.duracao ? row2('Duração', c.duracao) : ''}
        ${c.observacoes ? row2('Observações', c.observacoes) : ''}
      </div>`
  }

  // ---- SINAIS VITAIS ----
  let vitais = ''
  const v = form.vitals ?? {}
  const hasVitals = v.temperatura || v.fc || v.fr || v.glicemia || v.spo2
  if (hasVitals) {
    const tC = classifyTemp(v.temperatura)
    const fC = classifyFC(v.fc, especie)
    const frC = classifyFR(v.fr, especie)
    const gC = classifyGlicemia(v.glicemia, especie)
    const clBadge = c2 => c2 ? badge(c2.label, c2.color) : ''
    vitais = sectionHeader('Sinais Vitais') +
      `<div style="font-size:11px;margin-bottom:6px"><strong>Espécie referência:</strong> ${especie}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px 16px;font-size:11px;margin-bottom:8px">
        ${v.temperatura ? `<div style="margin-bottom:4px"><span style="font-weight:600;color:#444">Temperatura:</span> ${v.temperatura}°C ${clBadge(tC)}</div>` : ''}
        ${v.fc ? `<div style="margin-bottom:4px"><span style="font-weight:600;color:#444">FC:</span> ${v.fc} bpm ${clBadge(fC)}</div>` : ''}
        ${v.fr ? `<div style="margin-bottom:4px"><span style="font-weight:600;color:#444">FR:</span> ${v.fr} mpm ${clBadge(frC)}</div>` : ''}
        ${v.glicemia ? `<div style="margin-bottom:4px"><span style="font-weight:600;color:#444">Glicemia:</span> ${v.glicemia} mg/dL ${clBadge(gC)}</div>` : ''}
        ${v.spo2 ? `<div style="margin-bottom:4px"><span style="font-weight:600;color:#444">SpO₂:</span> ${v.spo2}%</div>` : ''}
        ${v.peso ? `<div style="margin-bottom:4px"><span style="font-weight:600;color:#444">Peso:</span> ${v.peso} kg</div>` : ''}
        ${v.tpc ? `<div style="margin-bottom:4px"><span style="font-weight:600;color:#444">TPC:</span> ${v.tpc}</div>` : ''}
        ${v.mucosas ? `<div style="margin-bottom:4px"><span style="font-weight:600;color:#444">Mucosas:</span> ${v.mucosas}</div>` : ''}
        ${v.hidratacao ? `<div style="margin-bottom:4px"><span style="font-weight:600;color:#444">Hidratação:</span> ${v.hidratacao}</div>` : ''}
        ${v.pulso ? `<div style="margin-bottom:4px"><span style="font-weight:600;color:#444">Pulso:</span> ${v.pulso}</div>` : ''}
        ${v.diurese ? `<div style="margin-bottom:4px"><span style="font-weight:600;color:#444">Diurese:</span> ${v.diurese}</div>` : ''}
        ${v.apetite ? `<div style="margin-bottom:4px"><span style="font-weight:600;color:#444">Apetite:</span> ${v.apetite}</div>` : ''}
        ${v.ingestaoAgua ? `<div style="margin-bottom:4px"><span style="font-weight:600;color:#444">Ingestão de água:</span> ${v.ingestaoAgua}</div>` : ''}
      </div>`
  }

  // ---- EXAME FÍSICO ----
  let exame = ''
  const ef = form.examesFisicos ?? {}
  const SISTEMA_LABELS = {
    cardiorespiratorio: 'Cardiorrespiratório', digestorio: 'Digestório', locomotor: 'Locomotor',
    neurologico: 'Neurológico', dermatologico: 'Dermatológico', reprodutivo: 'Reprodutivo',
    linfonodos: 'Linfonodos', olhos: 'Olhos', ouvidos: 'Ouvidos', boca: 'Boca / Dentes',
  }
  const exameRows = []
  for (const [key, label] of Object.entries(SISTEMA_LABELS)) {
    const sys = ef[key] ?? {}
    const chips = sys.chips ?? []
    const od = sys.od ?? []
    const oe = sys.oe ?? []
    const status = sys.status
    const obs = sys.obs
    let col2 = ''
    if (key === 'olhos') col2 = [od.length ? `OD: ${od.join(', ')}` : '', oe.length ? `OE: ${oe.join(', ')}` : '', obs || ''].filter(Boolean).join(' | ')
    else if (key === 'ouvidos') col2 = [od.length ? `OD: ${od.join(', ')}` : '', oe.length ? `OE: ${oe.join(', ')}` : '', obs || ''].filter(Boolean).join(' | ')
    else col2 = [chips.length ? chips.join(', ') : status, obs].filter(Boolean).join(' — ')
    if (col2 && col2 !== 'NDN') exameRows.push([label, col2 || 'NDN'])
    else if (col2 === 'NDN' || (!chips.length && !od.length && !oe.length && status === 'NDN')) exameRows.push([label, 'NDN'])
  }
  if (exameRows.length) {
    exame = sectionHeader('Exame Físico') + table(['Sistema', 'Achados'], exameRows)
  }

  // ---- VACINAS ----
  let vacinas = ''
  const va = form.vacinasAplicadas ?? []
  if (va.length) {
    const vaRows = va.map(r => [
      r.vacina || r.protocoloNome || '—',
      r.fabricante || '—',
      r.lote || '—',
      fmtDate(r.dataAplicacao),
      fmtDate(r.validade || r.validadeFrasco),
      r.dose ? `${r.dose}ª dose` : '—',
      r.via || '—',
    ])
    vacinas = sectionHeader('Vacinas Aplicadas') + table(['Vacina / Protocolo', 'Fabricante', 'Lote', 'Data Apl.', 'Validade', 'Dose', 'Via'], vaRows)
  }

  // ---- APLICAÇÕES ----
  let aplicacoes = ''
  const ap = form.aplicacoes ?? []
  if (ap.length) {
    const apRows = ap.map(r => [r.nome || '—', r.dose || '—', r.via || '—', fmtDate(r.dataAplicacao), r.obs || ''])
    aplicacoes = sectionHeader('Aplicações') + table(['Medicamento', 'Dose', 'Via', 'Data', 'Obs.'], apRows)
  }

  // ---- CIRURGIA ----
  let cirurgia = ''
  const procs = form.procedimentos ?? []
  if (form.tipoConsulta === 'Cirurgia' && procs.length) {
    const cRows = procs.map(p => {
      const nome = p.servicoId === '__outro' ? p.nome : (p.nome || p.servicoId || '—')
      const preco = p.preco > 0 ? `R$ ${Number(p.preco).toFixed(2).replace('.', ',')}` : '—'
      return [nome, p.vetNome || '—', preco]
    })
    const total = procs.reduce((s, p) => s + (Number(p.preco) || 0), 0)
    cirurgia = sectionHeader('Procedimentos Cirúrgicos') +
      table(['Procedimento', 'Veterinário', 'Valor'], cRows) +
      `<div style="text-align:right;font-weight:700;font-size:12px;margin-top:-6px;margin-bottom:10px">Total: R$ ${total.toFixed(2).replace('.', ',')}</div>`
  }

  // ---- SOLICITAÇÃO DE EXAMES ----
  let solicExames = ''
  const sx = form.solicitacaoExames ?? {}
  if (Object.values(sx).some(Boolean)) {
    const examSummary = getExamSummary(sx, examGroups)
    if (examSummary) {
      solicExames = sectionHeader('Solicitação de Exames') + examSummary +
        (sx['_obs'] ? `<div style="font-size:11px;margin-top:8px"><strong>Observações:</strong> ${sx['_obs']}</div>` : '')
    }
  }

  // ---- DIAGNÓSTICO ----
  let diagnostico = ''
  const diag = form.diagnostico ?? {}
  if (diag.diferencial || diag.definitivo) {
    diagnostico = sectionHeader('Diagnóstico') +
      (diag.diferencial ? `<div style="margin-bottom:8px"><span style="font-weight:600;font-size:11px">Diferencial:</span><div style="margin-top:3px;font-size:11px;background:#f8f8f8;padding:6px 10px;border-radius:4px">${diag.diferencial}</div></div>` : '') +
      (diag.definitivo ? `<div style="margin-bottom:8px"><span style="font-weight:600;font-size:11px">Definitivo:</span><div style="margin-top:3px;font-size:11px;background:#e8f5e9;padding:6px 10px;border-radius:4px;border-left:3px solid #38a169;font-weight:600">${diag.definitivo}</div></div>` : '')
  }

  // ---- PRESCRIÇÃO ----
  let prescricao = ''
  const pres = form.prescricao ?? {}
  if ((pres.medicamentos?.length ?? 0) > 0 || pres.orientacoes) {
    const presRows = (pres.medicamentos ?? []).map(m => [m.nome || '—', m.dose || '—', m.via || '—', m.frequencia || '—', m.duracao || '—', m.obs || ''])
    prescricao = sectionHeader('Prescrição') +
      (presRows.length ? table(['Medicamento', 'Dose', 'Via', 'Frequência', 'Duração', 'Obs.'], presRows) : '') +
      (pres.orientacoes ? `<div style="margin-bottom:8px"><span style="font-weight:600;font-size:11px">Orientações ao tutor:</span><div style="margin-top:3px;font-size:11px;background:#fff3cd;padding:6px 10px;border-radius:4px;border-left:3px solid #d69e2e">${pres.orientacoes}</div></div>` : '') +
      (pres.retorno ? `<div style="font-size:11px"><strong>Retorno previsto:</strong> ${fmtDate(pres.retorno)}</div>` : '')
  }

  // ---- TERMOS / ANEXOS ----
  let termos = ''
  const anx = (form.anexos ?? []).filter(a => a.tipo === 'termo' || a.tipo === 'exame' || a.tipo === 'termo-cannabis' || a.tipo === 'termo-derma')
  if (anx.length) {
    termos = sectionHeader('Documentos Gerados') +
      anx.map(a => `<div style="font-size:11px;margin:2px 0">• ${a.nome}${a.dataAdicionado ? ` — ${new Date(a.dataAdicionado).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}</div>`).join('')
  }

  // ---- ASSINATURA ----
  const sigHtml = signatureData
    ? `<img src="${signatureData}" style="width:300px;height:100px;object-fit:contain;border:1px solid #ccc;border-radius:4px;background:#fff;display:block;margin-bottom:4px" />`
    : `<div style="width:300px;height:80px;border-bottom:1px solid #333;margin-bottom:4px"></div>`
  const assinatura = sectionHeader('Assinatura') +
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:16px">
      <div>
        <div style="font-size:11px;font-weight:600;margin-bottom:6px;color:#555">ASSINATURA DO TUTOR / RESPONSÁVEL</div>
        <div style="width:100%;height:80px;border-bottom:1px solid #333;margin-bottom:4px"></div>
        <div style="font-size:10px;color:#777">${tutorInfo?.name ?? 'Nome do responsável'}</div>
        <div style="font-size:10px;color:#777">CPF: ${tutorInfo?.cpf ?? '—'}</div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;margin-bottom:6px;color:#555">MÉDICO VETERINÁRIO RESPONSÁVEL</div>
        ${sigHtml}
        <div style="font-size:10px;color:#777">${vetInfo?.name ?? '—'}</div>
        <div style="font-size:10px;color:#777">CRMV: ${vetInfo?.crmv ?? '—'}${vetInfo?.mapa ? ` · MAPA: ${fmtMapa(vetInfo.mapa)}` : ''}</div>
        <div style="font-size:10px;color:#777">Data: ${dateStr} — ${clinica.cidade || clinica.endereco?.split(',')[0] || cNome}</div>
      </div>
    </div>`

  // ---- ASSEMBLE ----
  const body = [header, identificacao, anamnese, derma, cannabis, vitais, exame, vacinas, aplicacoes, cirurgia, solicExames, diagnostico, prescricao, termos, assinatura].filter(Boolean).join('\n')

  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Prontuário — ${petInfo?.name ?? 'Pet'} — ${dateStr}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; line-height: 1.5; }
  @page { size: A4; margin: 15mm; }
  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
  }
  .footer {
    position: fixed; bottom: 0; left: 0; right: 0;
    font-size: 8px; color: #aaa; text-align: center;
    padding: 6px 0; border-top: 1px solid #ddd;
    background: #fff;
  }
  .print-btn {
    display: block; margin: 0 auto 16px; padding: 8px 20px;
    background: #1a3a6b; color: #fff; border: none; border-radius: 6px;
    font-size: 13px; cursor: pointer; font-family: Arial;
  }
</style>
</head>
<body>
  <div class="no-print" style="text-align:center;padding:16px 0;border-bottom:2px dashed #ccc;margin-bottom:16px">
    <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
    <div style="font-size:11px;color:#888">Use Ctrl+P para imprimir ou salvar como PDF</div>
  </div>
  <div style="max-width:800px;margin:0 auto;padding:0 8px">
    ${body}
  </div>
  <div class="footer">Sistema PetVet — ${ssNome} &nbsp;|&nbsp; ${petInfo?.name ?? 'Pet'} &nbsp;|&nbsp; ${dateStr}</div>
</body>
</html>`

  return { htmlContent }
}
