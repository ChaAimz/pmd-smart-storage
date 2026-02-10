import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  PackagePlus,
  PackageMinus,
  PackageSearch,
  Package,
  MapPin,
  TrendingUp,
  BarChart3,
  Settings,
  User,
  FileText
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Small } from '@/components/ui/typography'

interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  badge?: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      {
        title: 'Dashboard',
        href: '/',
        icon: LayoutDashboard,
      },
    ]
  },
  {
    title: 'Warehouse Operations',
    items: [
      {
        title: 'Receive Items',
        href: '/receive',
        icon: PackagePlus,
      },
      {
        title: 'Pick Items',
        href: '/pick',
        icon: PackageMinus,
      },
      {
        title: 'Adjust Stock',
        href: '/adjust',
        icon: PackageSearch,
      },
    ]
  },
  {
    title: 'Procurement',
    items: [
      {
        title: 'Purchase Requisitions',
        href: '/prs',
        icon: FileText,
      },
    ]
  },
  {
    title: 'Inventory Management',
    items: [
      {
        title: 'Manage Items',
        href: '/items',
        icon: Package,
      },
      {
        title: 'Manage Locations',
        href: '/locations',
        icon: MapPin,
      },
      {
        title: 'Inventory Planning',
        href: '/planning',
        icon: TrendingUp,
        badge: '12'
      },
    ]
  },
  {
    title: 'Reports & Settings',
    items: [
      {
        title: 'Analytics',
        href: '/analytics',
        icon: BarChart3,
      },
      {
        title: 'Profile',
        href: '/profile',
        icon: User,
      },
      {
        title: 'Settings',
        href: '/settings',
        icon: Settings,
      },
    ]
  }
]

interface SidebarProps {
  isCollapsed?: boolean
  isDesktopSidebar?: boolean
  isMobileOpen?: boolean
  onNavigate?: () => void
}

export function Sidebar({
  isCollapsed = false,
  isDesktopSidebar = true,
  isMobileOpen = false,
  onNavigate,
}: SidebarProps) {
  const location = useLocation()

  return (
    <aside
      className={cn(
        'fixed left-0 top-16 h-[calc(100vh-4rem)] border-r border-border bg-card/95 backdrop-blur-sm transition-all duration-300',
        isDesktopSidebar
          ? cn('z-30 translate-x-0', isCollapsed ? 'w-16' : 'w-64')
          : cn('z-50 w-[17.5rem] max-w-[85vw]', isMobileOpen ? 'translate-x-0' : '-translate-x-full')
      )}
    >
      <div className={cn('flex h-full flex-col gap-1 overflow-y-auto', isCollapsed ? 'p-2' : 'p-4')}>
        <nav className={cn('flex flex-col', isCollapsed ? 'gap-3' : 'gap-6')}>
          {navSections.map((section, sectionIndex) => (
            <div key={section.title}>
              {/* Section Title */}
              {!isCollapsed && (
                <div className="mb-2 px-3">
                  <Small className="text-xs uppercase tracking-wider text-muted-foreground">
                    {section.title}
                  </Small>
                </div>
              )}

              {/* Section Items */}
              <div className="flex flex-col gap-1">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.href
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      title={item.title}
                      onClick={onNavigate}
                      className={cn(
                        'relative flex items-center rounded-lg text-sm font-medium transition-all',
                        isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {!isCollapsed && <span className="flex-1">{item.title}</span>}
                      {!isCollapsed && item.badge && (
                        <span className={cn(
                          "px-2 py-0.5 text-xs font-semibold rounded-full",
                          isActive
                            ? "bg-primary-foreground text-primary"
                            : "bg-destructive text-destructive-foreground"
                        )}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>

              {/* Separator between sections (except last) */}
              {sectionIndex < navSections.length - 1 && (
                <div className={cn('border-t border-border', isCollapsed ? 'my-2' : 'my-3')} />
              )}
            </div>
          ))}
        </nav>

        {/* System Status at bottom */}
        <div className={cn('mt-auto border-t border-border', isCollapsed ? 'pt-2' : 'pt-4')}>
          <div className={cn('rounded-lg bg-muted/50', isCollapsed ? 'p-2' : 'p-3')}>
            <div className={cn(isCollapsed ? 'flex justify-center' : 'space-y-2')}>
              {!isCollapsed && <Small className="text-xs">System Status</Small>}
              <div className={cn('flex items-center', isCollapsed ? 'justify-center' : 'gap-2')}>
                <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                {!isCollapsed && <span className="text-xs text-muted-foreground">All systems operational</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
