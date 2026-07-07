import { query, getPool } from "./db.js";
import { Order, OrderItem, Customer, MenuItem, InventoryItem, Supplier, FinanceEntry } from "../types.js";

export class OrdersRepository {
  /**
   * Fetches menu items directly from PostgreSQL
   */
  async getMenuItems(): Promise<MenuItem[]> {
    const p = getPool();
    if (!p) return [];

    const res = await query(`
      SELECT id, name, category, CAST(price AS DOUBLE PRECISION) as price, 
             CAST(cost AS DOUBLE PRECISION) as cost, status, popularity 
      FROM menu_items 
      ORDER BY category, name
    `);
    
    return res.rows.map(row => ({
      id: row.id,
      name: row.name,
      category: row.category,
      price: row.price,
      cost: row.cost,
      status: row.status as any,
      popularity: row.popularity
    }));
  }

  /**
   * Fetches customer list directly from PostgreSQL
   */
  async getCustomers(): Promise<Customer[]> {
    const p = getPool();
    if (!p) return [];

    const res = await query(`
      SELECT id, name, phone, visit_count as "visitCount", 
             CAST(total_spent AS DOUBLE PRECISION) as "totalSpent", 
             last_order_date as "lastOrderDate", notes 
      FROM customers 
      ORDER BY visit_count DESC, name
    `);

    return res.rows.map(row => ({
      id: String(row.id),
      name: row.name,
      phone: row.phone || "+91 99999 99999",
      visitCount: row.visitCount || 0,
      totalSpent: row.totalSpent || 0,
      lastOrderDate: row.lastOrderDate ? new Date(row.lastOrderDate).toISOString() : new Date().toISOString(),
      notes: row.notes || ""
    }));
  }

  /**
   * Fetches paginated, sorted, and filtered orders list
   */
  async getOrders(filters: {
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    limit?: number;
    offset?: number;
  }): Promise<{ orders: Order[]; totalCount: number }> {
    const p = getPool();
    if (!p) return { orders: [], totalCount: 0 };

    const { search, status, sortBy = "created_at", sortOrder = "desc", limit = 10, offset = 0 } = filters;
    
    let whereClauses: string[] = [];
    let params: any[] = [];
    let paramCounter = 1;

    if (status && status !== "All") {
      whereClauses.push(`o.status = $${paramCounter++}`);
      params.push(status);
    }

    if (search) {
      const searchWildcard = `%${search.toLowerCase()}%`;
      whereClauses.push(`(
        LOWER(o.customer_name) LIKE $${paramCounter} OR 
        LOWER(o.phone) LIKE $${paramCounter} OR
        LOWER(o.table_or_type) LIKE $${paramCounter} OR
        CAST(o.id AS TEXT) LIKE $${paramCounter}
      )`);
      params.push(searchWildcard);
      paramCounter++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    
    // Map UI sorting parameters to database columns
    let dbSortColumn = "o.created_at";
    if (sortBy === "id") dbSortColumn = "o.id";
    else if (sortBy === "customerName") dbSortColumn = "o.customer_name";
    else if (sortBy === "tableOrType") dbSortColumn = "o.table_or_type";
    else if (sortBy === "total") dbSortColumn = "o.total";
    else if (sortBy === "timestamp") dbSortColumn = "o.created_at";

    const orderSql = `ORDER BY ${dbSortColumn} ${sortOrder === "asc" ? "ASC" : "DESC"}`;

    // Query to get orders paginated with COUNT(*) OVER() to avoid dual database roundtrips
    const querySql = `
      SELECT o.id, o.customer_name as "customerName", o.phone, o.table_or_type as "tableOrType",
             CAST(o.subtotal AS DOUBLE PRECISION) as subtotal, 
             CAST(o.tax AS DOUBLE PRECISION) as tax, 
             CAST(o.total AS DOUBLE PRECISION) as total, 
             o.status, o.created_at as timestamp,
             COUNT(*) OVER() as "fullCount"
      FROM orders o
      ${whereSql}
      ${orderSql}
      LIMIT $${paramCounter++} OFFSET $${paramCounter++}
    `;

    const finalParams = [...params, limit, offset];
    const res = await query(querySql, finalParams);

    if (res.rows.length === 0) {
      return { orders: [], totalCount: 0 };
    }

    const totalCount = parseInt(res.rows[0].fullCount, 10);
    const orderIds = res.rows.map(r => r.id);

    // Fetch order items for these order IDs in a single batch query
    const itemsRes = await query(`
      SELECT order_id as "orderId", menu_item_id as "menuItemId", name, quantity, 
             CAST(price AS DOUBLE PRECISION) as price
      FROM order_items
      WHERE order_id = ANY($1)
    `, [orderIds]);

    // Map order items back to their parent orders
    const orders: Order[] = res.rows.map(row => {
      const items: OrderItem[] = itemsRes.rows
        .filter(i => i.orderId === row.id)
        .map(i => ({
          menuItemId: i.menuItemId,
          name: i.name,
          quantity: i.quantity,
          price: i.price
        }));

      return {
        id: `ORD-${String(row.id).padStart(6, '0')}`, // Standard visual prefix
        customerName: row.customerName,
        phone: row.phone || "+91 99999 99999",
        tableOrType: row.tableOrType,
        items,
        subtotal: row.subtotal,
        tax: row.tax,
        total: row.total,
        status: row.status as any,
        timestamp: new Date(row.timestamp).toISOString()
      };
    });

    return { orders, totalCount };
  }

  /**
   * Fetches single complete order by ID
   */
  async getOrderById(id: number): Promise<Order | null> {
    const res = await query(`
      SELECT id, customer_name as "customerName", phone, table_or_type as "tableOrType",
             CAST(subtotal AS DOUBLE PRECISION) as subtotal, 
             CAST(tax AS DOUBLE PRECISION) as tax, 
             CAST(total AS DOUBLE PRECISION) as total, 
             status, created_at as timestamp
      FROM orders
      WHERE id = $1
    `, [id]);

    if (res.rows.length === 0) return null;

    const row = res.rows[0];

    const itemsRes = await query(`
      SELECT menu_item_id as "menuItemId", name, quantity, 
             CAST(price AS DOUBLE PRECISION) as price
      FROM order_items
      WHERE order_id = $1
    `, [id]);

    const items: OrderItem[] = itemsRes.rows.map(i => ({
      menuItemId: i.menuItemId,
      name: i.name,
      quantity: i.quantity,
      price: i.price
    }));

    return {
      id: `ORD-${String(row.id).padStart(6, '0')}`,
      customerName: row.customerName,
      phone: row.phone || "+91 99999 99999",
      tableOrType: row.tableOrType,
      items,
      subtotal: row.subtotal,
      tax: row.tax,
      total: row.total,
      status: row.status as any,
      timestamp: new Date(row.timestamp).toISOString()
    };
  }

  /**
   * Saves a new order into PostgreSQL
   */
  async createOrder(orderData: {
    customerName: string;
    phone?: string;
    tableOrType: string;
    subtotal: number;
    tax: number;
    total: number;
    status: "Pending" | "Completed" | "Cancelled";
    items: OrderItem[];
  }): Promise<Order> {
    const p = getPool();
    if (!p) throw new Error("Database offline");

    // Start transaction to secure multi-table inserts
    await query("BEGIN");

    try {
      // 1. Check or Upsert Customer CRM records
      let customerId: number | null = null;
      let customerRes = await query(`
        SELECT id, visit_count, total_spent FROM customers 
        WHERE LOWER(name) = LOWER($1) OR (phone IS NOT NULL AND phone = $2)
        LIMIT 1
      `, [orderData.customerName, orderData.phone || ""]);

      if (customerRes.rows.length > 0) {
        const cust = customerRes.rows[0];
        customerId = cust.id;
        const nextVisitCount = (cust.visit_count || 0) + 1;
        const nextTotalSpent = parseFloat(cust.total_spent || 0) + orderData.total;

        await query(`
          UPDATE customers 
          SET visit_count = $1, total_spent = $2, last_order_date = NOW()
          WHERE id = $3
        `, [nextVisitCount, nextTotalSpent, customerId]);
      } else {
        const insertCust = await query(`
          INSERT INTO customers (name, phone, visit_count, total_spent, last_order_date, notes)
          VALUES ($1, $2, 1, $3, NOW(), 'Auto-registered during PostgreSQL Order placement')
          RETURNING id
        `, [orderData.customerName, orderData.phone || "+91 99999 99999", orderData.total]);
        customerId = insertCust.rows[0].id;
      }

      // 2. Insert Order Header record
      const orderRes = await query(`
        INSERT INTO orders (customer_id, customer_name, phone, table_or_type, subtotal, tax, total, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id, created_at
      `, [
        customerId, 
        orderData.customerName, 
        orderData.phone || "+91 99999 99999", 
        orderData.tableOrType, 
        orderData.subtotal, 
        orderData.tax, 
        orderData.total, 
        orderData.status
      ]);

      const newOrderId = orderRes.rows[0].id;
      const createdAt = orderRes.rows[0].created_at;

      // 3. Insert Order Items records in batch
      for (const item of orderData.items) {
        await query(`
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, price)
          VALUES ($1, $2, $3, $4, $5)
        `, [newOrderId, item.menuItemId, item.name, item.quantity, item.price]);
      }

      await query("COMMIT");

      return {
        id: `ORD-${String(newOrderId).padStart(6, '0')}`,
        customerName: orderData.customerName,
        phone: orderData.phone || "+91 99999 99999",
        tableOrType: orderData.tableOrType,
        items: orderData.items,
        subtotal: orderData.subtotal,
        tax: orderData.tax,
        total: orderData.total,
        status: orderData.status,
        timestamp: new Date(createdAt).toISOString()
      };
    } catch (err) {
      await query("ROLLBACK");
      console.error("Database transaction rolled back:", err);
      throw err;
    }
  }

  /**
   * Updates order status in PostgreSQL
   */
  async updateOrderStatus(id: number, status: "Pending" | "Completed" | "Cancelled"): Promise<Order | null> {
    const res = await query(`
      UPDATE orders 
      SET status = $1 
      WHERE id = $2 
      RETURNING id
    `, [status, id]);

    if (res.rows.length === 0) return null;
    return this.getOrderById(id);
  }

  /**
   * Deletes order from PostgreSQL
   */
  async deleteOrder(id: number): Promise<boolean> {
    // Cascading delete is enabled, so deleting order automatically removes order items.
    const res = await query(`
      DELETE FROM orders 
      WHERE id = $1 
      RETURNING id
    `, [id]);

    return res.rows.length > 0;
  }

  /**
   * Fetches computed order KPIs directly from PostgreSQL
   */
  async getOrdersStats(): Promise<{
    todayTransactions: number;
    pendingQueue: number;
    completedRevenue: number;
    averageTicket: number;
  }> {
    const p = getPool();
    if (!p) {
      return { todayTransactions: 0, pendingQueue: 0, completedRevenue: 0, averageTicket: 0 };
    }

    const querySql = `
      SELECT 
        (SELECT COUNT(*) FROM orders WHERE created_at::date = CURRENT_DATE) as "todayTransactions",
        (SELECT COUNT(*) FROM orders WHERE status = 'Pending') as "pendingQueue",
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = 'Completed') as "completedRevenue",
        (SELECT COALESCE(AVG(total), 0) FROM orders) as "averageTicket"
    `;

    const res = await query(querySql);
    const row = res.rows[0] || {};
    return {
      todayTransactions: parseInt(row.todayTransactions || "0", 10),
      pendingQueue: parseInt(row.pendingQueue || "0", 10),
      completedRevenue: parseFloat(row.completedRevenue || "0"),
      averageTicket: Math.round(parseFloat(row.averageTicket || "0") * 100) / 100
    };
  }

  /**
   * Fetches current stock inventory from PostgreSQL
   */
  async getInventory(): Promise<InventoryItem[]> {
    const p = getPool();
    if (!p) return [];

    const res = await query(`
      SELECT id, name, CAST(current_qty AS DOUBLE PRECISION) as "currentQty", 
             unit, CAST(reorder_level AS DOUBLE PRECISION) as "reorderLevel", 
             supplier_id as "supplierId", CAST(unit_price AS DOUBLE PRECISION) as "unitPrice"
      FROM inventory
      ORDER BY name
    `);

    return res.rows.map(row => ({
      id: row.id,
      name: row.name,
      currentQty: row.currentQty,
      unit: row.unit,
      reorderLevel: row.reorderLevel,
      supplierId: row.supplierId || "",
      unitPrice: row.unitPrice
    }));
  }

  /**
   * Fetches current active suppliers from PostgreSQL
   */
  async getSuppliers(): Promise<Supplier[]> {
    const p = getPool();
    if (!p) return [];

    const res = await query(`
      SELECT id, company_name as "companyName", contact_person as "contactPerson", 
             phone, items_supplied as "itemsSupplied", 
             CAST(pending_payments AS DOUBLE PRECISION) as "pendingPayments"
      FROM suppliers
      ORDER BY company_name
    `);

    return res.rows.map(row => ({
      id: row.id,
      companyName: row.companyName,
      contactPerson: row.contactPerson,
      phone: row.phone,
      itemsSupplied: Array.isArray(row.itemsSupplied) ? row.itemsSupplied : (typeof row.itemsSupplied === "string" ? JSON.parse(row.itemsSupplied) : []),
      pendingPayments: row.pendingPayments
    }));
  }

  /**
   * Fetches entire finances accounting ledger from PostgreSQL
   */
  async getFinances(): Promise<FinanceEntry[]> {
    const p = getPool();
    if (!p) return [];

    const res = await query(`
      SELECT id, created_at as timestamp, type, category, 
             CAST(amount AS DOUBLE PRECISION) as amount, description
      FROM finances
      ORDER BY created_at DESC
    `);

    return res.rows.map(row => ({
      id: "f" + row.id,
      timestamp: new Date(row.timestamp).toISOString(),
      type: row.type as any,
      category: row.category as any,
      amount: row.amount,
      description: row.description
    }));
  }

  /**
   * Updates an inventory item current level in PostgreSQL
   */
  async updateInventoryItemQty(id: string, currentQty: number): Promise<boolean> {
    const res = await query(`
      UPDATE inventory 
      SET current_qty = $1 
      WHERE id = $2 
      RETURNING id
    `, [currentQty, id]);
    return res.rows.length > 0;
  }

  /**
   * Updates a supplier outstanding balance in PostgreSQL
   */
  async updateSupplierPendingPayment(id: string, pendingPayments: number): Promise<boolean> {
    const res = await query(`
      UPDATE suppliers 
      SET pending_payments = $1 
      WHERE id = $2 
      RETURNING id
    `, [pendingPayments, id]);
    return res.rows.length > 0;
  }

  /**
   * Logs a new financial transaction into PostgreSQL ledger
   */
  async createFinanceEntry(entry: {
    type: "Income" | "Expense";
    category: string;
    amount: number;
    description: string;
  }): Promise<FinanceEntry> {
    const res = await query(`
      INSERT INTO finances (type, category, amount, description, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, created_at
    `, [entry.type, entry.category, entry.amount, entry.description]);

    const row = res.rows[0];
    return {
      id: "f" + row.id,
      timestamp: new Date(row.created_at).toISOString(),
      type: entry.type,
      category: entry.category as any,
      amount: entry.amount,
      description: entry.description
    };
  }
}
