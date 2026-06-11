import { useState, useEffect } from 'react'
import { api } from './auth'

export default function CheckIn() {
  const [families, setFamilies] = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('family') // family | guest
  const [selectedFamily, setSelectedFamily] = useState(null)
  const [selectedChildren, setSelectedChildren] = useState([])
  const [room, setRoom] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  // Guest mode fields
  const [guestParent, setGuestParent] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestKid, setGuestKid] = useState('')
  const [guestAge, setGuestAge] = useState('')

  useEffect(() => {
    api('/api/families').then(data => {
      if (!data.error) setFamilies(data)
      setLoading(false)
    })
  }, [])

  const toggleChild = (childId) => {
    setSelectedChildren(prev => 
      prev.includes(childId) ? prev.filter(id => id !== childId) : [...prev, childId]
    )
  }

  const handleFamilyCheckin = async () => {
    if (!selectedFamily || selectedChildren.length === 0) return
    setError('')
    const data = await api('/api/checkin', {
      method: 'POST',
      body: JSON.stringify({ family_id: selectedFamily, child_ids: selectedChildren, room })
    })
    if (data.error) return setError(data.error)
    setResult(data)
  }

  const handleGuestCheckin = async (e) => {
    e.preventDefault()
    if (!guestParent || !guestKid) return
    setError('')
    const data = await api('/api/checkin/guest', {
      method: 'POST',
      body: JSON.stringify({ parent_name: guestParent, phone: guestPhone, kid_name: guestKid, kid_age: guestAge, room })
    })
    if (data.error) return setError(data.error)
    setResult(data)
  }

  if (result) {
    const isFamily = result.checkins
    return (
      <div className="checkin-success">
        <div className="success-icon">✓</div>
        {isFamily ? (
          <>
            <h2>{result.familyName}</h2>
            <p className="text-muted">{result.message}</p>
            {result.checkins.map((c, i) => (
              <div key={i} className="code-pair">
                <span>{c.childName}</span>
                <div className="code-display-sm">{c.code}</div>
              </div>
            ))}
            {result.phone && <p className="text-hint">Codes sent via text to {result.phone}</p>}
          </>
        ) : (
          <>
            <h2>{result.kid_name} is checked in!</h2>
            <div className="code-display">{result.code}</div>
            <p className="code-label">Show this code at pickup</p>
          </>
        )}
        <button className="btn btn-primary btn-lg" onClick={() => { setResult(null); setSelectedFamily(null); setSelectedChildren([]); setGuestParent(''); setGuestKid(''); }}>
          Check In Another
        </button>
      </div>
    )
  }

  return (
    <div className="page">
      <h2>Check In</h2>

      <div className="mode-toggle">
        <button className={`mode-btn ${mode === 'family' ? 'active' : ''}`} onClick={() => setMode('family')}>
          Registered Family
        </button>
        <button className={`mode-btn ${mode === 'guest' ? 'active' : ''}`} onClick={() => setMode('guest')}>
          Guest / First Visit
        </button>
      </div>

      {mode === 'family' && (
        <div className="card">
          {loading ? <p className="text-muted">Loading families...</p> : families.length === 0 ? (
            <div className="empty-state">
              No families registered yet. Use "Guest" mode or add families from the Families page.
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>Select Family</label>
                <select value={selectedFamily || ''} onChange={e => { setSelectedFamily(parseInt(e.target.value)); setSelectedChildren([]) }}>
                  <option value="">-- Choose family --</option>
                  {families.map(f => (
                    <option key={f.id} value={f.id}>{f.parent_name} {f.phone ? `(${f.phone})` : ''}</option>
                  ))}
                </select>
              </div>

              {selectedFamily && (
                <>
                  <div className="form-group">
                    <label>Room / Class</label>
                    <input type="text" value={room} onChange={e => setRoom(e.target.value)} placeholder="e.g. Room 3" />
                  </div>
                  
                  <label>Select Children</label>
                  <div className="child-select-list">
                    {families.find(f => f.id === selectedFamily)?.children.map(child => (
                      <label key={child.id} className="child-checkbox">
                        <input type="checkbox" checked={selectedChildren.includes(child.id)}
                          onChange={() => toggleChild(child.id)} />
                        <span>{child.name}</span>
                        {child.age && <span className="text-muted">Age {child.age}</span>}
                      </label>
                    ))}
                  </div>

                  {error && <div className="error-msg">{error}</div>}
                  <button className="btn btn-primary btn-lg" 
                    onClick={handleFamilyCheckin} 
                    disabled={selectedChildren.length === 0}>
                    Check In {selectedChildren.length > 0 ? `(${selectedChildren.length} child${selectedChildren.length > 1 ? 'ren' : ''})` : ''}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}

      {mode === 'guest' && (
        <div className="card">
          <form onSubmit={handleGuestCheckin}>
            <div className="form-group">
              <label>Your Name *</label>
              <input type="text" value={guestParent} onChange={e => setGuestParent(e.target.value)} required autoFocus />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="For text notifications" />
            </div>
            <div className="form-group">
              <label>Child's Name *</label>
              <input type="text" value={guestKid} onChange={e => setGuestKid(e.target.value)} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Age</label>
                <input type="text" value={guestAge} onChange={e => setGuestAge(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Room</label>
                <input type="text" value={room} onChange={e => setRoom(e.target.value)} />
              </div>
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button className="btn btn-primary btn-lg" type="submit">
              Check In
            </button>
          </form>
        </div>
      )}
    </div>
  )
}