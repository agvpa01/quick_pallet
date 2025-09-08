"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Id } from "../../convex/_generated/dataModel";

export default function ProductsPage() {
  // Sync and CSV upload actions
  const sync = useAction(api.products.syncFromUnleashed);
  const generateUploadUrl = useMutation(api.products.generateUploadUrl);
  const syncFromCsv = useAction(api.products.syncFromCsv);

  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  // Filters
  const [query, setQuery] = useState("");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");

  // Paginated products
  const { results, status, loadMore } = usePaginatedQuery(
    api.products.listProductsPaginated,
    {},
    { initialNumItems: 24 },
  );

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const el = sentinelRef.current;
    const io = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (first && first.isIntersecting && status === "CanLoadMore") {
        loadMore(24);
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [status, loadMore]);

  // Apply client-side filters
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min =
      Number.isFinite(Number(minPrice)) && minPrice !== ""
        ? Number(minPrice)
        : undefined;
    const max =
      Number.isFinite(Number(maxPrice)) && maxPrice !== ""
        ? Number(maxPrice)
        : undefined;
    return results.filter((p: any) => {
      const matchesQuery = q
        ? `${p.name ?? ""} ${p.code ?? ""}`.toLowerCase().includes(q)
        : true;
      const price = typeof p.price === "number" ? p.price : undefined;
      const matchesMin =
        typeof min === "number"
          ? typeof price === "number"
            ? price >= min
            : false
          : true;
      const matchesMax =
        typeof max === "number"
          ? typeof price === "number"
            ? price <= max
            : false
          : true;
      return matchesQuery && matchesMin && matchesMax;
    });
  }, [results, query, minPrice, maxPrice]);

  return (
    <main className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-3xl font-bold">Products</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={async () => {
              setSyncError(null);
              setSyncLoading(true);
              try {
                await sync({});
              } catch (err: unknown) {
                setSyncError(
                  err instanceof Error ? err.message : "Failed to sync",
                );
              } finally {
                setSyncLoading(false);
              }
            }}
            disabled={syncLoading}
          >
            {syncLoading ? "Syncing..." : "Sync"}
          </Button>

          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
              className="h-9 w-full md:w-48"
            />
            <Button
              disabled={!csvFile || csvLoading}
              onClick={async () => {
                if (!csvFile) return;
                setCsvError(null);
                setCsvLoading(true);
                try {
                  const url = await generateUploadUrl({});
                  const res = await fetch(url as string, {
                    method: "POST",
                    headers: { "Content-Type": csvFile.type || "text/csv" },
                    body: csvFile,
                  });
                  if (!res.ok) {
                    const txt = await res.text();
                    throw new Error(`Upload failed: ${res.status} ${txt}`);
                  }
                  const json = (await res.json()) as {
                    storageId: Id<"_storage">;
                  };
                  await syncFromCsv({ storageId: json.storageId });
                } catch (err: unknown) {
                  setCsvError(
                    err instanceof Error
                      ? err.message
                      : "Failed to upload/sync CSV",
                  );
                } finally {
                  setCsvLoading(false);
                }
              }}
            >
              {csvLoading ? "Uploading..." : "Upload CSV"}
            </Button>
          </div>
        </div>
      </div>

      {(syncError || csvError) && (
        <p className="text-sm text-red-600">{syncError ?? csvError}</p>
      )}

      {/* Filters */}
      <div className="grid gap-3 md:grid-cols-3 items-end">
        <div className="md:col-span-1">
          <Label htmlFor="q">Search</Label>
          <Input
            id="q"
            placeholder="Name or code"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="min">Min price</Label>
          <Input
            id="min"
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="e.g. 10"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="max">Max price</Label>
          <Input
            id="max"
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="e.g. 100"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </div>
      </div>

      {status === "LoadingFirstPage" && results.length === 0 ? (
        <p>Loading products...</p>
      ) : results.length === 0 ? (
        <p>No products yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p: any) => (
              <Card key={p._id as unknown as string}>
                <CardHeader>
                  <CardTitle className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-2 min-w-0">
                    <span className="font-medium whitespace-normal break-words md:truncate min-w-0" title={p.name}>
                      {p.name}
                    </span>
                    <span className="text-sm md:text-base font-normal whitespace-nowrap">
                      {typeof p.price === "number" ? `$${p.price.toFixed(2)}` : ""}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="text-xs text-muted-foreground mb-1 truncate"
                    title={p.code}
                  >
                    Code: {p.code}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {p.description ?? "No description"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div ref={sentinelRef} className="h-8" />
          {status === "CanLoadMore" && (
            <div className="text-center text-sm text-muted-foreground">
              Scroll to load more…
            </div>
          )}
          {status === "LoadingMore" && (
            <div className="text-center text-sm text-muted-foreground">
              Loading more…
            </div>
          )}
        </>
      )}
    </main>
  );
}
