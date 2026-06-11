import { useState, useEffect } from 'react'
import { api } from './auth'

export default function Dashboard() {
  const [active, setActive] = useState([])
  const [stats, setStats] = useState({ totalToday: 0, activeNow: 0, checkedOut: 0, familiesCount: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    const [activeData, statsData] = await Promise.all([
      api('/api/active'),
      api('/api/stats'),
    ])
    if (!activeData.error) setActive(activeData)
    if (!statsData.error) setStats(statsData)
    setLoading(false)
  }

  if (loading) return <div className="loading">Loading dashboard...</div>

  return (
    <div className="page">
      <h2>Dashboard</h2>
      
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-number">{stats.activeNow}</div>
          <div className="stat-label">Currently In</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.checkedOut}</div>
          <div className="stat-label">Checked Out Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.totalToday}</div>
          <div className="stat-label">Total Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.familiesCount}</div>
          <div className="stat-label">Families</div>
        </div>
      </div>

      <h3>Active Check-Ins ({active.length})</h3>
      <div className="kid-list">
        {active.length === 0 ? (
          <div className="empty-state">No kids checked in right now</div>
        ) : active.map(kid => (
          <div key={kid.id} className="kid-card">
            <div className="kid-code">{kid.code}</div>
            <div className="kid-info">
              <strong>{kid.kid_name}</strong>
              <span className="kid-details">{kid.parent_name}{kid.room ? ` · ${kid.room}` : ''}{kid.kid_age ? ` · Age ${kid.kid_age}` : ''}</span>
              <span className="kid-time">In since {new Date(kid.checked_in_at).toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}