// ============================================================
// PETVET — DADOS MOCK CENTRALIZADOS
// ============================================================

export const TUTORES = [
  { id: 't1', name: 'Maria Silva', cpf: '123.456.789-00', phone: '(11) 99999-1111', email: 'maria.silva@email.com', address: 'Rua das Flores, 123 — Jardim Paulista, SP' },
  { id: 't2', name: 'João Pereira', cpf: '987.654.321-00', phone: '(11) 98888-2222', email: 'joao.p@email.com', address: 'Av. Paulista, 1000 — Bela Vista, SP' },
  { id: 't3', name: 'Ana Costa', cpf: '456.789.123-00', phone: '(11) 97777-3333', email: 'ana.costa@email.com', address: 'Rua Augusta, 500 — Consolação, SP' },
  { id: 't4', name: 'Pedro Alves', cpf: '321.654.987-00', phone: '(11) 96666-4444', email: 'pedro.alves@email.com', address: 'Rua Oscar Freire, 200 — Jardins, SP' },
  { id: 't5', name: 'Carla Mendes', cpf: '654.321.789-00', phone: '(11) 95555-5555', email: 'carla.m@email.com', address: 'Av. Brigadeiro, 800 — Itaim Bibi, SP' },
  { id: 't6', name: 'Roberto Lima', cpf: '789.123.456-00', phone: '(11) 94444-6666', email: 'roberto.lima@email.com', address: 'Rua Pamplona, 150 — Jardim Paulista, SP' },
]

export const PETS = [
  { id: 'p1', name: 'Rex', species: 'Cão', breed: 'Labrador', birthDate: '2020-03-15', weight: 28.5, sex: 'M', color: 'Caramelo', microchip: '985141000123456', tutorId: 't1', observations: 'Alérgico a frango. Muito dócil.', vacinacao: 'Em dia', vermifugacao: 'Em dia' },
  { id: 'p2', name: 'Mimi', species: 'Gato', breed: 'Persa', birthDate: '2019-07-22', weight: 4.2, sex: 'F', color: 'Branco', microchip: '985141000234567', tutorId: 't1', observations: 'Gata tranquila. Não gosta de barulho.', vacinacao: 'Em dia', vermifugacao: 'Atrasada' },
  { id: 'p3', name: 'Thor', species: 'Cão', breed: 'Golden Retriever', birthDate: '2021-11-05', weight: 32.1, sex: 'M', color: 'Dourado', microchip: '985141000345678', tutorId: 't2', observations: '', vacinacao: 'Em dia', vermifugacao: 'Em dia' },
  { id: 'p4', name: 'Luna', species: 'Cão', breed: 'Poodle', birthDate: '2022-05-18', weight: 6.8, sex: 'F', color: 'Preto', microchip: '985141000456789', tutorId: 't2', observations: 'Muito agitada. Necessita de sedação para corte de unhas.', vacinacao: 'Atrasada', vermifugacao: 'Em dia' },
  { id: 'p5', name: 'Mel', species: 'Cão', breed: 'Beagle', birthDate: '2018-02-10', weight: 12.3, sex: 'F', color: 'Tricolor', microchip: '985141000567890', tutorId: 't3', observations: 'Idosa. Monitorar pressão arterial.', vacinacao: 'Em dia', vermifugacao: 'Em dia' },
  { id: 'p6', name: 'Nemo', species: 'Peixe', breed: 'Peixe-palhaço', birthDate: '2023-01-01', weight: 0.1, sex: 'M', color: 'Laranja/Branco', microchip: '', tutorId: 't3', observations: 'Aquário marinho 200L.', vacinacao: 'N/A', vermifugacao: 'N/A' },
  { id: 'p7', name: 'Simba', species: 'Gato', breed: 'Maine Coon', birthDate: '2020-09-30', weight: 7.5, sex: 'M', color: 'Tigrado', microchip: '985141000678901', tutorId: 't4', observations: 'Pelo longo — necessita escovação regular.', vacinacao: 'Em dia', vermifugacao: 'Em dia' },
  { id: 'p8', name: 'Princesa', species: 'Cão', breed: 'Shih Tzu', birthDate: '2017-12-24', weight: 5.1, sex: 'F', color: 'Branco/Caramelo', microchip: '985141000789012', tutorId: 't5', observations: 'Cardiopatia — uso contínuo de Enalapril 2,5mg.', vacinacao: 'Em dia', vermifugacao: 'Atrasada' },
  { id: 'p9', name: 'Bolt', species: 'Cão', breed: 'Husky Siberiano', birthDate: '2022-08-14', weight: 22.4, sex: 'M', color: 'Cinza/Branco', microchip: '985141000890123', tutorId: 't6', observations: '', vacinacao: 'Em dia', vermifugacao: 'Em dia' },
  { id: 'p10', name: 'Oreo', species: 'Gato', breed: 'SRD', birthDate: '2023-06-05', weight: 3.1, sex: 'M', color: 'Preto/Branco', microchip: '', tutorId: 't6', observations: 'Adotado. Em adaptação doméstica.', vacinacao: 'Atrasada', vermifugacao: 'Atrasada' },
]

export const VETS = [
  { id: 'v1', name: 'Dra. Tatiana Borges', crmv: 'SP-12345', mapa: 'MAPA-00123', specialty: 'Clínica Geral' },
  { id: 'v2', name: 'Dr. Carlos Menezes',  crmv: 'SP-67890', mapa: 'MAPA-00456', specialty: 'Cirurgia' },
]

export const AGENDAMENTOS = [
  { id: 'a1',  petId: 'p1', tutorId: 't1', vetId: 'v1', date: '2026-05-14', time: '08:00', duration: 30, type: 'consulta',  status: 'em-atendimento', notes: 'Queixa de coceira' },
  { id: 'a2',  petId: 'p3', tutorId: 't2', vetId: 'v1', date: '2026-05-14', time: '09:00', duration: 30, type: 'retorno',   status: 'confirmado',     notes: 'Retorno pós-cirurgia' },
  { id: 'a3',  petId: 'p4', tutorId: 't2', vetId: 'v1', date: '2026-05-14', time: '10:00', duration: 60, type: 'banho',     status: 'agendado',       notes: 'Banho e tosa padrão' },
  { id: 'a4',  petId: 'p7', tutorId: 't4', vetId: 'v2', date: '2026-05-14', time: '11:00', duration: 90, type: 'cirurgia',  status: 'confirmado',     notes: 'Castração' },
  { id: 'a5',  petId: 'p8', tutorId: 't5', vetId: 'v1', date: '2026-05-14', time: '14:00', duration: 30, type: 'consulta',  status: 'agendado',       notes: 'Revisão cardio' },
  { id: 'a6',  petId: 'p9', tutorId: 't6', vetId: 'v1', date: '2026-05-14', time: '15:00', duration: 30, type: 'vacina',    status: 'agendado',       notes: 'V10 anual' },
  { id: 'a7',  petId: 'p2', tutorId: 't1', vetId: 'v1', date: '2026-05-15', time: '09:00', duration: 30, type: 'consulta',  status: 'agendado',       notes: '' },
  { id: 'a8',  petId: 'p5', tutorId: 't3', vetId: 'v1', date: '2026-05-15', time: '10:30', duration: 30, type: 'retorno',   status: 'agendado',       notes: 'Controle pressão' },
  { id: 'a9',  petId: 'p10',tutorId: 't6', vetId: 'v1', date: '2026-05-15', time: '14:00', duration: 30, type: 'vacina',    status: 'agendado',       notes: 'Primeira vacina' },
  { id: 'a10', petId: 'p1', tutorId: 't1', vetId: 'v2', date: '2026-05-16', time: '09:00', duration: 60, type: 'cirurgia',  status: 'agendado',       notes: 'Retirada de nódulo' },
  { id: 'a11', petId: 'p3', tutorId: 't2', vetId: 'v1', date: '2026-05-16', time: '11:00', duration: 30, type: 'consulta',  status: 'agendado',       notes: '' },
  { id: 'a12', petId: 'p6', tutorId: 't3', vetId: 'v1', date: '2026-05-19', time: '09:00', duration: 30, type: 'consulta',  status: 'agendado',       notes: 'Peixes — avaliação geral' },
  { id: 'a13', petId: 'p7', tutorId: 't4', vetId: 'v1', date: '2026-05-19', time: '10:00', duration: 60, type: 'banho',     status: 'agendado',       notes: 'Tosa higiênica' },
  { id: 'a14', petId: 'p4', tutorId: 't2', vetId: 'v1', date: '2026-05-20', time: '08:30', duration: 30, type: 'consulta',  status: 'agendado',       notes: '' },
  { id: 'a15', petId: 'p8', tutorId: 't5', vetId: 'v2', date: '2026-05-21', time: '09:00', duration: 60, type: 'cirurgia',  status: 'agendado',       notes: 'Exame de ecocardiograma' },
  { id: 'a16', petId: 'p9', tutorId: 't6', vetId: 'v1', date: '2026-05-07', time: '10:00', duration: 30, type: 'consulta',  status: 'concluido',      notes: '' },
  { id: 'a17', petId: 'p2', tutorId: 't1', vetId: 'v1', date: '2026-05-08', time: '09:00', duration: 30, type: 'vacina',    status: 'concluido',      notes: '' },
  { id: 'a18', petId: 'p5', tutorId: 't3', vetId: 'v1', date: '2026-05-09', time: '14:00', duration: 30, type: 'retorno',   status: 'concluido',      notes: '' },
  { id: 'a19', petId: 'p1', tutorId: 't1', vetId: 'v1', date: '2026-05-12', time: '09:00', duration: 30, type: 'consulta',  status: 'cancelado',      notes: 'Tutor cancelou' },
  { id: 'a20', petId: 'p3', tutorId: 't2', vetId: 'v2', date: '2026-05-06', time: '08:00', duration: 90, type: 'cirurgia',  status: 'concluido',      notes: '' },
]

export const PRONTUARIOS = [
  {
    id: 'pr1', petId: 'p1', vetId: 'v1', appointmentId: 'a16', date: '2026-05-07',
    vitals: { temperatura: '38.5', fc: '92', fr: '22', peso: '28.5', spo2: '98', trc: '1', mucosas: 'Rosadas', hidratacao: '<5%', pulso: 'Normal' },
    anamnese: { queixa: 'Coceira intensa no corpo', historiaAtual: 'Tutora relata prurido generalizado há 5 dias. Sem melhora com banho medicado.', historicoPrevio: 'Histórico de alergia alimentar a frango.', statusVacinal: 'Em dia', statusVermifugacao: 'Em dia', alimentacao: 'Ração premium salmão', acesRua: 'Não', contatoAnimais: 'Sim' },
    examesFisicos: {
      cardiovascular: { status: 'Normal', obs: 'Bulhas cardíacas rítmicas, sem sopros' },
      respiratorio: { status: 'Normal', obs: '' },
      digestorio: { status: 'Normal', obs: '' },
      locomotor: { status: 'Normal', obs: '' },
      neurologico: { status: 'Normal', obs: '' },
      dermatologico: { status: 'Alterado', obs: 'Eritema difuso em abdômen e axilas. Presença de pápulas. Pele ressecada.' },
      reprodutivo: { status: 'Normal', obs: '' },
      linfonodos: { status: 'Normal', obs: '' },
      olhos: { status: 'Normal', obs: '' },
      ouvidos: { status: 'Alterado', obs: 'Leve descamação no pavilhão auricular bilateral' },
      boca: { status: 'Normal', obs: '' },
    },
    diagnostico: { presuntivo: 'Dermatite alérgica', diferencial: 'Dermatite de contato, Sarna demodécica', definitivo: 'Dermatite atópica canina', examesSolicitados: 'Raspado de pele, hemograma completo' },
    prescricao: {
      medicamentos: [
        { nome: 'Prednisolona', dose: '1 mg/kg', via: 'Oral', frequencia: 'SID', duracao: '7 dias', obs: 'Com alimento' },
        { nome: 'Clorexidina shampoo 2%', dose: 'Uso tópico', via: 'Tópica', frequencia: '2x/semana', duracao: '30 dias', obs: 'Deixar agir 5 min' },
      ],
      retorno: '2026-05-21',
      orientacoes: 'Manter dieta hipoalergênica com proteína de salmão. Evitar ambientes empoeirados. Retornar com resultado dos exames.'
    },
    assinatura: 'data:image/png;base64,placeholder',
  },
  {
    id: 'pr2', petId: 'p5', vetId: 'v1', appointmentId: 'a18', date: '2026-05-09',
    vitals: { temperatura: '38.7', fc: '110', fr: '28', peso: '12.3', spo2: '96', trc: '2', mucosas: 'Rosadas', hidratacao: '5-8%', pulso: 'Fraco' },
    anamnese: { queixa: 'Cansaço e tosse seca', historiaAtual: 'Tutora relata cansaço progressivo, intolerância ao exercício e tosse noturna há 2 semanas.', historicoPrevio: 'Cardiopatia diagnosticada em 2024.', statusVacinal: 'Em dia', statusVermifugacao: 'Em dia', alimentacao: 'Ração cardíaca prescrita', acesRua: 'Sim (curtos passeios)', contatoAnimais: 'Não' },
    examesFisicos: {
      cardiovascular: { status: 'Alterado', obs: 'Sopro grau III/VI em mitral. FC 110 bpm.' },
      respiratorio: { status: 'Alterado', obs: 'Estertores na base dos pulmões. FR 28 mpm.' },
      digestorio: { status: 'Normal', obs: '' },
      locomotor: { status: 'Normal', obs: '' },
      neurologico: { status: 'Normal', obs: '' },
      dermatologico: { status: 'Normal', obs: '' },
      reprodutivo: { status: 'N/A', obs: 'Castrada' },
      linfonodos: { status: 'Normal', obs: '' },
      olhos: { status: 'Normal', obs: '' },
      ouvidos: { status: 'Normal', obs: '' },
      boca: { status: 'Normal', obs: 'Tártaro grau II' },
    },
    diagnostico: { presuntivo: 'Insuficiência cardíaca congestiva', diferencial: 'Pneumonia, traqueobronquite', definitivo: 'ICC estágio B2 — valvopatia mitral', examesSolicitados: 'Radiografia torácica, ecocardiograma, troponina I' },
    prescricao: {
      medicamentos: [
        { nome: 'Furosemida', dose: '2 mg/kg', via: 'Oral', frequencia: 'BID', duracao: '30 dias', obs: '' },
        { nome: 'Enalapril', dose: '0.5 mg/kg', via: 'Oral', frequencia: 'BID', duracao: 'Contínuo', obs: '' },
        { nome: 'Pimobendan', dose: '0.25 mg/kg', via: 'Oral', frequencia: 'BID', duracao: 'Contínuo', obs: 'Separado das refeições' },
      ],
      retorno: '2026-05-23',
      orientacoes: 'Restrição de sódio. Pesar diariamente. Retornar urgente se piora da tosse ou dificuldade respiratória.'
    },
    assinatura: 'data:image/png;base64,placeholder',
  },
]

export const PRODUTOS = [
  { id: 'e1',  name: 'Amoxicilina 250mg',         category: 'Medicamento',  quantity: 48,  unit: 'comp',    minStock: 20, expiryDate: '2026-07-15', supplier: 'Lab A', costPrice: 0.45, salePrice: 1.10, location: 'A1' },
  { id: 'e2',  name: 'Prednisolona 20mg',          category: 'Medicamento',  quantity: 30,  unit: 'comp',    minStock: 15, expiryDate: '2026-05-20', supplier: 'Lab A', costPrice: 0.80, salePrice: 1.90, location: 'A2' },
  { id: 'e3',  name: 'Furosemida 40mg',            category: 'Medicamento',  quantity: 60,  unit: 'comp',    minStock: 20, expiryDate: '2026-09-30', supplier: 'Lab B', costPrice: 0.30, salePrice: 0.75, location: 'A2' },
  { id: 'e4',  name: 'Dipirona Injetável 500mg/mL',category: 'Medicamento',  quantity: 8,   unit: 'frasco',  minStock: 10, expiryDate: '2027-03-01', supplier: 'Lab C', costPrice: 12.00, salePrice: 28.00, location: 'A3' },
  { id: 'e5',  name: 'Vacina V10 Cão',             category: 'Vacina',       quantity: 15,  unit: 'dose',    minStock: 10, expiryDate: '2026-06-01', supplier: 'MSD',  costPrice: 18.00, salePrice: 45.00, location: 'FRIG' },
  { id: 'e6',  name: 'Vacina Antirrábica',         category: 'Vacina',       quantity: 10,  unit: 'dose',    minStock: 8,  expiryDate: '2026-08-20', supplier: 'MSD',  costPrice: 22.00, salePrice: 55.00, location: 'FRIG' },
  { id: 'e7',  name: 'Clorexidina Shampoo 2%',     category: 'Dermatologia', quantity: 12,  unit: 'frasco',  minStock: 5,  expiryDate: '2027-01-10', supplier: 'PetFarm', costPrice: 18.00, salePrice: 42.00, location: 'B1' },
  { id: 'e8',  name: 'Ração Hills z/d 2kg',        category: 'Nutrição',     quantity: 6,   unit: 'pacote',  minStock: 4,  expiryDate: '2026-10-15', supplier: 'Hills', costPrice: 85.00, salePrice: 175.00, location: 'C1' },
  { id: 'e9',  name: 'Ração Royal Canin Cardiac',  category: 'Nutrição',     quantity: 4,   unit: 'pacote',  minStock: 5,  expiryDate: '2026-11-01', supplier: 'Royal', costPrice: 95.00, salePrice: 195.00, location: 'C1' },
  { id: 'e10', name: 'Ketamina 10% Injetável',     category: 'Anestésico',   quantity: 5,   unit: 'frasco',  minStock: 3,  expiryDate: '2026-05-18', supplier: 'Lab D', costPrice: 45.00, salePrice: 0.00,  location: 'COFRE' },
  { id: 'e11', name: 'Propofol 10mg/mL',           category: 'Anestésico',   quantity: 8,   unit: 'frasco',  minStock: 4,  expiryDate: '2026-12-15', supplier: 'Lab D', costPrice: 38.00, salePrice: 0.00,  location: 'COFRE' },
  { id: 'e12', name: 'Scalp 23G',                  category: 'Material',     quantity: 200, unit: 'un',      minStock: 50, expiryDate: '2028-01-01', supplier: 'BD',   costPrice: 0.80, salePrice: 0.00,  location: 'D1' },
  { id: 'e13', name: 'Seringa 3mL',                category: 'Material',     quantity: 12,  unit: 'caixa',   minStock: 5,  expiryDate: '2028-06-01', supplier: 'BD',   costPrice: 22.00, salePrice: 0.00,  location: 'D1' },
  { id: 'e14', name: 'Luva Descartável M',         category: 'Material',     quantity: 3,   unit: 'caixa',   minStock: 5,  expiryDate: '2029-01-01', supplier: 'Volk', costPrice: 28.00, salePrice: 0.00,  location: 'D2' },
  { id: 'e15', name: 'Pimobendan 2.5mg',           category: 'Medicamento',  quantity: 2,   unit: 'comp',    minStock: 15, expiryDate: '2026-05-16', supplier: 'Lab E', costPrice: 8.50, salePrice: 18.00, location: 'A4' },
]

export const SERVICOS_CATALOGO = [
  { id: 's1',  name: 'Consulta Clínica',        category: 'Consulta',      duration: 30,  price: 120.00 },
  { id: 's2',  name: 'Consulta Retorno',         category: 'Consulta',      duration: 20,  price: 70.00  },
  { id: 's3',  name: 'Consulta Domiciliar',      category: 'Consulta',      duration: 60,  price: 220.00 },
  { id: 's4',  name: 'Cirurgia — Castração F',   category: 'Cirurgia',      duration: 120, price: 450.00 },
  { id: 's5',  name: 'Cirurgia — Castração M',   category: 'Cirurgia',      duration: 60,  price: 320.00 },
  { id: 's6',  name: 'Cirurgia — Nodulectomia',  category: 'Cirurgia',      duration: 90,  price: 550.00 },
  { id: 's7',  name: 'Vacina V10',               category: 'Vacina',        duration: 15,  price: 85.00  },
  { id: 's8',  name: 'Vacina Antirrábica',        category: 'Vacina',        duration: 15,  price: 75.00  },
  { id: 's9',  name: 'Vacina Tríplice Felina',   category: 'Vacina',        duration: 15,  price: 80.00  },
  { id: 's10', name: 'Banho Pequeno Porte',       category: 'Banho & Tosa',  duration: 60,  price: 60.00  },
  { id: 's11', name: 'Banho Médio Porte',         category: 'Banho & Tosa',  duration: 90,  price: 90.00  },
  { id: 's12', name: 'Banho Grande Porte',        category: 'Banho & Tosa',  duration: 120, price: 130.00 },
  { id: 's13', name: 'Tosa Higiênica',            category: 'Banho & Tosa',  duration: 30,  price: 55.00  },
  { id: 's14', name: 'Tosa Completa',             category: 'Banho & Tosa',  duration: 90,  price: 110.00 },
  { id: 's15', name: 'Hemograma Completo',        category: 'Exame',         duration: 15,  price: 95.00  },
  { id: 's16', name: 'Bioquímico Renal',          category: 'Exame',         duration: 15,  price: 110.00 },
  { id: 's17', name: 'Ecocardiograma',            category: 'Exame',         duration: 60,  price: 380.00 },
  { id: 's18', name: 'Radiografia (2 posições)',  category: 'Exame',         duration: 20,  price: 180.00 },
  { id: 's19', name: 'Eletrocardiograma',         category: 'Exame',         duration: 20,  price: 120.00 },
  { id: 's20', name: 'Hospedagem Diária — Pequeno', category: 'Hospedagem',  duration: 1440, price: 80.00 },
  { id: 's21', name: 'Hospedagem Diária — Médio',   category: 'Hospedagem',  duration: 1440, price: 110.00 },
  { id: 's22', name: 'Hospedagem Diária — Grande',  category: 'Hospedagem',  duration: 1440, price: 150.00 },
]

export const HOSPEDAGENS = [
  { id: 'h1', petId: 'p4', tutorId: 't2', checkIn: '2026-05-12', checkOut: '2026-05-17', dailyRate: 110.00, status: 'ativo',      observations: 'Alimentação 2x ao dia. Ração Hills' },
  { id: 'h2', petId: 'p9', tutorId: 't6', checkIn: '2026-05-14', checkOut: '2026-05-19', dailyRate: 150.00, status: 'ativo',      observations: 'Passeio 2x ao dia' },
  { id: 'h3', petId: 'p7', tutorId: 't4', checkIn: '2026-05-01', checkOut: '2026-05-05', dailyRate: 110.00, status: 'concluido',  observations: '' },
  { id: 'h4', petId: 'p2', tutorId: 't1', checkIn: '2026-04-20', checkOut: '2026-04-25', dailyRate: 80.00,  status: 'concluido',  observations: 'Gata tímida' },
]

export const LANCAMENTOS = [
  { id: 'f1',  type: 'receita',  category: 'Consultas',    date: '2026-05-14', value: 120.00, description: 'Consulta — Rex (Maria Silva)',        method: 'PIX',      status: 'recebido' },
  { id: 'f2',  type: 'receita',  category: 'Consultas',    date: '2026-05-14', value: 70.00,  description: 'Retorno — Thor (João Pereira)',       method: 'Cartão',   status: 'recebido' },
  { id: 'f3',  type: 'receita',  category: 'Banho & Tosa', date: '2026-05-14', value: 90.00,  description: 'Banho médio — Luna (João Pereira)',   method: 'Dinheiro', status: 'recebido' },
  { id: 'f4',  type: 'receita',  category: 'Cirurgia',     date: '2026-05-14', value: 320.00, description: 'Castração M — Simba (Pedro Alves)',   method: 'PIX',      status: 'pendente' },
  { id: 'f5',  type: 'receita',  category: 'Hospedagem',   date: '2026-05-14', value: 260.00, description: 'Hospedagem Luna — 2 diárias',         method: 'PIX',      status: 'recebido' },
  { id: 'f6',  type: 'despesa',  category: 'Medicamentos', date: '2026-05-14', value: 240.00, description: 'Compra Amoxicilina — Lab A',          method: 'Boleto',   status: 'pago' },
  { id: 'f7',  type: 'receita',  category: 'Consultas',    date: '2026-05-13', value: 120.00, description: 'Consulta — Mel (Ana Costa)',          method: 'PIX',      status: 'recebido' },
  { id: 'f8',  type: 'receita',  category: 'Vacinas',      date: '2026-05-13', value: 85.00,  description: 'V10 — Thor (João Pereira)',           method: 'Cartão',   status: 'recebido' },
  { id: 'f9',  type: 'despesa',  category: 'Pessoal',      date: '2026-05-10', value: 3000.00, description: 'Salário — Dra. Tatiana Borges',      method: 'TED',      status: 'pago' },
  { id: 'f10', type: 'despesa',  category: 'Pessoal',      date: '2026-05-10', value: 2200.00, description: 'Salário — Dr. Carlos Menezes',       method: 'TED',      status: 'pago' },
  { id: 'f11', type: 'despesa',  category: 'Aluguel',      date: '2026-05-05', value: 3500.00, description: 'Aluguel — Maio 2026',                method: 'TED',      status: 'pago' },
  { id: 'f12', type: 'receita',  category: 'Consultas',    date: '2026-05-12', value: 120.00, description: 'Consulta — Bolt (Roberto Lima)',      method: 'PIX',      status: 'recebido' },
  { id: 'f13', type: 'receita',  category: 'Exames',       date: '2026-05-09', value: 380.00, description: 'Ecocardiograma — Mel (Ana Costa)',    method: 'Cartão',   status: 'recebido' },
  { id: 'f14', type: 'receita',  category: 'Banho & Tosa', date: '2026-05-08', value: 110.00, description: 'Tosa completa — Simba (Pedro Alves)',  method: 'PIX',      status: 'recebido' },
  { id: 'f15', type: 'despesa',  category: 'Fornecedores', date: '2026-05-07', value: 1250.00, description: 'Compra vacinas — MSD',              method: 'Boleto',   status: 'pago' },
  { id: 'f16', type: 'despesa',  category: 'Utilidades',   date: '2026-05-05', value: 580.00, description: 'Energia elétrica — Abril',           method: 'Débito',   status: 'pago' },
  { id: 'f17', type: 'receita',  category: 'Consultas',    date: '2026-05-07', value: 120.00, description: 'Consulta — Rex (Maria Silva)',        method: 'PIX',      status: 'recebido' },
  { id: 'f18', type: 'receita',  category: 'Consultas',    date: '2026-05-06', value: 450.00, description: 'Castração F — Thor (João Pereira)',   method: 'Cartão',   status: 'recebido' },
  { id: 'f19', type: 'despesa',  category: 'Marketing',    date: '2026-05-01', value: 350.00, description: 'Impulsionamento Instagram — Maio',   method: 'Cartão',   status: 'pago' },
  { id: 'f20', type: 'receita',  category: 'Produtos',     date: '2026-05-11', value: 175.00, description: 'Ração Hills z/d — Maria Silva',       method: 'PIX',      status: 'recebido' },
]

export const USUARIOS = [
  { id: 'u-danilo', name: 'Danilo Toledo',  email: 'dastoledo@gmail.com',          role: 'admin',       initials: 'DT', active: true,  crmv: '',         lastLogin: null,                  firstLogin: false, permissions: { dashboard: true, pets: true, prontuario: true, agenda: true, estoque: true, servicos: true, financeiro: true, usuarios: true } },
  { id: 'u-julia',  name: 'Julia',          email: 'julia@emporiumvazpet.com.br',  role: 'admin',       initials: 'JU', active: true,  crmv: '',         lastLogin: null,                  firstLogin: false, permissions: { dashboard: true, pets: true, prontuario: true, agenda: true, estoque: true, servicos: true, financeiro: true, usuarios: true } },
  { id: 'u-tamara', name: 'Tamara',         email: 'tamara@tatabi.com.br',         role: 'admin',       initials: 'TA', active: true,  crmv: '',         lastLogin: null,                  firstLogin: false, permissions: { dashboard: true, pets: true, prontuario: true, agenda: true, estoque: true, servicos: true, financeiro: true, usuarios: true } },
  { id: 'u1',       name: 'Admin Emporium', email: 'admin@emporiumvazpet.com.br',  role: 'admin',       initials: 'AE', active: true,  crmv: '',         lastLogin: '2026-05-14T08:00:00', firstLogin: false, permissions: { dashboard: true, pets: true, prontuario: true, agenda: true, estoque: true, servicos: true, financeiro: true, usuarios: true } },
  { id: 'u2',       name: 'Tatiana Borges', email: 'tatiana@petvet.com',           role: 'veterinario', initials: 'TB', active: true,  crmv: 'SP-12345', lastLogin: '2026-05-14T07:55:00', firstLogin: false, permissions: { dashboard: true, pets: true, prontuario: true, agenda: true, estoque: false, servicos: true, financeiro: false, usuarios: false } },
  { id: 'u3',       name: 'Carlos Menezes', email: 'carlos@petvet.com',            role: 'veterinario', initials: 'CM', active: true,  crmv: 'SP-67890', lastLogin: '2026-05-13T18:30:00', firstLogin: false, permissions: { dashboard: true, pets: true, prontuario: true, agenda: true, estoque: false, servicos: true, financeiro: false, usuarios: false } },
  { id: 'u4',       name: 'Fernanda Rocha', email: 'fernanda@petvet.com',          role: 'atendente',   initials: 'FR', active: true,  crmv: '',         lastLogin: '2026-05-14T07:45:00', firstLogin: false, permissions: { dashboard: true, pets: true, prontuario: false, agenda: true, estoque: true, servicos: true, financeiro: false, usuarios: false } },
  { id: 'u5',       name: 'Rafael Santos',  email: 'rafael@petvet.com',            role: 'atendente',   initials: 'RS', active: false, crmv: '',         lastLogin: '2026-04-30T17:00:00', firstLogin: false, permissions: { dashboard: true, pets: true, prontuario: false, agenda: true, estoque: true, servicos: true, financeiro: false, usuarios: false } },
]

export const ATIVIDADES = [
  { id: 'at1', userId: 'u1', action: 'Login no sistema',                    date: '2026-05-14T08:00:00', module: 'Auth' },
  { id: 'at2', userId: 'u2', action: 'Login no sistema',                    date: '2026-05-14T07:55:00', module: 'Auth' },
  { id: 'at3', userId: 'u4', action: 'Login no sistema',                    date: '2026-05-14T07:45:00', module: 'Auth' },
  { id: 'at4', userId: 'u2', action: 'Prontuário criado — Rex (ID: pr1)',    date: '2026-05-14T09:30:00', module: 'Prontuário' },
  { id: 'at5', userId: 'u4', action: 'Pet cadastrado — Oreo (ID: p10)',      date: '2026-05-13T14:20:00', module: 'Pets' },
  { id: 'at6', userId: 'u4', action: 'Agendamento criado — Thor, 15/mai',   date: '2026-05-13T11:00:00', module: 'Agenda' },
  { id: 'at7', userId: 'u1', action: 'Usuário ativado — Rafael Santos',      date: '2026-05-10T09:00:00', module: 'Usuários' },
  { id: 'at8', userId: 'u3', action: 'Login no sistema',                    date: '2026-05-13T08:00:00', module: 'Auth' },
  { id: 'at9', userId: 'u2', action: 'Prontuário editado — Mel (ID: pr2)',   date: '2026-05-13T10:00:00', module: 'Prontuário' },
  { id: 'at10',userId: 'u1', action: 'Produto atualizado — Amoxicilina',     date: '2026-05-12T16:00:00', module: 'Estoque' },
]

// Helpers
export function getPetById(id) { return PETS.find(p => p.id === id) }
export function getTutorById(id) { return TUTORES.find(t => t.id === id) }
export function getVetById(id) { return VETS.find(v => v.id === id) }
export function getUserById(id) { return USUARIOS.find(u => u.id === id) }
export function getPetAge(birthDate) {
  const birth = new Date(birthDate)
  const now = new Date('2026-05-14')
  const years = now.getFullYear() - birth.getFullYear()
  const months = now.getMonth() - birth.getMonth()
  if (years === 0) return `${months + (months < 0 ? 12 : 0)}m`
  return `${years}a`
}
export function getDaysUntilExpiry(dateStr) {
  const expiry = new Date(dateStr)
  const now = new Date('2026-05-14')
  return Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
}
