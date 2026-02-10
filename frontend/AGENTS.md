# Smart Storage Frontend - Agent Guide

This document provides essential information for AI coding agents working on the Smart Storage Frontend project.

## Project Overview

Smart Storage Frontend is a comprehensive warehouse inventory management UI built with React, TypeScript, and Tailwind CSS. It provides a modern, minimalist interface for managing warehouse operations including item receiving, picking, stock adjustments, and inventory planning.

**Key Domain Concepts:**
- **Items**: Products stored in the warehouse with SKU, category, quantity, and reorder points
- **Locations**: Physical storage locations identified by node address, zone, shelf, row, and column
- **Transactions**: Record of receive, pick, and adjust operations
- **Purchase Orders**: Orders placed with suppliers for restocking

## Technology Stack

| Category | Technology |
|----------|------------|
| Framework | React 19.1.1 |
| Language | TypeScript 5.9.3 |
| Build Tool | Vite 7.1.7 |
| Routing | React Router DOM 7.9.4 |
| Styling | Tailwind CSS 3.4.18 |
| UI Components | shadcn/ui (Radix UI primitives) |
| Animations | Framer Motion 12.23.24 |
| Charts | Recharts 3.3.0 |
| Icons | Lucide React 0.548.0 |
| State Management | React Context + Hooks |

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── layout/           # Layout components
│   │   │   ├── Header.tsx    # Top navigation bar
│   │   │   ├── Sidebar.tsx   # Left navigation sidebar
│   │   │   ├── RightSidebar.tsx  # Dashboard right panel
│   │   │   ├── Layout.tsx    # Main layout wrapper
│   │   │   └── PageHeader.tsx
│   │   └── ui/               # shadcn/ui components (20+ components)
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── toast.tsx
│   │       └── ...
│   ├── contexts/             # React contexts
│   │   ├── AuthContext.tsx   # Authentication state
│   │   └── PageContext.tsx   # Page title/description
│   ├── hooks/                # Custom React hooks
│   │   └── use-toast.ts      # Toast notification hook
│   ├── lib/
│   │   └── utils.ts          # Utility functions (cn helper)
│   ├── pages/                # Page components
│   │   ├── Dashboard.tsx     # Main dashboard with widgets
│   │   ├── ReceiveItems.tsx  # Item receiving interface
│   │   ├── PickItems.tsx     # Item picking interface
│   │   ├── AdjustStock.tsx   # Stock adjustment
│   │   ├── ManageItems.tsx   # Item CRUD operations
│   │   ├── ManageLocations.tsx  # Location management
│   │   ├── InventoryPlanning.tsx
│   │   ├── Profile.tsx
│   │   └── Login.tsx
│   ├── services/
│   │   └── api.ts            # API client functions
│   ├── styles/
│   │   └── grid-layout.css   # Dashboard grid styles
│   ├── App.tsx               # Main app with routing
│   ├── main.tsx              # Entry point
│   └── index.css             # Global styles & CSS variables
├── public/                   # Static assets
├── tailwind.config.js        # Tailwind configuration
├── vite.config.ts            # Vite configuration
├── tsconfig.app.json         # TypeScript app config
├── eslint.config.js          # ESLint configuration
└── package.json
```

## Build and Development Commands

```bash
# Install dependencies
npm install

# Start development server (Vite dev server)
npm run dev

# Build for production (runs TypeScript check + Vite build)
npm run build

# Preview production build
npm run preview

# Run ESLint
npm run lint
```

## Configuration Details

### Vite Configuration (vite.config.ts)
- Path alias: `@/` maps to `./src`
- React plugin enabled
- ES modules output

### TypeScript Configuration (tsconfig.app.json)
- Target: ES2022
- Strict mode enabled
- Path mapping: `@/*` → `./src/*`
- JSX: react-jsx transform

### Tailwind Configuration (tailwind.config.js)
- Dark mode: class-based
- Content paths: src/**/*.{ts,tsx}, Flowbite components
- Custom colors mapped to CSS variables
- Plugins: tailwindcss-animate, flowbite/plugin

## Code Style Guidelines

### Import Conventions
- Use path alias `@/` for all internal imports
- Group imports: React → External libraries → Internal components → Types/Utils

```typescript
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
```

### Component Patterns
- Use functional components with explicit return types
- Forward refs for UI components
- Use `cn()` utility for conditional class merging

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'success' | 'warning'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant }), className)}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
```

### Styling Conventions
- Use Tailwind CSS utility classes exclusively
- Custom CSS variables for theming (defined in index.css)
- Common utilities in index.css:
  - `.glass` - Glassmorphism effect
  - `.card-hover` - Card hover animation
  - `.focus-visible-ring` - Accessible focus states
  - `.badge-{success,warning,danger,info}` - Status badges

### UI Style Baseline (Required)
- Default design direction is shadcn/ui dashboard style (aligned with current `/receive` page).
- Use local shadcn primitives from `src/components/ui/*` as default building blocks.
- Standard page composition:
  - KPI summary row
  - Main operational cards/panels
  - Structured data section (`Table`/`Tabs`) for logs or queue management
- Preferred components: `Card`, `Badge`, `Tabs`, `Table`, `Dialog`, `Button`, `Input`, `Select`, `Textarea`.
- Maintain a consistent visual language:
  - Page frame spacing should follow Receive baseline:
    `px-2.5 pt-2.5 pb-1.5 lg:px-3.5 lg:pt-3.5 lg:pb-2.5`
  - Subtle gradient or layered background depth
  - Strong information hierarchy and scan-friendly spacing
  - Compact, operational dashboard density
- For UI tasks, apply `../skills/shadcn-dashboard-ui/SKILL.md`.
- Cross-reference style rules in `../docs/reference/UI_STYLE_GUIDE.md`.

### Shadcn-First Component Policy (Required)
- Prefer shadcn base components before custom markup for common UI patterns.
- Required defaults:
  - `Dialog`: `src/components/ui/dialog.tsx` (shadcn base)
  - `Calendar`: `src/components/ui/calendar.tsx` with `mode="range"` for range filters
  - `Toggle Group` / `Button Group`: use shadcn groups with contiguous controls (no visual gaps)
  - `Breadcrumb`: `src/components/ui/breadcrumb.tsx` for top navigation path
  - `Checkbox`: `src/components/ui/checkbox.tsx`
- All new dialogs, table filters, and date-range pickers must follow the shadcn docs pattern first, then apply project-specific styling.

### Typography Policy (Required)
- Use shared typography primitives from `src/components/ui/typography.tsx` (`H1`, `H2`, `H3`, `Lead`, `Muted`, `Small`) for page headers and section titles.
- Avoid ad-hoc heading classes like `text-3xl font-semibold` in new code when equivalent typography primitives exist.
- Keep text scale consistent across pages; only add class overrides for responsive sizing when necessary.

### Component Size Policy (Required)
- Prefer shadcn size props over custom height/padding classes for core controls.
- Default sizing:
  - `Button`: use `size="default"` or `size="sm"` as first choice.
  - `Input`: use base shadcn `Input` size; avoid per-page custom height unless required by a dense table toolbar.
  - `ToggleGroup/ToggleGroupItem`: use `size="sm"`/`variant="outline"` for compact filter bars.
- Avoid custom utility sizes like `h-7 px-2.5 text-xs` for shared actions unless there is a documented exception.

### Refresh-safe Export Structure (Required)
- Follow React Fast Refresh safe-export rules for every `.tsx` file.
- Component files should export components only.
- Move non-component exports (constants, `cva` variants, helper hooks, context objects/types) into dedicated companion files.
- Required patterns:
  - UI variants: `*-variants.ts` (example: `button-variants.ts`, `toggle-variants.ts`, `button-group-variants.ts`)
  - Reusable hooks: `use-*.ts` (example: `use-auth.ts`, `use-page-context.ts`, `use-notifications.ts`)
  - Context definitions/types: `*-context.ts` (provider component remains in `*.tsx`)
- Avoid exporting hooks/constants from component/provider files when that file also exports a React component.
- New code must keep `npm run lint` free of `react-refresh/only-export-components` warnings.
- Enforcement standard (mandatory):
  - Treat `react-refresh/only-export-components` warnings as release blockers for frontend changes.
  - Before merge, run `npm run lint` and verify warnings are `0`.
  - If a new component needs helper exports, create a companion file first (`*.ts`) and import back into the component file.

### Theme-Safe Styling Rules (Required)
- Keep button tone consistent per page via shadcn variants (`default`, `outline`, `secondary`) instead of per-button hardcoded colors.
- Keep button size consistent by pattern, not ad-hoc values:
  - compact list actions: `h-8 px-3 text-xs` (equivalent to shadcn `size="sm"` density)
  - dialog/footer actions: `h-9 px-4`
  - icon actions: use `size="icon"` baseline (`h-9 w-9`) and avoid per-page `h-8/w-8` overrides unless explicitly required
- Use `Quick Pick` (`/pick`) as the compact quick-action size reference for other pages.
- Prefer semantic Tailwind tokens over fixed palette classes for core surfaces and controls:
  - `bg-background`, `text-foreground`, `border-border`, `border-input`, `bg-muted`
- Do not use hardcoded palette classes for reusable controls unless there is a clear state meaning.
  - Avoid patterns like `bg-blue-*`, `bg-emerald-*`, `border-sky-*` on shared controls.
- If compact button classes are reused in multiple places, define local constants and reuse them for consistency.
- Use richer color only for status signaling (for example ETA/status badges), not for baseline layout or standard action controls.

### Manage Items Header Pattern (Required)
- Keep `Manage Items` controls in a single header row:
  - left: page title (`Manage Items`)
  - right: item-count chip, search input, category filter, create button
- Item-count chip style must be flat solid primary (`bg-primary text-primary-foreground`) with no border.
- Chip size standard (global, all badge/chip usages including status columns): `px-3 py-1 text-sm` with rounded-full.
- Global chip style baseline (all pages): flat style with no border (`border-0`).
- Category filter button (`All` / selected category) must remain standard `outline` style (not primary-filled).
- Do not show `found` text next to the item-count chip; show only the number.
- Search input and controls should stay aligned to match the Receive page spacing language.

### Pick/Adjust Log Time Filter (Required)
- `Pick Items` and `Adjust Stock` log tables must use the same time-filter pattern.
- Default visible range is last `30 days`.
- Provide preset button group: `30D`, `M`, `3M`, `6M`, `1Y`.
- Provide date range selector using shadcn-style `Calendar` (Radix popover + range calendar).
- Preset and custom range must both drive table filtering consistently.

### Table Style Baseline (Required)
- All data tables across pages must follow the `Manage Items` table style as the canonical baseline.
- This is mandatory for the entire app (existing pages + new pages). Do not introduce alternate table visual patterns.
- Required table wrapper pattern:
  - outer container: `rounded-lg border border-border/70 bg-background`
  - outer behavior: `overflow-hidden`
  - inner scroll container: `h-full overflow-auto` for sticky headers
- Required header style:
  - `sticky top-0 z-10`
  - `bg-muted/50`
  - `backdrop-blur-xl`
  - visible bottom border (`border-b border-border`)
- Required body row style:
  - `border-b border-border`
  - hover state `hover:bg-muted/50`
- Prefer shared `Table` primitives from `src/components/ui/table.tsx`; if raw `<table>` is required, mirror these classes exactly.

### Category/Tag Governance (Required)
- Keep `Category` as a controlled master list managed from `Settings > Category`.
- Category management must support:
  - create, rename, recolor, activate/deactivate
  - usage count per category
  - safe delete via replacement migration (cannot hard-delete while in use)
- Delete flow rule:
  - if usage count > 0, require selecting a replacement category and migrate all linked items first
  - only allow hard-delete after usage count becomes 0
- Prefer soft delete (`inactive`) as default for operational safety and auditability.
- Use `Tag` as optional, free-form or semi-controlled metadata for flexible filtering/search (non-critical classification).
- Reporting, stock policy, and procurement logic should rely on `Category` (controlled), not free-form tags.

### State Management
- Local state: `useState`, `useReducer`
- Global state: React Context
  - `AuthContext` - User authentication state
  - `PageContext` - Page metadata (title, description)
- Persistence: localStorage for user session, layout preferences

## API Integration

### Base Configuration
- API URL from environment: `import.meta.env.VITE_API_URL`
- Fallback: `http://localhost:3001/api`

### Key API Functions (src/services/api.ts)

| Function | Endpoint | Description |
|----------|----------|-------------|
| `login()` | POST /auth/login | User authentication |
| `getAllItems()` | GET /items | Fetch all inventory items |
| `getLowStockItems()` | GET /items/low-stock | Fetch low stock alerts |
| `createItem()` | POST /items | Create new item |
| `updateItem()` | PUT /items/:id | Update item |
| `deleteItem()` | DELETE /items/:id | Delete item |
| `getAllLocations()` | GET /locations | Fetch all locations |
| `createLocation()` | POST /locations | Create location |
| `getTransactions()` | GET /transactions | Fetch transaction history |
| `createTransaction()` | POST /transactions | Record transaction |
| `getPurchaseOrders()` | GET /purchase-orders | Fetch purchase orders |
| `createPurchaseOrder()` | POST /purchase-orders | Create purchase order |
| `getStatistics()` | GET /stats | Fetch dashboard statistics |

### Response Format
```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
```

## Routing Structure

| Route | Component | Access |
|-------|-----------|--------|
| `/login` | Login | Public |
| `/` | Dashboard | Protected |
| `/receive` | ReceiveItems | Protected |
| `/pick` | PickItems | Protected |
| `/adjust` | AdjustStock | Protected |
| `/items` | ManageItems | Protected |
| `/locations` | ManageLocations | Protected |
| `/planning` | InventoryPlanning | Protected |
| `/profile` | Profile | Protected |
| `/analytics` | Placeholder | Protected |
| `/settings` | Placeholder | Protected |

## Theme System

The application supports both light and dark themes using CSS variables.

### Color Variables (index.css)
```css
--background        /* Page background */
--foreground        /* Primary text */
--card             /* Card background */
--primary          /* Primary brand color */
--secondary        /* Secondary color */
--muted            /* Muted backgrounds */
--border           /* Border color */
--success          /* Success states */
--warning          /* Warning states */
--destructive      /* Error/danger states */
--info             /* Info states */
```

### Theme Classes
- Light theme: default (root)
- Dark theme: `.dark` class

## Toast Notifications

Use the toast hook for user feedback:

```typescript
import { useToast } from '@/hooks/use-toast'

const { toast } = useToast()

toast({
  title: 'Success',
  description: 'Item created successfully',
  variant: 'default' | 'success' | 'warning' | 'destructive'
})
```

## Testing Strategy

**Current Status**: No automated tests are configured.

**Recommended Additions**:
- Jest + React Testing Library for unit tests
- Vitest (aligns with Vite ecosystem)
- Playwright or Cypress for E2E tests

## Security Considerations

1. **Authentication**: JWT token stored in localStorage
2. **API Calls**: All authenticated routes should validate session
3. **XSS Prevention**: React's built-in escaping, sanitize user inputs
4. **Environment Variables**: Use `VITE_` prefix for client-side env vars

## Common Tasks

### Adding a New Page
1. Create component in `src/pages/`
2. Add route in `src/App.tsx`
3. Add navigation item in `src/components/layout/Sidebar.tsx`
4. Set page metadata using `usePageContext()` if needed

### Adding a New UI Component
1. Check shadcn/ui registry first
2. Place in `src/components/ui/`
3. Use Radix UI primitives for accessibility
4. Export from component file
5. Use forwardRef pattern

### Adding API Endpoints
1. Define TypeScript interfaces
2. Add function in `src/services/api.ts`
3. Follow error handling pattern with ApiResponse

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `VITE_API_URL` | Backend API base URL | `http://localhost:3001/api` |

## Known Limitations

1. No automated test suite
2. No error boundaries implemented
3. No service worker for offline support
4. Some placeholder pages (Analytics, Settings)
5. No bundle optimization with code splitting

## Dependencies to Note

- **Flowbite/Flowbite React**: Additional UI components (configured in Tailwind)
- **React Grid Layout**: Dashboard widget drag-and-drop
- **bcryptjs**: Client-side hashing (note: typically better on server)
- **class-variance-authority**: Component variant management
