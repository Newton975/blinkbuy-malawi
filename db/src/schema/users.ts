import { pgTable, text, boolean, integer, real, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["customer", "worker", "both", "admin"]);

export const usersTable = pgTable("users", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  role: userRoleEnum("role").notNull().default("customer"),
  location: text("location"),
  profilePhoto: text("profile_photo"),
  bio: text("bio"),
  isOnline: boolean("is_online").default(false),
  isVerified: boolean("is_verified").default(false),
  isTrusted: boolean("is_trusted").default(false),
  isSuspended: boolean("is_suspended").default(false),
  rating: real("rating").default(0),
  reviewCount: integer("review_count").default(0),
  jobsCompleted: integer("jobs_completed").default(0),
  profileStrength: integer("profile_strength").default(20),
  priceRange: text("price_range"),
  servicesOffered: text("services_offered").array(),
  workPhotos: text("work_photos").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
