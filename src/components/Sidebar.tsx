import React from "react";
import { 
  Calculator, 
  FileText, 
  Shield, 
  LogOut, 
  Cloud, 
  LayoutDashboard,
  Menu,
  X
} from "lucide-react";
import { User } from "../types";

interface SidebarProps {
  user: User;
  view: string;
  setView: (view: string) => void;
  onLogout: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isCalculatorUnlocked: boolean;
}

export const Sidebar = ({ user, view, setView, onLogout, sidebarOpen, setSidebarOpen, isCalculatorUnlocked }: SidebarProps) => {
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "calculator", label: "Calculator", icon: Calculator, hidden: !isCalculatorUnlocked },
    { id: "reports", label: "Reports", icon: FileText, advanced: true },
    { id: "admin", label: "Admin", icon: Shield, adminOnly: true, advanced: true },
  ];

  const filteredItems = menuItems.filter(item => {
    if (item.hidden) return false;
    if (item.adminOnly && user.role !== "admin") return false;
    if (item.advanced && !showAdvanced) return false;
    return true;
  });

  return (
    <>
      {/* Overlay for mobile/desktop when sidebar is open */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Content */}
      <aside className={`fixed top-0 left-0 bottom-0 w-64 bg-[#0a0a0a]/60 backdrop-blur-xl border-r border-white/5 z-50 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-10">
            <div 
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <Cloud className="text-black w-6 h-6" />
              </div>
              <div>
                <h1 className="text-white font-bold tracking-tight">Cloud</h1>
                <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Pricing Intelligence</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="text-zinc-400 hover:text-white p-1">
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-1 flex-1">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setView(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  view === item.id 
                    ? "bg-emerald-500/10 text-emerald-500" 
                    : "text-zinc-500 hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon size={20} className={view === item.id ? "text-emerald-500" : "group-hover:text-white"} />
                <span className="text-sm font-semibold">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="pt-6 border-t border-white/5">
            <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-white/5 rounded-xl border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-bold text-xs">
                {user.email[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{user.email}</p>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">{user.role}</p>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-zinc-500 hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all group"
            >
              <LogOut size={20} />
              <span className="text-sm font-semibold">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
