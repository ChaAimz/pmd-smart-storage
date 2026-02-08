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
import { Separator } from '@/components/ui/separator'

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

export function Sidebar() {
  const location = useLocation()

  return (
    <aside className="fixed left-0 top-16 z-30 h-[calc(100vh-4rem)] w-64 border-r border-border bg-card/50 backdrop-blur-sm">
      <div className="flex h-full flex-col gap-1 p-4 overflow-y-auto">
        <nav className="flex flex-col gap-6">
          {navSections.map((section, sectionIndex) => (
            <div key={section.title}>
              {/* Section Title */}
              <div className="px-3 mb-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {section.title}
                </h3>
              </div>

              {/* Section Items */}
              <div className="flex flex-col gap-1">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.href
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={cn(
                        'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1">{item.title}</span>
                      {item.badge && (
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
                <div className="my-3 border-t border-border" />
              )}
            </div>
          ))}
        </nav>

        {/* System Status at bottom */}
        <div className="mt-auto pt-4 border-t border-border">
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold">System Status</h3>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-muted-foreground">All systems operational</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}