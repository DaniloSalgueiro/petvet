// Generates printable blank form HTML for manual fill-in
// tipo: 'anamnese' | 'derma' | 'cannabis'

// ---- Low-level helpers ----
function cb() {
  return '<span style="display:inline-block;width:12px;height:12px;border:1.5px solid #111;border-radius:2px;margin-right:4px;vertical-align:middle;flex-shrink:0"></span>'
}
function opt(label) {
  return `<span style="display:inline-flex;align-items:center;margin-right:14px;white-space:nowrap">${cb()}<span style="font-size:11px">${label}</span></span>`
}
function linha(n = 1) {
  return Array.from({ length: n }, () =>
    '<div style="border-bottom:1px solid #aaa;min-height:20px;margin:2px 0 8px"></div>'
  ).join('')
}
function sectionH(t) {
  return `<h2 style="color:#1a3a6b;border-bottom:2px solid #1a3a6b;padding-bottom:4px;margin:14px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;page-break-after:avoid">${t}</h2>`
}
function fieldLine(label, linhas = 1) {
  return `<div style="margin-bottom:6px"><div style="font-size:11px;font-weight:600;color:#333;margin-bottom:2px">${label}:</div>${linha(linhas)}</div>`
}
function yesNo(label, suffix = '') {
  return `<div style="margin-bottom:6px;font-size:11px;display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap"><span style="font-weight:600;flex-shrink:0">${label}:</span><span style="display:flex;align-items:center;flex-wrap:wrap">${opt('Sim')} ${opt('Não')} ${suffix}</span></div>`
}
function yesNoNaLine(label, linhas = 0, extraOpts = '') {
  return `<div style="margin-bottom:6px;font-size:11px"><div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:${linhas ? 2 : 0}px"><span style="font-weight:600">${label}:</span> ${opt('Sim')} ${opt('Não')} ${extraOpts}</div>${linhas ? linha(linhas) : ''}</div>`
}
function scale(max, label) {
  const boxes = Array.from({ length: max + 1 }, (_, i) => `${i}${cb()}`).join(' ')
  return `<div style="margin-bottom:8px;font-size:11px"><strong>${label}:</strong> &nbsp; ${boxes}</div>`
}
function triagem(label, max = 5) {
  const boxes = Array.from({ length: max + 1 }, (_, i) => `<span style="display:inline-flex;align-items:center;margin-right:8px">${i}${cb()}</span>`).join('')
  return `<div style="display:flex;align-items:center;margin-bottom:6px;font-size:11px"><span style="min-width:220px;font-weight:600">${label}</span>${boxes}</div>`
}
function grid3(items) {
  const cells = items.map(item =>
    `<div style="display:flex;align-items:center;gap:4px;font-size:10.5px">${cb()}<span>${item}</span></div>`
  ).join('')
  return `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px 8px;margin:6px 0 10px">${cells}</div>`
}
function pageBreak() {
  return '<div style="page-break-before:always"></div>'
}

// ---- Clinic header ----
function buildHeader(clinica, title) {
  const cNome = clinica.nome || 'Emporium Vazpet & Tatá Bichos'
  const cEnd = clinica.endereco || ''
  const cTel = clinica.telefone || ''
  const cEmail = clinica.email || ''
  const logos = [clinica.logoEmporium, clinica.logoTata].filter(Boolean)
    .map(s => `<img src="${s}" style="max-height:50px;max-width:80px;object-fit:contain" />`)
    .join('')
  return `
    <div style="text-align:center;border-bottom:2px solid #1a3a6b;padding-bottom:10px;margin-bottom:12px">
      ${logos ? `<div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:6px">${logos}</div>` : ''}
      <div style="font-size:15px;font-weight:800;color:#1a3a6b">${cNome}</div>
      ${cEnd ? `<div style="font-size:10px;color:#555;margin-top:2px">${cEnd}</div>` : ''}
      <div style="font-size:10px;color:#555">${[cTel, cEmail].filter(Boolean).join(' · ')}</div>
    </div>
    <div style="text-align:center;margin-bottom:14px">
      <div style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1a3a6b">${title}</div>
    </div>
    <div style="display:flex;gap:16px;font-size:11px;margin-bottom:12px;flex-wrap:wrap">
      <span><strong>Data:</strong> _____ / _____ / _________</span>
      <span style="flex:1"><strong>Veterinário:</strong> ___________________________________</span>
      <span><strong>CRMV:</strong> _______________</span>
    </div>`
}

// ---- Patient block ----
function patientBlock() {
  return `
    ${sectionH('Identificação do Paciente')}
    <div style="display:grid;grid-template-columns:2fr 1fr 2fr;gap:6px 14px;font-size:11px;margin-bottom:6px">
      <div>${fieldLine('Nome do Animal')}</div>
      <div>${fieldLine('Espécie')}</div>
      <div>${fieldLine('Raça')}</div>
    </div>
    <div style="display:flex;align-items:center;flex-wrap:wrap;gap:14px;font-size:11px;margin-bottom:8px">
      <span><strong>Sexo:</strong> ${opt('Macho')} ${opt('Fêmea')}</span>
      <span><strong>Castrado:</strong> ${opt('Sim')} ${opt('Não')}</span>
      <span><strong>Idade:</strong> ____________</span>
      <span><strong>Peso:</strong> ____________ kg</span>
    </div>
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:6px 14px;font-size:11px">
      <div>${fieldLine('Tutor / Responsável')}</div>
      <div>${fieldLine('Telefone')}</div>
    </div>`
}

// ---- Common anamnese fields (shared across all three fichas) ----
function anamneseComum() {
  return `
    ${yesNoNaLine('Vômito', 1, '')}
    ${yesNoNaLine('Diarreia', 1, '')}
    <div style="margin-bottom:6px;font-size:11px">
      <strong>Alimentação:</strong><br/>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0">
        ${opt('Ração')} ${opt('Ração seca + sachê')} ${opt('Ração + AN')} ${opt('Ração + Petisco')} ${opt('Natural/Caseira')}
        <span style="display:flex;align-items:center">${opt('Outro')}: <span style="display:inline-block;width:100px;border-bottom:1px solid #aaa;margin-left:4px">&nbsp;</span></span>
      </div>
      <div style="font-size:11px;font-weight:600;color:#333;margin-bottom:2px">Observações:</div>
      ${linha(1)}
    </div>
    ${yesNoNaLine('Uso de antipulgas', 1, '')}
    <div style="margin-bottom:6px;font-size:11px"><strong>Medicamentos prévios:</strong> ${opt('Sim')} ${opt('Não')}<br/><div style="font-size:11px;color:#555;margin:2px 0 2px">Se sim, quais:</div>${linha(2)}</div>`
}

// ============================================================
// FICHA DE ANAMNESE
// ============================================================
function fichaAnamnese(clinica) {
  return buildHeader(clinica, 'Ficha de Anamnese') +
    patientBlock() +
    sectionH('Anamnese Geral') +
    fieldLine('Queixa principal / Tempo de evolução', 3) +
    fieldLine('Histórico (início, evolução, exames anteriores)', 3) +
    fieldLine('Cirurgias anteriores / doenças prévias', 2) +
    `<div style="margin-bottom:6px;font-size:11px"><strong>Houve melhora nos tratamentos anteriores:</strong> ${opt('Sim')} ${opt('Não')}<br/><div style="color:#555;font-size:11px;margin:2px 0 2px">Se sim, qual tratamento melhorou:</div>${linha(2)}</div>` +
    `<div style="margin-bottom:6px;font-size:11px"><strong>O animal possui outra doença diagnosticada:</strong> ${opt('Sim')} ${opt('Não')}<br/><div style="color:#555;font-size:11px;margin:2px 0 2px">Se sim, qual:</div>${linha(2)}</div>` +
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 20px">
      <div>${yesNoNaLine('Acesso à rua', 0, opt('Restrito'))}</div>
      <div>
        <div style="margin-bottom:6px;font-size:11px"><strong>Contato com outros animais:</strong> ${opt('Sim')} ${opt('Não')} ${opt('Eventualmente')}</div>
        <div style="color:#555;font-size:11px;margin:2px 0 2px">Descreva:</div>${linha(1)}
      </div>
    </div>` +
    anamneseComum() +
    `<div style="margin-bottom:6px;font-size:11px"><strong>Status vacinal:</strong> ${opt('Em dia')} ${opt('Atrasada')} ${opt('Desconhecida')}</div>` +
    scale(10, 'Intensidade do prurido (0 = sem prurido / 10 = máximo)')
}

// ============================================================
// FICHA DERMATOLÓGICA
// ============================================================
function fichaDerma(clinica, corpImgSrc) {
  // --- PAGE 1: Anamnese dermatológica ---
  const page1 = buildHeader(clinica, 'Ficha Dermatológica') +
    patientBlock() +
    sectionH('Seção 1 — Anamnese Dermatológica') +
    fieldLine('Queixa principal / Tempo de evolução', 3) +
    fieldLine('Sazonalidade (piora em alguma época do ano?)', 2) +
    fieldLine('Tratamentos anteriores (medicamentos, shampoos, dietas)', 2) +
    `<div style="margin-bottom:6px;font-size:11px"><strong>Houve melhora nos tratamentos anteriores:</strong> ${opt('Sim')} ${opt('Não')}<br/><div style="color:#555;font-size:11px;margin:2px 0 2px">Qual tratamento melhorou:</div>${linha(1)}</div>` +
    `<div style="margin-bottom:6px;font-size:11px"><strong>O animal possui outra doença diagnosticada:</strong> ${opt('Sim')} ${opt('Não')}<br/><div style="color:#555;font-size:11px;margin:2px 0 2px">Qual:</div>${linha(1)}</div>` +
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 20px">
      <div>${yesNoNaLine('Acesso à rua', 0, opt('Restrito'))}</div>
      <div><div style="margin-bottom:6px;font-size:11px"><strong>Contato com outros animais:</strong> ${opt('Sim')} ${opt('Não')} ${opt('Eventualmente')}<br/><div style="color:#555;font-size:11px;margin-top:2px">Descreva:</div>${linha(1)}</div></div>
    </div>` +
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 20px">
      <div>${yesNoNaLine('Outros animais com problema de pele', 1, '')}</div>
      <div>${yesNoNaLine('Humano com problema de pele / coceira', 1, '')}</div>
    </div>` +
    anamneseComum() +
    `<div style="margin-bottom:6px;font-size:11px">
      <strong>Frequência de banhos:</strong>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0">
        ${opt('1× por semana')} ${opt('Quinzenal')} ${opt('Mensal')}
        <span style="display:flex;align-items:center">${opt('Outro')}: <span style="display:inline-block;width:80px;border-bottom:1px solid #aaa;margin-left:4px">&nbsp;</span></span>
      </div>
    </div>` +
    scale(10, 'Intensidade do prurido (0 = sem prurido / 10 = máximo)') +
    sectionH('Seção 2 — Comportamento e Ambiente') +
    `<div style="font-size:11px;margin-bottom:6px"><strong>Como o animal se coça:</strong></div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
      ${opt('Lambedura')} ${opt('Mordedura')} ${opt('Esfrega-se nos móveis/parede')} ${opt('Unhadas')}
    </div>
    <div style="font-size:11px;margin-bottom:6px"><strong>O que apareceu primeiro:</strong></div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
      ${opt('Coceira (prurido)')} ${opt('Lesões na pele')}
    </div>
    <div style="font-size:11px;margin-bottom:6px"><strong>Tipo de habitação:</strong></div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
      ${opt('Casa com quintal')} ${opt('Apartamento')} ${opt('Sítio / Chácara')} ${opt('Piso / Laminado')} ${opt('Taco / Madeira')}
    </div>
    <div style="font-size:11px;margin-bottom:6px"><strong>Contatos do animal com:</strong></div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
      ${opt('Grama')} ${opt('Plantas de jardim')} ${opt('Terra / Areia')} ${opt('Apenas piso frio / madeira')} ${opt('Praia')} ${opt('Campo')}
    </div>`

  // --- PAGE 2: Mapa corporal + Tipos de lesão + Exames complementares ---
  const page2 = pageBreak() +
    buildHeader(clinica, 'Ficha Dermatológica — Mapa e Exames') +
    sectionH('Seção 3 — Mapa Corporal') +
    `<div style="font-size:11px;color:#555;margin-bottom:8px">Indique as regiões afetadas marcando sobre o diagrama:</div>
    <div style="display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:start">
      <div>
        ${corpImgSrc ? `<img src="${corpImgSrc}" style="width:280px;max-width:280px;border:1px solid #ccc;border-radius:4px" />` : '<div style="width:280px;height:360px;border:1px solid #ccc;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#aaa">Mapa corporal</div>'}
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;color:#1a3a6b;margin-bottom:8px">Legenda das regiões:</div>
        ${Array.from({ length: 10 }, (_, i) => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:11px">${cb()}<span style="display:inline-block;width:180px;border-bottom:1px solid #aaa">&nbsp;</span></div>`).join('')}
      </div>
    </div>` +
    sectionH('Seção 4 — Tipos de Lesão') +
    grid3([
      'Úmida', 'Mácula', 'Alopécia', 'Erosão', 'Edema', 'Telangectasia',
      'Descamação micácea', 'Úlcera', 'Abcesso', 'Sanguinolenta', 'Pápula', 'Hipotricose',
      'Crostas melicéricas', 'Crostas hemáticas', 'Eritrodermia', 'Hiperpigmentação', 'Nódulo', 'Purulenta',
      'Pústula', 'Bolha', 'Hiperqueratose', 'Hiperemia', 'D. Farinácea', 'Calo',
      'Placa', 'Seca', 'Colarete epidérmico', 'Vesícula', 'Querión', 'Fissuras',
      'Comedos', 'Exudativa', 'Atrofia da derme',
    ]) +
    sectionH('Seção 5 — Exames Complementares Realizados') +
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;font-size:11px">
      <div>
        <div style="margin-bottom:6px"><strong>Raspado Cutâneo:</strong> ${opt('Negativo')} ${opt('Positivo')}<br/>Resultado: ${linha(1)}</div>
        <div style="margin-bottom:6px"><strong>Citologia:</strong><br/>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0">
            ${opt('Bastonetes')} ${opt('Cocos')} ${opt('Malassezia')}
            <span>${opt('Outros')}: <span style="display:inline-block;width:80px;border-bottom:1px solid #aaa">&nbsp;</span></span>
          </div>
        </div>
        <div style="margin-bottom:6px"><strong>Fita de Acetato:</strong> ${opt('Negativo')} ${opt('Positivo')}</div>
        <div style="margin-bottom:6px"><strong>Tricograma:</strong><br/>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0">
            ${opt('Anágena')} ${opt('Catágena')} ${opt('Telógena')}
            <span>${opt('Outros')}: <span style="display:inline-block;width:60px;border-bottom:1px solid #aaa">&nbsp;</span></span>
          </div>
        </div>
      </div>
      <div>
        <div style="margin-bottom:6px"><strong>Lâmpada de Wood:</strong> ${opt('Negativo')} ${opt('Positivo')}</div>
        <div style="margin-bottom:6px"><strong>Cultura / Antibiograma:</strong> ${opt('Negativo')} ${opt('Positivo')}<br/>Resultado: ${linha(1)}</div>
        <div style="margin-bottom:6px"><strong>Reflexo Otopodal:</strong> ${opt('Negativo')} ${opt('Positivo')}</div>
        <div style="margin-bottom:6px"><strong>Biópsia:</strong><br/>${linha(1)}</div>
        <div style="margin-bottom:6px"><strong>Outro exame:</strong><br/>${linha(1)}</div>
      </div>
    </div>
    <div style="margin-top:10px">${fieldLine('Observações gerais', 2)}</div>`

  return page1 + page2
}

// ============================================================
// FICHA CANÁBICA
// ============================================================
function fichaCannabis(clinica) {
  return buildHeader(clinica, 'Ficha de Anamnese Canábica') +
    patientBlock() +
    sectionH('Anamnese Geral') +
    fieldLine('Queixa principal / Motivo da consulta', 3) +
    fieldLine('Histórico clínico (início, evolução, diagnósticos anteriores)', 3) +
    fieldLine('Tratamentos anteriores realizados', 2) +
    `<div style="margin-bottom:6px;font-size:11px"><strong>Houve melhora nos tratamentos anteriores:</strong> ${opt('Sim')} ${opt('Não')}<br/><div style="color:#555;font-size:11px;margin:2px 0 2px">Qual tratamento melhorou:</div>${linha(1)}</div>` +
    `<div style="margin-bottom:6px;font-size:11px"><strong>O animal possui outra doença diagnosticada:</strong> ${opt('Sim')} ${opt('Não')}<br/><div style="color:#555;font-size:11px;margin:2px 0 2px">Qual:</div>${linha(1)}</div>` +
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 20px">
      <div>${yesNoNaLine('Acesso à rua', 0, opt('Restrito'))}</div>
      <div><div style="margin-bottom:6px;font-size:11px"><strong>Contato com outros animais:</strong> ${opt('Sim')} ${opt('Não')} ${opt('Eventualmente')}</div></div>
    </div>` +
    anamneseComum() +
    sectionH('Comorbidades Conhecidas') +
    grid3([
      'Doença Renal Crônica', 'Insuficiência Hepática', 'Cardiopatia',
      'Endocrinopatia', 'Neoplasia / Tumor', 'Doença Neurológica',
      'Doença Osteoarticular', 'Distúrbio Comportamental', 'Distúrbio do Sono',
    ]) +
    `<div style="display:flex;align-items:center;gap:8px;font-size:11px;margin-bottom:6px">${opt('Outras')}: <span style="display:inline-block;flex:1;border-bottom:1px solid #aaa">&nbsp;</span></div>` +
    fieldLine('Observações sobre comorbidades', 2) +
    sectionH('Triagem de Sinais Alvo (0 = ausente · 5 = severo)') +
    triagem('Dor Crônica / Inflamação') +
    triagem('Convulsões / Tremores') +
    `<div style="font-size:11px;margin-bottom:8px;margin-left:220px">Frequência dos episódios: ${linha(1)}</div>` +
    triagem('Ansiedade / Reatividade') +
    triagem('Distúrbios do Sono') +
    triagem('Falta de Apetite / Náusea') +
    sectionH('Histórico Terapêutico') +
    fieldLine('Medicamentos em uso contínuo (nome, dose, frequência)', 3) +
    `<div style="margin-bottom:6px;font-size:11px"><strong>Já utilizou Cannabis medicinal:</strong> ${opt('Sim')} ${opt('Não')}<br/><div style="color:#555;font-size:11px;margin:2px 0 2px">Se sim, resposta obtida e dosagem:</div>${linha(2)}</div>` +
    sectionH('Estilo de Vida e Comportamento') +
    `<div style="margin-bottom:8px;font-size:11px"><strong>Nível de estresse ambiental:</strong> ${opt('Baixo')} ${opt('Moderado')} ${opt('Alto')}</div>` +
    fieldLine('Rotina de atividades físicas / ambientes frequentados', 2) +
    `<div style="margin-bottom:8px;font-size:11px"><strong>Comportamento social:</strong>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
      ${opt('Apático / Isolado')} ${opt('Sociável')} ${opt('Agressivo / Defensivo')} ${opt('Hiperativo')}
    </div></div>` +
    sectionH('Expectativas do Tutor') +
    fieldLine('O que espera alcançar com o tratamento canábico?', 3) +
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 20px;margin-top:16px;font-size:11px">
      <div>
        <div style="font-weight:600;margin-bottom:4px">Assinatura do Tutor / Responsável:</div>
        <div style="border-bottom:1px solid #333;min-height:36px;margin-bottom:4px"></div>
        <div style="color:#777">Nome: <span style="border-bottom:1px solid #aaa;display:inline-block;width:200px">&nbsp;</span></div>
        <div style="color:#777;margin-top:4px">Data: _____ / _____ / _________</div>
      </div>
      <div>
        <div style="font-weight:600;margin-bottom:4px">Ciência do Veterinário:</div>
        <div style="border-bottom:1px solid #333;min-height:36px;margin-bottom:4px"></div>
        <div style="color:#777">CRMV: <span style="border-bottom:1px solid #aaa;display:inline-block;width:160px">&nbsp;</span></div>
      </div>
    </div>`
}

// ============================================================
// Wrap in full HTML doc
// ============================================================
function wrapHtml(title, body, ssNome = 'Salgueiro Systems') {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; line-height: 1.5; }
  @page { size: A4 portrait; margin: 15mm; }
  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
  .footer {
    position: fixed; bottom: 0; left: 0; right: 0;
    font-size: 8px; color: #aaa; text-align: center;
    padding: 5px 0; border-top: 1px solid #e0e0e0;
    background: #fff;
  }
  .print-btn {
    display: inline-block; padding: 8px 20px;
    background: #1a3a6b; color: #fff; border: none; border-radius: 6px;
    font-size: 13px; cursor: pointer; font-family: Arial;
  }
</style>
</head>
<body>
  <div class="no-print" style="text-align:center;padding:14px 0 12px;border-bottom:2px dashed #ccc;margin-bottom:16px">
    <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
    <div style="font-size:11px;color:#888;margin-top:6px">Use Ctrl+P para imprimir. Selecione "Salvar como PDF" para salvar.</div>
  </div>
  <div style="max-width:800px;margin:0 auto;padding:0 6px">
    ${body}
  </div>
  <div class="footer">${ssNome} — PetVet &nbsp;|&nbsp; ${title}</div>
</body>
</html>`
}

// ============================================================
// Main export
// ============================================================
export function generateFichaHTML(tipo, { corpImgSrc = '' } = {}) {
  const clinica = (() => {
    try { return JSON.parse(localStorage.getItem('petvet-clinica-config') ?? 'null') }
    catch { return null }
  })() ?? {}
  const ssNome = (() => { try { const c = JSON.parse(localStorage.getItem('petvet-ss-config') ?? '{}'); return c.nome || 'Salgueiro Systems' } catch { return 'Salgueiro Systems' } })()

  let title, body
  if (tipo === 'anamnese') {
    title = 'Ficha de Anamnese'
    body = fichaAnamnese(clinica)
  } else if (tipo === 'derma') {
    title = 'Ficha Dermatológica'
    body = fichaDerma(clinica, corpImgSrc)
  } else if (tipo === 'cannabis') {
    title = 'Ficha Canábica'
    body = fichaCannabis(clinica)
  } else {
    title = 'Ficha'
    body = '<p>Tipo desconhecido.</p>'
  }

  return wrapHtml(title, body, ssNome)
}
