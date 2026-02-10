import { createContext } from "react"

export interface User {
  id: number
  username: string
  fullName: string
  email: string
  role: string
  avatarUrl?: string
}

export interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)
