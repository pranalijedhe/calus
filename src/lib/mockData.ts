export const MOCK_PROVIDERS = [
  { id: "aws-mock", name: "AWS" },
  { id: "azure-mock", name: "Azure" },
  { id: "gcp-mock", name: "GCP" }
];

export const MOCK_REGIONS = [
  { id: "aws-us-east-1", provider_id: "aws-mock", region_name: "US East (N. Virginia)", region_code: "us-east-1", availability_zones: ["us-east-1a", "us-east-1b", "us-east-1c"] },
  { id: "azure-eastus", provider_id: "azure-mock", region_name: "East US", region_code: "eastus", availability_zones: ["1", "2", "3"] },
  { id: "gcp-us-central1", provider_id: "gcp-mock", region_name: "US Central 1 (Iowa)", region_code: "us-central1", availability_zones: ["us-central1-a", "us-central1-b", "us-central1-c"] }
];

export const MOCK_COMPUTE = [
  { id: "aws-t3-micro", provider_id: "aws-mock", region_id: "aws-us-east-1", instance_type: "t3.micro", vcpu: 2, memory_gb: 1, os_type: "Linux", price_per_hour: 0.0104 },
  { id: "aws-m5-large", provider_id: "aws-mock", region_id: "aws-us-east-1", instance_type: "m5.large", vcpu: 2, memory_gb: 8, os_type: "Linux", price_per_hour: 0.096 },
  { id: "azure-b1s", provider_id: "azure-mock", region_id: "azure-eastus", instance_type: "Standard_B1s", vcpu: 1, memory_gb: 1, os_type: "Linux", price_per_hour: 0.0104 },
  { id: "gcp-e2-micro", provider_id: "gcp-mock", region_id: "gcp-us-central1", instance_type: "e2-micro", vcpu: 2, memory_gb: 1, os_type: "Linux", price_per_hour: 0.0084 }
];

export const MOCK_STORAGE = [
  { id: "aws-s3-std", provider_id: "aws-mock", region_id: "aws-us-east-1", storage_name: "S3 Standard", storage_type: "Object Storage", price_per_gb_month: 0.023, unit_type: "GB" },
  { id: "aws-ebs-gp3", provider_id: "aws-mock", region_id: "aws-us-east-1", storage_name: "EBS gp3", storage_type: "Block Storage", price_per_gb_month: 0.08, unit_type: "GB" }
];

export const MOCK_DATABASE = [
  { id: "aws-rds-mysql", provider_id: "aws-mock", region_id: "aws-us-east-1", db_engine: "MySQL", instance_type: "db.t3.micro", vcpu: 2, memory_gb: 1, price_per_hour: 0.017 },
  { id: "aws-dynamodb", provider_id: "aws-mock", region_id: "aws-us-east-1", db_engine: "DynamoDB", instance_type: "Pay-per-request", vcpu: 0, memory_gb: 0, price_per_hour: 0 }
];

export const MOCK_NETWORKING = [
  { id: "aws-data-transfer", provider_id: "aws-mock", region_id: "aws-us-east-1", service_name: "Data Transfer Out", service_type: "Egress", price_per_unit: 0.09, unit_type: "GB" }
];
