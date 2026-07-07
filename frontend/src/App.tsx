import React, { useState, useEffect } from "react";
import { RestaurantState, ChatMessage, Order, MenuItem, InventoryItem, Supplier, FinanceEntry } from "./types";
import Sidebar from "./components/Sidebar";
import RightPanel from "./components/RightPanel";
import AgentView from "./components/AgentView";
import InventoryView from "./components/InventoryView";
import SalesView from "./components/SalesView";
import FinanceView from "./components/FinanceView";
import AnalyticsView from "./components/AnalyticsView";
import SettingsView from "./components/SettingsView";
import LoginView from "./components/LoginView";
import { Bot, RefreshCw } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("agent");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init-welcome",
      sender: "ai",
      text: "Hello! I'm your **Restaurant Agent** 🤖. I can help you manage orders, inventory, finance, customers, suppliers and reports through natural language. Try asking me to create a new order, show low stock items, show daily profit, or settle supplier balances!",
      timestamp: new Date().toISOString()
    }
  ]);
  const [isSending, setIsSending] = useState<boolean>(false);

  // User Authentication State
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [user, setUser] = useState<{ email: string; name: string; role: string } | null>(() => {
    const storedUser = localStorage.getItem("user");
    try {
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  const handleLoginSuccess = (newToken: string, newUser: { email: string; name: string; role: string }) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  // Core synchronized restaurant state
  const [restaurantState, setRestaurantState] = useState<RestaurantState>({
    menu: [],
    inventory: [],
    orders: [],
    customers: [],
    suppliers: [],
    finances: []
  });

  const [isLoadingState, setIsLoadingState] = useState<boolean>(true);

  // Fetch live database state from server on mount
  useEffect(() => {
    fetchState();
  }, []);

  const fetchState = async () => {
    try {
      const res = await fetch("/api/state");
      if (res.ok) {
        const data = await res.json();
        setRestaurantState(data);
      }
    } catch (err) {
      console.error("Failed to fetch initial restaurant state:", err);
    } finally {
      setIsLoadingState(false);
    }
  };

  // Sync any manual state updates back to server
  const syncStateWithServer = async (updated: RestaurantState) => {
    setRestaurantState(updated);
    try {
      await fetch("/api/state/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      });
    } catch (err) {
      console.error("Failed to sync updated state with server:", err);
    }
  };

  // Handle database resets
  const handleResetDatabase = async () => {
    try {
      const res = await fetch("/api/state/reset", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setRestaurantState(data.state);
        // Add status log
        setMessages(prev => [
          ...prev,
          {
            id: `reset-${Date.now()}`,
            sender: "ai",
            text: "✔ **System database reset successfully.** Reverted to fresh Spice Heaven restaurant records.",
            timestamp: new Date().toISOString()
          }
        ]);
      }
    } catch (err) {
      console.error("Failed to reset database:", err);
    }
  };

  // Log a manual financial credit/debit transaction
  const handleAddFinancialLog = (
    type: "Income" | "Expense",
    category: any,
    amount: number,
    description: string
  ) => {
    const newEntry: FinanceEntry = {
      id: "f" + (restaurantState.finances.length + 1),
      timestamp: new Date().toISOString(),
      type,
      category,
      amount,
      description
    };
    const updated = {
      ...restaurantState,
      finances: [newEntry, ...restaurantState.finances]
    };
    syncStateWithServer(updated);
  };

  // Send prompt to Gemini AI agent
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isSending) return;

    const userMsg: ChatMessage = {
      id: `owner-${Date.now()}`,
      sender: "owner",
      text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: [...messages, userMsg],
          currentState: restaurantState
        })
      });

      if (response.ok) {
        const data = await response.json();
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          text: data.reply,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, aiMsg]);
        if (data.updatedState) {
          setRestaurantState(data.updatedState);
        }
      } else {
        throw new Error("Chat server error");
      }
    } catch (err) {
      console.error("Error communicating with AI Agent:", err);
      // Fallback fallback response
      setMessages(prev => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: "ai",
          text: "❌ **Failed to connect to AI brain.** Please check that your server is running and your API key is correctly configured in Settings > Secrets.",
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  // Clicking right panel templates/history triggers agent prompt
  const handleTriggerPrompt = (prompt: string) => {
    setActiveTab("agent");
    handleSendMessage(prompt);
  };

  // Render correct content pane depending on active tab
  const renderMainContent = () => {
    if (isLoadingState) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#FAFAF8] text-zinc-400 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs font-semibold">Booting Restaurant AI Operating System...</p>
        </div>
      );
    }

    switch (activeTab) {
      case "agent":
        return (
          <AgentView 
            messages={messages} 
            onSendMessage={handleSendMessage} 
            isSending={isSending} 
            onTriggerPrompt={handleTriggerPrompt}
            restaurantState={restaurantState}
            onResetDatabase={handleResetDatabase}
          />
        );
      case "inventory":
        return (
          <InventoryView 
            inventory={restaurantState.inventory} 
            suppliers={restaurantState.suppliers}
            menu={restaurantState.menu}
            orders={restaurantState.orders}
            onUpdateInventory={(inventory) => syncStateWithServer({ ...restaurantState, inventory })}
            onUpdateMenu={(menu) => syncStateWithServer({ ...restaurantState, menu })}
            onUpdateOrders={(orders) => syncStateWithServer({ ...restaurantState, orders })}
            onUpdateState={(updatedState) => syncStateWithServer(updatedState)}
            onAddLog={handleAddFinancialLog}
          />
        );
      case "sales":
        return (
          <SalesView 
            orders={restaurantState.orders} 
            menu={restaurantState.menu}
            customers={restaurantState.customers}
            inventory={restaurantState.inventory}
            onUpdateState={(updatedState) => syncStateWithServer(updatedState)}
            onUpdateOrders={(orders) => syncStateWithServer({ ...restaurantState, orders })}
            onAddLog={handleAddFinancialLog}
            setActiveTab={setActiveTab}
          />
        );
      case "finance":
        return (
          <FinanceView 
            finances={restaurantState.finances}
            onAddLog={handleAddFinancialLog}
          />
        );
      case "analytics":
        return (
          <AnalyticsView 
            restaurantState={restaurantState}
          />
        );
      case "settings":
        return (
          <SettingsView 
            onResetDatabase={handleResetDatabase}
          />
        );
      default:
        return (
          <div className="flex-1 flex items-center justify-center bg-[#FAFAF8]">
            <p className="text-zinc-400 text-xs font-medium">Module under development.</p>
          </div>
        );
    }
  };

  if (!token) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="w-screen h-screen flex overflow-hidden bg-[#FAFAF8] antialiased">
      {/* Left Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        restaurantState={restaurantState}
        onLogout={handleLogout}
        user={user}
      />

      {/* Main Container */}
      <main className="flex-1 flex h-full min-w-0 relative">
        {renderMainContent()}

        {/* Right Utility Panel - shown exclusively on AI Agent home tab to give full widescreen spread on other high-density datagrids */}
        {activeTab === "agent" && (
          <RightPanel 
            onTriggerPrompt={handleTriggerPrompt} 
            restaurantState={restaurantState}
          />
        )}
      </main>
    </div>
  );
}
