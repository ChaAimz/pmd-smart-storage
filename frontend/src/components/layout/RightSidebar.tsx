import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  PackagePlus,
  PackageMinus,
  Activity,
  ShoppingCart,
  Zap,
  Wifi,
  WifiOff,
  Circle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Small } from '@/components/ui/typography'

interface RightSidebarProps {
  className?: string
  onExpandChange?: (isExpanded: boolean) => void
}

export function RightSidebar({ className, onExpandChange }: RightSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const handleToggle = () => {
    const newState = !isExpanded
    setIsExpanded(newState)
    onExpandChange?.(newState)
  }

  // Mock BLE Mesh Device data (simulate many devices)
  const bleDevices = [
    { id: 1, name: 'Gateway-01', status: 'online', battery: 100, rssi: -45 },
    { id: 2, name: 'Node-A1', status: 'online', battery: 87, rssi: -62 },
    { id: 3, name: 'Node-A2', status: 'online', battery: 92, rssi: -58 },
    { id: 4, name: 'Node-B1', status: 'offline', battery: 45, rssi: -85 },
    { id: 5, name: 'Node-B2', status: 'online', battery: 78, rssi: -67 },
    { id: 6, name: 'Node-C1', status: 'online', battery: 95, rssi: -55 },
    { id: 7, name: 'Node-C2', status: 'online', battery: 88, rssi: -60 },
    { id: 8, name: 'Node-D1', status: 'offline', battery: 32, rssi: -90 },
    { id: 9, name: 'Node-D2', status: 'online', battery: 76, rssi: -68 },
    { id: 10, name: 'Node-E1', status: 'online', battery: 91, rssi: -57 },
  ]

  const onlineDevices = bleDevices.filter(d => d.status === 'online').length
  const totalDevices = bleDevices.length

  return (
    <aside
      className={cn(
        'fixed right-0 top-16 z-30 h-[calc(100vh-4rem)] border-l border-border bg-background transition-all duration-300',
        isExpanded ? 'w-80' : 'w-14',
        className
      )}
    >
      {/* Toggle Button */}
      <Button
        type="button"
        onClick={handleToggle}
        variant="outline"
        size="icon"
        className="absolute -left-3 top-6 z-40 h-6 w-6 rounded-full shadow-md"
      >
        {isExpanded ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>

      {/* Sidebar Content */}
      <div className="flex h-full flex-col overflow-y-auto">
        <AnimatePresence mode="wait">
          {isExpanded ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="p-4 space-y-6"
            >
              {/* Quick Actions */}
              <div>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <Zap className="h-4 w-4 text-primary" />
                  <Small className="text-sm">Quick Actions</Small>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Link to="/receive" className="block">
                    <Button
                      variant="outline"
                      className="w-full h-20 flex flex-col gap-2 hover:bg-green-50 dark:hover:bg-green-950/20 hover:border-green-500 transition-colors"
                    >
                      <PackagePlus className="h-6 w-6 text-green-500" />
                      <span className="text-xs font-medium">Receive</span>
                    </Button>
                  </Link>
                  <Link to="/pick" className="block">
                    <Button
                      variant="outline"
                      className="w-full h-20 flex flex-col gap-2 hover:bg-red-50 dark:hover:bg-red-950/20 hover:border-red-500 transition-colors"
                    >
                      <PackageMinus className="h-6 w-6 text-red-500" />
                      <span className="text-xs font-medium">Pick</span>
                    </Button>
                  </Link>
                  <Link to="/adjust" className="block">
                    <Button
                      variant="outline"
                      className="w-full h-20 flex flex-col gap-2 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:border-blue-500 transition-colors"
                    >
                      <Activity className="h-6 w-6 text-blue-500" />
                      <span className="text-xs font-medium">Adjust</span>
                    </Button>
                  </Link>
                  <Link to="/planning" className="block">
                    <Button
                      variant="outline"
                      className="w-full h-20 flex flex-col gap-2 hover:bg-purple-50 dark:hover:bg-purple-950/20 hover:border-purple-500 transition-colors"
                    >
                      <ShoppingCart className="h-6 w-6 text-purple-500" />
                      <span className="text-xs font-medium">Planning</span>
                    </Button>
                  </Link>
                </div>
              </div>

              {/* BLE Mesh Device Status */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-blue-500" />
                    <Small className="text-sm">BLE Mesh Devices</Small>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {onlineDevices}/{totalDevices}
                  </Badge>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-1 mb-1">
                      <Wifi className="h-3 w-3 text-green-600" />
                      <span className="text-xs font-medium text-green-600 dark:text-green-400">Online</span>
                    </div>
                    <div className="text-lg font-bold text-green-900 dark:text-green-100">{onlineDevices}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-950/20 border border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-1 mb-1">
                      <WifiOff className="h-3 w-3 text-gray-600" />
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Offline</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{totalDevices - onlineDevices}</div>
                  </div>
                </div>

                {/* Device List - Show only first 5 with scroll */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {bleDevices.slice(0, 5).map((device) => (
                    <div
                      key={device.id}
                      className="p-2.5 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          {device.status === 'online' ? (
                            <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                          ) : (
                            <Circle className="h-2 w-2 fill-gray-400 text-gray-400" />
                          )}
                          <span className="text-xs font-medium">{device.name}</span>
                        </div>
                        <Badge
                          variant={device.status === 'online' ? 'default' : 'secondary'}
                          className="text-[10px] h-4 px-1.5"
                        >
                          {device.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>🔋 {device.battery}%</span>
                        <span>📶 {device.rssi} dBm</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* View All Button */}
                {bleDevices.length > 5 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3 text-xs"
                  >
                    View All ({bleDevices.length})
                  </Button>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="p-2 space-y-4 mt-16"
            >
              {/* Collapsed Icons */}
              <Link to="/receive">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10 hover:bg-green-500/10"
                  title="Receive Items"
                >
                  <PackagePlus className="h-5 w-5 text-green-500" />
                </Button>
              </Link>
              <Link to="/pick">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10 hover:bg-red-500/10"
                  title="Pick Items"
                >
                  <PackageMinus className="h-5 w-5 text-red-500" />
                </Button>
              </Link>
              <Link to="/adjust">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10 hover:bg-blue-500/10"
                  title="Adjust Stock"
                >
                  <Activity className="h-5 w-5 text-blue-500" />
                </Button>
              </Link>
              <Link to="/planning">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10 hover:bg-purple-500/10"
                  title="Planning"
                >
                  <ShoppingCart className="h-5 w-5 text-purple-500" />
                </Button>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  )
}
