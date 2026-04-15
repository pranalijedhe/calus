import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

if (!getApps().length) {
  try {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account.json";
    
    if (fs.existsSync(serviceAccountPath)) {
      initializeApp({
        credential: cert(JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"))),
        projectId: firebaseConfig.projectId,
      });
      console.log("Firebase Admin initialized with service account.");
    } else {
      initializeApp({
        projectId: firebaseConfig.projectId,
      });
      console.log("Firebase Admin initialized with default credentials.");
    }
  } catch (err) {
    console.error("Firebase Admin initialization failed:", err);
    process.exit(1);
  }
}

const db = getFirestore(firebaseConfig.firestoreDatabaseId);

async function seed() {
  console.log(`Seeding database: ${firebaseConfig.firestoreDatabaseId}...`);
  
  try {
    // Test write
    await db.collection("test_connection").add({ timestamp: new Date().toISOString() });
    console.log("Connection test successful.");
  } catch (err) {
    console.error("Connection test failed:", err);
    // If it fails with permission denied, it might be that the service account 
    // doesn't have access to the named database yet or we should use (default)
  }

  // Users
  const users = [
    { email: "admin@yourcompany.com", password: "yourpassword", role: "admin" },
    { email: "user@yourcompany.com", password: "userpassword", role: "user" },
  ];

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    const existing = await db.collection("users").where("email", "==", u.email).get();
    if (existing.empty) {
      await db.collection("users").add({
        email: u.email,
        password_hash: hash,
        role: u.role,
        created_at: new Date().toISOString()
      });
      console.log(`User ${u.email} created.`);
    }
  }

  // Providers
  const providers = ["AWS", "Azure", "GCP"];
  const providerIds: any = {};
  for (const p of providers) {
    const existing = await db.collection("providers").where("name", "==", p).get();
    if (existing.empty) {
      const ref = await db.collection("providers").add({ name: p });
      providerIds[p] = ref.id;
    } else {
      providerIds[p] = existing.docs[0].id;
    }
  }

  // Regions
  const regions = [
    { provider: "AWS", code: "us-east-1", name: "US East (N. Virginia)", azs: ["us-east-1a", "us-east-1b", "us-east-1c"] },
    { provider: "AWS", code: "us-west-2", name: "US West (Oregon)", azs: ["us-west-2a", "us-west-2b", "us-west-2c"] },
    { provider: "AWS", code: "eu-west-1", name: "Europe (Ireland)", azs: ["eu-west-1a", "eu-west-1b", "eu-west-1c"] },
    { provider: "AWS", code: "ap-south-1", name: "Asia Pacific (Mumbai)", azs: ["ap-south-1a", "ap-south-1b", "ap-south-1c"] },
    { provider: "AWS", code: "ap-southeast-1", name: "Asia Pacific (Singapore)", azs: ["ap-southeast-1a", "ap-southeast-1b", "ap-southeast-1c"] },
    { provider: "AWS", code: "eu-central-1", name: "Europe (Frankfurt)", azs: ["eu-central-1a", "eu-central-1b", "eu-central-1c"] },
    { provider: "Azure", code: "eastus", name: "East US", azs: ["Zone 1", "Zone 2", "Zone 3"] },
    { provider: "Azure", code: "westus", name: "West US", azs: ["Zone 1", "Zone 2", "Zone 3"] },
    { provider: "Azure", code: "westeurope", name: "West Europe", azs: ["Zone 1", "Zone 2", "Zone 3"] },
    { provider: "Azure", code: "centralindia", name: "Central India", azs: ["Zone 1", "Zone 2", "Zone 3"] },
    { provider: "GCP", code: "us-east1", name: "US East 1 (South Carolina)", azs: ["us-east1-b", "us-east1-c", "us-east1-d"] },
    { provider: "GCP", code: "us-west1", name: "US West 1 (Oregon)", azs: ["us-west1-a", "us-west1-b", "us-west1-c"] },
    { provider: "GCP", code: "europe-west1", name: "Europe West 1 (Belgium)", azs: ["europe-west1-b", "europe-west1-c", "europe-west1-d"] },
    { provider: "GCP", code: "asia-south1", name: "Asia South 1 (Mumbai)", azs: ["asia-south1-a", "asia-south1-b", "asia-south1-c"] },
  ];

  const regionIds: any = {};
  for (const r of regions) {
    const pId = providerIds[r.provider];
    const existing = await db.collection("regions").where("region_code", "==", r.code).get();
    if (existing.empty) {
      const ref = await db.collection("regions").add({ 
        provider_id: pId, 
        region_code: r.code, 
        region_name: r.name,
        availability_zones: r.azs
      });
      regionIds[r.code] = ref.id;
    } else {
      regionIds[r.code] = existing.docs[0].id;
      // Update AZs if they don't exist
      await existing.docs[0].ref.update({ availability_zones: r.azs });
    }
  }

  // Compute Pricing
  const baseCompute = [
    { type: "t2.nano", vcpu: 1, ram: 0.5, price: 0.0058 },
    { type: "t2.micro", vcpu: 1, ram: 1, price: 0.0116 },
    { type: "t2.small", vcpu: 1, ram: 2, price: 0.023 },
    { type: "t2.medium", vcpu: 2, ram: 4, price: 0.0464 },
    { type: "t2.large", vcpu: 2, ram: 8, price: 0.0928 },
    { type: "t2.xlarge", vcpu: 4, ram: 16, price: 0.1856 },
    { type: "t3.nano", vcpu: 2, ram: 0.5, price: 0.0052 },
    { type: "t3.micro", vcpu: 2, ram: 1, price: 0.0104 },
    { type: "t3.small", vcpu: 2, ram: 2, price: 0.0208 },
    { type: "t3.medium", vcpu: 2, ram: 4, price: 0.0416 },
    { type: "t3.large", vcpu: 2, ram: 8, price: 0.0832 },
    { type: "t3.xlarge", vcpu: 4, ram: 16, price: 0.1664 },
    { type: "t3.2xlarge", vcpu: 8, ram: 32, price: 0.3328 },
    { type: "m5.large", vcpu: 2, ram: 8, price: 0.096 },
    { type: "m5.xlarge", vcpu: 4, ram: 16, price: 0.192 },
    { type: "m5.2xlarge", vcpu: 8, ram: 32, price: 0.384 },
    { type: "m5.4xlarge", vcpu: 16, ram: 64, price: 0.768 },
    { type: "m5.8xlarge", vcpu: 32, ram: 128, price: 1.536 },
    { type: "m5.12xlarge", vcpu: 48, ram: 192, price: 2.304 },
    { type: "c5.large", vcpu: 2, ram: 4, price: 0.085 },
    { type: "c5.xlarge", vcpu: 4, ram: 8, price: 0.17 },
    { type: "c5.2xlarge", vcpu: 8, ram: 16, price: 0.34 },
    { type: "c5.4xlarge", vcpu: 16, ram: 32, price: 0.68 },
    { type: "r5.large", vcpu: 2, ram: 16, price: 0.126 },
    { type: "r5.xlarge", vcpu: 4, ram: 32, price: 0.252 },
    { type: "r5.2xlarge", vcpu: 8, ram: 64, price: 0.504 },
    { type: "p3.2xlarge", vcpu: 8, ram: 61, price: 3.06 },
    { type: "g4dn.xlarge", vcpu: 4, ram: 16, price: 0.526 },
  ];

  for (const r of regions) {
    const pId = providerIds[r.provider];
    const rId = regionIds[r.code];
    
    // Regional price multiplier
    let multiplier = 1.0;
    if (r.code.includes("ap-south") || r.code.includes("india")) multiplier = 1.1;
    if (r.code.includes("europe") || r.code.includes("eu-")) multiplier = 1.05;

    for (const c of baseCompute) {
      const price = c.price * multiplier;
      const existing = await db.collection("compute_pricing")
        .where("provider_id", "==", pId)
        .where("region_id", "==", rId)
        .where("instance_type", "==", c.type)
        .get();
      
      if (existing.empty) {
        await db.collection("compute_pricing").add({
          provider_id: pId,
          region_id: rId,
          instance_type: c.type,
          os_type: "Linux",
          price_per_hour: price,
          price_per_month: price * 730,
          price_per_year: price * 730 * 12,
          vcpu: c.vcpu,
          memory_gb: c.ram,
          updated_at: new Date().toISOString()
        });
      }
    }
  }

  // Storage Pricing
  const storage = [
    { provider: "AWS", region: "us-east-1", type: "object", name: "S3 Standard", price: 0.023 },
    { provider: "AWS", region: "us-west-2", type: "object", name: "S3 Standard", price: 0.025 },
    { provider: "Azure", region: "eastus", type: "object", name: "Blob Storage LRS", price: 0.018 },
    { provider: "Azure", region: "westus", type: "object", name: "Blob Storage LRS", price: 0.020 },
    { provider: "GCP", region: "us-east1", type: "object", name: "Cloud Storage Standard", price: 0.020 },
    { provider: "GCP", region: "us-west1", type: "object", name: "Cloud Storage Standard", price: 0.022 },
  ];

  for (const s of storage) {
    const pId = providerIds[s.provider];
    const rId = regionIds[s.region];
    const existing = await db.collection("storage_pricing")
      .where("provider_id", "==", pId)
      .where("region_id", "==", rId)
      .where("storage_name", "==", s.name)
      .get();
    
    if (existing.empty) {
      await db.collection("storage_pricing").add({
        provider_id: pId,
        region_id: rId,
        storage_type: s.type,
        storage_name: s.name,
        price_per_gb_month: s.price,
        unit_type: "GB",
        updated_at: new Date().toISOString()
      });
    }
  }

  // Database Pricing
  const databases = [
    { provider: "AWS", region: "us-east-1", engine: "MySQL", type: "db.t3.micro", vcpu: 2, ram: 1, price: 0.017 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.t2.micro", vcpu: 1, ram: 1, price: 0.018 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.t3.small", vcpu: 2, ram: 2, price: 0.034 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.t4g.small", vcpu: 2, ram: 2, price: 0.032 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.m4.large", vcpu: 2, ram: 8, price: 0.175 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.m5.large", vcpu: 2, ram: 8, price: 0.182 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.m5d.large", vcpu: 2, ram: 8, price: 0.205 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.m6i.large", vcpu: 2, ram: 8, price: 0.182 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.m6g.large", vcpu: 2, ram: 8, price: 0.165 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.m6gd.large", vcpu: 2, ram: 8, price: 0.188 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.m7i.large", vcpu: 2, ram: 8, price: 0.182 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.r4.large", vcpu: 2, ram: 15.25, price: 0.24 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.r5.large", vcpu: 2, ram: 16, price: 0.25 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.r5b.large", vcpu: 2, ram: 16, price: 0.27 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.r5d.large", vcpu: 2, ram: 16, price: 0.28 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.r6i.large", vcpu: 2, ram: 16, price: 0.25 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.r6g.large", vcpu: 2, ram: 16, price: 0.225 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.r6gd.large", vcpu: 2, ram: 16, price: 0.255 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.r7i.large", vcpu: 2, ram: 16, price: 0.25 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.c4.large", vcpu: 2, ram: 3.75, price: 0.115 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.c5.large", vcpu: 2, ram: 4, price: 0.125 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.c6i.large", vcpu: 2, ram: 4, price: 0.125 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.m5.metal", vcpu: 96, ram: 384, price: 8.736 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.m6i.metal", vcpu: 128, ram: 512, price: 11.648 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.m7i.metal-24xl", vcpu: 96, ram: 384, price: 8.736 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.m7i.metal-48xl", vcpu: 192, ram: 768, price: 17.472 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.r5.metal", vcpu: 96, ram: 768, price: 12.00 },
    { provider: "AWS", region: "us-east-1", engine: "PostgreSQL", type: "db.r6i.metal", vcpu: 128, ram: 1024, price: 16.00 },
    { provider: "Azure", region: "eastus", engine: "SQL Server", type: "General Purpose", vcpu: 2, ram: 4, price: 0.025 },
    { provider: "GCP", region: "us-east1", engine: "MySQL", type: "db-f1-micro", vcpu: 1, ram: 0.6, price: 0.015 },
    { provider: "GCP", region: "us-east1", engine: "PostgreSQL", type: "db-n1-standard-1", vcpu: 1, ram: 3.75, price: 0.085 },
  ];

  for (const d of databases) {
    const pId = providerIds[d.provider];
    const rId = regionIds[d.region];
    const existing = await db.collection("database_pricing")
      .where("provider_id", "==", pId)
      .where("region_id", "==", rId)
      .where("db_instance_type", "==", d.type)
      .get();
    
    if (existing.empty) {
      await db.collection("database_pricing").add({
        provider_id: pId,
        region_id: rId,
        db_engine: d.engine,
        db_instance_type: d.type,
        vcpu: d.vcpu,
        memory_gb: d.ram,
        price_per_hour: d.price,
        updated_at: new Date().toISOString()
      });
    }
  }

  // Networking Pricing
  const networking = [
    { provider: "AWS", region: "us-east-1", type: "Data Transfer Out", price: 0.09 },
    { provider: "Azure", region: "eastus", type: "Data Transfer Out", price: 0.08 },
    { provider: "GCP", region: "us-east1", type: "Data Transfer Out", price: 0.085 },
  ];

  for (const n of networking) {
    const pId = providerIds[n.provider];
    const rId = regionIds[n.region];
    const existing = await db.collection("networking_pricing")
      .where("provider_id", "==", pId)
      .where("region_id", "==", rId)
      .where("service_type", "==", n.type)
      .get();
    
    if (existing.empty) {
      await db.collection("networking_pricing").add({
        provider_id: pId,
        region_id: rId,
        service_type: n.type,
        price_per_unit: n.price,
        unit_type: "GB",
        updated_at: new Date().toISOString()
      });
    }
  }

  console.log("Seeding complete.");
}

seed().catch(console.error);
