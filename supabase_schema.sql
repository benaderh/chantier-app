-- ═══════════════════════════════════════════════════════════════
-- GESTION CHANTIERS — Script SQL Supabase
-- À exécuter dans l'éditeur SQL de votre projet Supabase
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Enable UUID extension ────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 2. Tables (si pas déjà créées) ──────────────────────────────

-- Tiers (clients, fournisseurs, personnel, autre)
CREATE TABLE IF NOT EXISTS tier (
  tier_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier_name  TEXT NOT NULL,
  tier_type  CHAR(1) CHECK (tier_type IN ('C','F','P','A')) DEFAULT 'C',
  tier_obs   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Engins
CREATE TABLE IF NOT EXISTS engin (
  engin_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engin_name TEXT NOT NULL,
  engin_obs  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projets / Chantiers
CREATE TABLE IF NOT EXISTS projet (
  projet_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_tier     UUID REFERENCES tier(tier_id),
  projet_name TEXT NOT NULL,
  projet_ville TEXT,
  projet_mt   NUMERIC(18,2),
  projet_du   DATE,
  projet_au   DATE,
  projet_obs  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Attachements (situations de travaux)
CREATE TABLE IF NOT EXISTS attach (
  attach_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_projet   UUID NOT NULL REFERENCES projet(projet_id) ON DELETE CASCADE,
  attach_num  TEXT,
  attach_date DATE,
  attach_name TEXT,
  attach_mt   NUMERIC(18,2),
  attach_obs  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Encaissements
CREATE TABLE IF NOT EXISTS enc (
  enc_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_attach UUID NOT NULL REFERENCES attach(attach_id) ON DELETE CASCADE,
  enc_date  DATE,
  enc_mt    NUMERIC(18,2),
  enc_obs   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Charges (fournisseurs, engins, personnel, autres)
CREATE TABLE IF NOT EXISTS charge (
  charge_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_projet   UUID NOT NULL REFERENCES projet(projet_id) ON DELETE CASCADE,
  id_tier     UUID REFERENCES tier(tier_id),
  id_engin    UUID REFERENCES engin(engin_id),
  charge_date DATE,
  charge_mt   NUMERIC(18,2),
  charge_obs  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Règlements des charges
CREATE TABLE IF NOT EXISTS regl (
  regl_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_charge  UUID NOT NULL REFERENCES charge(charge_id) ON DELETE CASCADE,
  regl_date  DATE,
  regl_mt    NUMERIC(18,2),
  regl_obs   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Table droits d'accès utilisateurs ─────────────────────────
-- Permet de gérer les permissions par chantier et par module

CREATE TABLE IF NOT EXISTS user_access (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id_projet  UUID REFERENCES projet(projet_id) ON DELETE CASCADE,
  -- NULL = accès à tous les projets (admin)
  can_attach BOOLEAN DEFAULT FALSE,  -- Gestion situations/attachements
  can_charge BOOLEAN DEFAULT FALSE,  -- Gestion charges
  can_enc    BOOLEAN DEFAULT FALSE,  -- Voir encaissements
  can_regl   BOOLEAN DEFAULT FALSE,  -- Voir règlements
  is_admin   BOOLEAN DEFAULT FALSE,  -- Accès total
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, id_projet)
);

-- ── 4. Enable Row Level Security ────────────────────────────────

ALTER TABLE tier    ENABLE ROW LEVEL SECURITY;
ALTER TABLE engin   ENABLE ROW LEVEL SECURITY;
ALTER TABLE projet  ENABLE ROW LEVEL SECURITY;
ALTER TABLE attach  ENABLE ROW LEVEL SECURITY;
ALTER TABLE enc     ENABLE ROW LEVEL SECURITY;
ALTER TABLE charge  ENABLE ROW LEVEL SECURITY;
ALTER TABLE regl    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_access ENABLE ROW LEVEL SECURITY;

-- ── 5. Helper function: check user access ───────────────────────

CREATE OR REPLACE FUNCTION has_projet_access(p_projet_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_access
    WHERE user_id = auth.uid()
    AND (id_projet = p_projet_id OR id_projet IS NULL)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_access
    WHERE user_id = auth.uid() AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 6. RLS Policies ─────────────────────────────────────────────

-- TIER: tous les utilisateurs connectés peuvent lire
CREATE POLICY "tier_read"  ON tier FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "tier_write" ON tier FOR ALL    USING (is_admin());

-- ENGIN: idem
CREATE POLICY "engin_read"  ON engin FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "engin_write" ON engin FOR ALL    USING (is_admin());

-- PROJET: selon user_access
CREATE POLICY "projet_read" ON projet FOR SELECT
  USING (has_projet_access(projet_id));
CREATE POLICY "projet_write" ON projet FOR ALL
  USING (is_admin());

-- ATTACH
CREATE POLICY "attach_read" ON attach FOR SELECT
  USING (has_projet_access(id_projet));
CREATE POLICY "attach_write" ON attach FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_access
      WHERE user_id = auth.uid()
      AND (id_projet = attach.id_projet OR id_projet IS NULL)
      AND can_attach = TRUE
    )
  );

-- ENC
CREATE POLICY "enc_read" ON enc FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM attach a WHERE a.attach_id = enc.id_attach
    AND has_projet_access(a.id_projet)
  ));
CREATE POLICY "enc_write" ON enc FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM attach a, user_access ua
      WHERE a.attach_id = enc.id_attach
      AND ua.user_id = auth.uid()
      AND (ua.id_projet = a.id_projet OR ua.id_projet IS NULL)
      AND (ua.can_enc = TRUE OR ua.can_attach = TRUE)
    )
  );

-- CHARGE
CREATE POLICY "charge_read" ON charge FOR SELECT
  USING (has_projet_access(id_projet));
CREATE POLICY "charge_write" ON charge FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_access
      WHERE user_id = auth.uid()
      AND (id_projet = charge.id_projet OR id_projet IS NULL)
      AND can_charge = TRUE
    )
  );

-- REGL
CREATE POLICY "regl_read" ON regl FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM charge c WHERE c.charge_id = regl.id_charge
    AND has_projet_access(c.id_projet)
  ));
CREATE POLICY "regl_write" ON regl FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM charge c, user_access ua
      WHERE c.charge_id = regl.id_charge
      AND ua.user_id = auth.uid()
      AND (ua.id_projet = c.id_projet OR ua.id_projet IS NULL)
      AND (ua.can_regl = TRUE OR ua.can_charge = TRUE)
    )
  );

-- USER_ACCESS: admin seulement
CREATE POLICY "ua_admin" ON user_access FOR ALL USING (is_admin());
CREATE POLICY "ua_self"  ON user_access FOR SELECT USING (user_id = auth.uid());

-- ── 7. Indexes pour les performances ────────────────────────────

CREATE INDEX IF NOT EXISTS idx_attach_projet ON attach(id_projet);
CREATE INDEX IF NOT EXISTS idx_enc_attach     ON enc(id_attach);
CREATE INDEX IF NOT EXISTS idx_charge_projet  ON charge(id_projet);
CREATE INDEX IF NOT EXISTS idx_regl_charge    ON regl(id_charge);
CREATE INDEX IF NOT EXISTS idx_ua_user        ON user_access(user_id);
CREATE INDEX IF NOT EXISTS idx_ua_projet      ON user_access(id_projet);

-- ── 8. Donner accès admin au premier utilisateur ─────────────────
-- À exécuter APRÈS avoir créé votre compte:
-- INSERT INTO user_access (user_id, is_admin)
-- VALUES ('VOTRE_USER_ID_AUTH', TRUE);

-- Pour trouver votre user_id:
-- SELECT id, email FROM auth.users;
