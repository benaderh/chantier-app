import { useState } from 'react'
import { useProjetDetail, upsertAttach, deleteAttach, upsertEnc, deleteEnc, upsertCharge, deleteCharge, upsertRegl, deleteRegl, useTiers, useEngins, fmt, fmtDate } from '../hooks/useData'
import { Modal, Field, Input, Textarea, Select, Btn, BtnRow, KpiCard, ListRow, Empty, useConfirm, Tabs, Progress } from '../components/UI'

const CHARGE_TYPE_OPTIONS = [
  { value: 'F', label: 'Fournisseur' },
  { value: 'P', label: 'Personnel' },
  { value: 'E', label: 'Location engin' },
  { value: 'A', label: 'Autre charge' },
]

// ─── Synthèse tab ─────────────────────────────────────────────────────────────

function SyntheseTab({ detail }) {
  const { projet, totalAttach, totalEnc, totalCharge, totalRegl, resteFacturer, resteEncaisser, marge, dettes } = detail
  const mt = projet.projet_mt || 0

  return (
    <div className="tab-content">
      {/* Situations */}
      <div className="section-block">
        <div className="section-label">📋 Situations de travaux</div>
        <div className="kpi-grid-2">
          <KpiCard label="Montant marché" value={fmt(mt)} />
          <KpiCard label="Total facturé" value={fmt(totalAttach)} color="green" />
          <KpiCard label="Total encaissé" value={fmt(totalEnc)} color="blue" />
          <KpiCard label="Reste à facturer" value={fmt(resteFacturer)} color={resteFacturer > 0 ? 'orange' : 'gray'} />
          <KpiCard label="Reste à encaisser" value={fmt(resteEncaisser)} color={resteEncaisser > 0 ? 'red' : 'gray'} />
        </div>
        {mt > 0 && (
          <div style={{ marginTop: 8, padding: '0 4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              <span>Avancement facturation</span>
              <span>{mt > 0 ? Math.round((totalAttach / mt) * 100) : 0}%</span>
            </div>
            <Progress value={totalAttach} max={mt} />
          </div>
        )}
      </div>

      {/* Charges */}
      <div className="section-block">
        <div className="section-label">💸 Charges</div>
        <div className="kpi-grid-2">
          <KpiCard label="Total charges" value={fmt(totalCharge)} color="red" />
          <KpiCard label="Total réglé" value={fmt(totalRegl)} color="green" />
          <KpiCard label="Dettes fournisseurs" value={fmt(dettes)} color={dettes > 0 ? 'orange' : 'gray'} />
        </div>
      </div>

      {/* Marge */}
      <div className="section-block">
        <div className="section-label">📊 Rentabilité</div>
        <div className="kpi-grid-2">
          <KpiCard label="Marge brute" value={fmt(marge)} color={marge >= 0 ? 'green' : 'red'} />
          <KpiCard label="Taux de marge" value={totalAttach > 0 ? `${Math.round((marge / totalAttach) * 100)}%` : '—'} color="blue" />
        </div>
      </div>
    </div>
  )
}

// ─── Attachements tab ────────────────────────────────────────────────────────

function AttachTab({ detail, onRefresh }) {
  const { confirm, Dialog } = useConfirm()
  const [showAttach, setShowAttach] = useState(false)
  const [editAttach, setEditAttach] = useState(null)
  const [showEnc, setShowEnc] = useState(null) // attach object
  const [editEnc, setEditEnc] = useState(null)
  const [saving, setSaving] = useState(false)

  const [aForm, setAForm] = useState({ id_projet: detail.projet.projet_id, attach_num: '', attach_date: '', attach_name: '', attach_mt: '', attach_obs: '' })
  const [eForm, setEForm] = useState({ enc_date: '', enc_mt: '', enc_obs: '' })

  function openNewAttach() {
    setEditAttach(null)
    setAForm({ id_projet: detail.projet.projet_id, attach_num: '', attach_date: '', attach_name: '', attach_mt: '', attach_obs: '' })
    setShowAttach(true)
  }

  function openEditAttach(a) {
    setEditAttach(a)
    setAForm({ attach_id: a.attach_id, id_projet: a.id_projet, attach_num: a.attach_num || '', attach_date: a.attach_date || '', attach_name: a.attach_name || '', attach_mt: a.attach_mt || '', attach_obs: a.attach_obs || '' })
    setShowAttach(true)
  }

  async function saveAttach() {
    setSaving(true)
    await upsertAttach({ ...aForm, attach_mt: Number(aForm.attach_mt) || null })
    setSaving(false)
    setShowAttach(false)
    onRefresh()
  }

  async function handleDeleteAttach(a) {
    if (await confirm(`Supprimer l'attachement N° ${a.attach_num || a.attach_id} ?`)) {
      await deleteAttach(a.attach_id)
      onRefresh()
    }
  }

  function openEncForm(attach, enc = null) {
    setShowEnc(attach)
    setEditEnc(enc)
    setEForm(enc
      ? { enc_id: enc.enc_id, enc_date: enc.enc_date || '', enc_mt: enc.enc_mt || '', enc_obs: enc.enc_obs || '' }
      : { id_attach: attach.attach_id, enc_date: '', enc_mt: '', enc_obs: '' }
    )
  }

  async function saveEnc() {
    setSaving(true)
    await upsertEnc({ ...eForm, enc_mt: Number(eForm.enc_mt) || null })
    setSaving(false)
    setShowEnc(null)
    onRefresh()
  }

  async function handleDeleteEnc(enc) {
    if (await confirm('Supprimer cet encaissement ?')) {
      await deleteEnc(enc.enc_id)
      onRefresh()
    }
  }

  return (
    <div className="tab-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0 8px' }}>
        <span className="section-label" style={{ marginBottom: 0 }}>Attachements</span>
        <button className="btn btn-primary btn-sm" onClick={openNewAttach}>+ Ajouter</button>
      </div>

      {detail.attaches.length === 0 && <Empty icon="📋" label="Aucun attachement" />}

      {detail.attaches.map(a => {
        const encTotal = (a.enc || []).reduce((s, e) => s + (e.enc_mt || 0), 0)
        return (
          <div key={a.attach_id} className="attach-card">
            <div className="attach-header">
              <div>
                <div className="attach-num">N° {a.attach_num || '—'} — {a.attach_name || ''}</div>
                <div className="attach-date">{fmtDate(a.attach_date)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="attach-mt">{fmt(a.attach_mt)}</div>
                <div className="attach-enc">Enc: {fmt(encTotal)}</div>
              </div>
            </div>
            {a.attach_mt > 0 && <Progress value={encTotal} max={a.attach_mt} />}

            {/* Encaissements */}
            <div className="enc-list">
              {(a.enc || []).map(e => (
                <div key={e.enc_id} className="enc-row">
                  <span className="enc-date">{fmtDate(e.enc_date)}</span>
                  <span className="enc-mt">{fmt(e.enc_mt)}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="link-btn" onClick={() => openEncForm(a, e)}>✏️</button>
                    <button className="link-btn danger" onClick={() => handleDeleteEnc(e)}>🗑️</button>
                  </div>
                </div>
              ))}
              <button className="link-btn" style={{ fontSize: 12, marginTop: 4 }} onClick={() => openEncForm(a)}>+ Encaissement</button>
            </div>

            <div className="attach-actions">
              <button className="link-btn" onClick={() => openEditAttach(a)}>✏️ Modifier</button>
              <button className="link-btn danger" onClick={() => handleDeleteAttach(a)}>🗑️ Supprimer</button>
            </div>
          </div>
        )
      })}

      {/* Attach form */}
      {showAttach && (
        <Modal title={editAttach ? 'Modifier attachement' : 'Nouvel attachement'} onClose={() => setShowAttach(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="N° attachement">
              <Input value={aForm.attach_num} onChange={e => setAForm(f => ({ ...f, attach_num: e.target.value }))} />
            </Field>
            <Field label="Date">
              <Input type="date" value={aForm.attach_date} onChange={e => setAForm(f => ({ ...f, attach_date: e.target.value }))} />
            </Field>
          </div>
          <Field label="Désignation">
            <Input value={aForm.attach_name} onChange={e => setAForm(f => ({ ...f, attach_name: e.target.value }))} />
          </Field>
          <Field label="Montant (DA)">
            <Input type="number" value={aForm.attach_mt} onChange={e => setAForm(f => ({ ...f, attach_mt: e.target.value }))} />
          </Field>
          <Field label="Observations">
            <Textarea value={aForm.attach_obs} onChange={e => setAForm(f => ({ ...f, attach_obs: e.target.value }))} />
          </Field>
          <BtnRow>
            <Btn variant="outline" onClick={() => setShowAttach(false)}>Annuler</Btn>
            <Btn loading={saving} onClick={saveAttach}>Enregistrer</Btn>
          </BtnRow>
        </Modal>
      )}

      {/* Enc form */}
      {showEnc && (
        <Modal title={editEnc ? 'Modifier encaissement' : 'Nouvel encaissement'} onClose={() => setShowEnc(null)}>
          <Field label="Date">
            <Input type="date" value={eForm.enc_date} onChange={e => setEForm(f => ({ ...f, enc_date: e.target.value }))} />
          </Field>
          <Field label="Montant (DA)">
            <Input type="number" value={eForm.enc_mt} onChange={e => setEForm(f => ({ ...f, enc_mt: e.target.value }))} />
          </Field>
          <Field label="Observations">
            <Textarea value={eForm.enc_obs} onChange={e => setEForm(f => ({ ...f, enc_obs: e.target.value }))} />
          </Field>
          <BtnRow>
            <Btn variant="outline" onClick={() => setShowEnc(null)}>Annuler</Btn>
            <Btn loading={saving} onClick={saveEnc}>Enregistrer</Btn>
          </BtnRow>
        </Modal>
      )}

      <Dialog />
    </div>
  )
}

// ─── Charges tab ─────────────────────────────────────────────────────────────

function ChargeTab({ detail, onRefresh }) {
  const { tiers: fournisseurs } = useTiers('F')
  const { tiers: personnels } = useTiers('P')
  const { tiers: autres } = useTiers('A')
  const { engins } = useEngins()
  const { confirm, Dialog } = useConfirm()

  const [showCharge, setShowCharge] = useState(false)
  const [editCharge, setEditCharge] = useState(null)
  const [showRegl, setShowRegl] = useState(null)
  const [editRegl, setEditRegl] = useState(null)
  const [saving, setSaving] = useState(false)
  const [filterType, setFilterType] = useState('all')

  const [cForm, setCForm] = useState({ id_projet: detail.projet.projet_id, id_tier: '', id_engin: '', charge_date: '', charge_mt: '', charge_obs: '', _type: 'F' })
  const [rForm, setRForm] = useState({ regl_date: '', regl_mt: '', regl_obs: '' })

  function getTiersForType(type) {
    if (type === 'F') return fournisseurs
    if (type === 'P') return personnels
    if (type === 'A') return autres
    return []
  }

  function openNewCharge() {
    setEditCharge(null)
    setCForm({ id_projet: detail.projet.projet_id, id_tier: '', id_engin: '', charge_date: '', charge_mt: '', charge_obs: '', _type: 'F' })
    setShowCharge(true)
  }

  function openEditCharge(c) {
    setEditCharge(c)
    const _type = c.id_engin ? 'E' : (c.tier?.tier_type || 'F')
    setCForm({ charge_id: c.charge_id, id_projet: c.id_projet, id_tier: c.id_tier || '', id_engin: c.id_engin || '', charge_date: c.charge_date || '', charge_mt: c.charge_mt || '', charge_obs: c.charge_obs || '', _type })
    setShowCharge(true)
  }

  async function saveCharge() {
    setSaving(true)
    const payload = { ...cForm, charge_mt: Number(cForm.charge_mt) || null }
    if (payload._type === 'E') { payload.id_tier = null } else { payload.id_engin = null }
    delete payload._type
    await upsertCharge(payload)
    setSaving(false)
    setShowCharge(false)
    onRefresh()
  }

  async function handleDeleteCharge(c) {
    if (await confirm('Supprimer cette charge ?')) {
      await deleteCharge(c.charge_id)
      onRefresh()
    }
  }

  function openReglForm(charge, regl = null) {
    setShowRegl(charge)
    setEditRegl(regl)
    setRForm(regl
      ? { regl_id: regl.regl_id, regl_date: regl.regl_date || '', regl_mt: regl.regl_mt || '', regl_obs: regl.regl_obs || '' }
      : { id_charge: charge.charge_id, regl_date: '', regl_mt: '', regl_obs: '' }
    )
  }

  async function saveRegl() {
    setSaving(true)
    await upsertRegl({ ...rForm, regl_mt: Number(rForm.regl_mt) || null })
    setSaving(false)
    setShowRegl(null)
    onRefresh()
  }

  async function handleDeleteRegl(r) {
    if (await confirm('Supprimer ce règlement ?')) {
      await deleteRegl(r.regl_id)
      onRefresh()
    }
  }

  const typeIcon = { F: '🏭', P: '👷', E: '🚜', A: '📦' }

  const filtered = filterType === 'all' ? detail.charges : detail.charges.filter(c => {
    if (filterType === 'E') return !!c.id_engin
    return c.tier?.tier_type === filterType && !c.id_engin
  })

  return (
    <div className="tab-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 }}>
        <span className="section-label" style={{ marginBottom: 0 }}>Charges</span>
        <button className="btn btn-primary btn-sm" onClick={openNewCharge}>+ Ajouter</button>
      </div>

      {/* Type filter */}
      <div className="filter-row">
        {[['all', '📋 Tous'], ['F', '🏭 Fourn.'], ['E', '🚜 Engins'], ['P', '👷 Personnel'], ['A', '📦 Autres']].map(([k, l]) => (
          <button key={k} className={`filter-btn ${filterType === k ? 'active' : ''}`} onClick={() => setFilterType(k)}>{l}</button>
        ))}
      </div>

      {filtered.length === 0 && <Empty icon="💸" label="Aucune charge" />}

      {filtered.map(c => {
        const reglTotal = (c.regl || []).reduce((s, r) => s + (r.regl_mt || 0), 0)
        const ctype = c.id_engin ? 'E' : (c.tier?.tier_type || 'A')
        return (
          <div key={c.charge_id} className="attach-card">
            <div className="attach-header">
              <div>
                <div className="attach-num">
                  {typeIcon[ctype]} {c.id_engin ? c.engin?.engin_name : c.tier?.tier_name || '—'}
                </div>
                <div className="attach-date">{fmtDate(c.charge_date)} {c.charge_obs && `· ${c.charge_obs}`}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="attach-mt">{fmt(c.charge_mt)}</div>
                <div className="attach-enc" style={{ color: reglTotal >= (c.charge_mt || 0) ? '#1D9E75' : '#EF9F27' }}>
                  Réglé: {fmt(reglTotal)}
                </div>
              </div>
            </div>
            {c.charge_mt > 0 && <Progress value={reglTotal} max={c.charge_mt} color={reglTotal >= c.charge_mt ? '#1D9E75' : '#EF9F27'} />}

            <div className="enc-list">
              {(c.regl || []).map(r => (
                <div key={r.regl_id} className="enc-row">
                  <span className="enc-date">{fmtDate(r.regl_date)}</span>
                  <span className="enc-mt">{fmt(r.regl_mt)}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="link-btn" onClick={() => openReglForm(c, r)}>✏️</button>
                    <button className="link-btn danger" onClick={() => handleDeleteRegl(r)}>🗑️</button>
                  </div>
                </div>
              ))}
              <button className="link-btn" style={{ fontSize: 12, marginTop: 4 }} onClick={() => openReglForm(c)}>+ Règlement</button>
            </div>

            <div className="attach-actions">
              <button className="link-btn" onClick={() => openEditCharge(c)}>✏️ Modifier</button>
              <button className="link-btn danger" onClick={() => handleDeleteCharge(c)}>🗑️ Supprimer</button>
            </div>
          </div>
        )
      })}

      {/* Charge form */}
      {showCharge && (
        <Modal title={editCharge ? 'Modifier charge' : 'Nouvelle charge'} onClose={() => setShowCharge(false)}>
          <Field label="Type de charge">
            <Select
              options={CHARGE_TYPE_OPTIONS}
              value={cForm._type}
              onChange={e => setCForm(f => ({ ...f, _type: e.target.value, id_tier: '', id_engin: '' }))}
            />
          </Field>
          {cForm._type === 'E' ? (
            <Field label="Engin">
              <Select
                options={engins.map(e => ({ value: e.engin_id, label: e.engin_name }))}
                placeholder="Sélectionner engin..."
                value={cForm.id_engin}
                onChange={e => setCForm(f => ({ ...f, id_engin: e.target.value }))}
              />
            </Field>
          ) : (
            <Field label={CHARGE_TYPE_OPTIONS.find(o => o.value === cForm._type)?.label || 'Tiers'}>
              <Select
                options={getTiersForType(cForm._type).map(t => ({ value: t.tier_id, label: t.tier_name }))}
                placeholder="Sélectionner..."
                value={cForm.id_tier}
                onChange={e => setCForm(f => ({ ...f, id_tier: e.target.value }))}
              />
            </Field>
          )}
          <Field label="Date">
            <Input type="date" value={cForm.charge_date} onChange={e => setCForm(f => ({ ...f, charge_date: e.target.value }))} />
          </Field>
          <Field label="Montant (DA)">
            <Input type="number" value={cForm.charge_mt} onChange={e => setCForm(f => ({ ...f, charge_mt: e.target.value }))} />
          </Field>
          <Field label="Observations">
            <Textarea value={cForm.charge_obs} onChange={e => setCForm(f => ({ ...f, charge_obs: e.target.value }))} />
          </Field>
          <BtnRow>
            <Btn variant="outline" onClick={() => setShowCharge(false)}>Annuler</Btn>
            <Btn loading={saving} onClick={saveCharge}>Enregistrer</Btn>
          </BtnRow>
        </Modal>
      )}

      {/* Regl form */}
      {showRegl && (
        <Modal title={editRegl ? 'Modifier règlement' : 'Nouveau règlement'} onClose={() => setShowRegl(null)}>
          <Field label="Date">
            <Input type="date" value={rForm.regl_date} onChange={e => setRForm(f => ({ ...f, regl_date: e.target.value }))} />
          </Field>
          <Field label="Montant (DA)">
            <Input type="number" value={rForm.regl_mt} onChange={e => setRForm(f => ({ ...f, regl_mt: e.target.value }))} />
          </Field>
          <Field label="Observations">
            <Textarea value={rForm.regl_obs} onChange={e => setRForm(f => ({ ...f, regl_obs: e.target.value }))} />
          </Field>
          <BtnRow>
            <Btn variant="outline" onClick={() => setShowRegl(null)}>Annuler</Btn>
            <Btn loading={saving} onClick={saveRegl}>Enregistrer</Btn>
          </BtnRow>
        </Modal>
      )}

      <Dialog />
    </div>
  )
}

// ─── Main detail page ─────────────────────────────────────────────────────────

export default function ProjetDetailPage({ projet, onBack }) {
  const [tab, setTab] = useState('synthese')
  const { detail, loading, refresh } = useProjetDetail(projet.projet_id)

  const TABS = [
    { key: 'synthese', label: '📊 Synthèse' },
    { key: 'situations', label: '📋 Situations' },
    { key: 'charges', label: '💸 Charges' },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="icon-btn" onClick={onBack}>←</button>
          <div>
            <div className="page-title" style={{ fontSize: 14 }}>{projet.projet_name}</div>
            <div className="page-sub">{projet.tier?.tier_name} {projet.projet_ville && `· ${projet.projet_ville}`}</div>
          </div>
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {loading && <div className="loading-text">Chargement...</div>}

      {!loading && detail && (
        <>
          {tab === 'synthese' && <SyntheseTab detail={detail} />}
          {tab === 'situations' && <AttachTab detail={detail} onRefresh={refresh} />}
          {tab === 'charges' && <ChargeTab detail={detail} onRefresh={refresh} />}
        </>
      )}
    </div>
  )
}
