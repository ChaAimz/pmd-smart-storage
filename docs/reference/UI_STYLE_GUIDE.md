# UI Style Guide (Shadcn-First, Theme-Safe)

This guide defines the frontend UI baseline for dashboard pages and redesign work.

## Design Direction

- Use **shadcn/ui dashboard style** as the default direction.
- Compose pages with:
  - KPI summary row
  - operational cards/panels
  - structured activity/log area
- Prefer local shadcn components from `frontend/src/components/ui/*`.
- Keep page frame spacing consistent with Receive baseline:
  - `px-2.5 pt-2.5 pb-1.5`
  - `lg:px-3.5 lg:pt-3.5 lg:pb-2.5`

## Core Rule: Theme-Safe Over Hardcoded Colors

Use semantic classes and shadcn variants so palette changes are low-impact.

- Prefer:
  - `bg-background`
  - `text-foreground`
  - `border-border`
  - `border-input`
  - `bg-muted`
- Avoid hardcoded palette classes for reusable controls:
  - `bg-blue-*`, `bg-emerald-*`, `border-sky-*`, etc.

## Button System

- In one page/view, keep button tone unified.
- Use shadcn `Button` variants first:
  - `default` for primary
  - `outline` for secondary
  - `secondary` for soft emphasis
- Keep button size on a fixed scale:
  - compact list actions: `h-7 px-2.5 text-xs`
  - dialog/footer actions: `h-9 px-4`
- Baseline reference: use `/pick` page `Quick Pick` as the compact quick-action standard.
- If repeated styles exist, define shared constants.

Example:

```tsx
const COMPACT_PRIMARY_BUTTON_CLASS = 'h-7 px-2.5 text-xs'
const COMPACT_OUTLINE_BUTTON_CLASS = 'h-7 px-2.5 text-xs'
const DIALOG_PRIMARY_BUTTON_CLASS = 'h-9 px-4'
const DIALOG_OUTLINE_BUTTON_CLASS = 'h-9 px-4'

<Button size="sm" className={COMPACT_PRIMARY_BUTTON_CLASS}>Receive</Button>
<Button size="sm" variant="outline" className={COMPACT_OUTLINE_BUTTON_CLASS}>Change ETA</Button>
<Button className={DIALOG_PRIMARY_BUTTON_CLASS}>Confirm</Button>
<Button variant="outline" className={DIALOG_OUTLINE_BUTTON_CLASS}>Cancel</Button>
```

## Status Color Usage

- Color emphasis is allowed for **state signaling only**:
  - ETA urgency
  - status badges (ordered, delayed, completed)
  - alert/warning states
- Keep base surfaces and common controls neutral/theme-driven.

## Icon Usage

- Use icons to improve scanability for key data points:
  - status
  - ETA
  - quantity
  - primary actions
- Keep icon size compact and consistent in dense operational panels.

## Current Reference Implementation

- `frontend/src/pages/ReceiveItems.tsx`
