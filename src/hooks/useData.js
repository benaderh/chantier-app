import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ─── Format helpers ──────────────────────────────────────────────────────────

export function fmt(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('fr-DZ') + ' DA'
}

export function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function diffDays(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr) - new Date()
  return Math.round(diff / 86400000)
}

// ─── Projets ─────────────────────────────────────────────────────────────────

export function useProjets() {
  const [projets, setProjets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('projet')
      .select(`
        projet_id, projet_name, projet_ville, projet_mt,
        projet_du, projet_au, projet_obs,
        tier:id_tier ( tier_id, tier_name )
      `)
      .order('projet_du', { ascending: false })

    if (error) setError(error.message)
    else setProjets(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { projets, loading, error, refresh: fetch }
}

export async function upsertProjet(values) {
  const { projet_id, ...rest } = values
  if (projet_id) {
    return supabase.from('projet').update(rest).eq('projet_id', projet_id)
  }
  return supabase.from('projet').insert(rest)
}

export async function deleteProjet(id) {
  return supabase.from('projet').delete().eq('projet_id', id)
}

// ─── Tiers ───────────────────────────────────────────────────────────────────

export function useTiers(type = null) {
  const [tiers, setTiers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let q = supabase.from('tier').select('*').order('tier_name')
    if (type) q = q.eq('tier_type', type)
    q.then(({ data }) => { setTiers(data || []); setLoading(false) })
  }, [type])

  return { tiers, loading }
}

export async function upsertTier(values) {
  const { tier_id, ...rest } = values
  if (tier_id) return supabase.from('tier').update(rest).eq('tier_id', tier_id)
  return supabase.from('tier').insert(rest)
}

// ─── Projet detail (summary) ──────────────────────────────────────────────────

export function useProjetDetail(projetId) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!projetId) return
    setLoading(true)

    // Fetch projet + tier
    const { data: projet } = await supabase
      .from('projet')
      .select('*, tier:id_tier(tier_name, tier_type)')
      .eq('projet_id', projetId)
      .single()

    // Fetch attachments with encaissements
    const { data: attaches } = await supabase
      .from('attach')
      .select('*, enc(*)')
      .eq('id_projet', projetId)
      .order('attach_date', { ascending: false })

    // Fetch charges with règlements
    const { data: charges } = await supabase
      .from('charge')
      .select('*, regl(*), tier:id_tier(tier_name, tier_type), engin:id_engin(engin_name)')
      .eq('id_projet', projetId)
      .order('charge_date', { ascending: false })

    const totalAttach = (attaches || []).reduce((s, a) => s + (a.attach_mt || 0), 0)
    const totalEnc = (attaches || []).reduce((s, a) =>
      s + (a.enc || []).reduce((se, e) => se + (e.enc_mt || 0), 0), 0)
    const totalCharge = (charges || []).reduce((s, c) => s + (c.charge_mt || 0), 0)
    const totalRegl = (charges || []).reduce((s, c) =>
      s + (c.regl || []).reduce((sr, r) => sr + (r.regl_mt || 0), 0), 0)

    setDetail({
      projet,
      attaches: attaches || [],
      charges: charges || [],
      totalAttach,
      totalEnc,
      totalCharge,
      totalRegl,
      resteFacturer: (projet?.projet_mt || 0) - totalAttach,
      resteEncaisser: totalAttach - totalEnc,
      marge: totalAttach - totalCharge,
      dettes: totalCharge - totalRegl,
    })
    setLoading(false)
  }, [projetId])

  useEffect(() => { fetch() }, [fetch])

  return { detail, loading, refresh: fetch }
}

// ─── Attachements ─────────────────────────────────────────────────────────────

export async function upsertAttach(values) {
  const { attach_id, enc, ...rest } = values
  if (attach_id) return supabase.from('attach').update(rest).eq('attach_id', attach_id)
  return supabase.from('attach').insert(rest)
}

export async function deleteAttach(id) {
  return supabase.from('attach').delete().eq('attach_id', id)
}

// ─── Encaissements ────────────────────────────────────────────────────────────

export async function upsertEnc(values) {
  const { enc_id, ...rest } = values
  if (enc_id) return supabase.from('enc').update(rest).eq('enc_id', enc_id)
  return supabase.from('enc').insert(rest)
}

export async function deleteEnc(id) {
  return supabase.from('enc').delete().eq('enc_id', id)
}

// ─── Charges ─────────────────────────────────────────────────────────────────

export async function upsertCharge(values) {
  const { charge_id, regl, tier, engin, ...rest } = values
  if (charge_id) return supabase.from('charge').update(rest).eq('charge_id', charge_id)
  return supabase.from('charge').insert(rest)
}

export async function deleteCharge(id) {
  return supabase.from('charge').delete().eq('charge_id', id)
}

// ─── Règlements ────────────────────────────────────────────────────────────────

export async function upsertRegl(values) {
  const { regl_id, ...rest } = values
  if (regl_id) return supabase.from('regl').update(rest).eq('regl_id', regl_id)
  return supabase.from('regl').insert(rest)
}

export async function deleteRegl(id) {
  return supabase.from('regl').delete().eq('regl_id', id)
}

// ─── Engins ───────────────────────────────────────────────────────────────────

export function useEngins() {
  const [engins, setEngins] = useState([])
  useEffect(() => {
    supabase.from('engin').select('*').order('engin_name')
      .then(({ data }) => setEngins(data || []))
  }, [])
  return { engins }
}

export async function upsertEngin(values) {
  const { engin_id, ...rest } = values
  if (engin_id) return supabase.from('engin').update(rest).eq('engin_id', engin_id)
  return supabase.from('engin').insert(rest)
}
