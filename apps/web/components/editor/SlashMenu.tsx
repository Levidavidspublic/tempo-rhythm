"use client";

import { useEffect, useState } from "react";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";

export type MenuItem = {
  id: string;
  group: string;
  name: string;
  hint?: string;
  icon: TpIconName;
};

type Props = {
  /** Accessible label of the listbox ("Insert a block", "Link a page"). */
  label: string;
  /** The hint line under the search icon. */
  hint: string;
  items: readonly MenuItem[];
  active: number;
  /** Caret position in viewport coordinates (desktop popover); under 768 px the menu is a bottom sheet. */
  coords: { left: number; top: number; bottom: number } | null;
  empty: string;
  onChoose: (item: MenuItem) => void;
  onHover: (index: number) => void;
};

/**
 * SlashMenu / SlashCommand (docs/design/v3/screens/web/page-editor.html): a glass listbox
 * under the caret. Arrows move, Enter adds, Esc closes; the editor forwards those keys.
 * shadcn target: command in popover. Also used for the [[ page picker.
 */
export function SlashMenu({ label, hint, items, active, coords, empty, onChoose, onHover }: Props) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  const style =
    wide && coords
      ? {
          position: "fixed" as const,
          top: Math.min(coords.bottom + 6, window.innerHeight - 220),
          // Keep the 340 px popover on screen in both directions.
          left: Math.max(8, Math.min(coords.left - 8, window.innerWidth - 356)),
          insetInlineStart: "auto",
        }
      : undefined;

  let lastGroup = "";
  return (
    <div className="tp-slash-menu tp-glass" id="slash" data-component="SlashMenu" style={style}>
      <div className="tp-slash-menu__search">
        <TpIcon name="search" size="sm" />
        <span>{hint}</span>
      </div>
      <div role="listbox" tabIndex={-1} aria-label={label} aria-activedescendant={items[active] ? `slash-${items[active].id}` : undefined}>
        {items.length === 0 ? <div className="tp-slash-menu__group">{empty}</div> : null}
        {items.map((item, index) => {
          const head = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          return (
            <div key={item.id}>
              {head ? <div className="tp-slash-menu__group">{head}</div> : null}
              <div
                className="tp-slash-item"
                role="option"
                id={`slash-${item.id}`}
                aria-selected={index === active}
                tabIndex={-1}
                onMouseDown={(event) => {
                  // Keep the caret in the editor; choose on mouse down.
                  event.preventDefault();
                  onChoose(item);
                }}
                onMouseEnter={() => onHover(index)}
              >
                <span className="tp-slash-item__icon">
                  <TpIcon name={item.icon} />
                </span>
                <span className="tp-slash-item__text">
                  <span className="tp-slash-item__name" dir="auto">
                    {item.name}
                  </span>
                  {item.hint ? <span className="tp-slash-item__hint">{item.hint}</span> : null}
                </span>
                <span />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
