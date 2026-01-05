import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

const AuthContext = createContext()

export const useAuth = () => useContext(AuthContext)

const API_BASE_URL = import.meta.env.PROD
  ? import.meta.env.VITE_API_URL || ''
  : `http://${import.meta.env.VITE_API_HOST || 'localhost'}:${import.meta.env.VITE_API_PORT || 3000}`

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('auth_token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('auth_token')
      if (storedToken) {
        try {
          const response = await axios.get(`${API_BASE_URL}/api/auth/verify`, {
            headers: { Authorization: `Bearer ${storedToken}` }
          })
          if (response.data.success) {
            setUser(response.data.user)
            setToken(storedToken)
          } else {
            // Token invalid, clear it
            localStorage.removeItem('auth_token')
            setToken(null)
            setUser(null)
          }
        } catch (error) {
          // Token verification failed, clear it silently
          localStorage.removeItem('auth_token')
          setToken(null)
          setUser(null)
        }
      }
      setLoading(false)
    }
    
    initAuth()
  }, [])

  const login = async (username, password) => {
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, { username, password })
    if (response.data.success) {
      setToken(response.data.token)
      setUser(response.data.user)
      localStorage.setItem('auth_token', response.data.token)
    }
    return response.data
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('auth_token')
    toast.success('Logged out successfully')
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

