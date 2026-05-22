import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Keep Neon connection alive — ping every 4 minutes
// Neon suspends after 5 minutes of inactivity
if (process.env.NODE_ENV === "production") {
  setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      // silently reconnect on next real query
      await prisma.$disconnect();
    }
  }, 4 * 60 * 1000);
}

process.on("beforeExit", async () => {
  await prisma.$disconnect();
});

export default prisma;
