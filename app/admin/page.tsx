"use client";

import { useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Id } from "../../convex/_generated/dataModel";

export default function AdminPage() {
  const sync = useAction(api.products.syncFromUnleashed);
  const generateUploadUrl = useMutation(api.products.generateUploadUrl);
  const syncFromCsv = useAction(api.products.syncFromCsv);
  const products = useQuery(api.products.listProducts, {});
  const total = products?.length ?? 0;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    inserted: number;
    updated: number;
    batches?: number;
  } | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvResult, setCsvResult] = useState<{
    inserted: number;
    updated: number;
    rows?: number;
  } | null>(null);

  const latestPreview = useMemo(() => (products ?? []).slice(0, 8), [products]);

  return (
    <div className="space-y-6 p-4 md:p-0">
      {/* Stat Cards */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Products"
          value={products === undefined ? "..." : String(total)}
          hint="Across all sources"
        />
        <StatCard
          title="Inserted (last sync)"
          value={result ? String(result.inserted) : "0"}
          hint="New items added"
        />
        <StatCard
          title="Updated (last sync)"
          value={result ? String(result.updated) : "0"}
          hint="Existing items changed"
        />
        <StatCard
          title="Last Sync"
          value={lastSyncedAt ? lastSyncedAt.toLocaleTimeString() : "-"}
          hint={
            lastSyncedAt ? lastSyncedAt.toLocaleDateString() : "No recent sync"
          }
        />
      </section>

      {/* Visitors / Filters mimic */}
      <Card className="border-none shadow-none rounded-none bg-transparent sm:border sm:shadow sm:rounded-md sm:bg-card">
        <CardHeader className="px-0 py-3 sm:p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base md:text-lg">
              Total Visitors
            </CardTitle>
            <div className="flex gap-1 flex-wrap">
              <FilterPill active>Last 3 months</FilterPill>
              <FilterPill>Last 30 days</FilterPill>
              <FilterPill>Last 7 days</FilterPill>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="flex items-center gap-2 text-sm mb-4 flex-wrap">
            <FilterPill active>Outline</FilterPill>
            <FilterPill>Past Performance</FilterPill>
            <FilterPill>Key Personnel</FilterPill>
            <FilterPill>Focus Documents</FilterPill>
          </div>
          <div className="h-40 rounded-md border border-dashed grid place-items-center text-sm text-muted-foreground">
            Chart placeholder
          </div>
        </CardContent>
      </Card>

      {/* Sync Settings */}
      <Card className="border-none shadow-none rounded-none bg-transparent sm:border sm:shadow sm:rounded-md sm:bg-card">
        <CardHeader className="px-0 py-3 sm:p-6">
          <CardTitle className="text-base md:text-lg">
            Sync Products from Unleashed
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Pulls products from Unleashed and upserts them into Convex.
            </p>
            <DashboardSyncProgress />
            <div />
            <div className="flex gap-3 items-center">
              <Button
                onClick={async () => {
                  setError(null);
                  setResult(null);
                  setLoading(true);
                  try {
                    const res = await sync({});
                    setResult(
                      res as {
                        inserted: number;
                        updated: number;
                        batches?: number;
                      },
                    );
                    setLastSyncedAt(new Date());
                  } catch (err: unknown) {
                    setError(
                      err instanceof Error ? err.message : "Failed to sync",
                    );
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
              >
                {loading ? "Syncing..." : "Sync now"}
              </Button>
              <Link href="/admin/products" className="underline">
                View products
              </Link>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            {result && (
              <p className="text-green-600 text-sm">
                Synced. Inserted {result.inserted}, Updated {result.updated}
                {typeof result.batches === "number"
                  ? `, Batches ${result.batches}`
                  : ""}
                {lastSyncedAt ? ` at ${lastSyncedAt.toLocaleTimeString()}` : ""}
                .
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* CSV Upload */}
      <Card className="border-none shadow-none rounded-none bg-transparent sm:border sm:shadow sm:rounded-md sm:bg-card">
        <CardHeader className="px-0 py-3 sm:p-6">
          <CardTitle className="text-base md:text-lg">
            Upload Products via CSV
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV with headers Product Code, Product Description, and
              optional Price. Case-insensitive; also accepts Code and Name.
            </p>
            <div className="grid gap-2 max-w-md">
              <Label htmlFor="csv">CSV file</Label>
              <Input
                id="csv"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setCsvFile(f);
                }}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                disabled={!csvFile || csvLoading}
                onClick={async () => {
                  if (!csvFile) return;
                  setCsvError(null);
                  setCsvResult(null);
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
                    const syncRes = (await syncFromCsv({
                      storageId: json.storageId,
                    })) as any;
                    setCsvResult(syncRes ?? null);
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
                {csvLoading ? "Uploading..." : "Upload & Sync"}
              </Button>
              {csvError && (
                <span className="text-sm text-red-600">{csvError}</span>
              )}
              {csvResult && (
                <span className="text-sm text-green-600">
                  Done. Inserted {csvResult.inserted}, Updated{" "}
                  {csvResult.updated}
                  {typeof csvResult.rows === "number"
                    ? ` from ${csvResult.rows} rows`
                    : ""}
                  .
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Latest products table-like list */}
      <Card className="border-none shadow-none rounded-none bg-transparent sm:border sm:shadow sm:rounded-md sm:bg-card">
        <CardHeader className="px-0 py-3 sm:p-6">
          <CardTitle className="text-base md:text-lg">
            Latest Products
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {products === undefined ? (
            <p>Loading preview...</p>
          ) : latestPreview.length === 0 ? (
            <p>No products in database yet.</p>
          ) : (
            <>
              {/* Desktop/tablet table-like layout */}
              <div className="hidden sm:block rounded-md border overflow-hidden w-full">
                <div className="grid grid-cols-[1.5fr_1fr_0.5fr] bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <div>Name</div>
                  <div>Code</div>
                  <div className="text-right">Price</div>
                </div>
                <div className="divide-y">
                  {latestPreview.map((p: any) => (
                    <div
                      key={p._id as unknown as string}
                      className="grid grid-cols-[1.5fr_1fr_0.5fr] px-3 py-2 text-sm items-center min-w-0"
                    >
                      <div className="min-w-0 truncate">{p.name}</div>
                      <div className="min-w-0 truncate text-muted-foreground">
                        {p.code}
                      </div>
                      <div className="text-right whitespace-nowrap">
                        {typeof p.price === "number"
                          ? `$${p.price.toFixed(2)}`
                          : "-"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Mobile stacked layout */}
              <div className="sm:hidden grid gap-2 w-full min-w-0 overflow-hidden">
                {latestPreview.map((p: any) => (
                  <div
                    key={p._id as unknown as string}
                    className="rounded-md border p-3 min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm min-w-0">
                      <span className="font-medium truncate min-w-0" title={p.name}>
                        {p.name}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {typeof p.price === "number"
                          ? `$${p.price.toFixed(2)}`
                          : "-"}
                      </span>
                    </div>
                    <div
                      className="text-xs text-muted-foreground truncate min-w-0"
                      title={p.code}
                    >
                      Code: {p.code}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardSyncProgress() {
  const status = useQuery(api.products.getSyncStatus, {});
  if (!status || status.status === "completed") return null;
  const pct = Math.min(95, status.batches * 10);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Syncing products...</span>
        <span className="text-muted-foreground">
          {status.inserted + status.updated} items / {status.batches} batches
        </span>
      </div>
      <Progress value={status.status === "running" ? pct : 100} />
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{title}</div>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function FilterPill({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={
        "inline-flex items-center rounded-md border px-2.5 py-1 text-xs " +
        (active ? "bg-accent text-accent-foreground" : "bg-background")
      }
    >
      {children}
    </span>
  );
}
