import { InventoryItem, Order, FinanceEntry, MenuItem } from "../types";

export interface LowStockAlert {
  item: string;
  current_quantity: number;
  required_level: number;
  recommended_order_quantity: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export interface InventoryTransactionDTO {
  id: string;
  timestamp: string;
  item: string;
  transaction_type: "RECEIVE" | "CONSUME" | "WASTE" | "TRANSFER" | "ADJUST";
  quantity_change: number;
  user: string;
  reference: string;
}

export interface MenuCosting {
  menu_item_id: string;
  item_name: string;
  category: string;
  selling_price: number;
  ingredient_cost: number;
  food_cost_percentage: number;
  profit_margin: number;
  availability_status: string;
}

export interface FinanceSummaryDTO {
  total_revenue: number;
  total_expenses: number;
  gross_profit: number;
  net_profit: number;
  food_cost: number;
  labor_cost: number;
  profit_margin_percentage: number;
}

export interface SalesKPI {
  daily_sales: number;
  weekly_sales: number;
  monthly_sales: number;
  best_selling_items: string[];
  average_order_value: number;
}

export interface InventoryKPI {
  inventory_value: number;
  low_stock_items: string[];
  waste_percentage: number;
  stock_turnover: number;
}

export interface CustomerKPI {
  total_customers: number;
  returning_customers: number;
  customer_frequency: number;
  customer_lifetime_value: number;
}

export interface AnalyticsKPIsResponse {
  sales: SalesKPI;
  inventory: InventoryKPI;
  customer: CustomerKPI;
}

export interface StrategicInsight {
  insight_title: string;
  explanation: string;
  recommendation: string;
  confidence_score: number;
  generated_at: string;
}

const handleResponse = async (res: Response) => {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API error: ${res.status}`);
  }
  return res.json();
};

export const inventoryService = {
  async getInventory(): Promise<any[]> {
    return fetch("/api/inventory").then(handleResponse);
  },
  async getLowStock(): Promise<LowStockAlert[]> {
    return fetch("/api/inventory/low-stock").then(handleResponse);
  },
  async getTransactions(): Promise<InventoryTransactionDTO[]> {
    return fetch("/api/inventory/transactions").then(handleResponse);
  },
  async addInventoryItem(payload: any): Promise<any> {
    return fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handleResponse);
  },
  async logTransaction(payload: any): Promise<any> {
    return fetch("/api/inventory/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handleResponse);
  },
};

export const menuService = {
  async getMenu(): Promise<MenuCosting[]> {
    return fetch("/api/menu").then(handleResponse);
  },
};

export const salesService = {
  async getOrders(): Promise<any[]> {
    return fetch("/api/orders").then(handleResponse);
  },
};

export const financeService = {
  async getSummary(): Promise<FinanceSummaryDTO> {
    return fetch("/api/finance/summary").then(handleResponse);
  },
  async logExpense(payload: any): Promise<any> {
    return fetch("/api/finance/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handleResponse);
  },
};

export const analyticsService = {
  async getKPIs(): Promise<AnalyticsKPIsResponse> {
    return fetch("/api/analytics/kpis").then(handleResponse);
  },
  async getInsights(): Promise<StrategicInsight[]> {
    return fetch("/api/analytics/insights").then(handleResponse);
  },
};
