"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { MessageKey } from "@/lib/i18n";

/**
 * Personal MCP tokens on Settings · Integrations, as a v3 SettingsSection. Data: mcp.listTokens;
 * mcp.createToken shows the new token once; mcp.revokeToken. The token name field, "Create
 * token", the one-time token field (data-testid="mcp-new-token") and each token's "Revoke"
 * button keep their names for tests/e2e/mcp.spec.ts.
 */
export function McpTokensCard() {
  const { t, lang } = useLocale();
  const { isAuthenticated } = useConvexAuth();
  const tokens = useQuery(api.mcp.listTokens, isAuthenticated ? {} : "skip");
  const createToken = useMutation(api.mcp.createToken);
  const revokeToken = useMutation(api.mcp.revokeToken);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<MessageKey | null>(null);
  const [pending, setPending] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const endpoint = typeof window === "undefined" ? "/api/mcp" : `${window.location.origin}/api/mcp`;
  const active = (tokens ?? []).filter((token) => token.revokedAt === undefined);
  const formatDate = (ms: number | undefined) =>
    ms === undefined ? t("set.mcp.never") : new Date(ms).toLocaleString(lang === "he" ? "he-IL" : "en-US");

  const handleCreate = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setCopied(false);
    try {
      const result = await createToken({ name });
      setFresh(result.token);
      setName("");
    } catch (error) {
      const text = error instanceof Error ? error.message : "";
      if (text.includes("ACCOUNT_PENDING_APPROVAL")) {
        setPending(true);
      } else if (text.includes("active tokens")) {
        setMessage("set.mcp.errMax");
      } else if (text.includes("name")) {
        setMessage("set.mcp.errName");
      } else {
        setMessage("set.mcp.errCreate");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh);
      setCopied(true);
    } catch {
      setMessage("set.mcp.errCopy");
    }
  };

  const handleRevoke = async (tokenId: (typeof active)[number]["_id"]) => {
    setMessage(null);
    try {
      await revokeToken({ tokenId });
    } catch {
      setMessage("set.mcp.errRevoke");
    }
  };

  return (
    <section
      className="tp-settings-section"
      aria-labelledby="mcp-heading"
      data-testid="mcp-tokens-card"
      data-component="SettingsSection"
    >
      <div className="tp-settings-section__head">
        <h2 className="tp-settings-section__title" id="mcp-heading">
          {t("set.mcp.title")}
        </h2>
        <p className="tp-settings-section__desc">{t("set.mcp.desc")}</p>
      </div>

      {pending ? (
        <div className="tp-setting-row" data-component="SettingRow">
          <output className="tp-help">{t("set.mcp.pending")}</output>
        </div>
      ) : (
        <form
          className="tp-setting-row tp-setting-row--stack od-row"
          data-component="SettingRow"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
        >
          <div className="tp-setting-row__text">
            <label className="tp-setting-row__label" htmlFor="mcp-token-name">
              {t("set.mcp.tokenName")}
            </label>
          </div>
          <div className="tp-setting-row__control">
            <input
              className="tp-input ig-grow"
              id="mcp-token-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              placeholder="Executor"
              dir="auto"
              autoComplete="off"
            />
            <button className="tp-btn tp-btn--secondary" type="submit" disabled={busy || !isAuthenticated}>
              <TpIcon name="plus" size="sm" />
              <span>{t("set.mcp.create")}</span>
            </button>
          </div>
        </form>
      )}

      {fresh ? (
        <div className="tp-setting-row tp-setting-row--stack od-row" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <output className="tp-setting-row__label">{t("set.mcp.once")}</output>
          </div>
          <div className="tp-setting-row__control">
            <input
              readOnly
              className="tp-input tp-mono ig-grow"
              dir="ltr"
              aria-label={t("set.mcp.newToken")}
              data-testid="mcp-new-token"
              value={fresh}
              onFocus={(event) => event.currentTarget.select()}
            />
            <button className="tp-btn tp-btn--secondary" type="button" onClick={() => void handleCopy()}>
              <span>{copied ? t("set.mcp.copied") : t("set.mcp.copy")}</span>
            </button>
            <button className="tp-btn tp-btn--ghost" type="button" onClick={() => setFresh(null)}>
              <span>{t("set.mcp.done")}</span>
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="tp-setting-row" data-component="SettingRow">
          <p className="tp-error-text" role="alert">
            <TpIcon name="alert" size="sm" />
            <span>{t(message)}</span>
          </p>
        </div>
      ) : null}

      <div className="tp-setting-row od-row" data-component="SettingRow">
        <div className="tp-setting-row__text">
          <h3 className="tp-setting-row__label">{t("set.mcp.yours")}</h3>
          {active.length === 0 ? (
            <span className="tp-help">
              {tokens === undefined && isAuthenticated ? t("set.mcp.loadingTokens") : t("set.mcp.none")}
            </span>
          ) : null}
        </div>
      </div>
      {active.length > 0 ? (
        <ul className="tp-list">
          {active.map((token) => (
            <li key={token._id}>
              <div className="tp-setting-row od-row" data-component="SettingRow">
                <div className="tp-setting-row__text">
                  <span className="tp-setting-row__label" dir="auto">
                    {token.name}
                  </span>
                  <span className="tp-help">
                    <span className="tp-mono">{token.prefix}…</span> · {t("set.mcp.created")}{" "}
                    <span className="tp-num">{formatDate(token.createdAt)}</span> · {t("set.mcp.lastUsed")}{" "}
                    <span className="tp-num">{formatDate(token.lastUsedAt)}</span>
                  </span>
                </div>
                <div className="tp-setting-row__control">
                  <button className="tp-btn tp-btn--secondary tp-btn--sm" type="button" onClick={() => void handleRevoke(token._id)}>
                    <span>{t("set.mcp.revoke")}</span>
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="tp-setting-row tp-setting-row--stack od-row" data-component="SettingRow">
        <div className="tp-setting-row__text">
          <h3 className="tp-setting-row__label">{t("set.mcp.connect")}</h3>
          <span className="tp-help">{t("set.mcp.connectHelp")}</span>
        </div>
        <div className="tp-setting-row__control">
          <pre className="tp-mono ig-grow ig-pre" dir="ltr">{`URL: ${endpoint}\nHeader: Authorization: Bearer <your token>`}</pre>
        </div>
      </div>
    </section>
  );
}
