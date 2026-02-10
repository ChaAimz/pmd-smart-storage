import { createContext } from "react"

export interface PageContextType {
  pageTitle: string
  pageDescription: string
  setPageInfo: (title: string, description?: string) => void
}

export const PageContext = createContext<PageContextType | undefined>(undefined)
