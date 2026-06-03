"""
Script de configuration Supabase pour Gestion Chantiers
Exécuter localement : python3 setup_supabase.py
"""
import psycopg2
import sys

DB_CONFIG = {
    "host": "db.ctdwrlgrdjmqrnmaqnra.supabase.co",
    "port": 5432,
    "dbname": "postgres",
    "user": "postgres",
    "password": "ilD7VcZ8Ywzlcx5L",
    "sslmode": "require",
}

SQL = """
-- ═══════════════════════════════════════════════════════════════
-- GESTION CHANTIERS — Setup complet
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Tables ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tier (
  tier_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier_name  TEXT NOT NULL,
  tier_type  CHAR(1) CHECK (tier_type IN ('C','F','P','A')) DEFAULT 'C',
  tier_obs   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS engin (
  engin_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engin_name TEXT NOT NULL,
  engin_obs  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS enc (
  enc_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_attach UUID NOT NULL REFERENCES attach(attach_id) ON DELETE CASCADE,
  enc_date  DATE,
  enc_mt    NUMERIC(18,2),
  enc_obs   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS regl (
  regl_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_charge  UUID NOT NULL REFERENCES charge(charge_id) ON DELETE CASCADE,
  regl_date  DATE,
  regl_mt    NUMERIC(18,2),
  regl_obs   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_access (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id_projet  UUID REFERENCES projet(projet_id) ON DELETE CASCADE,
  can_attach BOOLEAN DEFAULT FALSE,
  can_charge BOOLEAN DEFAULT FALSE,
  can_enc    BOOLEAN DEFAULT FALSE,
  can_regl   BOOLEAN DEFAULT FALSE,
  is_admin   BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, id_projet)
);

-- ── Indexes ─────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_attach_projet ON attach(id_projet);
CREATE INDEX IF NOT EXISTS idx_enc_attach     ON enc(id_attach);
CREATE INDEX IF NOT EXISTS idx_charge_projet  ON charge(id_projet);
CREATE INDEX IF NOT EXISTS idx_regl_charge    ON regl(id_charge);
CREATE INDEX IF NOT EXISTS idx_ua_user        ON user_access(user_id);
CREATE INDEX IF NOT EXISTS idx_ua_projet      ON user_access(id_projet);

-- ── RLS ─────────────────────────────────────────────────────────

ALTER TABLE tier        ENABLE ROW LEVEL SECURITY;
ALTER TABLE engin       ENABLE ROW LEVEL SECURITY;
ALTER TABLE projet      ENABLE ROW LEVEL SECURITY;
ALTER TABLE attach      ENABLE ROW LEVEL SECURITY;
ALTER TABLE enc         ENABLE ROW LEVEL SECURITY;
ALTER TABLE charge      ENABLE ROW LEVEL SECURITY;
ALTER TABLE regl        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_access ENABLE ROW LEVEL SECURITY;

-- Helper functions
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

-- Drop existing policies to avoid conflicts
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname='public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Tier policies
CREATE POLICY "tier_read"  ON tier FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "tier_write" ON tier FOR ALL    USING (is_admin());

-- Engin policies
CREATE POLICY "engin_read"  ON engin FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "engin_write" ON engin FOR ALL    USING (is_admin());

-- Projet policies
CREATE POLICY "projet_read"  ON projet FOR SELECT USING (has_projet_access(projet_id));
CREATE POLICY "projet_write" ON projet FOR ALL    USING (is_admin());

-- Attach policies
CREATE POLICY "attach_read" ON attach FOR SELECT USING (has_projet_access(id_projet));
CREATE POLICY "attach_write" ON attach FOR ALL USING (
  is_admin() OR EXISTS (
    SELECT 1 FROM user_access
    WHERE user_id = auth.uid()
    AND (id_projet = attach.id_projet OR id_projet IS NULL)
    AND can_attach = TRUE
  )
);

-- Enc policies
CREATE POLICY "enc_read" ON enc FOR SELECT USING (
  EXISTS (SELECT 1 FROM attach a WHERE a.attach_id = enc.id_attach AND has_projet_access(a.id_projet))
);
CREATE POLICY "enc_write" ON enc FOR ALL USING (
  is_admin() OR EXISTS (
    SELECT 1 FROM attach a
    JOIN user_access ua ON (ua.id_projet = a.id_projet OR ua.id_projet IS NULL)
    WHERE a.attach_id = enc.id_attach AND ua.user_id = auth.uid()
    AND (ua.can_enc = TRUE OR ua.can_attach = TRUE)
  )
);

-- Charge policies
CREATE POLICY "charge_read"  ON charge FOR SELECT USING (has_projet_access(id_projet));
CREATE POLICY "charge_write" ON charge FOR ALL USING (
  is_admin() OR EXISTS (
    SELECT 1 FROM user_access
    WHERE user_id = auth.uid()
    AND (id_projet = charge.id_projet OR id_projet IS NULL)
    AND can_charge = TRUE
  )
);

-- Regl policies
CREATE POLICY "regl_read" ON regl FOR SELECT USING (
  EXISTS (SELECT 1 FROM charge c WHERE c.charge_id = regl.id_charge AND has_projet_access(c.id_projet))
);
CREATE POLICY "regl_write" ON regl FOR ALL USING (
  is_admin() OR EXISTS (
    SELECT 1 FROM charge c
    JOIN user_access ua ON (ua.id_projet = c.id_projet OR ua.id_projet IS NULL)
    WHERE c.charge_id = regl.id_charge AND ua.user_id = auth.uid()
    AND (ua.can_regl = TRUE OR ua.can_charge = TRUE)
  )
);

-- User access policies
CREATE POLICY "ua_admin" ON user_access FOR ALL    USING (is_admin());
CREATE POLICY "ua_self"  ON user_access FOR SELECT USING (user_id = auth.uid());

-- ── Données de test ──────────────────────────────────────────────

INSERT INTO tier (tier_name, tier_type) VALUES
  ('EURL BENALI TRAVAUX', 'C'),
  ('SPA INFRA OUEST', 'C'),
  ('DIRECTION DES TRAVAUX PUBLICS', 'C'),
  ('SARL MATÉRIAUX BÂTIMENT', 'F'),
  ('LOCATION ENGINS HADJ OMAR', 'F'),
  ('ENTREPRISE TRANSPORT NORD', 'F'),
  ('PERSONNEL CHANTIER', 'P'),
  ('FRAIS DIVERS', 'A')
ON CONFLICT DO NOTHING;

INSERT INTO engin (engin_name, engin_obs) VALUES
  ('Pelle hydraulique CAT 320', 'Location journalière'),
  ('Compacteur BOMAG BW 213', 'Location journalière'),
  ('Bulldozer CAT D6', 'Location hebdomadaire'),
  ('Camion benne 10T', 'Location journalière'),
  ('Niveleuse CAT 140', 'Location journalière')
ON CONFLICT DO NOTHING;
"""

def run():
    print("Connexion à Supabase...")
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        conn.autocommit = True
        cur = conn.cursor()
        print("✓ Connecté\n")
        
        print("Exécution du schéma SQL...")
        cur.execute(SQL)
        print("✓ Tables créées")
        print("✓ RLS activé")
        print("✓ Politiques configurées")
        print("✓ Données de test insérées\n")
        
        # Verify
        cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;")
        tables = [r[0] for r in cur.fetchall()]
        print(f"Tables créées: {', '.join(tables)}\n")
        
        # Get first user to make admin
        cur.execute("SELECT id, email FROM auth.users LIMIT 5;")
        users = cur.fetchall()
        if users:
            print("Utilisateurs trouvés:")
            for u in users:
                print(f"  {u[1]} → {u[0]}")
            print(f"\nPour donner les droits admin au premier utilisateur:")
            print(f"  INSERT INTO user_access (user_id, is_admin) VALUES ('{users[0][0]}', TRUE);")
        else:
            print("Aucun utilisateur encore. Créez-en un dans Supabase Auth,")
            print("puis exécutez:")
            print("  INSERT INTO user_access (user_id, is_admin)")
            print("  SELECT id, TRUE FROM auth.users WHERE email='votre@email.com';")
        
        conn.close()
        print("\n✅ Configuration terminée avec succès!")
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run()
