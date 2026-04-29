import React, { useState, useEffect, useMemo } from "react";
import { 
  Calculator, 
  Cloud, 
  Database, 
  Cpu, 
  TrendingDown, 
  BarChart3,
  Loader2,
  Plus,
  Minus,
  Network,
  Server,
  Layers,
  Info,
  Download,
  X,
  Check,
  Trash2,
  Search
} from "lucide-react";
import { motion } from "motion/react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { User, Provider, Region, ComputePricing, StoragePricing, DatabasePricing, NetworkingPricing, Calculation } from "../types";
import { api } from "../api";

const VCPU_OPTIONS = [1, 2, 4, 8, 16, 32, 48, 64, 96, 128];
const MEMORY_OPTIONS = [
  { label: "1 GiB", value: 1 },
  { label: "2 GiB", value: 2 },
  { label: "4 GiB", value: 4 },
  { label: "8 GiB", value: 8 },
  { label: "16 GiB", value: 16 },
  { label: "32 GiB", value: 32 },
  { label: "48 GiB", value: 48 },
  { label: "64 GiB", value: 64 },
  { label: "96 GiB", value: 96 },
  { label: "128 GiB", value: 128 },
  { label: "192 GiB", value: 192 },
  { label: "256 GiB", value: 256 },
  { label: "384 GiB", value: 384 },
  { label: "512 GiB", value: 512 },
  { label: "768 GiB", value: 768 },
  { label: "1024 GiB", value: 1024 }
];

const PROVIDER_SERVICES: Record<string, { label: string, value: string, type: string }[]> = {
  "aws": [
    { label: "EC2 Instances", value: "ec2", type: "compute" },
    { label: "RDS", value: "rds", type: "database" },
    { label: "S3 Storage", value: "s3", type: "storage" },
    { label: "EKS", value: "eks", type: "compute" },
    { label: "DynamoDB", value: "dynamodb", type: "storage" },
    { label: "EBS", value: "ebs", type: "storage" },
    { label: "Route53", value: "route53", type: "networking" },
    { label: "VPC", value: "vpc", type: "networking" },
    { label: "Load Balancer", value: "elb", type: "networking" },
    { label: "Lambda", value: "lambda", type: "compute" }
  ],
  "azure": [
    { label: "Virtual Machines", value: "vm", type: "compute" },
    { label: "Azure SQL Database", value: "sql", type: "database" },
    { label: "Blob Storage", value: "blob", type: "storage" },
    { label: "Container Instances", value: "aci", type: "compute" },
    { label: "AKS Kubernetes", value: "aks", type: "compute" },
    { label: "Cosmos DB", value: "cosmos", type: "database" }
  ],
  "gcp": [
    { label: "Compute Engine", value: "ce", type: "compute" },
    { label: "Google Kubernetes Engine (GKE)", value: "gke", type: "compute" },
    { label: "Cloud Run", value: "run", type: "compute" },
    { label: "App Engine", value: "appengine", type: "compute" },
    { label: "Cloud Functions", value: "functions", type: "compute" }
  ]
};

const getProviderServiceKey = (providerId: string, providers: Provider[]) => {
  const providerName = providers.find((p) => p.id === providerId)?.name || "";
  const normalized = `${providerId} ${providerName}`.toLowerCase();
  if (normalized.includes("aws") || normalized.includes("amazon")) return "aws";
  if (normalized.includes("azure") || normalized.includes("microsoft")) return "azure";
  if (normalized.includes("gcp") || normalized.includes("google")) return "gcp";
  return "aws";
};

const CUSTOM_COMPUTE_SERVICES = ["eks", "lambda", "ce", "gke", "run", "appengine", "functions"];

const APP_ENGINE_INSTANCE_CLASS_RATES: Record<string, number> = {
  F1: 0.05,
  F2: 0.10,
  F4: 0.20,
  F4_1G: 0.30
};

const HOURS_PER_MONTH = 730;

const getGceSudTierMultipliers = (instanceType: string) => {
  const normalized = instanceType.toLowerCase();
  if (normalized.startsWith("n1-") || normalized === "f1-micro" || normalized === "g1-small") {
    return [1, 0.8, 0.6, 0.4];
  }
  if (normalized.startsWith("n2-") || normalized.startsWith("n2d-") || normalized.startsWith("c2-")) {
    return [1, 0.8678, 0.733, 0.6];
  }
  return null;
};

const calculateGceComputeCost = ({
  hourlyRate,
  hoursPerMonth,
  quantity,
  instanceType,
  applySustainedUseDiscount
}: {
  hourlyRate: number;
  hoursPerMonth: number;
  quantity: number;
  instanceType: string;
  applySustainedUseDiscount: boolean;
}) => {
  const safeRate = Math.max(0, hourlyRate || 0);
  const safeHours = Math.min(HOURS_PER_MONTH, Math.max(0, hoursPerMonth || 0));
  const safeQuantity = Math.max(0, quantity || 0);
  const baseCost = safeRate * safeHours * safeQuantity;

  if (!applySustainedUseDiscount) {
    return { cost: baseCost, baseCost, savings: 0, applied: false };
  }

  const tierMultipliers = getGceSudTierMultipliers(instanceType);
  if (!tierMultipliers) {
    return { cost: baseCost, baseCost, savings: 0, applied: false };
  }

  const tierHours = HOURS_PER_MONTH / 4;
  let remainingHours = safeHours;
  let discountedCostPerInstance = 0;

  for (const multiplier of tierMultipliers) {
    const hoursInTier = Math.min(remainingHours, tierHours);
    if (hoursInTier <= 0) break;
    discountedCostPerInstance += hoursInTier * safeRate * multiplier;
    remainingHours -= hoursInTier;
  }

  const discountedCost = discountedCostPerInstance * safeQuantity;
  return {
    cost: discountedCost,
    baseCost,
    savings: Math.max(0, baseCost - discountedCost),
    applied: true
  };
};

const calculateS3StorageCost = (size: number, unit: string) => {
  const totalGb = unit === "TB" ? size * 1024 : size;
  let cost = 0;
  if (totalGb <= 50 * 1024) {
    cost = totalGb * 0.023;
  } else if (totalGb <= 500 * 1024) {
    cost = (50 * 1024 * 0.023) + ((totalGb - 50 * 1024) * 0.022);
  } else {
    cost = (50 * 1024 * 0.023) + (450 * 1024 * 0.022) + ((totalGb - 500 * 1024) * 0.021);
  }
  return cost;
};

const calculateRoute53HostedZoneCost = (zones: number) => {
  const first25 = Math.min(zones, 25);
  const additional = Math.max(0, zones - 25);
  return (first25 * 0.5) + (additional * 0.1);
};

const convertToMillionsPerMonth = (value: number, unit: string) => {
  if (unit === "billion per month") return value * 1000;
  return value;
};

const calculateRoute53QueryCost = (queriesMillions: number, pricePerMillion: number) => {
  const tier1 = Math.min(queriesMillions, 1000);
  const tier2 = Math.min(Math.max(0, queriesMillions - 1000), 4000);
  const tier3 = Math.max(0, queriesMillions - 5000);
  return (tier1 * pricePerMillion) + (tier2 * (pricePerMillion * 0.5)) + (tier3 * (pricePerMillion * 0.25));
};

const durationToHoursPerMonth = (value: number, unit: string) => {
  if (unit === "hours per day") return value * 30.44;
  if (unit === "hours per week") return value * 4.345;
  return value;
};

const requestUnitsToCount = (value: number, unit: string) => {
  if (unit === "million per month") return value * 1_000_000;
  if (unit === "billion per month") return value * 1_000_000_000;
  return value;
};

const snapshotsPerMonthFromFrequency = (frequency: string) => {
  switch (frequency) {
    case "No snapshot storage":
      return 0;
    case "Hourly":
      return 730;
    case "Daily":
      return 30;
    case "2x Daily":
      return 60;
    case "3x Daily":
      return 90;
    case "4x Daily":
      return 120;
    case "6x Daily":
      return 180;
    case "Weekly":
      return 4;
    case "Monthly":
      return 1;
    default:
      return 0;
  }
};

type PricingModel = "on-demand" | "reserved-1yr" | "reserved-3yr" | "spot";

type CalculationRequestPayload = {
  compute_selections: any[];
  storage_selections: any[];
  database_selections: any[];
  networking_selections: any[];
  eks_selections: any[];
  custom_compute_selections: any[];
  duration_months: number;
  pricing_model: PricingModel;
};

type SavedService = {
  id: string;
  signature: string;
  providerId: string;
  providerName: string;
  regionId: string;
  regionName: string;
  service: string;
  serviceLabel: string;
  monthlyTotal: number;
  breakdown: {
    compute: number;
    storage: number;
    database: number;
    networking: number;
  };
  payload: CalculationRequestPayload;
};

const getPricingModelMultiplier = (model: PricingModel) => {
  if (model === "reserved-1yr") return 0.7;
  if (model === "reserved-3yr") return 0.4;
  if (model === "spot") return 0.3;
  return 1.0;
};

const getDurationMonthsForPricingModel = (model: PricingModel) => {
  if (model === "reserved-1yr") return 12;
  if (model === "reserved-3yr") return 36;
  return 1;
};

const createEmptyCalculationPayload = (pricingModel: PricingModel): CalculationRequestPayload => ({
  compute_selections: [],
  storage_selections: [],
  database_selections: [],
  networking_selections: [],
  eks_selections: [],
  custom_compute_selections: [],
  duration_months: getDurationMonthsForPricingModel(pricingModel),
  pricing_model: pricingModel
});

const mergeCalculationPayloads = (
  payloads: CalculationRequestPayload[],
  pricingModel: PricingModel
): CalculationRequestPayload => {
  const merged = createEmptyCalculationPayload(pricingModel);

  for (const payload of payloads) {
    merged.compute_selections.push(...(payload.compute_selections || []));
    merged.storage_selections.push(...(payload.storage_selections || []));
    merged.database_selections.push(...(payload.database_selections || []));
    merged.networking_selections.push(...(payload.networking_selections || []));
    merged.eks_selections.push(...(payload.eks_selections || []));
    merged.custom_compute_selections.push(...(payload.custom_compute_selections || []));
  }

  return merged;
};

export const CalculatorView = ({ user, theme }: { user: User; theme: "light" | "dark" }) => {
  const handleNumberFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.select();
  };

  const handleGlobalNumberFocus = (e: React.FocusEvent<HTMLElement>) => {
    const target = e.target as HTMLInputElement | null;
    if (target && target.tagName === "INPUT" && target.type === "number") {
      target.select();
    }
  };

  const [providers, setProviders] = useState<Provider[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedAZ, setSelectedAZ] = useState<string>("");
  const [selectedService, setSelectedService] = useState<string>("ec2");
  
  const [loadingPricing, setLoadingPricing] = useState(false);
  
  const providerServiceKey = getProviderServiceKey(selectedProvider, providers);
  const currentServices = PROVIDER_SERVICES[providerServiceKey] || PROVIDER_SERVICES["aws"];
  const currentServiceType = currentServices.find(s => s.value === selectedService)?.type || "compute";
  const isAwsCalculatorAlignedService = ["s3", "eks", "dynamodb", "ebs", "route53", "elb", "vpc", "lambda", "ce", "gke", "run", "appengine", "functions"].includes(selectedService);
  
  const currentRegion = regions.find(r => r.id === selectedRegion);
  const availabilityZones = currentRegion?.availability_zones || [];
  
  const [computePricing, setComputePricing] = useState<ComputePricing[]>([]);
  const [storagePricing, setStoragePricing] = useState<StoragePricing[]>([]);
  const [databasePricing, setDatabasePricing] = useState<DatabasePricing[]>([]);
  const [networkingPricing, setNetworkingPricing] = useState<NetworkingPricing[]>([]);

  const [config, setConfig] = useState<any>({
    compute: { pricingId: "", quantity: 1, os: "linux", vcpu: 2, ram: 4, family: "Any" },
    gce: {
      quantity: 1,
      hoursPerMonth: HOURS_PER_MONTH,
      diskPricingId: "",
      diskSizeGb: 50,
      applySustainedUseDiscount: true
    },
    storage: { pricingId: "", size: 100, unit: "GB", movementType: "already_stored", putRequests: 0, getRequests: 0, selectReturned: 0, selectReturnedUnit: "GB", selectScanned: 0, selectScannedUnit: "GB", avgObjectSize: 16, avgObjectSizeUnit: "MB" },
    database: { 
      pricingId: "", 
      quantity: 1, 
      vcpu: 0, 
      ram: 0, 
      engine: "", 
      family: "Any",
      storageGb: 0,
      utilizationValue: 100,
      utilizationUnit: "%Utilized/Month",
      deploymentOption: "Single-AZ",
      edition: "Standard",
      pricingModel: "OnDemand",
      storageType: "gp2"
    },
    networking: { pricingId: "", quantity: 100 },
    eks: { clusters: 1 },
    ebs: {
      volumeType: "gp3",
      volumes: 1,
      durationValue: 730,
      durationUnit: "hours per month",
      storagePerVolumeGb: 30,
      provisionedIops: 3000,
      provisionedThroughputMibps: 125,
      snapshotFrequency: "2x Daily",
      changedSnapshotGb: 3
    },
    route53: {
      hostedZones: 1,
      additionalRecords: 0,
      trafficFlow: 0,
      standardQueries: 0,
      standardQueriesUnit: "million per month",
      latencyQueries: 0,
      latencyQueriesUnit: "million per month",
      geoQueries: 0,
      geoQueriesUnit: "million per month",
      ipRoutingQueries: 0,
      ipRoutingQueriesUnit: "million per month",
      ipCidrBlocks: 0
    },
    elb: {
      albCount: 1,
      hours: 730,
      processedBytesLambdaGbPerHour: 0,
      processedBytesLambdaUnit: "GB per hour",
      processedBytesEc2GbPerHour: 0,
      processedBytesEc2Unit: "GB per hour",
      newConnectionsPerSec: 0,
      newConnectionsUnit: "per second",
      connectionDurationSec: 0,
      connectionDurationUnit: "seconds",
      requestsPerSec: 0,
      ruleEvaluationsPerRequest: 10
    },
    lambda: {
      includeFreeTier: true,
      requests: 1000000,
      requestsUnit: "per month",
      averageDurationMs: 100,
      memoryMb: 512,
      architecture: "x86",
      ephemeralStorageMb: 512
    },
    vpc: {
      siteToSiteVpnConnections: 5,
      siteToSiteVpnDuration: 24,
      siteToSiteVpnDurationUnit: "hours per day",
      clientVpnSubnetAssociations: 2,
      clientVpnActiveConnections: 5,
      clientVpnActiveConnectionsUnit: "per day",
      clientVpnAvgDuration: 10,
      clientVpnAvgDurationUnit: "hours per day",
      clientVpnWorkingDaysPerMonth: 22
    },
    gke: {
      clusters: 1
    },
    run: {
      requests: 2,
      requestsUnit: "million per month",
      avgDurationMs: 250,
      memoryGiB: 0.5,
      vcpu: 1,
      freeTier: true
    },
    appengine: {
      instances: 1,
      hoursPerMonth: 730,
      instanceClass: "F1"
    },
    functions: {
      invocations: 2,
      invocationsUnit: "million per month",
      avgDurationMs: 200,
      memoryGiB: 0.25,
      freeTier: true
    },
    dynamodb: {
      capacityMode: "on-demand",
      tableClass: "Standard",
      dataStorageSize: 5,
      dataStorageUnit: "GB",
      avgItemSize: 1,
      avgItemSizeUnit: "KB",
      standardWritesPercent: 100,
      transactionalWritesPercent: 0,
      writeRate: 4,
      writeRateUnit: "million per month",
      eventuallyConsistentPercent: 100,
      stronglyConsistentPercent: 0,
      transactionalReadsPercent: 0,
      readRate: 4,
      readRateUnit: "million per month",
      baselineWriteRate: 100,
      peakWriteRate: 400,
      durationOfPeakWrite: 72,
      writeReservedCapacityPercent: 100,
      writeReservedCapacityTerm: "1 year",
      baselineReadRate: 100,
      peakReadRate: 400,
      durationOfPeakRead: 72,
      readReservedCapacityPercent: 100,
      readReservedCapacityTerm: "1 year",
    }
  });
  
  const [pricingModel, setPricingModel] = useState<PricingModel>("on-demand");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Calculation | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [showCalculations, setShowCalculations] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isSummaryView, setIsSummaryView] = useState(false);
  const [regionSearchTerm, setRegionSearchTerm] = useState("");
  const [azSearchTerm, setAzSearchTerm] = useState("");
  const [computeInstanceDropdownOpen, setComputeInstanceDropdownOpen] = useState(false);
  const [computeInstanceSearchTerm, setComputeInstanceSearchTerm] = useState("");
  const [dbInstanceDropdownOpen, setDbInstanceDropdownOpen] = useState(false);
  const [dbInstanceSearchTerm, setDbInstanceSearchTerm] = useState("");
  const [savedServices, setSavedServices] = useState<SavedService[]>([]);
  const [showAddedMessage, setShowAddedMessage] = useState(false);

  useEffect(() => {
    api.getProviders(user.token).then(res => {
      const allowed = ["aws", "azure", "gcp"];
      const filtered = res.filter(p => {
        const name = p.name.toLowerCase();
        return allowed.some(a => name.includes(a)) || 
               (name.includes("amazon") && allowed.includes("aws")) || 
               (name.includes("google") && allowed.includes("gcp")) || 
               (name.includes("microsoft") && allowed.includes("azure"));
      }).map(p => {
        let name = p.name;
        const lower = p.name.toLowerCase();
        if (lower.includes("aws") || lower.includes("amazon")) name = "AWS";
        else if (lower.includes("azure") || lower.includes("microsoft")) name = "Azure";
        else if (lower.includes("gcp") || lower.includes("google")) name = "GCP";
        return { ...p, name };
      });
      
      const uniqueMap = new Map();
      filtered.forEach(p => {
        if (!uniqueMap.has(p.name)) {
          uniqueMap.set(p.name, p);
        }
      });
      const finalProviders = Array.from(uniqueMap.values());
      
      setProviders(finalProviders);
      if (finalProviders.length > 0) {
        const awsProvider = finalProviders.find(p => p.name === "AWS");
        if (awsProvider) {
          setSelectedProvider(awsProvider.id);
        } else {
          setSelectedProvider(finalProviders[0].id);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (selectedProvider) {
      api.getRegions(user.token, selectedProvider).then(res => {
        setRegions(res);
        if (res.length > 0) {
          setSelectedRegion(res[0].id);
          if (res[0].availability_zones?.length > 0) {
            setSelectedAZ(res[0].availability_zones[0]);
          } else {
            setSelectedAZ("");
          }
        }
      });
      const serviceKey = getProviderServiceKey(selectedProvider, providers);
      const firstService = PROVIDER_SERVICES[serviceKey]?.[0]?.value || "ec2";
      setSelectedService(firstService);
    }
  }, [selectedProvider]);

  useEffect(() => {
    if (selectedRegion) {
      const region = regions.find(r => r.id === selectedRegion);
      if (region?.availability_zones?.length > 0) {
        setSelectedAZ(region.availability_zones[0]);
      } else {
        setSelectedAZ("");
      }
    }
  }, [selectedRegion, regions]);

  useEffect(() => {
    if (selectedProvider && selectedRegion) {
      setLoadingPricing(true);
      
      // Fetch all pricing types for the region to keep the live estimate accurate
      const fetchAllPricing = async () => {
        try {
          const [compute, storage, dbPricing, networking] = await Promise.all([
            api.getComputePricing(user.token, selectedProvider, selectedRegion),
            api.getStoragePricing(user.token, selectedProvider, selectedRegion),
            api.getDatabasePricing(user.token, selectedProvider, selectedRegion),
            api.getNetworkingPricing(user.token, selectedProvider, selectedRegion)
          ]);
          
          setComputePricing(compute);
          setStoragePricing(storage);
          setDatabasePricing(dbPricing);
          setNetworkingPricing(networking);
          
          // Initialize or validate selections
          setConfig((prev: any) => {
            const next = { ...prev, compute: { ...prev.compute }, storage: { ...prev.storage }, database: { ...prev.database }, networking: { ...prev.networking } };
            
            if (compute.length > 0) {
              const current = compute.find(p => p.id === prev.compute.pricingId);
              if (!current) next.compute.pricingId = compute[0].id;
            } else {
              next.compute.pricingId = "";
            }

            if (storage.length > 0) {
              const current = storage.find(p => p.id === prev.storage.pricingId);
              if (!current) next.storage.pricingId = storage[0].id;
            } else {
              next.storage.pricingId = "";
            }

            if (dbPricing.length > 0) {
              const current = dbPricing.find(p => p.id === prev.database.pricingId);
              if (!current) next.database.pricingId = dbPricing[0].id;
            } else {
              next.database.pricingId = "";
            }

            if (networking.length > 0) {
              const current = networking.find(p => p.id === prev.networking.pricingId);
              if (!current) next.networking.pricingId = networking[0].id;
            } else {
              next.networking.pricingId = "";
            }

            return next;
          });
        } catch (err) {
          console.error("Failed to fetch pricing:", err);
        } finally {
          setLoadingPricing(false);
        }
      };
      
      fetchAllPricing();
    }
  }, [selectedProvider, selectedRegion]);

  const buildCurrentPayload = (): CalculationRequestPayload => {
    const providerName = providers.find(p => p.id === selectedProvider)?.name || "";
    const includeComputeSelection = currentServiceType === "compute" && !CUSTOM_COMPUTE_SERVICES.includes(selectedService);
    const includeStorageSelection = currentServiceType === "storage" && !["dynamodb", "ebs"].includes(selectedService);
    const includeDatabaseSelection = currentServiceType === "database" && selectedService !== "dynamodb";
    const includeNetworkingSelection = currentServiceType === "networking" && !["route53", "elb", "vpc"].includes(selectedService);

    const compute_selections = includeComputeSelection && config.compute.pricingId ? [{
      type: "compute",
      provider_id: selectedProvider,
      region_id: selectedRegion,
      compute_pricing_id: config.compute.pricingId,
      quantity: config.compute.quantity,
      provider_name: providerName,
      label: "Compute"
    }] : [];

    const storage_selections = includeStorageSelection && (config.storage.pricingId || selectedService === "s3") ? [{
      type: "storage",
      provider_id: selectedProvider,
      region_id: selectedRegion,
      storage_pricing_id: config.storage.pricingId,
      size: config.storage.size,
      unit: config.storage.unit,
      movement_type: config.storage.movementType,
      put_requests: config.storage.putRequests,
      get_requests: config.storage.getRequests,
      select_returned: config.storage.selectReturned,
      select_returned_unit: config.storage.selectReturnedUnit,
      select_scanned: config.storage.selectScanned,
      select_scanned_unit: config.storage.selectScannedUnit,
      avg_object_size: config.storage.avgObjectSize,
      avg_object_size_unit: config.storage.avgObjectSizeUnit,
      provider_name: providerName,
      label: selectedService === "s3" ? "S3 Standard Storage" : "Storage"
    }] : [];

    const database_selections = includeDatabaseSelection && config.database.pricingId ? [{
      type: "database",
      provider_id: selectedProvider,
      region_id: selectedRegion,
      database_pricing_id: config.database.pricingId,
      quantity: config.database.quantity,
      storage_gb: config.database.storageGb,
      utilization_value: config.database.utilizationValue,
      utilization_unit: config.database.utilizationUnit,
      deployment_option: config.database.deploymentOption,
      edition: config.database.edition,
      pricing_model: config.database.pricingModel,
      storage_type: config.database.storageType,
      provider_name: providerName,
      label: "Database"
    }] : [];

    const networking_selections = includeNetworkingSelection && config.networking.pricingId ? [{
      type: "networking",
      provider_id: selectedProvider,
      region_id: selectedRegion,
      networking_pricing_id: config.networking.pricingId,
      quantity: config.networking.quantity,
      provider_name: providerName,
      label: "Networking"
    }] : [];

    const eks_selections = selectedService === "eks" ? [{
      type: "eks",
      provider_id: selectedProvider,
      region_id: selectedRegion,
      clusters: config.eks.clusters,
      provider_name: providerName,
      label: "EKS Cluster"
    }] : [];

    const custom_compute_selections = ["ce", "gke", "run", "appengine", "functions"].includes(selectedService)
      ? [{
          type: selectedService,
          provider_id: selectedProvider,
          region_id: selectedRegion,
          ...(selectedService === "ce"
            ? {
                compute_pricing_id: config.compute.pricingId,
                quantity: config.gce.quantity,
                hours_per_month: config.gce.hoursPerMonth,
                disk_pricing_id: config.gce.diskPricingId,
                disk_size_gb: config.gce.diskSizeGb,
                apply_sustained_use_discount: config.gce.applySustainedUseDiscount
              }
            : {}),
          ...(selectedService === "gke" ? { clusters: config.gke.clusters } : {}),
          ...(selectedService === "run"
            ? {
                requests: config.run.requests,
                requests_unit: config.run.requestsUnit,
                avg_duration_ms: config.run.avgDurationMs,
                memory_gib: config.run.memoryGiB,
                vcpu: config.run.vcpu,
                free_tier: config.run.freeTier
              }
            : {}),
          ...(selectedService === "appengine"
            ? {
                instances: config.appengine.instances,
                hours_per_month: config.appengine.hoursPerMonth,
                instance_class: config.appengine.instanceClass
              }
            : {}),
          ...(selectedService === "functions"
            ? {
                invocations: config.functions.invocations,
                invocations_unit: config.functions.invocationsUnit,
                avg_duration_ms: config.functions.avgDurationMs,
                memory_gib: config.functions.memoryGiB,
                free_tier: config.functions.freeTier
              }
            : {}),
          provider_name: providerName,
          label: currentServices.find((s) => s.value === selectedService)?.label || selectedService
        }]
      : [];

    return {
      compute_selections,
      storage_selections,
      database_selections,
      networking_selections,
      eks_selections,
      custom_compute_selections,
      duration_months: getDurationMonthsForPricingModel(pricingModel),
      pricing_model: pricingModel
    };
  };

  const handleCalculate = async (payload?: CalculationRequestPayload) => {
    if (!selectedProvider || !selectedRegion) return;

    setLoading(true);
    try {
      const res = await api.calculate(user.token, payload || buildCurrentPayload());
      setResult(res);
      setShowResults(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const filteredComputePricing = useMemo(() => computePricing.filter(p => {
    const matchVcpu = p.vcpu >= config.compute.vcpu;
    const matchRam = p.memory_gb >= config.compute.ram;
    const matchFamily = config.compute.family === "Any" || p.instance_type === config.compute.family;
    const matchOS = !config.compute.os || p.os_type?.toLowerCase() === config.compute.os.toLowerCase();
    const isLambda = p.instance_type.toLowerCase().includes("lambda") || p.instance_type.toLowerCase().includes("function");
    return matchVcpu && matchRam && matchFamily && matchOS && !isLambda;
  }), [computePricing, config.compute.vcpu, config.compute.ram, config.compute.family, config.compute.os]);

  const filteredComputeInstanceOptions = useMemo(() => (
    filteredComputePricing.filter((p) => p.instance_type?.toLowerCase().includes(computeInstanceSearchTerm.toLowerCase()))
  ), [filteredComputePricing, computeInstanceSearchTerm]);

  useEffect(() => {
    if (filteredComputePricing.length > 0) {
      const currentPricing = filteredComputePricing.find(p => p.id === config.compute.pricingId);
      if (!currentPricing && config.compute.pricingId !== filteredComputePricing[0].id) {
        setConfig((prev: any) => ({ ...prev, compute: { ...prev.compute, pricingId: filteredComputePricing[0].id } }));
      }
    } else if (config.compute.pricingId !== "") {
      setConfig((prev: any) => ({ ...prev, compute: { ...prev.compute, pricingId: "" } }));
    }
  }, [filteredComputePricing, config.compute.pricingId]);

  const familyOptions = useMemo(() => ["Any", ...new Set(computePricing.filter(p => p.instance_type && !p.instance_type.toLowerCase().includes("lambda") && !p.instance_type.toLowerCase().includes("function")).map(p => p.instance_type))].sort(), [computePricing]);
  const gceDiskPricingOptions = useMemo(
    () => storagePricing.filter((p) => /persistent disk|pd-|hyperdisk|disk/i.test(`${p.storage_name} ${p.storage_type}`)),
    [storagePricing]
  );
  const selectedComputePricing = computePricing.find((p) => p.id === config.compute.pricingId);
  const selectedGceDiskPricing = gceDiskPricingOptions.find((p) => p.id === config.gce.diskPricingId);

  useEffect(() => {
    if (selectedService !== "ce" || gceDiskPricingOptions.length === 0) return;
    const current = gceDiskPricingOptions.find((p) => p.id === config.gce.diskPricingId);
    if (!current) {
      setConfig((prev: any) => ({
        ...prev,
        gce: { ...prev.gce, diskPricingId: gceDiskPricingOptions[0].id }
      }));
    }
  }, [selectedService, gceDiskPricingOptions, config.gce.diskPricingId]);

  const rdsFamilies = [
    "Any", "db.t2", "db.t3", "db.t4g", "db.m4", "db.m5", "db.m5d", "db.m6i", "db.m6g", "db.m6gd", "db.m7i", 
    "db.r4", "db.r5", "db.r5b", "db.r5d", "db.r6i", "db.r6g", "db.r6gd", "db.r7i", "db.c4", "db.c5", 
    "db.c6i", "db.m5.metal", "db.m6i.metal", "db.m7i.metal-24xl", "db.m7i.metal-48xl", "db.r5.metal", "db.r6i.metal"
  ];

  const filteredDatabasePricing = useMemo(() => {
    const filtered = databasePricing.filter(p => {
      const matchEngine = !config.database.engine || p.db_engine === config.database.engine;
      const matchVcpu = !config.database.vcpu || (Number(p.vcpu) || 0) >= config.database.vcpu;
      const matchRam = !config.database.ram || (Number(p.memory_gb) || 0) >= config.database.ram;
      const matchFamily = !config.database.family || config.database.family === "Any" || p.instance_class === config.database.family || (p.instance_class && p.instance_class.startsWith(`${config.database.family}.`));
      
      return matchEngine && matchVcpu && matchRam && matchFamily;
    });
    console.log("Database Pricing Total:", databasePricing.length);
    console.log("Filtered Database Pricing:", filtered.length);
    console.log("Config:", config.database);
    return filtered;
  }, [databasePricing, config.database.engine, config.database.vcpu, config.database.ram, config.database.family]);

  const databaseEngines = ["PostgreSQL"];

  useEffect(() => {
    if (databaseEngines.length > 0) {
      if (!config.database.engine || !databaseEngines.includes(config.database.engine)) {
        if (config.database.engine !== databaseEngines[0]) {
          setConfig((prev: any) => ({ ...prev, database: { ...prev.database, engine: databaseEngines[0] } }));
        }
      }
    }
  }, [databaseEngines, config.database.engine]);

  useEffect(() => {
    if (filteredDatabasePricing.length > 0) {
      const currentPricing = filteredDatabasePricing.find(p => p.id === config.database.pricingId);
      if (!currentPricing && config.database.pricingId !== filteredDatabasePricing[0].id) {
        setConfig((prev: any) => ({ ...prev, database: { ...prev.database, pricingId: filteredDatabasePricing[0].id } }));
      }
    } else if (config.database.pricingId !== "") {
      setConfig((prev: any) => ({ ...prev, database: { ...prev.database, pricingId: "" } }));
    }
  }, [filteredDatabasePricing, config.database.pricingId]);

  const isDynamoDB = selectedService === "dynamodb" || config.database.engine?.toLowerCase().includes("dynamo");
  const isCosmosDB = selectedService === "cosmos" || config.database.engine?.toLowerCase().includes("cosmos");
  const isBigQuery = selectedService === "bigquery" || config.database.engine?.toLowerCase().includes("bigquery");
  const isNoSQL = isDynamoDB || isCosmosDB || isBigQuery;

  const normalizeProviderName = (name: string) => {
    const normalized = (name || "").toLowerCase();
    if (normalized.includes("amazon") || normalized.includes("aws")) return "aws";
    if (normalized.includes("azure")) return "azure";
    if (normalized.includes("google") || normalized.includes("gcp") || normalized.includes("google cloud")) return "gcp";
    return "other";
  };

  const filteredRegions = regions.filter(r => 
    r.region_name.toLowerCase().includes(regionSearchTerm.toLowerCase()) ||
    r.region_code.toLowerCase().includes(regionSearchTerm.toLowerCase())
  );

  const filteredAZs = availabilityZones.filter(az => 
    az.toLowerCase().includes(azSearchTerm.toLowerCase())
  );

  const providerBreakdowns = useMemo(() => {
    const breakdowns = result?.result_json?.provider_breakdowns || [];
    if (!Array.isArray(breakdowns) || breakdowns.length === 0) return [];

    const enriched = breakdowns.map((b) => {
      const total = b.total_cost_monthly ?? ((b.compute_cost_monthly || 0) + (b.storage_cost_monthly || 0) + (b.database_cost_monthly || 0) + (b.networking_cost_monthly || 0));
      return {
        ...b,
        canonical_provider: normalizeProviderName(b.provider_name || ""),
        total_cost_monthly: total
      };
    });

    const minTotal = Math.min(...enriched.map((b) => b.total_cost_monthly || 0));
    return enriched.map((b) => ({ ...b, is_cheapest: b.is_cheapest ?? (b.total_cost_monthly === minTotal) }));
  }, [result]);

  const allowedComparisonProviders = ["aws", "azure", "gcp"];

  const comparisonProviders = useMemo(() => {
    const breakdowns = result?.result_json?.provider_breakdowns || [];
    const enriched = allowedComparisonProviders.map((name) => {
      const found = breakdowns.find((b) => normalizeProviderName(b.provider_name || "") === name);
      const total = found ? (found.total_cost_monthly ?? ((found.compute_cost_monthly || 0) + (found.storage_cost_monthly || 0) + (found.database_cost_monthly || 0) + (found.networking_cost_monthly || 0))) : 0;
      return {
        provider_name: name === 'gcp' ? 'GCP' : name.charAt(0).toUpperCase() + name.slice(1),
        compute_cost_monthly: found?.compute_cost_monthly ?? 0,
        storage_cost_monthly: found?.storage_cost_monthly ?? 0,
        database_cost_monthly: found?.database_cost_monthly ?? 0,
        networking_cost_monthly: found?.networking_cost_monthly ?? 0,
        total_cost_monthly: total,
        is_cheapest: false,
        missing: !Boolean(found)
      };
    });

    const availableTotals = enriched.filter((item) => !item.missing).map((item) => item.total_cost_monthly || Infinity);
    const minTotal = availableTotals.length ? Math.min(...availableTotals) : Infinity;

    return enriched.map((item) => ({
      ...item,
      is_cheapest: !item.missing && item.total_cost_monthly === minTotal
    }));
  }, [result]);

  const chartData = providerBreakdowns
    .filter(b => {
      const allowed = ["aws", "azure", "gcp"];
      return allowed.includes(normalizeProviderName(b.provider_name || ""));
    })
    .map(b => ({
      name: b.provider_name,
      Compute: b.compute_cost_monthly,
      Storage: b.storage_cost_monthly,
      Database: b.database_cost_monthly,
      Networking: b.networking_cost_monthly,
      Total: b.total_cost_monthly
    })) || [];

  const pieData = providerBreakdowns.find(b => b.is_cheapest) ? [
    { name: 'Compute', value: providerBreakdowns.find(b => b.is_cheapest)!.compute_cost_monthly || 0 },
    { name: 'Storage', value: providerBreakdowns.find(b => b.is_cheapest)!.storage_cost_monthly || 0 },
    { name: 'Database', value: providerBreakdowns.find(b => b.is_cheapest)!.database_cost_monthly || 0 },
    { name: 'Networking', value: providerBreakdowns.find(b => b.is_cheapest)!.networking_cost_monthly || 0 },
  ].filter(d => d.value > 0) : [];

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];

  const liveEstimate = useMemo(() => {
    const compute = (computePricing.find(p => p.id === config.compute.pricingId)?.price_per_hour || 0) * config.compute.quantity * 730;
    
    const storagePrice = storagePricing.find(p => p.id === config.storage.pricingId)?.price_per_gb_month || 0.023;
    const storage = selectedService === "s3" 
      ? calculateS3StorageCost(config.storage.size, config.storage.unit)
      : storagePrice * (config.storage.unit === "TB" ? config.storage.size * 1024 : config.storage.size);
    
    // S3 Request pricing (approximate AWS rates)
    const putCost = (config.storage.putRequests / 1000) * 0.005;
    const getCost = (config.storage.getRequests / 10000) * 0.004;
    
    const selectReturnedGb = config.storage.selectReturnedUnit === "TB" ? config.storage.selectReturned * 1024 : config.storage.selectReturned;
    const selectScannedGb = config.storage.selectScannedUnit === "TB" ? config.storage.selectScanned * 1024 : config.storage.selectScanned;
    
    const selectReturnedCost = selectReturnedGb * 0.0007;
    const selectScannedCost = selectScannedGb * 0.002;
    
    // Data movement initial cost (if applicable)
    let initialMovementCost = 0;
    if (config.storage.movementType === "put_copy_post") {
      const totalSizeGb = config.storage.unit === "TB" ? config.storage.size * 1024 : config.storage.size;
      let avgSizeGb = config.storage.avgObjectSize;
      if (config.storage.avgObjectSizeUnit === "KB") avgSizeGb = config.storage.avgObjectSize / (1024 * 1024);
      if (config.storage.avgObjectSizeUnit === "MB") avgSizeGb = config.storage.avgObjectSize / 1024;
      
      const numObjects = avgSizeGb > 0 ? totalSizeGb / avgSizeGb : 0;
      initialMovementCost = (numObjects / 1000) * 0.005;
    }
    
    const s3Total = storage + putCost + getCost + selectReturnedCost + selectScannedCost + initialMovementCost;

    let dbHours = 730;
    if (config.database.utilizationUnit === "%Utilized/Month") {
      dbHours = 730 * (config.database.utilizationValue / 100);
    } else if (config.database.utilizationUnit === "Hours/Day") {
      dbHours = config.database.utilizationValue * 30.44;
    } else if (config.database.utilizationUnit === "Hours/Week") {
      dbHours = config.database.utilizationValue * 4.345;
    } else if (config.database.utilizationUnit === "Hours/Month") {
      dbHours = config.database.utilizationValue;
    }

    const dbBasePrice = databasePricing.find(p => p.id === config.database.pricingId)?.price_per_hour || 0;
    const dbMultiplier = config.database.deploymentOption === "Multi-AZ" ? 2 : 1;
    
    // Storage cost (approximate $0.115 per GB for gp2)
    const storageRate = config.database.storageType === "gp3" ? 0.08 : 0.115;
    const storageCost = config.database.storageGb * storageRate * dbMultiplier * config.database.quantity;

    const database = (dbBasePrice * dbMultiplier * config.database.quantity * dbHours) + storageCost;
    
    const networking = (networkingPricing.find(p => p.id === config.networking.pricingId)?.price_per_unit || 0) * config.networking.quantity;
    const eks = selectedService === "eks" ? config.eks.clusters * 0.10 * 730 : 0;
    
    let dynamodbCost = 0;
    if (selectedService === "dynamodb") {
      const ddb = config.dynamodb;
      const storageGb = ddb.dataStorageUnit === "TB" ? ddb.dataStorageSize * 1024 : ddb.dataStorageSize;
      const storageCost = storageGb * 0.25;

      const itemSizeKb = ddb.avgItemSizeUnit === "Byte" ? ddb.avgItemSize / 1024 : ddb.avgItemSize;
      const readBlocks = Math.ceil(itemSizeKb / 4);

      if (ddb.capacityMode === "on-demand") {
        const readRateMultiplier = 
          ddb.readRateUnit === "per second" ? 730 * 3600 :
          ddb.readRateUnit === "per minute" ? 730 * 60 :
          ddb.readRateUnit === "per hour" ? 730 :
          ddb.readRateUnit === "per day" ? 30.416 :
          ddb.readRateUnit === "per month" ? 1 :
          1000000;
          
        const totalReadsPerMonth = ddb.readRate * readRateMultiplier;
        const eventuallyConsistentReads = totalReadsPerMonth * (ddb.eventuallyConsistentPercent / 100);
        const stronglyConsistentReads = totalReadsPerMonth * (ddb.stronglyConsistentPercent / 100);
        const transactionalReads = totalReadsPerMonth * (ddb.transactionalReadsPercent / 100);
        
        const rruPerMonth = (eventuallyConsistentReads * readBlocks * 0.5) + 
                            (stronglyConsistentReads * readBlocks) + 
                            (transactionalReads * readBlocks * 2);
        const readCost = (rruPerMonth / 1000000) * 0.125;
        
        // AWS on-demand read settings only; writes are not included in this mode.
        dynamodbCost = storageCost + readCost;
      } else {
        const peakRcu = (ddb.peakReadRate * (ddb.eventuallyConsistentPercent / 100) * readBlocks * 0.5) + 
                        (ddb.peakReadRate * (ddb.stronglyConsistentPercent / 100) * readBlocks) + 
                        (ddb.peakReadRate * (ddb.transactionalReadsPercent / 100) * readBlocks * 2);
        const baselineRcu = (ddb.baselineReadRate * (ddb.eventuallyConsistentPercent / 100) * readBlocks * 0.5) + 
                            (ddb.baselineReadRate * (ddb.stronglyConsistentPercent / 100) * readBlocks) + 
                            (ddb.baselineReadRate * (ddb.transactionalReadsPercent / 100) * readBlocks * 2);
                            
        const peakReadHours = ddb.durationOfPeakRead;
        const baselineReadHours = Math.max(0, 730 - peakReadHours);
        
        const readCost = (peakRcu * 0.00013 * peakReadHours) + (baselineRcu * 0.00013 * baselineReadHours);
        
        // Provisioned capacity read settings only; writes are intentionally excluded.
        dynamodbCost = storageCost + readCost;
      }
    }
    
    // AWS specialized services
    const ebsStorageRate = config.ebs.volumeType === "gp3" ? 0.08 : 0.10;
    const ebsDurationHours = durationToHoursPerMonth(config.ebs.durationValue, config.ebs.durationUnit);
    const ebsInstanceHours = config.ebs.volumes * ebsDurationHours;
    const ebsInstanceMonths = ebsInstanceHours / 730;
    const ebsBaseStorageCost = config.ebs.storagePerVolumeGb * ebsInstanceMonths * ebsStorageRate;
    const ebsIopsOverage = Math.max(0, config.ebs.provisionedIops - 3000);
    const ebsThroughputOverage = Math.max(0, config.ebs.provisionedThroughputMibps - 125);
    const ebsIopsCost = (ebsIopsOverage * 0.005 * ebsInstanceMonths);
    const ebsThroughputCost = (ebsThroughputOverage * 0.04 * ebsInstanceMonths);
    const snapshotsPerMonth = snapshotsPerMonthFromFrequency(config.ebs.snapshotFrequency);
    const initialSnapshotCost = config.ebs.storagePerVolumeGb * 0.05;
    const incrementalSnapshotCost = config.ebs.changedSnapshotGb * 0.05 * 0.5;
    const totalSnapshotPerVolumeMonth = snapshotsPerMonth === 0
      ? 0
      : initialSnapshotCost + (incrementalSnapshotCost * Math.max(0, snapshotsPerMonth - 1));
    const ebsSnapshotCost = totalSnapshotPerVolumeMonth * ebsInstanceMonths;
    const ebsTotal = ebsBaseStorageCost + ebsIopsCost + ebsThroughputCost + ebsSnapshotCost;

    const route53HostedZonesCost = calculateRoute53HostedZoneCost(config.route53.hostedZones);
    const route53AdditionalRecordsCost = config.route53.additionalRecords * 0.0015;
    const route53TrafficFlowCost = config.route53.trafficFlow * 50;
    const route53StandardQueriesMillions = convertToMillionsPerMonth(config.route53.standardQueries, config.route53.standardQueriesUnit);
    const route53LatencyQueriesMillions = convertToMillionsPerMonth(config.route53.latencyQueries, config.route53.latencyQueriesUnit);
    const route53GeoQueriesMillions = convertToMillionsPerMonth(config.route53.geoQueries, config.route53.geoQueriesUnit);
    const route53IpRoutingQueriesMillions = convertToMillionsPerMonth(config.route53.ipRoutingQueries, config.route53.ipRoutingQueriesUnit);
    const route53StandardQueriesCost = calculateRoute53QueryCost(route53StandardQueriesMillions, 0.4);
    const route53LatencyQueriesCost = calculateRoute53QueryCost(route53LatencyQueriesMillions, 0.6);
    const route53GeoQueriesCost = calculateRoute53QueryCost(route53GeoQueriesMillions, 0.7);
    const route53IpRoutingQueriesCost = calculateRoute53QueryCost(route53IpRoutingQueriesMillions, 0.8);
    const route53IpCidrBlocksCost = Math.max(0, config.route53.ipCidrBlocks - 1000) * 0.0015;
    const route53Total = route53HostedZonesCost + route53AdditionalRecordsCost + route53TrafficFlowCost + route53StandardQueriesCost + route53LatencyQueriesCost + route53GeoQueriesCost + route53IpRoutingQueriesCost + route53IpCidrBlocksCost;

    const lbHourly = 0.0225; // Application Load Balancer only
    const lcuHourly = 0.008; // ALB LCU hourly rate
    const bytesLambdaLcu = config.elb.processedBytesLambdaGbPerHour / 0.4;
    const bytesEc2Lcu = config.elb.processedBytesEc2GbPerHour / 1.0;
    const processedBytesLcu = bytesLambdaLcu + bytesEc2Lcu;
    const newConnectionsLcu = config.elb.newConnectionsPerSec / 25;
    const activeConnections = config.elb.newConnectionsPerSec * config.elb.connectionDurationSec;
    const activeConnectionsLcu = activeConnections / 3000;
    const ruleEvalLcu = Math.max(0, (config.elb.requestsPerSec * Math.max(0, config.elb.ruleEvaluationsPerRequest - 10)) / 1000);
    const maxLcu = Math.max(processedBytesLcu, newConnectionsLcu, activeConnectionsLcu, ruleEvalLcu);
    const elbFixedCost = config.elb.albCount * config.elb.hours * lbHourly;
    const elbLcuCost = config.elb.albCount * config.elb.hours * maxLcu * lcuHourly;
    const elbTotal = elbFixedCost + elbLcuCost;

    const lambdaRequestCount =
      config.lambda.requestsUnit === "per month"
        ? config.lambda.requests
        : config.lambda.requestsUnit === "million per month"
        ? config.lambda.requests * 1_000_000
        : config.lambda.requests * 1_000_000_000;
    const freeTierRequests = config.lambda.includeFreeTier ? 1_000_000 : 0;
    const billableRequests = Math.max(0, lambdaRequestCount - freeTierRequests);
    const lambdaRequestCost = (billableRequests / 1_000_000) * 0.20;

    const lambdaGbSeconds = lambdaRequestCount * (config.lambda.averageDurationMs / 1000) * (config.lambda.memoryMb / 1024);
    const lambdaDurationRate = config.lambda.architecture === "arm" ? 0.0000133334 : 0.0000166667;
    const freeTierGbSeconds = config.lambda.includeFreeTier ? 400_000 : 0;
    const billableLambdaGbSeconds = Math.max(0, lambdaGbSeconds - freeTierGbSeconds);
    const lambdaDurationCost = billableLambdaGbSeconds * lambdaDurationRate;

    const ephemeralStorageGb = config.lambda.ephemeralStorageMb / 1024;
    const lambdaEphemeralGbSeconds = lambdaRequestCount * (config.lambda.averageDurationMs / 1000) * Math.max(0, ephemeralStorageGb - 0.5);
    const lambdaEphemeralCost = lambdaEphemeralGbSeconds * 0.0000000309;
    const lambdaTotal = lambdaRequestCost + lambdaDurationCost + lambdaEphemeralCost;

    const gceDiskMonthlyCost = (selectedGceDiskPricing?.price_per_gb_month || 0) * Math.max(0, config.gce.diskSizeGb || 0);
    const gceComputeBreakdown = calculateGceComputeCost({
      hourlyRate: selectedComputePricing?.price_per_hour || 0,
      hoursPerMonth: config.gce.hoursPerMonth,
      quantity: config.gce.quantity,
      instanceType: selectedComputePricing?.instance_type || "",
      applySustainedUseDiscount: config.gce.applySustainedUseDiscount
    });
    const gceTotal = selectedService === "ce"
      ? gceComputeBreakdown.cost + gceDiskMonthlyCost
      : 0;

    const gkeTotal = selectedService === "gke" ? config.gke.clusters * 0.10 * 730 : 0;

    const runRequestCount = requestUnitsToCount(config.run.requests, config.run.requestsUnit);
    const runBillableRequests = Math.max(0, runRequestCount - (config.run.freeTier ? 2_000_000 : 0));
    const runRequestCost = (runBillableRequests / 1_000_000) * 0.40;
    const runDurationSeconds = runRequestCount * (config.run.avgDurationMs / 1000);
    const runVcpuSecondsCost = runDurationSeconds * config.run.vcpu * 0.000024;
    const runMemorySecondsCost = runDurationSeconds * config.run.memoryGiB * 0.0000025;
    const runTotal = selectedService === "run"
      ? runRequestCost + runVcpuSecondsCost + runMemorySecondsCost
      : 0;

    const appEngineRate = APP_ENGINE_INSTANCE_CLASS_RATES[config.appengine.instanceClass] || APP_ENGINE_INSTANCE_CLASS_RATES.F1;
    const appEngineTotal = selectedService === "appengine"
      ? config.appengine.instances * config.appengine.hoursPerMonth * appEngineRate
      : 0;

    const functionsInvocationCount = requestUnitsToCount(config.functions.invocations, config.functions.invocationsUnit);
    const functionsBillableInvocations = Math.max(0, functionsInvocationCount - (config.functions.freeTier ? 2_000_000 : 0));
    const functionsInvocationsCost = (functionsBillableInvocations / 1_000_000) * 0.40;
    const functionsGbSeconds = functionsInvocationCount * (config.functions.avgDurationMs / 1000) * config.functions.memoryGiB;
    const functionsDurationCost = functionsGbSeconds * 0.0000025;
    const functionsTotal = selectedService === "functions"
      ? functionsInvocationsCost + functionsDurationCost
      : 0;

    const siteToSiteVpnMonthlyHoursPerConnection = durationToHoursPerMonth(
      config.vpc.siteToSiteVpnDuration,
      config.vpc.siteToSiteVpnDurationUnit
    );
    const vpcSiteToSiteVpnCost = config.vpc.siteToSiteVpnConnections * siteToSiteVpnMonthlyHoursPerConnection * 0.05;

    const activeConnectionsPerDay =
      config.vpc.clientVpnActiveConnectionsUnit === "per day"
        ? config.vpc.clientVpnActiveConnections
        : config.vpc.clientVpnActiveConnectionsUnit === "per week"
        ? config.vpc.clientVpnActiveConnections / 7
        : config.vpc.clientVpnActiveConnections / 30.44;
    const avgDurationHoursPerDay =
      config.vpc.clientVpnAvgDurationUnit === "hours per day"
        ? config.vpc.clientVpnAvgDuration
        : config.vpc.clientVpnAvgDurationUnit === "hours per week"
        ? config.vpc.clientVpnAvgDuration / 7
        : config.vpc.clientVpnAvgDuration / 30.44;
    const clientConnectionHoursPerMonth =
      activeConnectionsPerDay * avgDurationHoursPerDay * config.vpc.clientVpnWorkingDaysPerMonth;
    const vpcClientVpnEndpointCost = config.vpc.clientVpnSubnetAssociations * 730 * 0.10;
    const vpcClientVpnConnectionCost = clientConnectionHoursPerMonth * 0.05;
    const vpcTotal = vpcSiteToSiteVpnCost + vpcClientVpnEndpointCost + vpcClientVpnConnectionCost;

    const pricingMultiplier = getPricingModelMultiplier(pricingModel);
    
    const finalDatabaseCost = selectedService === "dynamodb" ? dynamodbCost : database;

    let discountedCompute = 0;
    let discountedStorage = 0;
    let discountedDatabase = 0;
    let discountedNetworking = 0;

    if (selectedService === "eks") {
      discountedCompute = eks * pricingMultiplier;
    } else if (selectedService === "ce") {
      discountedCompute = gceComputeBreakdown.cost;
      discountedStorage = gceDiskMonthlyCost;
    } else if (selectedService === "gke") {
      discountedCompute = gkeTotal;
    } else if (selectedService === "run") {
      discountedCompute = runTotal;
    } else if (selectedService === "appengine") {
      discountedCompute = appEngineTotal;
    } else if (selectedService === "functions") {
      discountedCompute = functionsTotal;
    } else if (selectedService === "s3") {
      discountedStorage = s3Total * pricingMultiplier;
    } else if (selectedService === "dynamodb") {
      discountedDatabase = finalDatabaseCost * pricingMultiplier;
    } else if (selectedService === "lambda") {
      discountedCompute = lambdaTotal * pricingMultiplier;
    } else if (selectedService === "ebs") {
      discountedStorage = ebsTotal;
    } else if (selectedService === "route53" || selectedService === "elb" || selectedService === "vpc") {
      discountedNetworking = selectedService === "route53" ? route53Total : selectedService === "elb" ? elbTotal : vpcTotal;
    } else if (currentServiceType === "compute") {
      discountedCompute = compute * pricingMultiplier;
    } else if (currentServiceType === "storage") {
      discountedStorage = storage * pricingMultiplier;
    } else if (currentServiceType === "database") {
      discountedDatabase = finalDatabaseCost * pricingMultiplier;
    } else if (currentServiceType === "networking") {
      discountedNetworking = networking;
    }
     
    const total = discountedCompute + discountedStorage + discountedDatabase + discountedNetworking;
    return {
      compute: discountedCompute,
      storage: discountedStorage,
      database: discountedDatabase,
      networking: discountedNetworking,
      total,
      yearly: total * 12
    };
  }, [computePricing, storagePricing, databasePricing, networkingPricing, config, selectedService, currentServiceType, pricingModel, selectedComputePricing, selectedGceDiskPricing]);

  const currentServiceDraft = useMemo(() => {
    if (!selectedProvider || !selectedRegion) return null;

    const providerName = providers.find((p) => p.id === selectedProvider)?.name || "";
    const regionName = regions.find((r) => r.id === selectedRegion)?.region_name || "";
    const serviceLabel = currentServices.find((s) => s.value === selectedService)?.label || selectedService;
    const payload = buildCurrentPayload();

    return {
      signature: JSON.stringify({
        provider: selectedProvider,
        region: selectedRegion,
        az: selectedAZ,
        service: selectedService,
        pricingModel,
        payload
      }),
      providerId: selectedProvider,
      providerName,
      regionId: selectedRegion,
      regionName,
      service: selectedService,
      serviceLabel,
      monthlyTotal: liveEstimate.total,
      breakdown: {
        compute: liveEstimate.compute,
        storage: liveEstimate.storage,
        database: liveEstimate.database,
        networking: liveEstimate.networking
      },
      payload
    };
  }, [selectedProvider, selectedRegion, selectedAZ, selectedService, pricingModel, providers, regions, currentServices, liveEstimate, config]);

  const savedServicesSummary = useMemo(() => (
    savedServices.reduce((acc, service) => ({
      compute: acc.compute + service.breakdown.compute,
      storage: acc.storage + service.breakdown.storage,
      database: acc.database + service.breakdown.database,
      networking: acc.networking + service.breakdown.networking,
      total: acc.total + service.monthlyTotal
    }), { compute: 0, storage: 0, database: 0, networking: 0, total: 0 })
  ), [savedServices]);

  useEffect(() => {
    if (!showAddedMessage) return;
    const timer = window.setTimeout(() => setShowAddedMessage(false), 2500);
    return () => window.clearTimeout(timer);
  }, [showAddedMessage]);

  const handleSaveAndAddService = () => {
    if (!currentServiceDraft) return;

    setSavedServices((prev) => (
      prev.some((service) => service.signature === currentServiceDraft.signature)
        ? prev
        : [...prev, { id: `${Date.now()}-${prev.length}`, ...currentServiceDraft }]
    ));
    setShowAddedMessage(true);
    setIsComparing(false);
    setIsSummaryView(false);
    setShowResults(false);
    setShowCalculations(false);
    setResult(null);
  };

  const handleSaveAndViewSummary = async () => {
    if (!currentServiceDraft) return;

    const nextSavedServices = savedServices.some((service) => service.signature === currentServiceDraft.signature)
      ? savedServices
      : [...savedServices, { id: `${Date.now()}-${savedServices.length}`, ...currentServiceDraft }];

    setSavedServices(nextSavedServices);
    setIsComparing(false);
    setIsSummaryView(true);
    setShowCalculations(false);
    await handleCalculate(mergeCalculationPayloads(nextSavedServices.map((service) => service.payload), pricingModel));
  };

  const handleCancelSummary = () => {
    setSavedServices([]);
    setShowAddedMessage(false);
    setIsComparing(false);
    setIsSummaryView(false);
    setShowResults(false);
    setShowCalculations(false);
    setResult(null);
  };

  const handleRemoveSavedService = (id: string) => {
    setSavedServices((prev) => prev.filter((service) => service.id !== id));
    setIsSummaryView(false);
  };

  return (
    <div className={`space-y-6 ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`} onFocusCapture={handleGlobalNumberFocus}>
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-2xl border ${theme === "dark" ? "bg-slate-900/90 border-slate-700" : "bg-secondary-50 border-secondary-200"}`}>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Cloud Provider</label>
          <select 
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="w-full bg-secondary-50 border border-secondary-200 rounded-xl px-4 py-2.5 text-sm text-primary-900 focus:outline-none focus:border-primary-500/50 transition-colors"
          >
            {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Region</label>
          <select 
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="w-full bg-secondary-50 border border-secondary-200 rounded-xl px-4 py-2.5 text-sm text-primary-900 focus:outline-none focus:border-primary-500/50 transition-colors"
          >
            {regions.map(r => (
              <option key={r.id} value={r.id}>
                {r.region_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Availability Zone</label>
          <select 
            value={selectedAZ}
            onChange={(e) => setSelectedAZ(e.target.value)}
            className="w-full bg-secondary-50 border border-secondary-200 rounded-xl px-4 py-2.5 text-sm text-primary-900 focus:outline-none focus:border-primary-500/50 transition-colors"
          >
            {availabilityZones.map(az => <option key={az} value={az}>{az}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Services</label>
          <select 
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="w-full bg-secondary-50 border border-secondary-200 rounded-xl px-4 py-2.5 text-sm text-primary-900 focus:outline-none focus:border-primary-500/50 transition-colors"
          >
            {currentServices.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-6">
        <div className={`rounded-2xl p-6 ${theme === "dark" ? "bg-slate-900/90 border border-slate-700" : "bg-white/90 backdrop-blur-md border border-gray-200"}`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-500/10 rounded-lg border border-primary-500/20">
                {currentServiceType === "compute" && <Cpu className="text-primary-500" size={20} />}
                {currentServiceType === "storage" && <Database className="text-primary-500" size={20} />}
                {currentServiceType === "database" && <Server className="text-primary-500" size={20} />}
                {currentServiceType === "networking" && <Network className="text-primary-500" size={20} />}
              </div>
              <h2 className={`text-lg font-semibold capitalize ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{currentServices.find(s => s.value === selectedService)?.label} Configuration</h2>
            </div>
          </div>
          
          <div className="space-y-6">
            {currentServiceType === "compute" && !CUSTOM_COMPUTE_SERVICES.includes(selectedService) && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Operating System</label>
                    <select 
                      value={config.compute.os}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, compute: { ...prev.compute, os: e.target.value } }))}
                      className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                    >
                      <option value="linux">Linux</option>
                      <option value="windows">Windows</option>
                      <option value="rhel">RHEL</option>
                      <option value="sles">SUSE</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Instance Type</label>
                    <select 
                      value={config.compute.family}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, compute: { ...prev.compute, family: e.target.value } }))}
                      className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                    >
                      {familyOptions.map(opt => <option key={opt} value={opt}>{opt === "Any" ? "Any Type" : opt}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">vCPUs</label>
                    <select 
                      value={config.compute.vcpu}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, compute: { ...prev.compute, vcpu: parseInt(e.target.value) } }))}
                      className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                    >
                      {VCPU_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Memory (GiB)</label>
                    <select 
                      value={config.compute.ram}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, compute: { ...prev.compute, ram: parseInt(e.target.value) } }))}
                      className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                    >
                      {MEMORY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Quantity</label>
                    <input 
                      type="number" 
                      value={config.compute.quantity}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, compute: { ...prev.compute, quantity: parseInt(e.target.value) || 1 } }))}
                      className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-3 relative">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Select instance type</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setComputeInstanceDropdownOpen(!computeInstanceDropdownOpen)}
                      className="w-full bg-white/90 backdrop-blur-md border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all text-left flex justify-between items-center"
                    >
                      {config.compute.pricingId ? (() => {
                        const p = filteredComputePricing.find((item) => item.id === config.compute.pricingId);
                        if (!p) return "Select Instance Type";
                        return (
                          <div className="flex flex-col">
                            <span className="text-primary-500 font-medium">{p.instance_type}</span>
                            <span className="text-xs text-gray-600">vCPU: {p.vcpu} • Memory: {p.memory_gb} GiB • ${p.price_per_hour.toFixed(4)}/hr</span>
                          </div>
                        );
                      })() : "Select Instance Type"}
                      <svg className={`w-4 h-4 transition-transform ${computeInstanceDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>

                    {computeInstanceDropdownOpen && (
                      <div className={`relative z-100 w-full mt-2 ${theme === 'dark' ? 'bg-[#1a1a1a]/95 text-white' : 'bg-white/95 text-slate-900'} backdrop-blur-sm border border-gray-300 rounded-xl shadow-2xl max-h-80 flex flex-col`}>
                        <div className="p-2 border-b border-gray-300 sticky top-0 bg-gray-50 backdrop-blur-sm rounded-t-xl z-10">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                            <input
                              type="text"
                              placeholder="Search instance type..."
                              value={computeInstanceSearchTerm}
                              onChange={(e) => setComputeInstanceSearchTerm(e.target.value)}
                              className="w-full bg-white/90 backdrop-blur-md border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div className="overflow-y-auto flex-1">
                          {filteredComputeInstanceOptions.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setConfig((prev: any) => ({ ...prev, compute: { ...prev.compute, pricingId: p.id } }));
                                setComputeInstanceDropdownOpen(false);
                                setComputeInstanceSearchTerm("");
                              }}
                              className={`w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors border-b border-gray-200 last:border-0 ${config.compute.pricingId === p.id ? 'bg-primary-500/10' : ''}`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-primary-500 font-medium">{p.instance_type}</div>
                                  <div className="text-xs text-gray-600 mt-1">vCPU: {p.vcpu} • Memory: {p.memory_gb} GiB</div>
                                </div>
                                <div className={`text-xs font-mono ${theme === 'dark' ? 'text-zinc-300' : 'text-gray-900'}`}>${p.price_per_hour.toFixed(4)}/hr</div>
                              </div>
                            </button>
                          ))}
                          {filteredComputeInstanceOptions.length === 0 && (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">No instances found</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {selectedService === "eks" && (
              <div className="space-y-6">
                <div className="bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-2xl p-8">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <h3 className="text-lg font-bold text-gray-900">EKS Cluster Pricing - Standard Support</h3>
                  </div>
                  
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Number of EKS Clusters</label>
                      <input 
                        type="number" 
                        min="0"
                        value={config.eks.clusters}
                        onChange={(e) => setConfig((prev: any) => ({ ...prev, eks: { ...prev.eks, clusters: parseInt(e.target.value) || 0 } }))}
                        className="w-full max-w-md bg-white/90 backdrop-blur-md border border-gray-300 rounded-xl px-6 py-4 text-lg font-mono text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                      />
                    </div>

                    <div className="pt-8 border-t border-gray-200">
                      <div className="p-4 bg-primary-500/5 border border-primary-500/10 rounded-xl">
                        <p className="text-xs text-gray-600 leading-relaxed">
                          EKS clusters are billed at a flat rate of <span className="text-gray-900 font-bold">$0.10 per hour</span>. 
                          Worker nodes are billed separately as EC2 instances.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedService === "gke" && (
              <div className="space-y-6">
                <div className="bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-2xl p-8">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <h3 className="text-lg font-bold text-gray-900">GKE Cluster Pricing - Standard</h3>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Number of GKE Clusters</label>
                    <input
                      type="number"
                      min="0"
                      value={config.gke.clusters}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, gke: { ...prev.gke, clusters: parseInt(e.target.value) || 0 } }))}
                      className="w-full max-w-md bg-white/90 backdrop-blur-md border border-gray-300 rounded-xl px-6 py-4 text-lg font-mono text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                    />
                  </div>
                  <div className="pt-8 border-t border-gray-200 mt-8">
                    <div className="p-4 bg-primary-500/5 border border-primary-500/10 rounded-xl">
                      <p className="text-xs text-gray-600 leading-relaxed">
                        GKE control plane pricing is estimated at <span className="text-gray-900 font-bold">$0.10 per cluster-hour</span> (same model as managed Kubernetes control plane billing).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedService === "run" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Requests</label>
                    <input
                      type="number"
                      min="0"
                      value={config.run.requests}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, run: { ...prev.run, requests: parseFloat(e.target.value) || 0 } }))}
                      className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Request Unit</label>
                    <select
                      value={config.run.requestsUnit}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, run: { ...prev.run, requestsUnit: e.target.value } }))}
                      className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                    >
                      <option value="million per month">Million / month</option>
                      <option value="billion per month">Billion / month</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Avg Duration (ms)</label>
                    <input
                      type="number"
                      min="0"
                      value={config.run.avgDurationMs}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, run: { ...prev.run, avgDurationMs: parseFloat(e.target.value) || 0 } }))}
                      className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">vCPU per request</label>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      value={config.run.vcpu}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, run: { ...prev.run, vcpu: parseFloat(e.target.value) || 0 } }))}
                      className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Memory (GiB)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      value={config.run.memoryGiB}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, run: { ...prev.run, memoryGiB: parseFloat(e.target.value) || 0 } }))}
                      className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2 flex items-end">
                    <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={config.run.freeTier}
                        onChange={(e) => setConfig((prev: any) => ({ ...prev, run: { ...prev.run, freeTier: e.target.checked } }))}
                      />
                      Include free tier
                    </label>
                  </div>
                </div>
              </div>
            )}

            {selectedService === "appengine" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Instance Class</label>
                    <select
                      value={config.appengine.instanceClass}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, appengine: { ...prev.appengine, instanceClass: e.target.value } }))}
                      className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                    >
                      {Object.keys(APP_ENGINE_INSTANCE_CLASS_RATES).map((cls) => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Instances</label>
                    <input
                      type="number"
                      min="0"
                      value={config.appengine.instances}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, appengine: { ...prev.appengine, instances: parseInt(e.target.value) || 0 } }))}
                      className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Hours / month</label>
                    <input
                      type="number"
                      min="0"
                      value={config.appengine.hoursPerMonth}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, appengine: { ...prev.appengine, hoursPerMonth: parseInt(e.target.value) || 0 } }))}
                      className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedService === "functions" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Invocations</label>
                    <input
                      type="number"
                      min="0"
                      value={config.functions.invocations}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, functions: { ...prev.functions, invocations: parseFloat(e.target.value) || 0 } }))}
                      className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Invocation Unit</label>
                    <select
                      value={config.functions.invocationsUnit}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, functions: { ...prev.functions, invocationsUnit: e.target.value } }))}
                      className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                    >
                      <option value="million per month">Million / month</option>
                      <option value="billion per month">Billion / month</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Avg Duration (ms)</label>
                    <input
                      type="number"
                      min="0"
                      value={config.functions.avgDurationMs}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, functions: { ...prev.functions, avgDurationMs: parseFloat(e.target.value) || 0 } }))}
                      className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Memory (GiB)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.125"
                      value={config.functions.memoryGiB}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, functions: { ...prev.functions, memoryGiB: parseFloat(e.target.value) || 0 } }))}
                      className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2 flex items-end">
                    <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={config.functions.freeTier}
                        onChange={(e) => setConfig((prev: any) => ({ ...prev, functions: { ...prev.functions, freeTier: e.target.checked } }))}
                      />
                      Include free tier
                    </label>
                  </div>
                </div>
              </div>
            )}

            {currentServiceType === "database" && selectedService !== "dynamodb" && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Database Engine</label>
                      <select 
                        value={config.database.engine}
                        onChange={(e) => setConfig((prev: any) => ({ ...prev, database: { ...prev.database, engine: e.target.value } }))}
                        className="w-full bg-white/90 backdrop-blur-md border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                      >
                        {databaseEngines.map(eng => <option key={eng} value={eng}>{eng}</option>)}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Nodes (Enter the number of DB instances that you need)</label>
                      <input 
                        type="number" 
                        min="0"
                        value={config.database.quantity === 0 ? "" : config.database.quantity}
                        onChange={(e) => setConfig((prev: any) => ({ ...prev, database: { ...prev.database, quantity: e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0) } }))}
                        onFocus={handleNumberFocus}
                        className="w-full bg-white/90 backdrop-blur-md border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                      />
                    </div>

                    <div className="space-y-3 relative">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Select instance type</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setDbInstanceDropdownOpen(!dbInstanceDropdownOpen)}
                          className="w-full bg-white/90 backdrop-blur-md border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all text-left flex justify-between items-center"
                        >
                          {config.database.pricingId ? (() => {
                            const p = filteredDatabasePricing.find(p => p.id === config.database.pricingId);
                            if (!p) return "Select Instance Type";
                            return (
                              <div className="flex flex-col">
                                <span className="text-primary-500 font-medium">{p.instance_class}</span>
                                <span className="text-xs text-gray-600">vCPU: {p.vcpu} &nbsp; Memory: {p.memory_gb} GiB</span>
                              </div>
                            );
                          })() : "Select Instance Type"}
                          <svg className={`w-4 h-4 transition-transform ${dbInstanceDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        
                        {dbInstanceDropdownOpen && (
                          <div className={`relative z-100 w-full mt-2 ${theme === 'dark' ? 'bg-[#1a1a1a]/95' : 'bg-white/95'} backdrop-blur-sm border border-gray-300 rounded-xl shadow-2xl max-h-80 flex flex-col`}>
                            <div className="p-2 border-b border-gray-300 sticky top-0 bg-gray-50 backdrop-blur-sm rounded-t-xl z-10">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                                <input
                                  type="text"
                                  placeholder="Search instance type..."
                                  value={dbInstanceSearchTerm}
                                  onChange={(e) => setDbInstanceSearchTerm(e.target.value)}
                                  className="w-full bg-white/90 backdrop-blur-md border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </div>
                            <div className="overflow-y-auto flex-1">
                              {filteredDatabasePricing.filter(p => p.instance_class?.toLowerCase().includes(dbInstanceSearchTerm.toLowerCase())).map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    setConfig((prev: any) => ({ ...prev, database: { ...prev.database, pricingId: p.id } }));
                                    setDbInstanceDropdownOpen(false);
                                    setDbInstanceSearchTerm("");
                                  }}
                                  className={`w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors border-b border-gray-200 last:border-0 ${config.database.pricingId === p.id ? 'bg-primary-500/10' : ''}`}
                                >
                                  <div className="text-primary-500 font-medium">{p.instance_class}</div>
                                  <div className="text-xs text-gray-600 mt-1">vCPU: {p.vcpu} &nbsp; Memory: {p.memory_gb} GiB</div>
                                </button>
                              ))}
                              {filteredDatabasePricing.filter(p => p.instance_class?.toLowerCase().includes(dbInstanceSearchTerm.toLowerCase())).length === 0 && (
                                <div className="px-4 py-3 text-sm text-gray-500 text-center">No instances found</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                    <div className="space-y-6 mt-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Utilization (On-Demand only)</label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] text-gray-500 ml-1">Value</span>
                            <input 
                              type="number" 
                              value={config.database.utilizationValue}
                              onChange={(e) => {
                                let val = parseFloat(e.target.value) || 0;
                                if (config.database.utilizationUnit === "%Utilized/Month" && val > 100) val = 100;
                                setConfig((prev: any) => ({ ...prev, database: { ...prev.database, utilizationValue: val } }));
                              }}
                              onFocus={handleNumberFocus}
                              className="w-full bg-white/90 backdrop-blur-md border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] text-gray-500 ml-1">Unit</span>
                            <select 
                              value={config.database.utilizationUnit}
                              onChange={(e) => {
                                const newUnit = e.target.value;
                                setConfig((prev: any) => {
                                  let newVal = prev.database.utilizationValue;
                                  if (newUnit === "%Utilized/Month" && newVal > 100) newVal = 100;
                                  return { ...prev, database: { ...prev.database, utilizationUnit: newUnit, utilizationValue: newVal } };
                                });
                              }}
                              className="w-full bg-white/90 backdrop-blur-md border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none"
                            >
                              <option value="%Utilized/Month">%Utilized/Month</option>
                              <option value="Hours/Day">Hours/Day</option>
                              <option value="Hours/Week">Hours/Week</option>
                              <option value="Hours/Month">Hours/Month</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
            )}
            {currentServiceType === "storage" && !["s3", "dynamodb", "ebs"].includes(selectedService) && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Storage Type</label>
                    <select 
                      value={config.storage.pricingId}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, pricingId: e.target.value } }))}
                      className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                    >
                      {storagePricing.map(p => (
                        <option key={p.id} value={p.id}>{p.storage_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Size</label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        value={config.storage.size}
                        onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, size: parseInt(e.target.value) || 1 } }))}
                        className="flex-1 bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                      />
                      <select 
                        value={config.storage.unit}
                        onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, unit: e.target.value } }))}
                        className="bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors w-32"
                      >
                        <option value="GB">GB</option>
                        <option value="TB">TB</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedService === "ebs" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Number of volumes</label>
                    <input type="number" value={config.ebs.volumes} onChange={(e) => setConfig((prev: any) => ({ ...prev, ebs: { ...prev.ebs, volumes: parseFloat(e.target.value) || 0 } }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Average duration of volume</label>
                    <div className="flex gap-2">
                      <input type="number" value={config.ebs.durationValue} onChange={(e) => setConfig((prev: any) => ({ ...prev, ebs: { ...prev.ebs, durationValue: parseFloat(e.target.value) || 0 } }))} className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" />
                      <select value={config.ebs.durationUnit} onChange={(e) => setConfig((prev: any) => ({ ...prev, ebs: { ...prev.ebs, durationUnit: e.target.value } }))} className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none">
                        <option value="hours per month">hours per month</option>
                        <option value="hours per week">hours per week</option>
                        <option value="hours per day">hours per day</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Storage for each EC2 instance</label>
                    <p className="text-[11px] text-gray-600">Choose EBS volume storage type.</p>
                    <select
                      value={config.ebs.volumeType}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, ebs: { ...prev.ebs, volumeType: e.target.value } }))}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none"
                    >
                      <option value="gp2">General Purpose SSD (gp2)</option>
                      <option value="gp3">General Purpose SSD (gp3)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Storage amount per volume</label>
                    <input type="number" value={config.ebs.storagePerVolumeGb} onChange={(e) => setConfig((prev: any) => ({ ...prev, ebs: { ...prev.ebs, storagePerVolumeGb: parseFloat(e.target.value) || 0 } }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Provisioned IOPS</label>
                    <input type="number" value={config.ebs.provisionedIops} onChange={(e) => setConfig((prev: any) => ({ ...prev, ebs: { ...prev.ebs, provisionedIops: parseFloat(e.target.value) || 0 } }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Throughput (MiB/s)</label>
                    <input type="number" value={config.ebs.provisionedThroughputMibps} onChange={(e) => setConfig((prev: any) => ({ ...prev, ebs: { ...prev.ebs, provisionedThroughputMibps: parseFloat(e.target.value) || 0 } }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Snapshot Frequency</label>
                    <select value={config.ebs.snapshotFrequency} onChange={(e) => setConfig((prev: any) => ({ ...prev, ebs: { ...prev.ebs, snapshotFrequency: e.target.value } }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none">
                      <option value="No snapshot storage">No snapshot storage</option>
                      <option value="Hourly">Hourly</option>
                      <option value="Daily">Daily</option>
                      <option value="2x Daily">2x Daily</option>
                      <option value="3x Daily">3x Daily</option>
                      <option value="4x Daily">4x Daily</option>
                      <option value="6x Daily">6x Daily</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Amount changed per snapshot (GB)</label>
                    <input type="number" value={config.ebs.changedSnapshotGb} onChange={(e) => setConfig((prev: any) => ({ ...prev, ebs: { ...prev.ebs, changedSnapshotGb: parseFloat(e.target.value) || 0 } }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" />
                  </div>
                </div>
              </div>
            )}

            {selectedService === "route53" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Hosted Zones</label><input type="number" value={config.route53.hostedZones} onChange={(e) => setConfig((prev: any) => ({ ...prev, route53: { ...prev.route53, hostedZones: parseFloat(e.target.value) || 0 } }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Additional Records in Hosted Zones</label><input type="number" value={config.route53.additionalRecords} onChange={(e) => setConfig((prev: any) => ({ ...prev, route53: { ...prev.route53, additionalRecords: parseFloat(e.target.value) || 0 } }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Traffic Flow</label><input type="number" value={config.route53.trafficFlow} onChange={(e) => setConfig((prev: any) => ({ ...prev, route53: { ...prev.route53, trafficFlow: parseFloat(e.target.value) || 0 } }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">IP (CIDR) blocks</label><input type="number" value={config.route53.ipCidrBlocks} onChange={(e) => setConfig((prev: any) => ({ ...prev, route53: { ...prev.route53, ipCidrBlocks: parseFloat(e.target.value) || 0 } }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Standard queries</label><div className="flex gap-2"><input type="number" value={config.route53.standardQueries} onChange={(e) => setConfig((prev: any) => ({ ...prev, route53: { ...prev.route53, standardQueries: parseFloat(e.target.value) || 0 } }))} className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /><select value={config.route53.standardQueriesUnit} onChange={(e) => setConfig((prev: any) => ({ ...prev, route53: { ...prev.route53, standardQueriesUnit: e.target.value } }))} className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none"><option value="million per month">million per month</option><option value="billion per month">billion per month</option></select></div></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Latency based routing queries</label><div className="flex gap-2"><input type="number" value={config.route53.latencyQueries} onChange={(e) => setConfig((prev: any) => ({ ...prev, route53: { ...prev.route53, latencyQueries: parseFloat(e.target.value) || 0 } }))} className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /><select value={config.route53.latencyQueriesUnit} onChange={(e) => setConfig((prev: any) => ({ ...prev, route53: { ...prev.route53, latencyQueriesUnit: e.target.value } }))} className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none"><option value="million per month">million per month</option><option value="billion per month">billion per month</option></select></div></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Geo DNS queries</label><div className="flex gap-2"><input type="number" value={config.route53.geoQueries} onChange={(e) => setConfig((prev: any) => ({ ...prev, route53: { ...prev.route53, geoQueries: parseFloat(e.target.value) || 0 } }))} className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /><select value={config.route53.geoQueriesUnit} onChange={(e) => setConfig((prev: any) => ({ ...prev, route53: { ...prev.route53, geoQueriesUnit: e.target.value } }))} className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none"><option value="million per month">million per month</option><option value="billion per month">billion per month</option></select></div></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">IP-based routing queries</label><div className="flex gap-2"><input type="number" value={config.route53.ipRoutingQueries} onChange={(e) => setConfig((prev: any) => ({ ...prev, route53: { ...prev.route53, ipRoutingQueries: parseFloat(e.target.value) || 0 } }))} className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /><select value={config.route53.ipRoutingQueriesUnit} onChange={(e) => setConfig((prev: any) => ({ ...prev, route53: { ...prev.route53, ipRoutingQueriesUnit: e.target.value } }))} className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none"><option value="million per month">million per month</option><option value="billion per month">billion per month</option></select></div></div>
              </div>
            )}

            {selectedService === "elb" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Number of Application Load Balancers</label><input type="number" value={config.elb.albCount} onChange={(e) => setConfig((prev: any) => ({ ...prev, elb: { ...prev.elb, albCount: Math.max(0, parseFloat(e.target.value) || 0) } }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Hours per month</label><input type="number" value={config.elb.hours} onChange={(e) => setConfig((prev: any) => ({ ...prev, elb: { ...prev.elb, hours: parseFloat(e.target.value) || 0 } }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Processed bytes (Lambda functions as targets)</label><div className="flex gap-2"><input type="number" value={config.elb.processedBytesLambdaGbPerHour} onChange={(e) => setConfig((prev: any) => ({ ...prev, elb: { ...prev.elb, processedBytesLambdaGbPerHour: parseFloat(e.target.value) || 0 } }))} className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /><select value={config.elb.processedBytesLambdaUnit} onChange={(e) => setConfig((prev: any) => ({ ...prev, elb: { ...prev.elb, processedBytesLambdaUnit: e.target.value } }))} className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none"><option value="GB per hour">GB per hour</option></select></div></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Processed bytes (EC2 Instances and IP addresses as targets)</label><div className="flex gap-2"><input type="number" value={config.elb.processedBytesEc2GbPerHour} onChange={(e) => setConfig((prev: any) => ({ ...prev, elb: { ...prev.elb, processedBytesEc2GbPerHour: parseFloat(e.target.value) || 0 } }))} className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /><select value={config.elb.processedBytesEc2Unit} onChange={(e) => setConfig((prev: any) => ({ ...prev, elb: { ...prev.elb, processedBytesEc2Unit: e.target.value } }))} className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none"><option value="GB per hour">GB per hour</option></select></div></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Average number of new connections per ALB</label><div className="flex gap-2"><input type="number" value={config.elb.newConnectionsPerSec} onChange={(e) => setConfig((prev: any) => ({ ...prev, elb: { ...prev.elb, newConnectionsPerSec: parseFloat(e.target.value) || 0 } }))} className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /><select value={config.elb.newConnectionsUnit} onChange={(e) => setConfig((prev: any) => ({ ...prev, elb: { ...prev.elb, newConnectionsUnit: e.target.value } }))} className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none"><option value="per second">per second</option></select></div></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Average connection duration</label><div className="flex gap-2"><input type="number" value={config.elb.connectionDurationSec} onChange={(e) => setConfig((prev: any) => ({ ...prev, elb: { ...prev.elb, connectionDurationSec: parseFloat(e.target.value) || 0 } }))} className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /><select value={config.elb.connectionDurationUnit} onChange={(e) => setConfig((prev: any) => ({ ...prev, elb: { ...prev.elb, connectionDurationUnit: e.target.value } }))} className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none"><option value="seconds">seconds</option></select></div></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Average number of requests per second per ALB</label><input type="number" value={config.elb.requestsPerSec} onChange={(e) => setConfig((prev: any) => ({ ...prev, elb: { ...prev.elb, requestsPerSec: parseFloat(e.target.value) || 0 } }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Average number of rule evaluations per request</label><input type="number" value={config.elb.ruleEvaluationsPerRequest} onChange={(e) => setConfig((prev: any) => ({ ...prev, elb: { ...prev.elb, ruleEvaluationsPerRequest: parseFloat(e.target.value) || 0 } }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /></div>
              </div>
            )}

            {selectedService === "lambda" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Lambda mode</label><div className="flex gap-4"><label className="flex items-center gap-2 text-sm text-gray-900"><input type="radio" checked={config.lambda.includeFreeTier} onChange={() => setConfig((prev: any) => ({ ...prev, lambda: { ...prev.lambda, includeFreeTier: true } }))} />Include Free Tier</label><label className="flex items-center gap-2 text-sm text-gray-900"><input type="radio" checked={!config.lambda.includeFreeTier} onChange={() => setConfig((prev: any) => ({ ...prev, lambda: { ...prev.lambda, includeFreeTier: false } }))} />Without Free Tier</label></div></div>
                  <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Architecture</label><select value={config.lambda.architecture} onChange={(e) => setConfig((prev: any) => ({ ...prev, lambda: { ...prev.lambda, architecture: e.target.value } }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none"><option value="x86">x86</option><option value="arm">arm</option></select></div>
                  <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Number of requests</label><div className="flex gap-2"><input type="number" value={config.lambda.requests} onChange={(e) => setConfig((prev: any) => ({ ...prev, lambda: { ...prev.lambda, requests: parseFloat(e.target.value) || 0 } }))} className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /><select value={config.lambda.requestsUnit} onChange={(e) => setConfig((prev: any) => ({ ...prev, lambda: { ...prev.lambda, requestsUnit: e.target.value } }))} className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none"><option value="per month">per month</option><option value="million per month">million per month</option><option value="billion per month">billion per month</option></select></div></div>
                  <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Duration of each request (ms)</label><input type="number" value={config.lambda.averageDurationMs} onChange={(e) => setConfig((prev: any) => ({ ...prev, lambda: { ...prev.lambda, averageDurationMs: parseFloat(e.target.value) || 0 } }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /></div>
                  <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Amount of memory allocated</label><div className="flex gap-2"><input type="number" value={config.lambda.memoryMb} onChange={(e) => setConfig((prev: any) => ({ ...prev, lambda: { ...prev.lambda, memoryMb: parseFloat(e.target.value) || 0 } }))} className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /><select className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none"><option>MB</option></select></div></div>
                  <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Amount of ephemeral storage allocated</label><div className="flex gap-2"><input type="number" value={config.lambda.ephemeralStorageMb} onChange={(e) => setConfig((prev: any) => ({ ...prev, lambda: { ...prev.lambda, ephemeralStorageMb: parseFloat(e.target.value) || 0 } }))} className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /><select className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none"><option>MB</option></select></div></div>
                </div>
              </div>
            )}

            {selectedService === "vpc" && (
              <div className="space-y-6">
                <div className="bg-white/90 border border-gray-300 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">VPN Connection feature</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Number of Site-to-Site VPN Connections</label><input type="number" value={config.vpc.siteToSiteVpnConnections} onChange={(e) => setConfig((prev: any) => ({ ...prev, vpc: { ...prev.vpc, siteToSiteVpnConnections: parseFloat(e.target.value) || 0 } }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /></div>
                    <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Average duration for each connection</label><div className="flex gap-2"><input type="number" value={config.vpc.siteToSiteVpnDuration} onChange={(e) => setConfig((prev: any) => ({ ...prev, vpc: { ...prev.vpc, siteToSiteVpnDuration: parseFloat(e.target.value) || 0 } }))} className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /><select value={config.vpc.siteToSiteVpnDurationUnit} onChange={(e) => setConfig((prev: any) => ({ ...prev, vpc: { ...prev.vpc, siteToSiteVpnDurationUnit: e.target.value } }))} className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none"><option value="hours per day">hours per day</option><option value="hours per week">hours per week</option><option value="hours per month">hours per month</option></select></div></div>
                  </div>
                </div>

                <div className="bg-white/90 border border-gray-300 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Client VPN settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Number of subnet associations</label><input type="number" value={config.vpc.clientVpnSubnetAssociations} onChange={(e) => setConfig((prev: any) => ({ ...prev, vpc: { ...prev.vpc, clientVpnSubnetAssociations: parseFloat(e.target.value) || 0 } }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /></div>
                    <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Number of active Client VPN connections</label><div className="flex gap-2"><input type="number" value={config.vpc.clientVpnActiveConnections} onChange={(e) => setConfig((prev: any) => ({ ...prev, vpc: { ...prev.vpc, clientVpnActiveConnections: parseFloat(e.target.value) || 0 } }))} className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /><select value={config.vpc.clientVpnActiveConnectionsUnit} onChange={(e) => setConfig((prev: any) => ({ ...prev, vpc: { ...prev.vpc, clientVpnActiveConnectionsUnit: e.target.value } }))} className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none"><option value="per day">per day</option><option value="per week">per week</option><option value="per month">per month</option></select></div></div>
                    <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Average duration for each connection</label><div className="flex gap-2"><input type="number" value={config.vpc.clientVpnAvgDuration} onChange={(e) => setConfig((prev: any) => ({ ...prev, vpc: { ...prev.vpc, clientVpnAvgDuration: parseFloat(e.target.value) || 0 } }))} className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /><select value={config.vpc.clientVpnAvgDurationUnit} onChange={(e) => setConfig((prev: any) => ({ ...prev, vpc: { ...prev.vpc, clientVpnAvgDurationUnit: e.target.value } }))} className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none"><option value="hours per day">hours per day</option><option value="hours per week">hours per week</option><option value="hours per month">hours per month</option></select></div></div>
                    <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Working days per month</label><input type="number" value={config.vpc.clientVpnWorkingDaysPerMonth} onChange={(e) => setConfig((prev: any) => ({ ...prev, vpc: { ...prev.vpc, clientVpnWorkingDaysPerMonth: parseFloat(e.target.value) || 0 } }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none" /></div>
                  </div>
                </div>
              </div>
            )}

            {selectedService === "s3" && (
              <div className="space-y-8">
                <div className="bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-2xl p-6 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">S3 Standard storage</label>
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          value={config.storage.size}
                          onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, size: parseInt(e.target.value) || 0 } }))}
                          className="flex-1 bg-white/90 backdrop-blur-md border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all min-w-0"
                        />
                        <select 
                          value={config.storage.unit}
                          onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, unit: e.target.value } }))}
                          className="bg-white/90 backdrop-blur-md border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none w-40"
                        >
                          <option value="GB">GB per month</option>
                          <option value="TB">TB per month</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="space-y-3 col-span-full">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">How will data be moved into S3 Standard?</label>
                      <p className="text-[11px] text-gray-600 ml-1 leading-relaxed mb-2">
                        Automatically calculates PUT, COPY, POST costs for moving data into S3 Standard initially. To compare the cost of current storage in S3 Standard to lifecycling this data to another storage class, you can specify that your storage is already stored in S3 Standard while selecting Lifecycle under the new storage class to capture the upfront cost of moving your data.
                      </p>
                      <select 
                        value={config.storage.movementType}
                        onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, movementType: e.target.value } }))}
                        className="w-full bg-white/90 backdrop-blur-md border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none"
                      >
                        <option value="already_stored">The specified amount of data is already stored in S3 Standard</option>
                        <option value="put_copy_post">PUT, COPY, POST requests to S3 Standard</option>
                      </select>
                    </div>

                    {config.storage.movementType === "put_copy_post" && (
                      <div className="space-y-3 col-span-full">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">S3 Standard Average Object Size</label>
                        <p className="text-[11px] text-gray-600 ml-1 leading-relaxed mb-2">
                          Used to calculate number of objects which affects cost of moving data into S3 Standard. You can find the average object size of your existing S3 data using S3 Storage Lens in the S3 Console.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] text-gray-500 ml-1">Value</span>
                            <input 
                              type="number" 
                              value={config.storage.avgObjectSize}
                              onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, avgObjectSize: parseFloat(e.target.value) || 0 } }))}
                              className="w-full bg-white/90 backdrop-blur-md border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] text-gray-500 ml-1">Unit</span>
                            <select 
                              value={config.storage.avgObjectSizeUnit}
                              onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, avgObjectSizeUnit: e.target.value } }))}
                              className="w-full bg-white/90 backdrop-blur-md border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none"
                            >
                              <option value="KB">KB</option>
                              <option value="MB">MB</option>
                              <option value="GB">GB</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">PUT, COPY, POST, LIST requests to S3 Standard</label>
                      <p className="text-[11px] text-gray-600 ml-1 leading-relaxed">Ongoing monthly number of PUT, COPY, POST or LIST requests</p>
                      <input 
                        type="number" 
                        placeholder="Enter amount of requests"
                        value={config.storage.putRequests || ''}
                        onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, putRequests: parseInt(e.target.value) || 0 } }))}
                        className="w-full bg-white/90 backdrop-blur-md border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">GET, SELECT, and all other requests from S3 Standard</label>
                      <p className="text-[11px] text-gray-600 ml-1 leading-relaxed">Ongoing monthly number of GET, SELECT and all other requests</p>
                      <input 
                        type="number" 
                        placeholder="Enter amount of requests"
                        value={config.storage.getRequests || ''}
                        onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, getRequests: parseInt(e.target.value) || 0 } }))}
                        className="w-full bg-white/90 backdrop-blur-md border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Data returned by S3 Select</label>
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          placeholder="Enter amount"
                          value={config.storage.selectReturned || ''}
                          onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, selectReturned: parseInt(e.target.value) || 0 } }))}
                          className="flex-1 bg-white/90 backdrop-blur-md border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all min-w-0"
                        />
                        <select 
                          value={config.storage.selectReturnedUnit}
                          onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, selectReturnedUnit: e.target.value } }))}
                          className="bg-white/90 backdrop-blur-md border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none w-40"
                        >
                          <option value="GB">GB per month</option>
                          <option value="TB">TB per month</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Data scanned by S3 Select</label>
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          placeholder="Enter amount"
                          value={config.storage.selectScanned || ''}
                          onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, selectScanned: parseInt(e.target.value) || 0 } }))}
                          className="flex-1 bg-white/90 backdrop-blur-md border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all min-w-0"
                        />
                        <select 
                          value={config.storage.selectScannedUnit}
                          onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, selectScannedUnit: e.target.value } }))}
                          className="bg-white/90 backdrop-blur-md border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none w-40"
                        >
                          <option value="GB">GB per month</option>
                          <option value="TB">TB per month</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedService === "dynamodb" && (
              <div className="space-y-8">
                <div className="bg-white/90 backdrop-blur-md border border-gray-300 rounded-2xl p-6 space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Choose DynamoDB features</h3>
                    <p className="text-sm text-gray-600">Choose the DynamoDB features whose pricing you want to estimate.</p>
                  </div>
                  <div className="flex space-x-6">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input 
                        type="radio" 
                        name="capacityMode" 
                        value="on-demand" 
                        checked={config.dynamodb.capacityMode === "on-demand"}
                        onChange={() => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, capacityMode: "on-demand" } }))}
                        className="form-radio text-primary-500 bg-gray-50 backdrop-blur-sm border-white/20 focus:ring-primary-500/50"
                      />
                      <span className="text-gray-900">DynamoDB on-demand capacity</span>
                    </label>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input 
                        type="radio" 
                        name="capacityMode" 
                        value="provisioned" 
                        checked={config.dynamodb.capacityMode === "provisioned"}
                        onChange={() => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, capacityMode: "provisioned" } }))}
                        className="form-radio text-primary-500 bg-gray-50 backdrop-blur-sm border-white/20 focus:ring-primary-500/50"
                      />
                      <span className="text-gray-900">DynamoDB provisioned capacity</span>
                    </label>
                  </div>
                </div>

                <div className="bg-white/90 backdrop-blur-md border border-gray-300 rounded-2xl p-6 space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900">Table Class</h3>
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Table class</label>
                    <select 
                      value={config.dynamodb.tableClass}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, tableClass: e.target.value } }))}
                      className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                    >
                      <option value="Standard">Standard</option>
                    </select>
                  </div>
                </div>

                <div className="bg-white/90 backdrop-blur-md border border-gray-300 rounded-2xl p-6 space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900">Data storage</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Data storage size</label>
                      <div className="flex space-x-2">
                        <input 
                          type="number" 
                          value={config.dynamodb.dataStorageSize}
                          onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, dataStorageSize: parseFloat(e.target.value) || 0 } }))}
                          onFocus={handleNumberFocus}
                          className="flex-1 bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                        />
                        <select 
                          value={config.dynamodb.dataStorageUnit}
                          onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, dataStorageUnit: e.target.value } }))}
                          className="w-24 bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                        >
                          <option value="GB">GB</option>
                          <option value="TB">TB</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Average item size (all attributes)</label>
                      <div className="flex space-x-2">
                        <input 
                          type="number" 
                          value={config.dynamodb.avgItemSize}
                          onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, avgItemSize: parseFloat(e.target.value) || 0 } }))}
                          onFocus={handleNumberFocus}
                          className="flex-1 bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                        />
                        <select 
                          value={config.dynamodb.avgItemSizeUnit}
                          onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, avgItemSizeUnit: e.target.value } }))}
                          className="w-24 bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                        >
                          <option value="KB">KB</option>
                          <option value="Byte">Byte</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {config.dynamodb.capacityMode === "on-demand" ? (
                  <>
                    <div className="bg-white/90 backdrop-blur-md border border-gray-300 rounded-2xl p-6 space-y-6">
                      <h3 className="text-lg font-semibold text-gray-900">On-demand read settings</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Eventually consistent percentage (%)</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.eventuallyConsistentPercent}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, eventuallyConsistentPercent: parseFloat(e.target.value) || 0 } }))}
                            onFocus={handleNumberFocus}
                            className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Strongly consistent percentage (%)</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.stronglyConsistentPercent}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, stronglyConsistentPercent: parseFloat(e.target.value) || 0 } }))}
                            onFocus={handleNumberFocus}
                            className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Transactional percentage (%)</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.transactionalReadsPercent}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, transactionalReadsPercent: parseFloat(e.target.value) || 0 } }))}
                            onFocus={handleNumberFocus}
                            className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3 md:col-span-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Number of reads</label>
                          <div className="flex space-x-2">
                            <input 
                              type="number" 
                              value={config.dynamodb.readRate}
                              onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, readRate: parseFloat(e.target.value) || 0 } }))}
                              onFocus={handleNumberFocus}
                              className="flex-1 bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                            />
                            <select 
                              value={config.dynamodb.readRateUnit}
                              onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, readRateUnit: e.target.value } }))}
                              className="w-48 bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                            >
                              <option value="per second">per second</option>
                              <option value="per minute">per minute</option>
                              <option value="per hour">per hour</option>
                              <option value="per day">per day</option>
                              <option value="per month">per month</option>
                              <option value="million per month">million per month</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-white/90 backdrop-blur-md border border-gray-300 rounded-2xl p-6 space-y-6">
                      <h3 className="text-lg font-semibold text-gray-900">Read settings</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Eventually consistent percentage</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.eventuallyConsistentPercent}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, eventuallyConsistentPercent: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Strongly consistent percentage</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.stronglyConsistentPercent}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, stronglyConsistentPercent: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Transactional percentage</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.transactionalReadsPercent}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, transactionalReadsPercent: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Baseline read rate (per second)</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.baselineReadRate}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, baselineReadRate: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Peak read rate (per second)</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.peakReadRate}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, peakReadRate: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Duration of peak read activity (hours/month)</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.durationOfPeakRead}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, durationOfPeakRead: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Percentage of baseline reads covered by reserved capacity</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.readReservedCapacityPercent}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, readReservedCapacityPercent: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Read reserved capacity term</label>
                          <select 
                            value={config.dynamodb.readReservedCapacityTerm}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, readReservedCapacityTerm: e.target.value } }))}
                            className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-all"
                          >
                            <option value="1 year">1 year</option>
                            <option value="3 year">3 year</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {currentServiceType === "networking" && !["route53", "elb", "vpc"].includes(selectedService) && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Networking Service</label>
                    <select 
                      value={config.networking.pricingId}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, networking: { ...prev.networking, pricingId: e.target.value } }))}
                      className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                    >
                      {networkingPricing.map(p => (
                        <option key={p.id} value={p.id}>{p.service_type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Quantity (Units)</label>
                    <input 
                      type="number" 
                      value={config.networking.quantity}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, networking: { ...prev.networking, quantity: parseInt(e.target.value) || 1 } }))}
                      className="w-full bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary-500/50 transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

          {/* Bottom Actions */}
          <div className="bg-white/90 backdrop-blur-md border border-gray-200 rounded-2xl p-6 flex flex-col gap-6">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="flex flex-col gap-1 w-full lg:w-auto">
                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Estimated Monthly Cost</div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <div className="text-3xl font-mono font-bold text-primary-500">
                    {showResults ? `$${liveEstimate.total.toFixed(2)}` : "$ --.--"}
                  </div>
                  {showResults && liveEstimate.total > 0 && (
                    <div className="text-[10px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                      {liveEstimate.compute > 0 && <span>Compute: ${liveEstimate.compute.toFixed(2)}</span>}
                      {liveEstimate.storage > 0 && <span>Storage: ${liveEstimate.storage.toFixed(2)}</span>}
                      {liveEstimate.database > 0 && <span>DB: ${liveEstimate.database.toFixed(2)}</span>}
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-zinc-600 italic space-y-1">
                  <div>Based on 730 hours/month with <span className="capitalize">{pricingModel.replace("-", " ").replace("1yr", "1yr reserved").replace("3yr", "3yr reserved")}</span> pricing</div>
                  <div>Estimated <span className="font-semibold text-gray-900">${liveEstimate.yearly.toFixed(2)}/year</span></div>
                </div>
                {savedServices.length > 0 && (
                  <div className="mt-3 text-xs text-gray-600">
                    {savedServices.length} saved service{savedServices.length === 1 ? "" : "s"} totaling <span className="text-gray-900 font-mono">${savedServicesSummary.total.toFixed(2)}</span> per month
                  </div>
                )}
                {showAddedMessage && (
                  <div className="mt-3 inline-flex items-center gap-2 text-xs text-primary-400 bg-primary-500/10 border border-primary-500/20 rounded-lg px-3 py-2 w-fit">
                    <Check size={14} />
                    Service added to summary
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-end">
                <button 
                  onClick={() => {
                    setIsComparing(false);
                    setIsSummaryView(false);
                    handleCalculate();
                  }}
                  disabled={loading || !selectedProvider || !selectedRegion}
                  className="flex-1 lg:flex-none px-8 py-4 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-500/20 disabled:text-primary-500/50 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-500/10"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <Calculator size={20} />}
                  Calculate Cost
                </button>
                <div className="flex items-center gap-4 w-full lg:w-auto">
                  <button 
                    onClick={async () => {
                      setIsComparing(true);
                      setIsSummaryView(false);
                      await handleCalculate();
                      setShowResults(true);
                      setTimeout(() => {
                        document.getElementById('comparison-report')?.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }}
                    disabled={loading || !selectedProvider || !selectedRegion}
                    className="flex-1 lg:flex-none px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/20 disabled:text-blue-600/50 text-gray-900 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/10"
                  >
                    <BarChart3 size={20} />
                    Compare
                  </button>

                  {/* Cost Intelligence integrated here */}
                  <div className="bg-gray-50 backdrop-blur-sm border border-gray-300 rounded-xl px-4 py-2 flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Pricing model</span>
                      <select 
                        value={pricingModel}
                        onChange={(e) => setPricingModel(e.target.value as PricingModel)}
                        className="bg-transparent text-primary-500 text-xs font-bold focus:outline-none"
                      >
                        <option value="on-demand">On-Demand</option>
                        <option value="reserved-1yr">Reserved (1 Year)</option>
                        <option value="reserved-3yr">Reserved (3 Year)</option>
                        <option value="spot">Spot</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-gray-900">Multi-service summary</div>
                <div className="text-xs text-gray-500">Save this service, keep adding more, or clear the current summary.</div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleCancelSummary}
                  disabled={loading}
                  className="px-6 py-3 bg-gray-50 hover:bg-white/10 disabled:bg-gray-50 disabled:text-zinc-600 text-zinc-300 font-semibold rounded-xl transition-colors border border-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAndViewSummary}
                  disabled={loading || !selectedProvider || !selectedRegion}
                  className="px-6 py-3 bg-white/10 hover:bg-white/15 disabled:bg-gray-50 disabled:text-zinc-600 text-gray-900 font-semibold rounded-xl transition-colors border border-gray-300"
                >
                  Save and view summary
                </button>
                <button
                  onClick={handleSaveAndAddService}
                  disabled={loading || !selectedProvider || !selectedRegion}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/20 disabled:text-amber-500/50 text-black font-bold rounded-xl transition-colors"
                >
                  Save and add service
                </button>
              </div>
            </div>

            {showResults && (
              <div className="pt-6 border-t border-gray-200 space-y-4">
                {result?.id && (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => api.export(user.token, result.id, "pdf")}
                      className="px-4 py-2 bg-gray-50 hover:bg-white/10 rounded-xl text-zinc-300 hover:text-gray-900 transition-colors border border-gray-300 flex items-center gap-2 text-sm"
                    >
                      <Download size={16} />
                      <span>Download PDF</span>
                    </button>
                    <button
                      onClick={() => api.export(user.token, result.id, "excel")}
                      className="px-4 py-2 bg-gray-50 hover:bg-white/10 rounded-xl text-zinc-300 hover:text-gray-900 transition-colors border border-gray-300 flex items-center gap-2 text-sm"
                    >
                      <Download size={16} />
                      <span>Download Excel</span>
                    </button>
                  </div>
                )}
                {!isSummaryView && (
                  <button 
                    onClick={() => setShowCalculations(!showCalculations)}
                    className="flex items-center gap-2 text-gray-600 hover:text-zinc-300 transition-colors group"
                  >
                    <div className="w-4 h-4 flex items-center justify-center rounded border border-zinc-700 group-hover:border-zinc-500">
                      {showCalculations ? <Minus size={10} /> : <Plus size={10} />}
                    </div>
                    <span className="text-xs font-medium">Show calculations</span>
                  </button>
                )}

                {showCalculations && !isSummaryView && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-primary-500/5 border border-primary-500/10 rounded-xl p-6 space-y-4"
                  >
                    {selectedService === "eks" ? (
                      <div className="text-sm text-gray-600 leading-relaxed">
                        <span className="text-gray-900 font-bold">{config.eks.clusters} Clusters</span> x <span className="text-gray-900 font-bold">0.10 USD</span> per hour x <span className="text-gray-900 font-bold">730 hours</span> per month = <span className="text-primary-500 font-bold text-lg ml-2">${(config.eks.clusters * 0.1 * 730).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                      </div>
                      ) : selectedService === "gke" ? (
                      <div className="text-sm text-gray-600 leading-relaxed">
                        <span className="text-gray-900 font-bold">{config.gke.clusters} Clusters</span> x <span className="text-gray-900 font-bold">0.10 USD</span> per hour x <span className="text-gray-900 font-bold">730 hours</span> per month = <span className="text-primary-500 font-bold text-lg ml-2">${(config.gke.clusters * 0.1 * 730).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                      </div>
                      ) : selectedService === "run" ? (
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Request cost</span>
                          <span className="text-gray-900 font-mono">
                            ${((Math.max(0, requestUnitsToCount(config.run.requests, config.run.requestsUnit) - (config.run.freeTier ? 2_000_000 : 0)) / 1_000_000) * 0.4).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">vCPU-seconds cost</span>
                          <span className="text-gray-900 font-mono">
                            ${(requestUnitsToCount(config.run.requests, config.run.requestsUnit) * (config.run.avgDurationMs / 1000) * config.run.vcpu * 0.000024).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Memory GiB-seconds cost</span>
                          <span className="text-gray-900 font-mono">
                            ${(requestUnitsToCount(config.run.requests, config.run.requestsUnit) * (config.run.avgDurationMs / 1000) * config.run.memoryGiB * 0.0000025).toFixed(2)}
                          </span>
                        </div>
                        <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total Monthly Cost</span>
                          <span className="text-xl font-mono font-bold text-primary-500">${liveEstimate.total.toFixed(2)} USD</span>
                        </div>
                      </div>
                      ) : selectedService === "appengine" ? (
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Instance hours</span>
                          <span className="text-gray-900 font-mono">{(config.appengine.instances * config.appengine.hoursPerMonth).toFixed(0)} h</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Rate ({config.appengine.instanceClass})</span>
                          <span className="text-gray-900 font-mono">${(APP_ENGINE_INSTANCE_CLASS_RATES[config.appengine.instanceClass] || APP_ENGINE_INSTANCE_CLASS_RATES.F1).toFixed(4)}/hour</span>
                        </div>
                        <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total Monthly Cost</span>
                          <span className="text-xl font-mono font-bold text-primary-500">${liveEstimate.total.toFixed(2)} USD</span>
                        </div>
                      </div>
                      ) : selectedService === "functions" ? (
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Invocation cost</span>
                          <span className="text-gray-900 font-mono">
                            ${((Math.max(0, requestUnitsToCount(config.functions.invocations, config.functions.invocationsUnit) - (config.functions.freeTier ? 2_000_000 : 0)) / 1_000_000) * 0.4).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Duration (GiB-seconds) cost</span>
                          <span className="text-gray-900 font-mono">
                            ${(requestUnitsToCount(config.functions.invocations, config.functions.invocationsUnit) * (config.functions.avgDurationMs / 1000) * config.functions.memoryGiB * 0.0000025).toFixed(2)}
                          </span>
                        </div>
                        <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total Monthly Cost</span>
                          <span className="text-xl font-mono font-bold text-primary-500">${liveEstimate.total.toFixed(2)} USD</span>
                        </div>
                      </div>
                      ) : selectedService === "s3" ? (
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Storage ({config.storage.size} {config.storage.unit})</span>
                          <span className="text-gray-900 font-mono">${(selectedService === "s3" ? calculateS3StorageCost(config.storage.size, config.storage.unit) : 0).toFixed(2)}</span>
                        </div>
                        {config.storage.movementType === "put_copy_post" && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Initial Data Movement (PUT/COPY/POST)</span>
                            <span className="text-gray-900 font-mono">${((config.storage.putRequests / 1000) * 0.005).toFixed(2)}</span>
                          </div>
                        )}
                        {config.storage.putRequests > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">PUT/COPY/POST/LIST ({config.storage.putRequests} requests)</span>
                            <span className="text-gray-900 font-mono">${((config.storage.putRequests / 1000) * 0.005).toFixed(2)}</span>
                          </div>
                        )}
                        {config.storage.getRequests > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">GET/SELECT/Other ({config.storage.getRequests} requests)</span>
                            <span className="text-gray-900 font-mono">${((config.storage.getRequests / 10000) * 0.004).toFixed(2)}</span>
                          </div>
                        )}
                        {config.storage.selectReturned > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">S3 Select Returned ({config.storage.selectReturned} {config.storage.selectReturnedUnit})</span>
                            <span className="text-gray-900 font-mono">${((config.storage.selectReturnedUnit === "TB" ? config.storage.selectReturned * 1024 : config.storage.selectReturned) * 0.0007).toFixed(2)}</span>
                          </div>
                        )}
                        {config.storage.selectScanned > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">S3 Select Scanned ({config.storage.selectScanned} {config.storage.selectScannedUnit})</span>
                            <span className="text-gray-900 font-mono">${((config.storage.selectScannedUnit === "TB" ? config.storage.selectScanned * 1024 : config.storage.selectScanned) * 0.002).toFixed(2)}</span>
                          </div>
                        )}
                        <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total Monthly Cost</span>
                          <span className="text-xl font-mono font-bold text-primary-500">${liveEstimate.total.toFixed(2)} USD</span>
                        </div>
                      </div>
                      ) : selectedService === "dynamodb" ? (
                      <div className="space-y-3">
                        {(() => {
                          const ddb = config.dynamodb;
                          const itemSizeKb = ddb.avgItemSizeUnit === "Byte" ? ddb.avgItemSize / 1024 : ddb.avgItemSize;
                          const readBlocks = Math.ceil(itemSizeKb / 4);
                          const readRateMultiplier =
                            ddb.readRateUnit === "per second" ? 730 * 3600 :
                            ddb.readRateUnit === "per minute" ? 730 * 60 :
                            ddb.readRateUnit === "per hour" ? 730 :
                            ddb.readRateUnit === "per day" ? 30.416 :
                            ddb.readRateUnit === "per month" ? 1 :
                            1000000;
                          const totalReads = ddb.readRate * readRateMultiplier;
                          const eventualRatio = ddb.eventuallyConsistentPercent / 100;
                          const strongRatio = ddb.stronglyConsistentPercent / 100;
                          const txnRatio = ddb.transactionalReadsPercent / 100;
                          const eventualRru = totalReads * eventualRatio * 0.5 * readBlocks;
                          const strongRru = totalReads * strongRatio * 1 * readBlocks;
                          const txnRru = totalReads * txnRatio * 2 * readBlocks;
                          const totalRru = eventualRru + strongRru + txnRru;
                          const readCost = (totalRru / 1000000) * 0.125;
                          const storageCost = (config.dynamodb.dataStorageUnit === "TB" ? config.dynamodb.dataStorageSize * 1024 : config.dynamodb.dataStorageSize) * 0.25;
                          return (
                            <>
                              <div className="text-xs text-gray-600 space-y-1">
                                <div>Eventually consistent percentage: {ddb.eventuallyConsistentPercent} / 100 = {eventualRatio.toFixed(4)}</div>
                                <div>Strongly consistent percentage: {ddb.stronglyConsistentPercent} / 100 = {strongRatio.toFixed(4)}</div>
                                <div>Transactional percentage: {ddb.transactionalReadsPercent} / 100 = {txnRatio.toFixed(4)}</div>
                                <div>Number of reads: {ddb.readRate} {ddb.readRateUnit} * {readRateMultiplier} multiplier = {totalReads.toLocaleString()} per month</div>
                                <div>{itemSizeKb.toFixed(3)} KB average item size / 4 KB = {(itemSizeKb / 4).toFixed(9)} unrounded read request units needed per item</div>
                                <div>RoundUp ({(itemSizeKb / 4).toFixed(9)}) = {readBlocks} read request units needed per item</div>
                                <div>{totalReads.toLocaleString()} number of reads x {eventualRatio.toFixed(2)} eventually consistent portion x 0.5 x {readBlocks} = {eventualRru.toLocaleString(undefined, { maximumFractionDigits: 2 })} read request units</div>
                                <div>{totalReads.toLocaleString()} number of reads x {strongRatio.toFixed(2)} strongly consistent portion x 1 x {readBlocks} = {strongRru.toLocaleString(undefined, { maximumFractionDigits: 2 })} read request units</div>
                                <div>{totalReads.toLocaleString()} number of reads x {txnRatio.toFixed(2)} transactional portion x 2 x {readBlocks} = {txnRru.toLocaleString(undefined, { maximumFractionDigits: 2 })} read request units</div>
                                <div>{eventualRru.toLocaleString(undefined, { maximumFractionDigits: 2 })} + {strongRru.toLocaleString(undefined, { maximumFractionDigits: 2 })} + {txnRru.toLocaleString(undefined, { maximumFractionDigits: 2 })} = {totalRru.toLocaleString(undefined, { maximumFractionDigits: 2 })} total read request units</div>
                                <div>{totalRru.toLocaleString(undefined, { maximumFractionDigits: 2 })} total read request units x 0.000000125 USD = {readCost.toFixed(2)} USD read request cost</div>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">{ddb.capacityMode === "on-demand" ? "Monthly read cost (on-demand)" : "Monthly read cost (provisioned)"}</span>
                                <span className="text-gray-900 font-mono">${readCost.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">DynamoDB Storage ({config.dynamodb.dataStorageSize} {config.dynamodb.dataStorageUnit})</span>
                                <span className="text-gray-900 font-mono">${storageCost.toFixed(2)}</span>
                              </div>
                            </>
                          );
                        })()}
                        <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total Monthly Cost</span>
                          <span className="text-xl font-mono font-bold text-primary-500">${liveEstimate.total.toFixed(2)} USD</span>
                        </div>
                      </div>
                      ) : selectedService === "rds" ? (
                        <div className="space-y-3">
                          {(() => {
                            const dbPrice = databasePricing.find(p => p.id === config.database.pricingId)?.price_per_hour || 0;
                            const dbHours =
                              config.database.utilizationUnit === "%Utilized/Month" ? 730 * (config.database.utilizationValue / 100) :
                              config.database.utilizationUnit === "Hours/Day" ? config.database.utilizationValue * 30.44 :
                              config.database.utilizationUnit === "Hours/Week" ? config.database.utilizationValue * 4.345 :
                              config.database.utilizationValue;
                            const deployment = config.database.deploymentOption === "Multi-AZ" ? 2 : 1;
                            const storageRate = config.database.storageType === "gp3" ? 0.08 : 0.115;
                            const storageCost = config.database.storageGb * storageRate * deployment * config.database.quantity;
                            const instanceCost = dbPrice * dbHours * deployment * config.database.quantity;
                            return (
                              <>
                                <div className="text-xs text-gray-600">{config.database.quantity} instances x {dbHours.toFixed(2)} hours x ${dbPrice.toFixed(4)}/hour x {deployment} ({config.database.deploymentOption}) = ${instanceCost.toFixed(2)}</div>
                                {config.database.storageGb > 0 && <div className="text-xs text-gray-600">{config.database.storageGb} GB storage x ${storageRate.toFixed(3)}/GB-month x {config.database.quantity} x {deployment} = ${storageCost.toFixed(2)}</div>}
                              </>
                            );
                          })()}
                          <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total Monthly Cost</span>
                            <span className="text-xl font-mono font-bold text-primary-500">${liveEstimate.total.toFixed(2)} USD</span>
                          </div>
                        </div>
                      ) : ["ebs", "route53", "elb", "vpc", "lambda"].includes(selectedService) ? (
                        <div className="space-y-3">
                          {selectedService === "ebs" && (
                            <>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">Total instance hours</span><span className="text-gray-900 font-mono">{(config.ebs.volumes * durationToHoursPerMonth(config.ebs.durationValue, config.ebs.durationUnit)).toFixed(2)} h</span></div>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">EBS Storage</span><span className="text-gray-900 font-mono">${(config.ebs.storagePerVolumeGb * ((config.ebs.volumes * durationToHoursPerMonth(config.ebs.durationValue, config.ebs.durationUnit)) / 730) * (config.ebs.volumeType === "gp3" ? 0.08 : 0.10)).toFixed(2)}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">Snapshot Cost</span><span className="text-gray-900 font-mono">${(((snapshotsPerMonthFromFrequency(config.ebs.snapshotFrequency) === 0 ? 0 : (config.ebs.storagePerVolumeGb * 0.05) + (config.ebs.changedSnapshotGb * 0.05 * 0.5 * Math.max(0, snapshotsPerMonthFromFrequency(config.ebs.snapshotFrequency) - 1))) * ((config.ebs.volumes * durationToHoursPerMonth(config.ebs.durationValue, config.ebs.durationUnit)) / 730))).toFixed(2)}</span></div>
                            </>
                          )}
                          {selectedService === "route53" && (
                            <>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">Hosted Zones</span><span className="text-gray-900 font-mono">${calculateRoute53HostedZoneCost(config.route53.hostedZones).toFixed(2)}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">Additional RRsets</span><span className="text-gray-900 font-mono">${(config.route53.additionalRecords * 0.0015).toFixed(2)}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">Traffic Flow</span><span className="text-gray-900 font-mono">${(config.route53.trafficFlow * 50).toFixed(2)}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">Standard queries</span><span className="text-gray-900 font-mono">${calculateRoute53QueryCost(convertToMillionsPerMonth(config.route53.standardQueries, config.route53.standardQueriesUnit), 0.4).toFixed(2)}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">Latency queries</span><span className="text-gray-900 font-mono">${calculateRoute53QueryCost(convertToMillionsPerMonth(config.route53.latencyQueries, config.route53.latencyQueriesUnit), 0.6).toFixed(2)}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">Geo queries</span><span className="text-gray-900 font-mono">${calculateRoute53QueryCost(convertToMillionsPerMonth(config.route53.geoQueries, config.route53.geoQueriesUnit), 0.7).toFixed(2)}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">IP routing queries</span><span className="text-gray-900 font-mono">${calculateRoute53QueryCost(convertToMillionsPerMonth(config.route53.ipRoutingQueries, config.route53.ipRoutingQueriesUnit), 0.8).toFixed(2)}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">IP CIDR blocks (above free 1,000)</span><span className="text-gray-900 font-mono">${(Math.max(0, config.route53.ipCidrBlocks - 1000) * 0.0015).toFixed(2)}</span></div>
                            </>
                          )}
                          {selectedService === "elb" && (
                            <>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">ALB hourly charge</span><span className="text-gray-900 font-mono">${(config.elb.albCount * config.elb.hours * 0.0225).toFixed(2)}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">Processed bytes LCU</span><span className="text-gray-900 font-mono">{((config.elb.processedBytesLambdaGbPerHour / 0.4) + (config.elb.processedBytesEc2GbPerHour / 1.0)).toFixed(2)}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">New connections LCU</span><span className="text-gray-900 font-mono">{(config.elb.newConnectionsPerSec / 25).toFixed(2)}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">Active connections LCU</span><span className="text-gray-900 font-mono">{((config.elb.newConnectionsPerSec * config.elb.connectionDurationSec) / 3000).toFixed(2)}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">Rule evaluations LCU</span><span className="text-gray-900 font-mono">{(Math.max(0, (config.elb.requestsPerSec * Math.max(0, config.elb.ruleEvaluationsPerRequest - 10)) / 1000)).toFixed(2)}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">Max LCU</span><span className="text-gray-900 font-mono">{Math.max(((config.elb.processedBytesLambdaGbPerHour / 0.4) + (config.elb.processedBytesEc2GbPerHour / 1.0)), (config.elb.newConnectionsPerSec / 25), ((config.elb.newConnectionsPerSec * config.elb.connectionDurationSec) / 3000), Math.max(0, (config.elb.requestsPerSec * Math.max(0, config.elb.ruleEvaluationsPerRequest - 10)) / 1000)).toFixed(2)}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">ALB LCU charge</span><span className="text-gray-900 font-mono">${(config.elb.albCount * config.elb.hours * Math.max(((config.elb.processedBytesLambdaGbPerHour / 0.4) + (config.elb.processedBytesEc2GbPerHour / 1.0)), (config.elb.newConnectionsPerSec / 25), ((config.elb.newConnectionsPerSec * config.elb.connectionDurationSec) / 3000), Math.max(0, (config.elb.requestsPerSec * Math.max(0, config.elb.ruleEvaluationsPerRequest - 10)) / 1000)) * 0.008).toFixed(2)}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">Load Balancer Total</span><span className="text-gray-900 font-mono">${liveEstimate.networking.toFixed(2)}</span></div>
                            </>
                          )}
                          {selectedService === "vpc" && (
                            <>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">Site-to-Site VPN usage cost</span><span className="text-gray-900 font-mono">${(config.vpc.siteToSiteVpnConnections * (config.vpc.siteToSiteVpnDurationUnit === "hours per day" ? config.vpc.siteToSiteVpnDuration * 30.44 : config.vpc.siteToSiteVpnDurationUnit === "hours per week" ? config.vpc.siteToSiteVpnDuration * 4.345 : config.vpc.siteToSiteVpnDuration) * 0.05).toFixed(2)}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">Client VPN endpoint cost</span><span className="text-gray-900 font-mono">${(config.vpc.clientVpnSubnetAssociations * 730 * 0.10).toFixed(2)}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">Client VPN connection cost</span><span className="text-gray-900 font-mono">${(() => { const active = config.vpc.clientVpnActiveConnectionsUnit === "per day" ? config.vpc.clientVpnActiveConnections : config.vpc.clientVpnActiveConnectionsUnit === "per week" ? config.vpc.clientVpnActiveConnections / 7 : config.vpc.clientVpnActiveConnections / 30.44; const duration = config.vpc.clientVpnAvgDurationUnit === "hours per day" ? config.vpc.clientVpnAvgDuration : config.vpc.clientVpnAvgDurationUnit === "hours per week" ? config.vpc.clientVpnAvgDuration / 7 : config.vpc.clientVpnAvgDuration / 30.44; return (active * duration * config.vpc.clientVpnWorkingDaysPerMonth * 0.05).toFixed(2); })()}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">VPC Total</span><span className="text-gray-900 font-mono">${liveEstimate.networking.toFixed(2)}</span></div>
                            </>
                          )}
                          {selectedService === "lambda" && (
                            <>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">Request Charges</span><span className="text-gray-900 font-mono">${(((Math.max(0, (config.lambda.requestsUnit === "per month" ? config.lambda.requests : config.lambda.requestsUnit === "million per month" ? config.lambda.requests * 1_000_000 : config.lambda.requests * 1_000_000_000) - (config.lambda.includeFreeTier ? 1_000_000 : 0))) / 1_000_000) * 0.2).toFixed(2)}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">Duration Charges</span><span className="text-gray-900 font-mono">${(Math.max(0, ((config.lambda.requestsUnit === "per month" ? config.lambda.requests : config.lambda.requestsUnit === "million per month" ? config.lambda.requests * 1_000_000 : config.lambda.requests * 1_000_000_000) * (config.lambda.averageDurationMs / 1000) * (config.lambda.memoryMb / 1024)) - (config.lambda.includeFreeTier ? 400_000 : 0)) * (config.lambda.architecture === "arm" ? 0.0000133334 : 0.0000166667)).toFixed(2)}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">Ephemeral Storage Charges</span><span className="text-gray-900 font-mono">${(((config.lambda.requestsUnit === "per month" ? config.lambda.requests : config.lambda.requestsUnit === "million per month" ? config.lambda.requests * 1_000_000 : config.lambda.requests * 1_000_000_000) * (config.lambda.averageDurationMs / 1000) * Math.max(0, (config.lambda.ephemeralStorageMb / 1024) - 0.5)) * 0.0000000309).toFixed(2)}</span></div>
                              <div className="flex justify-between text-sm"><span className="text-gray-600">Lambda Total</span><span className="text-gray-900 font-mono">${liveEstimate.compute.toFixed(2)}</span></div>
                            </>
                          )}
                          <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total Monthly Cost</span>
                            <span className="text-xl font-mono font-bold text-primary-500">${liveEstimate.total.toFixed(2)} USD</span>
                          </div>
                        </div>
                      ) : (
                      <div className="space-y-3">
                        {liveEstimate.compute > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Compute ({config.compute.quantity}x {computePricing.find(p => p.id === config.compute.pricingId)?.instance_type})</span>
                            <span className="text-gray-900 font-mono">${liveEstimate.compute.toFixed(2)}</span>
                          </div>
                        )}
                        {liveEstimate.storage > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Storage ({config.storage.sizeGb} GB {storagePricing.find(p => p.id === config.storage.pricingId)?.storage_name})</span>
                            <span className="text-gray-900 font-mono">${liveEstimate.storage.toFixed(2)}</span>
                          </div>
                        )}
                        {liveEstimate.database > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Database ({config.database.quantity}x {databasePricing.find(p => p.id === config.database.pricingId)?.instance_class})</span>
                            <span className="text-gray-900 font-mono">${liveEstimate.database.toFixed(2)}</span>
                          </div>
                        )}
                        {liveEstimate.networking > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Networking ({config.networking.quantity} Units)</span>
                            <span className="text-gray-900 font-mono">${liveEstimate.networking.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total Monthly Cost</span>
                          <span className="text-xl font-mono font-bold text-primary-500">${liveEstimate.total.toFixed(2)} USD</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>

      {savedServices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/90 backdrop-blur-md border border-gray-200 rounded-2xl p-8"
        >
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Saved Services Summary</h2>
              <p className="text-xs text-gray-500 mt-1">Combined monthly estimate across the services you have saved in this session.</p>
            </div>
            <div className="text-left lg:text-right">
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Combined Monthly Total</div>
              <div className="text-3xl font-mono font-bold text-primary-500">${savedServicesSummary.total.toFixed(2)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6">
            <div className="space-y-3">
              {savedServices.map((service) => (
                <div key={service.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{service.serviceLabel}</div>
                    <div className="text-xs text-gray-500 mt-1">{service.providerName} • {service.regionName}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Monthly</div>
                      <div className="text-lg font-mono font-bold text-gray-900">${service.monthlyTotal.toFixed(2)}</div>
                    </div>
                    <button
                      onClick={() => handleRemoveSavedService(service.id)}
                      className="w-10 h-10 rounded-xl border border-gray-300 bg-gray-50 hover:bg-white/10 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors"
                      aria-label={`Remove ${service.serviceLabel}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-primary-500/15 bg-primary-500/5 p-6 space-y-4">
              <div className="text-sm font-semibold text-gray-900">Cost Breakdown</div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Compute</span>
                  <span className="text-gray-900 font-mono">${savedServicesSummary.compute.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Storage</span>
                  <span className="text-gray-900 font-mono">${savedServicesSummary.storage.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Database</span>
                  <span className="text-gray-900 font-mono">${savedServicesSummary.database.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Networking</span>
                  <span className="text-gray-900 font-mono">${savedServicesSummary.networking.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {result && showResults && isComparing && (
        <motion.div 
          id="comparison-report"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/90 backdrop-blur-md border border-gray-200 rounded-2xl p-8"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Comparison Intelligence Report</h2>
              <p className="text-xs text-gray-500 mt-1">Detailed breakdown of infrastructure costs across primary providers.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {comparisonProviders.map((b, idx) => (
              <div key={idx} className={`p-6 rounded-2xl border transition-all ${b.is_cheapest ? 'bg-primary-500/5 border-primary-500/20' : 'bg-gray-50 backdrop-blur-sm border-gray-200'}`}>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${b.is_cheapest ? 'bg-primary-500/20 text-primary-500' : 'bg-gray-50 text-gray-500'}`}>
                      <Cloud size={20} />
                    </div>
                    <div>
                      <span className="text-lg font-bold text-gray-900">{b.provider_name}</span>
                      {b.missing && <div className="text-xs text-gray-500">No data available</div>}
                    </div>
                  </div>
                  {b.is_cheapest && <span className="px-2 py-1 bg-primary-500 text-black text-[10px] font-bold rounded uppercase tracking-widest">Best Value</span>}
                </div>

                <div className="space-y-4">
                  {[
                    { label: "Compute", value: b.compute_cost_monthly, icon: Cpu },
                    { label: "Storage", value: b.storage_cost_monthly, icon: Database },
                    { label: "Database", value: b.database_cost_monthly, icon: Server },
                    { label: "Networking", value: b.networking_cost_monthly, icon: Network },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2 text-gray-500">
                        <item.icon size={12} />
                        <span>{item.label}</span>
                      </div>
                      <span className="text-gray-900 font-mono">${item.value.toFixed(2)}</span>
                    </div>
                  ))}
                  
                  <div className="pt-6 mt-6 border-t border-gray-200">
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Monthly Total</div>
                        <div className={`text-3xl font-mono font-bold ${b.is_cheapest ? 'text-primary-500' : 'text-gray-900'}`}>${b.total_cost_monthly.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};
