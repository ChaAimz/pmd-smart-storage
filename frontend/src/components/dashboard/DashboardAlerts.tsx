import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import * as api from '@/services/api';
import { 
  Package, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  ShoppingCart 
} from 'lucide-react';

interface Alert {
  type: 'delivery' | 'overdue' | 'approval' | 'low_stock';
  title: string;
  message: string;
  data: any;
}

export function DashboardAlerts() {
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const checkAlerts = async () => {
    try {
      const response = await api.get('/dashboard/alerts');
      if (!response.success) return;

      const { data } = response;

      // Check deliveries today
      const todayDeliveries = data.upcomingDeliveries.filter(
        (d: any) => d.urgency === 'today'
      );
      
      if (todayDeliveries.length > 0) {
        toast.info(
          `📦 มี ${todayDeliveries.length} รายการที่ต้องรับของวันนี้`,
          {
            description: todayDeliveries.map((d: any) => d.pr_number).join(', '),
            duration: 10000
          }
        );
      }

      // Check overdue
      if (data.overdueDeliveries.length > 0) {
        toast.error(
          `⏰ ${data.overdueDeliveries.length} รายการเลยกำหนดรับของ`,
          {
            description: data.overdueDeliveries.map((d: any) => 
              `${d.pr_number} (${Math.floor(d.days_overdue)} วัน)`
            ).join(', '),
            duration: 0
          }
        );
      }

      // Check pending approvals
      if (data.pendingApprovals.length > 0) {
        toast.warning(
          `📝 รออนุมัติ ${data.pendingApprovals.length} PR`,
          {
            action: {
              label: 'อนุมัติ',
              onClick: () => window.location.href = '/prs?status=pending'
            }
          }
        );
      }

      // Check critical stock
      const criticalStock = data.lowStockItems.filter(
        (i: any) => i.urgency === 'critical'
      );
      
      if (criticalStock.length > 0) {
        toast.error(
          `⚠️ สต็อกวิกฤต ${criticalStock.length} รายการ`,
          {
            description: criticalStock.map((i: any) => i.name).join(', '),
            duration: 0
          }
        );
      }

      setLastChecked(new Date());
    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  };

  useEffect(() => {
    checkAlerts();
    const interval = setInterval(checkAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return null;
}

// Hook for manual notifications
export function useDashboardNotifications() {
  return {
    showSuccess: (message: string, description?: string) => 
      toast.success(message, { description }),
    showError: (message: string, description?: string) => 
      toast.error(message, { description }),
    showInfo: (message: string, description?: string) => 
      toast.info(message, { description }),
    showWarning: (message: string, description?: string) => 
      toast.warning(message, { description })
  };
}
