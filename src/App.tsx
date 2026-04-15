import React, { useState, useEffect, useRef } from "react";
import { User } from "./types";
import { Login } from "./components/Login";
import { Sidebar } from "./components/Sidebar";
import { CalculatorView } from "./components/CalculatorView";
import { DashboardView } from "./components/DashboardView";
import { ReportsView } from "./components/ReportsView";
import { AdminView } from "./components/AdminView";
import { api } from "./api";
import { Loader2, Cloud } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState("dashboard");
  const [isCalculatorUnlocked, setIsCalculatorUnlocked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const vantaRef = useRef<HTMLDivElement>(null);
  const effectRef = useRef<any>(null);

  // Load user from localStorage on startup
  useEffect(() => {
    const savedUser = localStorage.getItem("calcus_user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Vanta Effect Logic
  useEffect(() => {
    let vantaTimeout: NodeJS.Timeout;
    
    const initVanta = () => {
      if (!effectRef.current && vantaRef.current && (window as any).VANTA) {
        try {
          effectRef.current = (window as any).VANTA.CLOUDS({
            el: vantaRef.current,
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200.00,
            minWidth: 200.00,
            speed: 1.0,
            skyColor: 0x0a192f,
            cloudColor: 0x87bbe3,
            cloudShadowColor: 0x183a5e,
            sunColor: 0xffffff,
            sunGlareColor: 0x3292e3,
            sunPosition: { x: 0, y: 0, z: 0 }
          });
        } catch (error) {
          console.error("Vanta initialization failed:", error);
        }
      } else if (!effectRef.current) {
        vantaTimeout = setTimeout(initVanta, 250);
      }
    };

    initVanta();

    return () => {
      if (vantaTimeout) clearTimeout(vantaTimeout);
      if (effectRef.current) {
        effectRef.current.destroy();
        effectRef.current = null;
      }
    };
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem("calcus_user", JSON.stringify(userData));
    setView("dashboard");
  };

  const handleLogout = () => {
    setUser(null);
    setIsCalculatorUnlocked(false);
    localStorage.removeItem("calcus_user");
  };

  const unlockCalculator = () => {
    setIsCalculatorUnlocked(true);
    setView("calculator");
  };

  return (
    <div className="min-h-screen text-zinc-300 font-sans selection:bg-emerald-500/30 selection:text-emerald-500 bg-transparent">
      <div ref={vantaRef} className="fixed inset-0 z-0 pointer-events-none" />
      
      <div className="relative z-10">
        {!user ? (
          <Login onLogin={handleLogin} />
        ) : (
          <>
            {/* Top Left Logo to open sidebar */}
            {!sidebarOpen && (
              <div 
                className="fixed top-6 left-6 z-40 flex items-center gap-3 cursor-pointer group bg-[#0a0a0a]/40 backdrop-blur-md p-3 rounded-2xl border border-white/5 hover:bg-[#0a0a0a]/60 transition-all"
                onClick={() => setSidebarOpen(true)}
              >
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                  <Cloud className="text-black w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-white font-bold tracking-tight">Cloud</h1>
                  <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Pricing Intelligence</p>
                </div>
              </div>
            )}

            <Sidebar 
              user={user} 
              view={view} 
              setView={setView} 
              onLogout={handleLogout}
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
              isCalculatorUnlocked={isCalculatorUnlocked}
            />

            <main className="min-h-screen flex flex-col pt-24">
              <div className={`flex-1 ${view === 'dashboard' ? 'p-4 lg:p-6' : 'max-w-7xl mx-auto p-4 lg:p-10 w-full'}`}>
                {view === "calculator" && <CalculatorView user={user} />}
                {view === "dashboard" && <DashboardView user={user} onOpenCalculator={unlockCalculator} />}
                {view === "reports" && <ReportsView user={user} />}
                {view === "admin" && <AdminView user={user} />}
              </div>
            </main>
          </>
        )}
      </div>
    </div>
  );
}
