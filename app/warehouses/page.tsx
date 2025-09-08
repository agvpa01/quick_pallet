"use client";

import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function WarehousesPage() {
  const warehouses = useQuery(api.warehouses.listWarehouses, {});
  const sync = useAction(api.warehouses.syncFromUnleashed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = (warehouses ?? []).filter((w: any) =>
    query ? `${w.name ?? ''} ${w.code ?? ''}`.toLowerCase().includes(query.toLowerCase()) : true,
  );

  return (
    <main className="p-8 max-w-6xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-3xl font-bold">Warehouses</h1>
        <div className="flex items-center gap-3">
          <Button
            onClick={async () => {
              setError(null);
              setLoading(true);
              try {
                await sync({});
              } catch (e: any) {
                setError(e?.message ?? "Failed to sync");
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
          >
            {loading ? "Syncing..." : "Sync from Unleashed"}
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3 items-end">
        <div className="md:col-span-1">
          <Label htmlFor="q">Search</Label>
          <Input id="q" placeholder="Name or code" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {warehouses === undefined ? (
        <p>Loading warehouses...</p>
      ) : filtered.length === 0 ? (
        <p>No warehouses.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((w: any) => (
            <Card key={w._id as string}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate" title={w.name}>{w.name}</span>
                  {w.isDefault && (
                    <span className="text-xs rounded bg-accent text-accent-foreground px-2 py-0.5">Default</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">Code: {w.code}</div>
                {w.description && (
                  <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{w.description}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}

