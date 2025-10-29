# Smart Storage Frontend

A comprehensive, minimalist UI/UX system for smart warehouse inventory management built with React, TypeScript, and shadcn/ui.

## 🎨 Design Philosophy

The Smart Storage Frontend prioritizes:
- **Minimalist Aesthetics**: Clean, uncluttered interface with purposeful design
- **Exceptional Usability**: Rapid inventory operations with minimal friction
- **Dark Theme**: Modern dark color palette optimized for extended use
- **Fluid Interactions**: Smooth animations and micro-interactions throughout
- **Accessibility**: WCAG compliant with keyboard navigation and ARIA support

## 🚀 Features

### Dashboard Module
- **Real-time Warehouse Status**: Live inventory count, low-stock alerts, and movement tracking
- **Data Visualizations**: 
  - Area charts for inventory movement trends
  - Pie charts for stock distribution by category
  - Animated progress indicators
- **Notification Center**: Color-coded priority alerts for critical events
- **Quick Actions**: One-click access to primary operations with visual feedback

### Receive Items Module
- Intuitive item reception interface
- Intelligent autocomplete search with advanced filtering
- Multi-step form with progressive disclosure
- Interactive warehouse map with AI-powered location recommendations
- Real-time validation and visual confirmation

### Pick Items Module
- Streamlined picking workflow with batch operations
- Predictive search with recent items
- Interactive warehouse map with pulsing location indicators
- LED activation visualization
- Haptic-style animations for feedback

### Adjust Stock Balance Module
- Focused stock adjustment interface
- Recent adjustment history
- Information-dense item detail cards
- Smart adjustment form with before/after comparison
- Inline validation and undo capabilities

### Manage Items Module
- Sophisticated data table with advanced sorting/filtering
- Bulk operations support
- Image upload and barcode scanning integration
- Real-time duplicate detection
- Export functionality with customization

### Manage Locations Module
- Interactive warehouse visualization with zoom/pan
- Grid and graphical view modes
- Drag-and-drop layout reorganization
- Endpoint status indicators with occupancy percentages
- Bulk status updates

## 🛠️ Tech Stack

- **Framework**: React 18 + TypeScript + Vite
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS with custom design tokens
- **Routing**: React Router v6
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Icons**: Lucide React
- **State Management**: React Hooks
- **Build Tool**: Vite

## 📦 Installation

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🎯 Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx           # Global header with search & notifications
│   │   │   ├── Sidebar.tsx          # Navigation sidebar with active indicators
│   │   │   └── Layout.tsx           # Main layout wrapper
│   │   └── ui/                      # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── badge.tsx
│   │       ├── toast.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── label.tsx
│   │       └── skeleton.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx            # Main dashboard with visualizations
│   │   ├── ReceiveItems.tsx         # (To be implemented)
│   │   ├── PickItems.tsx            # (To be implemented)
│   │   ├── AdjustStock.tsx          # (To be implemented)
│   │   ├── ManageItems.tsx          # (To be implemented)
│   │   └── ManageLocations.tsx      # (To be implemented)
│   ├── hooks/
│   │   └── use-toast.ts             # Toast notification hook
│   ├── lib/
│   │   └── utils.ts                 # Utility functions (cn)
│   ├── App.tsx                      # Main app with routing
│   ├── main.tsx                     # Entry point
│   └── index.css                    # Global styles & design tokens
├── public/                          # Static assets
├── tailwind.config.js               # Tailwind configuration
├── tsconfig.json                    # TypeScript configuration
├── vite.config.ts                   # Vite configuration
└── package.json                     # Dependencies
```

## 🎨 Design System

### Color Palette (Dark Theme)
```css
--background: 222.2 84% 4.9%        /* Deep dark blue-gray */
--foreground: 210 40% 98%           /* Light text */
--primary: 217.2 91.2% 59.8%        /* Blue accent */
--success: 142.1 76.2% 36.3%        /* Green */
--warning: 38 92% 50%               /* Amber */
--destructive: 0 62.8% 30.6%        /* Red */
```

### Typography
- **Font Family**: System font stack with fallbacks
- **Sizes**: Consistent scale (xs, sm, base, lg, xl, 2xl, 3xl)
- **Weights**: Medium (500), Semibold (600), Bold (700)

### Spacing
- **Scale**: 0.25rem increments (1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24)
- **Container**: Centered with 2rem padding, max-width 1400px

### Animations
- **Transitions**: 200-300ms with easing curves
- **Micro-interactions**: Scale, fade, slide effects
- **Loading States**: Pulse and skeleton loaders
- **Page Transitions**: Smooth fade-in animations

## 🔧 Configuration

### Path Aliases
TypeScript and Vite are configured with `@/*` alias:
```typescript
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
```

### Custom CSS Utilities
```css
.glass                  /* Glassmorphism effect */
.gradient-primary       /* Gradient backgrounds */
.card-hover            /* Card hover effects */
.focus-visible-ring    /* Accessible focus states */
.skeleton              /* Loading placeholders */
.badge-success         /* Status badges */
.text-gradient         /* Gradient text */
.shadow-glow           /* Glowing shadows */
```

## 🎯 Key Components

### Button
Multiple variants with animations:
```tsx
<Button variant="default">Primary</Button>
<Button variant="success">Success</Button>
<Button variant="warning">Warning</Button>
<Button variant="destructive">Delete</Button>
<Button variant="ghost">Ghost</Button>
```

### Card
Flexible container with hover effects:
```tsx
<Card className="card-hover">
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>{/* Content */}</CardContent>
</Card>
```

### Toast Notifications
Declarative toast system:
```tsx
import { useToast } from '@/hooks/use-toast'

const { toast } = useToast()
toast({
  title: "Success",
  description: "Item added successfully",
  variant: "success"
})
```

## ♿ Accessibility Features

- **ARIA Labels**: All interactive elements properly labeled
- **Keyboard Navigation**: Full keyboard support with visible focus indicators
- **Screen Reader Support**: Semantic HTML and ARIA attributes
- **High Contrast**: Optimized color contrast ratios
- **Focus Management**: Logical tab order and focus trapping in modals

## 📱 Responsive Design

- **Mobile First**: Base styles optimized for mobile
- **Breakpoints**: 
  - sm: 640px
  - md: 768px
  - lg: 1024px
  - xl: 1280px
  - 2xl: 1400px
- **Touch Gestures**: Optimized for touch interactions
- **Adaptive Layouts**: Fluid grid system

## 🔮 Future Enhancements

### Planned Features
- [ ] Complete Receive Items module
- [ ] Complete Pick Items module
- [ ] Complete Adjust Stock module
- [ ] Complete Manage Items module with data table
- [ ] Complete Manage Locations with warehouse visualization
- [ ] Real-time updates via WebSocket
- [ ] Advanced search with filters
- [ ] Barcode scanning integration
- [ ] Export/Import functionality
- [ ] Multi-language support
- [ ] Dark/Light theme toggle
- [ ] User preferences persistence
- [ ] Advanced analytics dashboard

### Technical Improvements
- [ ] Add comprehensive test coverage (Jest + React Testing Library)
- [ ] Implement error boundaries
- [ ] Add service worker for offline support
- [ ] Optimize bundle size with code splitting
- [ ] Add performance monitoring
- [ ] Implement skeleton screens for all loading states
- [ ] Add animation prefers-reduced-motion support

## 🤝 Contributing

1. Follow the established component patterns
2. Maintain TypeScript strict mode compliance
3. Use the existing design tokens and utilities
4. Ensure accessibility compliance
5. Add proper ARIA labels and keyboard navigation
6. Test on multiple screen sizes
7. Document new components

## 📄 License

This project is part of the Smart Storage Device system.

## 🙏 Acknowledgments

- **shadcn/ui**: For the excellent component library
- **Radix UI**: For accessible primitives
- **Tailwind CSS**: For utility-first styling
- **Framer Motion**: For smooth animations
- **Recharts**: For data visualization
