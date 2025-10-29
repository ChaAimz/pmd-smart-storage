import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { MapPin, Plus, Edit, Grid3x3, Eye, Package, Warehouse } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/layout/PageHeader'
import { TableLoadingSkeleton } from '@/components/ui/loading-state'
import * as api from '@/services/api'

interface Location {
  id: number
  code: string
  zone: string
  capacity: number
  status: string
}

const zones = ['A', 'B', 'C', 'All']

export function ManageLocations() {
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedZone, setSelectedZone] = useState<string>('All')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchLocations()
  }, [])

  async function fetchLocations() {
    try {
      setIsLoading(true)
      const data = await api.getAllLocations()
      setLocations(data)
    } catch (error) {
      console.error('Error fetching locations:', error)
      toast({
        title: 'Error',
        description: 'Failed to load locations',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const filteredLocations = locations.filter(
    (loc) => selectedZone === 'All' || loc.zone === selectedZone
  )

  const getStatusColor = (status: Location['status']) => {
    switch (status) {
      case 'available':
        return 'bg-success/20 border-success text-success'
      case 'occupied':
        return 'bg-warning/20 border-warning text-warning'
      case 'full':
        return 'bg-destructive/20 border-destructive text-destructive'
      case 'maintenance':
        return 'bg-muted border-muted-foreground text-muted-foreground'
    }
  }

  const getStatusBadge = (status: Location['status']) => {
    switch (status) {
      case 'available':
        return <Badge variant="success">Available</Badge>
      case 'occupied':
        return <Badge variant="warning">Occupied</Badge>
      case 'full':
        return <Badge variant="destructive">Full</Badge>
      case 'maintenance':
        return <Badge variant="outline">Maintenance</Badge>
    }
  }

  const getOccupancyPercentage = (location: Location) => {
    return Math.round((location.occupied / location.capacity) * 100)
  }

  const viewLocationDetails = (location: Location) => {
    setSelectedLocation(location)
    setShowDetailsDialog(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Locations</h1>
          <p className="text-muted-foreground">
            View and manage warehouse storage locations
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Location
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Location</DialogTitle>
              <DialogDescription>
                Add a new storage location to the warehouse
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-zone">Zone</Label>
                  <select
                    id="new-zone"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {zones.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-aisle">Aisle</Label>
                  <Input id="new-aisle" type="number" placeholder="1" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-shelf">Shelf</Label>
                  <Input id="new-shelf" type="number" placeholder="1" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-capacity">Capacity</Label>
                <Input id="new-capacity" type="number" placeholder="100" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                setShowCreateDialog(false)
                toast({
                  title: 'Location Created',
                  description: 'New storage location has been added',
                  variant: 'success',
                })
              }}>
                Create Location
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={selectedZone === 'All' ? 'default' : 'outline'}
                onClick={() => setSelectedZone('All')}
              >
                All Zones
              </Button>
              {zones.map((zone) => (
                <Button
                  key={zone}
                  variant={selectedZone === zone ? 'default' : 'outline'}
                  onClick={() => setSelectedZone(zone)}
                >
                  Zone {zone}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <Package className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          {
            title: 'Total Locations',
            value: filteredLocations.length,
            color: 'text-primary',
          },
          {
            title: 'Available',
            value: filteredLocations.filter((l) => l.status === 'available').length,
            color: 'text-success',
          },
          {
            title: 'Occupied',
            value: filteredLocations.filter((l) => l.status === 'occupied').length,
            color: 'text-warning',
          },
          {
            title: 'Full',
            value: filteredLocations.filter((l) => l.status === 'full').length,
            color: 'text-destructive',
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Warehouse Grid/List View */}
      {viewMode === 'grid' ? (
        <Card>
          <CardHeader>
            <CardTitle>Warehouse Map</CardTitle>
            <CardDescription>
              Interactive warehouse layout visualization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
              {filteredLocations.slice(0, 48).map((location, index) => (
                <motion.div
                  key={location.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.01 }}
                  whileHover={{ scale: 1.1, zIndex: 10 }}
                  className="relative"
                >
                  <button
                    className={`relative h-20 w-full rounded-lg border-2 p-2 text-xs transition-all ${getStatusColor(
                      location.status
                    )}`}
                    onClick={() => viewLocationDetails(location)}
                  >
                    <div className="flex h-full flex-col items-center justify-center">
                      <MapPin className="h-4 w-4 mb-1" />
                      <p className="font-bold">{location.code}</p>
                      <p className="text-[10px]">{getOccupancyPercentage(location)}%</p>
                    </div>
                    {location.items > 0 && (
                      <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {location.items}
                      </div>
                    )}
                  </button>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Locations List</CardTitle>
            <CardDescription>
              {filteredLocations.length} location{filteredLocations.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredLocations.slice(0, 20).map((location, index) => (
                <motion.div
                  key={location.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <Card className="transition-all hover:border-primary">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                          <MapPin className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{location.code}</p>
                          <p className="text-sm text-muted-foreground">
                            Zone {location.zone} • Aisle {location.aisle}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold">
                            {location.occupied}/{location.capacity}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {getOccupancyPercentage(location)}% full
                          </p>
                        </div>
                        {getStatusBadge(location.status)}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => viewLocationDetails(location)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Location Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Location Details</DialogTitle>
            <DialogDescription>
              View and manage location information
            </DialogDescription>
          </DialogHeader>
          {selectedLocation && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-4">
                <div className="grid gap-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Location Code</span>
                    <span className="font-semibold">{selectedLocation.code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Zone</span>
                    <Badge variant="outline">Zone {selectedLocation.zone}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Aisle</span>
                    <span className="font-medium">{selectedLocation.aisle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Shelf</span>
                    <span className="font-medium">{selectedLocation.shelf}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-3">
                    <span className="text-sm text-muted-foreground">Capacity</span>
                    <span className="font-semibold">{selectedLocation.capacity} units</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Occupied</span>
                    <span className="font-semibold">{selectedLocation.occupied} units</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Occupancy</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary transition-all"
                          style={{
                            width: `${getOccupancyPercentage(selectedLocation)}%`,
                          }}
                        />
                      </div>
                      <span className="font-semibold">
                        {getOccupancyPercentage(selectedLocation)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Items</span>
                    <span className="font-medium">{selectedLocation.items}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    {getStatusBadge(selectedLocation.status)}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Close
            </Button>
            <Button className="gap-2">
              <Edit className="h-4 w-4" />
              Edit Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}