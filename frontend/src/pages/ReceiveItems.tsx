import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  PackagePlus,
  CalendarClock,
  CalendarDays,
  Package,
  TrendingUp,
  Activity,
  Clock3,
  Timer,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Hash,
} from 'lucide-react'

interface ItemLike {
  name?: string
  master_name?: string
  local_name?: string
  sku?: string
  master_sku?: string
  local_sku?: string
}

interface PRItemLike extends ItemLike {
  item_name?: string
  requested_quantity?: number
  quantity?: number
  received_quantity?: number
  pending_quantity?: number
  remaining_quantity?: number
}

interface PRLike {
  id: number
  pr_number?: string
  status?: string
  required_date?: string
  expected_delivery_date?: string
  expected_date?: string
  items?: PRItemLike[]
}

// Helper functions to handle both old and new API response formats
const getItemName = (item?: ItemLike | null): string => {
  return item?.name || item?.master_name || item?.local_name || 'Unknown'
}

const getItemSku = (item?: ItemLike | null): string => {
  return item?.sku || item?.master_sku || item?.local_sku || 'N/A'
}

const getPrItemName = (item?: PRItemLike | null): string => {
  return item?.item_name || item?.name || item?.local_name || item?.master_name || 'Unknown'
}

const getPrItemSku = (item?: PRItemLike | null): string => {
  return item?.sku || item?.local_sku || item?.master_sku || 'N/A'
}

const getPrExpectedDate = (pr?: PRLike | null): string | null => {
  return pr?.required_date || pr?.expected_delivery_date || pr?.expected_date || null
}

const parseDateOnly = (value?: string | null): Date | null => {
  if (!value) return null
  const dateOnly = value.split('T')[0]
  const [year, month, day] = dateOnly.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate())

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const toInputDateValue = (value?: string | null): string => {
  const date = parseDateOnly(value)
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const formatPrStatus = (status?: string): string => {
  if (!status) return 'Ordered'
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const getPrStatusBadgeClass = (status?: string): string => {
  switch (status) {
    case 'partially_received':
      return 'border-border bg-amber-50 text-amber-700 dark:border-border dark:bg-amber-950/50 dark:text-amber-200'
    case 'fully_received':
      return 'border-border bg-emerald-50 text-emerald-700 dark:border-border dark:bg-emerald-950/50 dark:text-emerald-200'
    case 'cancelled':
      return 'border-border bg-rose-50 text-rose-700 dark:border-border dark:bg-rose-950/50 dark:text-rose-200'
    case 'ordered':
    default:
      return 'border-border bg-blue-50 text-blue-700 dark:border-border dark:bg-blue-950/50 dark:text-blue-200'
  }
}

const getPrStatusIcon = (status?: string) => {
  switch (status) {
    case 'fully_received':
      return CheckCircle2
    case 'cancelled':
      return XCircle
    case 'partially_received':
      return Timer
    case 'ordered':
    default:
      return Clock3
  }
}

const getEtaMeta = (expectedDate?: string | null) => {
  const date = parseDateOnly(expectedDate)
  const displayDate = date ? date.toLocaleDateString('en-US') : '-'

  if (!date) {
    return {
      displayDate,
      hint: 'No ETA',
      hintIcon: AlertTriangle,
      etaBadgeClass: 'border-border text-muted-foreground',
      hintBadgeClass: 'bg-muted text-muted-foreground',
    }
  }

  const today = startOfDay(new Date())
  const target = startOfDay(date)
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return {
      displayDate,
      hint: 'Delayed',
      hintIcon: AlertTriangle,
      etaBadgeClass: 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200',
      hintBadgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200',
    }
  }

  if (diffDays === 0) {
    return {
      displayDate,
      hint: 'Today',
      hintIcon: Timer,
      etaBadgeClass: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
      hintBadgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
    }
  }

  if (diffDays === 1) {
    return {
      displayDate,
      hint: 'Tomorrow',
      hintIcon: Clock3,
      etaBadgeClass: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200',
      hintBadgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
    }
  }

  if (diffDays <= 3) {
    return {
      displayDate,
      hint: `In ${diffDays} days`,
      hintIcon: Clock3,
      etaBadgeClass: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200',
      hintBadgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
    }
  }

  return {
    displayDate,
    hint: 'Scheduled',
    hintIcon: Clock3,
    etaBadgeClass: 'border-border bg-muted/40 text-foreground',
    hintBadgeClass: 'bg-muted text-muted-foreground',
  }
}
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusCard } from '@/components/ui/status-card'
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
import { useAuth } from '@/contexts/use-auth'
import { usePageContext } from '@/contexts/use-page-context'

interface PRGuideItem {
  itemName: string
  sku: string
  remainingQuantity: number
}

interface PRGuideEntry {
  id: number
  prNumber: string
  expectedDate: string
  status: string
  items: PRGuideItem[]
}

interface PRReceiveDialogItem {
  pr_item_id: number
  item_name: string
  sku: string
  requested_quantity: number
  already_received_quantity: number
  remaining_quantity: number
  receive_quantity: number
}

const COMPACT_PRIMARY_BUTTON_CLASS = 'h-8 px-3 text-xs'
const COMPACT_OUTLINE_BUTTON_CLASS = 'h-8 px-3 text-xs'
const DIALOG_PRIMARY_BUTTON_CLASS = 'h-9 px-4'
const DIALOG_OUTLINE_BUTTON_CLASS = 'h-9 px-4'

export function ReceiveItems() {
  const [items, setItems] = useState<api.Item[]>([])
  const [transactions, setTransactions] = useState<api.Transaction[]>([])
  const [incomingPrGuide, setIncomingPrGuide] = useState<PRGuideEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingPrGuide, setIsLoadingPrGuide] = useState(false)
  const [showReceiveDialog, setShowReceiveDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<api.Item | null>(null)
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [filterText, setFilterText] = useState('')
  const [todayPrFilterText, setTodayPrFilterText] = useState('')
  const [weeklyPrFilterText, setWeeklyPrFilterText] = useState('')
  const [showPrReceiveDialog, setShowPrReceiveDialog] = useState(false)
  const [isLoadingPrReceiveDetail, setIsLoadingPrReceiveDetail] = useState(false)
  const [isSubmittingPrReceive, setIsSubmittingPrReceive] = useState(false)
  const [selectedPrForReceive, setSelectedPrForReceive] = useState<PRGuideEntry | null>(null)
  const [prReceiveItems, setPrReceiveItems] = useState<PRReceiveDialogItem[]>([])
  const [prReceivePoNumber, setPrReceivePoNumber] = useState('')
  const [prReceiveDate, setPrReceiveDate] = useState(new Date().toISOString().split('T')[0])
  const [prReceiveNotes, setPrReceiveNotes] = useState('')
  const [showMoveEtaDialog, setShowMoveEtaDialog] = useState(false)
  const [isSubmittingMoveEta, setIsSubmittingMoveEta] = useState(false)
  const [selectedPrForEta, setSelectedPrForEta] = useState<PRGuideEntry | null>(null)
  const [etaDate, setEtaDate] = useState('')
  const [etaReason, setEtaReason] = useState('')

  const { user } = useAuth()
  const { setPageInfo } = usePageContext()

  useEffect(() => {
    setPageInfo('Receive Items', 'Receive new inventory into the warehouse')
  }, [setPageInfo])

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [itemsData, transactionsData] = await Promise.all([
        api.getAllItems(),
        api.getTransactions()
      ])
      const receiveTransactions = transactionsData.filter(t => t.transaction_type === 'receive')
      setItems(itemsData)
      setTransactions(receiveTransactions)
      await fetchIncomingPRGuide()
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const fetchIncomingPRGuide = async () => {
    try {
      setIsLoadingPrGuide(true)
      const response = await api.get('/prs')

      if (!response?.success || !Array.isArray(response.data)) {
        setIncomingPrGuide([])
        return
      }

      const today = startOfDay(new Date())
      const weekEnd = addDays(today, 6)

      const prList = response.data as PRLike[]

      const activePRs = prList.filter((pr) =>
        ['ordered', 'partially_received'].includes(pr.status || '')
      )

      const upcomingPRs = activePRs.filter((pr) => {
        const date = parseDateOnly(getPrExpectedDate(pr))
        if (!date) return false
        return date >= today && date <= weekEnd
      })

      if (upcomingPRs.length === 0) {
        setIncomingPrGuide([])
        return
      }

      const details = await Promise.all(
        upcomingPRs.map(async (pr) => {
          const detail = await api.get(`/prs/${pr.id}`)
          const prData = (detail?.success ? detail.data : pr) as PRLike
          const rawItems = Array.isArray(prData?.items) ? prData.items : []

          const items = rawItems
            .map((item) => {
              const requestedQuantity = toFiniteNumber(item?.requested_quantity ?? item?.quantity ?? 0)
              const receivedQuantity = toFiniteNumber(item?.received_quantity ?? 0)
              const pendingQuantity = toFiniteNumber(item?.pending_quantity ?? item?.remaining_quantity, NaN)
              const remainingQuantity = Number.isFinite(pendingQuantity)
                ? Math.max(pendingQuantity, 0)
                : Math.max(requestedQuantity - receivedQuantity, 0)

              return {
                itemName: getPrItemName(item),
                sku: getPrItemSku(item),
                remainingQuantity,
              }
            })
            .filter((item: PRGuideItem) => item.remainingQuantity > 0)

          return {
            id: pr.id,
            prNumber: prData?.pr_number || `PR-${pr.id}`,
            expectedDate: getPrExpectedDate(prData) || '',
            status: prData?.status || pr?.status || 'ordered',
            items,
          } satisfies PRGuideEntry
        })
      )

      const normalizedGuide = details
        .filter((pr) => pr.expectedDate && pr.items.length > 0)
        .sort((a, b) => {
          const left = parseDateOnly(a.expectedDate)?.getTime() || 0
          const right = parseDateOnly(b.expectedDate)?.getTime() || 0
          return left - right
        })

      setIncomingPrGuide(normalizedGuide)
    } catch (error) {
      console.error('Error fetching incoming PR guide:', error)
      setIncomingPrGuide([])
    } finally {
      setIsLoadingPrGuide(false)
    }
  }

  const filteredTransactions = useMemo(() => {
    const keyword = filterText.trim().toLowerCase()
    const filtered = keyword
      ? transactions.filter((txn) => {
          const item = items.find(i => i.id === txn.item_id)
          return (
            getItemName(item).toLowerCase().includes(keyword) ||
            getItemSku(item).toLowerCase().includes(keyword) ||
            (txn.notes || '').toLowerCase().includes(keyword)
          )
        })
      : transactions

    return [...filtered].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }, [transactions, items, filterText])

  const handleOpenDialog = () => {
    setShowReceiveDialog(true)
    setSearchQuery('')
    setSelectedItem(null)
    setQuantity('')
    setNotes('')
  }

  const handleSelectItem = (item: api.Item) => {
    setSelectedItem(item)
    setQuantity('1')
  }

  const handleReceive = async () => {
    if (!selectedItem || !quantity || parseInt(quantity) <= 0) {
      toast.error('Please select an item and enter a valid quantity')
      return
    }

    try {
      await api.createTransaction({
        item_id: selectedItem.id,
        transaction_type: 'receive',
        quantity: parseInt(quantity),
        notes: notes || `Received ${quantity} units`,
        user_id: user?.id || 1
      })

      toast.success(`Received ${quantity} units of ${getItemName(selectedItem)}`)

      setShowReceiveDialog(false)
      fetchData()
    } catch (error) {
      console.error('Error creating receive transaction:', error)
      toast.error('Failed to create receive transaction')
    }
  }

  const filteredItems = items.filter(item =>
    getItemName(item).toLowerCase().includes(searchQuery.toLowerCase()) ||
    getItemSku(item).toLowerCase().includes(searchQuery.toLowerCase())
  )

  const openPrReceiveDialog = async (pr: PRGuideEntry) => {
    try {
      setIsLoadingPrReceiveDetail(true)
      setSelectedPrForReceive(pr)
      setPrReceivePoNumber('')
      setPrReceiveNotes('')
      setPrReceiveDate(new Date().toISOString().split('T')[0])

      const response = await api.get(`/prs/${pr.id}`)
      if (!response?.success || !response.data) {
        toast.error('Failed to load PR details')
        return
      }

      const prData = response.data as PRLike
      const rawItems = Array.isArray(prData.items) ? prData.items : []
      const mappedItems = rawItems
        .map((item) => {
          const prItemId = toFiniteNumber((item as { id?: number })?.id, 0)
          const requestedQuantity = toFiniteNumber(item?.requested_quantity ?? item?.quantity ?? 0)
          const receivedQuantity = toFiniteNumber(item?.received_quantity ?? 0)
          const pendingQuantity = toFiniteNumber(item?.pending_quantity ?? item?.remaining_quantity, Number.NaN)
          const remainingQuantity = Number.isFinite(pendingQuantity)
            ? Math.max(pendingQuantity, 0)
            : Math.max(requestedQuantity - receivedQuantity, 0)

          return {
            pr_item_id: prItemId,
            item_name: getPrItemName(item),
            sku: getPrItemSku(item),
            requested_quantity: requestedQuantity,
            already_received_quantity: receivedQuantity,
            remaining_quantity: remainingQuantity,
            receive_quantity: remainingQuantity,
          } satisfies PRReceiveDialogItem
        })
        .filter((item) => item.pr_item_id > 0 && item.remaining_quantity > 0)

      if (mappedItems.length === 0) {
        toast.info('All items in this PR are already received')
        return
      }

      setPrReceiveItems(mappedItems)
      setShowPrReceiveDialog(true)
    } catch (error) {
      console.error('Error opening PR receive dialog:', error)
      toast.error('Failed to prepare receive form')
    } finally {
      setIsLoadingPrReceiveDetail(false)
    }
  }

  const updatePrReceiveQuantity = (prItemId: number, value: string) => {
    const parsed = Number.parseInt(value, 10)
    const nextQuantity = Number.isNaN(parsed) ? 0 : parsed

    setPrReceiveItems((prev) =>
      prev.map((item) =>
        item.pr_item_id === prItemId
          ? {
              ...item,
              receive_quantity: Math.max(0, Math.min(item.remaining_quantity, nextQuantity)),
            }
          : item
      )
    )
  }

  const handleConfirmPrReceive = async () => {
    if (!selectedPrForReceive) return
    if (!prReceiveDate) {
      toast.error('Receive date is required')
      return
    }

    const lines = prReceiveItems
      .filter((item) => item.receive_quantity > 0)
      .map((item) => ({
        pr_item_id: item.pr_item_id,
        received_quantity: item.receive_quantity,
      }))

    if (lines.length === 0) {
      toast.error('Please enter receive quantity for at least one item')
      return
    }

    try {
      setIsSubmittingPrReceive(true)
      const response = await api.post(`/prs/${selectedPrForReceive.id}/receive`, {
        po_number: prReceivePoNumber.trim() || undefined,
        received_date: prReceiveDate,
        notes: prReceiveNotes.trim() || undefined,
        items: lines,
      })

      if (!response?.success) {
        toast.error(response?.error || 'Failed to receive items')
        return
      }

      toast.success('PR receipt saved')
      setShowPrReceiveDialog(false)
      setSelectedPrForReceive(null)
      setPrReceiveItems([])
      await fetchIncomingPRGuide()
    } catch (error) {
      console.error('Error submitting PR receive:', error)
      toast.error('Failed to receive items')
    } finally {
      setIsSubmittingPrReceive(false)
    }
  }

  const openMoveEtaDialog = (pr: PRGuideEntry) => {
    setSelectedPrForEta(pr)
    setEtaDate(toInputDateValue(pr.expectedDate) || new Date().toISOString().split('T')[0])
    setEtaReason('')
    setShowMoveEtaDialog(true)
  }

  const handleMoveEta = async () => {
    if (!selectedPrForEta) return
    if (!etaDate) {
      toast.error('Please select a new ETA date')
      return
    }

    try {
      setIsSubmittingMoveEta(true)
      const response = await api.post(`/prs/${selectedPrForEta.id}/eta`, {
        required_date: etaDate,
        reason: etaReason.trim() || undefined,
      })

      if (!response?.success) {
        toast.error(response?.error || 'Failed to update ETA')
        return
      }

      toast.success(`ETA updated for ${selectedPrForEta.prNumber}`)
      setShowMoveEtaDialog(false)
      setSelectedPrForEta(null)
      await fetchIncomingPRGuide()
    } catch (error) {
      console.error('Error moving ETA:', error)
      toast.error('Failed to update ETA')
    } finally {
      setIsSubmittingMoveEta(false)
    }
  }

  const totalPrReceiveQuantity = useMemo(
    () => prReceiveItems.reduce((sum, item) => sum + item.receive_quantity, 0),
    [prReceiveItems]
  )

  const todayPrGuide = useMemo(() => {
    const today = startOfDay(new Date())
    return incomingPrGuide.filter((pr) => {
      const expected = parseDateOnly(pr.expectedDate)
      return !!expected && expected.getTime() === today.getTime()
    })
  }, [incomingPrGuide])

  const weekPrGuide = useMemo(() => {
    const today = startOfDay(new Date())
    const weekEnd = addDays(today, 6)
    return incomingPrGuide.filter((pr) => {
      const expected = parseDateOnly(pr.expectedDate)
      return !!expected && expected > today && expected <= weekEnd
    })
  }, [incomingPrGuide])

  const filteredTodayPrGuide = useMemo(() => {
    const keyword = todayPrFilterText.trim().toLowerCase()
    if (!keyword) return todayPrGuide

    return todayPrGuide.filter((pr) => {
      if (pr.prNumber.toLowerCase().includes(keyword)) return true
      if (pr.status.toLowerCase().includes(keyword)) return true
      return pr.items.some((item) =>
        item.itemName.toLowerCase().includes(keyword) || item.sku.toLowerCase().includes(keyword)
      )
    })
  }, [todayPrGuide, todayPrFilterText])

  const filteredWeekPrGuide = useMemo(() => {
    const keyword = weeklyPrFilterText.trim().toLowerCase()
    if (!keyword) return weekPrGuide

    return weekPrGuide.filter((pr) => {
      if (pr.prNumber.toLowerCase().includes(keyword)) return true
      if (pr.status.toLowerCase().includes(keyword)) return true
      return pr.items.some((item) =>
        item.itemName.toLowerCase().includes(keyword) || item.sku.toLowerCase().includes(keyword)
      )
    })
  }, [weekPrGuide, weeklyPrFilterText])

  const todaySkuCount = filteredTodayPrGuide.reduce((sum, pr) => sum + pr.items.length, 0)
  const weekSkuCount = filteredWeekPrGuide.reduce((sum, pr) => sum + pr.items.length, 0)
  const todayPendingQuantity = todayPrGuide.reduce(
    (sum, pr) => sum + pr.items.reduce((itemSum, item) => itemSum + item.remainingQuantity, 0),
    0
  )
  const weekPendingQuantity = weekPrGuide.reduce(
    (sum, pr) => sum + pr.items.reduce((itemSum, item) => itemSum + item.remainingQuantity, 0),
    0
  )
  const incomingLineCount = incomingPrGuide.reduce((sum, pr) => sum + pr.items.length, 0)
  const incomingQuantity = incomingPrGuide.reduce(
    (sum, pr) => sum + pr.items.reduce((itemSum, item) => itemSum + item.remainingQuantity, 0),
    0
  )
  const receivedToday = useMemo(() => {
    const today = startOfDay(new Date())
    return transactions.filter((txn) => {
      const createdAt = startOfDay(new Date(txn.created_at))
      return createdAt.getTime() === today.getTime()
    })
  }, [transactions])
  const receivedTodayQuantity = receivedToday.reduce((sum, txn) => sum + txn.quantity, 0)

  return (
    <div className="h-full min-h-0 overflow-y-auto lg:overflow-hidden">
      <div className="flex h-full min-h-0 flex-col gap-3 px-2.5 py-2 sm:gap-3.5 sm:px-3 sm:py-2.5 lg:gap-4 lg:px-3.5 lg:py-3">
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0">
          <StatusCard
            title="Today Arrivals"
            value={todayPrGuide.length}
            description={`${todayPendingQuantity} units pending / ${todaySkuCount} lines`}
            icon={CalendarClock}
            accentClassName="text-sky-700 dark:text-sky-300"
            className="min-w-[250px] snap-start lg:min-w-0"
          />
          <StatusCard
            title="Weekly Pipeline"
            value={weekPrGuide.length}
            description={`${weekPendingQuantity} units pending / ${weekSkuCount} lines`}
            icon={TrendingUp}
            accentClassName="text-cyan-700 dark:text-cyan-300"
            className="min-w-[250px] snap-start lg:min-w-0"
          />
          <StatusCard
            title="Received Today"
            value={receivedTodayQuantity}
            description={`${receivedToday.length} receive transactions`}
            icon={PackagePlus}
            accentClassName="text-emerald-700 dark:text-emerald-300"
            className="min-w-[250px] snap-start lg:min-w-0"
          />
          <StatusCard
            title="Incoming Snapshot"
            value={incomingLineCount}
            description={`${incomingPrGuide.length} PR / ${incomingQuantity} units`}
            icon={Package}
            accentClassName="text-slate-700 dark:text-slate-300"
            className="min-w-[250px] snap-start lg:min-w-0"
          />
        </div>

        <div className="grid min-h-0 flex-1 gap-3.5 overflow-visible lg:grid-cols-3 lg:grid-rows-1 lg:overflow-hidden">
        <Card className="flex min-h-[440px] flex-col overflow-hidden border-border/70 bg-background/90 lg:min-h-0 lg:h-full dark:border-border/60 dark:bg-background/70">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-blue-600 dark:text-blue-300" />
              Today PR
            </CardTitle>
            <CardDescription>{filteredTodayPrGuide.length} PR / {todaySkuCount} items</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-0">
            {isLoadingPrGuide ? (
              <TableLoadingSkeleton />
            ) : (
              <>
                <div className="mb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500/80 dark:text-blue-300/80" />
                    <Input
                      placeholder="Search PR number, item, or SKU..."
                      value={todayPrFilterText}
                      onChange={(e) => setTodayPrFilterText(e.target.value)}
                      className="border-input bg-background/80 pl-10 dark:border-input dark:bg-background/70"
                    />
                  </div>
                </div>

                {filteredTodayPrGuide.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {todayPrFilterText ? 'No matching PR for today' : 'No incoming PR for today'}
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-scroll pr-2 [scrollbar-gutter:stable]">
                    {filteredTodayPrGuide.map((pr, index) => {
                      const etaMeta = getEtaMeta(pr.expectedDate)
                      const StatusIcon = getPrStatusIcon(pr.status)
                      const EtaHintIcon = etaMeta.hintIcon

                      return (
                        <motion.div
                          key={pr.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.04 }}
                          className="rounded-lg border border-border/70 bg-muted/35 p-3 dark:border-border/60 dark:bg-muted/20"
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-900 dark:text-blue-100">
                              <Package className="h-3.5 w-3.5" />
                              {pr.prNumber}
                            </p>
                            <Badge variant="outline" className={`text-[10px] ${getPrStatusBadgeClass(pr.status)}`}>
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {formatPrStatus(pr.status)}
                            </Badge>
                          </div>
                          <div className="mb-2 flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className={`h-6 gap-1 rounded-md px-2 text-[11px] ${etaMeta.etaBadgeClass}`}>
                              <CalendarDays className="h-3.5 w-3.5" />
                              ETA {etaMeta.displayDate}
                            </Badge>
                            <Badge variant="secondary" className={`h-6 gap-1 rounded-md px-2 text-[11px] ${etaMeta.hintBadgeClass}`}>
                              <EtaHintIcon className="h-3.5 w-3.5" />
                              {etaMeta.hint}
                            </Badge>
                          </div>
                          <div className="space-y-1">
                            {pr.items.map((item) => (
                              <div
                                key={`${pr.id}-${item.sku}-${item.itemName}`}
                                className="flex items-center gap-1.5 text-xs text-blue-950/90 dark:text-blue-100/90"
                              >
                                <Package className="h-3.5 w-3.5 text-muted-foreground/80" />
                                <span>{item.itemName} ({item.sku}) x</span>
                                <Badge className="h-5 bg-emerald-500 px-2 text-[11px] text-white hover:bg-emerald-500">
                                  <Hash className="mr-1 h-3 w-3" />
                                  {item.remainingQuantity}
                                </Badge>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <Button
                              size="sm"
                              className={COMPACT_PRIMARY_BUTTON_CLASS}
                              onClick={() => openPrReceiveDialog(pr)}
                              disabled={isLoadingPrReceiveDetail}
                            >
                              <PackagePlus className="mr-1 h-3.5 w-3.5" />
                              Receive
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className={COMPACT_OUTLINE_BUTTON_CLASS}
                              onClick={() => openMoveEtaDialog(pr)}
                            >
                              <CalendarDays className="mr-1 h-3.5 w-3.5" />
                              Change ETA
                            </Button>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-[440px] flex-col overflow-hidden border-border/70 bg-background/90 lg:min-h-0 lg:h-full dark:border-border/60 dark:bg-background/70">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-sky-600 dark:text-sky-300" />
              Weekly PR
            </CardTitle>
            <CardDescription>{filteredWeekPrGuide.length} PR / {weekSkuCount} items</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-0">
            {isLoadingPrGuide ? (
              <TableLoadingSkeleton />
            ) : (
              <>
                <div className="mb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-500/80 dark:text-sky-300/80" />
                    <Input
                      placeholder="Search PR number, item, or SKU..."
                      value={weeklyPrFilterText}
                      onChange={(e) => setWeeklyPrFilterText(e.target.value)}
                      className="border-input bg-background/80 pl-10 dark:border-input dark:bg-background/70"
                    />
                  </div>
                </div>

                {filteredWeekPrGuide.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {weeklyPrFilterText ? 'No matching PR for this week' : 'No incoming PR this week'}
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-scroll pr-2 [scrollbar-gutter:stable]">
                    {filteredWeekPrGuide.map((pr, index) => {
                      const etaMeta = getEtaMeta(pr.expectedDate)
                      const StatusIcon = getPrStatusIcon(pr.status)
                      const EtaHintIcon = etaMeta.hintIcon

                      return (
                        <motion.div
                          key={pr.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.04 }}
                          className="rounded-lg border border-border/70 bg-muted/35 p-3 dark:border-border/60 dark:bg-muted/20"
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-sky-900 dark:text-sky-100">
                              <Package className="h-3.5 w-3.5" />
                              {pr.prNumber}
                            </p>
                            <Badge variant="outline" className={`text-[10px] ${getPrStatusBadgeClass(pr.status)}`}>
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {formatPrStatus(pr.status)}
                            </Badge>
                          </div>
                          <div className="mb-2 flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className={`h-6 gap-1 rounded-md px-2 text-[11px] ${etaMeta.etaBadgeClass}`}>
                              <CalendarDays className="h-3.5 w-3.5" />
                              ETA {etaMeta.displayDate}
                            </Badge>
                            <Badge variant="secondary" className={`h-6 gap-1 rounded-md px-2 text-[11px] ${etaMeta.hintBadgeClass}`}>
                              <EtaHintIcon className="h-3.5 w-3.5" />
                              {etaMeta.hint}
                            </Badge>
                          </div>
                          <div className="space-y-1">
                            {pr.items.map((item) => (
                              <div
                                key={`${pr.id}-${item.sku}-${item.itemName}`}
                                className="flex items-center gap-1.5 text-xs text-sky-950/90 dark:text-sky-100/90"
                              >
                                <Package className="h-3.5 w-3.5 text-muted-foreground/80" />
                                <span>{item.itemName} ({item.sku}) x</span>
                                <Badge className="h-5 bg-emerald-500 px-2 text-[11px] text-white hover:bg-emerald-500">
                                  <Hash className="mr-1 h-3 w-3" />
                                  {item.remainingQuantity}
                                </Badge>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <Button
                              size="sm"
                              className={COMPACT_PRIMARY_BUTTON_CLASS}
                              onClick={() => openPrReceiveDialog(pr)}
                              disabled={isLoadingPrReceiveDetail}
                            >
                              <PackagePlus className="mr-1 h-3.5 w-3.5" />
                              Receive
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className={COMPACT_OUTLINE_BUTTON_CLASS}
                              onClick={() => openMoveEtaDialog(pr)}
                            >
                              <CalendarDays className="mr-1 h-3.5 w-3.5" />
                              Change ETA
                            </Button>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-[440px] flex-col overflow-hidden border-border/70 bg-background/90 lg:min-h-0 lg:h-full dark:border-border/60 dark:bg-background/70">
          <CardHeader className="relative flex flex-col gap-2 pb-3 pr-0 sm:pr-36">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
              Recent Receive
            </CardTitle>
            <CardDescription>{filteredTransactions.length} transactions</CardDescription>
            <Button
              onClick={handleOpenDialog}
              size="sm"
              className={`w-full sm:absolute sm:right-6 sm:top-6 sm:w-auto ${COMPACT_PRIMARY_BUTTON_CLASS}`}
            >
              <PackagePlus className="mr-2 h-4 w-4" />
              Quick Receive
            </Button>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-0">
            <div className="mb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500/80 dark:text-emerald-300/80" />
                <Input
                  placeholder="Filter by item name, SKU, or notes..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="w-full border-input bg-background/80 pl-10 dark:border-input dark:bg-background/70"
                />
              </div>
            </div>

            {isLoading ? (
              <TableLoadingSkeleton />
            ) : filteredTransactions.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {filterText ? 'No matching transactions found' : 'No receive transactions yet'}
              </div>
            ) : (
              <div className="h-full min-h-0 overflow-hidden rounded-lg border border-border/70 bg-background">
                <div className="h-full overflow-auto">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="w-[88px]">Qty</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-[158px]">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((txn) => {
                      const fallbackItem = items.find(i => i.id === txn.item_id)
                      const itemName = txn.item_name || getItemName(fallbackItem)
                      const itemSku = txn.sku || getItemSku(fallbackItem)

                      return (
                        <TableRow key={txn.id}>
                          <TableCell>
                            <p className="font-medium">{itemName}</p>
                            <p className="text-xs text-muted-foreground">{itemSku}</p>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">
                              <Hash className="mr-1 h-3 w-3" />
                              {txn.quantity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{txn.notes || '-'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(txn.created_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
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
      </div>

      <Dialog
        open={showPrReceiveDialog}
        onOpenChange={(open) => {
          setShowPrReceiveDialog(open)
          if (!open) {
            setSelectedPrForReceive(null)
            setPrReceiveItems([])
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5" />
              Receive PR Items
            </DialogTitle>
            <DialogDescription>
              {selectedPrForReceive
                ? `PR ${selectedPrForReceive.prNumber} - confirm quantities received today`
                : 'Select quantities to receive from this PR'}
            </DialogDescription>
          </DialogHeader>

          {isLoadingPrReceiveDetail ? (
            <div className="py-4">
              <TableLoadingSkeleton />
            </div>
          ) : (
            <div className="flex max-h-[60vh] min-h-0 flex-col gap-3 overflow-hidden">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pr-po-number">Supplier PO Number (Optional)</Label>
                  <Input
                    id="pr-po-number"
                    placeholder="PO-2026-0001"
                    value={prReceivePoNumber}
                    onChange={(e) => setPrReceivePoNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pr-receive-date">Receive Date *</Label>
                  <Input
                    id="pr-receive-date"
                    type="date"
                    value={prReceiveDate}
                    onChange={(e) => setPrReceiveDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pr-receive-notes">Receive Notes (Optional)</Label>
                <Textarea
                  id="pr-receive-notes"
                  placeholder="Additional notes for this receipt..."
                  value={prReceiveNotes}
                  onChange={(e) => setPrReceiveNotes(e.target.value)}
                  className="min-h-[72px]"
                />
              </div>

              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                {prReceiveItems.map((item) => (
                  <div
                    key={item.pr_item_id}
                    className="rounded-lg border border-border/70 bg-card p-2.5 dark:border-slate-700 dark:bg-slate-900/40"
                  >
                    <div className="mb-1.5 flex items-start justify-between gap-2.5">
                      <div>
                        <p className="text-sm font-medium">{item.item_name}</p>
                        <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                      </div>
                      <Badge variant="outline">
                        Remaining {item.remaining_quantity}
                      </Badge>
                    </div>
                    <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <p>Requested: {item.requested_quantity}</p>
                      <p>Already received: {item.already_received_quantity}</p>
                    </div>
                    <div className="mt-2 space-y-1">
                      <Label htmlFor={`receive-qty-${item.pr_item_id}`}>Receive Quantity</Label>
                      <Input
                        id={`receive-qty-${item.pr_item_id}`}
                        type="number"
                        min={0}
                        max={item.remaining_quantity}
                        value={item.receive_quantity}
                        onChange={(e) => updatePrReceiveQuantity(item.pr_item_id, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-md border border-border/70 bg-muted/40 px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900/40">
                {prReceiveItems.length} items selected / Total receive qty {totalPrReceiveQuantity}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" className={DIALOG_OUTLINE_BUTTON_CLASS} onClick={() => setShowPrReceiveDialog(false)}>
              Cancel
            </Button>
            <Button
              className={DIALOG_PRIMARY_BUTTON_CLASS}
              onClick={handleConfirmPrReceive}
              disabled={isLoadingPrReceiveDetail || isSubmittingPrReceive || prReceiveItems.length === 0}
            >
              <PackagePlus className="mr-2 h-4 w-4" />
              {isSubmittingPrReceive ? 'Saving...' : 'Confirm Receive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showMoveEtaDialog}
        onOpenChange={(open) => {
          setShowMoveEtaDialog(open)
          if (!open) {
            setSelectedPrForEta(null)
            setEtaDate('')
            setEtaReason('')
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Change ETA
            </DialogTitle>
            <DialogDescription>
              {selectedPrForEta ? `Change ETA for ${selectedPrForEta.prNumber}` : 'Change PR ETA'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-eta-date">New ETA Date *</Label>
              <Input
                id="new-eta-date"
                type="date"
                value={etaDate}
                onChange={(e) => setEtaDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eta-reason">Reason (Optional)</Label>
              <Textarea
                id="eta-reason"
                placeholder="Supplier delayed shipment, purchasing updated ETA, etc."
                value={etaReason}
                onChange={(e) => setEtaReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className={DIALOG_OUTLINE_BUTTON_CLASS} onClick={() => setShowMoveEtaDialog(false)}>
              Cancel
            </Button>
            <Button className={DIALOG_PRIMARY_BUTTON_CLASS} onClick={handleMoveEta} disabled={isSubmittingMoveEta || !etaDate}>
              {isSubmittingMoveEta ? 'Changing...' : 'Change ETA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5" />
              Receive Item
            </DialogTitle>
            <DialogDescription>
              Search and select an item to receive into inventory
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
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
                  <div className="p-3 text-center text-muted-foreground">
                    No items found
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredItems.slice(0, 10).map((item) => (
                      <div
                        key={item.id}
                        className={`p-2.5 cursor-pointer hover:bg-accent transition-colors ${
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
                className="space-y-3 rounded-lg border bg-accent/50 p-3"
              >
                <div>
                  <Label className="text-xs text-muted-foreground">Selected Item</Label>
                  <p className="font-medium">{getItemName(selectedItem)}</p>
                  <p className="text-sm text-muted-foreground">SKU: {getItemSku(selectedItem)}</p>
                  <p className="text-sm">Current Stock: {selectedItem.quantity} units</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="quantity">Quantity to Receive *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter quantity"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Input
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g., PO #12345, Supplier name..."
                  />
                </div>
              </motion.div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className={DIALOG_OUTLINE_BUTTON_CLASS} onClick={() => setShowReceiveDialog(false)}>
              Cancel
            </Button>
            <Button className={DIALOG_PRIMARY_BUTTON_CLASS} onClick={handleReceive} disabled={!selectedItem || !quantity}>
              <PackagePlus className="mr-2 h-4 w-4" />
              Confirm Receive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
