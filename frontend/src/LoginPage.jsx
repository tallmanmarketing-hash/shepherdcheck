import { useState } from 'react'
import { useAuth } from './auth'

export default function LoginPage({ onSwitch }) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const data = await login(email, password)
    if (data.error) setError(data.error)
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span>🐑</span>
          <h1>ShepherdCheck</h1>
        </div>
        <p className="auth-subtitle">Church Kids Check-In System</p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@church.org" required autoFocus />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" required />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button className="btn btn-primary btn-lg" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        
        <p className="auth-switch">
          New church? <button className="link-btn" onClick={onSwitch}>Register here</button>
        </p>
      </div>
    </div>
  )
}