import { Router } from "express";
import { db } from "@workspace/db";
import { servicesTable, usersTable, reviewsTable } from "@workspace/db";
import { eq, and, ilike, gte, lte, desc, sql, or } from "drizzle-orm";
import { requireAuth, optionalAuth, type AuthRequest } from "../middlewares/auth";
import { generateId } from "../lib/auth";
import type { Response } from "express";

const router = Router();

async function getServiceWithWorker(id: string) {
  const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, id)).limit(1);
  if (!service) return null;
  const [worker] = await db.select().from(usersTable).where(eq(usersTable.id, service.workerId)).limit(1);
  const { passwordHash: _, ...safeWorker } = worker;
  return { ...service, worker: safeWorker };
}

router.get("/", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { category, location, search, minPrice, maxPrice, minRating, available, featured, limit = "20", offset = "0" } = req.query as Record<string, string>;
    const conditions: ReturnType<typeof eq>[] = [];
    if (category) conditions.push(eq(servicesTable.category, category));
    if (location) conditions.push(ilike(servicesTable.location, `%${location}%`));
    if (search) conditions.push(or(ilike(servicesTable.title, `%${search}%`), ilike(servicesTable.description, `%${search}%`)));
    if (minPrice) conditions.push(gte(servicesTable.price, parseFloat(minPrice)));
    if (maxPrice) conditions.push(lte(servicesTable.price, parseFloat(maxPrice)));
    if (minRating) conditions.push(gte(servicesTable.rating, parseFloat(minRating)));
    if (available === "true") conditions.push(eq(servicesTable.isOnline, true));
    if (featured === "true") conditions.push(eq(servicesTable.isFeatured, true));

    const services = await db.select().from(servicesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(servicesTable.isFeatured), desc(servicesTable.rating))
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    const withWorkers = await Promise.all(services.map(async (s) => {
      const [worker] = await db.select().from(usersTable).where(eq(usersTable.id, s.workerId)).limit(1);
      const { passwordHash: _, ...safeWorker } = worker || {};
      return { ...s, worker: safeWorker };
    }));

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(servicesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({ services: withWorkers, total: Number(countResult.count) });
  } catch (err) {
    req.log.error({ err }, "List services error");
    res.status(500).json({ error: "Failed to list services" });
  }
});

router.get("/trending", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = "10" } = req.query as Record<string, string>;
    const services = await db.select().from(servicesTable)
      .orderBy(desc(servicesTable.viewCount), desc(servicesTable.bookingCount))
      .limit(parseInt(limit));
    const withWorkers = await Promise.all(services.map(async (s) => {
      const [worker] = await db.select().from(usersTable).where(eq(usersTable.id, s.workerId)).limit(1);
      const { passwordHash: _, ...safeWorker } = worker || {};
      return { ...s, worker: safeWorker };
    }));
    res.json({ services: withWorkers, total: withWorkers.length });
  } catch (err) {
    req.log.error({ err }, "Trending error");
    res.status(500).json({ error: "Failed to fetch trending" });
  }
});

router.get("/featured", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const services = await db.select().from(servicesTable)
      .where(eq(servicesTable.isFeatured, true))
      .orderBy(desc(servicesTable.rating))
      .limit(12);
    const withWorkers = await Promise.all(services.map(async (s) => {
      const [worker] = await db.select().from(usersTable).where(eq(usersTable.id, s.workerId)).limit(1);
      const { passwordHash: _, ...safeWorker } = worker || {};
      return { ...s, worker: safeWorker };
    }));
    res.json({ services: withWorkers, total: withWorkers.length });
  } catch (err) {
    req.log.error({ err }, "Featured error");
    res.status(500).json({ error: "Failed to fetch featured" });
  }
});

router.get("/:id", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const service = await getServiceWithWorker(req.params.id);
    if (!service) { res.status(404).json({ error: "Service not found" }); return; }
    await db.update(servicesTable).set({ viewCount: sql`${servicesTable.viewCount} + 1` }).where(eq(servicesTable.id, req.params.id));
    const reviews = await db.select().from(reviewsTable).where(eq(reviewsTable.serviceId, req.params.id)).limit(20);
    res.json({ ...service, reviews });
  } catch (err) {
    req.log.error({ err }, "Get service error");
    res.status(500).json({ error: "Failed to get service" });
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, category, subcategory, priceType, price, location, coverageArea, photos } = req.body;
    const [service] = await db.insert(servicesTable).values({
      id: generateId(),
      workerId: req.user!.id,
      title,
      description,
      category,
      subcategory,
      priceType: priceType || "negotiable",
      price: price ? parseFloat(price) : null,
      priceDisplay: price ? `MK ${parseInt(price).toLocaleString()}` : "Negotiable",
      location,
      coverageArea: coverageArea || [],
      photos: photos || [],
      isOnline: true,
    }).returning();
    const [worker] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
    const { passwordHash: _, ...safeWorker } = worker;
    res.status(201).json({ ...service, worker: safeWorker });
  } catch (err) {
    req.log.error({ err }, "Create service error");
    res.status(500).json({ error: "Failed to create service" });
  }
});

router.put("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, req.params.id)).limit(1);
    if (!service) { res.status(404).json({ error: "Service not found" }); return; }
    if (service.workerId !== req.user!.id && req.user!.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
    const { title, description, price, priceType, isOnline, photos } = req.body;
    const [updated] = await db.update(servicesTable)
      .set({ title, description, price, priceType, isOnline, photos, updatedAt: new Date() })
      .where(eq(servicesTable.id, req.params.id))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update service error");
    res.status(500).json({ error: "Failed to update service" });
  }
});

router.delete("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, req.params.id)).limit(1);
    if (!service) { res.status(404).json({ error: "Service not found" }); return; }
    if (service.workerId !== req.user!.id && req.user!.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
    await db.delete(servicesTable).where(eq(servicesTable.id, req.params.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete service error");
    res.status(500).json({ error: "Failed to delete service" });
  }
});

router.post("/:id/book", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const service = await getServiceWithWorker(req.params.id);
    if (!service) { res.status(404).json({ error: "Service not found" }); return; }
    await db.update(servicesTable).set({ bookingCount: sql`${servicesTable.bookingCount} + 1` }).where(eq(servicesTable.id, req.params.id));
    res.status(201).json({
      id: generateId(),
      serviceId: req.params.id,
      customerId: req.user!.id,
      workerId: service.workerId,
      status: "pending",
      message: req.body.message,
      scheduledAt: req.body.scheduledAt,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Book service error");
    res.status(500).json({ error: "Failed to book service" });
  }
});

export default router;
