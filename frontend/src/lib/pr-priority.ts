export type PRPriority = 'low' | 'normal' | 'high' | 'urgent'

type PRPriorityMeta = {
  label: string
  badgeClassName: string
}

const DEFAULT_PRIORITY: PRPriority = 'normal'

const PR_PRIORITY_MAP: Record<PRPriority, PRPriorityMeta> = {
  low: {
    label: 'Low',
    badgeClassName:
      'border-transparent bg-slate-500 text-white hover:bg-slate-500 dark:bg-slate-500 dark:text-white',
  },
  normal: {
    label: 'Normal',
    badgeClassName:
      'border-transparent bg-emerald-500 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:text-white',
  },
  high: {
    label: 'High',
    badgeClassName:
      'border-transparent bg-red-500 text-white hover:bg-red-500 dark:bg-red-500 dark:text-white',
  },
  urgent: {
    label: 'Urgent',
    badgeClassName:
      'border-transparent bg-red-700 text-white hover:bg-red-700 dark:bg-red-700 dark:text-white',
  },
}

export const normalizePrPriority = (priority?: string | null): PRPriority => {
  const normalized = (priority || '').toLowerCase().trim()
  if (normalized in PR_PRIORITY_MAP) {
    return normalized as PRPriority
  }
  return DEFAULT_PRIORITY
}

export const getPrPriorityMeta = (priority?: string | null): PRPriorityMeta => {
  return PR_PRIORITY_MAP[normalizePrPriority(priority)]
}

export const getPrPriorityLabel = (priority?: string | null): string => {
  return getPrPriorityMeta(priority).label
}

export const getPrPriorityBadgeClassName = (priority?: string | null): string => {
  return getPrPriorityMeta(priority).badgeClassName
}
