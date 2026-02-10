import { toast } from "sonner"

export function useDashboardNotifications() {
  return {
    showSuccess: (message: string, description?: string) =>
      toast.success(message, { description }),
    showError: (message: string, description?: string) =>
      toast.error(message, { description }),
    showInfo: (message: string, description?: string) =>
      toast.info(message, { description }),
    showWarning: (message: string, description?: string) =>
      toast.warning(message, { description }),
  }
}
