const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Generic API functions
export async function get(url: string, params?: Record<string, any>): Promise<any> {
  const token = localStorage.getItem('token');
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  const response = await fetch(`${API_BASE_URL}${url}${queryString}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    }
  });
  return response.json();
}

export async function post(url: string, data: any): Promise<any> {
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

export async function put(url: string, data: any): Promise<any> {
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

export async function del(url: string): Promise<any> {
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
}

// Authentication
export async function login(username: string, password: string): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  const result: ApiResponse<User> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Login failed');
  }

  return result.data;
}

// Items
export async function getAllItems(): Promise<Item[]> {
  const response = await fetch(`${API_BASE_URL}/items`);
  const result: ApiResponse<Item[]> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch items');
  }

  return result.data;
}

export async function getLowStockItems(): Promise<LowStockItem[]> {
  const response = await fetch(`${API_BASE_URL}/items/low-stock`);
  const result: ApiResponse<LowStockItem[]> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch low stock items');
  }

  return result.data;
}

// Purchase Orders
export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  const response = await fetch(`${API_BASE_URL}/purchase-orders`);
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
  const response = await fetch(`${API_BASE_URL}/transactions?limit=${limit}`);
  const result: ApiResponse<Transaction[]> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch transactions');
  }

  return result.data;
}

// Locations
export async function getAllLocations(): Promise<any[]> {
  const response = await fetch(`${API_BASE_URL}/locations`);
  const result: ApiResponse<any[]> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch locations');
  }

  return result.data;
}

// Statistics
export async function getStatistics(): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/stats`);
  const result: ApiResponse<any> = await response.json();

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
export async function updateLocation(address: string, data: any): Promise<void> {
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

