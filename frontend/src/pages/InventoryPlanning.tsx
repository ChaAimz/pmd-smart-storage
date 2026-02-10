import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { StatusCard } from '@/components/ui/status-card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertTriangle,
  TrendingDown,
  Package,
  ShoppingCart,
  Clock,
  DollarSign,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  ClipboardList,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import * as api from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { TableLoadingSkeleton } from '@/components/ui/loading-state'
import { H1, Lead } from '@/components/ui/typography'

const COMPACT_PRIMARY_BUTTON_CLASS = 'h-7 px-2.5 text-xs'

export default function InventoryPlanning() {
  const [lowStockItems, setLowStockItems] = useState<api.Item[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<api.PurchaseOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [showCreatePODialog, setShowCreatePODialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortColumn, setSortColumn] = useState<'name' | 'urgency' | 'value' | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const { user } = useAuth()


  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setIsLoading(true)
      const [lowStock, orders] = await Promise.all([
        api.getLowStockItems(),
        api.getPurchaseOrders()
      ])
      setLowStockItems(lowStock)
      setPurchaseOrders(orders)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load inventory planning data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSort = (column: 'name' | 'urgency' | 'value') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const getUrgencyLevel = (item: api.Item) => {
    const stockLevel = item.reorder_point ? (item.quantity / item.reorder_point) : 1
    if (stockLevel < 0.3) return 4 // Critical
    if (stockLevel < 0.5) return 3 // High
    if (stockLevel < 0.8) return 2 // Medium
    return 1 // Low
  }

  const filteredAndSortedItems = useMemo(() => {
    let filtered = lowStockItems

    // Filter
    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    // Sort
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let comparison = 0
        if (sortColumn === 'name') {
          comparison = a.name.localeCompare(b.name)
        } else if (sortColumn === 'urgency') {
          comparison = getUrgencyLevel(b) - getUrgencyLevel(a)
        } else if (sortColumn === 'value') {
          const aValue = (a.reorder_quantity || 0) * (a.unit_cost || 0)
          const bValue = (b.reorder_quantity || 0) * (b.unit_cost || 0)
          comparison = bValue - aValue
        }
        return sortDirection === 'asc' ? comparison : -comparison
      })
    }

    return filtered
  }, [lowStockItems, searchQuery, sortColumn, sortDirection])

  const getUrgencyBadge = (item: api.Item) => {
    const stockLevel = item.reorder_point ? (item.quantity / item.reorder_point) : 1
    if (stockLevel < 0.3) {
      return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Critical</Badge>
    } else if (stockLevel < 0.5) {
      return <Badge variant="default" className="gap-1 bg-orange-500"><AlertTriangle className="h-3 w-3" />High</Badge>
    } else if (stockLevel < 0.8) {
      return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Medium</Badge>
    }
    return <Badge variant="outline">Low</Badge>
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="gap-1 bg-green-500"><CheckCircle2 className="h-3 w-3" />Approved</Badge>
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>
      case 'ordered':
        return <Badge variant="default" className="gap-1"><ShoppingCart className="h-3 w-3" />Ordered</Badge>
      case 'received':
        return <Badge variant="default" className="gap-1 bg-blue-500"><Package className="h-3 w-3" />Received</Badge>
      case 'cancelled':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }


  const handleSelectItem = (itemId: number) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
  }

  const handleCreatePO = async () => {
    if (selectedItems.length === 0) {
      toast.error('Please select at least one item')
      return
    }

    try {
      const items = lowStockItems.filter(item => selectedItems.includes(item.id))
      const itemsJson = items.map(item => ({
        item_id: item.id,
        sku: item.sku,
        name: item.name,
        quantity: item.reorder_quantity || 0,
        unit_cost: item.unit_cost || 0
      }))

      await api.createPurchaseOrder({
        supplier_name: 'Default Supplier',
        items: itemsJson,
        created_by: user?.id || 0
      })

      toast.success('Purchase order created successfully')

      setShowCreatePODialog(false)
      setSelectedItems([])
      fetchData()
    } catch (error) {
      console.error('Error creating PO:', error)
      toast.error('Failed to create purchase order')
    }
  }

  const getSortIcon = (column: 'name' | 'urgency' | 'value') => {
    if (sortColumn !== column) return <ArrowUpDown className="h-4 w-4" />
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }

  const getStockLevel = (item: api.Item) => {
    if (!item.reorder_point) return 100
    return Math.min((item.quantity / item.reorder_point) * 100, 100)
  }

  // Calculate statistics
  const totalLowStockValue = lowStockItems.reduce((sum, item) =>
    sum + (item.reorder_quantity || 0) * (item.unit_cost || 0), 0
  )
  const criticalItems = lowStockItems.filter(item => getUrgencyLevel(item) === 4)
  const hasVisibleItems = filteredAndSortedItems.length > 0
  const allVisibleSelected = hasVisibleItems && filteredAndSortedItems.every((item) => selectedItems.includes(item.id))

  if (isLoading) {
    return (
      <div className="h-full min-h-0 overflow-y-auto lg:overflow-hidden">
        <div className="h-full min-h-0 flex flex-col gap-4 px-2.5 pt-2.5 pb-1.5 lg:px-3.5 lg:pt-3.5 lg:pb-2.5">
          <div className="flex items-center justify-between">
            <div>
              <H1 className="text-3xl">Inventory Planning</H1>
              <Lead>Monitor stock levels and manage reorder points</Lead>
            </div>
          </div>
          <Card className="border-border/70 bg-background/90 dark:border-border/60 dark:bg-background/70">
            <CardContent className="p-4">
              <TableLoadingSkeleton rows={8} />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto lg:overflow-hidden">
      <div className="h-full min-h-0 flex min-w-0 flex-col gap-4 px-2.5 pt-2.5 pb-1.5 lg:px-3.5 lg:pt-3.5 lg:pb-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <H1 className="text-3xl">Inventory Planning</H1>
          <Lead>Monitor stock levels and manage purchase orders</Lead>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreatePODialog(true)}
          disabled={selectedItems.length === 0}
          className={COMPACT_PRIMARY_BUTTON_CLASS}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Create PO ({selectedItems.length})
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <StatusCard
            title="Low Stock Items"
            value={lowStockItems.length}
            description="Items below reorder point"
            icon={TrendingDown}
            accentClassName="text-amber-700 dark:text-amber-300"
            valueClassName="text-amber-600 dark:text-amber-300"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <StatusCard
            title="Critical Items"
            value={criticalItems.length}
            description="Urgent reordering needed"
            icon={AlertCircle}
            accentClassName="text-rose-700 dark:text-rose-300"
            valueClassName="text-rose-600 dark:text-rose-300"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <StatusCard
            title="Reorder Value"
            value={`฿${totalLowStockValue.toLocaleString()}`}
            description="Estimated reorder cost"
            icon={DollarSign}
            accentClassName="text-violet-700 dark:text-violet-300"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <StatusCard
            title="Purchase Orders"
            value={purchaseOrders.length}
            description="Total POs created"
            icon={FileText}
            accentClassName="text-blue-700 dark:text-blue-300"
          />
        </motion.div>
      </div>


      {/* Tabs */}
      <Tabs defaultValue="low-stock" className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="low-stock" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Low Stock Items
          </TabsTrigger>
          <TabsTrigger value="purchase-orders" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Purchase Orders
          </TabsTrigger>
        </TabsList>

        {/* Low Stock Items Tab */}
        <TabsContent value="low-stock" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="h-full min-h-0"
          >
            <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/70 bg-background/90 dark:border-border/60 dark:bg-background/70">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-yellow-500" />
                      Low Stock Items
                    </CardTitle>
                    <CardDescription>Items requiring reordering</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-64"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-0">
                {filteredAndSortedItems.length === 0 ? (
                  <div className="flex min-h-0 flex-1 items-center justify-center py-12 text-center text-muted-foreground">
                    {searchQuery ? 'No items found matching your search' : 'All items are well stocked'}
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border/70 bg-background">
                    <table className="w-full min-w-[980px] border-collapse">
                      <thead className="sticky top-0 z-10 overflow-hidden rounded-t-lg bg-muted/50 text-left text-sm text-muted-foreground backdrop-blur-xl">
                        <tr className="border-b border-border">
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            <Checkbox
                              checked={allVisibleSelected}
                              onCheckedChange={(checked) => {
                                if (checked === true) {
                                  setSelectedItems(filteredAndSortedItems.map((item) => item.id))
                                } else {
                                  setSelectedItems([])
                                }
                              }}
                              disabled={!hasVisibleItems}
                              aria-label="Select all visible items"
                            />
                          </th>
                          <th
                            className="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                            onClick={() => handleSort('name')}
                          >
                            <div className="flex items-center gap-2">
                              Item
                              {getSortIcon('name')}
                            </div>
                          </th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            Stock Level
                          </th>
                          <th
                            className="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                            onClick={() => handleSort('urgency')}
                          >
                            <div className="flex items-center gap-2">
                              Urgency
                              {getSortIcon('urgency')}
                            </div>
                          </th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            Reorder Qty
                          </th>
                          <th
                            className="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                            onClick={() => handleSort('value')}
                          >
                            <div className="flex items-center gap-2">
                              Est. Cost
                              {getSortIcon('value')}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAndSortedItems.map((item, index) => (
                          <motion.tr
                            key={item.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="border-b border-border hover:bg-muted/50 transition-colors"
                          >
                            <td className="p-4">
                              <Checkbox
                                checked={selectedItems.includes(item.id)}
                                onCheckedChange={() => handleSelectItem(item.id)}
                                aria-label={`Select ${item.name}`}
                              />
                            </td>
                            <td className="p-4">
                              <div className="font-medium">{item.name}</div>
                              <div className="text-sm text-muted-foreground">
                                <code className="rounded bg-muted px-2 py-0.5 text-xs">{item.sku}</code>
                                {item.category && (
                                  <span className="ml-2 text-xs">• {item.category}</span>
                                )}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="font-medium">{item.quantity}</span>
                                  <span className="text-muted-foreground">/ {item.reorder_point}</span>
                                  <span className="text-xs text-muted-foreground">
                                    ({Math.round(getStockLevel(item))}%)
                                  </span>
                                </div>
                                <Progress
                                  value={getStockLevel(item)}
                                  className={`h-2 ${
                                    getStockLevel(item) < 30 ? '[&>div]:bg-red-500' :
                                    getStockLevel(item) < 50 ? '[&>div]:bg-yellow-500' :
                                    '[&>div]:bg-green-500'
                                  }`}
                                />
                              </div>
                            </td>
                            <td className="p-4">
                              {getUrgencyBadge(item)}
                            </td>
                            <td className="p-4">
                              <span className="font-medium">{item.reorder_quantity || 0}</span>
                            </td>
                            <td className="p-4">
                              <span className="font-medium">
                                ฿{((item.reorder_quantity || 0) * (item.unit_cost || 0)).toLocaleString()}
                              </span>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>


        {/* Purchase Orders Tab */}
        <TabsContent value="purchase-orders" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="h-full min-h-0"
          >
            <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/70 bg-background/90 dark:border-border/60 dark:bg-background/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-blue-500" />
                  Purchase Orders
                </CardTitle>
                <CardDescription>Manage and track purchase orders</CardDescription>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-0">
                {purchaseOrders.length === 0 ? (
                  <div className="flex min-h-0 flex-1 items-center justify-center py-12 text-center text-muted-foreground">
                    No purchase orders yet
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border/70 bg-background">
                    <table className="w-full min-w-[920px] border-collapse">
                      <thead className="sticky top-0 z-10 overflow-hidden rounded-t-lg bg-muted/50 text-left text-sm text-muted-foreground backdrop-blur-xl">
                        <tr className="border-b border-border">
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            PO #
                          </th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            Supplier
                          </th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            Items
                          </th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            Total Cost
                          </th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            Status
                          </th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            Created
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchaseOrders.map((po, index) => {
                          const items = JSON.parse(po.items_json || '[]')
                          return (
                            <motion.tr
                              key={po.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="border-b border-border hover:bg-muted/50 transition-colors"
                            >
                              <td className="p-4">
                                <code className="rounded bg-muted px-2 py-1 text-sm font-medium">
                                  PO-{po.id.toString().padStart(4, '0')}
                                </code>
                              </td>
                              <td className="p-4">
                                <div className="font-medium">{po.supplier_name}</div>
                              </td>
                              <td className="p-4">
                                <div className="text-sm text-muted-foreground">
                                  {items.length} item{items.length !== 1 ? 's' : ''}
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="font-medium">฿{po.total_cost.toLocaleString()}</span>
                              </td>
                              <td className="p-4">
                                {getStatusBadge(po.status)}
                              </td>
                              <td className="p-4">
                                <div className="text-sm text-muted-foreground">
                                  {new Date(po.created_at).toLocaleDateString()}
                                </div>
                              </td>
                            </motion.tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Create PO Dialog */}
      <Dialog open={showCreatePODialog} onOpenChange={setShowCreatePODialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
            <DialogDescription>
              Review selected items and create a purchase order
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border/70 bg-background">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 overflow-hidden rounded-t-lg bg-muted/50 text-left text-sm text-muted-foreground backdrop-blur-xl">
                  <tr className="border-b border-border">
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-sm">
                      Item
                    </th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-sm">
                      Quantity
                    </th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-sm">
                      Unit Cost
                    </th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-sm">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems
                    .filter(item => selectedItems.includes(item.id))
                    .map((item) => (
                      <tr key={item.id} className="border-b border-border">
                        <td className="p-4">
                          <div className="font-medium text-sm">{item.name}</div>
                          <div className="text-xs text-muted-foreground">
                            <code className="rounded bg-muted px-1.5 py-0.5">{item.sku}</code>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm">{item.reorder_quantity || 0}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm">฿{(item.unit_cost || 0).toLocaleString()}</span>
                        </td>
                        <td className="p-4">
                          <span className="font-medium text-sm">
                            ฿{((item.reorder_quantity || 0) * (item.unit_cost || 0)).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/30">
                    <td colSpan={3} className="p-4 text-right font-semibold">
                      Total:
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-lg">
                        ฿{lowStockItems
                          .filter(item => selectedItems.includes(item.id))
                          .reduce((sum, item) => sum + (item.reorder_quantity || 0) * (item.unit_cost || 0), 0)
                          .toLocaleString()}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreatePODialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePO}>
              Create Purchase Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}

