import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { RestaurantState, ChatMessage, ChatResponse } from "./src/types.js";
import { bootstrapDatabase, getPool } from "./src/lib/db.js";
import { OrdersService } from "./src/lib/ordersService.js";
import { runMultiAgentSystem } from "./src/lib/agents.js";

// Load environment variables
dotenv.config();

const PORT = 3000;
const isProd = process.env.NODE_ENV === "production";

const defaultMenuItems = [
  { id: "m1", name: "Masala Dosa", category: "Main Course" as const, price: 120, cost: 40, status: "Available" as const, popularity: 5 },
  { id: "m2", name: "Paneer Butter Masala", category: "Main Course" as const, price: 220, cost: 80, status: "Available" as const, popularity: 4 },
  { id: "m3", name: "Garlic Naan", category: "Main Course" as const, price: 40, cost: 12, status: "Available" as const, popularity: 4 },
  { id: "m4", name: "Filter Coffee", category: "Beverage" as const, price: 30, cost: 8, status: "Available" as const, popularity: 5 },
  { id: "m5", name: "Mango Lassi", category: "Beverage" as const, price: 80, cost: 25, status: "Available" as const, popularity: 4 },
  { id: "m6", name: "Samosa (2 Pcs)", category: "Appetizer" as const, price: 50, cost: 15, status: "Available" as const, popularity: 4 },
  { id: "m7", name: "Gulab Jamun (2 Pcs)", category: "Dessert" as const, price: 60, cost: 18, status: "Available" as const, popularity: 5 }
];

const defaultInventory = [
  { id: "i1", name: "Tomatoes", currentQty: 12.5, unit: "kg", reorderLevel: 5.0, supplierId: "s2", unitPrice: 40 },
  { id: "i2", name: "Onions", currentQty: 18.0, unit: "kg", reorderLevel: 6.0, supplierId: "s2", unitPrice: 30 },
  { id: "i3", name: "Paneer", currentQty: 4.2, unit: "kg", reorderLevel: 2.0, supplierId: "s1", unitPrice: 350 },
  { id: "i4", name: "Milk", currentQty: 15.0, unit: "L", reorderLevel: 5.0, supplierId: "s1", unitPrice: 60 },
  { id: "i5", name: "Flour/Maida", currentQty: 25.0, unit: "kg", reorderLevel: 10.0, supplierId: "s2", unitPrice: 45 },
  { id: "i6", name: "Coffee Beans", currentQty: 3.5, unit: "kg", reorderLevel: 1.5, supplierId: "s3", unitPrice: 800 }
];

const defaultSuppliers = [
  { id: "s1", companyName: "Dairy Craft", contactPerson: "Rajesh Kumar", phone: "+91 98888 77777", itemsSupplied: ["Paneer", "Milk", "Cheese"], pendingPayments: 2800.00 },
  { id: "s2", companyName: "Fresh Farms", contactPerson: "Anil Sharma", phone: "+91 97777 66666", itemsSupplied: ["Tomatoes", "Onions", "Potatoes", "Flour/Maida"], pendingPayments: 1500.00 },
  { id: "s3", companyName: "Kapi Co.", contactPerson: "Srinivas Rao", phone: "+91 96666 55555", itemsSupplied: ["Coffee Beans", "Tea Powder"], pendingPayments: 0.00 }
];

const defaultCustomers = [
  { id: "c1", name: "Rahul", phone: "+91 98765 43210", visitCount: 12, totalSpent: 2450, lastOrderDate: new Date().toISOString(), notes: "Regular. Likes Filter Coffee strong and sweet." },
  { id: "c2", name: "Priya", phone: "+91 91234 56789", visitCount: 8, totalSpent: 1920, lastOrderDate: new Date().toISOString(), notes: "Prefers mild options, fan of paneer." },
  { id: "c3", name: "Amit", phone: "+91 99887 76655", visitCount: 3, totalSpent: 450, lastOrderDate: new Date().toISOString(), notes: "Prefers table near the window." },
  { id: "c4", name: "Sneha", phone: "+91 97777 88888", visitCount: 20, totalSpent: 5200, lastOrderDate: new Date().toISOString(), notes: "VVIP customer. Prefers organic ingredients." }
];

const defaultFinances = [
  { id: "f1", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), type: "Expense" as const, category: "Rent" as const, amount: 12000.00, description: "Monthly restaurant space rent" },
  { id: "f2", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), type: "Expense" as const, category: "Salaries" as const, amount: 8500.00, description: "Part-time kitchen staff salaries" },
  { id: "f3", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), type: "Expense" as const, category: "Utilities" as const, amount: 2350.00, description: "Electricity and water bills" },
  { id: "f4", timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), type: "Income" as const, category: "Order Revenue" as const, amount: 283.50, description: "Completed Order ORD-001041 for Rahul" }
];

const defaultOrders = [
  {
    id: "ORD-001041",
    customerName: "Rahul",
    phone: "+91 98765 43210",
    tableOrType: "Table 4",
    items: [
      { menuItemId: "m1", name: "Masala Dosa", quantity: 2, price: 120 },
      { menuItemId: "m4", name: "Filter Coffee", quantity: 1, price: 30 }
    ],
    subtotal: 270,
    tax: 13.5,
    total: 283.5,
    status: "Completed" as const,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "ORD-001042",
    customerName: "Priya",
    phone: "+91 91234 56789",
    tableOrType: "Table 2",
    items: [
      { menuItemId: "m2", name: "Paneer Butter Masala", quantity: 1, price: 220 },
      { menuItemId: "m3", name: "Garlic Naan", quantity: 2, price: 40 }
    ],
    subtotal: 300,
    tax: 15,
    total: 315,
    status: "Pending" as const,
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString()
  },
  {
    id: "ORD-001043",
    customerName: "Amit",
    phone: "+91 99887 76655",
    tableOrType: "Takeaway",
    items: [
      { menuItemId: "m6", name: "Samosa (2 Pcs)", quantity: 2, price: 50 },
      { menuItemId: "m4", name: "Filter Coffee", quantity: 2, price: 30 }
    ],
    subtotal: 160,
    tax: 8,
    total: 168,
    status: "Pending" as const,
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString()
  }
];

// Initial/default database state for Spice Heaven Restaurant
const createInitialState = (): RestaurantState => JSON.parse(JSON.stringify({
  menu: defaultMenuItems,
  inventory: defaultInventory,
  orders: defaultOrders,
  customers: defaultCustomers,
  suppliers: defaultSuppliers,
  finances: defaultFinances
}));

// Current active restaurant memory
let dbState = createInitialState();

function mapItemCompat(item: any): any {
  if (!item || typeof item !== "object") return item;

  const mapped = { ...item };

  // 1. Inventory Item Mapping
  if ("item_name" in item || "current_quantity" in item) {
    mapped.name = item.item_name || item.name;
    mapped.currentQty = item.current_quantity !== undefined ? item.current_quantity : item.currentQty;
    mapped.unit = item.unit_of_measure || item.unit;
    mapped.reorderLevel = item.minimum_stock_level !== undefined ? item.minimum_stock_level : item.reorderLevel;
    mapped.unitPrice = item.unit_cost !== undefined ? item.unit_cost : item.unitPrice;
    mapped.supplierId = item.supplier_id || item.supplierId || "s1";
  }

  // 2. Menu Item Mapping
  if ("selling_price" in item || "ingredient_cost" in item || "availability_status" in item) {
    mapped.name = item.item_name || item.name;
    mapped.price = item.selling_price !== undefined ? item.selling_price : item.price;
    mapped.cost = item.ingredient_cost !== undefined ? item.ingredient_cost : item.cost;
    mapped.status = item.availability_status === "Available" || item.status === "Available" ? "Available" : "Sold Out";
    mapped.popularity = item.popularity !== undefined ? item.popularity : 4;
  }

  // 3. Order Mapping
  if ("order_number" in item || "table_or_type" in item || "total_amount" in item) {
    mapped.id = item.order_number || String(item.id);
    mapped.customerName = item.customer_name || (item.customer ? item.customer.name : "Guest Customer");
    mapped.phone = item.phone || (item.customer ? item.customer.phone : "");
    mapped.tableOrType = item.table_or_type || item.order_type;
    mapped.total = item.total_amount !== undefined ? item.total_amount : item.total;
    mapped.timestamp = item.created_at || item.timestamp;
    if (Array.isArray(item.items)) {
      mapped.items = item.items.map((it: any) => ({
        menuItemId: it.menu_item_id || it.menuItemId,
        name: it.name,
        quantity: it.quantity,
        price: it.price
      }));
    }
  }

  return mapped;
}

// Helper to sync in-memory state with PostgreSQL records via FastAPI
async function syncDbStateFromPostgres() {
  try {
    const [menu, inventory, orders] = await Promise.all([
      fetch("http://127.0.0.1:8001/api/menu").then(r => r.json()).catch(() => null),
      fetch("http://127.0.0.1:8001/api/inventory").then(r => r.json()).catch(() => null),
      fetch("http://127.0.0.1:8001/orders").then(r => r.json()).catch(() => null)
    ]);

    console.log("syncDbStateFromPostgres fetched:", { menu, inventory, orders });

    if (menu !== null) dbState.menu = menu.map(mapItemCompat);
    if (inventory !== null) dbState.inventory = inventory.map(mapItemCompat);
    if (orders !== null) dbState.orders = orders.map(mapItemCompat);
  } catch (err) {
    console.error("Failed to sync state from FastAPI:", err);
  }
}

async function startServer() {
  // Bootstrap the PostgreSQL database
  await bootstrapDatabase();

  const app = express();
  app.use(express.json());

  // --- FastAPI Proxy Layer ---
  async function proxyToFastAPI(req: any, res: any, targetPath: string) {
    const targetUrl = `http://127.0.0.1:8001${targetPath}`;
    console.log(`[Proxy] Forwarding ${req.method} ${req.originalUrl} -> ${targetUrl}`);
    try {
      const options: any = {
        method: req.method,
        headers: { ...req.headers },
      };
      delete options.headers.host;
      delete options.headers.connection;
      delete options.headers["content-length"];

      if (["POST", "PUT", "PATCH"].includes(req.method) && req.body) {
        options.headers["content-type"] = "application/json";
        options.body = JSON.stringify(req.body);
      }

      const response = await fetch(targetUrl, options);
      const contentType = response.headers.get("content-type") || "";
      
      res.status(response.status);
      for (const [key, value] of response.headers.entries()) {
        if (!["content-encoding", "transfer-encoding", "connection", "keep-alive"].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      }

      if (contentType.includes("application/json")) {
        const json = await response.json();
        res.json(json);
      } else {
        const text = await response.text();
        res.send(text);
      }
    } catch (err: any) {
      console.error(`[Proxy Error] Failed to forward request to ${targetUrl}:`, err);
      res.status(502).json({ error: "Failed to connect to FastAPI backend.", details: err.message });
    }
  }

  if (getPool()) {
    app.all("/api/inventory*", (req, res) => {
      proxyToFastAPI(req, res, req.originalUrl);
    });

    app.all("/api/menu*", (req, res) => {
      proxyToFastAPI(req, res, req.originalUrl);
    });

    app.all("/api/finance*", (req, res) => {
      proxyToFastAPI(req, res, req.originalUrl);
    });

    app.all("/api/analytics*", (req, res) => {
      proxyToFastAPI(req, res, req.originalUrl);
    });

    app.all("/api/audit-logs*", (req, res) => {
      proxyToFastAPI(req, res, req.originalUrl);
    });

    app.all("/api/agents/events*", (req, res) => {
      proxyToFastAPI(req, res, req.originalUrl);
    });

    app.all("/api/orders*", (req, res) => {
      const pathPart = req.originalUrl.replace(/^\/api\/orders/, "/orders");
      proxyToFastAPI(req, res, pathPart);
    });

    app.all("/orders*", (req, res) => {
      proxyToFastAPI(req, res, req.originalUrl);
    });
  }

  // API Route: Login Authentication
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;

    console.log("[Auth] Incoming login request:", { email, passwordLength: password ? password.length : 0 });

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedPassword = password.trim();

    // Standard credential validation (admin@restaurantos.ai / restaurant123 or owner@restaurantos.ai / password123)
    const isValidEmail = sanitizedEmail === "admin@restaurantos.ai" || 
                         sanitizedEmail === "owner@restaurantos.ai" || 
                         sanitizedEmail === "owner@restaurant.com";
                         
    const isValidPassword = sanitizedPassword === "restaurant123" || 
                            sanitizedPassword === "password123";

    console.log("[Auth] Validation result:", { sanitizedEmail, isValidEmail, isValidPassword });

    if (isValidEmail && isValidPassword) {
      // Create a standard base64 JWT payload token
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64");
      const payload = Buffer.from(JSON.stringify({ email: sanitizedEmail, role: "owner", exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 })).toString("base64");
      const signature = "restaurantos_ai_signature_hash";
      const token = `${header}.${payload}.${signature}`;

      console.log("[Auth] Successful login for:", sanitizedEmail);

      return res.json({
        success: true,
        token,
        user: {
          email: sanitizedEmail,
          role: "owner",
          name: "Restaurant Owner"
        },
        message: "Login Successful"
      });
    }

    console.warn("[Auth] Failed login attempt for:", sanitizedEmail);
    return res.status(401).json({ error: "Invalid email or password." });
  });

  // API Route: Get state
  app.get("/api/state", async (req, res) => {
    await syncDbStateFromPostgres();
    res.json(dbState);
  });

  // API Route: Reset state
  app.post("/api/state/reset", (req, res) => {
    dbState = createInitialState();
    res.json({ success: true, message: "Database state reset successfully", state: dbState });
  });

  // API Route: Manually update/patch state (for UI quick action support)
  app.post("/api/state/update", (req, res) => {
    const { menu, inventory, orders, customers, suppliers, finances } = req.body;
    if (menu) dbState.menu = menu;
    if (inventory) dbState.inventory = inventory;
    if (orders) dbState.orders = orders;
    if (customers) dbState.customers = customers;
    if (suppliers) dbState.suppliers = suppliers;
    if (finances) dbState.finances = finances;
    res.json(dbState);
  });

  // --- Orders Module REST API (FastAPI-aligned Node/Express implementation) ---

  // --- Orders Module REST API (PostgreSQL Supabase & Clean Architecture Backend) ---

  const ordersService = new OrdersService();

  // Helper to parse numerical ID from ORD-xxxxxx or #xxxx
  function parseOrderId(idStr: string): number {
    let sanitized = idStr;
    if (sanitized.startsWith("#")) {
      sanitized = sanitized.substring(1);
    } else if (sanitized.startsWith("ORD-")) {
      sanitized = sanitized.substring(4);
    }
    const parsed = parseInt(sanitized, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  // GET /api/customers & GET /customers - Load customers directly from PostgreSQL
  const handleGetCustomers = async (req: express.Request, res: express.Response) => {
    if (getPool()) {
      try {
        const customers = await ordersService.getCustomers();
        return res.json(customers);
      } catch (err: any) {
        console.error("PostgreSQL customers fetch failed:", err);
        return res.status(500).json({ error: err.message });
      }
    }
    res.json(dbState.customers);
  };
  app.get("/api/customers", handleGetCustomers);
  app.get("/customers", handleGetCustomers);

  // GET /api/menu & GET /menu - Load menu items directly from PostgreSQL
  const handleGetMenu = async (req: express.Request, res: express.Response) => {
    if (getPool()) {
      try {
        const menu = await ordersService.getMenuItems();
        return res.json(menu);
      } catch (err: any) {
        console.error("PostgreSQL menu fetch failed:", err);
        return res.status(500).json({ error: err.message });
      }
    }
    res.json(dbState.menu);
  };
  app.get("/api/menu", handleGetMenu);
  app.get("/menu", handleGetMenu);

  // GET /api/orders/search & GET /orders/search - Express-based FastAPI-compliant search endpoint
  const handleSearchOrders = async (req: express.Request, res: express.Response) => {
    const q = (req.query.q || req.query.search || "") as string;
    const status = (req.query.status || "All") as string;
    const sortBy = (req.query.sortBy || "timestamp") as string;
    const sortOrder = (req.query.sortOrder || "desc") as "asc" | "desc";
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const page = parseInt(req.query.page as string, 10) || 1;
    const offset = parseInt(req.query.offset as string, 10) || (page - 1) * limit;

    if (getPool()) {
      try {
        const result = await ordersService.getOrders({
          search: q,
          status,
          sortBy,
          sortOrder,
          limit,
          offset
        });
        return res.json(result);
      } catch (err: any) {
        console.error("PostgreSQL orders search failed:", err);
        return res.status(500).json({ error: err.message });
      }
    }

    // In-Memory Fallback search
    let filtered = dbState.orders.filter(o => 
      o.id.toLowerCase().includes(q.toLowerCase()) ||
      o.customerName.toLowerCase().includes(q.toLowerCase()) ||
      o.tableOrType.toLowerCase().includes(q.toLowerCase())
    );
    if (status && status !== "All") {
      filtered = filtered.filter(o => o.status === status);
    }
    const paginated = filtered.slice(offset, offset + limit);
    res.json({ orders: paginated, totalCount: filtered.length });
  };
  app.get("/api/orders/search", handleSearchOrders);
  app.get("/orders/search", handleSearchOrders);

  // GET /api/orders/stats & GET /orders/stats - Retrieve real-time PostgreSQL aggregated KPIs
  const handleGetOrdersStats = async (req: express.Request, res: express.Response) => {
    if (getPool()) {
      try {
        const stats = await ordersService.getOrdersStats();
        return res.json(stats);
      } catch (err: any) {
        console.error("PostgreSQL stats calculation failed:", err);
        return res.status(500).json({ error: err.message });
      }
    }

    // In-Memory Fallback stats calculation
    const totalOrdersCount = dbState.orders.length;
    const pendingOrdersCount = dbState.orders.filter(o => o.status === "Pending").length;
    const completedRevenue = dbState.orders
      .filter(o => o.status === "Completed")
      .reduce((sum, o) => sum + o.total, 0);
    const averageOrderValue = totalOrdersCount > 0 
      ? Math.round(dbState.orders.reduce((sum, o) => sum + o.total, 0) / totalOrdersCount) 
      : 0;

    res.json({
      todayTransactions: totalOrdersCount, // fallback approximation
      pendingQueue: pendingOrdersCount,
      completedRevenue,
      averageTicket: averageOrderValue
    });
  };
  app.get("/api/orders/stats", handleGetOrdersStats);
  app.get("/orders/stats", handleGetOrdersStats);

  // GET /api/orders & GET /orders - List, search, paginate, sort, and filter orders
  const handleGetOrders = async (req: express.Request, res: express.Response) => {
    const search = (req.query.search || req.query.q || "") as string;
    const status = (req.query.status || "All") as string;
    const orderType = req.query.orderType as string;
    const sortBy = (req.query.sortBy || "timestamp") as string;
    const sortOrder = (req.query.sortOrder || "desc") as "asc" | "desc";
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const page = parseInt(req.query.page as string, 10) || 1;
    const offset = parseInt(req.query.offset as string, 10) || (page - 1) * limit;

    if (getPool()) {
      try {
        const result = await ordersService.getOrders({
          search,
          status,
          sortBy,
          sortOrder,
          limit,
          offset
        });
        return res.json(result);
      } catch (err: any) {
        console.error("PostgreSQL orders fetch failed:", err);
        return res.status(500).json({ error: err.message });
      }
    }

    // In-Memory Fallback listing
    let filtered = [...dbState.orders];
    if (status && status !== "All") {
      filtered = filtered.filter(o => o.status === status);
    }
    if (orderType) {
      filtered = filtered.filter(o => o.tableOrType.toLowerCase() === orderType.toLowerCase() || 
                                     (orderType === "Dine In" && o.tableOrType.toLowerCase().startsWith("table")));
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(o => 
        o.id.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.tableOrType.toLowerCase().includes(q)
      );
    }

    // In-memory Sorting
    const field = sortBy || "timestamp";
    filtered.sort((a, b) => {
      let valA: any = a[field as keyof typeof a];
      let valB: any = b[field as keyof typeof b];
      if (field === "timestamp") {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    const paginated = filtered.slice(offset, offset + limit);
    res.json({
      orders: paginated,
      totalCount: filtered.length
    });
  };
  app.get("/api/orders", handleGetOrders);
  app.get("/orders", handleGetOrders);

  // GET /api/orders/:id/receipt & GET /orders/:id/receipt - REAL thermal receipt printing from backend
  const handleGetReceipt = async (req: express.Request, res: express.Response) => {
    const id = parseOrderId(req.params.id);
    if (getPool()) {
      try {
        const html = await ordersService.generateReceiptHtml(id);
        res.setHeader("Content-Type", "text/html");
        return res.send(html);
      } catch (err: any) {
        console.error("PostgreSQL thermal receipt generation failed:", err);
        return res.status(500).send(`<h3>Error generating receipt: ${err.message}</h3>`);
      }
    }

    // Offline thermal receipt fallback
    const offlineOrder = dbState.orders.find(o => parseOrderId(o.id) === id);
    if (!offlineOrder) {
      return res.status(404).send("<h3>Order not found for receipt printing</h3>");
    }
    const itemRows = offlineOrder.items.map(item => `
      <tr>
        <td style="padding: 6px 0;">${item.name} <span style="font-size: 11px; color: #555;">x${item.quantity}</span></td>
        <td style="padding: 6px 0; text-align: right;">₹${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `).join("");

    res.setHeader("Content-Type", "text/html");
    res.send(`
      <html>
        <body style="font-family: monospace; max-width: 300px; padding: 20px;">
          <h2 style="text-align: center;">SPICE HEAVEN (OFFLINE)</h2>
          <hr/>
          <p>Receipt No: ${offlineOrder.id}</p>
          <p>Customer: ${offlineOrder.customerName}</p>
          <p>Table/Type: ${offlineOrder.tableOrType}</p>
          <hr/>
          <table style="width: 100%;">${itemRows}</table>
          <hr/>
          <p style="text-align: right; font-weight: bold;">Grand Total: ₹${offlineOrder.total.toFixed(2)}</p>
          <h4 style="text-align: center;">THANK YOU!</h4>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
  };
  app.get("/api/orders/:id/receipt", handleGetReceipt);
  app.get("/orders/:id/receipt", handleGetReceipt);

  // GET /api/orders/:id & GET /orders/:id - Get single order by ID
  const handleGetOrderById = async (req: express.Request, res: express.Response) => {
    const id = parseOrderId(req.params.id);
    if (getPool()) {
      try {
        const order = await ordersService.getOrderById(id);
        if (!order) {
          return res.status(404).json({ error: `Order with ID ${req.params.id} not found in PostgreSQL` });
        }
        return res.json(order);
      } catch (err: any) {
        console.error("PostgreSQL fetch order failed:", err);
        return res.status(500).json({ error: err.message });
      }
    }

    const order = dbState.orders.find(o => o.id === req.params.id || o.id === `#${req.params.id}` || o.id === `ORD-${req.params.id}`);
    if (!order) {
      return res.status(404).json({ error: `Order with ID ${req.params.id} not found` });
    }
    res.json(order);
  };
  app.get("/api/orders/:id", handleGetOrderById);
  app.get("/orders/:id", handleGetOrderById);

  // POST /api/orders & POST /orders - Create a new order with validation
  const handleCreateOrder = async (req: express.Request, res: express.Response) => {
    const { customerName, phone, tableOrType, items, discount, status } = req.body;

    if (!customerName || customerName.trim() === "") {
      return res.status(400).json({ error: "Customer name is required" });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "An order must contain at least one item" });
    }

    // Deduct inventory quantities dynamically in in-memory state based on recipes
    items.forEach(item => {
      const qty = item.quantity;
      if (item.menuItemId === "m1") {
        const t = dbState.inventory.find(i => i.name === "Tomatoes");
        const o = dbState.inventory.find(i => i.name === "Onions");
        if (t) t.currentQty = Math.max(0, parseFloat((t.currentQty - 0.2 * qty).toFixed(2)));
        if (o) o.currentQty = Math.max(0, parseFloat((o.currentQty - 0.2 * qty).toFixed(2)));
      } else if (item.menuItemId === "m2") {
        const p = dbState.inventory.find(i => i.name === "Paneer");
        const t = dbState.inventory.find(i => i.name === "Tomatoes");
        if (p) p.currentQty = Math.max(0, parseFloat((p.currentQty - 0.2 * qty).toFixed(2)));
        if (t) t.currentQty = Math.max(0, parseFloat((t.currentQty - 0.1 * qty).toFixed(2)));
      } else if (item.menuItemId === "m3") {
        const f = dbState.inventory.find(i => i.name === "Flour/Maida");
        if (f) f.currentQty = Math.max(0, parseFloat((f.currentQty - 0.15 * qty).toFixed(2)));
      } else if (item.menuItemId === "m4") {
        const c = dbState.inventory.find(i => i.name === "Coffee Beans");
        const m = dbState.inventory.find(i => i.name === "Milk");
        if (c) c.currentQty = Math.max(0, parseFloat((c.currentQty - 0.05 * qty).toFixed(2)));
        if (m) m.currentQty = Math.max(0, parseFloat((m.currentQty - 0.1 * qty).toFixed(2)));
      } else if (item.menuItemId === "m5") {
        const m = dbState.inventory.find(i => i.name === "Milk");
        if (m) m.currentQty = Math.max(0, parseFloat((m.currentQty - 0.15 * qty).toFixed(2)));
      } else if (item.menuItemId === "m6") {
        const f = dbState.inventory.find(i => i.name === "Flour/Maida");
        const o = dbState.inventory.find(i => i.name === "Onions");
        if (f) f.currentQty = Math.max(0, parseFloat((f.currentQty - 0.1 * qty).toFixed(2)));
        if (o) o.currentQty = Math.max(0, parseFloat((o.currentQty - 0.1 * qty).toFixed(2)));
      } else if (item.menuItemId === "m7") {
        const m = dbState.inventory.find(i => i.name === "Milk");
        if (m) m.currentQty = Math.max(0, parseFloat((m.currentQty - 0.05 * qty).toFixed(2)));
      }
    });

    if (getPool()) {
      try {
        const order = await ordersService.placeOrder({
          customerName,
          phone,
          tableOrType,
          items,
          discount,
          status: status || "Pending"
        });

        // Add to finances if created directly as Completed
        if (order.status === "Completed") {
          dbState.finances.unshift({
            id: "f" + (dbState.finances.length + 1),
            timestamp: new Date().toISOString(),
            type: "Income",
            category: "Order Revenue",
            amount: order.total,
            description: `Completed Order ${order.id} for ${order.customerName}`
          });
        }

        return res.status(201).json(order);
      } catch (err: any) {
        console.error("PostgreSQL create order failed:", err);
        return res.status(500).json({ error: err.message });
      }
    }

    // In-Memory Fallback creation
    const orderItems = items.map(item => {
      const menuItem = dbState.menu.find(m => m.id === item.menuItemId)!;
      return {
        menuItemId: item.menuItemId,
        name: menuItem.name,
        quantity: item.quantity,
        price: menuItem.price
      };
    });

    const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = Math.round((subtotal * 0.05) * 100) / 100;
    const discountAmt = parseFloat(discount) || 0;
    const total = Math.max(0, Math.round((subtotal + tax - discountAmt) * 100) / 100);

    const suffix = String(dbState.orders.length + 1043).padStart(6, '0');
    const orderId = `ORD-${suffix}`;

    let customer = dbState.customers.find(c => c.name.toLowerCase() === customerName.toLowerCase() || (phone && c.phone === phone));
    if (!customer) {
      customer = {
        id: "c" + (dbState.customers.length + 1),
        name: customerName,
        phone: phone || "+91 99999 99999",
        visitCount: 1,
        totalSpent: total,
        lastOrderDate: new Date().toISOString(),
        notes: "Auto-registered via manual order creation"
      };
      dbState.customers.push(customer);
    } else {
      customer.visitCount += 1;
      customer.totalSpent += total;
      customer.lastOrderDate = new Date().toISOString();
    }

    const newOrder = {
      id: orderId,
      customerName: customer.name,
      phone: customer.phone,
      tableOrType: tableOrType || "Takeaway",
      items: orderItems,
      subtotal,
      tax,
      total,
      status: (status || "Pending") as any,
      timestamp: new Date().toISOString()
    };

    dbState.orders.unshift(newOrder);

    if (newOrder.status === "Completed") {
      dbState.finances.unshift({
        id: "f" + (dbState.finances.length + 1),
        timestamp: new Date().toISOString(),
        type: "Income",
        category: "Order Revenue",
        amount: newOrder.total,
        description: `Completed Order ${newOrder.id} for ${newOrder.customerName}`
      });
    }

    res.status(201).json(newOrder);
  };
  app.post("/api/orders", handleCreateOrder);
  app.post("/orders", handleCreateOrder);

  // PUT /api/orders/:id & PUT /orders/:id - Update order status or details
  const handleUpdateOrder = async (req: express.Request, res: express.Response) => {
    const idStr = req.params.id;
    const id = parseOrderId(idStr);
    const { status } = req.body;

    const allowed = ["Pending", "Completed", "Cancelled"];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed values are: ${allowed.join(", ")}` });
    }

    if (getPool()) {
      try {
        const orderBefore = await ordersService.getOrderById(id);
        if (!orderBefore) {
          return res.status(404).json({ error: `Order with ID ${idStr} not found in PostgreSQL` });
        }

        const updatedOrder = await ordersService.updateOrderStatus(id, status);
        if (updatedOrder && status === "Completed" && orderBefore.status !== "Completed") {
          dbState.finances.unshift({
            id: "f" + (dbState.finances.length + 1),
            timestamp: new Date().toISOString(),
            type: "Income",
            category: "Order Revenue",
            amount: updatedOrder.total,
            description: `Completed Order ${updatedOrder.id} for ${updatedOrder.customerName}`
          });
        }
        return res.json(updatedOrder);
      } catch (err: any) {
        console.error("PostgreSQL update order failed:", err);
        return res.status(500).json({ error: err.message });
      }
    }

    const order = dbState.orders.find(o => o.id === idStr || o.id === `#${idStr}` || o.id === `ORD-${idStr}`);
    if (!order) {
      return res.status(404).json({ error: `Order with ID ${idStr} not found` });
    }

    if (status) {
      const prevStatus = order.status;
      order.status = status;

      if (status === "Completed" && prevStatus !== "Completed") {
        dbState.finances.unshift({
          id: "f" + (dbState.finances.length + 1),
          timestamp: new Date().toISOString(),
          type: "Income",
          category: "Order Revenue",
          amount: order.total,
          description: `Completed Order ${order.id} for ${order.customerName}`
        });
      }
    }

    res.json(order);
  };
  app.put("/api/orders/:id", handleUpdateOrder);
  app.put("/orders/:id", handleUpdateOrder);

  // DELETE /api/orders/:id & DELETE /orders/:id - Delete an order
  const handleDeleteOrder = async (req: express.Request, res: express.Response) => {
    const idStr = req.params.id;
    const id = parseOrderId(idStr);

    if (getPool()) {
      try {
        const deleted = await ordersService.deleteOrder(id);
        if (!deleted) {
          return res.status(404).json({ error: `Order with ID ${idStr} not found in PostgreSQL` });
        }
        return res.status(204).end();
      } catch (err: any) {
        console.error("PostgreSQL delete order failed:", err);
        return res.status(500).json({ error: err.message });
      }
    }

    const initialLen = dbState.orders.length;
    dbState.orders = dbState.orders.filter(o => o.id !== idStr && o.id !== `#${idStr}` && o.id !== `ORD-${idStr}`);
    
    if (dbState.orders.length === initialLen) {
      return res.status(404).json({ error: `Order with ID ${idStr} not found` });
    }

    res.status(204).end();
  };
  app.delete("/api/orders/:id", handleDeleteOrder);
  app.delete("/orders/:id", handleDeleteOrder);

  // Helper to sync any in-memory state updates from the AI agents back to PostgreSQL
  async function syncInMemoryStateToPostgres(oldState: RestaurantState, newState: RestaurantState) {
    if (!getPool()) return;
    try {
      const { OrdersRepository } = await import("./src/lib/ordersRepository.js");
      const repository = new OrdersRepository();

      // 1. Sync inventory quantity changes
      for (const newItem of newState.inventory) {
        const oldItem = oldState.inventory.find(i => i.id === newItem.id);
        if (!oldItem || oldItem.currentQty !== newItem.currentQty) {
          console.log(`[Sync] Updating inventory item "${newItem.name}" to qty: ${newItem.currentQty}`);
          await repository.updateInventoryItemQty(newItem.id, newItem.currentQty);
        }
      }

      // 2. Sync supplier pending payments changes
      for (const newSup of newState.suppliers) {
        const oldSup = oldState.suppliers.find(s => s.id === newSup.id);
        if (!oldSup || oldSup.pendingPayments !== newSup.pendingPayments) {
          console.log(`[Sync] Updating supplier "${newSup.companyName}" balance to: ${newSup.pendingPayments}`);
          await repository.updateSupplierPendingPayment(newSup.id, newSup.pendingPayments);
        }
      }

      // 3. Sync new financial entries
      if (newState.finances.length > oldState.finances.length) {
        const diffCount = newState.finances.length - oldState.finances.length;
        const newFinEntries = newState.finances.slice(0, diffCount);
        for (const entry of newFinEntries) {
          console.log(`[Sync] Saving new financial log to PostgreSQL: "${entry.description}"`);
          await repository.createFinanceEntry({
            type: entry.type,
            category: entry.category,
            amount: entry.amount,
            description: entry.description
          });
        }
      }

      // 4. Check if a new order was created
      if (newState.orders.length > oldState.orders.length) {
        const diffCount = newState.orders.length - oldState.orders.length;
        const newOrdersInState = newState.orders.slice(0, diffCount);

        for (const order of newOrdersInState) {
          // Check if order already exists in PG (avoid duplication)
          const cleanIdStr = order.id.replace("ORD-", "");
          const parsedId = parseInt(cleanIdStr, 10);
          const existing = isNaN(parsedId) ? null : await ordersService.getOrderById(parsedId);
          
          if (!existing) {
            console.log(`[Sync] Saving new agent-created order to PostgreSQL: ${order.id}`);
            const itemsPayload = order.items.map(i => ({
              menuItemId: i.menuItemId,
              quantity: i.quantity
            }));
            await ordersService.placeOrder({
              customerName: order.customerName,
              phone: order.phone || "+91 99999 99999",
              tableOrType: order.tableOrType,
              items: itemsPayload,
              status: order.status
            });
          }
        }
      }
    } catch (err) {
      console.error("[Sync Error] Failed to persist agent actions to PostgreSQL:", err);
    }
  }

  // API Route: Chat with RestaurantOS AI Agent
  app.post("/api/chat", async (req, res) => {
    const { message, history } = req.body;
    
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "") {
      // Use local rule-based smart fallback system if no API key is configured
      console.log("No Gemini API Key found. Using intelligent rule-based local agent.");
      const response = handleLocalAgent(message, dbState);
      
      const stateBefore = JSON.parse(JSON.stringify(dbState));
      dbState = response.updatedState || dbState;
      if (response.updatedState) {
        await syncInMemoryStateToPostgres(stateBefore, dbState);
      }
      return res.json(response);
    }

    try {
      // Sync from database first to make sure state is absolutely up to date before running the agent
      await syncDbStateFromPostgres();
      const stateBefore = JSON.parse(JSON.stringify(dbState));

      // Execute Multi-Agent Routing and Specialist handling
      const response = await runMultiAgentSystem(apiKey, message, history, dbState);

      if (response.updatedState) {
        dbState = response.updatedState;
        // Persist all updates safely into PostgreSQL
        await syncInMemoryStateToPostgres(stateBefore, dbState);
      }

      res.json({
        reply: response.reply,
        updatedState: dbState,
        actionDetails: response.actionDetails
      });

    } catch (err: any) {
      console.error("Gemini Multi-Agent System Error:", err);
      // Fallback to local agent in case of network or key failure
      const response = handleLocalAgent(message, dbState);
      const stateBefore = JSON.parse(JSON.stringify(dbState));
      dbState = response.updatedState || dbState;
      if (response.updatedState) {
        await syncInMemoryStateToPostgres(stateBefore, dbState);
      }
      res.json({
        reply: `*(Fallback active due to API issues)*\n\n${response.reply}`,
        updatedState: dbState
      });
    }
  });

  // Local rule-based processing engine
  function handleLocalAgent(message: string, currentState: RestaurantState): ChatResponse {
    const msg = message.toLowerCase();
    const updated = JSON.parse(JSON.stringify(currentState)) as RestaurantState;

    // 1. Create order
    if (msg.includes("create") && (msg.includes("order") || msg.includes("dosa") || msg.includes("coffee") || msg.includes("rahul"))) {
      // Create a mock order for Rahul
      const orderId = `#10${updated.orders.length + 40}`;
      
      // Verify Rahul
      let customer = updated.customers.find(c => c.name.toLowerCase() === "rahul");
      if (!customer) {
        customer = {
          id: "c" + (updated.customers.length + 1),
          name: "Rahul",
          phone: "+91 98765 43210",
          visitCount: 1,
          totalSpent: 0,
          lastOrderDate: new Date().toISOString(),
          notes: "Regular"
        };
        updated.customers.push(customer);
      }

      // Check items
      const items = [
        { menuItemId: "m1", name: "Masala Dosa", quantity: 2, price: 120 },
        { menuItemId: "m4", name: "Filter Coffee", quantity: 1, price: 30 }
      ];

      const subtotal = 270;
      const tax = 13.5;
      const total = 283.5;

      const newOrder = {
        id: orderId,
        customerName: customer.name,
        phone: customer.phone,
        tableOrType: "Table 4",
        items,
        subtotal,
        tax,
        total,
        status: "Completed" as const,
        timestamp: new Date().toISOString()
      };

      updated.orders.unshift(newOrder);

      // Deduct inventory
      const tomatoes = updated.inventory.find(i => i.name === "Tomatoes");
      const onions = updated.inventory.find(i => i.name === "Onions");
      const coffee = updated.inventory.find(i => i.name === "Coffee Beans");
      
      if (tomatoes) tomatoes.currentQty = Math.max(0, tomatoes.currentQty - 0.4);
      if (onions) onions.currentQty = Math.max(0, onions.currentQty - 0.3);
      if (coffee) coffee.currentQty = Math.max(0, coffee.currentQty - 0.1);

      // Update customer stats
      customer.visitCount += 1;
      customer.totalSpent += total;
      customer.lastOrderDate = newOrder.timestamp;

      // Add income finance entry
      updated.finances.unshift({
        id: "f" + (updated.finances.length + 1),
        timestamp: newOrder.timestamp,
        type: "Income",
        category: "Order Revenue",
        amount: total,
        description: `Order ${orderId} for Rahul`
      });

      const reply = `✔ **Customer Found:** Rahul (+91 98765 43210)  
✔ **Menu Items Found:** Masala Dosa, Filter Coffee  
✔ **Inventory Available & Verified**  
✔ **Order ${orderId} Created Successfully**  

| Item | Qty | Price | Total |
| :--- | :---: | :---: | :---: |
| Masala Dosa | 2 | ₹120 | ₹240 |
| Filter Coffee | 1 | ₹30 | ₹30 |
| **Subtotal** | | | **₹270** |
| **Tax (5%)** | | | **₹13.5** |
| **Grand Total** | | | **₹283.5** |

- 🥬 **Inventory Updated:** Tomatoes (-0.4 kg), Onions (-0.3 kg), Coffee Beans (-0.1 kg).
- 💰 **Revenue Updated:** Added ₹283.50 to daily sales.
  
*Order is marked as Active on Table 4.* Anything else I can do for you?`;

      return { reply, updatedState: updated };
    }

    // 2. Show low stock
    if (msg.includes("low") || msg.includes("stock") || msg.includes("inventory")) {
      const lowStockItems = updated.inventory.filter(i => i.currentQty <= i.reorderLevel);
      
      let reply = `### ⚠ Low Stock Items Identified\n\n`;
      reply += `Our system has detected **${lowStockItems.length} items** below their reorder safety thresholds. Here is the operational summary:\n\n`;
      
      reply += `| Item | Stock level | Reorder Point | Supplier | Unit Price | Action |\n`;
      reply += `| :--- | :---: | :---: | :---: | :---: | :--- |\n`;
      
      lowStockItems.forEach(item => {
        const sup = updated.suppliers.find(s => s.id === item.supplierId);
        reply += `| **${item.name}** | <span class="text-rose-500 font-semibold">${item.currentQty} ${item.unit}</span> | ${item.reorderLevel} ${item.unit} | ${sup ? sup.companyName : "Unknown"} | ₹${item.unitPrice} | 🚚 [Draft Purchase Order](#) |\n`;
      });

      reply += `\nWould you like me to automatically draft and send purchase orders to **Fresh Farms** and **Dairy Craft** to restock these items?`;
      
      return { reply };
    }

    // 3. Show profit
    if (msg.includes("profit") || msg.includes("today") || msg.includes("revenue") || msg.includes("summary") || msg.includes("sales")) {
      const totalOrders = updated.orders.length;
      const salesSum = updated.orders.reduce((acc, o) => acc + o.total, 0);
      const expensesSum = updated.finances.filter(f => f.type === "Expense").reduce((acc, f) => acc + f.amount, 0);
      const netProfit = salesSum - expensesSum;

      const reply = `### Today's Business Summary
Below is the live operational summary for **Spice Heaven** as of today:

| Metric | Value | Status |
| :--- | :--- | :--- |
| 💰 **Total Revenue** | **₹${salesSum.toLocaleString()}** | <span class="text-emerald-600 font-semibold">▲ Strong</span> |
| 💸 **Total Expenses** | **₹${expensesSum.toLocaleString()}** | Normal |
| 📈 **Net Profit** | **₹${netProfit.toLocaleString()}** | <span class="text-emerald-600 font-semibold">Margin ~${Math.round((netProfit / (salesSum || 1)) * 100)}%</span> |
| 📦 **Completed Orders** | **${totalOrders}** | Avg. ticket ₹${Math.round(salesSum / (totalOrders || 1))} |

- *Most popular item:* **Masala Dosa** (5★)
- *Staff recommendation:* Tomatoes, Onions, and Paneer stock are currently low. Purchasing supplies is recommended.

Would you like to run a detailed analysis on any specific segment?`;

      return { reply };
    }

    // 4. Pay Supplier / Settle
    if (msg.includes("pay") || msg.includes("settle") || msg.includes("supplier")) {
      let supplierToPay = updated.suppliers.find(s => msg.includes(s.companyName.toLowerCase()) || msg.includes("dairy") || msg.includes("farms"));
      
      if (!supplierToPay) {
        // Default to Dairy Craft for demonstration
        supplierToPay = updated.suppliers.find(s => s.companyName === "Dairy Craft");
      }

      if (supplierToPay && supplierToPay.pendingPayments > 0) {
        const amount = supplierToPay.pendingPayments;
        supplierToPay.pendingPayments = 0;

        // Log Finance Expense
        updated.finances.unshift({
          id: "f" + (updated.finances.length + 1),
          timestamp: new Date().toISOString(),
          type: "Expense",
          category: "Supplier Payment",
          amount: amount,
          description: `Settle outstanding balance with ${supplierToPay.companyName}`
        });

        const reply = `✔ **Supplier Found:** ${supplierToPay.companyName}  
✔ **Payment Cleared:** ₹${amount.toLocaleString()}  
✔ **Financial Ledger Updated Successfully**  

- **Supplier Balance:** Updated from ₹${amount.toLocaleString()} to **₹0**.
- **Financial Log:** Logged ₹${amount.toLocaleString()} expense under *Supplier Payment*.
- **Cash Flow impact:** Deducted ₹${amount.toLocaleString()} from working capital.

*Payment invoice confirmation generated and sent to contact ${supplierToPay.contactPerson} (${supplierToPay.phone}).* Let me know if there's any other supplier payout to clear!`;

        return { reply, updatedState: updated };
      } else {
        const reply = `I checked the suppliers list. All pending accounts with **Dairy Craft** and **Kapi Co.** are currently clear (Balance: ₹0). 

Is there another supplier or an unlisted payment you'd like me to log?`;
        return { reply };
      }
    }

    // Default general response
    const reply = `Hello! I'm your **RestaurantOS AI Agent** 🤖.

I can help you manage your restaurant operations seamlessly using natural language. Try typing any of these instructions:

1. ➕ **Create a new order** (e.g. *"Create an order for Rahul. 2 Masala Dosa, 1 Filter Coffee"*)
2. 🥬 **Check stock levels** (e.g. *"Show low stock items"*)
3. 💰 **Review finances** (e.g. *"Show today's sales summary and profit"*)
4. 🚚 **Settle suppliers** (e.g. *"Settle balance with Dairy Craft"* or *"Show supplier pending payments"*)

Just describe what you need, and I'll update the menus, orders, customers, and accounting logs automatically!`;

    return { reply };
  }

  // Vite Integration
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
