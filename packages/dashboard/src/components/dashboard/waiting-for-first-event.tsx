"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Settings } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveProject } from "@/hooks/use-projects";

/** How long the "it arrived" panel stays up before the real dashboard takes over. */
const ARRIVED_MS = 2500;

/**
 * Ports on which the dashboard is being reached directly rather than through
 * the reverse proxy — `next dev` and `next start`. Reaching it on one of these
 * means /v1 is not on this origin.
 */
const DIRECT_PORTS = new Set(["3000", "3001"]);

/** Where the Go server listens when nothing is proxying for it. */
const SERVER_PORT = "8080";

/**
 * Where an SDK should send its events.
 *
 * A deployed install puts the dashboard and the ingest API behind one host —
 * Caddy sends /v1/* to the Go server and everything else here — so the page's
 * own origin is the answer and nobody has to be asked for it. Reaching the
 * dashboard on its own port means there is no proxy in front, and the server is
 * then a separate address.
 */
function ingestEndpoint(): string {
  const { protocol, hostname, port, origin } = window.location;
  return DIRECT_PORTS.has(port) ? `${protocol}//${hostname}:${SERVER_PORT}` : origin;
}

/** The address of the page never changes under us while it is open. */
const noUpdates = () => () => {};

/** There is no location during a server render, and no honest guess at one. */
const noEndpoint = () => null;

interface Props {
  /** True once the project has received an event. Triggers the hand-off. */
  arrived: boolean;
  /** Called when this screen is finished and the dashboard should take over. */
  onDone: () => void;
}

/**
 * The Overview for a project that has never received an event.
 *
 * A grid of zeroes tells someone who just finished installing nothing about
 * whether their server works, their key is right, or they simply have not
 * opened their app yet. This answers that: the three commands that produce a
 * first event, filled in with this project's real key and this server's real
 * address, and a line that says whether anything has arrived.
 */
export function WaitingForFirstEvent({ arrived, onDone }: Props) {
  const { project } = useActiveProject();
  const writeKey = project?.write_key ?? "";

  // Read on the client only: the server render has no location, and guessing
  // one would make the markup disagree with itself on hydration.
  const endpoint = useSyncExternalStore(noUpdates, ingestEndpoint, noEndpoint);

  useEffect(() => {
    if (!arrived) return;
    const t = setTimeout(onDone, ARRIVED_MS);
    return () => clearTimeout(t);
  }, [arrived, onDone]);

  if (arrived) return <FirstEventArrived onDone={onDone} />;

  const ready = endpoint !== null && writeKey !== "";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 py-6">
      <div className="space-y-2 text-center">
        <div className="text-4xl">🍌</div>
        <h1 className="text-xl font-semibold">Waiting for your first event</h1>
        <p className="text-sm text-muted-foreground">
          The server is up and this project is ready. Send one event and this
          page turns into your dashboard.
        </p>
      </div>

      <Card className="border-border">
        <CardContent className="space-y-6 pt-6">
          <Step n={1} title="Install the SDK">
            <CodeBlock lang="bash">
              npm install @bananalytics/react-native @react-native-async-storage/async-storage
            </CodeBlock>
          </Step>

          <Step n={2} title="Initialize it in your app">
            {ready ? (
              <CodeBlock lang="tsx" title="App.tsx">
                {initSnippet(writeKey, endpoint)}
              </CodeBlock>
            ) : (
              <Skeleton className="h-[180px] w-full" />
            )}
            <p className="text-xs text-muted-foreground">
              Events are batched and sent every 30 seconds. The{" "}
              <code className="font-mono">flush()</code> above skips that wait so
              the first one shows up while you are still looking.
            </p>
          </Step>

          <Step n={3} title="No app running yet? Prove the pipe from a terminal">
            {ready ? (
              <CodeBlock lang="bash">{curlSnippet(writeKey, endpoint)}</CodeBlock>
            ) : (
              <Skeleton className="h-[120px] w-full" />
            )}
          </Step>
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          Listening — this page updates itself the moment an event lands
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <Settings className="h-3 w-3" />
            Keys &amp; settings
          </Link>
          <a
            href="https://bananalytics.xyz/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            Read the docs
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
          {n}
        </span>
        <p className="text-sm font-medium">{title}</p>
      </div>
      <div className="space-y-2 pl-7">{children}</div>
    </div>
  );
}

function FirstEventArrived({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <CheckCircle2 className="h-10 w-10 text-primary" />
      <div>
        <h1 className="text-xl font-semibold">First event received</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You are collecting data. Opening your dashboard…
        </p>
      </div>
      <button
        onClick={onDone}
        className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Go there now
      </button>
    </div>
  );
}

function initSnippet(writeKey: string, endpoint: string): string {
  return `import { Bananalytics } from '@bananalytics/react-native';

Bananalytics.init({
  apiKey: '${writeKey}',
  endpoint: '${endpoint}',
});

Bananalytics.track('app_opened');
Bananalytics.flush();`;
}

/**
 * A single event, by hand.
 *
 * Ingest requires an event name, a type, an anonymous ID, a message ID and a
 * timestamp, so all five are here — a shorter version comes back 400 and reads
 * like a broken install. The message ID is a shell substitution rather than a
 * fixed string because inserts deduplicate on it: run this twice with the same
 * one and the second attempt reports nothing accepted, which looks like failure
 * and is not.
 */
function curlSnippet(writeKey: string, endpoint: string): string {
  const event = [
    '{\\"event\\":\\"hello_bananalytics\\"',
    '\\"type\\":\\"track\\"',
    '\\"anonymousId\\":\\"terminal-test\\"',
    '\\"messageId\\":\\"$(date +%s)\\"',
    '\\"timestamp\\":\\"$(date -u +%FT%TZ)\\"}',
  ].join(",");

  return [
    `curl -sS -X POST ${endpoint}/v1/ingest \\`,
    `  -H "Authorization: Bearer ${writeKey}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d "{\\"batch\\":[${event}]}"`,
  ].join("\n");
}
