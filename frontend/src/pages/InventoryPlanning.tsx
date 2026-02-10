import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Inventory Planning</h1>
            <p className="text-muted-foreground">Monitor stock levels and manage reorder points</p>
          </div>
        </div>
        <TableLoadingSkeleton rows={8} />
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Planning</h1>
          <p className="text-muted-foreground">Monitor stock levels and manage purchase orders</p>
        </div>
        <Button
          size="lg"
          onClick={() => setShowCreatePODialog(true)}
          disabled={selectedItems.length === 0}
          className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
        >
          <Plus className="mr-2 h-5 w-5" />
          Create PO ({selectedItems.length})
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card className="border-2 border-yellow-500/20 bg-gradient-to-br from-yellow-50 to-white dark:from-yellow-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Items</CardTitle>
                <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-yellow-500" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{lowStockItems.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Items below reorder point</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-2 border-red-500/20 bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Critical Items</CardTitle>
                <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{criticalItems.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Urgent reordering needed</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-2 border-purple-500/20 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Reorder Value</CardTitle>
                <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-purple-500" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">฿{totalLowStockValue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Estimated reorder cost</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-2 border-blue-500/20 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Purchase Orders</CardTitle>
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{purchaseOrders.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Total POs created</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>


      {/* Tabs */}
      <Tabs defaultValue="low-stock" className="space-y-6">
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
        <TabsContent value="low-stock" className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader>
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
              <CardContent>
                {filteredAndSortedItems.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    {searchQuery ? 'No items found matching your search' : 'All items are well stocked'}
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={selectedItems.length === filteredAndSortedItems.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedItems(filteredAndSortedItems.map(item => item.id))
                                } else {
                                  setSelectedItems([])
                                }
                              }}
                              className="rounded border-gray-300"
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
                              <input
                                type="checkbox"
                                checked={selectedItems.includes(item.id)}
                                onChange={() => handleSelectItem(item.id)}
                                className="rounded border-gray-300"
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
        <TabsContent value="purchase-orders" className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-blue-500" />
                  Purchase Orders
                </CardTitle>
                <CardDescription>Manage and track purchase orders</CardDescription>
              </CardHeader>
              <CardContent>
                {purchaseOrders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No purchase orders yet
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
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
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
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
            <Button onClick={handleCreatePO} className="bg-gradient-to-r from-purple-500 to-purple-600">
              Create Purchase Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

