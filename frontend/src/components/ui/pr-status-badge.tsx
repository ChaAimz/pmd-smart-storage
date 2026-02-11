import { CheckCircle2, Clock3, Timer, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getPrStatusBadgeClassName, getPrStatusIconKey, getPrStatusLabel, type PRStatusIconKey } from '@/lib/pr-status'

interface PRStatusBadgeProps {
  status?: string | null
  className?: string
  showIcon?: boolean
  iconClassName?: string
}

export function PRStatusBadge({
  status,
  className,
  showIcon = false,
  iconClassName,
}: PRStatusBadgeProps) {
  const label = getPrStatusLabel(status)
  const iconKey = getPrStatusIconKey(status)

  const renderIcon = (key: PRStatusIconKey) => {
    const iconClass = cn('h-3.5 w-3.5', iconClassName)
    switch (key) {
      case 'timer':
        return <Timer className={iconClass} />
      case 'check':
        return <CheckCircle2 className={iconClass} />
      case 'x':
        return <XCircle className={iconClass} />
      case 'clock':
      default:
        return <Clock3 className={iconClass} />
    }
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 border-0 font-medium',
        getPrStatusBadgeClassName(status),
        className
      )}
    >
      {showIcon ? renderIcon(iconKey) : null}
      {label}
    </Badge>
  )
}
