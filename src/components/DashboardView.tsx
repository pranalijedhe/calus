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

export const DashboardView = ({ user, onOpenCalculator }: { user: User, onOpenCalculator: () => void }) => {
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
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
    <div className="h-full flex flex-col">
      {/* Enhanced Dashboard Header */}
      <div className="relative flex-1 min-h-[calc(100vh-4rem)] flex flex-col">
        <div className="absolute inset-0 flex flex-col items-center justify-start pt-32 text-center p-8 z-20">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/30 mb-6 backdrop-blur-sm">
            <Cloud className="text-emerald-500 w-10 h-10" />
          </div>
          <h2 className="text-5xl font-bold text-white tracking-tight mb-4">
            Welcome to Cloud Pricing Calculator
          </h2>
          <p className="text-xl text-zinc-300 max-w-2xl mb-8">
            Intelligent Cost Analysis Engine for multi-cloud infrastructure optimization.
          </p>
          <button 
            onClick={onOpenCalculator}
            className="px-10 py-5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-2xl transition-all shadow-xl shadow-emerald-500/20 flex items-center gap-3 text-lg group"
          >
            <BarChart3 size={24} className="group-hover:scale-110 transition-transform" />
            Start Calculating Now
          </button>
        </div>
      </div>
    </div>
  );
};
