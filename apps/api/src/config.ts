// ═══════════════════════════════════════════════
// Environment Configuration
// ═══════════════════════════════════════════════

import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",

  database: {
    url: process.env.DATABASE_URL!,
  },

  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || "",
  },

  crunchbase: {
    apiKey: process.env.CRUNCHBASE_API_KEY || "",
  },

  productHunt: {
    apiKey: process.env.PRODUCTHUNT_API_KEY || "",
  },

  linkedin: {
    apiKey: process.env.LINKEDIN_API_KEY || "",
  },

  builtwith: {
    apiKey: process.env.BUILTWITH_API_KEY || "",
  },

  hunter: {
    apiKey: process.env.HUNTER_API_KEY || "",
  },
} as const;
