import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  ArrowLeft,
  Calendar,
  Download,
  Package,
  User,
  Building,
  Store
} from 'lucide-react';

interface PRItem {
  id: number;
  master_item_id: number;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  received_quantity: number;
  estimated_unit_cost: number;
  actual_unit_cost: number;
  notes: string;
}

interface PR {
  id: number;
  pr_number: string;
  status: string;
  priority: string;
  required_date: string;
  created_at: string;
  approved_at: string;
  received_at: string;
  notes: string;
  requester_name: string;
  department_name: string;
  store_name: string;
  approver_name: string;
  items: PRItem[];
  po_number?: string;
  supplier_name?: string;
}

export function PRDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pr, setPr] = useState<PR | null>(null);

  useEffect(() => {
    fetchPR();
  }, [id]);

  const fetchPR = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/prs/${id}`);
      if (response.success) {
        setPr(response.data);
      }
    } catch (error) {
      toast.error('Failed to fetch PR');
      navigate('/prs');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    if (!pr) return;
    try {
      const response = await api.get(`/prs/${pr.id}/export`);
      if (!response.success) {
        toast.error('Failed to export');
        return;
      }

      const XLSX = await import('xlsx');
      const data = response.data;
      
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

      ws['!cols'] = [
        { wch: 8 },
        { wch: 15 },
        { wch: 35 },
        { wch: 10 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'PR');
      XLSX.writeFile(wb, `PR-${data.pr_number}.xlsx`);
      toast.success('Export Excel สำเร็จ');
    } catch (error) {
      toast.error('Export failed');
    }
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

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      low: 'bg-gray-100 text-gray-800',
      normal: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return styles[priority] || 'bg-gray-100';
  };

  const getPriorityText = (priority: string) => {
    const texts: Record<string, string> = {
      low: 'ต่ำ',
      normal: 'ปกติ',
      high: 'สูง',
      urgent: 'ด่วน'
    };
    return texts[priority] || priority;
  };

  const canReceive = (status: string) => {
    return status === 'ordered' || status === 'partially_received';
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!pr) {
    return <div className="text-center p-8">PR not found</div>;
  }

  const totalEstimated = pr.items?.reduce((sum, item) => 
    sum + (item.quantity * item.estimated_unit_cost), 0) || 0;
  
  const totalActual = pr.items?.reduce((sum, item) => 
    sum + (item.received_quantity * (item.actual_unit_cost || item.estimated_unit_cost)), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/prs')}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          กลับ
        </Button>
        <div>
          <h1 className="text-3xl font-bold">รายละเอียดใบขอซื้อ</h1>
          <p className="text-gray-500">{pr.pr_number}</p>
        </div>
      </div>

      {/* Header Info */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <span className="font-semibold text-xl">{pr.pr_number}</span>
                <Badge className={getStatusBadge(pr.status)}>
                  {getStatusText(pr.status)}
                </Badge>
                <Badge className={getPriorityBadge(pr.priority)}>
                  {getPriorityText(pr.priority)}
                </Badge>
              </div>
              <div className="text-sm text-gray-500">
                สร้างเมื่อ {new Date(pr.created_at).toLocaleDateString('th-TH')}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={exportToExcel}>
                <Download className="w-4 h-4 mr-1" />
                Export Excel
              </Button>
              {canReceive(pr.status) && (
                <Button onClick={() => navigate(`/prs/${pr.id}/receive`)}>
                  <Package className="w-4 h-4 mr-1" />
                  รับของ
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">ข้อมูลทั่วไป</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">ผู้ขอ:</span>
                <span>{pr.requester_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">แผนก:</span>
                <span>{pr.department_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">คลัง:</span>
                <span>{pr.store_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">วันที่ต้องการ:</span>
                <span>{new Date(pr.required_date).toLocaleDateString('th-TH')}</span>
              </div>

              {pr.notes && (
                <div className="pt-2 border-t">
                  <span className="text-gray-500">หมายเหตุ:</span>
                  <p className="mt-1">{pr.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PO Info if received */}
          {(pr.po_number || pr.supplier_name) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  ข้อมูลการรับของ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {pr.po_number && (
                  <div>
                    <span className="text-gray-500">เลข PO จากผู้ขาย:</span>
                    <p className="font-mono text-lg">{pr.po_number}</p>
                  </div>
                )}
                {pr.supplier_name && (
                  <div>
                    <span className="text-gray-500">ผู้ขาย:</span>
                    <p>{pr.supplier_name}</p>
                  </div>
                )}
                {pr.received_at && (
                  <div>
                    <span className="text-gray-500">รับของเมื่อ:</span>
                    <p>{new Date(pr.received_at).toLocaleDateString('th-TH')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Items */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">รายการสินค้า ({pr.items?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pr.items?.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-gray-500">
                          SKU: {item.sku} | {item.unit}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">
                          {item.received_quantity || 0} / {item.quantity}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                      <div>
                        <span className="text-gray-500">ราคาประมาณ:</span>
                        <p>฿{item.estimated_unit_cost?.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">ราคาจริง:</span>
                        <p>฿{item.actual_unit_cost?.toLocaleString() || '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">รวม:</span>
                        <p className="font-medium">
                          ฿{((item.received_quantity || item.quantity) * (item.actual_unit_cost || item.estimated_unit_cost)).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {item.notes && (
                      <p className="text-sm text-gray-500 mt-2">หมายเหตุ: {item.notes}</p>
                    )}
                  </div>
                ))}

                {/* Totals */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">รวมมูลค่าประมาณ:</span>
                    <span>฿{totalEstimated.toLocaleString()}</span>
                  </div>
                  {(pr.status === 'partially_received' || pr.status === 'fully_received') && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">รวมมูลค่าจริง:</span>
                      <span className="font-bold text-green-600">฿{totalActual.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
