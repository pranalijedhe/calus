import { 
  User, 
  Provider, 
  Region, 
  ComputePricing, 
  StoragePricing, 
  DatabasePricing, 
  NetworkingPricing, 
  Calculation 
} from "./types";

const API_BASE = "/api/v1";

export const api = {
  async login(email: string, password: string): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "Invalid credentials");
    }
    return res.json();
  },
  async register(token: string, email: string, password: string, role: string = "user"): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ email, password, role }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "Registration failed");
    }
    return res.json();
  },
  async getUsers(token: string): Promise<User[]> {
    const res = await fetch(`${API_BASE}/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },
  async getProviders(token: string): Promise<Provider[]> {
    const res = await fetch(`${API_BASE}/providers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },
  async getRegions(token: string, providerId: string): Promise<Region[]> {
    const res = await fetch(`${API_BASE}/providers/${providerId}/regions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },
  async getComputePricing(token: string, providerId: string, regionId: string): Promise<ComputePricing[]> {
    const res = await fetch(`${API_BASE}/pricing/compute?provider_id=${providerId}&region_id=${regionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },
  async getStoragePricing(token: string, providerId: string, regionId: string): Promise<StoragePricing[]> {
    const res = await fetch(`${API_BASE}/pricing/storage?provider_id=${providerId}&region_id=${regionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },
  async getDatabasePricing(token: string, providerId: string, regionId: string): Promise<DatabasePricing[]> {
    const res = await fetch(`${API_BASE}/pricing/database?provider_id=${providerId}&region_id=${regionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },
  async getNetworkingPricing(token: string, providerId: string, regionId: string): Promise<NetworkingPricing[]> {
    const res = await fetch(`${API_BASE}/pricing/networking?provider_id=${providerId}&region_id=${regionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },
  async calculate(token: string, data: any): Promise<Calculation> {
    const res = await fetch(`${API_BASE}/calculations`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (typeof result.result_json === 'string') {
      try {
        result.result_json = JSON.parse(result.result_json);
      } catch (e) {
        result.result_json = { provider_breakdowns: [] };
      }
    }
    return result;
  },
  async getCalculations(token: string): Promise<{ calculations: Calculation[] }> {
    const res = await fetch(`${API_BASE}/calculations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { calculations: [] };
    const data = await res.json();
    if (data && Array.isArray(data.calculations)) {
      data.calculations = data.calculations.map((c: any) => {
        if (typeof c.result_json === 'string') {
          try {
            c.result_json = JSON.parse(c.result_json);
          } catch (e) {
            c.result_json = { provider_breakdowns: [] };
          }
        }
        return c;
      });
      return data;
    }
    return { calculations: [] };
  },
  async export(token: string, id: string, format: "pdf" | "excel") {
    const res = await fetch(`${API_BASE}/export/calculations/${id}/${format}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `calcus_report_${id}.${format === "pdf" ? "pdf" : "xlsx"}`;
    a.click();
  }
};
