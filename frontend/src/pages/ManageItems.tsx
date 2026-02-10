import { useState, useEffect, type MouseEvent as ReactMouseEvent } from 'react'
import { motion } from 'framer-motion'
import { Search, Plus, Edit, Trash2, Download, Filter, MoreVertical, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import * as api from '@/services/api'

// Using api.Item type from services/api.ts

const categories = ['All', 'Electronics', 'Clothing', 'Food', 'Tools', 'Hardware', 'Office Supplies', 'Other']
type SortColumn = 'sku' | 'name' | 'category' | 'quantity' | 'reorder_point' | 'lead_time_days' | 'supplier_name' | 'status'
type ColumnKey = SortColumn | 'actions'

const COLUMN_WIDTH_STORAGE_KEY = 'manage-items-column-widths-v1'
const DEFAULT_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  sku: 160,
  name: 280,
  category: 170,
  quantity: 170,
  reorder_point: 180,
  lead_time_days: 130,
  supplier_name: 170,
  status: 140,
  actions: 96,
}

const COLUMN_MIN_WIDTHS: Record<ColumnKey, number> = {
  sku: 120,
  name: 180,
  category: 120,
  quantity: 120,
  reorder_point: 130,
  lead_time_days: 110,
  supplier_name: 140,
  status: 120,
  actions: 84,
}

export function ManageItems() {
  const [items, setItems] = useState<api.Item[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedItem, setSelectedItem] = useState<api.Item | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [sortColumn, setSortColumn] = useState<SortColumn>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(() => {
    if (typeof window === 'undefined') return DEFAULT_COLUMN_WIDTHS

    try {
      const saved = window.localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY)
      if (!saved) return DEFAULT_COLUMN_WIDTHS

      const parsed = JSON.parse(saved) as Partial<Record<ColumnKey, number>>
      return {
        sku: Number.isFinite(parsed.sku) ? Math.max(parsed.sku as number, COLUMN_MIN_WIDTHS.sku) : DEFAULT_COLUMN_WIDTHS.sku,
        name: Number.isFinite(parsed.name) ? Math.max(parsed.name as number, COLUMN_MIN_WIDTHS.name) : DEFAULT_COLUMN_WIDTHS.name,
        category: Number.isFinite(parsed.category) ? Math.max(parsed.category as number, COLUMN_MIN_WIDTHS.category) : DEFAULT_COLUMN_WIDTHS.category,
        quantity: Number.isFinite(parsed.quantity) ? Math.max(parsed.quantity as number, COLUMN_MIN_WIDTHS.quantity) : DEFAULT_COLUMN_WIDTHS.quantity,
        reorder_point: Number.isFinite(parsed.reorder_point)
          ? Math.max(parsed.reorder_point as number, COLUMN_MIN_WIDTHS.reorder_point)
          : DEFAULT_COLUMN_WIDTHS.reorder_point,
        lead_time_days: Number.isFinite(parsed.lead_time_days)
          ? Math.max(parsed.lead_time_days as number, COLUMN_MIN_WIDTHS.lead_time_days)
          : DEFAULT_COLUMN_WIDTHS.lead_time_days,
        supplier_name: Number.isFinite(parsed.supplier_name)
          ? Math.max(parsed.supplier_name as number, COLUMN_MIN_WIDTHS.supplier_name)
          : DEFAULT_COLUMN_WIDTHS.supplier_name,
        status: Number.isFinite(parsed.status) ? Math.max(parsed.status as number, COLUMN_MIN_WIDTHS.status) : DEFAULT_COLUMN_WIDTHS.status,
        actions: Number.isFinite(parsed.actions) ? Math.max(parsed.actions as number, COLUMN_MIN_WIDTHS.actions) : DEFAULT_COLUMN_WIDTHS.actions,
      }
    } catch (error) {
      console.error('Failed to load saved column widths:', error)
      return DEFAULT_COLUMN_WIDTHS
    }
  })


  useEffect(() => {
    async function fetchItems() {
      try {
        const data = await api.getAllItems()
        setItems(data)
      } catch (error) {
        console.error('Error fetching items:', error)
        toast.error('Failed to load items')
      }
    }

    fetchItems()
  }, [])

  useEffect(() => {
    window.localStorage.setItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(columnWidths))
  }, [columnWidths])

  const tableMinWidth = Object.values(columnWidths).reduce((sum, width) => sum + width, 0)

  const handleColumnResizeStart = (column: ColumnKey, event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = columnWidths[column]
    const minWidth = COLUMN_MIN_WIDTHS[column]

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const nextWidth = Math.max(minWidth, Math.round(startWidth + deltaX))
      setColumnWidths((prev) => ({ ...prev, [column]: nextWidth }))
    }

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const getStatusRank = (item: api.Item) => {
    if (item.quantity === 0) return 0
    if (item.quantity <= item.reorder_point) return 1
    return 2
  }

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortColumn(column)
    setSortDirection(
      column === 'quantity' || column === 'reorder_point' || column === 'lead_time_days' || column === 'status'
        ? 'desc'
        : 'asc'
    )
  }

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
    return sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
  }

  const filteredItems = items
    .filter((item) => {
      // Handle API response structure with master_name/master_sku
      const itemName = item.name || (item as any).master_name || ''
      const itemSku = item.sku || (item as any).master_sku || (item as any).local_sku || ''
      const matchesSearch =
        itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        itemSku.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory =
        selectedCategory === 'All' || item.category === selectedCategory
      return matchesSearch && matchesCategory
    })
    .sort((a, b) => {
      const nameA = a.name || (a as any).master_name || ''
      const nameB = b.name || (b as any).master_name || ''
      const skuA = a.sku || (a as any).master_sku || (a as any).local_sku || ''
      const skuB = b.sku || (b as any).master_sku || (b as any).local_sku || ''
      const categoryA = a.category || (a as any).master_category || ''
      const categoryB = b.category || (b as any).master_category || ''
      const supplierA = a.supplier_name || ''
      const supplierB = b.supplier_name || ''

      let comparison = 0
      switch (sortColumn) {
        case 'sku':
          comparison = skuA.localeCompare(skuB)
          break
        case 'name':
          comparison = nameA.localeCompare(nameB)
          break
        case 'category':
          comparison = categoryA.localeCompare(categoryB)
          break
        case 'quantity':
          comparison = a.quantity - b.quantity
          break
        case 'reorder_point':
          comparison = a.reorder_point - b.reorder_point
          break
        case 'lead_time_days':
          comparison = (a.lead_time_days || 0) - (b.lead_time_days || 0)
          break
        case 'supplier_name':
          comparison = supplierA.localeCompare(supplierB)
          break
        case 'status':
          comparison = getStatusRank(a) - getStatusRank(b)
          break
        default:
          comparison = 0
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

  const getStatusBadge = (item: api.Item) => {
    if (item.quantity === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>
    } else if (item.quantity <= item.reorder_point) {
      return <Badge variant="default">Low Stock</Badge>
    } else {
      return <Badge className="bg-green-500 hover:bg-green-600">In Stock</Badge>
    }
  }

  const handleEdit = (item: api.Item) => {
    setSelectedItem(item)
    setShowEditDialog(true)
  }

  const handleDelete = (item: api.Item) => {
    setSelectedItem(item)
    setShowDeleteDialog(true)
  }

  const confirmDelete = () => {
    toast.success(`${selectedItem?.name} has been removed from inventory`)
    setShowDeleteDialog(false)
    setSelectedItem(null)
  }

  const handleExport = () => {
    toast.success('Your data is being exported...')
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto lg:overflow-hidden">
      <div className="h-full min-h-0 flex flex-col gap-4 px-2.5 pt-2.5 pb-1.5 lg:px-3.5 lg:pt-3.5 lg:pb-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Items</h1>
          <p className="text-muted-foreground">
            View and manage your inventory items
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Item</DialogTitle>
              <DialogDescription>
                Add a new item to your inventory
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-sku">SKU *</Label>
                    <Input id="new-sku" placeholder="SKU-XXXX" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-category">Category *</Label>
                    <select
                      id="new-category"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Select category...</option>
                      {categories.filter(c => c !== 'All').map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-name">Product Name *</Label>
                  <Input id="new-name" placeholder="Enter product name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-barcode">Barcode (Optional)</Label>
                  <Input id="new-barcode" placeholder="Scan or enter barcode" />
                </div>
              </div>

              {/* Inventory Planning */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-sm text-muted-foreground">Inventory Planning</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-reorder-point">Reorder Point *</Label>
                    <Input id="new-reorder-point" type="number" placeholder="0" />
                    <p className="text-xs text-muted-foreground">Trigger reorder when stock reaches this level</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-reorder-qty">Reorder Quantity *</Label>
                    <Input id="new-reorder-qty" type="number" placeholder="0" />
                    <p className="text-xs text-muted-foreground">How many units to order</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-safety-stock">Safety Stock</Label>
                    <Input id="new-safety-stock" type="number" placeholder="0" />
                    <p className="text-xs text-muted-foreground">Buffer inventory to prevent stockouts</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-lead-time">Lead Time (Days)</Label>
                    <Input id="new-lead-time" type="number" placeholder="7" />
                    <p className="text-xs text-muted-foreground">Days to receive after ordering</p>
                  </div>
                </div>
              </div>

              {/* Supplier Information */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-sm text-muted-foreground">Supplier Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-supplier">Supplier Name</Label>
                    <Input id="new-supplier" placeholder="Enter supplier name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-unit-cost">Unit Cost (฿)</Label>
                    <Input id="new-unit-cost" type="number" step="0.01" placeholder="0.00" />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                setShowCreateDialog(false)
                toast.success('New item has been added to inventory')
              }}>
                Create Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters and Search */}
      <Card className="border-border/70 bg-background/90 dark:border-border/60 dark:bg-background/70">
        <CardContent className="px-4 pb-4 pt-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search items by SKU or name..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    {selectedCategory}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {categories.map((cat) => (
                    <DropdownMenuItem
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" className="gap-2" onClick={handleExport}>
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/70 bg-background/90 dark:border-border/60 dark:bg-background/70">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Items</CardTitle>
              <CardDescription>
                {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} found
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-0">
          <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border/70">
            <table className="w-full table-fixed" style={{ minWidth: `${tableMinWidth}px` }}>
              <colgroup>
                <col style={{ width: columnWidths.sku }} />
                <col style={{ width: columnWidths.name }} />
                <col style={{ width: columnWidths.category }} />
                <col style={{ width: columnWidths.quantity }} />
                <col style={{ width: columnWidths.reorder_point }} />
                <col style={{ width: columnWidths.lead_time_days }} />
                <col style={{ width: columnWidths.supplier_name }} />
                <col style={{ width: columnWidths.status }} />
                <col style={{ width: columnWidths.actions }} />
              </colgroup>
              <thead>
                <tr className="sticky top-0 z-10 border-b border-border bg-background/72 text-left text-sm text-muted-foreground backdrop-blur-xl supports-[backdrop-filter]:bg-background/55">
                  <th className="relative h-12 px-4 align-middle font-medium">
                    <button type="button" className="inline-flex items-center gap-1.5 hover:text-foreground" onClick={() => handleSort('sku')}>
                      SKU
                      {getSortIcon('sku')}
                    </button>
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      onMouseDown={(event) => handleColumnResizeStart('sku', event)}
                      className="absolute -right-1 top-1 h-10 w-2 cursor-col-resize rounded-sm transition-colors hover:bg-primary/20"
                    />
                  </th>
                  <th className="relative h-12 px-4 align-middle font-medium">
                    <button type="button" className="inline-flex items-center gap-1.5 hover:text-foreground" onClick={() => handleSort('name')}>
                      Name
                      {getSortIcon('name')}
                    </button>
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      onMouseDown={(event) => handleColumnResizeStart('name', event)}
                      className="absolute -right-1 top-1 h-10 w-2 cursor-col-resize rounded-sm transition-colors hover:bg-primary/20"
                    />
                  </th>
                  <th className="relative h-12 px-4 align-middle font-medium">
                    <button type="button" className="inline-flex items-center gap-1.5 hover:text-foreground" onClick={() => handleSort('category')}>
                      Category
                      {getSortIcon('category')}
                    </button>
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      onMouseDown={(event) => handleColumnResizeStart('category', event)}
                      className="absolute -right-1 top-1 h-10 w-2 cursor-col-resize rounded-sm transition-colors hover:bg-primary/20"
                    />
                  </th>
                  <th className="relative h-12 px-4 align-middle font-medium">
                    <button type="button" className="inline-flex items-center gap-1.5 hover:text-foreground" onClick={() => handleSort('quantity')}>
                      Quantity
                      {getSortIcon('quantity')}
                    </button>
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      onMouseDown={(event) => handleColumnResizeStart('quantity', event)}
                      className="absolute -right-1 top-1 h-10 w-2 cursor-col-resize rounded-sm transition-colors hover:bg-primary/20"
                    />
                  </th>
                  <th className="relative h-12 px-4 align-middle font-medium">
                    <button type="button" className="inline-flex items-center gap-1.5 hover:text-foreground" onClick={() => handleSort('reorder_point')}>
                      Reorder Point
                      {getSortIcon('reorder_point')}
                    </button>
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      onMouseDown={(event) => handleColumnResizeStart('reorder_point', event)}
                      className="absolute -right-1 top-1 h-10 w-2 cursor-col-resize rounded-sm transition-colors hover:bg-primary/20"
                    />
                  </th>
                  <th className="relative h-12 px-4 align-middle font-medium">
                    <button type="button" className="inline-flex items-center gap-1.5 hover:text-foreground" onClick={() => handleSort('lead_time_days')}>
                      Lead Time
                      {getSortIcon('lead_time_days')}
                    </button>
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      onMouseDown={(event) => handleColumnResizeStart('lead_time_days', event)}
                      className="absolute -right-1 top-1 h-10 w-2 cursor-col-resize rounded-sm transition-colors hover:bg-primary/20"
                    />
                  </th>
                  <th className="relative h-12 px-4 align-middle font-medium">
                    <button type="button" className="inline-flex items-center gap-1.5 hover:text-foreground" onClick={() => handleSort('supplier_name')}>
                      Supplier
                      {getSortIcon('supplier_name')}
                    </button>
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      onMouseDown={(event) => handleColumnResizeStart('supplier_name', event)}
                      className="absolute -right-1 top-1 h-10 w-2 cursor-col-resize rounded-sm transition-colors hover:bg-primary/20"
                    />
                  </th>
                  <th className="relative h-12 px-4 align-middle font-medium">
                    <button type="button" className="inline-flex items-center gap-1.5 hover:text-foreground" onClick={() => handleSort('status')}>
                      Status
                      {getSortIcon('status')}
                    </button>
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      onMouseDown={(event) => handleColumnResizeStart('status', event)}
                      className="absolute -right-1 top-1 h-10 w-2 cursor-col-resize rounded-sm transition-colors hover:bg-primary/20"
                    />
                  </th>
                  <th className="relative h-12 px-4 align-middle font-medium">
                    Actions
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      onMouseDown={(event) => handleColumnResizeStart('actions', event)}
                      className="absolute -right-1 top-1 h-10 w-2 cursor-col-resize rounded-sm transition-colors hover:bg-primary/20"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => {
                  // Handle API response structure
                  const itemName = item.name || (item as any).master_name || (item as any).local_name || 'N/A'
                  const itemSku = item.sku || (item as any).master_sku || (item as any).local_sku || 'N/A'
                  const itemCategory = item.category || (item as any).master_category || 'General'
                  return (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-border transition-colors hover:bg-muted/50"
                  >
                    <td className="px-4 py-3">
                      <code className="rounded bg-muted px-2 py-1 text-xs">
                        {itemSku}
                      </code>
                    </td>
                    <td className="px-4 py-3 font-medium">{itemName}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{itemCategory}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold">{item.quantity}</span>
                        <span className="text-xs text-muted-foreground">
                          Safety: {item.safety_stock}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold">{item.reorder_point}</span>
                        <span className="text-xs text-muted-foreground">
                          Qty: {item.reorder_quantity}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{item.lead_time_days} days</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{item.supplier_name}</span>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(item)}</td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(item)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(item)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </motion.tr>
                )})}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Item Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
            <DialogDescription>
              Update item information
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-sku">SKU *</Label>
                  <Input id="edit-sku" defaultValue={selectedItem.sku} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Category *</Label>
                  <select
                    id="edit-category"
                    defaultValue={selectedItem.category}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {categories.filter(c => c !== 'All').map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Product Name *</Label>
                <Input id="edit-name" defaultValue={selectedItem.name} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-min">Minimum Quantity</Label>
                  <Input id="edit-min" type="number" defaultValue={selectedItem.minQuantity} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-current">Current Quantity</Label>
                  <Input id="edit-current" type="number" defaultValue={selectedItem.quantity} disabled />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setShowEditDialog(false)
              toast.success(`${selectedItem?.name} has been updated successfully`)
            }}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
              <p className="font-semibold">{selectedItem.name}</p>
              <p className="text-sm text-muted-foreground">{selectedItem.sku}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}
