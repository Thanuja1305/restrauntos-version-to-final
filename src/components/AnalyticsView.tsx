import React, { useState } from "react";
import { 
  LineChart, 
  TrendingUp, 
  FileSpreadsheet, 
  FileText, 
  FileSignature, 
  RefreshCw, 
  Eye, 
  Coins, 
  ArrowUpRight, 
  ArrowDownRight,
  Sparkles
} from "lucide-react";
import { RestaurantState } from "../types";

interface AnalyticsViewProps {
  restaurantState: RestaurantState;
}

export default function AnalyticsView({ restaurantState }: AnalyticsViewProps) {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [reportText, setReportText] = useState<string>("");
  const [isCompiling, setIsCompiling] = useState(false);

  // Compute live analytics from PostgreSQL state
  const totalRevenue = restaurantState.orders
    .filter(o => o.status === "Completed")
    .reduce((acc, o) => acc + o.total, 0);

  const totalExpense = restaurantState.finances
    .filter(f => f.type === "Expense")
    .reduce((acc, f) => acc + f.amount, 0);

  const profitLoss = totalRevenue - totalExpense;

  const lowStockItems = restaurantState.inventory.filter(
    item => item.currentQty <= item.reorderLevel
  );

  const pendingPaymentsTotal = restaurantState.suppliers.reduce(
    (acc, s) => acc + s.pendingPayments, 0
  );

  const totalOrdersCount = restaurantState.orders.length;
  const completedOrdersCount = restaurantState.orders.filter(o => o.status === "Completed").length;

  const reportTypes = [
    { 
      id: "sales", 
      title: "Daily Sales & Margins Audit", 
      desc: "Comprehensive review of daily completed orders, cumulative receipts, average ticket values, and ingredient profit markups.",
      icon: FileSpreadsheet 
    },
    { 
      id: "inventory", 
      title: "Stock Reorder & Logistical Report", 
      desc: "Delineates depleted raw ingredients weight, safety limit violations, and drafts distributor restock orders.",
      icon: FileText 
    },
    { 
      id: "suppliers", 
      title: "Supplier Accounts Outstanding Balances", 
      desc: "Traces bulk vendor disbursements, outstanding pending payments, and transaction history.",
      icon: FileSignature 
    },
  ];

  const handleCompileReport = (reportId: string) => {
    setIsCompiling(true);
    setSelectedReport(reportId);

    setTimeout(() => {
      let doc = "";
      const dateStr = new Date().toLocaleDateString("en-IN", { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      if (reportId === "sales") {
        const orderCount = restaurantState.orders.length;
        const totalRev = restaurantState.orders.reduce((acc, o) => acc + o.total, 0);
        const avgTicket = orderCount > 0 ? Math.round(totalRev / orderCount) : 0;

        doc = `# Live Sales & Margins Audit Report
**Compiled for:** Spice Heaven Restaurant
**Timestamp:** ${dateStr}
**Status:** ✔ Reconciled & Audited

---

## 1. Executive Operations Summary
- **Cumulative Revenue (PostgreSQL):** ₹${totalRev.toLocaleString()}
- **Total Registered Guest Tickets:** ${orderCount} tickets
- **Average Ticket Value (Avg Ticket):** ₹${avgTicket.toLocaleString()}
- **Completed Database Transactions:** ${completedOrdersCount} orders

## 2. Recipe Popularity & Cost Markup Margins
${restaurantState.menu.map(item => {
  const margin = item.price - item.cost;
  const markupPct = item.cost > 0 ? Math.round((margin / item.cost) * 100) : 100;
  return `- **${item.name} (${item.category}):** ₹${item.price} sell / ₹${item.cost} cost. (Margin: ₹${margin}, Markup: ${markupPct}%)`;
}).join("\n")}

## 3. Recommended Operational Adjustments
- Promotion of high-yield items is advised to bolster the average transaction ticker value.
- Re-evaluate cost basis for ingredients that are currently matching low safety margin limits.`;
      } else if (reportId === "inventory") {
        doc = `# Stock Reorder & Logistical Audit Report
**Compiled for:** Spice Heaven Restaurant
**Timestamp:** ${dateStr}
**Status:** ${lowStockItems.length > 0 ? "⚠ Stock Violations Identified" : "✔ Healthy Operating Levels"}

---

## 1. Safety Limit Violations Summary
Our raw ingredients auditor has detected **${lowStockItems.length} ingredients** below safety thresholds.

${lowStockItems.length === 0 ? "✔ All raw materials are well within safe operating limits." : `
| Material Item | Current Stock Level | Reorder Safety Level | Cost Basis | Action |
| :--- | :---: | :---: | :---: | :--- |
${lowStockItems.map(item => {
  return `| **${item.name}** | **${item.currentQty} ${item.unit}** | ${item.reorderLevel} ${item.unit} | ₹${item.unitPrice} | 🚚 restock advised |`;
}).join("\n")}
`}

## 2. Logistical Distributor Action Sheet
- **Tomatoes / Onions / Vegetables:** Procured from Fresh Farms. Monitor daily kitchen usage.
- **Dry Staples / Dairy:** Safety limits are automatically logged into the central stock auditor.`;
      } else {
        doc = `# Supplier Outstanding Accounts Audit Report
**Compiled for:** Spice Heaven Restaurant
**Timestamp:** ${dateStr}
**Status:** ✔ Ledger Reconciled

---

## 1. Bulk Vendor Disbursements Ledger
Cumulative outstanding liabilities to third-party distributors sum up to **₹${pendingPaymentsTotal.toLocaleString()}**.

${restaurantState.suppliers.length === 0 ? "No supplier accounts registered in PostgreSQL." : `
| Vendor ID | Distributor Company | Key Agent | Outstanding Liabilities | Primary Ingredients Supplied | Status |
| :--- | :---: | :---: | :---: | :---: | :--- |
${restaurantState.suppliers.map(s => {
  return `| **${s.id}** | **${s.companyName}** | ${s.contactPerson} | **₹${s.pendingPayments.toLocaleString()}** | ${s.itemsSupplied.join(", ")} | ${s.pendingPayments > 0 ? "⚠ Due" : "✔ Settled"} |`;
}).join("\n")}
`}

## 2. Account Settlement Compliance
- Financial logs for supplier settlements can be registered under the Finance module to balance raw materials procurement ledgers.`;
      }

      setReportText(doc);
      setIsCompiling(false);
    }, 800);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAFAF8] px-3 py-4 sm:p-6 overflow-y-auto font-sans select-none animate-fade-in">
      
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="pl-10 sm:pl-0">
          <h1 className="text-xl font-bold text-[#062C1A] tracking-tight flex items-center gap-2">
            <LineChart className="w-5 h-5 text-[#16A34A]" />
            <span className="hidden sm:inline">AI Restaurant Operations Analytics</span>
            <span className="sm:hidden">Analytics</span>
          </h1>
          <p className="hidden sm:block text-xs text-zinc-500 mt-0.5">Evaluate live margins, trace ingredient profit markups, analyze active safety violations, and compile business summaries.</p>
        </div>
      </div>

      {/* Analytics Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {/* Total revenue */}
        <div className="bg-white border border-zinc-200/60 p-5 rounded-[18px] shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Completed Sales Revenue</span>
              <h2 className="text-2xl font-black text-[#16A34A]">₹{totalRevenue.toLocaleString()}</h2>
            </div>
            <span className="w-8 h-8 bg-emerald-50 rounded-lg text-[#16A34A] flex items-center justify-center font-bold">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="text-[10px] text-zinc-400 font-bold mt-4 pt-3.5 border-t border-zinc-100 uppercase">
            From {completedOrdersCount} completed orders
          </div>
        </div>

        {/* Total Expense */}
        <div className="bg-white border border-zinc-200/60 p-5 rounded-[18px] shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Supplier Disbursements</span>
              <h2 className="text-2xl font-black text-rose-600">₹{totalExpense.toLocaleString()}</h2>
            </div>
            <span className="w-8 h-8 bg-rose-50 rounded-lg text-rose-600 flex items-center justify-center font-bold">
              <ArrowDownRight className="w-4 h-4" />
            </span>
          </div>
          <div className="text-[10px] text-zinc-400 font-bold mt-4 pt-3.5 border-t border-zinc-100 uppercase">
            Total ledger expense payouts
          </div>
        </div>

        {/* Net Cashflow status */}
        <div className="bg-white border border-zinc-200/60 p-5 rounded-[18px] shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Net Ledger Cashflow</span>
              <h2 className={`text-2xl font-black ${profitLoss >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                ₹{profitLoss.toLocaleString()}
              </h2>
            </div>
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${profitLoss >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
              <Coins className="w-4 h-4" />
            </span>
          </div>
          <div className="text-[10px] text-zinc-400 font-bold mt-4 pt-3.5 border-t border-zinc-100 uppercase">
            Net operating surplus
          </div>
        </div>
      </div>

      {/* Menu Markup & Safety Thresholds Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        
        {/* Menu item markup list */}
        <div className="bg-white border border-zinc-200/60 rounded-[18px] p-5 shadow-2xs">
          <h3 className="font-bold text-sm text-[#062C1A] tracking-tight mb-4 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-[#16A34A]" />
            <span>Recipe Profitability & Markup Index</span>
          </h3>
          <div className="space-y-3.5 max-h-[280px] overflow-y-auto">
            {restaurantState.menu.length === 0 ? (
              <div className="text-center text-zinc-400 italic text-xs py-8">
                No recipes registered in PostgreSQL database.
              </div>
            ) : (
              restaurantState.menu.map(item => {
                const margin = item.price - item.cost;
                const marginPct = item.price > 0 ? Math.round((margin / item.price) * 100) : 0;
                
                return (
                  <div key={item.id} className="flex justify-between items-center text-xs border-b border-zinc-50 pb-2">
                    <div>
                      <span className="font-bold text-zinc-800 block">{item.name}</span>
                      <span className="text-[10px] text-zinc-400 font-semibold block uppercase">{item.category}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-zinc-900 block">₹{item.price} <span className="text-[10px] text-zinc-400 font-medium">(cost: ₹{item.cost})</span></span>
                      <span className="text-[9.5px] font-black text-emerald-600 block mt-0.5">
                        {marginPct}% Margin • +₹{margin} Profit
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Safety limits panel */}
        <div className="bg-white border border-zinc-200/60 rounded-[18px] p-5 shadow-2xs">
          <h3 className="font-bold text-sm text-rose-800 tracking-tight mb-4 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-rose-500" />
            <span>Safety Limits & Stock Outstandings</span>
          </h3>
          <div className="space-y-3.5 max-h-[280px] overflow-y-auto">
            <div className="flex justify-between text-xs border-b border-zinc-50 pb-2">
              <span className="text-zinc-500">Low Stock Safety Violations:</span>
              <span className={`font-black ${lowStockItems.length > 0 ? "text-rose-600" : "text-zinc-800"}`}>{lowStockItems.length} items</span>
            </div>
            <div className="flex justify-between text-xs border-b border-zinc-50 pb-2">
              <span className="text-zinc-500">Unresolved Supplier Balances:</span>
              <span className={`font-black ${pendingPaymentsTotal > 0 ? "text-amber-600" : "text-zinc-800"}`}>₹{pendingPaymentsTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs border-b border-zinc-50 pb-2">
              <span className="text-zinc-500">Registered Guest Accounts:</span>
              <span className="font-black text-zinc-800">{restaurantState.customers.length} profiles</span>
            </div>
            <div className="flex justify-between text-xs border-b border-zinc-50 pb-2">
              <span className="text-zinc-500">Logistical Suppliers Linked:</span>
              <span className="font-black text-zinc-800">{restaurantState.suppliers.length} vendors</span>
            </div>
          </div>
        </div>

      </div>

      {/* AI Operations Reports Compiler */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start flex-1">
        
        {/* Templates Selection */}
        <div className="lg:col-span-2 space-y-3">
          <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider pl-1">Operational Audit Templates</div>
          <div className="space-y-2.5">
            {reportTypes.map(r => {
              const Icon = r.icon;
              const isActive = selectedReport === r.id;

              return (
                <div 
                  key={r.id}
                  className={`bg-white border p-4.5 rounded-[18px] shadow-2xs transition-all flex flex-col gap-2 relative overflow-hidden ${
                    isActive ? "border-[#16A34A] bg-emerald-50/10 shadow-xs" : "border-zinc-200/60 hover:border-zinc-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive ? "bg-[#16A34A]/10 text-[#16A34A]" : "bg-zinc-100 text-zinc-500"
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-zinc-900 truncate">{r.title}</h4>
                      <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">{r.desc}</p>
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => handleCompileReport(r.id)}
                      disabled={isCompiling}
                      className={`text-[9.5px] font-black uppercase px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${
                        isActive 
                          ? "bg-[#062C1A] text-white border-transparent" 
                          : "bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border-zinc-200"
                      }`}
                    >
                      {isActive && isCompiling ? "Compiling..." : "Compile Audit"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Report Output Panel */}
        <div className="lg:col-span-3 h-full flex flex-col min-h-[350px]">
          <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-3 pl-1">Live Audit compiler output</div>
          <div className="bg-white border border-zinc-200/60 rounded-[18px] p-5 shadow-2xs flex-1 flex flex-col justify-between overflow-hidden">
            {selectedReport ? (
              <div className="flex-1 flex flex-col justify-between h-full">
                <div className="overflow-y-auto max-h-[300px] text-xs font-mono whitespace-pre-wrap text-zinc-700 leading-relaxed scrollbar-thin">
                  {reportText}
                </div>
                <div className="pt-4 border-t border-zinc-100 flex justify-end">
                  <button
                    onClick={() => {
                      const printWindow = window.open("", "_blank");
                      if (printWindow) {
                        printWindow.document.write(`
                          <html>
                            <head><title>${reportTypes.find(r => r.id === selectedReport)?.title}</title></head>
                            <body style="font-family: monospace; white-space: pre-wrap; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6;">
                              ${reportText}
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                        printWindow.print();
                      }
                    }}
                    className="bg-[#062C1A] hover:bg-[#031d10] text-white font-extrabold text-[10px] uppercase tracking-wider px-4 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    Print Audit Document
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-12 text-zinc-400 italic text-xs">
                Select an operational template on the left and click "Compile Audit" to auto-compile PostgreSQL telemetry!
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
