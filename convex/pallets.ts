import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import QRCode from "qrcode";

export const listPallets = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("pallets")
      .withIndex("by_userId", (q) => q.eq("userId", String(userId)))
      .order("desc")
      .collect();
  },
});

const anyApi = api as any;

function genPalletCode(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PLT-${yyyy}${mm}${dd}-${rand}`;
}

export const createPallet = action({
  args: {
    name: v.optional(v.string()),
    items: v.optional(
      v.array(v.object({ productId: v.id("products"), quantity: v.number() })),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const items = args.items ?? [];

    const palletId = await ctx.runMutation(anyApi.pallets.insertPallet, {
      userId: String(userId),
      name: (args.name ?? "").trim() || genPalletCode(),
      items,
    });

    const qrText = JSON.stringify({ type: "pallet", id: palletId });
    // Generate SVG to avoid Node Buffer dependency
    const svgMarkup: string = await (QRCode as any).toString(qrText, { type: "svg", width: 512 });
    const storageId = await ctx.storage.store(new Blob([svgMarkup], { type: "image/svg+xml" }));

    await ctx.runMutation(anyApi.pallets.setPalletQr, { palletId, storageId });

    return { id: palletId, qrStorageId: storageId } as const;
  },
});

export const insertPallet = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    items: v.array(v.object({ productId: v.id("products"), quantity: v.number() })),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("pallets", {
      userId: args.userId,
      name: args.name,
      items: args.items,
      qrStorageId: undefined,
    });
    return id;
  },
});

export const setPalletQr = mutation({
  args: { palletId: v.id("pallets"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.palletId, { qrStorageId: args.storageId });
  },
});

export const getQrUrl = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    return url;
  },
});

export const deletePallet = mutation({
  args: { palletId: v.id("pallets") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const pallet = await ctx.db.get(args.palletId);
    if (!pallet) throw new Error("Pallet not found");
    if (pallet.userId !== String(userId)) throw new Error("Forbidden");
    if (pallet.qrStorageId) {
      try {
        await ctx.storage.delete(pallet.qrStorageId);
      } catch (e) {
        // ignore
      }
    }
    await ctx.db.delete(args.palletId);
  },
});

export const getPallet = query({
  args: { id: v.id("pallets") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const pallet = await ctx.db.get(args.id);
    if (!pallet || pallet.userId !== String(userId)) return null;
    return pallet;
  },
});

// Bulk create multiple empty pallets, each with a QR stored
export const bulkCreatePallets = action({
  args: { count: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const count = Math.min(Math.max(1, Math.floor(args.count)), 200); // 1..200 safety

    const created: { id: any; name: string; qrStorageId: any }[] = [];
    for (let i = 0; i < count; i++) {
      const name = genPalletCode();
      const palletId = await ctx.runMutation((api as any).pallets.insertPallet, {
        userId: String(userId),
        name,
        items: [],
      });
      const qrText = JSON.stringify({ type: "pallet", id: palletId });
      const svgMarkup: string = await (QRCode as any).toString(qrText, { type: "svg", width: 512 });
      const storageId = await ctx.storage.store(new Blob([svgMarkup], { type: "image/svg+xml" }));
      await ctx.runMutation((api as any).pallets.setPalletQr, { palletId, storageId });
      created.push({ id: palletId, name, qrStorageId: storageId });
    }
    return created;
  },
});

// Mutations to edit pallet items after creation
export const addItemToPallet = mutation({
  args: { palletId: v.id("pallets"), productId: v.id("products"), quantity: v.number() },
  handler: async (ctx, args) => {
    if (args.quantity <= 0) throw new Error("Quantity must be positive");
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const pallet = await ctx.db.get(args.palletId);
    if (!pallet) throw new Error("Pallet not found");
    if (pallet.userId !== String(userId)) throw new Error("Forbidden");
    const items = Array.isArray(pallet.items) ? [...pallet.items] : [];
    const idx = items.findIndex((it) => String(it.productId) === String(args.productId));
    if (idx >= 0) items[idx] = { ...items[idx], quantity: items[idx].quantity + args.quantity };
    else items.push({ productId: args.productId, quantity: args.quantity });
    await ctx.db.patch(args.palletId, { items });
  },
});

export const setItemQuantity = mutation({
  args: { palletId: v.id("pallets"), productId: v.id("products"), quantity: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const pallet = await ctx.db.get(args.palletId);
    if (!pallet) throw new Error("Pallet not found");
    if (pallet.userId !== String(userId)) throw new Error("Forbidden");
    let items = Array.isArray(pallet.items) ? [...pallet.items] : [];
    const idx = items.findIndex((it) => String(it.productId) === String(args.productId));
    if (idx === -1) throw new Error("Item not found in pallet");
    if (args.quantity <= 0) items = items.filter((_, i) => i !== idx);
    else items[idx] = { ...items[idx], quantity: args.quantity };
    await ctx.db.patch(args.palletId, { items });
  },
});

export const removeItemFromPallet = mutation({
  args: { palletId: v.id("pallets"), productId: v.id("products") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const pallet = await ctx.db.get(args.palletId);
    if (!pallet) throw new Error("Pallet not found");
    if (pallet.userId !== String(userId)) throw new Error("Forbidden");
    const items = (pallet.items ?? []).filter((it) => String(it.productId) !== String(args.productId));
    await ctx.db.patch(args.palletId, { items });
  },
});

export const addItemToPalletByCode = mutation({
  args: { palletId: v.id("pallets"), productCode: v.string(), quantity: v.number() },
  handler: async (ctx, args) => {
    if (args.quantity <= 0) throw new Error("Quantity must be positive");
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const pallet = await ctx.db.get(args.palletId);
    if (!pallet) throw new Error("Pallet not found");
    if (pallet.userId !== String(userId)) throw new Error("Forbidden");
    const product = await ctx.db
      .query("products")
      .withIndex("by_code", (q) => q.eq("code", args.productCode))
      .first();
    if (!product) throw new Error("Product not found");
    const items = Array.isArray(pallet.items) ? [...pallet.items] : [];
    const idx = items.findIndex((it) => String(it.productId) === String(product._id));
    if (idx >= 0) items[idx] = { ...items[idx], quantity: items[idx].quantity + args.quantity };
    else items.push({ productId: product._id, quantity: args.quantity });
    await ctx.db.patch(args.palletId, { items });
  },
});

export const setPalletItems = mutation({
  args: {
    palletId: v.id("pallets"),
    items: v.array(v.object({ productId: v.id("products"), quantity: v.number() })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const pallet = await ctx.db.get(args.palletId);
    if (!pallet) throw new Error("Pallet not found");
    if (pallet.userId !== String(userId)) throw new Error("Forbidden");
    const normalized = args.items.filter((it) => (it.quantity ?? 0) > 0);
    await ctx.db.patch(args.palletId, { items: normalized });
  },
});

