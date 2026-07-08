<div align="center">

<br/>

# 🍽️ RestaurantOS AI

### *The AI-Powered Operating System for Modern Restaurants*

[![Live Demo](https://img.shields.io/badge/🚀%20Live%20Demo-Vercel-black?style=for-the-badge)](https://restrauntos-version-to-final.vercel.app)
[![Backend](https://img.shields.io/badge/🔧%20Backend%20API-Render-46E3B7?style=for-the-badge)](https://restrauntos-version-to-final.onrender.com)
[![Built with](https://img.shields.io/badge/Built%20with-Gemini%20AI-4285F4?style=for-the-badge&logo=google)](https://ai.google.dev)
[![License](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)](LICENSE)

<br/>

> **RestaurantOS AI** is a full-stack, AI-powered restaurant management system that lets restaurant owners manage orders, inventory, finance, suppliers, and analytics — all through natural language conversation with a Gemini AI Agent.

<br/>

</div>

---

## ✨ Features

| Module | Description |
|---|---|
| 🤖 **AI Agent** | Chat with a Gemini-powered assistant to manage anything — create orders, audit stock, check finances — all in plain English |
| 📦 **Inventory Hub** | Track ingredient stock levels, safety reorder limits, toggle menu recipe prices, and manage kitchen prep queues |
| 🧾 **Sales & Billing** | Create new orders, generate customer invoices, filter/search order history, and print thermal receipts |
| 💰 **Finance Ledger** | Full credit/debit cash-flow ledger — track income from sales and expenses from supplier settlements |
| 📊 **Analytics Dashboard** | Live business KPIs, revenue analysis, profit margins, menu performance, and ingredient cost breakdowns |
| ⚙️ **Settings** | Configure restaurant profile, manage AI integration, run diagnostics, and reset the demo database |
| 🔐 **Authentication** | JWT-based login system with role-based access and session persistence |
| 🎙️ **Voice Input** | Browser speech recognition for hands-free AI command entry (Indian English optimized) |
| 📱 **Fully Responsive** | Adapts to all screen sizes — mobile, tablet, and desktop with a slide-in hamburger drawer |

---

## 🖥️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 19** + **TypeScript** | UI framework |
| **Vite 6** | Build tool & dev server |
| **Tailwind CSS v4** | Utility-first styling |
| **Framer Motion** | Animations & transitions |
| **Lucide React** | Icon library |
| **React Hook Form** + **Zod** | Form validation |

### Backend
| Technology | Purpose |
|---|---|
| **FastAPI** | Python REST API framework |
| **Uvicorn** | ASGI server |
| **Google Gemini AI** (`google-genai`) | AI Agent reasoning & orchestration |
| **Supabase (PostgreSQL)** | Cloud database |
| **PyJWT** | JWT authentication tokens |
| **Pydantic v2** | Request/response schema validation |

### Deployment
| Service | Role |
|---|---|
| **Vercel** | Frontend hosting + static build |
| **Render** | FastAPI backend hosting |
| **Supabase** | Managed PostgreSQL database |

---

## 🏗️ Project Architecture

```
restaurantOs/
├── src/                         # React frontend
│   ├── components/
│   │   ├── AgentView.tsx        # AI chat interface with voice input
│   │   ├── Sidebar.tsx          # Responsive sidebar with mobile drawer
│   │   ├── RightPanel.tsx       # Quick commands & live status panel
│   │   ├── InventoryView.tsx    # Stock levels, menu & prep management
│   │   ├── SalesView.tsx        # Orders, billing & invoicing
│   │   ├── FinanceView.tsx      # Cash flow ledger
│   │   ├── AnalyticsView.tsx    # Business KPIs & analytics
│   │   ├── SettingsView.tsx     # System configuration
│   │   ├── LoginView.tsx        # Authentication UI
│   │   ├── MarkdownRenderer.tsx # AI response markdown renderer
│   │   └── ErrorBoundary.tsx    # Graceful error handling
│   ├── services/                # API client utilities
│   ├── lib/                     # Shared helpers
│   ├── types.ts                 # TypeScript type definitions
│   └── App.tsx                  # Root application with state management
│
├── backend/
│   ├── app/
│   │   ├── agents/              # Gemini AI orchestrator & tools
│   │   ├── api/                 # FastAPI route handlers
│   │   ├── schemas.py           # Pydantic data models
│   │   ├── supabase_client.py   # Supabase DB connection
│   │   ├── config.py            # Environment configuration
│   │   └── main.py              # FastAPI app entry point
│   ├── run_supervisor.py        # Uvicorn server launcher
│   └── requirements.txt         # Python dependencies
│
├── api/                         # Vercel serverless function bridge
├── vercel.json                  # Vercel deployment config
├── vite.config.ts               # Vite dev proxy config
└── package.json                 # Node.js dependencies
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18+
- **Python** 3.10+
- A **Gemini API Key** → [Get one here](https://aistudio.google.com/app/apikey)
- A **Supabase** project with PostgreSQL → [supabase.com](https://supabase.com)

---

### 1. Clone the Repository

```bash
git clone https://github.com/Thanuja1305/restrauntos-version-to-final.git
cd restrauntos-version-to-final
```

---

### 2. Set Up Environment Variables

Copy the example file and fill in your secrets:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Supabase PostgreSQL connection string
DATABASE_URL="postgresql://postgres:[password]@[host]:5432/postgres"

# Google Gemini AI API Key
GEMINI_API_KEY="your-gemini-api-key-here"

# Your deployed app URL (used for internal API references)
APP_URL="http://localhost:5173"
```

---

### 3. Install Frontend Dependencies

```bash
npm install
```

---

### 4. Install Backend Dependencies

```bash
pip install -r backend/requirements.txt
```

---

### 5. Run Locally

Open **two terminals**:

**Terminal 1 — Start the FastAPI backend:**
```bash
python backend/run_supervisor.py
```
> Backend runs on `http://127.0.0.1:8000`

**Terminal 2 — Start the Vite dev server:**
```bash
npm run dev
```
> Frontend runs on `http://localhost:5173` (proxies `/api/*` to the backend)

---

### 6. Login

Open [http://localhost:5173](http://localhost:5173) and use the demo credentials:

| Field | Value |
|---|---|
| **Email** | `admin@restaurantos.ai` |
| **Password** | `restaurant123` |

---

## 🤖 AI Agent Capabilities

The Gemini AI Agent can handle natural language commands like:

```
"Show today's sales summary"
"Create an order for Rahul — 2 Masala Dosa, 1 Filter Coffee"
"What items are low on stock?"
"Show today's profit"
"Settle outstanding balance with Dairy Craft"
"Generate a daily operational report"
"Show the top 5 customers today"
"List all pending orders"
```

The agent has access to **live database tools** — it reads and writes to Supabase PostgreSQL in real time.

---

## 🌐 Deployment

### Frontend → Vercel

The `vercel.json` is pre-configured:
- `/api/*` requests are proxied to the Render backend
- All other routes fall back to `index.html` for client-side routing

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://restrauntos-version-to-final.onrender.com/api/:path*" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

### Backend → Render

Deploy the `backend/` directory as a **Python Web Service** on Render:
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `python run_supervisor.py`
- Set all environment variables (`DATABASE_URL`, `GEMINI_API_KEY`) in the Render dashboard

---

## 📸 Screenshots

### 🔐 Login Page
Clean, split-panel auth screen with demo credential auto-fill.

### 🤖 AI Agent (Home)
Chat interface with voice input, quick-action suggestion cards, and live restaurant status panel.

### 📦 Inventory Management
Stock level tracker with low-stock alerts, menu price editor, and kitchen prep queue.

### 🧾 Sales & Billing
Order management table with invoice modal, status filters, and receipt printing simulation.

### 💰 Finance Ledger
Full income/expense ledger with cumulative balance, entry filtering, and manual transaction logging.

### 📊 Analytics
Revenue KPI cards, profit margin analysis, top-selling items, and operational health summary.

---

## 👥 Team

Built with 💚 by a passionate team for the AI Hackathon:

| Name | Role |
|---|---|
| 👩‍💻 **Thanuja** | Full-Stack Lead · AI Integration · Backend Architecture |
| 👩‍💻 **Shivani Gundlapalli** | Frontend Development · UI/UX Design |
| 👩‍💻 **Akshitha Kota** | Backend Development · Database & API |
| 👩‍💻 **Srija Reddy Mamidi** | AI Agent Design · Testing & QA |

---

## 🙏 Acknowledgements

- [Google Gemini AI](https://ai.google.dev) — AI Agent reasoning engine
- [Supabase](https://supabase.com) — PostgreSQL database platform
- [Vercel](https://vercel.com) — Frontend deployment
- [Render](https://render.com) — Backend deployment
- [Framer Motion](https://www.framer.com/motion/) — UI animations
- [Tailwind CSS](https://tailwindcss.com) — Styling framework
- [Lucide Icons](https://lucide.dev) — Icon set

---

<div align="center">

**Built with ❤️ for the AI Hackathon**

*Team RestaurantOS — Thanuja · Shivani · Akshitha · Srija*

[🚀 Live Demo](https://restrauntos-version-to-final.vercel.app) • [🐛 Report Bug](https://github.com/Thanuja1305/restrauntos-version-to-final/issues) • [💡 Request Feature](https://github.com/Thanuja1305/restrauntos-version-to-final/issues)

</div>
