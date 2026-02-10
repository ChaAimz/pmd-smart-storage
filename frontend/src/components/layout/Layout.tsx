import { useEffect, useState } from 'react'
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('sidebar-collapsed') === 'true'
  })
  const [isRightSidebarExpanded, setIsRightSidebarExpanded] = useState(true)
  const [isDesktopSidebar, setIsDesktopSidebar] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= 1024
  })
  const [isCompactDesktop, setIsCompactDesktop] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth >= 1024 && (window.innerWidth <= 1280 || window.innerHeight <= 720)
  })
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  usePageContext()

  useEffect(() => {
    const onResize = () => {
      const desktop = window.innerWidth >= 1024
      const compactDesktop = window.innerWidth >= 1024 && (window.innerWidth <= 1280 || window.innerHeight <= 720)
      setIsDesktopSidebar(desktop)
      setIsCompactDesktop(compactDesktop)
      if (desktop) setIsMobileSidebarOpen(false)
      if (desktop && compactDesktop) setIsSidebarCollapsed(true)
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (isDesktopSidebar && isCompactDesktop) {
      setIsSidebarCollapsed(true)
    }
  }, [isDesktopSidebar, isCompactDesktop])

  const handleSidebarToggle = () => {
    if (!isDesktopSidebar) {
      setIsMobileSidebarOpen((prev) => !prev)
      return
    }
    setIsSidebarCollapsed((prev) => {
      const next = !prev
      window.localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  const handleSidebarNavigate = () => {
    if (!isDesktopSidebar) {
      setIsMobileSidebarOpen(false)
    }
  }

  // Calculate margin-right based on sidebar state
  const getMarginRight = () => {
    if (!isDashboard) return ''
    return isRightSidebarExpanded ? 'lg:mr-80' : 'lg:mr-14'
  }

  const mainPaddingClass = isFullContentPage
    ? 'p-0'
    : 'px-2.5 pt-2.5 pb-1.5 lg:px-3.5 lg:pt-3.5 lg:pb-2.5'
  const mainHeightClass = isFullContentPage ? 'h-[calc(100dvh-4rem)] min-h-0 overflow-hidden' : ''
  const effectiveSidebarCollapsed = isDesktopSidebar ? (isCompactDesktop ? true : isSidebarCollapsed) : false

  return (
    <div className={`relative min-h-screen bg-background ${isFullContentPage ? 'h-screen overflow-hidden' : ''}`}>
      <Header
        isSidebarCollapsed={effectiveSidebarCollapsed}
        isDesktopSidebar={isDesktopSidebar}
        onSidebarToggle={handleSidebarToggle}
      />
      <Sidebar
        isCollapsed={effectiveSidebarCollapsed}
        isDesktopSidebar={isDesktopSidebar}
        isMobileOpen={isMobileSidebarOpen}
        onNavigate={handleSidebarNavigate}
      />
      {!isDesktopSidebar && isMobileSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 top-16 z-40 bg-black/35 backdrop-blur-[1px]"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}
      {isDashboard && <RightSidebar onExpandChange={setIsRightSidebarExpanded} />}
      <main
        className={`${isDesktopSidebar ? (effectiveSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64') : 'ml-0'} mt-16 transition-all duration-300 ${getMarginRight()} ${mainPaddingClass} ${mainHeightClass}`}
      >
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
