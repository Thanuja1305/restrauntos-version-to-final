import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Utensils, 
  ArrowRight, 
  Sparkles, 
  Layers, 
  BadgeIndianRupee, 
  ShoppingBag, 
  BarChart3, 
  Chrome, 
  Eye, 
  EyeOff, 
  AlertCircle,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { motion } from "motion/react";

// Schema validation using Zod
const loginSchema = z.object({
  email: z.string().min(1, "Email address is required").email("Please enter a valid email format"),
  password: z.string().min(1, "Password is required").min(8, "Password must be at least 8 characters long"),
  rememberMe: z.boolean().optional()
});

type LoginSchemaType = z.infer<typeof loginSchema>;

interface LoginViewProps {
  onLoginSuccess: (token: string, user: { email: string; name: string; role: string }) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<LoginSchemaType>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false
    }
  });

  const handlePrefill = (emailVal: string, passVal: string) => {
    setValue("email", emailVal, { shouldValidate: true });
    setValue("password", passVal, { shouldValidate: true });
    setErrorMsg(null);
  };

  const onSubmit = async (data: LoginSchemaType) => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          password: data.password
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSuccessMsg("Login Successful. Redirecting to Dashboard...");
        // Wait 1.2s to show success feedback animation before updating state
        setTimeout(() => {
          onLoginSuccess(result.token, result.user);
        }, 1200);
      } else {
        setErrorMsg(result.error || "Invalid email or password.");
      }
    } catch (err) {
      console.error("Login failure:", err);
      setErrorMsg("Failed to connect to the authentication service. Please check your network.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-screen h-screen flex bg-zinc-50 overflow-hidden font-sans">
      {/* LEFT SIDE: 40% Login Form Area */}
      <div className="w-full lg:w-[40%] h-full flex flex-col justify-between p-8 sm:p-12 md:p-16 bg-white shadow-xl z-10 overflow-y-auto">
        {/* Top Header Row */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-600/10">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <div className="font-black text-zinc-900 text-base tracking-tight flex items-center gap-1.5">
              RestaurantOS <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded-full">AI</span>
            </div>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Manage. Serve. Grow.</p>
          </div>
        </div>

        {/* Center login form */}
        <div className="my-auto py-10 max-w-sm w-full mx-auto">
          <div className="space-y-1.5 mb-8">
            <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Welcome Back 👋</h1>
            <p className="text-xs text-zinc-500 font-medium">Sign in to manage your restaurant operations.</p>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700"
            >
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Authentication Failed</span>
                <p className="text-[11px] text-red-600/90 mt-0.5">{errorMsg}</p>
              </div>
            </motion.div>
          )}

          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Login Successful</span>
                <p className="text-[11px] text-emerald-700 mt-0.5">{successMsg}</p>
              </div>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email Address */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs text-zinc-700 font-bold uppercase tracking-wider block">
                Email Address
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="text"
                  placeholder="admin@restaurantos.ai"
                  {...register("email")}
                  disabled={isLoading}
                  autoComplete="email"
                  className={`w-full bg-zinc-50 text-xs text-zinc-800 font-semibold p-3.5 rounded-xl border transition-all placeholder-zinc-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 ${
                    errors.email 
                      ? "border-red-300 focus:border-red-500" 
                      : "border-zinc-200 focus:border-emerald-600"
                  }`}
                />
              </div>
              {errors.email && (
                <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                  <span>⚠️</span> {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs text-zinc-700 font-bold uppercase tracking-wider block">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => alert("Standard credentials are:\nEmail: admin@restaurantos.ai\nPassword: restaurant123")}
                  className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold transition-colors cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  {...register("password")}
                  disabled={isLoading}
                  autoComplete="current-password"
                  className={`w-full bg-zinc-50 text-xs text-zinc-800 font-semibold p-3.5 rounded-xl border transition-all placeholder-zinc-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 pr-11 ${
                    errors.password 
                      ? "border-red-300 focus:border-red-500" 
                      : "border-zinc-200 focus:border-emerald-600"
                  }`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer p-1.5 rounded-lg transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                  <span>⚠️</span> {errors.password.message}
                </p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  {...register("rememberMe")}
                  disabled={isLoading}
                  className="w-4 h-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs text-zinc-500 font-semibold">Remember me for 30 days</span>
              </label>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#16A34A] hover:bg-[#15803d] disabled:bg-[#16A34A]/50 text-white p-3.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/10 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-150"></div>
            </div>
            <span className="relative bg-white px-3 text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
              OR
            </span>
          </div>

          {/* Continue with Google */}
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              alert("Google single-sign-on integration is configured for production. For current active restaurant owner access, please sign in with: \n\nEmail: admin@restaurantos.ai\nPassword: restaurant123");
            }}
            className="w-full bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 p-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Chrome className="w-4 h-4 text-red-500" />
            <span>Continue with Google</span>
          </button>

          {/* Demo Account Indicator Info */}
          <button
            type="button"
            onClick={() => handlePrefill("admin@restaurantos.ai", "restaurant123")}
            className="mt-6 w-full text-left bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100 p-3 rounded-xl text-[11px] text-zinc-600 leading-normal transition-all duration-200 cursor-pointer block hover:border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            title="Click to auto-fill credentials"
          >
            <span className="font-extrabold text-emerald-800 flex items-center gap-1.5 mb-0.5">
              <span>💡</span> Click to Auto-fill Demo Credentials
            </span>
            Email: <strong className="text-emerald-700 font-extrabold">admin@restaurantos.ai</strong> | Password: <strong className="text-emerald-700 font-extrabold">restaurant123</strong>
          </button>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-zinc-100 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
          <div className="flex items-center gap-4">
            <a href="#privacy" className="hover:text-zinc-600 transition-colors">Privacy Policy</a>
            <span>•</span>
            <a href="#terms" className="hover:text-zinc-600 transition-colors">Terms of Service</a>
          </div>
          <div>
            <span>Version 1.0</span>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: 60% Hero Visual Cover & Feature Cards */}
      <div className="hidden lg:block lg:w-[60%] h-full relative bg-zinc-900">
        {/* Full cover restaurant visual background image */}
        <img 
          src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=1200" 
          alt="Fine Dining Culinary Kitchen" 
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        {/* Dark subtle radial gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-zinc-950/95 via-zinc-900/85 to-transparent"></div>

        {/* Content Layer */}
        <div className="absolute inset-0 flex flex-col justify-between p-16 xl:p-24 z-20">
          {/* Top Row badge */}
          <div className="flex justify-end">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 px-3.5 py-1.5 rounded-full flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] text-white font-extrabold uppercase tracking-wider">Powered by AI</span>
            </div>
          </div>

          {/* Central Title and Taglines */}
          <div className="space-y-6 max-w-xl">
            <div className="space-y-2">
              <h2 className="text-4xl xl:text-5xl font-black text-white tracking-tight">
                RestaurantOS <span className="text-emerald-400 font-bold">AI</span>
              </h2>
              <p className="text-sm xl:text-base text-zinc-300 font-medium leading-relaxed">
                Empowering world-class culinary venues with intelligent workflow automation, automated reports, dynamic order processing, and unified tracking.
              </p>
            </div>

            {/* List features bullet points */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3.5 text-xs text-zinc-300 font-bold uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Manage Orders</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Track Inventory</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Monitor Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Generate Reports</span>
              </div>
            </div>
          </div>

          {/* Four Informational Feature cards at the bottom */}
          <div className="grid grid-cols-4 gap-4">
            {/* Orders Card */}
            <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col justify-between gap-3 text-left">
              <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest">Orders</h4>
                <p className="text-[11px] text-white font-bold mt-0.5">Instant KDS Routing</p>
              </div>
            </div>

            {/* Inventory Card */}
            <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col justify-between gap-3 text-left">
              <div className="w-8 h-8 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest">Inventory</h4>
                <p className="text-[11px] text-white font-bold mt-0.5">Low Stock Triggers</p>
              </div>
            </div>

            {/* Finance Card */}
            <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col justify-between gap-3 text-left">
              <div className="w-8 h-8 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center">
                <BadgeIndianRupee className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest">Finance</h4>
                <p className="text-[11px] text-white font-bold mt-0.5">Automated Auditing</p>
              </div>
            </div>

            {/* Reports Card */}
            <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col justify-between gap-3 text-left">
              <div className="w-8 h-8 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest">Reports</h4>
                <p className="text-[11px] text-white font-bold mt-0.5">Intelligent Insights</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
