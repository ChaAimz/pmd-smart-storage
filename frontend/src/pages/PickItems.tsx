import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, PackageMinus, ArrowUpDown, ArrowUp, ArrowDown, Package, TrendingDown, CalendarDays } from 'lucide-react'
import { format, subDays, subMonths, subYears, startOfDay, endOfDay } from 'date-fns'
import type { DateRange } from 'react-day-picker'

interface ItemLike {
  name?: string
  master_name?: string
  local_name?: string
  sku?: string
  master_sku?: string
  local_sku?: string
}

// Helper functions to handle both old and new API response formats
const getItemName = (item: ItemLike | undefined): string => {
  return item?.name || item?.master_name || item?.local_name || 'Unknown'
}

const getItemSku = (item: ItemLike | undefined): string => {
  return item?.sku || item?.master_sku || item?.local_sku || 'N/A'
}
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { StatusCard } from '@/components/ui/status-card'
import { CalendarRange } from '@/components/ui/calendar-range'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
import { ItemNameHoverCard } from '@/components/ui/item-name-hover-card'
import * as api from '@/services/api'
import { useAuth } from '@/contexts/use-auth'
import { usePageContext } from '@/contexts/use-page-context'

type RangePreset = '30D' | 'M' | '3M' | '6M' | '1Y' | 'CUSTOM'
const RANGE_PRESET_LABELS: Record<Exclude<RangePreset, 'CUSTOM'>, string> = {
  '30D': '30D',
  M: 'M',
  '3M': '3M',
  '6M': '6M',
  '1Y': '1Y',
}

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
  const [selectedRangePreset, setSelectedRangePreset] = useState<RangePreset>('30D')
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 29),
    to: new Date(),
  })

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

    // Date range filter
    if (dateRange.from || dateRange.to) {
      const from = dateRange.from ? startOfDay(dateRange.from) : null
      const to = dateRange.to ? endOfDay(dateRange.to) : null

      filtered = filtered.filter((txn) => {
        const createdAt = new Date(txn.created_at)
        if (from && createdAt < from) return false
        if (to && createdAt > to) return false
        return true
      })
    }

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
        let aValue: number | string = 0
        let bValue: number | string = 0

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

    return filtered
  }, [transactions, items, filterText, sortColumn, sortDirection, dateRange])

  const applyPreset = (preset: Exclude<RangePreset, 'CUSTOM'>) => {
    const now = new Date()
    let from = subDays(now, 29)

    if (preset === 'M') from = subMonths(now, 1)
    if (preset === '3M') from = subMonths(now, 3)
    if (preset === '6M') from = subMonths(now, 6)
    if (preset === '1Y') from = subYears(now, 1)

    setSelectedRangePreset(preset)
    setDateRange({ from, to: now })
  }

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setSelectedRangePreset('CUSTOM')
    setDateRange(range || { from: undefined, to: undefined })
  }

  const rangeLabel =
    dateRange.from && dateRange.to
      ? `${format(dateRange.from, 'MMM dd, yyyy')} - ${format(dateRange.to, 'MMM dd, yyyy')}`
      : 'Select date range'

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

  return (
    <div className="h-full min-h-0 overflow-y-auto lg:overflow-hidden">
      <div className="h-full min-h-0 flex flex-col gap-4 px-2.5 pt-2.5 pb-1.5 lg:px-3.5 lg:pt-3.5 lg:pb-2.5">
      <div className="grid gap-4 md:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <StatusCard
            title="Pick Transactions"
            value={transactions.length}
            description="Total pick transactions recorded"
            icon={PackageMinus}
            accentClassName="text-orange-700 dark:text-orange-300"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <StatusCard
            title="Available Items"
            value={items.filter(i => i.quantity > 0).length}
            description="Items currently in stock"
            icon={Package}
            accentClassName="text-emerald-700 dark:text-emerald-300"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <StatusCard
            title="Low Stock"
            value={items.filter(i => i.reorder_point && i.quantity < i.reorder_point).length}
            description="Items below reorder point"
            icon={TrendingDown}
            accentClassName="text-amber-700 dark:text-amber-300"
            valueClassName="text-amber-600 dark:text-amber-300"
          />
        </motion.div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardHeader className="pb-0" />
        <CardContent className="flex min-h-0 flex-1 flex-col">
          <div className="mb-4 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter by item name, SKU, or notes..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="pl-10"
              />
            </div>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={selectedRangePreset === 'CUSTOM' ? undefined : selectedRangePreset}
              onValueChange={(value) => {
                if (value) applyPreset(value as Exclude<RangePreset, 'CUSTOM'>)
              }}
              className="shrink-0 gap-0 overflow-hidden rounded-xl border border-border bg-background [&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l [&>*:not(:first-child)]:border-border [&>*:not(:last-child)]:rounded-r-none"
            >
              {(['30D', 'M', '3M', '6M', '1Y'] as const).map((preset) => (
                <ToggleGroupItem
                  key={preset}
                  value={preset}
                  aria-label={`Range ${preset}`}
                  className="rounded-none border-0 bg-transparent px-3 text-foreground hover:bg-muted/70 focus-visible:ring-ring/40 data-[state=on]:bg-muted data-[state=on]:text-foreground"
                >
                  {RANGE_PRESET_LABELS[preset]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="min-w-[230px] shrink-0 justify-start">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {rangeLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={8} className="w-auto p-0">
                <CalendarRange
                  dateRange={dateRange}
                  onDateRangeChange={handleDateRangeChange}
                />
              </PopoverContent>
            </Popover>
            <Button onClick={handleOpenDialog} className="ml-auto shrink-0">
              <PackageMinus className="mr-2 h-4 w-4" />
              Quick Pick
            </Button>
          </div>

          {isLoading ? (
            <TableLoadingSkeleton />
          ) : filteredAndSortedTransactions.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {filterText ? 'No matching transactions found' : 'No pick transactions yet'}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border/70 bg-background">
              <div className="h-full overflow-auto">
              <Table className="min-w-[860px] text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer hover:text-foreground"
                      onClick={() => handleSort('item')}
                    >
                      <div className="flex items-center gap-2">
                        Item
                        {sortColumn === 'item' && (
                          sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                        )}
                        {sortColumn !== 'item' && <ArrowUpDown className="h-4 w-4 opacity-50" />}
                      </div>
                    </TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead
                      className="cursor-pointer hover:text-foreground"
                      onClick={() => handleSort('quantity')}
                    >
                      <div className="flex items-center gap-2">
                        Quantity
                        {sortColumn === 'quantity' && (
                          sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                        )}
                        {sortColumn !== 'quantity' && <ArrowUpDown className="h-4 w-4 opacity-50" />}
                      </div>
                    </TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead
                      className="cursor-pointer hover:text-foreground"
                      onClick={() => handleSort('time')}
                    >
                      <div className="flex items-center gap-2">
                        Time
                        {sortColumn === 'time' && (
                          sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                        )}
                        {sortColumn !== 'time' && <ArrowUpDown className="h-4 w-4 opacity-50" />}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedTransactions.map((txn, index) => {
                    // Use item_name and sku directly from transaction (returned by API)
                    const itemName = txn.item_name || 'Unknown'
                    const itemSku = txn.sku || 'N/A'
                    const itemMeta = items.find((it) => it.id === txn.item_id || it.sku === itemSku)
                    return (
                      <motion.tr
                        key={txn.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b border-border transition-colors hover:bg-muted/50"
                      >
                        <TableCell className="font-medium">
                          <ItemNameHoverCard
                            name={itemName}
                            sku={itemSku}
                            item={itemMeta}
                            transactions={transactions}
                            className="cursor-default"
                          />
                        </TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-2 py-1 text-xs">
                            {itemSku}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive">{Math.abs(txn.quantity)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {txn.notes || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(txn.created_at).toLocaleString()}
                        </TableCell>
                      </motion.tr>
                    )
                  })}
                </TableBody>
              </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

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
