"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Eye, EyeOff, Code } from "lucide-react";

export default function SettingsPage() {
  // In a real app these would come from the API / cookie
  const [showWrite, setShowWrite] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const writeKey = "rk_your_write_key";
  const secretKey = "sk_your_secret_key";

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your project configuration and API keys
        </p>
      </div>

      {/* API Keys */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-medium">API Keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Write Key */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Write Key</label>
              <Badge variant="secondary" className="text-xs">Public</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Used in the SDK for sending events. Safe to include in client-side code.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={showWrite ? writeKey : "rk_••••••••••••••••••••"}
                  readOnly
                  className="font-mono text-sm pr-20"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setShowWrite(!showWrite)}
                  >
                    {showWrite ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => copyToClipboard(writeKey, "write")}
                  >
                    {copied === "write" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Secret Key */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Secret Key</label>
              <Badge variant="destructive" className="text-xs">Secret</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Used for querying data. Never expose in client-side code.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={showSecret ? secretKey : "sk_••••••••••••••••••••"}
                  readOnly
                  className="font-mono text-sm pr-20"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => copyToClipboard(secretKey, "secret")}
                  >
                    {copied === "secret" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SDK Integration */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            <CardTitle className="text-base font-medium">SDK Integration</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">1. Install the package</p>
            <pre className="rounded-lg bg-card border border-border p-3 font-mono text-sm overflow-x-auto">
              npm install @bananalytics/react-native @react-native-async-storage/async-storage
            </pre>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">2. Initialize in your app</p>
            <pre className="rounded-lg bg-card border border-border p-3 font-mono text-sm overflow-x-auto">
{`import { Bananalytics } from '@bananalytics/react-native';

Bananalytics.init({
  apiKey: '${writeKey}',
  endpoint: 'https://your-server.com',
});

// Track events
Bananalytics.track('button_clicked', { button: 'signup' });
Bananalytics.identify('user-123', { plan: 'pro' });
Bananalytics.screen('HomeScreen');`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
