import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { RightSidebar } from './RightSidebar'

import { PageProvider, usePageContext } from '@/contexts/PageContext'

function LayoutContent() {
  const location = useLocation()
  const isDashboard = location.pathname === '/'
  const isReceivePage = location.pathname === '/receive'
  const [isRightSidebarExpanded, setIsRightSidebarExpanded] = useState(true)
  const { pageTitle, pageDescription } = usePageContext()

  // Calculate margin-right based on sidebar state
  const getMarginRight = () => {
    if (!isDashboard) return ''
    return isRightSidebarExpanded ? 'mr-80' : 'mr-14'
  }

  return (
    <div className={`relative min-h-screen bg-background ${isReceivePage ? 'h-screen overflow-hidden' : ''}`}>
      <Header pageTitle={pageTitle} pageDescription={pageDescription} />
      <Sidebar />
      {isDashboard && <RightSidebar onExpandChange={setIsRightSidebarExpanded} />}
      <main className={`ml-64 mt-16 p-8 transition-all duration-300 ${getMarginRight()} ${isReceivePage ? 'h-[calc(100dvh-4rem)] min-h-0 overflow-hidden' : ''}`}>
        <Outlet />
      </main>

    </div>
  )
}

export function Layout() {
  return (
    <PageProvider>
      <LayoutContent />
    </PageProvider>
  )
}
