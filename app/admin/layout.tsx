"use client";

import Link from "next/link";
import { useRouter, useSelectedLayoutSegments } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-hidden grid grid-cols-1 md:grid-cols-[240px_1fr]">
      <aside className="hidden md:flex md:flex-col border-r bg-muted/20 p-4 h-full overflow-y-auto">
        <div className="font-semibold mb-6">Quick Pallet</div>
        <nav className="text-sm space-y-1">
          <SidebarLink href="/admin" segment="">
            Dashboard
          </SidebarLink>
          <SidebarLink href="/admin/products" segment="products">
            Products
          </SidebarLink>
          <SidebarLink href="/admin/pallets" segment="pallets">
            Pallets
          </SidebarLink>
          <SidebarLink href="/admin/warehouses" segment="warehouses">
            Warehouses
          </SidebarLink>
        </nav>
      </aside>
      <main className="flex flex-col min-h-0 overflow-hidden">
        <AdminNavbar />
        <div className="p-0 md:p-8 space-y-6 overflow-y-auto min-h-0">
          {children}
        </div>
      </main>
    </div>
  );
}

function SidebarLink({ href, children, segment }: { href: string; children: React.ReactNode; segment: string }) {
  const segs = useSelectedLayoutSegments();
  const active = (segs[0] ?? "") === segment;
  return (
    <Link
      href={href}
      className={
        "block rounded-md px-2 py-1.5 hover:bg-accent hover:text-accent-foreground " +
        (active ? "bg-accent text-accent-foreground" : "")
      }
    >
      {children}
    </Link>
  );
}

function AdminNavbar() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const viewer = useQuery(api.myFunctions.listNumbers, { count: 0 })?.viewer;
  const segs = useSelectedLayoutSegments();
  const [open, setOpen] = useState(false);
  const title =
    (segs[0] ?? "") === "products"
      ? "Products"
      : (segs[0] ?? "") === "pallets"
      ? "Pallets"
      : (segs[0] ?? "") === "warehouses"
      ? "Warehouses"
      : "Dashboard";
  return (
    <>
      <nav className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="px-4 md:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Open menu"
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border"
              onClick={() => setOpen(true)}
            >
              {/* Hamburger icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <h1 className="hidden md:block text-base md:text-lg font-semibold">{title}</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">Hi {viewer ?? "there"}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void signOut().then(() => {
                  router.push("/signin");
                })
              }
            >
              Log out
            </Button>
          </div>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85%] bg-background border-r shadow-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold">Menu</div>
              <button
                type="button"
                aria-label="Close menu"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border"
                onClick={() => setOpen(false)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <nav className="text-sm space-y-1">
              <SidebarLink href="/admin" segment="">Dashboard</SidebarLink>
              <SidebarLink href="/admin/products" segment="products">Products</SidebarLink>
              <SidebarLink href="/admin/pallets" segment="pallets">Pallets</SidebarLink>
              <SidebarLink href="/admin/warehouses" segment="warehouses">Warehouses</SidebarLink>
            </nav>
            <hr className="my-4" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{viewer ?? "Signed in"}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void signOut().then(() => {
                    setOpen(false);
                    router.push("/signin");
                  })
                }
              >
                Log out
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
