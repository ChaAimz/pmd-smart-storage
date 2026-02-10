import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, Settings, TrendingUp, TrendingDown, ArrowUpDown, ArrowUp, ArrowDown, CalendarDays } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { TableLoadingSkeleton } from '@/components/ui/loading-state'
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

export function AdjustStock() {
  const [items, setItems] = useState<api.Item[]>([])
  const [transactions, setTransactions] = useState<api.Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAdjustDialog, setShowAdjustDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<api.Item | null>(null)
  const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('increase')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [filterText, setFilterText] = useState('')
  const [sortColumn, setSortColumn] = useState<'item' | 'adjustment' | 'time' | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [selectedRangePreset, setSelectedRangePreset] = useState<RangePreset>('30D')
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 29),
    to: new Date(),
  })

  const { user } = useAuth()
  const { setPageInfo } = usePageContext()

  useEffect(() => {
    setPageInfo('Adjust Stock', 'Adjust inventory quantities for corrections and cycle counts')
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
      setItems(itemsData)
      setTransactions(transactionsData.filter(t => t.transaction_type === 'adjust'))
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSort = (column: 'item' | 'adjustment' | 'time') => {
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
        } else if (sortColumn === 'adjustment') {
          aValue = a.quantity
          bValue = b.quantity
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
    setShowAdjustDialog(true)
    setSearchQuery('')
    setSelectedItem(null)
    setAdjustmentType('increase')
    setQuantity('')
    setReason('')
  }

  const handleSelectItem = (item: api.Item) => {
    setSelectedItem(item)
    setQuantity('1')
  }

  const handleAdjust = async () => {
    if (!selectedItem || !quantity || parseInt(quantity) <= 0 || !reason) {
      toast.error('Please fill in all required fields')
      return
    }

    const adjustedQuantity = adjustmentType === 'increase'
      ? parseInt(quantity)
      : -parseInt(quantity)

    try {
      await api.createTransaction({
        item_id: selectedItem.id,
        transaction_type: 'adjust',
        quantity: adjustedQuantity,
        notes: reason,
        user_id: user?.id || 1
      })

      toast.success(`Stock adjusted: ${adjustmentType === 'increase' ? '+' : '-'}${quantity} units`)

      setShowAdjustDialog(false)
      fetchData()
    } catch (error) {
      console.error('Error creating adjustment:', error)
      toast.error('Failed to create adjustment')
    }
  }

  const filteredItems = items.filter(item =>
    getItemName(item).toLowerCase().includes(searchQuery.toLowerCase()) ||
    getItemSku(item).toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalAdjustments = transactions.length
  const positiveAdjustments = transactions.filter(t => t.quantity > 0).length
  const negativeAdjustments = transactions.filter(t => t.quantity < 0).length

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
            title="Total Adjustments"
            value={totalAdjustments}
            description="All stock adjustment transactions"
            icon={Settings}
            accentClassName="text-blue-700 dark:text-blue-300"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <StatusCard
            title="Increases"
            value={positiveAdjustments}
            description="Positive stock adjustments"
            icon={TrendingUp}
            accentClassName="text-emerald-700 dark:text-emerald-300"
            valueClassName="text-emerald-600 dark:text-emerald-300"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <StatusCard
            title="Decreases"
            value={negativeAdjustments}
            description="Negative stock adjustments"
            icon={TrendingDown}
            accentClassName="text-rose-700 dark:text-rose-300"
            valueClassName="text-rose-600 dark:text-rose-300"
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
                placeholder="Filter by item name, SKU, or reason..."
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
                <Button size="sm" variant="outline" className="min-w-[230px] shrink-0 justify-start">
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
            <Button onClick={handleOpenDialog} size="sm" className="ml-auto shrink-0">
              <Settings className="mr-2 h-4 w-4" />
              Quick Adjust
            </Button>
          </div>

          {isLoading ? (
            <TableLoadingSkeleton />
          ) : filteredAndSortedTransactions.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {filterText ? 'No matching adjustments found' : 'No adjustments yet'}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border/70 bg-background">
              <Table className="text-sm">
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
                      onClick={() => handleSort('adjustment')}
                    >
                      <div className="flex items-center gap-2">
                        Adjustment
                        {sortColumn === 'adjustment' && (
                          sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                        )}
                        {sortColumn !== 'adjustment' && <ArrowUpDown className="h-4 w-4 opacity-50" />}
                      </div>
                    </TableHead>
                    <TableHead>Reason</TableHead>
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
                    return (
                      <motion.tr
                        key={txn.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b border-border transition-colors hover:bg-muted/50"
                      >
                        <TableCell className="font-medium">
                          {itemName}
                        </TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-2 py-1 text-xs">
                            {itemSku}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant={txn.quantity > 0 ? 'default' : 'destructive'} className={txn.quantity > 0 ? 'bg-green-500' : ''}>
                            {txn.quantity > 0 ? '+' : ''}{txn.quantity}
                          </Badge>
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
          )}
        </CardContent>
      </Card>
      </div>

      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Adjust Stock
            </DialogTitle>
            <DialogDescription>
              Adjust inventory quantity for cycle counts or corrections
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
                            <Badge variant="outline">
                              Current: {item.quantity}
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
                  <p className="text-sm">Current Stock: {selectedItem.quantity} units</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adjustmentType">Adjustment Type *</Label>
                  <Select value={adjustmentType} onValueChange={(value: 'increase' | 'decrease') => setAdjustmentType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="increase">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                          Increase Stock
                        </div>
                      </SelectItem>
                      <SelectItem value="decrease">
                        <div className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-red-500" />
                          Decrease Stock
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter quantity"
                  />
                  {selectedItem && quantity && (
                    <p className="text-sm text-muted-foreground">
                      New stock will be: {selectedItem.quantity + (adjustmentType === 'increase' ? parseInt(quantity || '0') : -parseInt(quantity || '0'))} units
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason *</Label>
                  <Input
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Cycle count, Damaged goods, Found items..."
                  />
                </div>
              </motion.div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdjust} disabled={!selectedItem || !quantity || !reason}>
              <Settings className="mr-2 h-4 w-4" />
              Confirm Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
