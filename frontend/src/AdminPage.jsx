import { useState, useEffect } from 'react'
import { api } from './auth'

export default function AdminPage() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionMsg, setActionMsg] = useState('')

  useEffect(() => { loadTenants() }, [])

  const loadTenants = async () => {
    const data = await api('/api/admin/tenants')
    if (!data.error) setTenants(data)
    else setActionMsg('Error loading churches: ' + data.error)
    setLoading(false)
  }

  const approve = async (id, name) => {
    const data = await api(`/api/admin/tenants/${id}/approve`, { method: 'POST' })
    if (data.success) {
      setActionMsg(`✅ ${name} activated!`)
      loadTenants()
    }
  }

  const suspend = async (id, name) => {
    const data = await api(`/api/admin/tenants/${id}/suspend`, { method: 'POST' })
    if (data.success) {
      setActionMsg(`⛔ ${name} suspended`)
      loadTenants()
    }
  }

  if (loading) return <div className="loading">Loading churches...</div>

  const pending = tenants.filter(t => t.status === 'pending')
  const active = tenants.filter(t => t.status === 'active')
  const suspended = tenants.filter(t => t.status === 'suspended')

  return (
    <div className="page">
      <h2>Admin: Church Management</h2>

      {actionMsg && <div className="success-banner">{actionMsg}</div>}

      {pending.length > 0 && (
        <>
          <h3>Pending Approval ({pending.length})</h3>
          <div className="tenant-list">
            {pending.map(t => (
              <div key={t.id} className="tenant-card pending">
                <div className="tenant-info">
                  <strong>{t.name}</strong>
                  <span className="text-muted">{t.email} · Signed up {new Date(t.created_at).toLocaleDateString()}</span>
                </div>
                <div className="tenant-actions">
                  <button className="btn-approve" onClick={() => approve(t.id, t.name)}>Approve</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {active.length > 0 && (
        <>
          <h3>Active Churches ({active.length})</h3>
          <div className="tenant-list">
            {active.map(t => (
              <div key={t.id} className="tenant-card active">
                <div className="tenant-info">
                  <strong>{t.name}</strong>
                  <span className="text-muted">{t.email} · {t.staffCount} staff</span>
                </div>
                <div className="tenant-actions">
                  <button className="btn-suspend" onClick={() => suspend(t.id, t.name)}>Suspend</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {suspended.length > 0 && (
        <>
          <h3>Suspended ({suspended.length})</h3>
          <div className="tenant-list">
            {suspended.map(t => (
              <div key={t.id} className="tenant-card suspended">
                <div className="tenant-info">
                  <strong>{t.name}</strong>
                  <span className="text-muted">{t.email}</span>
                </div>
                <div className="tenant-actions">
                  <button className="btn-approve" onClick={() => approve(t.id, t.name)}>Reactivate</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tenants.length === 0 && <div className="empty-state">No churches registered yet.</div>}
    </div>
  )
}