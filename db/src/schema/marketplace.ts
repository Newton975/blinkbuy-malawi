import { pgTable, text, real, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const itemTypeEnum = pgEnum("item_type", ["sale", "rent"]);

export const marketplaceItemsTable = pgTable("marketplace_items", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  sellerId: text("seller_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  type: itemTypeEnum("type").notNull().default("sale"),
  price: real("price").notNull(),
  priceNegotiable: boolean("price_negotiable").default(false),
  location: text("location").notNull(),
  photos: text("photos").array(),
  condition: text("condition"),
  isAvailable: boolean("is_available").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMarketplaceItemSchema = createInsertSchema(marketplaceItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMarketplaceItem = z.infer<typeof insertMarketplaceItemSchema>;
export type MarketplaceItem = typeof marketplaceItemsTable.$inferSelect;
