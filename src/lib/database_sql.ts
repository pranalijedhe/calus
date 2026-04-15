import { Sequelize } from "sequelize-typescript";
import { User, AWSPricing } from "../models/SQLModels.ts";
import dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL?.trim();

// Only create Sequelize instance if we have a valid connection string
export const sequelize = (DATABASE_URL && DATABASE_URL.includes("://")) 
  ? new Sequelize(DATABASE_URL, {
      dialect: DATABASE_URL.startsWith("postgres") ? "postgres" : undefined,
      logging: false,
      models: [User, AWSPricing],
      dialectOptions: DATABASE_URL.includes("sslmode=require") ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      } : {}
    })
  : null;

// Add error listener to prevent unhandled 'error' events
if (sequelize) {
  sequelize.addHook('beforeConnect', (config) => {
    // Optional: log connection attempt
  });
}

export async function initSQLDatabase() {
  if (!sequelize) {
    console.warn("SQL Database initialization skipped: DATABASE_URL is not set or invalid.");
    return;
  }

  try {
    // Test connection
    await sequelize.authenticate();
    console.log("SQL Database connection has been established successfully.");
    
    // Sync models
    await sequelize.sync({ alter: true });
    console.log("SQL Database models synchronized.");
  } catch (error) {
    console.error("SQL Database initialization failed. The app will continue without SQL features.");
    console.error("Error details:", error instanceof Error ? error.message : String(error));
  }
}
