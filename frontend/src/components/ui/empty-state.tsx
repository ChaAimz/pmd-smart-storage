import type { LucideProps } from 'lucide-react'
import { Button } from './button'
import { Card, CardContent } from './card'
import { H3, Muted } from './typography'

interface EmptyStateProps {
  icon: React.ComponentType<LucideProps>
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
          <Icon className="h-10 w-10 text-muted-foreground" />
        </div>
        <H3 className="mb-2 text-lg">{title}</H3>
        <Muted className="mb-6 max-w-sm">{description}</Muted>
        {action && (
          <Button onClick={action.onClick}>{action.label}</Button>
        )}
      </CardContent>
    </Card>
  )
}
