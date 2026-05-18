import { useState, useRef } from 'react'
import { Search, Plus, X, ChevronRight, Trash2 } from 'lucide-react'
import Modal from '../components/ui/Modal'
import CropModal from '../components/ui/CropModal'
import ConfirmModal from '../components/ui/ConfirmModal'
import { useAuth } from '../context/AuthContext'
import { normIncludes, norm } from '../utils/normalizeText'
import { usePersistentState } from '../hooks/usePersistentState'

const CATEGORIAS = ['Antibióticos', 'Analgésicos/Anti-inflamatórios', 'Corticoides', 'Gastroentérologia', 'Cardiovascular', 'Neurológico', 'Dermatológico', 'Antiparasitários', 'Anestésicos', 'Oncológico', 'Outros']

const EMPTY_MED = {
  nomeComercial: '', nomeGenerico: '', fabricante: '', apresentacao: '', concentracao: '',
  indicacoes: '', contraindicacoes: '',
  doseCao: '', doseGato: '', doseOutros: '',
  via: '', frequencia: '', tempoPtto: '',
  efeitosAdversos: '', interacoes: '', observacoes: '',
  categoria: 'Antibióticos', foto: null,
}

const INITIAL_BULARIO = [
  { id: 'b01', categoria: 'Antibióticos', nomeComercial: 'Amoxil Vet', nomeGenerico: 'Amoxicilina', fabricante: 'Zoetis', apresentacao: 'Comprimidos 250mg', concentracao: '250 mg', indicacoes: 'Infecções bacterianas (pele, trato respiratório, urinário)', contraindicacoes: 'Hipersensibilidade a penicilinas', doseCao: '11-22 mg/kg', doseGato: '11-22 mg/kg', doseOutros: 'Consultar especialista', via: 'VO', frequencia: '2x ao dia (12/12h)', tempoPtto: '5–10 dias', efeitosAdversos: 'Diarréia, vômito, reação alérgica rara', interacoes: 'Tetraciclinas (antagonismo)', observacoes: 'Administrar com ou sem alimento', foto: null },
  { id: 'b02', categoria: 'Antibióticos', nomeComercial: 'Clavamox', nomeGenerico: 'Amoxicilina + Clavulanato', fabricante: 'Zoetis', apresentacao: 'Comprimidos 62,5mg / 250mg', concentracao: '62,5 / 250 mg', indicacoes: 'Infecções por bactérias produtoras de beta-lactamase', contraindicacoes: 'Hipersensibilidade a penicilinas', doseCao: '12,5 mg/kg', doseGato: '12,5 mg/kg', doseOutros: '—', via: 'VO', frequencia: '2x ao dia', tempoPtto: '5–14 dias', efeitosAdversos: 'Distúrbios GI, diarreia', interacoes: 'Anticoagulantes', observacoes: 'Administrar com alimento para reduzir náusea', foto: null },
  { id: 'b03', categoria: 'Antibióticos', nomeComercial: 'Cefalexina Vet', nomeGenerico: 'Cefalexina', fabricante: 'Genérico', apresentacao: 'Comprimidos 500mg', concentracao: '500 mg', indicacoes: 'Infecções de pele, piodermites, otites', contraindicacoes: 'Hipersensibilidade a cefalosporinas', doseCao: '20-30 mg/kg', doseGato: '15-20 mg/kg', doseOutros: '—', via: 'VO', frequencia: '2-3x ao dia', tempoPtto: '7–21 dias', efeitosAdversos: 'Diarreia, vômito', interacoes: 'Aminoglicosídeos (toxicidade renal)', observacoes: 'Primeira escolha para piodermites', foto: null },
  { id: 'b04', categoria: 'Antibióticos', nomeComercial: 'Enroxil', nomeGenerico: 'Enrofloxacino', fabricante: 'KRKA', apresentacao: 'Comprimidos 50mg / 150mg', concentracao: '50 / 150 mg', indicacoes: 'Infecções urinárias, respiratórias, dérmicas por gram-negativos', contraindicacoes: 'Filhotes em crescimento, epiléticos', doseCao: '5-20 mg/kg', doseGato: '5 mg/kg (máx.)', doseOutros: 'Aves: 10-20 mg/kg', via: 'VO / IM', frequencia: '1-2x ao dia', tempoPtto: '7–14 dias', efeitosAdversos: 'Degeneração retiniana em gatos (doses altas), convulsões', interacoes: 'AINEs, antiácidos', observacoes: 'Evitar luz solar intensa durante tratamento', foto: null },
  { id: 'b05', categoria: 'Antibióticos', nomeComercial: 'Doxitrat', nomeGenerico: 'Doxiciclina', fabricante: 'Ourofino', apresentacao: 'Comprimidos 50mg / 100mg', concentracao: '50 / 100 mg', indicacoes: 'Erliquiose, ricketsiose, micoplasma, clamídia, leptospirose', contraindicacoes: 'Gestantes, animais jovens', doseCao: '5-10 mg/kg', doseGato: '5 mg/kg', doseOutros: 'Aves: 25-50 mg/kg', via: 'VO', frequencia: '2x ao dia', tempoPtto: '21–28 dias (erliquiose)', efeitosAdversos: 'Esofagite (gatos), fotossensibilidade', interacoes: 'Antiácidos, cálcio (quelação)', observacoes: 'Administrar com água ou alimento úmido; não deitar após a dose', foto: null },
  { id: 'b06', categoria: 'Analgésicos/Anti-inflamatórios', nomeComercial: 'Previcox', nomeGenerico: 'Firocoxibe', fabricante: 'Boehringer', apresentacao: 'Comprimidos 57mg / 227mg', concentracao: '57 / 227 mg', indicacoes: 'Dor e inflamação em osteoartrite, pós-operatório', contraindicacoes: 'Gatos (NÃO USAR), insuficiência renal/hepática', doseCao: '5 mg/kg', doseGato: 'Contraindicado', doseOutros: '—', via: 'VO', frequencia: '1x ao dia', tempoPtto: 'Conforme necessidade clínica', efeitosAdversos: 'Úlcera gástrica, insuficiência renal', interacoes: 'Corticoides, outros AINEs', observacoes: 'Dar com alimento; monitorar função renal', foto: null },
  { id: 'b07', categoria: 'Analgésicos/Anti-inflamatórios', nomeComercial: 'Metacam', nomeGenerico: 'Meloxicam', fabricante: 'Boehringer', apresentacao: 'Solução oral 1,5 mg/mL; injetável 5 mg/mL', concentracao: '1,5 / 5 mg/mL', indicacoes: 'Dor aguda e crônica, inflamação, pós-cirúrgico', contraindicacoes: 'Insuficiência renal/hepática grave, gestação', doseCao: '0,2 mg/kg (1ª dose) → 0,1 mg/kg/dia', doseGato: '0,1 mg/kg dose única SC; oral longo prazo: 0,025 mg/kg', doseOutros: 'Aves: 0,5-1 mg/kg', via: 'VO / SC', frequencia: '1x ao dia', tempoPtto: 'Curto prazo (agudo); crônico com monitoração', efeitosAdversos: 'Distúrbios GI, nefrotoxicidade', interacoes: 'Outros AINEs, corticoides, diuréticos', observacoes: 'Melhor AINE disponível para gatos sob prescrição controlada', foto: null },
  { id: 'b08', categoria: 'Analgésicos/Anti-inflamatórios', nomeComercial: 'Tramal Vet', nomeGenerico: 'Tramadol', fabricante: 'Grünenthal', apresentacao: 'Comprimidos 50mg; injetável 50mg/mL', concentracao: '50 mg', indicacoes: 'Dor moderada a severa, pós-operatório', contraindicacoes: 'Epilepsia, uso com IMAO', doseCao: '2-5 mg/kg', doseGato: '2-4 mg/kg', doseOutros: '—', via: 'VO / SC / IM / IV', frequencia: '2-3x ao dia (8-12h)', tempoPtto: 'Conforme prescrição', efeitosAdversos: 'Sedação, vômito, disfonese', interacoes: 'IMAOs, SSRIs, depressores do SNC', observacoes: 'Uso controlado (lista C1 ANVISA)', foto: null },
  { id: 'b09', categoria: 'Corticoides', nomeComercial: 'Prednisolona 20mg', nomeGenerico: 'Prednisolona', fabricante: 'Genérico', apresentacao: 'Comprimidos 5mg / 20mg', concentracao: '5 / 20 mg', indicacoes: 'Processos alérgicos, doenças autoimunes, choque', contraindicacoes: 'Infecções fúngicas sistêmicas, animais infectados', doseCao: 'Imunossupressão: 2-4 mg/kg; anti-inflamatório: 0,5-2 mg/kg', doseGato: '1-3 mg/kg', doseOutros: '—', via: 'VO', frequencia: '1x ao dia (manhã)', tempoPtto: 'Desmame gradual', efeitosAdversos: 'PU/PD/PF, imunossupressão, Cushing iatrogênico', interacoes: 'AINEs (úlcera), vacinas atenuadas', observacoes: 'Nunca cessar abruptamente; desmame gradual', foto: null },
  { id: 'b10', categoria: 'Corticoides', nomeComercial: 'Dexametasona 2mg/mL', nomeGenerico: 'Dexametasona', fabricante: 'Genérico', apresentacao: 'Solução injetável 2mg/mL', concentracao: '2 mg/mL', indicacoes: 'Choque, edema cerebral, doenças alérgicas agudas', contraindicacoes: 'Infecções virais, sistêmicas', doseCao: '0,1-0,5 mg/kg', doseGato: '0,1-0,25 mg/kg', doseOutros: 'Aves: 0,4-2 mg/kg', via: 'IV / IM / SC', frequencia: 'Dose única ou conforme protocolo', tempoPtto: 'Curto prazo', efeitosAdversos: 'Imunossupressão intensa, hiperglicemia', interacoes: 'AINEs, insulina', observacoes: '6-10x mais potente que prednisolona; preferir IM/IV', foto: null },
  { id: 'b11', categoria: 'Gastroentérologia', nomeComercial: 'Omeprazol Vet', nomeGenerico: 'Omeprazol', fabricante: 'Genérico', apresentacao: 'Cápsulas 20mg', concentracao: '20 mg', indicacoes: 'Úlcera gástrica, refluxo, profilaxia com corticoides', contraindicacoes: 'Hipersensibilidade', doseCao: '0,7-1 mg/kg', doseGato: '0,7 mg/kg', doseOutros: '—', via: 'VO', frequencia: '1x ao dia (jejum)', tempoPtto: '4–8 semanas', efeitosAdversos: 'Raro: diarreia, náusea', interacoes: 'Reduz absorção de itraconazol, cetoconazol', observacoes: 'Administrar 30 min antes da alimentação; não mastigar a cápsula', foto: null },
  { id: 'b12', categoria: 'Gastroentérologia', nomeComercial: 'Cerenia', nomeGenerico: 'Maropitant', fabricante: 'Zoetis', apresentacao: 'Comprimidos 16mg / 24mg / 60mg; injetável 10mg/mL', concentracao: '16/24/60 mg; 10mg/mL', indicacoes: 'Vômito agudo, enjoo de movimento, náusea pré-anestésica', contraindicacoes: 'Filhotes <16 semanas (comp)', doseCao: '2 mg/kg SC, 8 mg/kg VO', doseGato: '1 mg/kg SC', doseOutros: '—', via: 'SC / VO', frequencia: '1x ao dia', tempoPtto: '5 dias (máx. contínuo)', efeitosAdversos: 'Salivação, dor no local (SC)', interacoes: 'Inibidores de CYP3A4', observacoes: 'SC causa dor; refrigerar injetável; boa opção pré-cirúrgica', foto: null },
  { id: 'b13', categoria: 'Gastroentérologia', nomeComercial: 'Metronidazol Vet', nomeGenerico: 'Metronidazol', fabricante: 'Genérico', apresentacao: 'Comprimidos 250mg / 400mg; IV 5mg/mL', concentracao: '250/400 mg', indicacoes: 'Giardíase, anaerobiose, diarreia inflamatória', contraindicacoes: 'Gestantes (1° trimestre), neuropatias', doseCao: '10-25 mg/kg', doseGato: '10-15 mg/kg', doseOutros: 'Répteis: 25-40 mg/kg', via: 'VO / IV', frequencia: '2x ao dia', tempoPtto: '5–7 dias (giárdia: 5 dias)', efeitosAdversos: 'Neurotoxicidade (doses altas), gosto amargo', interacoes: 'Varfarina, fenobarbital', observacoes: 'Sabor amargo intenso — usar comprimido inteiro', foto: null },
  { id: 'b14', categoria: 'Cardiovascular', nomeComercial: 'Vetmedin', nomeGenerico: 'Pimobendan', fabricante: 'Boehringer', apresentacao: 'Comprimidos mastigáveis 1,25mg / 2,5mg / 5mg', concentracao: '1,25 / 2,5 / 5 mg', indicacoes: 'Insuficiência cardíaca congestiva por cardiomiopatia dilatada ou doença valvar mitral', contraindicacoes: 'Estenose aórtica/pulmonar, obstrução do fluxo', doseCao: '0,2-0,3 mg/kg', doseGato: 'Uso off-label: 1,25 mg/gato 2x/dia', doseOutros: '—', via: 'VO', frequencia: '2x ao dia (12/12h — 1h antes do alimento)', tempoPtto: 'Uso contínuo', efeitosAdversos: 'Taquicardia, anorexia', interacoes: 'Bloqueadores de cálcio', observacoes: 'Administrar com estômago vazio para melhor absorção', foto: null },
  { id: 'b15', categoria: 'Cardiovascular', nomeComercial: 'Furosemida Vet', nomeGenerico: 'Furosemida', fabricante: 'Genérico', apresentacao: 'Comprimidos 40mg; injetável 10mg/mL', concentracao: '40 mg / 10 mg/mL', indicacoes: 'Edema pulmonar, ascite, insuficiência cardíaca', contraindicacoes: 'Anúria, hipocalemia severa', doseCao: '1-4 mg/kg', doseGato: '1-2 mg/kg', doseOutros: '—', via: 'VO / IM / IV', frequencia: '1-3x ao dia', tempoPtto: 'Uso contínuo (crônico); emergência: IV lento', efeitosAdversos: 'Hipocalemia, desidratação, azotemia', interacoes: 'Aminoglicosídeos (nefrotoxicidade), digoxina', observacoes: 'Monitorar eletrólitos e função renal periodicamente', foto: null },
  { id: 'b16', categoria: 'Neurológico', nomeComercial: 'Fenobarbital Vet', nomeGenerico: 'Fenobarbital', fabricante: 'Genérico', apresentacao: 'Comprimidos 100mg; injetável 40mg/mL', concentracao: '100 mg / 40 mg/mL', indicacoes: 'Epilepsia idiopática, convulsões', contraindicacoes: 'Hepatopatia grave', doseCao: '2-4 mg/kg', doseGato: '2 mg/kg', doseOutros: '—', via: 'VO / IV', frequencia: '2x ao dia', tempoPtto: 'Uso contínuo (não cessar abruptamente)', efeitosAdversos: 'Sedação inicial, PU/PD/PF, hepatotoxicidade crônica', interacoes: 'Inúmeras (indutor enzimático P450)', observacoes: 'Monitorar fenobarbitalemia e perfil hepático a cada 6 meses; lista C5', foto: null },
  { id: 'b17', categoria: 'Neurológico', nomeComercial: 'Keppra Vet', nomeGenerico: 'Levetiracetam', fabricante: 'Genérico', apresentacao: 'Comprimidos 250mg / 500mg / 750mg', concentracao: '250/500/750 mg', indicacoes: 'Epilepsia refratária, adjuvante ao fenobarbital', contraindicacoes: 'Hipersensibilidade', doseCao: '20 mg/kg', doseGato: '20 mg/kg', doseOutros: '—', via: 'VO', frequencia: '3x ao dia (8/8h)', tempoPtto: 'Uso contínuo', efeitosAdversos: 'Sedação, ataxia transitória', interacoes: 'Poucas — bom para polifarmácia', observacoes: 'Boa tolerabilidade; sem necessidade de monitoração hepática rotineira', foto: null },
  { id: 'b18', categoria: 'Dermatológico', nomeComercial: 'Apoquel', nomeGenerico: 'Oclacitinibe', fabricante: 'Zoetis', apresentacao: 'Comprimidos 3,6mg / 5,4mg / 16mg', concentracao: '3,6 / 5,4 / 16 mg', indicacoes: 'Prurido associado a dermatite alérgica em cães', contraindicacoes: 'Gatos (off-label apenas), imunodeprimidos, menores de 12 meses', doseCao: '0,4-0,6 mg/kg', doseGato: 'Off-label: 0,5-1 mg/kg', doseOutros: '—', via: 'VO', frequencia: '2x ao dia (início 14 dias) → 1x ao dia (manutenção)', tempoPtto: 'Uso contínuo', efeitosAdversos: 'Infecções oportunistas, neoplasias (uso crônico)', interacoes: 'Imunossupressores', observacoes: 'Início de ação rápido (4h); não usar com corticoides a longo prazo', foto: null },
  { id: 'b19', categoria: 'Dermatológico', nomeComercial: 'Cytopoint', nomeGenerico: 'Lokivetmab', fabricante: 'Zoetis', apresentacao: 'Solução injetável 10mg/mL', concentracao: '10 mg/mL', indicacoes: 'Dermatite atópica em cães', contraindicacoes: 'Gatos (não aprovado)', doseCao: '2 mg/kg SC', doseGato: 'Não aprovado', doseOutros: '—', via: 'SC', frequencia: '1x ao mês (ou a cada 4-8 semanas)', tempoPtto: 'Uso crônico conforme necessidade', efeitosAdversos: 'Raro: reação no local, letargia transitória', interacoes: 'Seguro com outros fármacos', observacoes: 'Anticorpo monoclonal; refrigerar 2-8°C; excelente tolerabilidade', foto: null },
  { id: 'b20', categoria: 'Antiparasitários', nomeComercial: 'Simparic', nomeGenerico: 'Sarolaner', fabricante: 'Zoetis', apresentacao: 'Comprimidos mastigáveis 5mg/10mg/20mg/40mg/80mg/120mg', concentracao: '5-120 mg', indicacoes: 'Pulgas e carrapatos (adultos e larvas)', contraindicacoes: 'Filhotes < 6 meses ou < 1,3 kg; MDR1/ABCB1 mutação', doseCao: '2 mg/kg', doseGato: 'Não aprovado', doseOutros: '—', via: 'VO', frequencia: '1x ao mês', tempoPtto: 'Uso contínuo', efeitosAdversos: 'Raro: vômito, diarreia, tremores (Collies MDR1+)', interacoes: 'Macrolídeos (cautela em raças sensíveis)', observacoes: 'Ação rápida contra pulgas (3h); manter uso mensal preventivo', foto: null },
  { id: 'b21', categoria: 'Antiparasitários', nomeComercial: 'Bravecto', nomeGenerico: 'Fluralaner', fabricante: 'MSD', apresentacao: 'Comprimidos mastigáveis / solução spot-on', concentracao: 'Variadas', indicacoes: 'Pulgas e carrapatos por 12 semanas', contraindicacoes: 'Filhotes < 6 meses', doseCao: '25-56 mg/kg', doseGato: 'Spot-on 280mg (>6meses, >1,2kg)', doseOutros: '—', via: 'VO / Tópico', frequencia: '1x a cada 12 semanas', tempoPtto: 'Uso contínuo', efeitosAdversos: 'Vômito, diarreia (raro)', interacoes: 'Baixas interações conhecidas', observacoes: 'Praticidade de dose trimestral; preferir ingestão com alimento', foto: null },
  { id: 'b22', categoria: 'Antiparasitários', nomeComercial: 'Drontal Plus', nomeGenerico: 'Praziquantel + Pamoato de Pirantel + Febantel', fabricante: 'Bayer', apresentacao: 'Comprimidos para cão', concentracao: 'Combinado', indicacoes: 'Ascarídeos, ancilostomídeos, tricúreos, tênias', contraindicacoes: 'Filhotes < 2 semanas', doseCao: '1 comp/10 kg', doseGato: 'Drontal Gato (fórmula específica)', doseOutros: '—', via: 'VO', frequencia: 'Dose única (repetir em 3 semanas se necessário)', tempoPtto: 'Dose única', efeitosAdversos: 'Vômito, salivação (raro)', interacoes: 'Baixas', observacoes: 'Vermifugar filhotes a partir de 2 semanas de vida', foto: null },
  { id: 'b23', categoria: 'Anestésicos', nomeComercial: 'Cetamina 10%', nomeGenerico: 'Cetamina', fabricante: 'Cristália', apresentacao: 'Solução injetável 10% (100mg/mL)', concentracao: '100 mg/mL', indicacoes: 'Indução anestésica, anestesia dissociativa', contraindicacoes: 'Hipertensão, insuficiência cardíaca, convulsões', doseCao: 'Indução: 5-10 mg/kg IM; TIVA: 5-10 mg/kg/h IV', doseGato: 'Indução: 10-20 mg/kg IM', doseOutros: 'Aves: 10-30 mg/kg IM', via: 'IM / IV', frequencia: 'Conforme protocolo', tempoPtto: 'Intraoperatório', efeitosAdversos: 'Hipersalivação, aumento de tônus muscular, alucinações', interacoes: 'Benzodiazepínicos (agonismo), AINEs', observacoes: 'Sempre associar a agentes sedativos (midazolam, acepromazina) para reduzir efeitos excitatórios', foto: null },
  { id: 'b24', categoria: 'Anestésicos', nomeComercial: 'Propofol 1%', nomeGenerico: 'Propofol', fabricante: 'Cristália/Fresenius', apresentacao: 'Emulsão IV 10mg/mL', concentracao: '10 mg/mL', indicacoes: 'Indução anestésica e TIVA', contraindicacoes: 'Sem acesso venoso, hiperlipidemia grave', doseCao: 'Indução: 4-6 mg/kg IV lento; manutenção: 0,1-0,4 mg/kg/min', doseGato: '4-8 mg/kg IV lento', doseOutros: '—', via: 'IV', frequencia: 'Conforme protocolo', tempoPtto: 'Intraoperatório', efeitosAdversos: 'Apneia, hipotensão, dor na infusão', interacoes: 'Opioides (reduzem dose), benzodiazepínicos', observacoes: 'Emulsão lipídica — usar dentro de 6h após abertura; não usar com tubo ou material rígido. Refrigerar.', foto: null },
]

export default function BularioPage() {
  const { hasRole } = useAuth()
  const [bulario, setBulario] = usePersistentState('petvet-bulario', INITIAL_BULARIO)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('Todas')
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_MED)
  const [cropSrc, setCropSrc] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const fotoRef = useRef(null)

  const filtered = bulario
    .filter(m => {
      const matchCat = catFilter === 'Todas' || m.categoria === catFilter
      const matchSearch = !search || normIncludes(m.nomeComercial, search) || normIncludes(m.nomeGenerico, search) || normIncludes(m.indicacoes, search)
      return matchCat && matchSearch
    })
    .sort((a, b) => a.nomeComercial.localeCompare(b.nomeComercial, 'pt-BR'))

  function openNew() { setEditing(null); setForm(EMPTY_MED); setShowForm(true) }
  function openEdit(m) { setEditing(m); setForm({ ...EMPTY_MED, ...m }); setShowForm(true) }
  function handleFotoChange(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result)
    reader.readAsDataURL(file)
  }
  function save() {
    if (!form.nomeComercial) return
    const sort = arr => [...arr].sort((a, b) => a.nomeComercial.localeCompare(b.nomeComercial, 'pt-BR'))
    if (editing) {
      setBulario(prev => sort(prev.map(m => m.id === editing.id ? { ...form, id: editing.id } : m)))
    } else {
      setBulario(prev => sort([...prev, { ...form, id: `b${Date.now()}` }]))
    }
    setShowForm(false)
  }

  const cats = ['Todas', ...CATEGORIAS]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Bulário Veterinário</h2>
          <p className="page-subtitle">{bulario.length} medicamentos cadastrados</p>
        </div>
        {hasRole('admin', 'veterinario') && (
          <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Novo Medicamento</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-input" style={{ paddingLeft: 38 }} placeholder="Buscar por nome comercial, genérico ou indicação..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 200 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          {cats.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Ficha completa */}
      {selected && (
        <div className="card" style={{ position: 'relative' }}>
          <button className="btn btn-ghost btn-sm" style={{ position: 'absolute', top: 16, right: 16 }} onClick={() => setSelected(null)}><X size={16} /></button>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {selected.foto && <img src={selected.foto} alt="" style={{ width: 120, height: 120, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>{selected.nomeComercial}</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{selected.nomeGenerico}</span>
                <span className="badge badge-neutral">{selected.categoria}</span>
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {selected.fabricante && <span>{selected.fabricante} · </span>}
                {selected.apresentacao && <span>{selected.apresentacao}</span>}
                {selected.concentracao && <span> · {selected.concentracao}</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px 24px', marginTop: 16 }}>
            {[
              ['Indicações', selected.indicacoes],
              ['Contraindicações', selected.contraindicacoes],
              ['Dose — Cão', selected.doseCao],
              ['Dose — Gato', selected.doseGato],
              ['Dose — Outros', selected.doseOutros],
              ['Via de administração', selected.via],
              ['Frequência', selected.frequencia],
              ['Tempo de tratamento', selected.tempoPtto],
              ['Efeitos adversos', selected.efeitosAdversos],
              ['Interações', selected.interacoes],
              ['Observações', selected.observacoes],
            ].filter(([, v]) => v).map(([label, val]) => (
              <div key={label}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 4px' }}>{label}</p>
                <p style={{ fontSize: '0.875rem', margin: 0, lineHeight: 1.6 }}>{val}</p>
              </div>
            ))}
          </div>
          {hasRole('admin', 'veterinario') && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => { setDeleteTarget(selected); setSelected(null) }}><Trash2 size={14} /> Excluir</button>
              <button className="btn btn-outline btn-sm" onClick={() => { openEdit(selected); setSelected(null) }}>Editar</button>
            </div>
          )}
        </div>
      )}

      {/* Lista */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {filtered.map(m => (
          <div key={m.id} className="card" style={{ cursor: 'pointer', padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', transition: 'box-shadow 150ms' }}
            onClick={() => setSelected(m)}>
            {m.foto
              ? <img src={m.foto} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.4rem' }}>💊</div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nomeComercial}</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nomeGenerico}</p>
              <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{m.categoria}</span>
            </div>
            <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 4 }} />
          </div>
        ))}
        {filtered.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', gridColumn: '1/-1', padding: '24px 0', textAlign: 'center' }}>Nenhum medicamento encontrado.</p>
        )}
      </div>

      {/* Modal form */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? 'Editar Medicamento' : 'Novo Medicamento'} size="lg"
        footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
          <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={!form.nomeComercial}>Salvar</button>
        </div>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
          <div className="form-group">
            <label className="form-label">Nome comercial *</label>
            <input className="form-input" value={form.nomeComercial} onChange={e => setForm(f => ({ ...f, nomeComercial: e.target.value }))} placeholder="Ex: Apoquel" />
          </div>
          <div className="form-group">
            <label className="form-label">Nome genérico (princípio ativo)</label>
            <input className="form-input" value={form.nomeGenerico} onChange={e => setForm(f => ({ ...f, nomeGenerico: e.target.value }))} placeholder="Ex: Oclacitinibe" />
          </div>
          <div className="form-group">
            <label className="form-label">Fabricante</label>
            <input className="form-input" value={form.fabricante} onChange={e => setForm(f => ({ ...f, fabricante: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Categoria</label>
            <select className="form-select" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Apresentação</label>
            <input className="form-input" value={form.apresentacao} onChange={e => setForm(f => ({ ...f, apresentacao: e.target.value }))} placeholder="Ex: Comprimidos 50mg" />
          </div>
          <div className="form-group">
            <label className="form-label">Concentração</label>
            <input className="form-input" value={form.concentracao} onChange={e => setForm(f => ({ ...f, concentracao: e.target.value }))} placeholder="Ex: 50 mg" />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Indicações</label>
            <textarea className="form-textarea" value={form.indicacoes} onChange={e => setForm(f => ({ ...f, indicacoes: e.target.value }))} style={{ minHeight: 72 }} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Contraindicações</label>
            <textarea className="form-textarea" value={form.contraindicacoes} onChange={e => setForm(f => ({ ...f, contraindicacoes: e.target.value }))} style={{ minHeight: 60 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Dose — Cão</label>
            <input className="form-input" value={form.doseCao} onChange={e => setForm(f => ({ ...f, doseCao: e.target.value }))} placeholder="Ex: 5 mg/kg" />
          </div>
          <div className="form-group">
            <label className="form-label">Dose — Gato</label>
            <input className="form-input" value={form.doseGato} onChange={e => setForm(f => ({ ...f, doseGato: e.target.value }))} placeholder="Ex: 2,5 mg/kg" />
          </div>
          <div className="form-group">
            <label className="form-label">Dose — Outros</label>
            <input className="form-input" value={form.doseOutros} onChange={e => setForm(f => ({ ...f, doseOutros: e.target.value }))} placeholder="Ex: Aves: 10 mg/kg" />
          </div>
          <div className="form-group">
            <label className="form-label">Via de administração</label>
            <input className="form-input" value={form.via} onChange={e => setForm(f => ({ ...f, via: e.target.value }))} placeholder="VO, SC, IM, IV..." />
          </div>
          <div className="form-group">
            <label className="form-label">Frequência usual</label>
            <input className="form-input" value={form.frequencia} onChange={e => setForm(f => ({ ...f, frequencia: e.target.value }))} placeholder="Ex: 2x ao dia" />
          </div>
          <div className="form-group">
            <label className="form-label">Tempo de tratamento</label>
            <input className="form-input" value={form.tempoPtto} onChange={e => setForm(f => ({ ...f, tempoPtto: e.target.value }))} placeholder="Ex: 7–14 dias" />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Efeitos adversos</label>
            <textarea className="form-textarea" value={form.efeitosAdversos} onChange={e => setForm(f => ({ ...f, efeitosAdversos: e.target.value }))} style={{ minHeight: 60 }} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Interações medicamentosas</label>
            <textarea className="form-textarea" value={form.interacoes} onChange={e => setForm(f => ({ ...f, interacoes: e.target.value }))} style={{ minHeight: 60 }} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Observações</label>
            <textarea className="form-textarea" value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} style={{ minHeight: 60 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Foto</label>
            <input ref={fotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFotoChange} />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {form.foto && <img src={form.foto} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }} />}
              <button type="button" className="btn btn-outline btn-sm" onClick={() => fotoRef.current?.click()}>
                {form.foto ? 'Trocar foto' : 'Selecionar foto'}
              </button>
              {form.foto && <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setForm(f => ({ ...f, foto: null }))}>Remover</button>}
            </div>
          </div>
        </div>
      </Modal>

      {cropSrc && (
        <CropModal src={cropSrc}
          onSave={b64 => { setForm(f => ({ ...f, foto: b64 })); setCropSrc(null) }}
          onClose={() => setCropSrc(null)} />
      )}

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => { setBulario(prev => prev.filter(m => m.id !== deleteTarget.id)); setDeleteTarget(null) }}
        message={`Excluir "${deleteTarget?.nomeComercial}" do bulário? Esta ação não pode ser desfeita.`} />
    </div>
  )
}
