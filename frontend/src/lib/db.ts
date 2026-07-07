import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let isInitialized = false;

// Default initial menu items for Spice Heaven
const defaultMenuItems = [
  { id: "m1", name: "Masala Dosa", category: "Main Course", price: 120, cost: 40, status: "Available", popularity: 5 },
  { id: "m2", name: "Paneer Butter Masala", category: "Main Course", price: 220, cost: 80, status: "Available", popularity: 4 },
  { id: "m3", name: "Garlic Naan", category: "Main Course", price: 40, cost: 12, status: "Available", popularity: 4 },
  { id: "m4", name: "Filter Coffee", category: "Beverage", price: 30, cost: 8, status: "Available", popularity: 5 },
  { id: "m5", name: "Mango Lassi", category: "Beverage", price: 80, cost: 25, status: "Available", popularity: 4 },
  { id: "m6", name: "Samosa (2 Pcs)", category: "Appetizer", price: 50, cost: 15, status: "Available", popularity: 4 },
  { id: "m7", name: "Gulab Jamun (2 Pcs)", category: "Dessert", price: 60, cost: 18, status: "Available", popularity: 5 }
];

// Default initial customers for Spice Heaven
const defaultCustomers = [
  { name: "Rahul", phone: "+91 98765 43210", visitCount: 12, totalSpent: 2450, notes: "Regular. Likes Filter Coffee strong and sweet." },
  { name: "Priya", phone: "+91 91234 56789", visitCount: 8, totalSpent: 1920, notes: "Prefers mild options, fan of paneer." },
  { name: "Amit", phone: "+91 99887 76655", visitCount: 3, totalSpent: 450, notes: "Prefers table near the window." },
  { name: "Sneha", phone: "+91 97777 88888", visitCount: 20, totalSpent: 5200, notes: "VVIP customer. Prefers organic ingredients." }
];

export function getPool(): pg.Pool | null {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("⚠️ DATABASE_URL environment variable is not defined. The app will run in offline demo fallback mode.");
    return null;
  }

  // Validate that connectionString is a valid postgres connection string format
  if (!connectionString.startsWith("postgresql://") && !connectionString.startsWith("postgres://")) {
    console.warn(`⚠️ DATABASE_URL is not a valid PostgreSQL connection string format (received: "${connectionString}"). The app will run in offline demo fallback mode.`);
    return null;
  }

  try {
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes("supabase") || connectionString.includes("localhost") ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on("error", (err) => {
      console.error("PostgreSQL Pool error:", err);
    });

    return pool;
  } catch (err) {
    console.error("Failed to initialize PostgreSQL connection pool:", err);
    return null;
  }
}

export async function query(text: string, params?: any[]) {
  const p = getPool();
  if (!p) {
    throw new Error("DATABASE_URL environment variable is required to run database queries.");
  }
  return p.query(text, params);
}

export async function bootstrapDatabase() {
  if (isInitialized) return;
  const p = getPool();
  if (!p) return;

  try {
    console.log("Checking and bootstrapping database tables in PostgreSQL...");

    // 1. Create Customers Table
    await p.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) UNIQUE,
        visit_count INT DEFAULT 0,
        total_spent DECIMAL(12, 2) DEFAULT 0.0,
        last_order_date TIMESTAMP,
        notes TEXT
      );
    `);

    // 2. Create Menu Items Table
    await p.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        cost DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'Available',
        popularity INT DEFAULT 3
      );
    `);

    // 3. Create Suppliers Table
    await p.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id VARCHAR(50) PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        contact_person VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        items_supplied JSON DEFAULT '[]'::json,
        pending_payments DECIMAL(12, 2) DEFAULT 0.0
      );
    `);

    // 4. Create Inventory Table
    await p.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        current_qty DECIMAL(12, 2) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        reorder_level DECIMAL(12, 2) NOT NULL,
        supplier_id VARCHAR(50) REFERENCES suppliers(id) ON DELETE SET NULL,
        unit_price DECIMAL(12, 2) NOT NULL
      );
    `);

    // 5. Create Orders Table
    await p.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
        customer_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        table_or_type VARCHAR(100) NOT NULL,
        subtotal DECIMAL(10, 2) NOT NULL,
        tax DECIMAL(10, 2) NOT NULL,
        total DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Create Order Items Table
    await p.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INT REFERENCES orders(id) ON DELETE CASCADE,
        menu_item_id VARCHAR(50) REFERENCES menu_items(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(10, 2) NOT NULL
      );
    `);

    // 7. Create Finances Table
    await p.query(`
      CREATE TABLE IF NOT EXISTS finances (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        type VARCHAR(50) NOT NULL,
        category VARCHAR(100) NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        description TEXT NOT NULL
      );
    `);

    // --- Seeding Section ---

    // Seed Menu Items if empty
    const menuCount = await p.query("SELECT COUNT(*) FROM menu_items");
    if (parseInt(menuCount.rows[0].count, 10) === 0) {
      console.log("Seeding initial menu items into PostgreSQL...");
      for (const item of defaultMenuItems) {
        await p.query(`
          INSERT INTO menu_items (id, name, category, price, cost, status, popularity)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [item.id, item.name, item.category, item.price, item.cost, item.status, item.popularity]);
      }
    }

    // Seed Customers if empty
    const customerCount = await p.query("SELECT COUNT(*) FROM customers");
    if (parseInt(customerCount.rows[0].count, 10) === 0) {
      console.log("Seeding initial CRM customers into PostgreSQL...");
      for (const c of defaultCustomers) {
        await p.query(`
          INSERT INTO customers (name, phone, visit_count, total_spent, last_order_date, notes)
          VALUES ($1, $2, $3, $4, NOW(), $5)
        `, [c.name, c.phone, c.visitCount, c.totalSpent, c.notes]);
      }
    }

    // Seed Suppliers if empty
    const supplierCount = await p.query("SELECT COUNT(*) FROM suppliers");
    if (parseInt(supplierCount.rows[0].count, 10) === 0) {
      console.log("Seeding initial suppliers into PostgreSQL...");
      const defaultSuppliers = [
        { id: "s1", companyName: "Dairy Craft", contactPerson: "Rajesh Kumar", phone: "+91 98888 77777", itemsSupplied: ["Paneer", "Milk", "Cheese"], pendingPayments: 2800.00 },
        { id: "s2", companyName: "Fresh Farms", contactPerson: "Anil Sharma", phone: "+91 97777 66666", itemsSupplied: ["Tomatoes", "Onions", "Potatoes", "Flour/Maida"], pendingPayments: 1500.00 },
        { id: "s3", companyName: "Kapi Co.", contactPerson: "Srinivas Rao", phone: "+91 96666 55555", itemsSupplied: ["Coffee Beans", "Tea Powder"], pendingPayments: 0.00 }
      ];
      for (const s of defaultSuppliers) {
        await p.query(`
          INSERT INTO suppliers (id, company_name, contact_person, phone, items_supplied, pending_payments)
          VALUES ($1, $2, $3, $4, $5::json, $6)
        `, [s.id, s.companyName, s.contactPerson, s.phone, JSON.stringify(s.itemsSupplied), s.pendingPayments]);
      }
    }

    // Seed Inventory if empty
    const inventoryCount = await p.query("SELECT COUNT(*) FROM inventory");
    if (parseInt(inventoryCount.rows[0].count, 10) === 0) {
      console.log("Seeding initial inventory items into PostgreSQL...");
      const defaultInventory = [
        { id: "i1", name: "Tomatoes", currentQty: 12.5, unit: "kg", reorderLevel: 5.0, supplierId: "s2", unitPrice: 40 },
        { id: "i2", name: "Onions", currentQty: 18.0, unit: "kg", reorderLevel: 6.0, supplierId: "s2", unitPrice: 30 },
        { id: "i3", name: "Paneer", currentQty: 4.2, unit: "kg", reorderLevel: 2.0, supplierId: "s1", unitPrice: 350 },
        { id: "i4", name: "Milk", currentQty: 15.0, unit: "L", reorderLevel: 5.0, supplierId: "s1", unitPrice: 60 },
        { id: "i5", name: "Flour/Maida", currentQty: 25.0, unit: "kg", reorderLevel: 10.0, supplierId: "s2", unitPrice: 45 },
        { id: "i6", name: "Coffee Beans", currentQty: 3.5, unit: "kg", reorderLevel: 1.5, supplierId: "s3", unitPrice: 800 }
      ];
      for (const i of defaultInventory) {
        await p.query(`
          INSERT INTO inventory (id, name, current_qty, unit, reorder_level, supplier_id, unit_price)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [i.id, i.name, i.currentQty, i.unit, i.reorderLevel, i.supplierId, i.unitPrice]);
      }
    }

    // Seed Finances if empty (add some rent/salaries history)
    const financesCount = await p.query("SELECT COUNT(*) FROM finances");
    if (parseInt(financesCount.rows[0].count, 10) === 0) {
      console.log("Seeding initial financial history into PostgreSQL...");
      const defaultFinances = [
        { type: "Expense", category: "Rent", amount: 12000.00, description: "Monthly restaurant space rent" },
        { type: "Expense", category: "Salaries", amount: 8500.00, description: "Part-time kitchen staff salaries" },
        { type: "Expense", category: "Utilities", amount: 2350.00, description: "Electricity and water bills" }
      ];
      for (const f of defaultFinances) {
        await p.query(`
          INSERT INTO finances (type, category, amount, description, created_at)
          VALUES ($1, $2, $3, $4, NOW() - INTERVAL '3 days')
        `, [f.type, f.category, f.amount, f.description]);
      }
    }

    console.log("Database table bootstrapping and seeding complete!");
    isInitialized = true;
  } catch (err) {
    console.error("Error bootstrapping database tables:", err);
  }
}
