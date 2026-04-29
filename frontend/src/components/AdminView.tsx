import React, { useState, useEffect } from "react";
import { 
  Shield, 
  Users, 
  Settings, 
  Activity,
  Search,
  Plus,
  MoreVertical,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { User } from "../types";
import { api } from "../api";

export const AdminView = ({ user, theme }: { user: User; theme: "light" | "dark" }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", role: "user" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers(user.token);
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [user]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      await api.register(user.token, newUser.email, newUser.password, newUser.role);
      setShowAddModal(false);
      setNewUser({ email: "", password: "", role: "user" });
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (id?: string) => {
    if (!id) return;
    setError("");
    try {
      await api.deleteUser(user.token, id);
      await fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-8 ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}>
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl border ${theme === "dark" ? "bg-slate-900/95 border-slate-700" : "bg-secondary-50 backdrop-blur-md border border-secondary-200"}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-500/10 rounded-lg border border-primary-500/20">
            <Shield className="text-primary-500" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Admin Control Panel</h2>
            <p className="text-xs text-gray-500">Manage users, system configuration, and data integrity.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowAddModal(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm font-bold ${theme === "dark" ? "bg-secondary text-slate-950 hover:bg-yellow-400" : "bg-primary-500 hover:bg-primary-600 text-black"}`}
          >
            <Plus size={18} />
            <span>Add User</span>
          </button>
          <button className={`p-2 rounded-xl transition-colors border ${theme === "dark" ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700" : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-white/10 hover:text-gray-900"}`}>
            <Settings size={20} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
          {error}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={`w-full max-w-md space-y-6 rounded-2xl p-8 shadow-2xl ${theme === "dark" ? "bg-slate-900/95 border border-slate-700" : "bg-white backdrop-blur-md border border-gray-200"}`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Add New User</h3>
              <button onClick={() => setShowAddModal(false)} className={`transition-colors ${theme === "dark" ? "text-slate-300 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}>
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="space-y-2">
                <label className={`text-xs font-bold uppercase tracking-widest ${theme === "dark" ? "text-slate-300" : "text-gray-500"}`}>Email Address</label>
                <input 
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className={`w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors ${theme === "dark" ? "bg-slate-800 border border-slate-700 text-slate-100 focus:border-secondary/50" : "bg-gray-50 backdrop-blur-sm border border-gray-200 text-gray-900 focus:border-primary-500/50"}`}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Password</label>
                <input 
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full bg-gray-50 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Role</label>
                <select 
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full bg-gray-50 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-500/20 disabled:text-primary-500/50 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? "Creating..." : "Create User"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stats removed as per request */}
      </div>

      <div className="bg-white backdrop-blur-md border border-gray-200 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-gray-900">User Management</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input 
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-gray-50 backdrop-blur-sm border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors w-full md:w-64"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-200">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Last Login</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((u, idx) => (
                <tr key={u.id || idx} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center text-primary-500 font-bold text-xs">
                        {u.email[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{u.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${u.role === 'admin' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-primary-500">
                      <CheckCircle2 size={14} />
                      <span className="text-xs font-semibold">Active</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    Today, 14:24
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-900 transition-colors">
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        disabled={!u.id || u.email === "admin@jadeglobal.com"}
                        className="p-2 hover:bg-red-400/5 rounded-lg text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={16} />
                      </button>
                      <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-900 transition-colors">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
