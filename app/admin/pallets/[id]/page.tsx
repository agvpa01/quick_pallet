"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { use as usePromise, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function PalletDetail({ params }: any) {
  const { id } = usePromise(params) as { id: string };
  const palletsList = useQuery(api.pallets.listPallets, {});
  const resolvedId = useMemo(() => {
    const raw = String(id ?? "");
    const list = palletsList ?? [];
    const byId = list.find((p: any) => String(p._id) === raw);
    if (byId) return String(byId._id);
    const byName = list.find((p: any) => String(p.name ?? "") === raw);
    return byName ? String(byName._id) : null;
  }, [id, palletsList]);
  const palletRaw = useQuery(
    api.pallets.getPallet,
    resolvedId ? ({ id: resolvedId } as any) : undefined,
  );
  const pallet =
    palletsList !== undefined && resolvedId === null
      ? null
      : (palletRaw as any);
  const getQrUrl = useAction(api.pallets.getQrUrl);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const products = useQuery(api.products.listProducts, {});
  const setAll = useMutation(api.pallets.setPalletItems);
  const [selected, setSelected] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [items, setItems] = useState<{ productId: string; quantity: number }[]>(
    [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const productMap = useMemo(() => {
    const m = new Map<string, string>();
    (products ?? []).forEach((p: any) => m.set(String(p._id), p.name));
    return m;
  }, [products]);

  useEffect(() => {
    (async () => {
      if (pallet?.qrStorageId) {
        try {
          const u = await getQrUrl({ storageId: pallet.qrStorageId });
          setQrUrl(String(u));
        } catch {}
      } else {
        setQrUrl(null);
      }
    })();
  }, [pallet?.qrStorageId]);

  // Initialize editable items when pallet loads
  useEffect(() => {
    if (pallet && Array.isArray(pallet.items)) {
      setItems(
        pallet.items.map((it: any) => ({
          productId: String(it.productId),
          quantity: it.quantity,
        })),
      );
    }
  }, [pallet && (pallet as any)._id]);

  const addItem = () => {
    if (!selected || qty <= 0) return;
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === selected);
      if (existing)
        return prev.map((i) =>
          i.productId === selected ? { ...i, quantity: i.quantity + qty } : i,
        );
      return [...prev, { productId: selected, quantity: qty }];
    });
    setQty(1);
  };

  if (pallet === undefined) {
    return <div className="p-6">Loading…</div>;
  }
  if (pallet === null) {
    return <div className="p-6">Pallet not found.</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-0">
      <div className="sm:rounded-md sm:border sm:bg-card sm:shadow">
        <div className="no-print px-0 sm:px-4 sm:py-3 border-b sm:border-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Link
                href="/admin/pallets"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                ← Back
              </Link>
              <CardTitle className="break-words">Pallet {pallet.name}</CardTitle>
            </div>
            <div className="sm:self-auto">
              {qrUrl ? (
                <a
                  href={qrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Open QR
                </a>
              ) : (
                <Button className="no-print" size="sm" variant="outline" disabled>
                  Open QR
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="px-0 sm:px-4 sm:pb-4">
          <div className="grid gap-6 md:grid-cols-[240px_1fr] items-start qr-print-layout">
            <div className="flex flex-col items-center gap-2 qr-print">
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt="Pallet QR"
                  className="qr-print-img w-full max-w-xs sm:max-w-sm h-auto border rounded bg-white p-2 object-contain"
                />
              ) : (
                <div className="h-60 w-60 grid place-items-center border rounded text-xs text-muted-foreground">
                  No QR
                </div>
              )}
              <div className="text-sm font-mono qr-code-text">{pallet.name}</div>
              <div className="sm:hidden">
                {qrUrl ? (
                  <a
                    href={qrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Open QR
                  </a>
                ) : null}
              </div>
            </div>
            <div className="no-print">
              <div className="text-sm text-muted-foreground mb-2">Items</div>
              <div className="grid md:grid-cols-[1fr_auto_auto] gap-3 items-end max-w-3xl mb-3">
                <div className="grid gap-2">
                  <Label htmlFor="prod">Product</Label>
                  <ProductSelect products={(products ?? []) as any[]} value={selected} onChange={setSelected} />
                </div>
                <div className="grid gap-2 w-32">
                  <Label htmlFor="qty">Qty</Label>
                  <Input id="qty" type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value || 1))} />
                </div>
                <div>
                  <Button onClick={addItem} disabled={!selected || qty <= 0}>Add item</Button>
                </div>
              </div>
              <div className="rounded-md border overflow-hidden">
                <div className="grid grid-cols-[1fr_auto] bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <div>Product</div>
                  <div className="text-right">Qty</div>
                </div>
                <div className="divide-y">
                  {items.map((it, idx) => (
                    <div key={String(it.productId)} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] px-3 py-2 text-sm sm:items-center">
                      <div className="whitespace-normal break-words sm:truncate">
                        {productMap.get(String(it.productId)) ?? String(it.productId)}
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
                        <Input
                          className="h-8 w-24 sm:w-20"
                          type="number"
                          min={0}
                          value={it.quantity}
                          onChange={(e) => {
                            const v = Math.max(0, Number(e.target.value || 0));
                            setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, quantity: v } : p)));
                          }}
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="text-white"
                          onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <Button
                  disabled={saving}
                  onClick={async () => {
                    if (!pallet) return;
                    setError(null);
                    setSaving(true);
                    try {
                      await setAll({
                        palletId: (pallet as any)._id,
                        items: items.map((i) => ({ productId: i.productId as any, quantity: i.quantity })),
                      });
                    } catch (e: any) {
                      setError(e?.message ?? "Failed to update pallet");
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? "Updating…" : "Update Pallet"}
                </Button>
                {error && <span className="text-sm text-red-600">{error}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductSelect({
  products,
  value,
  onChange,
}: {
  products: any[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p: any) =>
      q ? `${p.name ?? ""} ${p.code ?? ""}`.toLowerCase().includes(q) : true,
    );
  }, [products, query]);
  const current = products.find((p: any) => String(p._id) === value);
  return (
    <div className="relative">
      <button
        type="button"
        className="h-9 w-full rounded-md border bg-background px-3 text-left text-sm flex items-center justify-between"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="truncate">
          {current ? `${current.name} (${current.code})` : "Select a product…"}
        </span>
        <span className="ml-2 text-muted-foreground">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-w-2xl max-h-64 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="p-2 border-b bg-background">
            <Input
              autoFocus
              placeholder="Search products"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8"
            />
          </div>
          <ul className="py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-xs text-muted-foreground">
                No results
              </li>
            )}
            {filtered.map((p: any) => (
              <li key={String(p._id)}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    onChange(String(p._id));
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="truncate block">
                    {p.name} ({p.code})
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}




