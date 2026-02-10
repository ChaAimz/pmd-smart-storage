import { useState } from 'react'
import type { ReactNode } from 'react'
import { PageContext } from '@/contexts/page-context'

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
