import { useMemo } from 'react'
import { AlertTriangle, Box, Building2, Image as ImageIcon, Ruler, ShieldAlert, TrendingUp } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import * as api from '@/services/api'
import { Badge } from '@/components/ui/badge'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'

interface ItemNameHoverCardProps {
  name: string
  sku: string
  item?: Partial<api.Item> | null
  transactions?: api.Transaction[]
  className?: string
}

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate())

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const formatShortDate = (date: Date): string =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export function ItemNameHoverCard({
  name,
  sku,
  item,
  transactions = [],
  className,
}: ItemNameHoverCardProps) {
  const onHand = Number(item?.quantity || 0)
  const reorderPoint = Number(item?.reorder_point || 0)
  const safetyStock = Number(item?.safety_stock || 0)
  const reorderQty = Number(item?.reorder_quantity || 0)
  const unit = String(item?.unit || 'pcs').trim() || 'pcs'
  const supplier = item?.supplier_name || '-'
  const category = item?.category || '-'
  const isCritical = onHand <= reorderPoint

  const chartData = useMemo(() => {
    const today = startOfDay(new Date())
    const points = 12
    const startDate = addDays(today, -77)

    const candidateTx = transactions
      .filter((tx) => tx.item_id === item?.id || tx.sku === sku)
      .filter((tx) => tx.transaction_type === 'pick' || tx.transaction_type === 'receive')
      .map((tx) => ({ ...tx, date: startOfDay(new Date(tx.created_at)) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    const txInRange = candidateTx.filter((tx) => tx.date >= startDate && tx.date <= today)
    const netSinceStart = txInRange.reduce((sum, tx) => {
      if (tx.transaction_type === 'receive') return sum + Math.abs(Number(tx.quantity) || 0)
      return sum - Math.abs(Number(tx.quantity) || 0)
    }, 0)

    let runningOnHand = Math.max(0, onHand - netSinceStart)
    let cursorDate = addDays(startDate, -1)

    const pointsData: Array<{ idx: number; t: string; onHand: number; date: Date }> = []
    for (let i = 0; i < points; i += 1) {
      const pointDate = i === points - 1 ? today : addDays(startDate, i * 7)
      const rangeTx = txInRange.filter((tx) => tx.date > cursorDate && tx.date <= pointDate)
      rangeTx.forEach((tx) => {
        if (tx.transaction_type === 'receive') runningOnHand += Math.abs(Number(tx.quantity) || 0)
        if (tx.transaction_type === 'pick') runningOnHand -= Math.abs(Number(tx.quantity) || 0)
      })
      pointsData.push({
        idx: i,
        t: i === points - 1 ? 'Today' : formatShortDate(pointDate),
        onHand: Math.max(0, runningOnHand),
        date: pointDate,
      })
      cursorDate = pointDate
    }

    if (pointsData.length > 0) pointsData[pointsData.length - 1].onHand = onHand
    return pointsData
  }, [item?.id, onHand, sku, transactions])

  const maxY = Math.max(...chartData.map((d) => d.onHand), reorderPoint, safetyStock, 10)

  return (
    <HoverCard openDelay={120} closeDelay={100}>
      <HoverCardTrigger asChild>
        <span className={className || 'cursor-default'}>{name}</span>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-[340px] space-y-2.5 p-3">
        <div className="flex items-start gap-2.5">
          <div className="h-12 w-12 overflow-hidden rounded-md border border-border/60 bg-muted/30">
            {item?.image_url ? (
              <img src={item.image_url} alt={name} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="text-xs text-muted-foreground">{sku}</p>
          </div>
          {isCritical ? (
            <Badge variant="destructive" className="h-5 px-2 text-[10px]">Critical</Badge>
          ) : (
            <Badge variant="outline" className="h-5 px-2 text-[10px]">Normal</Badge>
          )}
        </div>

        <div className="rounded-md border border-border/70 bg-background p-2">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Onhand Timeline (3M)</div>
          <div className="h-28 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="idx"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickCount={4}
                  tickFormatter={(value) => chartData[value]?.t ?? ''}
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, Math.ceil(maxY * 1.1)]}
                  width={26}
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <ReferenceLine y={reorderPoint} stroke="#f59e0b" strokeDasharray="3 4" strokeOpacity={0.7} />
                <ReferenceLine y={safetyStock} stroke="#ef4444" strokeDasharray="3 4" strokeOpacity={0.7} />
                <Area type="stepAfter" dataKey="onHand" stroke="none" fill="#0ea5e9" fillOpacity={0.08} isAnimationActive={false} />
                <Line type="stepAfter" dataKey="onHand" stroke="#0ea5e9" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Tooltip
                  cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const value = Number(payload[0]?.value || 0)
                    return (
                      <div className="rounded border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground shadow-sm">
                        <p className="mb-0.5">{String(label || '')}</p>
                        <p className="font-semibold text-foreground">Onhand: {value}</p>
                      </div>
                    )
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex flex-nowrap items-center gap-1 text-[10px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200"><span className="h-1.5 w-3 rounded bg-sky-500" />Onhand</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200"><span className="h-1.5 w-3 rounded bg-amber-500" />Reorder</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"><span className="h-1.5 w-3 rounded bg-rose-500" />Safety</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          <div className="rounded-md border border-border/60 bg-muted/20 px-2 py-1"><p className="text-[9px] uppercase tracking-wide text-muted-foreground">Onhand</p><p className="inline-flex items-center gap-1 text-[12px] font-semibold text-foreground"><Box className="h-3 w-3 text-muted-foreground" />{onHand}</p></div>
          <div className="rounded-md border border-border/60 bg-muted/20 px-2 py-1"><p className="text-[9px] uppercase tracking-wide text-muted-foreground">PR</p><p className="inline-flex items-center gap-1 text-[12px] font-semibold text-foreground"><TrendingUp className="h-3 w-3 text-muted-foreground" />{reorderQty}</p></div>
          <div className="rounded-md border border-border/60 bg-muted/20 px-2 py-1"><p className="text-[9px] uppercase tracking-wide text-muted-foreground">Reorder</p><p className="inline-flex items-center gap-1 text-[12px] font-semibold text-foreground"><AlertTriangle className="h-3 w-3 text-muted-foreground" />{reorderPoint}</p></div>
          <div className="rounded-md border border-border/60 bg-muted/20 px-2 py-1"><p className="text-[9px] uppercase tracking-wide text-muted-foreground">Safety</p><p className="inline-flex items-center gap-1 text-[12px] font-semibold text-foreground"><ShieldAlert className="h-3 w-3 text-muted-foreground" />{safetyStock}</p></div>
        </div>

        <div className="grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
          <div className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-background px-2 py-0.5"><Ruler className="h-3.5 w-3.5" /><span>{unit}</span></div>
          <div className="col-span-2 inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-background px-2 py-0.5"><Building2 className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{supplier}</span></div>
          <div className="col-span-3 inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-background px-2 py-0.5"><span className="truncate">{category}</span></div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

