import "reflect-metadata";
import "dotenv/config";
import express from "express";

// Debug: Check if env vars are loaded
console.log("------------------------------------");
console.log("DEBUG: Environment Check");
console.log("AWS_ACCESS_KEY_ID exists:", !!process.env.AWS_ACCESS_KEY_ID);
console.log("AWS_SECRET_ACCESS_KEY exists:", !!process.env.AWS_SECRET_ACCESS_KEY);
console.log("AWS_REGION:", process.env.AWS_REGION);
console.log("------------------------------------");
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import cron from "node-cron";
import axios from "axios";
import fs from "fs";
import os from "os";
import { PricingClient, GetProductsCommand } from "@aws-sdk/client-pricing";
import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";

import { initSQLDatabase } from "./src/lib/database_sql.ts";

const MOCK_PROVIDERS = [
  { id: "aws-mock", name: "AWS" },
  { id: "azure-mock", name: "Azure" },
  { id: "gcp-mock", name: "GCP" }
];

const MOCK_REGIONS = [
  {"id":"aws-us-east-1","provider_id":"aws-mock","region_name":"US East (N. Virginia)","region_code":"us-east-1","availability_zones":["us-east-1a","us-east-1b","us-east-1c"]},
  {"id":"aws-us-east-2","provider_id":"aws-mock","region_name":"US East (Ohio)","region_code":"us-east-2","availability_zones":["us-east-2a","us-east-2b","us-east-2c"]},
  {"id":"aws-us-west-1","provider_id":"aws-mock","region_name":"US West (N. California)","region_code":"us-west-1","availability_zones":["us-west-1a","us-west-1b","us-west-1c"]},
  {"id":"aws-us-west-2","provider_id":"aws-mock","region_name":"US West (Oregon)","region_code":"us-west-2","availability_zones":["us-west-2a","us-west-2b","us-west-2c"]},
  {"id":"aws-af-south-1","provider_id":"aws-mock","region_name":"Africa (Cape Town)","region_code":"af-south-1","availability_zones":["af-south-1a","af-south-1b","af-south-1c"]},
  {"id":"aws-ap-east-1","provider_id":"aws-mock","region_name":"Asia Pacific (Hong Kong)","region_code":"ap-east-1","availability_zones":["ap-east-1a","ap-east-1b","ap-east-1c"]},
  {"id":"aws-ap-south-1","provider_id":"aws-mock","region_name":"Asia Pacific (Mumbai)","region_code":"ap-south-1","availability_zones":["ap-south-1a","ap-south-1b","ap-south-1c"]},
  {"id":"aws-ap-northeast-3","provider_id":"aws-mock","region_name":"Asia Pacific (Osaka)","region_code":"ap-northeast-3","availability_zones":["ap-northeast-3a","ap-northeast-3b","ap-northeast-3c"]},
  {"id":"aws-ap-northeast-2","provider_id":"aws-mock","region_name":"Asia Pacific (Seoul)","region_code":"ap-northeast-2","availability_zones":["ap-northeast-2a","ap-northeast-2b","ap-northeast-2c"]},
  {"id":"aws-ap-southeast-1","provider_id":"aws-mock","region_name":"Asia Pacific (Singapore)","region_code":"ap-southeast-1","availability_zones":["ap-southeast-1a","ap-southeast-1b","ap-southeast-1c"]},
  {"id":"aws-ap-southeast-2","provider_id":"aws-mock","region_name":"Asia Pacific (Sydney)","region_code":"ap-southeast-2","availability_zones":["ap-southeast-2a","ap-southeast-2b","ap-southeast-2c"]},
  {"id":"aws-ap-northeast-1","provider_id":"aws-mock","region_name":"Asia Pacific (Tokyo)","region_code":"ap-northeast-1","availability_zones":["ap-northeast-1a","ap-northeast-1b","ap-northeast-1c"]},
  {"id":"aws-ca-central-1","provider_id":"aws-mock","region_name":"Canada (Central)","region_code":"ca-central-1","availability_zones":["ca-central-1a","ca-central-1b","ca-central-1c"]},
  {"id":"aws-eu-central-1","provider_id":"aws-mock","region_name":"Europe (Frankfurt)","region_code":"eu-central-1","availability_zones":["eu-central-1a","eu-central-1b","eu-central-1c"]},
  {"id":"aws-eu-west-1","provider_id":"aws-mock","region_name":"Europe (Ireland)","region_code":"eu-west-1","availability_zones":["eu-west-1a","eu-west-1b","eu-west-1c"]},
  {"id":"aws-eu-west-2","provider_id":"aws-mock","region_name":"Europe (London)","region_code":"eu-west-2","availability_zones":["eu-west-2a","eu-west-2b","eu-west-2c"]},
  {"id":"aws-eu-south-1","provider_id":"aws-mock","region_name":"Europe (Milan)","region_code":"eu-south-1","availability_zones":["eu-south-1a","eu-south-1b","eu-south-1c"]},
  {"id":"aws-eu-west-3","provider_id":"aws-mock","region_name":"Europe (Paris)","region_code":"eu-west-3","availability_zones":["eu-west-3a","eu-west-3b","eu-west-3c"]},
  {"id":"aws-eu-north-1","provider_id":"aws-mock","region_name":"Europe (Stockholm)","region_code":"eu-north-1","availability_zones":["eu-north-1a","eu-north-1b","eu-north-1c"]},
  {"id":"aws-me-south-1","provider_id":"aws-mock","region_name":"Middle East (Bahrain)","region_code":"me-south-1","availability_zones":["me-south-1a","me-south-1b","me-south-1c"]},
  {"id":"aws-sa-east-1","provider_id":"aws-mock","region_name":"South America (São Paulo)","region_code":"sa-east-1","availability_zones":["sa-east-1a","sa-east-1b","sa-east-1c"]},
  { id: "azure-eastus", provider_id: "azure-mock", region_name: "East US", region_code: "eastus", availability_zones: ["1", "2", "3"] },
  { id: "gcp-us-central1", provider_id: "gcp-mock", region_name: "US Central 1 (Iowa)", region_code: "us-central1", availability_zones: ["us-central1-a", "us-central1-b", "us-central1-c"] }
];

const MOCK_COMPUTE = [
  { id: "aws-t3-micro", provider_id: "aws-mock", region_id: "aws-us-east-1", instance_type: "t3.micro", vcpu: 2, memory_gb: 1, os_type: "Linux", price_per_hour: 0.0104 },
  { id: "aws-m5-large", provider_id: "aws-mock", region_id: "aws-us-east-1", instance_type: "m5.large", vcpu: 2, memory_gb: 8, os_type: "Linux", price_per_hour: 0.096 },
  { id: "azure-b1s", provider_id: "azure-mock", region_id: "azure-eastus", instance_type: "Standard_B1s", vcpu: 1, memory_gb: 1, os_type: "Linux", price_per_hour: 0.0104 },
  { id: "gcp-e2-micro", provider_id: "gcp-mock", region_id: "gcp-us-central1", instance_type: "e2-micro", vcpu: 2, memory_gb: 1, os_type: "Linux", price_per_hour: 0.0084 }
];

const MOCK_STORAGE = [
  { id: "aws-s3-std", provider_id: "aws-mock", region_id: "aws-us-east-1", storage_name: "S3 Standard", storage_type: "Object Storage", price_per_gb_month: 0.023, unit_type: "GB" },
  { id: "aws-ebs-gp3", provider_id: "aws-mock", region_id: "aws-us-east-1", storage_name: "EBS gp3", storage_type: "Block Storage", price_per_gb_month: 0.08, unit_type: "GB" }
];

const MOCK_DATABASE = [
  
  {
    "id": "aws-rds-postgres-m4-large",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m4.large",
    "vcpu": 2,
    "memory_gb": 8,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-m4-xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m4.xlarge",
    "vcpu": 4,
    "memory_gb": 16,
    "price_per_hour": 0.2
  },
  {
    "id": "aws-rds-postgres-m4-2xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m4.2xlarge",
    "vcpu": 8,
    "memory_gb": 32,
    "price_per_hour": 0.4
  },
  {
    "id": "aws-rds-postgres-m4-4xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m4.4xlarge",
    "vcpu": 16,
    "memory_gb": 64,
    "price_per_hour": 0.8
  },
  {
    "id": "aws-rds-postgres-m4-10xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m4.10xlarge",
    "vcpu": 40,
    "memory_gb": 160,
    "price_per_hour": 2
  },
  {
    "id": "aws-rds-postgres-m4-16xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m4.16xlarge",
    "vcpu": 64,
    "memory_gb": 256,
    "price_per_hour": 3.2
  },
  {
    "id": "aws-rds-postgres-m5-large",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m5.large",
    "vcpu": 2,
    "memory_gb": 8,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-m5-xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m5.xlarge",
    "vcpu": 4,
    "memory_gb": 16,
    "price_per_hour": 0.2
  },
  {
    "id": "aws-rds-postgres-m5-2xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m5.2xlarge",
    "vcpu": 8,
    "memory_gb": 32,
    "price_per_hour": 0.4
  },
  {
    "id": "aws-rds-postgres-m5-4xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m5.4xlarge",
    "vcpu": 16,
    "memory_gb": 64,
    "price_per_hour": 0.8
  },
  {
    "id": "aws-rds-postgres-m5-8xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m5.8xlarge",
    "vcpu": 32,
    "memory_gb": 128,
    "price_per_hour": 1.6
  },
  {
    "id": "aws-rds-postgres-m5-12xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m5.12xlarge",
    "vcpu": 48,
    "memory_gb": 192,
    "price_per_hour": 2.4000000000000004
  },
  {
    "id": "aws-rds-postgres-m5-16xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m5.16xlarge",
    "vcpu": 64,
    "memory_gb": 256,
    "price_per_hour": 3.2
  },
  {
    "id": "aws-rds-postgres-m5-24xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m5.24xlarge",
    "vcpu": 96,
    "memory_gb": 384,
    "price_per_hour": 4.800000000000001
  },
  {
    "id": "aws-rds-postgres-m5d-large",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m5d.large",
    "vcpu": 2,
    "memory_gb": 8,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-m5d-xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m5d.xlarge",
    "vcpu": 4,
    "memory_gb": 16,
    "price_per_hour": 0.2
  },
  {
    "id": "aws-rds-postgres-m5d-2xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m5d.2xlarge",
    "vcpu": 8,
    "memory_gb": 32,
    "price_per_hour": 0.4
  },
  {
    "id": "aws-rds-postgres-m5d-4xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m5d.4xlarge",
    "vcpu": 16,
    "memory_gb": 64,
    "price_per_hour": 0.8
  },
  {
    "id": "aws-rds-postgres-m5d-8xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m5d.8xlarge",
    "vcpu": 32,
    "memory_gb": 128,
    "price_per_hour": 1.6
  },
  {
    "id": "aws-rds-postgres-m5d-12xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m5d.12xlarge",
    "vcpu": 48,
    "memory_gb": 192,
    "price_per_hour": 2.4000000000000004
  },
  {
    "id": "aws-rds-postgres-m5d-16xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m5d.16xlarge",
    "vcpu": 64,
    "memory_gb": 256,
    "price_per_hour": 3.2
  },
  {
    "id": "aws-rds-postgres-m5d-24xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m5d.24xlarge",
    "vcpu": 96,
    "memory_gb": 384,
    "price_per_hour": 4.800000000000001
  },
  {
    "id": "aws-rds-postgres-m6i-large",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6i.large",
    "vcpu": 2,
    "memory_gb": 8,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-m6i-xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6i.xlarge",
    "vcpu": 4,
    "memory_gb": 16,
    "price_per_hour": 0.2
  },
  {
    "id": "aws-rds-postgres-m6i-2xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6i.2xlarge",
    "vcpu": 8,
    "memory_gb": 32,
    "price_per_hour": 0.4
  },
  {
    "id": "aws-rds-postgres-m6i-4xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6i.4xlarge",
    "vcpu": 16,
    "memory_gb": 64,
    "price_per_hour": 0.8
  },
  {
    "id": "aws-rds-postgres-m6i-8xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6i.8xlarge",
    "vcpu": 32,
    "memory_gb": 128,
    "price_per_hour": 1.6
  },
  {
    "id": "aws-rds-postgres-m6i-12xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6i.12xlarge",
    "vcpu": 48,
    "memory_gb": 192,
    "price_per_hour": 2.4000000000000004
  },
  {
    "id": "aws-rds-postgres-m6i-16xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6i.16xlarge",
    "vcpu": 64,
    "memory_gb": 256,
    "price_per_hour": 3.2
  },
  {
    "id": "aws-rds-postgres-m6i-24xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6i.24xlarge",
    "vcpu": 96,
    "memory_gb": 384,
    "price_per_hour": 4.800000000000001
  },
  {
    "id": "aws-rds-postgres-m6g-large",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6g.large",
    "vcpu": 2,
    "memory_gb": 8,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-m6g-xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6g.xlarge",
    "vcpu": 4,
    "memory_gb": 16,
    "price_per_hour": 0.2
  },
  {
    "id": "aws-rds-postgres-m6g-2xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6g.2xlarge",
    "vcpu": 8,
    "memory_gb": 32,
    "price_per_hour": 0.4
  },
  {
    "id": "aws-rds-postgres-m6g-4xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6g.4xlarge",
    "vcpu": 16,
    "memory_gb": 64,
    "price_per_hour": 0.8
  },
  {
    "id": "aws-rds-postgres-m6g-8xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6g.8xlarge",
    "vcpu": 32,
    "memory_gb": 128,
    "price_per_hour": 1.6
  },
  {
    "id": "aws-rds-postgres-m6g-12xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6g.12xlarge",
    "vcpu": 48,
    "memory_gb": 192,
    "price_per_hour": 2.4000000000000004
  },
  {
    "id": "aws-rds-postgres-m6g-16xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6g.16xlarge",
    "vcpu": 64,
    "memory_gb": 256,
    "price_per_hour": 3.2
  },
  {
    "id": "aws-rds-postgres-m6g-24xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6g.24xlarge",
    "vcpu": 96,
    "memory_gb": 384,
    "price_per_hour": 4.800000000000001
  },
  {
    "id": "aws-rds-postgres-m6gd-large",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6gd.large",
    "vcpu": 2,
    "memory_gb": 8,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-m6gd-xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6gd.xlarge",
    "vcpu": 4,
    "memory_gb": 16,
    "price_per_hour": 0.2
  },
  {
    "id": "aws-rds-postgres-m6gd-2xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6gd.2xlarge",
    "vcpu": 8,
    "memory_gb": 32,
    "price_per_hour": 0.4
  },
  {
    "id": "aws-rds-postgres-m6gd-4xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6gd.4xlarge",
    "vcpu": 16,
    "memory_gb": 64,
    "price_per_hour": 0.8
  },
  {
    "id": "aws-rds-postgres-m6gd-8xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6gd.8xlarge",
    "vcpu": 32,
    "memory_gb": 128,
    "price_per_hour": 1.6
  },
  {
    "id": "aws-rds-postgres-m6gd-12xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6gd.12xlarge",
    "vcpu": 48,
    "memory_gb": 192,
    "price_per_hour": 2.4000000000000004
  },
  {
    "id": "aws-rds-postgres-m6gd-16xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6gd.16xlarge",
    "vcpu": 64,
    "memory_gb": 256,
    "price_per_hour": 3.2
  },
  {
    "id": "aws-rds-postgres-m6gd-24xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6gd.24xlarge",
    "vcpu": 96,
    "memory_gb": 384,
    "price_per_hour": 4.800000000000001
  },
  {
    "id": "aws-rds-postgres-m7i-large",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m7i.large",
    "vcpu": 2,
    "memory_gb": 8,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-m7i-xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m7i.xlarge",
    "vcpu": 4,
    "memory_gb": 16,
    "price_per_hour": 0.2
  },
  {
    "id": "aws-rds-postgres-m7i-2xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m7i.2xlarge",
    "vcpu": 8,
    "memory_gb": 32,
    "price_per_hour": 0.4
  },
  {
    "id": "aws-rds-postgres-m7i-4xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m7i.4xlarge",
    "vcpu": 16,
    "memory_gb": 64,
    "price_per_hour": 0.8
  },
  {
    "id": "aws-rds-postgres-m7i-8xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m7i.8xlarge",
    "vcpu": 32,
    "memory_gb": 128,
    "price_per_hour": 1.6
  },
  {
    "id": "aws-rds-postgres-m7i-12xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m7i.12xlarge",
    "vcpu": 48,
    "memory_gb": 192,
    "price_per_hour": 2.4000000000000004
  },
  {
    "id": "aws-rds-postgres-m7i-16xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m7i.16xlarge",
    "vcpu": 64,
    "memory_gb": 256,
    "price_per_hour": 3.2
  },
  {
    "id": "aws-rds-postgres-m7i-24xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m7i.24xlarge",
    "vcpu": 96,
    "memory_gb": 384,
    "price_per_hour": 4.800000000000001
  },
  {
    "id": "aws-rds-postgres-r4-large",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r4.large",
    "vcpu": 2,
    "memory_gb": 16,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-r4-xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r4.xlarge",
    "vcpu": 4,
    "memory_gb": 32,
    "price_per_hour": 0.2
  },
  {
    "id": "aws-rds-postgres-r4-2xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r4.2xlarge",
    "vcpu": 8,
    "memory_gb": 64,
    "price_per_hour": 0.4
  },
  {
    "id": "aws-rds-postgres-r4-4xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r4.4xlarge",
    "vcpu": 16,
    "memory_gb": 128,
    "price_per_hour": 0.8
  },
  {
    "id": "aws-rds-postgres-r4-8xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r4.8xlarge",
    "vcpu": 32,
    "memory_gb": 256,
    "price_per_hour": 1.6
  },
  {
    "id": "aws-rds-postgres-r4-16xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r4.16xlarge",
    "vcpu": 64,
    "memory_gb": 512,
    "price_per_hour": 3.2
  },
  {
    "id": "aws-rds-postgres-r5-large",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5.large",
    "vcpu": 2,
    "memory_gb": 16,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-r5-xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5.xlarge",
    "vcpu": 4,
    "memory_gb": 32,
    "price_per_hour": 0.2
  },
  {
    "id": "aws-rds-postgres-r5-2xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5.2xlarge",
    "vcpu": 8,
    "memory_gb": 64,
    "price_per_hour": 0.4
  },
  {
    "id": "aws-rds-postgres-r5-4xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5.4xlarge",
    "vcpu": 16,
    "memory_gb": 128,
    "price_per_hour": 0.8
  },
  {
    "id": "aws-rds-postgres-r5-8xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5.8xlarge",
    "vcpu": 32,
    "memory_gb": 256,
    "price_per_hour": 1.6
  },
  {
    "id": "aws-rds-postgres-r5-12xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5.12xlarge",
    "vcpu": 48,
    "memory_gb": 384,
    "price_per_hour": 2.4000000000000004
  },
  {
    "id": "aws-rds-postgres-r5-16xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5.16xlarge",
    "vcpu": 64,
    "memory_gb": 512,
    "price_per_hour": 3.2
  },
  {
    "id": "aws-rds-postgres-r5-24xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5.24xlarge",
    "vcpu": 96,
    "memory_gb": 768,
    "price_per_hour": 4.800000000000001
  },
  {
    "id": "aws-rds-postgres-r5b-large",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5b.large",
    "vcpu": 2,
    "memory_gb": 16,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-r5b-xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5b.xlarge",
    "vcpu": 4,
    "memory_gb": 32,
    "price_per_hour": 0.2
  },
  {
    "id": "aws-rds-postgres-r5b-2xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5b.2xlarge",
    "vcpu": 8,
    "memory_gb": 64,
    "price_per_hour": 0.4
  },
  {
    "id": "aws-rds-postgres-r5b-4xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5b.4xlarge",
    "vcpu": 16,
    "memory_gb": 128,
    "price_per_hour": 0.8
  },
  {
    "id": "aws-rds-postgres-r5b-8xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5b.8xlarge",
    "vcpu": 32,
    "memory_gb": 256,
    "price_per_hour": 1.6
  },
  {
    "id": "aws-rds-postgres-r5b-12xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5b.12xlarge",
    "vcpu": 48,
    "memory_gb": 384,
    "price_per_hour": 2.4000000000000004
  },
  {
    "id": "aws-rds-postgres-r5b-16xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5b.16xlarge",
    "vcpu": 64,
    "memory_gb": 512,
    "price_per_hour": 3.2
  },
  {
    "id": "aws-rds-postgres-r5b-24xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5b.24xlarge",
    "vcpu": 96,
    "memory_gb": 768,
    "price_per_hour": 4.800000000000001
  },
  {
    "id": "aws-rds-postgres-r5d-large",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5d.large",
    "vcpu": 2,
    "memory_gb": 16,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-r5d-xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5d.xlarge",
    "vcpu": 4,
    "memory_gb": 32,
    "price_per_hour": 0.2
  },
  {
    "id": "aws-rds-postgres-r5d-2xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5d.2xlarge",
    "vcpu": 8,
    "memory_gb": 64,
    "price_per_hour": 0.4
  },
  {
    "id": "aws-rds-postgres-r5d-4xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5d.4xlarge",
    "vcpu": 16,
    "memory_gb": 128,
    "price_per_hour": 0.8
  },
  {
    "id": "aws-rds-postgres-r5d-8xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5d.8xlarge",
    "vcpu": 32,
    "memory_gb": 256,
    "price_per_hour": 1.6
  },
  {
    "id": "aws-rds-postgres-r5d-12xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5d.12xlarge",
    "vcpu": 48,
    "memory_gb": 384,
    "price_per_hour": 2.4000000000000004
  },
  {
    "id": "aws-rds-postgres-r5d-16xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5d.16xlarge",
    "vcpu": 64,
    "memory_gb": 512,
    "price_per_hour": 3.2
  },
  {
    "id": "aws-rds-postgres-r5d-24xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5d.24xlarge",
    "vcpu": 96,
    "memory_gb": 768,
    "price_per_hour": 4.800000000000001
  },
  {
    "id": "aws-rds-postgres-r6i-large",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6i.large",
    "vcpu": 2,
    "memory_gb": 16,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-r6i-xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6i.xlarge",
    "vcpu": 4,
    "memory_gb": 32,
    "price_per_hour": 0.2
  },
  {
    "id": "aws-rds-postgres-r6i-2xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6i.2xlarge",
    "vcpu": 8,
    "memory_gb": 64,
    "price_per_hour": 0.4
  },
  {
    "id": "aws-rds-postgres-r6i-4xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6i.4xlarge",
    "vcpu": 16,
    "memory_gb": 128,
    "price_per_hour": 0.8
  },
  {
    "id": "aws-rds-postgres-r6i-8xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6i.8xlarge",
    "vcpu": 32,
    "memory_gb": 256,
    "price_per_hour": 1.6
  },
  {
    "id": "aws-rds-postgres-r6i-12xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6i.12xlarge",
    "vcpu": 48,
    "memory_gb": 384,
    "price_per_hour": 2.4000000000000004
  },
  {
    "id": "aws-rds-postgres-r6i-16xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6i.16xlarge",
    "vcpu": 64,
    "memory_gb": 512,
    "price_per_hour": 3.2
  },
  {
    "id": "aws-rds-postgres-r6i-24xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6i.24xlarge",
    "vcpu": 96,
    "memory_gb": 768,
    "price_per_hour": 4.800000000000001
  },
  {
    "id": "aws-rds-postgres-r6g-large",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6g.large",
    "vcpu": 2,
    "memory_gb": 16,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-r6g-xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6g.xlarge",
    "vcpu": 4,
    "memory_gb": 32,
    "price_per_hour": 0.2
  },
  {
    "id": "aws-rds-postgres-r6g-2xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6g.2xlarge",
    "vcpu": 8,
    "memory_gb": 64,
    "price_per_hour": 0.4
  },
  {
    "id": "aws-rds-postgres-r6g-4xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6g.4xlarge",
    "vcpu": 16,
    "memory_gb": 128,
    "price_per_hour": 0.8
  },
  {
    "id": "aws-rds-postgres-r6g-8xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6g.8xlarge",
    "vcpu": 32,
    "memory_gb": 256,
    "price_per_hour": 1.6
  },
  {
    "id": "aws-rds-postgres-r6g-12xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6g.12xlarge",
    "vcpu": 48,
    "memory_gb": 384,
    "price_per_hour": 2.4000000000000004
  },
  {
    "id": "aws-rds-postgres-r6g-16xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6g.16xlarge",
    "vcpu": 64,
    "memory_gb": 512,
    "price_per_hour": 3.2
  },
  {
    "id": "aws-rds-postgres-r6g-24xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6g.24xlarge",
    "vcpu": 96,
    "memory_gb": 768,
    "price_per_hour": 4.800000000000001
  },
  {
    "id": "aws-rds-postgres-r6gd-large",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6gd.large",
    "vcpu": 2,
    "memory_gb": 16,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-r6gd-xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6gd.xlarge",
    "vcpu": 4,
    "memory_gb": 32,
    "price_per_hour": 0.2
  },
  {
    "id": "aws-rds-postgres-r6gd-2xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6gd.2xlarge",
    "vcpu": 8,
    "memory_gb": 64,
    "price_per_hour": 0.4
  },
  {
    "id": "aws-rds-postgres-r6gd-4xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6gd.4xlarge",
    "vcpu": 16,
    "memory_gb": 128,
    "price_per_hour": 0.8
  },
  {
    "id": "aws-rds-postgres-r6gd-8xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6gd.8xlarge",
    "vcpu": 32,
    "memory_gb": 256,
    "price_per_hour": 1.6
  },
  {
    "id": "aws-rds-postgres-r6gd-12xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6gd.12xlarge",
    "vcpu": 48,
    "memory_gb": 384,
    "price_per_hour": 2.4000000000000004
  },
  {
    "id": "aws-rds-postgres-r6gd-16xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6gd.16xlarge",
    "vcpu": 64,
    "memory_gb": 512,
    "price_per_hour": 3.2
  },
  {
    "id": "aws-rds-postgres-r6gd-24xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6gd.24xlarge",
    "vcpu": 96,
    "memory_gb": 768,
    "price_per_hour": 4.800000000000001
  },
  {
    "id": "aws-rds-postgres-r7i-large",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r7i.large",
    "vcpu": 2,
    "memory_gb": 16,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-r7i-xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r7i.xlarge",
    "vcpu": 4,
    "memory_gb": 32,
    "price_per_hour": 0.2
  },
  {
    "id": "aws-rds-postgres-r7i-2xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r7i.2xlarge",
    "vcpu": 8,
    "memory_gb": 64,
    "price_per_hour": 0.4
  },
  {
    "id": "aws-rds-postgres-r7i-4xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r7i.4xlarge",
    "vcpu": 16,
    "memory_gb": 128,
    "price_per_hour": 0.8
  },
  {
    "id": "aws-rds-postgres-r7i-8xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r7i.8xlarge",
    "vcpu": 32,
    "memory_gb": 256,
    "price_per_hour": 1.6
  },
  {
    "id": "aws-rds-postgres-r7i-12xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r7i.12xlarge",
    "vcpu": 48,
    "memory_gb": 384,
    "price_per_hour": 2.4000000000000004
  },
  {
    "id": "aws-rds-postgres-r7i-16xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r7i.16xlarge",
    "vcpu": 64,
    "memory_gb": 512,
    "price_per_hour": 3.2
  },
  {
    "id": "aws-rds-postgres-r7i-24xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r7i.24xlarge",
    "vcpu": 96,
    "memory_gb": 768,
    "price_per_hour": 4.800000000000001
  },
  {
    "id": "aws-rds-postgres-c4-large",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c4.large",
    "vcpu": 2,
    "memory_gb": 4,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-c4-xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c4.xlarge",
    "vcpu": 4,
    "memory_gb": 8,
    "price_per_hour": 0.2
  },
  {
    "id": "aws-rds-postgres-c4-2xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c4.2xlarge",
    "vcpu": 8,
    "memory_gb": 16,
    "price_per_hour": 0.4
  },
  {
    "id": "aws-rds-postgres-c4-4xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c4.4xlarge",
    "vcpu": 16,
    "memory_gb": 32,
    "price_per_hour": 0.8
  },
  {
    "id": "aws-rds-postgres-c4-8xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c4.8xlarge",
    "vcpu": 32,
    "memory_gb": 64,
    "price_per_hour": 1.6
  },
  {
    "id": "aws-rds-postgres-c5-large",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c5.large",
    "vcpu": 2,
    "memory_gb": 4,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-c5-xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c5.xlarge",
    "vcpu": 4,
    "memory_gb": 8,
    "price_per_hour": 0.2
  },
  {
    "id": "aws-rds-postgres-c5-2xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c5.2xlarge",
    "vcpu": 8,
    "memory_gb": 16,
    "price_per_hour": 0.4
  },
  {
    "id": "aws-rds-postgres-c5-4xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c5.4xlarge",
    "vcpu": 16,
    "memory_gb": 32,
    "price_per_hour": 0.8
  },
  {
    "id": "aws-rds-postgres-c5-8xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c5.8xlarge",
    "vcpu": 32,
    "memory_gb": 64,
    "price_per_hour": 1.6
  },
  {
    "id": "aws-rds-postgres-c5-12xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c5.12xlarge",
    "vcpu": 48,
    "memory_gb": 96,
    "price_per_hour": 2.4000000000000004
  },
  {
    "id": "aws-rds-postgres-c5-16xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c5.16xlarge",
    "vcpu": 64,
    "memory_gb": 128,
    "price_per_hour": 3.2
  },
  {
    "id": "aws-rds-postgres-c5-24xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c5.24xlarge",
    "vcpu": 96,
    "memory_gb": 192,
    "price_per_hour": 4.800000000000001
  },
  {
    "id": "aws-rds-postgres-c6i-large",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c6i.large",
    "vcpu": 2,
    "memory_gb": 4,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-c6i-xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c6i.xlarge",
    "vcpu": 4,
    "memory_gb": 8,
    "price_per_hour": 0.2
  },
  {
    "id": "aws-rds-postgres-c6i-2xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c6i.2xlarge",
    "vcpu": 8,
    "memory_gb": 16,
    "price_per_hour": 0.4
  },
  {
    "id": "aws-rds-postgres-c6i-4xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c6i.4xlarge",
    "vcpu": 16,
    "memory_gb": 32,
    "price_per_hour": 0.8
  },
  {
    "id": "aws-rds-postgres-c6i-8xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c6i.8xlarge",
    "vcpu": 32,
    "memory_gb": 64,
    "price_per_hour": 1.6
  },
  {
    "id": "aws-rds-postgres-c6i-12xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c6i.12xlarge",
    "vcpu": 48,
    "memory_gb": 96,
    "price_per_hour": 2.4000000000000004
  },
  {
    "id": "aws-rds-postgres-c6i-16xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c6i.16xlarge",
    "vcpu": 64,
    "memory_gb": 128,
    "price_per_hour": 3.2
  },
  {
    "id": "aws-rds-postgres-c6i-24xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c6i.24xlarge",
    "vcpu": 96,
    "memory_gb": 192,
    "price_per_hour": 4.800000000000001
  },
  {
    "id": "aws-rds-postgres-c6gd-medium",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c6gd.medium",
    "vcpu": 1,
    "memory_gb": 2,
    "price_per_hour": 0.05
  },
  {
    "id": "aws-rds-postgres-c6gd-large",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c6gd.large",
    "vcpu": 2,
    "memory_gb": 4,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-c6gd-xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c6gd.xlarge",
    "vcpu": 4,
    "memory_gb": 8,
    "price_per_hour": 0.2
  },
  {
    "id": "aws-rds-postgres-c6gd-2xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c6gd.2xlarge",
    "vcpu": 8,
    "memory_gb": 16,
    "price_per_hour": 0.4
  },
  {
    "id": "aws-rds-postgres-c6gd-4xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c6gd.4xlarge",
    "vcpu": 16,
    "memory_gb": 32,
    "price_per_hour": 0.8
  },
  {
    "id": "aws-rds-postgres-c6gd-8xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c6gd.8xlarge",
    "vcpu": 32,
    "memory_gb": 64,
    "price_per_hour": 1.6
  },
  {
    "id": "aws-rds-postgres-c6gd-12xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c6gd.12xlarge",
    "vcpu": 48,
    "memory_gb": 96,
    "price_per_hour": 2.4000000000000004
  },
  {
    "id": "aws-rds-postgres-c6gd-16xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.c6gd.16xlarge",
    "vcpu": 64,
    "memory_gb": 128,
    "price_per_hour": 3.2
  },
  {
    "id": "aws-rds-postgres-t2-micro",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.t2.micro",
    "vcpu": 1,
    "memory_gb": 1,
    "price_per_hour": 0.05
  },
  {
    "id": "aws-rds-postgres-t2-small",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.t2.small",
    "vcpu": 2,
    "memory_gb": 2,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-t2-medium",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.t2.medium",
    "vcpu": 1,
    "memory_gb": 4,
    "price_per_hour": 0.05
  },
  {
    "id": "aws-rds-postgres-t2-large",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.t2.large",
    "vcpu": 2,
    "memory_gb": 8,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-t2-xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.t2.xlarge",
    "vcpu": 4,
    "memory_gb": 16,
    "price_per_hour": 0.2
  },
  {
    "id": "aws-rds-postgres-t3-micro",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.t3.micro",
    "vcpu": 1,
    "memory_gb": 1,
    "price_per_hour": 0.05
  },
  {
    "id": "aws-rds-postgres-t3-small",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.t3.small",
    "vcpu": 2,
    "memory_gb": 2,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-t3-medium",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.t3.medium",
    "vcpu": 1,
    "memory_gb": 4,
    "price_per_hour": 0.05
  },
  {
    "id": "aws-rds-postgres-t3-large",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.t3.large",
    "vcpu": 2,
    "memory_gb": 8,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-t3-xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.t3.xlarge",
    "vcpu": 4,
    "memory_gb": 16,
    "price_per_hour": 0.2
  },
  {
    "id": "aws-rds-postgres-t3-2xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.t3.2xlarge",
    "vcpu": 8,
    "memory_gb": 32,
    "price_per_hour": 0.4
  },
  {
    "id": "aws-rds-postgres-t4g-micro",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.t4g.micro",
    "vcpu": 1,
    "memory_gb": 1,
    "price_per_hour": 0.05
  },
  {
    "id": "aws-rds-postgres-t4g-small",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.t4g.small",
    "vcpu": 2,
    "memory_gb": 2,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-t4g-medium",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.t4g.medium",
    "vcpu": 1,
    "memory_gb": 4,
    "price_per_hour": 0.05
  },
  {
    "id": "aws-rds-postgres-t4g-large",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.t4g.large",
    "vcpu": 2,
    "memory_gb": 8,
    "price_per_hour": 0.1
  },
  {
    "id": "aws-rds-postgres-t4g-xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.t4g.xlarge",
    "vcpu": 4,
    "memory_gb": 16,
    "price_per_hour": 0.2
  },
  {
    "id": "aws-rds-postgres-t4g-2xlarge",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.t4g.2xlarge",
    "vcpu": 8,
    "memory_gb": 32,
    "price_per_hour": 0.4
  },
  {
    "id": "aws-rds-postgres-m5-metal",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m5.metal",
    "vcpu": 96,
    "memory_gb": 384,
    "price_per_hour": 4.800000000000001
  },
  {
    "id": "aws-rds-postgres-m6i-metal",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m6i.metal",
    "vcpu": 128,
    "memory_gb": 512,
    "price_per_hour": 6.4
  },
  {
    "id": "aws-rds-postgres-m7i-metal-24xl",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m7i.metal-24xl",
    "vcpu": 96,
    "memory_gb": 384,
    "price_per_hour": 4.800000000000001
  },
  {
    "id": "aws-rds-postgres-m7i-metal-48xl",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.m7i.metal-48xl",
    "vcpu": 192,
    "memory_gb": 768,
    "price_per_hour": 9.600000000000001
  },
  {
    "id": "aws-rds-postgres-r5-metal",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r5.metal",
    "vcpu": 96,
    "memory_gb": 768,
    "price_per_hour": 4.800000000000001
  },
  {
    "id": "aws-rds-postgres-r6i-metal",
    "provider_id": "aws-mock",
    "region_id": "aws-us-east-1",
    "db_engine": "PostgreSQL",
    "instance_class": "db.r6i.metal",
    "vcpu": 128,
    "memory_gb": 1024,
    "price_per_hour": 6.4
  },
  ];

const MOCK_NETWORKING = [
  { id: "aws-data-transfer", provider_id: "aws-mock", region_id: "aws-us-east-1", service_name: "Data Transfer Out", service_type: "Egress", price_per_unit: 0.09, unit_type: "GB" }
];

// Load Firebase Config
const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

// Initialize Firebase Admin
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
      // Fallback for Cloud Run environment or ADC
      initializeApp({
        projectId: firebaseConfig.projectId,
      });
      console.log("Firebase Admin initialized with default credentials.");
      
      if (process.env.NODE_ENV !== "production") {
        console.warn("\n[WARNING] Running locally without GOOGLE_APPLICATION_CREDENTIALS.");
        console.warn("If you get 'PERMISSION_DENIED', please follow these steps:");
        console.warn("1. Go to Firebase Console > Project Settings > Service Accounts.");
        console.warn("2. Click 'Generate new private key'.");
        console.warn("3. Save the JSON file as 'service-account.json' in the root directory.");
        console.warn("OR set the GOOGLE_APPLICATION_CREDENTIALS environment variable to the path of the JSON file.\n");
      }
    }
  } catch (err) {
    console.error("Firebase Admin initialization failed:", err);
  }
}

const db = getFirestore(firebaseConfig.firestoreDatabaseId);

const app = express();

// Robust port detection
const rawPort = process.env.PORT || process.env.port || "3000";
const PORT = parseInt(rawPort.trim());

console.log("------------------------------------");
console.log(`DEBUG: Port Detection`);
console.log(`DEBUG: Raw PORT from env: "${rawPort}"`);
console.log(`DEBUG: Final PORT chosen: ${PORT}`);
console.log("------------------------------------");

const JWT_SECRET = process.env.JWT_SECRET_KEY || "calcus-super-secret-key-12345";

// --- AWS SDK Clients (Lazy Initialization) ---
let pricingClient: PricingClient | null = null;
let ec2Client: EC2Client | null = null;

function getAWSPricingClient() {
  if (!pricingClient) {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || "us-east-1";

    if (!accessKeyId || !secretAccessKey) {
      throw new Error("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required. Please set them in the AI Studio Settings menu.");
    }

    pricingClient = new PricingClient({
      region: "us-east-1", // Pricing API is only available in us-east-1 or ap-south-1
      credentials: { accessKeyId, secretAccessKey }
    });
  }
  return pricingClient;
}

function getAWSEC2Client() {
  if (!ec2Client) {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || "us-east-1";

    if (!accessKeyId || !secretAccessKey) {
      throw new Error("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required. Please set them in the AI Studio Settings menu.");
    }

    ec2Client = new EC2Client({
      region,
      credentials: { accessKeyId, secretAccessKey }
    });
  }
  return ec2Client;
}

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// --- Middleware ---

const authenticate = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

// --- Audit Logging ---

async function logAudit(action: string, status: string = "success", userId?: string, ip?: string, inputData?: any, errorMessage?: string) {
  try {
    await db.collection("audit_logs").add({
      user_id: userId || null,
      action,
      status,
      input_data: inputData || null,
      error_message: errorMessage || null,
      ip_address: ip || null,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}

// --- API Routes ---

app.get("/api/healthz", (req, res) => {
  res.json({ status: "ok" });
});

// Auth
app.post("/api/v1/auth/login", async (req, res) => {
  const { email, password } = req.body;
  
  // Hardcoded admin fallback for testing/remixed apps without DB
  if ((email === "admin@yourcompany.com" && password === "yourpassword") || 
      (email === "admin@jadeglobal.com" && password === "admin123")) {
    const token = jwt.sign({ userId: "admin-123", email, role: "admin" }, JWT_SECRET || "fallback-secret", { expiresIn: "24h" });
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    return res.json({ user_id: "admin-123", email, role: "admin", token, expires_at: expiresAt });
  }

  try {
    const userSnapshot = await db.collection("users").where("email", "==", email).limit(1).get();
    if (userSnapshot.empty) {
      await logAudit("login_failed", "failed", undefined, req.ip, { email }, "User not found");
      return res.status(401).json({ error: "User not found" });
    }
    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    const isValid = await bcrypt.compare(password, userData.password_hash);
    if (!isValid) {
      await logAudit("login_failed", "failed", undefined, req.ip, { email }, "Invalid password");
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = jwt.sign({ userId: userDoc.id, email, role: userData.role }, JWT_SECRET, { expiresIn: "24h" });
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await logAudit("login", "success", userDoc.id, req.ip);
    res.json({ user_id: userDoc.id, email, role: userData.role, token, expires_at: expiresAt });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Database connection failed. Please use the default admin credentials." });
  }
});

app.post("/api/v1/auth/register", authenticate, requireAdmin, async (req, res) => {
  const { email, password, role } = req.body;
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const userRef = await db.collection("users").add({
      email,
      password_hash: passwordHash,
      role: role || "user",
      created_at: FieldValue.serverTimestamp(),
    });
    await logAudit("register", "success", (req as any).user.userId, req.ip, { email, role });
    res.status(201).json({ user_id: userRef.id, email, role });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/v1/auth/me", authenticate, async (req: any, res) => {
  try {
    const userDoc = await db.collection("users").doc(req.user.userId).get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });
    res.json({ id: userDoc.id, ...userDoc.data() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Providers & Regions
app.get("/api/v1/providers", authenticate, async (req, res) => {
  if (firebaseConfig.projectId === "remixed-project-id") {
    return res.json(MOCK_PROVIDERS);
  }
  try {
    const snapshot = await db.collection("providers").get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/v1/providers/:provider_id/regions", authenticate, async (req, res) => {
  if (firebaseConfig.projectId === "remixed-project-id") {
    return res.json(MOCK_REGIONS.filter(r => r.provider_id === req.params.provider_id));
  }
  try {
    const snapshot = await db.collection("regions").where("provider_id", "==", req.params.provider_id).get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Pricing
app.get("/api/v1/pricing/compute", authenticate, async (req, res) => {
  const { provider_id, region_id, os_type } = req.query;
  if (firebaseConfig.projectId === "remixed-project-id") {
    let data = MOCK_COMPUTE;
    if (provider_id) data = data.filter(d => d.provider_id === provider_id);
    // if (region_id) data = data.filter(d => d.region_id === region_id); // Disabled region filter for mock data to allow all regions to show instances
    if (os_type) data = data.filter(d => d.os_type === os_type);
    return res.json(data);
  }
  try {
    let query: any = db.collection("compute_pricing");
    if (provider_id) query = query.where("provider_id", "==", provider_id);
    if (region_id) query = query.where("region_id", "==", region_id);
    if (os_type) query = query.where("os_type", "==", os_type);
    
    const snapshot = await query.get();
    res.json(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/v1/pricing/storage", authenticate, async (req, res) => {
  const { provider_id, region_id, storage_type } = req.query;
  if (firebaseConfig.projectId === "remixed-project-id") {
    let data = MOCK_STORAGE;
    if (provider_id) data = data.filter(d => d.provider_id === provider_id);
    // if (region_id) data = data.filter(d => d.region_id === region_id); // Disabled region filter for mock data to allow all regions to show instances
    if (storage_type) data = data.filter(d => d.storage_type === storage_type);
    return res.json(data);
  }
  try {
    let query: any = db.collection("storage_pricing");
    if (provider_id) query = query.where("provider_id", "==", provider_id);
    if (region_id) query = query.where("region_id", "==", region_id);
    if (storage_type) query = query.where("storage_type", "==", storage_type);
    
    const snapshot = await query.get();
    res.json(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/v1/pricing/database", authenticate, async (req, res) => {
  const { provider_id, region_id, db_engine } = req.query;
  if (firebaseConfig.projectId === "remixed-project-id") {
    let data = MOCK_DATABASE;
    if (provider_id) data = data.filter(d => d.provider_id === provider_id);
    // if (region_id) data = data.filter(d => d.region_id === region_id); // Disabled region filter for mock data to allow all regions to show instances
    if (db_engine) data = data.filter(d => d.db_engine === db_engine);
    return res.json(data);
  }
  try {
    let query: any = db.collection("database_pricing");
    if (provider_id) query = query.where("provider_id", "==", provider_id);
    if (region_id) query = query.where("region_id", "==", region_id);
    if (db_engine) query = query.where("db_engine", "==", db_engine);
    
    const snapshot = await query.get();
    res.json(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/v1/pricing/networking", authenticate, async (req, res) => {
  const { provider_id, region_id, service_type } = req.query;
  if (firebaseConfig.projectId === "remixed-project-id") {
    let data = MOCK_NETWORKING;
    if (provider_id) data = data.filter(d => d.provider_id === provider_id);
    // if (region_id) data = data.filter(d => d.region_id === region_id); // Disabled region filter for mock data to allow all regions to show instances
    if (service_type) data = data.filter(d => d.service_type === service_type);
    return res.json(data);
  }
  try {
    let query: any = db.collection("networking_pricing");
    if (provider_id) query = query.where("provider_id", "==", provider_id);
    if (region_id) query = query.where("region_id", "==", region_id);
    if (service_type) query = query.where("service_type", "==", service_type);
    
    const snapshot = await query.get();
    res.json(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AWS Data Sync
app.post("/api/v1/aws/sync-pricing", authenticate, requireAdmin, async (req, res) => {
  try {
    const client = getAWSPricingClient();
    const awsRegion = process.env.AWS_REGION || "us-east-1";
    
    // Comprehensive AWS Region to Location Name Map
    const regionMap: Record<string, string> = {
      "us-east-1": "US East (N. Virginia)",
      "us-east-2": "US East (Ohio)",
      "us-west-1": "US West (N. California)",
      "us-west-2": "US West (Oregon)",
      "af-south-1": "Africa (Cape Town)",
      "ap-east-1": "Asia Pacific (Hong Kong)",
      "ap-south-1": "Asia Pacific (Mumbai)",
      "ap-northeast-3": "Asia Pacific (Osaka)",
      "ap-northeast-2": "Asia Pacific (Seoul)",
      "ap-southeast-1": "Asia Pacific (Singapore)",
      "ap-southeast-2": "Asia Pacific (Sydney)",
      "ap-northeast-1": "Asia Pacific (Tokyo)",
      "ca-central-1": "Canada (Central)",
      "eu-central-1": "Europe (Frankfurt)",
      "eu-west-1": "Europe (Ireland)",
      "eu-west-2": "Europe (London)",
      "eu-south-1": "Europe (Milan)",
      "eu-west-3": "Europe (Paris)",
      "eu-north-1": "Europe (Stockholm)",
      "me-south-1": "Middle East (Bahrain)",
      "sa-east-1": "South America (São Paulo)"
    };
    const location = regionMap[awsRegion] || "US East (N. Virginia)";

    // Fetch common instance types for both Linux and Windows
    const instanceTypes = ["t3.medium", "m5.large", "c5.xlarge", "r5.large", "t3.xlarge", "m5.xlarge", "t3.micro", "t3.small"];
    const osTypes = ["Linux", "Windows"];
    const savedInstances = [];
    let sampleData = null;

    for (const type of instanceTypes) {
      for (const os of osTypes) {
        const command = new GetProductsCommand({
          ServiceCode: "AmazonEC2",
          Filters: [
            { Type: "TERM_MATCH", Field: "location", Value: location },
            { Type: "TERM_MATCH", Field: "instanceType", Value: type },
            { Type: "TERM_MATCH", Field: "operatingSystem", Value: os },
            { Type: "TERM_MATCH", Field: "preInstalledSw", Value: "NA" },
            { Type: "TERM_MATCH", Field: "tenancy", Value: "Shared" },
            { Type: "TERM_MATCH", Field: "capacitystatus", Value: "Used" }
          ],
          FormatVersion: "aws_v1",
          MaxResults: 1
        });

        const response = await client.send(command);
        const priceList = response.PriceList || [];
        
        if (priceList.length > 0) {
          const data = JSON.parse(priceList[0] as string);
          if (!sampleData) sampleData = data;

          const attributes = data.product?.attributes;
          const terms = data.terms?.OnDemand;
          
          if (attributes && terms) {
            const instanceType = attributes.instanceType;
            const vcpu = parseInt(attributes.vcpu);
            const memory = parseFloat(attributes.memory.split(" ")[0]);
            
            const termKey = Object.keys(terms)[0];
            const priceDimensions = terms[termKey]?.priceDimensions;
            const dimensionKey = Object.keys(priceDimensions)[0];
            const pricePerUnit = parseFloat(priceDimensions[dimensionKey]?.pricePerUnit?.USD);

            if (!isNaN(pricePerUnit)) {
              const providerSnap = await db.collection("providers").where("name", "==", "AWS").get();
              const providerId = providerSnap.empty ? null : providerSnap.docs[0].id;

              const regionSnap = await db.collection("regions").where("region_code", "==", awsRegion).get();
              const regionId = regionSnap.empty ? null : regionSnap.docs[0].id;

              if (providerId && regionId) {
                const pricingData = {
                  provider_id: providerId,
                  region_id: regionId,
                  instance_type: instanceType,
                  os_type: os,
                  price_per_hour: pricePerUnit,
                  price_per_month: pricePerUnit * 730,
                  price_per_year: pricePerUnit * 730 * 12,
                  vcpu: vcpu,
                  memory_gb: memory,
                  updated_at: new Date().toISOString()
                };

                const existing = await db.collection("compute_pricing")
                  .where("provider_id", "==", providerId)
                  .where("region_id", "==", regionId)
                  .where("instance_type", "==", instanceType)
                  .where("os_type", "==", os)
                  .get();

                if (existing.empty) {
                  await db.collection("compute_pricing").add(pricingData);
                } else {
                  await existing.docs[0].ref.update(pricingData);
                }
                savedInstances.push(`${instanceType} (${os})`);
              }
            }
          }
        }
      }
    }

    // Sync EBS Storage (gp3)
    const ebsCommand = new GetProductsCommand({
      ServiceCode: "AmazonEC2",
      Filters: [
        { Type: "TERM_MATCH", Field: "location", Value: location },
        { Type: "TERM_MATCH", Field: "volumeApiName", Value: "gp3" },
        { Type: "TERM_MATCH", Field: "productFamily", Value: "Storage" }
      ],
      FormatVersion: "aws_v1",
      MaxResults: 1
    });

    const ebsResponse = await client.send(ebsCommand);
    if (ebsResponse.PriceList && ebsResponse.PriceList.length > 0) {
      const ebsData = JSON.parse(ebsResponse.PriceList[0] as string);
      const ebsTerms = ebsData.terms?.OnDemand;
      const termKey = Object.keys(ebsTerms)[0];
      const pricePerGb = parseFloat(ebsTerms[termKey]?.priceDimensions[Object.keys(ebsTerms[termKey].priceDimensions)[0]]?.pricePerUnit?.USD);

      if (!isNaN(pricePerGb)) {
        const providerSnap = await db.collection("providers").where("name", "==", "AWS").get();
        const regionSnap = await db.collection("regions").where("region_code", "==", awsRegion).get();
        
        if (!providerSnap.empty && !regionSnap.empty) {
          const storageData = {
            provider_id: providerSnap.docs[0].id,
            region_id: regionSnap.docs[0].id,
            storage_type: "ebs",
            storage_name: "EBS gp3",
            price_per_gb_month: pricePerGb,
            unit_type: "GB",
            updated_at: new Date().toISOString()
          };

          const existing = await db.collection("storage_pricing")
            .where("provider_id", "==", storageData.provider_id)
            .where("region_id", "==", storageData.region_id)
            .where("storage_name", "==", "EBS gp3")
            .get();

          if (existing.empty) {
            await db.collection("storage_pricing").add(storageData);
          } else {
            await existing.docs[0].ref.update(storageData);
          }
        }
      }
    }
    
    // Log the sync attempt
    await logAudit("aws_pricing_sync", "success", (req as any).user.userId, req.ip, { count: savedInstances.length });
    
    res.json({ 
      message: `Successfully synced ${savedInstances.length} AWS instances`, 
      count: savedInstances.length,
      instances: savedInstances,
      sample: sampleData
    });
  } catch (err: any) {
    console.error("AWS Sync Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/v1/aws/instances", authenticate, async (req: any, res) => {
  try {
    const client = getAWSEC2Client();
    const command = new DescribeInstancesCommand({});
    const response = await client.send(command);
    
    const instances = response.Reservations?.flatMap(r => r.Instances || []) || [];
    
    res.json({
      count: instances.length,
      instances: instances.map(i => ({
        id: i.InstanceId,
        type: i.InstanceType,
        state: i.State?.Name,
        launch_time: i.LaunchTime,
        region: process.env.AWS_REGION
      }))
    });
  } catch (err: any) {
    console.error("AWS EC2 Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Calculations
app.post("/api/v1/calculations", authenticate, async (req: any, res) => {
  if (firebaseConfig.projectId === "remixed-project-id") {
    const breakdowns = MOCK_PROVIDERS.map(p => {
      return {
        provider_name: p.name,
        compute_cost_monthly: 100,
        storage_cost_monthly: 50,
        database_cost_monthly: 200,
        networking_cost_monthly: 20,
        total_cost_monthly: 370,
        total_cost_annual: 370 * 12,
        is_cheapest: false
      };
    });
    breakdowns[0].is_cheapest = true;
    const result = {
      id: "mock-calc-id",
      user_id: req.user.userId,
      input_json: req.body,
      result_json: { provider_breakdowns: breakdowns },
      cheapest_provider: breakdowns[0].provider_name,
      aws_total_monthly: breakdowns[0].total_cost_monthly,
      azure_total_monthly: breakdowns[1].total_cost_monthly,
      gcp_total_monthly: breakdowns[2].total_cost_monthly,
      duration_months: req.body.duration_months || 1,
      created_at: new Date().toISOString()
    };
    return res.json(result);
  }

  const { compute_selections, storage_selections, database_selections, networking_selections, eks_selections, duration_months } = req.body;
  try {
    const breakdowns: any[] = [];
    const providersSnapshot = await db.collection("providers").get();
    const providers = providersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    const discountMultiplier = (duration_months === 36) ? 0.4 : (duration_months === 12) ? 0.7 : 1.0;

    for (const p of providers) {
      let computeCost = 0;
      let storageCost = 0;
      let databaseCost = 0;
      let networkingCost = 0;

      let pCompute = (compute_selections || []).filter((s: any) => s.provider_id === p.id);
      let pStorage = (storage_selections || []).filter((s: any) => s.provider_id === p.id);
      let pDatabase = (database_selections || []).filter((s: any) => s.provider_id === p.id);
      let pNetworking = (networking_selections || []).filter((s: any) => s.provider_id === p.id);
      let pEks = (eks_selections || []).filter((s: any) => s.provider_id === p.id);

      // EKS / Managed Kubernetes Cluster Pricing ($0.10/hr)
      if (pEks.length === 0 && eks_selections?.length > 0) {
        const source = eks_selections[0];
        computeCost += (source.clusters || 0) * 0.10 * 730 * discountMultiplier;
      }
      for (const s of pEks) {
        computeCost += (s.clusters || 0) * 0.10 * 730 * discountMultiplier;
      }

      if (pCompute.length === 0 && compute_selections?.length > 0) {
        const source = compute_selections[0];
        const sourcePricing = await db.collection("compute_pricing").doc(source.compute_pricing_id).get();
        if (sourcePricing.exists) {
          const sp = sourcePricing.data();
          const equivalent = await db.collection("compute_pricing")
            .where("provider_id", "==", p.id)
            .where("vcpu", "==", sp?.vcpu)
            .where("memory_gb", "==", sp?.memory_gb)
            .get();
          if (!equivalent.empty) {
            computeCost += (equivalent.docs[0].data().price_per_hour || 0) * (source.quantity || 1) * 730 * discountMultiplier;
          }
        }
      }

      if (pStorage.length === 0 && storage_selections?.length > 0) {
        const source = storage_selections[0];
        const sourcePricing = await db.collection("storage_pricing").doc(source.storage_pricing_id).get();
        let basePrice = 0;
        const totalGb = source.unit === "TB" ? (source.size || 0) * 1024 : (source.size || 0);

        const calculateS3TieredCost = (gb: number) => {
          if (gb <= 50 * 1024) return gb * 0.023;
          if (gb <= 500 * 1024) return (50 * 1024 * 0.023) + ((gb - 50 * 1024) * 0.022);
          return (50 * 1024 * 0.023) + (450 * 1024 * 0.022) + ((gb - 500 * 1024) * 0.021);
        };

        let storageBase = 0;
        if (sourcePricing.exists) {
          const sp = sourcePricing.data();
          const equivalent = await db.collection("storage_pricing")
            .where("provider_id", "==", p.id)
            .where("storage_type", "==", sp?.storage_type)
            .get();
          if (!equivalent.empty) {
            basePrice = equivalent.docs[0].data().price_per_gb_month || 0;
            storageBase = basePrice * totalGb;
          }
        } else if (source.label?.includes("S3")) {
          storageBase = calculateS3TieredCost(totalGb);
        }

        if (storageBase > 0 || source.label?.includes("S3")) {
          const putCost = ((source.put_requests || 0) / 1000) * 0.005;
          const getCost = ((source.get_requests || 0) / 10000) * 0.004;
          
          const selectReturnedGb = source.select_returned_unit === "TB" ? (source.select_returned || 0) * 1024 : (source.select_returned || 0);
          const selectScannedGb = source.select_scanned_unit === "TB" ? (source.select_scanned || 0) * 1024 : (source.select_scanned || 0);
          
          const selectReturnedCost = selectReturnedGb * 0.0007;
          const selectScannedCost = selectScannedGb * 0.002;
          
          let movementCost = 0;
          if (source.movement_type === "put_copy_post") {
            let avgSizeGb = source.avg_object_size || 16;
            if (source.avg_object_size_unit === "KB") avgSizeGb = avgSizeGb / (1024 * 1024);
            if (source.avg_object_size_unit === "MB") avgSizeGb = avgSizeGb / 1024;
            
            const numObjects = avgSizeGb > 0 ? totalGb / avgSizeGb : 0;
            movementCost = (numObjects / 1000) * 0.005;
          }
          
          storageCost += storageBase + putCost + getCost + selectReturnedCost + selectScannedCost + movementCost;
        }
      }

      if (pDatabase.length === 0 && database_selections?.length > 0) {
        const source = database_selections[0];
        const sourcePricing = await db.collection("database_pricing").doc(source.database_pricing_id).get();
        if (sourcePricing.exists) {
          const sp = sourcePricing.data();
          const equivalent = await db.collection("database_pricing")
            .where("provider_id", "==", p.id)
            .where("db_engine", "==", sp?.db_engine)
            .get();
          if (!equivalent.empty) {
            let dbHours = 730;
            if (source.utilization_unit === "%Utilized/Month") {
              dbHours = 730 * ((source.utilization_value || 100) / 100);
            } else if (source.utilization_unit === "Hours/Day") {
              dbHours = (source.utilization_value || 24) * 30.44;
            } else if (source.utilization_unit === "Hours/Week") {
              dbHours = (source.utilization_value || 168) * 4.345;
            } else if (source.utilization_unit === "Hours/Month") {
              dbHours = (source.utilization_value || 730);
            }

            const dbMultiplier = source.deployment_option === "Multi-AZ" ? 2 : 1;
            const storageRate = source.storage_type === "gp3" ? 0.08 : 0.115;
            const storageCost = (source.storage_gb || 0) * storageRate * dbMultiplier;

            databaseCost += ((equivalent.docs[0].data().price_per_hour || 0) * dbMultiplier * (source.quantity || 1) * dbHours * discountMultiplier) + storageCost;
          }
        }
      }

      if (pNetworking.length === 0 && networking_selections?.length > 0) {
        const source = networking_selections[0];
        const sourcePricing = await db.collection("networking_pricing").doc(source.networking_pricing_id).get();
        if (sourcePricing.exists) {
          const sp = sourcePricing.data();
          const equivalent = await db.collection("networking_pricing")
            .where("provider_id", "==", p.id)
            .where("service_type", "==", sp?.service_type)
            .get();
          if (!equivalent.empty) {
            networkingCost += (equivalent.docs[0].data().price_per_unit || 0) * (source.quantity || 0);
          }
        }
      }

      for (const s of pCompute) {
        const d = await db.collection("compute_pricing").doc(s.compute_pricing_id).get();
        if (d.exists) computeCost += (d.data()?.price_per_hour || 0) * (s.quantity || 1) * 730 * discountMultiplier;
      }
      for (const s of pStorage) {
        const d = await db.collection("storage_pricing").doc(s.storage_pricing_id).get();
        let basePrice = 0;
        const totalGb = s.unit === "TB" ? (s.size || 0) * 1024 : (s.size || 0);

        const calculateS3TieredCost = (gb: number) => {
          if (gb <= 50 * 1024) return gb * 0.023;
          if (gb <= 500 * 1024) return (50 * 1024 * 0.023) + ((gb - 50 * 1024) * 0.022);
          return (50 * 1024 * 0.023) + (450 * 1024 * 0.022) + ((gb - 500 * 1024) * 0.021);
        };

        let storageBase = 0;
        if (d.exists) {
          basePrice = d.data()?.price_per_gb_month || 0;
          storageBase = basePrice * totalGb;
        } else if (s.label?.includes("S3")) {
          storageBase = calculateS3TieredCost(totalGb);
        }
        
        const putCost = ((s.put_requests || 0) / 1000) * 0.005;
        const getCost = ((s.get_requests || 0) / 10000) * 0.004;
        
        const selectReturnedGb = s.select_returned_unit === "TB" ? (s.select_returned || 0) * 1024 : (s.select_returned || 0);
        const selectScannedGb = s.select_scanned_unit === "TB" ? (s.select_scanned || 0) * 1024 : (s.select_scanned || 0);
        
        const selectReturnedCost = selectReturnedGb * 0.0007;
        const selectScannedCost = selectScannedGb * 0.002;
        
        let movementCost = 0;
        if (s.movement_type === "put_copy_post") {
          let avgSizeGb = s.avg_object_size || 16;
          if (s.avg_object_size_unit === "KB") avgSizeGb = avgSizeGb / (1024 * 1024);
          if (s.avg_object_size_unit === "MB") avgSizeGb = avgSizeGb / 1024;
          
          const numObjects = avgSizeGb > 0 ? totalGb / avgSizeGb : 0;
          movementCost = (numObjects / 1000) * 0.005;
        }
        
        storageCost += storageBase + putCost + getCost + selectReturnedCost + selectScannedCost + movementCost;
      }
      for (const s of pDatabase) {
        const d = await db.collection("database_pricing").doc(s.database_pricing_id).get();
        if (d.exists) {
          let dbHours = 730;
          if (s.utilization_unit === "%Utilized/Month") {
            dbHours = 730 * ((s.utilization_value || 100) / 100);
          } else if (s.utilization_unit === "Hours/Day") {
            dbHours = (s.utilization_value || 24) * 30.44;
          } else if (s.utilization_unit === "Hours/Week") {
            dbHours = (s.utilization_value || 168) * 4.345;
          } else if (s.utilization_unit === "Hours/Month") {
            dbHours = (s.utilization_value || 730);
          }

          const dbMultiplier = s.deployment_option === "Multi-AZ" ? 2 : 1;
          const storageRate = s.storage_type === "gp3" ? 0.08 : 0.115;
          const storageCost = (s.storage_gb || 0) * storageRate * dbMultiplier;

          databaseCost += ((d.data()?.price_per_hour || 0) * dbMultiplier * (s.quantity || 1) * dbHours * discountMultiplier) + storageCost;
        }
      }
      for (const s of pNetworking) {
        const d = await db.collection("networking_pricing").doc(s.networking_pricing_id).get();
        if (d.exists) networkingCost += (d.data()?.price_per_unit || 0) * (s.quantity || 0);
      }

      breakdowns.push({
        provider_name: p.name,
        compute_cost_monthly: computeCost,
        storage_cost_monthly: storageCost,
        database_cost_monthly: databaseCost,
        networking_cost_monthly: networkingCost,
        total_cost_monthly: computeCost + storageCost + databaseCost + networkingCost,
        total_cost_annual: (computeCost + storageCost + databaseCost + networkingCost) * 12,
        is_cheapest: false
      });
    }

    const cheapest = breakdowns.reduce((prev, curr) => (prev.total_cost_monthly < curr.total_cost_monthly ? prev : curr));
    cheapest.is_cheapest = true;

    const result = {
      user_id: req.user.userId,
      input_json: req.body,
      result_json: { provider_breakdowns: breakdowns },
      cheapest_provider: cheapest.provider_name,
      aws_total_monthly: breakdowns.find(b => b.provider_name.toLowerCase().includes("amazon") || b.provider_name.toLowerCase().includes("aws"))?.total_cost_monthly || 0,
      azure_total_monthly: breakdowns.find(b => b.provider_name.toLowerCase().includes("azure"))?.total_cost_monthly || 0,
      gcp_total_monthly: breakdowns.find(b => b.provider_name.toLowerCase().includes("google") || b.provider_name.toLowerCase().includes("gcp"))?.total_cost_monthly || 0,
      duration_months: duration_months || 1,
      created_at: new Date().toISOString()
    };

    const docRef = await db.collection("calculations").add(result);
    await logAudit("calculate_pricing", "success", req.user.userId, req.ip, req.body);
    res.json({ id: docRef.id, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/v1/calculations", authenticate, async (req: any, res) => {
  try {
    let query: any = db.collection("calculations");
    if (req.user.role !== "admin") {
      query = query.where("user_id", "==", req.user.userId);
    }
    query = query.orderBy("created_at", "desc");
    
    const snapshot = await query.get();
    res.json({ calculations: snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })), total: snapshot.size });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/v1/calculations/:id", authenticate, async (req: any, res) => {
  try {
    const d = await db.collection("calculations").doc(req.params.id).get();
    if (!d.exists) return res.status(404).json({ error: "Not found" });
    const data = d.data();
    if (req.user.role !== "admin" && data?.user_id !== req.user.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json({ id: d.id, ...data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Exports
app.get("/api/v1/export/calculations/:id/pdf", authenticate, async (req: any, res) => {
  try {
    const d = await db.collection("calculations").doc(req.params.id).get();
    if (!d.exists) return res.status(404).json({ error: "Not found" });
    const calc = d.data() as any;

    const pdfDoc = new PDFDocument();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=calcus_report_${req.params.id}.pdf`);
    pdfDoc.pipe(res);

    pdfDoc.fontSize(20).text("AWS Calcus - Pricing Report", { align: "center" });
    pdfDoc.moveDown();
    pdfDoc.fontSize(12).text(`Calculation ID: ${req.params.id}`);
    pdfDoc.text(`Date: ${calc.created_at}`);
    pdfDoc.text(`Cheapest Provider: ${calc.cheapest_provider}`);
    pdfDoc.moveDown();

    pdfDoc.text("Provider Cost Comparison:", { underline: true });
    calc.result_json.provider_breakdowns.forEach((b: any) => {
      pdfDoc.moveDown(0.5);
      pdfDoc.fontSize(14).text(`${b.provider_name}`, { underline: true });
      pdfDoc.fontSize(10).text(`- Compute: $${b.compute_cost_monthly.toFixed(2)}`);
      pdfDoc.text(`- Storage: $${b.storage_cost_monthly.toFixed(2)}`);
      pdfDoc.text(`- Database: $${b.database_cost_monthly.toFixed(2)}`);
      pdfDoc.text(`- Networking: $${b.networking_cost_monthly.toFixed(2)}`);
      pdfDoc.fontSize(12).text(`Total: $${b.total_cost_monthly.toFixed(2)}/mo ($${b.total_cost_annual.toFixed(2)}/yr)`);
    });

    pdfDoc.end();
    await logAudit("export_pdf", "success", req.user.userId, req.ip, { calc_id: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/v1/export/calculations/:id/excel", authenticate, async (req: any, res) => {
  try {
    const d = await db.collection("calculations").doc(req.params.id).get();
    if (!d.exists) return res.status(404).json({ error: "Not found" });
    const calc = d.data() as any;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Summary");
    sheet.columns = [
      { header: "Provider", key: "provider", width: 20 },
      { header: "Compute ($)", key: "compute", width: 15 },
      { header: "Storage ($)", key: "storage", width: 15 },
      { header: "Database ($)", key: "database", width: 15 },
      { header: "Networking ($)", key: "networking", width: 15 },
      { header: "Monthly Total ($)", key: "monthly", width: 15 },
      { header: "Annual Total ($)", key: "annual", width: 15 },
      { header: "Is Cheapest", key: "cheapest", width: 15 },
    ];

    calc.result_json.provider_breakdowns.forEach((b: any) => {
      sheet.addRow({
        provider: b.provider_name,
        compute: b.compute_cost_monthly,
        storage: b.storage_cost_monthly,
        database: b.database_cost_monthly,
        networking: b.networking_cost_monthly,
        monthly: b.total_cost_monthly,
        annual: b.total_cost_annual,
        cheapest: b.is_cheapest ? "YES" : "NO"
      });
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=calcus_report_${req.params.id}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
    await logAudit("export_excel", "success", req.user.userId, req.ip, { calc_id: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Stats
app.get("/api/v1/admin/stats", authenticate, requireAdmin, async (req, res) => {
  try {
    const usersSnap = await db.collection("users").get();
    const calcsSnap = await db.collection("calculations").get();
    const logsSnap = await db.collection("audit_logs").get();
    
    res.json({
      total_users: usersSnap.size,
      total_calculations: calcsSnap.size,
      total_audit_logs: logsSnap.size,
      last_ingestion: new Date().toISOString(), // Mocked
      pricing_data_count: 100, // Mocked
      active_users_last_30_days: usersSnap.size
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/v1/admin/users", authenticate, requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("users").get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/v1/admin/audit_logs", authenticate, requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("audit_logs").orderBy("timestamp", "desc").limit(100).get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Vite Integration ---

async function startServer() {
  // Auto-seed users if empty
  if (firebaseConfig.projectId !== "remixed-project-id") {
    try {
      const usersSnap = await db.collection("users").limit(1).get();
      if (usersSnap.empty) {
        console.log("Users collection empty, seeding default users...");
        const users = [
          { email: "admin@yourcompany.com", password: "yourpassword", role: "admin" },
          { email: "user@yourcompany.com", password: "userpassword", role: "user" },
        ];
        for (const u of users) {
          const hash = await bcrypt.hash(u.password, 10);
          await db.collection("users").add({
            email: u.email,
            password_hash: hash,
            role: u.role,
            created_at: new Date().toISOString()
          });
          console.log(`User ${u.email} seeded.`);
        }
      }
    } catch (err) {
      console.error("Auto-seeding failed:", err);
    }
  } else {
    console.log("Skipping auto-seeding for remixed app without Firebase setup.");
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Initialize SQL Database
  await initSQLDatabase();

  app.listen(PORT, "0.0.0.0", () => {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const k in interfaces) {
      for (const k2 in interfaces[k]) {
        const address = interfaces[k][k2];
        if (address.family === "IPv4" && !address.internal) {
          addresses.push(address.address);
        }
      }
    }
    console.log(`\n  AWS Calcus - Pricing Intelligence Platform`);
    console.log(`  > Local:   http://localhost:${PORT}`);
    addresses.forEach(addr => {
      console.log(`  > Network: http://${addr}:${PORT}`);
    });
    console.log(`\n  Press Ctrl+C to stop the server\n`);
  });
}

startServer();

// --- Ingestion Scheduler ---
cron.schedule("0 2 * * *", async () => {
  console.log("Running daily ingestion...");
  // Implementation of ingestion logic would go here
});
