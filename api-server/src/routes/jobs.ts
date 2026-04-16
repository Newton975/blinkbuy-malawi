import { Router } from "express";
import { db } from "@workspace/db";
import { jobsTable, jobApplicationsTable, usersTable } from "@workspace/db";
import { eq, and, ilike, desc, sql } from "drizzle-orm";
import { requireAuth, optionalAuth, type AuthRequest } from "../middlewares/auth";
import { generateId } from "../lib/auth";
import type { Response } from "express";

const router = Router();

router.get("/", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { category, location, urgency, status, search, limit = "20", offset = "0" } = req.query as Record<string, string>;
    const conditions: ReturnType<typeof eq>[] = [];
    if (category) conditions.push(eq(jobsTable.category, category));
    if (location) conditions.push(ilike(jobsTable.location, `%${location}%`));
    if (urgency) conditions.push(eq(jobsTable.urgency, urgency as "normal" | "urgent" | "emergency"));
    if (status) conditions.push(eq(jobsTable.status, status as "pending" | "in_progress" | "completed" | "cancelled"));
    if (search) conditions.push(ilike(jobsTable.title, `%${search}%`));

    const jobs = await db.select().from(jobsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(jobsTable.createdAt))
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    const withCustomers = await Promise.all(jobs.map(async (j) => {
      const [customer] = await db.select().from(usersTable).where(eq(usersTable.id, j.customerId)).limit(1);
      const { passwordHash: _, ...safeCustomer } = customer || {};
      return { ...j, customer: safeCustomer };
    }));

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(jobsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({ jobs: withCustomers, total: Number(countResult.count) });
  } catch (err) {
    req.log.error({ err }, "List jobs error");
    res.status(500).json({ error: "Failed to list jobs" });
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, category, location, budget, urgency } = req.body;
    const [job] = await db.insert(jobsTable).values({
      id: generateId(),
      customerId: req.user!.id,
      title,
      description,
      category,
      location,
      budget: budget ? parseFloat(budget) : null,
      budgetDisplay: budget ? `MK ${parseInt(budget).toLocaleString()}` : "Negotiable",
      urgency: urgency || "normal",
      status: "pending",
      applicationCount: 0,
    }).returning();
    res.status(201).json(job);
  } catch (err) {
    req.log.error({ err }, "Create job error");
    res.status(500).json({ error: "Failed to create job" });
  }
});

router.get("/:id", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, req.params.id)).limit(1);
    if (!job) { res.status(404).json({ error: "Job not found" }); return; }
    const [customer] = await db.select().from(usersTable).where(eq(usersTable.id, job.customerId)).limit(1);
    const { passwordHash: _, ...safeCustomer } = customer || {};
    const applications = await db.select().from(jobApplicationsTable).where(eq(jobApplicationsTable.jobId, job.id));
    res.json({ ...job, customer: safeCustomer, applications });
  } catch (err) {
    req.log.error({ err }, "Get job error");
    res.status(500).json({ error: "Failed to get job" });
  }
});

router.put("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, req.params.id)).limit(1);
    if (!job) { res.status(404).json({ error: "Job not found" }); return; }
    if (job.customerId !== req.user!.id && req.user!.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
    const { title, description, status, budget } = req.body;
    const [updated] = await db.update(jobsTable).set({ title, description, status, budget, updatedAt: new Date() }).where(eq(jobsTable.id, req.params.id)).returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update job error");
    res.status(500).json({ error: "Failed to update job" });
  }
});

router.post("/:id/apply", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, req.params.id)).limit(1);
    if (!job) { res.status(404).json({ error: "Job not found" }); return; }
    const { message, quote } = req.body;
    const [application] = await db.insert(jobApplicationsTable).values({
      id: generateId(),
      jobId: req.params.id,
      workerId: req.user!.id,
      message,
      quote: quote ? parseFloat(quote) : null,
      status: "pending",
    }).returning();
    await db.update(jobsTable).set({ applicationCount: sql`${jobsTable.applicationCount} + 1` }).where(eq(jobsTable.id, req.params.id));
    const [worker] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
    const { passwordHash: _, ...safeWorker } = worker;
    res.status(201).json({ ...application, worker: safeWorker });
  } catch (err) {
    req.log.error({ err }, "Apply job error");
    res.status(500).json({ error: "Failed to apply to job" });
  }
});

router.get("/:id/applications", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const applications = await db.select().from(jobApplicationsTable).where(eq(jobApplicationsTable.jobId, req.params.id));
    const withWorkers = await Promise.all(applications.map(async (a) => {
      const [worker] = await db.select().from(usersTable).where(eq(usersTable.id, a.workerId)).limit(1);
      const { passwordHash: _, ...safeWorker } = worker || {};
      return { ...a, worker: safeWorker };
    }));
    res.json({ applications: withWorkers, total: withWorkers.length });
  } catch (err) {
    req.log.error({ err }, "Get applications error");
    res.status(500).json({ error: "Failed to get applications" });
  }
});

router.post("/:id/complete", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, req.params.id)).limit(1);
    if (!job) { res.status(404).json({ error: "Job not found" }); return; }
    await db.update(jobsTable).set({ status: "completed", updatedAt: new Date() }).where(eq(jobsTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Complete job error");
    res.status(500).json({ error: "Failed to complete job" });
  }
});

export default router;
