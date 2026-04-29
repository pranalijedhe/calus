import React, { useState, useEffect, useRef } from "react";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  DollarSign,
  Cloud,
  Clock
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { User, Calculation } from "../types";
import { api } from "../api";

export const DashboardView = ({ user, onOpenCalculator, theme }: { user: User; onOpenCalculator: () => void; theme: "light" | "dark" }) => {
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCalculations(user.token).then(res => {
      setCalculations(res.calculations);
      setLoading(false);
    });
  }, [user.token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const totalCalculations = calculations.length;
  const totalMonthlyCost = calculations.reduce((acc, curr) => {
    const cheapest = curr.result_json?.provider_breakdowns?.find(b => b.is_cheapest);
    return acc + (cheapest?.total_cost_monthly || 0);
  }, 0);

  const providerDistribution = calculations.reduce((acc: any, curr) => {
    const provider = curr.cheapest_provider;
    acc[provider] = (acc[provider] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.keys(providerDistribution).map(key => ({
    name: key,
    value: providerDistribution[key]
  }));

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];

  const recentCalculations = [...calculations].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).slice(0, 5);

  return (
    <div className={`h-full flex flex-col ${theme === "dark" ? "bg-[#07101c]" : "bg-secondary-100"}`}>
      {/* Enhanced Dashboard Header */}
      <div className={`relative flex-1 min-h-[calc(100vh-4rem)] flex flex-col ${theme === "dark" ? "bg-slate-950/95 border border-slate-700 shadow-2xl" : "bg-white shadow-xl rounded-4xl border border-slate-200"}`}>
        <div className={theme === "dark" ? "absolute inset-0 bg-linear-to-br from-[#06121f] via-[#081826] to-[#0d1117] opacity-95" : "absolute inset-0 bg-linear-to-br from-primary-50 via-white to-secondary-100"} />
        <div className={`relative flex flex-col items-center justify-start pt-32 text-center p-8 z-20 ${theme === "dark" ? "text-slate-100" : "text-primary-900"}`}>
          <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center border border-slate-700/80 mb-6 shadow-xl shadow-slate-950/40">
            <Cloud className="text-primary-300 w-10 h-10" />
          </div>
          <h2 className={`text-5xl font-bold tracking-tight mb-4 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
            Welcome to Cloud Pricing Calculator
          </h2>
          <p className={`text-xl max-w-2xl mb-8 ${theme === "dark" ? "text-white/80" : "text-slate-600"}`}>
            Intelligent Cost Analysis Engine for multi-cloud infrastructure optimization.
          </p>
          <button 
            onClick={onOpenCalculator}
            className={`px-10 py-5 font-bold rounded-2xl transition-all flex items-center gap-3 text-lg group hover:scale-[1.01] ${
              theme === "dark"
                ? "bg-primary-500 text-slate-950 shadow-xl shadow-primary/20"
                : "bg-sky-600 text-white shadow-xl shadow-sky-300/30 hover:bg-sky-700"
            }`}
          >
            <BarChart3 size={24} className="group-hover:scale-110 transition-transform" />
            Start Calculating Now
          </button>
        </div>
      </div>
    </div>
  );
};
