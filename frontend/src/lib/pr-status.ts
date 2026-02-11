export type PRStatus = 'ordered' | 'partially_received' | 'fully_received' | 'cancelled'
export type PRStatusIconKey = 'clock' | 'timer' | 'check' | 'x'

type PRStatusMeta = {
  label: string
  badgeClassName: string
  iconKey: PRStatusIconKey
}

const DEFAULT_STATUS: PRStatus = 'ordered'

const PR_STATUS_MAP: Record<PRStatus, PRStatusMeta> = {
  ordered: {
    label: 'Ordered',
    badgeClassName:
      'border-transparent bg-blue-500 text-white hover:bg-blue-500 dark:bg-blue-500 dark:text-white',
    iconKey: 'clock',
  },
  partially_received: {
    label: 'Partially Received',
    badgeClassName:
      'border-transparent bg-amber-500 text-white hover:bg-amber-500 dark:bg-amber-500 dark:text-white',
    iconKey: 'timer',
  },
  fully_received: {
    label: 'Fully Received',
    badgeClassName:
      'border-transparent bg-emerald-500 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:text-white',
    iconKey: 'check',
  },
  cancelled: {
    label: 'Cancelled',
    badgeClassName:
      'border-transparent bg-red-500 text-white hover:bg-red-500 dark:bg-red-500 dark:text-white',
    iconKey: 'x',
  },
}

export const normalizePrStatus = (status?: string | null): PRStatus => {
  const normalized = (status || '').toLowerCase().trim()
  if (normalized in PR_STATUS_MAP) {
    return normalized as PRStatus
  }
  return DEFAULT_STATUS
}

export const getPrStatusMeta = (status?: string | null): PRStatusMeta => {
  return PR_STATUS_MAP[normalizePrStatus(status)]
}

export const getPrStatusLabel = (status?: string | null): string => {
  return getPrStatusMeta(status).label
}

export const getPrStatusBadgeClassName = (status?: string | null): string => {
  return getPrStatusMeta(status).badgeClassName
}

export const getPrStatusIconKey = (status?: string | null): PRStatusIconKey => {
  return getPrStatusMeta(status).iconKey
}

export const isPrReceivable = (status?: string | null): boolean => {
  const normalized = normalizePrStatus(status)
  return normalized === 'ordered' || normalized === 'partially_received'
}
