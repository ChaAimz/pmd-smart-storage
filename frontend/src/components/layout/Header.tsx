import { Bell, User, LogOut, Settings as SettingsIcon, Package } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { H3, Muted } from '@/components/ui/typography'
import { useAuth } from '@/contexts/AuthContext'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const PATH_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/receive': 'Receive Items',
  '/pick': 'Pick Items',
  '/adjust': 'Adjust Stock',
  '/items': 'Manage Items',
  '/locations': 'Manage Locations',
  '/planning': 'Inventory Planning',
  '/analytics': 'Analytics',
  '/profile': 'Profile',
  '/settings': 'Settings',
  '/prs': 'Purchase Requisitions',
  '/prs/create': 'Create PR',
}

const segmentTitle = (segment: string) =>
  segment
    .split('-')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ')

const getCurrentPageLabel = (pathname: string) => {
  if (PATH_LABELS[pathname]) return PATH_LABELS[pathname]

  const segments = pathname.split('/').filter(Boolean)
  if (segments.length >= 2 && segments[0] === 'prs' && /^\d+$/.test(segments[1])) {
    if (segments[2] === 'receive') return 'PR Receive'
    return 'PR Detail'
  }

  const lastSegment = segments[segments.length - 1]
  return lastSegment ? segmentTitle(lastSegment) : 'Dashboard'
}

const toTitleCase = (value: string) =>
  value
    .split(/[_\s-]+/)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ')

interface HeaderProps {
  isSidebarCollapsed: boolean
  isDesktopSidebar: boolean
  onSidebarToggle: () => void
}

export function Header({ isSidebarCollapsed, isDesktopSidebar, onSidebarToggle }: HeaderProps) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const department = (user as { department?: string } | null)?.department
  const departmentLabel = toTitleCase(department || user?.role || 'General')
  const currentPageLabel = getCurrentPageLabel(location.pathname)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="fixed top-0 z-40 isolate w-full border-b border-border bg-gradient-to-b from-background/92 to-muted/58 backdrop-blur-2xl supports-[backdrop-filter]:from-background/70 supports-[backdrop-filter]:to-muted/38">
      <div
        className={`grid h-16 items-center transition-[grid-template-columns] duration-300 ${
          !isDesktopSidebar
            ? 'grid-cols-[auto_minmax(0,1fr)_auto]'
            : isSidebarCollapsed
              ? 'grid-cols-[4rem_minmax(0,1fr)_auto]'
              : 'grid-cols-[16rem_minmax(0,1fr)_auto]'
        }`}
      >
        <div
          className={`flex items-center ${
            !isDesktopSidebar ? 'px-3' : isSidebarCollapsed ? 'justify-center px-2' : 'gap-4 px-6'
          }`}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Toggle sidebar"
            onClick={onSidebarToggle}
            className="h-auto items-center gap-2 rounded-lg px-0 outline-none transition-opacity hover:bg-transparent hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Package className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className={!isDesktopSidebar || isSidebarCollapsed ? 'hidden' : ''}>
              <H3 className="text-xl">Smart Storage</H3>
              <Muted className="text-xs">Inventory Management</Muted>
            </div>
          </Button>
        </div>

        <div className={`min-w-0 ${isDesktopSidebar ? 'pl-3.5' : 'px-2'}`}>
          <Breadcrumb>
            <BreadcrumbList className="truncate text-xs font-medium sm:text-sm">
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="truncate">{departmentLabel}</BreadcrumbPage>
              </BreadcrumbItem>
              <BreadcrumbSeparator>/</BreadcrumbSeparator>
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="truncate">{currentPageLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className={`flex items-center gap-1.5 ${isDesktopSidebar ? 'pr-6' : 'pr-3 sm:gap-2'}`}>
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 sm:h-10 sm:w-10" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                <Badge
                  variant="destructive"
                  className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
                >
                  3
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex-col items-start gap-1 py-3">
                <div className="flex items-center gap-2">
                  <Badge variant="warning" className="text-xs">Low Stock</Badge>
                  <span className="text-xs text-muted-foreground">5 min ago</span>
                </div>
                <p className="text-sm">Item SKU-123 is running low on stock</p>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex-col items-start gap-1 py-3">
                <div className="flex items-center gap-2">
                  <Badge variant="success" className="text-xs">Completed</Badge>
                  <span className="text-xs text-muted-foreground">15 min ago</span>
                </div>
                <p className="text-sm">Stock adjustment completed for 12 items</p>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex-col items-start gap-1 py-3">
                <div className="flex items-center gap-2">
                  <Badge variant="info" className="text-xs">Info</Badge>
                  <span className="text-xs text-muted-foreground">1 hour ago</span>
                </div>
                <p className="text-sm">New items received at Location A-01</p>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 gap-2 px-1.5 sm:h-10 sm:px-2" aria-label="User menu">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatarUrl} alt={user?.fullName} />
                  <AvatarFallback>
                    {user?.fullName?.split(' ').map(n => n[0]).join('') || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col items-start text-left">
                  <span className="text-sm font-medium">{user?.fullName}</span>
                  <span className="text-xs text-muted-foreground">{user?.role}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user?.fullName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <SettingsIcon className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
