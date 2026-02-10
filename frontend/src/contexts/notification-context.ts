import { createContext } from "react"

export interface Notification {
  id: number
  type: string
  title: string
  message: string
  data: Record<string, unknown> | null
  link: string
  is_read: boolean
  created_at: string
}

export interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  fetchNotifications: () => Promise<void>
  markAsRead: (id: number) => Promise<void>
  markAllAsRead: () => Promise<void>
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined)
