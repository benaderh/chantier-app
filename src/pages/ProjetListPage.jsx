import { useState } from 'react'
import { useProjets, upsertProjet, deleteProjet, useTiers, upsertTier, fmt, fmtDate, diffDays } from '../hooks/useData'
import { Modal, Field, Input, Textarea, Select, Btn, BtnRow, Empty, useConfirm, Progress } from '../components/UI'
import { signOut } from '../lib/supabase'

const TIER_TYPE_LABELS = { C: 'Client', F: 'Fournisseur', P: 'Personnel', A: 'Autre' }

function projetStatus(p) {
  const now = new Date()
  const du = p.projet_du ? new Date(p.projet_du) : null
  const au = p.projet_au ? new Date(p.projet_au) : null
  if (!au) return 'en_cours'
  if (now > au) return 'termine'
  if (!du || now < du) return 'demarrage'
  return 'en_cours'
}

function StatusDot({ projet }) {
  const s = projetStatus(projet)
  const map = {
    en_cours: { color: '#1D9E75', label: 'En cours' },
    termine: { color: '#888', label: 'Terminé' },
    demarrage: { color: '#378ADD', label: 'Démarrage' },
    retard: { color: '#EF9F27', label: 'En retard' },
  }
  const { color, label } = map[s] || map.en_cours
  return <span style={{ fontSize: 11, color }}>{label}</span>
}

export default function ProjetListPage({ onSelectProjet }) {
  const { projets, loading, error, refresh } = useProjets()
  const { tiers } = useTiers('C')
  const { confirm, Dialog } = useConfirm()

  const [showForm, setShowForm] = useState(false)
  const [showTierForm, setShowTierForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  // Form state
  const [form, setForm] = useState({ id_tier: '', projet_name: '', projet_ville: '', projet_mt: '', projet_du: '', projet_au: '', projet_obs: '' })
  const [tierForm, setTierForm] = useState({ tier_name: '', tier_type: 'C', tier_obs: '' })

  function openNew() {
    setEditing(null)
    setForm({ id_tier: '', projet_name: '', projet_ville: '', projet_mt: '', projet_du: '', projet_au: '', projet_obs: '' })
    setShowForm(true)
  }

  function openEdit(p) {
    setEditing(p)
    setForm({
      projet_id: p.projet_id,
      id_tier: p.id_tier,
      projet_name: p.projet_name,
      projet_ville: p.projet_ville || '',
      projet_mt: p.projet_mt || '',
      projet_du: p.projet_du || '',
      projet_au: p.projet_au || '',
      projet_obs: p.projet_obs || '',
    })
    setShowForm(true)
  }

  async function saveProjet() {
    setSaving(true)
    const { error } = await upsertProjet({ ...form, projet_mt: Number(form.projet_mt) || null })
    if (!error) { refresh(); setShowForm(false) }
    setSaving(false)
  }

  async function handleDelete(p) {
    const ok = await confirm(`Supprimer le projet "${p.projet_name}" ?`)
    if (ok) { await deleteProjet(p.projet_id); refresh() }
  }

  async function saveTier() {
    setSaving(true)
    const { error } = await upsertTier(tierForm)
    if (!error) { setShowTierForm(false); setTierForm({ tier_name: '', tier_type: 'C', tier_obs: '' }) }
    setSaving(false)
  }

  const filtered = projets.filter(p =>
    !search || p.projet_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.tier?.tier_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.projet_ville?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">🏗️ Chantiers</div>
          <div className="page-sub">{projets.length} projet{projets.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="icon-btn" title="Déconnexion" onClick={() => signOut()}>⏻</button>
          <button className="btn btn-primary btn-sm" onClick={openNew}>+ Nouveau</button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '0 12px 8px' }}>
        <input
          className="inp"
          type="search"
          placeholder="Rechercher un chantier..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      <div className="list-container">
        {loading && <div className="loading-text">Chargement...</div>}
        {error && <div className="alert alert-danger">{error}</div>}
        {!loading && filtered.length === 0 && (
          <Empty icon="🏗️" label="Aucun chantier trouvé" />
        )}
        {filtered.map(p => (
          <div key={p.projet_id} className="proj-card" onClick={() => onSelectProjet(p)}>
            <div className="proj-card-top">
              <div className="proj-client">{p.tier?.tier_name || '—'}</div>
              <StatusDot projet={p} />
            </div>
            <div className="proj-name">{p.projet_name}</div>
            <div className="proj-meta">
              <span className="proj-mt">{fmt(p.projet_mt)}</span>
              <span className="proj-ville">{p.projet_ville && `📍 ${p.projet_ville}`}</span>
            </div>
            {(p.projet_du || p.projet_au) && (
              <div className="proj-dates">
                {fmtDate(p.projet_du)} → {fmtDate(p.projet_au)}
                {p.projet_au && (
                  <span style={{ marginLeft: 6, color: diffDays(p.projet_au) < 0 ? '#A32D2D' : '#888' }}>
                    ({diffDays(p.projet_au)} j)
                  </span>
                )}
              </div>
            )}
            <div className="proj-actions" onClick={e => e.stopPropagation()}>
              <button className="link-btn" onClick={() => openEdit(p)}>✏️ Modifier</button>
              <button className="link-btn danger" onClick={() => handleDelete(p)}>🗑️ Supprimer</button>
            </div>
          </div>
        ))}
      </div>

      {/* Projet form modal */}
      {showForm && (
        <Modal title={editing ? 'Modifier chantier' : 'Nouveau chantier'} onClose={() => setShowForm(false)}>
          <Field label="Client (maître d'ouvrage)">
            <div style={{ display: 'flex', gap: 6 }}>
              <Select
                options={tiers.map(t => ({ value: t.tier_id, label: t.tier_name }))}
                placeholder="Sélectionner..."
                value={form.id_tier}
                onChange={e => setForm(f => ({ ...f, id_tier: e.target.value }))}
                style={{ flex: 1 }}
              />
              <button className="btn btn-outline btn-sm" onClick={() => setShowTierForm(true)}>+</button>
            </div>
          </Field>
          <Field label="Intitulé du chantier">
            <Input
              value={form.projet_name}
              onChange={e => setForm(f => ({ ...f, projet_name: e.target.value }))}
              placeholder="Ex: Terrassement RN 36 — Lot 2"
            />
          </Field>
          <Field label="Ville / Localisation">
            <Input
              value={form.projet_ville}
              onChange={e => setForm(f => ({ ...f, projet_ville: e.target.value }))}
              placeholder="Ex: Blida"
            />
          </Field>
          <Field label="Montant du marché (DA)">
            <Input
              type="number"
              value={form.projet_mt}
              onChange={e => setForm(f => ({ ...f, projet_mt: e.target.value }))}
              placeholder="0"
            />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Date début">
              <Input type="date" value={form.projet_du} onChange={e => setForm(f => ({ ...f, projet_du: e.target.value }))} />
            </Field>
            <Field label="Date fin">
              <Input type="date" value={form.projet_au} onChange={e => setForm(f => ({ ...f, projet_au: e.target.value }))} />
            </Field>
          </div>
          <Field label="Observations">
            <Textarea value={form.projet_obs} onChange={e => setForm(f => ({ ...f, projet_obs: e.target.value }))} />
          </Field>
          <BtnRow>
            <Btn variant="outline" onClick={() => setShowForm(false)}>Annuler</Btn>
            <Btn loading={saving} onClick={saveProjet}>Enregistrer</Btn>
          </BtnRow>
        </Modal>
      )}

      {/* Tier form modal */}
      {showTierForm && (
        <Modal title="Nouveau client / tiers" onClose={() => setShowTierForm(false)}>
          <Field label="Nom">
            <Input value={tierForm.tier_name} onChange={e => setTierForm(f => ({ ...f, tier_name: e.target.value }))} />
          </Field>
          <Field label="Type">
            <Select
              options={Object.entries(TIER_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              value={tierForm.tier_type}
              onChange={e => setTierForm(f => ({ ...f, tier_type: e.target.value }))}
            />
          </Field>
          <Field label="Observations">
            <Textarea value={tierForm.tier_obs} onChange={e => setTierForm(f => ({ ...f, tier_obs: e.target.value }))} />
          </Field>
          <BtnRow>
            <Btn variant="outline" onClick={() => setShowTierForm(false)}>Annuler</Btn>
            <Btn loading={saving} onClick={saveTier}>Enregistrer</Btn>
          </BtnRow>
        </Modal>
      )}

      <Dialog />
    </div>
  )
}
