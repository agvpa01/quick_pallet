"use client";

import { useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type NewUser = { email: string; role: string; warehouseId: string | null; location: string };

export default function UsersPage() {
  const users = useQuery((api as any).users.listUsers, {});
  const warehouses = useQuery(api.myFunctions?.listNumbers as any, { count: 0 }); // placeholder, we will query warehouses directly below if needed
  const listWarehouses = useQuery((api as any).warehouses?.listWarehouses ?? ({} as any), {} as any) as any;
  const createUser = useMutation((api as any).users.createUser);
  const updateUser = useMutation((api as any).users.updateUser);
  const deleteUser = useMutation((api as any).users.deleteUser);

  const wList: any[] = (listWarehouses ?? []) as any[];
  const [form, setForm] = useState<NewUser>({ email: "", role: "staff", warehouseId: null, location: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleOptions = ["admin", "staff", "viewer"];

  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-3xl font-bold">Users</h1>
      </div>

      <Card className="border-none shadow-none rounded-none bg-transparent sm:border sm:shadow sm:rounded-md sm:bg-card">
        <CardHeader className="px-0 py-3 sm:p-6">
          <CardTitle className="text-base md:text-lg">Add User</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="grid md:grid-cols-4 gap-3 items-end max-w-full">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <select id="role" className="h-9 rounded-md border bg-background px-3 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {roleOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="wh">Warehouse</Label>
              <select id="wh" className="h-9 rounded-md border bg-background px-3 text-sm" value={form.warehouseId ?? ""} onChange={(e) => setForm({ ...form, warehouseId: e.target.value || null })}>
                <option value="">Unassigned</option>
                {wList.map((w: any) => (
                  <option key={String(w._id)} value={String(w._id)}>{w.name ?? w.code}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="loc">Location (text)</Label>
              <Input id="loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button
              disabled={saving}
              onClick={async () => {
                if (!form.email.trim()) return;
                setError(null);
                setSaving(true);
                try {
                  await createUser({
                    email: form.email.trim(),
                    role: form.role,
                    warehouseId: form.warehouseId ? (form.warehouseId as any) : undefined,
                    location: form.location || undefined,
                  });
                  setForm({ email: "", role: "staff", warehouseId: null, location: "" });
                } catch (e: any) {
                  setError(e?.message ?? "Failed to add user");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving..." : "Add user"}
            </Button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-none rounded-none bg-transparent sm:border sm:shadow sm:rounded-md sm:bg-card">
        <CardHeader className="px-0 py-3 sm:p-6">
          <CardTitle className="text-base md:text-lg">User List</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {users === undefined ? (
            <p>Loading users...</p>
          ) : users.length === 0 ? (
            <p>No users yet.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <div className="grid grid-cols-[1.5fr_0.7fr_1fr_1fr_auto] bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                <div>Email</div>
                <div>Role</div>
                <div>Warehouse</div>
                <div>Location</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="divide-y">
                {users.map((u: any) => (
                  <div key={String(u._id)} className="grid grid-cols-[1.5fr_0.7fr_1fr_1fr_auto] px-3 py-2 text-sm items-center">
                    <div className="truncate">{u.email}</div>
                    <div className="truncate text-muted-foreground">{u.role}</div>
                    <div className="truncate">{(wList.find((w: any) => String(w._id) === String(u.warehouseId))?.name) ?? "-"}</div>
                    <div className="truncate text-muted-foreground">{u.location ?? "-"}</div>
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const role = prompt("Role (admin/staff/viewer)", u.role ?? "staff");
                          if (role === null) return;
                          try {
                            await updateUser({ id: u._id, role });
                          } catch (e) {
                            alert("Failed to update role");
                          }
                        }}
                      >
                        Edit Role
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          if (!confirm("Delete this user?")) return;
                          try {
                            await deleteUser({ id: u._id });
                          } catch (e) {
                            alert("Failed to delete");
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

