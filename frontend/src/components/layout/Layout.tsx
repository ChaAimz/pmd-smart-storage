import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { RightSidebar } from './RightSidebar'

import { PageProvider, usePageContext } from '@/contexts/PageContext'

function LayoutContent() {
  const location = useLocation()
  const isDashboard = location.pathname === '/'
  const fullContentRoutes = ['/receive', '/pick', '/adjust', '/items', '/planning']
  const isFullContentPage = fullContentRoutes.includes(location.pathname)
  const [isRightSidebarExpanded, setIsRightSidebarExpanded] = useState(true)
  const { pageTitle, pageDescription } = usePageContext()

  // Calculate margin-right based on sidebar state
  const getMarginRight = () => {
    if (!isDashboard) return ''
    return isRightSidebarExpanded ? 'mr-80' : 'mr-14'
  }

  const mainPaddingClass = isFullContentPage
    ? 'p-0'
    : 'px-2.5 pt-2.5 pb-1.5 lg:px-3.5 lg:pt-3.5 lg:pb-2.5'
  const mainHeightClass = isFullContentPage ? 'h-[calc(100dvh-4rem)] min-h-0 overflow-hidden' : ''

  return (
    <div className={`relative min-h-screen bg-background ${isFullContentPage ? 'h-screen overflow-hidden' : ''}`}>
      <Header pageTitle={pageTitle} pageDescription={pageDescription} />
      <Sidebar />
      {isDashboard && <RightSidebar onExpandChange={setIsRightSidebarExpanded} />}
      <main className={`ml-64 mt-16 transition-all duration-300 ${getMarginRight()} ${mainPaddingClass} ${mainHeightClass}`}>
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
