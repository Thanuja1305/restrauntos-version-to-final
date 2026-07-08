import React, { useState, useEffect } from "react";
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Eye, 
  Printer, 
  Award,
  TrendingUp,
  Receipt,
  Tag
} from "lucide-react";
import { Order, MenuItem, Customer, InventoryItem, RestaurantState } from "../types";

interface SalesViewProps {
  orders: Order[];
  menu: MenuItem[];
  customers: Customer[];
  inventory: InventoryItem[];
  onUpdateState: (state: RestaurantState) => void;
  onUpdateOrders: (orders: Order[]) => void;
  onAddLog: (type: "Income" | "Expense", category: any, amount: number, description: string) => void;
  setActiveTab?: (tab: string) => void;
}

export default function SalesView({ 
  orders, 
  menu, 
  customers, 
  inventory, 
  onUpdateState, 
  onUpdateOrders, 
  onAddLog,
  setActiveTab
}: SalesViewProps) {
  // Navigation & Filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Pending" | "Completed" | "Cancelled">("All");
  const [sortBy, setSortBy] = useState<"timestamp" | "total" | "customerName">("timestamp");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Selected order details (Invoices)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [simulatedPrintProgress, setSimulatedPrintProgress] = useState<number | null>(null);

  // Create Order Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || "");
  const [customCustomerName, setCustomCustomerName] = useState("");
  const [customCustomerPhone, setCustomCustomerPhone] = useState("");
  const [orderType, setOrderType] = useState("Table 1");
  const [addedItems, setAddedItems] = useState<{ menuItemId: string; name: string; price: number; quantity: number }[]>([]);
  const [currentMenuItemId, setCurrentMenuItemId] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState(1);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [modalOrderStatus, setModalOrderStatus] = useState<"Pending" | "Completed">("Completed");

  // Sync default customer when customers array changes
  useEffect(() => {
    if (customers.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, selectedCustomerId]);

  // Set default selected menu item
  useEffect(() => {
    if (menu.length > 0 && !currentMenuItemId) {
      setCurrentMenuItemId(menu[0].id);
    }
  }, [menu, currentMenuItemId]);

  // KPIs
  const [stats, setStats] = useState({
    todayTransactions: 0,
    pendingQueue: 0,
    completedRevenue: 0,
    averageTicket: 0
  });

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/state");
      if (res.ok) {
        const freshState = await res.json();
        const oList = freshState.orders as Order[];
        
        const today = new Date().toDateString();
        const todayOrders = oList.filter(o => new Date(o.timestamp).toDateString() === today);
        const pending = oList.filter(o => o.status === "Pending");
        const completed = oList.filter(o => o.status === "Completed");
        const revenue = completed.reduce((acc, o) => acc + o.total, 0);
        const avg = oList.length > 0 ? Math.round((oList.reduce((acc, o) => acc + o.total, 0) / oList.length) * 100) / 100 : 0;

        setStats({
          todayTransactions: todayOrders.length,
          pendingQueue: pending.length,
          completedRevenue: revenue,
          averageTicket: avg
        });
      }
    } catch (err) {
      console.error("Failed to compute database statistics:", err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [orders]);

  const handlePrintReceipt = () => {
    setSimulatedPrintProgress(0);
    const interval = setInterval(() => {
      setSimulatedPrintProgress(prev => {
        if (prev === null || prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setSimulatedPrintProgress(null);
            alert("📠 Receipt printed successfully via thermal POS dispatcher!");
          }, 400);
          return 100;
        }
        return prev + 25;
      });
    }, 150);
  };

  const handleToggleStatus = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    let nextStatus: "Pending" | "Completed" | "Cancelled" = "Pending";
    if (order.status === "Pending") {
      nextStatus = "Completed";
    } else if (order.status === "Completed") {
      nextStatus = "Cancelled";
    } else {
      nextStatus = "Pending";
    }

    try {
      const response = await fetch(`/api/orders/${orderId.replace("ORD-", "")}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });

      if (response.ok) {
        const updatedOrder = await response.json();
        
        // Update local list
        const updatedOrdersList = orders.map(o => o.id === orderId ? updatedOrder : o);
        onUpdateOrders(updatedOrdersList);

        // Fetch refreshed state
        const stateRes = await fetch("/api/state");
        if (stateRes.ok) {
          const freshState = await stateRes.json();
          onUpdateState(freshState);
        }

        if (selectedOrder?.id === orderId) {
          setSelectedOrder(updatedOrder);
        }
      }
    } catch (err) {
      console.error("Error updating order status:", err);
    }
  };

  // Recipe requirements calculation matched to backend recipes
  const getRecipeRequirement = (menuItemId: string, qty: number) => {
    const requirements: { name: string; qtyNeeded: number }[] = [];
    if (menuItemId === "m1") { // Masala Dosa
      requirements.push({ name: "Tomatoes", qtyNeeded: 0.2 * qty });
      requirements.push({ name: "Onions", qtyNeeded: 0.2 * qty });
    } else if (menuItemId === "m2") { // Paneer Butter Masala
      requirements.push({ name: "Paneer", qtyNeeded: 0.2 * qty });
      requirements.push({ name: "Tomatoes", qtyNeeded: 0.1 * qty });
    } else if (menuItemId === "m3") { // Garlic Naan
      requirements.push({ name: "Flour/Maida", qtyNeeded: 0.15 * qty });
    } else if (menuItemId === "m4") { // Filter Coffee
      requirements.push({ name: "Coffee Beans", qtyNeeded: 0.05 * qty });
      requirements.push({ name: "Milk", qtyNeeded: 0.1 * qty });
    } else if (menuItemId === "m5") { // Mango Lassi
      requirements.push({ name: "Milk", qtyNeeded: 0.15 * qty });
    } else if (menuItemId === "m6") { // Samosa
      requirements.push({ name: "Flour/Maida", qtyNeeded: 0.1 * qty });
      requirements.push({ name: "Onions", qtyNeeded: 0.1 * qty });
    } else if (menuItemId === "m7") { // Gulab Jamun
      requirements.push({ name: "Milk", qtyNeeded: 0.05 * qty });
    }
    return requirements;
  };

  // Check inventory limits before adding draft items
  const checkStockStatus = (menuItemId: string, qty: number) => {
    const reqs = getRecipeRequirement(menuItemId, qty);
    
    // Sum already-added portions
    const alreadyDrawn: Record<string, number> = {};
    addedItems.forEach(item => {
      const itemReqs = getRecipeRequirement(item.menuItemId, item.quantity);
      itemReqs.forEach(r => {
        alreadyDrawn[r.name] = (alreadyDrawn[r.name] || 0) + r.qtyNeeded;
      });
    });

    for (const req of reqs) {
      const invItem = inventory.find(i => i.name.toLowerCase() === req.name.toLowerCase());
      if (invItem) {
        const totalNeeded = req.qtyNeeded + (alreadyDrawn[invItem.name] || 0);
        if (invItem.currentQty < totalNeeded) {
          const remainingAvailable = Math.max(0, invItem.currentQty - (alreadyDrawn[invItem.name] || 0));
          const unitIngredientPerDish = req.qtyNeeded / qty;
          const maxPossible = Math.floor(remainingAvailable / unitIngredientPerDish);

          return {
            ok: false,
            ingredient: invItem.name,
            available: invItem.currentQty,
            deficit: totalNeeded - invItem.currentQty,
            maxPossible,
            unit: invItem.unit
          };
        }
      }
    }
    return { ok: true };
  };

  const handleAddItemToDraft = () => {
    if (!currentMenuItemId) {
      alert("Please select a menu item.");
      return;
    }
    if (currentQuantity <= 0) {
      alert("Quantity must be greater than 0.");
      return;
    }

    const menuItem = menu.find(m => m.id === currentMenuItemId);
    if (!menuItem) return;

    const stockStatus = checkStockStatus(currentMenuItemId, currentQuantity);
    if (!stockStatus.ok) {
      const proceed = window.confirm(
        `⚠️ STOCK SHORTAGE WARNING!\n\nAdding ${currentQuantity}x "${menuItem.name}" requires ${(stockStatus.deficit ?? 0).toFixed(2)} ${stockStatus.unit ?? ""} more "${stockStatus.ingredient ?? ""}" than what's available in ingredients stock.\n\nOnly ~${stockStatus.maxPossible ?? 0} portions can be cooked safely.\n\nDo you want to authorize this order anyway?`
      );
      if (!proceed) return;
    }

    const existingIdx = addedItems.findIndex(i => i.menuItemId === currentMenuItemId);
    if (existingIdx > -1) {
      const updated = [...addedItems];
      updated[existingIdx].quantity += currentQuantity;
      setAddedItems(updated);
    } else {
      setAddedItems([...addedItems, { 
        menuItemId: currentMenuItemId, 
        name: menuItem.name, 
        price: menuItem.price, 
        quantity: currentQuantity 
      }]);
    }

    setCurrentQuantity(1);
  };

  const handleRemoveItemFromDraft = (menuItemId: string) => {
    setAddedItems(addedItems.filter(i => i.menuItemId !== menuItemId));
  };

  const computedDraftTotals = () => {
    let subtotal = 0;
    addedItems.forEach(item => {
      subtotal += item.price * item.quantity;
    });
    const tax = subtotal * 0.05; // 5% GST
    const total = Math.max(0, (subtotal + tax) - discountAmount);
    return { subtotal, tax, total };
  };

  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let customerName = "";
    let customerPhone = "";

    if (isNewCustomer) {
      customerName = customCustomerName.trim();
      customerPhone = customCustomerPhone.trim();
      if (!customerName) {
        alert("Please enter customer name.");
        return;
      }
    } else {
      const matched = customers.find(c => c.id === selectedCustomerId);
      if (!matched) {
        alert("Please select a customer.");
        return;
      }
      customerName = matched.name;
      customerPhone = matched.phone;
    }

    if (addedItems.length === 0) {
      alert("An order must contain at least one menu item.");
      return;
    }

    const payload = {
      customerName,
      phone: customerPhone || "+91 99999 99999",
      tableOrType: orderType,
      items: addedItems,
      discount: discountAmount,
      status: modalOrderStatus
    };

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(`Error creating order: ${errData.error || "Please try again"}`);
        return;
      }

      const createdOrder = await res.json();
      setSelectedOrder(createdOrder);

      const stateRes = await fetch("/api/state");
      if (stateRes.ok) {
        const freshState = await stateRes.json();
        onUpdateState(freshState);
      }

      // Close modal & reset fields
      setIsModalOpen(false);
      setSelectedCustomerId(customers[0]?.id || "");
      setCustomCustomerName("");
      setCustomCustomerPhone("");
      setAddedItems([]);
      setDiscountAmount(0);
      setIsNewCustomer(false);
      setModalOrderStatus("Completed");
    } catch (err) {
      console.error("Failed to create order:", err);
      alert("Network error creating order.");
    }
  };

  // Filter & sort orders list
  const filteredOrders = orders.filter(o => {
    const matchesStatus = statusFilter === "All" || o.status === statusFilter;
    const cleanQuery = searchQuery.toLowerCase();
    const matchesSearch = 
      o.id.toLowerCase().includes(cleanQuery) ||
      o.customerName.toLowerCase().includes(cleanQuery) ||
      o.tableOrType.toLowerCase().includes(cleanQuery);
    return matchesStatus && matchesSearch;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];

    if (sortBy === "timestamp") {
      valA = new Date(valA).getTime();
      valB = new Date(valB).getTime();
    }

    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  // Paginate orders
  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);
  const paginatedOrders = sortedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const selectedCustomerRecord = customers.find(c => c.id === selectedCustomerId);
  const { subtotal: draftSubtotal, tax: draftTax, total: draftTotal } = computedDraftTotals();

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAFAF8] p-6 overflow-y-auto font-sans select-none animate-fade-in">
      
      {/* Top Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#062C1A] tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#16A34A]" />
            <span>Sales, Billing & Invoicing Ledger</span>
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">Track customer orders, bill grand totals, reconcile invoices, and review printing formats directly from PostgreSQL.</p>
        </div>
        
        <button
          onClick={() => {
            setIsModalOpen(true);
            if (menu.length > 0) setCurrentMenuItemId(menu[0].id);
          }}
          className="bg-[#16A34A] hover:bg-[#117534] text-white font-extrabold text-xs px-4.5 py-2.5 rounded-[12px] flex items-center gap-1.5 shadow-sm shadow-emerald-600/15 transition-all cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Sales Billing</span>
        </button>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-zinc-200/60 p-4.5 rounded-[18px] shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Today's Transactions</span>
            <span className="text-xl font-black text-zinc-950 block mt-1">{stats.todayTransactions}</span>
          </div>
          <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-600">
            <Receipt className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-zinc-200/60 p-4.5 rounded-[18px] shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Active Pending Queue</span>
            <span className={`text-xl font-black block mt-1 ${stats.pendingQueue > 0 ? "text-amber-600" : "text-zinc-950"}`}>{stats.pendingQueue}</span>
          </div>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${stats.pendingQueue > 0 ? "bg-amber-50 text-amber-600" : "bg-zinc-100 text-zinc-600"}`}>
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-zinc-200/60 p-4.5 rounded-[18px] shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Completed Revenue</span>
            <span className="text-xl font-black text-[#16A34A] block mt-1">₹{stats.completedRevenue.toLocaleString()}</span>
          </div>
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-[#16A34A]">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-zinc-200/60 p-4.5 rounded-[18px] shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Avg Ticket value</span>
            <span className="text-xl font-black text-zinc-950 block mt-1">₹{stats.averageTicket.toLocaleString()}</span>
          </div>
          <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-600">
            <Tag className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Ledger Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white border border-zinc-200/60 p-3.5 rounded-[18px] mb-5 shadow-2xs">
        
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search invoice ID, customer, table..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#FAFAF8] border border-zinc-200 pl-9 pr-4 py-1.5 rounded-[12px] text-xs font-medium text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-[#16A34A] transition-colors"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-[12px] border border-zinc-200/50">
          {(["All", "Pending", "Completed", "Cancelled"] as const).map(mode => {
            const count = mode === "All" ? orders.length : orders.filter(o => o.status === mode).length;
            return (
              <button
                key={mode}
                onClick={() => {
                  setStatusFilter(mode);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-[10px] text-xs font-bold transition-all flex items-center gap-1 ${
                  statusFilter === mode 
                    ? "bg-[#062C1A] text-white shadow-2xs" 
                    : "text-zinc-500 hover:text-[#062C1A]"
                }`}
              >
                <span>{mode}</span>
                <span className="text-[9px] bg-zinc-200 text-zinc-600 px-1 rounded font-black">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sales Transactions Grid */}
      <div className="bg-white border border-zinc-200/60 rounded-[18px] overflow-hidden shadow-2xs mb-4">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-left font-sans text-xs">
            <thead className="bg-[#062C1A]/5 text-[#062C1A] font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Invoice ID</th>
                <th className="px-5 py-3.5">Date & Time</th>
                <th className="px-5 py-3.5">Customer & Contact</th>
                <th className="px-5 py-3.5">Service Type</th>
                <th className="px-5 py-3.5">Subtotal & GST</th>
                <th className="px-5 py-3.5">Grand Total</th>
                <th className="px-5 py-3.5">Payment Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white font-medium text-zinc-700">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-center">
                      <span className="text-4xl mb-3 block">📦</span>
                      <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider">No sales or orders created yet.</h3>
                      <button
                        onClick={() => {
                          setIsModalOpen(true);
                          if (menu.length > 0) setCurrentMenuItemId(menu[0].id);
                        }}
                        className="mt-4 bg-[#16A34A] hover:bg-[#117534] text-white font-extrabold text-[11px] px-4 py-2 rounded-xl transition-all cursor-pointer"
                      >
                        Create First Order
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map(order => {
                  return (
                    <tr key={order.id} className="hover:bg-zinc-50/40 transition-colors">
                      {/* ID */}
                      <td className="px-5 py-4 font-mono font-bold text-zinc-950">
                        {order.id}
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4 text-zinc-500 font-mono">
                        {new Date(order.timestamp).toLocaleString("en-IN", { hour12: true, hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                      </td>

                      {/* Customer Name */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-zinc-900">{order.customerName}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">{order.phone || "+91 99999 99999"}</div>
                      </td>

                      {/* Dining Type */}
                      <td className="px-5 py-4">
                        <span className="font-semibold text-zinc-700 bg-zinc-100 px-2 py-1 rounded-[6px] text-[10px] uppercase tracking-wide">
                          {order.tableOrType}
                        </span>
                      </td>

                      {/* Subtotal */}
                      <td className="px-5 py-4 text-zinc-500">
                        ₹{order.subtotal.toLocaleString()} + ₹{order.tax.toLocaleString()}
                      </td>

                      {/* Total */}
                      <td className="px-5 py-4 text-[#062C1A] font-black text-xs">
                        ₹{order.total.toLocaleString()}
                      </td>

                      {/* Payment Status */}
                      <td className="px-5 py-4">
                        <button
                          onClick={() => handleToggleStatus(order.id)}
                          className={`text-[9.5px] font-extrabold uppercase px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                            order.status === "Completed" 
                              ? "bg-emerald-50 text-[#16A34A] border-emerald-200/50 hover:bg-emerald-100" 
                              : order.status === "Pending"
                              ? "bg-amber-50 text-amber-700 border-amber-200/50 hover:bg-amber-100"
                              : "bg-rose-50 text-rose-700 border-rose-200/50 hover:bg-rose-100"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            order.status === "Completed" ? "bg-[#16A34A]" : order.status === "Pending" ? "bg-amber-500" : "bg-rose-500"
                          }`} />
                          <span>{order.status}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsReceiptModalOpen(true);
                            }}
                            className="bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200 p-2 rounded-lg transition-colors cursor-pointer"
                            title="View Invoice & Print"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="bg-zinc-50/50 px-5 py-3 border-t border-zinc-100 flex items-center justify-between text-zinc-500 font-bold text-[11px]">
            <span>Showing Page {currentPage} of {totalPages} ({filteredOrders.length} matching transactions)</span>
            <div className="flex gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="bg-white border border-zinc-200 text-zinc-700 px-3 py-1.5 rounded-lg font-bold disabled:opacity-40 transition-colors cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="bg-white border border-zinc-200 text-zinc-700 px-3 py-1.5 rounded-lg font-bold disabled:opacity-40 transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invoice Detail Modal & Thermal Receipt */}
      {isReceiptModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white w-full max-w-[420px] rounded-[24px] border border-zinc-200 shadow-xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4.5 bg-[#062C1A] text-white flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-[#16A34A]" />
                  <span>TAX INVOICE DETAIL</span>
                </h3>
                <span className="text-[10px] text-white/50 font-mono uppercase mt-0.5 block">{selectedOrder.id}</span>
              </div>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="text-white/60 hover:text-white bg-white/10 p-1.5 rounded-full transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Receipt Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Thermal Print Progress Bar */}
              {simulatedPrintProgress !== null && (
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl space-y-2">
                  <div className="flex justify-between text-[10px] font-bold text-emerald-800">
                    <span>Dispatching to POS Thermal Printer...</span>
                    <span>{simulatedPrintProgress}%</span>
                  </div>
                  <div className="w-full bg-emerald-200/50 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#16A34A] h-full transition-all duration-300" style={{ width: `${simulatedPrintProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Customer Info Card */}
              <div className="bg-zinc-50 border border-zinc-200/50 p-4 rounded-[18px] text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Customer:</span>
                  <span className="font-bold text-zinc-900">{selectedOrder.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Contact No:</span>
                  <span className="font-mono text-zinc-700">{selectedOrder.phone || "+91 99999 99999"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Dining Style:</span>
                  <span className="font-semibold text-[#062C1A]">{selectedOrder.tableOrType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Timestamp:</span>
                  <span className="font-mono text-zinc-600">{new Date(selectedOrder.timestamp).toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2.5">
                <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Ordered items</div>
                <div className="divide-y divide-zinc-100 border-t border-b border-zinc-100 py-1">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between py-2.5 text-xs">
                      <div>
                        <span className="font-bold text-zinc-800">{item.name}</span>
                        <span className="text-[10px] text-zinc-400 ml-1.5">x{item.quantity}</span>
                      </div>
                      <span className="font-bold text-zinc-900 font-mono">₹{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Breakdown */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Subtotal:</span>
                  <span className="font-semibold font-mono text-zinc-700">₹{selectedOrder.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>5% GST:</span>
                  <span className="font-semibold font-mono text-zinc-700">₹{selectedOrder.tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-dashed border-zinc-200 pt-2 text-sm">
                  <span className="font-extrabold text-[#062C1A]">Grand Total:</span>
                  <span className="font-black text-[#16A34A] font-mono">₹{selectedOrder.total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Print Trigger */}
            <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex gap-2.5">
              <button
                onClick={handlePrintReceipt}
                className="flex-1 bg-[#062C1A] hover:bg-[#031d10] text-white font-extrabold text-xs py-2.5 rounded-[12px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Simulate Thermal POS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE ORDER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <form onSubmit={handleCreateOrderSubmit} className="bg-white w-full max-w-xl rounded-[24px] border border-zinc-200 shadow-xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-5 bg-[#062C1A] text-white flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-[#16A34A]" />
                  <span>CREATE SALES BILLING TRANSACTION</span>
                </h3>
                <p className="text-[10px] text-white/50 uppercase tracking-wider font-semibold mt-0.5">PostgreSQL Database Insertion</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/60 hover:text-white bg-white/10 p-1.5 rounded-full transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Scroll Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              
              {/* Customer Selector */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-[#062C1A] uppercase tracking-wide text-[10px]">CRM Customer Registration</label>
                  <button
                    type="button"
                    onClick={() => setIsNewCustomer(!isNewCustomer)}
                    className="text-[#16A34A] font-black text-[10px] uppercase hover:underline cursor-pointer"
                  >
                    {isNewCustomer ? "Select Existing Customer" : "Register New Customer"}
                  </button>
                </div>

                {isNewCustomer ? (
                  <div className="grid grid-cols-2 gap-3 bg-zinc-50 p-3.5 rounded-[14px] border border-zinc-200/50">
                    <div className="space-y-1">
                      <span className="text-[9px] text-zinc-400 font-bold uppercase">Customer Name *</span>
                      <input
                        type="text"
                        placeholder="e.g. Anand"
                        value={customCustomerName}
                        onChange={(e) => setCustomCustomerName(e.target.value)}
                        className="w-full bg-white border border-zinc-200 px-3 py-2 rounded-lg text-xs font-bold text-zinc-800 focus:outline-none focus:border-[#16A34A]"
                        required={isNewCustomer}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] text-zinc-400 font-bold uppercase">Phone Number</span>
                      <input
                        type="text"
                        placeholder="+91 99999 99999"
                        value={customCustomerPhone}
                        onChange={(e) => setCustomCustomerPhone(e.target.value)}
                        className="w-full bg-white border border-zinc-200 px-3 py-2 rounded-lg text-xs font-bold text-zinc-800 focus:outline-none focus:border-[#16A34A]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customers.length === 0 ? (
                      <div className="bg-amber-50/50 border border-amber-200/60 p-4 rounded-xl text-center text-xs space-y-2">
                        <span className="text-zinc-600 block">No customers available in PostgreSQL.</span>
                        <button
                          type="button"
                          onClick={() => setIsNewCustomer(true)}
                          className="bg-[#16A34A] hover:bg-[#117534] text-white font-extrabold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
                        >
                          Register Customer
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="bg-zinc-50 p-1.5 rounded-[14px] border border-zinc-200/50 relative">
                          <select
                            value={selectedCustomerId}
                            onChange={(e) => setSelectedCustomerId(e.target.value)}
                            className="w-full bg-white border border-zinc-200 px-3.5 py-2.5 rounded-[10px] text-xs font-bold text-zinc-800 focus:outline-none focus:border-[#16A34A] cursor-pointer appearance-none"
                          >
                            {customers.map(c => (
                              <option key={c.id} value={c.id}>{c.name} ({c.phone || "No phone"})</option>
                            ))}
                          </select>
                          <div className="absolute right-4.5 top-5 w-2 h-2 border-r-2 border-b-2 border-zinc-500 rotate-45 pointer-events-none" />
                        </div>

                        {selectedCustomerRecord && (
                          <div className="bg-emerald-50/45 border border-emerald-100 p-2.5 rounded-xl flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="bg-emerald-100 text-emerald-800 p-1 rounded-lg">
                                <Award className="w-3.5 h-3.5" />
                              </span>
                              <div>
                                <span className="font-bold text-emerald-950 block">
                                  {selectedCustomerRecord.visitCount >= 10 ? "👑 VIP Tier Client" : "✨ Registered Loyalty Guest"}
                                </span>
                                <span className="text-[10px] text-emerald-700/80 block mt-0.5">
                                  {selectedCustomerRecord.visitCount} visits • spent ₹{selectedCustomerRecord.totalSpent.toLocaleString()} • last active {new Date(selectedCustomerRecord.lastOrderDate).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            {selectedCustomerRecord.notes && (
                              <div className="text-[10px] text-zinc-500 italic max-w-[200px] text-right">
                                "{selectedCustomerRecord.notes}"
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Service Style & Dine In Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-[#062C1A] uppercase tracking-wide text-[10px]">Service Style / Dining Type</label>
                  <div className="bg-zinc-50 p-1.5 rounded-[14px] border border-zinc-200/50 relative">
                    <select
                      value={orderType}
                      onChange={(e) => setOrderType(e.target.value)}
                      className="w-full bg-white border border-zinc-200 px-3.5 py-2.5 rounded-[10px] text-xs font-bold text-zinc-800 focus:outline-none focus:border-[#16A34A] cursor-pointer appearance-none"
                    >
                      <option value="Table 1">Table 1 (Dine In)</option>
                      <option value="Table 2">Table 2 (Dine In)</option>
                      <option value="Table 3">Table 3 (Dine In)</option>
                      <option value="Table 4">Table 4 (Dine In)</option>
                      <option value="Takeaway">Takeaway / Parcels</option>
                      <option value="Delivery">Home Delivery Partner</option>
                    </select>
                    <div className="absolute right-4.5 top-5 w-2 h-2 border-r-2 border-b-2 border-zinc-500 rotate-45 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-[#062C1A] uppercase tracking-wide text-[10px]">Reconciliation Status</label>
                  <div className="bg-zinc-50 p-1.5 rounded-[14px] border border-zinc-200/50 relative">
                    <select
                      value={modalOrderStatus}
                      onChange={(e) => setModalOrderStatus(e.target.value as any)}
                      className="w-full bg-white border border-zinc-200 px-3.5 py-2.5 rounded-[10px] text-xs font-bold text-zinc-800 focus:outline-none focus:border-[#16A34A] cursor-pointer appearance-none"
                    >
                      <option value="Completed">Direct Payout (Completed)</option>
                      <option value="Pending">Queue Kitchen Prep (Pending)</option>
                    </select>
                    <div className="absolute right-4.5 top-5 w-2 h-2 border-r-2 border-b-2 border-zinc-500 rotate-45 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Dish Selection and Addition */}
              <div className="space-y-1.5">
                <label className="font-bold text-[#062C1A] uppercase tracking-wide text-[10px] flex justify-between">
                  <span>Dish Selection Menu</span>
                </label>

                {menu.length === 0 ? (
                  <div className="bg-amber-50/50 border border-amber-200/60 p-4 rounded-xl text-center text-xs space-y-2">
                    <span className="text-zinc-600 block">No menu items available in PostgreSQL.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        if (setActiveTab) setActiveTab("inventory");
                      }}
                      className="bg-[#16A34A] hover:bg-[#117534] text-white font-extrabold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
                    >
                      Add Menu Item
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 bg-zinc-50 p-3 rounded-[14px] border border-zinc-200/50">
                    <div className="flex-1 relative">
                      <select
                        value={currentMenuItemId}
                        onChange={(e) => setCurrentMenuItemId(e.target.value)}
                        className="w-full bg-white border border-zinc-200 px-3.5 py-2.5 rounded-[10px] text-xs font-bold text-zinc-800 focus:outline-none focus:border-[#16A34A] appearance-none cursor-pointer"
                      >
                        <option value="">-- Choose Menu Item --</option>
                        {menu.map(m => (
                          <option key={m.id} value={m.id} disabled={m.status === "Sold Out"}>
                            {m.name} - ₹{m.price} {m.status === "Sold Out" ? "(Sold Out)" : ""}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-4.5 w-2 h-2 border-r-2 border-b-2 border-zinc-500 rotate-45 pointer-events-none" />
                    </div>
                    <div className="w-20">
                      <input
                        type="number"
                        min="1"
                        value={currentQuantity}
                        onChange={(e) => setCurrentQuantity(parseInt(e.target.value) || 1)}
                        className="w-full bg-white border border-zinc-200 px-3 py-2.5 rounded-[10px] text-xs font-black text-zinc-800 text-center focus:outline-none focus:border-[#16A34A]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddItemToDraft}
                      className="bg-[#16A34A] hover:bg-[#117534] text-white font-extrabold text-xs px-5 rounded-[10px] cursor-pointer transition-colors"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>

              {/* Draft list display */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Draft Billing Items</span>
                {addedItems.length === 0 ? (
                  <div className="border border-dashed border-zinc-200 p-5 rounded-[18px] text-center text-zinc-400 italic">
                    Add recipes above to calculate invoice subtotal.
                  </div>
                ) : (
                  <div className="border border-zinc-200/60 rounded-[18px] divide-y divide-zinc-100 overflow-hidden bg-zinc-50/20">
                    {addedItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center px-4.5 py-3">
                        <div>
                          <span className="font-extrabold text-zinc-900">{item.name}</span>
                          <span className="text-[10px] text-zinc-500 ml-2">₹{item.price} x {item.quantity}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-zinc-900 font-mono">₹{(item.price * item.quantity).toLocaleString()}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromDraft(item.menuItemId)}
                            className="text-rose-500 hover:text-rose-700 font-black text-xs cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Billing Discounts & Deductions */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase block">Special Promo Discount (₹)</span>
                  <input
                    type="number"
                    min="0"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-zinc-50 border border-zinc-200 px-3.5 py-2 rounded-lg text-xs font-bold text-zinc-800 focus:outline-none focus:border-[#16A34A]"
                  />
                </div>

                {/* Instant Totals Sheet */}
                <div className="bg-[#062C1A]/5 border border-[#062C1A]/10 p-4 rounded-xl flex flex-col justify-between text-right">
                  <div className="flex justify-between text-[10px] text-zinc-500 font-semibold">
                    <span>Subtotal:</span>
                    <span className="font-mono">₹{draftSubtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500 font-semibold mt-1">
                    <span>5% GST:</span>
                    <span className="font-mono">₹{draftTax.toLocaleString()}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-[10px] text-rose-500 font-semibold mt-1">
                      <span>Discount:</span>
                      <span className="font-mono">-₹{discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-black text-zinc-900 mt-2 pt-1.5 border-t border-dashed border-zinc-300">
                    <span>Total Amount:</span>
                    <span className="text-[#16A34A] font-mono">₹{draftTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer triggers */}
            <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex gap-2.5">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 bg-white hover:bg-zinc-50 text-zinc-600 border border-zinc-200 font-bold text-xs py-2.5 rounded-[12px] transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={addedItems.length === 0}
                className="flex-1 bg-[#16A34A] hover:bg-[#117534] text-white font-extrabold text-xs py-2.5 rounded-[12px] shadow-sm shadow-emerald-600/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Submit Billing Invoice
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
