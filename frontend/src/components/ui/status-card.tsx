import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface StatusCardProps {
  title: string
  value: string | number
  description: string
  icon: LucideIcon
  className?: string
  accentClassName?: string
  valueClassName?: string
  headerRight?: ReactNode
}

export function StatusCard({
  title,
  value,
  description,
  icon: Icon,
  className,
  accentClassName,
  valueClassName,
  headerRight,
}: StatusCardProps) {
  return (
    <Card className={cn('border-border/70 bg-white/90 dark:border-border/60 dark:bg-background/70', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardDescription className={cn('flex items-center gap-2 text-slate-700 dark:text-slate-300', accentClassName)}>
            <Icon className="h-4 w-4" />
            {title}
          </CardDescription>
          {headerRight}
        </div>
        <CardTitle className={cn('text-2xl', valueClassName)}>{value}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 text-xs text-muted-foreground">
        {description}
      </CardContent>
    </Card>
  )
}
