import React from "react";
import { Settings, Shield, User, Bot, RefreshCw, CheckCircle, Wifi, Globe, Trash2 } from "lucide-react";

interface SettingsViewProps {
  onResetDatabase: () => void;
}

export default function SettingsView({ onResetDatabase }: SettingsViewProps) {
  
  const handleHardReset = () => {
    const confirmed = window.confirm("⚠ WARNING: DATABASE HARD RESET\nThis will restore the entire restaurant memory (Menu, Orders, Inventory, Customers, Suppliers, finances) back to default values.\n\nDo you want to proceed?");
    if (confirmed) {
      onResetDatabase();
      alert("✔ Restaurant Database restored back to default Spice Heaven records!");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAFAF8] p-6 overflow-y-auto font-sans select-none animate-fade-in">
      {/* View Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#062C1A] tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#16A34A]" />
          <span>System Settings & Integrations</span>
        </h1>
        <p className="text-xs text-zinc-500 mt-0.5">Configure restaurant details, test server-side AI connection, manage user permissions, and perform diagnostics.</p>
      </div>

      <div className="max-w-3xl space-y-6">
        
        {/* Profile Card */}
        <div className="bg-white border border-zinc-200/60 rounded-[18px] p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-[#062C1A] uppercase tracking-wide flex items-center gap-2 border-b border-zinc-150 pb-3">
            <User className="w-4 h-4 text-zinc-400" />
            <span>Restaurant Profile</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-zinc-600">
            <div>
              <label className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">Restaurant Name</label>
              <input 
                type="text" 
                defaultValue="Spice Heaven Restaurant" 
                className="w-full bg-[#FAFAF8] border border-zinc-200 px-3 py-2 rounded-[12px] focus:outline-none font-semibold text-zinc-800"
              />
            </div>
            <div>
              <label className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">Owner / Chief Operator</label>
              <input 
                type="text" 
                defaultValue="Chef Spice" 
                className="w-full bg-[#FAFAF8] border border-zinc-200 px-3 py-2 rounded-[12px] focus:outline-none font-semibold text-zinc-800"
              />
            </div>
            <div>
              <label className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">Primary Email Address</label>
              <input 
                type="email" 
                defaultValue="chef@spiceheaven.com" 
                className="w-full bg-[#FAFAF8] border border-zinc-200 px-3 py-2 rounded-[12px] focus:outline-none font-semibold text-zinc-800"
              />
            </div>
            <div>
              <label className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">Registered Address Line</label>
              <input 
                type="text" 
                defaultValue="23 Green Street, Hitech City, Hyderabad" 
                className="w-full bg-[#FAFAF8] border border-zinc-200 px-3 py-2 rounded-[12px] focus:outline-none font-semibold text-zinc-800"
              />
            </div>
          </div>
        </div>

        {/* AI OS Diagnostic Card */}
        <div className="bg-white border border-zinc-200/60 rounded-[18px] p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-[#062C1A] uppercase tracking-wide flex items-center gap-2 border-b border-zinc-150 pb-3">
            <Bot className="w-4 h-4 text-zinc-400" />
            <span>RestaurantOS AI Diagnostics</span>
          </h3>

          <div className="bg-[#FAFAF8] border border-zinc-150 p-4 rounded-[12px] space-y-3.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 font-medium flex items-center gap-1.5">
                <Wifi className="w-4 h-4 text-[#16A34A] animate-pulse" />
                Diagnostic Connection Status
              </span>
              <span className="font-extrabold text-[#16A34A] uppercase tracking-wider bg-[#16A34A]/10 border border-[#16A34A]/25 px-2 py-0.5 rounded text-[10px]">Connected</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-500 font-medium flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-[#16A34A]" />
                Operating System Gateway
              </span>
              <span className="font-mono text-zinc-600 font-bold bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded text-[10px]">Cloud Run Container Ingress</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-500 font-medium flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#16A34A]" />
                Gemini AI Engine Connection
              </span>
              <span className="font-bold text-zinc-700 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded text-[10px]">
                Google Gemini API SDK
              </span>
            </div>
          </div>
          <p className="text-[10px] text-zinc-400 leading-tight">All connections are handled server-side securely. Secrets can be managed inside the Secrets settings of Google AI Studio.</p>
        </div>

        {/* Database resets */}
        <div className="bg-rose-50/20 border border-rose-200/50 rounded-[18px] p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-rose-800 uppercase tracking-wide flex items-center gap-2 border-b border-rose-200/30 pb-3">
            <Trash2 className="w-4 h-4 text-rose-500" />
            <span>Danger Operational Actions</span>
          </h3>
          <p className="text-xs text-rose-700 font-medium leading-relaxed">
            Restoring the database state will destroy all orders logged, reset raw stock ingredients, settle supplier ledgers, and return Spice Heaven operating memory back to default values.
          </p>
          <button
            onClick={handleHardReset}
            className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-4 py-2.5 rounded-[12px] flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-md shadow-rose-600/10"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Restore Default Database Records</span>
          </button>
        </div>

      </div>
    </div>
  );
}
