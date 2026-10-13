"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { ReadView } from "@/components/editor/ReadView";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { TpIcon, TpIconSprite } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { dayTokens } from "@/lib/editor/markdown-model";
import { localIsoDate } from "@/lib/period-pages";
import { templatePageDraft } from "@/lib/template-pages";
import { parseSketch } from "@/lib/template-sketch";
import { useOnline } from "@/lib/useOnline";
import { TemplateBodyEditor } from "./TemplateBodyEditor";

export type PeriodType = "daily" | "weekly" | "monthly" | "none";

export type TemplateDraft = {
  name: string;
  description: string;
  periodType: PeriodType;
  body: string;
};

const EMPTY_DRAFT: TemplateDraft = { name: "", description: "", periodType: "none", body: "" };

export type SourceTemplate = {
  templateId: string;
  source: "starter" | "user";
  name: string;
  description?: string;
  periodType: PeriodType;
  body: string;
};

export function draftFrom(template: SourceTemplate): TemplateDraft {
  return {
    name: template.name,
    description: template.description ?? "",
    periodType: template.periodType,
    body: template.body,
  };
}

/** The builder's chrome (template-builder.html): no shell, a glass bar with back, status and Save. */
function BuilderFrame({ status, action, children }: { status?: string; action?: ReactNode; children: ReactNode }) {
  const { t } = useLocale();
  const { resolvedTheme, setTheme } = useTheme();
  const online = useOnline();
  const dark = resolvedTheme === "dark";
  return (
    <>
      {/* The (bare) layout has no shell, so the builder draws the icon sprite itself. */}
      <TpIconSprite />
      <a className="tp-skip" href="#main">
        {t("tb.skip")}
      </a>
      <header className="tp-mtopbar tp-glass bld-top" data-component="MobileTopBar">
        <Link className="tp-btn tp-btn--ghost" href="/templates">
          <TpIcon name="chevron" size="sm" className="tp-icon--back" />
          <span>{t("tb.back")}</span>
        </Link>
        <span className="tp-mtopbar__title">{t("tb.title")}</span>
        <div className="bld-top__end">
          {status && online ? <output className="tp-muted tp-small tp-topbar__hide-sm">{status}</output> : null}
          <button
            className="tp-btn tp-btn--ghost tp-btn--icon"
            type="button"
            aria-pressed={dark}
            aria-label={dark ? t("top.themeLight") : t("top.themeDark")}
            onClick={() => setTheme(dark ? "light" : "dark")}
          >
            <TpIcon name={dark ? "sun" : "moon"} />
          </button>
          {action}
        </div>
      </header>
      {/* The (bare) layout has no shell, so this page holds its own main landmark. */}
      <main className="tp-app__main bld-main" id="main" tabIndex={-1}>
        {online ? null : (
          <output className="tp-notice tp-offline" data-tone="caution" data-component="StateOffline">
            <span className="tp-notice__icon">
              <TpIcon name="wifi-off" size="sm" />
            </span>
            <span className="tp-notice__text">{t("tx.offline")}</span>
          </output>
        )}
        {children}
      </main>
    </>
  );
}

function BuilderLoading() {
  const { t } = useLocale();
  return (
    <BuilderFrame>
      <div className="tp-paper">
        <div className="tp-page__body">
          <div className="tp-state--loading" data-component="StateLoading">
            <output className="tp-sr-only">{t("tb.loading")}</output>
            <div className="tp-skel-list">
              <div className="tp-skeleton tp-skeleton--w60" />
              <div className="tp-skeleton tp-skeleton--block" />
              <div className="tp-skel-row">
                <span className="tp-skeleton tp-skel-row__box" />
                <span className="tp-skel-row__lines">
                  <span className="tp-skeleton tp-skeleton--w80" />
                  <span className="tp-skeleton tp-skeleton--sm tp-skeleton--w40" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BuilderFrame>
  );
}

function BuilderMissing() {
  const { t } = useLocale();
  return (
    <BuilderFrame>
      <div className="tp-paper">
        <div className="tp-page__body">
          <div className="tp-state tp-state--error" role="alert" data-component="StateError">
            <span className="tp-state__icon">
              <TpIcon name="refresh" size="lg" />
            </span>
            <h1 className="tp-state__title">{t("tb.missing")}</h1>
            <p className="tp-state__body">{t("tb.missingHint")}</p>
            <div className="tp-state__actions">
              <Link className="tp-btn tp-btn--secondary" href="/templates">
                {t("tplRun.back")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </BuilderFrame>
  );
}

type BuilderMode = { kind: "create"; note?: string } | { kind: "edit"; templateId: string };

function BuilderForm({ initial, mode }: { initial: TemplateDraft; mode: BuilderMode }) {
  const { t, lang } = useLocale();
  const router = useRouter();
  const create = useMutation(api.templates.create);
  const update = useMutation(api.templates.update);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [body, setBody] = useState(initial.body);
  const [saved, setSaved] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // The example date is read after mount, so the server render and the first client render agree.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(localIsoDate(new Date())), []);

  const dirty = name !== saved.name || description !== saved.description || body !== saved.body;
  const canSave = name.trim().length > 0 && !pending && (mode.kind === "create" || dirty);

  const onName = (value: string) => {
    setName(value);
    setNotice("");
  };
  const onDescription = (value: string) => {
    setDescription(value);
    setNotice("");
  };
  const onBody = (value: string) => {
    setBody(value);
    setNotice("");
  };

  const onSave = async () => {
    if (!canSave) return;
    setPending(true);
    setError("");
    setNotice("");
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    try {
      if (mode.kind === "edit") {
        await update({
          templateId: mode.templateId as Id<"templates">,
          name: trimmedName,
          description: trimmedDescription,
          periodType: initial.periodType,
          body,
        });
        setSaved({ ...initial, name, description, body });
        setNotice(t("tb.savedNote"));
        setPending(false);
      } else {
        await create({
          name: trimmedName,
          periodType: initial.periodType,
          body,
          ...(trimmedDescription ? { description: trimmedDescription } : {}),
        });
        router.push("/templates");
      }
    } catch {
      setError(t("tb.saveError"));
      setPending(false);
    }
  };

  const status = mode.kind === "edit" && !dirty ? t("tb.saved") : t("tb.unsaved");
  const draft = today ? templatePageDraft({ name, body }, { title: "", isoDate: today, lang }) : null;
  const exampleDay = today ? dayTokens(today, lang).title : "";

  return (
    <BuilderFrame
      status={status}
      action={
        <button className="tp-btn tp-btn--primary tp-btn--sm" type="button" disabled={!canSave} onClick={() => void onSave()}>
          <TpIcon name="check" size="sm" />
          <span>{pending ? t("tx.saving") : t("tb.save")}</span>
        </button>
      }
    >
      {mode.kind === "create" && mode.note ? (
        <p className="tp-notice" data-tone="info">
          <span className="tp-notice__text" dir="auto">
            {mode.note}
          </span>
        </p>
      ) : null}
      {error ? (
        <p className="tp-notice" data-tone="caution" role="alert">
          <span className="tp-notice__text">{error}</span>
        </p>
      ) : null}
      {notice ? (
        <output className="tp-notice" data-tone="info">
          <span className="tp-notice__icon">
            <TpIcon name="check" size="sm" />
          </span>
          <span className="tp-notice__text">{notice}</span>
        </output>
      ) : null}

      <div className="tp-split tp-split--even bld-split" data-component="Split">
        <article className="tp-paper" data-component="PageEditor" aria-labelledby="template-name-label">
          <div className="tp-page__body">
            <div className="bld-fields">
              <div className="tp-field" data-component="Field">
                <label className="tp-label" id="template-name-label" htmlFor="template-name">
                  {t("tb.name")}
                </label>
                <input
                  className="tp-input"
                  id="template-name"
                  type="text"
                  dir="auto"
                  required
                  value={name}
                  placeholder={t("tb.namePh")}
                  onChange={(event) => onName(event.target.value)}
                />
              </div>
              <div className="tp-field" data-component="Field">
                <label className="tp-label" htmlFor="template-description">
                  <span>{t("tb.desc")}</span> <span className="tp-label__opt">{t("tx.opt")}</span>
                </label>
                <input
                  className="tp-input"
                  id="template-description"
                  type="text"
                  dir="auto"
                  aria-describedby="template-description-help"
                  value={description}
                  placeholder={t("tb.descPh")}
                  onChange={(event) => onDescription(event.target.value)}
                />
                <p className="tp-help" id="template-description-help">
                  {t("tb.descHelp")}
                </p>
              </div>
            </div>

            {body.trim() === "" ? (
              <div className="tp-state tp-state--empty bld-empty" data-component="StateEmpty">
                <span className="tp-state__icon">
                  <TpIcon name="template" size="lg" />
                </span>
                <h2 className="tp-state__title">{t("tb.empty.title")}</h2>
                <p className="tp-state__body">{t("tb.empty.body")}</p>
                <div className="tp-state__actions">
                  <Link className="tp-btn tp-btn--secondary" href="/templates/sketch">
                    <TpIcon name="list" size="sm" />
                    <span>{t("tb.empty.sketch")}</span>
                  </Link>
                </div>
              </div>
            ) : null}

            <div className="tp-page-content bld-flow tp-slash-anchor" data-component="BlockList">
              <TemplateBodyEditor
                initialValue={initial.body}
                ariaLabel={t("tb.body")}
                placeholder={t("tb.bodyPh")}
                onChange={onBody}
              />
            </div>
          </div>
        </article>

        <section className="tp-surface bld-preview" data-component="TemplatePreview" aria-labelledby="pv-h">
          <div className="bld-row">
            <TpIcon name="page" size="sm" />
            <h2 className="tp-eyebrow" id="pv-h">
              {t("tb.pv.head")}
            </h2>
          </div>
          {exampleDay ? <p className="tp-muted tp-small">{t("tb.pv.sub").replace("{day}", () => exampleDay)}</p> : null}
          <div className="bld-preview__flow" id="pv-flow" aria-live="polite">
            {draft ? (
              <>
                <h3 className="tp-page-title" dir="auto">
                  {draft.title}
                </h3>
                {draft.body.trim() ? (
                  <ReadView
                    body={draft.body}
                    labels={{ minutes: t("editor.minutes"), brokenBlock: t("editor.broken"), template: t("editor.template") }}
                  />
                ) : (
                  <p className="tp-muted">{t("tb.pv.empty")}</p>
                )}
              </>
            ) : null}
          </div>
        </section>
      </div>
    </BuilderFrame>
  );
}

/**
 * Template builder (docs/design/v3/screens/web/template-builder.html), on the (bare) layout.
 * Left: the template as a page, in the live-preview editor with the slash menu. Right: the page
 * it makes, with today's {{tokens}} filled. Templates are Markdown (OVERNIGHT-RUN.md decision 6).
 *   ?id=<own template>  edits it in place (templates.update)
 *   ?from=<any template> starts a copy; ?outline=<sketch> starts from a sketch (templates.create)
 */
export function TemplateBuilderScreen({ fromId, editId, outline }: { fromId?: string; editId?: string; outline?: string }) {
  const { t } = useLocale();
  const sourceId = editId ?? fromId;
  const template = useQuery(api.templates.get, sourceId ? { templateId: sourceId } : "skip") as
    | SourceTemplate
    | null
    | undefined;

  if (sourceId && template === undefined) return <BuilderLoading />;
  if (sourceId && template === null) return <BuilderMissing />;

  if (template) {
    if (editId !== undefined && template.source === "user") {
      return (
        <BuilderForm
          key={`edit:${template.templateId}`}
          initial={draftFrom(template)}
          mode={{ kind: "edit", templateId: template.templateId }}
        />
      );
    }
    return (
      <BuilderForm
        key={`copy:${template.templateId}`}
        initial={draftFrom(template)}
        mode={{ kind: "create", note: t("tb.copyOf").replace("{name}", () => template.name) }}
      />
    );
  }

  const sketch = outline ? parseSketch(outline) : null;
  if (sketch) {
    return (
      <BuilderForm
        key="sketch"
        initial={{ ...EMPTY_DRAFT, name: sketch.name, body: sketch.body }}
        mode={{ kind: "create", note: t("tb.fromSketch") }}
      />
    );
  }
  return <BuilderForm key="blank" initial={EMPTY_DRAFT} mode={{ kind: "create" }} />;
}
