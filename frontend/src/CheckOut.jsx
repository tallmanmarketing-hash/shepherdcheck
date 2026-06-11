import { useState } from 'react'
import { api } from './auth'

export default function CheckOut() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!code.trim()) return
    
    setLoading(true)
    setError('')
    setResult(null)
    
    const data = await api('/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ code: code.trim() })
    })
    
    if (data.error) {
      setError(data.error)
    } else {
      setResult(data)
    }
    setLoading(false)
  }

  if (result) {
    return (
      <div className="checkin-success">
        <div className="success-icon checkout-icon">↩</div>
        <h2>{result.kid_name} checked out!</h2>
        <p className="text-muted">Released to {result.parent_name}</p>
        <button className="btn btn-primary btn-lg" onClick={() => { setResult(null); setCode(''); setError('') }}>
          Check Out Another Kid
        </button>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="card" style={{ textAlign: 'center' }}>
        <h2>Check Out at Pickup</h2>
        <p className="text-muted">Enter the unique code shown at check-in</p>
        <form onSubmit={handleSubmit}>
          <div className="code-input-group">
            <input
              type="text"
              className="code-input"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="0000"
              maxLength={4}
              autoFocus
            />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button className="btn btn-primary btn-lg" type="submit" disabled={loading || code.length < 4}>
            {loading ? 'Checking...' : 'Check Out'}
          </button>
        </form>
      </div>
    </div>
  )
}