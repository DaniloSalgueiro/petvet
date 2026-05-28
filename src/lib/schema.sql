-- ============================================================
-- PetVet — Schema Supabase
-- Execute este SQL no painel do Supabase: SQL Editor
-- ============================================================

-- ---- APP STATE (key-value store — usado pelo useCloudState) ----
CREATE TABLE IF NOT EXISTS app_state (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT 'null',
  updated_at timestamptz DEFAULT now()
);

-- ---- CLÍNICA CONFIG ----
CREATE TABLE IF NOT EXISTS clinica_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dados jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---- USUÁRIOS ----
CREATE TABLE IF NOT EXISTS usuarios (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'atend',
  active boolean DEFAULT true,
  cargo text,
  telefone text,
  cpf text,
  crmv text,
  mapa text,
  permissions jsonb DEFAULT '{}',
  first_login boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---- TUTORES ----
CREATE TABLE IF NOT EXISTS tutores (
  id text PRIMARY KEY,
  name text NOT NULL,
  cpf text,
  rg text,
  email text,
  phone text,
  address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---- PETS ----
CREATE TABLE IF NOT EXISTS pets (
  id text PRIMARY KEY,
  name text NOT NULL,
  species text,
  breed text,
  sex text,
  birth_date text,
  weight text,
  color text,
  castrado text,
  alergias text,
  plano_saude jsonb DEFAULT '{}',
  tutor_id text REFERENCES tutores(id) ON DELETE SET NULL,
  foto text,
  status text DEFAULT 'ok',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---- AGENDAMENTOS ----
CREATE TABLE IF NOT EXISTS agendamentos (
  id text PRIMARY KEY,
  pet_id text REFERENCES pets(id) ON DELETE SET NULL,
  pet_name text,
  tutor_id text REFERENCES tutores(id) ON DELETE SET NULL,
  tutor_name text,
  tutor_phone text,
  vet_id text,
  vet_name text,
  banista_id text,
  banista_name text,
  date text NOT NULL,
  time text,
  duration text,
  type text,
  status text DEFAULT 'agendado',
  tipo_atendimento text DEFAULT 'presencial',
  endereco_atendimento text,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---- PRONTUÁRIOS ----
CREATE TABLE IF NOT EXISTS prontuarios (
  id text PRIMARY KEY,
  pet_id text REFERENCES pets(id) ON DELETE SET NULL,
  tutor_id text REFERENCES tutores(id) ON DELETE SET NULL,
  vet_id text,
  vet_name text,
  date text NOT NULL,
  tipo_consulta text,
  status text DEFAULT 'aguardando',
  dados jsonb NOT NULL DEFAULT '{}',
  anexos jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---- PRODUTOS/ESTOQUE ----
CREATE TABLE IF NOT EXISTS produtos (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text,
  quantity numeric DEFAULT 0,
  min_stock numeric DEFAULT 0,
  unit text,
  sale_price numeric DEFAULT 0,
  cost_price numeric DEFAULT 0,
  expiry_date text,
  lote text,
  fornecedor text,
  foto text,
  dados jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---- SERVIÇOS CONSULTÓRIO ----
CREATE TABLE IF NOT EXISTS servicos_consultorio (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  duration text,
  price numeric DEFAULT 0,
  category text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---- SERVIÇOS DOMICÍLIO ----
CREATE TABLE IF NOT EXISTS servicos_domicilio (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  duration text,
  price numeric DEFAULT 0,
  category text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---- FUNCIONÁRIOS ----
CREATE TABLE IF NOT EXISTS funcionarios (
  id text PRIMARY KEY,
  name text NOT NULL,
  cargo text,
  email text,
  telefone text,
  cpf text,
  rg text,
  salario numeric DEFAULT 0,
  aparece_agenda boolean DEFAULT false,
  dados jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---- LANÇAMENTOS FINANCEIROS ----
CREATE TABLE IF NOT EXISTS lancamentos (
  id text PRIMARY KEY,
  tipo text NOT NULL,
  categoria text,
  descricao text,
  valor numeric NOT NULL,
  data text NOT NULL,
  forma_pagamento text,
  status text DEFAULT 'pago',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---- PROTOCOLOS DE VACINAS ----
CREATE TABLE IF NOT EXISTS protocolos_vacinas (
  id text PRIMARY KEY,
  nome text NOT NULL,
  especie text,
  dados jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---- APLICAÇÕES DE VACINAS ----
CREATE TABLE IF NOT EXISTS aplicacoes_vacinas (
  id text PRIMARY KEY,
  pet_id text REFERENCES pets(id) ON DELETE CASCADE,
  protocolo_id text REFERENCES protocolos_vacinas(id) ON DELETE SET NULL,
  dados jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- ---- RAÇAS ----
CREATE TABLE IF NOT EXISTS racas (
  id text PRIMARY KEY,
  name text NOT NULL,
  species text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ---- BULÁRIO ----
CREATE TABLE IF NOT EXISTS bulario (
  id text PRIMARY KEY,
  nome_comercial text NOT NULL,
  dados jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---- PDV VENDAS ----
CREATE TABLE IF NOT EXISTS vendas (
  id text PRIMARY KEY,
  tutor_id text,
  tutor_name text,
  itens jsonb DEFAULT '[]',
  total numeric DEFAULT 0,
  forma_pagamento text,
  juros numeric DEFAULT 0,
  desconto numeric DEFAULT 0,
  data text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ---- FOLLOW UP QUEUE ----
CREATE TABLE IF NOT EXISTS followup_queue (
  id text PRIMARY KEY,
  agendamento_id text,
  pet_id text,
  tutor_id text,
  concluido_em timestamptz,
  enviado boolean DEFAULT false,
  enviado_em timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- RLS — Row Level Security
-- Acesso público total (restrinja para authenticated após configurar Supabase Auth)
-- ============================================================

-- app_state
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico app_state" ON app_state;
CREATE POLICY "Acesso publico app_state" ON app_state
  FOR ALL USING (true) WITH CHECK (true);

-- clinica_config
ALTER TABLE clinica_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico clinica_config" ON clinica_config;
CREATE POLICY "Acesso publico clinica_config" ON clinica_config
  FOR ALL USING (true) WITH CHECK (true);

-- usuarios
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico usuarios" ON usuarios;
CREATE POLICY "Acesso publico usuarios" ON usuarios
  FOR ALL USING (true) WITH CHECK (true);

-- tutores
ALTER TABLE tutores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico tutores" ON tutores;
CREATE POLICY "Acesso publico tutores" ON tutores
  FOR ALL USING (true) WITH CHECK (true);

-- pets
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico pets" ON pets;
CREATE POLICY "Acesso publico pets" ON pets
  FOR ALL USING (true) WITH CHECK (true);

-- agendamentos
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico agendamentos" ON agendamentos;
CREATE POLICY "Acesso publico agendamentos" ON agendamentos
  FOR ALL USING (true) WITH CHECK (true);

-- prontuarios
ALTER TABLE prontuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico prontuarios" ON prontuarios;
CREATE POLICY "Acesso publico prontuarios" ON prontuarios
  FOR ALL USING (true) WITH CHECK (true);

-- produtos
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico produtos" ON produtos;
CREATE POLICY "Acesso publico produtos" ON produtos
  FOR ALL USING (true) WITH CHECK (true);

-- servicos_consultorio
ALTER TABLE servicos_consultorio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico servicos_consultorio" ON servicos_consultorio;
CREATE POLICY "Acesso publico servicos_consultorio" ON servicos_consultorio
  FOR ALL USING (true) WITH CHECK (true);

-- servicos_domicilio
ALTER TABLE servicos_domicilio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico servicos_domicilio" ON servicos_domicilio;
CREATE POLICY "Acesso publico servicos_domicilio" ON servicos_domicilio
  FOR ALL USING (true) WITH CHECK (true);

-- funcionarios
ALTER TABLE funcionarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico funcionarios" ON funcionarios;
CREATE POLICY "Acesso publico funcionarios" ON funcionarios
  FOR ALL USING (true) WITH CHECK (true);

-- lancamentos
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico lancamentos" ON lancamentos;
CREATE POLICY "Acesso publico lancamentos" ON lancamentos
  FOR ALL USING (true) WITH CHECK (true);

-- protocolos_vacinas
ALTER TABLE protocolos_vacinas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico protocolos_vacinas" ON protocolos_vacinas;
CREATE POLICY "Acesso publico protocolos_vacinas" ON protocolos_vacinas
  FOR ALL USING (true) WITH CHECK (true);

-- aplicacoes_vacinas
ALTER TABLE aplicacoes_vacinas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico aplicacoes_vacinas" ON aplicacoes_vacinas;
CREATE POLICY "Acesso publico aplicacoes_vacinas" ON aplicacoes_vacinas
  FOR ALL USING (true) WITH CHECK (true);

-- racas
ALTER TABLE racas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico racas" ON racas;
CREATE POLICY "Acesso publico racas" ON racas
  FOR ALL USING (true) WITH CHECK (true);

-- bulario
ALTER TABLE bulario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico bulario" ON bulario;
CREATE POLICY "Acesso publico bulario" ON bulario
  FOR ALL USING (true) WITH CHECK (true);

-- vendas
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico vendas" ON vendas;
CREATE POLICY "Acesso publico vendas" ON vendas
  FOR ALL USING (true) WITH CHECK (true);

-- followup_queue
ALTER TABLE followup_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico followup_queue" ON followup_queue;
CREATE POLICY "Acesso publico followup_queue" ON followup_queue
  FOR ALL USING (true) WITH CHECK (true);
