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
  
  // PR Info - no need to add supplier when creating
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
      toast.warning('This item is already in the list');
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
      toast.error('Please add at least 1 item');
      return;
    }

    if (!requiredDate) {
      toast.error('Please enter required date');
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
        toast.success('PR created successfully', {
          description: `Number: ${response.data.pr_number}`
        });
        
        // Export Excel อัตโนมัติเพื่อส่งให้จัดซื้อ
        await exportToExcel(response.data.id);
        
        toast.info('Excel export successful, please send to Purchasing');
        
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
        ['Purchase Requisition'],
        [''],
        ['PR Number:', data.pr_number],
        ['Date:', data.pr_date],
        ['Required Date:', data.required_date],
        ['ความสำคัญ:', data.priority],
        ['Requester:', data.requester],
        ['Department:', data.department],
        ['Store:', data.store],
        [''],
        ['Requested Items:']
      ]);

      // Add items
      const itemsHeader = ['No.', 'Code/SKU', 'Item', 'Unit', 'Quantity', 'Est. Unit Price', 'Total', 'Notes'];
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
        ['Total Amount:', '', '', '', '', '', data.total_estimated_amount],
        [],
        ['==============================================='],
        ['For Purchasing Dept (fill when purchasing):'],
        ['PO Number:', ''],
        ['Supplier Name:', ''],
        ['Order Date:', ''],
        ['Receive Date:', ''],
        [],
        ['Notes:', data.notes]
      ], { origin: -1 });

      // Set column widths
      ws['!cols'] = [
        { wch: 8 },   // No.
        { wch: 15 },  // Code/SKU
        { wch: 30 },  // Item
        { wch: 10 },  // Unit
        { wch: 10 },  // Quantity
        { wch: 15 },  // Price
        { wch: 15 },  // Total
        { wch: 20 }   // Notes
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
      <h1 className="text-3xl font-bold">Create Purchase Requisition (PR)</h1>
      <p className="text-gray-500">Create internal PR, then Export Excel to send to Purchasing</p>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Search & Add Items */}
        <div className="col-span-2 space-y-6">
          {/* Search */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Search items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative" ref={searchRef}>
                <Input
                  placeholder="Type name or SKU..."
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
                          SKU: {item.sku} | Unit: {item.unit}
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
                  Items to purchase ({selectedItems.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No items yet, please search and add
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
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Est. Unit Price</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.estimated_unit_cost}
                          onChange={(e) => updateItem(index, 'estimated_unit_cost', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Total</Label>
                        <div className="pt-2 font-medium">
                          ฿{(item.quantity * item.estimated_unit_cost).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Notes</Label>
                      <Input
                        placeholder="Item notes"
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
                PR Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Priority</Label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {['low', 'normal', 'high', 'urgent'].map((p) => (
                    <Badge
                      key={p}
                      variant={priority === p ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setPriority(p)}
                    >
                      {p === 'low' && 'Low'}
                      {p === 'normal' && 'Normal'}
                      {p === 'high' && 'High'}
                      {p === 'urgent' && 'Urgent'}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Required Date
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
                  placeholder="Enter reason for purchase or additional details..."
                  rows={4}
                />
              </div>

              <div className="bg-blue-50 p-3 rounded text-sm text-blue-700">
                <strong>Next Steps:</strong><br/>
                1. Save PR<br/>
                2. Export Excel to Purchasing<br/>
                3. Wait for purchasing<br/>
                4. Receive items when delivered
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-500">Number of Items</span>
                <span className="font-medium">{selectedItems.length} items</span>
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-500">Total Estimated Amount</span>
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
                {loading ? 'Saving...' : 'Save PR'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
