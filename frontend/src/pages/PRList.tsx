import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { TableLoadingSkeleton } from '@/components/ui/loading-state';
import { PRPriorityBadge } from '@/components/ui/pr-priority-badge';
import { PRStatusBadge } from '@/components/ui/pr-status-badge';
import { isPrReceivable } from '@/lib/pr-status';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Search,
  Plus, 
  Download, 
  Package,
  Eye,
  Filter,
  MoreVertical,
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

interface ExportItemRow {
  sku: string;
  item_name: string;
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

export function PRList() {
  const navigate = useNavigate();
  const [prs, setPrs] = useState<PR[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPRs = useCallback(async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { status: filter } : undefined;
      const response = await api.get<PR[]>('/prs', params);
      if (response.success) {
        setPrs(response.data || []);
      }
    } catch {
      toast.error('Failed to fetch PRs');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void fetchPRs();
  }, [fetchPRs]);

  const exportToExcel = async (prId: number) => {
    try {
      const response = await api.get<PRExportData>(`/prs/${prId}/export`);
      if (!response.success) {
        toast.error('Failed to export');
        return;
      }

      // Dynamic import xlsx
      const XLSX = await import('xlsx');
      const data = response.data as PRExportData;
      
      // Create worksheet
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

      // Add items
      const itemsHeader = ['No.', 'Code/SKU', 'Item', 'Unit', 'Quantity', 'Est. Unit Price', 'Total'];
      const itemsData = data.items.map((item: ExportItemRow, idx: number) => [
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
      toast.success('Excel export successful', {
        description: 'Send file to Purchasing now'
      });
    } catch {
      toast.error('Export failed');
    }
  };

  const handleReceive = (prId: number) => {
    navigate(`/prs/${prId}/receive`);
  };

  const getNextAction = (pr: PR) => {
    if (isPrReceivable(pr.status)) {
      return { text: 'Ready to Receive', canReceive: true };
    }
    return { text: 'Fully Received', canReceive: false };
  };

  const filteredPrs = prs.filter((pr) => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return true;
    return (
      pr.pr_number.toLowerCase().includes(keyword) ||
      (pr.requester_name || '').toLowerCase().includes(keyword) ||
      (pr.status || '').toLowerCase().includes(keyword)
    );
  });

  return (
    <div className="h-full min-h-0 overflow-y-auto lg:overflow-hidden">
      <div className="h-full min-h-0 flex flex-col gap-4 px-2.5 pt-2.5 pb-1.5 lg:px-3.5 lg:pt-3.5 lg:pb-2.5">
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/70 bg-background/90 dark:border-border/60 dark:bg-background/70">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="shrink-0">PR List</CardTitle>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Badge className="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground hover:bg-primary">
                  {filteredPrs.length}
                </Badge>
              </div>
              <div className="relative w-full sm:w-[360px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search PR number, requester, status..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    {filter === 'all' ? 'All' : filter}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'ordered', label: 'Ordered' },
                    { key: 'partially_received', label: 'Partially Received' },
                    { key: 'fully_received', label: 'Fully Received' }
                  ].map((f) => (
                    <DropdownMenuItem key={f.key} onClick={() => setFilter(f.key)}>
                      {f.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button className="gap-2" onClick={() => navigate('/prs/create')}>
                <Plus className="h-4 w-4" />
                Create PR
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-0">
          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border/70 bg-background">
            <div className="h-full overflow-auto">
              {loading ? (
                <div className="p-4">
                  <TableLoadingSkeleton />
                </div>
              ) : filteredPrs.length === 0 ? (
                <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
                  No PR records
                </div>
              ) : (
                <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth: '980px' }}>
                  <colgroup>
                    <col style={{ width: 190 }} />
                    <col style={{ width: 170 }} />
                    <col style={{ width: 150 }} />
                    <col style={{ width: 180 }} />
                    <col style={{ width: 170 }} />
                    <col style={{ width: 110 }} />
                    <col style={{ width: 140 }} />
                    <col style={{ width: 120 }} />
                  </colgroup>
                  <thead className="sticky top-0 z-10 overflow-hidden rounded-t-lg bg-muted/50 text-left text-sm text-muted-foreground backdrop-blur-xl">
                    <tr className="border-b border-border">
                      <th className="h-12 px-4 align-middle font-medium">PR Number</th>
                      <th className="h-12 px-4 align-middle font-medium">Status</th>
                      <th className="h-12 px-4 align-middle font-medium">Priority</th>
                      <th className="h-12 px-4 align-middle font-medium">Requester</th>
                      <th className="h-12 px-4 align-middle font-medium">Required Date</th>
                      <th className="h-12 px-4 text-right align-middle font-medium">Items</th>
                      <th className="h-12 px-4 text-right align-middle font-medium">Amount</th>
                      <th className="h-12 px-4 align-middle font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPrs.map((pr) => {
                      const nextAction = getNextAction(pr);
                      return (
                        <tr key={pr.id} className="border-b border-border transition-colors hover:bg-muted/50">
                          <td className="px-4 py-3 font-medium">
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 font-semibold text-foreground hover:text-primary"
                              onClick={() => navigate(`/prs/${pr.id}`)}
                            >
                              {pr.pr_number}
                            </Button>
                          </td>
                          <td className="px-4 py-3">
                            <PRStatusBadge status={pr.status} />
                          </td>
                          <td className="px-4 py-3">
                            <PRPriorityBadge priority={pr.priority} />
                          </td>
                          <td className="px-4 py-3">{pr.requester_name}</td>
                          <td className="px-4 py-3">{new Date(pr.required_date).toLocaleDateString('th-TH')}</td>
                          <td className="px-4 py-3 text-right">{pr.item_count}</td>
                          <td className="px-4 py-3 text-right">฿{pr.estimated_total?.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => exportToExcel(pr.id)}>
                                  <Download className="mr-2 h-4 w-4" />
                                  Export
                                </DropdownMenuItem>
                                {nextAction.canReceive && (
                                  <DropdownMenuItem onClick={() => handleReceive(pr.id)}>
                                    <Package className="mr-2 h-4 w-4" />
                                    Receive
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => navigate(`/prs/${pr.id}`)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
