import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, PackageMinus, History, ArrowUpDown, ArrowUp, ArrowDown, Package, TrendingDown } from 'lucide-react'

// Helper functions to handle both old and new API response formats
const getItemName = (item: any): string => {
  return item?.name || item?.master_name || item?.local_name || 'Unknown'
}

const getItemSku = (item: any): string => {
  return item?.sku || item?.master_sku || item?.local_sku || 'N/A'
}
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
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { TableLoadingSkeleton } from '@/components/ui/loading-state'
import * as api from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { usePageContext } from '@/contexts/PageContext'
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'

export function PickItems() {
  const [items, setItems] = useState<api.Item[]>([])
  const [transactions, setTransactions] = useState<api.Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showPickDialog, setShowPickDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<api.Item | null>(null)
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [filterText, setFilterText] = useState('')
  const [sortColumn, setSortColumn] = useState<'item' | 'quantity' | 'time' | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const { user } = useAuth()
  const { setPageInfo } = usePageContext()

  useEffect(() => {
    setPageInfo('Pick Items', 'Pick items from inventory')
  }, [setPageInfo])

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setIsLoading(true)
      const [itemsData, transactionsData] = await Promise.all([
        api.getAllItems(),
        api.getTransactions()
      ])
      const pickTransactions = transactionsData.filter(t => t.transaction_type === 'pick')
      setItems(itemsData)
      setTransactions(pickTransactions)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSort = (column: 'item' | 'quantity' | 'time') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = transactions

    // Filter
    if (filterText) {
      filtered = filtered.filter(txn => {
        const item = items.find(i => i.id === txn.item_id)
        return (
          getItemName(item).toLowerCase().includes(filterText.toLowerCase()) ||
          getItemSku(item).toLowerCase().includes(filterText.toLowerCase()) ||
          txn.notes?.toLowerCase().includes(filterText.toLowerCase())
        )
      })
    }

    // Sort
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any, bValue: any

        if (sortColumn === 'item') {
          const aItem = items.find(i => i.id === a.item_id)
          const bItem = items.find(i => i.id === b.item_id)
          aValue = getItemName(aItem)
          bValue = getItemName(bItem)
        } else if (sortColumn === 'quantity') {
          aValue = Math.abs(a.quantity)
          bValue = Math.abs(b.quantity)
        } else if (sortColumn === 'time') {
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
        }

        if (sortDirection === 'asc') {
          return aValue > bValue ? 1 : -1
        } else {
          return aValue < bValue ? 1 : -1
        }
      })
    }

    return filtered.slice(0, 10)
  }, [transactions, items, filterText, sortColumn, sortDirection])

  const handleOpenDialog = () => {
    setShowPickDialog(true)
    setSearchQuery('')
    setSelectedItem(null)
    setQuantity('')
    setNotes('')
  }

  const handleSelectItem = (item: api.Item) => {
    setSelectedItem(item)
    setQuantity('1')
  }

  const handlePick = async () => {
    if (!selectedItem || !quantity || parseInt(quantity) <= 0) {
      toast.error('Please select an item and enter a valid quantity')
      return
    }

    if (parseInt(quantity) > selectedItem.quantity) {
      toast.error(`Only ${selectedItem.quantity} units available`)
      return
    }

    try {
      await api.createTransaction({
        item_id: selectedItem.id,
        transaction_type: 'pick',
        quantity: -parseInt(quantity),
        notes: notes || `Picked ${quantity} units`,
        user_id: user?.id || 1
      })

      toast.success(`Picked ${quantity} units of ${getItemName(selectedItem)}`)

      setShowPickDialog(false)
      fetchData()
    } catch (error) {
      console.error('Error creating pick transaction:', error)
      toast.error('Failed to create pick transaction')
    }
  }

  const filteredItems = items.filter(item =>
    getItemName(item).toLowerCase().includes(searchQuery.toLowerCase()) ||
    getItemSku(item).toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Generate monthly data for charts (last 6 months)
  const generateMonthlyData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    return months.map((month) => ({
      month,
      value: Math.floor(Math.random() * 20) + 5
    }))
  }

  const pickChartData = generateMonthlyData()
  const availableChartData = generateMonthlyData()
  const lowStockChartData = generateMonthlyData()

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card className="border-2 border-orange-500/20 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Today's Picks</CardTitle>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-48 min-h-[48px] min-w-[192px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={192} minHeight={48}>
                      <LineChart data={pickChartData}>
                        <YAxis hide domain={['dataMin', 'dataMax']} />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <PackageMinus className="h-4 w-4 text-orange-500" />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold">{transactions.length}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-2 border-green-500/20 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Available Items</CardTitle>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-48 min-h-[48px] min-w-[192px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={192} minHeight={48}>
                      <LineChart data={availableChartData}>
                        <YAxis hide domain={['dataMin', 'dataMax']} />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Package className="h-4 w-4 text-green-500" />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold">{items.filter(i => i.quantity > 0).length}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-2 border-yellow-500/20 bg-gradient-to-br from-yellow-50 to-white dark:from-yellow-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock</CardTitle>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-48 min-h-[48px] min-w-[192px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={192} minHeight={48}>
                      <LineChart data={lowStockChartData}>
                        <YAxis hide domain={['dataMin', 'dataMax']} />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#eab308"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <TrendingDown className="h-4 w-4 text-yellow-500" />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-yellow-600">
                {items.filter(i => i.reorder_point && i.quantity < i.reorder_point).length}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent Pick Transactions
              </CardTitle>
              <CardDescription>Last 10 pick transactions</CardDescription>
            </div>
            <Button onClick={handleOpenDialog} size="lg">
              <PackageMinus className="mr-2 h-5 w-5" />
              Quick Pick
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter by item name, SKU, or notes..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {isLoading ? (
            <TableLoadingSkeleton />
          ) : filteredAndSortedTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {filterText ? 'No matching transactions found' : 'No pick transactions yet'}
            </div>
          ) : (
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                  <tr className="border-b transition-colors">
                    <th
                      className="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                      onClick={() => handleSort('item')}
                    >
                      <div className="flex items-center gap-2">
                        Item
                        {sortColumn === 'item' && (
                          sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                        )}
                        {sortColumn !== 'item' && <ArrowUpDown className="h-4 w-4 opacity-50" />}
                      </div>
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">SKU</th>
                    <th
                      className="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                      onClick={() => handleSort('quantity')}
                    >
                      <div className="flex items-center gap-2">
                        Quantity
                        {sortColumn === 'quantity' && (
                          sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                        )}
                        {sortColumn !== 'quantity' && <ArrowUpDown className="h-4 w-4 opacity-50" />}
                      </div>
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Notes</th>
                    <th
                      className="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                      onClick={() => handleSort('time')}
                    >
                      <div className="flex items-center gap-2">
                        Time
                        {sortColumn === 'time' && (
                          sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                        )}
                        {sortColumn !== 'time' && <ArrowUpDown className="h-4 w-4 opacity-50" />}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {filteredAndSortedTransactions.map((txn, index) => {
                    // Use item_name and sku directly from transaction (returned by API)
                    const itemName = txn.item_name || 'Unknown'
                    const itemSku = txn.sku || 'N/A'
                    return (
                      <motion.tr
                        key={txn.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <td className="p-4 align-middle font-medium">
                          {itemName}
                        </td>
                        <td className="p-4 align-middle">
                          <code className="rounded bg-muted px-2 py-1 text-xs">
                            {itemSku}
                          </code>
                        </td>
                        <td className="p-4 align-middle">
                          <Badge variant="destructive">{Math.abs(txn.quantity)}</Badge>
                        </td>
                        <td className="p-4 align-middle text-sm text-muted-foreground">
                          {txn.notes || '-'}
                        </td>
                        <td className="p-4 align-middle text-sm text-muted-foreground">
                          {new Date(txn.created_at).toLocaleString()}
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

      <Dialog open={showPickDialog} onOpenChange={setShowPickDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageMinus className="h-5 w-5" />
              Pick Item
            </DialogTitle>
            <DialogDescription>
              Search and select an item to pick from inventory
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Search Item (Name or SKU)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {searchQuery && (
              <div className="border rounded-lg max-h-60 overflow-y-auto">
                {filteredItems.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No items found
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredItems.slice(0, 10).map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 cursor-pointer hover:bg-accent transition-colors ${
                          selectedItem?.id === item.id ? 'bg-accent' : ''
                        }`}
                        onClick={() => handleSelectItem(item)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{getItemName(item)}</p>
                            <p className="text-sm text-muted-foreground">SKU: {getItemSku(item)}</p>
                          </div>
                          <div className="text-right">
                            <Badge variant={item.quantity > 0 ? 'default' : 'destructive'}>
                              Stock: {item.quantity}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedItem && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4 p-4 border rounded-lg bg-accent/50"
              >
                <div>
                  <Label className="text-xs text-muted-foreground">Selected Item</Label>
                  <p className="font-medium">{getItemName(selectedItem)}</p>
                  <p className="text-sm text-muted-foreground">SKU: {getItemSku(selectedItem)}</p>
                  <p className="text-sm">Available: {selectedItem.quantity} units</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity to Pick *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    max={selectedItem.quantity}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter quantity"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Input
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g., Order #12345, Customer name..."
                  />
                </div>
              </motion.div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPickDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handlePick} disabled={!selectedItem || !quantity}>
              <PackageMinus className="mr-2 h-4 w-4" />
              Confirm Pick
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
