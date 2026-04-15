"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [secretKey, setSecretKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed");
        return;
      }

      const redirect = searchParams.get("redirect") || "/dashboard";
      router.push(redirect);
    } catch {
      setError("Network error. Is the server running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <span className="text-4xl">&#x1F34C;</span>
          </div>
          <CardTitle className="text-xl">Connect to Bananalytics</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your project secret key to access the dashboard
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Input
                type="password"
                placeholder="sk_your_secret_key..."
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="font-mono"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={!secretKey || loading}
            >
              {loading ? "Connecting..." : "Connect"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Your secret key was generated when you created a project.
            <br />
            Run:{" "}
            <code className="bg-muted px-1.5 py-0.5 font-mono text-xs">
              curl -X POST http://localhost:8080/v1/projects -H
              &quot;Content-Type: application/json&quot; -d
              &apos;&#123;&quot;name&quot;:&quot;My App&quot;&#125;&apos;
            </code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
