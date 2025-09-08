import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,
  numbers: defineTable({
    value: v.number(),
  }),
  products: defineTable({
    code: v.string(),
    name: v.string(),
    price: v.optional(v.number()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  }).index("by_code", ["code"]),
  warehouses: defineTable({
    code: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  }).index("by_code", ["code"]),
  sync_status: defineTable({
    userId: v.string(),
    status: v.string(), // running | completed | error
    batches: v.number(),
    inserted: v.number(),
    updated: v.number(),
    message: v.optional(v.string()),
    startedAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),
  pallets: defineTable({
    userId: v.string(),
    name: v.string(),
    items: v.array(
      v.object({
        productId: v.id("products"),
        quantity: v.number(),
      }),
    ),
    qrStorageId: v.optional(v.id("_storage")),
  }).index("by_userId", ["userId"]),
});
