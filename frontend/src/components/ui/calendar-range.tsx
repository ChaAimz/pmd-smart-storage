"use client"

import * as React from "react"
import { addDays } from "date-fns"
import { type DateRange } from "react-day-picker"

import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"

interface CalendarRangeProps {
  dateRange?: DateRange
  onDateRangeChange?: (range: DateRange | undefined) => void
}

export function CalendarRange({ dateRange, onDateRangeChange }: CalendarRangeProps) {
  const [localDateRange, setLocalDateRange] = React.useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), 0, 12),
    to: addDays(new Date(new Date().getFullYear(), 0, 12), 30),
  })

  React.useEffect(() => {
    if (dateRange) {
      setLocalDateRange(dateRange)
    }
  }, [dateRange])

  const handleSelect = (range: DateRange | undefined) => {
    setLocalDateRange(range)
    onDateRangeChange?.(range)
  }

  return (
    <Card className="mx-auto w-fit p-0">
      <CardContent className="p-0">
        <Calendar
          mode="range"
          defaultMonth={localDateRange?.from}
          selected={localDateRange}
          onSelect={handleSelect}
          numberOfMonths={2}
          className="rounded-lg border"
          disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
        />
      </CardContent>
    </Card>
  )
}
