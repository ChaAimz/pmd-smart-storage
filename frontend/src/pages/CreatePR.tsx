import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Trash2, 
  Search,
  Package,
  Calendar,
  FileText
} from 'lucide-react';

interface PRItem {
  master_item_id: number;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  estimated_unit_cost: number;
  notes: string;
}

interface MasterItem {
  id: number;
  sku: string;
  name: string;
  unit: string;
  category: string;
}

export function CreatePR() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<MasterItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<PRItem[]>([]);
  
  // PR Info - ไม่ต้องใส่ supplier ตอนสร้าง
  const [priority, setPriority] = useState('normal');
  const [requiredDate, setRequiredDate] = useState('');
  const [notes, setNotes] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  // Close search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search master items
  useEffect(() => {
    if (searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    const delay = setTimeout(async () => {
      try {
        const response = await api.get(`/master-items?search=${searchTerm}`);
        if (response.success) {
          setSearchResults(response.data);
        }
      } catch (error) {
        console.error('Search error:', error);
      }
    }, 300);

    return () => clearTimeout(delay);
  }, [searchTerm]);

  const addItem = (item: MasterItem) => {
    if (selectedItems.find(i => i.master_item_id === item.id)) {
      toast.warning('รายการนี้อยู่ในรายการแล้ว');
      return;
    }

    setSelectedItems(prev => [...prev, {
      master_item_id: item.id,
      sku: item.sku,
      name: item.name,
      unit: item.unit,
      quantity: 1,
      estimated_unit_cost: 0,
      notes: ''
    }]);
    
    setSearchTerm('');
    setSearchResults([]);
  };

  const removeItem = (index: number) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof PRItem, value: any) => {
    setSelectedItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const calculateTotal = () => {
    return selectedItems.reduce((sum, item) => 
      sum + (item.quantity * item.estimated_unit_cost), 0
    );
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      toast.error('กรุณาเพิ่มอย่างน้อย 1 รายการ');
      return;
    }

    if (!requiredDate) {
      toast.error('กรุณาระบุวันที่ต้องการ');
      return;
    }

    try {
      setLoading(true);
      
      const response = await api.post('/prs', {
        priority,
        required_date: requiredDate,
        notes,
        items: selectedItems.map(item => ({
          master_item_id: item.master_item_id,
          quantity: item.quantity,
          estimated_unit_cost: item.estimated_unit_cost,
          notes: item.notes
        }))
      });

      if (response.success) {
        toast.success('สร้าง PR สำเร็จ', {
          description: `เลขที่: ${response.data.pr_number}`
        });
        
        // Export Excel อัตโนมัติเพื่อส่งให้จัดซื้อ
        await exportToExcel(response.data.id);
        
        toast.info('Export Excel สำเร็จ กรุณาส่งไฟล์ให้ฝ่ายจัดซื้อ');
        
        navigate('/prs');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create PR');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async (prId: number) => {
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
        ['วันที่:', data.pr_date],
        ['วันที่ต้องการ:', data.required_date],
        ['ความสำคัญ:', data.priority],
        ['ผู้ขอ:', data.requester],
        ['แผนก:', data.department],
        ['คลัง:', data.store],
        [''],
        ['รายการที่ขอ:']
      ]);

      // Add items
      const itemsHeader = ['ลำดับ', 'รหัส', 'รายการ', 'หน่วย', 'จำนวน', 'ราคาประมาณ/หน่วย', 'รวม', 'หมายเหตุ'];
      const itemsData = data.items.map((item: any, idx: number) => [
        idx + 1,
        item.sku,
        item.item_name,
        item.unit,
        item.quantity,
        item.estimated_price,
        item.estimated_total,
        item.notes
      ]);
      
      XLSX.utils.sheet_add_aoa(ws, [[]], { origin: -1 });
      XLSX.utils.sheet_add_aoa(ws, [itemsHeader], { origin: -1 });
      XLSX.utils.sheet_add_aoa(ws, itemsData, { origin: -1 });
      
      // Add summary
      XLSX.utils.sheet_add_aoa(ws, [
        [],
        ['รวมมูลค่า:', '', '', '', '', '', data.total_estimated_amount],
        [],
        ['==============================================='],
        ['สำหรับฝ่ายจัดซื้อ (กรอกข้อมูลตอนซื้อ):'],
        ['เลข PO:', ''],
        ['ชื่อผู้ขาย:', ''],
        ['วันที่สั่งซื้อ:', ''],
        ['วันที่รับของ:', ''],
        [],
        ['หมายเหตุ:', data.notes]
      ], { origin: -1 });

      // Set column widths
      ws['!cols'] = [
        { wch: 8 },   // ลำดับ
        { wch: 15 },  // รหัส
        { wch: 30 },  // รายการ
        { wch: 10 },  // หน่วย
        { wch: 10 },  // จำนวน
        { wch: 15 },  // ราคา
        { wch: 15 },  // รวม
        { wch: 20 }   // หมายเหตุ
      ];

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'PR');

      // Download
      XLSX.writeFile(wb, `PR-${data.pr_number}.xlsx`);
      toast.success('Exported to Excel');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">สร้างใบขอซื้อ (PR)</h1>
      <p className="text-gray-500">สร้างใบขอซื้อภายใน จากนั้น Export Excel ส่งให้ฝ่ายจัดซื้อ</p>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Search & Add Items */}
        <div className="col-span-2 space-y-6">
          {/* Search */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                ค้นหารายการสินค้า
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative" ref={searchRef}>
                <Input
                  placeholder="พิมพ์ชื่อหรือ SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border rounded-md mt-1 shadow-lg max-h-60 overflow-auto">
                    {searchResults.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b"
                        onClick={() => addItem(item)}
                      >
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-gray-500">
                          SKU: {item.sku} | หน่วย: {item.unit}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Selected Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  รายการที่ขอซื้อ ({selectedItems.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  ยังไม่มีรายการ กรุณาค้นหาและเพิ่มรายการ
                </div>
              ) : (
                selectedItems.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-gray-500">SKU: {item.sku}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs">จำนวน</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">ราคาประมาณ/หน่วย</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.estimated_unit_cost}
                          onChange={(e) => updateItem(index, 'estimated_unit_cost', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">รวม</Label>
                        <div className="pt-2 font-medium">
                          ฿{(item.quantity * item.estimated_unit_cost).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">หมายเหตุ</Label>
                      <Input
                        placeholder="หมายเหตุรายการ"
                        value={item.notes}
                        onChange={(e) => updateItem(index, 'notes', e.target.value)}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: PR Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                ข้อมูลใบขอซื้อ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>ความเร่งด่วน</Label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {['low', 'normal', 'high', 'urgent'].map((p) => (
                    <Badge
                      key={p}
                      variant={priority === p ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setPriority(p)}
                    >
                      {p === 'low' && 'ต่ำ'}
                      {p === 'normal' && 'ปกติ'}
                      {p === 'high' && 'สูง'}
                      {p === 'urgent' && 'ด่วน'}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  วันที่ต้องการของ
                </Label>
                <Input
                  type="date"
                  value={requiredDate}
                  onChange={(e) => setRequiredDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <Label>หมายเหตุ</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ระบุเหตุผลการขอซื้อ หรือรายละเอียดเพิ่มเติม..."
                  rows={4}
                />
              </div>

              <div className="bg-blue-50 p-3 rounded text-sm text-blue-700">
                <strong>ขั้นตอนต่อไป:</strong><br/>
                1. บันทึก PR<br/>
                2. Export Excel ส่งจัดซื้อ<br/>
                3. รอจัดซื้อซื้อของ<br/>
                4. Key รับของเมื่อของมาส่ง
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-500">จำนวนรายการ</span>
                <span className="font-medium">{selectedItems.length} รายการ</span>
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-500">มูลค่ารวมประมาณ</span>
                <span className="text-xl font-bold">
                  ฿{calculateTotal().toLocaleString()}
                </span>
              </div>
              
              <Button 
                className="w-full" 
                size="lg"
                onClick={handleSubmit}
                disabled={loading || selectedItems.length === 0}
              >
                {loading ? 'กำลังบันทึก...' : 'บันทึกใบขอซื้อ'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
