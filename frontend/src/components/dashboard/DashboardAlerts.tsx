import { useEffect } from 'react';
import { toast } from 'sonner';
import * as api from '@/services/api';

interface AlertDelivery {
  urgency?: string;
  pr_number: string;
  days_overdue?: number;
}

interface AlertStockItem {
  urgency?: string;
  name: string;
}

interface DashboardAlertPayload {
  upcomingDeliveries: AlertDelivery[];
  overdueDeliveries: AlertDelivery[];
  pendingApprovals: AlertDelivery[];
  lowStockItems: AlertStockItem[];
}

export function DashboardAlerts() {
  const checkAlerts = async () => {
    try {
      const response = await api.get<DashboardAlertPayload>('/dashboard/alerts');
      if (!response.success) return;

      const data = response.data;
      if (!data) return;

      // Check deliveries today
      const todayDeliveries = data.upcomingDeliveries.filter(
        (d) => d.urgency === 'today'
      );
      
      if (todayDeliveries.length > 0) {
        toast.info(
          `📦 มี ${todayDeliveries.length} รายการที่ต้องรับของวันนี้`,
          {
            description: todayDeliveries.map((d) => d.pr_number).join(', '),
            duration: 10000
          }
        );
      }

      // Check overdue
      if (data.overdueDeliveries.length > 0) {
        toast.error(
          `⏰ ${data.overdueDeliveries.length} รายการเลยกำหนดรับของ`,
          {
            description: data.overdueDeliveries.map((d) => 
              `${d.pr_number} (${Math.floor(d.days_overdue ?? 0)} วัน)`
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
        (i) => i.urgency === 'critical'
      );
      
      if (criticalStock.length > 0) {
        toast.error(
          `⚠️ สต็อกวิกฤต ${criticalStock.length} รายการ`,
          {
            description: criticalStock.map((i) => i.name).join(', '),
            duration: 0
          }
        );
      }
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
