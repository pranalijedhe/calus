import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, where, setDoc, doc, deleteDoc } from "firebase/firestore";
import bcrypt from "bcryptjs";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function seed() {
  console.log(`Seeding database (Client SDK): ${firebaseConfig.firestoreDatabaseId}...`);

  try {
    // 1. Users
    const users = [
      { id: "admin-user", email: "admin@yourcompany.com", password: "yourpassword", role: "admin" },
      { id: "standard-user", email: "user@yourcompany.com", password: "userpassword", role: "user" },
    ];

    for (const u of users) {
      const hash = await bcrypt.hash(u.password, 10);
      const userRef = doc(db, "users", u.id);
      await setDoc(userRef, {
        email: u.email,
        password_hash: hash,
        role: u.role,
        created_at: new Date().toISOString()
      });
      console.log(`User ${u.email} set.`);
    }

    // 2. Providers
    const providers = [
      { id: "aws", name: "Amazon Web Services" },
      { id: "azure", name: "Microsoft Azure" },
      { id: "gcp", name: "Google Cloud Platform" },
    ];

    // Clear old providers and regions to avoid duplicates
    const oldProviders = await getDocs(collection(db, "providers"));
    for (const d of oldProviders.docs) await deleteDoc(d.ref);
    const oldRegions = await getDocs(collection(db, "regions"));
    for (const d of oldRegions.docs) await deleteDoc(d.ref);

    for (const p of providers) {
      await setDoc(doc(db, "providers", p.id), { name: p.name });
      console.log(`Provider ${p.id} set.`);
    }

    // 3. Regions
    const regions = [
      { provider_id: "aws", id: "aws-us-east-1", code: "us-east-1", name: "US East (N. Virginia)", azs: ["us-east-1a", "us-east-1b", "us-east-1c"] },
      { provider_id: "aws", id: "aws-us-west-2", code: "us-west-2", name: "US West (Oregon)", azs: ["us-west-2a", "us-west-2b", "us-west-2c"] },
      { provider_id: "aws", id: "aws-eu-west-1", code: "eu-west-1", name: "Europe (Ireland)", azs: ["eu-west-1a", "eu-west-1b", "eu-west-1c"] },
      { provider_id: "aws", id: "aws-ap-south-1", code: "ap-south-1", name: "Asia Pacific (Mumbai)", azs: ["ap-south-1a", "ap-south-1b", "ap-south-1c"] },
      { provider_id: "aws", id: "aws-ap-southeast-1", code: "ap-southeast-1", name: "Asia Pacific (Singapore)", azs: ["ap-southeast-1a", "ap-southeast-1b", "ap-southeast-1c"] },
      { provider_id: "aws", id: "aws-eu-central-1", code: "eu-central-1", name: "Europe (Frankfurt)", azs: ["eu-central-1a", "eu-central-1b", "eu-central-1c"] },
      { provider_id: "azure", id: "azure-eastus", code: "eastus", name: "East US", azs: ["Zone 1", "Zone 2", "Zone 3"] },
      { provider_id: "azure", id: "azure-westus", code: "westus", name: "West US", azs: ["Zone 1", "Zone 2", "Zone 3"] },
      { provider_id: "azure", id: "azure-westeurope", code: "westeurope", name: "West Europe", azs: ["Zone 1", "Zone 2", "Zone 3"] },
      { provider_id: "azure", id: "azure-centralindia", code: "centralindia", name: "Central India", azs: ["Zone 1", "Zone 2", "Zone 3"] },
      { provider_id: "gcp", id: "gcp-us-east1", code: "us-east1", name: "US East 1 (South Carolina)", azs: ["us-east1-b", "us-east1-c", "us-east1-d"] },
      { provider_id: "gcp", id: "gcp-us-west1", code: "us-west1", name: "US West 1 (Oregon)", azs: ["us-west1-a", "us-west1-b", "us-west1-c"] },
      { provider_id: "gcp", id: "gcp-europe-west1", code: "europe-west1", name: "Europe West 1 (Belgium)", azs: ["europe-west1-b", "europe-west1-c", "europe-west1-d"] },
      { provider_id: "gcp", id: "gcp-asia-south1", code: "asia-south1", name: "Asia South 1 (Mumbai)", azs: ["asia-south1-a", "asia-south1-b", "asia-south1-c"] },
    ];

    for (const r of regions) {
      await setDoc(doc(db, "regions", r.id), {
        provider_id: r.provider_id,
        region_code: r.code,
        region_name: r.name,
        availability_zones: r.azs
      });
      console.log(`Region ${r.id} set.`);
    }

    // 4. Pricing (Compute)
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
      { type: "m5.large", vcpu: 2, ram: 8, price: 0.096 },
      { type: "m5.xlarge", vcpu: 4, ram: 16, price: 0.192 },
      { type: "c5.large", vcpu: 2, ram: 4, price: 0.085 },
      { type: "r5.large", vcpu: 2, ram: 16, price: 0.126 },
      { type: "Lambda / Functions", vcpu: 0.5, ram: 0.5, price: 0.00001667 },
      { type: "ECS Container", vcpu: 2, ram: 4, price: 0.040 },
      { type: "EKS Node", vcpu: 4, ram: 16, price: 0.200 },
      { type: "ACI Instance", vcpu: 1, ram: 2, price: 0.015 },
      { type: "AKS Node", vcpu: 4, ram: 8, price: 0.180 },
      { type: "Cloud Run", vcpu: 1, ram: 2, price: 0.020 },
      { type: "GKE Node", vcpu: 2, ram: 4, price: 0.090 },
    ];

    // Clear old pricing
    const oldCompute = await getDocs(collection(db, "compute_pricing"));
    for (const d of oldCompute.docs) await deleteDoc(d.ref);

    for (const r of regions) {
      // Regional price multiplier
      let multiplier = 1.0;
      if (r.code.includes("ap-south") || r.code.includes("india")) multiplier = 1.1;
      if (r.code.includes("europe") || r.code.includes("eu-")) multiplier = 1.05;

      for (const c of baseCompute) {
        // Filter by provider relevance
        if (r.provider_id === "aws" && !["t2", "t3", "m5", "c5", "r5", "Lambda", "ECS", "EKS"].some(prefix => c.type.startsWith(prefix))) continue;
        if (r.provider_id === "azure" && !["Standard", "ACI", "AKS", "Functions"].some(prefix => c.type.startsWith(prefix))) {
          // Azure base compute mapping
          if (c.type.startsWith("t2") || c.type.startsWith("t3")) continue;
        }
        if (r.provider_id === "gcp" && !["n1", "n2", "e2", "Cloud Run", "GKE"].some(prefix => c.type.startsWith(prefix))) {
           if (c.type.startsWith("t2") || c.type.startsWith("t3")) continue;
        }

        const price = c.price * multiplier;
        await addDoc(collection(db, "compute_pricing"), {
          provider_id: r.provider_id,
          region_id: r.id,
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
      console.log(`Compute pricing for region ${r.id} added.`);
    }

    // 5. Pricing (Storage)
    const oldStorage = await getDocs(collection(db, "storage_pricing"));
    for (const d of oldStorage.docs) await deleteDoc(d.ref);

    for (const r of regions) {
      const storageOptions = [];
      if (r.provider_id === "aws") {
        storageOptions.push({ name: "S3 Standard", price: 0.023 });
        storageOptions.push({ name: "S3 Intelligent-Tiering", price: 0.023 });
        storageOptions.push({ name: "EBS gp3", price: 0.08 });
      } else if (r.provider_id === "azure") {
        storageOptions.push({ name: "Blob Storage LRS", price: 0.018 });
        storageOptions.push({ name: "Blob Storage GRS", price: 0.036 });
        storageOptions.push({ name: "Managed Disk Premium", price: 0.15 });
      } else if (r.provider_id === "gcp") {
        storageOptions.push({ name: "Cloud Storage Standard", price: 0.020 });
        storageOptions.push({ name: "Cloud Storage Nearline", price: 0.010 });
        storageOptions.push({ name: "Persistent Disk SSD", price: 0.17 });
      }

      for (const opt of storageOptions) {
        await addDoc(collection(db, "storage_pricing"), {
          provider_id: r.provider_id,
          region_id: r.id,
          storage_type: "object",
          storage_name: opt.name,
          price_per_gb_month: opt.price,
          unit_type: "GB",
          updated_at: new Date().toISOString()
        });
      }
    }
    console.log(`Storage pricing for all regions added.`);

    // 6. Pricing (Database)
    const baseDatabase = [
      { engine: "MySQL", class: "db.t3.micro", vcpu: 2, ram: 1, price: 0.017 },
      { engine: "PostgreSQL", class: "db.t2.micro", vcpu: 1, ram: 1, price: 0.018 },
      { engine: "PostgreSQL", class: "db.t3.small", vcpu: 2, ram: 2, price: 0.034 },
      { engine: "PostgreSQL", class: "db.t4g.small", vcpu: 2, ram: 2, price: 0.032 },
      { engine: "PostgreSQL", class: "db.m4.large", vcpu: 2, ram: 8, price: 0.175 },
      { engine: "PostgreSQL", class: "db.m5.large", vcpu: 2, ram: 8, price: 0.182 },
      { engine: "PostgreSQL", class: "db.m5d.large", vcpu: 2, ram: 8, price: 0.205 },
      { engine: "PostgreSQL", class: "db.m6i.large", vcpu: 2, ram: 8, price: 0.182 },
      { engine: "PostgreSQL", class: "db.m6g.large", vcpu: 2, ram: 8, price: 0.165 },
      { engine: "PostgreSQL", class: "db.m6gd.large", vcpu: 2, ram: 8, price: 0.188 },
      { engine: "PostgreSQL", class: "db.m7i.large", vcpu: 2, ram: 8, price: 0.182 },
      { engine: "PostgreSQL", class: "db.r4.large", vcpu: 2, ram: 15.25, price: 0.24 },
      { engine: "PostgreSQL", class: "db.r5.large", vcpu: 2, ram: 16, price: 0.25 },
      { engine: "PostgreSQL", class: "db.r5b.large", vcpu: 2, ram: 16, price: 0.27 },
      { engine: "PostgreSQL", class: "db.r5d.large", vcpu: 2, ram: 16, price: 0.28 },
      { engine: "PostgreSQL", class: "db.r6i.large", vcpu: 2, ram: 16, price: 0.25 },
      { engine: "PostgreSQL", class: "db.r6g.large", vcpu: 2, ram: 16, price: 0.225 },
      { engine: "PostgreSQL", class: "db.r6gd.large", vcpu: 2, ram: 16, price: 0.255 },
      { engine: "PostgreSQL", class: "db.r7i.large", vcpu: 2, ram: 16, price: 0.25 },
      { engine: "PostgreSQL", class: "db.c4.large", vcpu: 2, ram: 3.75, price: 0.115 },
      { engine: "PostgreSQL", class: "db.c5.large", vcpu: 2, ram: 4, price: 0.125 },
      { engine: "PostgreSQL", class: "db.c6i.large", vcpu: 2, ram: 4, price: 0.125 },
      { engine: "PostgreSQL", class: "db.m5.metal", vcpu: 96, ram: 384, price: 8.736 },
      { engine: "PostgreSQL", class: "db.m6i.metal", vcpu: 128, ram: 512, price: 11.648 },
      { engine: "PostgreSQL", class: "db.m7i.metal-24xl", vcpu: 96, ram: 384, price: 8.736 },
      { engine: "PostgreSQL", class: "db.m7i.metal-48xl", vcpu: 192, ram: 768, price: 17.472 },
      { engine: "PostgreSQL", class: "db.r5.metal", vcpu: 96, ram: 768, price: 12.00 },
      { engine: "PostgreSQL", class: "db.r6i.metal", vcpu: 128, ram: 1024, price: 16.00 },
      { engine: "SQL Server", class: "General Purpose", vcpu: 2, ram: 4, price: 0.025 },
      { engine: "MySQL", class: "db-f1-micro", vcpu: 1, ram: 0.6, price: 0.015 },
      { engine: "PostgreSQL", class: "db-n1-standard-1", vcpu: 1, ram: 3.75, price: 0.085 },
      { engine: "BigQuery", class: "Analysis", vcpu: 0, ram: 0, price: 0.000005 },
      { engine: "DynamoDB", class: "On-Demand", vcpu: 0, ram: 0, price: 0.25 }, // Per million requests approx
      { engine: "CosmosDB", class: "Provisioned throughput", vcpu: 0, ram: 0, price: 0.008 }, // Per 100 RU/s
      { engine: "Cloud Spanner", class: "Regional", vcpu: 1, ram: 4, price: 0.90 },
    ];

    const oldDb = await getDocs(collection(db, "database_pricing"));
    for (const d of oldDb.docs) await deleteDoc(d.ref);

    for (const r of regions) {
      let multiplier = 1.0;
      if (r.code.includes("ap-south") || r.code.includes("india")) multiplier = 1.1;
      if (r.code.includes("europe") || r.code.includes("eu-")) multiplier = 1.05;

      for (const dbp of baseDatabase) {
        // Filter by provider relevance
        if (r.provider_id === "aws" && !["db.t3", "MySQL", "PostgreSQL", "DynamoDB"].some(prefix => dbp.class.startsWith(prefix) || dbp.engine === prefix)) {
           if (dbp.engine !== "MySQL" && dbp.engine !== "PostgreSQL" && dbp.engine !== "DynamoDB") continue;
        }
        if (r.provider_id === "azure" && !["General Purpose", "CosmosDB"].some(prefix => dbp.class === prefix || dbp.engine === prefix)) {
           if (dbp.engine !== "SQL Server" && dbp.engine !== "CosmosDB") continue;
        }
        if (r.provider_id === "gcp" && !["db-", "BigQuery", "Cloud Spanner"].some(prefix => dbp.class.startsWith(prefix) || dbp.engine === prefix)) {
           if (dbp.engine !== "MySQL" && dbp.engine !== "PostgreSQL" && dbp.engine !== "BigQuery" && dbp.engine !== "Cloud Spanner") continue;
        }

        await addDoc(collection(db, "database_pricing"), {
          provider_id: r.provider_id,
          region_id: r.id,
          db_engine: dbp.engine,
          instance_class: dbp.class,
          price_per_hour: dbp.price * multiplier,
          vcpu: dbp.vcpu,
          memory_gb: dbp.ram,
          updated_at: new Date().toISOString()
        });
      }
      console.log(`Database pricing for region ${r.id} added.`);
    }

    // 7. Pricing (Networking)
    const oldNet = await getDocs(collection(db, "networking_pricing"));
    for (const d of oldNet.docs) await deleteDoc(d.ref);

    for (const r of regions) {
      await addDoc(collection(db, "networking_pricing"), {
        provider_id: r.provider_id,
        region_id: r.id,
        service_type: "Data Transfer Out",
        price_per_unit: 0.09,
        unit_type: "GB",
        updated_at: new Date().toISOString()
      });
    }
    console.log(`Networking pricing for all regions added.`);

    console.log("Seeding complete.");
  } catch (err) {
    console.error("Seeding failed:", err);
  }
}

seed().catch(console.error);
