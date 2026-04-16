import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, generateToken, generateId } from "../lib/auth";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import type { Request, Response } from "express";

const router = Router();

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name, phone, whatsapp, role, location } = req.body;

    if (!email || !password || !name || !role) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }

    const passwordHash = hashPassword(password);
    const userId = generateId();

    // Admin auto-detection
    const isAdmin = email.toLowerCase() === "otechy8@gmail.com";
    const userRole = isAdmin ? "admin" : (role as "customer" | "worker" | "both");

    const [user] = await db.insert(usersTable).values({
      id: userId,
      email: email.toLowerCase(),
      passwordHash,
      name,
      phone: phone || null,
      whatsapp: whatsapp || null,
      role: userRole,
      location: location || null,
      profileStrength: 20,
    }).returning();

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.insert(sessionsTable).values({
      id: generateId(),
      userId: user.id,
      token,
      expiresAt,
    });

    const { passwordHash: _, ...safeUser } = user;
    res.status(201).json({ token, user: safeUser });
  } catch (err) {
    req.log.error({ err }, "Register error");
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    if (user.isSuspended) {
      res.status(403).json({ error: "Account suspended" });
      return;
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.insert(sessionsTable).values({
      id: generateId(),
      userId: user.id,
      token,
      expiresAt,
    });

    const { passwordHash: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (req.sessionId) {
      await db.delete(sessionsTable).where(eq(sessionsTable.id, req.sessionId));
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Logout error");
    res.status(500).json({ error: "Logout failed" });
  }
});

router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  const { passwordHash: _, ...safeUser } = req.user!;
  res.json(safeUser);
});

export default router;
