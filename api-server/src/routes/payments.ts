import { Router } from "express";
import { db } from "@workspace/db";
import { paymentsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin, type AuthRequest } from "../middlewares/auth";
import { generateId } from "../lib/auth";
import type { Response } from "express";

const router = Router();

router.get("/", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const payments = await db.select().from(paymentsTable).orderBy(desc(paymentsTable.createdAt));
    const withUsers = await Promise.all(payments.map(async (p) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, p.userId)).limit(1);
      const { passwordHash: _, ...safeUser } = user || {};
      return { ...p, user: safeUser };
    }));
    res.json({ payments: withUsers, total: withUsers.length });
  } catch (err) {
    req.log.error({ err }, "List payments error");
    res.status(500).json({ error: "Failed to list payments" });
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { amount, method, purpose, proofImageUrl, transactionRef } = req.body;
    const [payment] = await db.insert(paymentsTable).values({
      id: generateId(),
      userId: req.user!.id,
      amount: parseFloat(amount),
      currency: "MWK",
      method: method as "airtel_money" | "tnm_mpamba",
      purpose: purpose as "featured_listing" | "verified_badge" | "ad",
      proofImageUrl,
      transactionRef,
      status: "pending",
    }).returning();
    res.status(201).json(payment);
  } catch (err) {
    req.log.error({ err }, "Submit payment error");
    res.status(500).json({ error: "Failed to submit payment" });
  }
});

export default router;
