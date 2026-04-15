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
    { label: "ASG", value: "asg", type: "compute" },
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
    { label: "Cloud SQL", value: "sql", type: "database" },
    { label: "Cloud Storage", value: "gcs", type: "storage" },
    { label: "BigQuery", value: "bigquery", type: "database" },
    { label: "Cloud Run", value: "run", type: "compute" },
    { label: "GKE Kubernetes", value: "gke", type: "compute" },
    { label: "Cloud Spanner", value: "spanner", type: "database" }
  ]
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

export const CalculatorView = ({ user }: { user: User }) => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedAZ, setSelectedAZ] = useState<string>("");
  const [selectedService, setSelectedService] = useState<string>("ec2");
  
  const [loadingPricing, setLoadingPricing] = useState(false);
  
  const currentServices = PROVIDER_SERVICES[selectedProvider] || PROVIDER_SERVICES["aws"];
  const currentServiceType = currentServices.find(s => s.value === selectedService)?.type || "compute";
  
  const currentRegion = regions.find(r => r.id === selectedRegion);
  const availabilityZones = currentRegion?.availability_zones || [];
  
  const [computePricing, setComputePricing] = useState<ComputePricing[]>([]);
  const [storagePricing, setStoragePricing] = useState<StoragePricing[]>([]);
  const [databasePricing, setDatabasePricing] = useState<DatabasePricing[]>([]);
  const [networkingPricing, setNetworkingPricing] = useState<NetworkingPricing[]>([]);

  const [config, setConfig] = useState<any>({
    compute: { pricingId: "", quantity: 1, os: "linux", vcpu: 2, ram: 4, family: "Any" },
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
  
  const [duration, setDuration] = useState(12);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Calculation | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [showCalculations, setShowCalculations] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [regionSearchTerm, setRegionSearchTerm] = useState("");
  const [azSearchTerm, setAzSearchTerm] = useState("");
  const [dbInstanceDropdownOpen, setDbInstanceDropdownOpen] = useState(false);
  const [dbInstanceSearchTerm, setDbInstanceSearchTerm] = useState("");

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
      const firstService = PROVIDER_SERVICES[selectedProvider]?.[0]?.value || "ec2";
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

  const handleCalculate = async () => {
    if (!selectedProvider || !selectedRegion) return;
    
    const providerName = providers.find(p => p.id === selectedProvider)?.name || "";
    
    setLoading(true);
    try {
      const compute_selections = config.compute.pricingId ? [{
        type: "compute",
        provider_id: selectedProvider,
        region_id: selectedRegion,
        compute_pricing_id: config.compute.pricingId,
        quantity: config.compute.quantity,
        provider_name: providerName,
        label: "Compute"
      }] : [];

      const storage_selections = config.storage.pricingId || selectedService === "s3" ? [{
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

      const database_selections = config.database.pricingId ? [{
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

      const networking_selections = config.networking.pricingId ? [{
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

      const data: any = {
        compute_selections,
        storage_selections,
        database_selections,
        networking_selections,
        eks_selections,
        duration_months: duration
      };

      const res = await api.calculate(user.token, data);
      setResult(res);
      setShowResults(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const [showAddedMessage, setShowAddedMessage] = useState(false);
  
  const filteredComputePricing = useMemo(() => computePricing.filter(p => {
    const matchVcpu = p.vcpu >= config.compute.vcpu;
    const matchRam = p.memory_gb >= config.compute.ram;
    const matchFamily = config.compute.family === "Any" || p.instance_type === config.compute.family;
    const matchOS = !config.compute.os || p.os_type?.toLowerCase() === config.compute.os.toLowerCase();
    const isLambda = p.instance_type.toLowerCase().includes("lambda") || p.instance_type.toLowerCase().includes("function");
    return matchVcpu && matchRam && matchFamily && matchOS && !isLambda;
  }), [computePricing, config.compute.vcpu, config.compute.ram, config.compute.family, config.compute.os]);

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

  const filteredRegions = regions.filter(r => 
    r.region_name.toLowerCase().includes(regionSearchTerm.toLowerCase()) ||
    r.region_code.toLowerCase().includes(regionSearchTerm.toLowerCase())
  );

  const filteredAZs = availabilityZones.filter(az => 
    az.toLowerCase().includes(azSearchTerm.toLowerCase())
  );

  const chartData = result?.result_json?.provider_breakdowns
    ?.filter(b => {
      const allowed = ["aws", "azure", "gcp"];
      return allowed.includes(b.provider_name.toLowerCase());
    })
    .map(b => ({
      name: b.provider_name,
      Compute: b.compute_cost_monthly,
      Storage: b.storage_cost_monthly,
      Database: b.database_cost_monthly,
      Networking: b.networking_cost_monthly,
      Total: b.total_cost_monthly
    })) || [];

  const pieData = result?.result_json?.provider_breakdowns?.find(b => b.is_cheapest) ? [
    { name: 'Compute', value: result.result_json.provider_breakdowns.find(b => b.is_cheapest)!.compute_cost_monthly || 0 },
    { name: 'Storage', value: result.result_json.provider_breakdowns.find(b => b.is_cheapest)!.storage_cost_monthly || 0 },
    { name: 'Database', value: result.result_json.provider_breakdowns.find(b => b.is_cheapest)!.database_cost_monthly || 0 },
    { name: 'Networking', value: result.result_json.provider_breakdowns.find(b => b.is_cheapest)!.networking_cost_monthly || 0 },
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
    const storageCost = config.database.storageGb * storageRate * dbMultiplier;

    const database = (dbBasePrice * dbMultiplier * config.database.quantity * dbHours) + storageCost;
    
    const networking = (networkingPricing.find(p => p.id === config.networking.pricingId)?.price_per_unit || 0) * config.networking.quantity;
    const eks = selectedService === "eks" ? config.eks.clusters * 0.10 * 730 : 0;
    
    let dynamodbCost = 0;
    if (selectedService === "dynamodb") {
      const ddb = config.dynamodb;
      const storageGb = ddb.dataStorageUnit === "TB" ? ddb.dataStorageSize * 1024 : ddb.dataStorageSize;
      const storageCost = storageGb * 0.25;

      const itemSizeKb = ddb.avgItemSizeUnit === "Byte" ? ddb.avgItemSize / 1024 : ddb.avgItemSize;
      const writeItemSizeKb = Math.ceil(itemSizeKb);
      const readBlocks = Math.ceil(itemSizeKb / 4);

      if (ddb.capacityMode === "on-demand") {
        const writeRateMultiplier = 
          ddb.writeRateUnit === "per second" ? 730 * 3600 :
          ddb.writeRateUnit === "per minute" ? 730 * 60 :
          ddb.writeRateUnit === "per hour" ? 730 :
          ddb.writeRateUnit === "per day" ? 30.416 :
          ddb.writeRateUnit === "per month" ? 1 :
          1000000;
          
        const totalWritesPerMonth = ddb.writeRate * writeRateMultiplier;
        const standardWrites = totalWritesPerMonth * (ddb.standardWritesPercent / 100);
        const transactionalWrites = totalWritesPerMonth * (ddb.transactionalWritesPercent / 100);
        
        const wruPerMonth = (standardWrites * writeItemSizeKb) + (transactionalWrites * writeItemSizeKb * 2);
        const writeCost = (wruPerMonth / 1000000) * 1.25;

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
        const readCost = (rruPerMonth / 1000000) * 0.25;
        
        dynamodbCost = storageCost + writeCost + readCost;
      } else {
        const peakWcu = (ddb.peakWriteRate * (ddb.standardWritesPercent / 100) * writeItemSizeKb) + 
                        (ddb.peakWriteRate * (ddb.transactionalWritesPercent / 100) * writeItemSizeKb * 2);
        const baselineWcu = (ddb.baselineWriteRate * (ddb.standardWritesPercent / 100) * writeItemSizeKb) + 
                            (ddb.baselineWriteRate * (ddb.transactionalWritesPercent / 100) * writeItemSizeKb * 2);
        
        const peakHours = ddb.durationOfPeakWrite;
        const baselineHours = Math.max(0, 730 - peakHours);
        
        const writeCost = (peakWcu * 0.00065 * peakHours) + (baselineWcu * 0.00065 * baselineHours);
        
        const peakRcu = (ddb.peakReadRate * (ddb.eventuallyConsistentPercent / 100) * readBlocks * 0.5) + 
                        (ddb.peakReadRate * (ddb.stronglyConsistentPercent / 100) * readBlocks) + 
                        (ddb.peakReadRate * (ddb.transactionalReadsPercent / 100) * readBlocks * 2);
        const baselineRcu = (ddb.baselineReadRate * (ddb.eventuallyConsistentPercent / 100) * readBlocks * 0.5) + 
                            (ddb.baselineReadRate * (ddb.stronglyConsistentPercent / 100) * readBlocks) + 
                            (ddb.baselineReadRate * (ddb.transactionalReadsPercent / 100) * readBlocks * 2);
                            
        const peakReadHours = ddb.durationOfPeakRead;
        const baselineReadHours = Math.max(0, 730 - peakReadHours);
        
        const readCost = (peakRcu * 0.00013 * peakReadHours) + (baselineRcu * 0.00013 * baselineReadHours);
        
        dynamodbCost = storageCost + writeCost + readCost;
      }
    }
    
    // Apply contract discounts
    const discountMultiplier = duration === 36 ? 0.4 : duration === 12 ? 0.7 : 1.0;
    
    const finalDatabaseCost = selectedService === "dynamodb" ? dynamodbCost : database;
    
    const baseTotal = (selectedService === "eks" ? eks : compute) + (selectedService === "s3" ? s3Total : storage) + finalDatabaseCost + networking;
    
    return {
      compute: (selectedService === "eks" ? eks : compute) * discountMultiplier,
      storage: (selectedService === "s3" ? s3Total : storage) * (selectedService === "s3" || selectedService === "blob" || selectedService === "gcs" ? 1.0 : discountMultiplier),
      database: finalDatabaseCost * discountMultiplier,
      networking: networking,
      total: baseTotal * discountMultiplier
    };
  }, [computePricing, storagePricing, databasePricing, networkingPricing, config, selectedService, duration]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-[#141414]/60 backdrop-blur-md p-4 rounded-2xl border border-white/5">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Cloud Provider</label>
          <select 
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
          >
            {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Region</label>
          <select 
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
          >
            {regions.map(r => (
              <option key={r.id} value={r.id}>
                {r.region_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Availability Zone</label>
          <select 
            value={selectedAZ}
            onChange={(e) => setSelectedAZ(e.target.value)}
            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
          >
            {availabilityZones.map(az => <option key={az} value={az}>{az}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Services</label>
          <select 
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
          >
            {currentServices.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-[#141414]/60 backdrop-blur-md border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                {currentServiceType === "compute" && <Cpu className="text-emerald-500" size={20} />}
                {currentServiceType === "storage" && <Database className="text-emerald-500" size={20} />}
                {currentServiceType === "database" && <Server className="text-emerald-500" size={20} />}
                {currentServiceType === "networking" && <Network className="text-emerald-500" size={20} />}
              </div>
              <h2 className="text-lg font-semibold text-white capitalize">{currentServices.find(s => s.value === selectedService)?.label} Configuration</h2>
            </div>
          </div>
          
          <div className="space-y-6">
            {currentServiceType === "compute" && selectedService !== "eks" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Operating System</label>
                    <select 
                      value={config.compute.os}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, compute: { ...prev.compute, os: e.target.value } }))}
                      className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                    >
                      <option value="linux">Linux</option>
                      <option value="windows">Windows</option>
                      <option value="rhel">RHEL</option>
                      <option value="sles">SUSE</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Instance Type</label>
                    <select 
                      value={config.compute.family}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, compute: { ...prev.compute, family: e.target.value } }))}
                      className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                    >
                      {familyOptions.map(opt => <option key={opt} value={opt}>{opt === "Any" ? "Any Type" : opt}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">vCPUs</label>
                    <select 
                      value={config.compute.vcpu}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, compute: { ...prev.compute, vcpu: parseInt(e.target.value) } }))}
                      className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                    >
                      {VCPU_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Memory (GiB)</label>
                    <select 
                      value={config.compute.ram}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, compute: { ...prev.compute, ram: parseInt(e.target.value) } }))}
                      className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                    >
                      {MEMORY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Quantity</label>
                    <input 
                      type="number" 
                      value={config.compute.quantity}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, compute: { ...prev.compute, quantity: parseInt(e.target.value) || 1 } }))}
                      className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                    />
                  </div>
                </div>

                {/* Instance Table */}
                <div className="mt-8 border border-white/5 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white/5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5">
                        <th className="px-6 py-4 w-12"></th>
                        <th className="px-6 py-4">Instance name</th>
                        <th className="px-6 py-4">vCPUs</th>
                        <th className="px-6 py-4">Memory</th>
                        <th className="px-6 py-4">Hourly Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredComputePricing.slice(0, 10).map((p) => (
                        <tr 
                          key={p.id} 
                          onClick={() => setConfig((prev: any) => ({ ...prev, compute: { ...prev.compute, pricingId: p.id } }))}
                          className={`cursor-pointer transition-colors ${config.compute.pricingId === p.id ? 'bg-emerald-500/10' : 'hover:bg-white/[0.02]'}`}
                        >
                          <td className="px-6 py-4">
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${config.compute.pricingId === p.id ? 'border-emerald-500' : 'border-zinc-600'}`}>
                              {config.compute.pricingId === p.id && <div className="w-2 h-2 bg-emerald-500 rounded-full" />}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">{p.instance_type}</span>
                              {config.compute.pricingId === p.id && (
                                <span className="text-[8px] font-bold bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded uppercase tracking-tighter">Selected</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-400">{p.vcpu}</td>
                          <td className="px-6 py-4 text-sm text-zinc-400">{p.memory_gb} GiB</td>
                          <td className="px-6 py-4 text-sm font-mono text-emerald-400">${p.price_per_hour.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedService === "eks" && (
              <div className="space-y-6">
                <div className="bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <h3 className="text-lg font-bold text-white">EKS Cluster Pricing - Standard Support</h3>
                  </div>
                  
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Number of EKS Clusters</label>
                      <input 
                        type="number" 
                        min="0"
                        value={config.eks.clusters}
                        onChange={(e) => setConfig((prev: any) => ({ ...prev, eks: { ...prev.eks, clusters: parseInt(e.target.value) || 0 } }))}
                        className="w-full max-w-md bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-xl px-6 py-4 text-lg font-mono text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                      />
                    </div>

                    <div className="pt-8 border-t border-white/5">
                      <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          EKS clusters are billed at a flat rate of <span className="text-white font-bold">$0.10 per hour</span>. 
                          Worker nodes are billed separately as EC2 instances.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentServiceType === "database" && selectedService !== "dynamodb" && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Database Engine</label>
                      <select 
                        value={config.database.engine}
                        onChange={(e) => setConfig((prev: any) => ({ ...prev, database: { ...prev.database, engine: e.target.value } }))}
                        className="w-full bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                      >
                        {databaseEngines.map(eng => <option key={eng} value={eng}>{eng}</option>)}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Nodes (Enter the number of DB instances that you need)</label>
                      <input 
                        type="number" 
                        value={config.database.quantity}
                        onChange={(e) => setConfig((prev: any) => ({ ...prev, database: { ...prev.database, quantity: parseInt(e.target.value) || 1 } }))}
                        className="w-full bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                      />
                    </div>

                    <div className="space-y-3 relative">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Select instance type</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setDbInstanceDropdownOpen(!dbInstanceDropdownOpen)}
                          className="w-full bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all text-left flex justify-between items-center"
                        >
                          {config.database.pricingId ? (() => {
                            const p = filteredDatabasePricing.find(p => p.id === config.database.pricingId);
                            if (!p) return "Select Instance Type";
                            return (
                              <div className="flex flex-col">
                                <span className="text-emerald-500 font-medium">{p.instance_class}</span>
                                <span className="text-xs text-zinc-400">vCPU: {p.vcpu} &nbsp; Memory: {p.memory_gb} GiB</span>
                              </div>
                            );
                          })() : "Select Instance Type"}
                          <svg className={`w-4 h-4 transition-transform ${dbInstanceDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        
                        {dbInstanceDropdownOpen && (
                          <div className="absolute z-50 w-full mt-2 bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl max-h-80 flex flex-col">
                            <div className="p-2 border-b border-white/10 sticky top-0 bg-[#1a1a1a]/60 backdrop-blur-sm rounded-t-xl z-10">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
                                <input
                                  type="text"
                                  placeholder="Search instance type..."
                                  value={dbInstanceSearchTerm}
                                  onChange={(e) => setDbInstanceSearchTerm(e.target.value)}
                                  className="w-full bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
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
                                  className={`w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${config.database.pricingId === p.id ? 'bg-emerald-500/10' : ''}`}
                                >
                                  <div className="text-emerald-500 font-medium">{p.instance_class}</div>
                                  <div className="text-xs text-zinc-400 mt-1">vCPU: {p.vcpu} &nbsp; Memory: {p.memory_gb} GiB</div>
                                </button>
                              ))}
                              {filteredDatabasePricing.filter(p => p.instance_class?.toLowerCase().includes(dbInstanceSearchTerm.toLowerCase())).length === 0 && (
                                <div className="px-4 py-3 text-sm text-zinc-500 text-center">No instances found</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                    <div className="space-y-6 mt-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Utilization (On-Demand only)</label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 ml-1">Value</span>
                            <input 
                              type="number" 
                              value={config.database.utilizationValue}
                              onChange={(e) => {
                                let val = parseFloat(e.target.value) || 0;
                                if (config.database.utilizationUnit === "%Utilized/Month" && val > 100) val = 100;
                                setConfig((prev: any) => ({ ...prev, database: { ...prev.database, utilizationValue: val } }));
                              }}
                              className="w-full bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 ml-1">Unit</span>
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
                              className="w-full bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
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
            {currentServiceType === "storage" && selectedService !== "s3" && selectedService !== "dynamodb" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Storage Type</label>
                    <select 
                      value={config.storage.pricingId}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, pricingId: e.target.value } }))}
                      className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                    >
                      {storagePricing.map(p => (
                        <option key={p.id} value={p.id}>{p.storage_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Size</label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        value={config.storage.size}
                        onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, size: parseInt(e.target.value) || 1 } }))}
                        className="flex-1 bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                      />
                      <select 
                        value={config.storage.unit}
                        onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, unit: e.target.value } }))}
                        className="bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors w-32"
                      >
                        <option value="GB">GB</option>
                        <option value="TB">TB</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedService === "s3" && (
              <div className="space-y-8">
                <div className="bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-2xl p-6 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">S3 Standard storage</label>
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          value={config.storage.size}
                          onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, size: parseInt(e.target.value) || 0 } }))}
                          className="flex-1 bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all min-w-0"
                        />
                        <select 
                          value={config.storage.unit}
                          onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, unit: e.target.value } }))}
                          className="bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none w-40"
                        >
                          <option value="GB">GB per month</option>
                          <option value="TB">TB per month</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="space-y-3 col-span-full">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">How will data be moved into S3 Standard?</label>
                      <p className="text-[11px] text-zinc-400 ml-1 leading-relaxed mb-2">
                        Automatically calculates PUT, COPY, POST costs for moving data into S3 Standard initially. To compare the cost of current storage in S3 Standard to lifecycling this data to another storage class, you can specify that your storage is already stored in S3 Standard while selecting Lifecycle under the new storage class to capture the upfront cost of moving your data.
                      </p>
                      <select 
                        value={config.storage.movementType}
                        onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, movementType: e.target.value } }))}
                        className="w-full bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
                      >
                        <option value="already_stored">The specified amount of data is already stored in S3 Standard</option>
                        <option value="put_copy_post">PUT, COPY, POST requests to S3 Standard</option>
                      </select>
                    </div>

                    {config.storage.movementType === "put_copy_post" && (
                      <div className="space-y-3 col-span-full">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">S3 Standard Average Object Size</label>
                        <p className="text-[11px] text-zinc-400 ml-1 leading-relaxed mb-2">
                          Used to calculate number of objects which affects cost of moving data into S3 Standard. You can find the average object size of your existing S3 data using S3 Storage Lens in the S3 Console.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 ml-1">Value</span>
                            <input 
                              type="number" 
                              value={config.storage.avgObjectSize}
                              onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, avgObjectSize: parseFloat(e.target.value) || 0 } }))}
                              className="w-full bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 ml-1">Unit</span>
                            <select 
                              value={config.storage.avgObjectSizeUnit}
                              onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, avgObjectSizeUnit: e.target.value } }))}
                              className="w-full bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
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
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">PUT, COPY, POST, LIST requests to S3 Standard</label>
                      <p className="text-[11px] text-zinc-400 ml-1 leading-relaxed">Ongoing monthly number of PUT, COPY, POST or LIST requests</p>
                      <input 
                        type="number" 
                        placeholder="Enter amount of requests"
                        value={config.storage.putRequests || ''}
                        onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, putRequests: parseInt(e.target.value) || 0 } }))}
                        className="w-full bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">GET, SELECT, and all other requests from S3 Standard</label>
                      <p className="text-[11px] text-zinc-400 ml-1 leading-relaxed">Ongoing monthly number of GET, SELECT and all other requests</p>
                      <input 
                        type="number" 
                        placeholder="Enter amount of requests"
                        value={config.storage.getRequests || ''}
                        onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, getRequests: parseInt(e.target.value) || 0 } }))}
                        className="w-full bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Data returned by S3 Select</label>
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          placeholder="Enter amount"
                          value={config.storage.selectReturned || ''}
                          onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, selectReturned: parseInt(e.target.value) || 0 } }))}
                          className="flex-1 bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all min-w-0"
                        />
                        <select 
                          value={config.storage.selectReturnedUnit}
                          onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, selectReturnedUnit: e.target.value } }))}
                          className="bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none w-40"
                        >
                          <option value="GB">GB per month</option>
                          <option value="TB">TB per month</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Data scanned by S3 Select</label>
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          placeholder="Enter amount"
                          value={config.storage.selectScanned || ''}
                          onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, selectScanned: parseInt(e.target.value) || 0 } }))}
                          className="flex-1 bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all min-w-0"
                        />
                        <select 
                          value={config.storage.selectScannedUnit}
                          onChange={(e) => setConfig((prev: any) => ({ ...prev, storage: { ...prev.storage, selectScannedUnit: e.target.value } }))}
                          className="bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none w-40"
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
                <div className="bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">Choose DynamoDB features</h3>
                    <p className="text-sm text-zinc-400">Choose the DynamoDB features whose pricing you want to estimate.</p>
                  </div>
                  <div className="flex space-x-6">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input 
                        type="radio" 
                        name="capacityMode" 
                        value="on-demand" 
                        checked={config.dynamodb.capacityMode === "on-demand"}
                        onChange={() => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, capacityMode: "on-demand" } }))}
                        className="form-radio text-emerald-500 bg-[#1a1a1a]/60 backdrop-blur-sm border-white/20 focus:ring-emerald-500/50"
                      />
                      <span className="text-white">DynamoDB on-demand capacity</span>
                    </label>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input 
                        type="radio" 
                        name="capacityMode" 
                        value="provisioned" 
                        checked={config.dynamodb.capacityMode === "provisioned"}
                        onChange={() => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, capacityMode: "provisioned" } }))}
                        className="form-radio text-emerald-500 bg-[#1a1a1a]/60 backdrop-blur-sm border-white/20 focus:ring-emerald-500/50"
                      />
                      <span className="text-white">DynamoDB provisioned capacity</span>
                    </label>
                  </div>
                </div>

                <div className="bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-6">
                  <h3 className="text-lg font-semibold text-white">Table Class</h3>
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Table class</label>
                    <select 
                      value={config.dynamodb.tableClass}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, tableClass: e.target.value } }))}
                      className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                    >
                      <option value="Standard">Standard</option>
                    </select>
                  </div>
                </div>

                <div className="bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-6">
                  <h3 className="text-lg font-semibold text-white">Data storage</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Data storage size</label>
                      <div className="flex space-x-2">
                        <input 
                          type="number" 
                          value={config.dynamodb.dataStorageSize}
                          onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, dataStorageSize: parseFloat(e.target.value) || 0 } }))}
                          className="flex-1 bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                        />
                        <select 
                          value={config.dynamodb.dataStorageUnit}
                          onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, dataStorageUnit: e.target.value } }))}
                          className="w-24 bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                        >
                          <option value="GB">GB</option>
                          <option value="TB">TB</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Average item size (all attributes)</label>
                      <div className="flex space-x-2">
                        <input 
                          type="number" 
                          value={config.dynamodb.avgItemSize}
                          onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, avgItemSize: parseFloat(e.target.value) || 0 } }))}
                          className="flex-1 bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                        />
                        <select 
                          value={config.dynamodb.avgItemSizeUnit}
                          onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, avgItemSizeUnit: e.target.value } }))}
                          className="w-24 bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
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
                    <div className="bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-6">
                      <h3 className="text-lg font-semibold text-white">On-demand write settings</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Standard writes (%)</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.standardWritesPercent}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, standardWritesPercent: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Transactional writes (%)</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.transactionalWritesPercent}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, transactionalWritesPercent: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3 md:col-span-2">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Number of writes</label>
                          <div className="flex space-x-2">
                            <input 
                              type="number" 
                              value={config.dynamodb.writeRate}
                              onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, writeRate: parseFloat(e.target.value) || 0 } }))}
                              className="flex-1 bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                            />
                            <select 
                              value={config.dynamodb.writeRateUnit}
                              onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, writeRateUnit: e.target.value } }))}
                              className="w-48 bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
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

                    <div className="bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-6">
                      <h3 className="text-lg font-semibold text-white">On-demand read settings</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Eventually consistent percentage (%)</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.eventuallyConsistentPercent}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, eventuallyConsistentPercent: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Strongly consistent percentage (%)</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.stronglyConsistentPercent}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, stronglyConsistentPercent: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Transactional percentage (%)</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.transactionalReadsPercent}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, transactionalReadsPercent: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3 md:col-span-2">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Number of reads</label>
                          <div className="flex space-x-2">
                            <input 
                              type="number" 
                              value={config.dynamodb.readRate}
                              onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, readRate: parseFloat(e.target.value) || 0 } }))}
                              className="flex-1 bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                            />
                            <select 
                              value={config.dynamodb.readRateUnit}
                              onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, readRateUnit: e.target.value } }))}
                              className="w-48 bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
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
                    <div className="bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-6">
                      <h3 className="text-lg font-semibold text-white">Write settings</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Percentage of Non-transactional writes</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.standardWritesPercent}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, standardWritesPercent: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Percentage of Transactional writes</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.transactionalWritesPercent}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, transactionalWritesPercent: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Baseline write rate (per second)</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.baselineWriteRate}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, baselineWriteRate: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Peak write rate (per second)</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.peakWriteRate}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, peakWriteRate: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Duration of peak write activity (hours/month)</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.durationOfPeakWrite}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, durationOfPeakWrite: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Percentage of baseline writes covered by reserved capacity</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.writeReservedCapacityPercent}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, writeReservedCapacityPercent: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Write reserved capacity term</label>
                          <select 
                            value={config.dynamodb.writeReservedCapacityTerm}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, writeReservedCapacityTerm: e.target.value } }))}
                            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                          >
                            <option value="1 year">1 year</option>
                            <option value="3 year">3 year</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#141414]/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-6">
                      <h3 className="text-lg font-semibold text-white">Read settings</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Eventually consistent percentage</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.eventuallyConsistentPercent}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, eventuallyConsistentPercent: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Strongly consistent percentage</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.stronglyConsistentPercent}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, stronglyConsistentPercent: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Transactional percentage</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.transactionalReadsPercent}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, transactionalReadsPercent: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Baseline read rate (per second)</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.baselineReadRate}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, baselineReadRate: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Peak read rate (per second)</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.peakReadRate}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, peakReadRate: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Duration of peak read activity (hours/month)</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.durationOfPeakRead}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, durationOfPeakRead: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Percentage of baseline reads covered by reserved capacity</label>
                          <input 
                            type="number" 
                            value={config.dynamodb.readReservedCapacityPercent}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, readReservedCapacityPercent: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Read reserved capacity term</label>
                          <select 
                            value={config.dynamodb.readReservedCapacityTerm}
                            onChange={(e) => setConfig((prev: any) => ({ ...prev, dynamodb: { ...prev.dynamodb, readReservedCapacityTerm: e.target.value } }))}
                            className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
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

            {currentServiceType === "networking" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Networking Service</label>
                    <select 
                      value={config.networking.pricingId}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, networking: { ...prev.networking, pricingId: e.target.value } }))}
                      className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                    >
                      {networkingPricing.map(p => (
                        <option key={p.id} value={p.id}>{p.service_type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Quantity (Units)</label>
                    <input 
                      type="number" 
                      value={config.networking.quantity}
                      onChange={(e) => setConfig((prev: any) => ({ ...prev, networking: { ...prev.networking, quantity: parseInt(e.target.value) || 1 } }))}
                      className="w-full bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

          {/* Bottom Actions */}
          <div className="bg-[#141414]/60 backdrop-blur-md border border-white/5 rounded-2xl p-6 flex flex-col gap-6">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="flex flex-col gap-1 w-full lg:w-auto">
                <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Estimated Monthly Cost</div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <div className="text-3xl font-mono font-bold text-emerald-500">
                    {showResults ? `$${liveEstimate.total.toFixed(2)}` : "$ --.--"}
                  </div>
                  {showResults && liveEstimate.total > 0 && (
                    <div className="text-[10px] text-zinc-500 flex flex-wrap gap-x-3 gap-y-1">
                      {liveEstimate.compute > 0 && <span>Compute: ${liveEstimate.compute.toFixed(2)}</span>}
                      {liveEstimate.storage > 0 && <span>Storage: ${liveEstimate.storage.toFixed(2)}</span>}
                      {liveEstimate.database > 0 && <span>DB: ${liveEstimate.database.toFixed(2)}</span>}
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-zinc-600 italic">Based on 730 hours/month {duration > 1 && `with ${duration === 36 ? '60%' : '30%'} contract discount`}</div>
              </div>
              
              <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-end">
                <button 
                  onClick={() => {
                    setIsComparing(false);
                    handleCalculate();
                  }}
                  disabled={loading || !selectedProvider || !selectedRegion}
                  className="flex-1 lg:flex-none px-8 py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/20 disabled:text-emerald-500/50 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <Calculator size={20} />}
                  Calculate Cost
                </button>
                <div className="flex items-center gap-4 w-full lg:w-auto">
                  <button 
                    onClick={async () => {
                      setIsComparing(true);
                      await handleCalculate();
                      setShowResults(true);
                      setTimeout(() => {
                        document.getElementById('comparison-report')?.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }}
                    disabled={loading || !selectedProvider || !selectedRegion}
                    className="flex-1 lg:flex-none px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/20 disabled:text-blue-600/50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/10"
                  >
                    <BarChart3 size={20} />
                    Compare
                  </button>

                  {/* Cost Intelligence integrated here */}
                  <div className="bg-[#1a1a1a]/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-2 flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Contract</span>
                      <select 
                        value={duration} 
                        onChange={(e) => setDuration(parseInt(e.target.value))}
                        className="bg-transparent text-emerald-500 text-xs font-bold focus:outline-none"
                      >
                        <option value={1}>On-Demand</option>
                        <option value={12}>1 Year</option>
                        <option value={36}>3 Year</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {showResults && (
              <div className="pt-6 border-t border-white/5 space-y-4">
                <button 
                  onClick={() => setShowCalculations(!showCalculations)}
                  className="flex items-center gap-2 text-zinc-400 hover:text-zinc-300 transition-colors group"
                >
                  <div className="w-4 h-4 flex items-center justify-center rounded border border-zinc-700 group-hover:border-zinc-500">
                    {showCalculations ? <Minus size={10} /> : <Plus size={10} />}
                  </div>
                  <span className="text-xs font-medium">Show calculations</span>
                </button>

                {showCalculations && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-6 space-y-4"
                  >
                    {selectedService === "eks" ? (
                      <div className="text-sm text-zinc-400 leading-relaxed">
                        <span className="text-white font-bold">{config.eks.clusters} Clusters</span> x <span className="text-white font-bold">0.10 USD</span> per hour x <span className="text-white font-bold">730 hours</span> per month = <span className="text-emerald-500 font-bold text-lg ml-2">${(config.eks.clusters * 0.1 * 730).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                        {duration > 1 && (
                          <div className="mt-2 text-xs text-emerald-500/70 italic">
                            * Applied {duration === 36 ? '60%' : '30%'} contract discount: ${(config.eks.clusters * 0.1 * 730 * (duration === 36 ? 0.4 : 0.7)).toFixed(2)} USD
                          </div>
                        )}
                      </div>
                    ) : selectedService === "s3" ? (
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-400">Storage ({config.storage.size} {config.storage.unit})</span>
                          <span className="text-white font-mono">${(selectedService === "s3" ? calculateS3StorageCost(config.storage.size, config.storage.unit) : 0).toFixed(2)}</span>
                        </div>
                        {config.storage.movementType === "put_copy_post" && (
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">Initial Data Movement (PUT/COPY/POST)</span>
                            <span className="text-white font-mono">${((config.storage.putRequests / 1000) * 0.005).toFixed(2)}</span>
                          </div>
                        )}
                        {config.storage.putRequests > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">PUT/COPY/POST/LIST ({config.storage.putRequests} requests)</span>
                            <span className="text-white font-mono">${((config.storage.putRequests / 1000) * 0.005).toFixed(2)}</span>
                          </div>
                        )}
                        {config.storage.getRequests > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">GET/SELECT/Other ({config.storage.getRequests} requests)</span>
                            <span className="text-white font-mono">${((config.storage.getRequests / 10000) * 0.004).toFixed(2)}</span>
                          </div>
                        )}
                        {config.storage.selectReturned > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">S3 Select Returned ({config.storage.selectReturned} {config.storage.selectReturnedUnit})</span>
                            <span className="text-white font-mono">${((config.storage.selectReturnedUnit === "TB" ? config.storage.selectReturned * 1024 : config.storage.selectReturned) * 0.0007).toFixed(2)}</span>
                          </div>
                        )}
                        {config.storage.selectScanned > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">S3 Select Scanned ({config.storage.selectScanned} {config.storage.selectScannedUnit})</span>
                            <span className="text-white font-mono">${((config.storage.selectScannedUnit === "TB" ? config.storage.selectScanned * 1024 : config.storage.selectScanned) * 0.002).toFixed(2)}</span>
                          </div>
                        )}
                        <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                          <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Total Monthly Cost</span>
                          <span className="text-xl font-mono font-bold text-emerald-500">${liveEstimate.total.toFixed(2)} USD</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {liveEstimate.compute > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">Compute ({config.compute.quantity}x {computePricing.find(p => p.id === config.compute.pricingId)?.instance_type})</span>
                            <span className="text-white font-mono">${liveEstimate.compute.toFixed(2)}</span>
                          </div>
                        )}
                        {liveEstimate.storage > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">Storage ({config.storage.sizeGb} GB {storagePricing.find(p => p.id === config.storage.pricingId)?.storage_name})</span>
                            <span className="text-white font-mono">${liveEstimate.storage.toFixed(2)}</span>
                          </div>
                        )}
                        {liveEstimate.database > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">Database ({config.database.quantity}x {databasePricing.find(p => p.id === config.database.pricingId)?.instance_class})</span>
                            <span className="text-white font-mono">${liveEstimate.database.toFixed(2)}</span>
                          </div>
                        )}
                        {liveEstimate.networking > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">Networking ({config.networking.quantity} Units)</span>
                            <span className="text-white font-mono">${liveEstimate.networking.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                          <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Total Monthly Cost</span>
                          <span className="text-xl font-mono font-bold text-emerald-500">${liveEstimate.total.toFixed(2)} USD</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>

      {result && showResults && isComparing && (
        <motion.div 
          id="comparison-report"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#141414]/60 backdrop-blur-md border border-white/5 rounded-2xl p-8"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold text-white">Comparison Intelligence Report</h2>
              <p className="text-xs text-zinc-500 mt-1">Detailed breakdown of infrastructure costs across primary providers.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {result.result_json?.provider_breakdowns
              ?.filter(b => {
                const allowed = ["aws", "azure", "gcp"];
                return allowed.includes(b.provider_name.toLowerCase());
              })
              .map((b, idx) => (
              <div key={idx} className={`p-6 rounded-2xl border transition-all ${b.is_cheapest ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-[#1a1a1a]/60 backdrop-blur-sm border-white/5'}`}>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${b.is_cheapest ? 'bg-emerald-500/20 text-emerald-500' : 'bg-white/5 text-zinc-500'}`}>
                      <Cloud size={20} />
                    </div>
                    <span className="text-lg font-bold text-white">{b.provider_name}</span>
                  </div>
                  {b.is_cheapest && <span className="px-2 py-1 bg-emerald-500 text-black text-[10px] font-bold rounded uppercase tracking-widest">Best Value</span>}
                </div>

                <div className="space-y-4">
                  {[
                    { label: "Compute", value: b.compute_cost_monthly, icon: Cpu },
                    { label: "Storage", value: b.storage_cost_monthly, icon: Database },
                    { label: "Database", value: b.database_cost_monthly, icon: Server },
                    { label: "Networking", value: b.networking_cost_monthly, icon: Network },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2 text-zinc-500">
                        <item.icon size={12} />
                        <span>{item.label}</span>
                      </div>
                      <span className="text-white font-mono">${item.value.toFixed(2)}</span>
                    </div>
                  ))}
                  
                  <div className="pt-6 mt-6 border-t border-white/5">
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Monthly Total</div>
                        <div className={`text-3xl font-mono font-bold ${b.is_cheapest ? 'text-emerald-500' : 'text-white'}`}>${b.total_cost_monthly.toFixed(2)}</div>
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
