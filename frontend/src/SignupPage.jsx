import { useState } from 'react'
import { useAuth } from './auth'

export default function SignupPage({ onSwitch }) {
  const { signup } = useAuth()
  const [churchName, setChurchName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    
    const data = await signup(churchName, email, password, phone)
    if (data.error) {
      setError(data.error)
    } else {
      setSuccess(data.message + ' You can log in once approved.')
    }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span>🐑</span>
          <h1>ShepherdCheck</h1>
        </div>
        <p className="auth-subtitle">Register Your Church</p>
        
        {success ? (
          <div className="success-state">
            <div className="success-icon">✓</div>
            <p>{success}</p>
            <button className="btn btn-primary btn-lg" onClick={onSwitch}>Go to Login</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Church Name *</label>
              <input type="text" value={churchName} onChange={e => setChurchName(e.target.value)} placeholder="e.g. Grace Community Church" required autoFocus />
            </div>
            <div className="form-group">
              <label>Your Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="pastor@church.org" required />
            </div>
            <div className="form-group">
              <label>Password *</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a password" required minLength={6} />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Church phone number" />
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading}>
              {loading ? 'Registering...' : 'Register Church'}
            </button>
          </form>
        )}
        
        <p className="auth-switch">
          Already registered? <button className="link-btn" onClick={onSwitch}>Sign in</button>
        </p>
      </div>
    </div>
  )
}