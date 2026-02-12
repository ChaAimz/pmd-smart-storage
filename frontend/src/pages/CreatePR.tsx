import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Small } from '@/components/ui/typography';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ItemNameHoverCard } from '@/components/ui/item-name-hover-card';
import { PRPriorityBadge } from '@/components/ui/pr-priority-badge';
import { getPrPriorityBadgeClassName, getPrPriorityLabel } from '@/lib/pr-priority';
import { 
  ArrowLeft,
  Trash2, 
  Search,
  Plus,
  Loader2,
  ImagePlus,
  Package,
  CalendarDays,
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

interface PRCreateResponse {
  id: number;
  pr_number: string;
}

interface ExportItemRow {
  sku: string;
  item_name: string;
  unit: string;
  quantity: number;
  estimated_price: number;
  estimated_total: number;
  notes?: string;
}

interface PRExportData {
  pr_number: string;
  pr_date: string;
  required_date: string;
  priority: string;
  requester: string;
  department: string;
  store: string;
  notes?: string;
  total_estimated_amount: number;
  items: ExportItemRow[];
}

interface NewItemAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  data_url: string;
}

export function CreatePR() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<MasterItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeSearchItem, setActiveSearchItem] = useState<MasterItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<PRItem[]>([]);
  const [showCreateItemDialog, setShowCreateItemDialog] = useState(false);
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<string[]>(['General']);
  const [newItemSku, setNewItemSku] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('General');
  const [newItemUnit, setNewItemUnit] = useState('pcs');
  const [newItemBarcode, setNewItemBarcode] = useState('');
  const [newItemImageUrl, setNewItemImageUrl] = useState('');
  const [newItemImageUploading, setNewItemImageUploading] = useState(false);
  const [newItemImageDragOver, setNewItemImageDragOver] = useState(false);
  const [newItemAttachments, setNewItemAttachments] = useState<NewItemAttachment[]>([]);
  const [newItemAttachmentsUploading, setNewItemAttachmentsUploading] = useState(false);
  const [newItemReorderPoint, setNewItemReorderPoint] = useState('0');
  const [newItemReorderQty, setNewItemReorderQty] = useState('0');
  const [newItemSafetyStock, setNewItemSafetyStock] = useState('0');
  const [newItemLeadTimeDays, setNewItemLeadTimeDays] = useState('7');
  const [newItemSupplierName, setNewItemSupplierName] = useState('');
  const [newItemUnitCost, setNewItemUnitCost] = useState('0');
  
  // PR Info - no need to add supplier when creating
  const [priority, setPriority] = useState('normal');
  const [requiredDate, setRequiredDate] = useState('');
  const [notes, setNotes] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);
  const newItemImageInputRef = useRef<HTMLInputElement>(null);
  const newItemAttachmentInputRef = useRef<HTMLInputElement>(null);

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
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const delay = setTimeout(async () => {
      try {
        const response = await api.get<MasterItem[]>(`/master-items?search=${searchTerm}`);
        if (response.success) {
          setSearchResults(response.data || []);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delay);
  }, [searchTerm]);

  useEffect(() => {
    async function loadCategories() {
      try {
        const categories = await api.getCategories(true)
        const active = categories
          .filter((category) => category.is_active)
          .map((category) => category.name)
        if (active.length > 0) {
          setCategoryOptions(active)
          setNewItemCategory(active[0])
        }
      } catch {
        setCategoryOptions(['General'])
      }
    }

    loadCategories()
  }, [])

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
    setActiveSearchItem(null);
  };

  const handleAddItemFromInput = () => {
    const keyword = searchTerm.trim().toLowerCase()
    if (!keyword) {
      toast.error('Please type item name or SKU')
      return
    }

    if (activeSearchItem) {
      addItem(activeSearchItem)
      return
    }

    const exactMatch = searchResults.find((item) =>
      item.sku.toLowerCase() === keyword || item.name.toLowerCase() === keyword
    )
    if (exactMatch) {
      addItem(exactMatch)
      return
    }

    if (searchResults.length === 1) {
      addItem(searchResults[0])
      return
    }

    toast.error('Please select an item from suggestions first')
  }

  const handleCreateNewItem = () => {
    const keyword = searchTerm.trim()
    setNewItemName(keyword || '')
    setNewItemSku('')
    setNewItemCategory(categoryOptions[0] || 'General')
    setNewItemUnit('pcs')
    setNewItemBarcode('')
    setNewItemImageUrl('')
    setNewItemImageUploading(false)
    setNewItemAttachments([])
    setNewItemAttachmentsUploading(false)
    setNewItemReorderPoint('0')
    setNewItemReorderQty('0')
    setNewItemSafetyStock('0')
    setNewItemLeadTimeDays('7')
    setNewItemSupplierName('')
    setNewItemUnitCost('0')
    setShowCreateItemDialog(true)
  }

  const handleNewItemImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    void handleNewItemImageFile(file)
  }

  const handleNewItemImageFile = async (file: File) => {
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    setNewItemImageUploading(true)
    try {
      const result = await readFileAsDataUrl(file)
      setNewItemImageUrl(result)
    } catch {
      toast.error('Failed to read image file')
    } finally {
      setNewItemImageUploading(false)
    }
  }

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result)
        else reject(new Error('Invalid file content'))
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })

  const handleNewItemAttachmentsUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    try {
      setNewItemAttachmentsUploading(true)
      const next = await Promise.all(
        files.map(async (file) => ({
          id: `${file.name}-${file.size}-${file.lastModified}`,
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          data_url: await readFileAsDataUrl(file),
        }))
      )

      setNewItemAttachments((prev) => {
        const exists = new Set(prev.map((attachment) => attachment.id))
        const uniqueNew = next.filter((attachment) => !exists.has(attachment.id))
        return [...prev, ...uniqueNew]
      })
    } catch {
      toast.error('Failed to attach one or more files')
    } finally {
      setNewItemAttachmentsUploading(false)
      if (event.target) event.target.value = ''
    }
  }

  const removeAttachment = (attachmentId: string) => {
    setNewItemAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId))
  }

  const handleConfirmCreateNewItem = async () => {
    const sku = newItemSku.trim()
    const name = newItemName.trim()
    const category = newItemCategory.trim()
    const unit = newItemUnit.trim() || 'pcs'
    const reorderPoint = Math.max(0, Number.parseInt(newItemReorderPoint, 10) || 0)
    const reorderQty = Math.max(0, Number.parseInt(newItemReorderQty, 10) || 0)
    const safetyStock = Math.max(0, Number.parseInt(newItemSafetyStock, 10) || 0)
    const leadTimeDays = Math.max(0, Number.parseInt(newItemLeadTimeDays, 10) || 0)
    const unitCost = Math.max(0, Number.parseFloat(newItemUnitCost) || 0)
    const supplierName = newItemSupplierName.trim()
    const barcode = newItemBarcode.trim()
    const imageUrl = newItemImageUrl.trim()

    if (!sku || !name || !category) {
      toast.error('SKU, Item Name, and Category are required')
      return
    }

    try {
      setIsCreatingItem(true)
      const created = await api.createItem({
        sku,
        name,
        category,
        unit,
        description: barcode || undefined,
        reorder_point: reorderPoint,
        reorder_quantity: reorderQty,
        safety_stock: safetyStock,
        lead_time_days: leadTimeDays,
        supplier_name: supplierName || undefined,
        unit_cost: unitCost,
        image_url: imageUrl || undefined,
        attachments: newItemAttachments.map((attachment) => ({
          name: attachment.name,
          type: attachment.type,
          size: attachment.size,
          data_url: attachment.data_url,
        })),
      })

      const createdItem: MasterItem = {
        id: created.id,
        sku,
        name,
        unit,
        category,
      }

      addItem(createdItem)
      setShowCreateItemDialog(false)
      toast.success('Item created and added to PR')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create item'
      toast.error(message)
    } finally {
      setIsCreatingItem(false)
    }
  }

  const removeItem = (index: number) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof PRItem, value: PRItem[keyof PRItem]) => {
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
      
      const response = await api.post<PRCreateResponse>('/prs', {
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
        const created = response.data;
        if (!created) {
          toast.error('Failed to create PR');
          return;
        }
        toast.success('PR created successfully', {
          description: `Number: ${created.pr_number}`
        });
        
        // Export Excel อัตโนมัติเพื่อส่งให้จัดซื้อ
        await exportToExcel(created.id);
        
        toast.info('Excel export successful, please send to Purchasing');
        
        navigate('/prs');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create PR';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

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
      const itemsData = data.items.map((item: ExportItemRow, idx: number) => [
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
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto lg:overflow-hidden">
      <div className="h-full min-h-0 flex flex-col gap-4 px-2.5 pt-2.5 pb-1.5 lg:px-3.5 lg:pt-3.5 lg:pb-2.5">
        <Card className="shrink-0 border-border/70 bg-background/90 dark:border-border/60 dark:bg-background/70">
          <CardContent className="space-y-4 p-6">
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
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <FileText className="h-5 w-5 text-blue-500" />
                  <span className="text-xl font-semibold">Create PR</span>
                  <PRPriorityBadge priority={priority} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => navigate('/prs')}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={loading || selectedItems.length === 0}>
                  {loading ? 'Saving...' : 'Save PR'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 border-t pt-4 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Priority</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(['low', 'normal', 'high', 'urgent'] as const).map((p) => (
                    <Badge
                      key={p}
                      variant="outline"
                      className={`cursor-pointer border-0 transition-opacity ${getPrPriorityBadgeClassName(p)} ${priority === p ? '' : 'opacity-55'}`}
                      onClick={() => setPriority(p)}
                    >
                      {getPrPriorityLabel(p)}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Required Date</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="date"
                    className="pl-8"
                    value={requiredDate}
                    onChange={(e) => setRequiredDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Items</Label>
                <div className="text-sm font-semibold text-foreground">{selectedItems.length} items</div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Total Estimated</Label>
                <div className="text-sm font-semibold text-foreground">฿{calculateTotal().toLocaleString()}</div>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="pr-create-notes">Notes</Label>
              <Textarea
                id="pr-create-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter reason for purchase or additional details..."
                className="min-h-[44px]"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/70 bg-background/90 dark:border-border/60 dark:bg-background/70">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="shrink-0 flex items-center gap-2">
                <Package className="h-5 w-5" />
                Items to Purchase ({selectedItems.length})
              </CardTitle>
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
                <div className="relative w-full sm:w-[420px]" ref={searchRef}>
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Type item name or SKU..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value)
                      setActiveSearchItem(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddItemFromInput()
                      }
                    }}
                  />
                  {(searchTerm.trim().length >= 2) && (
                    <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-background shadow-lg">
                      {isSearching ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Searching...</div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="flex w-full items-center justify-between border-b border-border px-3 py-2 text-left hover:bg-muted/50"
                            onClick={() => {
                              setSearchTerm(`${item.name} (${item.sku})`)
                              setActiveSearchItem(item)
                              setSearchResults([])
                            }}
                          >
                            <div>
                              <div className="font-medium text-sm">{item.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {item.sku} · {item.unit}
                              </div>
                            </div>
                            <Plus className="h-4 w-4 text-muted-foreground" />
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2">
                          <p className="mb-2 text-sm text-muted-foreground">No matching item found</p>
                          <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleCreateNewItem}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create new item
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto shrink-0"
                  onClick={handleAddItemFromInput}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="min-h-0 flex flex-1 flex-col px-4 pb-4 pt-0">

            <div className="h-full min-h-0 flex-1 overflow-hidden rounded-lg border border-border/70 bg-background">
              <div className="h-full overflow-auto">
                <table className="w-full min-w-[980px] border-collapse text-sm">
                    <thead className="sticky top-0 z-10 overflow-hidden rounded-t-lg bg-muted/50 text-left text-sm text-muted-foreground backdrop-blur-xl">
                      <tr className="border-b border-border">
                        <th className="h-12 px-4 align-middle font-medium">Item</th>
                        <th className="h-12 px-4 align-middle font-medium">SKU</th>
                        <th className="h-12 px-4 align-middle font-medium">Qty</th>
                        <th className="h-12 px-4 align-middle font-medium">Est. Unit Price</th>
                        <th className="h-12 px-4 text-right align-middle font-medium">Line Total</th>
                        <th className="h-12 px-4 align-middle font-medium">Notes</th>
                        <th className="h-12 px-4 align-middle font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((item, index) => (
                        <tr key={item.master_item_id} className="border-b border-border transition-colors hover:bg-muted/50">
                          <td className="px-4 py-3 font-medium">
                            <ItemNameHoverCard
                              name={item.name}
                              sku={item.sku}
                              item={{
                                id: item.master_item_id,
                                name: item.name,
                                sku: item.sku,
                                unit: item.unit,
                                reorder_quantity: item.quantity,
                              }}
                              className="cursor-default"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <code className="rounded bg-muted px-2 py-1 text-xs">{item.sku}</code>
                            <span className="ml-2 text-muted-foreground">{item.unit}</span>
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', Number.parseInt(e.target.value, 10) || 0)}
                              className="h-9 w-24"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.estimated_unit_cost}
                              onChange={(e) => updateItem(index, 'estimated_unit_cost', Number.parseFloat(e.target.value) || 0)}
                              className="h-9 w-32"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            ฿{(item.quantity * item.estimated_unit_cost).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              placeholder="Item notes"
                              value={item.notes}
                              onChange={(e) => updateItem(index, 'notes', e.target.value)}
                              className="h-9"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}>
                              <Trash2 className="h-4 w-4 text-rose-500" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {selectedItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                            No items yet. Search and add items to create PR.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
              </div>
            </div>

            <div className="mt-2 shrink-0 rounded-md border border-border/70 bg-muted/20 px-4 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-muted-foreground">Total Estimated</span>
                <span className="font-semibold">฿{calculateTotal().toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreateItemDialog} onOpenChange={setShowCreateItemDialog}>
        <DialogContent className="max-w-5xl p-5">
          <DialogHeader>
            <DialogTitle>Create New Item</DialogTitle>
            <DialogDescription>
              Add full item details and use this item in the current PR.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-1 lg:grid-cols-12">
            <div className="space-y-3 rounded-md border border-border/60 p-4 lg:col-span-7">
              <Small className="text-muted-foreground">Basic Information</Small>
              <div className="space-y-1">
                <Label htmlFor="new-item-image-upload" className="sr-only">Image Upload</Label>
                <Input
                  id="new-item-image-upload"
                  ref={newItemImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleNewItemImageUpload}
                  className="hidden"
                />
                <div
                  className={`relative w-[240px] overflow-hidden rounded-xl border border-dashed transition-colors ${
                    newItemImageDragOver ? 'border-primary bg-primary/5' : 'border-border/70 bg-muted/20'
                  }`}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setNewItemImageDragOver(true)
                  }}
                  onDragLeave={() => setNewItemImageDragOver(false)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setNewItemImageDragOver(false)
                    const file = event.dataTransfer.files?.[0]
                    if (file) {
                      void handleNewItemImageFile(file)
                    }
                  }}
                >
                  <button
                    type="button"
                    className="relative flex h-[140px] w-full items-center justify-center p-4 text-center"
                    onClick={() => newItemImageInputRef.current?.click()}
                    disabled={newItemImageUploading}
                  >
                    {newItemImageUrl ? (
                      <img
                        src={newItemImageUrl}
                        alt="New item preview"
                        className="h-full w-full rounded-sm object-cover"
                      />
                    ) : (
                      <div className="space-y-2">
                        <div className="flex justify-center text-muted-foreground">
                          <ImagePlus className="h-6 w-6" />
                        </div>
                        <p className="text-sm leading-5">
                          <span className="text-muted-foreground">Drop your image here, or select </span>
                          <span className="font-medium text-primary">Click to browse</span>
                        </p>
                      </div>
                    )}
                  </button>
                  {newItemImageUploading ? (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/75">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  ) : null}
                  {newItemImageUrl ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="absolute bottom-2 right-2 h-7 px-2 text-xs"
                      onClick={() => setNewItemImageUrl('')}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
                {newItemImageUrl ? (
                  <div className="mt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => newItemImageInputRef.current?.click()}
                      disabled={newItemImageUploading}
                    >
                      Change image
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="new-item-sku" className="text-xs">SKU *</Label>
                  <Input
                    id="new-item-sku"
                    value={newItemSku}
                    onChange={(e) => setNewItemSku(e.target.value)}
                    placeholder="SKU-XXXX"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Category *</Label>
                  <Select value={newItemCategory} onValueChange={setNewItemCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="new-item-name" className="text-xs">Product Name *</Label>
                <Input
                  id="new-item-name"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Enter product name"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="new-item-unit" className="text-xs">Unit</Label>
                  <Input
                    id="new-item-unit"
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    placeholder="pcs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-item-barcode" className="text-xs">Barcode (Optional)</Label>
                  <Input
                    id="new-item-barcode"
                    value={newItemBarcode}
                    onChange={(e) => setNewItemBarcode(e.target.value)}
                    placeholder="Scan or enter barcode"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Input
                  ref={newItemAttachmentInputRef}
                  type="file"
                  multiple
                  onChange={handleNewItemAttachmentsUpload}
                  className="hidden"
                />
                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => newItemAttachmentInputRef.current?.click()}
                    disabled={newItemAttachmentsUploading}
                  >
                    {newItemAttachmentsUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Attaching...
                      </>
                    ) : (
                      'Attach files'
                    )}
                  </Button>
                  {newItemAttachments.length > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {newItemAttachments.length} file(s) attached
                    </span>
                  ) : null}
                </div>
                {newItemAttachments.length > 0 ? (
                  <div className="max-h-24 space-y-1 overflow-auto rounded-md border border-border/70 bg-muted/10 p-2">
                    {newItemAttachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-foreground">
                          {attachment.name}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => removeAttachment(attachment.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

            </div>

            <div className="space-y-3 rounded-md border border-border/60 p-4 lg:col-span-5">
              <Small className="text-muted-foreground">Inventory Planning</Small>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="new-item-reorder-point" className="text-xs">Reorder Point *</Label>
                  <Input
                    id="new-item-reorder-point"
                    type="number"
                    min={0}
                    value={newItemReorderPoint}
                    onChange={(e) => setNewItemReorderPoint(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-item-reorder-qty" className="text-xs">Reorder Quantity *</Label>
                  <Input
                    id="new-item-reorder-qty"
                    type="number"
                    min={0}
                    value={newItemReorderQty}
                    onChange={(e) => setNewItemReorderQty(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-item-safety-stock" className="text-xs">Safety Stock</Label>
                  <Input
                    id="new-item-safety-stock"
                    type="number"
                    min={0}
                    value={newItemSafetyStock}
                    onChange={(e) => setNewItemSafetyStock(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-item-lead-time" className="text-xs">Lead Time (Days)</Label>
                  <Input
                    id="new-item-lead-time"
                    type="number"
                    min={0}
                    value={newItemLeadTimeDays}
                    onChange={(e) => setNewItemLeadTimeDays(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-1 border-t pt-3">
                <Small className="text-muted-foreground">Supplier Information</Small>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="new-item-supplier" className="text-xs">Supplier Name</Label>
                  <Input
                    id="new-item-supplier"
                    value={newItemSupplierName}
                    onChange={(e) => setNewItemSupplierName(e.target.value)}
                    placeholder="Enter supplier name"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-item-unit-cost" className="text-xs">Unit Cost (฿)</Label>
                  <Input
                    id="new-item-unit-cost"
                    type="number"
                    step="0.01"
                    min={0}
                    value={newItemUnitCost}
                    onChange={(e) => setNewItemUnitCost(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateItemDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmCreateNewItem} disabled={isCreatingItem}>
              {isCreatingItem ? 'Creating...' : 'Create & Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
