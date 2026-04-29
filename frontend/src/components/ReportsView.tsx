import React, { useState, useEffect } from "react";
import { 
  History, 
  Search, 
  Download, 
  ExternalLink, 
  Cloud,
  ChevronRight,
  Filter,
  Calendar,
  FileText
} from "lucide-react";
import { User, Calculation } from "../types";
import { api } from "../api";

export const ReportsView = ({ user, theme }: { user: User; theme: "light" | "dark" }) => {
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    api.getCalculations(user.token).then(res => {
      setCalculations(res.calculations);
      setLoading(false);
    });
  }, [user.token]);

  const filteredCalculations = calculations.filter(calc => 
    calc.cheapest_provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
    calc.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}>
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl border ${theme === "dark" ? "bg-slate-900/95 border-slate-700" : "bg-secondary-50 backdrop-blur-md border border-secondary-200"}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-500/10 rounded-lg border border-primary-500/20">
            <FileText className="text-primary-500" size={20} />
          </div>
          <div>
            <h2 className={`text-lg font-bold ${theme === "dark" ? "text-slate-100" : "text-gray-900"}`}>Recent Intelligence Reports</h2>
            <p className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-gray-500"}`}>Historical cost analysis and provider comparisons.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme === "dark" ? "text-slate-400" : "text-gray-500"}`} size={16} />
            <input 
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full md:w-64 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none transition-colors ${theme === "dark" ? "bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-primary/50" : "bg-gray-50 backdrop-blur-sm border border-gray-200 text-gray-900 focus:border-primary-500/50"}`}
            />
          </div>
          <button className={`p-2 rounded-xl transition-colors border ${theme === "dark" ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700" : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-white/10 hover:text-gray-900"}`}>
            <Filter size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredCalculations.length > 0 ? (
          filteredCalculations.map((calc) => (
            <div key={calc.id} className={`group p-6 rounded-2xl transition-all duration-300 ${theme === "dark" ? "bg-slate-900/95 border border-slate-700 hover:border-primary/40" : "bg-white backdrop-blur-md border border-gray-200 hover:border-primary-500/30"}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-500 group-hover:scale-110 transition-transform">
                    <Cloud size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-bold uppercase tracking-tight ${theme === "dark" ? "text-slate-100" : "text-gray-900"}`}>{calc.cheapest_provider}</span>
                      <span className="px-2 py-0.5 bg-primary-500/10 text-primary-500 text-[10px] font-bold rounded uppercase tracking-widest">Optimized</span>
                    </div>
                    <div className={`flex items-center gap-3 text-xs ${theme === "dark" ? "text-slate-400" : "text-gray-500"}`}>
                      <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        <span>{new Date(calc.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <History size={12} />
                        <span>{new Date(calc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <div className={`text-[10px] uppercase font-bold tracking-widest mb-1 ${theme === "dark" ? "text-slate-400" : "text-gray-500"}`}>Monthly Total</div>
                    <div className="text-xl font-mono font-bold text-primary-400">
                      ${calc.result_json?.provider_breakdowns?.find(b => b.is_cheapest)?.total_cost_monthly.toFixed(2)}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => api.export(user.token, calc.id, "pdf")}
                      className={`p-2.5 rounded-xl transition-colors border flex items-center gap-2 ${theme === "dark" ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white" : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-white/10 hover:text-gray-900"}`}
                    >
                      <Download size={18} />
                      <span className="text-xs font-bold hidden md:inline">PDF</span>
                    </button>
                    <button 
                      onClick={() => api.export(user.token, calc.id, "excel")}
                      className={`p-2.5 rounded-xl transition-colors border flex items-center gap-2 ${theme === "dark" ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white" : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-white/10 hover:text-gray-900"}`}
                    >
                      <ExternalLink size={18} />
                      <span className="text-xs font-bold hidden md:inline">Excel</span>
                    </button>
                    <button className="p-2.5 bg-primary-500/10 hover:bg-primary-500/20 rounded-xl text-primary-500 transition-colors border border-primary-500/20">
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className={`flex flex-col items-center justify-center p-20 rounded-2xl border ${theme === "dark" ? "bg-slate-900/95 border-slate-700" : "bg-white backdrop-blur-md border border-gray-200"}`}>
            <FileText size={48} className={`${theme === "dark" ? "text-slate-400" : "text-zinc-700"} mb-4`} />
            <h3 className={`text-xl font-bold mb-2 ${theme === "dark" ? "text-slate-100" : "text-gray-900"}`}>No Reports Found</h3>
            <p className={`${theme === "dark" ? "text-slate-400" : "text-gray-500"}`}>Start by creating your first infrastructure cost calculation.</p>
          </div>
        )}
      </div>
    </div>
  );
};
