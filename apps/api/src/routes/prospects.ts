import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import nodemailer from "nodemailer";
import * as aws from "@aws-sdk/client-ses";
import { ProspectStatus } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { config } from "../config.js";

const router = Router();
import { emailGenerateQueue } from "../lib/queue.js";

// Zod schemas
const patchProspectSchema = z.object({
  status: z.enum(["PENDING", "REVIEWED", "SENT", "SKIPPED"]).optional(),
  editedEmail: z.object({
    subject: z.string().min(1, "Subject is required"),
    body: z.string().min(1, "Body is required"),
  }).optional(),
});

// GET /api/prospects/stats — return summary statistics
router.get("/stats", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await prisma.prospect.groupBy({
      by: ["status"],
      _count: {
        status: true,
      },
    });

    const formattedStats = {
      total: 0,
      sent: 0,
      pending: 0,
      skipped: 0,
      reviewed: 0,
    };

    for (const stat of stats) {
      formattedStats.total += stat._count.status;
      if (stat.status === "SENT") formattedStats.sent = stat._count.status;
      if (stat.status === "PENDING") formattedStats.pending = stat._count.status;
      if (stat.status === "SKIPPED") formattedStats.skipped = stat._count.status;
      if (stat.status === "REVIEWED") formattedStats.reviewed = stat._count.status;
    }

    res.json({ success: true, data: formattedStats });
  } catch (err) {
    next(err);
  }
});

// GET /api/prospects — return paginated list (default 20 per page) of prospects with status PENDING, joined with their Company and Founder data, ordered by Company.fundingDate desc.
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const skip = (page - 1) * pageSize;

    const [prospects, total] = await Promise.all([
      prisma.prospect.findMany({
        where: { status: "PENDING" },
        skip,
        take: pageSize,
        orderBy: {
          company: { fundingDate: "desc" },
        },
        include: {
          company: {
            include: { founders: true },
          },
        },
      }),
      prisma.prospect.count({ where: { status: "PENDING" } }),
    ]);

    // Parse generated/edited emails for convenience
    const formattedProspects = prospects.map((p) => {
      let parsedEmail = null;
      try {
        if (p.editedEmail) parsedEmail = JSON.parse(p.editedEmail);
        else if (p.generatedEmail) parsedEmail = JSON.parse(p.generatedEmail);
      } catch (e) {
        // Ignored
      }
      return { ...p, parsedEmail };
    });

    res.json({
      success: true,
      data: formattedProspects,
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

// GET /api/prospects/:id — return a single prospect with full company enrichment data and parsed email (subject + body).
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prospect = await prisma.prospect.findUnique({
      where: { id: req.params.id },
      include: {
        company: {
          include: { founders: true },
        },
      },
    });

    if (!prospect) {
      throw new AppError(404, "Prospect not found");
    }

    let parsedEmail = null;
    try {
      if (prospect.editedEmail) parsedEmail = JSON.parse(prospect.editedEmail);
      else if (prospect.generatedEmail) parsedEmail = JSON.parse(prospect.generatedEmail);
    } catch (e) {
      // Ignored
    }

    res.json({ success: true, data: { ...prospect, parsedEmail } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/prospects/:id — accept { editedEmail: { subject: string, body: string }, status: string } in the body, validate with Zod, and update the Prospect row.
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = patchProspectSchema.parse(req.body);

    const dataToUpdate: any = {};
    if (parsedBody.status) {
      dataToUpdate.status = parsedBody.status;
    }
    if (parsedBody.editedEmail) {
      dataToUpdate.editedEmail = JSON.stringify(parsedBody.editedEmail);
    }

    const prospect = await prisma.prospect.update({
      where: { id: req.params.id },
      data: dataToUpdate,
      include: { company: true },
    });

    res.json({ success: true, data: prospect });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(400, "Validation failed", err.errors));
    }
    next(err);
  }
});

// POST /api/prospects/:id/send — pull email, send via Nodemailer, update status to SENT, log timestamp.
router.post("/:id/send", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prospect = await prisma.prospect.findUnique({
      where: { id: req.params.id },
      include: { company: { include: { founders: true } } },
    });

    if (!prospect) {
      throw new AppError(404, "Prospect not found");
    }

    if (prospect.status === "SENT") {
      throw new AppError(400, "Prospect email already sent");
    }

    const emailJsonStr = prospect.editedEmail || prospect.generatedEmail;
    if (!emailJsonStr) {
      throw new AppError(400, "No email content available to send");
    }

    let emailData: { subject: string; body: string };
    try {
      emailData = JSON.parse(emailJsonStr);
    } catch (e) {
      throw new AppError(500, "Invalid email JSON format stored in database");
    }

    const founder = prospect.company.founders[0];
    if (!founder || !founder.email) {
      throw new AppError(400, "No valid founder email found for this company");
    }

    // Configure Nodemailer Transport
    let transporter;
    if (process.env.USE_SES === "true") {
      const sesClient = new aws.SES({
        region: process.env.AWS_REGION || "us-east-1",
        // AWS SDK automatically uses AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY from env
      });
      transporter = nodemailer.createTransport({
        SES: { ses: sesClient, aws },
      } as any);
    } else {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_PORT === "465", // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER || "",
          pass: process.env.SMTP_PASS || "",
        },
      });
    }

    // Send the email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"InternHunter" <hello@internhunter.com>',
      to: founder.email,
      subject: emailData.subject,
      text: emailData.body,
      // You can also add html: ... if desired, but sticking to text for cold emails is fine
    });

    const sendTimestamp = new Date();
    console.log(`[Email Sent] To: ${founder.email} | ProspectId: ${prospect.id} | Timestamp: ${sendTimestamp.toISOString()} | MessageId: ${info.messageId}`);

    // Update status to SENT
    const updatedProspect = await prisma.prospect.update({
      where: { id: prospect.id },
      data: { status: "SENT" },
    });

    res.json({
      success: true,
      message: "Email sent successfully",
      data: updatedProspect,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/prospects/:id/skip — set status to SKIPPED.
router.post("/:id/skip", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prospect = await prisma.prospect.update({
      where: { id: req.params.id },
      data: { status: "SKIPPED" },
    });

    res.json({
      success: true,
      message: "Prospect skipped",
      data: prospect,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/prospects/:id/regenerate — queue a new generation job
router.post("/:id/regenerate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prospect = await prisma.prospect.findUnique({
      where: { id: req.params.id },
      include: { company: true },
    });

    if (!prospect) {
      throw new AppError(404, "Prospect not found");
    }

    // Set status to PENDING again
    await prisma.prospect.update({
      where: { id: req.params.id },
      data: { status: "PENDING" },
    });

    const job = await emailGenerateQueue.add(
      "generate",
      {
        prospectId: prospect.id,
        companyId: prospect.companyId,
      },
      {
        jobId: `gen-email-regen-${prospect.id}-${Date.now()}`, // Force a new job ID
      }
    );

    res.json({
      success: true,
      message: "Email regeneration job queued",
      data: { jobId: job.id, status: "queued" },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
