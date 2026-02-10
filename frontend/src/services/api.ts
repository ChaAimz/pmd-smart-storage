function resolveApiBaseUrl(): string {
  const envApiUrl = (import.meta.env.VITE_API_URL || '').trim();

  if (!envApiUrl) {
    return '/api';
  }

  try {
    const url = new URL(envApiUrl, window.location.origin);
    const isLoopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const browserHost = window.location.hostname;
    const browserIsLoopback = browserHost === 'localhost' || browserHost === '127.0.0.1';

    // If frontend is opened from another machine, remap localhost API to that machine's host.
    if (isLoopback && !browserIsLoopback) {
      url.hostname = browserHost;
    }

    return url.toString().replace(/\/$/, '');
  } catch {
    return envApiUrl;
  }
}

export const API_BASE_URL = resolveApiBaseUrl();

type QueryParams = Record<string, string | number | boolean>;

// Generic API functions
export async function get<T = unknown>(url: string, params?: QueryParams): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('token');
  const queryString = params
    ? '?' + new URLSearchParams(
      Object.entries(params).reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = String(value);
        return acc;
      }, {})
    ).toString()
    : '';
  const response = await fetch(`${API_BASE_URL}${url}${queryString}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    }
  });
  return response.json();
}

export async function post<T = unknown, B = unknown>(url: string, data: B): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    },
    body: JSON.stringify(data)
  });
  return response.json();
}

export async function put<T = unknown, B = unknown>(url: string, data: B): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}${url}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    },
    body: JSON.stringify(data)
  });
  return response.json();
}

export async function del<T = unknown>(url: string): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}${url}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    }
  });
  return response.json();
}

export interface User {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

export interface Item {
  id: number;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  minQuantity?: number;
  reorder_point: number;
  reorder_quantity: number;
  safety_stock: number;
  lead_time_days: number;
  unit_cost: number;
  supplier_name: string;
  supplier_contact?: string;
  created_at: string;
  updated_at: string;
  // Fields from backend API response (optional)
  master_name?: string;
  master_sku?: string;
  local_name?: string;
  local_sku?: string;
  master_category?: string;
}

export interface LowStockItem extends Item {
  urgency: 'critical' | 'high' | 'medium';
}

export interface PurchaseOrder {
  id: number;
  supplier_name: string;
  total_cost: number;
  status: 'pending' | 'ordered' | 'received' | 'cancelled';
  created_by: number;
  created_by_name?: string;
  items_json: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: number;
  item_id: number;
  item_name?: string;
  sku?: string;
  transaction_type: 'receive' | 'pick' | 'adjust';
  quantity: number;
  user_id: number;
  user_name?: string;
  notes?: string;
  created_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  requires_replacement?: boolean;
  usage_count?: number;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  is_active: boolean;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: number;
  code: string;
  zone: string;
  aisle?: string;
  shelf?: string;
  capacity: number;
  occupied: number;
  status: string;
}

export interface Statistics {
  total_items?: number;
  low_stock_items?: number;
  total_transactions?: number;
  [key: string]: string | number | boolean | null | undefined;
}

// Authentication
export async function login(username: string, password: string): Promise<{ token: string; user: User }> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  const result: ApiResponse<{ token: string; user: User }> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Login failed');
  }

  return result.data;
}

// Items
export async function getAllItems(): Promise<Item[]> {
  const response = await fetch(`${API_BASE_URL}/items`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
    }
  });
  const result: ApiResponse<Item[]> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch items');
  }

  return result.data;
}

export async function getLowStockItems(): Promise<LowStockItem[]> {
  const response = await fetch(`${API_BASE_URL}/items/low-stock`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
    }
  });
  const result: ApiResponse<LowStockItem[]> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch low stock items');
  }

  return result.data;
}

// Purchase Orders
export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  const response = await fetch(`${API_BASE_URL}/purchase-orders`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
    }
  });
  const result: ApiResponse<PurchaseOrder[]> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch purchase orders');
  }

  return result.data;
}

export async function createPurchaseOrder(data: {
  items: Array<{ item_id: number; sku: string; name: string; quantity: number; unit_cost: number }>;
  supplier_name: string;
  created_by: number;
  total_cost?: number;
  status?: string;
}): Promise<{ id: number }> {
  const response = await fetch(`${API_BASE_URL}/purchase-orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result: ApiResponse<{ id: number }> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to create purchase order');
  }

  return result.data;
}

// Transactions
export async function getTransactions(limit = 100): Promise<Transaction[]> {
  const response = await fetch(`${API_BASE_URL}/transactions?limit=${limit}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
    }
  });
  const result: ApiResponse<Transaction[]> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch transactions');
  }

  return result.data;
}

// Locations
export async function getAllLocations(): Promise<Location[]> {
  const response = await fetch(`${API_BASE_URL}/locations`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
    }
  });
  const result: ApiResponse<Location[]> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch locations');
  }

  return result.data;
}

// Statistics
export async function getStatistics(): Promise<Statistics> {
  const response = await fetch(`${API_BASE_URL}/stats`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
    }
  });
  const result: ApiResponse<Statistics> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch statistics');
  }

  return result.data;
}

// Create Transaction
export async function createTransaction(data: {
  item_id: number;
  location_id?: number;
  transaction_type: 'receive' | 'pick' | 'adjust';
  quantity: number;
  reference_number?: string;
  notes?: string;
  user_id: number;
}): Promise<{ id: number }> {
  const response = await fetch(`${API_BASE_URL}/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result: ApiResponse<{ id: number }> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to create transaction');
  }

  return result.data;
}

// Create Item
export async function createItem(data: {
  sku: string;
  name: string;
  description?: string;
  category: string;
  unit?: string;
  min_quantity?: number;
  reorder_point?: number;
  reorder_quantity?: number;
  safety_stock?: number;
  lead_time_days?: number;
  unit_cost?: number;
  supplier_name?: string;
  supplier_contact?: string;
}): Promise<{ id: number }> {
  const response = await fetch(`${API_BASE_URL}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result: ApiResponse<{ id: number }> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to create item');
  }

  return result.data;
}

// Update Item
export async function updateItem(id: number, data: Partial<Item>): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/items/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result: ApiResponse<void> = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to update item');
  }
}

// Delete Item
export async function deleteItem(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/items/${id}`, {
    method: 'DELETE',
  });

  const result: ApiResponse<void> = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to delete item');
  }
}

// Create Location
export async function createLocation(data: {
  node_address: string;
  zone: string;
  shelf: string;
  row: number;
  column: number;
  description?: string;
  capacity?: number;
}): Promise<{ id: number }> {
  const response = await fetch(`${API_BASE_URL}/locations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result: ApiResponse<{ id: number }> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to create location');
  }

  return result.data;
}

// Update Location
export async function updateLocation(address: string, data: Partial<Location>): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/locations/${address}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result: ApiResponse<void> = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to update location');
  }
}

// Search Items
export async function searchItems(query: string): Promise<Item[]> {
  const response = await fetch(`${API_BASE_URL}/items/search?q=${encodeURIComponent(query)}`);
  const result: ApiResponse<Item[]> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to search items');
  }

  return result.data;
}

// Categories (Settings > Category master)
export async function getCategories(includeInactive = false): Promise<Category[]> {
  const response = await fetch(`${API_BASE_URL}/categories?include_inactive=${includeInactive ? 'true' : 'false'}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
    }
  });

  const result: ApiResponse<Category[]> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch categories');
  }
  return result.data;
}

export async function createCategory(data: { name: string; color: string; is_active?: boolean }): Promise<Category> {
  const response = await fetch(`${API_BASE_URL}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  const result: ApiResponse<Category> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to create category');
  }
  return result.data;
}

export async function updateCategory(
  id: number,
  data: Partial<Pick<Category, 'name' | 'color' | 'is_active'>>
): Promise<Category> {
  const response = await fetch(`${API_BASE_URL}/categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  const result: ApiResponse<Category> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to update category');
  }
  return result.data;
}

export async function deleteCategory(id: number, replacementCategoryId?: number): Promise<void> {
  const query = replacementCategoryId ? `?replacement_category_id=${replacementCategoryId}` : '';
  const response = await fetch(`${API_BASE_URL}/categories/${id}${query}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }
  });

  const result: ApiResponse<void> = await response.json();
  if (!result.success) {
    const err = new Error(result.error || 'Failed to delete category') as Error & {
      requiresReplacement?: boolean;
      usageCount?: number;
    };
    err.requiresReplacement = !!result.requires_replacement;
    err.usageCount = result.usage_count;
    throw err;
  }
}

