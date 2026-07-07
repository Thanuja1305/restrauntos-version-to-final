import { OrdersRepository } from "./ordersRepository.js";
import { Order, OrderItem, MenuItem } from "../types.js";

export class OrdersService {
  private repository = new OrdersRepository();

  async getMenuItems(): Promise<MenuItem[]> {
    return this.repository.getMenuItems();
  }

  async getCustomers() {
    return this.repository.getCustomers();
  }

  async getOrders(filters: {
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    limit?: number;
    offset?: number;
  }) {
    return this.repository.getOrders(filters);
  }

  async getOrderById(id: number): Promise<Order | null> {
    return this.repository.getOrderById(id);
  }

  /**
   * Calculates order totals and saves to PostgreSQL
   */
  async placeOrder(orderPayload: {
    customerName: string;
    phone?: string;
    tableOrType: string;
    items: { menuItemId: string; quantity: number }[];
    discount?: number;
    status?: "Pending" | "Completed" | "Cancelled";
  }): Promise<Order> {
    // 1. Resolve item names, prices, and quantities from database menu
    const menuItems = await this.repository.getMenuItems();
    const menuMap = new Map<string, MenuItem>();
    menuItems.forEach(item => menuMap.set(item.id, item));

    const validatedItems: OrderItem[] = [];
    let subtotal = 0;

    for (const item of orderPayload.items) {
      const menuObj = menuMap.get(item.menuItemId);
      if (!menuObj) {
        throw new Error(`Menu item with ID ${item.menuItemId} does not exist in PostgreSQL`);
      }
      
      const price = menuObj.price;
      const totalItemCost = price * item.quantity;
      subtotal += totalItemCost;

      validatedItems.push({
        menuItemId: item.menuItemId,
        name: menuObj.name,
        quantity: item.quantity,
        price: price
      });
    }

    const tax = Math.round((subtotal * 0.05) * 100) / 100; // 5% GST
    const discount = orderPayload.discount || 0;
    const total = Math.max(0, Math.round((subtotal + tax - discount) * 100) / 100);

    // 2. Persist to PostgreSQL
    return this.repository.createOrder({
      customerName: orderPayload.customerName,
      phone: orderPayload.phone,
      tableOrType: orderPayload.tableOrType,
      subtotal,
      tax,
      total,
      status: orderPayload.status || "Pending",
      items: validatedItems
    });
  }

  async updateOrderStatus(id: number, status: "Pending" | "Completed" | "Cancelled"): Promise<Order | null> {
    return this.repository.updateOrderStatus(id, status);
  }

  async deleteOrder(id: number): Promise<boolean> {
    return this.repository.deleteOrder(id);
  }

  async getOrdersStats() {
    return this.repository.getOrdersStats();
  }

  /**
   * Generates a beautiful HTML thermal receipt for POS printing
   */
  async generateReceiptHtml(orderId: number): Promise<string> {
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new Error(`Order #${orderId} not found`);
    }

    const itemsRows = order.items.map(item => `
      <tr>
        <td style="padding: 6px 0;">${item.name} <span style="font-size: 11px; color: #555;">x${item.quantity}</span></td>
        <td style="padding: 6px 0; text-align: right;">₹${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `).join("");

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>POS Receipt - ${order.id}</title>
          <style>
            body {
              font-family: 'Courier New', Courier, monospace;
              color: #000;
              background-color: #fff;
              margin: 0;
              padding: 20px;
              font-size: 14px;
              line-height: 1.4;
              max-width: 300px;
            }
            .header {
              text-align: center;
              border-bottom: 1px dashed #000;
              padding-bottom: 15px;
              margin-bottom: 15px;
            }
            .title {
              font-size: 18px;
              font-weight: bold;
              margin: 0 0 5px 0;
              text-transform: uppercase;
            }
            .subtitle {
              font-size: 12px;
              margin: 0;
              color: #333;
            }
            .meta-item {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              margin: 3px 0;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
              border-bottom: 1px dashed #000;
              padding-bottom: 10px;
            }
            .totals-container {
              border-top: 1px dashed #000;
              padding-top: 10px;
              margin-top: 10px;
              font-size: 13px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin: 4px 0;
            }
            .grand-total {
              font-size: 16px;
              font-weight: bold;
              margin-top: 8px;
              border-top: 1px double #000;
              border-bottom: 1px double #000;
              padding: 6px 0;
            }
            .footer {
              text-align: center;
              margin-top: 25px;
              font-size: 11px;
              border-top: 1px dashed #000;
              padding-top: 15px;
            }
            @media print {
              body {
                padding: 0;
                margin: 0;
              }
              @page {
                size: 80px auto;
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">SPICE HEAVEN</h1>
            <p class="subtitle">Operational AI Operating System</p>
            <p class="subtitle">Sector 62, Noida, UP</p>
            <p class="subtitle">Tel: +91 99999 99999</p>
          </div>

          <div>
            <div class="meta-item"><span>Receipt No:</span> <span>${order.id}</span></div>
            <div class="meta-item"><span>Date:</span> <span>${new Date(order.timestamp).toLocaleDateString()}</span></div>
            <div class="meta-item"><span>Time:</span> <span>${new Date(order.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
            <div class="meta-item"><span>Table/Type:</span> <span>${order.tableOrType}</span></div>
            <div class="meta-item"><span>Customer:</span> <span>${order.customerName}</span></div>
            <div class="meta-item"><span>Phone:</span> <span>${order.phone}</span></div>
          </div>

          <table class="items-table">
            <thead>
              <tr style="border-bottom: 1px dashed #000;">
                <th style="text-align: left; padding-bottom: 6px; font-size: 12px;">ITEM</th>
                <th style="text-align: right; padding-bottom: 6px; font-size: 12px;">PRICE</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div class="totals-container">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>₹${order.subtotal.toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span>CGST + SGST (5.0%):</span>
              <span>₹${order.tax.toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span>Payment status:</span>
              <span style="font-weight: bold; text-transform: uppercase;">${order.status}</span>
            </div>
            <div class="total-row grand-total">
              <span>GRAND TOTAL:</span>
              <span>₹${order.total.toFixed(2)}</span>
            </div>
          </div>

          <div class="footer">
            <p style="margin: 0 0 5px 0; font-weight: bold;">THANK YOU FOR VISITING!</p>
            <p style="margin: 0;">Powered by RestaurantOS AI</p>
            <p style="margin: 3px 0 0 0; font-size: 8px;">Order tracked on PostgreSQL production ledger</p>
          </div>

          <script>
            // Auto trigger browser print if opened in standalone window
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;
  }
}
