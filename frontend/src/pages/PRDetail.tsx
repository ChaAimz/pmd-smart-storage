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
import { ItemNameHoverCard } from '@/components/ui/item-name-hover-card';
import { PRPriorityBadge } from '@/components/ui/pr-priority-badge';
import { PRStatusBadge } from '@/components/ui/pr-status-badge';
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

const formatDisplayDate = (value: string) => {
  const date = new Date(value)
  const day = String(date.getDate()).padStart(2, '0')
  const month = date.toLocaleString('en-US', { month: 'short' })
  const year = String(date.getFullYear()).slice(-2)
  return `${day}/${month}/${year}`
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
  const hasReceivingInfo = Boolean(pr.po_number || pr.supplier_name)

  return (
    <div className="h-full min-h-0 overflow-y-auto lg:overflow-hidden">
      <div className="h-full min-h-0 flex flex-col gap-4 px-2.5 pt-2.5 pb-1.5 lg:px-3.5 lg:pt-3.5 lg:pb-2.5">
      {/* Header Info */}
      <Card className="shrink-0 border-border/70 bg-background/90 dark:border-border/60 dark:bg-background/70">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => navigate('/prs')}
                  aria-label="Back to PR list"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <FileText className="w-5 h-5 text-blue-500" />
                <span className="font-semibold text-xl">{pr.pr_number}</span>
                <PRStatusBadge status={pr.status} />
                <PRPriorityBadge priority={pr.priority} />
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
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
              <div className="text-sm text-gray-500">
                Created on {formatDisplayDate(pr.created_at)}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 border-t pt-4 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <span className="truncate">{pr.requester_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-gray-400" />
              <span className="truncate">{pr.department_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-gray-400" />
              <span className="truncate">{pr.store_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span>{new Date(pr.required_date).toLocaleDateString('th-TH')}</span>
            </div>
          </div>

          {pr.notes ? (
            <div className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Notes:</span> {pr.notes}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {hasReceivingInfo ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="min-h-0 lg:col-span-1">
            <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/70 bg-background/90 dark:border-border/60 dark:bg-background/70">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Receiving Information
                </CardTitle>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
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
          </div>

          <div className="min-h-0 lg:col-span-2">
            <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/70 bg-background/90 dark:border-border/60 dark:bg-background/70">
              <CardHeader>
                <CardTitle className="text-lg">Items ({pr.items?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent className="min-h-0 flex flex-1 flex-col px-4 pb-4 pt-0">
                <div className="h-full min-h-0 flex-1 overflow-hidden rounded-lg border border-border/70 bg-background">
                  <div className="h-full overflow-auto">
                    <table className="w-full min-w-[940px] border-collapse text-sm">
                      <thead className="sticky top-0 z-10 overflow-hidden rounded-t-lg bg-muted/50 text-left text-sm text-muted-foreground backdrop-blur-xl">
                        <tr className="border-b border-border">
                          <th className="h-12 px-4 align-middle font-medium">Item</th>
                          <th className="h-12 px-4 align-middle font-medium">SKU</th>
                          <th className="h-12 px-4 align-middle font-medium">Qty (Rcv/Req)</th>
                          <th className="h-12 px-4 text-right align-middle font-medium">Est. Price</th>
                          <th className="h-12 px-4 text-right align-middle font-medium">Actual Price</th>
                          <th className="h-12 px-4 text-right align-middle font-medium">Total</th>
                          <th className="h-12 px-4 align-middle font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pr.items?.map((item) => (
                          <tr key={item.id} className="border-b border-border transition-colors hover:bg-muted/50">
                            <td className="px-4 py-3 font-medium">
                              <ItemNameHoverCard
                                name={getItemName(item)}
                                sku={getItemSku(item)}
                                item={{
                                  id: item.master_item_id,
                                  name: getItemName(item),
                                  sku: getItemSku(item),
                                  unit: item.unit,
                                  reorder_quantity: item.quantity,
                                }}
                                className="cursor-default"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <code className="rounded bg-muted px-2 py-1 text-xs">
                                {getItemSku(item)}
                              </code>
                              <span className="ml-2 text-muted-foreground">{item.unit}</span>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline">
                                {item.received_quantity || 0} / {item.quantity}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">฿{item.estimated_unit_cost?.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right">
                              {item.actual_unit_cost ? `฿${item.actual_unit_cost.toLocaleString()}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              ฿{((item.received_quantity || item.quantity) * (item.actual_unit_cost || item.estimated_unit_cost)).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{item.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="mt-2 shrink-0 rounded-md border border-border/70 bg-muted/20 px-4 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-muted-foreground">Total Estimated</span>
                    <span className="font-semibold">฿{totalEstimated.toLocaleString()}</span>
                  </div>
                  {pr.status === 'partially_received' || pr.status === 'fully_received' ? (
                    <div className="mt-1 flex items-center justify-between">
                      <span className="font-medium text-muted-foreground">Total Actual</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">฿{totalActual.toLocaleString()}</span>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/70 bg-background/90 dark:border-border/60 dark:bg-background/70">
            <CardHeader>
              <CardTitle className="text-lg">Items ({pr.items?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex flex-1 flex-col px-4 pb-4 pt-0">
              <div className="h-full min-h-0 flex-1 overflow-hidden rounded-lg border border-border/70 bg-background">
                <div className="h-full overflow-auto">
                  <table className="w-full min-w-[940px] border-collapse text-sm">
                    <thead className="sticky top-0 z-10 overflow-hidden rounded-t-lg bg-muted/50 text-left text-sm text-muted-foreground backdrop-blur-xl">
                      <tr className="border-b border-border">
                        <th className="h-12 px-4 align-middle font-medium">Item</th>
                        <th className="h-12 px-4 align-middle font-medium">SKU</th>
                        <th className="h-12 px-4 align-middle font-medium">Qty (Rcv/Req)</th>
                        <th className="h-12 px-4 text-right align-middle font-medium">Est. Price</th>
                        <th className="h-12 px-4 text-right align-middle font-medium">Actual Price</th>
                        <th className="h-12 px-4 text-right align-middle font-medium">Total</th>
                        <th className="h-12 px-4 align-middle font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pr.items?.map((item) => (
                        <tr key={item.id} className="border-b border-border transition-colors hover:bg-muted/50">
                          <td className="px-4 py-3 font-medium">
                            <ItemNameHoverCard
                              name={getItemName(item)}
                              sku={getItemSku(item)}
                              item={{
                                id: item.master_item_id,
                                name: getItemName(item),
                                sku: getItemSku(item),
                                unit: item.unit,
                                reorder_quantity: item.quantity,
                              }}
                              className="cursor-default"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <code className="rounded bg-muted px-2 py-1 text-xs">
                              {getItemSku(item)}
                            </code>
                            <span className="ml-2 text-muted-foreground">{item.unit}</span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline">
                              {item.received_quantity || 0} / {item.quantity}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">฿{item.estimated_unit_cost?.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">
                            {item.actual_unit_cost ? `฿${item.actual_unit_cost.toLocaleString()}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            ฿{((item.received_quantity || item.quantity) * (item.actual_unit_cost || item.estimated_unit_cost)).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{item.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="mt-2 shrink-0 rounded-md border border-border/70 bg-muted/20 px-4 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-muted-foreground">Total Estimated</span>
                  <span className="font-semibold">฿{totalEstimated.toLocaleString()}</span>
                </div>
                {pr.status === 'partially_received' || pr.status === 'fully_received' ? (
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-medium text-muted-foreground">Total Actual</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">฿{totalActual.toLocaleString()}</span>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
}
