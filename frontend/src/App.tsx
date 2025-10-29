import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Toaster } from './components/ui/toaster'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { ReceiveItems } from './pages/ReceiveItems'
import { PickItems } from './pages/PickItems'
import { AdjustStock } from './pages/AdjustStock'
import { ManageItems } from './pages/ManageItems'
import { ManageLocations } from './pages/ManageLocations'
import InventoryPlanning from './pages/InventoryPlanning'
import Profile from './pages/Profile'
import Login from './pages/Login'

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
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
            <Route path="settings" element={<div className="p-6">Settings - Coming Soon</div>} />
          </Route>
        </Routes>
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
