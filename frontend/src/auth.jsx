import { useState, useEffect, createContext, useContext } from 'react'

const API = ''  

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

export function api(path, options = {}) {
  const token = localStorage.getItem('sc_token')
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`
  
  return fetch(`${API}${path}`, { ...options, headers }).then(res => res.json())
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('sc_token')
    if (token) {
      api('/api/me').then(data => {
        if (data.error) {
          localStorage.removeItem('sc_token')
        } else {
          setUser(data)
        }
        setLoading(false)
      }).catch(() => {
        localStorage.removeItem('sc_token')
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    const data = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
    if (data.token) {
      localStorage.setItem('sc_token', data.token)
      setUser(data.user)
    }
    return data
  }

  const signup = async (church_name, email, password, phone) => {
    return api('/api/signup', {
      method: 'POST',
      body: JSON.stringify({ church_name, email, password, phone })
    })
  }

  const logout = () => {
    localStorage.removeItem('sc_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}