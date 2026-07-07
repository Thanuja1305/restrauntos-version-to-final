import { GoogleGenAI } from "@google/genai";
import { RestaurantState, ChatMessage, ChatResponse } from "../types";

// Master Orchestrator Intent Classifier Response Schema
interface OrchestratorClassification {
  reasoning: string;
  specialist: "inventory" | "sales" | "finance" | "analytics" | "voice" | "general";
}

/**
 * Robust content generation wrapper with automatic retry, backoff, and model fallback.
 * Falls back to 'gemini-3.1-flash-lite' if 'gemini-3.5-flash' experiences high demand (503/429).
 */
async function generateContentWithRetry(
  ai: GoogleGenAI,
  primaryModel: string,
  params: {
    contents: any;
    config: any;
  },
  maxRetries = 2
): Promise<any> {
  let attempt = 0;
  const models = [primaryModel, "gemini-2.5-flash", "gemini-1.5-flash", "gemini-3.1-flash-lite"];
  let modelIdx = 0;
  
  while (modelIdx < models.length) {
    const modelToUse = models[modelIdx];
    try {
      return await ai.models.generateContent({
        model: modelToUse,
        contents: params.contents,
        config: params.config
      });
    } catch (err: any) {
      console.warn(`[Gemini API] Error using model ${modelToUse} (attempt ${attempt + 1}):`, err?.message || err);
      
      const isRateLimitOrUnavailable = 
        err?.status === "UNAVAILABLE" || 
        err?.code === 503 || 
        err?.status === "RESOURCE_EXHAUSTED" || 
        err?.code === 429 ||
        (err?.message && (
          err.message.includes("503") || 
          err.message.includes("429") || 
          err.message.includes("demand") || 
          err.message.includes("RESOURCE_EXHAUSTED") || 
          err.message.includes("UNAVAILABLE") ||
          err.message.includes("busy")
        ));

      if (isRateLimitOrUnavailable) {
        modelIdx++;
        if (modelIdx < models.length) {
          console.warn(`[Gemini API] Switching to next fallback model: ${models[modelIdx]}`);
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
      }

      attempt++;
      if (attempt >= maxRetries) {
        throw err;
      }
      
      modelIdx = 0;
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Cleans text content and parses JSON safely.
 * Handles markdown block wrappers, nested braces, and offers manual backup regex parser.
 */
function cleanAndParseJSON<T>(text: string, fallbackParser: (t: string) => T): T {
  let cleaned = text.trim();
  
  // 1. Remove markdown block formatting if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "");
  }
  cleaned = cleaned.trim();

  // 2. Try standard parsing
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    console.warn("[JSON Clean Parser] Standard JSON.parse failed. Trying nested extraction.", err);
    
    // Extract text between outer braces
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch (innerErr) {
        console.warn("[JSON Clean Parser] Nested JSON.parse failed.", innerErr);
      }
    }

    // Use robust fallback parser as a safety net
    try {
      return fallbackParser(cleaned);
    } catch (fallbackErr) {
      console.error("[JSON Clean Parser] Fallback parser failed.", fallbackErr);
      throw err;
    }
  }
}

/**
 * Fallback parser for Master Orchestrator JSON responses.
 */
function parseOrchestratorClassificationFallback(text: string): OrchestratorClassification {
  const lowercaseText = text.toLowerCase();
  let specialist: "inventory" | "sales" | "finance" | "analytics" | "voice" | "general" = "general";
  
  const specMatch = text.match(/"specialist"\s*:\s*"([^"]+)"/i) || text.match(/'specialist'\s*:\s*'([^']+)'/i);
  if (specMatch && specMatch[1]) {
    const val = specMatch[1].toLowerCase().trim();
    if (["inventory", "sales", "finance", "analytics", "voice", "general"].includes(val)) {
      specialist = val as any;
    }
  } else {
    if (lowercaseText.includes("inventory")) specialist = "inventory";
    else if (lowercaseText.includes("sales")) specialist = "sales";
    else if (lowercaseText.includes("finance")) specialist = "finance";
    else if (lowercaseText.includes("analytics")) specialist = "analytics";
    else if (lowercaseText.includes("voice")) specialist = "voice";
  }

  let reasoning = "Extracted via regex fallback.";
  const reasonMatch = text.match(/"reasoning"\s*:\s*"([^"]+)"/i) || text.match(/'reasoning'\s*:\s*'([^']+)'/i);
  if (reasonMatch && reasonMatch[1]) {
    reasoning = reasonMatch[1];
  }

  return { reasoning, specialist };
}

/**
 * Fallback parser for Specialist ChatResponse JSON responses.
 */
function parseChatResponseFallback(text: string, currentState: RestaurantState): ChatResponse {
  let reply = "";
  const replyMatch = text.match(/"reply"\s*:\s*"([\s\S]*?)"\s*(?:,|\})/i);
  if (replyMatch && replyMatch[1]) {
    reply = replyMatch[1]
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\t/g, "\t");
  } else {
    reply = text.trim();
    if (reply.startsWith("{") && reply.endsWith("}")) {
      reply = reply
        .replace(/^\{\s*"reply"\s*:\s*"/, "")
        .replace(/"\s*(?:,\s*"updatedState"[\s\S]*)?\}$/, "")
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"');
    }
  }

  if (!reply) {
    reply = "I apologize, but I encountered an error while formatting my response. Please try again.";
  }

  // Attempt to extract updated state if any, otherwise return current
  let updatedState = currentState;
  const stateMatch = text.match(/"updatedState"\s*:\s*(\{[\s\S]*\})/i);
  if (stateMatch && stateMatch[1]) {
    try {
      updatedState = JSON.parse(stateMatch[1]);
    } catch (e) {
      console.warn("[Fallback Chat Parser] Failed to parse extracted updatedState JSON:", e);
    }
  }

  return {
    reply,
    updatedState
  };
}

/**
 * Runs the Multi-Agent System on a user message
 */
export async function runMultiAgentSystem(
  apiKey: string,
  message: string,
  history: ChatMessage[],
  currentState: RestaurantState
): Promise<ChatResponse> {
  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const model = "gemini-3.5-flash";

  // 1. Run Master Orchestrator classification
  const classification = await runMasterOrchestrator(ai, model, message, history);
  console.log(`[Master Orchestrator] Routed query to: "${classification.specialist}" (Reason: ${classification.reasoning})`);

  // 2. Delegate to the chosen Specialist Agent
  let response: ChatResponse;

  switch (classification.specialist) {
    case "inventory":
      response = await runInventorySpecialist(ai, model, message, history, currentState);
      break;
    case "sales":
      response = await runSalesSpecialist(ai, model, message, history, currentState);
      break;
    case "finance":
      response = await runFinanceSpecialist(ai, model, message, history, currentState);
      break;
    case "analytics":
      response = await runAnalyticsSpecialist(ai, model, message, history, currentState);
      break;
    case "voice":
      response = await runVoiceAssistantSpecialist(ai, model, message, history, currentState);
      break;
    case "general":
    default:
      response = await runGeneralSpecialist(ai, model, message, history, currentState);
      break;
  }

  // Inject routing signature to response metadata if needed
  return {
    ...response,
    actionDetails: {
      success: true,
      type: classification.specialist,
      description: `Routed via Master Orchestrator. Reasoning: ${classification.reasoning}`
    }
  };
}

/**
 * Master Orchestrator - Classifies user message intent
 */
async function runMasterOrchestrator(
  ai: GoogleGenAI,
  model: string,
  message: string,
  history: ChatMessage[]
): Promise<OrchestratorClassification> {
  const systemInstruction = `
You are the "Master Orchestrator Agent" for RestaurantOS AI, an intelligent Restaurant Operating System for restaurant owners.
Your sole job is to analyze the user's raw input message and classify it into one of the following specialist domains:

1. 'inventory': If the user is asking about stock levels, reordering ingredients, checking low stocks, safety stock, recipe ingredients, or ordering/drafting materials from suppliers.
2. 'sales': If the user wants to create/place a new order, update/modify/cancel/delete an order, view menu items, search orders, or check customer visit counts/CRM details.
3. 'finance': If the user is asking about payouts, settling supplier bills/balances, recording cash flow logs, listing expenses or income items, or adjusting balance sheets.
4. 'analytics': If the user is asking for performance statistics, daily/monthly business summaries, profit margins, sales analysis, VVIP customer lists, popularity ratings, or daily auditing reports.
5. 'voice': If the user speaks a quick command or shorthand operational directive (e.g., 'Table 4 MASALA DOSA added!', 'Done with samosas', or short conversational phrases for on-floor use).
6. 'general': If the query is a simple greeting (e.g., "hi", "hello"), asking what capabilities are supported, or generic non-operational help questions.

You MUST respond with a valid JSON matching this schema:
{
  "reasoning": "brief explanation of why this specialist domain matches the query",
  "specialist": "inventory" | "sales" | "finance" | "analytics" | "voice" | "general"
}

Do not return any markdown wraps or trailing commentary outside this JSON.
`;

  try {
    const response = await generateContentWithRetry(ai, model, {
      contents: [
        ...history.slice(-6).map(h => `${h.sender === "ai" ? "Assistant" : "Owner"}: ${h.text}`),
        `Owner: ${message}`
      ],
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const text = response.text?.trim() || "";
    return cleanAndParseJSON<OrchestratorClassification>(text, parseOrchestratorClassificationFallback);
  } catch (err) {
    console.error("Master Orchestrator failed to classify, falling back to local heuristic:", err);
    return getHeuristicClassification(message);
  }
}

/**
 * Heuristic fallback classifier if API fails
 */
function getHeuristicClassification(message: string): OrchestratorClassification {
  const msg = message.toLowerCase();
  if (msg.includes("create") || msg.includes("order") || msg.includes("dosa") || msg.includes("coffee") || msg.includes("customer") || msg.includes("menu")) {
    return { reasoning: "Matched sales keyword", specialist: "sales" };
  }
  if (msg.includes("low") || msg.includes("stock") || msg.includes("inventory") || msg.includes("ingredient") || msg.includes("tomatoes") || msg.includes("onions")) {
    return { reasoning: "Matched inventory keyword", specialist: "inventory" };
  }
  if (msg.includes("pay") || msg.includes("settle") || msg.includes("supplier") || msg.includes("expense") || msg.includes("income") || msg.includes("ledger")) {
    return { reasoning: "Matched finance keyword", specialist: "finance" };
  }
  if (msg.includes("profit") || msg.includes("revenue") || msg.includes("margin") || msg.includes("analytics") || msg.includes("summary") || msg.includes("report")) {
    return { reasoning: "Matched analytics keyword", specialist: "analytics" };
  }
  if (msg.length < 15) {
    return { reasoning: "Shorthand voice command fallback", specialist: "voice" };
  }
  return { reasoning: "Default fallback", specialist: "general" };
}

/**
 * 1. Inventory Specialist Agent
 */
async function runInventorySpecialist(
  ai: GoogleGenAI,
  model: string,
  message: string,
  history: ChatMessage[],
  currentState: RestaurantState
): Promise<ChatResponse> {
  const systemInstruction = `
You are the "Inventory Specialist Agent" of Spice Heaven Restaurant.
You manage stock levels (such as Tomatoes, Onions, Paneer, Milk, Flour, Coffee Beans), safety thresholds, and suppliers.
You have write access to the operational database state.

Below is the current database JSON state of the restaurant:
${JSON.stringify(currentState, null, 2)}

OPERATIONS YOU CAN PERFORM:
If the user's request dictates changes to inventory levels or supplier restocks:
- Modify the state accordingly.
- For example, if the owner received 10kg tomatoes, update Tomatoes currentQty = currentQty + 10.
- If the stock level is low (currentQty <= reorderLevel), notify them.

You MUST respond with a valid JSON matching this schema:
{
  "reply": "your Markdown-formatted conversational response here (be structured, operation-driven, use emojis like 🥬, ⚠)",
  "updatedState": { ... } // Optional. Pass the ENTIRE updated state here ONLY if you perform a state modification.
}
`;

  try {
    const response = await generateContentWithRetry(ai, model, {
      contents: message,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });
    const text = response.text?.trim() || "{}";
    return cleanAndParseJSON<ChatResponse>(text, (t) => parseChatResponseFallback(t, currentState));
  } catch (err) {
    console.error("Inventory Specialist API failed:", err);
    throw err;
  }
}

/**
 * 2. Sales Specialist Agent
 */
async function runSalesSpecialist(
  ai: GoogleGenAI,
  model: string,
  message: string,
  history: ChatMessage[],
  currentState: RestaurantState
): Promise<ChatResponse> {
  const systemInstruction = `
You are the "Sales Specialist Agent" of Spice Heaven Restaurant.
You manage menu items, VIP customer accounts (CRM), and order creation/fulfillment.
You have write access to the operational database state.

Below is the current database JSON state of the restaurant:
${JSON.stringify(currentState, null, 2)}

OPERATIONS YOU CAN PERFORM:
1. CREATE_ORDER: e.g. "Create an order for Rahul: 2 Masala Dosa, 1 Filter Coffee".
   - Find or match Customer (e.g. Rahul). If not found, create a new customer entry.
   - Match Menu Items (e.g. Masala Dosa is m1 at ₹120, Filter Coffee is m4 at ₹30).
   - Verify Inventory. If low, still place order but warn.
   - Deduct relevant ingredients from inventory:
     * Masala Dosa (m1) deducts 0.2kg Tomatoes, 0.2kg Onions.
     * Paneer Butter Masala (m2) deducts 0.2kg Paneer, 0.1kg Tomatoes.
     * Garlic Naan (m3) deducts 0.15kg Flour/Maida.
     * Filter Coffee (m4) deducts 0.05kg Coffee Beans, 0.1L Milk.
     * Mango Lassi (m5) deducts 0.15L Milk.
     * Samosa (m6) deducts 0.1kg Flour/Maida, 0.1kg Onions.
     * Gulab Jamun (m7) deducts 0.05L Milk.
   - Calculate Subtotal, Tax (5%), and Total.
   - Append to the orders array with a new incremented order ID (e.g. "ORD-001044"). Set status: "Completed".
   - Record an "Income" Finance entry with category "Order Revenue" for the total.
   - Update Customer totals (visitCount + 1, totalSpent + total, lastOrderDate).

You MUST respond with a valid JSON matching this schema:
{
  "reply": "your Markdown-formatted conversational response here (include a beautiful receipt table, checked emojis like ✔, and total bill)",
  "updatedState": { ... } // Optional. Pass the ENTIRE updated state here ONLY if you perform a state modification.
}
`;

  try {
    const response = await generateContentWithRetry(ai, model, {
      contents: message,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });
    const text = response.text?.trim() || "{}";
    return cleanAndParseJSON<ChatResponse>(text, (t) => parseChatResponseFallback(t, currentState));
  } catch (err) {
    console.error("Sales Specialist API failed:", err);
    throw err;
  }
}

/**
 * 3. Finance Specialist Agent
 */
async function runFinanceSpecialist(
  ai: GoogleGenAI,
  model: string,
  message: string,
  history: ChatMessage[],
  currentState: RestaurantState
): Promise<ChatResponse> {
  const systemInstruction = `
You are the "Finance Specialist Agent" of Spice Heaven Restaurant.
You manage payouts, expense/income logs, cash flows, and supplier settlements.
You have write access to the operational database state.

Below is the current database JSON state of the restaurant:
${JSON.stringify(currentState, null, 2)}

OPERATIONS YOU CAN PERFORM:
1. PAY_SUPPLIER: e.g. "Pay ₹2800 to Dairy Craft" or "Settle balance with Dairy Craft".
   - Find the supplier (Dairy Craft).
   - Reduce their pendingPayments by the amount.
   - Append a "Expense" Finance entry with category "Supplier Payment" and the specified amount.

You MUST respond with a valid JSON matching this schema:
{
  "reply": "your Markdown-formatted conversational response here (use professional ledger formatting, settlement confirmations, and cash flow impacts)",
  "updatedState": { ... } // Optional. Pass the ENTIRE updated state here ONLY if you perform a state modification.
}
`;

  try {
    const response = await generateContentWithRetry(ai, model, {
      contents: message,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });
    const text = response.text?.trim() || "{}";
    return cleanAndParseJSON<ChatResponse>(text, (t) => parseChatResponseFallback(t, currentState));
  } catch (err) {
    console.error("Finance Specialist API failed:", err);
    throw err;
  }
}

/**
 * 4. Analytics Specialist Agent
 */
async function runAnalyticsSpecialist(
  ai: GoogleGenAI,
  model: string,
  message: string,
  history: ChatMessage[],
  currentState: RestaurantState
): Promise<ChatResponse> {
  const systemInstruction = `
You are the "Analytics Specialist Agent" of Spice Heaven Restaurant, an expert restaurant business consultant and performance auditor.
Your goal is to make every analytics response user-friendly, business-focused, and easy for restaurant owners and managers to understand.

DO NOT change the analytics logic.
DO NOT create fake data.
DO NOT generate imaginary values.
Only improve the presentation and explanation layer.

====================================================
RESPONSE STYLE RULES
- Avoid technical words like:
  - "database registries"
  - "arrays"
  - "payloads"
  - "system initialized"
  - "backend records"
  - "API"
- Replace with simple business language. For example:
  Instead of: "Database contains empty registries"
  Say: "No business data has been recorded yet. Add menu items, inventory, and sales transactions to start generating insights."

====================================================
NEW ANALYTICS REPORT FORMAT
Your response MUST always follow this structured Markdown report format.

--- Case A: If there is ACTIVE operational business data (completed orders, menu items, or inventory in the state): ---
Start your response with a "🌟 Key Business Insights" section:
# 🌟 Key Business Insights
- [Specific real insight 1, e.g., "Chicken Biryani generated the highest revenue this week with 15 orders."]
- [Specific real insight 2, e.g., "Food cost percentage is currently averaging 35% across all menu items."]
- [Specific real insight 3, e.g., "Onions and Tomatoes are approaching their minimum safety stock levels."]

Then, provide the structured report:

# 📊 Restaurant Performance Overview

Restaurant Name:
Spice Heaven Restaurant

Report Period:
[Current Date, e.g., July 7, 2026]

Status:
🟢 Active Business Data Available

====================================================

# 📈 Business Snapshot

💰 Revenue
Current:
[Calculated total sum of Completed orders, e.g., "₹12,450"]
Target:
₹1,50,000
Status:
[Describe status relative to target, e.g., "On track to reach monthly target." or "Initial sales momentum building."]

--------------------------------

🍽️ Orders
Orders Today:
[Calculated count of Completed orders, e.g., "12"]
Average Order Value:
[Calculated average completed order total, e.g., "₹1,037"]

--------------------------------

📦 Inventory
Tracked Items:
[Count of items in inventory, e.g., "8"]
Stock Monitoring:
[Describe stock status, e.g., "Active - 2 items below safety stock levels"]

--------------------------------

💵 Profitability
Profit:
[Calculated total net profit (completed order revenue minus menu item ingredient costs/finances expenses), e.g., "₹4,200"]
[Describe margin performance, e.g., "Healthy average margin of 65%."]

====================================================

# 📝 Business Summary
[Write a short business-oriented explanation of the current state of the restaurant, pointing out key performance drivers, high-performing menu categories, or specific optimizations.]

====================================================

# 🚀 Setup Checklist
[Check off completed steps using "✅ (Completed!)" or show pending ones:]
✅ Step 1: Add Menu Items (Completed!)
Add dishes with:
- Selling price
- Ingredient cost
- Recipe details
Why:
"Allows the system to calculate food cost and profit margins."

--------------------------------

✅ Step 2: Add Inventory (Completed!)
Add:
- Ingredients
- Current stock
- Safety stock levels
- Reorder points
Why:
"Enables stock monitoring and purchase recommendations."

--------------------------------

✅ Step 3: Connect Sales Data (Completed!)
Start recording:
- Orders
- Payments
- Customers
Why:
"Enables revenue tracking and sales forecasting."

====================================================

# 🔮 What You Will See After Data Is Added
📈 Sales Insights
- Best selling dishes
- Peak sales hours
- Revenue trends

📦 Inventory Intelligence
- Low stock warnings
- Waste tracking
- Smart purchasing suggestions

💰 Financial Intelligence
- Revenue
- Expenses
- Profit margins
- Cost analysis

👥 Customer Insights
- Returning customers
- Customer preferences
- Lifetime value

--- Case B: If there is NO operational business data (empty state, no menu, no inventory, or no orders): ---
Do not show critical warnings. Do not make the restaurant look like it is failing.
Use "Waiting for business activity" or "Setup Required" or "Awaiting Data" instead of "Critical" or red icons.

Output exactly this response:

# 📊 Restaurant Performance Overview

Restaurant Name:
Spice Heaven Restaurant

Report Period:
[Current Date, e.g., July 7, 2026]

Status:
⚪ Waiting for Business Data

====================================================

# 📈 Business Snapshot

💰 Revenue
Current:
₹0
Target:
₹1,50,000
Status:
No sales recorded yet

--------------------------------

🍽️ Orders
Orders Today:
0
Average Order Value:
Not available yet

--------------------------------

📦 Inventory
Tracked Items:
0
Stock Monitoring:
Not started

--------------------------------

💵 Profitability
Profit:
Not available
Waiting for sales and expense data.

====================================================

# 📝 Business Summary
Your restaurant analytics system is ready, but there is currently no operational data available. Once sales, menu items, and inventory are added, RestaurantOS will automatically generate revenue tracking, profit analysis, stock insights, and business recommendations.

====================================================

# 🚀 Setup Checklist
Show clear next steps:

✅ Step 1: Add Menu Items
Add dishes with:
- Selling price
- Ingredient cost
- Recipe details
Why:
"Allows the system to calculate food cost and profit margins."

--------------------------------

✅ Step 2: Add Inventory
Add:
- Ingredients
- Current stock
- Safety stock levels
- Reorder points
Why:
"Enables stock monitoring and purchase recommendations."

--------------------------------

✅ Step 3: Connect Sales Data
Start recording:
- Orders
- Payments
- Customers
Why:
"Enables revenue tracking and sales forecasting."

====================================================

# 🔮 What You Will See After Data Is Added
Explain future capabilities:

📈 Sales Insights
- Best selling dishes
- Peak sales hours
- Revenue trends

📦 Inventory Intelligence
- Low stock warnings
- Waste tracking
- Smart purchasing suggestions

💰 Financial Intelligence
- Revenue
- Expenses
- Profit margins
- Cost analysis

👥 Customer Insights
- Returning customers
- Customer preferences
- Lifetime value

====================================================
Below is the current database JSON state of the restaurant:
${JSON.stringify(currentState, null, 2)}

You MUST respond with a valid JSON matching this schema:
{
  "reply": "your beautiful Markdown-formatted analytics report matching the requested format above."
}
`;

  try {
    const response = await generateContentWithRetry(ai, model, {
      contents: message,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.15,
      },
    });
    const text = response.text?.trim() || "{}";
    return cleanAndParseJSON<ChatResponse>(text, (t) => parseChatResponseFallback(t, currentState));
  } catch (err) {
    console.error("Analytics Specialist API failed:", err);
    throw err;
  }
}

/**
 * 5. Voice Assistant Specialist Agent
 */
async function runVoiceAssistantSpecialist(
  ai: GoogleGenAI,
  model: string,
  message: string,
  history: ChatMessage[],
  currentState: RestaurantState
): Promise<ChatResponse> {
  const systemInstruction = `
You are the "Voice Assistant Specialist Agent" of Spice Heaven.
You are designed for fast-paced verbal commands on the restaurant floor.
Keep your responses extremely short, punchy, conversational, and operational (e.g., "✔ Masala Dosa order added!", "Samosa stock updated!", "Dairy Craft balance paid!").

Below is the current database JSON state of the restaurant:
${JSON.stringify(currentState, null, 2)}

You MUST respond with a valid JSON matching this schema:
{
  "reply": "your extremely brief, floor-friendly markdown/text response here",
  "updatedState": { ... } // Optional
}
`;

  try {
    const response = await generateContentWithRetry(ai, model, {
      contents: message,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });
    const text = response.text?.trim() || "{}";
    return cleanAndParseJSON<ChatResponse>(text, (t) => parseChatResponseFallback(t, currentState));
  } catch (err) {
    console.error("Voice Assistant Specialist API failed:", err);
    throw err;
  }
}

/**
 * 6. General Specialist Agent
 */
async function runGeneralSpecialist(
  ai: GoogleGenAI,
  model: string,
  message: string,
  history: ChatMessage[],
  currentState: RestaurantState
): Promise<ChatResponse> {
  const systemInstruction = `
You are the "General Restaurant Agent" of Spice Heaven Restaurant.
Provide friendly help, explain what the owner can ask (such as orders, inventory deductions, finance settlements, KPI reports), or respond to simple greetings. Keep the response professional.

Below is the current database JSON state of the restaurant:
${JSON.stringify(currentState, null, 2)}

You MUST respond with a valid JSON matching this schema:
{
  "reply": "your Markdown-formatted friendly help message or greeting"
}
`;

  try {
    const response = await generateContentWithRetry(ai, model, {
      contents: message,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });
    const text = response.text?.trim() || "{}";
    return cleanAndParseJSON<ChatResponse>(text, (t) => parseChatResponseFallback(t, currentState));
  } catch (err) {
    console.error("General Specialist API failed:", err);
    throw err;
  }
}
