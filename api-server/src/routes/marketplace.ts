import { Router } from "express";
import { db } from "@workspace/db";
import { marketplaceItemsTable, usersTable } from "@workspace/db";
import { eq, and, ilike, gte, lte, desc, sql } from "drizzle-orm";
import { requireAuth, optionalAuth, type AuthRequest } from "../middlewares/auth";
import { generateId } from "../lib/auth";
import type { Response } from "express";

const router = Router();

router.get("/", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { category, type, location, search, minPrice, maxPrice, limit = "20", offset = "0" } = req.query as Record<string, string>;
    const conditions: ReturnType<typeof eq>[] = [eq(marketplaceItemsTable.isAvailable, true)];
    if (category) conditions.push(eq(marketplaceItemsTable.category, category));
    if (type) conditions.push(eq(marketplaceItemsTable.type, type as "sale" | "rent"));
    if (location) conditions.push(ilike(marketplaceItemsTable.location, `%${location}%`));
    if (search) conditions.push(ilike(marketplaceItemsTable.title, `%${search}%`));
    if (minPrice) conditions.push(gte(marketplaceItemsTable.price, parseFloat(minPrice)));
    if (maxPrice) conditions.push(lte(marketplaceItemsTable.price, parseFloat(maxPrice)));

    const items = await db.select().from(marketplaceItemsTable)
      .where(and(...conditions))
      .orderBy(desc(marketplaceItemsTable.createdAt))
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    const withSellers = await Promise.all(items.map(async (item) => {
      const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, item.sellerId)).limit(1);
      const { passwordHash: _, ...safeSeller } = seller || {};
      return { ...item, seller: safeSeller };
    }));

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(marketplaceItemsTable).where(and(...conditions));
    res.json({ items: withSellers, total: Number(countResult.count) });
  } catch (err) {
    req.log.error({ err }, "List marketplace error");
    res.status(500).json({ error: "Failed to list marketplace" });
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, category, type, price, priceNegotiable, location, photos, condition } = req.body;
    const [item] = await db.insert(marketplaceItemsTable).values({
      id: generateId(),
      sellerId: req.user!.id,
      title,
      description,
      category,
      type: type || "sale",
      price: parseFloat(price),
      priceNegotiable: priceNegotiable || false,
      location,
      photos: photos || [],
      condition,
      isAvailable: true,
    }).returning();
    const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
    const { passwordHash: _, ...safeSeller } = seller;
    res.status(201).json({ ...item, seller: safeSeller });
  } catch (err) {
    req.log.error({ err }, "Create marketplace item error");
    res.status(500).json({ error: "Failed to create item" });
  }
});

router.get("/:id", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [item] = await db.select().from(marketplaceItemsTable).where(eq(marketplaceItemsTable.id, req.params.id)).limit(1);
    if (!item) { res.status(404).json({ error: "Item not found" }); return; }
    const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, item.sellerId)).limit(1);
    const { passwordHash: _, ...safeSeller } = seller || {};
    res.json({ ...item, seller: safeSeller });
  } catch (err) {
    req.log.error({ err }, "Get marketplace item error");
    res.status(500).json({ error: "Failed to get item" });
  }
});

router.delete("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [item] = await db.select().from(marketplaceItemsTable).where(eq(marketplaceItemsTable.id, req.params.id)).limit(1);
    if (!item) { res.status(404).json({ error: "Item not found" }); return; }
    if (item.sellerId !== req.user!.id && req.user!.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
    await db.delete(marketplaceItemsTable).where(eq(marketplaceItemsTable.id, req.params.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete marketplace item error");
    res.status(500).json({ error: "Failed to delete item" });
  }
});

export default router;
