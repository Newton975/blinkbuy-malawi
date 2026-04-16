import { pgTable, text, boolean, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const messageTypeEnum = pgEnum("message_type", ["text", "image", "quick_reply", "system"]);

export const conversationsTable = pgTable("conversations", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  participant1Id: text("participant1_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  participant2Id: text("participant2_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  lastMessageId: text("last_message_id"),
  unreadCount1: integer("unread_count1").default(0),
  unreadCount2: integer("unread_count2").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messagesTable = pgTable("messages", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  conversationId: text("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  type: messageTypeEnum("type").notNull().default("text"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Conversation = typeof conversationsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
