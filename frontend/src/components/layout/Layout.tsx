import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { RightSidebar } from './RightSidebar'
import { Toaster } from '@/components/ui/toaster'
import { PageProvider, usePageContext } from '@/contexts/PageContext'

function LayoutContent() {
  const location = useLocation()
  const isDashboard = location.pathname === '/'
  const [isRightSidebarExpanded, setIsRightSidebarExpanded] = useState(true)
  const { pageTitle, pageDescription } = usePageContext()

  // Calculate margin-right based on sidebar state
  const getMarginRight = () => {
    if (!isDashboard) return ''
    return isRightSidebarExpanded ? 'mr-80' : 'mr-14'
  }

  return (
    <div className="relative min-h-screen bg-background">
      <Header pageTitle={pageTitle} pageDescription={pageDescription} />
      <Sidebar />
      {isDashboard && <RightSidebar onExpandChange={setIsRightSidebarExpanded} />}
      <main className={`ml-64 mt-16 p-8 transition-all duration-300 ${getMarginRight()}`}>
        <Outlet />
      </main>
      <Toaster />
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