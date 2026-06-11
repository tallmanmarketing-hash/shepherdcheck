import { useState, useEffect } from 'react'
import { api } from './auth'

const quickMessages = [
  'Your child is asking for you — please come to the kids area.',
  'Everything is fine! Just a quick check-in question about your child.',
  'Service is ending soon — please pick up your child.',
  'Your child is ready for pickup.',
]

export default function StaffPage() {
  const [active, setActive] = useState([])
  const [selectedKid, setSelectedKid] = useState(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/api/active').then(data => { if (!data.error) setActive(data) })
  }, [])

  const handleSend = async () => {
    if (!selectedKid || !message.trim()) return
    setSending(true)
    setError('')
    setSent(null)
    
    const data = await api('/api/text-parent', {
      method: 'POST',
      body: JSON.stringify({ checkin_id: selectedKid.id, message: message.trim() })
    })
    
    if (data.error) {
      setError(data.error)
    } else {
      setSent(`Message sent to ${selectedKid.parent_name}`)
      setMessage('')
      setSelectedKid(null)
    }
    setSending(false)
  }

  return (
    <div className="page">
      <h2>Staff: Text a Parent</h2>
      
      {sent && <div className="success-banner">{sent}</div>}
      {error && <div className="error-msg">{error}</div>}

      {!selectedKid ? (
        <>
          <p className="text-muted">Select a child to send a message to their parent:</p>
          <div className="kid-list">
            {active.length === 0 ? (
              <div className="empty-state">No kids currently checked in</div>
            ) : active.map(kid => (
              <div key={kid.id} className="kid-card clickable" onClick={() => setSelectedKid(kid)}>
                <div className="kid-code">{kid.code}</div>
                <div className="kid-info">
                  <strong>{kid.kid_name}</strong>
                  <span className="kid-details">{kid.parent_name}{kid.phone || kid.family_phone ? ` · ${kid.phone || kid.family_phone}` : ' · No phone'}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="card">
          <div className="selected-parent">
            <button className="btn-back" onClick={() => setSelectedKid(null)}>← Back</button>
            <strong>Texting {selectedKid.parent_name}</strong>
            <span className="text-muted">about {selectedKid.kid_name} ({(selectedKid.phone || selectedKid.family_phone) || 'No phone number'})</span>
          </div>

          {(selectedKid.phone || selectedKid.family_phone) ? (
            <>
              <div className="quick-messages">
                <p className="text-muted">Quick messages:</p>
                <div className="quick-btns">
                  {quickMessages.map((msg, i) => (
                    <button key={i} className="btn-quick" onClick={() => setMessage(msg)}>
                      {msg}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Your message:</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Type your message..." />
              </div>

              <button className="btn btn-primary" onClick={handleSend} disabled={sending || !message.trim()}>
                {sending ? 'Sending...' : 'Send Text Message'}
              </button>
            </>
          ) : (
            <div className="error-msg">No phone number on file for this parent.</div>
          )}
        </div>
      )}
    </div>
  )
}