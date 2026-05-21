// ═══════════════════════════════════════════════
// Redis Connection (IORedis)
// ═══════════════════════════════════════════════

import IORedis from "ioredis";
import { config } from "../config.js";

export const redis = new IORedis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
});

redis.on("connect", () => {
  console.log("🔴 Redis connected");
});

redis.on("error", (err) => {
  console.error("❌ Redis error:", err.message);
});

export default redis;
