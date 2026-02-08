import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Plus, 
  Download, 
  Package,
  Calendar,
  Truck
} from 'lucide-react';

interface PR {
  id: number;
  pr_number: string;
  status: string;
  priority: string;
  required_date: string;
  created_at: string;
  requester_name: string;
  item_count: number;
  estimated_total: number;
}

export function PRList() {
  const navigate = useNavigate();
  const [prs, setPrs] = useState<PR[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchPRs();
  }, [filter]);

  const fetchPRs = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await api.get('/prs', params);
      if (response.success) {
        setPrs(response.data);
      }
    } catch (error) {
      toast.error('Failed to fetch PRs');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async (prId: number, prNumber: string) => {
    try {
      const response = await api.get(`/prs/${prId}/export`);
      if (!response.success) {
        toast.error('Failed to export');
        return;
      }

      // Dynamic import xlsx
      const XLSX = await import('xlsx');
      const data = response.data;
      
      // Create worksheet
      const ws = XLSX.utils.json_to_sheet([
        ['เอกสารขอซื้อ (Purchase Requisition)'],
        [''],
        ['เลขที่ PR:', data.pr_number],
        ['วันที่:', new Date(data.pr_date).toLocaleDateString('th-TH')],
        ['วันที่ต้องการ:', new Date(data.required_date).toLocaleDateString('th-TH')],
        ['ความสำคัญ:', data.priority],
        ['ผู้ขอ:', data.requester_name],
        ['แผนก:', data.department_name],
        ['คลัง:', data.store_name],
        ['หมายเหตุ:', data.notes || '-'],
        [''],
        ['รายการที่ขอ:']
      ]);

      // Add items
      const itemsHeader = ['ลำดับ', 'รหัส', 'รายการ', 'หน่วย', 'จำนวน', 'ราคาประมาณ/หน่วย', 'รวม'];
      const itemsData = data.items.map((item: any, idx: number) => [
        idx + 1,
        item.sku,
        item.item_name,
        item.unit,
        item.quantity,
        item.estimated_unit_cost,
        item.estimated_total
      ]);
      
      XLSX.utils.sheet_add_aoa(ws, [[]], { origin: -1 });
      XLSX.utils.sheet_add_aoa(ws, [itemsHeader], { origin: -1 });
      XLSX.utils.sheet_add_aoa(ws, itemsData, { origin: -1 });
      
      // Add summary
      XLSX.utils.sheet_add_aoa(ws, [
        [],
        ['รวมมูลค่า:', '', '', '', '', '', data.total_amount],
        [],
        ['==============================================='],
        ['สำหรับฝ่ายจัดซื้อ (กรอกข้อมูลตอนซื้อ):'],
        ['เลข PO:', '', 'วันที่สั่งซื้อ:', ''],
        ['ชื่อผู้ขาย:', '', 'วันที่รับของ:', ''],
        ['เบอร์โทรผู้ขาย:', ''],
        [''],
        ['รายการที่ซื้อได้:'],
        ['ลำดับ', 'รหัส', 'รายการ', 'จำนวนที่ซื้อ', 'ราคาจริง/หน่วย', 'รวม']
      ], { origin: -1 });

      // Set column widths
      ws['!cols'] = [
        { wch: 8 },
        { wch: 15 },
        { wch: 35 },
        { wch: 10 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 }
      ];

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'PR');

      // Download
      XLSX.writeFile(wb, `PR-${data.pr_number}.xlsx`);
      toast.success('Export Excel สำเร็จ', {
        description: 'ส่งไฟล์ให้ฝ่ายจัดซื้อได้เลย'
      });
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const handleReceive = (prId: number) => {
    navigate(`/prs/${prId}/receive`);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ordered: 'bg-green-100 text-green-800',
      partially_received: 'bg-blue-100 text-blue-800',
      fully_received: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return styles[status] || 'bg-gray-100';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      ordered: 'สั่งซื้อแล้ว',
      partially_received: 'รับบางส่วน',
      fully_received: 'รับครบแล้ว',
      cancelled: 'ยกเลิก'
    };
    return texts[status] || status;
  };

  const getNextAction = (pr: PR) => {
    switch (pr.status) {
      case 'ordered':
      case 'partially_received':
        return { text: 'รับของได้', canReceive: true };
      case 'fully_received':
      case 'cancelled':
        return { text: 'รับครบแล้ว', canReceive: false };
      default:
        return { text: 'รับของได้', canReceive: true };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ใบขอซื้อ (PR)</h1>
          <p className="text-gray-500 mt-1">สร้าง PR → Export Excel → ส่งจัดซื้อ → Key รับของ</p>
        </div>
        <Button onClick={() => navigate('/prs/create')}>
          <Plus className="w-4 h-4 mr-2" />
          สร้าง PR
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'ทั้งหมด' },
          { key: 'ordered', label: 'สั่งซื้อแล้ว' },
          { key: 'partially_received', label: 'รับบางส่วน' },
          { key: 'fully_received', label: 'รับครบ' }
        ].map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* PR List */}
      <div className="grid gap-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : prs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            ไม่มีรายการ PR
          </div>
        ) : (
          prs.map((pr) => {
            const nextAction = getNextAction(pr);
            return (
              <Card key={pr.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <FileText className="w-5 h-5 text-blue-500" />
                        <span className="font-semibold text-lg">{pr.pr_number}</span>
                        <Badge className={getStatusBadge(pr.status)}>
                          {getStatusText(pr.status)}
                        </Badge>
                        {pr.priority === 'urgent' && (
                          <Badge className="bg-red-100 text-red-800">ด่วน</Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-500">
                        ขอโดย: {pr.requester_name} | 
                        {pr.item_count} รายการ | 
                        มูลค่า: ฿{pr.estimated_total?.toLocaleString()}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          ต้องการ: {new Date(pr.required_date).toLocaleDateString('th-TH')}
                        </span>
                      </div>

                      {nextAction.canReceive && (
                        <div className="mt-2 text-sm text-blue-600">
                          <Truck className="w-4 h-4 inline mr-1" />
                          {nextAction.text}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 flex-col sm:flex-row">
                      {/* Export Button - ทุกสถานะ */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportToExcel(pr.id, pr.pr_number)}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Export
                      </Button>

                      {/* Receive Button - เฉพาะ approved/partially_received */}
                      {nextAction.canReceive && (
                        <Button
                          size="sm"
                          onClick={() => handleReceive(pr.id)}
                        >
                          <Package className="w-4 h-4 mr-1" />
                          รับของ
                        </Button>
                      )}

                      {/* View Detail */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/prs/${pr.id}`)}
                      >
                        ดู
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
