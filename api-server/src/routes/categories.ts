import { Router } from "express";
import { db } from "@workspace/db";
import { categoriesTable } from "@workspace/db";
import { asc } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const categories = await db.select().from(categoriesTable).orderBy(asc(categoriesTable.sortOrder));
    res.json({ categories });
  } catch (err) {
    req.log.error({ err }, "List categories error");
    res.status(500).json({ error: "Failed to list categories" });
  }
});

export default router;
