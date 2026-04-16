import { Router } from "express";
import { db } from "@workspace/db";
import { conversationsTable, messagesTable, usersTable } from "@workspace/db";
import { eq, and, or, desc, lt, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { generateId } from "../lib/auth";
import type { Response } from "express";

const router = Router();

async function getConversationWithParticipants(conv: typeof conversationsTable.$inferSelect) {
  const [p1] = await db.select().from(usersTable).where(eq(usersTable.id, conv.participant1Id)).limit(1);
  const [p2] = await db.select().from(usersTable).where(eq(usersTable.id, conv.participant2Id)).limit(1);
  const { passwordHash: _1, ...safe1 } = p1 || {};
  const { passwordHash: _2, ...safe2 } = p2 || {};
  let lastMessage = null;
  if (conv.lastMessageId) {
    const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, conv.lastMessageId)).limit(1);
    lastMessage = msg;
  }
  return { ...conv, participants: [safe1, safe2], lastMessage };
}

router.get("/conversations", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversations = await db.select().from(conversationsTable)
      .where(or(eq(conversationsTable.participant1Id, userId), eq(conversationsTable.participant2Id, userId)))
      .orderBy(desc(conversationsTable.updatedAt));
    const withParticipants = await Promise.all(conversations.map(getConversationWithParticipants));
    res.json({ conversations: withParticipants, total: withParticipants.length });
  } catch (err) {
    req.log.error({ err }, "List conversations error");
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

router.post("/conversations", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { participantId, initialMessage } = req.body;
    const userId = req.user!.id;

    // Check existing conversation
    const existing = await db.select().from(conversationsTable)
      .where(or(
        and(eq(conversationsTable.participant1Id, userId), eq(conversationsTable.participant2Id, participantId)),
        and(eq(conversationsTable.participant1Id, participantId), eq(conversationsTable.participant2Id, userId))
      ))
      .limit(1);

    let conv = existing[0];
    if (!conv) {
      const [created] = await db.insert(conversationsTable).values({
        id: generateId(),
        participant1Id: userId,
        participant2Id: participantId,
        unreadCount1: 0,
        unreadCount2: 0,
      }).returning();
      conv = created;
    }

    if (initialMessage) {
      const msgId = generateId();
      await db.insert(messagesTable).values({
        id: msgId,
        conversationId: conv.id,
        senderId: userId,
        content: initialMessage,
        type: "text",
        isRead: false,
      });
      await db.update(conversationsTable).set({ lastMessageId: msgId, updatedAt: new Date(), unreadCount2: sql`${conversationsTable.unreadCount2} + 1` }).where(eq(conversationsTable.id, conv.id));
    }

    const withParticipants = await getConversationWithParticipants(conv);
    res.json(withParticipants);
  } catch (err) {
    req.log.error({ err }, "Create conversation error");
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/conversations/:id/messages", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = "50", before } = req.query as Record<string, string>;
    const conditions: ReturnType<typeof eq>[] = [eq(messagesTable.conversationId, req.params.id)];
    if (before) conditions.push(lt(messagesTable.createdAt, new Date(before)));

    const messages = await db.select().from(messagesTable)
      .where(and(...conditions))
      .orderBy(desc(messagesTable.createdAt))
      .limit(parseInt(limit));

    const withSenders = await Promise.all(messages.reverse().map(async (m) => {
      const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, m.senderId)).limit(1);
      const { passwordHash: _, ...safeSender } = sender || {};
      return { ...m, sender: safeSender };
    }));

    res.json({ messages: withSenders, total: withSenders.length });
  } catch (err) {
    req.log.error({ err }, "Get messages error");
    res.status(500).json({ error: "Failed to get messages" });
  }
});

router.post("/conversations/:id/messages", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { content, type = "text" } = req.body;
    const msgId = generateId();
    const [msg] = await db.insert(messagesTable).values({
      id: msgId,
      conversationId: req.params.id,
      senderId: req.user!.id,
      content,
      type: type as "text" | "image" | "quick_reply" | "system",
      isRead: false,
    }).returning();

    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, req.params.id)).limit(1);
    if (conv) {
      const isP1 = conv.participant1Id === req.user!.id;
      await db.update(conversationsTable).set({
        lastMessageId: msgId,
        updatedAt: new Date(),
        unreadCount1: isP1 ? conv.unreadCount1 || 0 : sql`${conversationsTable.unreadCount1} + 1`,
        unreadCount2: isP1 ? sql`${conversationsTable.unreadCount2} + 1` : conv.unreadCount2 || 0,
      }).where(eq(conversationsTable.id, req.params.id));
    }

    const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
    const { passwordHash: _, ...safeSender } = sender;
    res.status(201).json({ ...msg, sender: safeSender });
  } catch (err) {
    req.log.error({ err }, "Send message error");
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.put("/conversations/:id/read", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, req.params.id)).limit(1);
    if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
    const isP1 = conv.participant1Id === req.user!.id;
    await db.update(conversationsTable).set({
      unreadCount1: isP1 ? 0 : conv.unreadCount1,
      unreadCount2: isP1 ? conv.unreadCount2 : 0,
    }).where(eq(conversationsTable.id, req.params.id));
    await db.update(messagesTable).set({ isRead: true })
      .where(and(eq(messagesTable.conversationId, req.params.id)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Mark read error");
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

export default router;
