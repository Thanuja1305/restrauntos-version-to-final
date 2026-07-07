import React, { useState } from "react";
import { Coins, Search, ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, Plus } from "lucide-react";
import { FinanceEntry } from "../types";

interface FinanceViewProps {
  finances: FinanceEntry[];
  onAddLog: (type: "Income" | "Expense", category: any, amount: number, description: string) => void;
}

export default function FinanceView({ finances, onAddLog }: FinanceViewProps) {
  const [filterType, setFilterType] = useState<"All" | "Income" | "Expense">("All");

  const filteredFinances = finances.filter(f => {
    return filterType === "All" || f.type === filterType;
  });

  const totalIncome = finances
    .filter(f => f.type === "Income")
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalExpense = finances
    .filter(f => f.type === "Expense")
    .reduce((acc, curr) => acc + curr.amount, 0);

  const netCashFlow = totalIncome - totalExpense;

  const handleLogManualTransaction = () => {
    const type = window.confirm("Transaction type:\n- Click OK for 'Income' (Revenue)\n- Click Cancel for 'Expense' (Payout)") ? "Income" : "Expense";
    const categoryInput = window.prompt("Enter category (Order Revenue, Supplier Payment, Rent, Salaries, Utilities, Other):", "Other");
    const amountInput = window.prompt("Enter amount (₹):", "1000");
    const descInput = window.prompt("Enter description:", "Manual transaction log");

    if (!categoryInput || !amountInput || isNaN(Number(amountInput)) || !descInput) {
      alert("Invalid inputs. Transaction logging aborted.");
      return;
    }

    onAddLog(
      type,
      categoryInput as any,
      Number(amountInput),
      descInput
    );

    alert("✔ Transaction successfully added to live accounts ledger!");
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAFAF8] p-6 overflow-y-auto font-sans select-none animate-fade-in">
      {/* View Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#062C1A] tracking-tight flex items-center gap-2">
            <Coins className="w-5 h-5 text-[#16A34A]" />
            <span>Operational Cash Flow Ledger</span>
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">High-density spreadsheet tracking credits (sales, order bills) and debits (supplier settlements, rent, kitchen operations).</p>
        </div>
        
        <button
          onClick={handleLogManualTransaction}
          className="bg-[#16A34A] hover:bg-[#117534] text-white font-bold text-xs px-4 py-2 rounded-[12px] flex items-center gap-1.5 shadow-sm shadow-emerald-600/10 transition-all cursor-pointer active:scale-95 animate-fade-in"
        >
          <Plus className="w-4 h-4" />
          <span>Manual Entry Log</span>
        </button>
      </div>

      {/* High-density account sheet balance summary */}
      <div className="bg-white border border-zinc-200/60 rounded-[18px] p-4.5 mb-5 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="px-4 py-2 border-r border-zinc-150">
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Cumulative Income (Credits)</span>
          <div className="text-lg font-black text-[#16A34A] mt-0.5">₹{totalIncome.toLocaleString()}</div>
        </div>
        <div className="px-4 py-2 border-r border-zinc-150">
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Cumulative Expenses (Debits)</span>
          <div className="text-lg font-black text-rose-600 mt-0.5">₹{totalExpense.toLocaleString()}</div>
        </div>
        <div className="px-4 py-2">
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Net Operating Capital</span>
          <div className={`text-lg font-black mt-0.5 ${netCashFlow >= 0 ? "text-[#16A34A]" : "text-rose-700"}`}>
            ₹{netCashFlow.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Filter and toggle options */}
      <div className="flex items-center justify-between bg-white border border-zinc-200/60 p-3.5 rounded-[18px] mb-5 shadow-xs">
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-[12px] border border-zinc-200/50">
          {(["All", "Income", "Expense"] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-1.5 rounded-[10px] text-xs font-bold transition-all ${
                filterType === type 
                  ? "bg-[#062C1A] text-white shadow-xs" 
                  : "text-zinc-500 hover:text-[#062C1A]"
              }`}
            >
              {type === "All" ? "Full Ledger" : type === "Income" ? "Credits Only" : "Debits Only"}
            </button>
          ))}
        </div>

        <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider pl-1 flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5 text-zinc-300" />
          <span>Real-time Capital Sync Active</span>
        </div>
      </div>

      {/* Main ledger sheets sheet */}
      <div className="bg-white border border-zinc-200/60 rounded-[18px] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-left font-sans text-xs">
            <thead className="bg-[#062C1A]/5 text-[#062C1A] font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Transaction ID</th>
                <th className="px-5 py-3.5">Date & Timestamp</th>
                <th className="px-5 py-3.5">Account Ledger Category</th>
                <th className="px-5 py-3.5">Narrative Description</th>
                <th className="px-5 py-3.5">Cash Flow</th>
                <th className="px-5 py-3.5 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white font-medium text-zinc-700">
              {filteredFinances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-zinc-400 font-semibold">
                    No matching ledger transactions identified.
                  </td>
                </tr>
              ) : (
                filteredFinances.map(entry => {
                  const isIncome = entry.type === "Income";

                  return (
                    <tr key={entry.id} className="hover:bg-zinc-50/40 transition-colors">
                      {/* ID */}
                      <td className="px-5 py-4 font-bold text-zinc-900 font-mono text-xs">{entry.id}</td>

                      {/* Date */}
                      <td className="px-5 py-4 text-zinc-500 font-mono text-[10px]">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>

                      {/* Category */}
                      <td className="px-5 py-4">
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                          entry.category === "Order Revenue" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/15" :
                          entry.category === "Supplier Payment" ? "bg-amber-500/10 text-amber-700 border-amber-500/15" :
                          "bg-blue-500/10 text-blue-700 border-blue-500/15"
                        }`}>
                          {entry.category}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="px-5 py-4 text-zinc-700 font-medium max-w-sm truncate" title={entry.description}>
                        {entry.description}
                      </td>

                      {/* Flow status */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          isIncome ? "text-[#16A34A]" : "text-rose-600"
                        }`}>
                          {isIncome ? (
                            <>
                              <ArrowUpRight className="w-3 h-3 text-[#16A34A]" />
                              <span>Credit</span>
                            </>
                          ) : (
                            <>
                              <ArrowDownRight className="w-3 h-3 text-rose-500" />
                              <span>Debit</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className={`px-5 py-4 text-right font-black font-mono text-xs ${
                        isIncome ? "text-[#16A34A] font-extrabold" : "text-rose-700"
                      }`}>
                        {isIncome ? "+" : "-"} ₹{entry.amount.toLocaleString()}
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
  );
}
