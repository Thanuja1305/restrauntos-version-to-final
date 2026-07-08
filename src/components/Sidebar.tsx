import React, { useState } from "react";
import { 
  Bot, 
  ShoppingBag, 
  Warehouse, 
  Coins, 
  LineChart, 
  Settings, 
  LogOut,
  Menu,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  restaurantState: {
    orders: any[];
    inventory: any[];
  };
  onLogout?: () => void;
  user?: { email: string; name: string; role: string } | null;
}

export default function Sidebar({ activeTab, setActiveTab, restaurantState, onLogout, user }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    { id: "agent", label: "AI Agent", icon: Bot },
    { id: "inventory", label: "Inventory", icon: Warehouse, badge: restaurantState.inventory.filter(i => i.currentQty <= i.reorderLevel).length ? "Low" : undefined },
    { id: "sales", label: "Sales", icon: ShoppingBag, badge: restaurantState.orders.filter(o => o.status === "Pending").length || undefined },
    { id: "finance", label: "Finance", icon: Coins },
    { id: "analytics", label: "Analytics", icon: LineChart },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const handleTabSelect = (tab: string) => {
    setActiveTab(tab);
    setMobileOpen(false);
  };

  const SidebarContent = () => (
    <aside id="sidebar-container" className="w-full bg-[#062C1A] text-zinc-100 flex flex-col justify-between h-full border-r border-white/5 font-sans relative z-10 select-none">
      {/* Top Brand Logo */}
      <div className="p-6 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#16A34A] rounded-[8px] flex items-center justify-center text-white font-bold shrink-0">
            <span className="font-bold text-base">R</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-1.5">
              RestaurantOS <span className="text-emerald-400 font-extrabold text-[10px] bg-white/10 px-1.5 py-0.5 rounded-md border border-white/10">AI</span>
            </h1>
            <p className="text-[10px] text-white/50 font-medium tracking-wider uppercase mt-0.5">Manage • Serve • Grow</p>
          </div>
        </div>
        {/* Close button on mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Navigation links */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
        <div className="text-[10px] text-white/40 font-semibold tracking-wider uppercase px-3 mb-2">OPERATING SYSTEM</div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabSelect(item.id)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-[12px] text-sm font-medium transition-all duration-200 relative group cursor-pointer ${
                isActive 
                  ? "text-white font-semibold shadow-sm bg-white/10" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-3 relative z-10">
                <Icon className={`w-4 h-4 transition-colors ${isActive ? "text-white" : "text-white/40 group-hover:text-emerald-400"}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full relative z-10 border ${
                  item.badge === "Low" 
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse" 
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                }`}>
                  {item.badge}
                </span>
              )}
              {isActive && (
                <motion.div 
                  layoutId="active-indicator" 
                  className="absolute inset-0 bg-white/10 rounded-[12px] -z-0" 
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Profile Details */}
      <div className="p-4 border-t border-white/5 space-y-3 bg-[#062C1A]/95">
        {/* Restaurant Badge details */}
        <div className="bg-white/5 p-3 rounded-[14px] border border-white/10 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white truncate max-w-[140px]">Spice Heaven</span>
            <span className="flex items-center gap-1 text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
              Active
            </span>
          </div>
          <p className="text-[10px] text-white/50 leading-tight">23 Green Street, Hitech City, Hyderabad</p>
          <div className="pt-1.5 border-t border-white/5 flex flex-col gap-0.5 text-[9px] text-white/40 font-mono">
            <div>GSTIN: 36ABCDE1234F1Z5</div>
            <div>FSSAI: 13620012000456</div>
          </div>
        </div>

        {/* Profile details */}
        <div className="flex items-center justify-between gap-3 bg-white/5 p-3 rounded-[18px] border border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-full bg-emerald-700 border border-emerald-500/50 flex items-center justify-center shrink-0 font-extrabold text-white relative uppercase">
              {user?.name ? user.name.split(" ").map(n => n[0]).join("") : "CS"}
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#062C1A] rounded-full" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-semibold text-white truncate">{user?.name || "The Spice Garden"}</h4>
              <p className="text-[10px] text-white/50 truncate">{user?.email || "Chef Spice (Owner)"}</p>
            </div>
          </div>
          <button 
            onClick={() => {
              if (onLogout) {
                onLogout();
              } else {
                alert("Simulated logout - Database connection remains active.");
              }
            }}
            className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-200 cursor-pointer"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile Hamburger Button — visible only on small screens */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 bg-[#062C1A] text-white rounded-xl flex items-center justify-center shadow-lg border border-white/10"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Desktop Sidebar — always visible on lg+ */}
      <div className="hidden lg:flex w-[280px] shrink-0 h-full">
        <SidebarContent />
      </div>

      {/* Mobile Overlay Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            {/* Drawer */}
            <motion.div
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="lg:hidden fixed top-0 left-0 w-[280px] h-full z-50"
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
