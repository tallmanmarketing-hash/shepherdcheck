import { useState, useEffect } from 'react'
import { api } from './auth'

export default function FamiliesPage() {
  const [families, setFamilies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [parentName, setParentName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [childName, setChildName] = useState('')
  const [childAge, setChildAge] = useState('')
  const [childAllergies, setChildAllergies] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { loadFamilies() }, [])

  const loadFamilies = async () => {
    setLoading(true)
    const data = await api('/api/families')
    if (!data.error) setFamilies(data)
    setLoading(false)
  }

  const addFamily = async (e) => {
    e.preventDefault()
    setError('')
    const data = await api('/api/families', {
      method: 'POST',
      body: JSON.stringify({ parent_name: parentName, phone, email })
    })
    if (data.error) return setError(data.error)
    setSuccess(`${parentName} added!`)
    setParentName(''); setPhone(''); setEmail('')
    setShowAdd(false)
    loadFamilies()
    setTimeout(() => setSuccess(''), 3000)
  }

  const addChild = async (familyId) => {
    if (!childName.trim()) return
    const data = await api('/api/children', {
      method: 'POST',
      body: JSON.stringify({ family_id: familyId, name: childName, age: childAge, allergies: childAllergies })
    })
    if (!data.error) {
      setChildName(''); setChildAge(''); setChildAllergies('')
      loadFamilies()
    }
  }

  if (loading) return <div className="loading">Loading families...</div>

  return (
    <div className="page">
      <div className="page-header">
        <h2>Families</h2>
        <button className="btn btn-small" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancel' : '+ Add Family'}
        </button>
      </div>

      {success && <div className="success-banner">{success}</div>}
      {error && <div className="error-msg">{error}</div>}

      {showAdd && (
        <div className="card form-card">
          <h4>Register New Family</h4>
          <form onSubmit={addFamily}>
            <div className="form-group">
              <label>Parent Name *</label>
              <input type="text" value={parentName} onChange={e => setParentName(e.target.value)} required autoFocus />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Phone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary" type="submit">Save Family</button>
          </form>
        </div>
      )}

      <div className="family-list">
        {families.length === 0 ? (
          <div className="empty-state">No families registered yet. Add a family to get started.</div>
        ) : families.map(family => (
          <div key={family.id} className="card family-card">
            <div className="family-header" onClick={() => setExpanded(expanded === family.id ? null : family.id)}>
              <div className="family-info">
                <strong>{family.parent_name}</strong>
                <span className="text-muted">{family.phone}{family.email ? ` · ${family.email}` : ''}</span>
              </div>
              <div className="family-meta">
                <span className="badge">{family.children.length} child{family.children.length !== 1 ? 'ren' : ''}</span>
                <span className={`expand-icon ${expanded === family.id ? 'open' : ''}`}>▾</span>
              </div>
            </div>

            {expanded === family.id && (
              <div className="family-children">
                {family.children.length > 0 ? (
                  <div className="children-list">
                    {family.children.map(child => (
                      <div key={child.id} className="child-row">
                        <span className="child-name">{child.name}</span>
                        {child.age && <span className="child-detail">Age {child.age}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted">No children added yet</p>
                )}

                <div className="add-child-form">
                  <h5>Add Child</h5>
                  <div className="form-row">
                    <div className="form-group">
                      <input type="text" placeholder="Child's name" value={childName}
                        onChange={e => setChildName(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <input type="text" placeholder="Age" value={childAge}
                        onChange={e => setChildAge(e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group">
                    <input type="text" placeholder="Allergies / notes" value={childAllergies}
                      onChange={e => setChildAllergies(e.target.value)} />
                  </div>
                  <button className="btn btn-small btn-primary" onClick={() => addChild(family.id)}>
                    Add Child
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}