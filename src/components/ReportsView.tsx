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

export const ReportsView = ({ user }: { user: User }) => {
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#141414]/60 backdrop-blur-md p-6 rounded-2xl border border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <FileText className="text-emerald-500" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Recent Intelligence Reports</h2>
            <p className="text-xs text-zinc-500">Historical cost analysis and provider comparisons.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input 
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors w-full md:w-64"
            />
          </div>
          <button className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-white transition-colors border border-white/5">
            <Filter size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredCalculations.length > 0 ? (
          filteredCalculations.map((calc) => (
            <div key={calc.id} className="group bg-[#141414]/60 backdrop-blur-md border border-white/5 p-6 rounded-2xl hover:border-emerald-500/30 transition-all duration-300">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                    <Cloud size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-white uppercase tracking-tight">{calc.cheapest_provider}</span>
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded uppercase tracking-widest">Optimized</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
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
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Monthly Total</div>
                    <div className="text-xl font-mono font-bold text-emerald-400">
                      ${calc.result_json?.provider_breakdowns?.find(b => b.is_cheapest)?.total_cost_monthly.toFixed(2)}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => api.export(user.token, calc.id, "pdf")}
                      className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-white transition-colors border border-white/5 flex items-center gap-2"
                    >
                      <Download size={18} />
                      <span className="text-xs font-bold hidden md:inline">PDF</span>
                    </button>
                    <button 
                      onClick={() => api.export(user.token, calc.id, "excel")}
                      className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-white transition-colors border border-white/5 flex items-center gap-2"
                    >
                      <ExternalLink size={18} />
                      <span className="text-xs font-bold hidden md:inline">Excel</span>
                    </button>
                    <button className="p-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl text-emerald-500 transition-colors border border-emerald-500/20">
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center p-20 bg-[#141414]/60 backdrop-blur-md rounded-2xl border border-white/5">
            <FileText size={48} className="text-zinc-700 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No Reports Found</h3>
            <p className="text-zinc-500">Start by creating your first infrastructure cost calculation.</p>
          </div>
        )}
      </div>
    </div>
  );
};
