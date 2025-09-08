"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";

type ItemDraft = { productId: string; quantity: number };

export default function PalletsPage() {
  const router = useRouter();
  const products = useQuery(api.products.listProducts, {});
  const pallets = useQuery(api.pallets.listPallets, {});
  const createPallet = useAction(api.pallets.createPallet);
  const getQrUrl = useAction(api.pallets.getQrUrl);
  const bulkCreate = useAction((api as any).pallets.bulkCreatePallets);
  const deletePallet = useMutation(api.pallets.deletePallet);

  // List filters + modal state
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  // Create form state (used in modal)
  const [name, setName] = useState(() => genPalletCode());
  const [selected, setSelected] = useState("");
  const [qty, setQty] = useState(1);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedPallets, setSelectedPallets] = useState<Set<string>>(
    new Set(),
  );
  const [openBatch, setOpenBatch] = useState(false);
  const [batchCount, setBatchCount] = useState<number>(10);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  const productMap = useMemo(() => {
    const map = new Map<string, { name?: string; code?: string }>();
    (products ?? []).forEach((p: any) =>
      map.set(String(p._id), { name: p.name, code: p.code }),
    );
    return map;
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (pallets ?? []).filter((p: any) =>
      q
        ? String(p.name ?? "")
            .toLowerCase()
            .includes(q)
        : true,
    );
  }, [pallets, search]);

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

  return (
    <main className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-3xl font-bold">Pallets</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => router.push("/scan")}>
            Scan QR
          </Button>
          <Button onClick={() => setOpen(true)}>New Pallet</Button>
          <Button variant="secondary" onClick={() => setOpenBatch(true)}>
            Batch Create
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 items-end">
        <div className="md:col-span-1">
          <Label htmlFor="q">Search</Label>
          <Input
            id="q"
            placeholder="Name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label>Selection</Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const next = new Set<string>(selectedPallets);
                (filtered ?? []).forEach((p: any) => next.add(String(p._id)));
                setSelectedPallets(next);
              }}
            >
              Select All (filtered)
            </Button>
            <Button
              variant="outline"
              onClick={() => setSelectedPallets(new Set())}
            >
              Clear Selection
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const list = pallets ?? [];
                const chosen =
                  selectedPallets.size > 0
                    ? list.filter((p: any) =>
                        selectedPallets.has(String(p._id)),
                      )
                    : list;
                downloadAllQrPdf(chosen, getQrUrl);
              }}
            >
              {selectedPallets.size > 0
                ? `Download Selected (${selectedPallets.size})`
                : "Download QR PDF"}
            </Button>
          </div>
        </div>
      </div>

      {pallets === undefined ? (
        <p>Loading pallets...</p>
      ) : filtered.length === 0 ? (
        <p>No pallets found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p: any) => (
            <Card
              key={String(p._id)}
              role="button"
              tabIndex={0}
              className="relative cursor-pointer hover:bg-accent/40 transition-colors rounded-br-none"
              onClick={() => router.push(`/admin/pallets/${String(p._id)}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/admin/pallets/${String(p._id)}`);
                }
              }}
            >
              {(() => {
                const c = (p.items?.length ?? 0) as number;
                const cls =
                  c === 0
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-orange-100 text-orange-700";
                return (
                  <span
                    className={`absolute top-2 right-2 text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}
                  >
                    {c} items
                  </span>
                );
              })()}
              <label
                className="absolute top-1 left-2 z-10"
                onClick={(e) => e.stopPropagation()}
                title="Select pallet"
              >
                <Checkbox
                  className="rounded-md"
                  checked={selectedPallets.has(String(p._id))}
                  onChange={(e) => {
                    const next = new Set<string>(selectedPallets);
                    const key = String(p._id);
                    if ((e.target as HTMLInputElement).checked) next.add(key);
                    else next.delete(key);
                    setSelectedPallets(next);
                  }}
                />
              </label>
              <CardHeader>
                <CardTitle className="pl-10 truncate" title={p.name}>
                  {p.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm("Delete this pallet?")) return;
                      try {
                        await deletePallet({ palletId: p._id });
                      } catch (err) {
                        alert(
                          err instanceof Error
                            ? err.message
                            : "Failed to delete",
                        );
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal for creating pallet */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-3xl bg-background rounded-lg border shadow-md">
            <div className="flex items-center justify-between px-6 py-3 border-b">
              <div className="font-semibold">Create Pallet</div>
              <button
                className="text-sm underline"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="p-6">
              <div className="grid gap-4">
                <div className="grid gap-2 max-w-md">
                  <Label htmlFor="pname">Pallet name</Label>
                  <div className="flex gap-2">
                    <Input
                      id="pname"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="PLT-20250101-ABCD"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setName(genPalletCode())}
                    >
                      Regenerate
                    </Button>
                  </div>
                </div>

                <div className="grid md:grid-cols-[1fr_auto_auto] gap-3 items-end max-w-3xl">
                  <div className="grid gap-2">
                    <Label htmlFor="prod">Product</Label>
                    <ProductSelect
                      products={(products ?? []) as any[]}
                      value={selected}
                      onChange={setSelected}
                    />
                  </div>
                  <div className="grid gap-2 w-32">
                    <Label htmlFor="qty">Qty</Label>
                    <Input
                      id="qty"
                      type="number"
                      min={1}
                      value={qty}
                      onChange={(e) => setQty(Number(e.target.value || 1))}
                    />
                  </div>
                  <div>
                    <Button onClick={addItem} disabled={!selected || qty <= 0}>
                      Add item
                    </Button>
                  </div>
                </div>

                {items.length > 0 && (
                  <div className="rounded-md border overflow-hidden">
                    <div className="grid grid-cols-[1fr_auto] bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                      <div>Item</div>
                      <div className="text-right">Quantity</div>
                    </div>
                    <div className="divide-y">
                      {items.map((it) => (
                        <div
                          key={it.productId}
                          className="grid grid-cols-[1fr_auto] px-3 py-2 text-sm items-center"
                        >
                          <div className="truncate">
                            {productMap.get(it.productId)?.name} (
                            {productMap.get(it.productId)?.code})
                          </div>
                          <div className="flex items-center gap-2 justify-end">
                            <span>{it.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setItems((prev) =>
                                  prev.filter(
                                    (p) => p.productId !== it.productId,
                                  ),
                                )
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Button
                    disabled={saving || !name}
                    onClick={async () => {
                      setError(null);
                      setSaving(true);
                      try {
                        const payload = {
                          name,
                          items: items.map((i) => ({
                            productId: i.productId as any,
                            quantity: i.quantity,
                          })),
                        } as any;
                        await createPallet(payload);
                        setItems([]);
                        setName(genPalletCode());
                        setOpen(false);
                      } catch (err: unknown) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Failed to create pallet",
                        );
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    {saving ? "Saving…" : "Save pallet"}
                  </Button>
                  {error && (
                    <span className="text-sm text-red-600">{error}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal for batch creating pallets */}
      {openBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpenBatch(false)}
          />
          <div className="relative z-10 w-full max-w-md bg-background rounded-lg border shadow-md">
            <div className="flex items-center justify-between px-6 py-3 border-b">
              <div className="font-semibold">Batch Create Pallets</div>
              <button
                className="text-sm underline"
                onClick={() => setOpenBatch(false)}
              >
                Close
              </button>
            </div>
            <div className="p-6">
              <div className="grid gap-4">
                <div className="grid gap-2 max-w-xs">
                  <Label htmlFor="batch">Number of pallets</Label>
                  <Input
                    id="batch"
                    type="number"
                    min={1}
                    max={200}
                    value={batchCount}
                    onChange={(e) =>
                      setBatchCount(
                        Math.max(1, Math.min(200, Number(e.target.value || 1))),
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Between 1 and 200
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    disabled={batchLoading}
                    onClick={async () => {
                      setBatchError(null);
                      setBatchLoading(true);
                      try {
                        await bulkCreate({ count: batchCount } as any);
                        setOpenBatch(false);
                      } catch (e: any) {
                        setBatchError(e?.message ?? "Failed to create pallets");
                      } finally {
                        setBatchLoading(false);
                      }
                    }}
                  >
                    {batchLoading ? "Creating…" : "Create"}
                  </Button>
                  {batchError && (
                    <span className="text-sm text-red-600">{batchError}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function genPalletCode(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PLT-${yyyy}${mm}${dd}-${rand}`;
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
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p: any) =>
      q ? `${p.name ?? ""} ${p.code ?? ""}`.toLowerCase().includes(q) : true,
    );
  }, [products, query]);
  const current = products.find((p: any) => String(p._id) === value);
  // Close on outside click / Escape when open
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="h-11 w-full rounded-md border bg-background px-3 text-left text-sm flex items-center justify-between cursor-pointer hover:bg-accent/40"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="truncate">
          {current ? `${current.name} (${current.code})` : "Select a product"}
        </span>
        <span className="ml-2 text-muted-foreground">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="p-2 border-b bg-background sticky top-0">
            <Input
              autoFocus
              placeholder="Search products"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9"
            />
          </div>
          <ul className="py-1" role="listbox">
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-xs text-muted-foreground">
                No results
              </li>
            )}
            {filtered.map((p: any) => {
              const selected = String(p._id) === value;
              return (
                <li key={String(p._id)}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={
                      "w-full px-3 py-3 text-left text-sm hover:bg-accent/60 focus:bg-accent/60 transition-colors " +
                      (selected ? "bg-accent/50" : "")
                    }
                    onClick={() => {
                      onChange(String(p._id));
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.code}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

async function downloadAllQrPdf(
  pallets: any[],
  getQrUrl: (args: { storageId: Id<"_storage"> }) => Promise<string | null>,
) {
  if (!pallets || pallets.length === 0) return;
  const [{ jsPDF }] = await Promise.all([import("jspdf")]);
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  // Page layout
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const cols = 2;
  const rows = 3;
  const margin = 36;
  const cellW = (pageW - margin * 2) / cols;
  const cellH = (pageH - margin * 2) / rows;

  let idx = 0;
  for (const p of pallets) {
    if (!p?.qrStorageId) continue;
    const url = await getQrUrl({ storageId: p.qrStorageId as Id<"_storage"> });
    if (!url) continue;
    try {
      const dataUrl = await svgUrlToPngDataUrl(url, 512, 512);
      const col = idx % cols;
      const row = Math.floor(idx / cols) % rows;
      if (idx > 0 && row === 0 && col === 0) doc.addPage();
      const x = margin + col * cellW;
      const y = margin + row * cellH;
      const pad = 12; // outer padding inside each cell
      const inner = 6; // extra safety padding so QR never touches edges

      // Draw the cell boundary
      doc.rect(x, y, cellW, cellH);

      // Use a perfect square area inside the cell to avoid any cropping
      const squareAvail = Math.min(cellW, cellH) - pad * 2; // max square side
      const imgSize = Math.max(0, squareAvail - inner * 2);
      const imgX = x + pad + inner + (cellW > cellH ? (cellW - cellH) / 2 : 0);
      const imgY = y + pad + inner;
      doc.addImage(dataUrl, "PNG", imgX, imgY, imgSize, imgSize);

      // Label under the QR, positioned slightly closer to the square
      doc.setFontSize(12);
      const labelY = y + pad + squareAvail + 10;
      doc.text(String(p.name ?? p._id), x + pad, labelY, {
        maxWidth: cellW - pad * 2,
      });
      idx++;
    } catch {
      // ignore
    }
  }

  doc.save("pallet_qr_codes.pdf");
}

async function svgUrlToPngDataUrl(url: string, width: number, height: number): Promise<string> {
  const svgText = await fetch(url).then((r) => r.text());
  const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
  const svgUrl = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.src = svgUrl;
    await new Promise((res, rej) => {
      img.onload = () => res(null);
      img.onerror = rej;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
