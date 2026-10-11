"use client";

import { Search } from "@tempo/ui/icons";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { TEMPO_SCREENS } from "@/lib/tempo-nav";

// These routes still render ScaffoldScreen. Keep the command page focused on
// usable destinations until those routes are implemented.
const SCAFFOLD_ROUTES = new Set([
  "/ask-founder",
  "/empty-states",
  "/goals",
  "/journal",
  "/routines",
]);

export const REAL_SCREENS = TEMPO_SCREENS.filter(
  (screen) => !screen.bare && !SCAFFOLD_ROUTES.has(screen.route),
);

export function CommandList() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const matches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return REAL_SCREENS;

    return REAL_SCREENS.filter((screen) =>
      screen.title.toLowerCase().includes(normalizedQuery),
    );
  }, [query]);

  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  function openScreen(index: number) {
    const screen = matches[index];
    if (screen) router.push(screen.route);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      openScreen(selectedIndex);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-lift" aria-label="Screen finder">
      <div className="flex items-center gap-3 border-b border-border-soft px-5 py-4">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          role="combobox"
          aria-label="Filter screens"
          aria-autocomplete="list"
          aria-controls="command-screen-list"
          aria-expanded="true"
          aria-activedescendant={matches[selectedIndex] ? `command-screen-${matches[selectedIndex].slug}` : undefined}
          placeholder="Search screens…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-subtle-foreground"
        />
        <span className="hidden text-caption font-tabular text-muted-foreground sm:inline">↑↓ to move · ↵ to open</span>
      </div>

      <div id="command-screen-list" role="listbox" aria-label="Available screens" className="max-h-[55vh] overflow-y-auto p-2">
        {matches.length === 0 ? (
          <p className="px-4 py-12 text-center text-small text-muted-foreground">
            No screens match “{query}”.
          </p>
        ) : (
          matches.map((screen, index) => (
            <button
              key={screen.slug}
              id={`command-screen-${screen.slug}`}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              onClick={() => openScreen(index)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition-colors ${
                index === selectedIndex ? "bg-surface-sunken" : "hover:bg-surface-sunken"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-small font-medium text-foreground">{screen.title}</span>
                <span className="block text-caption text-muted-foreground">{screen.route}</span>
              </span>
              <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-caption font-tabular text-muted-foreground">
                {screen.category}
              </span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
