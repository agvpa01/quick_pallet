import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

export const listProducts = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db
      .query("products")
      .order("desc")
      .collect();
    return products;
  },
});

export const listProductsPaginated = query({
  args: { paginationOpts: v.any() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("products")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const getSyncStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const doc = await ctx.db
      .query("sync_status")
      .withIndex("by_userId", (q) => q.eq("userId", String(userId)))
      .first();
    return doc ?? null;
  },
});

export const upsertSyncStatus = mutation({
  args: {
    userId: v.string(),
    status: v.string(),
    batches: v.number(),
    inserted: v.number(),
    updated: v.number(),
    message: v.optional(v.string()),
    startedAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sync_status")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        batches: args.batches,
        inserted: args.inserted,
        updated: args.updated,
        message: args.message,
        updatedAt: args.updatedAt,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("sync_status", args);
    }
  },
});

export const upsertProduct = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    price: v.optional(v.number()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("products")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        price: args.price,
        description: args.description,
        imageUrl: args.imageUrl,
      });
      return { id: existing._id, updated: true } as const;
    } else {
      const id = await ctx.db.insert("products", {
        code: args.code,
        name: args.name,
        price: args.price,
        description: args.description,
        imageUrl: args.imageUrl,
      });
      return { id, updated: false } as const;
    }
  },
});

export const syncFromUnleashed = action({
  args: {
    pageSize: v.optional(v.number()),
    maxPages: v.optional(v.number()),
    maxDurationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const pageSize = args.pageSize ?? 200;
    const maxPages = args.maxPages; // if undefined, fetch until no more pages
    const maxDurationMs = args.maxDurationMs ?? 180_000; // ~3 minutes
    const started = Date.now();

    let inserted = 0;
    let updated = 0;
    let batches = 0;
    let pagesProcessed = 0;

    await ctx.runMutation(api.products.upsertSyncStatus, {
      userId: String(userId),
      status: "running",
      batches: 0,
      inserted: 0,
      updated: 0,
      message: "",
      startedAt: started,
      updatedAt: Date.now(),
    });

    const HARD_CAP = 500; // avoid infinite loops

    for (let page = 1; ; page++) {
      const resp: any = await ctx.runAction(api.unleashed.fetchUnleashedProducts, { page, pageSize });
      const items: any[] = Array.isArray(resp)
        ? resp
        : resp?.Items ?? resp?.items ?? resp?.Products ?? resp?.products ?? [];
      if (!Array.isArray(items) || items.length === 0) break;

      pagesProcessed++;
      batches++;

      const totalPages = (
        resp?.Pagination?.NumberOfPages ??
        resp?.pagination?.numberOfPages ??
        resp?.Pagination?.TotalPages ??
        resp?.pagination?.totalPages
      );

      for (const it of items) {
        const code = String(it?.ProductCode ?? it?.Code ?? it?.code ?? "").trim();
        if (!code) continue;
        const name = String(
          it?.ProductDescription ?? it?.Description ?? it?.Name ?? code
        );
        const priceRaw = it?.SellPriceTier1 ?? it?.SellPrice ?? it?.RetailPrice ?? it?.Price;
        const price =
          typeof priceRaw === "number"
            ? priceRaw
            : typeof priceRaw === "string"
            ? parseFloat(priceRaw)
            : undefined;
        const description =
          (it?.Notes as string | undefined) ??
          (it?.Description as string | undefined) ??
          (it?.ProductDescription as string | undefined);
        const imageUrl = (it?.DefaultImageUrl as string | undefined) ?? (it?.ImageUrl as string | undefined);

        const res = await ctx.runMutation(api.products.upsertProduct, {
          code,
          name,
          price: Number.isFinite(price as number) ? (price as number) : undefined,
          description: description?.trim() || undefined,
          imageUrl: imageUrl?.trim() || undefined,
        });
        if (res.updated) updated++; else inserted++;
      }

      // Termination conditions
      if (items.length < pageSize) break; // fewer than a full page means last page
      if (typeof maxPages === "number" && page >= maxPages) break;
      if (typeof totalPages === "number" && page >= totalPages) break;
      if (page >= HARD_CAP) break;
      if (Date.now() - started > maxDurationMs) break;

      // progress update
      await ctx.runMutation(api.products.upsertSyncStatus, {
        userId: String(userId),
        status: "running",
        batches,
        inserted,
        updated,
        message: `Processed page ${page}`,
        startedAt: started,
        updatedAt: Date.now(),
      });
    }

    await ctx.runMutation(api.products.upsertSyncStatus, {
      userId: String(userId),
      status: "completed",
      batches,
      inserted,
      updated,
      message: "Done",
      startedAt: started,
      updatedAt: Date.now(),
    });

    return { inserted, updated, batches, pagesProcessed };
  },
});


// Generate a signed upload URL for uploading CSVs to Convex storage
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Sync products from a CSV file stored in Convex storage
// Expected headers (case-insensitive): Product Code, Product Description, Price (optional)
export const syncFromCsv = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Unable to read uploaded CSV");
    const text = await (await fetch(url)).text();

    function parseCsv(input: string): string[][] {
      const rows: string[][] = [];
      let cur: string[] = [];
      let cell = "";
      let quoted = false;
      for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (quoted) {
          if (ch === '"') {
            if (input[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; }
          } else { cell += ch; }
        } else {
          if (ch === '"') { quoted = true; }
          else if (ch === ',') { cur.push(cell.trim()); cell = ""; }
          else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && input[i + 1] === '\n') i++;
            cur.push(cell.trim()); cell = ""; if (cur.length) rows.push(cur); cur = [];
          } else { cell += ch; }
        }
      }
      if (cell.length > 0 || cur.length > 0) { cur.push(cell.trim()); rows.push(cur); }
      return rows.filter(r => r.some(c => c.length > 0));
    }

    const rows = parseCsv(text);
    if (rows.length === 0) return { inserted: 0, updated: 0, rows: 0 };
    const header = rows[0].map(h => h.toLowerCase());
    const codeIdx = header.findIndex(h => h.includes("product code") || h === "code");
    const nameIdx = header.findIndex(h => h.includes("product description") || h === "name");
    const priceIdx = header.findIndex(h => h.includes("price"));
    if (codeIdx === -1 || nameIdx === -1) throw new Error("Missing required columns: Product Code and Product Description");

    let inserted = 0, updated = 0;
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const codeRaw = (row[codeIdx] ?? "").trim();
      const nameRaw = (row[nameIdx] ?? "").trim();
      if (!codeRaw) continue;
      const priceRaw = priceIdx >= 0 ? row[priceIdx] : undefined;
      const price = priceRaw ? Number.parseFloat(String(priceRaw).replace(/[^0-9.\-]/g, '')) : undefined;

      const res = await ctx.runMutation(api.products.upsertProduct, {
        code: codeRaw,
        name: nameRaw || codeRaw,
        price: Number.isFinite(price as number) ? (price as number) : undefined,
        description: undefined,
        imageUrl: undefined,
      });
      if (res.updated) updated++; else inserted++;
    }
    return { inserted, updated, rows: rows.length - 1 };
  },
});
