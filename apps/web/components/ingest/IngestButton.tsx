"use client";

import { useId, useState } from "react";
import { TpIcon } from "@/components/tempo/TpIcon";
import { useIngestCopy } from "./copy";
import { IngestSheet, type IngestTab } from "./IngestSheet";

export type IngestButtonProps = {
  /** The button's words. Default: "Bring in text". */
  label?: string;
  /** Button style. Default "secondary", so the screen keeps its own one primary action. */
  variant?: "primary" | "secondary" | "ghost";
  /** Which source the sheet opens on. Default "file". */
  initialTab?: IngestTab;
  /** Called with the new page's id after it is saved. */
  onSaved?: (noteId: string) => void;
};

/** A button that opens the IngestSheet; focus comes back here when the sheet closes. */
export function IngestButton({
  label,
  variant = "secondary",
  initialTab,
  onSaved,
}: IngestButtonProps) {
  const t = useIngestCopy();
  const [open, setOpen] = useState(false);
  const sheetId = `ingest-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  return (
    <>
      <button
        className={`tp-btn tp-btn--${variant}`}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? sheetId : undefined}
        data-component="IngestButton"
        onClick={() => setOpen(true)}
      >
        <TpIcon name="upload" size="sm" />
        <span>{label ?? t("ig.open")}</span>
      </button>
      {open ? (
        <IngestSheet
          id={sheetId}
          initialTab={initialTab}
          onSaved={onSaved}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
