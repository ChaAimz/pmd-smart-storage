import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Plus, Edit, Trash2, Download, Filter, MoreVertical } from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import * as api from '@/services/api'

// Using api.Item type from services/api.ts

const categories = ['All', 'Electronics', 'Clothing', 'Food', 'Tools', 'Hardware', 'Office Supplies', 'Other']

export function ManageItems() {
  const [items, setItems] = useState<api.Item[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedItem, setSelectedItem] = useState<api.Item | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'updated'>('name')
  const { toast } = useToast()

  useEffect(() => {
    async function fetchItems() {
      try {
        setIsLoading(true)
        const data = await api.getAllItems()
        setItems(data)
      } catch (error) {
        console.error('Error fetching items:', error)
        toast({
          title: 'Error',
          description: 'Failed to load items',
          variant: 'destructive'
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchItems()
  }, [])

  const filteredItems = items
    .filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory =
        selectedCategory === 'All' || item.category === selectedCategory
      return matchesSearch && matchesCategory
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'quantity') return b.quantity - a.quantity
      return 0 // For 'updated', would need actual dates
    })

  const getStatusBadge = (item: api.Item) => {
    if (item.quantity === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>
    } else if (item.quantity <= item.reorder_point) {
      return <Badge variant="default">Low Stock</Badge>
    } else {
      return <Badge className="bg-green-500 hover:bg-green-600">In Stock</Badge>
    }
  }

  const handleEdit = (item: api.Item) => {
    setSelectedItem(item)
    setShowEditDialog(true)
  }

  const handleDelete = (item: api.Item) => {
    setSelectedItem(item)
    setShowDeleteDialog(true)
  }

  const confirmDelete = () => {
    toast({
      title: 'Item Deleted',
      description: `${selectedItem?.name} has been removed from inventory`,
      variant: 'success',
    })
    setShowDeleteDialog(false)
    setSelectedItem(null)
  }

  const handleExport = () => {
    toast({
      title: 'Export Started',
      description: 'Your data is being exported...',
      variant: 'success',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Items</h1>
          <p className="text-muted-foreground">
            View and manage your inventory items
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Item</DialogTitle>
              <DialogDescription>
                Add a new item to your inventory
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-sku">SKU *</Label>
                    <Input id="new-sku" placeholder="SKU-XXXX" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-category">Category *</Label>
                    <select
                      id="new-category"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Select category...</option>
                      {categories.filter(c => c !== 'All').map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-name">Product Name *</Label>
                  <Input id="new-name" placeholder="Enter product name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-barcode">Barcode (Optional)</Label>
                  <Input id="new-barcode" placeholder="Scan or enter barcode" />
                </div>
              </div>

              {/* Inventory Planning */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-sm text-muted-foreground">Inventory Planning</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-reorder-point">Reorder Point *</Label>
                    <Input id="new-reorder-point" type="number" placeholder="0" />
                    <p className="text-xs text-muted-foreground">Trigger reorder when stock reaches this level</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-reorder-qty">Reorder Quantity *</Label>
                    <Input id="new-reorder-qty" type="number" placeholder="0" />
                    <p className="text-xs text-muted-foreground">How many units to order</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-safety-stock">Safety Stock</Label>
                    <Input id="new-safety-stock" type="number" placeholder="0" />
                    <p className="text-xs text-muted-foreground">Buffer inventory to prevent stockouts</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-lead-time">Lead Time (Days)</Label>
                    <Input id="new-lead-time" type="number" placeholder="7" />
                    <p className="text-xs text-muted-foreground">Days to receive after ordering</p>
                  </div>
                </div>
              </div>

              {/* Supplier Information */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-sm text-muted-foreground">Supplier Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-supplier">Supplier Name</Label>
                    <Input id="new-supplier" placeholder="Enter supplier name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-unit-cost">Unit Cost (฿)</Label>
                    <Input id="new-unit-cost" type="number" step="0.01" placeholder="0.00" />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                setShowCreateDialog(false)
                toast({
                  title: 'Item Created',
                  description: 'New item has been added to inventory',
                  variant: 'success',
                })
              }}>
                Create Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search items by SKU or name..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    {selectedCategory}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {categories.map((cat) => (
                    <DropdownMenuItem
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" className="gap-2" onClick={handleExport}>
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Items</CardTitle>
              <CardDescription>
                {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} found
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={sortBy === 'name' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('name')}
              >
                Name
              </Button>
              <Button
                variant={sortBy === 'quantity' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('quantity')}
              >
                Quantity
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-sm text-muted-foreground">
                  <th className="pb-3 font-medium">SKU</th>
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium">Quantity</th>
                  <th className="pb-3 font-medium">Reorder Point</th>
                  <th className="pb-3 font-medium">Lead Time</th>
                  <th className="pb-3 font-medium">Supplier</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-border transition-colors hover:bg-muted/50"
                  >
                    <td className="py-4">
                      <code className="rounded bg-muted px-2 py-1 text-xs">
                        {item.sku}
                      </code>
                    </td>
                    <td className="py-4 font-medium">{item.name}</td>
                    <td className="py-4">
                      <Badge variant="outline">{item.category}</Badge>
                    </td>
                    <td className="py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold">{item.quantity}</span>
                        <span className="text-xs text-muted-foreground">
                          Safety: {item.safety_stock}
                        </span>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold">{item.reorder_point}</span>
                        <span className="text-xs text-muted-foreground">
                          Qty: {item.reorder_quantity}
                        </span>
                      </div>
                    </td>
                    <td className="py-4">
                      <span className="text-sm">{item.lead_time_days} days</span>
                    </td>
                    <td className="py-4">
                      <span className="text-sm">{item.supplier_name}</span>
                    </td>
                    <td className="py-4">{getStatusBadge(item)}</td>
                    <td className="py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(item)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(item)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Item Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
            <DialogDescription>
              Update item information
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-sku">SKU *</Label>
                  <Input id="edit-sku" defaultValue={selectedItem.sku} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Category *</Label>
                  <select
                    id="edit-category"
                    defaultValue={selectedItem.category}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {categories.filter(c => c !== 'All').map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Product Name *</Label>
                <Input id="edit-name" defaultValue={selectedItem.name} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-min">Minimum Quantity</Label>
                  <Input id="edit-min" type="number" defaultValue={selectedItem.minQuantity} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-current">Current Quantity</Label>
                  <Input id="edit-current" type="number" defaultValue={selectedItem.quantity} disabled />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setShowEditDialog(false)
              toast({
                title: 'Item Updated',
                description: `${selectedItem?.name} has been updated successfully`,
                variant: 'success',
              })
            }}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
              <p className="font-semibold">{selectedItem.name}</p>
              <p className="text-sm text-muted-foreground">{selectedItem.sku}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}