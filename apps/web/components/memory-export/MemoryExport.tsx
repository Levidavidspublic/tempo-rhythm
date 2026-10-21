"use client";

import { useConvex, useConvexAuth, useQuery } from "convex/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { safeFilename, summaryLine, toBlobParts } from "./download";

const SECTOR_LABELS: Record<string, string> = {
  semantic: "Facts and ideas",
  episodic: "Experiences",
  procedural: "Ways of doing things",
  emotional: "Feelings",
  general: "General",
};

export function MemoryExport() {
  const convex = useConvex();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const stats = useQuery(api.memories.getMemoryStats, profile ? {} : "skip");
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function downloadMemories() {
    if (exporting || !stats || stats.total === 0) return;

    setExporting(true);
    setStatus(null);
    setFailed(false);
    try {
      const result = await convex.query(api.memory.exportAll, {});
      const { parts, type } = toBlobParts(result.markdown);
      const url = URL.createObjectURL(new Blob(parts, { type }));
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = safeFilename(result.filename);
        anchor.click();
      } finally {
        URL.revokeObjectURL(url);
      }
      setStatus(`Saved ${result.count} memories to your downloads.`);
    } catch {
      setFailed(true);
      setStatus("That export didn't work. Try again?");
    } finally {
      setExporting(false);
    }
  }

  if (authLoading || (isAuthenticated && profile === undefined)) {
    return (
      <section aria-busy="true" aria-labelledby="memory-export-heading" className="max-w-2xl">
        <h2 id="memory-export-heading" className="font-heading text-xl font-semibold">
          Download your memories
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">Loading your memory summary.</p>
      </section>
    );
  }

  if (!isAuthenticated || !profile) return null;

  return (
    <section aria-labelledby="memory-export-heading" className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle id="memory-export-heading">Download your memories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {stats === undefined ? (
            <p aria-live="polite" className="text-sm text-muted-foreground">
              Loading your memory summary.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{summaryLine(stats)}</p>
              <dl className="grid gap-2 sm:grid-cols-2">
                {stats.sectors.map(({ sector, count }) => (
                  <div
                    key={sector}
                    className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2"
                  >
                    <dt className="text-sm text-foreground">{SECTOR_LABELS[sector] ?? sector}</dt>
                    <dd className="text-sm font-medium tabular-nums text-foreground">{count}</dd>
                  </div>
                ))}
              </dl>
              <Button
                type="button"
                disabled={stats.total === 0 || exporting}
                onClick={() => void downloadMemories()}
              >
                {exporting ? "Preparing download…" : "Download my memories"}
              </Button>
            </>
          )}
          {status ? (
            <p
              role={failed ? "alert" : "status"}
              className={failed ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
            >
              {status}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
