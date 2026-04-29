import React, { useState, useEffect } from "react";
import { User } from "./types";
import { Login } from "./components/Login";
import { Sidebar } from "./components/Sidebar";
import { CalculatorView } from "./components/CalculatorView";
import { DashboardView } from "./components/DashboardView";
import { ReportsView } from "./components/ReportsView";
import { AdminView } from "./components/AdminView";
import { Cloud } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState("dashboard");
  const [isCalculatorUnlocked, setIsCalculatorUnlocked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedUser = localStorage.getItem("calcus_user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    const storedTheme = localStorage.getItem("calcus_theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("calcus_theme", theme);
  }, [theme]);

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

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const unlockCalculator = () => {
    setIsCalculatorUnlocked(true);
    setView("calculator");
  };

  return (
    <div
      className={`min-h-screen font-sans selection:bg-primary/20 selection:text-primary-foreground ${
        theme === "dark"
          ? "dark bg-[#0d1117] text-slate-100"
          : "bg-slate-50 text-slate-900"
      }`}
    >
      <div className="relative">
        <button
          onClick={toggleTheme}
          className={`fixed top-6 right-6 z-40 rounded-2xl px-4 py-2 text-sm font-semibold transition-all bg-card text-card-foreground border border-border hover:bg-accent hover:text-accent-foreground`}
        >
          {theme === "dark" ? "Light Theme" : "Dark Theme"}
        </button>

        {!user ? (
          <Login onLogin={handleLogin} theme={theme} />
        ) : (
          <div className="flex h-screen">
            <Sidebar
              user={user}
              view={view}
              setView={setView}
              onLogout={handleLogout}
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
              isCalculatorUnlocked={isCalculatorUnlocked}
              theme={theme}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
              <main className="flex-1 overflow-y-auto p-6">
                {view === "calculator" && <CalculatorView user={user} theme={theme} />}
                {view === "dashboard" && <DashboardView user={user} onOpenCalculator={unlockCalculator} theme={theme} />}
                {view === "reports" && <ReportsView user={user} theme={theme} />}
                {view === "admin" && <AdminView user={user} theme={theme} />}
              </main>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
