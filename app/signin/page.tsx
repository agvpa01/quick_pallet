"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function SignIn() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            {flow === "signIn" ? "Welcome back" : "Create account"}
          </CardTitle>
          <CardDescription>
            {flow === "signIn"
              ? "Log in to see the numbers."
              : "Sign up to start tracking."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setLoading(true);
              const formData = new FormData(e.target as HTMLFormElement);
              formData.set("flow", flow);
              try {
                await signIn("password", formData);
                router.push("/admin");
              } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Something went wrong");
              } finally {
                setLoading(false);
              }
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                name="email"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                name="password"
                placeholder="********"
                required
              />
            </div>
            {error && (
              <Alert>
                <AlertTitle>Authentication error</AlertTitle>
                <AlertDescription className="font-mono text-xs">
                  {error}
                </AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading
                ? flow === "signIn"
                  ? "Signing in..."
                  : "Creating account..."
                : flow === "signIn"
                ? "Sign in"
                : "Sign up"}
            </Button>
            <div className="text-sm text-muted-foreground">
              {flow === "signIn" ? (
                <span>
                  {"Don't have an account? "}
                  <button
                    type="button"
                    className="text-primary underline underline-offset-4 hover:no-underline"
                    onClick={() => setFlow("signUp")}
                  >
                    Sign up instead
                  </button>
                </span>
              ) : (
                <span>
                  {"Already have an account? "}
                  <button
                    type="button"
                    className="text-primary underline underline-offset-4 hover:no-underline"
                    onClick={() => setFlow("signIn")}
                  >
                    Sign in instead
                  </button>
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
