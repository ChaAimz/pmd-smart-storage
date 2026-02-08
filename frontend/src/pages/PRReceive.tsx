import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Truck, 
  FileText, 
  Calendar,
  ArrowLeft,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface PRItem {
  id: number;
  master_item_id: number;
  sku: string;
  name: string;
  unit: string;
  requested_quantity: number;
  received_quantity: number;
  estimated_unit_cost: number;
  notes: string;
}

interface PR {
  id: number;
  pr_number: string;
  status: string;
  required_date: string;
  created_at: string;
  requester_name: string;
  department_name: string;
  store_name: string;
  notes: string;
  items: PRItem[];
}

interface ReceiveItem {
  pr_item_id: number;
  received_quantity: number;
  actual_unit_cost: number;
  batch_number: string;
  expiry_date: string;
}

export function PRReceive() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pr, setPr] = useState<PR | null>(null);
  
  // Supplier document info (กรอกจากเอกสารที่ได้รับ)
  const [poNumber, setPoNumber] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Receive items
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);

  useEffect(() => {
    fetchPR();
  }, [id]);

  const fetchPR = async () => {
    try {
      const response = await api.get(`/prs/${id}`);
      if (response.success) {
        setPr(response.data);
        
        // Initialize receive items with remaining quantity
        const items = response.data.items
          .filter((item: PRItem) => item.requested_quantity > item.received_quantity)
          .map((item: PRItem) => ({
            pr_item_id: item.id,
            received_quantity: item.requested_quantity - item.received_quantity,
            actual_unit_cost: item.estimated_unit_cost,
            batch_number: '',
            expiry_date: ''
          }));
        setReceiveItems(items);
      }
    } catch (error) {
      toast.error('Failed to fetch PR');
      navigate('/prs');
    } finally {
      setLoading(false);
    }
  };

  const updateReceiveItem = (prItemId: number, field: keyof ReceiveItem, value: any) => {
    setReceiveItems(prev => prev.map(item => 
      item.pr_item_id === prItemId ? { ...item, [field]: value } : item
    ));
  };

  const validate = () => {
    if (!poNumber.trim()) {
      toast.error('กรุณาระบุเลข PO จากผู้ขาย (จากเอกสารที่แนบมากับสินค้า)');
      return false;
    }
    if (!supplierName.trim()) {
      toast.error('กรุณาระบุชื่อผู้ขาย');
      return false;
    }
    if (!receivedDate) {
      toast.error('กรุณาระบุวันที่รับของ');
      return false;
    }
    if (receiveItems.some(item => item.received_quantity <= 0)) {
      toast.error('กรุณาระบุจำนวนที่รับให้ถูกต้อง');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setSubmitting(true);
      const response = await api.post(`/prs/${id}/receive`, {
        po_number: poNumber.trim(),
        invoice_number: invoiceNumber.trim(),
        supplier_name: supplierName.trim(),
        received_date: receivedDate,
        items: receiveItems
      });

      if (response.success) {
        toast.success('บันทึกการรับของสำเร็จ', {
          description: `รับของเข้าระบบแล้ว ${response.data.received_count} รายการ`
        });
        navigate('/prs');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to receive items');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!pr) {
    return <div>PR not found</div>;
  }

  const getRemainingItems = () => {
    return pr.items.filter(item => item.requested_quantity > item.received_quantity);
  };

  const remainingItems = getRemainingItems();
  const totalQuantity = receiveItems.reduce((sum, item) => sum + item.received_quantity, 0);
  const totalCost = receiveItems.reduce((sum, item, idx) => {
    const itemData = remainingItems[idx];
    return sum + (item.received_quantity * item.actual_unit_cost);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/prs')}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          กลับ
        </Button>
        <div>
          <h1 className="text-3xl font-bold">รับของเข้าคลัง</h1>
          <p className="text-gray-500">กรอกข้อมูลจากเอกสาร PO/ใบส่งสินค้าที่ได้รับ</p>
        </div>
      </div>

      {/* PR Info */}
      <Card className="bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <FileText className="w-8 h-8 text-blue-500" />
            <div>
              <div className="font-semibold">{pr.pr_number}</div>
              <div className="text-sm text-gray-600">
                {pr.department_name} / {pr.store_name}
              </div>
            </div>
            <Badge className="bg-blue-100 text-blue-800">
              {pr.status === 'ordered' ? 'สั่งซื้อแล้ว' : 'รับบางส่วน'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Supplier Document */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                ข้อมูลจากผู้ขาย (กรอกจากเอกสาร)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  เลข PO จากผู้ขาย *
                </Label>
                <Input
                  placeholder="ตัวอย่าง: PO-2024-00123"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  ดูจากใบส่งสินค้าหรือใบกำกับภาษีจากผู้ขาย
                </p>
              </div>

              <div>
                <Label>เลข Invoice/ใบกำกับภาษี</Label>
                <Input
                  placeholder="INV-2024-XXXX"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-red-600">ชื่อผู้ขาย (Supplier) *</Label>
                <Input
                  placeholder="ชื่อบริษัทหรือร้านค้า"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label className="text-red-600">วันที่รับของ *</Label>
                <Input
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  required
                />
              </div>

              <div className="bg-yellow-50 p-3 rounded text-sm">
                <strong className="text-yellow-800">คำอธิบาย:</strong>
                <ul className="list-disc list-inside mt-1 text-yellow-700 space-y-1">
                  <li>PO ที่กรอกคือเลขจากผู้ขาย (Supplier)</li>
                  <li>หมายเลขนี้จะถูกบันทึกไว้เพื่ออ้างอิงในอนาคต</li>
                  <li>ระบบจะสร้าง Lot Number อัตโนมัติสำหรับ FIFO</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Receive Items */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                รายการที่รับ ({remainingItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {remainingItems.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  รับครบทุกรายการแล้ว
                </div>
              ) : (
                remainingItems.map((item, idx) => {
                  const receiveItem = receiveItems.find(r => r.pr_item_id === item.id);
                  const remaining = item.requested_quantity - item.received_quantity;
                  
                  return (
                    <div key={item.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-gray-500">
                            SKU: {item.sku} | {item.unit}
                          </div>
                        </div>
                        <Badge variant="outline">
                          ขอ: {item.requested_quantity} | 
                          รับแล้ว: {item.received_quantity} | 
                          คงเหลือ: {remaining}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">จำนวนที่รับจริง *</Label>
                          <Input
                            type="number"
                            min={1}
                            max={remaining}
                            value={receiveItem?.received_quantity || 0}
                            onChange={(e) => updateReceiveItem(
                              item.id, 
                              'received_quantity', 
                              parseInt(e.target.value) || 0
                            )}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">ราคาต่อหน่วย (บาท) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={receiveItem?.actual_unit_cost || 0}
                            onChange={(e) => updateReceiveItem(
                              item.id, 
                              'actual_unit_cost', 
                              parseFloat(e.target.value) || 0
                            )}
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">หมายเลข Batch/Lot (ถ้ามี)</Label>
                        <Input
                          placeholder="เลข Lot จากผู้ขาย"
                          value={receiveItem?.batch_number || ''}
                          onChange={(e) => updateReceiveItem(item.id, 'batch_number', e.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="text-xs">วันหมดอายุ (ถ้ามี)</Label>
                        <Input
                          type="date"
                          value={receiveItem?.expiry_date || ''}
                          onChange={(e) => updateReceiveItem(item.id, 'expiry_date', e.target.value)}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Summary & Submit */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-gray-500">จำนวนรายการที่จะรับ</div>
              <div className="text-xl font-bold">{receiveItems.length} รายการ / {totalQuantity} ชิ้น</div>
            </div>
            <div className="text-right space-y-1">
              <div className="text-gray-500">มูลค่ารวม</div>
              <div className="text-xl font-bold text-green-600">
                ฿{totalCost.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4 mt-6">
            <Button 
              variant="outline" 
              onClick={() => navigate('/prs')}
              disabled={submitting}
            >
              ยกเลิก
            </Button>
            <Button 
              size="lg"
              onClick={handleSubmit}
              disabled={submitting || remainingItems.length === 0}
            >
              {submitting ? (
                'กำลังบันทึก...'
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  ยืนยันการรับของ
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
