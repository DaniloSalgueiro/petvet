import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Plus, Search, FileText, Printer, ChevronRight, ChevronDown, X } from 'lucide-react'
import Tabs from '../components/ui/Tabs'
import corpImg from '../assets/corpo.jpg'
import { PRONTUARIOS, PETS, TUTORES, PRODUTOS, getPetById, getTutorById, AGENDAMENTOS } from '../data/mock'
import { getVeterinarios, findVetById } from '../utils/getVeterinarios'
import { useAuth } from '../context/AuthContext'
import { normIncludes, norm } from '../utils/normalizeText'
import { usePersistentState } from '../hooks/usePersistentState'
import ConfirmModal from '../components/ui/ConfirmModal'
import { calcularIdade } from '../utils/calcularIdade'
import { generateProntuarioPrint } from '../utils/generateProntuarioPrint'
import { generateFichaHTML } from '../utils/generateFichaHTML'
import { maskCPF, maskRG, maskPhone } from '../utils/masks'

// ---- Tipos de consulta e config padrão ----
export const TIPOS_CONSULTA_DEFAULT = ['Consulta Clínica Geral', 'Consulta Dermatológica', 'Consulta Canábica', 'Retorno', 'Cirurgia']
export const SECTIONS_CONFIGURABLES = [
  { id: 'anamnese',           label: 'Anamnese' },
  { id: 'derma',              label: 'Derma' },
  { id: 'cannabis',           label: 'Cannabis' },
  { id: 'vitais',             label: 'Sinais Vitais' },
  { id: 'exame',              label: 'Exame Físico' },
  { id: 'vacinas',            label: 'Vacinas' },
  { id: 'aplicacoes',         label: 'Aplicações' },
  { id: 'solicitacao-exames', label: 'Solicitação de Exames' },
  { id: 'diagnostico',        label: 'Diagnóstico' },
  { id: 'prescricao',         label: 'Prescrição' },
  { id: 'manual-coleta',      label: 'Manual de Coleta' },
  { id: 'termos',             label: 'Termos' },
  { id: 'anexos',             label: 'Anexos' },
  { id: 'assinatura',         label: 'Assinatura' },
]

function buildDefaultSectionConfig(tipos) {
  const cfg = {}
  for (const t of tipos) {
    cfg[t] = Object.fromEntries(SECTIONS_CONFIGURABLES.map(s => [s.id, { visible: true }]))
  }
  return cfg
}

export const DEFAULT_PRONTUARIO_CONFIG = {
  tipos: TIPOS_CONSULTA_DEFAULT,
  sectionConfig: buildDefaultSectionConfig(TIPOS_CONSULTA_DEFAULT),
}

// ---- Classificações vitais ----
function classifyTemp(val) {
  const v = parseFloat(val); if (isNaN(v) || !val) return null
  if (v < 38)     return { label: 'Hipotermia',       color: 'var(--info)' }
  if (v <= 39.4)  return { label: 'Normotermia',       color: 'var(--success)' }
  if (v <= 40)    return { label: 'Hipertermia / Febre', color: 'var(--warning)' }
  return              { label: 'Febre / Urgência',    color: 'var(--danger)' }
}
function classifyFC(val, especie) {
  const v = parseFloat(val); if (isNaN(v) || !val) return null
  if (especie === 'Cão') {
    if (v < 60)   return { label: 'Bradicardia',    color: 'var(--danger)' }
    if (v <= 120) return { label: 'Normocárdico',   color: 'var(--success)' }
    return            { label: 'Taquicardia',       color: 'var(--warning)' }
  }
  if (especie === 'Gato') {
    if (v < 120)  return { label: 'Bradicardia',    color: 'var(--danger)' }
    if (v <= 240) return { label: 'Normocárdico',   color: 'var(--success)' }
    return            { label: 'Taquicardia',       color: 'var(--warning)' }
  }
  return null
}
function classifyFR(val, especie) {
  const v = parseFloat(val); if (isNaN(v) || !val) return null
  if (especie === 'Cão') {
    if (v < 12)   return { label: 'Dispneia',      color: 'var(--danger)' }
    if (v <= 30)  return { label: 'Normopneico',   color: 'var(--success)' }
    return            { label: 'Taquipneia',       color: 'var(--warning)' }
  }
  if (especie === 'Gato') {
    if (v < 20)   return { label: 'Dispneia',      color: 'var(--danger)' }
    if (v <= 30)  return { label: 'Normopneico',   color: 'var(--success)' }
    return            { label: 'Taquipneia',       color: 'var(--warning)' }
  }
  return null
}
function classifyGlicemia(val, especie) {
  const v = parseFloat(val); if (isNaN(v) || !val) return null
  if (especie === 'Cão') {
    if (v < 60)   return { label: 'Hipoglicemia',      color: 'var(--danger)' }
    if (v <= 110) return { label: 'Normoglicêmico',    color: 'var(--success)' }
    if (v <= 200) return { label: 'Pré-diabético',     color: 'var(--warning)' }
    return            { label: 'Hiperglicêmico',       color: 'var(--danger)' }
  }
  if (especie === 'Gato') {
    if (v < 70)   return { label: 'Hipoglicemia',      color: 'var(--danger)' }
    if (v <= 150) return { label: 'Normoglicêmico',    color: 'var(--success)' }
    if (v <= 200) return { label: 'Pré-diabético',     color: 'var(--warning)' }
    return            { label: 'Hiperglicêmico',       color: 'var(--danger)' }
  }
  return null
}
function classifyHidratacao(val) {
  if (val === '<5%')  return { label: 'Normal',    color: '#4CAF50' }
  if (val === '5-8%') return { label: 'Leve',      color: '#FF9800' }
  if (val === '8-12%')return { label: 'Moderada',  color: '#9C27B0' }
  if (val === '>12%') return { label: 'Grave',     color: '#F44336' }
  return null
}

const EXAM_GROUPS = [
  // 1. HEMATOLOGIA
  { id: 'hematologia', label: 'Hematologia', items: [
    { id: 'hema_hemograma',  label: 'Hemograma + Reticulócitos' },
    { id: 'hema_htpp',       label: 'Hematócrito + PP' },
    { id: 'hema_hemopara',   label: 'Pesquisa de Hemoparasitas' },
    { id: 'hema_lentz',      label: 'Pesquisa de Lentz' },
    { id: 'hema_microf',     label: 'Pesquisa de Microfilária' },
    { id: 'hema_gasometria', label: 'Hemogasometria', type: 'check+field', fieldLabel: 'Temp. (°C)', fieldKey: 'temp' },
    { id: 'hema_compat',     label: 'Compatibilidade Sanguínea', type: 'check+field', fieldLabel: 'Nº doadores', fieldKey: 'doadores' },
    { id: 'hema_tipagem',    label: 'Tipagem Sanguínea' },
    { id: 'hema_coombs',     label: 'Teste de Coombs' },
    { id: 'hema_outro',      label: 'Outros', type: 'check+text' },
  ]},
  // 2. HEMOSTASIA
  { id: 'hemostasia', label: 'Hemostasia', items: [
    { id: 'hemo_plaquetas',   label: 'Plaquetas / Trombócitos' },
    { id: 'hemo_tpttpa',      label: 'TP + TTPA' },
    { id: 'hemo_dimero',      label: 'Dímero Canino' },
  ]},
  // 3. BIOQUÍMICOS
  { id: 'bioquimicos', label: 'Bioquímicos', items: [
    { id: 'bio_alt',          label: 'ALT / TGP' },
    { id: 'bio_ast',          label: 'AST / TGO' },
    { id: 'bio_fa',           label: 'FA — Fosfatase Alcalina' },
    { id: 'bio_ggt',          label: 'GGT' },
    { id: 'bio_bili',         label: 'Bilirrubinas (Total / Direta / Indireta)' },
    { id: 'bio_albumina',     label: 'Albumina' },
    { id: 'bio_prot',         label: 'Proteínas Totais e Frações' },
    { id: 'bio_ureia',        label: 'Ureia' },
    { id: 'bio_creat',        label: 'Creatinina' },
    { id: 'bio_glicose',      label: 'Glicose' },
    { id: 'bio_colesterol',   label: 'Colesterol Total' },
    { id: 'bio_triglicerid',  label: 'Triglicerídeos' },
    { id: 'bio_ldh',          label: 'LDH' },
    { id: 'bio_ck',           label: 'CK / CPK' },
    { id: 'bio_amilase',      label: 'Amilase' },
    { id: 'bio_lipase',       label: 'Lipase' },
    { id: 'bio_frutosamina',  label: 'Frutosamina' },
    { id: 'bio_hbglicada',    label: 'Hemoglobina Glicada' },
    { id: 'bio_ferro',        label: 'Ferro Sérico' },
    { id: 'bio_ferritina',    label: 'Ferritina' },
    { id: 'bio_caplig',       label: 'Capacidade de Ligação do Ferro' },
    { id: 'bio_acurico',      label: 'Ácido Úrico' },
    { id: 'bio_cobre',        label: 'Cobre Sérico' },
    { id: 'bio_ppt',          label: 'PPT (Proteína Plasmática Total)' },
    { id: 'bio_tli',          label: 'TLI / Lipase Pancreática (cPLI / fPLI)' },
    { id: 'bio_b12',          label: 'Cobalamina (B12) / Folato' },
    { id: 'bio_sdma',         label: 'SDMA (Dimetil Arginina)' },
    { id: 'bio_troponina',    label: 'Troponina Cardíaca' },
    { id: 'bio_vitamina',     label: 'Vitamina', type: 'check+text', fieldLabel: 'Qual vitamina?' },
    { id: 'bio_outro',        label: 'Outro', type: 'check+text' },
  ]},
  // 4. ELETRÓLITOS E MINERAIS
  { id: 'eletrolitos', label: 'Eletrólitos e Minerais', items: [
    { id: 'elet_sodio',       label: 'Sódio (Na⁺)' },
    { id: 'elet_potassio',    label: 'Potássio (K⁺)' },
    { id: 'elet_calcio_ion',  label: 'Cálcio Iônico (Ca²⁺)' },
    { id: 'elet_calcio_tot',  label: 'Cálcio Total' },
    { id: 'elet_fosforo',     label: 'Fósforo' },
    { id: 'elet_magnesio',    label: 'Magnésio' },
    { id: 'elet_cloro',       label: 'Cloro (Cl⁻)' },
    { id: 'elet_bicarb',      label: 'Bicarbonato' },
    { id: 'elet_zinco',       label: 'Zinco' },
    { id: 'elet_outro',       label: 'Outro', type: 'check+text' },
  ]},
  // 5. MEDICAMENTOS (monitoração sérica) — linha horizontal
  { id: 'medicamentos', label: 'Medicamentos (Monitoração Sérica)', layout: 'horizontal', items: [
    { id: 'med_brometo',      label: 'Brometo de Potássio' },
    { id: 'med_digoxina',     label: 'Digoxina' },
    { id: 'med_fenobarb',     label: 'Fenobarbital' },
  ]},
  // 6. ALERGOLOGIA
  { id: 'alergologia', label: 'Alergologia', items: [
    { id: 'alergo_inh_cao',   label: 'Painel Inalante Cão' },
    { id: 'alergo_inh_gat',   label: 'Painel Inalante Gato' },
    { id: 'alergo_aliment',   label: 'Painel Alimentar' },
    { id: 'alergo_ige',       label: 'IgE Total' },
    { id: 'alergo_intrad',    label: 'Testes Intradérmicos' },
    { id: 'alergo_outro',     label: 'Outro', type: 'check+text' },
  ]},
  // 7. ANÁLISE DE URINA
  { id: 'urina', label: 'Análise de Urina', items: [
    { id: 'uri_tipo1',        label: 'Urinálise (Tipo I)' },
    { id: 'uri_sedimento',    label: 'Sedimento Urinário' },
    { id: 'uri_urocultura',   label: 'Urocultura' },
    { id: 'uri_antibio',      label: 'Antibiograma Urina' },
    { id: 'uri_upc',          label: 'UPC (Proteína : Creatinina)' },
    { id: 'uri_dme',          label: 'Densidade Urinária' },
    { id: 'uri_vbac',         label: 'VBAC (Bactérias em câmara)' },
    { id: 'uri_outro',        label: 'Outro', type: 'check+text' },
  ], extras: [
    { id: 'uri_metodo', type: 'select', label: 'Método de coleta', options: ['Cistocentese', 'Cateterismo', 'Jato médio'] },
  ]},
  // 8. ANÁLISE DE LÍQUIDOS CAVITÁRIOS
  { id: 'liquidos', label: 'Análise de Líquidos Cavitários', items: [
    { id: 'liq_pleural',      label: 'Líquido Pleural' },
    { id: 'liq_peritoneal',   label: 'Líquido Peritoneal / Ascítico' },
    { id: 'liq_sinovial',     label: 'Líquido Sinovial' },
    { id: 'liq_lcr',          label: 'LCR (Líquido Cefalorraquidiano)' },
    { id: 'liq_pericardico',  label: 'Pericárdico' },
    { id: 'liq_outro',        label: 'Outro', type: 'check+text' },
  ], extras: [
    { id: 'liq_local_acumulo',  type: 'text', label: 'Local de Acúmulo' },
    { id: 'liq_articulacao',    type: 'text', label: 'Articulação (se sinovial)' },
    { id: 'liq_local_coleta',   type: 'text', label: 'Local de Coleta' },
    { id: 'liq_bio_extra',      type: 'text', label: 'Exame Bioquímico Adicional' },
  ]},
  // 9. COPROLOGIA
  { id: 'coprologia', label: 'Coprologia', items: [
    { id: 'copro_epf',        label: 'EPF (Exame Parasitológico de Fezes)' },
    { id: 'copro_giardia',    label: 'Coproantígeno Giardia' },
    { id: 'copro_crypto',     label: 'Coproantígeno Cryptosporidium' },
    { id: 'copro_cultura',    label: 'Cultura de Fezes' },
    { id: 'copro_sangue',     label: 'Sangue Oculto nas Fezes' },
    { id: 'copro_calprote',   label: 'Calprotectina' },
    { id: 'copro_outro',      label: 'Outro', type: 'check+text' },
  ]},
  // 10. MICROBIOLOGIA
  { id: 'microbiologia', label: 'Microbiologia', items: [
    { id: 'micro_aerobia',    label: 'Cultura Aeróbia + Antibiograma' },
    { id: 'micro_anaerobia',  label: 'Cultura Anaeróbia + Antibiograma' },
    { id: 'micro_fungica',    label: 'Cultura Fúngica (Dermatofitose)' },
    { id: 'micro_mrsa',       label: 'Pesquisa de MRSA' },
    { id: 'micro_biofilme',   label: 'Pesquisa de Biofilme' },
    { id: 'micro_bacteriosc', label: 'Bacterioscopia (Gram)' },
    { id: 'micro_outro',      label: 'Outro', type: 'check+text' },
  ], extras: [
    { id: 'micro_material', type: 'text', label: 'Material Enviado' },
  ]},
  // 11. CITOLOGIA E PARASITOLOGIA
  { id: 'citologia', label: 'Citologia e Parasitologia', layout: 'citologia', items: [
    { id: 'cito_tricograma',  label: 'Tricograma' },
    { id: 'cito_vaginal',     label: 'Citologia Vaginal' },
    { id: 'cito_medula',      label: 'Citologia de Medula Óssea' },
    { id: 'cito_pesquisa',    label: 'Pesquisa de', type: 'check+subs', subs: [
      { id: 'acaros',         label: 'Ácaros' },
      { id: 'candida',        label: 'Cândida e Bactéria' },
      { id: 'malassezia',     label: 'Malassezia e Bactéria' },
      { id: 'leishmania',     label: 'Leishmania' },
      { id: 'myco',           label: 'Mycobacterium' },
      { id: 'esporotrix',     label: 'Esporotrix' },
      { id: 'celulas_le',     label: 'Células LE' },
    ]},
    { id: 'cito_diag1',       label: 'Citologia Diagnóstica', type: 'check+diag' },
    { id: 'cito_diag2',       label: 'Citologia Diagnóstica (adicional — por local)', type: 'check+diag' },
  ]},
  // 12. HISTOPATOLOGIA
  { id: 'histopatologia', label: 'Histopatologia', items: [
    { id: 'histo_excisional', label: 'Biópsia Excisional' },
    { id: 'histo_incisional', label: 'Biópsia Incisional' },
    { id: 'histo_punch',      label: 'Biópsia Punch' },
    { id: 'histo_core',       label: 'Biópsia por Agulha Grossa (Core)' },
    { id: 'histo_endosc',     label: 'Biópsia Endoscópica' },
    { id: 'histo_medula',     label: 'Biópsia de Medula Óssea' },
    { id: 'histo_necro',      label: 'Necrópsia Completa' },
    { id: 'histo_necro_parc', label: 'Necrópsia Parcial' },
    { id: 'histo_mama_uni',   label: 'Histopatológico de Cadeia Mamária — Unilateral' },
    { id: 'histo_mama_bi',    label: 'Histopatológico de Cadeia Mamária — Bilateral' },
  ]},
  // 13. ONCOLOGIA AVANÇADA
  { id: 'oncologia', label: 'Oncologia Avançada', items: [
    { id: 'onco_ki67',        label: 'IHQ — Ki-67' },
    { id: 'onco_ciclina',     label: 'IHQ — Ciclina D1' },
    { id: 'onco_vimentina',   label: 'IHQ — Vimentina' },
    { id: 'onco_actina',      label: 'IHQ — Actina' },
    { id: 'onco_desmina',     label: 'IHQ — Desmina' },
    { id: 'onco_ckit_ihq',    label: 'IHQ — c-Kit (CD117)' },
    { id: 'onco_pdgfra',      label: 'IHQ — PDGFRA' },
    { id: 'onco_vegfr2',      label: 'IHQ — VEGFR2' },
    { id: 'onco_her2',        label: 'IHQ — HER2' },
    { id: 'onco_pancito',     label: 'IHQ — Pancitoqueratina' },
    { id: 'onco_parr_can',    label: 'PARR Canino' },
    { id: 'onco_parr_fel',    label: 'PARR Felino' },
    { id: 'onco_braf',        label: 'BRAF' },
    { id: 'onco_ckit_mut',    label: 'C-Kit (Mutação)' },
    { id: 'onco_cea',         label: 'CEA' },
  ]},
  // 14. IMUNOLOGIA — TESTES RÁPIDOS
  { id: 'imuno_rapidos', label: 'Imunologia — Testes Rápidos', items: [
    { id: 'ir_fiv_felv',      label: 'FIV / FeLV' },
    { id: 'ir_leish',         label: 'Leishmaniose (rK39)' },
    { id: 'ir_cinomose',      label: 'Cinomose (Ag)' },
    { id: 'ir_parvo',         label: 'Parvovirose (Ag)' },
    { id: 'ir_corona',        label: 'Coronavírus / PIF (Ag)' },
    { id: 'ir_giardia',       label: 'Giardia (Ag)' },
    { id: 'ir_ehrlichia',     label: 'Ehrlichia (Ac)' },
    { id: 'ir_anaplasma',     label: 'Anaplasma (Ac)' },
    { id: 'ir_neospora',      label: 'Neospora (Ac)' },
    { id: 'ir_toxo',          label: 'Toxoplasmose (rápido)' },
    { id: 'ir_brucella',      label: 'Brucella (rápido)' },
    { id: 'ir_lepto',         label: 'Leptospirose (rápido)' },
    { id: 'ir_dirofilaria',   label: 'Dirofilaria (Ag)' },
  ]},
  // 15. IMUNOLOGIA — SOROLOGIAS
  { id: 'imuno_sorologias', label: 'Imunologia — Sorologias', items: [
    { id: 'is_leish_elisa',   label: 'Leishmaniose (ELISA)' },
    { id: 'is_leish_rifi',    label: 'Leishmaniose (RIFI)' },
    { id: 'is_toxo',          label: 'Toxoplasmose (IgG / IgM)' },
    { id: 'is_brucella',      label: 'Brucella canis' },
    { id: 'is_lepto',         label: 'Leptospirose (MAT)' },
    { id: 'is_neospora',      label: 'Neospora caninum' },
    { id: 'is_toxocara',      label: 'Toxocara spp.' },
    { id: 'is_bartonella',    label: 'Bartonella' },
    { id: 'is_babesia',       label: 'Babesia' },
    { id: 'is_rickettsia',    label: 'Rickettsia' },
    { id: 'is_cinomose',      label: 'Cinomose (Ac)' },
    { id: 'is_fiv_wb',        label: 'FIV (Western Blot)' },
    { id: 'is_felv_elisa',    label: 'FeLV (ELISA)' },
    { id: 'is_aspergillus',   label: 'Aspergillus' },
    { id: 'is_cryptococcus',  label: 'Cryptococcus' },
    { id: 'is_pif',           label: 'PIF (IgG)' },
    { id: 'is_hemoplasma',    label: 'Hemoplasmose' },
    { id: 'is_dirofilaria',   label: 'Dirofilaria (ELISA)' },
    { id: 'is_outro',         label: 'Outro', type: 'check+text' },
  ]},
  // 16. ENDOCRINOLOGIA — tabela hormônio × método
  { id: 'endocrinologia', label: 'Endocrinologia', layout: 'endocrinologia',
    hormones: [
      { id: 't4_total',  label: 'T4 Total' },
      { id: 't4_livre',  label: 'T4 Livre' },
      { id: 't3_total',  label: 'T3 Total' },
      { id: 't3_livre',  label: 'T3 Livre' },
      { id: 'tsh_can',   label: 'TSH Canino' },
      { id: 'tsh_fel',   label: 'TSH Felino' },
      { id: 'cortisol',  label: 'Cortisol' },
      { id: 'insulina',  label: 'Insulina' },
      { id: 'progest',   label: 'Progesterona' },
      { id: 'estradiol', label: 'Estradiol' },
      { id: 'acth_end',  label: 'ACTH Endógeno' },
      { id: 'pth',       label: 'PTH' },
      { id: 'gh_end',    label: 'GH' },
    ],
    methods: ['Quimio', 'FQ', 'RIE'],
    extras: [
      { id: 'endo_painel_red',   type: 'check', label: 'Painel Androgênico — Reduzido' },
      { id: 'endo_painel_comp',  type: 'check', label: 'Painel Androgênico — Completo' },
      { id: 'endo_outro_exame',  type: 'text',  label: 'Outro hormônio / exame' },
      { id: 'endo_outro_metodo', type: 'text',  label: 'Método' },
    ],
    items: [],
  },
  // 17. BIOLOGIA MOLECULAR — PCR
  { id: 'pcr', label: 'Biologia Molecular — PCR', layout: 'pcr', items: [], extras: [] },
  // 18. RADIOGRÁFICO
  { id: 'radiografico', label: 'Radiográfico', layout: 'radiografico', items: [],
    regions: [
      { id: 'rad_mt_d',       label: 'Membro Torácico D',    positions: ['LL', 'VD', 'CrCd', 'ML'] },
      { id: 'rad_mt_e',       label: 'Membro Torácico E',    positions: ['LL', 'VD', 'CrCd', 'ML'] },
      { id: 'rad_mp_d',       label: 'Membro Pélvico D',     positions: ['LL', 'VD', 'CrCd', 'ML'] },
      { id: 'rad_mp_e',       label: 'Membro Pélvico E',     positions: ['LL', 'VD', 'CrCd', 'ML'] },
      { id: 'rad_col_cerv',   label: 'Coluna Cervical',      positions: ['LL', 'VD'] },
      { id: 'rad_col_tor',    label: 'Coluna Torácica',      positions: ['LL', 'VD'] },
      { id: 'rad_col_lomb',   label: 'Coluna Lombar',        positions: ['LL', 'VD'] },
      { id: 'rad_col_sacra',  label: 'Coluna Sacra',         positions: ['LL', 'VD'] },
      { id: 'rad_lombosacra', label: 'Lombossacra',          positions: ['LL', 'VD'] },
      { id: 'rad_coxofem',    label: 'Coxofemoral / Pelve',  positions: ['LLD', 'LLE', 'VD'] },
      { id: 'rad_torax',      label: 'Tórax',                positions: ['LLD', 'LLE', 'VD'] },
    ],
  },
  // 19. ULTRASSOM, ECO E ECG
  { id: 'ultrassom', label: 'Ultrassom, Eco e ECG', items: [
    { id: 'usg_abd_total',    label: 'Ultrassom Abdominal Total' },
    { id: 'usg_abd_foc',      label: 'Ultrassom Abdominal Focada', type: 'check+text', fieldLabel: 'Órgãos a avaliar' },
    { id: 'usg_cervical',     label: 'Ultrassom Cervical' },
    { id: 'usg_eco',          label: 'Ecocardiograma Doppler' },
    { id: 'usg_ecg',          label: 'Eletrocardiograma (ECG)' },
  ]},
]

const SISTEMAS = [
  { key: 'cardiorespiratorio', label: 'Cardiorrespiratório', chips: ['NDN', 'Tosse', 'Cansaço fácil', 'Secreção Nasal'] },
  { key: 'digestorio',         label: 'Digestório' },
  { key: 'locomotor',          label: 'Locomotor',           chips: ['NDN', 'Dificuldade de locomoção', 'Alteração postural'] },
  { key: 'neurologico',        label: 'Neurológico',         chips: ['NDN', 'Convulsão', 'Crises epiléticas', 'Inclinação de cabeça', 'Ataxia'] },
  { key: 'dermatologico',      label: 'Dermatológico' },
  { key: 'reprodutivo',        label: 'Reprodutivo' },
  { key: 'linfonodos',         label: 'Linfonodos' },
  { key: 'olhos',              label: 'Olhos',   split: true, chips: ['NDN', 'Secreção ocular', 'Prurido', 'Perda da visão'] },
  { key: 'ouvidos',            label: 'Ouvidos', split: true, chips: ['NDN', 'Secreção', 'Prurido', 'Perda da audição'] },
  { key: 'boca',               label: 'Boca / Dentes' },
]

const ALL_SECTIONS = [
  { id: 'tipo',               label: 'Tipo de Consulta' },
  { id: 'cirurgia',           label: 'Procedimentos Cirúrgicos' },
  { id: 'anamnese',           label: 'Anamnese' },
  { id: 'derma',              label: 'Derma' },
  { id: 'cannabis',           label: 'Cannabis' },
  { id: 'vitais',             label: 'Sinais Vitais' },
  { id: 'exame',              label: 'Exame Físico' },
  { id: 'vacinas',            label: 'Vacinas' },
  { id: 'aplicacoes',         label: 'Aplicações' },
  { id: 'solicitacao-exames', label: 'Solicitação de Exames' },
  { id: 'diagnostico',        label: 'Diagnóstico' },
  { id: 'prescricao',         label: 'Prescrição' },
  { id: 'manual-coleta',      label: 'Manual de Coleta' },
  { id: 'termos',             label: 'Termos' },
  { id: 'anexos',             label: 'Anexos' },
  { id: 'assinatura',         label: 'Assinatura' },
]

function todayISO() { return new Date().toISOString().split('T')[0] }

const EMPTY_FORM = {
  petId: '', vetId: '', date: todayISO(),
  status: 'aguardando',
  tipoConsulta: 'Consulta Clínica Geral',
  vitals: {
    especie: 'Cão',
    temperatura: '', fc: '', fr: '', peso: '', spo2: '',
    tpc: '', mucosas: 'Normocorada', hidratacao: '<5%',
    pulso: 'Normosfigmia', glicemia: '', diurese: 'Normúria',
    apetite: 'Normorexia', ingestaoAgua: 'Normodipsia',
  },
  anamnese: {
    queixa: '', historiaAtual: '', historicoPrevio: '',
    statusVacinal: 'Em dia',
    vomito: 'Não', vomitoDesc: '',
    diarreia: 'Não', diarreiaDesc: '',
    alimentacao: 'Ração', alimentacaoOutro: '',
    acesRua: 'Não', contatoAnimais: 'Sim', contatoAnimaisDesc: '',
    antipulgas: 'Não', antipulgasProduto: '',
    medicamentosPrevios: 'Não', medicamentosPreviosDesc: '',
  },
  derma: {
    queixa: '', sazonalidade: '', tratamentosAnteriores: '',
    melhoraTratamentos: 'Não', melhoraTratamentosDesc: '',
    outraDoenca: 'Não', outraDoencaDesc: '',
    acesRua: 'Não',
    contatoAnimais: 'Não', contatoAnimaisDesc: '',
    animaisComProblema: 'Não', animaisComProblemaDesc: '',
    vomito: 'Não', vomitoDesc: '',
    diarreia: 'Não', diarreiaDesc: '',
    alimentacao: 'Ração seca', alimentacaoDesc: '',
    antipulgas: 'Não', antipulgasProduto: '',
    medicamentosPrevios: 'Não', medicamentosPreviosDesc: '',
    humanoComProblema: 'Não', humanoComProblemaDesc: '',
    frequenciaBanhos: 'Mensal', frequenciaBanhosCustom: '',
    pruridoIntensidade: '',
    comoSeCoca: [], apareceuPrimeiro: [], habitacao: [], contatosCom: [],
    mapaCanvasData: null,
    tiposLesao: [],
    raspado: '', raspadoDesc: '',
    citologia: [], citologiaOutrosDesc: '',
    fitaAcetato: '', tricograma: [], tricogramaOutrosDesc: '',
    lampadaWood: '', culturaAntibiograma: '', culturaDesc: '',
    reflexoOtopodal: '', biopsia: '', outroExame: '', observacoes: '',
  },
  cannabis: {
    queixa: '', historico: '', tratamentosAnteriores: '',
    melhoraTratamentos: 'Não', melhoraTratamentosDesc: '',
    outraDoenca: 'Não', outraDoencaDesc: '',
    acesRua: 'Não',
    contatoAnimais: 'Não', contatoAnimaisDesc: '',
    vomito: 'Não', vomitoDesc: '',
    diarreia: 'Não', diarreiaDesc: '',
    alimentacao: 'Ração seca', alimentacaoDesc: '',
    antipulgas: 'Não', antipulgasProduto: '',
    medicamentosPrevios: 'Não', medicamentosPreviosDesc: '',
    comorbidades: [], comorbidadesOutras: '',
    triaDor: '', triaConvulsoes: '', triaConvulsoesFreq: '',
    triaAnsiedade: '', triaSono: '', triaApetite: '',
    medsContinuos: '', usouCannabis: 'Não', usouCannabisResp: '',
    estresseAmbiental: 'Baixo', rotinasAtividades: '', comportamentoSocial: 'Sociável',
    expectativasTutor: '',
    indicacao: '', produto: '', concentracao: '',
    doseKg: '', doseTotal: '',
    via: 'Oral', frequencia: '', duracao: '',
    respostaAnterior: 'Primeira vez',
    efeitosAdversos: '', observacoes: '',
  },
  examesFisicos: {
    cardiorespiratorio: { chips: [], obs: '' },
    digestorio:         { status: 'NDN', obs: '' },
    locomotor:          { chips: [], obs: '' },
    neurologico:        { chips: [], obs: '' },
    dermatologico:      { status: 'NDN', obs: '' },
    reprodutivo:        { status: 'NDN', obs: '' },
    linfonodos:         { status: 'NDN', obs: '' },
    olhos:              { od: [], oe: [], obs: '' },
    ouvidos:            { od: [], oe: [], obs: '' },
    boca:               { status: 'NDN', obs: '' },
  },
  diagnostico: { diferencial: '', definitivo: '' },
  solicitacaoExames: {},
  prescricao: { medicamentos: [], retorno: '', orientacoes: '' },
  vacinasAplicadas: [],
  aplicacoes: [],
  procedimentos: [],
  cirurgiaMesmoVet: false,
  cirurgiaVetUnicoId: '',
  precoTotalCirurgia: 0,
  anexos: [],
  assinatura: null,
}

const STATUS_LABEL = {
  aguardando: 'Aguardando', confirmado: 'Confirmado', 'em-atendimento': 'Em Atendimento',
  concluido: 'Concluído', cancelado: 'Cancelado',
}
const STATUS_COLOR = {
  aguardando: '#888', confirmado: '#2196F3', 'em-atendimento': '#FF9800',
  concluido: '#4CAF50', cancelado: '#F44336',
}

// ---- Derma constants ----
const LESAO_TYPES = [
  'Úmida', 'Mácula', 'Alopécia', 'Erosão', 'Edema', 'Telangectasia',
  'Descamação micácea', 'Úlcera', 'Abcesso', 'Sanguinolenta', 'Pápula', 'Hipotricose',
  'Crostas melicéricas', 'Crostas hemáticas', 'Eritrodermia', 'Hiperpigmentação', 'Nódulo', 'Purulenta',
  'Pústula', 'Bolha', 'Hiperqueratose', 'Hiperemia', 'D. Farinácea', 'Calo',
  'Placa', 'Seca', 'Colarete epidérmico', 'Vesícula', 'Querión', 'Fissuras',
  'Comedos', 'Exudativa', 'Atrofia da derme',
]

function DermaCanvas({ value, onChange, disabled }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const drawing = useRef(false)
  const lastPos = useRef(null)
  const [tool, setTool] = useState('brush') // 'brush' | 'eraser'

  // Load saved drawing on mount
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !value) return
    const img = new Image()
    img.onload = () => {
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    }
    img.src = value
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function syncCanvasSize() {
    const canvas = canvasRef.current
    const imgEl = imgRef.current
    if (!canvas || !imgEl) return
    const { naturalWidth, naturalHeight } = imgEl
    if (naturalWidth && canvas.width !== naturalWidth) {
      canvas.width = naturalWidth
      canvas.height = naturalHeight
    }
  }

  function getPos(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    return {
      x: (src.clientX - rect.left) * canvas.width / rect.width,
      y: (src.clientY - rect.top) * canvas.height / rect.height,
    }
  }

  function applyStroke(from, to, mode) {
    const ctx = canvasRef.current.getContext('2d')
    ctx.save()
    if (mode === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
      ctx.lineWidth = 28
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = 'rgba(220, 38, 38, 0.5)'
      ctx.lineWidth = 20
    }
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    ctx.restore()
  }

  function saveCanvas() {
    const canvas = canvasRef.current
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
    // Check only alpha channel (index 3, 7, 11...) — destination-out leaves RGB non-zero
    const hasContent = data.some((v, i) => i % 4 === 3 && v > 0)
    onChange(hasContent ? canvas.toDataURL('image/png') : null)
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    onChange(null)
  }

  function onDown(e) {
    if (disabled) return
    syncCanvasSize()
    drawing.current = true
    lastPos.current = getPos(e)
  }
  function onMove(e) {
    if (!drawing.current || disabled) return
    const pos = getPos(e)
    applyStroke(lastPos.current, pos, tool)
    lastPos.current = pos
  }
  function onUp() {
    if (!drawing.current) return
    drawing.current = false
    saveCanvas()
  }

  const cursor = disabled ? 'default' : tool === 'eraser' ? 'cell' : 'crosshair'

  return (
    <div>
      {/* Toolbar */}
      {!disabled && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <button type="button"
            className={`btn btn-sm ${tool === 'brush' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setTool('brush')}>
            🖊️ Pincel
          </button>
          <button type="button"
            className={`btn btn-sm ${tool === 'eraser' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setTool('eraser')}>
            🧹 Borracha
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearCanvas}>
            🗑️ Limpar
          </button>
        </div>
      )}

      {/* Map container */}
      <div style={{ position: 'relative', userSelect: 'none', display: 'inline-block', maxWidth: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <img
          ref={imgRef}
          src={corpImg}
          alt="Mapa corporal"
          draggable={false}
          onLoad={() => {
            const canvas = canvasRef.current
            const imgEl = imgRef.current
            if (!canvas || !imgEl) return
            // Set canvas logical dimensions to match natural image size
            canvas.width = imgEl.naturalWidth
            canvas.height = imgEl.naturalHeight
            // Reload saved drawing after resize
            if (value) {
              const img = new Image()
              img.onload = () => {
                const ctx = canvas.getContext('2d')
                ctx.clearRect(0, 0, canvas.width, canvas.height)
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
              }
              img.src = value
            }
          }}
          style={{ display: 'block', width: '100%', maxWidth: 600, pointerEvents: 'none' }}
        />
        <canvas
          ref={canvasRef}
          width={800} height={600}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            cursor,
            touchAction: 'none',
          }}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          onTouchStart={e => { e.preventDefault(); onDown(e) }}
          onTouchMove={e => { e.preventDefault(); onMove(e) }}
          onTouchEnd={onUp}
        />
      </div>
    </div>
  )
}

export default function ProntuarioPage({ navParams = {} }) {
  const { user, hasRole } = useAuth()
  const vets = getVeterinarios()
  const [prontuarios, setProntuarios] = usePersistentState('petvet-prontuarios', PRONTUARIOS)
  const [prontuarioConfig, setProntuarioConfig] = usePersistentState('petvet-prontuario-config', DEFAULT_PRONTUARIO_CONFIG)
  const [agendamentos, setAgendamentos] = usePersistentState('petvet-agendamentos', AGENDAMENTOS)
  const [view, setView] = useState('list')
  const [selectedPr, setSelectedPr] = useState(null)
  const [activeSection, setActiveSection] = useState('tipo')
  const [form, setForm] = useState(EMPTY_FORM)
  const [searchQuery, setSearchQuery] = useState('')
  const [signatureData, setSignatureData] = useState(null)
  const [filterPetId, setFilterPetId] = useState(navParams.petId ?? null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [newTipoInput, setNewTipoInput] = useState('')
  const [sortField, setSortField] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [bulario] = usePersistentState('petvet-bulario', [])
  const [prescBulaMed, setPrescBulaMed] = useState(null)
  const [termoRequest, setTermoRequest] = useState(null)
  const [tabAnterior, setTabAnterior] = useState(null)
  const [showFichasModal, setShowFichasModal] = useState(false)
  const [fichasTab, setFichasTab] = useState('imprimir')
  const [fichasWa, setFichasWa] = useState({ petId: '', tipo: null, msg: '' })
  const [fichasWaSearch, setFichasWaSearch] = useState('')
  const [petsLS, setPetsLS] = usePersistentState('petvet-pets', PETS)
  const [tutoresLS, setTutoresLS] = usePersistentState('petvet-tutores', TUTORES)

  const [showExportModal, setShowExportModal] = useState(false)
  const [exportConfirmed, setExportConfirmed] = useState(false)
  const [exportFiltro, setExportFiltro] = useState({ tipo: 'todos', de: '', ate: '', petId: '', vetId: '' })
  const [exportSuccess, setExportSuccess] = useState(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importData, setImportData] = useState(null)
  const [importMode, setImportMode] = useState('novos')
  const [importSuccess, setImportSuccess] = useState(null)
  const importFileRef = useRef(null)

  // Migrate stored config: ensure all DEFAULT tipos exist (e.g. 'Cirurgia' added later)
  useEffect(() => {
    const missingTipos = TIPOS_CONSULTA_DEFAULT.filter(t => !prontuarioConfig.tipos.includes(t))
    if (missingTipos.length > 0) {
      const novosTipos = [...prontuarioConfig.tipos, ...missingTipos]
      const novoSectionConfig = { ...prontuarioConfig.sectionConfig }
      for (const t of missingTipos) {
        novoSectionConfig[t] = Object.fromEntries(SECTIONS_CONFIGURABLES.map(s => [s.id, { visible: true }]))
      }
      setProntuarioConfig({ tipos: novosTipos, sectionConfig: novoSectionConfig })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Visible sections based on selected type and config
  const visibleSections = useMemo(() => {
    return ALL_SECTIONS.filter(s => {
      if (s.id === 'tipo') return true
      if (s.id === 'cirurgia') return form.tipoConsulta === 'Cirurgia'
      const typeConf = prontuarioConfig?.sectionConfig?.[form.tipoConsulta]
      if (!typeConf) return true
      return typeConf[s.id]?.visible !== false
    })
  }, [prontuarioConfig, form.tipoConsulta])

  // Keep activeSection valid when visibleSections changes
  useEffect(() => {
    if (!visibleSections.find(s => s.id === activeSection)) {
      setActiveSection(visibleSections[0]?.id ?? 'tipo')
    }
  }, [visibleSections, activeSection])

  const openViewFn = useCallback((pr) => {
    setSelectedPr(pr)
    setForm({ ...EMPTY_FORM, ...pr, vitals: { ...EMPTY_FORM.vitals, ...(pr.vitals ?? {}) }, anamnese: { ...EMPTY_FORM.anamnese, ...(pr.anamnese ?? {}) }, derma: { ...EMPTY_FORM.derma, ...(pr.derma ?? {}) }, cannabis: { ...EMPTY_FORM.cannabis, ...(pr.cannabis ?? {}) }, solicitacaoExames: pr.solicitacaoExames ?? {}, anexos: pr.anexos ?? [] })
    setSignatureData(pr.assinatura)
    setActiveSection('tipo')
    setView('form')
  }, [])

  useEffect(() => {
    if (navParams.prontuarioId) {
      const pr = PRONTUARIOS.find(p => p.id === navParams.prontuarioId)
      if (pr) openViewFn(pr)
    } else if (navParams.petId) {
      setFilterPetId(navParams.petId)
    }
  }, [navParams.prontuarioId, navParams.petId, openViewFn])

  const filterPet = filterPetId ? getPetById(filterPetId) : null

  const filtered = prontuarios.filter(pr => {
    if (filterPetId && pr.petId !== filterPetId) return false
    if (!searchQuery) return true
    const pet = getPetById(pr.petId)
    const vet = findVetById(pr.vetId)
    return (
      normIncludes(pet?.name, searchQuery) ||
      normIncludes(vet?.name, searchQuery) ||
      normIncludes(pr.diagnostico?.definitivo, searchQuery) ||
      normIncludes(pr.diagnostico?.presuntivo, searchQuery) ||
      pr.date?.includes(searchQuery)
    )
  })

  function handleSort(field) {
    if (field === sortField) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const sortedFiltered = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    if (sortField === 'date') return dir * (new Date(a.date) - new Date(b.date))
    if (sortField === 'pet') return dir * (getPetById(a.petId)?.name ?? '').localeCompare(getPetById(b.petId)?.name ?? '', 'pt-BR')
    if (sortField === 'vet') return dir * (findVetById(a.vetId)?.name ?? '').localeCompare(findVetById(b.vetId)?.name ?? '', 'pt-BR')
    if (sortField === 'tipo') return dir * (a.tipoConsulta ?? 'Consulta').localeCompare(b.tipoConsulta ?? 'Consulta', 'pt-BR')
    return 0
  })

  function openNew() {
    setSelectedPr(null)
    const base = { ...EMPTY_FORM, date: todayISO(), status: 'aguardando' }
    setForm(filterPetId ? { ...base, petId: filterPetId } : base)
    setSignatureData(null)
    setActiveSection('tipo')
    setView('form')
  }

  function saveProntuario() {
    const data = { ...form, assinatura: signatureData }
    if (selectedPr) {
      setProntuarios(prev => prev.map(p => p.id === selectedPr.id ? { ...data, id: selectedPr.id } : p))
    } else {
      setProntuarios(prev => [...prev, { ...data, id: `pr${Date.now()}` }])
    }
    if (form.petId && form.date) {
      setAgendamentos(prev => prev.map(a =>
        a.petId === form.petId && a.date === form.date ? { ...a, status: form.status } : a
      ))
    }
    setView('list')
  }

  function handlePrintProntuario() {
    const petInfo  = PETS.find(p => p.id === form.petId) ?? null
    const tutorInfo = petInfo ? TUTORES.find(t => t.id === petInfo.tutorId) ?? null : null
    const vetInfo  = findVetById(form.vetId)
    const { htmlContent } = generateProntuarioPrint({
      form: { ...form, id: selectedPr?.id },
      petInfo,
      tutorInfo,
      vetInfo,
      signatureData,
      examGroups: EXAM_GROUPS,
    })
    const win = window.open('', '_blank', 'width=850,height=800')
    if (!win) return
    win.document.write(htmlContent)
    win.document.close()
    // Save copy to Anexos
    const dateStr = form.date ? new Date(form.date + 'T00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')
    const anexoNome = `Prontuário Completo — ${dateStr}`
    if (!form.anexos?.find(a => a.nome === anexoNome)) {
      setForm(f => ({
        ...f,
        anexos: [
          ...(f.anexos ?? []),
          { nome: anexoNome, tipo: 'prontuario', conteudoHtml: htmlContent, dataAdicionado: new Date().toISOString() },
        ],
      }))
    }
  }

  function handleOpenFicha(tipo) {
    setShowFichasModal(false)
    const html = generateFichaHTML(tipo, { corpImgSrc: corpImg })
    const win = window.open('', '_blank', 'width=850,height=800')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
  }

  function generateFichaTexto(tipo, tutorNome, petNome, dataConsulta) {
    const _ = '___________'
    const yn = `( ) Sim  ( ) Não`
    const clinicaNome = (() => { try { const c = JSON.parse(localStorage.getItem('petvet-clinica-config') ?? '{}'); return c.nome || 'Emporium Vazpet & Tatá Bichos' } catch { return 'Emporium Vazpet & Tatá Bichos' } })()
    const dataFmt = dataConsulta ? new Date(dataConsulta + 'T00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')
    const header = `Olá, ${tutorNome || 'tutor(a)'}! 🐾\nAntes da consulta de *${petNome || 'seu pet'}* em ${dataFmt}, pedimos que preencha a ficha abaixo e responda esta mensagem com as informações:\n`

    if (tipo === 'anamnese') {
      return header + `\n📋 *FICHA DE ANAMNESE*\n\n` +
        `1. Queixa principal: ${_}\n` +
        `2. Tempo de evolução: ${_}\n` +
        `3. Vômito: ${yn} — Frequência: ${_}\n` +
        `4. Diarreia: ${yn} — Frequência: ${_}\n` +
        `5. Apetite: ( ) Normal  ( ) Aumentado  ( ) Diminuído  ( ) Ausente\n` +
        `6. Sede: ( ) Normal  ( ) Aumentada  ( ) Diminuída\n` +
        `7. Esforço urinário: ${yn}\n` +
        `8. Tosse ou espirro: ${yn}\n` +
        `9. Secreção nasal/ocular: ${yn} — Tipo: ${_}\n` +
        `10. Convulsão: ${yn}\n` +
        `11. Medicamentos em uso: ${_}\n` +
        `12. Vacinação em dia: ${yn}\n` +
        `13. Vermifugação (produto e data): ${_}\n` +
        `14. Histórico cirúrgico: ${_}\n` +
        `15. Ambiente: ( ) Interno  ( ) Externo  ( ) Misto\n` +
        `16. Contato com outros animais: ${yn}\n\n` +
        `Obrigado! ${clinicaNome} 🐾`
    }

    if (tipo === 'derma') {
      return header + `\n🔬 *FICHA DERMATOLÓGICA*\n\n` +
        `1. Queixa principal: ${_}\n` +
        `2. Tempo de evolução: ${_}\n` +
        `3. Já tratou anteriormente: ${yn} — Com quê: ${_}\n` +
        `4. Prurido (coceira): ${yn} — Intensidade (0-10): ${_}\n` +
        `5. Lambedura: ${yn} — Local: ${_}\n` +
        `6. Auto-trauma (arranhar/esfregar): ${yn}\n` +
        `7. Lesões em: ( ) Corpo  ( ) Cabeça  ( ) Patas  ( ) Orelhas  ( ) Outros: ${_}\n` +
        `8. Ambiente: ( ) Interno  ( ) Externo  ( ) Misto\n` +
        `9. Alimentação: ( ) Ração  ( ) Natural  ( ) Mista — Marca: ${_}\n` +
        `10. Contato com produtos químicos: ${yn} — Quais: ${_}\n` +
        `11. Pulgas/carrapatos visíveis: ${yn}\n` +
        `12. Piorou com: ( ) Calor  ( ) Frio  ( ) Chuva  ( ) Sem relação\n\n` +
        `Obrigado! ${clinicaNome} 🐾`
    }

    if (tipo === 'cannabis') {
      return header + `\n🌿 *FICHA CANÁBICA*\n\n` +
        `1. Condição/diagnóstico principal: ${_}\n` +
        `2. Comorbidades (outras condições): ${_}\n` +
        `3. Medicamentos em uso atualmente: ${_}\n` +
        `4. Tentativas de tratamento anteriores: ${_}\n` +
        `5. Qualidade de vida atual (0-10): ${_}\n` +
        `6. Nível de dor (0-10): ${_}\n` +
        `7. Apetite: ( ) Normal  ( ) Aumentado  ( ) Diminuído\n` +
        `8. Sono: ( ) Normal  ( ) Agitado  ( ) Letárgico\n` +
        `9. Nível de atividade: ( ) Normal  ( ) Aumentado  ( ) Diminuído\n` +
        `10. Episódios de agressividade: ${yn}\n` +
        `11. Convulsões: ${yn} — Frequência: ${_}\n` +
        `12. Tutor concorda com uso de cannabis medicinal: ${yn}\n\n` +
        `Obrigado! ${clinicaNome} 🐾`
    }
    return ''
  }

  function handleGenerateFichaWa(tipo) {
    const allPets = Array.isArray(petsLS) ? petsLS : PETS
    const allTutores = Array.isArray(tutoresLS) ? tutoresLS : TUTORES
    const pet = allPets.find(p => p.id === fichasWa.petId)
    const tutor = pet ? allTutores.find(t => t.id === pet.tutorId) : null
    const msg = generateFichaTexto(tipo, tutor?.name, pet?.name, new Date().toISOString().split('T')[0])
    setFichasWa(s => ({ ...s, tipo, msg }))
  }

  function handleSendFichaWa() {
    const allPets = Array.isArray(petsLS) ? petsLS : PETS
    const allTutores = Array.isArray(tutoresLS) ? tutoresLS : TUTORES
    const pet = allPets.find(p => p.id === fichasWa.petId)
    const tutor = pet ? allTutores.find(t => t.id === pet.tutorId) : null
    const digits = (tutor?.phone ?? '').replace(/\D/g, '')
    const phone = digits.startsWith('55') && digits.length >= 12 ? digits : '55' + digits
    if (!phone || phone.length < 12) { alert('Número de telefone do tutor não encontrado ou inválido.'); return }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(fichasWa.msg)}`, '_blank')
  }

  function addTipo() {
    const t = newTipoInput.trim()
    if (!t || prontuarioConfig.tipos.includes(t)) return
    const novosTipos = [...prontuarioConfig.tipos, t]
    const novoSectionConfig = {
      ...prontuarioConfig.sectionConfig,
      [t]: Object.fromEntries(SECTIONS_CONFIGURABLES.map(s => [s.id, { visible: true }])),
    }
    setProntuarioConfig({ tipos: novosTipos, sectionConfig: novoSectionConfig })
    setForm(f => ({ ...f, tipoConsulta: t }))
    setNewTipoInput('')
  }

  function updateVitals(key, value)    { setForm(f => ({ ...f, vitals: { ...f.vitals, [key]: value } })) }
  function updateAnamnese(key, value)  { setForm(f => ({ ...f, anamnese: { ...f.anamnese, [key]: value } })) }
  function updateExame(sistema, key, value) { setForm(f => ({ ...f, examesFisicos: { ...f.examesFisicos, [sistema]: { ...f.examesFisicos[sistema], [key]: value } } })) }
  function updateDiag(key, value)      { setForm(f => ({ ...f, diagnostico: { ...f.diagnostico, [key]: value } })) }
  function updatePrescricao(key, value){ setForm(f => ({ ...f, prescricao: { ...f.prescricao, [key]: value } })) }
  function updateSolicitacao(key, value) { setForm(f => ({ ...f, solicitacaoExames: { ...f.solicitacaoExames, [key]: value } })) }
  function addMedicamento()            { setForm(f => ({ ...f, prescricao: { ...f.prescricao, medicamentos: [...f.prescricao.medicamentos, { nome: '', dose: '', via: '', frequencia: '', duracao: '', obs: '' }] } })) }
  function updateMed(idx, key, value)  { setForm(f => { const meds = [...f.prescricao.medicamentos]; meds[idx] = { ...meds[idx], [key]: value }; return { ...f, prescricao: { ...f.prescricao, medicamentos: meds } } }) }
  function removeMed(idx)              { setForm(f => ({ ...f, prescricao: { ...f.prescricao, medicamentos: f.prescricao.medicamentos.filter((_, i) => i !== idx) } })) }
  function findBulaForPresc(nome)      { return bulario.find(m => norm(m.nomeComercial) === norm(nome) || normIncludes(m.nomeComercial, nome)) ?? null }

  const isReadOnly = selectedPr && !hasRole('admin', 'veterinario')
  const sectionIdx = visibleSections.findIndex(s => s.id === activeSection)
  const especie = form.vitals?.especie ?? 'Cão'

  if (view === 'form') {
    const petInfo = PETS.find(p => p.id === form.petId)
    const tutorInfo = petInfo ? TUTORES.find(t => t.id === petInfo.tutorId) : null

    return (
      <div className="page" id="prontuario-print-area">
        <div className="page-header no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setView('list')}>← Voltar</button>
            <div>
              <h2 className="page-title">{selectedPr ? 'Prontuário' : 'Novo Prontuário'}</h2>
              {petInfo && <p className="page-subtitle">{petInfo.name} · {tutorInfo?.name}</p>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {selectedPr && (
              <button className="btn btn-outline btn-sm" onClick={handlePrintProntuario}>
                <Printer size={14} /> Imprimir Prontuário
              </button>
            )}
            {!isReadOnly && <button className="btn btn-primary" onClick={saveProntuario}>Salvar Prontuário</button>}
          </div>
        </div>

        {/* Print header (only visible when printing) */}
        <div className="print-only" style={{ display: 'none', marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Prontuário Veterinário — PetVet</h2>
          {petInfo && <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: '#555' }}>
            Pet: {petInfo.name} &nbsp;|&nbsp; Tutor: {tutorInfo?.name} &nbsp;|&nbsp; Data: {new Date(form.date + 'T00:00').toLocaleDateString('pt-BR')}
          </p>}
        </div>

        {/* Dados básicos */}
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 20px' }}>
            <div className="form-group">
              <label className="form-label">Pet *</label>
              {(() => {
                const todayApts = agendamentos.filter(a => a.date === form.date).filter((a, i, arr) => arr.findIndex(x => x.petId === a.petId) === i)
                const TYPE_LABEL = { consulta: 'Consulta', retorno: 'Retorno', cirurgia: 'Cirurgia', vacina: 'Vacina', banho: 'Banho & Tosa', outros: 'Outros' }
                return (
                  <select className="form-select" value={form.petId} onChange={e => setForm(f => ({ ...f, petId: e.target.value }))}>
                    <option value="">Selecione o pet</option>
                    {todayApts.length > 0 && (
                      <optgroup label={`Agendados em ${new Date(form.date + 'T00:00').toLocaleDateString('pt-BR')}`}>
                        {todayApts.map(a => { const p = PETS.find(pt => pt.id === a.petId); return p ? <option key={`t-${a.id}`} value={p.id}>{p.name} — {a.time} ({TYPE_LABEL[a.type] ?? a.type})</option> : null })}
                      </optgroup>
                    )}
                    <optgroup label="Todos os pets">
                      {PETS.map(p => <option key={p.id} value={p.id}>{p.name} ({TUTORES.find(t => t.id === p.tutorId)?.name})</option>)}
                    </optgroup>
                  </select>
                )
              })()}
            </div>
            <div className="form-group">
              <label className="form-label">Veterinário *</label>
              <select className="form-select" value={form.vetId} onChange={e => setForm(f => ({ ...f, vetId: e.target.value }))}>
                <option value="">Selecione</option>
                {vets.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Data</label>
              <input type="date" className="form-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} disabled={!!selectedPr} />
            </div>
          </div>
        </div>

        {/* Status do atendimento */}
        {!isReadOnly && (
          <div className="card no-print" style={{ padding: '12px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: 4 }}>Status:</span>
              {Object.entries(STATUS_LABEL).map(([key, label]) => (
                <button key={key} onClick={() => setForm(f => ({ ...f, status: key }))}
                  style={{
                    padding: '5px 14px', borderRadius: 20, fontSize: '0.8125rem', fontWeight: 600, border: '2px solid',
                    cursor: 'pointer', transition: 'all 150ms',
                    borderColor: STATUS_COLOR[key],
                    background: form.status === key ? STATUS_COLOR[key] : 'transparent',
                    color: form.status === key ? '#fff' : STATUS_COLOR[key],
                  }}>{label}</button>
              ))}
            </div>
          </div>
        )}
        {isReadOnly && form.status && (
          <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Status:</span>
            <span style={{ padding: '4px 14px', borderRadius: 20, fontSize: '0.8125rem', fontWeight: 700, background: STATUS_COLOR[form.status] ?? '#888', color: '#fff' }}>
              {STATUS_LABEL[form.status] ?? form.status}
            </span>
          </div>
        )}

        {/* Seções */}
        <div className="card prontuario-form-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0 22px' }} className="no-print">
            <Tabs tabs={visibleSections} active={activeSection} onChange={setActiveSection} />
          </div>
          <div style={{ padding: '22px' }}>

            {/* TIPO */}
            {activeSection === 'tipo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 4 }}>Selecione o tipo de consulta para este atendimento</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
                  {prontuarioConfig.tipos.map(tipo => (
                    <label key={tipo} style={{
                      padding: '14px 16px', borderRadius: 10, cursor: isReadOnly ? 'default' : 'pointer',
                      border: `2px solid ${form.tipoConsulta === tipo ? 'var(--teal)' : 'var(--border)'}`,
                      background: form.tipoConsulta === tipo ? 'var(--teal-light)' : 'var(--surface-2)',
                      display: 'flex', alignItems: 'center', gap: 10, transition: 'all 150ms',
                    }}>
                      <input type="radio" name="tipoConsulta" value={tipo} checked={form.tipoConsulta === tipo}
                        onChange={() => !isReadOnly && setForm(f => ({ ...f, tipoConsulta: tipo }))}
                        style={{ accentColor: 'var(--teal)', width: 16, height: 16 }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: form.tipoConsulta === tipo ? 700 : 500, color: form.tipoConsulta === tipo ? 'var(--teal-dark)' : 'var(--text-primary)', lineHeight: 1.3 }}>{tipo}</span>
                    </label>
                  ))}
                </div>
                {hasRole('admin') && !isReadOnly && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 400, marginTop: 4 }}>
                    <input className="form-input" placeholder="Novo tipo de consulta..." value={newTipoInput} onChange={e => setNewTipoInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addTipo()} />
                    <button className="btn btn-outline btn-sm" onClick={addTipo} disabled={!newTipoInput.trim()}>
                      <Plus size={14} /> Adicionar
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* PROCEDIMENTOS CIRÚRGICOS */}
            {activeSection === 'cirurgia' && (
              <CirurgiaSection
                procedimentos={form.procedimentos ?? []}
                mesmoVet={form.cirurgiaMesmoVet ?? false}
                vetUnicoId={form.cirurgiaVetUnicoId ?? ''}
                vets={vets}
                isReadOnly={isReadOnly}
                onChange={arr => setForm(f => ({
                  ...f,
                  procedimentos: arr,
                  precoTotalCirurgia: arr.reduce((s, p) => s + (Number(p.preco) || 0), 0),
                }))}
                onMesmoVetChange={v => setForm(f => ({ ...f, cirurgiaMesmoVet: v }))}
                onVetUnicoChange={(vetId, vetNome) => setForm(f => ({
                  ...f,
                  cirurgiaVetUnicoId: vetId,
                  procedimentos: f.procedimentos.map(p => ({ ...p, vetId, vetNome })),
                }))}
              />
            )}

            {/* ANAMNESE */}
            {activeSection === 'anamnese' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Queixa principal / Tempo de evolução *</label>
                  <input className="form-input" value={form.anamnese.queixa} onChange={e => updateAnamnese('queixa', e.target.value)} disabled={isReadOnly} placeholder="Motivo da consulta e tempo de evolução" />
                </div>
                <div className="form-group">
                  <label className="form-label">Histórico</label>
                  <textarea className="form-textarea" value={form.anamnese.historiaAtual} onChange={e => updateAnamnese('historiaAtual', e.target.value)} disabled={isReadOnly}
                    placeholder="Descreva o histórico clínico, início, evolução..." style={{ resize: 'none', overflowY: 'auto', maxHeight: 140, minHeight: 80 }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cirurgias anteriores</label>
                  <textarea className="form-textarea" value={form.anamnese.historicoPrevio} onChange={e => updateAnamnese('historicoPrevio', e.target.value)} disabled={isReadOnly}
                    placeholder="Cirurgias, doenças anteriores, medicamentos contínuos..." style={{ resize: 'none', overflowY: 'auto', maxHeight: 120, minHeight: 64 }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 20px' }}>
                  <SelectField label="Status vacinal" value={form.anamnese.statusVacinal} onChange={v => updateAnamnese('statusVacinal', v)} ro={isReadOnly} options={['Em dia', 'Atrasada', 'Desconhecida']} />
                  <SelectField label="Acesso à rua" value={form.anamnese.acesRua} onChange={v => updateAnamnese('acesRua', v)} ro={isReadOnly} options={['Sim', 'Não', 'Restrito']} />
                  <SelectField label="Contato com outros animais" value={form.anamnese.contatoAnimais} onChange={v => updateAnamnese('contatoAnimais', v)} ro={isReadOnly} options={['Sim', 'Não', 'Eventualmente']} />
                  {(form.anamnese.contatoAnimais === 'Sim' || form.anamnese.contatoAnimais === 'Eventualmente') && (
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Descreva o contato</label>
                      <textarea className="form-textarea" value={form.anamnese.contatoAnimaisDesc ?? ''} onChange={e => updateAnamnese('contatoAnimaisDesc', e.target.value)} disabled={isReadOnly}
                        placeholder="Espécies, frequência, ambiente compartilhado..." style={{ resize: 'none', overflowY: 'auto', maxHeight: 100, minHeight: 54 }} />
                    </div>
                  )}

                  {/* Vômito */}
                  <SelectField label="Vômito" value={form.anamnese.vomito ?? 'Não'} onChange={v => updateAnamnese('vomito', v)} ro={isReadOnly} options={['Não', 'Sim']} />
                  {form.anamnese.vomito === 'Sim' && (
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Descrição do vômito</label>
                      <textarea className="form-textarea" value={form.anamnese.vomitoDesc ?? ''} onChange={e => updateAnamnese('vomitoDesc', e.target.value)} disabled={isReadOnly}
                        placeholder="Frequência, aspecto, quantidade..." style={{ resize: 'none', overflowY: 'auto', maxHeight: 100, minHeight: 54 }} />
                    </div>
                  )}

                  {/* Diarreia */}
                  <SelectField label="Diarreia" value={form.anamnese.diarreia ?? 'Não'} onChange={v => updateAnamnese('diarreia', v)} ro={isReadOnly} options={['Não', 'Sim']} />
                  {form.anamnese.diarreia === 'Sim' && (
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Descrição da diarreia</label>
                      <textarea className="form-textarea" value={form.anamnese.diarreiaDesc ?? ''} onChange={e => updateAnamnese('diarreiaDesc', e.target.value)} disabled={isReadOnly}
                        placeholder="Frequência, consistência, presença de sangue..." style={{ resize: 'none', overflowY: 'auto', maxHeight: 100, minHeight: 54 }} />
                    </div>
                  )}

                  {/* Alimentação */}
                  <div className="form-group">
                    <label className="form-label">Alimentação</label>
                    <select className="form-select" value={form.anamnese.alimentacao} onChange={e => updateAnamnese('alimentacao', e.target.value)} disabled={isReadOnly}>
                      {['Ração', 'Ração seca + sachê', 'Ração + AN', 'Ração + Petisco', 'Natural/Caseira', 'Outro'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Observações sobre alimentação</label>
                    <input className="form-input" value={form.anamnese.alimentacaoOutro ?? ''} onChange={e => updateAnamnese('alimentacaoOutro', e.target.value)} disabled={isReadOnly} placeholder="Marcas, suplementos, frequência..." />
                  </div>

                  {/* Antipulgas */}
                  <SelectField label="Uso de antipulgas" value={form.anamnese.antipulgas ?? 'Não'} onChange={v => updateAnamnese('antipulgas', v)} ro={isReadOnly} options={['Não', 'Sim']} />
                  {form.anamnese.antipulgas === 'Sim' && (
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Produto antipulgas</label>
                      <input className="form-input" value={form.anamnese.antipulgasProduto ?? ''} onChange={e => updateAnamnese('antipulgasProduto', e.target.value)} disabled={isReadOnly} placeholder="Nome do produto, frequência de uso..." />
                    </div>
                  )}

                  {/* Medicamentos prévios */}
                  <SelectField label="Medicamentos prévios" value={form.anamnese.medicamentosPrevios ?? 'Não'} onChange={v => updateAnamnese('medicamentosPrevios', v)} ro={isReadOnly} options={['Não', 'Sim']} />
                  {form.anamnese.medicamentosPrevios === 'Sim' && (
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Quais medicamentos?</label>
                      <textarea className="form-textarea" value={form.anamnese.medicamentosPreviosDesc ?? ''} onChange={e => updateAnamnese('medicamentosPreviosDesc', e.target.value)} disabled={isReadOnly}
                        placeholder="Nome, dose, frequência..." style={{ resize: 'none', overflowY: 'auto', maxHeight: 100, minHeight: 54 }} />
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* DERMA */}
            {activeSection === 'derma' && (() => {
              const dUpd = (k, v) => setForm(f => ({ ...f, derma: { ...(f.derma ?? {}), [k]: v } }))
              const dVal = k => form.derma?.[k] ?? EMPTY_FORM.derma[k]
              const dArr = k => { const v = form.derma?.[k] ?? []; return Array.isArray(v) ? v : [] }
              const taStyle = { resize: 'none', overflowY: 'auto', maxHeight: 120, minHeight: 64, whiteSpace: 'pre-wrap' }
              const sectionTitle = t => (
                <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', borderBottom: '2px solid var(--teal)', paddingBottom: 6, marginBottom: 2 }}>{t}</p>
              )
              const checkGroup = (label, key, opts) => (
                <div>
                  <p className="form-label" style={{ marginBottom: 6 }}>{label}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {opts.map(o => {
                      const sel = dArr(key).includes(o)
                      return (
                        <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', cursor: isReadOnly ? 'default' : 'pointer', padding: '4px 10px', borderRadius: 6, background: sel ? 'var(--teal-light)' : 'var(--surface-2)', border: `1px solid ${sel ? 'var(--teal)' : 'var(--border)'}` }}>
                          <input type="checkbox" checked={sel} disabled={isReadOnly}
                            onChange={() => !isReadOnly && dUpd(key, sel ? dArr(key).filter(x => x !== o) : [...dArr(key), o])}
                            style={{ accentColor: 'var(--teal)', width: 14, height: 14 }} />
                          <span style={{ fontWeight: sel ? 600 : 400 }}>{o}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
              const radioGroup = (label, key, opts) => (
                <div>
                  <p className="form-label" style={{ marginBottom: 6 }}>{label}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {opts.map(o => {
                      const sel = dVal(key) === o
                      return (
                        <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', cursor: isReadOnly ? 'default' : 'pointer', padding: '4px 10px', borderRadius: 6, background: sel ? 'var(--teal-light)' : 'var(--surface-2)', border: `1px solid ${sel ? 'var(--teal)' : 'var(--border)'}` }}>
                          <input type="radio" checked={sel} disabled={isReadOnly}
                            onChange={() => !isReadOnly && dUpd(key, o)}
                            style={{ accentColor: 'var(--teal)', width: 14, height: 14 }} />
                          <span style={{ fontWeight: sel ? 600 : 400 }}>{o}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

                  {/* SEÇÃO 1 — Anamnese Dermatológica */}
                  {sectionTitle('Seção 1 — Anamnese Dermatológica')}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 20px' }}>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Queixa principal / Tempo de evolução *</label>
                      <textarea className="form-textarea" value={dVal('queixa')} onChange={e => dUpd('queixa', e.target.value)} disabled={isReadOnly} placeholder="Motivo da consulta e tempo de evolução" style={taStyle} />
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Sazonalidade</label>
                      <textarea className="form-textarea" value={dVal('sazonalidade')} onChange={e => dUpd('sazonalidade', e.target.value)} disabled={isReadOnly} placeholder="Piora em alguma época do ano?" style={taStyle} />
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Tratamentos anteriores</label>
                      <textarea className="form-textarea" value={dVal('tratamentosAnteriores')} onChange={e => dUpd('tratamentosAnteriores', e.target.value)} disabled={isReadOnly} placeholder="Medicamentos, shampoos, dietas exclusão..." style={taStyle} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Houve melhora nos tratamentos anteriores?</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {['Sim', 'Não'].map(o => { const sel = dVal('melhoraTratamentos') === o; return (
                          <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', cursor: isReadOnly ? 'default' : 'pointer', padding: '4px 12px', borderRadius: 6, background: sel ? 'var(--teal-light)' : 'var(--surface-2)', border: `1px solid ${sel ? 'var(--teal)' : 'var(--border)'}` }}>
                            <input type="radio" checked={sel} disabled={isReadOnly} onChange={() => !isReadOnly && dUpd('melhoraTratamentos', o)} style={{ accentColor: 'var(--teal)', width: 14, height: 14 }} />
                            <span style={{ fontWeight: sel ? 600 : 400 }}>{o}</span>
                          </label>
                        )})}
                      </div>
                    </div>
                    {dVal('melhoraTratamentos') === 'Sim' && (
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Qual tratamento melhorou?</label>
                        <textarea className="form-textarea" value={dVal('melhoraTratamentosDesc')} onChange={e => dUpd('melhoraTratamentosDesc', e.target.value)} disabled={isReadOnly} style={taStyle} />
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">O animal possui outra doença diagnosticada?</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {['Sim', 'Não'].map(o => { const sel = dVal('outraDoenca') === o; return (
                          <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', cursor: isReadOnly ? 'default' : 'pointer', padding: '4px 12px', borderRadius: 6, background: sel ? 'var(--teal-light)' : 'var(--surface-2)', border: `1px solid ${sel ? 'var(--teal)' : 'var(--border)'}` }}>
                            <input type="radio" checked={sel} disabled={isReadOnly} onChange={() => !isReadOnly && dUpd('outraDoenca', o)} style={{ accentColor: 'var(--teal)', width: 14, height: 14 }} />
                            <span style={{ fontWeight: sel ? 600 : 400 }}>{o}</span>
                          </label>
                        )})}
                      </div>
                    </div>
                    {dVal('outraDoenca') === 'Sim' && (
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Qual doença?</label>
                        <textarea className="form-textarea" value={dVal('outraDoencaDesc')} onChange={e => dUpd('outraDoencaDesc', e.target.value)} disabled={isReadOnly} style={taStyle} />
                      </div>
                    )}

                    <SelectField label="Acesso à rua" value={dVal('acesRua')} onChange={v => dUpd('acesRua', v)} ro={isReadOnly} options={['Não', 'Sim', 'Restrito']} />
                    <SelectField label="Contato com outros animais" value={dVal('contatoAnimais')} onChange={v => dUpd('contatoAnimais', v)} ro={isReadOnly} options={['Não', 'Sim', 'Eventualmente']} />
                    {(dVal('contatoAnimais') === 'Sim' || dVal('contatoAnimais') === 'Eventualmente') && (
                      <div className="form-group">
                        <label className="form-label">Descreva o contato</label>
                        <textarea className="form-textarea" value={dVal('contatoAnimaisDesc')} onChange={e => dUpd('contatoAnimaisDesc', e.target.value)} disabled={isReadOnly} style={taStyle} />
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">Esses animais têm problemas de pele?</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {['Sim', 'Não'].map(o => { const sel = dVal('animaisComProblema') === o; return (
                          <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', cursor: isReadOnly ? 'default' : 'pointer', padding: '4px 12px', borderRadius: 6, background: sel ? 'var(--teal-light)' : 'var(--surface-2)', border: `1px solid ${sel ? 'var(--teal)' : 'var(--border)'}` }}>
                            <input type="radio" checked={sel} disabled={isReadOnly} onChange={() => !isReadOnly && dUpd('animaisComProblema', o)} style={{ accentColor: 'var(--teal)', width: 14, height: 14 }} />
                            <span style={{ fontWeight: sel ? 600 : 400 }}>{o}</span>
                          </label>
                        )})}
                      </div>
                    </div>
                    {dVal('animaisComProblema') === 'Sim' && (
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Descreva</label>
                        <textarea className="form-textarea" value={dVal('animaisComProblemaDesc')} onChange={e => dUpd('animaisComProblemaDesc', e.target.value)} disabled={isReadOnly} style={taStyle} />
                      </div>
                    )}

                    <SelectField label="Vômito" value={dVal('vomito')} onChange={v => dUpd('vomito', v)} ro={isReadOnly} options={['Não', 'Sim']} />
                    {dVal('vomito') === 'Sim' && (
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Descrição do vômito</label>
                        <textarea className="form-textarea" value={dVal('vomitoDesc')} onChange={e => dUpd('vomitoDesc', e.target.value)} disabled={isReadOnly} style={taStyle} />
                      </div>
                    )}

                    <SelectField label="Diarreia" value={dVal('diarreia')} onChange={v => dUpd('diarreia', v)} ro={isReadOnly} options={['Não', 'Sim']} />
                    {dVal('diarreia') === 'Sim' && (
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Descrição da diarreia</label>
                        <textarea className="form-textarea" value={dVal('diarreiaDesc')} onChange={e => dUpd('diarreiaDesc', e.target.value)} disabled={isReadOnly} style={taStyle} />
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">Alimentação</label>
                      <select className="form-select" value={dVal('alimentacao')} onChange={e => dUpd('alimentacao', e.target.value)} disabled={isReadOnly}>
                        {['Ração', 'Ração seca + sachê', 'Ração + AN', 'Ração + Petisco', 'Natural/Caseira', 'Outro'].map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Observações sobre alimentação</label>
                      <textarea className="form-textarea" value={dVal('alimentacaoDesc')} onChange={e => dUpd('alimentacaoDesc', e.target.value)} disabled={isReadOnly} placeholder="Marcas, frequência, suplementos..." style={taStyle} />
                    </div>

                    <SelectField label="Uso de antipulgas" value={dVal('antipulgas')} onChange={v => dUpd('antipulgas', v)} ro={isReadOnly} options={['Não', 'Sim']} />
                    {dVal('antipulgas') === 'Sim' && (
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Produto antipulgas</label>
                        <textarea className="form-textarea" value={dVal('antipulgasProduto')} onChange={e => dUpd('antipulgasProduto', e.target.value)} disabled={isReadOnly} style={taStyle} />
                      </div>
                    )}

                    <SelectField label="Medicamentos prévios" value={dVal('medicamentosPrevios')} onChange={v => dUpd('medicamentosPrevios', v)} ro={isReadOnly} options={['Não', 'Sim']} />
                    {dVal('medicamentosPrevios') === 'Sim' && (
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Quais medicamentos?</label>
                        <textarea className="form-textarea" value={dVal('medicamentosPreviosDesc')} onChange={e => dUpd('medicamentosPreviosDesc', e.target.value)} disabled={isReadOnly} style={taStyle} />
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">Algum humano na casa com problemas de pele/coceira?</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {['Sim', 'Não'].map(o => { const sel = dVal('humanoComProblema') === o; return (
                          <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', cursor: isReadOnly ? 'default' : 'pointer', padding: '4px 12px', borderRadius: 6, background: sel ? 'var(--teal-light)' : 'var(--surface-2)', border: `1px solid ${sel ? 'var(--teal)' : 'var(--border)'}` }}>
                            <input type="radio" checked={sel} disabled={isReadOnly} onChange={() => !isReadOnly && dUpd('humanoComProblema', o)} style={{ accentColor: 'var(--teal)', width: 14, height: 14 }} />
                            <span style={{ fontWeight: sel ? 600 : 400 }}>{o}</span>
                          </label>
                        )})}
                      </div>
                    </div>
                    {dVal('humanoComProblema') === 'Sim' && (
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Descreva</label>
                        <textarea className="form-textarea" value={dVal('humanoComProblemaDesc')} onChange={e => dUpd('humanoComProblemaDesc', e.target.value)} disabled={isReadOnly} style={taStyle} />
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">Frequência de banhos</label>
                      <select className="form-select" value={dVal('frequenciaBanhos')} onChange={e => dUpd('frequenciaBanhos', e.target.value)} disabled={isReadOnly}>
                        {['1x por semana', 'Quinzenal', 'Mensal', 'Outro'].map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Detalhar frequência de banhos</label>
                      <input className="form-input" value={dVal('frequenciaBanhosCustom')} onChange={e => dUpd('frequenciaBanhosCustom', e.target.value)} disabled={isReadOnly} placeholder="Ex: A cada 10 dias, no pet shop..." />
                    </div>

                    <div className="form-group" style={{ gridColumn: '1 / -1', maxWidth: 340 }}>
                      <label className="form-label">Intensidade do prurido — 0 (ausente) a 10 (intenso)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <input type="range" min="0" max="10" step="1"
                          value={dVal('pruridoIntensidade') || 0}
                          onChange={e => dUpd('pruridoIntensidade', e.target.value)}
                          disabled={isReadOnly} style={{ flex: 1, accentColor: 'var(--teal)' }} />
                        <span style={{ minWidth: 28, fontWeight: 700, color: 'var(--teal-dark)', fontSize: '1rem' }}>
                          {dVal('pruridoIntensidade') || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SEÇÃO 2 — Checkboxes */}
                  {sectionTitle('Seção 2 — Comportamento e Ambiente')}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {checkGroup('Como ele se coça', 'comoSeCoca', ['Lambedura', 'Mordedura', 'Esfrega-se nos móveis', 'Unhadas'])}
                    {checkGroup('O que apareceu primeiro', 'apareceuPrimeiro', ['Coceira', 'Lesões na pele'])}
                    {checkGroup('Tipo de habitação', 'habitacao', ['Casa com quintal', 'Apartamento', 'Sítio/Chácara', 'Piso/Laminado', 'Taco/Madeira'])}
                    {checkGroup('Contatos com', 'contatosCom', ['Grama', 'Plantas de jardim', 'Terra', 'Apenas piso frio/madeira', 'Praia', 'Campo'])}
                  </div>

                  {/* SEÇÃO 3 — Mapa corporal */}
                  {sectionTitle('Seção 3 — Mapa Corporal')}
                  <div>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 8 }}>Desenhe sobre o mapa as regiões afetadas (vermelho semi-transparente)</p>
                    <DermaCanvas
                      value={form.derma?.mapaCanvasData ?? null}
                      onChange={v => dUpd('mapaCanvasData', v)}
                      disabled={isReadOnly}
                    />
                  </div>

                  {/* SEÇÃO 4 — Tipos de lesão */}
                  {sectionTitle('Seção 4 — Tipos de Lesão')}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {LESAO_TYPES.map(lesao => {
                      const sel = dArr('tiposLesao').includes(lesao)
                      return (
                        <label key={lesao} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.8125rem', cursor: isReadOnly ? 'default' : 'pointer', padding: '5px 8px', borderRadius: 6, background: sel ? 'var(--teal-light)' : 'var(--surface-2)', border: `1px solid ${sel ? 'var(--teal)' : 'var(--border)'}`, transition: 'all 0.15s' }}>
                          <input type="checkbox" checked={sel} disabled={isReadOnly}
                            onChange={() => !isReadOnly && dUpd('tiposLesao', sel ? dArr('tiposLesao').filter(l => l !== lesao) : [...dArr('tiposLesao'), lesao])}
                            style={{ accentColor: 'var(--teal)', width: 14, height: 14, flexShrink: 0 }} />
                          <span style={{ fontWeight: sel ? 600 : 400, color: sel ? 'var(--teal-dark)' : 'var(--text-secondary)' }}>{lesao}</span>
                        </label>
                      )
                    })}
                  </div>

                  {/* SEÇÃO 5 — Exames complementares */}
                  {sectionTitle('Seção 5 — Exames Complementares Realizados')}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Raspado */}
                    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '8px 16px', alignItems: 'start' }}>
                      <div>
                        <p className="form-label" style={{ marginBottom: 6 }}>Raspado Cutâneo</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {['Negativo', 'Positivo'].map(o => { const sel = dVal('raspado') === o; return (
                            <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8125rem', cursor: isReadOnly ? 'default' : 'pointer', padding: '4px 10px', borderRadius: 6, background: sel ? 'var(--teal-light)' : 'var(--surface-2)', border: `1px solid ${sel ? 'var(--teal)' : 'var(--border)'}` }}>
                              <input type="radio" checked={sel} disabled={isReadOnly} onChange={() => !isReadOnly && dUpd('raspado', o)} style={{ accentColor: 'var(--teal)', width: 13, height: 13 }} />
                              <span style={{ fontWeight: sel ? 600 : 400 }}>{o}</span>
                            </label>
                          )})}
                        </div>
                      </div>
                      {dVal('raspado') === 'Positivo' && (
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Achado (Positivo)</label>
                          <textarea className="form-textarea" value={dVal('raspadoDesc')} onChange={e => dUpd('raspadoDesc', e.target.value)} disabled={isReadOnly} style={{ ...taStyle, minHeight: 48 }} />
                        </div>
                      )}
                    </div>
                    {/* Citologia */}
                    <div>
                      <p className="form-label" style={{ marginBottom: 6 }}>Citologia</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {['Bastonetes', 'Cocos', 'Malassezia', 'Outros'].map(o => {
                          const sel = dArr('citologia').includes(o)
                          return (
                            <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8125rem', cursor: isReadOnly ? 'default' : 'pointer', padding: '4px 10px', borderRadius: 6, background: sel ? 'var(--teal-light)' : 'var(--surface-2)', border: `1px solid ${sel ? 'var(--teal)' : 'var(--border)'}` }}>
                              <input type="checkbox" checked={sel} disabled={isReadOnly}
                                onChange={() => !isReadOnly && dUpd('citologia', sel ? dArr('citologia').filter(x => x !== o) : [...dArr('citologia'), o])}
                                style={{ accentColor: 'var(--teal)', width: 13, height: 13 }} />
                              <span style={{ fontWeight: sel ? 600 : 400 }}>{o}</span>
                            </label>
                          )
                        })}
                      </div>
                      {dArr('citologia').includes('Outros') && (
                        <div className="form-group" style={{ marginTop: 8 }}>
                          <label className="form-label">Outros (citologia)</label>
                          <textarea className="form-textarea" value={dVal('citologiaOutrosDesc')} onChange={e => dUpd('citologiaOutrosDesc', e.target.value)} disabled={isReadOnly} style={{ ...taStyle, minHeight: 48 }} />
                        </div>
                      )}
                    </div>
                    {/* Fita de acetato */}
                    <div>
                      <p className="form-label" style={{ marginBottom: 6 }}>Fita de Acetato</p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {['Negativo', 'Positivo'].map(o => { const sel = dVal('fitaAcetato') === o; return (
                          <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8125rem', cursor: isReadOnly ? 'default' : 'pointer', padding: '4px 10px', borderRadius: 6, background: sel ? 'var(--teal-light)' : 'var(--surface-2)', border: `1px solid ${sel ? 'var(--teal)' : 'var(--border)'}` }}>
                            <input type="radio" checked={sel} disabled={isReadOnly} onChange={() => !isReadOnly && dUpd('fitaAcetato', o)} style={{ accentColor: 'var(--teal)', width: 13, height: 13 }} />
                            <span style={{ fontWeight: sel ? 600 : 400 }}>{o}</span>
                          </label>
                        )})}
                      </div>
                    </div>
                    {/* Tricograma */}
                    <div>
                      <p className="form-label" style={{ marginBottom: 6 }}>Tricograma</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {['Anágena', 'Catágena', 'Telógena', 'Outros'].map(o => {
                          const sel = dArr('tricograma').includes(o)
                          return (
                            <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8125rem', cursor: isReadOnly ? 'default' : 'pointer', padding: '4px 10px', borderRadius: 6, background: sel ? 'var(--teal-light)' : 'var(--surface-2)', border: `1px solid ${sel ? 'var(--teal)' : 'var(--border)'}` }}>
                              <input type="checkbox" checked={sel} disabled={isReadOnly}
                                onChange={() => !isReadOnly && dUpd('tricograma', sel ? dArr('tricograma').filter(x => x !== o) : [...dArr('tricograma'), o])}
                                style={{ accentColor: 'var(--teal)', width: 13, height: 13 }} />
                              <span style={{ fontWeight: sel ? 600 : 400 }}>{o}</span>
                            </label>
                          )
                        })}
                      </div>
                      {dArr('tricograma').includes('Outros') && (
                        <div className="form-group" style={{ marginTop: 8 }}>
                          <label className="form-label">Outros (tricograma)</label>
                          <textarea className="form-textarea" value={dVal('tricogramaOutrosDesc')} onChange={e => dUpd('tricogramaOutrosDesc', e.target.value)} disabled={isReadOnly} style={{ ...taStyle, minHeight: 48 }} />
                        </div>
                      )}
                    </div>
                    {/* Lâmpada de Wood */}
                    <div>
                      <p className="form-label" style={{ marginBottom: 6 }}>Lâmpada de Wood</p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {['Negativo', 'Positivo'].map(o => { const sel = dVal('lampadaWood') === o; return (
                          <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8125rem', cursor: isReadOnly ? 'default' : 'pointer', padding: '4px 10px', borderRadius: 6, background: sel ? 'var(--teal-light)' : 'var(--surface-2)', border: `1px solid ${sel ? 'var(--teal)' : 'var(--border)'}` }}>
                            <input type="radio" checked={sel} disabled={isReadOnly} onChange={() => !isReadOnly && dUpd('lampadaWood', o)} style={{ accentColor: 'var(--teal)', width: 13, height: 13 }} />
                            <span style={{ fontWeight: sel ? 600 : 400 }}>{o}</span>
                          </label>
                        )})}
                      </div>
                    </div>
                    {/* Cultura/Antibiograma */}
                    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '8px 16px', alignItems: 'start' }}>
                      <div>
                        <p className="form-label" style={{ marginBottom: 6 }}>Cultura / Antibiograma</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {['Negativo', 'Positivo'].map(o => { const sel = dVal('culturaAntibiograma') === o; return (
                            <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8125rem', cursor: isReadOnly ? 'default' : 'pointer', padding: '4px 10px', borderRadius: 6, background: sel ? 'var(--teal-light)' : 'var(--surface-2)', border: `1px solid ${sel ? 'var(--teal)' : 'var(--border)'}` }}>
                              <input type="radio" checked={sel} disabled={isReadOnly} onChange={() => !isReadOnly && dUpd('culturaAntibiograma', o)} style={{ accentColor: 'var(--teal)', width: 13, height: 13 }} />
                              <span style={{ fontWeight: sel ? 600 : 400 }}>{o}</span>
                            </label>
                          )})}
                        </div>
                      </div>
                      {dVal('culturaAntibiograma') === 'Positivo' && (
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Resultado</label>
                          <textarea className="form-textarea" value={dVal('culturaDesc')} onChange={e => dUpd('culturaDesc', e.target.value)} disabled={isReadOnly} style={{ ...taStyle, minHeight: 48 }} />
                        </div>
                      )}
                    </div>
                    {/* Reflexo otopodal */}
                    <div>
                      <p className="form-label" style={{ marginBottom: 6 }}>Reflexo Otopodal</p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {['Negativo', 'Positivo'].map(o => { const sel = dVal('reflexoOtopodal') === o; return (
                          <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8125rem', cursor: isReadOnly ? 'default' : 'pointer', padding: '4px 10px', borderRadius: 6, background: sel ? 'var(--teal-light)' : 'var(--surface-2)', border: `1px solid ${sel ? 'var(--teal)' : 'var(--border)'}` }}>
                            <input type="radio" checked={sel} disabled={isReadOnly} onChange={() => !isReadOnly && dUpd('reflexoOtopodal', o)} style={{ accentColor: 'var(--teal)', width: 13, height: 13 }} />
                            <span style={{ fontWeight: sel ? 600 : 400 }}>{o}</span>
                          </label>
                        )})}
                      </div>
                    </div>
                    {/* Biópsia */}
                    <div className="form-group">
                      <label className="form-label">Biópsia</label>
                      <textarea className="form-textarea" value={dVal('biopsia')} onChange={e => dUpd('biopsia', e.target.value)} disabled={isReadOnly} placeholder="Resultado da biópsia..." style={taStyle} />
                    </div>
                    {/* Outro exame */}
                    <div className="form-group">
                      <label className="form-label">Outro exame</label>
                      <textarea className="form-textarea" value={dVal('outroExame')} onChange={e => dUpd('outroExame', e.target.value)} disabled={isReadOnly} placeholder="Descreva outro exame realizado..." style={taStyle} />
                    </div>
                  </div>
                  {!isReadOnly && (
                    <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}
                      onClick={() => { setTabAnterior(activeSection); setActiveSection('termos'); setTermoRequest('derma-continuo') }}>
                      📄 Gerar Termo Dermatológico Contínuo
                    </button>
                  )}

                </div>
              )
            })()}

            {/* CANNABIS */}
            {activeSection === 'cannabis' && (() => {
              const cUpd = (k, v) => setForm(f => ({ ...f, cannabis: { ...(f.cannabis ?? {}), [k]: v } }))
              const cVal = k => form.cannabis?.[k] ?? EMPTY_FORM.cannabis[k]
              const taStyle = { resize: 'none', overflowY: 'auto', maxHeight: 120, minHeight: 64, whiteSpace: 'pre-wrap' }
              const sectionTitle = t => (
                <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', borderBottom: '2px solid var(--teal)', paddingBottom: 6, marginBottom: 2 }}>{t}</p>
              )
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

                  {sectionTitle('Anamnese Canábica')}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 20px' }}>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Queixa principal / Tempo de evolução *</label>
                      <textarea className="form-textarea" value={cVal('queixa')} onChange={e => cUpd('queixa', e.target.value)} disabled={isReadOnly} placeholder="Motivo da consulta e tempo de evolução" style={taStyle} />
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Histórico</label>
                      <textarea className="form-textarea" value={cVal('historico')} onChange={e => cUpd('historico', e.target.value)} disabled={isReadOnly} placeholder="Histórico clínico, início, evolução..." style={taStyle} />
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Tratamentos anteriores</label>
                      <textarea className="form-textarea" value={cVal('tratamentosAnteriores')} onChange={e => cUpd('tratamentosAnteriores', e.target.value)} disabled={isReadOnly} placeholder="Medicamentos, terapias, cirurgias..." style={taStyle} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Houve melhora nos tratamentos anteriores?</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {['Sim', 'Não'].map(o => { const sel = cVal('melhoraTratamentos') === o; return (
                          <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', cursor: isReadOnly ? 'default' : 'pointer', padding: '4px 12px', borderRadius: 6, background: sel ? 'var(--teal-light)' : 'var(--surface-2)', border: `1px solid ${sel ? 'var(--teal)' : 'var(--border)'}` }}>
                            <input type="radio" checked={sel} disabled={isReadOnly} onChange={() => !isReadOnly && cUpd('melhoraTratamentos', o)} style={{ accentColor: 'var(--teal)', width: 14, height: 14 }} />
                            <span style={{ fontWeight: sel ? 600 : 400 }}>{o}</span>
                          </label>
                        )})}
                      </div>
                    </div>
                    {cVal('melhoraTratamentos') === 'Sim' && (
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Qual tratamento melhorou?</label>
                        <textarea className="form-textarea" value={cVal('melhoraTratamentosDesc')} onChange={e => cUpd('melhoraTratamentosDesc', e.target.value)} disabled={isReadOnly} style={taStyle} />
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">O animal possui outra doença diagnosticada?</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {['Sim', 'Não'].map(o => { const sel = cVal('outraDoenca') === o; return (
                          <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', cursor: isReadOnly ? 'default' : 'pointer', padding: '4px 12px', borderRadius: 6, background: sel ? 'var(--teal-light)' : 'var(--surface-2)', border: `1px solid ${sel ? 'var(--teal)' : 'var(--border)'}` }}>
                            <input type="radio" checked={sel} disabled={isReadOnly} onChange={() => !isReadOnly && cUpd('outraDoenca', o)} style={{ accentColor: 'var(--teal)', width: 14, height: 14 }} />
                            <span style={{ fontWeight: sel ? 600 : 400 }}>{o}</span>
                          </label>
                        )})}
                      </div>
                    </div>
                    {cVal('outraDoenca') === 'Sim' && (
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Qual doença?</label>
                        <textarea className="form-textarea" value={cVal('outraDoencaDesc')} onChange={e => cUpd('outraDoencaDesc', e.target.value)} disabled={isReadOnly} style={taStyle} />
                      </div>
                    )}

                    <SelectField label="Acesso à rua" value={cVal('acesRua')} onChange={v => cUpd('acesRua', v)} ro={isReadOnly} options={['Não', 'Sim', 'Restrito']} />
                    <SelectField label="Contato com outros animais" value={cVal('contatoAnimais')} onChange={v => cUpd('contatoAnimais', v)} ro={isReadOnly} options={['Não', 'Sim', 'Eventualmente']} />
                    {(cVal('contatoAnimais') === 'Sim' || cVal('contatoAnimais') === 'Eventualmente') && (
                      <div className="form-group">
                        <label className="form-label">Descreva o contato</label>
                        <textarea className="form-textarea" value={cVal('contatoAnimaisDesc')} onChange={e => cUpd('contatoAnimaisDesc', e.target.value)} disabled={isReadOnly} style={taStyle} />
                      </div>
                    )}

                    <SelectField label="Vômito" value={cVal('vomito')} onChange={v => cUpd('vomito', v)} ro={isReadOnly} options={['Não', 'Sim']} />
                    {cVal('vomito') === 'Sim' && (
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Descrição do vômito</label>
                        <textarea className="form-textarea" value={cVal('vomitoDesc')} onChange={e => cUpd('vomitoDesc', e.target.value)} disabled={isReadOnly} style={taStyle} />
                      </div>
                    )}

                    <SelectField label="Diarreia" value={cVal('diarreia')} onChange={v => cUpd('diarreia', v)} ro={isReadOnly} options={['Não', 'Sim']} />
                    {cVal('diarreia') === 'Sim' && (
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Descrição da diarreia</label>
                        <textarea className="form-textarea" value={cVal('diarreiaDesc')} onChange={e => cUpd('diarreiaDesc', e.target.value)} disabled={isReadOnly} style={taStyle} />
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">Alimentação</label>
                      <select className="form-select" value={cVal('alimentacao')} onChange={e => cUpd('alimentacao', e.target.value)} disabled={isReadOnly}>
                        {['Ração', 'Ração seca + sachê', 'Ração + AN', 'Ração + Petisco', 'Natural/Caseira', 'Outro'].map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Observações sobre alimentação</label>
                      <textarea className="form-textarea" value={cVal('alimentacaoDesc')} onChange={e => cUpd('alimentacaoDesc', e.target.value)} disabled={isReadOnly} placeholder="Marcas, frequência, suplementos..." style={taStyle} />
                    </div>

                    <SelectField label="Uso de antipulgas" value={cVal('antipulgas')} onChange={v => cUpd('antipulgas', v)} ro={isReadOnly} options={['Não', 'Sim']} />
                    {cVal('antipulgas') === 'Sim' && (
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Produto antipulgas</label>
                        <textarea className="form-textarea" value={cVal('antipulgasProduto')} onChange={e => cUpd('antipulgasProduto', e.target.value)} disabled={isReadOnly} style={taStyle} />
                      </div>
                    )}

                    <SelectField label="Medicamentos prévios" value={cVal('medicamentosPrevios')} onChange={v => cUpd('medicamentosPrevios', v)} ro={isReadOnly} options={['Não', 'Sim']} />
                    {cVal('medicamentosPrevios') === 'Sim' && (
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Quais medicamentos?</label>
                        <textarea className="form-textarea" value={cVal('medicamentosPreviosDesc')} onChange={e => cUpd('medicamentosPreviosDesc', e.target.value)} disabled={isReadOnly} style={taStyle} />
                      </div>
                    )}
                  </div>

                  {sectionTitle('Comorbidades conhecidas')}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {['Doença Renal', 'Insuficiência Hepática', 'Cardiopatia', 'Endocrinopatia', 'Neoplasia', 'Outras'].map(op => {
                      const chk = (cVal('comorbidades') ?? []).includes(op)
                      return (
                        <label key={op} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: isReadOnly ? 'default' : 'pointer', padding: '4px 12px', borderRadius: 6, background: chk ? 'var(--teal-light)' : 'var(--surface-2)', border: `1px solid ${chk ? 'var(--teal)' : 'var(--border)'}`, fontSize: '0.8125rem' }}>
                          <input type="checkbox" checked={chk} disabled={isReadOnly}
                            onChange={() => { if (isReadOnly) return; const cur = cVal('comorbidades') ?? []; cUpd('comorbidades', chk ? cur.filter(x => x !== op) : [...cur, op]) }}
                            style={{ accentColor: 'var(--teal)', width: 14, height: 14 }} />
                          <span style={{ fontWeight: chk ? 600 : 400 }}>{op}</span>
                        </label>
                      )
                    })}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Observações / detalhes das comorbidades:</label>
                    <textarea className="form-textarea" value={cVal('comorbidadesOutras')} onChange={e => cUpd('comorbidadesOutras', e.target.value)} disabled={isReadOnly} style={{ ...taStyle, minHeight: 70 }} placeholder="Detalhes, observações ou outras comorbidades..." />
                  </div>

                  {sectionTitle('Triagem de Sinais Alvo para Canabinoides')}
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '-14px 0 4px' }}>Indique a intensidade atual dos sintomas de 0 (ausente) a 5 (severo):</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'Dor Crônica / Inflamação', key: 'triaDor', freqKey: null },
                      { label: 'Convulsões / Tremores', key: 'triaConvulsoes', freqKey: 'triaConvulsoesFreq' },
                      { label: 'Ansiedade / Reatividade / Medo', key: 'triaAnsiedade', freqKey: null },
                      { label: 'Distúrbios do Sono / Agitação Noturna', key: 'triaSono', freqKey: null },
                      { label: 'Falta de Apetite / Náusea', key: 'triaApetite', freqKey: null },
                    ].map(({ label, key, freqKey }) => (
                      <div key={key}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
                          <span style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
                          <div style={{ display: 'flex', gap: 10 }}>
                            {[0,1,2,3,4,5].map(n => (
                              <label key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, cursor: isReadOnly ? 'default' : 'pointer', minWidth: 24 }}>
                                <input type="radio" checked={cVal(key) === String(n)} disabled={isReadOnly}
                                  onChange={() => !isReadOnly && cUpd(key, String(n))}
                                  style={{ accentColor: 'var(--teal)' }} />
                                <span style={{ fontSize: '0.68rem', color: cVal(key) === String(n) ? 'var(--teal-dark)' : 'var(--text-muted)', fontWeight: cVal(key) === String(n) ? 700 : 400 }}>{n}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        {freqKey && (
                          <div className="form-group" style={{ marginTop: 6, paddingLeft: 10 }}>
                            <label className="form-label">Frequência atual dos episódios:</label>
                            <textarea className="form-textarea" value={cVal(freqKey)} onChange={e => cUpd(freqKey, e.target.value)} disabled={isReadOnly} style={taStyle} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {sectionTitle('Histórico Terapêutico e Interações Medicamentosas')}
                  <div style={{ background: 'rgba(255,193,7,0.1)', border: '1px solid #FFC107', borderRadius: 8, padding: '10px 14px', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    ⚠️ O uso concomitante de óleos de Cannabis com medicamentos metabolizados pelo citocromo P450 exige atenção.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="form-group">
                      <label className="form-label">Medicamentos em uso contínuo (AINEs, corticoides, anticonvulsivantes, desinfetantes, etc.):</label>
                      <textarea className="form-textarea" value={cVal('medsContinuos')} onChange={e => cUpd('medsContinuos', e.target.value)} disabled={isReadOnly} placeholder="Liste os medicamentos..." style={taStyle} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">O animal já utilizou produtos à base de Cannabis?</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {['Sim', 'Não'].map(o => { const sel = cVal('usouCannabis') === o; return (
                          <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: isReadOnly ? 'default' : 'pointer', padding: '4px 12px', borderRadius: 6, background: sel ? 'var(--teal-light)' : 'var(--surface-2)', border: `1px solid ${sel ? 'var(--teal)' : 'var(--border)'}`, fontSize: '0.8125rem' }}>
                            <input type="radio" checked={sel} disabled={isReadOnly} onChange={() => !isReadOnly && cUpd('usouCannabis', o)} style={{ accentColor: 'var(--teal)', width: 14, height: 14 }} />
                            <span style={{ fontWeight: sel ? 600 : 400 }}>{o}</span>
                          </label>
                        )})}
                      </div>
                    </div>
                    {cVal('usouCannabis') === 'Sim' && (
                      <div className="form-group">
                        <label className="form-label">Qual foi a resposta e dosagem utilizada?</label>
                        <textarea className="form-textarea" value={cVal('usouCannabisResp')} onChange={e => cUpd('usouCannabisResp', e.target.value)} disabled={isReadOnly} style={taStyle} />
                      </div>
                    )}
                  </div>

                  {sectionTitle('Estilo de Vida, Rotina e Ambiente (Anamnese Ampliada)')}
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    O ambiente molda o tônus endocanabinoide do paciente.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px 20px' }}>
                    <div className="form-group">
                      <label className="form-label">Nível de estresse ambiental na casa:</label>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {['Baixo', 'Moderado', 'Alto'].map(o => { const sel = cVal('estresseAmbiental') === o; return (
                          <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: isReadOnly ? 'default' : 'pointer', padding: '4px 12px', borderRadius: 6, background: sel ? 'var(--teal-light)' : 'var(--surface-2)', border: `1px solid ${sel ? 'var(--teal)' : 'var(--border)'}`, fontSize: '0.8125rem' }}>
                            <input type="radio" checked={sel} disabled={isReadOnly} onChange={() => !isReadOnly && cUpd('estresseAmbiental', o)} style={{ accentColor: 'var(--teal)', width: 14, height: 14 }} />
                            <span style={{ fontWeight: sel ? 600 : 400 }}>{o}</span>
                          </label>
                        )})}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Padrão de comportamento social:</label>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {['Apático/Isolado', 'Sociável', 'Agressivo/Defensivo', 'Hiperativo'].map(o => { const sel = cVal('comportamentoSocial') === o; return (
                          <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: isReadOnly ? 'default' : 'pointer', padding: '4px 12px', borderRadius: 6, background: sel ? 'var(--teal-light)' : 'var(--surface-2)', border: `1px solid ${sel ? 'var(--teal)' : 'var(--border)'}`, fontSize: '0.8125rem' }}>
                            <input type="radio" checked={sel} disabled={isReadOnly} onChange={() => !isReadOnly && cUpd('comportamentoSocial', o)} style={{ accentColor: 'var(--teal)', width: 14, height: 14 }} />
                            <span style={{ fontWeight: sel ? 600 : 400 }}>{o}</span>
                          </label>
                        )})}
                      </div>
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Rotina de atividades físicas e passeios:</label>
                      <textarea className="form-textarea" value={cVal('rotinasAtividades')} onChange={e => cUpd('rotinasAtividades', e.target.value)} disabled={isReadOnly} style={taStyle} />
                    </div>
                  </div>

                  {sectionTitle('Expectativas do Tutor e Termo de Consentimento')}
                  <div className="form-group">
                    <label className="form-label">Qual o principal objetivo do tutor com o tratamento?</label>
                    <textarea className="form-textarea" value={cVal('expectativasTutor')} onChange={e => cUpd('expectativasTutor', e.target.value)} disabled={isReadOnly} placeholder="Ex: ganho de mobilidade, redução de crises, desmame de alopáticos" style={taStyle} />
                  </div>
                  {sectionTitle('Protocolo Canábico')}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 20px' }}>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Indicação clínica</label>
                      <textarea className="form-textarea" value={cVal('indicacao')} onChange={e => cUpd('indicacao', e.target.value)} disabled={isReadOnly} placeholder="Ex: Dor crônica, ansiedade, epilepsia refratária, suporte oncológico..." style={taStyle} />
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Produto / apresentação</label>
                      <input className="form-input" value={cVal('produto')} disabled={isReadOnly} onChange={e => cUpd('produto', e.target.value)} placeholder="Ex: CBD isolado, Full spectrum, THC:CBD 1:20..." />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Concentração</label>
                      <input className="form-input" value={cVal('concentracao')} disabled={isReadOnly} onChange={e => cUpd('concentracao', e.target.value)} placeholder="Ex: 100 mg/ml" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Dose (mg/kg)</label>
                      <input className="form-input" value={cVal('doseKg')} disabled={isReadOnly} onChange={e => cUpd('doseKg', e.target.value)} placeholder="Ex: 0,5 mg/kg" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Dose total</label>
                      <input className="form-input" value={cVal('doseTotal')} disabled={isReadOnly} onChange={e => cUpd('doseTotal', e.target.value)} placeholder="Ex: 15 mg" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Via</label>
                      <select className="form-select" value={cVal('via')} disabled={isReadOnly} onChange={e => cUpd('via', e.target.value)}>
                        {['Oral', 'Sublingual', 'Tópica', 'Outra'].map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Frequência</label>
                      <input className="form-input" value={cVal('frequencia')} disabled={isReadOnly} onChange={e => cUpd('frequencia', e.target.value)} placeholder="Ex: 2x/dia, a cada 12h" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Duração do tratamento</label>
                      <input className="form-input" value={cVal('duracao')} disabled={isReadOnly} onChange={e => cUpd('duracao', e.target.value)} placeholder="Ex: 30 dias, uso contínuo" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Resposta anterior</label>
                      <select className="form-select" value={cVal('respostaAnterior')} disabled={isReadOnly} onChange={e => cUpd('respostaAnterior', e.target.value)}>
                        {['Primeira vez', 'Boa resposta', 'Resposta parcial', 'Sem resposta', 'Intolerância'].map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Efeitos adversos observados</label>
                      <textarea className="form-textarea" value={cVal('efeitosAdversos')} disabled={isReadOnly} onChange={e => cUpd('efeitosAdversos', e.target.value)} placeholder="Ex: Sedação, diarreia, aumento de apetite, ataxia..." style={taStyle} />
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Observações</label>
                      <textarea className="form-textarea" value={cVal('observacoes')} disabled={isReadOnly} onChange={e => cUpd('observacoes', e.target.value)} placeholder="Notas clínicas, monitoramento, ajuste de dose previsto..." style={taStyle} />
                    </div>
                  </div>
                  {!isReadOnly && (
                    <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}
                      onClick={() => { setTabAnterior(activeSection); setActiveSection('termos'); setTermoRequest('termo-cannabis') }}>
                      📄 Gerar Termo de Acompanhamento Canábico
                    </button>
                  )}
                </div>
              )
            })()}

            {/* SINAIS VITAIS */}
            {activeSection === 'vitais' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Seletor de espécie */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8 }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: 8 }}>Espécie do paciente:</span>
                  {['Cão', 'Gato', 'Outros'].map(sp => (
                    <label key={sp} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: isReadOnly ? 'default' : 'pointer', fontSize: '0.875rem' }}>
                      <input type="radio" name="especie" value={sp} checked={especie === sp}
                        onChange={() => !isReadOnly && updateVitals('especie', sp)}
                        style={{ accentColor: 'var(--teal)', width: 14, height: 14 }} />
                      <span style={{ fontWeight: especie === sp ? 700 : 400, color: especie === sp ? 'var(--teal-dark)' : 'var(--text-secondary)' }}>{sp}</span>
                    </label>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 20px' }}>
                  <VitalField label="Temperatura (°C)" value={form.vitals.temperatura} onChange={v => updateVitals('temperatura', v)} ro={isReadOnly} placeholder="38.0 – 39.4"
                    classification={classifyTemp(form.vitals.temperatura)} />
                  <VitalField label={`FC — bpm${especie === 'Cão' ? ' (60-120)' : especie === 'Gato' ? ' (140-220)' : ''}`} value={form.vitals.fc} onChange={v => updateVitals('fc', v)} ro={isReadOnly}
                    placeholder={especie === 'Cão' ? '60–120' : especie === 'Gato' ? '140–220' : 'bpm'}
                    classification={classifyFC(form.vitals.fc, especie)} />
                  <VitalField label={`FR — mpm${especie === 'Cão' ? ' (12-30)' : especie === 'Gato' ? ' (20-30)' : ''}`} value={form.vitals.fr} onChange={v => updateVitals('fr', v)} ro={isReadOnly}
                    placeholder={especie === 'Cão' ? '12–30' : especie === 'Gato' ? '20–30' : 'mpm'}
                    classification={classifyFR(form.vitals.fr, especie)} />
                  <VitalField label="Peso (kg)" value={form.vitals.peso} onChange={v => updateVitals('peso', v)} ro={isReadOnly} placeholder="0.0" />
                  <VitalField label="SpO₂ (%)" value={form.vitals.spo2} onChange={v => updateVitals('spo2', v)} ro={isReadOnly} placeholder="95–100" />
                  <VitalField label="TPC (seg)" value={form.vitals.tpc ?? form.vitals.trc ?? ''} onChange={v => updateVitals('tpc', v)} ro={isReadOnly} placeholder="< 2" />
                  <div className="form-group">
                    <label className="form-label">Mucosas</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {[
                        { value: 'Normocorada', color: '#E91E8C' },
                        { value: 'Hipocorada',  color: '#9E9E9E' },
                        { value: 'Cianótica',   color: '#7B68EE' },
                        { value: 'Ictérica',    color: '#B8860B' },
                        { value: 'Hiperêmica',  color: '#D32F2F' },
                      ].map(({ value, color }) => (
                        <button key={value} type="button"
                          onClick={() => !isReadOnly && updateVitals('mucosas', value)}
                          style={{
                            padding: '5px 12px', borderRadius: 99,
                            border: `2px solid ${form.vitals.mucosas === value ? color : 'var(--border)'}`,
                            background: form.vitals.mucosas === value ? color + '18' : 'var(--surface-2)',
                            cursor: isReadOnly ? 'default' : 'pointer', fontSize: '0.8rem', fontWeight: 600,
                            color: form.vitals.mucosas === value ? color : 'var(--text-secondary)',
                            transition: 'all 150ms',
                          }}>
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hidratação</label>
                    <select className="form-select" value={form.vitals.hidratacao} onChange={e => updateVitals('hidratacao', e.target.value)} disabled={isReadOnly}>
                      {['<5%', '5-8%', '8-12%', '>12%'].map(o => <option key={o}>{o}</option>)}
                    </select>
                    {(() => { const cl = classifyHidratacao(form.vitals.hidratacao); return cl ? (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: cl.color, marginTop: 4, display: 'block' }}>● {cl.label}</span>
                    ) : null })()}
                  </div>
                  <SelectField label="Pulso" value={form.vitals.pulso} onChange={v => updateVitals('pulso', v)} ro={isReadOnly}
                    options={['Normosfigmia', 'Bradisfigmia', 'Taquisfigmia']} />
                  <VitalField label={`Glicemia (mg/dL)${especie === 'Cão' ? ' (60-110)' : especie === 'Gato' ? ' (70-150)' : ''}`} value={form.vitals.glicemia ?? ''} onChange={v => updateVitals('glicemia', v)} ro={isReadOnly}
                    placeholder={especie === 'Cão' ? '60–110' : especie === 'Gato' ? '70–150' : 'mg/dL'}
                    classification={classifyGlicemia(form.vitals.glicemia, especie)} />
                  <div className="form-group">
                    <label className="form-label">Diurese</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {[{ value: 'Normúria', color: '#4CAF50' }, { value: 'Poliúria', color: '#FFC107' }, { value: 'Disúria', color: '#FF9800' }, { value: 'Anúria', color: '#F44336' }].map(({ value: v, color }) => (
                        <button key={v} type="button" onClick={() => !isReadOnly && updateVitals('diurese', v)}
                          style={{ padding: '5px 12px', borderRadius: 99, border: `2px solid ${(form.vitals.diurese ?? 'Normúria') === v ? color : 'var(--border)'}`, background: (form.vitals.diurese ?? 'Normúria') === v ? color + '18' : 'var(--surface-2)', cursor: isReadOnly ? 'default' : 'pointer', fontSize: '0.8rem', fontWeight: 600, color: (form.vitals.diurese ?? 'Normúria') === v ? color : 'var(--text-secondary)', transition: 'all 150ms' }}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Alimentação / Apetite</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {[{ value: 'Normorexia', color: '#4CAF50' }, { value: 'Hiporexia', color: '#FFC107' }, { value: 'Hiperorexia', color: '#FF9800' }, { value: 'Anorexia', color: '#F44336' }].map(({ value: v, color }) => (
                        <button key={v} type="button" onClick={() => !isReadOnly && updateVitals('apetite', v)}
                          style={{ padding: '5px 12px', borderRadius: 99, border: `2px solid ${(form.vitals.apetite ?? 'Normorexia') === v ? color : 'var(--border)'}`, background: (form.vitals.apetite ?? 'Normorexia') === v ? color + '18' : 'var(--surface-2)', cursor: isReadOnly ? 'default' : 'pointer', fontSize: '0.8rem', fontWeight: 600, color: (form.vitals.apetite ?? 'Normorexia') === v ? color : 'var(--text-secondary)', transition: 'all 150ms' }}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ingestão de água</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {[{ value: 'Normodipsia', color: '#4CAF50' }, { value: 'Oligodipsia/Hipodipsia', color: '#FFC107' }, { value: 'Polidipsia', color: '#FF9800' }, { value: 'Adipsia', color: '#F44336' }].map(({ value: v, color }) => (
                        <button key={v} type="button" onClick={() => !isReadOnly && updateVitals('ingestaoAgua', v)}
                          style={{ padding: '5px 12px', borderRadius: 99, border: `2px solid ${(form.vitals.ingestaoAgua ?? 'Normodipsia') === v ? color : 'var(--border)'}`, background: (form.vitals.ingestaoAgua ?? 'Normodipsia') === v ? color + '18' : 'var(--surface-2)', cursor: isReadOnly ? 'default' : 'pointer', fontSize: '0.8rem', fontWeight: 600, color: (form.vitals.ingestaoAgua ?? 'Normodipsia') === v ? color : 'var(--text-secondary)', transition: 'all 150ms' }}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* EXAME FÍSICO */}
            {activeSection === 'exame' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {SISTEMAS.map(s => {
                  const data = form.examesFisicos?.[s.key] ?? {}
                  if (s.split) {
                    return (
                      <div key={s.key} style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 10 }}>{s.label}</span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          {['od', 'oe'].map(side => {
                            const selected = data[side] ?? []
                            return (
                              <div key={side}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{side === 'od' ? 'OD' : 'OE'}</span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {s.chips.map(chip => {
                                    const isSel = selected.includes(chip)
                                    return (
                                      <button key={chip} type="button"
                                        onClick={() => { if (isReadOnly) return; updateExame(s.key, side, isSel ? selected.filter(c => c !== chip) : [...selected, chip]) }}
                                        style={{ padding: '4px 10px', borderRadius: 99, fontSize: '0.8rem', fontWeight: 600, border: `2px solid ${isSel ? 'var(--teal)' : 'var(--border)'}`, background: isSel ? 'var(--teal-light)' : 'var(--surface)', color: isSel ? 'var(--teal-dark)' : 'var(--text-secondary)', cursor: isReadOnly ? 'default' : 'pointer', transition: 'all 150ms' }}>
                                        {chip}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <input className="form-input" style={{ marginTop: 10, padding: '6px 10px', fontSize: '0.8125rem' }}
                          value={data.obs ?? ''} onChange={e => !isReadOnly && updateExame(s.key, 'obs', e.target.value)}
                          disabled={isReadOnly} placeholder="Observações..." />
                      </div>
                    )
                  }
                  if (s.chips) {
                    const selected = data.chips ?? []
                    return (
                      <div key={s.key} style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>{s.label}</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                          {s.chips.map(chip => {
                            const isSel = selected.includes(chip)
                            return (
                              <button key={chip} type="button"
                                onClick={() => { if (isReadOnly) return; updateExame(s.key, 'chips', isSel ? selected.filter(c => c !== chip) : [...selected, chip]) }}
                                style={{ padding: '4px 10px', borderRadius: 99, fontSize: '0.8rem', fontWeight: 600, border: `2px solid ${isSel ? 'var(--teal)' : 'var(--border)'}`, background: isSel ? 'var(--teal-light)' : 'var(--surface)', color: isSel ? 'var(--teal-dark)' : 'var(--text-secondary)', cursor: isReadOnly ? 'default' : 'pointer', transition: 'all 150ms' }}>
                                {chip}
                              </button>
                            )
                          })}
                        </div>
                        <input className="form-input" style={{ padding: '6px 10px', fontSize: '0.8125rem' }}
                          value={data.obs ?? ''} onChange={e => !isReadOnly && updateExame(s.key, 'obs', e.target.value)}
                          disabled={isReadOnly} placeholder="Observações..." />
                      </div>
                    )
                  }
                  return (
                    <div key={s.key} style={{ display: 'grid', gridTemplateColumns: '180px 160px 1fr', gap: 12, alignItems: 'center', padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8 }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{s.label}</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {['NDN', 'Alterado'].map(opt => (
                          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: isReadOnly ? 'default' : 'pointer', fontSize: '0.8rem' }}>
                            <input type="radio" name={s.key} value={opt}
                              checked={(data.status === opt) || (opt === 'NDN' && (data.status === 'Normal' || !data.status))}
                              onChange={() => !isReadOnly && updateExame(s.key, 'status', opt)} />
                            <span style={{ color: opt === 'Alterado' ? 'var(--danger)' : 'var(--text-secondary)' }}>{opt}</span>
                          </label>
                        ))}
                      </div>
                      <input className="form-input" style={{ padding: '6px 10px', fontSize: '0.8125rem' }}
                        value={data.obs ?? ''} onChange={e => !isReadOnly && updateExame(s.key, 'obs', e.target.value)}
                        disabled={isReadOnly} placeholder="Observações..." />
                    </div>
                  )
                })}
              </div>
            )}

            {/* VACINAS */}
            {activeSection === 'vacinas' && (
              <VacinasSection
                petId={form.petId}
                petInfo={PETS.find(p => p.id === form.petId)}
                vacinasAplicadas={form.vacinasAplicadas ?? []}
                onChange={arr => setForm(f => ({ ...f, vacinasAplicadas: arr }))}
                isReadOnly={isReadOnly}
                onApplyProtocol={proto => {
                  if (proto.medicamentos?.length > 0) {
                    const today = new Date().toISOString().split('T')[0]
                    setForm(f => ({
                      ...f,
                      aplicacoes: [
                        ...(f.aplicacoes ?? []),
                        ...proto.medicamentos.map(m => ({
                          nome: m.nome || '',
                          dose: '',
                          via: 'SC',
                          dataAplicacao: today,
                          obs: `Protocolo: ${proto.name}`,
                        })),
                      ],
                    }))
                  }
                }}
              />
            )}

            {/* APLICAÇÕES */}
            {activeSection === 'aplicacoes' && (
              <AplicacoesSection
                aplicacoes={form.aplicacoes ?? []}
                onChange={arr => setForm(f => ({ ...f, aplicacoes: arr }))}
                isReadOnly={isReadOnly}
              />
            )}

            {/* SOLICITAÇÃO DE EXAMES */}
            {activeSection === 'solicitacao-exames' && (
              <SolicitacaoExames
                value={form.solicitacaoExames ?? {}} onChange={updateSolicitacao} ro={isReadOnly}
                petInfo={PETS.find(p => p.id === form.petId)}
                tutorInfo={TUTORES.find(t => t.id === PETS.find(p => p.id === form.petId)?.tutorId)}
                vetInfo={findVetById(form.vetId)}
                consultaDate={form.date}
                onAddAnexo={!isReadOnly ? ax => setForm(f => ({ ...f, anexos: [...(f.anexos ?? []), { ...ax, id: `ax${Date.now()}` }] })) : undefined}
              />
            )}

            {/* DIAGNÓSTICO */}
            {activeSection === 'diagnostico' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Diagnóstico diferencial</label>
                  <textarea className="form-textarea" value={form.diagnostico.diferencial ?? ''} onChange={e => updateDiag('diferencial', e.target.value)} disabled={isReadOnly}
                    placeholder="Diagnósticos diferenciais considerados..." style={{ resize: 'none', overflowY: 'auto', minHeight: 120, maxHeight: 300, whiteSpace: 'pre-wrap' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Diagnóstico</label>
                  <textarea className="form-textarea" value={form.diagnostico.definitivo ?? ''} onChange={e => updateDiag('definitivo', e.target.value)} disabled={isReadOnly}
                    placeholder="Diagnóstico principal..." style={{ resize: 'none', overflowY: 'auto', minHeight: 120, maxHeight: 300, whiteSpace: 'pre-wrap', borderColor: 'var(--teal)' }} />
                </div>
              </div>
            )}

            {/* PRESCRIÇÃO */}
            {activeSection === 'prescricao' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Medicamentos</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline btn-sm no-print" onClick={() => {
                      const petI = PETS.find(p => p.id === form.petId)
                      const tutorI = petI ? TUTORES.find(t => t.id === petI.tutorId) : null
                      const vetI = findVetById(form.vetId)
                      const meds = form.prescricao.medicamentos
                      const dateStr = form.date ? new Date(form.date + 'T00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')
                      const win = window.open('', '_blank', 'width=800,height=700')
                      const _clinica = (() => { try { return JSON.parse(localStorage.getItem('petvet-clinica-config') ?? 'null') } catch { return null } })() ?? {}
                      const _cNome = _clinica.nome || 'Emporium Vazpet & Tatá Bichos'
                      const _cEndereco = [_clinica.endereco, _clinica.telefone].filter(Boolean).join(' · ')
                      const _logoHtml = [_clinica.logoEmporium, _clinica.logoTata].filter(Boolean).map(src => `<img src="${src}" style="width:50px;height:50px;object-fit:contain;" />`).join('')
                      win.document.write(`<html><head><title>Receituário</title><style>
                        body{font-family:Arial,sans-serif;padding:40px;font-size:13px;line-height:1.6;color:#111}
                        h2,h3{margin:0 0 8px}hr{border:none;border-top:1px solid #ddd;margin:16px 0}
                        .med{margin-bottom:12px;padding:10px;border:1px solid #eee;border-radius:6px}
                        @media print{.no-print{display:none}}
                      </style></head><body>
                        <div style="text-align:center;border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:16px">
                          ${_logoHtml ? `<div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:8px">${_logoHtml}</div>` : ''}
                          <h2 style="font-size:1.2rem;font-weight:800;margin:0">${_cNome}</h2>
                          ${_cEndereco ? `<p style="margin:4px 0 0;color:#555;font-size:12px">${_cEndereco}</p>` : ''}
                        </div>
                        <h3 style="text-align:center;font-size:1rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px">RECEITUÁRIO VETERINÁRIO</h3>
                        <p><strong>Pet:</strong> ${petI?.name ?? '—'} | <strong>Espécie:</strong> ${petI?.species ?? '—'} | <strong>Tutor:</strong> ${tutorI?.name ?? '—'}</p>
                        <p><strong>Data:</strong> ${dateStr} | <strong>Veterinário:</strong> ${vetI?.name ?? '—'} | <strong>CRMV:</strong> ${vetI?.crmv ?? '—'}${vetI?.mapa ? ` | <strong>MAPA:</strong> ${fmtMapa(vetI.mapa)}` : ''}</p>
                        <hr/>
                        ${meds.map((m, i) => `<div class="med"><strong>${i + 1}. ${m.nome || 'Medicamento'}</strong><br/>Dose: ${m.dose || '—'} | Via: ${m.via || '—'} | Frequência: ${m.frequencia || '—'} | Duração: ${m.duracao || '—'}${m.obs ? `<br/>Obs: ${m.obs}` : ''}</div>`).join('')}
                        <hr/>
                        ${form.prescricao.orientacoes ? `<p><strong>Orientações:</strong> ${form.prescricao.orientacoes}</p>` : ''}
                        ${form.prescricao.retorno ? `<p><strong>Retorno:</strong> ${new Date(form.prescricao.retorno + 'T00:00').toLocaleDateString('pt-BR')}</p>` : ''}
                        <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:60px">
                          <div style="border-top:1px solid #333;padding-top:6px">Assinatura do Tutor<br/>${tutorI?.name ?? ''}</div>
                          <div style="border-top:1px solid #333;padding-top:6px">${vetI?.name ?? 'Veterinário'}<br/>CRMV: ${vetI?.crmv ?? '—'}${vetI?.mapa ? ` · MAPA: ${fmtMapa(vetI.mapa)}` : ''}</div>
                        </div>
                        <script>window.onload=()=>window.print()<\/script>
                      </body></html>`)
                      win.document.close()
                    }}><Printer size={14} /> Imprimir Receita</button>
                    {!isReadOnly && <button className="btn btn-outline btn-sm" onClick={addMedicamento}><Plus size={14} /> Adicionar</button>}
                  </div>
                </div>
                {form.prescricao.medicamentos.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nenhum medicamento prescrito.</p>}
                <datalist id="dl-via">{['Via oral', 'SC', 'IM', 'IV', 'Tópico', 'Ocular', 'Auricular', 'Nasal', 'Inalatório', 'Retal'].map(v => <option key={v} value={v} />)}</datalist>
                <datalist id="dl-freq">{['1x ao dia', '2x ao dia', '3x ao dia', '8 em 8h', '12 em 12h', '24 em 24h', 'A cada 48h', 'Uso contínuo', 'Se necessário', 'Uso único'].map(v => <option key={v} value={v} />)}</datalist>
                {form.prescricao.medicamentos.map((med, idx) => (
                  <div key={idx} style={{ padding: '14px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px 14px' }}>
                      <div className="form-group" style={{ position: 'relative' }}>
                        <label className="form-label">Medicamento</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <MedInput value={med.nome} onChange={v => updateMed(idx, 'nome', v)} disabled={isReadOnly}
                              onSelect={p => { updateMed(idx, 'nome', p.name); if (!med.dose) updateMed(idx, 'dose', p.dosagem ?? '') }} />
                          </div>
                          {(() => { const b = med.nome?.length >= 2 ? findBulaForPresc(med.nome) : null; return (
                            <button type="button" className="btn btn-ghost btn-sm"
                              title={b ? 'Ver bula' : 'Medicamento não encontrado no bulário'}
                              disabled={!b} onClick={() => b && setPrescBulaMed(b)}
                              style={{ alignSelf: 'center', fontSize: '0.875rem', opacity: b ? 1 : 0.35, flexShrink: 0 }}>
                              📖
                            </button>
                          )})()}
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Dose</label>
                        <input className="form-input" value={med.dose} onChange={e => updateMed(idx, 'dose', e.target.value)} disabled={isReadOnly} placeholder="Ex: 1 mg/kg" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Via</label>
                        <input list="dl-via" className="form-input" value={med.via} onChange={e => updateMed(idx, 'via', e.target.value)} disabled={isReadOnly} placeholder="VO, SC, IM..." />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Frequência</label>
                        <input list="dl-freq" className="form-input" value={med.frequencia} onChange={e => updateMed(idx, 'frequencia', e.target.value)} disabled={isReadOnly} placeholder="2x ao dia, 8 em 8h..." />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Duração</label>
                        <input className="form-input" value={med.duracao} onChange={e => updateMed(idx, 'duracao', e.target.value)} disabled={isReadOnly} placeholder="Ex: 7 dias" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Observações</label>
                        <input className="form-input" value={med.obs} onChange={e => updateMed(idx, 'obs', e.target.value)} disabled={isReadOnly} placeholder="Ex: com alimento" />
                      </div>
                    </div>
                    {!isReadOnly && <button className="btn btn-outline-danger btn-sm" style={{ marginTop: 8 }} onClick={() => removeMed(idx)}>Remover</button>}
                  </div>
                ))}
                {prescBulaMed && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px' }}>
                    <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 640, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h3 style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>{prescBulaMed.nomeComercial}</h3>
                          {prescBulaMed.nomeGenerico && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>{prescBulaMed.nomeGenerico}</p>}
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => setPrescBulaMed(null)}><X size={16} /></button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', fontSize: '0.875rem' }}>
                        {[
                          ['Categoria', prescBulaMed.categoria],
                          ['Concentração', prescBulaMed.concentracao],
                          ['Apresentação', prescBulaMed.apresentacao],
                          ['Fabricante', prescBulaMed.fabricante],
                          ['Via de administração', prescBulaMed.via],
                          ['Dose (Cão)', prescBulaMed.doseCao],
                          ['Dose (Gato)', prescBulaMed.doseGato],
                          ['Dose (Outros)', prescBulaMed.doseOutros],
                          ['Frequência', prescBulaMed.frequencia],
                          ['Duração do tratamento', prescBulaMed.tempoPtto],
                          ['Interações', prescBulaMed.interacoes],
                        ].filter(([, v]) => v).map(([k, v]) => (
                          <div key={k}>
                            <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>{k}</span>
                            <span>{v}</span>
                          </div>
                        ))}
                      </div>
                      {prescBulaMed.indicacoes && <div><p style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 4 }}>Indicações</p><p style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{prescBulaMed.indicacoes}</p></div>}
                      {prescBulaMed.contraindicacoes && <div><p style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--danger)', marginBottom: 4 }}>Contraindicações</p><p style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{prescBulaMed.contraindicacoes}</p></div>}
                      {prescBulaMed.efeitosAdversos && <div><p style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--warning)', marginBottom: 4 }}>Efeitos Adversos</p><p style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{prescBulaMed.efeitosAdversos}</p></div>}
                      {prescBulaMed.observacoes && <div><p style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 4 }}>Observações</p><p style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{prescBulaMed.observacoes}</p></div>}
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn btn-primary" onClick={() => setPrescBulaMed(null)}>Fechar</button>
                      </div>
                    </div>
                  </div>
                )}
                <hr className="divider" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
                  <div className="form-group">
                    <label className="form-label">Data de retorno</label>
                    <input type="date" className="form-input" value={form.prescricao.retorno} onChange={e => updatePrescricao('retorno', e.target.value)} disabled={isReadOnly} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Orientações ao tutor</label>
                  <textarea className="form-textarea" value={form.prescricao.orientacoes} onChange={e => updatePrescricao('orientacoes', e.target.value)} disabled={isReadOnly}
                    placeholder="Restrições, cuidados em casa, sinais de alerta..." style={{ resize: 'none', overflowY: 'auto', maxHeight: 140, minHeight: 80 }} />
                </div>
              </div>
            )}

            {/* MANUAL DE COLETA */}
            {activeSection === 'manual-coleta' && <ManualColeta />}

            {/* TERMOS */}
            {activeSection === 'termos' && (
              <TermosSection
                form={form}
                petInfo={PETS.find(p => p.id === form.petId)}
                tutorInfo={TUTORES.find(t => t.id === PETS.find(p => p.id === form.petId)?.tutorId)}
                vetInfo={findVetById(form.vetId)}
                onAddAnexo={!isReadOnly ? ax => setForm(f => ({ ...f, anexos: [...(f.anexos ?? []), { ...ax, id: `ax${Date.now()}` }] })) : undefined}
                requestModal={termoRequest}
                onRequestModalHandled={() => setTermoRequest(null)}
                onModalClose={() => { if (tabAnterior) { setActiveSection(tabAnterior); setTabAnterior(null) } }}
              />
            )}

            {/* ANEXOS */}
            {activeSection === 'anexos' && (
              <AnexosSection
                anexos={form.anexos ?? []}
                onChange={arr => setForm(f => ({ ...f, anexos: arr }))}
                isReadOnly={isReadOnly}
              />
            )}

            {/* ASSINATURA */}
            {activeSection === 'assinatura' && (
              <AssinaturaSection form={form} signatureData={signatureData} setSignatureData={setSignatureData} isReadOnly={isReadOnly} />
            )}
          </div>

          {/* Navegação entre seções */}
          <div className="no-print prontuario-section-nav" style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 22px', borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-ghost" disabled={sectionIdx === 0} onClick={() => setActiveSection(visibleSections[sectionIdx - 1].id)}>← Anterior</button>
            {sectionIdx < visibleSections.length - 1
              ? <button className="btn btn-primary" onClick={() => setActiveSection(visibleSections[sectionIdx + 1].id)}>Próxima →</button>
              : !isReadOnly && <button className="btn btn-primary" onClick={saveProntuario}>Salvar Prontuário</button>
            }
          </div>
        </div>
      </div>
    )
  }

  function exportarProntuarios(prontsToExport) {
    const allPets = [...PETS, ...(Array.isArray(petsLS) ? petsLS.filter(p => !PETS.find(mp => mp.id === p.id)) : [])]
    const allTutores = [...TUTORES, ...(Array.isArray(tutoresLS) ? tutoresLS.filter(t => !TUTORES.find(mt => mt.id === t.id)) : [])]
    const petsMap = new Map(allPets.map(p => [p.id, p]))
    const tutoresMap = new Map(allTutores.map(t => [t.id, t]))

    const registros = prontsToExport.map(pr => {
      const pet = petsMap.get(pr.petId) ?? null
      const tutor = pet ? tutoresMap.get(pet.tutorId) ?? null : null
      const vet = findVetById(pr.vetId)
      const termos = []
      if (pr.termoRecusaAssinado) termos.push({ tipo: 'recusa_tratamento', dados: pr.termoRecusaDados ?? {} })
      if (pr.termoDermaAssinado) termos.push({ tipo: 'consentimento_derma', dados: pr.termoDermaDados ?? {} })
      if (pr.termoCanabisAssinado) termos.push({ tipo: 'cannabis', dados: pr.termoCanabisdados ?? {} })
      if (pr.termoAcompanhamento) termos.push({ tipo: 'acompanhamento_canabico', dados: {} })
      if (pr.termoTCLE) termos.push({ tipo: 'tcle', dados: {} })
      const anexos = (pr.anexos ?? []).map(a => ({
        nome: a.nome,
        tipo: a.tipo ?? 'arquivo',
        dataAdicionado: a.dataAdicionado ?? null,
        ...(a.conteudo ? { conteudo: a.conteudo } : {}),
        ...(a.conteudoHtml ? { conteudoHtml: a.conteudoHtml } : {}),
      }))
      return {
        id: pr.id,
        data: pr.date,
        tipo: pr.tipoConsulta ?? 'Consulta',
        status: pr.status ?? 'finalizado',
        paciente: pet ? { id: pet.id, nome: pet.name, especie: pet.species, raca: pet.breed ?? '', sexo: pet.sex ?? '', cor: pet.color ?? '', peso: pet.weight ?? '', dataNascimento: pet.birthDate ?? '', idade: calcularIdade(pet.birthDate), microchip: pet.microchip ?? '', registroBreeder: pet.registroBreeder ?? '' } : { id: pr.petId },
        tutor: tutor ? { id: tutor.id, nome: tutor.name, cpf: tutor.cpf ?? '', rg: tutor.rg ?? '', telefone: tutor.phone ?? '', email: tutor.email ?? '', endereco: tutor.address ?? '' } : null,
        veterinario: vet ? { id: vet.id, nome: vet.name, crmv: vet.crmv ?? '' } : { id: pr.vetId },
        anamnese: pr.anamnese ?? {},
        derma: pr.derma ?? {},
        cannabis: pr.cannabis ?? {},
        sinaisVitais: pr.vitals ?? {},
        exameFisico: pr.examesFisicos ?? {},
        vacinas: pr.vacinas ?? [],
        aplicacoes: pr.aplicacoes ?? [],
        procedimentosCirurgicos: pr.cirurgia ?? {},
        solicitacaoExames: pr.solicitacaoExames ?? {},
        diagnostico: pr.diagnostico ?? {},
        prescricao: pr.prescricao ?? [],
        termos,
        anexos,
        assinatura: pr.assinatura ?? null,
        mapaCorporal: pr.mapaCorporal ?? null,
        criadoEm: pr.criadoEm ?? pr.date ?? null,
        atualizadoEm: pr.atualizadoEm ?? null,
      }
    })

    const payload = {
      exportInfo: {
        sistema: 'PetVet — Salgueiro Systems',
        versao: '1.0',
        dataExportacao: new Date().toISOString(),
        totalRegistros: registros.length,
        exportadoPor: user?.name ?? 'Admin',
      },
      prontuarios: registros,
    }

    const blob = new Blob(['﻿' + JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prontuarios_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setExportSuccess(registros.length)
    setShowExportModal(false)
    setExportConfirmed(false)
    setExportFiltro({ tipo: 'todos', de: '', ate: '', petId: '', vetId: '' })
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const json = JSON.parse(ev.target.result.replace(/^﻿/, ''))
        if (json?.exportInfo?.sistema !== 'PetVet — Salgueiro Systems') {
          alert('Arquivo inválido: não é um export do sistema PetVet.')
          return
        }
        setImportData(json)
        setImportMode('novos')
        setShowImportModal(true)
      } catch {
        alert('Erro ao ler o arquivo. Verifique se é um JSON válido exportado pelo PetVet.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function confirmarImportacao() {
    if (!importData) return
    const allPets = [...PETS, ...(Array.isArray(petsLS) ? petsLS.filter(p => !PETS.find(mp => mp.id === p.id)) : [])]
    const allTutores = [...TUTORES, ...(Array.isArray(tutoresLS) ? tutoresLS.filter(t => !TUTORES.find(mt => mt.id === t.id)) : [])]

    const novosProts = importData.prontuarios ?? []
    const existingIds = new Set(prontuarios.map(p => p.id))

    let importados = 0
    let pulados = 0
    const toAdd = []
    const toUpdate = []

    for (const reg of novosProts) {
      const existe = existingIds.has(reg.id)
      if (importMode === 'novos' && existe) { pulados++; continue }
      if (importMode === 'tudo' || importMode === 'sobrescrever') {
        if (existe && importMode === 'sobrescrever') {
          toUpdate.push(reg)
        } else if (!existe) {
          toAdd.push(reg)
        } else {
          toAdd.push(reg)
        }
      } else {
        toAdd.push(reg)
      }
      importados++
    }

    const flat = pr => ({
      id: pr.id,
      date: pr.data,
      tipoConsulta: pr.tipo ?? 'Consulta',
      status: pr.status ?? 'finalizado',
      petId: pr.paciente?.id ?? '',
      vetId: pr.veterinario?.id ?? '',
      anamnese: pr.anamnese ?? {},
      derma: pr.derma ?? {},
      cannabis: pr.cannabis ?? {},
      vitals: pr.sinaisVitais ?? {},
      examesFisicos: pr.exameFisico ?? {},
      vacinas: pr.vacinas ?? [],
      aplicacoes: pr.aplicacoes ?? [],
      cirurgia: pr.procedimentosCirurgicos ?? {},
      solicitacaoExames: pr.solicitacaoExames ?? {},
      diagnostico: pr.diagnostico ?? {},
      prescricao: pr.prescricao ?? [],
      anexos: pr.anexos ?? [],
      assinatura: pr.assinatura ?? null,
      mapaCorporal: pr.mapaCorporal ?? null,
      criadoEm: pr.criadoEm ?? null,
      atualizadoEm: new Date().toISOString(),
    })

    setProntuarios(prev => {
      const updated = importMode === 'sobrescrever'
        ? prev.map(p => { const u = toUpdate.find(r => r.id === p.id); return u ? flat(u) : p })
        : prev
      return [...updated, ...toAdd.map(flat)]
    })

    // Import pets/tutores not in system
    const existingPetIds = new Set(allPets.map(p => p.id))
    const existingTutorIds = new Set(allTutores.map(t => t.id))
    const newPets = []
    const newTutores = []
    for (const reg of novosProts) {
      if (reg.paciente?.id && !existingPetIds.has(reg.paciente.id)) {
        newPets.push({ id: reg.paciente.id, name: reg.paciente.nome ?? '', species: reg.paciente.especie ?? '', breed: reg.paciente.raca ?? '', sex: reg.paciente.sexo ?? '', color: reg.paciente.cor ?? '', weight: reg.paciente.peso ?? '', birthDate: reg.paciente.dataNascimento ?? '', microchip: reg.paciente.microchip ?? '', tutorId: reg.tutor?.id ?? '' })
        existingPetIds.add(reg.paciente.id)
      }
      if (reg.tutor?.id && !existingTutorIds.has(reg.tutor.id)) {
        newTutores.push({ id: reg.tutor.id, name: reg.tutor.nome ?? '', cpf: reg.tutor.cpf ?? '', rg: reg.tutor.rg ?? '', phone: reg.tutor.telefone ?? '', email: reg.tutor.email ?? '', address: reg.tutor.endereco ?? '' })
        existingTutorIds.add(reg.tutor.id)
      }
    }
    if (newPets.length > 0) setPetsLS(prev => [...(Array.isArray(prev) ? prev : []), ...newPets])
    if (newTutores.length > 0) setTutoresLS(prev => [...(Array.isArray(prev) ? prev : []), ...newTutores])

    setImportSuccess({ importados, pulados })
    setShowImportModal(false)
    setImportData(null)
  }

  // LIST VIEW
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Prontuários</h2>
          <p className="page-subtitle">{prontuarios.length} registros clínicos</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={() => setShowFichasModal(true)}>
            📄 Fichas para preenchimento
          </button>
          {hasRole('admin') && (
            <>
              <button className="btn btn-outline btn-sm" onClick={() => { setShowExportModal(true); setExportConfirmed(false); setExportSuccess(null) }}>
                📥 Exportar prontuários
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => importFileRef.current?.click()}>
                📤 Importar prontuários
              </button>
              <input ref={importFileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />
            </>
          )}
          {hasRole('admin', 'veterinario') && (
            <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Novo Prontuário</button>
          )}
        </div>
      </div>

      {/* Modal: Fichas para preenchimento manual */}
      {showFichasModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, width: 480, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>Fichas para Preenchimento Manual</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => { setShowFichasModal(false); setFichasTab('imprimir'); setFichasWa({ petId: '', tipo: null, msg: '' }) }}><X size={18} /></button>
            </div>

            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: 6, background: 'var(--background)', borderRadius: 10, padding: 4 }}>
              {[
                { id: 'imprimir', label: '🖨️ Imprimir / PDF' },
                { id: 'whatsapp', label: '📱 Enviar pelo WhatsApp' },
              ].map(t => (
                <button key={t.id} onClick={() => setFichasTab(t.id)}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                    background: fichasTab === t.id ? 'var(--surface)' : 'transparent',
                    color: fichasTab === t.id ? 'var(--teal)' : 'var(--text-muted)',
                    boxShadow: fichasTab === t.id ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s' }}>
                  {t.label}
                </button>
              ))}
            </div>

            {fichasTab === 'imprimir' && (
              <>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                  Selecione a ficha desejada. O documento será aberto em nova janela para impressão ou salvar como PDF.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { tipo: 'anamnese', label: '📋 Ficha de Anamnese',    desc: 'Campos gerais da consulta clínica' },
                    { tipo: 'derma',    label: '🔬 Ficha Dermatológica',   desc: 'Anamnese derma, mapa corporal e exames' },
                    { tipo: 'cannabis', label: '🌿 Ficha Canábica',        desc: 'Anamnese, triagem e histórico terapêutico' },
                  ].map(({ tipo, label, desc }) => (
                    <button key={tipo} className="btn btn-outline" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px', gap: 12, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
                      onClick={() => handleOpenFicha(tipo)}>
                      <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{label}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>{desc}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {fichasTab === 'whatsapp' && (() => {
              const allPets = Array.isArray(petsLS) ? petsLS : PETS
              const allTutores = Array.isArray(tutoresLS) ? tutoresLS : TUTORES
              const sortedPets = [...allPets].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR'))
              const filteredWaPets = fichasWaSearch.trim()
                ? sortedPets.filter(p => {
                    const t = allTutores.find(tt => tt.id === p.tutorId)
                    return normIncludes(p.name ?? '', fichasWaSearch) || normIncludes(t?.name ?? '', fichasWaSearch)
                  })
                : sortedPets
              const waPet = allPets.find(p => p.id === fichasWa.petId)
              const waTutor = waPet ? allTutores.find(t => t.id === waPet.tutorId) : null
              return (
                <>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Pet</label>
                    <input className="form-input" placeholder="Digite o nome do pet ou tutor..."
                      value={fichasWaSearch} onChange={e => setFichasWaSearch(e.target.value)}
                      style={{ marginBottom: 4 }} />
                    <select className="form-input" value={fichasWa.petId}
                      onChange={e => {
                        const pet = sortedPets.find(p => p.id === e.target.value)
                        setFichasWa(s => ({ ...s, petId: e.target.value, tipo: null, msg: '' }))
                        if (pet) setFichasWaSearch(pet.name)
                      }}>
                      <option value="">Selecione um pet...</option>
                      {filteredWaPets.map(p => {
                        const t = allTutores.find(tt => tt.id === p.tutorId)
                        return <option key={p.id} value={p.id}>{p.name}{t ? ` — ${t.name}` : ''}</option>
                      })}
                    </select>
                    {fichasWaSearch.trim() && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {filteredWaPets.length} pet{filteredWaPets.length !== 1 ? 's' : ''} encontrado{filteredWaPets.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {waTutor && (
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                        Tutor: <strong>{waTutor.name}</strong>{waTutor.phone ? ` · ${waTutor.phone}` : ''}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>Selecione a ficha:</span>
                    {[
                      { tipo: 'anamnese', label: '📋 Anamnese' },
                      { tipo: 'derma',    label: '🔬 Dermatológica' },
                      { tipo: 'cannabis', label: '🌿 Canábica' },
                    ].map(({ tipo, label }) => (
                      <button key={tipo} className={`btn ${fichasWa.tipo === tipo ? 'btn-primary' : 'btn-outline'}`}
                        style={{ justifyContent: 'flex-start' }}
                        disabled={!fichasWa.petId}
                        onClick={() => handleGenerateFichaWa(tipo)}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {fichasWa.msg && (
                    <>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Mensagem (editável)</label>
                        <textarea className="form-textarea" rows={8}
                          style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem' }}
                          value={fichasWa.msg}
                          onChange={e => setFichasWa(s => ({ ...s, msg: e.target.value }))} />
                      </div>
                      <button className="btn btn-primary" style={{ gap: 8 }}
                        onClick={handleSendFichaWa}>
                        📱 Enviar para {waTutor?.name ?? 'tutor'}
                      </button>
                    </>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {filterPet && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--teal-light)', borderRadius: 8, border: '1px solid var(--teal)' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--teal-dark)', fontWeight: 600 }}>Filtrando: {filterPet.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setFilterPetId(null)} style={{ marginLeft: 'auto', color: 'var(--teal-dark)' }}>Limpar filtro</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, maxWidth: 560 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-input" style={{ paddingLeft: 38 }} placeholder="Buscar por pet, veterinário ou diagnóstico" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {[
                { field: 'date', label: 'Data' },
                { field: null,   label: 'Status' },
                { field: 'tipo', label: 'Tipo' },
                { field: 'pet',  label: 'Pet' },
                { field: null,   label: 'Espécie' },
                { field: null,   label: 'Tutor' },
                { field: 'vet',  label: 'Veterinário' },
                { field: null,   label: 'Diagnóstico' },
                { field: null,   label: '' },
              ].map(({ field, label }) => (
                <th key={label}
                  onClick={field ? () => handleSort(field) : undefined}
                  style={field ? { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' } : { whiteSpace: 'nowrap' }}>
                  {label}
                  {field && (
                    <span style={{ marginLeft: 4, fontSize: '0.7rem', opacity: sortField === field ? 1 : 0.3 }}>
                      {sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedFiltered.map(pr => {
              const pet = getPetById(pr.petId)
              const tutor = pet ? getTutorById(pet.tutorId) : null
              const vet = findVetById(pr.vetId)
              return (
                <tr key={pr.id} style={{ cursor: 'pointer' }} onClick={() => { setSelectedPr(pr); setForm({ ...EMPTY_FORM, ...pr, vitals: { ...EMPTY_FORM.vitals, ...(pr.vitals ?? {}) }, anamnese: { ...EMPTY_FORM.anamnese, ...(pr.anamnese ?? {}) }, derma: { ...EMPTY_FORM.derma, ...(pr.derma ?? {}) }, cannabis: { ...EMPTY_FORM.cannabis, ...(pr.cannabis ?? {}) }, solicitacaoExames: pr.solicitacaoExames ?? {}, anexos: pr.anexos ?? [] }); setSignatureData(pr.assinatura); setActiveSection('tipo'); setView('form') }}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(pr.date + 'T00:00').toLocaleDateString('pt-BR')}</td>
                  <td>
                    <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', background: STATUS_COLOR[pr.status ?? 'aguardando'] ?? '#888', color: '#fff' }}>
                      {STATUS_LABEL[pr.status ?? 'aguardando'] ?? pr.status ?? 'Aguardando'}
                    </span>
                  </td>
                  <td><span className="badge badge-neutral" style={{ whiteSpace: 'nowrap' }}>{pr.tipoConsulta ?? 'Consulta'}</span></td>
                  <td style={{ fontWeight: 600 }}>{pet?.name ?? '—'}</td>
                  <td>{pet?.species ?? '—'}</td>
                  <td>{tutor?.name ?? '—'}</td>
                  <td>{vet?.name ?? '—'}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pr.diagnostico?.definitivo || pr.diagnostico?.presuntivo || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                      {hasRole('admin', 'veterinario') && (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: '2px 4px' }} onClick={e => { e.stopPropagation(); setDeleteTarget(pr) }}><X size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Success banners */}
      {exportSuccess !== null && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--success, #22c55e)', color: '#fff', padding: '12px 24px', borderRadius: 12, fontWeight: 600, zIndex: 2000, boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', gap: 12 }}>
          ✅ {exportSuccess} prontuário{exportSuccess !== 1 ? 's' : ''} exportado{exportSuccess !== 1 ? 's' : ''} com sucesso — arquivo salvo em Downloads
          <button onClick={() => setExportSuccess(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: 8, fontSize: '1rem' }}>✕</button>
        </div>
      )}
      {importSuccess !== null && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--success, #22c55e)', color: '#fff', padding: '12px 24px', borderRadius: 12, fontWeight: 600, zIndex: 2000, boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', gap: 12 }}>
          ✅ {importSuccess.importados} prontuário{importSuccess.importados !== 1 ? 's' : ''} importado{importSuccess.importados !== 1 ? 's' : ''} · {importSuccess.pulados} já existiam e foram pulados
          <button onClick={() => setImportSuccess(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: 8, fontSize: '1rem' }}>✕</button>
        </div>
      )}

      {/* Export modal */}
      {showExportModal && (() => {
        const allPetsEx = [...PETS, ...(Array.isArray(petsLS) ? petsLS.filter(p => !PETS.find(mp => mp.id === p.id)) : [])]
        let filtered = [...prontuarios]
        if (exportFiltro.tipo === 'periodo') {
          if (exportFiltro.de) filtered = filtered.filter(p => p.date >= exportFiltro.de)
          if (exportFiltro.ate) filtered = filtered.filter(p => p.date <= exportFiltro.ate)
        } else if (exportFiltro.tipo === 'pet' && exportFiltro.petId) {
          filtered = filtered.filter(p => p.petId === exportFiltro.petId)
        } else if (exportFiltro.tipo === 'vet' && exportFiltro.vetId) {
          filtered = filtered.filter(p => p.vetId === exportFiltro.vetId)
        }
        const petsCount = new Set(filtered.map(p => p.petId)).size
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, width: 500, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>📥 Exportar Prontuários</h3>
                <button className="btn btn-ghost btn-icon" onClick={() => { setShowExportModal(false); setExportConfirmed(false) }}><X size={18} /></button>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Filtrar por</label>
                <select className="form-select" value={exportFiltro.tipo} onChange={e => setExportFiltro(f => ({ ...f, tipo: e.target.value, de: '', ate: '', petId: '', vetId: '' }))}>
                  <option value="todos">Todos os prontuários</option>
                  <option value="periodo">Período</option>
                  <option value="pet">Pet específico</option>
                  <option value="vet">Veterinário</option>
                </select>
              </div>

              {exportFiltro.tipo === 'periodo' && (
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="form-group" style={{ flex: 1, margin: 0 }}>
                    <label className="form-label">De</label>
                    <input className="form-input" type="date" value={exportFiltro.de} onChange={e => setExportFiltro(f => ({ ...f, de: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ flex: 1, margin: 0 }}>
                    <label className="form-label">Até</label>
                    <input className="form-input" type="date" value={exportFiltro.ate} onChange={e => setExportFiltro(f => ({ ...f, ate: e.target.value }))} />
                  </div>
                </div>
              )}

              {exportFiltro.tipo === 'pet' && (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Pet</label>
                  <select className="form-select" value={exportFiltro.petId} onChange={e => setExportFiltro(f => ({ ...f, petId: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {[...allPetsEx].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR')).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {exportFiltro.tipo === 'vet' && (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Veterinário</label>
                  <select className="form-select" value={exportFiltro.vetId} onChange={e => setExportFiltro(f => ({ ...f, vetId: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {getVeterinarios().map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ background: 'var(--background)', borderRadius: 10, padding: '10px 14px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong> prontuário{filtered.length !== 1 ? 's' : ''} de <strong style={{ color: 'var(--text)' }}>{petsCount}</strong> pet{petsCount !== 1 ? 's' : ''} serão exportados
              </div>

              <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 10, padding: '10px 14px', fontSize: '0.8125rem', color: '#713f12' }}>
                <strong>⚠️ Aviso LGPD:</strong> O arquivo exportado contém dados pessoais de tutores e histórico clínico dos animais. Guarde com segurança, não compartilhe com terceiros não autorizados e mantenha em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018).
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: '0.875rem' }}>
                <input type="checkbox" checked={exportConfirmed} onChange={e => setExportConfirmed(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
                Declaro que estou ciente das responsabilidades sobre o tratamento dos dados exportados conforme a LGPD.
              </label>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => { setShowExportModal(false); setExportConfirmed(false) }}>Cancelar</button>
                <button className="btn btn-primary" disabled={!exportConfirmed || filtered.length === 0} onClick={() => exportarProntuarios(filtered)}>
                  📥 Exportar {filtered.length > 0 ? `(${filtered.length})` : ''}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Import modal */}
      {showImportModal && importData && (() => {
        const prots = importData.prontuarios ?? []
        const petsCount = new Set(prots.map(p => p.paciente?.id).filter(Boolean)).size
        const existingIds = new Set(prontuarios.map(p => p.id))
        const novos = prots.filter(p => !existingIds.has(p.id)).length
        const existentes = prots.length - novos
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, width: 480, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: 'var(--shadow-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>📤 Importar Prontuários</h3>
                <button className="btn btn-ghost btn-icon" onClick={() => { setShowImportModal(false); setImportData(null) }}><X size={18} /></button>
              </div>

              <div style={{ background: 'var(--background)', borderRadius: 10, padding: '10px 14px', fontSize: '0.875rem' }}>
                <div><strong>{prots.length}</strong> prontuário{prots.length !== 1 ? 's' : ''} encontrado{prots.length !== 1 ? 's' : ''} de <strong>{petsCount}</strong> pet{petsCount !== 1 ? 's' : ''} diferentes</div>
                <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                  Exportado em {importData.exportInfo?.dataExportacao ? new Date(importData.exportInfo.dataExportacao).toLocaleString('pt-BR') : '—'} · {novos} novo{novos !== 1 ? 's' : ''} · {existentes} já existente{existentes !== 1 ? 's' : ''}
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Modo de importação</label>
                <select className="form-select" value={importMode} onChange={e => setImportMode(e.target.value)}>
                  <option value="novos">Apenas novos (pular existentes)</option>
                  <option value="tudo">Importar tudo (adicionar duplicados)</option>
                  <option value="sobrescrever">Sobrescrever existentes</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => { setShowImportModal(false); setImportData(null) }}>Cancelar</button>
                <button className="btn btn-primary" onClick={confirmarImportacao}>📤 Importar</button>
              </div>
            </div>
          </div>
        )
      })()}

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => { setProntuarios(prev => prev.filter(p => p.id !== deleteTarget.id)); setDeleteTarget(null) }}
        message={`Excluir prontuário de ${getPetById(deleteTarget?.petId)?.name ?? 'este pet'} em ${deleteTarget?.date ? new Date(deleteTarget.date + 'T00:00').toLocaleDateString('pt-BR') : ''}? Esta ação não pode ser desfeita.`} />
    </div>
  )
}

// ---- Helpers ----
function fmtMapa(m) { return m ? m.replace(/^mapa[-\s]*/i, '') : '' }

function VitalField({ label, value, onChange, ro, placeholder, classification }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-input" type="number" step="0.1" value={value} onChange={e => onChange(e.target.value)} disabled={ro} placeholder={placeholder} />
      {classification && (
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: classification.color, marginTop: 4, display: 'block' }}>
          ● {classification.label}
        </span>
      )}
    </div>
  )
}

function SelectField({ label, value, onChange, ro, options }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <select className="form-select" value={value} onChange={e => onChange(e.target.value)} disabled={ro}>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  )
}

// ---- Solicitação de Exames ----
function countGroup(g, value) {
  if (g.layout === 'endocrinologia')
    return (g.hormones ?? []).reduce((a, h) => a + (g.methods ?? []).filter(m => value[`endo_${h.id}_${m}`]).length, 0)
      + (value['endo_painel_red'] ? 1 : 0) + (value['endo_painel_comp'] ? 1 : 0)
      + (value['endo_outro_exame'] ? 1 : 0)
  if (g.layout === 'pcr')
    return ['pcr_agente', 'pcr_agente_quant', 'pcr_painel'].filter(k => value[k]).length
  if (g.layout === 'radiografico')
    return (g.regions ?? []).reduce((a, r) => a + r.positions.filter(p => value[`${r.id}__${p}`]).length, 0)
  if (g.layout === 'citologia')
    return (g.items ?? []).filter(i => {
      if (i.type === 'check+subs') return (i.subs ?? []).some(s => value[`${i.id}__${s.id}`])
      return value[i.id]
    }).length
  return (g.items ?? []).filter(i => value[i.id]).length
}

function SolicitacaoExames({ value, onChange, ro, petInfo, tutorInfo, vetInfo, consultaDate, onAddAnexo }) {
  const [openGroups, setOpenGroups] = useState({})
  const [savedMsg, setSavedMsg] = useState(false)
  const toggle = id => setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }))
  const totalChecked = EXAM_GROUPS.reduce((a, g) => a + countGroup(g, value), 0)

  function printExames() {
    const dateStr = consultaDate ? new Date(consultaDate + 'T00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')
    const selectedGroups = EXAM_GROUPS.filter(g => countGroup(g, value) > 0)
    function getSelectedItems(group) {
      function extrasLines() {
        return (group.extras ?? []).flatMap(extra => {
          if (extra.type === 'check') return []
          const v = value[extra.id]
          return v ? [`${extra.label}: ${v}`] : []
        })
      }
      if (group.layout === 'horizontal' || !group.layout) {
        const lines = (group.items ?? []).filter(i => value[i.id]).map(i => {
          if (i.type === 'check+text') {
            const txt = typeof value[i.id] === 'string' ? value[i.id] : ''
            return txt ? `${i.label} — ${i.fieldLabel ?? 'detalhe'}: ${txt}` : i.label
          }
          if (i.type === 'check+field') {
            const fieldVal = value[`${i.id}__${i.fieldKey}`] ?? ''
            return fieldVal ? `${i.label} — ${i.fieldLabel}: ${fieldVal}` : i.label
          }
          return i.label
        })
        return [...lines, ...extrasLines()]
      }
      if (group.layout === 'citologia') {
        return (group.items ?? []).flatMap(i => {
          if (i.type === 'check+subs') {
            const selSubs = (i.subs ?? []).filter(s => value[`${i.id}__${s.id}`]).map(s => s.label)
            return selSubs.length > 0 ? [`${i.label}: ${selSubs.join(', ')}`] : []
          }
          if (i.type === 'check+diag' && value[i.id]) {
            const details = DIAG_FIELDS.flatMap(f => {
              const v = value[`${i.id}__${f.key}`]
              return v ? [`${f.label}: ${v}`] : []
            })
            return details.length > 0 ? [`${i.label} (${details.join(' | ')})`] : [i.label]
          }
          return value[i.id] ? [i.label] : []
        })
      }
      if (group.layout === 'endocrinologia') {
        const items = []
        if (value['endo_painel_red']) items.push('Painel Androgênico — Reduzido')
        if (value['endo_painel_comp']) items.push('Painel Androgênico — Completo')
        for (const h of (group.hormones ?? [])) {
          const selMethods = (group.methods ?? []).filter(m => value[`endo_${h.id}_${m}`])
          if (selMethods.length > 0) items.push(`${h.label} — ${selMethods.join(', ')}`)
        }
        const outroExame = value['endo_outro_exame']
        const outroMetodo = value['endo_outro_metodo']
        if (outroExame) items.push(outroMetodo ? `Outro: ${outroExame} — Método: ${outroMetodo}` : `Outro: ${outroExame}`)
        return items
      }
      if (group.layout === 'pcr') {
        const items = []
        if (value['pcr_agente']) items.push(`Agente Qualitativo: ${value['pcr_agente']}`)
        if (value['pcr_agente_quant']) items.push(`Agente Quantitativo: ${value['pcr_agente_quant']}`)
        if (value['pcr_painel']) items.push(`Painel: ${value['pcr_painel']}`)
        return items
      }
      if (group.layout === 'radiografico') {
        const lines = (group.regions ?? []).flatMap(r => {
          const selPos = r.positions.filter(p => value[`${r.id}__${p}`])
          return selPos.length > 0 ? [`${r.label}: ${selPos.join(', ')}`] : []
        })
        if (value['rad_suspeita']) lines.push(`Suspeita Clínica: ${value['rad_suspeita']}`)
        return lines
      }
      return []
    }
    const _clinica = (() => { try { return JSON.parse(localStorage.getItem('petvet-clinica-config') ?? 'null') } catch { return null } })() ?? {}
    const _cNome = _clinica.nome || 'Emporium Vazpet & Tatá Bichos'
    const _cEndereco = [_clinica.endereco, _clinica.telefone].filter(Boolean).join(' · ')
    const _logoHtml = [_clinica.logoEmporium, _clinica.logoTata].filter(Boolean).map(src => `<img src="${src}" style="width:50px;height:50px;object-fit:contain;" />`).join('')
    const win = window.open('', '_blank', 'width=800,height=700')
    win.document.write(`<html><head><title>Solicitação de Exames</title><style>
      body{font-family:Arial,sans-serif;padding:40px;font-size:13px;line-height:1.6;color:#111}
      h2,h3{margin:0 0 8px}hr{border:none;border-top:1px solid #ddd;margin:16px 0}
      .group{margin-bottom:14px;page-break-inside:avoid}
      .group-title{font-weight:700;font-size:14px;border-bottom:1px solid #999;padding-bottom:4px;margin-bottom:6px}
      .item{margin:2px 0;padding-left:14px}
      @media print{.no-print{display:none}}
    </style></head><body>
      <div style="text-align:center;border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:16px">
        ${_logoHtml ? `<div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:8px">${_logoHtml}</div>` : ''}
        <h2 style="font-size:1.2rem;font-weight:800;margin:0">${_cNome}</h2>
        ${_cEndereco ? `<p style="margin:4px 0 0;color:#555;font-size:12px">${_cEndereco}</p>` : ''}
      </div>
      <h3 style="text-align:center;font-size:1rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px">SOLICITAÇÃO DE EXAMES</h3>
      <p><strong>Pet:</strong> ${petInfo?.name ?? '—'} | <strong>Espécie:</strong> ${petInfo?.species ?? '—'} | <strong>Tutor:</strong> ${tutorInfo?.name ?? '—'}</p>
      <p><strong>Data:</strong> ${dateStr} | <strong>Veterinário:</strong> ${vetInfo?.name ?? '—'} | <strong>CRMV:</strong> ${vetInfo?.crmv ?? '—'}${vetInfo?.mapa ? ` | MAPA: ${fmtMapa(vetInfo.mapa)}` : ''}</p>
      <hr/>
      ${selectedGroups.map(g => {
        const items = getSelectedItems(g)
        return `<div class="group"><div class="group-title">${g.label}</div>${items.map(it => `<div class="item">✓ ${it}</div>`).join('')}</div>`
      }).join('')}
      ${value['_obs'] ? `<hr/><p><strong>Observações:</strong> ${value['_obs']}</p>` : ''}
      <div style="margin-top:40px;border-top:1px solid #333;padding-top:6px">${vetInfo?.name ?? 'Veterinário'} — CRMV: ${vetInfo?.crmv ?? '—'}${vetInfo?.mapa ? ` · MAPA: ${fmtMapa(vetInfo.mapa)}` : ''}</div>
      <script>window.onload=()=>window.print()<\/script>
    </body></html>`)
    win.document.close()
    if (onAddAnexo) {
      const conteudoHtml = `<h3 style="font-family:Arial,sans-serif;font-size:1rem;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:12px">Solicitação de Exames</h3>
<p style="font-family:Arial,sans-serif;font-size:13px;margin:0 0 4px"><strong>Pet:</strong> ${petInfo?.name ?? '—'} | <strong>Espécie:</strong> ${petInfo?.species ?? '—'} | <strong>Tutor:</strong> ${tutorInfo?.name ?? '—'}</p>
<p style="font-family:Arial,sans-serif;font-size:13px;margin:0 0 12px"><strong>Data:</strong> ${dateStr} | <strong>Veterinário:</strong> ${vetInfo?.name ?? '—'} | <strong>CRMV:</strong> ${vetInfo?.crmv ?? '—'}</p>
<hr style="border:none;border-top:1px solid #ddd;margin:12px 0"/>
${selectedGroups.map(g => {
  const items = getSelectedItems(g)
  return `<div style="margin-bottom:10px"><div style="font-family:Arial,sans-serif;font-size:13px;font-weight:700;border-bottom:1px solid #999;padding-bottom:3px;margin-bottom:5px">${g.label}</div>${items.map(it => `<div style="font-family:Arial,sans-serif;font-size:13px;margin:2px 0;padding-left:12px">✓ ${it}</div>`).join('')}</div>`
}).join('')}
${value['_obs'] ? `<hr style="border:none;border-top:1px solid #ddd;margin:12px 0"/><p style="font-family:Arial,sans-serif;font-size:13px"><strong>Observações:</strong> ${value['_obs']}</p>` : ''}`
      onAddAnexo({ nome: `Solicitação de Exames — ${dateStr}`, tipo: 'exame', conteudoHtml, dataAdicionado: new Date().toISOString() })
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2000)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {totalChecked > 0 && (
          <div style={{ flex: 1, padding: '8px 14px', background: 'var(--teal-light)', borderRadius: 8, borderLeft: '3px solid var(--teal)' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--teal-dark)', fontWeight: 600 }}>
              {totalChecked} exame{totalChecked > 1 ? 's' : ''} selecionado{totalChecked > 1 ? 's' : ''}
            </span>
          </div>
        )}
        {totalChecked > 0 && (
          <button className="btn btn-outline btn-sm no-print" onClick={printExames}><Printer size={14} /> Imprimir selecionados</button>
        )}
        {savedMsg && (
          <span style={{ fontSize: '0.8rem', color: 'var(--success, #4CAF50)', fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: 'var(--success-light, #e8f5e9)' }}>
            🔬 Salvo em Anexos ✓
          </span>
        )}
      </div>
      {EXAM_GROUPS.map(group => {
        const isOpen = openGroups[group.id]
        const gc = countGroup(group, value)
        return (
          <div key={group.id} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <button type="button" onClick={() => toggle(group.id)}
              style={{ width: '100%', padding: '11px 16px', background: isOpen ? 'var(--teal-light)' : 'var(--surface-2)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {group.label}
                {gc > 0 && <span style={{ padding: '1px 8px', borderRadius: 99, background: 'var(--teal)', color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>{gc}</span>}
              </span>
              <ChevronDown size={15} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: '150ms', color: 'var(--text-muted)', flexShrink: 0 }} />
            </button>
            {isOpen && (
              <div style={{ padding: '14px 16px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
                <GroupContent group={group} value={value} onChange={onChange} ro={ro} />
              </div>
            )}
          </div>
        )
      })}
      <div className="form-group" style={{ marginTop: 6 }}>
        <label className="form-label">Observações</label>
        <textarea className="form-textarea" value={value['_obs'] ?? ''} onChange={e => !ro && onChange('_obs', e.target.value)} disabled={ro}
          placeholder="Observações gerais sobre os exames solicitados..." style={{ resize: 'none', overflowY: 'auto', maxHeight: 120, minHeight: 64 }} />
      </div>
    </div>
  )
}

function GroupContent({ group, value, onChange, ro }) {
  if (group.layout === 'horizontal') return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
      {group.items.map(item => <CheckItem key={item.id} item={item} value={value} onChange={onChange} ro={ro} />)}
    </div>
  )
  if (group.layout === 'citologia')    return <CitologiaContent    group={group} value={value} onChange={onChange} ro={ro} />
  if (group.layout === 'endocrinologia') return <EndocrinologiaContent group={group} value={value} onChange={onChange} ro={ro} />
  if (group.layout === 'pcr')          return <PCRContent          group={group} value={value} onChange={onChange} ro={ro} />
  if (group.layout === 'radiografico') return <RadiograficoContent group={group} value={value} onChange={onChange} ro={ro} />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 4 }}>
        {group.items.map(item => <CheckItem key={item.id} item={item} value={value} onChange={onChange} ro={ro} />)}
      </div>
      {(group.extras ?? []).map(extra => <ExtraField key={extra.id} extra={extra} value={value} onChange={onChange} ro={ro} />)}
    </div>
  )
}

function CheckItem({ item, value, onChange, ro }) {
  const checked = !!value[item.id]
  if (item.type === 'check+text') {
    return (
      <div style={{ padding: '6px 8px', borderRadius: 6, background: checked ? 'var(--teal-light)' : 'transparent' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: ro ? 'default' : 'pointer', fontSize: '0.8125rem' }}>
          <input type="checkbox" checked={checked} onChange={e => !ro && onChange(item.id, e.target.checked ? (value[item.id] || true) : false)}
            style={{ accentColor: 'var(--teal)', width: 14, height: 14, flexShrink: 0 }} />
          <span style={{ color: checked ? 'var(--teal-dark)' : 'var(--text-primary)', fontWeight: checked ? 600 : 400 }}>{item.label}</span>
        </label>
        {checked && (
          <input className="form-input" style={{ marginTop: 6, marginLeft: 22, fontSize: '0.8rem', padding: '4px 8px' }}
            value={typeof value[item.id] === 'string' ? value[item.id] : ''}
            onChange={e => !ro && onChange(item.id, e.target.value || true)}
            disabled={ro} placeholder={item.fieldLabel ?? 'Especificar...'} />
        )}
      </div>
    )
  }
  if (item.type === 'check+field') {
    return (
      <div style={{ padding: '6px 8px', borderRadius: 6, background: checked ? 'var(--teal-light)' : 'transparent', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: ro ? 'default' : 'pointer', fontSize: '0.8125rem', flex: '0 0 auto' }}>
          <input type="checkbox" checked={checked} onChange={e => !ro && onChange(item.id, e.target.checked)}
            style={{ accentColor: 'var(--teal)', width: 14, height: 14 }} />
          <span style={{ color: checked ? 'var(--teal-dark)' : 'var(--text-primary)', fontWeight: checked ? 600 : 400 }}>{item.label}</span>
        </label>
        {checked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.fieldLabel}:</span>
            <input className="form-input" style={{ width: 80, fontSize: '0.8rem', padding: '3px 6px' }}
              value={value[`${item.id}__${item.fieldKey}`] ?? ''}
              onChange={e => !ro && onChange(`${item.id}__${item.fieldKey}`, e.target.value)}
              disabled={ro} placeholder="—" />
          </div>
        )}
      </div>
    )
  }
  if (item.type === 'check+subs') {
    return (
      <div style={{ gridColumn: '1 / -1', padding: '10px 12px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--teal-dark)', margin: '0 0 8px' }}>{item.label}:</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(item.subs ?? []).map(sub => {
            const k = `${item.id}__${sub.id}`
            const sc = !!value[k]
            return (
              <label key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: ro ? 'default' : 'pointer', fontSize: '0.8rem', padding: '4px 12px', borderRadius: 99, border: `1.5px solid ${sc ? 'var(--teal)' : 'var(--border)'}`, background: sc ? 'var(--teal-light)' : 'var(--surface)' }}>
                <input type="checkbox" checked={sc} onChange={e => !ro && onChange(k, e.target.checked)}
                  style={{ accentColor: 'var(--teal)', width: 12, height: 12 }} />
                <span style={{ color: sc ? 'var(--teal-dark)' : 'var(--text-secondary)', fontWeight: sc ? 600 : 400 }}>{sub.label}</span>
              </label>
            )
          })}
        </div>
      </div>
    )
  }
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: ro ? 'default' : 'pointer', fontSize: '0.8125rem', padding: '6px 8px', borderRadius: 6, background: checked ? 'var(--teal-light)' : 'transparent' }}>
      <input type="checkbox" checked={checked} onChange={e => !ro && onChange(item.id, e.target.checked)}
        style={{ accentColor: 'var(--teal)', width: 14, height: 14, flexShrink: 0 }} />
      <span style={{ color: checked ? 'var(--teal-dark)' : 'var(--text-primary)', fontWeight: checked ? 600 : 400 }}>{item.label}</span>
    </label>
  )
}

function ExtraField({ extra, value, onChange, ro }) {
  if (extra.type === 'check') {
    const checked = !!value[extra.id]
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: ro ? 'default' : 'pointer', fontSize: '0.8125rem', padding: '6px 10px', borderRadius: 6, background: checked ? 'var(--teal-light)' : 'var(--surface-2)' }}>
        <input type="checkbox" checked={checked} onChange={e => !ro && onChange(extra.id, e.target.checked)}
          style={{ accentColor: 'var(--teal)', width: 14, height: 14 }} />
        <span style={{ color: checked ? 'var(--teal-dark)' : 'var(--text-primary)', fontWeight: checked ? 600 : 400 }}>{extra.label}</span>
      </label>
    )
  }
  if (extra.type === 'select') return (
    <div className="form-group" style={{ maxWidth: 340 }}>
      <label className="form-label">{extra.label}</label>
      <select className="form-select" value={value[extra.id] ?? ''} onChange={e => !ro && onChange(extra.id, e.target.value)} disabled={ro}>
        <option value="">— Selecione —</option>
        {(extra.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  )
  if (extra.type === 'textarea') return (
    <div className="form-group">
      <label className="form-label">{extra.label}</label>
      <textarea className="form-textarea" value={value[extra.id] ?? ''} onChange={e => !ro && onChange(extra.id, e.target.value)} disabled={ro}
        placeholder={`${extra.label}...`} style={{ resize: 'none', overflowY: 'auto', minHeight: 64, maxHeight: 120 }} />
    </div>
  )
  return (
    <div className="form-group" style={{ maxWidth: 420 }}>
      <label className="form-label">{extra.label}</label>
      <input className="form-input" value={value[extra.id] ?? ''} onChange={e => !ro && onChange(extra.id, e.target.value)} disabled={ro} placeholder={`${extra.label}...`} />
    </div>
  )
}

const DIAG_FIELDS = [
  { key: 'n', label: 'Nº' }, { key: 'tipo', label: 'Tipo' }, { key: 'metodo', label: 'Método' },
  { key: 'local', label: 'Local' }, { key: 'tamanho', label: 'Tamanho' },
  { key: 'tempo', label: 'Tempo de Evolução' }, { key: 'ulcera', label: 'Ulcerações' },
  { key: 'laminas', label: 'Nº Lâminas' },
]

function CitologiaContent({ group, value, onChange, ro }) {
  const simpleItems = (group.items ?? []).filter(i => !i.type || (i.type !== 'check+subs' && i.type !== 'check+diag'))
  const subsItems   = (group.items ?? []).filter(i => i.type === 'check+subs')
  const diagItems   = (group.items ?? []).filter(i => i.type === 'check+diag')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 4 }}>
        {simpleItems.map(item => <CheckItem key={item.id} item={item} value={value} onChange={onChange} ro={ro} />)}
        {subsItems.map(item => <CheckItem key={item.id} item={item} value={value} onChange={onChange} ro={ro} />)}
      </div>
      {diagItems.map(item => {
        const checked = !!value[item.id]
        return (
          <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: ro ? 'default' : 'pointer', fontSize: '0.8125rem', padding: '10px 14px', background: checked ? 'var(--teal-light)' : 'var(--surface-2)', fontWeight: 600 }}>
              <input type="checkbox" checked={checked} onChange={e => !ro && onChange(item.id, e.target.checked)}
                style={{ accentColor: 'var(--teal)', width: 14, height: 14 }} />
              <span style={{ color: checked ? 'var(--teal-dark)' : 'var(--text-primary)' }}>{item.label}</span>
            </label>
            {checked && (
              <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px 12px' }}>
                {DIAG_FIELDS.map(f => (
                  <div key={f.key} className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>{f.label}</label>
                    <input className="form-input" style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                      value={value[`${item.id}__${f.key}`] ?? ''}
                      onChange={e => !ro && onChange(`${item.id}__${f.key}`, e.target.value)}
                      disabled={ro} placeholder="—" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function EndocrinologiaContent({ group, value, onChange, ro }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 700, color: 'var(--text-primary)' }}>Hormônio / Exame</th>
              {(group.methods ?? []).map(m => (
                <th key={m} style={{ padding: '8px 16px', textAlign: 'center', borderBottom: '1px solid var(--border)', fontWeight: 700, color: 'var(--teal-dark)', whiteSpace: 'nowrap' }}>{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(group.hormones ?? []).map((h, idx) => (
              <tr key={h.id} style={{ background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{h.label}</td>
                {(group.methods ?? []).map(m => {
                  const k = `endo_${h.id}_${m}`
                  return (
                    <td key={m} style={{ padding: '7px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <input type="checkbox" checked={!!value[k]} onChange={e => !ro && onChange(k, e.target.checked)}
                        style={{ accentColor: 'var(--teal)', width: 15, height: 15, cursor: ro ? 'default' : 'pointer' }} disabled={ro} />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
        {(group.extras ?? []).map(extra => <ExtraField key={extra.id} extra={extra} value={value} onChange={onChange} ro={ro} />)}
      </div>
    </div>
  )
}

function PCRContent({ value, onChange, ro }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
        <div className="form-group">
          <label className="form-label">Agente — Qualitativo</label>
          <input className="form-input" value={value['pcr_agente'] ?? ''} onChange={e => !ro && onChange('pcr_agente', e.target.value)} disabled={ro} placeholder="Nome do agente..." />
        </div>
        <div className="form-group">
          <label className="form-label">Agente — Quantitativo</label>
          <input className="form-input" value={value['pcr_agente_quant'] ?? ''} onChange={e => !ro && onChange('pcr_agente_quant', e.target.value)} disabled={ro} placeholder="Nome do agente..." />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Painel</label>
        <input className="form-input" value={value['pcr_painel'] ?? ''} onChange={e => !ro && onChange('pcr_painel', e.target.value)} disabled={ro} placeholder="Nome do painel..." />
      </div>
      <div style={{ padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Respeitar 21 dias pós-vacinação. Em dúvida sobre painéis disponíveis, consultar o AlchemyPet.
      </div>
    </div>
  )
}

function RadiograficoContent({ group, value, onChange, ro }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {(group.regions ?? []).map(region => {
        const anyChecked = region.positions.some(p => value[`${region.id}__${p}`])
        return (
          <div key={region.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 12px', borderRadius: 6, background: anyChecked ? 'var(--teal-light)' : 'var(--surface-2)', border: `1px solid ${anyChecked ? 'var(--teal)' : 'var(--border)'}` }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: anyChecked ? 'var(--teal-dark)' : 'var(--text-primary)', minWidth: 190, flexShrink: 0 }}>{region.label}</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {region.positions.map(pos => {
                const k = `${region.id}__${pos}`
                const checked = !!value[k]
                return (
                  <label key={pos} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: ro ? 'default' : 'pointer', fontSize: '0.8rem', padding: '3px 10px', borderRadius: 99, border: `1.5px solid ${checked ? 'var(--teal)' : 'var(--border)'}`, background: checked ? 'var(--teal)' : 'var(--surface)' }}>
                    <input type="checkbox" checked={checked} onChange={e => !ro && onChange(k, e.target.checked)}
                      style={{ accentColor: 'var(--teal)', width: 12, height: 12 }} />
                    <span style={{ color: checked ? '#fff' : 'var(--text-secondary)', fontWeight: checked ? 700 : 400 }}>{pos}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}
      <div className="form-group" style={{ marginTop: 6 }}>
        <label className="form-label">Suspeita Clínica / Histórico</label>
        <textarea className="form-textarea" value={value['rad_suspeita'] ?? ''} onChange={e => !ro && onChange('rad_suspeita', e.target.value)} disabled={ro}
          placeholder="Descrever suspeita clínica e histórico relevante..." style={{ resize: 'none', overflowY: 'auto', minHeight: 64, maxHeight: 120 }} />
      </div>
    </div>
  )
}

// ---- Manual de Coleta ----
function ManualColeta() {
  const H3 = ({ children }) => (
    <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px', paddingBottom: 8, borderBottom: '2px solid var(--teal-light)' }}>{children}</h3>
  )
  const H5 = ({ children }) => (
    <h5 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>{children}</h5>
  )
  const P = ({ children }) => (
    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{children}</p>
  )
  const Tube = ({ color, label }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 10px', borderRadius: 99, border: `2px solid ${color}`, fontSize: '0.75rem', fontWeight: 700, color, background: color + '18', marginBottom: 8 }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
  const Card = ({ children }) => (
    <div style={{ padding: '14px', background: 'var(--surface-2)', borderRadius: 10 }}>{children}</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, borderLeft: '3px solid var(--teal)' }}>
        <P>Manual de referência para coleta de material biológico. Uso interno — todas as coletas devem ser realizadas por profissional habilitado, com EPI adequado.</P>
      </div>

      {/* 1. Hematologia */}
      <section>
        <H3>1. Hematologia</H3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
          <Card>
            <Tube color="#9B59B6" label="Tubo Roxo — EDTA" />
            <H5>Volume: 2 mL mínimo</H5>
            <P>Homogeneizar por inversão 8–10× imediatamente após coleta. Aves e répteis: tubo Verde (Heparina Lítio). Estável até 12 h em temperatura ambiente ou 24 h refrigerado (2–8°C). Enviar sem centrifugar.</P>
          </Card>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <svg viewBox="0 0 100 170" width="70" height="119" xmlns="http://www.w3.org/2000/svg">
                <path d="M 38 15 C 32 25 30 50 30 80 L 30 145 C 30 152 35 156 40 156 L 60 156 C 65 156 70 152 70 145 L 70 80 C 70 50 68 25 62 15 Z" fill="rgba(155,89,182,0.12)" stroke="#9B59B6" strokeWidth="1.5"/>
                <rect x="30" y="34" width="40" height="5" rx="2" fill="rgba(155,89,182,0.5)" stroke="#9B59B6" strokeWidth="1"/>
                <path d="M 50 41 L 50 105" stroke="#DE098D" strokeWidth="2" fill="none" strokeDasharray="4,3"/>
                <circle cx="50" cy="65" r="5" fill="#DE098D" opacity="0.85"/>
              </svg>
            </div>
            <H5>Veia Cefálica</H5>
            <P>Rotina em cães. Membro anterior estendido, compressão proximal ao antebraço. Agulha 21–23G a 15–20°.</P>
          </Card>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <svg viewBox="0 0 120 130" width="90" height="98" xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="60" cy="36" rx="30" ry="26" fill="rgba(155,89,182,0.1)" stroke="#9B59B6" strokeWidth="1.5"/>
                <path d="M 44 58 L 38 120 M 76 58 L 82 120" stroke="#9B59B6" strokeWidth="1.5" fill="none"/>
                <path d="M 58 64 Q 56 86 54 112" stroke="#DE098D" strokeWidth="2.5" fill="none" strokeDasharray="4,3"/>
                <circle cx="55" cy="88" r="5" fill="#DE098D" opacity="0.85"/>
              </svg>
            </div>
            <H5>Veia Jugular</H5>
            <P>Eleição em gatos e volumes maiores. Cabeça em extensão, compressão na base do pescoço. Agulha 22–23G a 45°.</P>
          </Card>
          <Card>
            <H5>Veia Safena</H5>
            <P>Alternativa quando cefálica/jugular indisponíveis. Decúbito lateral, compressão acima do jarrete. Agulha 21–23G no sentido cranial-caudal.</P>
          </Card>
        </div>
      </section>

      {/* 2. Bioquímica / Imunologia / Hormônios */}
      <section>
        <H3>2. Bioquímica Sérica / Imunologia / Hormônios</H3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
          <Card>
            <Tube color="#E74C3C" label="Tubo Vermelho / Amarelo" />
            <H5>Volume: 3 mL mínimo</H5>
            <P>Para glicemia: usar tubo Cinza (Fluoreto de Sódio). Aguardar coagulação 20–30 min na posição vertical antes de centrifugar. Soro pode ser refrigerado 24–48 h ou congelado &minus;20°C por até 30 dias.</P>
          </Card>
        </div>
      </section>

      {/* 3. Coagulação */}
      <section>
        <H3>3. Coagulação (TP + TTPA)</H3>
        <Card>
          <Tube color="#3498DB" label="Tubo Azul — Citrato de Sódio" />
          <P>Volume mínimo: 3 mL. Relação sangue:anticoagulante 9:1 — não encher além do volume marcado. Homogeneizar por inversão 8–10×. Refrigerar e enviar em até 4 h após coleta. Processamento imediato é ideal.</P>
        </Card>
      </section>

      {/* 4. Urinálise / Cultura */}
      <section>
        <H3>4. Urinálise / Cultura de Urina</H3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
          <Card>
            <H5>Cistocentese (padrão-ouro para cultura)</H5>
            <P>Técnica asséptica. Bexiga palpável ou guiada por USG. Frasco estéril. Volume mínimo: 1,5 mL. Refrigerar (2–8°C), processar em até 12 h. Ideal para urocultura.</P>
          </Card>
          <Card>
            <H5>Jato Médio</H5>
            <P>Aceito para urinálise de rotina — descartar 1º e último jato. Não recomendado para urocultura (alta taxa de contaminação).</P>
          </Card>
        </div>
      </section>

      {/* 5. Parasitologia */}
      <section>
        <H3>5. Parasitologia (Fezes)</H3>
        <Card>
          <H5>Volume: 2–20 g · Frasco estéril com tampa rosqueada</H5>
          <P>Coletar logo após defecação espontânea (evitar fezes do chão). Refrigerar (4°C) e processar em até 24 h. Para pesquisa de Giardia: enviar em até 6 h. Identificar hora e data da coleta.</P>
        </Card>
      </section>

      {/* 6. Fungos */}
      <section>
        <H3>6. Fungos (Dermatofitose / Malassezia)</H3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
          <Card>
            <H5>Raspado de pele / Pelos / Unhas</H5>
            <P>Coletar raspado de pele com bisturi ou lâmina, pelos com pinça (preferencialmente com raiz), crostas e escamas. Transferir para frasco seco ou entre duas lâminas. Temperatura ambiente 15–30°C.</P>
          </Card>
          <Card>
            <H5>Pesquisa de Malassezia</H5>
            <P>Swab ou fita adesiva sobre a região afetada (até 3 amostras em lâminas distintas). Rotacionar o swab para maximizar contato. Secar ao ar. Temperatura ambiente. Processar em até 24 h.</P>
          </Card>
        </div>
      </section>

      {/* 7. Citologia */}
      <section>
        <H3>7. Citologia (PAAF / Aposição / Líquidos)</H3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
          <Card>
            <H5>Punção Aspirativa por Agulha Fina (PAAF)</H5>
            <P>Tricotomia e antissepsia. Puncionar a massa diversas vezes com movimentos de avanço/recuo. Dispensar o material na lâmina com pressão de ar. Técnica squash: segunda lâmina deslizante. Secar ao ar rapidamente.</P>
          </Card>
          <Card>
            <H5>Citologia por Aposição</H5>
            <P>Limpar lesão com gaze seca. Pressionar a face fosca da lâmina sobre a lesão, firme e uniforme. Não soprar — secar ao ar. Não fixar antes da secagem completa. Temperatura ambiente.</P>
          </Card>
          <Card>
            <H5>Líquidos Cavitários</H5>
            <P>Coletar na seringa e transferir para tubo EDTA (citologia) e tubo vermelho (bioquímica). Enviar em temperatura ambiente — processar em até 2 h. Congelar se houver demora.</P>
          </Card>
        </div>
      </section>

      {/* 8. Ectoparasitas */}
      <section>
        <H3>8. Ectoparasitas (Sarnas)</H3>
        <Card>
          <P>Raspado superficial com bisturi até sangramento leve na periferia da lesão (borda ativa). Transferir para duas lâminas, vedar bordas com fita. Óleo mineral pode ser adicionado. Temperatura ambiente.</P>
        </Card>
      </section>

      {/* 9. Cultura de Bactérias */}
      <section>
        <H3>9. Cultura de Bactérias</H3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
          <Card>
            <H5>Aeróbias</H5>
            <P>Swab com Meio de Transporte Stuart. Temperatura ambiente. Processar em até 24 h.</P>
          </Card>
          <Card>
            <H5>Anaeróbias</H5>
            <P>Swab com Meio Tioglicolato ou seringa vedada. Manter anaeróbio. Processar imediatamente (máx. 2 h).</P>
          </Card>
        </div>
      </section>

      {/* 10. Histopatológico */}
      <section>
        <H3>10. Histopatológico</H3>
        <Card>
          <H5>Frasco com Formol 10% (1:10) — nunca congelar</H5>
          <P>O volume de formol deve cobrir completamente a peça (relação 1:10 tecido:formol). Peça plana e íntegra. Temperatura ambiente. Informar obrigatoriamente: local anatômico, consistência, espécie, raça, sexo, idade e histórico clínico resumido.</P>
        </Card>
      </section>

      {/* 11. Biologia Molecular */}
      <section>
        <H3>11. Biologia Molecular (PCR)</H3>
        <Card>
          <P>Material varia conforme o agente — consultar AlchemyPet para protocolos específicos (sangue EDTA, swab, tecido, soro, fezes). Respeitar obrigatoriamente 21 dias após vacinação antes de coletar para PCR de agentes vacinais. Congelar imediatamente se não houver envio no dia.</P>
        </Card>
      </section>

      {/* 12. Teste de Estimulação com ACTH */}
      <section>
        <H3>12. Teste de Estimulação com ACTH</H3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
          <Card>
            <H5>Canino</H5>
            <P><strong>T0</strong> — Coleta basal (tubo vermelho, 2 mL soro).<br/><strong>Dose:</strong> Tetracosactídeo 0,25 mg IV em cães &gt;5 kg; 0,125 mg IV em cães &lt;5 kg.<br/><strong>T60</strong> — Coleta 60 min após administração.</P>
          </Card>
          <Card>
            <H5>Felino</H5>
            <P><strong>T0</strong> — Coleta basal.<br/><strong>Dose:</strong> Tetracosactídeo 0,125 mg IV.<br/><strong>T60</strong> — Coleta 60 min após administração.</P>
          </Card>
        </div>
      </section>

      {/* 13. Teste de Supressão com Dexametasona */}
      <section>
        <H3>13. Teste de Supressão com Dexametasona</H3>
        <Card>
          <P>
            <strong>T0</strong> — Coleta basal (soro — tubo vermelho).<br/>
            <strong>Dose Cão:</strong> Dexametasona 0,01 mg/kg IV ou IM.<br/>
            <strong>Dose Gato:</strong> Dexametasona 0,1 mg/kg IV ou IM.<br/>
            <strong>T4h</strong> — Coleta 4 horas após administração.<br/>
            <strong>T8h</strong> — Coleta 8 horas após (triagem para HAC dependente hipofisário vs. adrenal).
          </P>
        </Card>
      </section>

      {/* 14. Conservação e Transporte */}
      <section>
        <H3>14. Conservação e Transporte</H3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
          <Card>
            <H5>Temperatura ambiente (15–30°C)</H5>
            <P>Lâminas de citologia, raspado, swab seco, histopatológico em formol, cultura aeróbia.</P>
          </Card>
          <Card>
            <H5>Refrigerado (2–8°C)</H5>
            <P>Sangue EDTA &gt;12 h, soro, urina, fezes, urocultura, coagulação.</P>
          </Card>
          <Card>
            <H5>Congelado (&minus;20°C / &minus;80°C)</H5>
            <P>Soro para hormônios e sorologias (&gt;48 h), material para PCR, sêmen.</P>
          </Card>
        </div>
      </section>
    </div>
  )
}

// ---- Assinatura Section ----
function AssinaturaSection({ form, signatureData, setSignatureData, isReadOnly }) {
  const [mode, setMode] = useState('desenhar') // 'desenhar' | 'imagem'
  const vet = findVetById(form.vetId)

  function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setSignatureData(ev.target.result)
    reader.readAsDataURL(file)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px 20px' }}>
        <div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>Veterinário</p>
          <p style={{ fontWeight: 600 }}>{vet?.name ?? '—'}</p>
        </div>
        <div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>CRMV</p>
          <p style={{ fontWeight: 600 }}>{vet?.crmv ?? '—'}</p>
        </div>
        {vet?.mapa && (
          <div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>MAPA</p>
            <p style={{ fontWeight: 600 }}>{vet.mapa}</p>
          </div>
        )}
        <div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>Data / Hora</p>
          <p style={{ fontWeight: 600 }}>{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>

      {isReadOnly ? (
        signatureData
          ? <img src={signatureData} alt="Assinatura" style={{ border: '1.5px solid var(--border)', borderRadius: 8, width: '100%', maxWidth: 600, height: 180, objectFit: 'contain', background: '#fff' }} />
          : <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface-2)', borderRadius: 8 }}>Sem assinatura registrada</div>
      ) : (
        <>
          {/* Mode switcher */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[['desenhar', 'Desenhar'], ['imagem', 'Carregar Imagem']].map(([m, lbl]) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                style={{ padding: '6px 16px', borderRadius: 8, border: `2px solid ${mode === m ? 'var(--teal)' : 'var(--border)'}`, background: mode === m ? 'var(--teal-light)' : 'var(--surface-2)', color: mode === m ? 'var(--teal-dark)' : 'var(--text-secondary)', fontWeight: mode === m ? 700 : 500, fontSize: '0.875rem', cursor: 'pointer' }}>
                {lbl}
              </button>
            ))}
          </div>

          {mode === 'desenhar' && <SignaturePad value={signatureData} onChange={setSignatureData} />}

          {mode === 'imagem' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="file" accept="image/*" onChange={handleImageUpload}
                style={{ fontSize: '0.875rem' }} />
              {signatureData && signatureData.startsWith('data:image') && (
                <div>
                  <img src={signatureData} alt="Prévia" style={{ border: '1.5px solid var(--border)', borderRadius: 8, maxWidth: 600, width: '100%', height: 180, objectFit: 'contain', background: '#fff' }} />
                  <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => setSignatureData(null)}>Remover</button>
                </div>
              )}
            </div>
          )}

          {/* Info Gov.br / ICP-Brasil */}
          <div style={{ padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 8, borderLeft: '3px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Assinatura Digital com Validade Jurídica:</strong> Para emissão de receituários e documentos com validade legal, utilize um certificado ICP-Brasil (A1 ou A3) via <strong>Gov.br</strong> ou outro provedor credenciado. A assinatura digital neste campo é apenas para registro interno do prontuário.
          </div>

          <div style={{ padding: '10px 14px', background: 'var(--teal-light)', borderRadius: 8, borderLeft: '3px solid var(--teal)' }}>
            <p style={{ fontSize: '0.8125rem', color: 'var(--teal-dark)', margin: 0 }}>Ao assinar, o veterinário confirma a veracidade das informações deste prontuário.</p>
          </div>
        </>
      )}
    </div>
  )
}

// ---- Signature Pad ----
function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null)
  const isDrawing = useRef(false)
  const lastPos = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#1a1f27'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])
  function getPos(e) {
    const canvas = canvasRef.current; const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height
    const src = e.touches ? e.touches[0] : e
    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY }
  }
  function startDraw(e) { e.preventDefault(); isDrawing.current = true; lastPos.current = getPos(e) }
  function draw(e) {
    e.preventDefault(); if (!isDrawing.current) return
    const canvas = canvasRef.current; const ctx = canvas.getContext('2d'); const pos = getPos(e)
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke()
    lastPos.current = pos; onChange?.(canvas.toDataURL())
  }
  function stopDraw(e) { e?.preventDefault?.(); isDrawing.current = false; lastPos.current = null }
  function clear() {
    const canvas = canvasRef.current; const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); onChange?.(null)
  }
  return (
    <div>
      <div style={{ border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: '#fff', touchAction: 'none' }}>
        <canvas ref={canvasRef} width={800} height={200} style={{ width: '100%', height: 200, cursor: 'crosshair', display: 'block' }}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>Limpar</button>
        {value && <span className="badge badge-success">Assinatura registrada</span>}
      </div>
    </div>
  )
}

// ---- Medicamento autocomplete input ----
function MedInput({ value, onChange, onSelect, disabled }) {
  const [open, setOpen] = useState(false)
  const suggestions = value.length >= 2 ? (() => {
    const produtos = (() => { try { return JSON.parse(localStorage.getItem('petvet-produtos') ?? '[]') } catch { return [] } })()
    const bulario = (() => { try { return JSON.parse(localStorage.getItem('petvet-bulario') ?? '[]') } catch { return [] } })()
    return [
      ...produtos.filter(p => normIncludes(p.name, value)).slice(0, 4).map(p => ({ id: `p-${p.id}`, label: p.name, sub: p.category ?? '', onSel: () => onSelect(p) })),
      ...bulario.filter(m => normIncludes(m.nomeComercial, value) || normIncludes(m.nomeGenerico, value)).slice(0, 4).map(m => ({ id: `b-${m.id}`, label: m.nomeComercial, sub: m.nomeGenerico ?? '', onSel: () => onSelect({ name: m.nomeComercial }) })),
    ].slice(0, 8)
  })() : []

  return (
    <div style={{ position: 'relative' }}>
      <input className="form-input" value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        disabled={disabled} placeholder="Nome do medicamento" autoComplete="off" />
      {open && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, maxHeight: 200, overflowY: 'auto' }}>
          {suggestions.map(s => (
            <div key={s.id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.8125rem', borderBottom: '1px solid var(--border)' }}
              onMouseDown={() => { s.onSel(); setOpen(false) }}>
              <span style={{ fontWeight: 600 }}>{s.label}</span>
              {s.sub && <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: '0.75rem' }}>{s.sub}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Vacinas Section ----
const DOSE_OPTIONS = ['Única', '1ª dose', '2ª dose', '3ª dose', 'Reforço anual']
const VIA_OPTIONS  = ['SC', 'Intranasal', 'VO']

function VacinasSection({ petId, petInfo, vacinasAplicadas, onChange, isReadOnly, onApplyProtocol }) {
  const [protocols] = usePersistentState('petvet-vac-protocols', [])
  const [applications] = usePersistentState('petvet-vac-applications', [])
  const [whatsappVac, setWhatsappVac] = useState(null)

  const allProtocols = protocols.length > 0 ? protocols : [
    { id: 'vp1', species: 'Cão',  name: 'V8/V10 – Múltipla',      doses: 3, intervalDays: 21,  annualBooster: true, minAgeMonths: 2 },
    { id: 'vp2', species: 'Cão',  name: 'Antirrábica',             doses: 1, intervalDays: null, annualBooster: true, minAgeMonths: 3 },
    { id: 'vp3', species: 'Cão',  name: 'Gripe Canina (Bb+Pi2)',   doses: 2, intervalDays: 21,  annualBooster: true, minAgeMonths: 3 },
    { id: 'vp4', species: 'Cão',  name: 'Leishmaniose (CanLeish)', doses: 3, intervalDays: 21,  annualBooster: true, minAgeMonths: 4 },
    { id: 'vp5', species: 'Gato', name: 'Tríplice Felina (V3)',    doses: 3, intervalDays: 21,  annualBooster: true, minAgeMonths: 2 },
    { id: 'vp6', species: 'Gato', name: 'Antirrábica Felina',      doses: 1, intervalDays: null, annualBooster: true, minAgeMonths: 3 },
    { id: 'vp7', species: 'Gato', name: 'FeLV – Leucemia Felina',  doses: 2, intervalDays: 21,  annualBooster: true, minAgeMonths: 3 },
  ]

  const todayIso = new Date().toISOString().slice(0, 10)
  const emptyRow = () => ({ vacina: '', fabricante: '', lote: '', dataAplicacao: todayIso, validade: '', dose: '1ª dose', via: 'SC' })

  function calcNextBooster(dateStr, proto) {
    if (!dateStr || !proto) return ''
    const d = new Date(dateStr + 'T00:00')
    if (proto.annualBooster) d.setFullYear(d.getFullYear() + 1)
    else if (proto.intervalDays) d.setDate(d.getDate() + proto.intervalDays)
    else return ''
    return d.toISOString().slice(0, 10)
  }

  function addRow() { onChange([...vacinasAplicadas, emptyRow()]) }
  function removeRow(i) { onChange(vacinasAplicadas.filter((_, idx) => idx !== i)) }
  function updateRow(i, key, val) {
    const arr = [...vacinasAplicadas]
    arr[i] = { ...arr[i], [key]: val }
    if (key === 'dataAplicacao' || key === 'vacina') {
      const r = arr[i]
      const proto = allProtocols.find(p => p.name === r.vacina)
      arr[i].proximoReforco = calcNextBooster(r.dataAplicacao, proto)
      if (key === 'vacina') {
        if (proto) {
          arr[i].protocoloId = proto.id
          arr[i].protocoloNome = proto.name
          arr[i].precoProtocolo = proto.precoTotal ?? 0
          arr[i].itensProtocolo = [
            ...(proto.vacinas ?? []).map(v => ({ tipo: 'vacina', ...v })),
            ...(proto.medicamentos ?? []).map(m => ({ tipo: 'medicamento', ...m })),
            ...(proto.servicos ?? []).map(s => ({ tipo: 'servico', ...s })),
          ]
        } else {
          delete arr[i].protocoloId
          delete arr[i].protocoloNome
          delete arr[i].precoProtocolo
          delete arr[i].itensProtocolo
        }
      }
    }
    onChange(arr)
  }

  const petApps = petId ? (applications.length > 0 ? applications : []).filter(a => a.petId === petId) : []
  const today = new Date()

  function nextBoosterDate(lastDateStr, proto) {
    if (!lastDateStr) return null
    if (proto.annualBooster) {
      const d = new Date(lastDateStr + 'T00:00'); d.setFullYear(d.getFullYear() + 1)
      return d.toISOString().split('T')[0]
    }
    if (proto.intervalDays) {
      const d = new Date(lastDateStr + 'T00:00'); d.setDate(d.getDate() + proto.intervalDays)
      return d.toISOString().split('T')[0]
    }
    return null
  }

  const boosters = allProtocols.map(proto => {
    const apps = petApps.filter(a => a.protocolId === proto.id).sort((a, b) => a.date.localeCompare(b.date))
    if (apps.length === 0) return null
    const lastApp = apps[apps.length - 1]
    const nextDate = nextBoosterDate(lastApp.date, proto)
    if (!nextDate) return null
    return { proto, lastDate: lastApp.date, nextDate }
  }).filter(Boolean)

  const history = petApps
    .map(app => ({ ...app, proto: allProtocols.find(p => p.id === app.protocolId) }))
    .filter(a => a.proto)
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Vacinas aplicadas nesta consulta */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>Vacinas aplicadas nesta consulta</h4>
          {!isReadOnly && <button className="btn btn-outline btn-sm" onClick={addRow}><Plus size={14} /> Adicionar</button>}
        </div>
        {vacinasAplicadas.length === 0 && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '12px 0' }}>Nenhuma vacina aplicada nesta consulta.</p>
        )}
        {vacinasAplicadas.map((row, i) => (
          <div key={i}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end', marginBottom: 4, padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Vacina</label>
              <select className="form-select" value={row.vacina} onChange={e => updateRow(i, 'vacina', e.target.value)} disabled={isReadOnly}>
                <option value="">Selecione...</option>
                {allProtocols.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                <option value="Outra">Outra</option>
              </select>
            </div>
            {row.vacina === 'Outra' || !allProtocols.find(p => p.name === row.vacina) ? (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Nome</label>
                <input className="form-input" value={row.vacinaOutra ?? ''} onChange={e => updateRow(i, 'vacinaOutra', e.target.value)} disabled={isReadOnly} />
              </div>
            ) : <div />}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Fabricante</label>
              <input className="form-input" value={row.fabricante} onChange={e => updateRow(i, 'fabricante', e.target.value)} disabled={isReadOnly} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Lote</label>
              <input className="form-input" value={row.lote} onChange={e => updateRow(i, 'lote', e.target.value)} disabled={isReadOnly} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Data aplicação</label>
              <input type="date" className="form-input" value={row.dataAplicacao ?? ''} onChange={e => updateRow(i, 'dataAplicacao', e.target.value)} disabled={isReadOnly} />
              {row.proximoReforco && (
                <span style={{ fontSize: '0.68rem', color: 'var(--success,#4CAF50)', display: 'block', marginTop: 3 }}>
                  Reforço: {new Date(row.proximoReforco + 'T00:00').toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Validade</label>
              <input type="date" className="form-input" value={row.validade ?? row.validadeFrasco ?? ''} onChange={e => updateRow(i, 'validade', e.target.value)} disabled={isReadOnly} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Dose</label>
              <select className="form-select" value={row.dose} onChange={e => updateRow(i, 'dose', e.target.value)} disabled={isReadOnly}>
                {DOSE_OPTIONS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Via</label>
              <select className="form-select" value={row.via} onChange={e => updateRow(i, 'via', e.target.value)} disabled={isReadOnly}>
                {VIA_OPTIONS.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            {!isReadOnly && (
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', alignSelf: 'center', marginTop: 18 }} onClick={() => removeRow(i)}><X size={14} /></button>
            )}
          </div>
          {(() => {
            const proto = allProtocols.find(p => p.name === row.vacina)
            if (!proto || (!proto.vacinas?.length && !proto.medicamentos?.length && !proto.servicos?.length)) return null
            return (
              <div style={{ background: 'var(--teal-light)', borderRadius: '0 0 8px 8px', border: '1px solid var(--teal)', borderTop: 'none', padding: '10px 14px', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--teal-dark)', margin: 0 }}>📋 Itens inclusos neste protocolo:</p>
                  {!isReadOnly && onApplyProtocol && (
                    <button className="btn btn-outline btn-sm"
                      style={{ fontSize: '0.75rem', borderColor: 'var(--teal)', color: 'var(--teal)' }}
                      onClick={() => onApplyProtocol(proto)}>
                      ✅ Aplicar protocolo completo
                    </button>
                  )}
                </div>
                {proto.vacinas?.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 3, margin: 0 }}>💉 Vacinas/Produtos</p>
                    {proto.vacinas.map((v, vi) => (
                      <div key={vi} style={{ fontSize: '0.78rem', padding: '2px 8px', color: 'var(--text-primary)' }}>
                        {v.nome} × {v.qtd ?? 1} — R$ {(Number(v.precoUnit) || 0).toFixed(2)}
                      </div>
                    ))}
                  </div>
                )}
                {proto.medicamentos?.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 3, margin: 0 }}>💊 Medicamentos</p>
                    {proto.medicamentos.map((m, mi) => (
                      <div key={mi} style={{ fontSize: '0.78rem', padding: '2px 8px', color: 'var(--text-primary)' }}>
                        {m.nome} × {m.qtd ?? 1} — R$ {(Number(m.precoUnit) || 0).toFixed(2)}
                      </div>
                    ))}
                  </div>
                )}
                {proto.servicos?.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 3, margin: 0 }}>🩺 Serviços</p>
                    {proto.servicos.map((s, si) => (
                      <div key={si} style={{ fontSize: '0.78rem', padding: '2px 8px', color: 'var(--text-primary)' }}>
                        {s.nome} × {s.qtd ?? 1} — R$ {(Number(s.precoUnit) || 0).toFixed(2)}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--teal)', borderTop: '1px solid rgba(0,150,130,0.3)', paddingTop: 6, marginTop: 4 }}>
                  Total do protocolo: R$ {(Number(proto.precoTotal) || 0).toFixed(2)}
                </div>
              </div>
            )
          })()}
          </div>
        ))}
      </div>

      {/* Próximos reforços */}
      {petId && boosters.length > 0 && (
        <div>
          <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Próximos reforços</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {boosters.map(({ proto, lastDate, nextDate }) => {
              const daysLeft = Math.round((new Date(nextDate + 'T00:00') - today) / 864e5)
              const overdue = daysLeft < 0
              return (
                <div key={proto.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, border: `1px solid ${overdue ? 'var(--danger)' : 'var(--border)'}` }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{proto.name}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 8 }}>Última: {new Date(lastDate + 'T00:00').toLocaleDateString('pt-BR')}</span>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 700, background: overdue ? 'var(--danger)' : daysLeft <= 30 ? '#FF9800' : 'var(--success)', color: '#fff' }}>
                    {overdue ? `Vencida há ${Math.abs(daysLeft)}d` : `${new Date(nextDate + 'T00:00').toLocaleDateString('pt-BR')} (${daysLeft}d)`}
                  </span>
                  <button className="btn btn-outline btn-sm no-print" style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}
                    onClick={() => setWhatsappVac({ proto, nextDate, petName: petInfo?.name })}>
                    📱 WhatsApp
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Histórico de vacinas do pet */}
      {petId && history.length > 0 && (
        <div>
          <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Histórico de vacinas</h4>
          <div className="table-wrapper" style={{ maxHeight: 240 }}>
            <table>
              <thead><tr><th>Data</th><th>Vacina</th><th>Dose</th><th>Lote</th><th>Validade</th><th>Veterinário</th></tr></thead>
              <tbody>
                {history.map(app => (
                  <tr key={app.id}>
                    <td>{new Date(app.date + 'T00:00').toLocaleDateString('pt-BR')}</td>
                    <td>{app.proto?.name}</td>
                    <td>{app.dose}ª dose</td>
                    <td>{app.lot || '—'}</td>
                    <td>{app.validade ? new Date(app.validade + 'T00:00').toLocaleDateString('pt-BR') : app.validadeFrasco ? new Date(app.validadeFrasco + 'T00:00').toLocaleDateString('pt-BR') : '—'}</td>
                    <td>{app.vet || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WhatsApp modal */}
      {whatsappVac && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, width: 480, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>Lembrete de reforço — WhatsApp</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>Copie a mensagem abaixo e envie pelo WhatsApp:</p>
            <textarea readOnly className="form-textarea" style={{ minHeight: 160, fontFamily: 'monospace', fontSize: '0.85rem' }}
              value={`Olá! Passando para lembrar que ${whatsappVac.petName ?? 'seu pet'} tem o reforço da vacina *${whatsappVac.proto?.name}* previsto para *${new Date(whatsappVac.nextDate + 'T00:00').toLocaleDateString('pt-BR')}*.\n\nAgende sua consulta com antecedência! 🐾\n\n— Equipe PetVet`} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setWhatsappVac(null)}>Fechar</button>
              <button className="btn btn-primary" onClick={() => { navigator.clipboard?.writeText(`Olá! Passando para lembrar que ${whatsappVac.petName ?? 'seu pet'} tem o reforço da vacina *${whatsappVac.proto?.name}* previsto para *${new Date(whatsappVac.nextDate + 'T00:00').toLocaleDateString('pt-BR')}*.\n\nAgende sua consulta com antecedência! 🐾\n\n— Equipe PetVet`); setWhatsappVac(null) }}>Copiar e fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Cirurgia Section ----
function CirurgiaSection({ procedimentos, mesmoVet, vetUnicoId, vets, isReadOnly, onChange, onMesmoVetChange, onVetUnicoChange }) {
  const [catalogo] = usePersistentState('petvet-catalogo', [])

  const cirurgias = catalogo.filter(s =>
    s.category === 'Cirurgia' ||
    normIncludes(s.name, 'cirurgia') ||
    normIncludes(s.name, 'orquiectomia') ||
    normIncludes(s.name, 'ovariohisterectomia') ||
    normIncludes(s.name, 'castra')
  )
  const displayCirurgias = cirurgias.length > 0 ? cirurgias : catalogo

  const EMPTY_PROC = { servicoId: '', nome: '', vetId: '', vetNome: '', preco: 0 }

  function addProc() { onChange([...procedimentos, { ...EMPTY_PROC }]) }
  function removeProc(i) { onChange(procedimentos.filter((_, idx) => idx !== i)) }
  function updateProc(i, key, val) {
    const arr = [...procedimentos]
    arr[i] = { ...arr[i], [key]: val }
    onChange(arr)
  }
  function selectServico(i, servicoId) {
    const svc = catalogo.find(s => (s.id ?? s.name) === servicoId)
    const arr = [...procedimentos]
    arr[i] = { ...arr[i], servicoId, nome: servicoId === '__outro' ? '' : (svc?.name ?? ''), preco: servicoId === '__outro' ? 0 : (Number(svc?.price) || 0) }
    onChange(arr)
  }
  function selectVet(i, vetId) {
    const vet = vets.find(v => v.id === vetId)
    const arr = [...procedimentos]
    arr[i] = { ...arr[i], vetId, vetNome: vet?.name ?? '' }
    onChange(arr)
  }

  const totalPreco = procedimentos.reduce((s, p) => s + (Number(p.preco) || 0), 0)
  const vetsEnvolvidos = [...new Set(procedimentos.map(p => p.vetNome).filter(Boolean))]
  const showIndivVet = !mesmoVet || procedimentos.length <= 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h4 style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', margin: 0 }}>Procedimentos Cirúrgicos</h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>Registre os procedimentos realizados nesta cirurgia</p>
        </div>
        {!isReadOnly && (
          <button className="btn btn-outline btn-sm" onClick={addProc}><Plus size={14} /> Adicionar procedimento</button>
        )}
      </div>

      {!isReadOnly && procedimentos.length > 1 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <input type="checkbox" checked={mesmoVet} onChange={e => onMesmoVetChange(e.target.checked)} style={{ accentColor: 'var(--teal)', width: 15, height: 15 }} />
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Mesmo veterinário para todos os procedimentos</span>
        </label>
      )}

      {mesmoVet && procedimentos.length > 1 && (
        <div className="form-group">
          <label className="form-label">Veterinário responsável (todos os procedimentos)</label>
          <select className="form-select" value={vetUnicoId}
            onChange={e => {
              const vet = vets.find(v => v.id === e.target.value)
              onVetUnicoChange(e.target.value, vet?.name ?? '')
            }}
            disabled={isReadOnly}>
            <option value="">Selecione o veterinário</option>
            {vets.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      )}

      {procedimentos.length === 0 && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '12px 0' }}>
          Nenhum procedimento adicionado. Clique em "+ Adicionar procedimento" para começar.
        </p>
      )}

      {procedimentos.map((proc, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: showIndivVet ? '1fr 1fr auto auto' : '1fr auto auto', gap: 8, alignItems: 'end', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Procedimento / Cirurgia</label>
            <select className="form-select" value={proc.servicoId} onChange={e => selectServico(i, e.target.value)} disabled={isReadOnly}>
              <option value="">Selecione...</option>
              {displayCirurgias.map(s => (
                <option key={s.id ?? s.name} value={s.id ?? s.name}>
                  {s.name}{s.category && s.category !== 'Cirurgia' ? ` (${s.category})` : ''}
                </option>
              ))}
              <option value="__outro">Outro (informar manualmente)</option>
            </select>
            {proc.servicoId === '__outro' && (
              <input className="form-input" style={{ marginTop: 4 }} value={proc.nome}
                onChange={e => updateProc(i, 'nome', e.target.value)}
                placeholder="Nome do procedimento" disabled={isReadOnly} />
            )}
          </div>

          {showIndivVet && (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Veterinário responsável</label>
              <select className="form-select" value={proc.vetId} onChange={e => selectVet(i, e.target.value)} disabled={isReadOnly}>
                <option value="">Selecione...</option>
                {vets.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          )}

          <div className="form-group" style={{ margin: 0, minWidth: 110 }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Preço R$</label>
            <input type="number" min="0" step="0.01" className="form-input"
              value={proc.preco} onChange={e => updateProc(i, 'preco', e.target.value)}
              disabled={isReadOnly} placeholder="0,00" />
          </div>

          {!isReadOnly && (
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', alignSelf: 'center', marginTop: 18 }} onClick={() => removeProc(i)}>
              <X size={14} />
            </button>
          )}
        </div>
      ))}

      {procedimentos.length > 0 && (
        <div style={{ background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Total de procedimentos</span>
            <span style={{ fontWeight: 700 }}>{procedimentos.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Valor total</span>
            <span style={{ fontWeight: 800, color: 'var(--teal)' }}>R$ {totalPreco.toFixed(2)}</span>
          </div>
          {vetsEnvolvidos.length > 0 && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
              Veterinários: {vetsEnvolvidos.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ---- Aplicações Section ----
const APLICACAO_VIA = ['SC', 'IM', 'IV', 'Intranasal', 'VO', 'Otológica', 'Ocular']

function AplicacoesSection({ aplicacoes, onChange, isReadOnly }) {
  const [bulario] = usePersistentState('petvet-bulario', [])
  const [suggest, setSuggest] = useState({})
  const [bulaMed, setBulaMed] = useState(null)

  const emptyRow = () => ({ nome: '', dose: '', via: 'SC' })
  function addRow() { onChange([...aplicacoes, emptyRow()]) }
  function removeRow(i) { onChange(aplicacoes.filter((_, idx) => idx !== i)) }
  function updateRow(i, key, val) { const arr = [...aplicacoes]; arr[i] = { ...arr[i], [key]: val }; onChange(arr) }
  function findBula(nome) { return bulario.find(m => norm(m.nomeComercial) === norm(nome) || normIncludes(m.nomeComercial, nome)) ?? null }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>Aplicações nesta consulta</h4>
        {!isReadOnly && <button className="btn btn-outline btn-sm" onClick={addRow}><Plus size={14} /> Adicionar</button>}
      </div>
      {aplicacoes.length === 0 && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '12px 0' }}>Nenhuma aplicação registrada.</p>
      )}
      {aplicacoes.map((row, i) => {
        const bula = row.nome.length >= 2 ? findBula(row.nome) : null
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto auto', gap: 8, alignItems: 'end', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div className="form-group" style={{ margin: 0, position: 'relative' }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Nome</label>
              <input className="form-input" value={row.nome}
                onChange={e => { updateRow(i, 'nome', e.target.value); setSuggest(s => ({ ...s, [i]: e.target.value.length >= 2 })) }}
                onBlur={() => setTimeout(() => setSuggest(s => ({ ...s, [i]: false })), 150)}
                disabled={isReadOnly} placeholder="Buscar no bulário..." autoComplete="off" />
              {suggest[i] && row.nome.length >= 2 && (() => {
                const hits = bulario.filter(m => normIncludes(m.nomeComercial, row.nome) || normIncludes(m.nomeGenerico, row.nome)).slice(0, 6)
                return hits.length > 0 ? (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, maxHeight: 180, overflowY: 'auto' }}>
                    {hits.map(m => (
                      <div key={m.id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.8125rem', borderBottom: '1px solid var(--border)' }}
                        onMouseDown={() => { updateRow(i, 'nome', m.nomeComercial); setSuggest(s => ({ ...s, [i]: false })) }}>
                        <span style={{ fontWeight: 600 }}>{m.nomeComercial}</span>
                        {m.nomeGenerico && <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: '0.75rem' }}>{m.nomeGenerico}</span>}
                      </div>
                    ))}
                  </div>
                ) : null
              })()}
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Dose</label>
              <input className="form-input" value={row.dose} onChange={e => updateRow(i, 'dose', e.target.value)} disabled={isReadOnly} placeholder="Ex: 1 mg/kg" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Via</label>
              <select className="form-select" value={row.via} onChange={e => updateRow(i, 'via', e.target.value)} disabled={isReadOnly}>
                {APLICACAO_VIA.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              title={bula ? 'Ver bula' : 'Medicamento não encontrado no bulário'}
              disabled={!bula}
              onClick={() => bula && setBulaMed(bula)}
              style={{ alignSelf: 'center', marginTop: 18, fontSize: '0.875rem', opacity: bula ? 1 : 0.35 }}>
              📖
            </button>
            {!isReadOnly && (
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', alignSelf: 'center', marginTop: 18 }} onClick={() => removeRow(i)}><X size={14} /></button>
            )}
          </div>
        )
      })}

      {bulaMed && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 640, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>{bulaMed.nomeComercial}</h3>
                {bulaMed.nomeGenerico && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>{bulaMed.nomeGenerico}</p>}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setBulaMed(null)}><X size={16} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', fontSize: '0.875rem' }}>
              {[
                ['Categoria', bulaMed.categoria],
                ['Concentração', bulaMed.concentracao],
                ['Apresentação', bulaMed.apresentacao],
                ['Fabricante', bulaMed.fabricante],
                ['Via de administração', bulaMed.via],
                ['Dose (Cão)', bulaMed.doseCao],
                ['Dose (Gato)', bulaMed.doseGato],
                ['Dose (Outros)', bulaMed.doseOutros],
                ['Frequência', bulaMed.frequencia],
                ['Duração do tratamento', bulaMed.tempoPtto],
                ['Interações', bulaMed.interacoes],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k}>
                  <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
            {bulaMed.indicacoes && (
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 4 }}>Indicações</p>
                <p style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{bulaMed.indicacoes}</p>
              </div>
            )}
            {bulaMed.contraindicacoes && (
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--danger)', marginBottom: 4 }}>Contraindicações</p>
                <p style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{bulaMed.contraindicacoes}</p>
              </div>
            )}
            {bulaMed.efeitosAdversos && (
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--warning)', marginBottom: 4 }}>Efeitos Adversos</p>
                <p style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{bulaMed.efeitosAdversos}</p>
              </div>
            )}
            {bulaMed.observacoes && (
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 4 }}>Observações</p>
                <p style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{bulaMed.observacoes}</p>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setBulaMed(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Termos TCLE Section ----
function TermosSection({ form, petInfo, tutorInfo, vetInfo, onAddAnexo, requestModal, onRequestModalHandled, onModalClose }) {
  const [activeModal, setActiveModal] = useState(null)

  useEffect(() => {
    if (requestModal) {
      setActiveModal(requestModal)
      if (onRequestModalHandled) onRequestModalHandled()
    }
  }, [requestModal])

  function closeModal() {
    setActiveModal(null)
    if (onModalClose) onModalClose()
  }
  const clinicConfig = (() => { try { return JSON.parse(localStorage.getItem('petvet-clinica-config') ?? 'null') } catch { return null } })() ?? {}
  const clinicNome = clinicConfig.nome || 'Emporium Vazpet & Tatá Bichos'

  const [termoData, setTermoData] = useState({
    procedimento: '', metodo: '', testemunha: '',
    exames: '', valoresEstimados: '',
    recusas: [], procedimentoRecusa: '',
    motivoAtestado: '', destinoAtestado: '', validadeAtestado: '',
    vacinasAtestado: '', validadeVacina: '',
    causaMorte: '', dataHoraObito: '', destinoCadaver: '',
    especialidade: '', clinicaDestino: '',
    plataforma: '',
    condicaoAlta: '', orientacoesAlta: '',
    motivoCertificado: '',
    transitoOrigem: '', transitoDestino: '', transitoFinalidade: '', transitoMeio: '',
    microchip: '', endectocida: '', endectocidaData: '', vermifugo: '', vermifugaData: '',
    // Declaração de Recusa
    tutorNomeRecusa: tutorInfo?.name ?? '',
    tutorRGRecusa: tutorInfo?.rg ?? '',
    tutorCPFRecusa: tutorInfo?.cpf ?? '',
    tutorEnderecoRecusa: tutorInfo?.address ?? '',
    tutorTelRecusa: tutorInfo?.phone ?? '',
    recusaTratamento: '',
    vetClinicaRecusa: clinicNome,
    // Cannabis Acompanhamento
    tutorNomeCanabis: tutorInfo?.name ?? '',
    tutorCPFCanabis: tutorInfo?.cpf ?? '',
    tutorEnderecoCanabis: tutorInfo?.address ?? '',
    tutorTelCanabis: tutorInfo?.phone ?? '',
    // Derma Contínuo
    tutorNomeDerma: tutorInfo?.name ?? '',
    tutorCPFDerma: tutorInfo?.cpf ?? '',
    tutorTelDerma: tutorInfo?.phone ?? '',
    tutorEnderecoDerma: tutorInfo?.address ?? '',
    afeccaoDerma: '',
    // Local/Data e Assinaturas (compartilhados)
    termoLocal: '',
    termoDataStr: '',
    assinaturaTutor: null,
    assinaturaVet: null,
    assinaturaTutorOffset: 0,
    assinaturaVetOffset: 0,
  })

  const hoje = form.date ? new Date(form.date + 'T00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')

  const [showSigCanvas, setShowSigCanvas] = useState(null)
  const miniCanvasRef = useRef(null)
  const miniDrawing = useRef(false)
  const miniLastPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (showSigCanvas && miniCanvasRef.current) {
      miniCanvasRef.current.getContext('2d').clearRect(0, 0, miniCanvasRef.current.width, miniCanvasRef.current.height)
    }
  }, [showSigCanvas])

  function getMiniPos(e) {
    const c = miniCanvasRef.current
    const rect = c.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: (clientX - rect.left) * (c.width / rect.width), y: (clientY - rect.top) * (c.height / rect.height) }
  }
  function miniStartDraw(e) { e.preventDefault(); miniDrawing.current = true; miniLastPos.current = getMiniPos(e) }
  function miniDraw(e) {
    e.preventDefault()
    if (!miniDrawing.current) return
    const pos = getMiniPos(e)
    const ctx = miniCanvasRef.current.getContext('2d')
    ctx.beginPath(); ctx.moveTo(miniLastPos.current.x, miniLastPos.current.y)
    ctx.lineTo(pos.x, pos.y); ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke()
    miniLastPos.current = pos
  }
  function miniStopDraw() { miniDrawing.current = false }
  function clearMiniCanvas() {
    const c = miniCanvasRef.current
    c.getContext('2d').clearRect(0, 0, c.width, c.height)
  }
  function confirmSig() {
    const dataUrl = miniCanvasRef.current.toDataURL()
    const key = showSigCanvas === 'tutor' ? 'assinaturaTutor' : 'assinaturaVet'
    setTermoData(d => ({ ...d, [key]: dataUrl }))
    setShowSigCanvas(null)
  }

  const [sigRepoMode, setSigRepoMode] = useState(null)
  const sigDragRef = useRef({ active: false, type: null, startY: 0, startOffset: 0 })

  useEffect(() => {
    function onMove(e) {
      if (!sigDragRef.current.active) return
      const delta = e.clientY - sigDragRef.current.startY
      const newOffset = Math.max(-100, Math.min(200, sigDragRef.current.startOffset + delta))
      const key = sigDragRef.current.type === 'tutor' ? 'assinaturaTutorOffset' : 'assinaturaVetOffset'
      setTermoData(d => ({ ...d, [key]: newOffset }))
    }
    function onUp() { sigDragRef.current.active = false }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [])

  function startSigDrag(e, type) {
    e.preventDefault()
    sigDragRef.current = {
      active: true, type,
      startY: e.clientY,
      startOffset: type === 'tutor' ? (termoData.assinaturaTutorOffset ?? 0) : (termoData.assinaturaVetOffset ?? 0),
    }
  }

  function sigBlock(type, labelLine1, labelLine2) {
    const sig = type === 'tutor' ? termoData.assinaturaTutor : termoData.assinaturaVet
    const off = type === 'tutor' ? (termoData.assinaturaTutorOffset ?? 0) : (termoData.assinaturaVetOffset ?? 0)
    const isRepo = sigRepoMode === type
    return (
      <div>
        {sig && (
          <>
            <img src={sig} alt="Assinatura" draggable={false}
              style={{ maxHeight: 50, display: 'block', position: 'relative', top: off, cursor: isRepo ? 'grab' : 'default', userSelect: 'none' }}
              onMouseDown={isRepo ? e => startSigDrag(e, type) : undefined}
            />
            <div className="no-print" style={{ fontSize: '0.7rem', marginBottom: 2 }}>
              {isRepo
                ? <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '2px 5px' }} onClick={() => setSigRepoMode(null)}>✓ Confirmar posição</button>
                : <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '2px 5px' }} onClick={() => setSigRepoMode(type)}>↕️ Reposicionar</button>}
            </div>
          </>
        )}
        <div style={{ borderTop: '1px solid #333', paddingTop: 6 }}>
          {labelLine1}{labelLine2 ? <><br />{labelLine2}</> : null}
        </div>
      </div>
    )
  }

  const clinicHeader = (
    <div style={{ textAlign: 'center', marginBottom: 16, borderBottom: '2px solid #333', paddingBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>EMPORIUM VAZPET & TATÁ BICHOS</h2>
      <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#555' }}>Clínica Veterinária · Rua Exemplo, 123 — São Paulo/SP · (11) 99999-9999</p>
    </div>
  )

  const qualTutor = (
    <div style={{ marginBottom: 14, fontSize: '0.875rem', lineHeight: 1.8 }}>
      <strong>TUTOR:</strong> {tutorInfo?.name ?? '___________________'}, CPF: {tutorInfo?.cpf ?? '___.___.___-__'}, Endereço: {tutorInfo?.address ?? '______________________'}, Tel: {tutorInfo?.phone ?? '____________'}
    </div>
  )

  const qualAnimal = (
    <div style={{ marginBottom: 14, fontSize: '0.875rem', lineHeight: 1.8 }}>
      <strong>ANIMAL:</strong> {petInfo?.name ?? '___'}, Espécie: {petInfo?.species ?? '___'}, Raça: {petInfo?.breed ?? '___'}, Idade: {petInfo?.birthDate ? calcularIdade(petInfo.birthDate) : '___'}, Peso: {petInfo?.weight ?? '___'} kg, Sexo: {petInfo?.sex ?? '___'}
    </div>
  )

  const vetLabel2 = `CRMV: ${vetInfo?.crmv ?? '—'}${vetInfo?.mapa ? ` · MAPA: ${fmtMapa(vetInfo.mapa)}` : ''}`

  const footer = (
    <div style={{ marginTop: 24, fontSize: '0.82rem', lineHeight: 2 }}>
      <p>Local e data: {termoData.termoLocal || '_________'}, {termoData.termoDataStr || '___/___/______'}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 20 }}>
        {sigBlock('tutor', 'Assinatura do Tutor / Responsável', tutorInfo?.name ?? '')}
        {sigBlock('vet', vetInfo?.name ?? 'Veterinário Responsável', vetLabel2)}
      </div>
    </div>
  )

  const footerSoVet = (
    <div style={{ marginTop: 24, fontSize: '0.82rem', lineHeight: 2 }}>
      <p>Local e data: {termoData.termoLocal || '_________'}, {termoData.termoDataStr || '___/___/______'}</p>
      <div style={{ marginTop: 20, maxWidth: 280 }}>
        {sigBlock('vet', vetInfo?.name ?? 'Veterinário Responsável', vetLabel2)}
      </div>
    </div>
  )

  function printModal() {
    const el = document.getElementById('termo-print-content')
    if (!el) return
    const isReceita = activeModal === 'receita-simples' || activeModal === 'receita-especial'
    const css = isReceita
      ? `@page{size:A4;margin:15mm}body{font-family:Arial,sans-serif;font-size:13px;line-height:1.6;margin:0;padding:0;display:flex;flex-direction:column;min-height:247mm;box-sizing:border-box;}h2,h3{margin:0 0 8px}.footer-vet{margin-top:auto;padding-top:24px;}p,div,table{page-break-inside:avoid}.no-print{display:none!important}@media print{button{display:none}}`
      : `body{font-family:Arial,sans-serif;padding:40px;font-size:13px;line-height:1.6;}h2,h3{margin:0 0 8px}.footer-vet{margin-top:auto;padding-top:32px;}.no-print{display:none!important}@media print{button{display:none}}`
    const win = window.open('', '_blank', 'width=800,height=700')
    win.document.write(`<html><head><title>Termo</title><style>${css}</style></head><body>${el.innerHTML}<script>window.onload=()=>window.print()<\/script></body></html>`)
    win.document.close()
    if (onAddAnexo) {
      const label = TERMOS.find(t => t.id === activeModal)?.label ?? activeModal
      onAddAnexo({ nome: `${label} — ${hoje}`, tipo: 'termo', conteudoHtml: el.innerHTML, dataAdicionado: new Date().toISOString() })
    }
    closeModal()
  }

  const TERMOS = [
    { id: 'atestado-transito',   label: 'Atestado Sanitário para Trânsito de Cães e Gatos', desc: 'Certificado CFMV para transporte — protocolo vacinal, antiparasitário, identificação' },
    { id: 'atestado-vacinacao',  label: 'Atestado de Vacinação',          desc: 'Comprovante de vacinas aplicadas' },
    { id: 'atestado-sanitario',  label: 'Atestado Sanitário',             desc: 'Certificado de estado sanitário do animal' },
    { id: 'certificado-coragem', label: 'Certificado de Coragem',         desc: 'Certificado simbólico de bravura durante atendimento' },
    { id: 'encaminhamento',      label: 'Encaminhamento',                 desc: 'Carta de encaminhamento para especialista ou outro serviço' },
    { id: 'receita-especial',    label: 'Receita Especial Controlada',    desc: 'Modelo de receita especial para medicamentos controlados (CFMV)' },
    { id: 'receita-simples',     label: 'Receita Simples',                desc: 'Modelo de receita simples em branco (CFMV)' },
    { id: 'anestesico',          label: 'TCLE Anestésico-Cirúrgico',      desc: 'Consentimento para procedimentos cirúrgicos e anestésicos (CFMV Res. 1321/2020)' },
    { id: 'tcle-exames',         label: 'TCLE Exames',                    desc: 'Autorização para realização de exames complementares' },
    { id: 'exames',              label: 'TCLE Exames e Internação',       desc: 'Autorização para realização de exames complementares e internação' },
    { id: 'retirada-corpo',      label: 'TCLE Retirada de Corpo',         desc: 'Autorização para retirada do corpo/cadáver do animal' },
    { id: 'telemedicina',        label: 'TCLE Telemedicina',              desc: 'Consentimento para atendimento veterinário por telemedicina (CFMV Res. 1370/2022)' },
    { id: 'termo-alta',          label: 'Termo de Alta',                  desc: 'Documento de alta hospitalar com orientações pós-internação' },
    { id: 'eutanasia',           label: 'Termo de Eutanásia',             desc: 'Autorização para eutanásia humanitária — CFMV Res. 1000/2012' },
    { id: 'obito',               label: 'Termo de Óbito',                 desc: 'Declaração de óbito do animal' },
    { id: 'recusa',              label: 'Termo de Recusa / Alta a Pedido',          desc: 'Registro de recusa de tratamento ou alta a pedido do tutor' },
    { id: 'declaracao-recusa',   label: 'Declaração de Recusa e/ou Interrupção de Tratamento / Alta a Pedido', desc: 'Declaração formal detalhada de recusa de tratamento — com dados completos do tutor' },
    { id: 'derma-continuo',      label: 'Termo de Ciência, Esclarecimento e Consentimento (Tratamento Dermatológico Contínuo)', desc: 'Consentimento informado para tratamento dermatológico de longa duração' },
    { id: 'termo-cannabis',      label: 'Termo de Ciência de Acompanhamento Periódico (Canábico)', desc: 'Ciência do tutor sobre acompanhamento periódico para ajuste de dose e diretrizes de receita canábica' },
  ]

  const activeTermoLabel = TERMOS.find(t => t.id === activeModal)?.label ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>Selecione o termo desejado, preencha os dados e imprima.</p>
      {[...TERMOS].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')).map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>{t.label}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0' }}>{t.desc}</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => setActiveModal(t.id)}>Gerar →</button>
        </div>
      ))}

      {activeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 32, width: '100%', maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1.05rem', margin: 0 }}>{activeTermoLabel}</h3>
              <button className="btn btn-ghost btn-sm" onClick={closeModal}><X size={16} /></button>
            </div>

            {activeModal === 'atestado-sanitario' && (
              <>
                <div className="form-group">
                  <label className="form-label">Motivo / destinação</label>
                  <input className="form-input" value={termoData.motivoAtestado} onChange={e => setTermoData(d => ({ ...d, motivoAtestado: e.target.value }))} placeholder="Ex: Adoção, Exposição, Guarda compartilhada..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Validade do atestado</label>
                  <input className="form-input" value={termoData.validadeAtestado} onChange={e => setTermoData(d => ({ ...d, validadeAtestado: e.target.value }))} placeholder="Ex: 30 dias a partir da emissão" />
                </div>
              </>
            )}
            {activeModal === 'atestado-transito' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                <div className="form-group">
                  <label className="form-label">Microchip / Tatuagem</label>
                  <input className="form-input" value={termoData.microchip} onChange={e => setTermoData(d => ({ ...d, microchip: e.target.value }))} placeholder="Número do microchip ou tatuagem" />
                </div>
                <div className="form-group">
                  <label className="form-label">Finalidade do trânsito</label>
                  <input className="form-input" value={termoData.transitoFinalidade} onChange={e => setTermoData(d => ({ ...d, transitoFinalidade: e.target.value }))} placeholder="Ex: Mudança, Passeio, Exposição..." />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Endereço de origem (completo)</label>
                  <input className="form-input" value={termoData.transitoOrigem} onChange={e => setTermoData(d => ({ ...d, transitoOrigem: e.target.value }))} placeholder="Rua, nº, bairro, cidade/UF" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Endereço de destino (cidade/UF)</label>
                  <input className="form-input" value={termoData.transitoDestino} onChange={e => setTermoData(d => ({ ...d, transitoDestino: e.target.value }))} placeholder="Cidade/UF de destino" />
                </div>
                <div className="form-group">
                  <label className="form-label">Meio de transporte</label>
                  <input className="form-input" value={termoData.transitoMeio} onChange={e => setTermoData(d => ({ ...d, transitoMeio: e.target.value }))} placeholder="Ex: Rodoviário, Aéreo, Particular" />
                </div>
                <div className="form-group">
                  <label className="form-label">Endoparasiticida / Vermífugo (produto)</label>
                  <input className="form-input" value={termoData.endectocida} onChange={e => setTermoData(d => ({ ...d, endectocida: e.target.value }))} placeholder="Nome do produto" />
                </div>
                <div className="form-group">
                  <label className="form-label">Endoparasiticida / Vermífugo — data de aplicação</label>
                  <input className="form-input" value={termoData.endectocidaData} onChange={e => setTermoData(d => ({ ...d, endectocidaData: e.target.value }))} placeholder="DD/MM/AAAA" />
                </div>
                <div className="form-group">
                  <label className="form-label">Ectoparasiticida / Antipulgas (produto)</label>
                  <input className="form-input" value={termoData.vermifugo} onChange={e => setTermoData(d => ({ ...d, vermifugo: e.target.value }))} placeholder="Nome do produto" />
                </div>
                <div className="form-group">
                  <label className="form-label">Ectoparasiticida / Antipulgas — data de aplicação</label>
                  <input className="form-input" value={termoData.vermifugaData} onChange={e => setTermoData(d => ({ ...d, vermifugaData: e.target.value }))} placeholder="DD/MM/AAAA" />
                </div>
              </div>
            )}
            {activeModal === 'atestado-vacinacao' && (
              <>
                {(form.vacinasAplicadas ?? []).length === 0 && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>Nenhuma vacina registrada neste prontuário. As vacinas da aba Vacinas serão exibidas automaticamente.</p>
                )}
                <div className="form-group">
                  <label className="form-label">Observações adicionais</label>
                  <textarea className="form-textarea" style={{ minHeight: 60 }} value={termoData.vacinasAtestado} onChange={e => setTermoData(d => ({ ...d, vacinasAtestado: e.target.value }))} placeholder="Informações complementares (opcional)..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Validade do atestado</label>
                  <input className="form-input" value={termoData.validadeAtestado} onChange={e => setTermoData(d => ({ ...d, validadeAtestado: e.target.value }))} placeholder="Ex: 12 meses" />
                </div>
              </>
            )}
            {activeModal === 'certificado-coragem' && (
              <div className="form-group">
                <label className="form-label">Motivo do certificado</label>
                <textarea className="form-textarea" style={{ minHeight: 72 }} value={termoData.motivoCertificado} onChange={e => setTermoData(d => ({ ...d, motivoCertificado: e.target.value }))} placeholder="Ex: Passou por cirurgia e se recuperou com muita bravura!" />
              </div>
            )}
            {activeModal === 'encaminhamento' && (
              <>
                <div className="form-group">
                  <label className="form-label">Especialidade / serviço de destino</label>
                  <input className="form-input" value={termoData.especialidade} onChange={e => setTermoData(d => ({ ...d, especialidade: e.target.value }))} placeholder="Ex: Neurologia veterinária, Oncologia..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Clínica / hospital de destino (opcional)</label>
                  <input className="form-input" value={termoData.clinicaDestino} onChange={e => setTermoData(d => ({ ...d, clinicaDestino: e.target.value }))} placeholder="Nome e endereço da clínica de destino" />
                </div>
                <div className="form-group">
                  <label className="form-label">Motivo do encaminhamento</label>
                  <textarea className="form-textarea" style={{ minHeight: 80 }} value={termoData.motivoAtestado} onChange={e => setTermoData(d => ({ ...d, motivoAtestado: e.target.value }))} placeholder="Resumo clínico, hipóteses diagnósticas, exames realizados..." />
                </div>
              </>
            )}
            {activeModal === 'anestesico' && (
              <div className="form-group">
                <label className="form-label">Procedimento cirúrgico</label>
                <input className="form-input" value={termoData.procedimento} onChange={e => setTermoData(d => ({ ...d, procedimento: e.target.value }))} placeholder="Ex: Orquiectomia eletiva, Cesariana..." />
              </div>
            )}
            {(activeModal === 'tcle-exames' || activeModal === 'exames') && (
              <>
                <div className="form-group">
                  <label className="form-label">Exames solicitados</label>
                  <textarea className="form-textarea" style={{ minHeight: 80 }} value={termoData.exames} onChange={e => setTermoData(d => ({ ...d, exames: e.target.value }))} placeholder="Hemograma, bioquímico, ultrassonografia..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Valores estimados (R$)</label>
                  <input className="form-input" value={termoData.valoresEstimados} onChange={e => setTermoData(d => ({ ...d, valoresEstimados: e.target.value }))} placeholder="Ex: R$ 350,00 a R$ 500,00" />
                </div>
              </>
            )}
            {activeModal === 'retirada-corpo' && (
              <div className="form-group">
                <label className="form-label">Destinação do corpo</label>
                <input className="form-input" value={termoData.destinoCadaver} onChange={e => setTermoData(d => ({ ...d, destinoCadaver: e.target.value }))} placeholder="Ex: Cremação, Enterro em domicílio, Cemitério Pet..." />
              </div>
            )}
            {activeModal === 'telemedicina' && (
              <div className="form-group">
                <label className="form-label">Plataforma utilizada</label>
                <input className="form-input" value={termoData.plataforma} onChange={e => setTermoData(d => ({ ...d, plataforma: e.target.value }))} placeholder="Ex: WhatsApp, Google Meet, Teams..." />
              </div>
            )}
            {activeModal === 'termo-alta' && (
              <>
                <div className="form-group">
                  <label className="form-label">Condição de alta</label>
                  <input className="form-input" value={termoData.condicaoAlta} onChange={e => setTermoData(d => ({ ...d, condicaoAlta: e.target.value }))} placeholder="Ex: Estável, em acompanhamento ambulatorial..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Orientações pós-alta</label>
                  <textarea className="form-textarea" style={{ minHeight: 80 }} value={termoData.orientacoesAlta} onChange={e => setTermoData(d => ({ ...d, orientacoesAlta: e.target.value }))} placeholder="Medicamentos, restrições, retorno..." />
                </div>
              </>
            )}
            {activeModal === 'eutanasia' && (
              <>
                <div className="form-group">
                  <label className="form-label">Diagnóstico</label>
                  <input className="form-input" value={form.diagnostico?.definitivo || ''} disabled placeholder="Preenchido automaticamente do diagnóstico" />
                </div>
                <div className="form-group">
                  <label className="form-label">Método</label>
                  <input className="form-input" value={termoData.metodo} onChange={e => setTermoData(d => ({ ...d, metodo: e.target.value }))} placeholder="Ex: Sobredose de barbitúrico (Pentobarbital IV)" />
                </div>
                <div className="form-group">
                  <label className="form-label">Testemunha</label>
                  <input className="form-input" value={termoData.testemunha} onChange={e => setTermoData(d => ({ ...d, testemunha: e.target.value }))} placeholder="Nome completo da testemunha" />
                </div>
                <div style={{ background: '#fff3f3', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px', fontSize: '0.8125rem', color: 'var(--danger)', fontWeight: 600 }}>
                  ⚠️ Este termo é irreversível. Confirme que todas as opções terapêuticas foram esgotadas e que o tutor está plenamente ciente da decisão.
                </div>
              </>
            )}
            {activeModal === 'obito' && (
              <>
                <div className="form-group">
                  <label className="form-label">Causa mortis</label>
                  <input className="form-input" value={termoData.causaMorte} onChange={e => setTermoData(d => ({ ...d, causaMorte: e.target.value }))} placeholder="Ex: Falência múltipla de órgãos, Parada cardiorrespiratória..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Data e hora do óbito</label>
                  <input className="form-input" value={termoData.dataHoraObito} onChange={e => setTermoData(d => ({ ...d, dataHoraObito: e.target.value }))} placeholder="Ex: 17/05/2026 às 14h30" />
                </div>
                <div className="form-group">
                  <label className="form-label">Destinação do corpo</label>
                  <input className="form-input" value={termoData.destinoCadaver} onChange={e => setTermoData(d => ({ ...d, destinoCadaver: e.target.value }))} placeholder="Ex: Cremação, Enterro, Cemitério Pet..." />
                </div>
              </>
            )}
            {activeModal === 'recusa' && (
              <div className="form-group">
                <label className="form-label">Procedimento/tratamento recusado</label>
                <textarea className="form-textarea" style={{ minHeight: 80 }} value={termoData.procedimentoRecusa} onChange={e => setTermoData(d => ({ ...d, procedimentoRecusa: e.target.value }))} placeholder="Descreva o(s) procedimento(s) recusado(s)..." />
              </div>
            )}
            {activeModal === 'declaracao-recusa' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Nome do tutor</label>
                  <input className="form-input" value={termoData.tutorNomeRecusa} onChange={e => setTermoData(d => ({ ...d, tutorNomeRecusa: e.target.value }))} placeholder="Nome completo" />
                </div>
                <div className="form-group">
                  <label className="form-label">RG</label>
                  <input className="form-input" value={termoData.tutorRGRecusa} onChange={e => setTermoData(d => ({ ...d, tutorRGRecusa: maskRG(e.target.value) }))} placeholder="00.000.000-0" />
                </div>
                <div className="form-group">
                  <label className="form-label">CPF</label>
                  <input className="form-input" value={termoData.tutorCPFRecusa} onChange={e => setTermoData(d => ({ ...d, tutorCPFRecusa: maskCPF(e.target.value) }))} placeholder="000.000.000-00" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Endereço</label>
                  <input className="form-input" value={termoData.tutorEnderecoRecusa} onChange={e => setTermoData(d => ({ ...d, tutorEnderecoRecusa: e.target.value }))} placeholder="Rua, número, bairro, cidade" />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone</label>
                  <input className="form-input" value={termoData.tutorTelRecusa} onChange={e => setTermoData(d => ({ ...d, tutorTelRecusa: maskPhone(e.target.value) }))} placeholder="(11) 99999-9999" />
                </div>
                <div className="form-group">
                  <label className="form-label">Veterinário ou Clínica</label>
                  <input className="form-input" value={termoData.vetClinicaRecusa} onChange={e => setTermoData(d => ({ ...d, vetClinicaRecusa: e.target.value }))} placeholder="Nome da clínica ou veterinário" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Tratamento/procedimento recusado</label>
                  <textarea className="form-textarea" style={{ minHeight: 80 }} value={termoData.recusaTratamento} onChange={e => setTermoData(d => ({ ...d, recusaTratamento: e.target.value }))} placeholder="Descreva o tratamento ou procedimento que está sendo recusado..." />
                </div>
              </div>
            )}
            {activeModal === 'derma-continuo' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Nome do tutor</label>
                  <input className="form-input" value={termoData.tutorNomeDerma} onChange={e => setTermoData(d => ({ ...d, tutorNomeDerma: e.target.value }))} placeholder="Nome completo" />
                </div>
                <div className="form-group">
                  <label className="form-label">CPF</label>
                  <input className="form-input" value={termoData.tutorCPFDerma} onChange={e => setTermoData(d => ({ ...d, tutorCPFDerma: maskCPF(e.target.value) }))} placeholder="000.000.000-00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone</label>
                  <input className="form-input" value={termoData.tutorTelDerma} onChange={e => setTermoData(d => ({ ...d, tutorTelDerma: maskPhone(e.target.value) }))} placeholder="(11) 99999-9999" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Endereço</label>
                  <input className="form-input" value={termoData.tutorEnderecoDerma} onChange={e => setTermoData(d => ({ ...d, tutorEnderecoDerma: e.target.value }))} placeholder="Rua, número, bairro, cidade" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Afecção dermatológica diagnosticada</label>
                  <textarea className="form-textarea" style={{ minHeight: 72 }} value={termoData.afeccaoDerma} onChange={e => setTermoData(d => ({ ...d, afeccaoDerma: e.target.value }))} placeholder="Ex: Dermatite atópica canina, piodermite recorrente..." />
                </div>
              </div>
            )}

            {activeModal === 'termo-cannabis' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Nome do tutor</label>
                  <input className="form-input" value={termoData.tutorNomeCanabis} onChange={e => setTermoData(d => ({ ...d, tutorNomeCanabis: e.target.value }))} placeholder="Nome completo" />
                </div>
                <div className="form-group">
                  <label className="form-label">CPF</label>
                  <input className="form-input" value={termoData.tutorCPFCanabis} onChange={e => setTermoData(d => ({ ...d, tutorCPFCanabis: maskCPF(e.target.value) }))} placeholder="000.000.000-00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone</label>
                  <input className="form-input" value={termoData.tutorTelCanabis} onChange={e => setTermoData(d => ({ ...d, tutorTelCanabis: maskPhone(e.target.value) }))} placeholder="(11) 99999-9999" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Endereço</label>
                  <input className="form-input" value={termoData.tutorEnderecoCanabis} onChange={e => setTermoData(d => ({ ...d, tutorEnderecoCanabis: e.target.value }))} placeholder="Rua, número, bairro, cidade" />
                </div>
              </div>
            )}

            {/* Shared: Local, Data, Assinaturas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div className="form-group">
                <label className="form-label">Local</label>
                <input className="form-input" value={termoData.termoLocal} onChange={e => setTermoData(d => ({ ...d, termoLocal: e.target.value }))} placeholder="cidade" />
              </div>
              <div className="form-group">
                <label className="form-label">Data</label>
                <input className="form-input" value={termoData.termoDataStr} onChange={e => setTermoData(d => ({ ...d, termoDataStr: e.target.value }))} placeholder="DD/MM/AAAA" />
              </div>
              <div>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6 }}>Assinatura do Tutor</p>
                {termoData.assinaturaTutor
                  ? <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <img src={termoData.assinaturaTutor} alt="Assinatura" style={{ maxHeight: 50, border: '1px solid var(--border)', borderRadius: 6, background: '#fff' }} />
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setTermoData(d => ({ ...d, assinaturaTutor: null }))}>Limpar</button>
                    </div>
                  : <button className="btn btn-outline btn-sm" onClick={() => setShowSigCanvas('tutor')}>✍️ Assinar agora</button>}
              </div>
              <div>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6 }}>Assinatura do Veterinário</p>
                {termoData.assinaturaVet
                  ? <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <img src={termoData.assinaturaVet} alt="Assinatura" style={{ maxHeight: 50, border: '1px solid var(--border)', borderRadius: 6, background: '#fff' }} />
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setTermoData(d => ({ ...d, assinaturaVet: null }))}>Limpar</button>
                    </div>
                  : <button className="btn btn-outline btn-sm" onClick={() => setShowSigCanvas('vet')}>✍️ Assinar agora</button>}
              </div>
            </div>

            <div id="termo-print-content" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 20, background: '#fff', color: '#111', fontSize: '0.875rem', lineHeight: 1.8, maxHeight: 400, overflowY: 'auto' }}>
              {clinicHeader}
              <h3 style={{ textAlign: 'center', margin: '16px 0', fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>{activeTermoLabel}</h3>

              {activeModal === 'atestado-sanitario' && (
                <>{qualAnimal}{qualTutor}
                  <p>Atesto, para os devidos fins, que o animal acima identificado foi submetido a exame clínico nesta data e encontra-se em boas condições de saúde, sem sinais de doenças infectocontagiosas.</p>
                  {termoData.motivoAtestado && <p><strong>Motivo/Destinação:</strong> {termoData.motivoAtestado}</p>}
                  {termoData.validadeAtestado && <p><strong>Validade deste atestado:</strong> {termoData.validadeAtestado}</p>}
                  {footerSoVet}
                </>
              )}
              {activeModal === 'atestado-transito' && (
                <>{qualAnimal}{qualTutor}
                  {termoData.microchip && <p><strong>Identificação (microchip/tatuagem):</strong> {termoData.microchip}</p>}
                  {termoData.transitoOrigem && <p><strong>Origem:</strong> {termoData.transitoOrigem}</p>}
                  {termoData.transitoDestino && <p><strong>Destino:</strong> {termoData.transitoDestino}</p>}
                  {termoData.transitoFinalidade && <p><strong>Finalidade:</strong> {termoData.transitoFinalidade}</p>}
                  {termoData.transitoMeio && <p><strong>Meio de transporte:</strong> {termoData.transitoMeio}</p>}
                  <p style={{ marginTop: 12 }}>Atesto que o animal acima identificado foi submetido a exame clínico nesta data e encontra-se em boas condições de saúde, apto para transporte, sem sinais aparentes de doença infectocontagiosa.</p>
                  <p style={{ fontWeight: 700, marginTop: 12, marginBottom: 4 }}>PROTOCOLO VACINAL:</p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: 12 }}>
                    <thead>
                      <tr style={{ background: '#f0f0f0' }}>
                        {['Vacina', 'Laboratório', 'Lote', 'Data Aplicação', 'Validade'].map(h => (
                          <th key={h} style={{ border: '1px solid #ccc', padding: '4px 8px', textAlign: 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(form.vacinasAplicadas ?? []).length > 0 ? (form.vacinasAplicadas ?? []).map((v, idx) => (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #ccc', padding: '4px 8px' }}>{v.vacina === 'Outra' ? (v.vacinaOutra ?? '—') : (v.vacina ?? v.nomeVacina ?? '—')}</td>
                          <td style={{ border: '1px solid #ccc', padding: '4px 8px' }}>{v.fabricante ?? '—'}</td>
                          <td style={{ border: '1px solid #ccc', padding: '4px 8px' }}>{v.lote ?? '—'}</td>
                          <td style={{ border: '1px solid #ccc', padding: '4px 8px' }}>{v.dataAplicacao ? new Date(v.dataAplicacao + 'T00:00').toLocaleDateString('pt-BR') : '—'}</td>
                          <td style={{ border: '1px solid #ccc', padding: '4px 8px' }}>{v.proximoReforco ? new Date(v.proximoReforco + 'T00:00').toLocaleDateString('pt-BR') : (v.validade ?? v.validadeFrasco) ? new Date((v.validade ?? v.validadeFrasco) + 'T00:00').toLocaleDateString('pt-BR') : '—'}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={5} style={{ border: '1px solid #ccc', padding: '6px 8px', color: '#888', textAlign: 'center' }}>Sem vacinas registradas neste prontuário</td></tr>
                      )}
                    </tbody>
                  </table>
                  <p style={{ fontWeight: 700, marginBottom: 4 }}>TRATAMENTO ANTIPARASITÁRIO:</p>
                  <p>Endoparasiticida / Vermífugo: {termoData.endectocida || '______________________'} — Data: {termoData.endectocidaData || '___/___/______'}</p>
                  <p>Ectoparasiticida / Antipulgas: {termoData.vermifugo || '______________________'} — Data: {termoData.vermifugaData || '___/___/______'}</p>
                  <p style={{ marginTop: 12, fontSize: '0.8rem', color: '#555' }}>Declaro ser o responsável técnico pelo atendimento e me responsabilizo pelas informações constantes neste documento, em conformidade com o Código de Ética da Medicina Veterinária (CFMV).</p>
                  {footerSoVet}
                </>
              )}
              {activeModal === 'atestado-vacinacao' && (
                <>{qualAnimal}{qualTutor}
                  <p>Atesto que o animal acima identificado recebeu as seguintes vacinas conforme protocolo vacinal:</p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: 12 }}>
                    <thead>
                      <tr style={{ background: '#f0f0f0' }}>
                        {['Vacina', 'Fabricante', 'Lote', 'Data Aplicação', 'Validade'].map(h => (
                          <th key={h} style={{ border: '1px solid #ccc', padding: '4px 8px', textAlign: 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(form.vacinasAplicadas ?? []).length > 0 ? (form.vacinasAplicadas ?? []).map((v, idx) => (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #ccc', padding: '4px 8px' }}>{v.vacina === 'Outra' ? (v.vacinaOutra ?? '—') : (v.vacina ?? '—')}</td>
                          <td style={{ border: '1px solid #ccc', padding: '4px 8px' }}>{v.fabricante ?? '—'}</td>
                          <td style={{ border: '1px solid #ccc', padding: '4px 8px' }}>{v.lote ?? '—'}</td>
                          <td style={{ border: '1px solid #ccc', padding: '4px 8px' }}>{v.dataAplicacao ? new Date(v.dataAplicacao + 'T00:00').toLocaleDateString('pt-BR') : '—'}</td>
                          <td style={{ border: '1px solid #ccc', padding: '4px 8px' }}>{v.proximoReforco ? new Date(v.proximoReforco + 'T00:00').toLocaleDateString('pt-BR') : (v.validade ?? v.validadeFrasco) ? new Date((v.validade ?? v.validadeFrasco) + 'T00:00').toLocaleDateString('pt-BR') : '—'}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={5} style={{ border: '1px solid #ccc', padding: '6px 8px', color: '#888', textAlign: 'center' }}>Sem vacinas registradas neste prontuário</td></tr>
                      )}
                    </tbody>
                  </table>
                  {termoData.vacinasAtestado && <p style={{ whiteSpace: 'pre-line' }}><strong>Observações:</strong> {termoData.vacinasAtestado}</p>}
                  {termoData.validadeAtestado && <p><strong>Validade deste atestado:</strong> {termoData.validadeAtestado}</p>}
                  {footerSoVet}
                </>
              )}
              {activeModal === 'certificado-coragem' && (
                <>
                  <div style={{ textAlign: 'center', margin: '8px 0 16px' }}>
                    <p style={{ fontSize: '0.95rem', fontStyle: 'italic', color: '#555' }}>Certificamos que</p>
                    <p style={{ fontSize: '1.3rem', fontWeight: 800, margin: '4px 0' }}>{petInfo?.name ?? '______________________'}</p>
                    <p style={{ fontSize: '0.95rem', fontStyle: 'italic', color: '#555' }}>demonstrou imensa coragem e bravura durante seu atendimento veterinário.</p>
                    {termoData.motivoCertificado && <p style={{ margin: '12px 0 0', fontStyle: 'italic' }}>"{termoData.motivoCertificado}"</p>}
                  </div>
                  {footerSoVet}
                </>
              )}
              {activeModal === 'encaminhamento' && (
                <>{qualAnimal}{qualTutor}
                  <p>Encaminho o paciente acima para avaliação especializada em <strong>{termoData.especialidade || '______________________'}</strong>.</p>
                  {termoData.clinicaDestino && <p><strong>Serviço de destino:</strong> {termoData.clinicaDestino}</p>}
                  {termoData.motivoAtestado && <><p><strong>Histórico clínico / Motivo do encaminhamento:</strong></p><p style={{ whiteSpace: 'pre-line' }}>{termoData.motivoAtestado}</p></>}
                  <p>Diagnóstico principal: <strong>{form.diagnostico?.definitivo || '______________________'}</strong></p>
                  {footerSoVet}
                </>
              )}
              {activeModal === 'receita-simples' && (
                <>{qualAnimal}{qualTutor}
                  <div style={{ flex: 1, marginTop: 20, minHeight: 200, borderBottom: '1px dashed #ccc' }}>
                    <p style={{ fontStyle: 'italic', color: '#999', textAlign: 'center' }}>(campos para preenchimento manual)</p>
                  </div>
                  <p style={{ marginTop: 12, fontSize: '0.82rem', color: '#777' }}>Data de validade da receita: ___/___/______</p>
                  <div className="footer-vet" style={{ fontSize: '0.82rem', lineHeight: 2 }}>
                    <p>Local e data: {termoData.termoLocal || '_________'}, {termoData.termoDataStr || '___/___/______'}</p>
                    <div style={{ marginTop: 20, maxWidth: 280 }}>
                      {sigBlock('vet', vetInfo?.name ?? 'Veterinário Responsável', vetLabel2)}
                    </div>
                  </div>
                </>
              )}
              {activeModal === 'receita-especial' && (
                <>
                  <p style={{ fontSize: '0.75rem', color: '#777', textAlign: 'center', marginBottom: 8 }}>Receituário de Controle Especial — 2 vias (Portaria SVS/MS nº 344/98)</p>
                  {qualAnimal}{qualTutor}
                  <div style={{ flex: 1, marginTop: 20, minHeight: 200, borderBottom: '1px dashed #ccc' }}>
                    <p style={{ fontStyle: 'italic', color: '#999', textAlign: 'center' }}>(campos para preenchimento manual)</p>
                  </div>
                  <p style={{ marginTop: 12, fontSize: '0.82rem', color: '#777' }}>Data de validade da receita: ___/___/______ · <strong>Validade: 30 dias</strong></p>
                  <p style={{ fontSize: '0.75rem', color: '#777' }}>Nº da notificação: ______________________</p>
                  <p style={{ fontWeight: 700, textAlign: 'center', margin: '10px 0 4px', fontSize: '0.78rem', border: '1px solid #555', padding: '5px 8px', letterSpacing: 0.3 }}>
                    ESTE RECEITUÁRIO SÓ TEM VALIDADE COM CARIMBO E ASSINATURA DO RESPONSÁVEL
                  </p>
                  <div className="footer-vet" style={{ fontSize: '0.82rem', lineHeight: 2 }}>
                    <p>Local e data: {termoData.termoLocal || '_________'}, {termoData.termoDataStr || '___/___/______'}</p>
                    <div style={{ marginTop: 20, maxWidth: 280 }}>
                      {sigBlock('vet', vetInfo?.name ?? 'Veterinário Responsável', vetLabel2)}
                    </div>
                  </div>
                </>
              )}
              {activeModal === 'anestesico' && (
                <>{qualTutor}{qualAnimal}
                  <p>O(A) tutor(a) acima qualificado(a) declara ter sido devidamente informado(a) pelo Médico-Veterinário responsável sobre os riscos inerentes ao procedimento de <strong>{termoData.procedimento || '______________________'}</strong>, incluindo riscos anestésicos, cirúrgicos e pós-operatórios, conforme <em>Resolução CFMV nº 1321/2020</em>.</p>
                  <p>Declaro estar ciente de que mesmo com todos os cuidados, existe possibilidade de complicações imprevisíveis, e que autorizo a equipe veterinária a tomar as medidas necessárias para preservar a saúde e vida do animal.</p>
                  <p><strong>Riscos informados:</strong> Reação adversa a fármacos, hipotermia, hipotensão, apneia, sangramento intraoperatório, infecção pós-operatória, outros.</p>
                  {footer}
                </>
              )}
              {activeModal === 'tcle-exames' && (
                <>{qualTutor}{qualAnimal}
                  <p>O(A) tutor(a) autoriza a realização dos seguintes exames complementares:</p>
                  <p><strong>Exames:</strong> {termoData.exames || '______________________'}</p>
                  <p><strong>Valores estimados:</strong> {termoData.valoresEstimados || 'A definir conforme necessidade clínica'}</p>
                  <p>Estou ciente de que os valores são estimativas e podem variar conforme a necessidade clínica do animal.</p>
                  {footer}
                </>
              )}
              {activeModal === 'exames' && (
                <>{qualTutor}{qualAnimal}
                  <p>O(A) tutor(a) autoriza a realização dos seguintes exames e/ou internação:</p>
                  <p><strong>Exames:</strong> {termoData.exames || '______________________'}</p>
                  <p><strong>Valores estimados:</strong> {termoData.valoresEstimados || 'A definir conforme evolução clínica'}</p>
                  <p>Estou ciente de que os valores são estimativas e podem variar conforme a necessidade clínica do animal.</p>
                  {footer}
                </>
              )}
              {activeModal === 'retirada-corpo' && (
                <>{qualTutor}{qualAnimal}
                  <p>O(A) tutor(a) declara que está recolhendo o corpo do animal acima identificado, que veio a óbito sob cuidados desta clínica, e autoriza sua retirada nesta data.</p>
                  {termoData.destinoCadaver && <p><strong>Destinação:</strong> {termoData.destinoCadaver}</p>}
                  <p>Declaro que tenho ciência do estado do corpo e que assumo toda a responsabilidade legal pela destinação final.</p>
                  {footer}
                </>
              )}
              {activeModal === 'telemedicina' && (
                <>{qualTutor}{qualAnimal}
                  <p>O(A) tutor(a) declara ter sido informado(a) sobre as condições e limitações do atendimento veterinário por telemedicina, conforme <em>Resolução CFMV nº 1370/2022</em>, e autoriza a realização da consulta por meio digital.</p>
                  {termoData.plataforma && <p><strong>Plataforma:</strong> {termoData.plataforma}</p>}
                  <p>Estou ciente de que a telemedicina não substitui o exame físico presencial quando necessário, e que o médico-veterinário poderá solicitar consulta presencial a qualquer momento.</p>
                  {footer}
                </>
              )}
              {activeModal === 'termo-alta' && (
                <>{qualTutor}{qualAnimal}
                  <p>O(A) tutor(a) recebe o animal em alta hospitalar na data de hoje.</p>
                  {termoData.condicaoAlta && <p><strong>Condição de alta:</strong> {termoData.condicaoAlta}</p>}
                  {termoData.orientacoesAlta && <><p><strong>Orientações pós-alta:</strong></p><p style={{ whiteSpace: 'pre-line' }}>{termoData.orientacoesAlta}</p></>}
                  <p>Declaro que recebi as orientações necessárias para o cuidado do animal em domicílio e que fui informado(a) sobre a necessidade de retorno em caso de intercorrências.</p>
                  {footer}
                </>
              )}
              {activeModal === 'eutanasia' && (
                <>{qualTutor}{qualAnimal}
                  <p>O(A) tutor(a) declara estar plenamente ciente do estado clínico do animal, com diagnóstico de <strong>{form.diagnostico?.definitivo || '______________________'}</strong>, e, após esgotar todas as possibilidades terapêuticas e ouvir o parecer do Médico-Veterinário responsável, decide pela eutanásia humanitária do animal.</p>
                  <p><strong>Método:</strong> {termoData.metodo || '______________________'}</p>
                  <p>Procedimento realizado em conformidade com a <em>Resolução CFMV nº 1000/2012</em>.</p>
                  {termoData.testemunha && <p><strong>Testemunha:</strong> {termoData.testemunha}</p>}
                  {footer}
                </>
              )}
              {activeModal === 'obito' && (
                <>{qualAnimal}{qualTutor}
                  <p>Declaramos o óbito do animal acima identificado, ocorrido enquanto sob cuidados desta clínica veterinária.</p>
                  {termoData.causaMorte && <p><strong>Causa mortis:</strong> {termoData.causaMorte}</p>}
                  {termoData.dataHoraObito && <p><strong>Data e hora do óbito:</strong> {termoData.dataHoraObito}</p>}
                  {termoData.destinoCadaver && <p><strong>Destinação do corpo:</strong> {termoData.destinoCadaver}</p>}
                  {footerSoVet}
                </>
              )}
              {activeModal === 'recusa' && (
                <>{qualTutor}{qualAnimal}
                  <p>O(A) tutor(a) declara que foi devidamente informado(a) pelo Médico-Veterinário responsável sobre a necessidade do seguinte procedimento/tratamento:</p>
                  <p><strong>{termoData.procedimentoRecusa || '______________________'}</strong></p>
                  <p>Declaro que, mesmo ciente dos riscos que a recusa pode acarretar à saúde e/ou à vida do animal, optou por <strong>não autorizar</strong> a realização do(s) procedimento(s) acima, assumindo total responsabilidade pelas consequências decorrentes dessa decisão.</p>
                  {footer}
                </>
              )}
              {activeModal === 'declaracao-recusa' && (
                <>
                  <p style={{ fontSize: '0.875rem', lineHeight: 1.8, marginBottom: 14 }}>
                    Eu, <strong>{termoData.tutorNomeRecusa || '___________________'}</strong>, portador(a) do RG nº <strong>{termoData.tutorRGRecusa || '___.____.____-__'}</strong> e CPF <strong>{termoData.tutorCPFRecusa || '___.___.___-__'}</strong>, residente na <strong>{termoData.tutorEnderecoRecusa || '______________________'}</strong>, telefone <strong>{termoData.tutorTelRecusa || '____________'}</strong>, tutor(a) responsável pelo(a) animal de nome <strong>{petInfo?.name ?? '___'}</strong>, espécie <strong>{petInfo?.species ?? '___'}</strong>, raça <strong>{petInfo?.breed ?? '___'}</strong>, sexo <strong>{petInfo?.sex ?? '___'}</strong>, idade <strong>{petInfo?.birthDate ? calcularIdade(petInfo.birthDate) : '___'}</strong>, declaro para os devidos fins:
                  </p>
                  <p style={{ marginBottom: 10 }}><strong>1.</strong> Fui devidamente informado(a) pelo(a) Médico(a) Veterinário(a) <strong>{vetInfo?.name ?? '___'}</strong>, CRMV: <strong>{vetInfo?.crmv ?? '___'}</strong>, sobre o quadro clínico atual do meu animal e a necessidade imperiosa da realização do seguinte tratamento/procedimento: <strong>{termoData.recusaTratamento || '______________________'}</strong></p>
                  <p style={{ marginBottom: 10 }}><strong>2.</strong> Fui alertado(a) de forma clara e compreensível sobre os benefícios, os riscos, as possíveis complicações e o prognóstico caso o tratamento/procedimento recomendado não seja realizado.</p>
                  <p style={{ marginBottom: 10 }}><strong>3.</strong> Por livre e espontânea vontade, <strong>DECIDO RECUSAR / INTERROMPER</strong> o tratamento ou procedimento médico-veterinário indicado acima.</p>
                  <p style={{ marginBottom: 10 }}><strong>4.</strong> Assumo a inteira responsabilidade cível, penal e moral por esta decisão, estando ciente dos riscos à saúde e da possibilidade de agravamento do quadro clínico ou óbito do animal.</p>
                  <p style={{ marginBottom: 14 }}><strong>5.</strong> Isento o(a) profissional médico(a) veterinário(a) e a clínica/hospital veterinário <strong>{termoData.vetClinicaRecusa || clinicNome}</strong> de qualquer responsabilidade civil ou penal por danos, complicações ou consequências decorrentes exclusivamente da minha recusa em autorizar o procedimento recomendado.</p>
                  <div style={{ marginTop: 24, fontSize: '0.82rem', lineHeight: 2 }}>
                    <p>Local e data: {termoData.termoLocal || '_________'}, {termoData.termoDataStr || '___/___/______'}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 20 }}>
                      {sigBlock('tutor', 'Assinatura do Tutor', termoData.tutorNomeRecusa || '')}
                      {sigBlock('vet', vetInfo?.name ?? 'Veterinário Responsável', vetLabel2)}
                    </div>
                  </div>
                </>
              )}
              {activeModal === 'derma-continuo' && (
                <>
                  <p style={{ fontWeight: 700, marginBottom: 6 }}>I. IDENTIFICAÇÃO DO PACIENTE E RESPONSÁVEL</p>
                  <p style={{ marginBottom: 4 }}><strong>Nome do Animal:</strong> {petInfo?.name ?? '___'}</p>
                  <p style={{ marginBottom: 4 }}><strong>Espécie:</strong> {petInfo?.species ?? '___'} | <strong>Raça:</strong> {petInfo?.breed ?? '___'} | <strong>Sexo:</strong> {petInfo?.sex ?? '___'} | <strong>Idade:</strong> {petInfo?.birthDate ? calcularIdade(petInfo.birthDate) : '___'}</p>
                  <p style={{ marginBottom: 4 }}><strong>Nome do Tutor/Responsável:</strong> {termoData.tutorNomeDerma || '___________________'}</p>
                  <p style={{ marginBottom: 4 }}><strong>CPF:</strong> {termoData.tutorCPFDerma || '___.___.___-__'} | <strong>Telefone:</strong> {termoData.tutorTelDerma || '____________'}</p>
                  <p style={{ marginBottom: 14 }}><strong>Endereço:</strong> {termoData.tutorEnderecoDerma || '______________________'}</p>
                  <p style={{ fontWeight: 700, marginBottom: 6 }}>II. DIAGNÓSTICO CLÍNICO</p>
                  <p style={{ marginBottom: 14 }}>Declaro que fui informado(a) pelo(a) médico(a) veterinário(a) que o animal acima identificado foi diagnosticado com a seguinte afecção dermatológica: <strong>{termoData.afeccaoDerma || '______________________'}</strong>.</p>
                  <p style={{ fontWeight: 700, marginBottom: 6 }}>III. DECLARAÇÃO DE ESCLARECIMENTO</p>
                  <p style={{ marginBottom: 6 }}><strong>1.</strong> Fui informado(a) sobre o diagnóstico dermatológico do meu animal e os fundamentos do tratamento proposto.</p>
                  <p style={{ marginBottom: 6 }}><strong>2.</strong> Estou ciente de que afecções dermatológicas frequentemente requerem tratamento contínuo e prolongado, com reavaliações periódicas.</p>
                  <p style={{ marginBottom: 6 }}><strong>3.</strong> Fui esclarecido(a) sobre a importância da adesão rigorosa ao protocolo terapêutico prescrito, incluindo medicações, dieta e cuidados ambientais.</p>
                  <p style={{ marginBottom: 6 }}><strong>4.</strong> Compreendo que a interrupção ou modificação não autorizada do tratamento pode levar à recidiva, agravamento do quadro clínico e desenvolvimento de resistência a fármacos.</p>
                  <p style={{ marginBottom: 6 }}><strong>5.</strong> Fui informado(a) sobre possíveis efeitos colaterais dos medicamentos prescritos e sobre os sinais de alerta que devem motivar retorno imediato à clínica.</p>
                  <p style={{ marginBottom: 14 }}><strong>6.</strong> Recebi orientações sobre medidas de controle ambiental, higiene e prevenção, fundamentais para o sucesso do tratamento dermatológico.</p>
                  <p style={{ fontWeight: 700, marginBottom: 6 }}>IV. CONSENTIMENTO</p>
                  <p style={{ marginBottom: 14 }}>Após ter sido devidamente esclarecido(a) sobre o diagnóstico, o prognóstico e o protocolo de tratamento proposto, <strong>CONSINTO</strong> com a realização do tratamento dermatológico contínuo para o animal acima identificado, comprometendo-me a seguir as orientações fornecidas, comparecer às consultas de reavaliação agendadas e comunicar imediatamente ao(à) veterinário(a) responsável qualquer alteração no quadro clínico do animal.</p>
                  <div style={{ marginTop: 24, fontSize: '0.82rem', lineHeight: 2 }}>
                    <p>Local e data: {termoData.termoLocal || '_________'}, {termoData.termoDataStr || '___/___/______'}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 20 }}>
                      {sigBlock('tutor', 'Assinatura do Tutor/Responsável', termoData.tutorNomeDerma || '')}
                      {sigBlock('vet', vetInfo?.name ?? 'Veterinário Responsável', vetLabel2)}
                    </div>
                  </div>
                </>
              )}
              {activeModal === 'termo-cannabis' && (
                <>
                  <p style={{ fontWeight: 700, marginBottom: 6 }}>I. IDENTIFICAÇÃO DO PACIENTE E RESPONSÁVEL</p>
                  <p style={{ marginBottom: 4 }}><strong>Nome do Animal:</strong> {petInfo?.name ?? '___'}</p>
                  <p style={{ marginBottom: 4 }}><strong>Espécie:</strong> {petInfo?.species ?? '___'} | <strong>Raça:</strong> {petInfo?.breed ?? '___'} | <strong>Sexo:</strong> {petInfo?.sex ?? '___'} | <strong>Idade:</strong> {petInfo?.birthDate ? calcularIdade(petInfo.birthDate) : '___'}</p>
                  <p style={{ marginBottom: 4 }}><strong>Nome do Tutor/Responsável:</strong> {termoData.tutorNomeCanabis || '___________________'}</p>
                  <p style={{ marginBottom: 4 }}><strong>CPF:</strong> {termoData.tutorCPFCanabis || '___.___.___-__'} | <strong>Telefone:</strong> {termoData.tutorTelCanabis || '____________'}</p>
                  <p style={{ marginBottom: 14 }}><strong>Endereço:</strong> {termoData.tutorEnderecoCanabis || '______________________'}</p>

                  <p style={{ fontWeight: 700, marginBottom: 6 }}>II. OBJETO DO ACOMPANHAMENTO</p>
                  <p style={{ marginBottom: 14 }}>O presente termo tem por objeto registrar a ciência do(a) tutor(a) acima qualificado(a) acerca das diretrizes de acompanhamento periódico para o uso de fitocanabinoides no paciente veterinário identificado, em conformidade com a <em>Instrução Normativa MAPA nº 35/2021</em> e as orientações do Conselho Federal de Medicina Veterinária (CFMV).</p>

                  <p style={{ fontWeight: 700, marginBottom: 6 }}>III. CIÊNCIA DO TUTOR</p>
                  <p style={{ marginBottom: 6 }}><strong>1.</strong> Fui devidamente orientado(a) sobre o protocolo terapêutico com fitocanabinoides prescrito para o meu animal, incluindo a substância utilizada, a via de administração, a posologia e os objetivos terapêuticos.</p>
                  <p style={{ marginBottom: 6 }}><strong>2.</strong> Estou ciente de que o uso de produtos à base de cannabis veterinária requer <strong>acompanhamento periódico</strong> pelo(a) médico(a) veterinário(a) responsável, para avaliação da resposta terapêutica e eventual ajuste de dose.</p>
                  <p style={{ marginBottom: 6 }}><strong>3.</strong> Compreendo que a <strong>receita de fitocanabinoide</strong> possui validade limitada, conforme regulamentação vigente, devendo ser renovada em consultas de retorno, e que a dispensação do produto está condicionada à apresentação da receita válida emitida pelo(a) veterinário(a) habilitado(a) com registro MAPA.</p>
                  <p style={{ marginBottom: 6 }}><strong>4.</strong> Fui alertado(a) sobre possíveis efeitos adversos, incluindo sedação excessiva, alterações gastrointestinais, letargia e, em casos raros, agravamento de sintomas, comprometendo-me a comunicar imediatamente qualquer alteração ao responsável técnico.</p>
                  <p style={{ marginBottom: 6 }}><strong>5.</strong> Estou ciente de que o produto prescrito <strong>não deve ser compartilhado</strong> com outros animais, nem ter sua dose alterada sem orientação veterinária.</p>
                  <p style={{ marginBottom: 14 }}><strong>6.</strong> Declaro ter recebido cópia deste termo e que todas as minhas dúvidas foram esclarecidas pelo(a) médico(a) veterinário(a) responsável.</p>

                  <p style={{ fontWeight: 700, marginBottom: 6 }}>IV. RESPONSABILIDADE TÉCNICA</p>
                  <p style={{ marginBottom: 14 }}>O(A) médico(a) veterinário(a) <strong>{vetInfo?.name ?? '___'}</strong>, CRMV: <strong>{vetInfo?.crmv ?? '___'}</strong>{vetInfo?.mapa ? `, MAPA: ${fmtMapa(vetInfo.mapa)}` : ''}, declara ter prestado as informações necessárias ao(à) tutor(a) e que o protocolo terapêutico foi estabelecido com base na avaliação clínica individual do paciente, observados os princípios da medicina veterinária baseada em evidências e a legislação vigente.</p>

                  <div style={{ marginTop: 24, fontSize: '0.82rem', lineHeight: 2 }}>
                    <p>Local e data: {termoData.termoLocal || '_________'}, {termoData.termoDataStr || '___/___/______'}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 20 }}>
                      {sigBlock('tutor', 'Assinatura do Tutor/Responsável', termoData.tutorNomeCanabis || '')}
                      {sigBlock('vet', vetInfo?.name ?? 'Veterinário Responsável', vetLabel2)}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={closeModal}>Fechar</button>
              <button className="btn btn-primary" onClick={printModal}><Printer size={14} /> 🖨️ Imprimir para assinatura manual</button>
            </div>
          </div>
        </div>
      )}

      {showSigCanvas && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: 'var(--shadow-lg)', minWidth: 380 }}>
            <h4 style={{ margin: 0, fontWeight: 700 }}>Assinatura — {showSigCanvas === 'tutor' ? 'Tutor/Responsável' : 'Veterinário'}</h4>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Desenhe a assinatura abaixo com o mouse ou o dedo.</p>
            <canvas
              ref={miniCanvasRef}
              width={340} height={160}
              style={{ border: '2px solid var(--border)', borderRadius: 8, background: '#fff', cursor: 'crosshair', touchAction: 'none', display: 'block' }}
              onMouseDown={miniStartDraw}
              onMouseMove={miniDraw}
              onMouseUp={miniStopDraw}
              onMouseLeave={miniStopDraw}
              onTouchStart={miniStartDraw}
              onTouchMove={miniDraw}
              onTouchEnd={miniStopDraw}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              <button className="btn btn-ghost btn-sm" onClick={clearMiniCanvas}>Limpar</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => setShowSigCanvas(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={confirmSig}>Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Anexos Section ----
function AnexosSection({ anexos, onChange, isReadOnly }) {
  const fileRef = useRef(null)
  const [viewAnexo, setViewAnexo] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  function handleFiles(e) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        onChange([...(anexos ?? []), {
          id: `ax${Date.now()}${Math.random().toString(36).slice(2)}`,
          nome: file.name,
          tipo: file.type,
          tamanho: file.size,
          dataAdicionado: new Date().toISOString(),
          dataUrl: ev.target.result,
        }])
      }
      reader.readAsDataURL(file)
    })
  }

  function removeAnexo(id) {
    onChange((anexos ?? []).filter(a => a.id !== id))
    setDeleteTarget(null)
  }

  function fmtSize(bytes) {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const list = anexos ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!isReadOnly && (
        <>
          <input type="file" ref={fileRef} style={{ display: 'none' }} multiple
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
            onChange={handleFiles} />
          <button className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => fileRef.current?.click()}>
            <Plus size={14} /> Adicionar anexo
          </button>
        </>
      )}
      {list.length === 0 && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '12px 0' }}>Nenhum anexo adicionado.</p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {list.map(ax => {
          const isImg = ax.tipo?.startsWith('image/') || (ax.dataUrl?.startsWith('data:image'))
          const isPdf = ax.tipo === 'application/pdf' || ax.nome?.endsWith('.pdf')
          const isTermo = ax.tipo === 'termo'
          const isExame = ax.tipo === 'exame'
          return (
            <div key={ax.id} style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-3, #f5f5f5)', overflow: 'hidden' }}>
                {isImg && ax.dataUrl
                  ? <img src={ax.dataUrl} alt={ax.nome} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: '2rem' }}>{isExame ? '🔬' : (isPdf || isTermo) ? '📄' : '📎'}</span>}
              </div>
              <div style={{ padding: '8px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, wordBreak: 'break-word', lineHeight: 1.3 }}>{ax.nome}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                  {ax.dataAdicionado ? new Date(ax.dataAdicionado).toLocaleDateString('pt-BR') : ''}
                  {ax.tamanho ? ` · ${fmtSize(ax.tamanho)}` : ''}
                </p>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {(ax.dataUrl || ax.conteudoHtml) && (
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem', padding: '3px 8px' }} onClick={() => setViewAnexo(ax)}>Visualizar</button>
                  )}
                  {!isReadOnly && (
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem', padding: '3px 8px', color: 'var(--danger)' }} onClick={() => setDeleteTarget(ax)}>Excluir</button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {viewAnexo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setViewAnexo(null)}>
          <div style={{ maxWidth: '90vw', maxHeight: '90vh', background: 'var(--surface)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{viewAnexo.nome}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setViewAnexo(null)}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {viewAnexo.conteudoHtml
                ? <iframe srcdoc={`<html><head><style>body{font-family:Arial,sans-serif;padding:24px;font-size:13px;line-height:1.6}</style></head><body>${viewAnexo.conteudoHtml}</body></html>`} style={{ width: '70vw', height: '75vh', border: 'none' }} title={viewAnexo.nome} />
                : viewAnexo.tipo?.startsWith('image/') || viewAnexo.dataUrl?.startsWith('data:image')
                  ? <img src={viewAnexo.dataUrl} alt={viewAnexo.nome} style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain' }} />
                  : <embed src={viewAnexo.dataUrl} type="application/pdf" style={{ width: '70vw', height: '75vh' }} />}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => removeAnexo(deleteTarget.id)}
        message={`Excluir o anexo "${deleteTarget?.nome}"? Esta ação não pode ser desfeita.`}
      />
    </div>
  )
}



