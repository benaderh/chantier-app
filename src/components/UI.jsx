import { useState } from 'react'

// ─── Modal ────────────────────────────────────────────────────────────────────

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

// ─── Form components ──────────────────────────────────────────────────────────

export function Field({ label, children, error }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      {children}
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}

export function Input({ ...props }) {
  return <input className="inp" {...props} />
}

export function Textarea({ ...props }) {
  return <textarea className="inp" rows={3} {...props} />
}

export function Select({ options, placeholder, ...props }) {
  return (
    <select className="inp" {...props}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function BtnRow({ children }) {
  return <div className="btn-row">{children}</div>
}

export function Btn({ variant = 'primary', loading, children, ...props }) {
  return (
    <button className={`btn btn-${variant}`} disabled={loading} {...props}>
      {loading ? '...' : children}
    </button>
  )
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

export function KpiCard({ label, value, color }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value kpi-${color || 'default'}`}>{value}</div>
    </div>
  )
}

// ─── List row ────────────────────────────────────────────────────────────────

export function ListRow({ left, right, sub, onClick, actions }) {
  return (
    <div className="list-row" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="list-row-content">
        <div className="list-row-left">
          <div className="list-row-main">{left}</div>
          {sub && <div className="list-row-sub">{sub}</div>}
        </div>
        <div className="list-row-right">{right}</div>
      </div>
      {actions && <div className="list-row-actions" onClick={e => e.stopPropagation()}>{actions}</div>}
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

export function Empty({ icon, label }) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon || '📋'}</span>
      <span className="empty-text">{label || 'Aucun enregistrement'}</span>
    </div>
  )
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map(t => (
        <button
          key={t.key}
          className={`tab ${active === t.key ? 'tab-active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─── Progress bar ────────────────────────────────────────────────────────────

export function Progress({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="progress">
      <div
        className="progress-fill"
        style={{ width: `${pct}%`, background: color || 'var(--c-green)' }}
      />
    </div>
  )
}

// ─── Status badge ────────────────────────────────────────────────────────────

export function StatusBadge({ status }) {
  const map = {
    'en_cours': { label: 'En cours', cls: 'badge-green' },
    'termine': { label: 'Terminé', cls: 'badge-gray' },
    'retard': { label: 'En retard', cls: 'badge-orange' },
    'demarrage': { label: 'Démarrage', cls: 'badge-blue' },
  }
  const s = map[status] || { label: status, cls: 'badge-gray' }
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}

// ─── Confirm dialog ──────────────────────────────────────────────────────────

export function useConfirm() {
  const [state, setState] = useState(null)

  const confirm = (msg) => new Promise(resolve => {
    setState({ msg, resolve })
  })

  const Dialog = () => state ? (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 320 }}>
        <div className="modal-body" style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: 20 }}>{state.msg}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Btn variant="outline" onClick={() => { state.resolve(false); setState(null) }}>Annuler</Btn>
            <Btn variant="danger" onClick={() => { state.resolve(true); setState(null) }}>Supprimer</Btn>
          </div>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, Dialog }
}
