import { Suspense, lazy, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Toaster } from './components/ui/sonner'

const Layout = lazy(async () => {
  const module = await import('./components/layout/Layout')
  return { default: module.Layout }
})

const Dashboard = lazy(async () => {
  const module = await import('./pages/Dashboard')
  return { default: module.Dashboard }
})

const ReceiveItems = lazy(async () => {
  const module = await import('./pages/ReceiveItems')
  return { default: module.ReceiveItems }
})

const PickItems = lazy(async () => {
  const module = await import('./pages/PickItems')
  return { default: module.PickItems }
})

const AdjustStock = lazy(async () => {
  const module = await import('./pages/AdjustStock')
  return { default: module.AdjustStock }
})

const ManageItems = lazy(async () => {
  const module = await import('./pages/ManageItems')
  return { default: module.ManageItems }
})

const ManageLocations = lazy(async () => {
  const module = await import('./pages/ManageLocations')
  return { default: module.ManageLocations }
})

const InventoryPlanning = lazy(() => import('./pages/InventoryPlanning'))
const Profile = lazy(() => import('./pages/Profile'))
const Login = lazy(() => import('./pages/Login'))
const Settings = lazy(() => import('./pages/Settings'))

const PRList = lazy(async () => {
  const module = await import('./pages/PRList')
  return { default: module.PRList }
})

const CreatePR = lazy(async () => {
  const module = await import('./pages/CreatePR')
  return { default: module.CreatePR }
})

const PRReceive = lazy(async () => {
  const module = await import('./pages/PRReceive')
  return { default: module.PRReceive }
})

const PRDetail = lazy(async () => {
  const module = await import('./pages/PRDetail')
  return { default: module.PRDetail }
})

function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
    </div>
  )
}

// Protected Route Component
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />

            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="receive" element={<ReceiveItems />} />
              <Route path="pick" element={<PickItems />} />
              <Route path="adjust" element={<AdjustStock />} />
              <Route path="items" element={<ManageItems />} />
              <Route path="locations" element={<ManageLocations />} />
              <Route path="planning" element={<InventoryPlanning />} />
              <Route path="profile" element={<Profile />} />
              <Route path="analytics" element={<div className="p-6">Analytics - Coming Soon</div>} />
              <Route path="settings" element={<Settings />} />
              <Route path="prs" element={<PRList />} />
              <Route path="prs/create" element={<CreatePR />} />
              <Route path="prs/:id" element={<PRDetail />} />
              <Route path="prs/:id/receive" element={<PRReceive />} />
            </Route>
          </Routes>
        </Suspense>
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
