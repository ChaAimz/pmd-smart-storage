import { Badge } from '@/components/ui/badge'
import { getPrPriorityBadgeClassName, getPrPriorityLabel } from '@/lib/pr-priority'
import { cn } from '@/lib/utils'

interface PRPriorityBadgeProps {
  priority?: string | null
  className?: string
}

export function PRPriorityBadge({ priority, className }: PRPriorityBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn('border-0 font-medium', getPrPriorityBadgeClassName(priority), className)}
    >
      {getPrPriorityLabel(priority)}
    </Badge>
  )
}
