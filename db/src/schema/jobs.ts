import { pgTable, text, real, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const jobUrgencyEnum = pgEnum("job_urgency", ["normal", "urgent", "emergency"]);
export const jobStatusEnum = pgEnum("job_status", ["pending", "in_progress", "completed", "cancelled"]);
export const applicationStatusEnum = pgEnum("application_status", ["pending", "accepted", "rejected"]);

export const jobsTable = pgTable("jobs", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  customerId: text("customer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  location: text("location").notNull(),
  budget: real("budget"),
  budgetDisplay: text("budget_display"),
  urgency: jobUrgencyEnum("urgency").notNull().default("normal"),
  status: jobStatusEnum("status").notNull().default("pending"),
  applicationCount: integer("application_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const jobApplicationsTable = pgTable("job_applications", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  jobId: text("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  workerId: text("worker_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  message: text("message"),
  quote: real("quote"),
  status: applicationStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertJobApplicationSchema = createInsertSchema(jobApplicationsTable).omit({ id: true, createdAt: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
export type JobApplication = typeof jobApplicationsTable.$inferSelect;
