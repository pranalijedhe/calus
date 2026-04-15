export interface User {
  user_id: string;
  email: string;
  role: string;
  token: string;
}

export interface Provider {
  id: string;
  name: string;
}

export interface Region {
  id: string;
  provider_id: string;
  region_code: string;
  region_name: string;
  availability_zones: string[];
}

export interface ComputePricing {
  id: string;
  provider_id: string;
  region_id: string;
  instance_type: string;
  os_type: string;
  price_per_hour: number;
  price_per_month: number;
  vcpu: number;
  memory_gb: number;
}

export interface StoragePricing {
  id: string;
  provider_id: string;
  region_id: string;
  storage_type: string;
  storage_name: string;
  price_per_gb_month: number;
}

export interface DatabasePricing {
  id: string;
  provider_id: string;
  region_id: string;
  db_engine: string;
  instance_class: string;
  price_per_hour: number;
  vcpu: number;
  memory_gb: number;
}

export interface NetworkingPricing {
  id: string;
  provider_id: string;
  region_id: string;
  service_type: string;
  price_per_unit: number;
  unit: string;
}

export interface Calculation {
  id: string;
  cheapest_provider: string;
  aws_total_monthly: number;
  azure_total_monthly: number;
  gcp_total_monthly: number;
  duration_months: number;
  created_at: string;
  result_json: {
    provider_breakdowns: {
      provider_name: string;
      compute_cost_monthly: number;
      storage_cost_monthly: number;
      database_cost_monthly: number;
      networking_cost_monthly: number;
      total_cost_monthly: number;
      total_cost_annual: number;
      is_cheapest: boolean;
    }[];
  };
}
