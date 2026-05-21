// ═══════════════════════════════════════════════
// Company Routes
// ═══════════════════════════════════════════════

import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { enrichQueue } from "../lib/queue.js";

const router = Router();

// GET /api/companies — List all companies (paginated)
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 10));
    const skip = (page - 1) * pageSize;

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: { founders: true, prospects: true },
      }),
      prisma.company.count(),
    ]);

    res.json({
      success: true,
      data: companies,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/companies/:id — Get single company
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: { founders: true, prospects: true },
    });

    if (!company) {
      throw new AppError(404, "Company not found");
    }

    res.json({ success: true, data: company });
  } catch (err) {
    next(err);
  }
});

// POST /api/companies — Create a company
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, domain, fundingStage, fundingDate, description, techStack, sourceUrl } =
      req.body;

    if (!name || !domain) {
      throw new AppError(400, "name and domain are required");
    }

    const company = await prisma.company.create({
      data: {
        name,
        domain,
        fundingStage: fundingStage || "Unknown",
        fundingDate: fundingDate ? new Date(fundingDate) : new Date(),
        description: description || "",
        techStack: techStack || [],
        sourceUrl: sourceUrl || "",
      },
    });

    res.status(201).json({ success: true, data: company });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/companies/:id — Update a company
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await prisma.company.update({
      where: { id: req.params.id },
      data: {
        ...req.body,
        ...(req.body.fundingDate && {
          fundingDate: new Date(req.body.fundingDate),
        }),
      },
    });

    res.json({ success: true, data: company });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/companies/:id — Delete a company (cascades)
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.company.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: null, message: "Company deleted" });
  } catch (err) {
    next(err);
  }
});

// POST /api/companies/:id/enrich — Queue enrichment job
router.post("/:id/enrich", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
    });

    if (!company) {
      throw new AppError(404, "Company not found");
    }

    const job = await enrichQueue.add("enrich", {
      companyId: company.id,
      domain: company.domain,
    });

    res.json({
      success: true,
      data: { jobId: job.id, status: "queued" },
      message: "Enrichment job queued",
    });
  } catch (err) {
    next(err);
  }
});

export default router;
