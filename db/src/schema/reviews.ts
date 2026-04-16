import { pgTable, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { servicesTable } from "./services";
import { jobsTable } from "./jobs";

export const reviewsTable = pgTable("reviews", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  reviewerId: text("reviewer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  workerId: text("worker_id").references(() => usersTable.id, { onDelete: "cascade" }),
  serviceId: text("service_id").references(() => servicesTable.id, { onDelete: "cascade" }),
  jobId: text("job_id").references(() => jobsTable.id, { onDelete: "cascade" }),
  rating: real("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({ id: true, createdAt: true });
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviewsTable.$inferSelect;
