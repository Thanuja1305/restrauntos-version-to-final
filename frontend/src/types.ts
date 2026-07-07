export interface MenuItem {
  id: string;
  name: string;
  category: "Appetizer" | "Main Course" | "Beverage" | "Dessert";
  price: number;
  cost: number;
  status: "Available" | "Sold Out";
  popularity: number; // 1-5 star rating or index
}

export interface InventoryItem {
  id: string;
  name: string;
  currentQty: number;
  unit: string;
  reorderLevel: number;
  supplierId: string;
  unitPrice: number;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string; // e.g. #1042
  customerName: string;
  phone?: string;
  tableOrType: string; // Table 4, Takeaway, Delivery
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: "Completed" | "Pending" | "Cancelled";
  timestamp: string; // ISO date string
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  visitCount: number;
  totalSpent: number;
  lastOrderDate: string;
  notes: string;
}

export interface Supplier {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  itemsSupplied: string[];
  pendingPayments: number;
}

export interface FinanceEntry {
  id: string;
  timestamp: string;
  type: "Income" | "Expense";
  category: "Order Revenue" | "Supplier Payment" | "Rent" | "Salaries" | "Utilities" | "Other";
  amount: number;
  description: string;
}

export interface RestaurantState {
  menu: MenuItem[];
  inventory: InventoryItem[];
  orders: Order[];
  customers: Customer[];
  suppliers: Supplier[];
  finances: FinanceEntry[];
}

export interface ChatMessage {
  id: string;
  sender: "owner" | "ai";
  text: string;
  timestamp: string;
  metadata?: {
    actionType?: "create_order" | "low_stock" | "finance_summary" | "supplier_payout" | "general";
    actionData?: any;
    confirmNeeded?: boolean;
    confirmed?: boolean;
  };
}

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
  currentState: RestaurantState;
}

export interface ChatResponse {
  reply: string;
  updatedState?: RestaurantState;
  actionDetails?: {
    success: boolean;
    type: string;
    description: string;
  };
}
