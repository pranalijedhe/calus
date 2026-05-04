import "reflect-metadata";
import "dotenv/config";
import express from "express";

// Debug: Check if env vars are loaded
console.log("------------------------------------");
console.log("DEBUG: Environment Check");
console.log("AWS_ACCESS_KEY_ID exists:", !!process.env.AWS_ACCESS_KEY_ID);
console.log("AWS_SECRET_ACCESS_KEY exists:", !!process.env.AWS_SECRET_ACCESS_KEY);
console.log("AWS_REGION:", process.env.AWS_REGION);
console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL);
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
import fs from "fs";
import os from "os";
import { QueryTypes } from "sequelize";
import { PricingClient, GetProductsCommand } from "@aws-sdk/client-pricing";
import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { RDSClient, DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import { S3Client, ListBucketsCommand, GetBucketLocationCommand } from "@aws-sdk/client-s3";
import { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand } from "@aws-sdk/client-elastic-load-balancing-v2";
import { Route53Client, ListHostedZonesCommand } from "@aws-sdk/client-route-53";
import { LambdaClient, ListFunctionsCommand } from "@aws-sdk/client-lambda";
import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { EKSClient, ListClustersCommand } from "@aws-sdk/client-eks";

import { initSQLDatabase, getSQLDatabaseHealth, sequelize } from "./database_sql.ts";

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

const AWS_REGION_LOCATION_MAP: Record<string, string> = {
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

const MOCK_COMPUTE = [
  {"id":"aws-t2-micro","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"t2.micro","vcpu":1,"memory_gb":1,"os_type":"Linux","price_per_hour":0.0116},
  {"id":"aws-t2-small","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"t2.small","vcpu":1,"memory_gb":2,"os_type":"Linux","price_per_hour":0.023},
  {"id":"aws-t2-medium","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"t2.medium","vcpu":2,"memory_gb":4,"os_type":"Linux","price_per_hour":0.0464},
  {"id":"aws-t2-large","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"t2.large","vcpu":2,"memory_gb":8,"os_type":"Linux","price_per_hour":0.0928},
  {"id":"aws-t3-micro","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"t3.micro","vcpu":2,"memory_gb":1,"os_type":"Linux","price_per_hour":0.0104},
  {"id":"aws-t3-small","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"t3.small","vcpu":2,"memory_gb":2,"os_type":"Linux","price_per_hour":0.0208},
  {"id":"aws-t3-medium","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"t3.medium","vcpu":2,"memory_gb":4,"os_type":"Linux","price_per_hour":0.0416},
  {"id":"aws-t3-large","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"t3.large","vcpu":2,"memory_gb":8,"os_type":"Linux","price_per_hour":0.0832},
  {"id":"aws-t3-xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"t3.xlarge","vcpu":4,"memory_gb":16,"os_type":"Linux","price_per_hour":0.1664},
  {"id":"aws-t4g-micro","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"t4g.micro","vcpu":2,"memory_gb":1,"os_type":"Linux","price_per_hour":0.0084},
  {"id":"aws-t4g-small","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"t4g.small","vcpu":2,"memory_gb":2,"os_type":"Linux","price_per_hour":0.0168},
  {"id":"aws-t4g-medium","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"t4g.medium","vcpu":2,"memory_gb":4,"os_type":"Linux","price_per_hour":0.0336},
  {"id":"aws-t4g-large","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"t4g.large","vcpu":2,"memory_gb":8,"os_type":"Linux","price_per_hour":0.0672},
  {"id":"aws-m4-large","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"m4.large","vcpu":2,"memory_gb":8,"os_type":"Linux","price_per_hour":0.1},
  {"id":"aws-m4-xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"m4.xlarge","vcpu":4,"memory_gb":16,"os_type":"Linux","price_per_hour":0.2},
  {"id":"aws-m5-large","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"m5.large","vcpu":2,"memory_gb":8,"os_type":"Linux","price_per_hour":0.096},
  {"id":"aws-m5-xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"m5.xlarge","vcpu":4,"memory_gb":16,"os_type":"Linux","price_per_hour":0.192},
  {"id":"aws-m5-2xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"m5.2xlarge","vcpu":8,"memory_gb":32,"os_type":"Linux","price_per_hour":0.384},
  {"id":"aws-m5-4xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"m5.4xlarge","vcpu":16,"memory_gb":64,"os_type":"Linux","price_per_hour":0.768},
  {"id":"aws-m6g-large","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"m6g.large","vcpu":2,"memory_gb":8,"os_type":"Linux","price_per_hour":0.077},
  {"id":"aws-m6g-xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"m6g.xlarge","vcpu":4,"memory_gb":16,"os_type":"Linux","price_per_hour":0.154},
  {"id":"aws-m6i-large","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"m6i.large","vcpu":2,"memory_gb":8,"os_type":"Linux","price_per_hour":0.096},
  {"id":"aws-m6i-xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"m6i.xlarge","vcpu":4,"memory_gb":16,"os_type":"Linux","price_per_hour":0.192},
  {"id":"aws-m7i-large","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"m7i.large","vcpu":2,"memory_gb":8,"os_type":"Linux","price_per_hour":0.1008},
  {"id":"aws-m7i-xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"m7i.xlarge","vcpu":4,"memory_gb":16,"os_type":"Linux","price_per_hour":0.2016},
  {"id":"aws-c4-large","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"c4.large","vcpu":2,"memory_gb":3.75,"os_type":"Linux","price_per_hour":0.1},
  {"id":"aws-c4-xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"c4.xlarge","vcpu":4,"memory_gb":7.5,"os_type":"Linux","price_per_hour":0.199},
  {"id":"aws-c5-large","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"c5.large","vcpu":2,"memory_gb":4,"os_type":"Linux","price_per_hour":0.085},
  {"id":"aws-c5-xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"c5.xlarge","vcpu":4,"memory_gb":8,"os_type":"Linux","price_per_hour":0.17},
  {"id":"aws-c5-2xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"c5.2xlarge","vcpu":8,"memory_gb":16,"os_type":"Linux","price_per_hour":0.34},
  {"id":"aws-c5-4xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"c5.4xlarge","vcpu":16,"memory_gb":32,"os_type":"Linux","price_per_hour":0.68},
  {"id":"aws-c6g-large","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"c6g.large","vcpu":2,"memory_gb":4,"os_type":"Linux","price_per_hour":0.068},
  {"id":"aws-c6g-xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"c6g.xlarge","vcpu":4,"memory_gb":8,"os_type":"Linux","price_per_hour":0.136},
  {"id":"aws-c6i-large","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"c6i.large","vcpu":2,"memory_gb":4,"os_type":"Linux","price_per_hour":0.085},
  {"id":"aws-c6i-xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"c6i.xlarge","vcpu":4,"memory_gb":8,"os_type":"Linux","price_per_hour":0.17},
  {"id":"aws-c7i-large","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"c7i.large","vcpu":2,"memory_gb":4,"os_type":"Linux","price_per_hour":0.08925},
  {"id":"aws-c7i-xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"c7i.xlarge","vcpu":4,"memory_gb":8,"os_type":"Linux","price_per_hour":0.1785},
  {"id":"aws-r4-large","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"r4.large","vcpu":2,"memory_gb":15.25,"os_type":"Linux","price_per_hour":0.133},
  {"id":"aws-r4-xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"r4.xlarge","vcpu":4,"memory_gb":30.5,"os_type":"Linux","price_per_hour":0.266},
  {"id":"aws-r5-large","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"r5.large","vcpu":2,"memory_gb":16,"os_type":"Linux","price_per_hour":0.126},
  {"id":"aws-r5-xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"r5.xlarge","vcpu":4,"memory_gb":32,"os_type":"Linux","price_per_hour":0.252},
  {"id":"aws-r5-2xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"r5.2xlarge","vcpu":8,"memory_gb":64,"os_type":"Linux","price_per_hour":0.504},
  {"id":"aws-r5-4xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"r5.4xlarge","vcpu":16,"memory_gb":128,"os_type":"Linux","price_per_hour":1.008},
  {"id":"aws-r6g-large","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"r6g.large","vcpu":2,"memory_gb":16,"os_type":"Linux","price_per_hour":0.1008},
  {"id":"aws-r6g-xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"r6g.xlarge","vcpu":4,"memory_gb":32,"os_type":"Linux","price_per_hour":0.2016},
  {"id":"aws-r6i-large","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"r6i.large","vcpu":2,"memory_gb":16,"os_type":"Linux","price_per_hour":0.126},
  {"id":"aws-r6i-xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"r6i.xlarge","vcpu":4,"memory_gb":32,"os_type":"Linux","price_per_hour":0.252},
  {"id":"aws-r7i-large","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"r7i.large","vcpu":2,"memory_gb":16,"os_type":"Linux","price_per_hour":0.1323},
  {"id":"aws-r7i-xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"r7i.xlarge","vcpu":4,"memory_gb":32,"os_type":"Linux","price_per_hour":0.2646},
  {"id":"aws-i3-large","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"i3.large","vcpu":2,"memory_gb":15.25,"os_type":"Linux","price_per_hour":0.156},
  {"id":"aws-i3-xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"i3.xlarge","vcpu":4,"memory_gb":30.5,"os_type":"Linux","price_per_hour":0.312},
  {"id":"aws-i4i-large","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"i4i.large","vcpu":2,"memory_gb":16,"os_type":"Linux","price_per_hour":0.171},
  {"id":"aws-i4i-xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"i4i.xlarge","vcpu":4,"memory_gb":32,"os_type":"Linux","price_per_hour":0.342},
  {"id":"aws-p3-2xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"p3.2xlarge","vcpu":8,"memory_gb":61,"os_type":"Linux","price_per_hour":3.06},
  {"id":"aws-p4d-24xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"p4d.24xlarge","vcpu":96,"memory_gb":1152,"os_type":"Linux","price_per_hour":32.7726},
  {"id":"aws-g4dn-xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"g4dn.xlarge","vcpu":4,"memory_gb":16,"os_type":"Linux","price_per_hour":0.526},
  {"id":"aws-g4dn-2xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"g4dn.2xlarge","vcpu":8,"memory_gb":32,"os_type":"Linux","price_per_hour":0.752},
  {"id":"aws-g5-xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"g5.xlarge","vcpu":4,"memory_gb":16,"os_type":"Linux","price_per_hour":1.006},
  {"id":"aws-g5-2xlarge","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"g5.2xlarge","vcpu":8,"memory_gb":32,"os_type":"Linux","price_per_hour":1.212},
  {"id":"aws-t3-micro-win","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"t3.micro","vcpu":2,"memory_gb":1,"os_type":"Windows","price_per_hour":0.015},
  {"id":"aws-m5-large-win","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"m5.large","vcpu":2,"memory_gb":8,"os_type":"Windows","price_per_hour":0.188},
  {"id":"aws-c5-large-win","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"c5.large","vcpu":2,"memory_gb":4,"os_type":"Windows","price_per_hour":0.177},
  {"id":"aws-r5-large-win","provider_id":"aws-mock","region_id":"aws-us-east-1","instance_type":"r5.large","vcpu":2,"memory_gb":16,"os_type":"Windows","price_per_hour":0.218},
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
  { id: "aws-data-transfer", provider_id: "aws-mock", region_id: "aws-us-east-1", service_type: "Egress", price_per_unit: 0.09, unit: "GB" }
];

type LivePricingCache = {
  compute: any[];
  storage: any[];
  database: any[];
  networking: any[];
  synced_at?: string;
  region?: string;
};

const livePricingCache: LivePricingCache = {
  compute: [],
  storage: [],
  database: [],
  networking: [],
};

async function syncAWSPricingToMemory(awsRegionOverride?: string) {
  const client = getAWSPricingClient();
  const awsRegion = awsRegionOverride || process.env.AWS_REGION || "us-east-1";
  const location = AWS_REGION_LOCATION_MAP[awsRegion] || "US East (N. Virginia)";

  const providerId = "aws-mock";
  const regionId = `aws-${awsRegion}`;
  const now = new Date().toISOString();

  const computeOut: any[] = [];
  const storageOut: any[] = [];
  const databaseOut: any[] = [];
  const networkingOut: any[] = [];

  const instanceTypes = ["t3.micro", "t3.small", "t3.medium", "m5.large", "m5.xlarge", "c5.xlarge", "r5.large"];
  const osTypes = ["Linux", "Windows"];

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
      if (priceList.length === 0) continue;

      const data = JSON.parse(priceList[0] as string);
      const attributes = data.product?.attributes;
      const terms = data.terms?.OnDemand;
      if (!attributes || !terms) continue;

      const termKey = Object.keys(terms)[0];
      const priceDimensions = terms[termKey]?.priceDimensions || {};
      const dimensionKey = Object.keys(priceDimensions)[0];
      const pricePerUnit = parseFloat(priceDimensions[dimensionKey]?.pricePerUnit?.USD);
      if (isNaN(pricePerUnit)) continue;

      computeOut.push({
        id: `live-ec2-${type}-${os.toLowerCase()}`,
        provider_id: providerId,
        region_id: regionId,
        instance_type: type,
        os_type: os,
        price_per_hour: pricePerUnit,
        price_per_month: pricePerUnit * 730,
        price_per_year: pricePerUnit * 730 * 12,
        vcpu: parseInt(attributes.vcpu || "0"),
        memory_gb: parseFloat((attributes.memory || "0 GiB").split(" ")[0]),
        updated_at: now
      });
    }
  }

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
  const ebsResp = await client.send(ebsCommand);
  if (ebsResp.PriceList && ebsResp.PriceList.length > 0) {
    const ebsData = JSON.parse(ebsResp.PriceList[0] as string);
    const ebsTerms = ebsData.terms?.OnDemand;
    if (ebsTerms) {
      const termKey = Object.keys(ebsTerms)[0];
      const dim = ebsTerms[termKey]?.priceDimensions || {};
      const dimKey = Object.keys(dim)[0];
      const pricePerGb = parseFloat(dim[dimKey]?.pricePerUnit?.USD);
      if (!isNaN(pricePerGb)) {
        storageOut.push({
          id: "live-ebs-gp3",
          provider_id: providerId,
          region_id: regionId,
          storage_type: "ebs",
          storage_name: "EBS gp3",
          price_per_gb_month: pricePerGb,
          unit_type: "GB",
          updated_at: now
        });
      }
    }
  }

  const s3Command = new GetProductsCommand({
    ServiceCode: "AmazonS3",
    Filters: [
      { Type: "TERM_MATCH", Field: "location", Value: location },
      { Type: "TERM_MATCH", Field: "storageClass", Value: "General Purpose" }
    ],
    FormatVersion: "aws_v1",
    MaxResults: 1
  });
  const s3Resp = await client.send(s3Command);
  if (s3Resp.PriceList && s3Resp.PriceList.length > 0) {
    const s3Data = JSON.parse(s3Resp.PriceList[0] as string);
    const s3Terms = s3Data.terms?.OnDemand;
    if (s3Terms) {
      const termKey = Object.keys(s3Terms)[0];
      const dim = s3Terms[termKey]?.priceDimensions || {};
      const dimKey = Object.keys(dim)[0];
      const pricePerGb = parseFloat(dim[dimKey]?.pricePerUnit?.USD);
      if (!isNaN(pricePerGb)) {
        storageOut.push({
          id: "live-s3-standard",
          provider_id: providerId,
          region_id: regionId,
          storage_type: "object",
          storage_name: "S3 Standard",
          price_per_gb_month: pricePerGb,
          unit_type: "GB",
          updated_at: now
        });
      }
    }
  }

  const rdsTypes = ["db.t3.micro", "db.t3.small", "db.t3.medium", "db.m5.large"];
  const rdsEngines = ["PostgreSQL", "MySQL"];
  for (const cls of rdsTypes) {
    for (const engine of rdsEngines) {
      const rdsCommand = new GetProductsCommand({
        ServiceCode: "AmazonRDS",
        Filters: [
          { Type: "TERM_MATCH", Field: "location", Value: location },
          { Type: "TERM_MATCH", Field: "instanceType", Value: cls },
          { Type: "TERM_MATCH", Field: "databaseEngine", Value: engine },
          { Type: "TERM_MATCH", Field: "deploymentOption", Value: "Single-AZ" }
        ],
        FormatVersion: "aws_v1",
        MaxResults: 1
      });
      const rdsPriceResp = await client.send(rdsCommand);
      const priceList = rdsPriceResp.PriceList || [];
      if (priceList.length === 0) continue;
      const d = JSON.parse(priceList[0] as string);
      const terms = d.terms?.OnDemand;
      const attrs = d.product?.attributes || {};
      if (!terms) continue;
      const termKey = Object.keys(terms)[0];
      const dim = terms[termKey]?.priceDimensions || {};
      const dimKey = Object.keys(dim)[0];
      const pricePerHour = parseFloat(dim[dimKey]?.pricePerUnit?.USD);
      if (isNaN(pricePerHour)) continue;
      databaseOut.push({
        id: `live-rds-${cls}-${engine.toLowerCase()}`,
        provider_id: providerId,
        region_id: regionId,
        db_engine: engine,
        instance_class: cls,
        price_per_hour: pricePerHour,
        vcpu: parseInt(attrs.vcpu || "0"),
        memory_gb: parseFloat((attrs.memory || "0 GiB").split(" ")[0]),
        updated_at: now
      });
    }
  }

  const route53Command = new GetProductsCommand({
    ServiceCode: "AmazonRoute53",
    Filters: [{ Type: "TERM_MATCH", Field: "group", Value: "DNS-Queries" }],
    FormatVersion: "aws_v1",
    MaxResults: 1
  });
  const route53Resp = await client.send(route53Command);
  if (route53Resp.PriceList && route53Resp.PriceList.length > 0) {
    const d = JSON.parse(route53Resp.PriceList[0] as string);
    const terms = d.terms?.OnDemand;
    if (terms) {
      const termKey = Object.keys(terms)[0];
      const dim = terms[termKey]?.priceDimensions || {};
      const dimKey = Object.keys(dim)[0];
      const price = parseFloat(dim[dimKey]?.pricePerUnit?.USD);
      if (!isNaN(price)) {
        networkingOut.push({
          id: "live-route53-dns-queries",
          provider_id: providerId,
          region_id: regionId,
          service_type: "route53",
          price_per_unit: price,
          unit: "query",
          updated_at: now
        });
      }
    }
  }

  const albCommand = new GetProductsCommand({
    ServiceCode: "AmazonEC2",
    Filters: [
      { Type: "TERM_MATCH", Field: "location", Value: location },
      { Type: "TERM_MATCH", Field: "productFamily", Value: "Load Balancer" },
      { Type: "TERM_MATCH", Field: "groupDescription", Value: "Hourly charge for Application Load Balancer" }
    ],
    FormatVersion: "aws_v1",
    MaxResults: 1
  });
  const albResp = await client.send(albCommand);
  if (albResp.PriceList && albResp.PriceList.length > 0) {
    const d = JSON.parse(albResp.PriceList[0] as string);
    const terms = d.terms?.OnDemand;
    if (terms) {
      const termKey = Object.keys(terms)[0];
      const dim = terms[termKey]?.priceDimensions || {};
      const dimKey = Object.keys(dim)[0];
      const price = parseFloat(dim[dimKey]?.pricePerUnit?.USD);
      if (!isNaN(price)) {
        networkingOut.push({
          id: "live-alb-hourly",
          provider_id: providerId,
          region_id: regionId,
          service_type: "elb",
          price_per_unit: price,
          unit: "hour",
          updated_at: now
        });
      }
    }
  }

  livePricingCache.compute = computeOut;
  livePricingCache.storage = storageOut;
  livePricingCache.database = databaseOut;
  livePricingCache.networking = networkingOut;
  livePricingCache.synced_at = now;
  livePricingCache.region = awsRegion;

  return {
    region: awsRegion,
    synced_at: now,
    counts: {
      compute: computeOut.length,
      storage: storageOut.length,
      database: databaseOut.length,
      networking: networkingOut.length
    }
  };
}

function parseAwsRegionFromRegionId(regionId: unknown): string | null {
  if (typeof regionId !== "string") return null;
  if (!regionId.startsWith("aws-")) return null;
  return regionId.slice(4);
}

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

const useSqlPersistence = !!sequelize;
const isRemixedMode = firebaseConfig.projectId === "remixed-project-id" && !useSqlPersistence;
const inMemoryUsers: Array<{ id: string; email: string; password_hash: string; role: string; created_at: string }> = [];
const inMemoryCalculations: any[] = [];

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function asJson(value: any) {
  return JSON.stringify(value ?? {});
}

function parseJson<T = any>(value: any, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "object") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function sqlSelect(table: string, where: Record<string, any> = {}, options?: { orderBy?: string; orderDir?: "ASC" | "DESC"; limit?: number }) {
  if (!sequelize) return [];
  const allowedColumns = await getTableColumns(table);
  const replacements: Record<string, any> = {};
  const clauses: string[] = [];
  for (const [k, v] of Object.entries(where)) {
    if (v === undefined || v === null) continue;
    if (!allowedColumns.has(k)) continue;
    replacements[k] = v;
    clauses.push(`${k} = :${k}`);
  }
  const whereSql = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const orderSql = options?.orderBy && allowedColumns.has(options.orderBy) ? ` ORDER BY ${options.orderBy} ${options.orderDir || "ASC"}` : "";
  const limitSql = typeof options?.limit === "number" ? ` LIMIT ${options.limit}` : "";
  return sequelize.query(`SELECT * FROM ${table}${whereSql}${orderSql}${limitSql}`, {
    replacements,
    type: QueryTypes.SELECT,
  });
}

const tableColumnsCache = new Map<string, Set<string>>();

async function getTableColumns(table: string): Promise<Set<string>> {
  if (!sequelize) return new Set();
  const cached = tableColumnsCache.get(table);
  if (cached) return cached;

  let rows: any[] = [];
  try {
    rows = await sequelize.query(`SHOW COLUMNS FROM ${table}`, { type: QueryTypes.SELECT }) as any[];
  } catch {
    rows = await sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = :table`,
      { replacements: { table }, type: QueryTypes.SELECT }
    ) as any[];
  }

  const cols = new Set(
    rows
      .map((r: any) => r.Field ?? r.column_name ?? r.name)
      .filter((v: any) => typeof v === "string")
  );
  tableColumnsCache.set(table, cols);
  return cols;
}

async function sqlInsert(table: string, row: Record<string, any>) {
  if (!sequelize) return;
  const allowedColumns = await getTableColumns(table);
  const entries = Object.entries(row).filter(([k, v]) => v !== undefined && allowedColumns.has(k));
  if (entries.length === 0) return;
  const keys = entries.map(([k]) => k);
  const cols = keys.join(", ");
  const vals = keys.map((k) => `:${k}`).join(", ");
  const replacements = Object.fromEntries(entries);
  await sequelize.query(`INSERT INTO ${table} (${cols}) VALUES (${vals})`, {
    replacements,
    type: QueryTypes.INSERT,
  });
}

async function sqlUpdate(table: string, values: Record<string, any>, where: Record<string, any>) {
  if (!sequelize) return;
  const allowedColumns = await getTableColumns(table);
  const setEntries = Object.entries(values).filter(([k, v]) => v !== undefined && allowedColumns.has(k));
  const whereEntries = Object.entries(where).filter(([k, v]) => v !== undefined && allowedColumns.has(k));
  const replacements: Record<string, any> = {};
  const setSql = setEntries.map(([k], i) => {
    const key = `set_${k}_${i}`;
    replacements[key] = values[k];
    return `${k} = :${key}`;
  }).join(", ");
  const whereSql = whereEntries.map(([k], i) => {
    const key = `where_${k}_${i}`;
    replacements[key] = where[k];
    return `${k} = :${key}`;
  }).join(" AND ");
  if (!setSql || !whereSql) return;
  await sequelize.query(`UPDATE ${table} SET ${setSql} WHERE ${whereSql}`, {
    replacements,
    type: QueryTypes.UPDATE,
  });
}

async function sqlDelete(table: string, where: Record<string, any>) {
  if (!sequelize) return;
  const allowedColumns = await getTableColumns(table);
  const replacements: Record<string, any> = {};
  const whereEntries = Object.entries(where).filter(([k, v]) => v !== undefined && allowedColumns.has(k));
  const whereSql = whereEntries.map(([k], i) => {
    const key = `where_${k}_${i}`;
    replacements[key] = where[k];
    return `${k} = :${key}`;
  }).join(" AND ");
  if (!whereSql) return;
  await sequelize.query(`DELETE FROM ${table} WHERE ${whereSql}`, {
    replacements,
    type: QueryTypes.DELETE,
  });
}

async function sqlCount(table: string) {
  if (!sequelize) return 0;
  const rows = await sequelize.query(`SELECT COUNT(*) as count FROM ${table}`, {
    type: QueryTypes.SELECT,
  }) as any[];
  return Number(rows[0]?.count || 0);
}

async function sqlGetById(table: string, id: string) {
  const rows: any[] = await sqlSelect(table, { id }, { limit: 1 });
  return rows[0] || null;
}

async function ensureSqlSchema() {
  if (!sequelize) return;
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(128) PRIMARY KEY,
      email VARCHAR(320) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(32) NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS providers (
      id VARCHAR(128) PRIMARY KEY,
      name VARCHAR(128) NOT NULL
    )
  `);
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS regions (
      id VARCHAR(128) PRIMARY KEY,
      provider_id VARCHAR(128) NOT NULL,
      region_name VARCHAR(128) NOT NULL,
      region_code VARCHAR(64) NOT NULL,
      availability_zones TEXT NOT NULL
    )
  `);
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS compute_pricing (
      id VARCHAR(128) PRIMARY KEY,
      provider_id VARCHAR(128) NOT NULL,
      region_id VARCHAR(128) NOT NULL,
      instance_type VARCHAR(128) NOT NULL,
      vcpu DOUBLE PRECISION,
      memory_gb DOUBLE PRECISION,
      os_type VARCHAR(64),
      price_per_hour DOUBLE PRECISION,
      price_per_month DOUBLE PRECISION,
      price_per_year DOUBLE PRECISION,
      updated_at TEXT
    )
  `);
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS storage_pricing (
      id VARCHAR(128) PRIMARY KEY,
      provider_id VARCHAR(128) NOT NULL,
      region_id VARCHAR(128) NOT NULL,
      storage_type VARCHAR(128) NOT NULL,
      storage_name VARCHAR(128) NOT NULL,
      price_per_gb_month DOUBLE PRECISION,
      unit_type VARCHAR(32),
      updated_at TEXT
    )
  `);
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS database_pricing (
      id VARCHAR(128) PRIMARY KEY,
      provider_id VARCHAR(128) NOT NULL,
      region_id VARCHAR(128) NOT NULL,
      db_engine VARCHAR(128) NOT NULL,
      instance_class VARCHAR(128) NOT NULL,
      vcpu DOUBLE PRECISION,
      memory_gb DOUBLE PRECISION,
      price_per_hour DOUBLE PRECISION,
      updated_at TEXT
    )
  `);
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS networking_pricing (
      id VARCHAR(128) PRIMARY KEY,
      provider_id VARCHAR(128) NOT NULL,
      region_id VARCHAR(128) NOT NULL,
      service_type VARCHAR(128) NOT NULL,
      price_per_unit DOUBLE PRECISION,
      unit VARCHAR(32),
      updated_at TEXT
    )
  `);
  await sequelize.query(`ALTER TABLE networking_pricing ADD COLUMN IF NOT EXISTS service_name VARCHAR(255)`);
  await sequelize.query(`ALTER TABLE networking_pricing ADD COLUMN IF NOT EXISTS unit_type VARCHAR(32)`);
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS calculations (
      id VARCHAR(128) PRIMARY KEY,
      user_id VARCHAR(128) NOT NULL,
      input_json TEXT NOT NULL,
      result_json TEXT NOT NULL,
      cheapest_provider VARCHAR(128),
      aws_total_monthly DOUBLE PRECISION,
      azure_total_monthly DOUBLE PRECISION,
      gcp_total_monthly DOUBLE PRECISION,
      duration_months INTEGER,
      pricing_model VARCHAR(32),
      created_at TEXT NOT NULL
    )
  `);
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(128) PRIMARY KEY,
      user_id VARCHAR(128),
      action VARCHAR(128) NOT NULL,
      status VARCHAR(32) NOT NULL,
      input_data TEXT,
      error_message TEXT,
      ip_address VARCHAR(128),
      timestamp TEXT NOT NULL
    )
  `);
}

async function seedSqlReferenceData() {
  if (!sequelize) return;
  if (await sqlCount("providers") === 0) {
    for (const p of MOCK_PROVIDERS) await sqlInsert("providers", p as any);
  }
  if (await sqlCount("regions") === 0) {
    for (const r of MOCK_REGIONS) await sqlInsert("regions", { ...r, availability_zones: asJson((r as any).availability_zones || []) } as any);
  }
  if (await sqlCount("compute_pricing") === 0) {
    for (const row of MOCK_COMPUTE) await sqlInsert("compute_pricing", row as any);
  }
  if (await sqlCount("storage_pricing") === 0) {
    for (const row of MOCK_STORAGE) await sqlInsert("storage_pricing", row as any);
  }
  if (await sqlCount("database_pricing") === 0) {
    for (const row of MOCK_DATABASE) await sqlInsert("database_pricing", row as any);
  }
  if (await sqlCount("networking_pricing") === 0) {
    for (const row of MOCK_NETWORKING) {
      await sqlInsert("networking_pricing", {
        id: (row as any).id,
        provider_id: (row as any).provider_id,
        region_id: (row as any).region_id,
        service_type: (row as any).service_type,
        price_per_unit: (row as any).price_per_unit,
        unit: (row as any).unit ?? (row as any).unit_type ?? "unit",
        updated_at: new Date().toISOString(),
      } as any);
    }
  }
}

// --- AWS SDK Clients (Lazy Initialization) ---
let pricingClient: PricingClient | null = null;
let ec2Client: EC2Client | null = null;
let rdsClient: RDSClient | null = null;
let s3Client: S3Client | null = null;
let elbClient: ElasticLoadBalancingV2Client | null = null;
let route53Client: Route53Client | null = null;
let lambdaClient: LambdaClient | null = null;
let dynamoClient: DynamoDBClient | null = null;
let eksClient: EKSClient | null = null;

function getAWSCredentialsConfig() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || "us-east-1";

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required. Please set them in environment variables.");
  }

  return {
    region,
    credentials: { accessKeyId, secretAccessKey }
  };
}

function getAWSPricingClient() {
  if (!pricingClient) {
    const cfg = getAWSCredentialsConfig();

    pricingClient = new PricingClient({
      region: "us-east-1", // Pricing API is only available in us-east-1 or ap-south-1
      credentials: cfg.credentials
    });
  }
  return pricingClient;
}

function getAWSEC2Client() {
  if (!ec2Client) {
    const cfg = getAWSCredentialsConfig();

    ec2Client = new EC2Client({
      region: cfg.region,
      credentials: cfg.credentials
    });
  }
  return ec2Client;
}

function getAWSRDSClient() {
  if (!rdsClient) {
    const cfg = getAWSCredentialsConfig();
    rdsClient = new RDSClient({ region: cfg.region, credentials: cfg.credentials });
  }
  return rdsClient;
}

function getAWSS3Client() {
  if (!s3Client) {
    const cfg = getAWSCredentialsConfig();
    s3Client = new S3Client({ region: cfg.region, credentials: cfg.credentials });
  }
  return s3Client;
}

function getAWSELBClient() {
  if (!elbClient) {
    const cfg = getAWSCredentialsConfig();
    elbClient = new ElasticLoadBalancingV2Client({ region: cfg.region, credentials: cfg.credentials });
  }
  return elbClient;
}

function getAWSRoute53Client() {
  if (!route53Client) {
    const cfg = getAWSCredentialsConfig();
    route53Client = new Route53Client({ region: cfg.region, credentials: cfg.credentials });
  }
  return route53Client;
}

function getAWSLambdaClient() {
  if (!lambdaClient) {
    const cfg = getAWSCredentialsConfig();
    lambdaClient = new LambdaClient({ region: cfg.region, credentials: cfg.credentials });
  }
  return lambdaClient;
}

function getAWSDynamoClient() {
  if (!dynamoClient) {
    const cfg = getAWSCredentialsConfig();
    dynamoClient = new DynamoDBClient({ region: cfg.region, credentials: cfg.credentials });
  }
  return dynamoClient;
}

function getAWSEKSClient() {
  if (!eksClient) {
    const cfg = getAWSCredentialsConfig();
    eksClient = new EKSClient({ region: cfg.region, credentials: cfg.credentials });
  }
  return eksClient;
}

async function getAWSHealth() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || "us-east-1";

  if (!accessKeyId || !secretAccessKey) {
    return { status: "disabled" as const, message: "AWS credentials are not configured." };
  }

  try {
    const client = getAWSEC2Client();
    await client.send(new DescribeInstancesCommand({ MaxResults: 5 }));
    return { status: "ok" as const, message: `AWS API reachable (${region}).` };
  } catch (error) {
    return {
      status: "error" as const,
      message: error instanceof Error ? error.message : String(error),
    };
  }
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
    if (useSqlPersistence) {
      await sqlInsert("audit_logs", {
        id: newId("audit"),
        user_id: userId || null,
        action,
        status,
        input_data: asJson(inputData || null),
        error_message: errorMessage || null,
        ip_address: ip || null,
        timestamp: new Date().toISOString(),
      });
      return;
    }
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

app.get("/api/healthz", async (req, res) => {
  const [sql, aws] = await Promise.all([getSQLDatabaseHealth(), getAWSHealth()]);
  const overallStatus = sql.status === "ok" && aws.status === "ok"
    ? "ok"
    : (sql.status === "error" || aws.status === "error")
    ? "degraded"
    : "partial";

  res.status(overallStatus === "ok" ? 200 : 503).json({
    status: overallStatus,
    checks: { sql, aws },
    region: process.env.AWS_REGION || "us-east-1",
    timestamp: new Date().toISOString()
  });
});

// Auth
app.post("/api/v1/auth/login", async (req, res) => {
  const { email, password } = req.body;
  
  // Hardcoded admin fallback for testing/remixed apps without DB
  if (!useSqlPersistence && ((email === "admin@yourcompany.com" && password === "yourpassword") || 
      (email === "admin@jadeglobal.com" && password === "admin123"))) {
    const token = jwt.sign({ userId: "admin-123", email, role: "admin" }, JWT_SECRET || "fallback-secret", { expiresIn: "24h" });
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    return res.json({ user_id: "admin-123", email, role: "admin", token, expires_at: expiresAt });
  }

  if (isRemixedMode) {
    const matched = inMemoryUsers.find(u => u.email.toLowerCase() === String(email || "").toLowerCase());
    if (!matched) {
      return res.status(401).json({ error: "User not found" });
    }
    const isValid = await bcrypt.compare(password, matched.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid password" });
    }
    const token = jwt.sign({ userId: matched.id, email: matched.email, role: matched.role }, JWT_SECRET, { expiresIn: "24h" });
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    return res.json({ user_id: matched.id, email: matched.email, role: matched.role, token, expires_at: expiresAt });
  }

  try {
    if (useSqlPersistence) {
      const rows: any[] = await sqlSelect("users", { email }, { limit: 1 });
      if (rows.length === 0) {
        await logAudit("login_failed", "failed", undefined, req.ip, { email }, "User not found");
        return res.status(401).json({ error: "User not found" });
      }
      const matched = rows[0];
      const isValid = await bcrypt.compare(password, matched.password_hash);
      if (!isValid) {
        await logAudit("login_failed", "failed", undefined, req.ip, { email }, "Invalid password");
        return res.status(401).json({ error: "Invalid password" });
      }
      const token = jwt.sign({ userId: matched.id, email: matched.email, role: matched.role }, JWT_SECRET, { expiresIn: "24h" });
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await logAudit("login", "success", matched.id, req.ip);
      return res.json({ user_id: matched.id, email: matched.email, role: matched.role, token, expires_at: expiresAt });
    }

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
    if (useSqlPersistence) {
      const existing: any[] = await sqlSelect("users", { email }, { limit: 1 });
      if (existing.length > 0) {
        return res.status(409).json({ error: "User already exists" });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const createdAt = new Date().toISOString();
      await sqlInsert("users", {
        email,
        password_hash: passwordHash,
        role: role || "user",
        created_at: createdAt,
      });
      const createdRows: any[] = await sqlSelect("users", { email }, { limit: 1 });
      const createdId = createdRows[0]?.id;
      await logAudit("register", "success", (req as any).user.userId, req.ip, { email, role });
      return res.status(201).json({ user_id: createdId, email, role: role || "user" });
    }

    if (isRemixedMode) {
      const existing = inMemoryUsers.find(u => u.email.toLowerCase() === String(email || "").toLowerCase());
      if (existing) {
        return res.status(409).json({ error: "User already exists" });
      }
      const userId = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const passwordHash = await bcrypt.hash(password, 10);
      const created = {
        id: userId,
        email,
        password_hash: passwordHash,
        role: role || "user",
        created_at: new Date().toISOString()
      };
      inMemoryUsers.push(created);
      await logAudit("register_memory", "success", (req as any).user.userId, req.ip, { email, role });
      return res.status(201).json({ user_id: created.id, email: created.email, role: created.role });
    }

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
    if (useSqlPersistence) {
      const rows: any[] = await sqlSelect("users", { id: req.user.userId }, { limit: 1 });
      if (rows.length === 0) return res.status(404).json({ error: "User not found" });
      const u = rows[0];
      return res.json({ id: u.id, email: u.email, role: u.role, created_at: u.created_at });
    }

    if (isRemixedMode) {
      if (req.user.userId === "admin-123") {
        return res.json({ id: "admin-123", email: req.user.email, role: "admin" });
      }
      const u = inMemoryUsers.find(x => x.id === req.user.userId);
      if (!u) return res.status(404).json({ error: "User not found" });
      return res.json({ id: u.id, email: u.email, role: u.role, created_at: u.created_at });
    }

    const userDoc = await db.collection("users").doc(req.user.userId).get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });
    res.json({ id: userDoc.id, ...userDoc.data() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Providers & Regions
app.get("/api/v1/providers", authenticate, async (req, res) => {
  if (useSqlPersistence) {
    try {
      const rows = await sqlSelect("providers");
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
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
  if (useSqlPersistence) {
    try {
      const rows: any[] = await sqlSelect("regions", { provider_id: req.params.provider_id });
      return res.json(rows.map((r) => ({ ...r, availability_zones: parseJson(r.availability_zones, []) })));
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
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
  if (useSqlPersistence) {
    try {
      const rows = await sqlSelect("compute_pricing", { provider_id, region_id, os_type });
      if ((rows as any[]).length > 0 || !region_id) {
        return res.json(rows);
      }

      const providerScoped = await sqlSelect("compute_pricing", { provider_id, os_type });
      if ((providerScoped as any[]).length > 0) {
        return res.json((providerScoped as any[]).map((r: any) => ({ ...r, region_id })));
      }

      if (provider_id === "aws-mock") {
        let fallback = MOCK_COMPUTE.filter((d: any) => d.provider_id === provider_id);
        if (os_type) fallback = fallback.filter((d: any) => d.os_type === os_type);
        const exact = fallback.filter((d: any) => d.region_id === region_id);
        if (exact.length > 0) return res.json(exact);
        return res.json(fallback.map((d: any) => ({ ...d, region_id })));
      }

      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  if (firebaseConfig.projectId === "remixed-project-id") {
    const requestedAwsRegion = parseAwsRegionFromRegionId(region_id);
    if (provider_id === "aws-mock" && requestedAwsRegion && livePricingCache.region !== requestedAwsRegion) {
      try {
        await syncAWSPricingToMemory(requestedAwsRegion);
      } catch (err) {
        console.warn("Auto-sync failed for compute pricing region:", requestedAwsRegion, err);
      }
    }

    const applyFilters = (rows: any[], options?: { ignoreRegion?: boolean }) => {
      let out = rows;
      if (provider_id) out = out.filter(d => d.provider_id === provider_id);
      if (region_id && !options?.ignoreRegion) out = out.filter(d => d.region_id === region_id);
      if (os_type) out = out.filter(d => d.os_type === os_type);
      return out;
    };

    const hasLiveAWS = provider_id === "aws-mock" && livePricingCache.compute.length > 0;
    const liveFiltered = hasLiveAWS ? applyFilters(livePricingCache.compute) : [];
    if (hasLiveAWS && liveFiltered.length > 0) {
      const mockForMerge = applyFilters(MOCK_COMPUTE);
      const liveKeys = new Set(liveFiltered.map((r: any) => `${r.instance_type}|${String(r.os_type || "").toLowerCase()}`));
      const mockExtras = mockForMerge.filter((r: any) => !liveKeys.has(`${r.instance_type}|${String(r.os_type || "").toLowerCase()}`));
      return res.json([...liveFiltered, ...mockExtras]);
    }
    const mockFiltered = applyFilters(MOCK_COMPUTE);
    if (mockFiltered.length > 0) return res.json(mockFiltered);

    // Fallback for regions where local mock rows do not exist: reuse provider-level rows
    // and stamp requested region_id so UI lists don't become empty.
    if (provider_id === "aws-mock" && region_id) {
      const mockWithoutRegion = applyFilters(MOCK_COMPUTE, { ignoreRegion: true }).map((row: any) => ({
        ...row,
        region_id
      }));
      if (mockWithoutRegion.length > 0) return res.json(mockWithoutRegion);
    }

    return res.json(mockFiltered);
  }
  try {
    let query: any = db.collection("compute_pricing");
    if (provider_id) query = query.where("provider_id", "==", provider_id);
    if (region_id) query = query.where("region_id", "==", region_id);
    if (os_type) query = query.where("os_type", "==", os_type);
    
    const snapshot = await query.get();
    const rows = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    if (rows.length > 0) return res.json(rows);

    // Safety fallback: if no persisted rows are available, serve static AWS mock rows.
    if (provider_id === "aws-mock") {
      let fallback = MOCK_COMPUTE.filter((d: any) => d.provider_id === provider_id);
      if (os_type) fallback = fallback.filter((d: any) => d.os_type === os_type);
      if (region_id) {
        const exact = fallback.filter((d: any) => d.region_id === region_id);
        if (exact.length > 0) return res.json(exact);
        fallback = fallback.map((d: any) => ({ ...d, region_id }));
      }
      return res.json(fallback);
    }

    return res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/v1/pricing/storage", authenticate, async (req, res) => {
  const { provider_id, region_id, storage_type } = req.query;
  if (useSqlPersistence) {
    try {
      const rows = await sqlSelect("storage_pricing", { provider_id, region_id, storage_type });
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  if (firebaseConfig.projectId === "remixed-project-id") {
    const requestedAwsRegion = parseAwsRegionFromRegionId(region_id);
    if (provider_id === "aws-mock" && requestedAwsRegion && livePricingCache.region !== requestedAwsRegion) {
      try {
        await syncAWSPricingToMemory(requestedAwsRegion);
      } catch (err) {
        console.warn("Auto-sync failed for storage pricing region:", requestedAwsRegion, err);
      }
    }

    const applyFilters = (rows: any[]) => {
      let out = rows;
      if (provider_id) out = out.filter(d => d.provider_id === provider_id);
      if (region_id) out = out.filter(d => d.region_id === region_id);
      if (storage_type) out = out.filter(d => d.storage_type === storage_type);
      return out;
    };

    const hasLiveAWS = provider_id === "aws-mock" && livePricingCache.storage.length > 0;
    const liveFiltered = hasLiveAWS ? applyFilters(livePricingCache.storage) : [];
    if (hasLiveAWS && liveFiltered.length > 0) return res.json(liveFiltered);
    return res.json(applyFilters(MOCK_STORAGE));
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
  if (useSqlPersistence) {
    try {
      const rows = await sqlSelect("database_pricing", { provider_id, region_id, db_engine });
      if ((rows as any[]).length > 0 || !region_id) {
        return res.json(rows);
      }

      const providerScoped = await sqlSelect("database_pricing", { provider_id, db_engine });
      if ((providerScoped as any[]).length > 0) {
        return res.json((providerScoped as any[]).map((r: any) => ({ ...r, region_id })));
      }

      if (provider_id === "aws-mock") {
        let fallback = MOCK_DATABASE.filter((d: any) => d.provider_id === provider_id);
        if (db_engine) fallback = fallback.filter((d: any) => d.db_engine === db_engine);
        const exact = fallback.filter((d: any) => d.region_id === region_id);
        if (exact.length > 0) return res.json(exact);
        return res.json(fallback.map((d: any) => ({ ...d, region_id })));
      }

      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  if (firebaseConfig.projectId === "remixed-project-id") {
    const requestedAwsRegion = parseAwsRegionFromRegionId(region_id);
    if (provider_id === "aws-mock" && requestedAwsRegion && livePricingCache.region !== requestedAwsRegion) {
      try {
        await syncAWSPricingToMemory(requestedAwsRegion);
      } catch (err) {
        console.warn("Auto-sync failed for database pricing region:", requestedAwsRegion, err);
      }
    }

    const applyFilters = (rows: any[], options?: { ignoreRegion?: boolean }) => {
      let out = rows;
      if (provider_id) out = out.filter(d => d.provider_id === provider_id);
      if (region_id && !options?.ignoreRegion) out = out.filter(d => d.region_id === region_id);
      if (db_engine) out = out.filter(d => d.db_engine === db_engine);
      return out;
    };

    const hasLiveAWS = provider_id === "aws-mock" && livePricingCache.database.length > 0;
    const liveFiltered = hasLiveAWS ? applyFilters(livePricingCache.database) : [];
    if (hasLiveAWS && liveFiltered.length > 0) {
      const mockForMerge = applyFilters(MOCK_DATABASE);
      const liveKeys = new Set(liveFiltered.map((r: any) => `${r.instance_class}|${String(r.db_engine || "").toLowerCase()}`));
      const mockExtras = mockForMerge.filter((r: any) => !liveKeys.has(`${r.instance_class}|${String(r.db_engine || "").toLowerCase()}`));
      return res.json([...liveFiltered, ...mockExtras]);
    }
    const mockFiltered = applyFilters(MOCK_DATABASE);
    if (mockFiltered.length > 0) return res.json(mockFiltered);

    // Fallback for regions where local mock rows do not exist: reuse provider-level rows
    // and stamp requested region_id so UI lists don't become empty.
    if (provider_id === "aws-mock" && region_id) {
      const mockWithoutRegion = applyFilters(MOCK_DATABASE, { ignoreRegion: true }).map((row: any) => ({
        ...row,
        region_id
      }));
      if (mockWithoutRegion.length > 0) return res.json(mockWithoutRegion);
    }

    return res.json(mockFiltered);
  }
  try {
    let query: any = db.collection("database_pricing");
    if (provider_id) query = query.where("provider_id", "==", provider_id);
    if (region_id) query = query.where("region_id", "==", region_id);
    if (db_engine) query = query.where("db_engine", "==", db_engine);
    
    const snapshot = await query.get();
    const rows = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    if (rows.length > 0) return res.json(rows);

    // Safety fallback: if no persisted rows are available, serve static AWS mock rows.
    if (provider_id === "aws-mock") {
      let fallback = MOCK_DATABASE.filter((d: any) => d.provider_id === provider_id);
      if (db_engine) fallback = fallback.filter((d: any) => d.db_engine === db_engine);
      if (region_id) {
        const exact = fallback.filter((d: any) => d.region_id === region_id);
        if (exact.length > 0) return res.json(exact);
        fallback = fallback.map((d: any) => ({ ...d, region_id }));
      }
      return res.json(fallback);
    }

    return res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/v1/pricing/networking", authenticate, async (req, res) => {
  const { provider_id, region_id, service_type } = req.query;
  if (useSqlPersistence) {
    try {
      const rows = await sqlSelect("networking_pricing", { provider_id, region_id, service_type });
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  if (firebaseConfig.projectId === "remixed-project-id") {
    const requestedAwsRegion = parseAwsRegionFromRegionId(region_id);
    if (provider_id === "aws-mock" && requestedAwsRegion && livePricingCache.region !== requestedAwsRegion) {
      try {
        await syncAWSPricingToMemory(requestedAwsRegion);
      } catch (err) {
        console.warn("Auto-sync failed for networking pricing region:", requestedAwsRegion, err);
      }
    }

    const applyFilters = (rows: any[]) => {
      let out = rows;
      if (provider_id) out = out.filter(d => d.provider_id === provider_id);
      if (region_id) out = out.filter(d => d.region_id === region_id);
      if (service_type) out = out.filter(d => d.service_type === service_type);
      return out;
    };

    const hasLiveAWS = provider_id === "aws-mock" && livePricingCache.networking.length > 0;
    const liveFiltered = hasLiveAWS ? applyFilters(livePricingCache.networking) : [];
    if (hasLiveAWS && liveFiltered.length > 0) return res.json(liveFiltered);
    return res.json(applyFilters(MOCK_NETWORKING));
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
  const requestedRegion = typeof req.body?.region === "string" && req.body.region.trim().length > 0
    ? req.body.region.trim()
    : (process.env.AWS_REGION || "us-east-1");

  if (useSqlPersistence) {
    try {
      const client = getAWSPricingClient();
      const location = AWS_REGION_LOCATION_MAP[requestedRegion] || "US East (N. Virginia)";
      const instanceTypes = ["t3.medium", "m5.large", "c5.xlarge", "r5.large", "t3.xlarge", "m5.xlarge", "t3.micro", "t3.small"];
      const osTypes = ["Linux", "Windows"];
      const savedInstances: string[] = [];
      const providerRows: any[] = await sqlSelect("providers", { name: "AWS" }, { limit: 1 });
      const providerId = providerRows[0]?.id;
      const regionRows: any[] = providerId
        ? await sqlSelect("regions", { provider_id: providerId, region_code: requestedRegion }, { limit: 1 })
        : [];
      const regionId = regionRows[0]?.id;
      if (!providerId || !regionId) {
        return res.status(400).json({ error: `AWS provider/region not found for region ${requestedRegion}.` });
      }

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
          if (priceList.length === 0) continue;
          const data = JSON.parse(priceList[0] as string);
          const attributes = data.product?.attributes;
          const terms = data.terms?.OnDemand;
          if (!attributes || !terms) continue;
          const termKey = Object.keys(terms)[0];
          const priceDimensions = terms[termKey]?.priceDimensions;
          const dimensionKey = Object.keys(priceDimensions)[0];
          const pricePerUnit = parseFloat(priceDimensions[dimensionKey]?.pricePerUnit?.USD);
          if (Number.isNaN(pricePerUnit)) continue;

          const instanceType = attributes.instanceType;
          const vcpu = parseInt(attributes.vcpu);
          const memory = parseFloat(attributes.memory.split(" ")[0]);
          const existing: any[] = await sqlSelect("compute_pricing", { provider_id: providerId, region_id: regionId, instance_type: instanceType, os_type: os }, { limit: 1 });
          const row = {
            provider_id: providerId,
            region_id: regionId,
            instance_type: instanceType,
            os_type: os,
            price_per_hour: pricePerUnit,
            price_per_month: pricePerUnit * 730,
            price_per_year: pricePerUnit * 730 * 12,
            vcpu,
            memory_gb: memory,
            updated_at: new Date().toISOString()
          };
          if (existing.length === 0) {
            await sqlInsert("compute_pricing", { id: newId("cmp"), ...row });
          } else {
            await sqlUpdate("compute_pricing", row, { id: existing[0].id });
          }
          savedInstances.push(`${instanceType} (${os})`);
        }
      }

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
        if (!Number.isNaN(pricePerGb)) {
          const row = {
            provider_id: providerId,
            region_id: regionId,
            storage_type: "ebs",
            storage_name: "EBS gp3",
            price_per_gb_month: pricePerGb,
            unit_type: "GB",
            updated_at: new Date().toISOString()
          };
          const existing: any[] = await sqlSelect("storage_pricing", { provider_id: providerId, region_id: regionId, storage_name: "EBS gp3" }, { limit: 1 });
          if (existing.length === 0) {
            await sqlInsert("storage_pricing", { id: newId("stg"), ...row });
          } else {
            await sqlUpdate("storage_pricing", row, { id: existing[0].id });
          }
        }
      }

      await logAudit("aws_pricing_sync_sql", "success", (req as any).user.userId, req.ip, {
        region: requestedRegion,
        count: savedInstances.length
      });
      return res.json({
        message: `Successfully synced ${savedInstances.length} AWS instances`,
        region: requestedRegion,
        count: savedInstances.length,
        instances: savedInstances
      });
    } catch (err: any) {
      console.error("AWS SQL Sync Error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (firebaseConfig.projectId === "remixed-project-id") {
    try {
      const syncResult = await syncAWSPricingToMemory(requestedRegion);
      await logAudit("aws_pricing_sync_memory", "success", (req as any).user.userId, req.ip, syncResult);
      return res.json({
        message: "Successfully synced AWS pricing into live in-memory cache",
        ...syncResult
      });
    } catch (err: any) {
      console.error("AWS in-memory sync error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  try {
    const client = getAWSPricingClient();
    const location = AWS_REGION_LOCATION_MAP[requestedRegion] || "US East (N. Virginia)";

    // Fetch common instance types for both Linux and Windows
    const instanceTypes = ["t3.medium", "m5.large", "c5.xlarge", "r5.large", "t3.xlarge", "m5.xlarge", "t3.micro", "t3.small"];
    const osTypes = ["Linux", "Windows"];
    const savedInstances = [];
    let sampleData = null;
    const providerSnap = await db.collection("providers").where("name", "==", "AWS").get();
    const providerId = providerSnap.empty ? null : providerSnap.docs[0].id;
    const regionSnap = providerId
      ? await db.collection("regions").where("provider_id", "==", providerId).where("region_code", "==", requestedRegion).get()
      : null;
    const regionId = regionSnap && !regionSnap.empty ? regionSnap.docs[0].id : null;

    if (!providerId || !regionId) {
      return res.status(400).json({ error: `AWS provider/region not found for region ${requestedRegion}.` });
    }

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
        if (providerId && regionId) {
          const storageData = {
            provider_id: providerId,
            region_id: regionId,
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
    await logAudit("aws_pricing_sync", "success", (req as any).user.userId, req.ip, {
      region: requestedRegion,
      count: savedInstances.length
    });
    
    res.json({ 
      message: `Successfully synced ${savedInstances.length} AWS instances`, 
      region: requestedRegion,
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

app.get("/api/v1/aws/inventory", authenticate, async (req: any, res) => {
  try {
    const [ec2Resp, rdsResp, s3Resp, elbResp, route53Resp, lambdaResp, dynamoResp, eksResp] = await Promise.all([
      getAWSEC2Client().send(new DescribeInstancesCommand({})),
      getAWSRDSClient().send(new DescribeDBInstancesCommand({})),
      getAWSS3Client().send(new ListBucketsCommand({})),
      getAWSELBClient().send(new DescribeLoadBalancersCommand({})),
      getAWSRoute53Client().send(new ListHostedZonesCommand({})),
      getAWSLambdaClient().send(new ListFunctionsCommand({})),
      getAWSDynamoClient().send(new ListTablesCommand({})),
      getAWSEKSClient().send(new ListClustersCommand({}))
    ]);

    const region = process.env.AWS_REGION || "us-east-1";
    const ec2Instances = ec2Resp.Reservations?.flatMap(r => r.Instances || []) || [];
    const rdsInstances = rdsResp.DBInstances || [];
    const buckets = s3Resp.Buckets || [];
    const loadBalancers = elbResp.LoadBalancers || [];
    const hostedZones = route53Resp.HostedZones || [];
    const functions = lambdaResp.Functions || [];
    const tables = dynamoResp.TableNames || [];
    const clusters = eksResp.clusters || [];

    const bucketLocations = await Promise.all(
      buckets.map(async (bucket) => {
        try {
          const loc = await getAWSS3Client().send(new GetBucketLocationCommand({ Bucket: bucket.Name! }));
          return { name: bucket.Name, location: loc.LocationConstraint || "us-east-1", created_at: bucket.CreationDate };
        } catch {
          return { name: bucket.Name, location: "unknown", created_at: bucket.CreationDate };
        }
      })
    );

    res.json({
      region,
      summary: {
        ec2_instances: ec2Instances.length,
        rds_instances: rdsInstances.length,
        s3_buckets: buckets.length,
        load_balancers: loadBalancers.length,
        route53_hosted_zones: hostedZones.length,
        lambda_functions: functions.length,
        dynamodb_tables: tables.length,
        eks_clusters: clusters.length
      },
      services: {
        ec2: ec2Instances.map(i => ({ id: i.InstanceId, type: i.InstanceType, state: i.State?.Name, launch_time: i.LaunchTime })),
        rds: rdsInstances.map(i => ({ id: i.DBInstanceIdentifier, engine: i.Engine, class: i.DBInstanceClass, status: i.DBInstanceStatus })),
        s3: bucketLocations,
        elb: loadBalancers.map(lb => ({ arn: lb.LoadBalancerArn, name: lb.LoadBalancerName, type: lb.Type, state: lb.State?.Code })),
        route53: hostedZones.map(z => ({ id: z.Id, name: z.Name, records_count: z.ResourceRecordSetCount })),
        lambda: functions.map(f => ({ name: f.FunctionName, runtime: f.Runtime, memory_mb: f.MemorySize, timeout_sec: f.Timeout })),
        dynamodb: tables.map(name => ({ name })),
        eks: clusters.map(name => ({ name }))
      },
      synced_at: new Date().toISOString()
    });
  } catch (err: any) {
    console.error("AWS Inventory Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/v1/aws/sync-status", authenticate, async (req, res) => {
  if (isRemixedMode) {
    return res.json({
      mode: "memory-cache",
      region: livePricingCache.region || process.env.AWS_REGION || "us-east-1",
      synced_at: livePricingCache.synced_at || null,
      counts: {
        compute: livePricingCache.compute.length,
        storage: livePricingCache.storage.length,
        database: livePricingCache.database.length,
        networking: livePricingCache.networking.length
      }
    });
  }

  res.json({
    mode: useSqlPersistence ? "sql" : "firestore",
    message: useSqlPersistence ? "SQL persistence active." : "Use collection updated_at timestamps for sync status in non-remixed mode."
  });
});

// Calculations
app.post("/api/v1/calculations", authenticate, async (req: any, res) => {
  if (isRemixedMode) {
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
    const calcId = `mock-calc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = {
      id: calcId,
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
    inMemoryCalculations.unshift(result);
    return res.json(result);
  }

  const { compute_selections, storage_selections, database_selections, networking_selections, eks_selections, custom_compute_selections, duration_months, pricing_model } = req.body;
  try {
    if (useSqlPersistence) {
      const breakdowns: any[] = [];
      const providers = await sqlSelect("providers") as any[];
      const modelMultiplier =
        pricing_model === "reserved-3yr"
          ? 0.4
          : pricing_model === "reserved-1yr"
          ? 0.7
          : pricing_model === "spot"
          ? 0.3
          : (duration_months === 36)
          ? 0.4
          : (duration_months === 12)
          ? 0.7
          : 1.0;

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
        let pCustomCompute = (custom_compute_selections || []).filter((s: any) => s.provider_id === p.id);

        if (pEks.length === 0 && eks_selections?.length > 0) {
          const source = eks_selections[0];
          computeCost += (source.clusters || 0) * 0.10 * 730 * modelMultiplier;
        }
        for (const s of pEks) {
          computeCost += (s.clusters || 0) * 0.10 * 730 * modelMultiplier;
        }

        if (pCustomCompute.length === 0 && custom_compute_selections?.length > 0) pCustomCompute = [custom_compute_selections[0]];
        for (const s of pCustomCompute) {
          if (s.type === "gke") {
            computeCost += (s.clusters || 0) * 0.10 * 730;
          } else if (s.type === "run") {
            const requestCount = s.requests_unit === "billion per month" ? (s.requests || 0) * 1_000_000_000 : (s.requests || 0) * 1_000_000;
            const billableRequests = Math.max(0, requestCount - (s.free_tier ? 2_000_000 : 0));
            const requestCost = (billableRequests / 1_000_000) * 0.40;
            const durationSeconds = requestCount * ((s.avg_duration_ms || 0) / 1000);
            const vcpuSecondsCost = durationSeconds * (s.vcpu || 0) * 0.000024;
            const memorySecondsCost = durationSeconds * (s.memory_gib || 0) * 0.0000025;
            computeCost += requestCost + vcpuSecondsCost + memorySecondsCost;
          } else if (s.type === "appengine") {
            const rates: Record<string, number> = { F1: 0.05, F2: 0.10, F4: 0.20, F4_1G: 0.30 };
            const rate = rates[s.instance_class] ?? rates.F1;
            computeCost += (s.instances || 0) * (s.hours_per_month || 0) * rate;
          } else if (s.type === "functions") {
            const invocationCount = s.invocations_unit === "billion per month" ? (s.invocations || 0) * 1_000_000_000 : (s.invocations || 0) * 1_000_000;
            const billableInvocations = Math.max(0, invocationCount - (s.free_tier ? 2_000_000 : 0));
            const invocationCost = (billableInvocations / 1_000_000) * 0.40;
            const gbSeconds = invocationCount * ((s.avg_duration_ms || 0) / 1000) * (s.memory_gib || 0);
            const durationCost = gbSeconds * 0.0000025;
            computeCost += invocationCost + durationCost;
          }
        }



        for (const s of pCompute) {
          const d: any = await sqlGetById("compute_pricing", s.compute_pricing_id);
          if (d) computeCost += (d.price_per_hour || 0) * (s.quantity || 1) * 730 * modelMultiplier;
        }
        for (const s of pStorage) {
          const d: any = await sqlGetById("storage_pricing", s.storage_pricing_id);
          let basePrice = 0;
          const totalGb = s.unit === "TB" ? (s.size || 0) * 1024 : (s.size || 0);
          const calculateS3TieredCost = (gb: number) => gb <= 50 * 1024 ? gb * 0.023 : gb <= 500 * 1024 ? (50 * 1024 * 0.023) + ((gb - 50 * 1024) * 0.022) : (50 * 1024 * 0.023) + (450 * 1024 * 0.022) + ((gb - 500 * 1024) * 0.021);
          let storageBase = 0;
          if (d) {
            basePrice = d.price_per_gb_month || 0;
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
          const d: any = await sqlGetById("database_pricing", s.database_pricing_id);
          if (d) {
            let dbHours = 730;
            if (s.utilization_unit === "%Utilized/Month") dbHours = 730 * ((s.utilization_value || 100) / 100);
            else if (s.utilization_unit === "Hours/Day") dbHours = (s.utilization_value || 24) * 30.44;
            else if (s.utilization_unit === "Hours/Week") dbHours = (s.utilization_value || 168) * 4.345;
            else if (s.utilization_unit === "Hours/Month") dbHours = (s.utilization_value || 730);
            const dbMultiplier = s.deployment_option === "Multi-AZ" ? 2 : 1;
            const storageRate = s.storage_type === "gp3" ? 0.08 : 0.115;
            const storageC = (s.storage_gb || 0) * storageRate * dbMultiplier * (s.quantity || 1);
            databaseCost += ((d.price_per_hour || 0) * dbMultiplier * (s.quantity || 1) * dbHours * modelMultiplier) + storageC;
          }
        }
        for (const s of pNetworking) {
          const d: any = await sqlGetById("networking_pricing", s.networking_pricing_id);
          if (d) networkingCost += (d.price_per_unit || 0) * (s.quantity || 0);
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
      const calcId = newId("calc");
      const result = {
        user_id: req.user.userId,
        input_json: req.body,
        result_json: { provider_breakdowns: breakdowns },
        cheapest_provider: cheapest.provider_name,
        aws_total_monthly: breakdowns.find((b: any) => b.provider_name.toLowerCase().includes("amazon") || b.provider_name.toLowerCase().includes("aws"))?.total_cost_monthly || 0,
        azure_total_monthly: breakdowns.find((b: any) => b.provider_name.toLowerCase().includes("azure"))?.total_cost_monthly || 0,
        gcp_total_monthly: breakdowns.find((b: any) => b.provider_name.toLowerCase().includes("google") || b.provider_name.toLowerCase().includes("gcp"))?.total_cost_monthly || 0,
        duration_months: duration_months || 1,
        pricing_model: pricing_model || ((duration_months === 36) ? "reserved-3yr" : (duration_months === 12) ? "reserved-1yr" : "on-demand"),
        created_at: new Date().toISOString()
      };
      await sqlInsert("calculations", { id: calcId, ...result, input_json: asJson(result.input_json), result_json: asJson(result.result_json) });
      await logAudit("calculate_pricing", "success", req.user.userId, req.ip, req.body);
      return res.json({ id: calcId, ...result });
    }

    const breakdowns: any[] = [];
    const providersSnapshot = await db.collection("providers").get();
    const providers = providersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    const modelMultiplier =
      pricing_model === "reserved-3yr"
        ? 0.4
        : pricing_model === "reserved-1yr"
        ? 0.7
        : pricing_model === "spot"
        ? 0.3
        : (duration_months === 36)
        ? 0.4
        : (duration_months === 12)
        ? 0.7
        : 1.0;

    const findNearestComputeEquivalent = async (providerId: string, vcpu: number, memoryGb: number) => {
      const rows: any[] = await sqlSelect("compute_pricing", { provider_id: providerId }, { limit: 1000 });
      let best: any = null;
      let bestDistance = Infinity;
      for (const row of rows) {
        const rowVcpu = Number(row.vcpu || 0);
        const rowMemory = Number(row.memory_gb || 0);
        const distance = Math.abs(rowVcpu - vcpu) + Math.abs(rowMemory - memoryGb);
        if (distance < bestDistance || (distance === bestDistance && (Number(row.price_per_hour || 0) < Number(best?.price_per_hour || Infinity)))) {
          best = row;
          bestDistance = distance;
        }
      }
      return best;
    };

    const findNearestStorageEquivalent = async (providerId: string, storageType: string) => {
      const exact = await sqlSelect("storage_pricing", { provider_id: providerId, storage_type: storageType }, { limit: 1 });
      if (exact.length > 0) return exact[0];
      const all: any[] = await sqlSelect("storage_pricing", { provider_id: providerId }, { limit: 1000 });
      return all.sort((a, b) => Number(a.price_per_gb_month || 0) - Number(b.price_per_gb_month || 0))[0] || null;
    };

    const findNearestDatabaseEquivalent = async (providerId: string, dbEngine: string) => {
      const exact = await sqlSelect("database_pricing", { provider_id: providerId, db_engine: dbEngine }, { limit: 1 });
      if (exact.length > 0) return exact[0];
      const all: any[] = await sqlSelect("database_pricing", { provider_id: providerId }, { limit: 1000 });
      return all.sort((a, b) => Number(a.price_per_hour || 0) - Number(b.price_per_hour || 0))[0] || null;
    };

    const findNearestNetworkingEquivalent = async (providerId: string, serviceType: string) => {
      const exact = await sqlSelect("networking_pricing", { provider_id: providerId, service_type: serviceType }, { limit: 1 });
      if (exact.length > 0) return exact[0];
      const all: any[] = await sqlSelect("networking_pricing", { provider_id: providerId }, { limit: 1000 });
      return all.sort((a, b) => Number(a.price_per_unit || 0) - Number(b.price_per_unit || 0))[0] || null;
    };

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
      let pCustomCompute = (custom_compute_selections || []).filter((s: any) => s.provider_id === p.id);

      // EKS / Managed Kubernetes Cluster Pricing ($0.10/hr)
      if (pEks.length === 0 && eks_selections?.length > 0) {
        const source = eks_selections[0];
        computeCost += (source.clusters || 0) * 0.10 * 730 * modelMultiplier;
      }
      for (const s of pEks) {
        computeCost += (s.clusters || 0) * 0.10 * 730 * modelMultiplier;
      }

      if (pCustomCompute.length === 0 && custom_compute_selections?.length > 0) {
        pCustomCompute = [custom_compute_selections[0]];
      }
      for (const s of pCustomCompute) {
        if (s.type === "gke") {
          computeCost += (s.clusters || 0) * 0.10 * 730;
        } else if (s.type === "run") {
          const requestCount =
            s.requests_unit === "billion per month"
              ? (s.requests || 0) * 1_000_000_000
              : (s.requests || 0) * 1_000_000;
          const billableRequests = Math.max(0, requestCount - (s.free_tier ? 2_000_000 : 0));
          const requestCost = (billableRequests / 1_000_000) * 0.40;
          const durationSeconds = requestCount * ((s.avg_duration_ms || 0) / 1000);
          const vcpuSecondsCost = durationSeconds * (s.vcpu || 0) * 0.000024;
          const memorySecondsCost = durationSeconds * (s.memory_gib || 0) * 0.0000025;
          computeCost += requestCost + vcpuSecondsCost + memorySecondsCost;
        } else if (s.type === "appengine") {
          const rates: Record<string, number> = { F1: 0.05, F2: 0.10, F4: 0.20, F4_1G: 0.30 };
          const rate = rates[s.instance_class] ?? rates.F1;
          computeCost += (s.instances || 0) * (s.hours_per_month || 0) * rate;
        } else if (s.type === "functions") {
          const invocationCount =
            s.invocations_unit === "billion per month"
              ? (s.invocations || 0) * 1_000_000_000
              : (s.invocations || 0) * 1_000_000;
          const billableInvocations = Math.max(0, invocationCount - (s.free_tier ? 2_000_000 : 0));
          const invocationCost = (billableInvocations / 1_000_000) * 0.40;
          const gbSeconds = invocationCount * ((s.avg_duration_ms || 0) / 1000) * (s.memory_gib || 0);
          const durationCost = gbSeconds * 0.0000025;
          computeCost += invocationCost + durationCost;
        }
      }



      for (const s of pCompute) {
        const d = await db.collection("compute_pricing").doc(s.compute_pricing_id).get();
        if (d.exists) computeCost += (d.data()?.price_per_hour || 0) * (s.quantity || 1) * 730 * modelMultiplier;
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
          const storageCost = (s.storage_gb || 0) * storageRate * dbMultiplier * (s.quantity || 1);

          databaseCost += ((d.data()?.price_per_hour || 0) * dbMultiplier * (s.quantity || 1) * dbHours * modelMultiplier) + storageCost;
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
      pricing_model: pricing_model || ((duration_months === 36) ? "reserved-3yr" : (duration_months === 12) ? "reserved-1yr" : "on-demand"),
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
    if (useSqlPersistence) {
      const rows: any[] = req.user.role === "admin"
        ? await sqlSelect("calculations", {}, { orderBy: "created_at", orderDir: "DESC" })
        : await sqlSelect("calculations", { user_id: req.user.userId }, { orderBy: "created_at", orderDir: "DESC" });
      const calculations = rows.map((r) => ({
        ...r,
        input_json: parseJson(r.input_json, {}),
        result_json: parseJson(r.result_json, { provider_breakdowns: [] })
      }));
      return res.json({ calculations, total: calculations.length });
    }

    if (isRemixedMode) {
      const calculations = req.user.role === "admin"
        ? inMemoryCalculations
        : inMemoryCalculations.filter(c => c.user_id === req.user.userId);
      return res.json({ calculations, total: calculations.length });
    }

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
    if (useSqlPersistence) {
      const row: any = await sqlGetById("calculations", req.params.id);
      if (!row) return res.status(404).json({ error: "Not found" });
      if (req.user.role !== "admin" && row.user_id !== req.user.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      return res.json({ ...row, input_json: parseJson(row.input_json, {}), result_json: parseJson(row.result_json, { provider_breakdowns: [] }) });
    }

    if (isRemixedMode) {
      const calc = inMemoryCalculations.find(c => c.id === req.params.id);
      if (!calc) return res.status(404).json({ error: "Not found" });
      if (req.user.role !== "admin" && calc.user_id !== req.user.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      return res.json(calc);
    }

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
    let calc: any = null;
    if (useSqlPersistence) {
      const row: any = await sqlGetById("calculations", req.params.id);
      if (!row) return res.status(404).json({ error: "Not found" });
      if (req.user.role !== "admin" && row.user_id !== req.user.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      calc = {
        ...row,
        input_json: parseJson(row.input_json, {}),
        result_json: parseJson(row.result_json, { provider_breakdowns: [] })
      };
    } else if (isRemixedMode) {
      calc = inMemoryCalculations.find(c => c.id === req.params.id) || null;
      if (!calc) return res.status(404).json({ error: "Not found" });
      if (req.user.role !== "admin" && calc.user_id !== req.user.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
    } else {
      const d = await db.collection("calculations").doc(req.params.id).get();
      if (!d.exists) return res.status(404).json({ error: "Not found" });
      calc = d.data() as any;
    }

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
    let calc: any = null;
    if (useSqlPersistence) {
      const row: any = await sqlGetById("calculations", req.params.id);
      if (!row) return res.status(404).json({ error: "Not found" });
      if (req.user.role !== "admin" && row.user_id !== req.user.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      calc = {
        ...row,
        input_json: parseJson(row.input_json, {}),
        result_json: parseJson(row.result_json, { provider_breakdowns: [] })
      };
    } else if (isRemixedMode) {
      calc = inMemoryCalculations.find(c => c.id === req.params.id) || null;
      if (!calc) return res.status(404).json({ error: "Not found" });
      if (req.user.role !== "admin" && calc.user_id !== req.user.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
    } else {
      const d = await db.collection("calculations").doc(req.params.id).get();
      if (!d.exists) return res.status(404).json({ error: "Not found" });
      calc = d.data() as any;
    }

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
    if (useSqlPersistence) {
      const totalUsers = await sqlCount("users");
      const totalCalcs = await sqlCount("calculations");
      const totalLogs = await sqlCount("audit_logs");
      return res.json({
        total_users: totalUsers,
        total_calculations: totalCalcs,
        total_audit_logs: totalLogs,
        last_ingestion: new Date().toISOString(),
        pricing_data_count: (await sqlCount("compute_pricing")) + (await sqlCount("storage_pricing")) + (await sqlCount("database_pricing")) + (await sqlCount("networking_pricing")),
        active_users_last_30_days: totalUsers
      });
    }

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
    if (useSqlPersistence) {
      const rows = await sqlSelect("users");
      return res.json(rows);
    }

    if (isRemixedMode) {
      const baseAdmin = { id: "admin-123", email: "admin@jadeglobal.com", role: "admin", created_at: new Date().toISOString() };
      return res.json([baseAdmin, ...inMemoryUsers.map(u => ({ id: u.id, email: u.email, role: u.role, created_at: u.created_at }))]);
    }

    const snapshot = await db.collection("users").get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/v1/admin/users/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    if (useSqlPersistence) {
      const row: any = await sqlGetById("users", userId);
      if (!row) return res.status(404).json({ error: "User not found" });
      if (String(row.email || "").toLowerCase() === "admin@yourcompany.com") {
        return res.status(400).json({ error: "Default admin user cannot be deleted" });
      }
      await sqlDelete("users", { id: userId });
      await logAudit("delete_user", "success", (req as any).user.userId, req.ip, { removed_user_id: userId });
      return res.json({ success: true });
    } else if (isRemixedMode) {
      if (userId === "admin-123") return res.status(400).json({ error: "Default admin user cannot be deleted" });
      const index = inMemoryUsers.findIndex(u => u.id === userId);
      if (index === -1) return res.status(404).json({ error: "User not found" });
      const removed = inMemoryUsers[index];
      inMemoryUsers.splice(index, 1);
      await logAudit("delete_user_memory", "success", (req as any).user.userId, req.ip, { removed_user_id: userId, email: removed.email });
      return res.json({ success: true });
    }

    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });
    await userRef.delete();
    await logAudit("delete_user", "success", (req as any).user.userId, req.ip, { removed_user_id: userId });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/v1/admin/audit_logs", authenticate, requireAdmin, async (req, res) => {
  try {
    if (useSqlPersistence) {
      const rows = await sqlSelect("audit_logs", {}, { orderBy: "timestamp", orderDir: "DESC", limit: 100 });
      return res.json(rows.map((r: any) => ({ ...r, input_data: parseJson(r.input_data, null) })));
    }

    const snapshot = await db.collection("audit_logs").orderBy("timestamp", "desc").limit(100).get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Vite Integration ---

async function startServer() {
  await initSQLDatabase();

  if (useSqlPersistence) {
    await ensureSqlSchema();
    await seedSqlReferenceData();
    const existingAdmin: any[] = await sqlSelect("users", { email: "admin@yourcompany.com" }, { limit: 1 });
    if (existingAdmin.length === 0) {
      await sqlInsert("users", {
        email: "admin@yourcompany.com",
        password_hash: await bcrypt.hash("yourpassword", 10),
        role: "admin",
        created_at: new Date().toISOString()
      });
    }
  }

  // Auto-seed users if empty
  if (!useSqlPersistence && firebaseConfig.projectId !== "remixed-project-id") {
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
  } else if (isRemixedMode) {
    console.log("Skipping auto-seeding for remixed app without Firebase setup.");
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      root: path.join(process.cwd(), "../frontend"),
      server: {
        host: "0.0.0.0",
        middlewareMode: true,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "../frontend/dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

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
