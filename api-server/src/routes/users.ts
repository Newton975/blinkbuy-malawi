import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, servicesTable, reviewsTable, reportsTable } from "@workspace/db";
import { eq, ilike, and, or, sql, desc } from "drizzle-orm";
import { requireAuth, optionalAuth, type AuthRequest } from "../middlewares/auth";
import { generateId } from "../lib/auth";
import type { Response } from "express";

const router = Router();

function safeUser(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

router.get("/", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { role, search, location, limit = "20", offset = "0" } = req.query as Record<string, string>;
    const conditions = [];
    if (role) conditions.push(eq(usersTable.role, role as "customer" | "worker" | "both" | "admin"));
    if (search) conditions.push(or(ilike(usersTable.name, `%${search}%`), ilike(usersTable.bio, `%${search}%`)));
    if (location) conditions.push(ilike(usersTable.location, `%${location}%`));

    const users = await db.select().from(usersTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(usersTable.createdAt))
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(usersTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({ users: users.map(safeUser), total: Number(countResult.count) });
  } catch (err) {
    req.log.error({ err }, "List users error");
    res.status(500).json({ error: "Failed to list users" });
  }
});

router.get("/top-rated", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = "10" } = req.query as Record<string, string>;
    const workers = await db.select().from(usersTable)
      .where(or(eq(usersTable.role, "worker"), eq(usersTable.role, "both")))
      .orderBy(desc(usersTable.rating), desc(usersTable.reviewCount))
      .limit(parseInt(limit));
    res.json({ workers: workers.map(safeUser), total: workers.length });
  } catch (err) {
    req.log.error({ err }, "Top rated error");
    res.status(500).json({ error: "Failed to fetch top rated workers" });
  }
});

router.get("/nearby", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { location, category, available } = req.query as Record<string, string>;
    const conditions = [or(eq(usersTable.role, "worker"), eq(usersTable.role, "both"))];
    if (location) conditions.push(ilike(usersTable.location, `%${location}%`));
    if (available === "true") conditions.push(eq(usersTable.isOnline, true));

    const workers = await db.select().from(usersTable)
      .where(and(...conditions))
      .orderBy(desc(usersTable.isOnline), desc(usersTable.rating))
      .limit(20);
    res.json({ workers: workers.map(safeUser), total: workers.length });
  } catch (err) {
    req.log.error({ err }, "Nearby error");
    res.status(500).json({ error: "Failed to fetch nearby workers" });
  }
});

router.get("/dashboard/stats", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const [services] = await db.select({ count: sql<number>`count(*)` }).from(servicesTable)
      .where(eq(servicesTable.workerId, user.id));

    res.json({
      totalJobsCompleted: user.jobsCompleted || 0,
      activeListings: Number(services.count),
      rating: user.rating || 0,
      reviewCount: user.reviewCount || 0,
      profileStrength: user.profileStrength || 20,
      totalViews: 0,
      recentActivity: [],
    });
  } catch (err) {
    req.log.error({ err }, "Dashboard stats error");
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

router.get("/:id", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.params.id)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const services = await db.select().from(servicesTable).where(eq(servicesTable.workerId, user.id)).limit(10);
    const reviews = await db.select().from(reviewsTable).where(eq(reviewsTable.workerId, user.id)).limit(10);

    res.json({ ...safeUser(user), services, reviews, workPhotos: user.workPhotos || [] });
  } catch (err) {
    req.log.error({ err }, "Get user error");
    res.status(500).json({ error: "Failed to get user" });
  }
});

router.put("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (req.user!.id !== id && req.user!.role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { name, phone, whatsapp, location, bio, profilePhoto, role, priceRange, servicesOffered } = req.body;
    
    // Calculate profile strength
    let strength = 20;
    if (profilePhoto) strength += 20;
    if (bio) strength += 15;
    if (phone) strength += 15;
    if (location) strength += 15;
    if (servicesOffered?.length > 0) strength += 15;

    const [updated] = await db.update(usersTable)
      .set({ name, phone, whatsapp, location, bio, profilePhoto, role, priceRange, servicesOffered, profileStrength: strength, updatedAt: new Date() })
      .where(eq(usersTable.id, id))
      .returning();

    res.json(safeUser(updated));
  } catch (err) {
    req.log.error({ err }, "Update user error");
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.put("/:id/availability", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (req.user!.id !== id) { res.status(403).json({ error: "Forbidden" }); return; }
    const { isOnline } = req.body;
    const [updated] = await db.update(usersTable).set({ isOnline, updatedAt: new Date() }).where(eq(usersTable.id, id)).returning();
    res.json(safeUser(updated));
  } catch (err) {
    req.log.error({ err }, "Availability error");
    res.status(500).json({ error: "Failed to update availability" });
  }
});

router.post("/:id/report", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { reason, description } = req.body;
    await db.insert(reportsTable).values({
      id: generateId(),
      reporterId: req.user!.id,
      reportedId: req.params.id,
      reason,
      description,
      status: "pending",
    });
    res.status(201).json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Report user error");
    res.status(500).json({ error: "Failed to submit report" });
  }
});

export default router;
