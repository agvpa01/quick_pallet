import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    // In a real app, check the caller's role here.
    return await ctx.db.query("app_users").order("desc").collect();
  },
});

export const createUser = mutation({
  args: {
    email: v.string(),
    role: v.string(),
    warehouseId: v.optional(v.id("warehouses")),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const now = Date.now();
    const exists = await ctx.db
      .query("app_users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
    if (exists) throw new Error("User already exists");
    const id = await ctx.db.insert("app_users", {
      email: args.email.toLowerCase(),
      role: (args.role || "staff").toLowerCase(),
      warehouseId: args.warehouseId,
      location: args.location,
      active: true,
      createdAt: now,
    });
    return id;
  },
});

export const updateUser = mutation({
  args: {
    id: v.id("app_users"),
    email: v.optional(v.string()),
    role: v.optional(v.string()),
    warehouseId: v.optional(v.id("warehouses")),
    location: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const patch: any = {};
    if (args.email !== undefined) patch.email = args.email.toLowerCase();
    if (args.role !== undefined) patch.role = args.role.toLowerCase();
    if (args.warehouseId !== undefined) patch.warehouseId = args.warehouseId;
    if (args.location !== undefined) patch.location = args.location;
    if (args.active !== undefined) patch.active = args.active;
    await ctx.db.patch(args.id, patch);
  },
});

export const deleteUser = mutation({
  args: { id: v.id("app_users") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.delete(args.id);
  },
});

