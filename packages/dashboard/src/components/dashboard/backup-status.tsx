"use client";

import { AlertTriangle, Check, Database, HardDrive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBackups } from "@/hooks/use-backups";
import { formatRelative } from "@/lib/format";
import type { BackupRun } from "@/types/backups";

/**
 * What the nightly dump did, for people who would otherwise have to SSH in to
 * find out.
 *
 * Read-only on purpose. The script that makes these runs on the host; this
 * dashboard is a container with no host mounts, and giving a web application
 * the access needed to edit a crontab would mean giving it the machine. So the
 * backup script reports into the database and this reads it back, while
 * changing anything stays a command on the server.
 */
export function BackupStatus() {
  const { data, isLoading, error } = useBackups();

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <CardTitle className="text-base font-medium">Backups</CardTitle>
          </div>
          {data?.last && <StatusPill run={data.last} />}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : error ? (
          <p className="text-sm text-muted-foreground">
            Could not read the backup history from the server.
          </p>
        ) : !data?.last ? (
          <NeverRun />
        ) : (
          <>
            <Details last={data.last} />
            {data.runs.length > 1 && <History runs={data.runs} />}
          </>
        )}

        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          Scheduled and configured on the server, not here — this dashboard has
          no access to the machine it runs on, which is why it cannot be
          persuaded to give anyone else access either.
        </p>
      </CardContent>
    </Card>
  );
}

function StatusPill({ run }: { run: BackupRun }) {
  const failed = run.status !== "ok";
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        failed
          ? "bg-red-500/10 text-red-400"
          : "bg-green-500/10 text-green-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${failed ? "bg-red-400" : "bg-green-400"}`}
      />
      {failed ? "Last run failed" : "Running"}
    </span>
  );
}

function NeverRun() {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-sm">
          This installation has never run a backup.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Re-run the installer on the server and it offers to schedule a nightly
        one, or start it yourself:
      </p>
      <Command>/opt/bananalytics/scripts/backup.sh</Command>
    </div>
  );
}

function Details({ last }: { last: BackupRun }) {
  const failed = last.status !== "ok";
  // Everything before the file name: where dumps are kept on that machine.
  const directory = last.path?.replace(/\/[^/]+$/, "");

  return (
    <div className="space-y-3">
      <Row label="Last run">
        <span className={failed ? "text-red-400" : undefined}>
          {formatRelative(last.finished_at)}
          {last.bytes != null && ` · ${formatBytes(last.bytes)}`}
        </span>
      </Row>

      {directory && <Row label="Stored in"><Mono>{directory}</Mono></Row>}

      <Row label="Off-site">
        {last.remote ? (
          <span className="flex items-center gap-1.5 text-green-400">
            <Check className="h-3.5 w-3.5" />
            <Mono>{last.remote}</Mono>
          </span>
        ) : (
          <span className="text-amber-400">
            None — the only copy is on this server
          </span>
        )}
      </Row>

      {last.message && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          <p className="text-xs text-muted-foreground">{last.message}</p>
        </div>
      )}

      {!last.remote && (
        <p className="text-xs text-muted-foreground">
          A dump beside the database survives a dropped table, not a lost
          machine. Point <Mono>BANANA_BACKUP_REMOTE</Mono> in{" "}
          <Mono>/opt/bananalytics/.env</Mono> at any rclone remote — S3, B2,
          Storj — and each dump is copied off automatically.
        </p>
      )}
    </div>
  );
}

/**
 * The recent runs as one strip.
 *
 * A single green tick says last night worked; it does not say whether the
 * three nights before it did. One glance should answer both.
 */
function History({ runs }: { runs: BackupRun[] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">Recent runs</p>
      <div className="flex flex-wrap gap-1">
        {[...runs].reverse().map((run, i) => (
          <span
            key={`${run.finished_at}-${i}`}
            title={`${new Date(run.finished_at).toLocaleString()} — ${
              run.status === "ok" ? "ok" : run.message || "failed"
            }`}
            className={`h-5 w-3 rounded-sm ${
              run.status === "ok" ? "bg-green-500/40" : "bg-red-500/60"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all">{children}</span>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-xs">{children}</code>;
}

function Command({ children }: { children: string }) {
  return (
    <pre className="flex items-center gap-2 overflow-x-auto rounded-lg border border-border bg-card p-3 font-mono text-xs">
      <HardDrive className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      {children}
    </pre>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
