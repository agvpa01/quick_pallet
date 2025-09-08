import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

export const listWarehouses = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db.query("warehouses").order("asc").collect();
  },
});

export const upsertWarehouse = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("warehouses")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        description: args.description,
        isDefault: args.isDefault,
      });
      return { id: existing._id, updated: true } as const;
    } else {
      const id = await ctx.db.insert("warehouses", {
        code: args.code,
        name: args.name,
        description: args.description,
        isDefault: args.isDefault,
      });
      return { id, updated: false } as const;
    }
  },
});

export const syncFromUnleashed = action({
  args: {
    pageSize: v.optional(v.number()),
    maxPages: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const pageSize = args.pageSize ?? 200;
    const maxPages = args.maxPages;
    let inserted = 0;
    let updated = 0;
    let page = 0;

    while (true) {
      page++;
      const resp: any = await ctx.runAction(api.unleashed.fetchUnleashedWarehouses, { page, pageSize });
      const items = Array.isArray(resp?.Items)
        ? resp.Items
        : Array.isArray(resp?.items)
        ? resp.items
        : Array.isArray(resp?.Warehouses)
        ? resp.Warehouses
        : Array.isArray(resp?.warehouses)
        ? resp.warehouses
        : [];

      for (const it of items) {
        const code = String(
          it?.WarehouseCode ?? it?.warehouseCode ?? it?.Code ?? it?.code ?? it?.Id ?? it?.id ?? ""
        ).trim();
        if (!code) continue;
        const name = String(
          it?.WarehouseName ?? it?.warehouseName ?? it?.Name ?? it?.name ?? code
        ).trim();
        const description = (it?.Description as string | undefined) ?? undefined;
        const isDefault = Boolean(it?.IsDefault ?? it?.isDefault ?? false);

        const res = await ctx.runMutation(api.warehouses.upsertWarehouse, {
          code,
          name,
          description: description?.trim() || undefined,
          isDefault,
        });
        if (res.updated) updated++; else inserted++;
      }

      const totalPages = resp?.Pagination?.NumberOfPages ?? resp?.pagination?.numberOfPages;
      if (items.length < pageSize) break;
      if (typeof maxPages === "number" && page >= maxPages) break;
      if (typeof totalPages === "number" && page >= totalPages) break;
      if (page >= 1000) break; // safety cap
    }

    return { inserted, updated };
  },
});

