const fs = require('fs');

const serverCode = fs.readFileSync('server.ts', 'utf-8');

const awsRegions = [
  { id: "aws-us-east-1", provider_id: "aws-mock", region_name: "US East (N. Virginia)", region_code: "us-east-1", availability_zones: ["us-east-1a", "us-east-1b", "us-east-1c"] },
  { id: "aws-us-east-2", provider_id: "aws-mock", region_name: "US East (Ohio)", region_code: "us-east-2", availability_zones: ["us-east-2a", "us-east-2b", "us-east-2c"] },
  { id: "aws-us-west-1", provider_id: "aws-mock", region_name: "US West (N. California)", region_code: "us-west-1", availability_zones: ["us-west-1a", "us-west-1b", "us-west-1c"] },
  { id: "aws-us-west-2", provider_id: "aws-mock", region_name: "US West (Oregon)", region_code: "us-west-2", availability_zones: ["us-west-2a", "us-west-2b", "us-west-2c"] },
  { id: "aws-af-south-1", provider_id: "aws-mock", region_name: "Africa (Cape Town)", region_code: "af-south-1", availability_zones: ["af-south-1a", "af-south-1b", "af-south-1c"] },
  { id: "aws-ap-east-1", provider_id: "aws-mock", region_name: "Asia Pacific (Hong Kong)", region_code: "ap-east-1", availability_zones: ["ap-east-1a", "ap-east-1b", "ap-east-1c"] },
  { id: "aws-ap-south-1", provider_id: "aws-mock", region_name: "Asia Pacific (Mumbai)", region_code: "ap-south-1", availability_zones: ["ap-south-1a", "ap-south-1b", "ap-south-1c"] },
  { id: "aws-ap-northeast-3", provider_id: "aws-mock", region_name: "Asia Pacific (Osaka)", region_code: "ap-northeast-3", availability_zones: ["ap-northeast-3a", "ap-northeast-3b", "ap-northeast-3c"] },
  { id: "aws-ap-northeast-2", provider_id: "aws-mock", region_name: "Asia Pacific (Seoul)", region_code: "ap-northeast-2", availability_zones: ["ap-northeast-2a", "ap-northeast-2b", "ap-northeast-2c"] },
  { id: "aws-ap-southeast-1", provider_id: "aws-mock", region_name: "Asia Pacific (Singapore)", region_code: "ap-southeast-1", availability_zones: ["ap-southeast-1a", "ap-southeast-1b", "ap-southeast-1c"] },
  { id: "aws-ap-southeast-2", provider_id: "aws-mock", region_name: "Asia Pacific (Sydney)", region_code: "ap-southeast-2", availability_zones: ["ap-southeast-2a", "ap-southeast-2b", "ap-southeast-2c"] },
  { id: "aws-ap-northeast-1", provider_id: "aws-mock", region_name: "Asia Pacific (Tokyo)", region_code: "ap-northeast-1", availability_zones: ["ap-northeast-1a", "ap-northeast-1b", "ap-northeast-1c"] },
  { id: "aws-ca-central-1", provider_id: "aws-mock", region_name: "Canada (Central)", region_code: "ca-central-1", availability_zones: ["ca-central-1a", "ca-central-1b", "ca-central-1c"] },
  { id: "aws-eu-central-1", provider_id: "aws-mock", region_name: "Europe (Frankfurt)", region_code: "eu-central-1", availability_zones: ["eu-central-1a", "eu-central-1b", "eu-central-1c"] },
  { id: "aws-eu-west-1", provider_id: "aws-mock", region_name: "Europe (Ireland)", region_code: "eu-west-1", availability_zones: ["eu-west-1a", "eu-west-1b", "eu-west-1c"] },
  { id: "aws-eu-west-2", provider_id: "aws-mock", region_name: "Europe (London)", region_code: "eu-west-2", availability_zones: ["eu-west-2a", "eu-west-2b", "eu-west-2c"] },
  { id: "aws-eu-south-1", provider_id: "aws-mock", region_name: "Europe (Milan)", region_code: "eu-south-1", availability_zones: ["eu-south-1a", "eu-south-1b", "eu-south-1c"] },
  { id: "aws-eu-west-3", provider_id: "aws-mock", region_name: "Europe (Paris)", region_code: "eu-west-3", availability_zones: ["eu-west-3a", "eu-west-3b", "eu-west-3c"] },
  { id: "aws-eu-north-1", provider_id: "aws-mock", region_name: "Europe (Stockholm)", region_code: "eu-north-1", availability_zones: ["eu-north-1a", "eu-north-1b", "eu-north-1c"] },
  { id: "aws-me-south-1", provider_id: "aws-mock", region_name: "Middle East (Bahrain)", region_code: "me-south-1", availability_zones: ["me-south-1a", "me-south-1b", "me-south-1c"] },
  { id: "aws-sa-east-1", provider_id: "aws-mock", region_name: "South America (São Paulo)", region_code: "sa-east-1", availability_zones: ["sa-east-1a", "sa-east-1b", "sa-east-1c"] }
];

const newMockRegions = `const MOCK_REGIONS = [\n` + 
  awsRegions.map(r => `  ${JSON.stringify(r)}`).join(',\n') + 
  `,\n  { id: "azure-eastus", provider_id: "azure-mock", region_name: "East US", region_code: "eastus", availability_zones: ["1", "2", "3"] },\n` +
  `  { id: "gcp-us-central1", provider_id: "gcp-mock", region_name: "US Central 1 (Iowa)", region_code: "us-central1", availability_zones: ["us-central1-a", "us-central1-b", "us-central1-c"] }\n];`;

let updatedCode = serverCode.replace(/const MOCK_REGIONS = \[[\s\S]*?\];/, newMockRegions);

// Also update the API to ignore region_id for MOCK_DATABASE so we don't have to duplicate 168 instances * 20 regions
updatedCode = updatedCode.replace(
  /if \(region_id\) data = data\.filter\(d => d\.region_id === region_id\);/g,
  `// if (region_id) data = data.filter(d => d.region_id === region_id); // Disabled region filter for mock data to allow all regions to show instances`
);

fs.writeFileSync('server.ts', updatedCode);
console.log("Updated server.ts with all AWS regions and disabled region filtering for mock data.");
