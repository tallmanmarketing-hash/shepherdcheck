import { useState } from 'react'
import { AuthProvider, useAuth } from './auth'
import LoginPage from './LoginPage'
import SignupPage from './SignupPage'
import CheckIn from './CheckIn'
import CheckOut from './CheckOut'
import Dashboard from './Dashboard'
import StaffPage from './StaffPage'
import FamiliesPage from './FamiliesPage'
import AdminPage from './AdminPage'
import './App.css'

function AppContent() {
  const { user, loading, logout } = useAuth()
  const [page, setPage] = useState('checkin')
  const [authMode, setAuthMode] = useState('login')

  if (loading) return <div className="loading">Loading...</div>

  if (!user) {
    return (
      <>
        {authMode === 'login' ? (
          <LoginPage onSwitch={() => setAuthMode('signup')} />
        ) : (
          <SignupPage onSwitch={() => setAuthMode('login')} />
        )}
      </>
    )
  }

  const isSuperAdmin = user.role === 'super_admin'

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo" onClick={() => setPage('checkin')}>
          <span className="logo-icon">🐑</span>
          <h1>ShepherdCheck</h1>
        </div>
        <div className="header-right">
          <span className="tenant-name">{user.tenantName || 'Admin'}</span>
          <nav className="nav-tabs">
            <button className={`nav-btn ${page === 'checkin' ? 'active' : ''}`} onClick={() => setPage('checkin')}>Check In</button>
            <button className={`nav-btn ${page === 'checkout' ? 'active' : ''}`} onClick={() => setPage('checkout')}>Check Out</button>
            <button className={`nav-btn ${page === 'dashboard' ? 'active' : ''}`} onClick={() => setPage('dashboard')}>Dashboard</button>
            <button className={`nav-btn ${page === 'families' ? 'active' : ''}`} onClick={() => setPage('families')}>Families</button>
            <button className={`nav-btn ${page === 'staff' ? 'active' : ''}`} onClick={() => setPage('staff')}>Staff</button>
            {isSuperAdmin && (
              <button className={`nav-btn admin-btn ${page === 'admin' ? 'active' : ''}`} onClick={() => setPage('admin')}>Admin</button>
            )}
          </nav>
          <button className="btn-logout" onClick={logout} title="Sign out">↩</button>
        </div>
      </header>

      <main className="app-main">
        {page === 'checkin' && <CheckIn />}
        {page === 'checkout' && <CheckOut />}
        {page === 'dashboard' && <Dashboard />}
        {page === 'families' && <FamiliesPage />}
        {page === 'staff' && <StaffPage />}
        {page === 'admin' && <AdminPage />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}