import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Power } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import * as api from '@/services/api'

type CategoryFormState = {
  name: string
  color: string
}

const DEFAULT_COLOR = '#64748B'
const CATEGORY_COLOR_POOL = [
  '#2563EB', '#DB2777', '#D97706', '#7C3AED', '#475569', '#0891B2',
  '#16A34A', '#EA580C', '#0EA5E9', '#9333EA', '#DC2626', '#059669',
  '#4F46E5', '#E11D48', '#0F766E', '#7C2D12', '#1D4ED8', '#BE185D'
]

const getReadableTextColor = (hexColor: string) => {
  const hex = (hexColor || '').replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#FFFFFF'

  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#111827' : '#FFFFFF'
}

const normalizeColor = (color: string) => String(color || '').trim().toUpperCase()

const randomHexColor = () => {
  const channel = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  return `#${channel()}${channel()}${channel()}`.toUpperCase()
}

const getNextCategoryColor = (existingColors: string[]) => {
  const used = new Set(existingColors.map(normalizeColor))

  const availablePreset = CATEGORY_COLOR_POOL.find((color) => !used.has(normalizeColor(color)))
  if (availablePreset) return availablePreset

  for (let i = 0; i < 24; i += 1) {
    const generated = randomHexColor()
    if (!used.has(normalizeColor(generated))) return generated
  }

  return randomHexColor()
}

export function Settings() {
  const [categories, setCategories] = useState<api.Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<api.Category | null>(null)
  const [replacementCategoryId, setReplacementCategoryId] = useState<number | null>(null)
  const [createForm, setCreateForm] = useState<CategoryFormState>({ name: '', color: DEFAULT_COLOR })
  const [editForm, setEditForm] = useState<CategoryFormState>({ name: '', color: DEFAULT_COLOR })

  const activeReplacementOptions = useMemo(
    () =>
      categories.filter((category) => category.is_active && category.id !== selectedCategory?.id),
    [categories, selectedCategory]
  )

  const pickUniqueCategoryColor = () =>
    getNextCategoryColor(categories.map((category) => category.color || DEFAULT_COLOR))

  const loadCategories = async () => {
    try {
      setLoading(true)
      const data = await api.getCategories(true)
      setCategories(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const handleCreateCategory = async () => {
    try {
      if (!createForm.name.trim()) {
        toast.error('Category name is required')
        return
      }
      await api.createCategory({
        name: createForm.name.trim(),
        color: createForm.color || DEFAULT_COLOR,
        is_active: true,
      })
      toast.success('Category created')
      setCreateForm({ name: '', color: pickUniqueCategoryColor() })
      setShowCreateDialog(false)
      await loadCategories()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create category')
    }
  }

  const handleOpenEdit = (category: api.Category) => {
    setSelectedCategory(category)
    setEditForm({ name: category.name, color: category.color || DEFAULT_COLOR })
    setShowEditDialog(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedCategory) return
    try {
      await api.updateCategory(selectedCategory.id, {
        name: editForm.name.trim(),
        color: editForm.color || DEFAULT_COLOR,
      })
      toast.success('Category updated')
      setShowEditDialog(false)
      setSelectedCategory(null)
      await loadCategories()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update category')
    }
  }

  const handleToggleActive = async (category: api.Category) => {
    try {
      await api.updateCategory(category.id, { is_active: !category.is_active })
      toast.success(category.is_active ? 'Category deactivated' : 'Category activated')
      await loadCategories()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update category status')
    }
  }

  const handleOpenDelete = (category: api.Category) => {
    setSelectedCategory(category)
    setReplacementCategoryId(null)
    setShowDeleteDialog(true)
  }

  const handleOpenCreate = () => {
    setCreateForm({ name: '', color: pickUniqueCategoryColor() })
    setShowCreateDialog(true)
  }

  const handleDeleteCategory = async () => {
    if (!selectedCategory) return

    if (selectedCategory.item_count > 0 && !replacementCategoryId) {
      toast.error('Select replacement category before deleting')
      return
    }

    try {
      await api.deleteCategory(selectedCategory.id, replacementCategoryId || undefined)
      toast.success(
        selectedCategory.item_count > 0
          ? 'Category replaced and deleted'
          : 'Category deleted'
      )
      setShowDeleteDialog(false)
      setSelectedCategory(null)
      setReplacementCategoryId(null)
      await loadCategories()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete category')
    }
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto lg:overflow-hidden">
      <div className="h-full min-h-0 flex flex-col gap-4 px-2.5 pt-2.5 pb-1.5 lg:px-3.5 lg:pt-3.5 lg:pb-2.5">
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/70 bg-background/90 dark:border-border/60 dark:bg-background/70">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="shrink-0">Settings</CardTitle>
              <div className="flex items-center gap-2">
                <Badge className="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground hover:bg-primary">
                  Category
                </Badge>
                <Button className="gap-2" onClick={handleOpenCreate}>
                  <Plus className="h-4 w-4" />
                  Add Category
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-0">
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border/70 bg-background">
              {loading ? (
                <div className="p-6 text-sm text-muted-foreground">Loading categories...</div>
              ) : (
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-10 bg-muted/50 text-left text-sm text-muted-foreground backdrop-blur-xl">
                    <tr className="border-b border-border">
                      <th className="h-12 px-4 align-middle font-medium">Category</th>
                      <th className="h-12 px-4 align-middle font-medium">Color</th>
                      <th className="h-12 px-4 align-middle font-medium">Status</th>
                      <th className="h-12 px-4 align-middle font-medium">Usage</th>
                      <th className="h-12 px-4 align-middle font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((category) => (
                      <tr key={category.id} className="border-b border-border transition-colors hover:bg-muted/50 last:border-0">
                        <td className="px-4 py-3">
                          {(() => {
                            const chipColor = category.color || DEFAULT_COLOR
                            return (
                          <Badge
                            variant="outline"
                            className="border-0"
                            style={{
                              backgroundColor: chipColor,
                              color: getReadableTextColor(chipColor),
                            }}
                          >
                            {category.name}
                          </Badge>
                            )
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-4 w-4 rounded-full border border-border"
                              style={{ backgroundColor: category.color }}
                            />
                            <span className="text-sm text-muted-foreground">{category.color}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={category.is_active ? 'default' : 'secondary'}>
                            {category.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground hover:bg-primary">
                            {category.item_count}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <div className="inline-flex items-center overflow-hidden rounded-md border border-input bg-background">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-none border-0"
                              title="Edit category"
                              aria-label={`Edit ${category.name}`}
                              onClick={() => handleOpenEdit(category)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <span className="h-5 w-px bg-border" />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-none border-0"
                              title={category.is_active ? 'Deactivate category' : 'Activate category'}
                              aria-label={`${category.is_active ? 'Deactivate' : 'Activate'} ${category.name}`}
                              onClick={() => handleToggleActive(category)}
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                            <span className="h-5 w-px bg-border" />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-none border-0 text-destructive hover:text-destructive"
                              title="Delete category"
                              aria-label={`Delete ${category.name}`}
                              onClick={() => handleOpenDelete(category)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Category</DialogTitle>
            <DialogDescription>Add a new category for item master data.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-category-name">Category Name</Label>
              <Input
                id="new-category-name"
                placeholder="Enter category name"
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-category-color">Color</Label>
              <Input
                id="new-category-color"
                type="color"
                value={createForm.color}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, color: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateCategory}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>Update category name and color.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-category-name">Category Name</Label>
              <Input
                id="edit-category-name"
                value={editForm.name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category-color">Color</Label>
              <Input
                id="edit-category-color"
                type="color"
                value={editForm.color}
                onChange={(event) => setEditForm((prev) => ({ ...prev, color: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              {selectedCategory?.item_count
                ? 'This category is used by items. Choose replacement category before deleting.'
                : 'Delete this category permanently?'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {selectedCategory?.item_count ? (
              <div className="space-y-2">
                <Label htmlFor="replacement-category">Replacement Category</Label>
                <select
                  id="replacement-category"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={replacementCategoryId ?? ''}
                  onChange={(event) => {
                    const nextValue = event.target.value ? Number(event.target.value) : null
                    setReplacementCategoryId(Number.isNaN(nextValue) ? null : nextValue)
                  }}
                >
                  <option value="">Select replacement category</option>
                  {activeReplacementOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} ({category.item_count})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={Boolean(selectedCategory?.item_count && !replacementCategoryId)}
              onClick={handleDeleteCategory}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Settings
