import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import type { Response } from "express";

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { unreadOnly, limit = "30" } = req.query as Record<string, string>;
    const conditions: ReturnType<typeof eq>[] = [eq(notificationsTable.userId, req.user!.id)];
    if (unreadOnly === "true") conditions.push(eq(notificationsTable.isRead, false));

    const notifications = await db.select().from(notificationsTable)
      .where(and(...conditions))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(parseInt(limit));

    const [unreadResult] = await db.select({ count: sql<number>`count(*)` }).from(notificationsTable)
      .where(and(eq(notificationsTable.userId, req.user!.id), eq(notificationsTable.isRead, false)));

    res.json({ notifications, unreadCount: Number(unreadResult.count), total: notifications.length });
  } catch (err) {
    req.log.error({ err }, "List notifications error");
    res.status(500).json({ error: "Failed to list notifications" });
  }
});

router.put("/read-all", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.userId, req.user!.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Mark all read error");
    res.status(500).json({ error: "Failed to mark notifications as read" });
  }
});

export default router;
