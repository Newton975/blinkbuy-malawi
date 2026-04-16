import { Router } from "express";
import { db } from "@workspace/db";
import { reviewsTable, usersTable, servicesTable } from "@workspace/db";
import { eq, and, avg, sql } from "drizzle-orm";
import { requireAuth, optionalAuth, type AuthRequest } from "../middlewares/auth";
import { generateId } from "../lib/auth";
import type { Response } from "express";

const router = Router();

router.get("/", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { workerId, serviceId, limit = "20" } = req.query as Record<string, string>;
    const conditions: ReturnType<typeof eq>[] = [];
    if (workerId) conditions.push(eq(reviewsTable.workerId, workerId));
    if (serviceId) conditions.push(eq(reviewsTable.serviceId, serviceId));

    const reviews = await db.select().from(reviewsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(parseInt(limit));

    const withReviewers = await Promise.all(reviews.map(async (r) => {
      const [reviewer] = await db.select().from(usersTable).where(eq(usersTable.id, r.reviewerId)).limit(1);
      const { passwordHash: _, ...safeReviewer } = reviewer || {};
      return { ...r, reviewer: safeReviewer };
    }));

    const [avgResult] = await db.select({ avg: avg(reviewsTable.rating) }).from(reviewsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({ reviews: withReviewers, averageRating: parseFloat(avgResult.avg || "0"), total: withReviewers.length });
  } catch (err) {
    req.log.error({ err }, "List reviews error");
    res.status(500).json({ error: "Failed to list reviews" });
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { workerId, serviceId, jobId, rating, comment } = req.body;
    const [review] = await db.insert(reviewsTable).values({
      id: generateId(),
      reviewerId: req.user!.id,
      workerId: workerId || null,
      serviceId: serviceId || null,
      jobId: jobId || null,
      rating: parseFloat(rating),
      comment,
    }).returning();

    // Update worker rating
    if (workerId) {
      const [avgResult] = await db.select({ avg: avg(reviewsTable.rating), count: sql<number>`count(*)` })
        .from(reviewsTable).where(eq(reviewsTable.workerId, workerId));
      await db.update(usersTable).set({
        rating: parseFloat(avgResult.avg || "0"),
        reviewCount: Number(avgResult.count),
      }).where(eq(usersTable.id, workerId));
    }

    if (serviceId) {
      const [avgResult] = await db.select({ avg: avg(reviewsTable.rating), count: sql<number>`count(*)` })
        .from(reviewsTable).where(eq(reviewsTable.serviceId, serviceId));
      await db.update(servicesTable).set({
        rating: parseFloat(avgResult.avg || "0"),
        reviewCount: Number(avgResult.count),
      }).where(eq(servicesTable.id, serviceId));
    }

    const [reviewer] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
    const { passwordHash: _, ...safeReviewer } = reviewer;
    res.status(201).json({ ...review, reviewer: safeReviewer });
  } catch (err) {
    req.log.error({ err }, "Create review error");
    res.status(500).json({ error: "Failed to create review" });
  }
});

export default router;
