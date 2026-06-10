-- ============================================================
-- PetVet — Tabela bulario_completo
-- Execute este script no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS bulario_completo (
  id                    text PRIMARY KEY,
  registro_mapa         text,
  nome_comercial        text NOT NULL,
  nome_generico         text,
  fabricante            text,
  categoria             text,
  sub_categoria         text,
  apresentacao          text,
  concentracao          text,
  classe_terapeutica    text,
  indicacoes            text,
  contraindicacoes      text,
  dose_cao              text,
  dose_gato             text,
  dose_cao_calculo      text,
  dose_gato_calculo     text,
  dose_outros           text,
  via                   text,
  frequencia            text,
  duracao               text,
  efeitos_adversos      text,
  interacoes            text,
  observacoes           text,
  periodo_carencia      text,
  prescricao_veterinaria boolean DEFAULT true,
  controlado            boolean DEFAULT false,
  foto_url              text,
  fonte                 text DEFAULT 'MAPA',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE bulario_completo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso publico bulario_completo" ON bulario_completo;
CREATE POLICY "Acesso publico bulario_completo" ON bulario_completo
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

GRANT ALL ON TABLE bulario_completo TO anon;
GRANT ALL ON TABLE bulario_completo TO authenticated;

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_bulario_nome      ON bulario_completo(nome_comercial);
CREATE INDEX IF NOT EXISTS idx_bulario_generico  ON bulario_completo(nome_generico);
CREATE INDEX IF NOT EXISTS idx_bulario_categoria ON bulario_completo(categoria);
CREATE INDEX IF NOT EXISTS idx_bulario_fonte     ON bulario_completo(fonte);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bulario_updated_at ON bulario_completo;
CREATE TRIGGER trg_bulario_updated_at
  BEFORE UPDATE ON bulario_completo
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
