/**
 * @screen: command
 * @source: docs/design/v3/screens/web/command.html
 * @summary: The command bar as a page: find a screen or an action, then press Enter.
 * @queries: (none)
 * @mutations: notes.create (New page)
 * @auth: required
 */
"use client";

import { useLocale } from "@/components/providers/LocaleProvider";
import { CommandPanel } from "@/components/tempo/CommandPalette";

export default function Page() {
  const { t } = useLocale();
  return (
    <div className="tp-page" data-component="PageLayout">
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <h1 className="tp-pagehead__title">{t("cmd.page.title")}</h1>
          <p className="tp-pagehead__sub">{t("cmd.page.sub")}</p>
        </div>
      </header>
      <CommandPanel />
    </div>
  );
}
