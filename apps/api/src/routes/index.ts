// ═══════════════════════════════════════════════
// Route Index — Mount all routers
// ═══════════════════════════════════════════════

import { Router } from "express";
import healthRouter from "./health.js";
import companiesRouter from "./companies.js";
import foundersRouter from "./founders.js";
import prospectsRouter from "./prospects.js";
import authRouter from "./auth.js";

const router = Router();

router.use("/health", healthRouter);
router.use("/companies", companiesRouter);
router.use("/founders", foundersRouter);
router.use("/prospects", prospectsRouter);
router.use("/auth", authRouter);

export default router;
