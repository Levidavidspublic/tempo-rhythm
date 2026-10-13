"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "@tempo/ui/icons";
import { TEMPO_SCREENS } from "@/lib/tempo-nav";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called as the palette closes; returns true when it moved focus itself. */
  returnFocus?: () => boolean;
};

/**
 * CommandPalette — ⌘K screen jumper.
 * @source docs/design/claude-export/design-system/app.html (ScreenPicker)
 * @action jumpToScreen
 * @navigate push(screen.route)
 */
export function CommandPalette({ open, onOpenChange, returnFocus }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setFocused(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TEMPO_SCREENS;
    return TEMPO_SCREENS.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q),
    );
  }, [query]);

  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => {
    const el = itemRefs.current[focused];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [focused]);

  function pick(index: number) {
    const picked = items[index];
    if (!picked) return;
    onOpenChange(false);
    router.push(picked.route);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocused((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocused((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(focused);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(0,0,0,0.35)] backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            if (returnFocus?.()) event.preventDefault();
          }}
          className="fixed left-1/2 top-[15vh] z-50 w-[min(640px,90vw)] -translate-x-1/2 rounded-2xl border border-border bg-card shadow-lift overflow-hidden"
        >
          <Dialog.Title className="sr-only">Jump to screen</Dialog.Title>

          <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border-soft">
            <Search size={16} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search screens…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setFocused(0);
              }}
              onKeyDown={onInputKeyDown}
              className="flex-1 bg-transparent text-body outline-none placeholder:text-subtle-foreground"
            />
          </div>

          <div
            className="max-h-[50vh] overflow-y-auto scroll-subtle p-1.5"
            role="listbox"
            aria-label="Screens"
          >
            {items.length === 0 ? (
              <div className="px-3.5 py-8 text-center text-muted-foreground text-small">
                Nothing matches. Try a different word.
              </div>
            ) : (
              items.map((s, i) => (
                <button
                  key={s.slug}
                  type="button"
                  role="option"
                  aria-selected={i === focused}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  onClick={() => pick(i)}
                  onMouseEnter={() => setFocused(i)}
                  className={[
                    "w-full text-left flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-small",
                    i === focused
                      ? "bg-surface-sunken"
                      : "hover:bg-surface-sunken",
                  ].join(" ")}
                >
                  <span className="text-caption font-tabular px-2 py-0.5 rounded-full bg-surface-sunken text-muted-foreground">
                    {s.category}
                  </span>
                  <span className="flex-1 text-foreground">{s.title}</span>
                  <span className="text-caption font-tabular text-muted-foreground opacity-60">
                    {s.route}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border-soft text-caption text-muted-foreground font-tabular">
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>esc close</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
