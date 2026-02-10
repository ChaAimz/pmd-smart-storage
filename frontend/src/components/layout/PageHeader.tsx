import type { ComponentType, ReactNode } from 'react'
import type { LucideProps } from 'lucide-react'
import { H1, Lead } from '@/components/ui/typography'

interface PageHeaderProps {
  icon?: ComponentType<LucideProps>
  title: string
  description?: string
  actions?: ReactNode
  badge?: ReactNode
}

export function PageHeader({ icon: Icon, title, description, actions, badge }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-6 w-6 text-muted-foreground" />}
          <H1 className="text-3xl">{title}</H1>
          {badge}
        </div>
        {description && (
          <Lead>{description}</Lead>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
