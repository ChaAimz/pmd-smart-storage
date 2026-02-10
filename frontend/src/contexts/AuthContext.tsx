import { useState } from 'react'
import type { ReactNode } from 'react'
import * as api from '@/services/api'
import { AuthContext, type User } from '@/contexts/auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem('user')
    if (!storedUser) return null

    try {
      return JSON.parse(storedUser) as User
    } catch (error) {
      console.error('Error parsing stored user:', error)
      localStorage.removeItem('user')
      return null
    }
  })
  const [isLoading] = useState(false)

  const login = async (username: string, password: string) => {
    try {
      // Call actual API
      const response = await api.login(username, password)
      
      // Backend returns { token, user }
      const { token, user: userData } = response
      
      setUser(userData)
      localStorage.setItem('user', JSON.stringify(userData))
      localStorage.setItem('token', token) // Store token separately
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('user')
    localStorage.removeItem('token')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

