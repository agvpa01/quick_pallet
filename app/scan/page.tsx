"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";

type PalletQrPayload = { type: "pallet"; id: string };

export default function ScanPalletPage() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [palletId, setPalletId] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<any | null>(null);

  // Load pallets and products; we will resolve the active pallet client-side
  const pallets = useQuery(api.pallets.listPallets, {});
  const products = useQuery(api.products.listProducts, {});
  const addByCode = useMutation(api.pallets.addItemToPalletByCode);
  const setQty = useMutation(api.pallets.setItemQuantity);
  const removeItem = useMutation(api.pallets.removeItemFromPallet);

  const pallet = useMemo(() => {
    if (!palletId) return undefined;
    if (pallets === undefined) return undefined; // still loading the list
    const list = pallets ?? [];
    // Try by Convex id string match first
    const byId = list.find((p: any) => String(p._id) === palletId);
    if (byId) return byId;
    // Fallback: try by name/code equality (manual input like PLT-...)
    const byName = list.find((p: any) => String(p.name ?? "").toLowerCase() === palletId.toLowerCase());
    return byName ?? null;
  }, [pallets, palletId]);

  const productMap = useMemo(() => {
    const map = new Map<string, any>();
    (products ?? []).forEach((p: any) => map.set(String(p._id), p));
    return map;
  }, [products]);

  const startScan = useCallback(async () => {
    setError(null);
    setPalletId(null);
    setScanning(true);
    try {
      const hasBarcode = typeof (window as any).BarcodeDetector !== "undefined";
      if (hasBarcode) {
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const tick = async () => {
          if (!videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes && codes.length > 0) {
              const value = (codes[0] as any).rawValue ?? "";
              try {
                const parsed = JSON.parse(String(value));
                if (parsed && parsed.type === "pallet" && parsed.id) {
                  setPalletId(String(parsed.id));
                  stopScan();
                  return;
                }
              } catch (e) {
                // ignore parse errors; keep scanning
              }
            }
          } catch (e) {
            // ignore, keep scanning
          }
          timerRef.current = window.setTimeout(tick, 400);
        };
        timerRef.current = window.setTimeout(tick, 300);
        return;
      }

      // Fallback: use ZXing if BarcodeDetector is unavailable
      const ZXing: any = await import("@zxing/browser");
      const reader = new ZXing.BrowserMultiFormatReader();
      const devices: any[] = await ZXing.BrowserMultiFormatReader.listVideoInputDevices();
      const backCam = devices.find((d) => /back|rear|environment/i.test(d.label ?? ""));
      const deviceId = (backCam ?? devices[0])?.deviceId ?? null;
      if (!videoRef.current) throw new Error("Video element not ready");
      reader.decodeFromVideoDevice(deviceId, videoRef.current, (result: any, err: any, controls: any) => {
        if (controls && !zxingControlsRef.current) zxingControlsRef.current = controls;
        if (result) {
          try {
            const text = result.getText ? result.getText() : String(result.text ?? "");
            const parsed = JSON.parse(String(text));
            if (parsed && parsed.type === "pallet" && parsed.id) {
              setPalletId(String(parsed.id));
              stopScan();
              return;
            }
          } catch {
            // ignore malformed payloads
          }
        }
        // ignore NotFoundException errors (no code in frame)
      });
    } catch (e: any) {
      setError(e?.message ?? "Failed to access camera");
      setScanning(false);
      try { stopTracks(); } catch {}
    }
  }, []);

  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const stopScan = useCallback(() => {
    setScanning(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    stopTracks();
    if (zxingControlsRef.current) {
      try { zxingControlsRef.current.stop(); } catch {}
      zxingControlsRef.current = null;
    }
  }, []);

  // If authenticated and we have a pallet id, redirect to admin detail page
  useEffect(() => {
    if (isAuthenticated && palletId) {
      router.push(`/admin/pallets/${encodeURIComponent(palletId)}`);
    }
  }, [isAuthenticated, palletId, router]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      stopTracks();
    };
  }, []);

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Scan Pallet QR</h1>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Link href="/admin" className="underline text-sm hover:no-underline">Admin Dashboard</Link>
          ) : (
            <Link href="/signin" className="underline text-sm hover:no-underline">Login</Link>
          )}
          {!scanning ? (
            <Button onClick={startScan}>Start Camera</Button>
          ) : (
            <Button variant="secondary" onClick={stopScan}>Stop</Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 items-start">
        <div className="space-y-2">
          <div className="aspect-video rounded-md overflow-hidden border bg-black/60 grid place-items-center">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Or enter pallet id manually"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={() => {
                if (!manual.trim()) return;
                setPalletId(manual.trim());
                stopScan();
              }}
            >
              Load
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent>
              {!pallet && pallet !== undefined ? (
                <p className="text-sm text-muted-foreground">Scan a QR to load a pallet.</p>
              ) : pallet === undefined ? (
                <p className="text-sm text-muted-foreground">Loading pallet…</p>
              ) : pallet === null ? (
                <p className="text-sm text-red-600">Pallet not found or unauthorized.</p>
              ) : (
                <div className="space-y-1 text-sm">
                  <div><span className="text-muted-foreground">ID:</span> {String((pallet as any)._id)}</div>
                  <div><span className="text-muted-foreground">Name:</span> {(pallet as any).name}</div>
                  <div><span className="text-muted-foreground">Items:</span> {(pallet as any).items?.length ?? 0}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {pallet && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Products in Pallet</CardTitle>
              </CardHeader>
              <CardContent>
                {products === undefined ? (
                  <p className="text-sm text-muted-foreground">Loading products…</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Scan or enter product code"
                        value={manual}
                        onChange={(e) => setManual(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        onClick={async () => {
                          if (!manual.trim() || !pallet) return;
                          try {
                            await addByCode({ palletId: (pallet as any)._id, productCode: manual.trim(), quantity: 1 });
                            setManual("");
                          } catch (e: any) {
                            alert(e?.message ?? "Failed to add item");
                          }
                        }}
                      >
                        Add
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {(pallet as any).items.map((it: any, idx: number) => {
                        const prod = productMap.get(String(it.productId));
                        return (
                          <div key={idx} className="rounded-md border p-3">
                            <div className="flex items-center justify-between text-sm font-medium">
                              <div className="truncate" title={prod?.name ?? "Unknown"}>{prod?.name ?? "Unknown product"}</div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setQty({ palletId: (pallet as any)._id, productId: it.productId, quantity: Math.max(0, (it.quantity ?? 0) - 1) })}
                                >
                                  -
                                </Button>
                                <span className="text-xs text-muted-foreground">{it.quantity}</span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setQty({ palletId: (pallet as any)._id, productId: it.productId, quantity: (it.quantity ?? 0) + 1 })}
                                >
                                  +
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => removeItem({ palletId: (pallet as any)._id, productId: it.productId })}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">{prod?.code ?? String(it.productId)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
