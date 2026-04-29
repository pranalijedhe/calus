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
  theme: "light" | "dark";
}

export const Sidebar = ({ user, view, setView, onLogout, sidebarOpen, setSidebarOpen, isCalculatorUnlocked, theme }: SidebarProps) => {
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
    <aside className={`h-full w-80 border-r ${theme === "dark" ? "bg-[#090f1d] border-[#16203a] text-slate-100 shadow-[0_24px_60px_rgba(0,0,0,0.25)]" : "bg-white border-slate-200 text-slate-900 shadow-sm"}`}>
      <div className="p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-10">
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <div className={`${theme === "dark" ? "bg-primary/10 shadow-lg shadow-primary/10" : "bg-slate-100"} w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform`}>
              <Cloud className={`${theme === "dark" ? "text-primary-300" : "text-primary-600"} w-6 h-6`} />
            </div>
            <div>
              <h1 className={`${theme === "dark" ? "text-card-foreground" : "text-slate-900"} font-bold tracking-tight`}>Cloud</h1>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${theme === "dark" ? "text-primary" : "text-slate-500"}`}>Pricing Intelligence</p>
            </div>
          </div>
        </div>

        <nav className="space-y-1 flex-1">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                view === item.id 
                  ? theme === "dark"
                    ? "bg-[#14213b] text-primary-300 border-l-4 border-primary-500 shadow-inner shadow-primary/10"
                    : "bg-slate-100 text-slate-900 border-l-4 border-primary-500"
                  : theme === "dark"
                    ? "text-slate-300 hover:text-white hover:bg-[#111a2d]"
                    : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <item.icon size={20} className={view === item.id ? (theme === "dark" ? "text-primary-300" : "text-primary-600") : (theme === "dark" ? "group-hover:text-white" : "group-hover:text-slate-900 text-slate-500")} />
              <span className="text-sm font-semibold">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className={`pt-6 border-t ${theme === "dark" ? "border-[#16203a]" : "border-slate-200"}`}>
          <div className={`flex items-center gap-3 px-4 py-3 mb-4 rounded-xl border ${theme === "dark" ? "border-[#1d2740] bg-[#0f172a]" : "border-slate-200 bg-slate-50"}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${theme === "dark" ? "text-primary bg-primary/15" : "text-primary-600 bg-primary/10"}`}>
              {user.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold truncate ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}>{user.email}</p>
              <p className={`text-[10px] uppercase font-bold tracking-widest ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>{user.role}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${theme === "dark" ? "text-slate-300 hover:text-white hover:bg-[#111a2d]" : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"}`}
          >
            <LogOut size={20} />
            <span className="text-sm font-semibold">Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
