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
import { Badge } from '@/components/ui/badge';
import { H1, Lead } from '@/components/ui/typography';
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

interface ExportItemRow {
  sku: string;
  item_name?: string;
  name?: string;
  unit: string;
  quantity: number;
  estimated_unit_cost: number;
  estimated_total: number;
}

interface PRExportData {
  pr_number: string;
  pr_date: string;
  required_date: string;
  priority: string;
  requester_name: string;
  department_name: string;
  store_name: string;
  notes?: string;
  total_amount: number;
  items: ExportItemRow[];
}

export function PRDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pr, setPr] = useState<PR | null>(null);

  const fetchPR = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<PR>(`/prs/${id}`);
      if (response.success) {
        setPr(response.data || null);
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

  const exportToExcel = async () => {
    if (!pr) return;
    try {
      const response = await api.get<PRExportData>(`/prs/${pr.id}/export`);
      if (!response.success) {
        toast.error('Failed to export');
        return;
      }

      const XLSX = await import('xlsx');
      const data = response.data as PRExportData;
      
      const ws = XLSX.utils.json_to_sheet([
        ['Purchase Requisition'],
        [''],
        ['PR Number:', data.pr_number],
        ['Date:', new Date(data.pr_date).toLocaleDateString('th-TH')],
        ['Required Date:', new Date(data.required_date).toLocaleDateString('th-TH')],
        ['ความสำคัญ:', data.priority],
        ['Requester:', data.requester_name],
        ['Department:', data.department_name],
        ['Store:', data.store_name],
        ['Notes:', data.notes || '-'],
        [''],
        ['Requested Items:']
      ]);

      const itemsHeader = ['No.', 'Code/SKU', 'Item', 'Unit', 'Quantity', 'Est. Unit Price', 'Total'];
      const itemsData = data.items.map((item: ExportItemRow, idx: number) => [
        idx + 1,
        getItemSku(item),
        item.item_name || getItemName(item),
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
        ['Total Amount:', '', '', '', '', '', data.total_amount],
        [],
        ['==============================================='],
        ['For Purchasing Dept (fill when purchasing):'],
        ['PO Number:', '', 'Order Date:', ''],
        ['Supplier Name:', '', 'Receive Date:', ''],
        ['Supplier Tel:', ''],
        [''],
        ['Items to Purchase:'],
        ['No.', 'Code/SKU', 'Item', 'Qty to Buy', 'Actual Unit Price', 'Total']
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
      toast.success('Excel export successful');
    } catch {
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
      ordered: 'Ordered',
      partially_received: 'Partially Received',
      fully_received: 'Fully Received',
      cancelled: 'Cancelled'
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
      low: 'Low',
      normal: 'Normal',
      high: 'High',
      urgent: 'Urgent'
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
          Back
        </Button>
        <div>
          <H1 className="text-3xl">PR Details</H1>
          <Lead>{pr.pr_number}</Lead>
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
                Created on {new Date(pr.created_at).toLocaleDateString('th-TH')}
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
                  Receive
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
              <CardTitle className="text-lg">General Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">Requester:</span>
                <span>{pr.requester_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">Department:</span>
                <span>{pr.department_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">Store:</span>
                <span>{pr.store_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">Required Date:</span>
                <span>{new Date(pr.required_date).toLocaleDateString('th-TH')}</span>
              </div>

              {pr.notes && (
                <div className="pt-2 border-t">
                  <span className="text-gray-500">Notes:</span>
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
                  Receiving Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {pr.po_number && (
                  <div>
                    <span className="text-gray-500">Supplier PO Number:</span>
                    <p className="font-mono text-lg">{pr.po_number}</p>
                  </div>
                )}
                {pr.supplier_name && (
                  <div>
                    <span className="text-gray-500">Supplier:</span>
                    <p>{pr.supplier_name}</p>
                  </div>
                )}
                {pr.received_at && (
                  <div>
                    <span className="text-gray-500">Received on:</span>
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
              <CardTitle className="text-lg">Items ({pr.items?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pr.items?.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{getItemName(item)}</div>
                        <div className="text-sm text-gray-500">
                          SKU: {getItemSku(item)} | {item.unit}
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
                        <span className="text-gray-500">Est. Price:</span>
                        <p>฿{item.estimated_unit_cost?.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Actual Price:</span>
                        <p>฿{item.actual_unit_cost?.toLocaleString() || '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Total:</span>
                        <p className="font-medium">
                          ฿{((item.received_quantity || item.quantity) * (item.actual_unit_cost || item.estimated_unit_cost)).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {item.notes && (
                      <p className="text-sm text-gray-500 mt-2">Notes: {item.notes}</p>
                    )}
                  </div>
                ))}

                {/* Totals */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total Estimated:</span>
                    <span>฿{totalEstimated.toLocaleString()}</span>
                  </div>
                  {(pr.status === 'partially_received' || pr.status === 'fully_received') && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Actual:</span>
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
