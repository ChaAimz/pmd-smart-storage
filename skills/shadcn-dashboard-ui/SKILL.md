---
name: shadcn-dashboard-ui
description: Design and implement dashboard-style UI using local shadcn/ui components as first-class primitives.
---

# Shadcn Dashboard UI Skill

Use this skill for any frontend page creation or redesign in this repository.

## Objective

Deliver UI in a consistent operational dashboard style aligned with the `/receive` page redesign:
- fast to scan
- card-first layout
- structured action and data zones
- production-ready shadcn component usage

## Mandatory Rules

1. Use local shadcn components from `frontend/src/components/ui/*` whenever equivalent exists.
2. Do not build custom raw HTML primitives if shadcn alternatives already exist.
3. Keep dashboard information hierarchy explicit:
   - summary KPIs
   - main operation panels
   - historical/log or queue table/list area
4. Maintain responsive behavior for desktop and mobile.
5. Preserve existing domain flows and API behavior while redesigning visuals.

## Default Component Set

Prefer these components first:
- `Card`, `CardHeader`, `CardContent`, `CardTitle`, `CardDescription`
- `Badge`
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
- `Dialog`
- `Button`
- `Input`, `Select`, `Textarea`, `Label`

## Visual Direction

- Subtle layered backgrounds (gradient or soft overlays)
- Clean spacing and compact dashboard density
- Color-coded status badges with clear semantics
- Avoid generic/plain layouts when a stronger dashboard structure is appropriate

## Implementation Checklist

- Confirm page goals and key user actions
- Build KPI row if metrics are available
- Organize primary actions in top or side action panel
- Render transactional/history data in `Table` when possible
- Verify empty/loading states
- Verify keyboard and focus behavior for interactive components
- Run project build/lint checks relevant to changed files
