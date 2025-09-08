"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { createHmac } from "crypto";

export const fetchUnleashedProducts = action({
  args: {
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    productCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const endpoint = (process.env.UNLEASHED_API_ENDPOINT ?? "https://api.unleashedsoftware.com/").replace(/\/+$/, "");
    const apiId = process.env.UNLEASHED_API_ID;
    const apiKey = process.env.UNLEASHED_API_KEY;

    if (!apiId || !apiKey) {
      throw new Error("Missing UNLEASHED_API_ID or UNLEASHED_API_KEY environment variables");
    }

    // Build query string in a deterministic order
    const params = new URLSearchParams();
    if (args.page !== undefined) params.append("page", String(args.page));
    if (args.pageSize !== undefined) params.append("pageSize", String(args.pageSize));
    if (args.productCode) params.append("productCode", args.productCode);

    const queryString = params.toString(); // Do NOT include the leading '?'

    // Unleashed signature: HMAC-SHA256 over the query string (empty string allowed), secret = API key, base64 output
    const signature = createHmac("sha256", apiKey).update(queryString, "utf8").digest("base64");

    const url = `${endpoint}/Products${queryString ? `?${queryString}` : ""}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-auth-id": apiId,
        "api-auth-signature": signature,
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Unleashed API error ${res.status}: ${text}`);
    }

    return res.json();
  },
});

export const fetchUnleashedWarehouses = action({
  args: {
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const endpoint = (process.env.UNLEASHED_API_ENDPOINT ?? "https://api.unleashedsoftware.com/").replace(/\/+$/, "");
    const apiId = process.env.UNLEASHED_API_ID;
    const apiKey = process.env.UNLEASHED_API_KEY;

    if (!apiId || !apiKey) {
      throw new Error("Missing UNLEASHED_API_ID or UNLEASHED_API_KEY environment variables");
    }

    const params = new URLSearchParams();
    if (args.page !== undefined) params.append("page", String(args.page));
    if (args.pageSize !== undefined) params.append("pageSize", String(args.pageSize));

    const queryString = params.toString();
    const signature = createHmac("sha256", apiKey).update(queryString, "utf8").digest("base64");

    const url = `${endpoint}/Warehouses${queryString ? `?${queryString}` : ""}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-auth-id": apiId,
        "api-auth-signature": signature,
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Unleashed API error ${res.status}: ${text}`);
    }

    return res.json();
  },
});
