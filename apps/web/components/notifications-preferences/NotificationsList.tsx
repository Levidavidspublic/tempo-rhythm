"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";

export function NotificationsList() {
  const notifications = useQuery(api.notifications.list, {});
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const [error, setError] = useState("");

  if (notifications === undefined) {
    return <p aria-live="polite">Loading notifications…</p>;
  }

  const sorted = [...notifications].sort((a, b) => {
    const unreadDiff = Number(a.readAt !== undefined) - Number(b.readAt !== undefined);
    return unreadDiff !== 0 ? unreadDiff : b.createdAt - a.createdAt;
  });
  const unreadCount = sorted.filter((item) => item.readAt === undefined).length;

  const run = async (action: () => Promise<unknown>) => {
    setError("");
    try {
      await action();
    } catch {
      setError("Could not update that. You can try again.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={unreadCount === 0}
          onClick={() => run(() => markAllRead({}))}
        >
          Mark all read
        </Button>
      </div>
      {sorted.length === 0 ? (
        <p>Nothing new</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((item) => {
            const unread = item.readAt === undefined;
            return (
              <li
                key={item._id}
                className="flex items-start justify-between gap-3 rounded-md border p-3"
              >
                <div className="flex items-start gap-2">
                  {unread ? (
                    <span
                      role="img"
                      aria-label="Unread"
                      className="mt-2 inline-block size-2 shrink-0 rounded-full bg-primary"
                    />
                  ) : null}
                  <div>
                    <p className={unread ? "font-medium" : undefined}>{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.body}</p>
                  </div>
                </div>
                {unread ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => run(() => markRead({ notificationId: item._id }))}
                  >
                    Mark read
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
