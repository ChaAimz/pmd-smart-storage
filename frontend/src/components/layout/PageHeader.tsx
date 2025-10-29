import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { LucideProps } from 'lucide-react'

interface PageHeaderProps {
  icon?: React.ComponentType<LucideProps>
  title: string
  description?: string
  actions?: ReactNode
  badge?: ReactNode
}

export function PageHeader({ icon: Icon, title, description, actions, badge }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                {badge}
              </div>
              {description && (
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              )}
            </div>
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </motion.div>
  )
}

