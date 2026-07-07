import React, { useState } from "react";
import { 
  Warehouse, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  RefreshCw, 
  Truck,
  Tag,
  Utensils,
  ChefHat,
  ToggleLeft,
  ToggleRight,
  Edit2,
  Check,
  Percent,
  TrendingUp,
  Clock
} from "lucide-react";
import { InventoryItem, Supplier, MenuItem, Order, RestaurantState } from "../types";

interface InventoryViewProps {
  inventory: InventoryItem[];
  suppliers: Supplier[];
  menu: MenuItem[];
  orders: Order[];
  onUpdateInventory: (inventory: InventoryItem[]) => void;
  onUpdateMenu: (menu: MenuItem[]) => void;
  onUpdateOrders: (orders: Order[]) => void;
  onUpdateState: (state: RestaurantState) => void;
  onAddLog: (type: "Income" | "Expense", category: any, amount: number, description: string) => void;
}

export default function InventoryView({ 
  inventory, 
  suppliers, 
  menu, 
  orders, 
  onUpdateInventory, 
  onUpdateMenu, 
  onUpdateOrders,
  onUpdateState,
  onAddLog 
}: InventoryViewProps) {
  // Master module view tab selection
  const [activeSubTab, setActiveSubTab] = useState<"stock" | "menu" | "prep">("stock");

  // --- Sub-Tab 1: Stock Levels States ---
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [stockFilterMode, setStockFilterMode] = useState<"All" | "Low Stock" | "Healthy">("All");

  // --- Sub-Tab 2: Recipe & Menu Customization States ---
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const [menuActiveCategory, setMenuActiveCategory] = useState<"All" | "Appetizer" | "Main Course" | "Beverage" | "Dessert">("All");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editCost, setEditCost] = useState<number>(0);

  // --- Recipe Requirements Sheet Helper ---
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

  // Restock logic (Postgres synchronized)
  const handleRestock = async (item: InventoryItem) => {
    const restockQty = 10;
    const cost = item.unitPrice * restockQty;

    const confirmed = window.confirm(
      `Restock request:\n- Purchase ${restockQty} ${item.unit} of ${item.name}\n- Cost: ₹${cost.toLocaleString()}\n- Supplier payout will be logged.\n\nSubmit this supplier order?`
    );
    if (!confirmed) return;

    // Update locally and update postgres state
    const updatedInventory = inventory.map(i => {
      if (i.id === item.id) {
        return { ...i, currentQty: Number((i.currentQty + restockQty).toFixed(2)) };
      }
      return i;
    });

    onUpdateInventory(updatedInventory);

    // Add cash outflow
    onAddLog(
      "Expense",
      "Supplier Payment",
      cost,
      `Restock purchase order for ${restockQty} ${item.unit} of ${item.name}`
    );

    // Sync whole state to server
    try {
      const res = await fetch("/api/state");
      if (res.ok) {
        const freshState = await res.json();
        onUpdateState({
          ...freshState,
          inventory: updatedInventory
        });
      }
    } catch (err) {
      console.error("Failed to sync restock state with server:", err);
    }

    alert(`🚚 Supplier restock order logged!\nAdded ${restockQty} ${item.unit} to ${item.name} inventory.`);
  };

  // Toggle Recipe availability
  const handleToggleRecipeStatus = async (id: string) => {
    const updatedMenu = menu.map(item => {
      if (item.id === id) {
        return { ...item, status: item.status === "Available" ? ("Sold Out" as const) : ("Available" as const) };
      }
      return item;
    });

    onUpdateMenu(updatedMenu);

    // Push state update to save in postgres/server
    try {
      await fetch("/api/state/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menu: updatedMenu })
      });
    } catch (err) {
      console.error("Failed to update menu status in PostgreSQL:", err);
    }
  };

  // Save Price / Cost adjustments
  const startEditingRecipe = (item: MenuItem) => {
    setEditingId(item.id);
    setEditPrice(item.price);
    setEditCost(item.cost);
  };

  const saveRecipeEdits = async (id: string) => {
    const updatedMenu = menu.map(item => {
      if (item.id === id) {
        return { ...item, price: Number(editPrice), cost: Number(editCost) };
      }
      return item;
    });

    onUpdateMenu(updatedMenu);
    setEditingId(null);

    // Push state update to save in postgres/server
    try {
      await fetch("/api/state/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menu: updatedMenu })
      });
    } catch (err) {
      console.error("Failed to save menu changes to PostgreSQL:", err);
    }
  };

  // Kitchen Display order completion
  const handleKdsCompletePreparation = async (orderId: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId.replace("ORD-", "")}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed" })
      });

      if (response.ok) {
        const updatedOrder = await response.json();
        
        // Update parent state lists
        onUpdateOrders(orders.map(o => o.id === orderId ? updatedOrder : o));

        const stateRes = await fetch("/api/state");
        if (stateRes.ok) {
          const freshState = await stateRes.json();
          onUpdateState(freshState);
        }
        alert(`🍳 Order ${orderId} prepared and dispatched successfully! Live inventory deducted.`);
      }
    } catch (err) {
      console.error("KDS failed to complete ticket:", err);
    }
  };

  // --- Filtering Datasets ---
  const filteredInventory = inventory.filter(item => {
    const isLow = item.currentQty <= item.reorderLevel;
    const matchesFilter = stockFilterMode === "All" || 
                         (stockFilterMode === "Low Stock" && isLow) || 
                         (stockFilterMode === "Healthy" && !isLow);
    const matchesSearch = item.name.toLowerCase().includes(stockSearchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const filteredMenu = menu.filter(item => {
    const matchesCategory = menuActiveCategory === "All" || item.category === menuActiveCategory;
    const matchesSearch = item.name.toLowerCase().includes(menuSearchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const activePendingOrders = orders.filter(o => o.status === "Pending");

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAFAF8] p-6 overflow-y-auto font-sans select-none animate-fade-in">
      
      {/* Module Title */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#062C1A] tracking-tight flex items-center gap-2.5">
            <Warehouse className="w-5.5 h-5.5 text-[#16A34A]" />
            <span>Culinary Supply & Recipe Customization Hub</span>
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">Control safety stock limits, toggle recipe prices, and manage active kitchen order preparation queues in PostgreSQL.</p>
        </div>
      </div>

      {/* Unified Tab Selectors */}
      <div className="flex border-b border-zinc-200 mb-5 gap-1 text-xs">
        <button
          onClick={() => setActiveSubTab("stock")}
          className={`px-5 py-2.5 font-bold transition-all relative ${
            activeSubTab === "stock" 
              ? "text-[#062C1A] border-b-2 border-[#16A34A]" 
              : "text-zinc-400 hover:text-zinc-600"
          } cursor-pointer`}
        >
          <span className="flex items-center gap-1.5">
            <Warehouse className="w-3.5 h-3.5" />
            <span>Stock Levels & Safety Limits</span>
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab("menu")}
          className={`px-5 py-2.5 font-bold transition-all relative ${
            activeSubTab === "menu" 
              ? "text-[#062C1A] border-b-2 border-[#16A34A]" 
              : "text-zinc-400 hover:text-zinc-600"
          } cursor-pointer`}
        >
          <span className="flex items-center gap-1.5">
            <Utensils className="w-3.5 h-3.5" />
            <span>Recipe & Menu Customization</span>
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab("prep")}
          className={`px-5 py-2.5 font-bold transition-all relative ${
            activeSubTab === "prep" 
              ? "text-[#062C1A] border-b-2 border-[#16A34A]" 
              : "text-zinc-400 hover:text-zinc-600"
          } cursor-pointer`}
        >
          <span className="flex items-center gap-1.5">
            <ChefHat className="w-3.5 h-3.5" />
            <span>Kitchen Order Prep Queue</span>
            {activePendingOrders.length > 0 && (
              <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                {activePendingOrders.length}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Render Selected Sub-Module Pane */}
      {activeSubTab === "stock" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white border border-zinc-200/60 p-3.5 rounded-[18px] shadow-2xs">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search raw ingredients..."
                value={stockSearchQuery}
                onChange={(e) => setStockSearchQuery(e.target.value)}
                className="w-full bg-[#FAFAF8] border border-zinc-200 pl-9 pr-4 py-1.5 rounded-[12px] text-xs font-medium text-zinc-800 focus:outline-none focus:border-[#16A34A]"
              />
            </div>

            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-[12px] border border-zinc-200/50">
              {(["All", "Low Stock", "Healthy"] as const).map(mode => {
                const count = mode === "Low Stock" 
                  ? inventory.filter(i => i.currentQty <= i.reorderLevel).length
                  : mode === "Healthy"
                  ? inventory.filter(i => i.currentQty > i.reorderLevel).length
                  : inventory.length;

                return (
                  <button
                    key={mode}
                    onClick={() => setStockFilterMode(mode)}
                    className={`px-3 py-1.5 rounded-[10px] text-xs font-bold transition-all flex items-center gap-1.5 ${
                      stockFilterMode === mode 
                        ? "bg-[#062C1A] text-white" 
                        : "text-zinc-500 hover:text-[#062C1A]"
                    } cursor-pointer`}
                  >
                    <span>{mode}</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                      mode === "Low Stock" && count > 0 ? "bg-rose-500 text-white" : "bg-zinc-200 text-zinc-600"
                    }`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table display */}
          <div className="bg-white border border-zinc-200/60 rounded-[18px] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-xs font-medium">
                <thead className="bg-[#062C1A]/5 text-[#062C1A] font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-5 py-3.5">Raw Material Item</th>
                    <th className="px-5 py-3.5">Stock Quantity</th>
                    <th className="px-5 py-3.5 w-48">Depletion visualizer</th>
                    <th className="px-5 py-3.5">Reorder Point</th>
                    <th className="px-5 py-3.5">Procurement Vendor</th>
                    <th className="px-5 py-3.5">Cost Basis</th>
                    <th className="px-5 py-3.5 text-right">Stock Dispatch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150 bg-white text-zinc-700">
                  {filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-zinc-400 italic">
                        {inventory.length === 0 ? "No inventory items registered in PostgreSQL." : "No raw materials match filters."}
                      </td>
                    </tr>
                  ) : (
                    filteredInventory.map(item => {
                      const isLow = item.currentQty <= item.reorderLevel;
                      const supplier = suppliers.find(s => s.id === item.supplierId);
                      const capacityMax = Math.max(item.reorderLevel * 2.5, item.currentQty);
                      const levelPct = Math.min(100, Math.round((item.currentQty / capacityMax) * 100));

                      return (
                        <tr key={item.id} className="hover:bg-zinc-50/40 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${isLow ? "bg-rose-500 animate-pulse" : "bg-emerald-500"}`} />
                              <span className="font-bold text-zinc-900">{item.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 font-black">
                            {item.currentQty} {item.unit}
                          </td>
                          <td className="px-5 py-4">
                            <div className="space-y-1">
                              <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden border border-zinc-200">
                                <div 
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    isLow ? "bg-rose-500" : "bg-emerald-500"
                                  }`} 
                                  style={{ width: `${levelPct}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[9px] text-zinc-400 font-bold font-mono">
                                <span>0</span>
                                <span>{Math.round(capacityMax)} {item.unit}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-zinc-500 font-mono">
                            {item.reorderLevel} {item.unit}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1">
                              <Truck className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              <span className="truncate max-w-[120px] font-semibold text-zinc-600">{supplier ? supplier.companyName : "Fresh Farms"}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 font-bold text-zinc-950 font-mono">
                            ₹{item.unitPrice} / {item.unit}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() => handleRestock(item)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase border transition-all cursor-pointer ${
                                isLow 
                                  ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 animate-pulse shadow-sm shadow-amber-500/5" 
                                  : "bg-zinc-50 hover:bg-zinc-100 text-zinc-500 border-zinc-200"
                              }`}
                            >
                              + Restock 10
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "menu" && (
        <div className="space-y-4">
          {/* Categories and Search bar */}
          <div className="bg-white border border-zinc-200/60 p-4 rounded-[18px] shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              
              <div className="flex flex-wrap items-center gap-1.5 bg-zinc-100 p-1 rounded-[12px] border border-zinc-200/50">
                {(["All", "Appetizer", "Main Course", "Beverage", "Dessert"] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setMenuActiveCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-[10px] text-xs font-bold transition-all cursor-pointer ${
                      menuActiveCategory === cat 
                        ? "bg-[#062C1A] text-white shadow-xs" 
                        : "text-zinc-500 hover:text-[#062C1A]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search recipes..."
                  value={menuSearchQuery}
                  onChange={(e) => setMenuSearchQuery(e.target.value)}
                  className="w-full bg-[#FAFAF8] border border-zinc-200 pl-9 pr-4 py-1.5 rounded-[12px] text-xs font-medium text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-[#16A34A] transition-colors"
                />
              </div>

            </div>
          </div>

          {/* Cards list */}
          {filteredMenu.length === 0 ? (
            <div className="bg-white border border-zinc-200/60 rounded-[18px] p-12 text-center shadow-xs flex flex-col items-center justify-center max-w-md mx-auto my-6">
              <span className="text-3xl mb-2">🍽</span>
              <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider">No Menu Items</h3>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                Add culinary recipes from your PostgreSQL database using the AI Agent.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredMenu.map(item => {
                const isAvailable = item.status === "Available";
                const margin = item.price - item.cost;
                const marginPct = item.price > 0 ? Math.round((margin / item.price) * 100) : 0;
                const isEditing = editingId === item.id;

                return (
                  <div 
                    key={item.id} 
                    className={`bg-white border p-5 rounded-[18px] shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-4 ${
                      isAvailable ? "border-zinc-200/60" : "border-rose-200 bg-rose-50/5"
                    }`}
                  >
                    {/* Top title */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-sm text-[#062C1A] tracking-tight">{item.name}</h3>
                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                          item.category === "Main Course" ? "bg-emerald-100 text-emerald-800" :
                          item.category === "Appetizer" ? "bg-amber-100 text-amber-800" :
                          item.category === "Beverage" ? "bg-blue-100 text-blue-800" :
                          "bg-purple-100 text-purple-800"
                        }`}>
                          {item.category}
                        </span>
                      </div>
                    </div>

                    {/* Costing edits */}
                    <div className="bg-zinc-50/60 border border-zinc-150 p-3 rounded-xl space-y-2">
                      {isEditing ? (
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-[9px] text-zinc-400 font-bold block mb-0.5">Sell Price (₹)</span>
                            <input 
                              type="number"
                              value={editPrice}
                              onChange={(e) => setEditPrice(Number(e.target.value) || 0)}
                              className="w-full bg-white border border-zinc-200 rounded px-2 py-1 font-bold text-zinc-800"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-zinc-400 font-bold block mb-0.5">Ingredient Cost (₹)</span>
                            <input 
                              type="number"
                              value={editCost}
                              onChange={(e) => setEditCost(Number(e.target.value) || 0)}
                              className="w-full bg-white border border-zinc-200 rounded px-2 py-1 font-bold text-zinc-800"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between text-xs font-semibold text-zinc-700">
                          <div>
                            <span className="text-[9px] text-zinc-400 font-bold block uppercase">Billing price</span>
                            <span className="font-extrabold text-zinc-900 font-mono text-xs">₹{item.price}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] text-zinc-400 font-bold block uppercase">Supplier cost</span>
                            <span className="font-bold text-zinc-600 font-mono">₹{item.cost}</span>
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t border-zinc-100 flex justify-between items-center text-[10px] text-zinc-400 font-semibold">
                        <span>Net profit margin:</span>
                        {isEditing ? (
                          <span className="text-emerald-600 font-mono font-bold">Calculating...</span>
                        ) : (
                          <span className="text-emerald-600 font-black font-mono">₹{margin} ({marginPct}%)</span>
                        )}
                      </div>
                    </div>

                    {/* Bottom triggers */}
                    <div className="flex items-center justify-between gap-2.5 pt-1.5 border-t border-zinc-50">
                      <button
                        onClick={() => handleToggleRecipeStatus(item.id)}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wide cursor-pointer transition-all flex items-center gap-1 ${
                          isAvailable 
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/50" 
                            : "bg-zinc-100 text-zinc-400 border border-zinc-200"
                        }`}
                      >
                        <span>{item.status}</span>
                      </button>

                      {isEditing ? (
                        <button
                          onClick={() => saveRecipeEdits(item.id)}
                          className="bg-[#062C1A] hover:bg-[#031d10] text-white p-2 rounded-lg cursor-pointer transition-all flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-extrabold uppercase tracking-wide">Save</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => startEditingRecipe(item)}
                          className="text-zinc-500 hover:text-zinc-900 bg-zinc-50 p-2 rounded-lg border border-zinc-200 cursor-pointer transition-all flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span className="text-[9px] font-extrabold uppercase tracking-wide">Edit Rates</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeSubTab === "prep" && (
        <div className="space-y-4">
          <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider pl-1 flex items-center gap-1">
            <Clock className="w-4 h-4 text-[#16A34A]" />
            <span>Active kitchen preparation tickets ({activePendingOrders.length})</span>
          </div>

          {activePendingOrders.length === 0 ? (
            <div className="bg-white border border-zinc-200/60 rounded-[18px] p-12 text-center shadow-2xs flex flex-col items-center justify-center max-w-md mx-auto my-6">
              <span className="text-3xl mb-3">🍳</span>
              <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider">Kitchen Queue Clear</h3>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                All order preparation tickets are processed! Active cooking sessions will populate here as new pending orders are placed.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {activePendingOrders.map(order => {
                return (
                  <div key={order.id} className="bg-white border border-zinc-200/60 rounded-[18px] p-5 shadow-2xs space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-mono font-bold text-zinc-950 text-xs block">{order.id}</span>
                          <span className="text-[10px] text-zinc-400 block mt-0.5">{order.customerName} • {order.tableOrType}</span>
                        </div>
                        <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                          Pending Prep
                        </span>
                      </div>

                      {/* Items */}
                      <div className="divide-y divide-zinc-100 py-1 text-xs">
                        {order.items.map((item, idx) => {
                          const reqs = getRecipeRequirement(item.menuItemId, item.quantity);
                          return (
                            <div key={idx} className="py-2.5">
                              <div className="flex justify-between font-bold text-zinc-900">
                                <span>{item.name}</span>
                                <span>x{item.quantity}</span>
                              </div>
                              {reqs.length > 0 && (
                                <div className="text-[10px] text-zinc-400 font-semibold mt-1 space-y-0.5">
                                  <span>Ingredients recipe draw:</span>
                                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[9px] text-zinc-500">
                                    {reqs.map((r, rIdx) => {
                                      const inv = inventory.find(i => i.name === r.name);
                                      const isDeficit = inv ? inv.currentQty < r.qtyNeeded : true;
                                      return (
                                        <div key={rIdx} className="flex justify-between">
                                          <span>• {r.name}:</span>
                                          <span className={isDeficit ? "text-rose-600 font-bold" : "text-zinc-600"}>
                                            {r.qtyNeeded.toFixed(2)} {inv?.unit} ({inv ? `${inv.currentQty} on hand` : "0 on hand"})
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-zinc-100 flex justify-end">
                      <button
                        onClick={() => handleKdsCompletePreparation(order.id)}
                        className="bg-[#16A34A] hover:bg-[#117534] text-white font-extrabold text-[10px] uppercase tracking-wider px-4 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Ready for Dispatch</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
