import { norm } from './normalizeText'

// ---- Utilitários de path (ex: 'vitals.temperatura', 'examesFisicos.cardiorespiratorio.obs') ----
export function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj)
}

export function setByPath(obj, path, value) {
  const keys = path.split('.')
  const clone = Array.isArray(obj) ? [...obj] : { ...obj }
  let cur = clone
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    cur[k] = Array.isArray(cur[k]) ? [...cur[k]] : { ...(cur[k] ?? {}) }
    cur = cur[k]
  }
  cur[keys[keys.length - 1]] = value
  return clone
}

// ---- Comandos de voz padrão ----
// tipo 'texto'  -> preenche/concatena texto livre no campo
// tipo 'numero' -> extrai apenas o primeiro número encontrado
// tipo 'opcao'  -> tenta casar com uma das opções fornecidas
// tipo 'add-array' -> adiciona um item de texto a um array
export const COMANDOS_VOZ_DEFAULT = [
  { id: 'queixa-principal',  frases: ['queixa principal', 'motivo da consulta', 'motivo do atendimento'], campo: 'anamnese.queixa', label: 'Queixa principal', tipo: 'texto' },
  { id: 'historico',         frases: ['histórico', 'historico', 'história clínica', 'historia clinica'], campo: 'anamnese.historiaAtual', label: 'Histórico', tipo: 'texto' },
  { id: 'cirurgias-anteriores', frases: ['cirurgias anteriores', 'histórico cirúrgico', 'historico cirurgico'], campo: 'anamnese.historicoPrevio', label: 'Cirurgias anteriores', tipo: 'texto' },

  { id: 'temperatura', frases: ['temperatura'], campo: 'vitals.temperatura', label: 'Temperatura', tipo: 'numero' },
  { id: 'frequencia-cardiaca', frases: ['frequência cardíaca', 'frequencia cardiaca', 'fc '], campo: 'vitals.fc', label: 'Frequência cardíaca', tipo: 'numero' },
  { id: 'frequencia-respiratoria', frases: ['frequência respiratória', 'frequencia respiratoria', 'fr '], campo: 'vitals.fr', label: 'Frequência respiratória', tipo: 'numero' },
  { id: 'peso', frases: ['peso'], campo: 'vitals.peso', label: 'Peso', tipo: 'numero' },
  { id: 'glicemia', frases: ['glicemia'], campo: 'vitals.glicemia', label: 'Glicemia', tipo: 'numero' },
  { id: 'mucosas', frases: ['mucosas'], campo: 'vitals.mucosas', label: 'Mucosas', tipo: 'texto' },
  { id: 'hidratacao', frases: ['hidratação', 'hidratacao'], campo: 'vitals.hidratacao', label: 'Hidratação', tipo: 'texto' },

  { id: 'exame-cardiorespiratorio', frases: ['exame cardiorrespiratório', 'cardiorrespiratório', 'cardiorespiratorio'], campo: 'examesFisicos.cardiorespiratorio.obs', label: 'Exame cardiorrespiratório', tipo: 'texto' },

  { id: 'diagnostico', frases: ['diagnóstico', 'diagnostico'], campo: 'diagnostico.definitivo', label: 'Diagnóstico', tipo: 'texto' },
  { id: 'prescricao', frases: ['prescrição', 'prescricao', 'orientações ao tutor', 'orientacoes ao tutor', 'orientações', 'orientacoes'], campo: 'prescricao.orientacoes', label: 'Orientações ao tutor', tipo: 'texto' },

  { id: 'prurido', frases: ['prurido', 'coceira'], campo: 'derma.pruridoIntensidade', label: 'Prurido', tipo: 'numero' },
  { id: 'tipos-lesao', frases: ['tipo de lesão', 'tipo de lesao', 'tipos de lesão', 'tipos de lesao'], campo: 'derma.tiposLesao', label: 'Tipo de lesão', tipo: 'add-array' },

  { id: 'observacoes', frases: ['observações', 'observacoes'], campo: 'observacoesGerais', label: 'Observações', tipo: 'texto' },

  // Itens adicionados a listas (vacinas, medicamentos, aplicações)
  { id: 'adicionar-vacina', frases: ['adicionar vacina', 'aplicar vacina'], campo: 'vacinasAplicadas', label: 'Vacina', tipo: 'add-vacina' },
  { id: 'adicionar-medicamento', frases: ['adicionar medicamento', 'prescrever medicamento'], campo: 'prescricao.medicamentos', label: 'Medicamento', tipo: 'add-medicamento' },
  { id: 'adicionar-aplicacao', frases: ['adicionar aplicação', 'adicionar aplicacao'], campo: 'aplicacoes', label: 'Aplicação', tipo: 'add-aplicacao' },
]

// Palavras usadas para limpar o início do conteúdo extraído (ex: "queixa principal: o pet está...")
const CONECTORES = [':', ' é ', ' foi ', ' de ', ' do ', ' da ', ' está ', ' esta ', ' são ', ' sao ']

function limparConteudo(txt) {
  let t = txt.trim()
  // remove conectores apenas se estiverem bem no início
  for (const c of CONECTORES) {
    const cTrim = c.trim()
    if (t.toLowerCase().startsWith(cTrim.toLowerCase() + ' ') || t === cTrim) {
      t = t.slice(cTrim.length).trim()
      break
    }
  }
  // remove pontuação inicial (':', '-', etc.)
  t = t.replace(/^[:\-–,.]+\s*/, '')
  return t.trim()
}

function extrairNumero(txt) {
  const m = txt.match(/-?\d+(?:[.,]\d+)?/)
  if (!m) return null
  return m[0].replace(',', '.')
}

/**
 * Processa um trecho de transcrição e retorna os comandos detectados.
 * Cada comando é aplicado a partir do texto que vem DEPOIS da frase-gatilho.
 * @param {string} texto - trecho de transcrição (geralmente uma frase finalizada)
 * @param {Array}  comandos - lista de comandos (DEFAULT + customizados)
 * @returns {Array<{ id, campo, label, tipo, valor }>}
 */
export function processarTranscricao(texto, comandos = COMANDOS_VOZ_DEFAULT) {
  const normalizado = norm(texto)
  const resultados = []

  for (const cmd of comandos) {
    for (const frase of cmd.frases) {
      const fraseNorm = norm(frase)
      const idx = normalizado.indexOf(fraseNorm)
      if (idx === -1) continue

      // Recupera o texto original correspondente após a frase (aproximação por tamanho)
      const restoNormalizado = normalizado.slice(idx + fraseNorm.length)
      const resto = texto.slice(texto.length - restoNormalizado.length)
      const conteudo = limparConteudo(resto)
      if (!conteudo) continue

      let valor = conteudo
      if (cmd.tipo === 'numero') {
        const n = extrairNumero(conteudo)
        if (n == null) continue
        valor = n
      }

      resultados.push({ id: cmd.id, campo: cmd.campo, label: cmd.label, tipo: cmd.tipo, valor })
      break // não testa outras frases do mesmo comando
    }
  }

  return resultados
}

// ---- Palavras-chave de autorização ----
export const PALAVRAS_AUTORIZACAO = ['sim', 'autorizo', 'pode gravar', 'concordo', 'aceito', 'pode', 'tudo bem']
export const PALAVRAS_NEGACAO = ['não autorizo', 'nao autorizo', 'não quero', 'nao quero', 'não', 'nao']

export function detectarAutorizacao(texto) {
  const t = norm(texto)
  for (const p of PALAVRAS_NEGACAO) {
    if (t.includes(norm(p))) return 'negado'
  }
  for (const p of PALAVRAS_AUTORIZACAO) {
    if (t.includes(norm(p))) return 'autorizado'
  }
  return null
}
