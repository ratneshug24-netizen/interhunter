// ═══════════════════════════════════════════════
// Founder Routes
// ═══════════════════════════════════════════════

import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";

const router = Router();

// GET /api/founders — List all founders
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.query.companyId as string | undefined;

    const founders = await prisma.founder.findMany({
      where: companyId ? { companyId } : undefined,
      include: { company: true },
      orderBy: { name: "asc" },
    });

    res.json({ success: true, data: founders });
  } catch (err) {
    next(err);
  }
});

// GET /api/founders/:id — Get single founder
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const founder = await prisma.founder.findUnique({
      where: { id: req.params.id },
      include: { company: true },
    });

    if (!founder) {
      throw new AppError(404, "Founder not found");
    }

    res.json({ success: true, data: founder });
  } catch (err) {
    next(err);
  }
});

// POST /api/founders — Create a founder
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, name, email, title } = req.body;

    if (!companyId || !name || !email || !title) {
      throw new AppError(400, "companyId, name, email, and title are required");
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new AppError(404, "Company not found");
    }

    const founder = await prisma.founder.create({
      data: { companyId, name, email, title },
    });

    res.status(201).json({ success: true, data: founder });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/founders/:id — Update a founder
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, title } = req.body;

    const founder = await prisma.founder.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(title && { title }),
      },
    });

    res.json({ success: true, data: founder });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/founders/:id — Delete a founder
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.founder.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: null, message: "Founder deleted" });
  } catch (err) {
    next(err);
  }
});

export default router;
