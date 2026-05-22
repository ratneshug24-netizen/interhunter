import IORedis from "ioredis";

export const redis = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  tls: {},
  retryStrategy: (times) => {
    return Math.min(times * 500, 5000);
  },
  reconnectOnError: () => true,
});

redis.on("connect", () => {
  console.log("🔴 Redis connected");
});

redis.on("error", (err) => {
  console.error("❌ Redis error:", err.message);
});

export default redis;
