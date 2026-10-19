"use client";

import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import {
  E2E_HARNESS,
  OfflineNotice,
  ScreenBoundary,
  Segmented,
  SignedOutState,
  StateEmpty,
  StateLoading,
  useOnline,
  useQueryParam,
  useSignedIn,
} from "@/components/goals/shared";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TaskViewsScreen } from "@/components/tasks/TaskViewsScreen";
import { TpIcon, TpIconSprite } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import {
  filterProjects,
  isProjectFilter,
  newProjectId,
  PROJECT_FILTERS,
  type ProjectFilter,
  type ProjectSummary,
  summarizeProjects,
} from "@/lib/goals-projects";
import { translateKb08, type Kb08Lang, type Kb08Key } from "@/lib/i18n-groups/kb-08";
import "@/app/v3/kb-08.css";

const FILTER_LABEL = {
  all: "pj.all",
  active: "pj.status.active",
  paused: "pj.status.paused",
  done: "pj.status.done",
} as const;

/**
 * Projects (docs/design/v3/screens/web/projects.html). There is no projects table: a project is
 * the tasks that share a projectId, so each card shows its name, a status worked out from those
 * tasks (Done when every task is done, else Active) and "3 of 6 tasks done". The design's why,
 * due date and "Part of" goal have no stored source yet and are left out.
 */
export function ProjectsScreen() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  // The local Playwright harness opens /projects signed out with a placeholder Convex URL; the
  // core task-views spec reads the browser-stored project list there (as /today does).
  if (E2E_HARNESS && !isLoading && !isAuthenticated) {
    return <TaskViewsScreen view="project" projectSlug="home-reset" />;
  }
  return <ProjectsBoundary />;
}

function ProjectsBoundary() {
  const { lang } = useLocale();
  return (
    <ScreenBoundary
      fallback={(retry) => (
        <div className="tp-page tp-page--wide pj-stack" data-component="PageLayout">
          <ProjectsHeader />
          <ProjectListState kind="error" lang={lang} onAction={retry} />
        </div>
      )}
    >
      <ProjectsContent />
    </ScreenBoundary>
  );
}

function useStartProject() {
  const router = useRouter();
  // A project exists once it has a task: the new page opens empty, and its first task saves it.
  return () => router.push(`/projects/${newProjectId(Date.now(), Math.random())}`);
}

function ProjectsHeader({ onNew }: { onNew?: () => void }) {
  const { t } = useLocale();
  return (
    <header className="tp-pagehead" data-component="PageHeader">
      <div className="tp-pagehead__text">
        <h1 className="tp-pagehead__title">{t("pj.title")}</h1>
        <p className="tp-pagehead__sub">{t("pj.sub")}</p>
      </div>
      {onNew ? (
        <div className="tp-pagehead__actions">
          <button className="tp-btn tp-btn--primary" type="button" data-component="Button" onClick={onNew}>
            <TpIcon name="plus" size="sm" />
            <span>{t("pj.new")}</span>
          </button>
        </div>
      ) : null}
    </header>
  );
}

function ProjectsContent() {
  const { t, lang } = useLocale();
  const signedIn = useSignedIn();
  const online = useOnline();
  const startProject = useStartProject();
  const tasks = useQuery(api.tasks.list, signedIn === "ready" ? {} : "skip");
  const [filter, setFilter] = useQueryParam<ProjectFilter>("status", "all", isProjectFilter);

  if (signedIn === "signedOut") {
    return (
      <div className="tp-page tp-page--wide pj-stack" data-component="PageLayout">
        <ProjectsHeader />
        <SignedOutState />
      </div>
    );
  }

  const loading = tasks === undefined;
  const projects = summarizeProjects(tasks ?? []);
  const shown = filterProjects(projects, filter);
  const empty = !loading && projects.length === 0;

  return (
    <div className="tp-page tp-page--wide pj-stack" data-component="PageLayout">
      <ProjectsHeader onNew={loading || empty ? undefined : startProject} />
      {online ? null : <ProjectListState kind="offline" lang={lang} />}

      {loading ? (
        <ProjectListState kind="loading" lang={lang} />
      ) : empty ? (
        <ProjectListState kind="empty" lang={lang} onAction={startProject} />
      ) : (
        <>
          <div className="tp-toolbar" data-component="Toolbar">
            <span className="tp-label" id="pj-filter-label">
              {t("pj.filter")}
            </span>
            <Segmented
              options={PROJECT_FILTERS}
              value={filter}
              onChange={setFilter}
              labelledBy="pj-filter-label"
              render={(option) => <span>{t(FILTER_LABEL[option])}</span>}
            />
            <span className="tp-muted tp-small tp-toolbar__end" aria-live="polite">
              <span>{t("pj.showing")}</span> <span className="tp-num">{shown.length}</span>{" "}
              <span>{t("pj.projects")}</span>
            </span>
          </div>

          {shown.length > 0 ? (
            <div className="tp-cards pj-cards kb08-list" data-component="CardGrid">
              {shown.map((project) => (
                <ProjectCard key={project.id} project={project} lang={lang} />
              ))}
            </div>
          ) : (
            <ProjectListState kind="filtered" lang={lang} onAction={() => setFilter("all")} />
          )}
        </>
      )}
    </div>
  );
}

function ProjectCard({ project, lang }: { project: ProjectSummary; lang: Kb08Lang }) {
  return <ProjectSummaryRow project={project} lang={lang} />;
}

/** A project summary with distinct, named navigation targets and no nested controls. */
export function ProjectSummaryRow({
  project,
  lang,
  disabled = false,
  onNavigate,
}: {
  readonly project: Readonly<ProjectSummary>;
  readonly lang: Kb08Lang;
  readonly disabled?: boolean;
  readonly onNavigate?: (target: "project" | "board") => void;
}) {
  const href = `/projects/${encodeURIComponent(project.id)}`;
  const titleId = `kb08-project-${encodeURIComponent(project.id)}-title`;
  const count = project.total === 0
    ? translateKb08(lang, "count.none")
    : project.total === 1
      ? translateKb08(lang, "count.one", { done: `\u2066${project.done}\u2069` })
      : translateKb08(lang, "count.many", {
          done: `\u2066${project.done}\u2069`,
          total: `\u2066${project.total}\u2069`,
        });
  const navigate = (target: "project" | "board") => (event: MouseEvent<HTMLAnchorElement>) => {
    if (disabled || onNavigate) event.preventDefault();
    if (!disabled) onNavigate?.(target);
  };
  return (
    <article className="tp-card pj-card kb08-row" data-component="ProjectSummaryRow" data-status={project.status} data-disabled={disabled} aria-labelledby={titleId}>
      <div className="kb08-row__summary">
        <span className="tp-status" data-status={project.status}>
          <TpIcon name={project.status === "done" ? "check" : project.status === "paused" ? "pause" : project.status === "idea" ? "leaf" : "play"} size="sm" />
          <span>{translateKb08(lang, `status.${project.status}` as Kb08Key)}</span>
        </span>
        <h2 className="tp-h3 kb08-row__name" id={titleId} dir="auto">{project.name}</h2>
        <span className="kb08-row__count tp-small" dir="auto">{count}</span>
      </div>
      <div className="pj-card__actions kb08-row__actions">
        {disabled ? <span className="tp-btn tp-btn--secondary tp-btn--sm" aria-disabled="true"><TpIcon name="page" size="sm" /><span>{translateKb08(lang, "open.short")}</span></span> : <Link className="tp-btn tp-btn--secondary tp-btn--sm" href={href} aria-label={translateKb08(lang, "open", { name: project.name })} onClick={navigate("project")}>
          <TpIcon name="page" size="sm" />
          <span>{translateKb08(lang, "open.short")}</span>
        </Link>}
        {disabled ? <span className="tp-btn tp-btn--ghost tp-btn--sm" aria-disabled="true"><TpIcon name="kanban" size="sm" /><span>{translateKb08(lang, "board.short")}</span></span> : <Link className="tp-btn tp-btn--ghost tp-btn--sm" href={`${href}/kanban`} aria-label={translateKb08(lang, "board", { name: project.name })} onClick={navigate("board")}>
          <TpIcon name="kanban" size="sm" />
          <span>{translateKb08(lang, "board.short")}</span>
        </Link>}
      </div>
    </article>
  );
}

type ProjectListKind = "empty" | "filtered" | "loading" | "error" | "offline" | "disabled";

/** Stable list states shared by the mounted screen and the controlled gallery. */
export function ProjectListState({ kind, lang, onAction }: {
  readonly kind: ProjectListKind;
  readonly lang: Kb08Lang;
  readonly onAction?: () => void;
}) {
  if (kind === "loading") return <div className="kb08-state"><StateLoading label={translateKb08(lang, "loading")} /></div>;
  if (kind === "offline") return <div className="kb08-state"><OfflineNotice text={translateKb08(lang, "offline")} /></div>;
  if (kind === "error") return (
    <div className="tp-state tp-state--error kb08-state" role="alert" data-component="ProjectListState">
      <h2 className="tp-state__title">{translateKb08(lang, "error.title")}</h2>
      <p className="tp-state__body">{translateKb08(lang, "error.body")}</p>
      {onAction ? <div className="tp-state__actions"><button className="tp-btn tp-btn--secondary" type="button" onClick={onAction}>{translateKb08(lang, "error.action")}</button></div> : null}
    </div>
  );
  if (kind === "disabled") return <div className="tp-state kb08-state" data-component="ProjectListState"><p className="tp-state__body">{translateKb08(lang, "disabled.title")}</p></div>;
  const prefix = kind === "filtered" ? "filtered" : "empty";
  return <div className="kb08-state"><StateEmpty
    icon={kind === "filtered" ? "filter" : "folder"}
    title={translateKb08(lang, `${prefix}.title` as Kb08Key)}
    body={translateKb08(lang, `${prefix}.body` as Kb08Key)}
    action={onAction ? <button className="tp-btn tp-btn--secondary" type="button" onClick={onAction}>{translateKb08(lang, `${prefix}.action` as Kb08Key)}</button> : undefined}
  /></div>;
}

/** Standalone interactive fixture; fictional data and callbacks, no backend subscription. */
export function Kb08Gallery() {
  const [lang, setLang] = useState<Kb08Lang>("en");
  const [state, setState] = useState<"default" | "empty" | "loading" | "error" | "disabled" | "overflow" | "offline">("default");
  const [feedback, setFeedback] = useState("");
  const samples: ProjectSummary[] = state === "overflow" ? [{ id: "maya-long", name: "Maya's very long home and garden project with a name that needs to wrap comfortably on a narrow phone", done: 2, total: 12, status: "active", updatedAt: 1 }] : [
    { id: "maya-home", name: "Maya's home", done: 2, total: 6, status: "active", updatedAt: 3 },
    { id: "dana-notes", name: "Dana's notes", done: 1, total: 1, status: "done", updatedAt: 2 },
    { id: "yoni-week", name: "Yoni's week", done: 0, total: 3, status: "paused", updatedAt: 1 },
  ];
  const states = ["default", "empty", "loading", "error", "disabled", "overflow", "offline"] as const;
  return <main className="kb08-gallery" lang={lang} dir={lang === "he" ? "rtl" : "ltr"} data-component="Kb08Gallery">
    <TpIconSprite />
    <h1 className="tp-pagehead__title">{translateKb08(lang, "gallery.title")}</h1>
    <fieldset className="kb08-gallery__controls"><legend className="tp-sr-only">{translateKb08(lang, "gallery.language")}</legend>
      <button type="button" className="tp-btn tp-btn--secondary" aria-pressed={lang === "en"} onClick={() => setLang("en")}>English</button>
      <button type="button" className="tp-btn tp-btn--secondary" aria-pressed={lang === "he"} onClick={() => setLang("he")}>עברית</button>
    </fieldset>
    <fieldset className="kb08-gallery__controls"><legend className="tp-sr-only">{translateKb08(lang, "gallery.state")}</legend>
      {states.map((next) => <button key={next} type="button" className="tp-btn tp-btn--secondary" aria-pressed={state === next} onClick={() => { setState(next); setFeedback(""); }}>{translateKb08(lang, `gallery.${next}`)}</button>)}
    </fieldset>
    {state === "offline" ? <ProjectListState kind="offline" lang={lang} /> : null}
    {state === "empty" || state === "loading" || state === "error" ? <ProjectListState kind={state} lang={lang} onAction={() => setFeedback(state)} /> : null}
    {state === "disabled" ? <ProjectListState kind="disabled" lang={lang} /> : null}
    {state === "default" || state === "disabled" || state === "overflow" || state === "offline" ? <div className="kb08-list">{samples.map((project) => <ProjectSummaryRow key={project.id} project={project} lang={lang} disabled={state === "disabled"} onNavigate={(target) => setFeedback(`${project.id}: ${target}`)} />)}</div> : null}
    {feedback ? <output aria-live="polite">{translateKb08(lang, "gallery.feedback", { action: feedback })}</output> : null}
  </main>;
}
