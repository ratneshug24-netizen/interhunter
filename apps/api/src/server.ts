// ═══════════════════════════════════════════════
// Express Server Entrypoint
// ═══════════════════════════════════════════════

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { config } from "./config.js";
import routes from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { startWorkers } from "./workers/index.js";

const app = express();

// ─── Global Middleware ─────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── API Routes ────────────────────────────────
app.use("/api", routes);

// ─── Root Route ────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    success: true,
    data: {
      name: "InternHunter API",
      version: "0.1.0",
      docs: "/api/health",
    },
  });
});

// ─── Error Handling ────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

import { scheduleAggregationJob } from "./lib/queue.js";

// ─── Start Server ──────────────────────────────
app.listen(config.port, async () => {
  console.log(`\n🚀 InternHunter API running on http://localhost:${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   CORS origin: ${config.corsOrigin}\n`);

  // Ensure aggregator repeatable job is scheduled when API starts
  await scheduleAggregationJob();
});

export default app;
