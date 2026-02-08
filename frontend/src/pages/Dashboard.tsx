import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Package,
  AlertTriangle,
  PackagePlus,
  PackageMinus,
  Activity,
  TrendingUp,
  ArrowRight,
  Clock,
  BarChart3,
  ShoppingCart,
  GripVertical,
  RotateCcw
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

import { toast } from 'sonner'
import { TableLoadingSkeleton } from '@/components/ui/loading-state'
import * as api from '@/services/api'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { ReactGridLayout, WidthProvider } from 'react-grid-layout/legacy'
import type { LayoutItem } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import '@/styles/grid-layout.css'

const ResponsiveGridLayout = WidthProvider(ReactGridLayout)

// Default layout configuration
const defaultLayout: LayoutItem[] = [
  { i: 'stats-1', x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'stats-2', x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'stats-3', x: 6, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'stats-4', x: 9, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'purchase-orders', x: 0, y: 2, w: 6, h: 4, minW: 4, minH: 3 },
  { i: 'critical-time', x: 6, y: 2, w: 6, h: 4, minW: 4, minH: 3 },
  { i: 'stock-movement', x: 0, y: 6, w: 6, h: 5, minW: 4, minH: 4 },
  { i: 'category-analysis', x: 6, y: 6, w: 6, h: 8, minW: 4, minH: 6 },
  { i: 'low-stock', x: 0, y: 11, w: 6, h: 6, minW: 4, minH: 4 },
  { i: 'recent-activity', x: 6, y: 14, w: 6, h: 6, minW: 4, minH: 4 },
]

export function Dashboard() {
  const [items, setItems] = useState<api.Item[]>([])
  const [transactions, setTransactions] = useState<api.Transaction[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<api.PurchaseOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)


  // Layout state
  const [layout, setLayout] = useState<LayoutItem[]>(() => {
    const savedLayout = localStorage.getItem('dashboard-layout')
    return savedLayout ? JSON.parse(savedLayout) : defaultLayout
  })

  useEffect(() => {
    fetchData()
  }, [])

  // Save layout to localStorage when it changes
  const handleLayoutChange = (newLayout: readonly LayoutItem[]) => {
    setLayout([...newLayout])
    localStorage.setItem('dashboard-layout', JSON.stringify(newLayout))
  }

  // Reset layout to default
  const resetLayout = () => {
    setLayout(defaultLayout)
    localStorage.setItem('dashboard-layout', JSON.stringify(defaultLayout))
    toast.success('Dashboard layout has been reset to default')
  }

  async function fetchData() {
    try {
      setIsLoading(true)
      const [itemsData, transactionsData, posData] = await Promise.all([
        api.getAllItems(),
        api.getTransactions(),
        api.getPurchaseOrders()
      ])
      setItems(itemsData)
      setTransactions(transactionsData)
      setPurchaseOrders(posData)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate statistics
  const totalItems = items.length
  const totalStock = items.reduce((sum, item) => sum + item.quantity, 0)
  const lowStockItems = items.filter(item => item.quantity <= item.reorder_point)
  const totalValue = items.reduce((sum, item) => sum + (item.quantity * (item.unit_cost || 0)), 0)

  // Recent transactions (last 10)
  const recentTransactions = transactions.slice(0, 10)

  // Prepare chart data (last 7 days)
  const chartData = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    date.setHours(0, 0, 0, 0)

    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)

    const dayTransactions = transactions.filter(t => {
      const txDate = new Date(t.created_at)
      return txDate >= date && txDate < nextDate
    })

    const picks = dayTransactions.filter(t => t.transaction_type === 'pick').reduce((sum, t) => sum + Math.abs(t.quantity), 0)
    const receives = dayTransactions.filter(t => t.transaction_type === 'receive').reduce((sum, t) => sum + t.quantity, 0)

    chartData.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      picks,
      receives
    })
  }

  // Category distribution with price
  const categoryData = items.reduce((acc, item) => {
    const category = item.category || 'Uncategorized'
    const existing = acc.find(c => c.name === category)
    const itemValue = item.quantity * (item.unit_cost || 0)
    if (existing) {
      existing.value += item.quantity
      existing.totalValue += itemValue
    } else {
      acc.push({
        name: category,
        value: item.quantity,
        totalValue: itemValue
      })
    }
    return acc
  }, [] as { name: string; value: number; totalValue: number }[])

  // Purchase Orders - pending and ordered status
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const pendingPOs = purchaseOrders.filter(po =>
    po.status === 'pending' || po.status === 'ordered'
  ).slice(0, 5) // Show top 5

  console.log('📦 Purchase Orders:', purchaseOrders.length, 'Pending:', pendingPOs.length)

  // Critical items (stock < 30% of reorder point)
  const criticalItems = items.filter(item => {
    if (item.reorder_point === 0) return false
    const stockLevel = (item.quantity / item.reorder_point) * 100
    return stockLevel < 30
  }).sort((a, b) => {
    const aLevel = (a.quantity / a.reorder_point) * 100
    const bLevel = (b.quantity / b.reorder_point) * 100
    return aLevel - bLevel
  })

  console.log('🚨 Critical Items:', criticalItems.length)
  console.log('📊 Category Data:', categoryData)

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case 'pick':
        return <Badge variant="destructive" className="gap-1"><PackageMinus className="h-3 w-3" />Pick</Badge>
      case 'receive':
        return <Badge variant="default" className="gap-1 bg-green-500"><PackagePlus className="h-3 w-3" />Receive</Badge>
      case 'adjust':
        return <Badge variant="secondary" className="gap-1"><Activity className="h-3 w-3" />Adjust</Badge>
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  const getStockLevel = (item: api.Item) => {
    if (!item.reorder_point) return 100
    return Math.min((item.quantity / item.reorder_point) * 100, 100)
  }


  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Monitor and manage your inventory</p>
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
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your inventory overview</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={resetLayout}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Reset Layout
        </Button>
      </div>

      {/* Grid Layout Container */}
      <ResponsiveGridLayout
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={60}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".drag-handle"
        compactType="vertical"
        preventCollision={false}
      >
        {/* Hero Stats Cards */}
        <div key="stats-1">
          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Items</CardTitle>
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground drag-handle cursor-move" />
                  <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center">
                    <Package className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">{totalItems}</div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Unique SKUs in inventory</p>
            </CardContent>
          </Card>
        </div>

        <div key="stats-2">
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-green-600 dark:text-green-400">Total Stock</CardTitle>
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground drag-handle cursor-move" />
                  <div className="h-10 w-10 rounded-lg bg-green-500 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-900 dark:text-green-100">{totalStock.toLocaleString()}</div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">Units in warehouse</p>
            </CardContent>
          </Card>
        </div>

        <div key="stats-3">
          <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-amber-600 dark:text-amber-400">Low Stock</CardTitle>
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground drag-handle cursor-move" />
                  <div className="h-10 w-10 rounded-lg bg-amber-500 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">{lowStockItems.length}</div>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Items need reordering</p>
            </CardContent>
          </Card>
        </div>

        <div key="stats-4">
          <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-purple-600 dark:text-purple-400">Inventory Value</CardTitle>
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground drag-handle cursor-move" />
                  <div className="h-10 w-10 rounded-lg bg-purple-500 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">฿{totalValue.toLocaleString()}</div>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Total stock value</p>
            </CardContent>
          </Card>
        </div>

        {/* PO Alert & Critical Time */}
        {/* Purchase Orders Alert */}
        <div key="purchase-orders">
          <Card className="h-full overflow-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground drag-handle cursor-move" />
                    <ShoppingCart className="h-5 w-5 text-orange-500" />
                    Purchase Orders
                  </CardTitle>
                  <CardDescription>Pending and ordered POs</CardDescription>
                </div>
                <Link to="/planning">
                  <Button variant="outline" size="sm">
                    View All
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {pendingPOs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending purchase orders
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingPOs.map((po) => {
                    const items = JSON.parse(po.items_json || '[]')
                    const itemCount = items.length
                    return (
                      <div
                        key={po.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{po.supplier_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {itemCount} item{itemCount > 1 ? 's' : ''} • ฿{po.total_cost.toLocaleString()}
                          </div>
                        </div>
                        <Badge variant={po.status === 'pending' ? 'secondary' : 'default'}>
                          {po.status}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Critical Time - Items needing urgent attention */}
        <div key="critical-time">
          <Card className="h-full overflow-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground drag-handle cursor-move" />
                    <Clock className="h-5 w-5 text-red-500" />
                    Critical Time
                  </CardTitle>
                  <CardDescription>Items needing urgent attention</CardDescription>
                </div>
                <Link to="/planning">
                  <Button variant="outline" size="sm">
                    View All
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {criticalItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No critical items
                </div>
              ) : (
                <div className="space-y-3">
                  {criticalItems.slice(0, 5).map((item) => {
                    const stockLevel = (item.quantity / item.reorder_point) * 100
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Stock: {item.quantity} / {item.reorder_point} ({Math.round(stockLevel)}%)
                          </div>
                          <Progress
                            value={stockLevel}
                            className="h-2 mt-2 [&>div]:bg-red-500"
                          />
                        </div>
                        <Badge variant="destructive" className="ml-4">
                          Critical
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        {/* Stock Movement Chart */}
        <div key="stock-movement">
          <Card className="h-full overflow-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground drag-handle cursor-move" />
                <Activity className="h-5 w-5 text-blue-500" />
                Stock Movement (7 Days)
              </CardTitle>
              <CardDescription>Daily picks and receives</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full h-[300px] min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="receives" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Receives" />
                  <Area type="monotone" dataKey="picks" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Picks" />
                </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Category Analysis - Combined Items & Value */}
        <div key="category-analysis">
          <Card className="h-full overflow-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground drag-handle cursor-move" />
                <BarChart3 className="h-5 w-5 text-purple-500" />
                Category Analysis
              </CardTitle>
              <CardDescription>Quantity and value distribution by category</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Legend */}
              <div className="flex items-center gap-4 mb-4 pb-3 border-b">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-8 bg-blue-500 rounded-full" />
                  <span className="text-xs text-muted-foreground">Quantity</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-8 bg-green-500 rounded-full" />
                  <span className="text-xs text-muted-foreground">Value</span>
                </div>
              </div>

              <div className="space-y-4">
                {categoryData.map((cat) => {
                  const maxQty = Math.max(...categoryData.map(c => c.value))
                  const maxVal = Math.max(...categoryData.map(c => c.totalValue))
                  const qtyPercentage = (cat.value / maxQty) * 100
                  const valPercentage = (cat.totalValue / maxVal) * 100

                  return (
                    <div key={cat.name} className="space-y-2">
                      {/* Category Name */}
                      <div className="font-medium text-sm">{cat.name}</div>

                      {/* Quantity Bar */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all duration-500"
                              style={{ width: `${qtyPercentage}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground min-w-[80px] text-right">
                          {cat.value.toLocaleString()} pcs
                        </div>
                      </div>

                      {/* Value Bar */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="absolute inset-y-0 left-0 bg-green-500 rounded-full transition-all duration-500"
                              style={{ width: `${valPercentage}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground min-w-[80px] text-right">
                          ฿{cat.totalValue.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stock Alerts & Recent Activity */}
        {/* Low Stock Alert */}
        <div key="low-stock">
          <Card className="h-full overflow-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground drag-handle cursor-move" />
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Low Stock Alert
                  </CardTitle>
                  <CardDescription>Items requiring immediate attention</CardDescription>
                </div>
                <Link to="/planning">
                  <Button variant="outline" size="sm">
                    View All
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {lowStockItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  All items are well stocked
                </div>
              ) : (
                <div className="space-y-4">
                  {lowStockItems.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-muted-foreground">
                          <code className="rounded bg-muted px-2 py-0.5 text-xs">{item.sku}</code>
                        </div>
                        <div className="mt-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <span>{item.quantity} / {item.reorder_point}</span>
                            <span className="text-xs">
                              {Math.round(getStockLevel(item))}%
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
                      </div>
                      <div className="ml-4">
                        {item.quantity < item.reorder_point * 0.5 ? (
                          <Badge variant="destructive">Critical</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-700">Low</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div key="recent-activity">
          <Card className="h-full overflow-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground drag-handle cursor-move" />
                    <Clock className="h-5 w-5 text-blue-500" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription>Latest transactions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {recentTransactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No recent transactions
                </div>
              ) : (
                <div className="space-y-3">
                  {recentTransactions.map((txn) => {
                    const item = items.find(i => i.id === txn.item_id)
                    return (
                      <div
                        key={txn.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            txn.transaction_type === 'receive' ? 'bg-green-500/10' :
                            txn.transaction_type === 'pick' ? 'bg-red-500/10' :
                            'bg-blue-500/10'
                          }`}>
                            {txn.transaction_type === 'receive' ? (
                              <PackagePlus className="h-5 w-5 text-green-500" />
                            ) : txn.transaction_type === 'pick' ? (
                              <PackageMinus className="h-5 w-5 text-red-500" />
                            ) : (
                              <Activity className="h-5 w-5 text-blue-500" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-sm">{item?.name || 'Unknown'}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(txn.created_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${
                            txn.quantity > 0 ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {txn.quantity > 0 ? '+' : ''}{txn.quantity}
                          </span>
                          {getTransactionBadge(txn.transaction_type)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ResponsiveGridLayout>
    </div>
  )
}

