"use client";

import Link from "next/link";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import type { MessageKey } from "@/lib/i18n";
import { en as starterCopy } from "@/lib/i18n-groups/starter-templates";

export type TemplatePeriod = "daily" | "weekly" | "monthly" | "none";

export type TemplateCardModel = {
  templateId: string;
  source: "starter" | "user";
  name: string;
  description?: string;
  periodType: TemplatePeriod;
  sections: string[];
};

const PERIOD_ICON: Record<TemplatePeriod, TpIconName> = {
  daily: "sun",
  weekly: "calendar-grid",
  monthly: "calendar-grid",
  none: "page",
};

const SECTION_PREVIEW_LIMIT = 4;

// i18n.ts spreads this group into its messages, so each key here is a MessageKey.
type StarterKey = keyof typeof starterCopy;
const STARTER_KEYS = Object.keys(starterCopy) as StarterKey[];
const STARTER_PREFIX = "starter:";

/** A line on the card: from a key (reads in the app language) or as written (dir="auto"). */
type CardText = { written: string; text: string; asWritten: boolean };

function isStarterKey(key: string): key is StarterKey {
  return Object.hasOwn(starterCopy, key);
}

/**
 * The server sends a starter's name, description and headings in English, word for word the
 * catalog's (convex/lib/templateCatalog.ts). Each has an st.<id> key with that same English,
 * so a starter card reads in the app language. A key is used only while its English still
 * matches; a user template, or anything without a matching key, shows as written.
 */
function cardCopy(template: TemplateCardModel, t: (key: MessageKey) => string) {
  const id =
    template.source === "starter" && template.templateId.startsWith(STARTER_PREFIX)
      ? template.templateId.slice(STARTER_PREFIX.length)
      : null;
  const line = (written: string, key: string | undefined): CardText =>
    key && isStarterKey(key) && starterCopy[key] === written
      ? { written, text: t(key), asWritten: false }
      : { written, text: written, asWritten: true };
  const headingKey = (heading: string) =>
    id
      ? STARTER_KEYS.find((key) => key.startsWith(`st.${id}.h.`) && starterCopy[key] === heading)
      : undefined;
  return {
    name: line(template.name, id ? `st.${id}.name` : undefined),
    description: template.description
      ? line(template.description, id ? `st.${id}.desc` : undefined)
      : null,
    sections: template.sections.map((heading) => line(heading, headingKey(heading))),
  };
}

export function templatePath(kind: "run" | "editor", templateId: string): string {
  return `/templates/${kind}/${encodeURIComponent(templateId)}`;
}

type TemplateCardProps = {
  template: TemplateCardModel;
  confirming: boolean;
  deleting: boolean;
  onAskDelete: (templateId: string) => void;
  onConfirmDelete: (templateId: string) => void;
  onCancelDelete: () => void;
};

/** One template (templates.html Card): name, who made it, the headings it adds, and actions. */
export function TemplateCard({
  template,
  confirming,
  deleting,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete,
}: TemplateCardProps) {
  const { t } = useLocale();
  const copy = cardCopy(template, t);
  // A callback keeps "$&", "$$" and the like in a name literal.
  const named = (key: Parameters<typeof t>[0]) => t(key).replace("{name}", () => copy.name.text);
  const preview = copy.sections.slice(0, SECTION_PREVIEW_LIMIT);
  const hiddenCount = copy.sections.length - preview.length;
  const own = template.source === "user";
  const useHref = templatePath("run", template.templateId);
  const editHref = templatePath("editor", template.templateId);

  return (
    <article data-template-id={template.templateId} className="tp-card tpl-card" data-component="Card">
      <div className="tp-card__head">
        <TpIcon name={PERIOD_ICON[template.periodType]} size="sm" />
        <h3 className="tp-card__title" dir={copy.name.asWritten ? "auto" : undefined}>
          {copy.name.text}
        </h3>
      </div>
      <div className="tpl-card__badges">
        {own ? (
          <span className="tp-badge" data-component="Badge">
            <TpIcon name="user" size="sm" />
            <span>{t("tpl.byyou")}</span>
          </span>
        ) : (
          <span className="tp-badge" data-component="Badge">
            <TpIcon name="lock" size="sm" />
            <span>{t("tpl.badge.builtin")}</span>
          </span>
        )}
        <span className="tp-badge" data-tone="info" data-component="Badge">
          {t(`tpl.period.${template.periodType}`)}
        </span>
      </div>
      {copy.description ? (
        <p className="tp-small" dir={copy.description.asWritten ? "auto" : undefined}>
          {copy.description.text}
        </p>
      ) : null}
      {preview.length > 0 ? (
        <ul aria-label={named("tpl.sections")} className="tpl-card__adds tp-small tp-muted">
          {preview.map((section) => (
            <li key={section.written} dir={section.asWritten ? "auto" : undefined}>
              {section.text}
            </li>
          ))}
          {hiddenCount > 0 ? <li>{t("tpl.more").replace("{n}", String(hiddenCount))}</li> : null}
        </ul>
      ) : (
        <p className="tp-small tp-muted">{t("tpl.noSections")}</p>
      )}
      <div className="tpl-card__actions">
        <Link className="tp-btn tp-btn--secondary tp-btn--sm" href={useHref} aria-label={named("tpl.useName")}>
          <TpIcon name="play" size="sm" />
          <span>{t("tpl.use")}</span>
        </Link>
        {own ? (
          <Link className="tp-btn tp-btn--ghost tp-btn--sm" href={editHref} aria-label={named("tpl.editName")}>
            <TpIcon name="edit" size="sm" />
            <span>{t("tpl.edit")}</span>
          </Link>
        ) : null}
        {own && confirming ? (
          <>
            <button
              type="button"
              className="tp-btn tp-btn--danger-ghost tp-btn--sm"
              aria-label={named("tpl.confirmName")}
              disabled={deleting}
              onClick={() => onConfirmDelete(template.templateId)}
            >
              {t("tpl.confirm")}
            </button>
            <button
              type="button"
              className="tp-btn tp-btn--ghost tp-btn--sm"
              aria-label={named("tpl.cancelName")}
              disabled={deleting}
              onClick={onCancelDelete}
            >
              {t("tpl.cancel")}
            </button>
          </>
        ) : null}
        {own && !confirming ? (
          <button
            type="button"
            className="tp-btn tp-btn--ghost tp-btn--sm tpl-card__delete"
            aria-label={named("tpl.deleteName")}
            onClick={() => onAskDelete(template.templateId)}
          >
            <TpIcon name="x" size="sm" />
            <span>{t("tpl.delete")}</span>
          </button>
        ) : null}
      </div>
    </article>
  );
}
