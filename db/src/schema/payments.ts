import { pgTable, text, real, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const paymentMethodEnum = pgEnum("payment_method", ["airtel_money", "tnm_mpamba"]);
export const paymentPurposeEnum = pgEnum("payment_purpose", ["featured_listing", "verified_badge", "ad"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "confirmed", "rejected"]);

export const paymentsTable = pgTable("payments", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("MWK"),
  method: paymentMethodEnum("method").notNull(),
  purpose: paymentPurposeEnum("purpose").notNull(),
  proofImageUrl: text("proof_image_url"),
  transactionRef: text("transaction_ref"),
  status: paymentStatusEnum("status").notNull().default("pending"),
  serviceId: text("service_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
