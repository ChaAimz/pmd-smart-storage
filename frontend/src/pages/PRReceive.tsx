import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as api from '@/services/api';

// Helper functions to handle both old and new API response formats
interface ItemLike {
  name?: string;
  master_name?: string;
  local_name?: string;
  sku?: string;
  master_sku?: string;
  local_sku?: string;
}

const getItemName = (item: ItemLike): string => {
  return item?.name || item?.master_name || item?.local_name || 'Unknown'
}

const getItemSku = (item: ItemLike): string => {
  return item?.sku || item?.master_sku || item?.local_sku || 'N/A'
}
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PRStatusBadge } from '@/components/ui/pr-status-badge';
import { H1, Lead } from '@/components/ui/typography';
import { 
  Package, 
  Truck, 
  FileText, 
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
  
  // Supplier document info (fill from received document)
  const [poNumber, setPoNumber] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Receive items
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);

  const fetchPR = useCallback(async () => {
    try {
      const response = await api.get<PR>(`/prs/${id}`);
      if (response.success) {
        const prData = response.data;
        if (!prData) return;
        setPr(prData);
        
        // Initialize receive items with remaining quantity
        const items = prData.items
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
    } catch {
      toast.error('Failed to fetch PR');
      navigate('/prs');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    void fetchPR();
  }, [fetchPR]);

  const updateReceiveItem = (
    prItemId: number,
    field: keyof ReceiveItem,
    value: ReceiveItem[keyof ReceiveItem]
  ) => {
    setReceiveItems(prev => prev.map(item => 
      item.pr_item_id === prItemId ? { ...item, [field]: value } : item
    ));
  };

  const validate = () => {
    if (!poNumber.trim()) {
      toast.error('Please enter supplier PO number');
      return false;
    }
    if (!supplierName.trim()) {
      toast.error('Please enter supplier name');
      return false;
    }
    if (!receivedDate) {
      toast.error('Please enter receive date');
      return false;
    }
    if (receiveItems.some(item => item.received_quantity <= 0)) {
      toast.error('Please enter valid receive quantity');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setSubmitting(true);
      const response = await api.post<{ received_count: number }>(`/prs/${id}/receive`, {
        po_number: poNumber.trim(),
        invoice_number: invoiceNumber.trim(),
        supplier_name: supplierName.trim(),
        received_date: receivedDate,
        items: receiveItems
      });

      if (response.success) {
        const result = response.data;
        toast.success('Receipt saved successfully', {
          description: `${result?.received_count || 0} items received into system`
        });
        navigate('/prs');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to receive items';
      toast.error(message);
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
  const totalCost = receiveItems.reduce((sum, item) => {
    return sum + (item.received_quantity * item.actual_unit_cost);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/prs')}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <div>
          <H1 className="text-3xl">Receive Items to Warehouse</H1>
          <Lead>Enter info from PO/Delivery document</Lead>
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
            <PRStatusBadge status={pr.status} />
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
                Supplier Info (from document)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  Supplier PO Number *
                </Label>
                <Input
                  placeholder="Example: PO-2024-00123"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  From delivery note or tax invoice
                </p>
              </div>

              <div>
                <Label>Invoice/Tax Invoice Number</Label>
                <Input
                  placeholder="INV-2024-XXXX"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-red-600">Supplier Name *</Label>
                <Input
                  placeholder="Company or shop name"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label className="text-red-600">Receive Date *</Label>
                <Input
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  required
                />
              </div>

              <div className="bg-yellow-50 p-3 rounded text-sm">
                <strong className="text-yellow-800">Note:</strong>
                <ul className="list-disc list-inside mt-1 text-yellow-700 space-y-1">
                  <li>PO number is from supplier</li>
                  <li>This number will be saved for future reference</li>
                  <li>System will auto-generate Lot Number for FIFO</li>
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
                Items to Receive ({remainingItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {remainingItems.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  All items received
                </div>
              ) : (
                remainingItems.map((item) => {
                  const receiveItem = receiveItems.find(r => r.pr_item_id === item.id);
                  const remaining = item.requested_quantity - item.received_quantity;
                  
                  return (
                    <div key={item.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{getItemName(item)}</div>
                          <div className="text-sm text-gray-500">
                            SKU: {getItemSku(item)} | {item.unit}
                          </div>
                        </div>
                        <Badge variant="outline">
                          Requested: {item.requested_quantity} | 
                          Received: {item.received_quantity} | 
                          Remaining: {remaining}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">Actual Qty Received *</Label>
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
                          <Label className="text-xs">Unit Price (THB) *</Label>
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
                        <Label className="text-xs">Batch/Lot Number (if any)</Label>
                        <Input
                          placeholder="Supplier Lot Number"
                          value={receiveItem?.batch_number || ''}
                          onChange={(e) => updateReceiveItem(item.id, 'batch_number', e.target.value)}
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Expiry Date (if any)</Label>
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
              <div className="text-gray-500">Items to receive</div>
              <div className="text-xl font-bold">{receiveItems.length} items / {totalQuantity} pieces</div>
            </div>
            <div className="text-right space-y-1">
              <div className="text-gray-500">Total Amount</div>
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
              Cancel
            </Button>
            <Button 
              size="lg"
              onClick={handleSubmit}
              disabled={submitting || remainingItems.length === 0}
            >
              {submitting ? (
                'Saving...'
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Confirm Receipt
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
