import { pgTable, text, boolean, real, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const priceTypeEnum = pgEnum("price_type", ["fixed", "negotiable", "quote"]);

export const servicesTable = pgTable("services", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  workerId: text("worker_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  priceType: priceTypeEnum("price_type").notNull().default("negotiable"),
  price: real("price"),
  priceDisplay: text("price_display"),
  location: text("location").notNull(),
  coverageArea: text("coverage_area").array(),
  photos: text("photos").array(),
  isOnline: boolean("is_online").default(true),
  isFeatured: boolean("is_featured").default(false),
  featuredUntil: timestamp("featured_until"),
  rating: real("rating").default(0),
  reviewCount: integer("review_count").default(0),
  bookingCount: integer("booking_count").default(0),
  viewCount: integer("view_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertServiceSchema = createInsertSchema(servicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof servicesTable.$inferSelect;
