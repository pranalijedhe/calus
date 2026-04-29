import React, { useState } from "react";
import { motion } from "motion/react";
import { Cloud, AlertCircle, Loader2 } from "lucide-react";
import { User } from "../types";
import { api } from "../api";

export const Login = ({ onLogin, theme }: { onLogin: (user: User) => void; theme: "light" | "dark" }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await api.login(email, password);
      onLogin(user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-linear-to-br from-[#0b1220] via-[#111c2c] to-[#0d1117] text-slate-100 flex-col justify-center items-center p-12">
        <div className="max-w-md space-y-6">
          <h1 className="text-5xl font-bold tracking-tight">Cloud</h1>
          <p className="text-2xl text-sky-300">Pricing Intelligence</p>
          <p className="text-lg text-slate-300">Cloud Pricing Calculator</p>
          <div className="mt-8 space-y-2 text-slate-300">
            <p>✓ Multi-cloud cost comparison</p>
            <p>✓ Reserved instance analysis</p>
            <p>✓ AI-powered recommendations</p>
            <p>✓ Budget tracking & alerts</p>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-card-foreground">Sign In</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Access the cloud pricing intelligence platform
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-card-foreground">Email Address</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none transition-colors text-base bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-card-foreground">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none transition-colors text-base bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 disabled:text-primary-foreground/50 text-primary-foreground font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};


