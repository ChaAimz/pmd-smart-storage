import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

interface PageContextType {
  pageTitle: string
  pageDescription: string
  setPageInfo: (title: string, description?: string) => void
}

const PageContext = createContext<PageContextType | undefined>(undefined)

export function PageProvider({ children }: { children: ReactNode }) {
  const [pageTitle, setPageTitle] = useState('')
  const [pageDescription, setPageDescription] = useState('')

  const setPageInfo = (title: string, description: string = '') => {
    setPageTitle(title)
    setPageDescription(description)
  }

  return (
    <PageContext.Provider value={{ pageTitle, pageDescription, setPageInfo }}>
      {children}
    </PageContext.Provider>
  )
}

export function usePageContext() {
  const context = useContext(PageContext)
  if (context === undefined) {
    throw new Error('usePageContext must be used within a PageProvider')
  }
  return context
}
