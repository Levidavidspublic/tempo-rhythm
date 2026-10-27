"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { type FormEvent, useState } from "react";
import { api } from "@/convex/_generated/api";

const MAX_LENGTH = 2000;

export function AskFounderForm() {
  const { isAuthenticated } = useConvexAuth();
  const sent = useQuery(api.feedback.listMine, isAuthenticated ? {} : "skip");
  const send = useMutation(api.feedback.send);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const canSend = message.trim().length > 0 && message.length <= MAX_LENGTH && !busy;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSend) return;
    setBusy(true);
    setStatus("idle");
    try {
      await send({ message, page: "/ask-founder" });
      setMessage("");
      setStatus("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send.");
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tp-settings-section" aria-labelledby="founder-send-title" data-component="SettingsSection">
      <div className="tp-settings-section__head">
        <h2 className="tp-settings-section__title" id="founder-send-title">
          Send a message
        </h2>
      </div>
      <form onSubmit={onSubmit} className="tp-setting-row" data-testid="ask-founder-form">
        <label htmlFor="founder-message" className="sr-only">
          Your message to Amit
        </label>
        <textarea
          id="founder-message"
          className="tp-input"
          rows={5}
          maxLength={MAX_LENGTH}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write to Amit"
        />
        <button type="submit" className="tp-btn tp-btn--primary" disabled={!canSend}>
          Send
        </button>
        {status === "sent" ? <output>Sent. Amit reads every message.</output> : null}
        {status === "error" ? <p role="alert">{error}</p> : null}
      </form>
      {sent && sent.length > 0 ? (
        <ul aria-label="Your past messages" data-testid="ask-founder-sent">
          {sent.map((m) => (
            <li key={m._id}>
              <p>{m.message}</p>
              <small>{new Date(m.createdAt).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
