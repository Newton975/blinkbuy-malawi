import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, servicesTable, jobsTable, marketplaceItemsTable, messagesTable, reportsTable, paymentsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { requireAdmin, type AuthRequest } from "../middlewares/auth";
import type { Response } from "express";

const router = Router();

router.post("/users/:id/verify", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.body;
    const update = type === "verified" ? { isVerified: true } : { isTrusted: true };
    await db.update(usersTable).set(update).where(eq(usersTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Verify user error");
    res.status(500).json({ error: "Failed to verify user" });
  }
});

router.post("/users/:id/suspend", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await db.update(usersTable).set({ isSuspended: true }).where(eq(usersTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Suspend user error");
    res.status(500).json({ error: "Failed to suspend user" });
  }
});

router.post("/users/:id/trusted", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await db.update(usersTable).set({ isTrusted: true }).where(eq(usersTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Mark trusted error");
    res.status(500).json({ error: "Failed to mark trusted" });
  }
});

router.get("/analytics", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
    const [workerCount] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.role, "worker"));
    const [serviceCount] = await db.select({ count: sql<number>`count(*)` }).from(servicesTable);
    const [jobCount] = await db.select({ count: sql<number>`count(*)` }).from(jobsTable);
    const [marketCount] = await db.select({ count: sql<number>`count(*)` }).from(marketplaceItemsTable);
    const [msgCount] = await db.select({ count: sql<number>`count(*)` }).from(messagesTable);
    const [reportCount] = await db.select({ count: sql<number>`count(*)` }).from(reportsTable).where(eq(reportsTable.status, "pending"));
    const [paymentCount] = await db.select({ count: sql<number>`count(*)` }).from(paymentsTable).where(eq(paymentsTable.status, "pending"));

    res.json({
      totalUsers: Number(userCount.count),
      totalWorkers: Number(workerCount.count),
      totalCustomers: Number(userCount.count) - Number(workerCount.count),
      totalServices: Number(serviceCount.count),
      totalJobs: Number(jobCount.count),
      totalMarketplaceItems: Number(marketCount.count),
      totalMessages: Number(msgCount.count),
      pendingReports: Number(reportCount.count),
      pendingPayments: Number(paymentCount.count),
      recentSignups: 0,
      activeUsers: 0,
      monthlyGrowth: 12.5,
    });
  } catch (err) {
    req.log.error({ err }, "Analytics error");
    res.status(500).json({ error: "Failed to get analytics" });
  }
});

router.get("/reports", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const reports = await db.select().from(reportsTable).orderBy(desc(reportsTable.createdAt));
    const withUsers = await Promise.all(reports.map(async (r) => {
      const [reporter] = await db.select().from(usersTable).where(eq(usersTable.id, r.reporterId)).limit(1);
      const [reported] = await db.select().from(usersTable).where(eq(usersTable.id, r.reportedId)).limit(1);
      const { passwordHash: _1, ...safeReporter } = reporter || {};
      const { passwordHash: _2, ...safeReported } = reported || {};
      return { ...r, reporter: safeReporter, reported: safeReported };
    }));
    res.json({ reports: withUsers, total: withUsers.length });
  } catch (err) {
    req.log.error({ err }, "List reports error");
    res.status(500).json({ error: "Failed to list reports" });
  }
});

router.post("/featured/:serviceId/activate", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const featuredUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await db.update(servicesTable).set({ isFeatured: true, featuredUntil }).where(eq(servicesTable.id, req.params.serviceId));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Activate featured error");
    res.status(500).json({ error: "Failed to activate featured listing" });
  }
});

export default router;
