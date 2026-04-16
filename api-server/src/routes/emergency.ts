import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, ilike, or, and, desc } from "drizzle-orm";
import { optionalAuth, type AuthRequest } from "../middlewares/auth";
import type { Response } from "express";

const router = Router();

router.get("/workers", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { location, category } = req.query as Record<string, string>;
    const conditions = [
      or(eq(usersTable.role, "worker"), eq(usersTable.role, "both")),
      eq(usersTable.isOnline, true),
    ];
    if (location) conditions.push(ilike(usersTable.location, `%${location}%`));

    const workers = await db.select().from(usersTable)
      .where(and(...conditions))
      .orderBy(desc(usersTable.rating))
      .limit(20);

    res.json({ workers: workers.map(({ passwordHash: _, ...w }) => w), total: workers.length });
  } catch (err) {
    req.log.error({ err }, "Emergency workers error");
    res.status(500).json({ error: "Failed to fetch emergency workers" });
  }
});

export default router;
