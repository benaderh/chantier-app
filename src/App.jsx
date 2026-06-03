import { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import ProjetListPage from './pages/ProjetListPage'
import ProjetDetailPage from './pages/ProjetDetailPage'

function AppInner() {
  const { user, loading } = useAuth()
  const [selectedProjet, setSelectedProjet] = useState(null)

  if (loading) {
    return (
      <div className="splash">
        <div className="splash-icon">🏗️</div>
        <div className="splash-text">Chargement...</div>
      </div>
    )
  }

  if (!user) return <LoginPage />

  if (selectedProjet) {
    return (
      <ProjetDetailPage
        projet={selectedProjet}
        onBack={() => setSelectedProjet(null)}
      />
    )
  }

  return <ProjetListPage onSelectProjet={setSelectedProjet} />
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
