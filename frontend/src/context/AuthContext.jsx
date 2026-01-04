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
    if (token) {
      verifyToken()
    } else {
      setLoading(false)
    }
  }, [])

  const verifyToken = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.data.success) {
        setUser(response.data.user)
      }
    } catch (error) {
      logout()
    } finally {
      setLoading(false)
    }
  }

  const login = async (username, password) => {
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, { username, password })
    return response.data
  }

  const verifyOTP = async (otpToken, otp) => {
    const response = await axios.post(`${API_BASE_URL}/api/auth/verify-otp`, { otpToken, otp })
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
    <AuthContext.Provider value={{ user, token, loading, login, verifyOTP, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

