"use client";

import Link from "next/link";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { listenHref } from "./player";

/**
 * S16 from the page menu: "Listen to a recap" opens /study/listen for this page. A `role="menuitem"`
 * link, so the page menu's keyboard handling reaches it like the Turn into items above it.
 */
export function ListenMenuItem({
  noteId,
  onNavigate,
}: {
  noteId: string;
  onNavigate?: () => void;
}) {
  const { t } = useLocale();
  return (
    <Link
      className="tp-menu__item"
      role="menuitem"
      href={listenHref(noteId)}
      data-action="listen-recap"
      onClick={onNavigate}
    >
      <TpIcon name="volume" size="sm" />
      {t("st.turn.listen")}
    </Link>
  );
}
