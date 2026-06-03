import { useState } from 'react'
import { signIn } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="login-icon">🏗️</span>
          <h1 className="login-title">Gestion Chantiers</h1>
          <p className="login-sub">Terrassement & VRD</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="field-label">Email</label>
            <input
              className="inp"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="chef@chantier.dz"
            />
          </div>
          <div className="field">
            <label className="field-label">Mot de passe</label>
            <input
              className="inp"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          {error && <div className="alert alert-danger">{error}</div>}
          <button className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}
