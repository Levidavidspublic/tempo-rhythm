"use client";

import { type FormEvent, type ReactNode, useState } from "react";

type Status = "idle" | "sending" | "joined" | "error";

const SANS = "'Source Sans 3',sans-serif";

/**
 * The join form from the design export (public-coming-soon.html, hero).
 * Posts the email to /api/waitlist. The success line is the export's; the "sending" and
 * "try again" states are not in the export.
 */
export function WaitlistForm({ note }: { note: ReactNode }) {
  const [status, setStatus] = useState<Status>("idle");

  /** Posts the email to /api/waitlist and sets the joined or error state. Ignores a second submit while one is sending. */
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") {
      return;
    }
    const data = new FormData(event.currentTarget);
    setStatus("sending");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), company: data.get("company") }),
      });
      setStatus(response.ok ? "joined" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <form
        data-join=""
        onSubmit={onSubmit}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "flex-end",
          maxWidth: "520px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 260px" }}>
          <label
            htmlFor="tf-email-hero"
            style={{
              fontFamily: SANS,
              fontSize: "15px",
              fontWeight: "500",
              color: "var(--tp-ink)",
            }}
          >
            Your email
          </label>
          <input
            id="tf-email-hero"
            className="tf-field"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            maxLength={254}
            style={{
              height: "48px",
              boxSizing: "border-box",
              padding: "0 16px",
              border: "1.5px solid var(--tp-line-control)",
              borderRadius: "10px",
              background: "var(--tp-input)",
              fontFamily: SANS,
              fontSize: "17px",
              color: "var(--tp-ink)",
            }}
          />
        </div>
        {/* Left empty by people; filled by form-filling scripts. Hidden from sight and from assistive tech. */}
        <div className="tf-trap" aria-hidden="true">
          <label htmlFor="tf-company-hero">Company</label>
          <input id="tf-company-hero" name="company" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <button
          type="submit"
          className="tf-shine"
          aria-disabled={status === "sending"}
          style={{
            height: "48px",
            padding: "0 22px",
            border: "none",
            borderRadius: "999px",
            background: "var(--tp-accent)",
            color: "var(--tp-on-accent)",
            fontFamily: SANS,
            fontSize: "17px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          Join the waitlist
        </button>
      </form>
      <div data-joined="" hidden={status !== "joined"}>
        {/* biome-ignore lint/a11y/useSemanticElements: the export's markup; a paragraph keeps its block layout */}
        <p
          role="status"
          style={{
            margin: "12px 0 0",
            fontFamily: SANS,
            fontSize: "16px",
            color: "var(--tp-done)",
          }}
        >
          You're on the list. We'll send one email when your spot opens.
        </p>
      </div>
      <div hidden={status !== "error"}>
        <p
          role="alert"
          style={{ margin: "12px 0 0", fontFamily: SANS, fontSize: "16px", color: "var(--tp-ink)" }}
        >
          That didn't go through. Your email isn't saved yet. Try again in a moment.
        </p>
      </div>
      <p
        style={{
          margin: "14px 0 0",
          fontFamily: SANS,
          fontSize: "15px",
          color: "var(--tp-ink-muted)",
        }}
      >
        {note}
      </p>
    </>
  );
}
