"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateProject } from "@/hooks/use-projects";
import { Copy, Check } from "lucide-react";
import type { Project } from "@/types/projects";

export default function NewProjectPage() {
  const router = useRouter();
  const create = useCreateProject();
  const [name, setName] = useState("");
  const [created, setCreated] = useState<Project | null>(null);
  const [copied, setCopied] = useState<"write" | "secret" | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const project = await create.mutateAsync(name.trim());
      setCreated(project);
    } catch {
      // error displayed via mutation state below
    }
  };

  const copyKey = (key: string, kind: "write" | "secret") => {
    navigator.clipboard.writeText(key);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  };

  if (created) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Project created 🎉</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Save these API keys now — the secret key won&apos;t be shown again in plaintext.
          </p>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-medium">{created.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Write Key (use in your SDK)
                </label>
                <button
                  onClick={() => copyKey(created.write_key, "write")}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {copied === "write" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  Copy
                </button>
              </div>
              <code className="block w-full rounded-md bg-muted px-3 py-2 font-mono text-xs break-all">
                {created.write_key}
              </code>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Secret Key (for queries — never expose in client code)
                </label>
                <button
                  onClick={() => copyKey(created.secret_key, "secret")}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {copied === "secret" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  Copy
                </button>
              </div>
              <code className="block w-full rounded-md bg-muted px-3 py-2 font-mono text-xs break-all">
                {created.secret_key}
              </code>
            </div>

            <Button onClick={() => router.push("/dashboard")} className="w-full">
              Continue to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create a project</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Each project gets its own API keys for tracking events.
        </p>
      </div>

      <Card className="border-border">
        <CardContent className="pt-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Project Name
              </label>
              <Input
                placeholder="My App"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            {create.isError && (
              <p className="text-sm text-destructive">
                {(create.error as Error)?.message || "Failed to create project"}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={!name.trim() || create.isPending}
            >
              {create.isPending ? "Creating..." : "Create project"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
