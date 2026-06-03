# 🏗️ Gestion Chantiers — Application Mobile React + Supabase

Application de gestion de chantiers (Terrassement & VRD), optimisée mobile Android pour les chefs de chantier.

## Fonctionnalités

- **Projets** : Liste des chantiers avec client, montant, délais et avancement
- **Situations de travaux** : Attachements avec suivi des encaissements et créances
- **Charges** : Fournisseurs, location engins, personnel, autres charges avec règlements
- **Synthèse financière** : Marge brute, taux d'avancement, restes à facturer/encaisser
- **Droits d'accès** : Par chantier et par module (situations, charges, encaissements, règlements)
- **Dark mode** : Support automatique

## Structure des fichiers

```
src/
├── lib/
│   └── supabase.js          # Client Supabase + helpers auth
├── contexts/
│   └── AuthContext.jsx      # Contexte authentification
├── hooks/
│   └── useData.js           # Tous les accès données (projets, attach, charges...)
├── components/
│   └── UI.jsx               # Composants réutilisables (Modal, KpiCard, Tabs...)
├── pages/
│   ├── LoginPage.jsx        # Page de connexion
│   ├── ProjetListPage.jsx   # Liste des chantiers
│   └── ProjetDetailPage.jsx # Détail chantier (synthèse, situations, charges)
├── App.jsx                  # Routage principal
├── main.jsx                 # Point d'entrée
└── index.css                # Styles globaux mobile-first
```

## Installation

### 1. Créer le projet Supabase

1. Aller sur [supabase.com](https://supabase.com) → New project
2. Copier l'URL et la clé `anon` depuis Settings → API

### 2. Créer les tables et politiques

Ouvrir l'éditeur SQL de Supabase et exécuter **`supabase_schema.sql`** en entier.

### 3. Créer le premier utilisateur admin

Dans Supabase → Authentication → Users → Invite user (ou Add user).

Ensuite dans l'éditeur SQL :
```sql
-- Remplacer par l'ID de votre utilisateur
INSERT INTO user_access (user_id, is_admin)
VALUES ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', TRUE);
```

Pour voir l'ID : `SELECT id, email FROM auth.users;`

### 4. Configurer l'application

```bash
# Copier le fichier d'environnement
cp .env.example .env.local

# Editer .env.local avec vos clés Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxxxxx...
```

### 5. Lancer l'application

```bash
npm install
npm run dev
```

### 6. Build pour production (Android)

```bash
npm run build
# Le dossier dist/ contient l'app prête à déployer
```

Pour une app Android native, utiliser [Capacitor](https://capacitorjs.com/docs/getting-started) :
```bash
npm install @capacitor/core @capacitor/android
npx cap init
npx cap add android
npm run build
npx cap sync
npx cap open android  # Ouvre Android Studio
```

## Gestion des droits d'accès

La table `user_access` contrôle les permissions :

| Champ | Description |
|-------|-------------|
| `id_projet` | NULL = accès à tous les projets |
| `can_attach` | Peut gérer les situations de travaux |
| `can_charge` | Peut gérer les charges |
| `can_enc` | Peut voir/gérer les encaissements |
| `can_regl` | Peut voir/gérer les règlements |
| `is_admin` | Accès total, peut tout faire |

### Exemple : donner accès à un chef de chantier

```sql
-- Accès au chantier spécifique uniquement, situations + charges
INSERT INTO user_access (user_id, id_projet, can_attach, can_charge)
VALUES (
  'user-uuid-du-chef',
  'projet-uuid-du-chantier',
  TRUE,
  TRUE
);

-- Accès admin total (tous les chantiers)
INSERT INTO user_access (user_id, is_admin)
VALUES ('user-uuid-admin', TRUE);
```

## Structure des données Supabase

```
tier (C/F/P/A)
  └── projet ──── attach ──── enc
                └── charge ── regl
                      └── engin (pour location)
```

## Technologies

- **React 18** + Vite
- **Supabase** (PostgreSQL + Auth + RLS)
- **CSS vanilla** — mobile-first, dark mode, pas de dépendances CSS
