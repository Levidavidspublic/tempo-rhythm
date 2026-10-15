"use client";

import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  E2E_HARNESS,
  OfflineNotice,
  ScreenBoundary,
  Segmented,
  SignedOutState,
  StateEmpty,
  StateError,
  StateLoading,
  StatusBadge,
  useOnline,
  useQueryParam,
  useSignedIn,
} from "@/components/goals/shared";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TaskViewsScreen } from "@/components/tasks/TaskViewsScreen";
import { TpIcon } from "@/components/tempo/TpIcon";
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
  const { t } = useLocale();
  return (
    <ScreenBoundary
      fallback={(retry) => (
        <div className="tp-page tp-page--wide pj-stack" data-component="PageLayout">
          <ProjectsHeader />
          <StateError title={t("pj.error")} onRetry={retry} />
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
  const { t } = useLocale();
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
      {online ? null : <OfflineNotice text={t("gx.offline")} />}

      {loading ? (
        <StateLoading label={t("pj.loading")} />
      ) : empty ? (
        <StateEmpty
          icon="folder"
          title={t("pj.empty.title")}
          body={t("pj.empty.body")}
          action={
            <button className="tp-btn tp-btn--secondary" type="button" onClick={startProject}>
              <TpIcon name="plus" size="sm" />
              <span>{t("pj.empty.add")}</span>
            </button>
          }
        />
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
            <div className="tp-cards pj-cards" data-component="CardGrid">
              {shown.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <StateEmpty
              icon="filter"
              title={t("pj.none.title")}
              body={t("pj.none.body")}
              action={
                <button className="tp-btn tp-btn--secondary" type="button" onClick={() => setFilter("all")}>
                  <span>{t("pj.showall")}</span>
                </button>
              }
            />
          )}
        </>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  const { t } = useLocale();
  const href = `/projects/${encodeURIComponent(project.id)}`;
  const titleId = `project-${project.id}-title`;
  return (
    <article className="tp-card pj-card" data-component="Card" data-status={project.status} aria-labelledby={titleId}>
      <div className="tp-card__head">
        <StatusBadge kind="project" status={project.status} />
      </div>
      <h2 className="tp-h3" id={titleId}>
        <Link href={href} dir="auto">
          {project.name}
        </Link>
      </h2>
      <div className="pj-card__meta tp-small">
        <span>
          <span className="tp-num">{project.done}</span> <span>{t("gx.of")}</span>{" "}
          <span className="tp-num">{project.total}</span> <span>{t("pj.tasksdone")}</span>
        </span>
      </div>
      <div className="pj-card__actions">
        <Link className="tp-btn tp-btn--secondary tp-btn--sm" href={href} aria-describedby={titleId}>
          <TpIcon name="page" size="sm" />
          <span>{t("pj.open")}</span>
        </Link>
        <Link className="tp-btn tp-btn--ghost tp-btn--sm" href={`${href}/kanban`} aria-describedby={titleId}>
          <TpIcon name="kanban" size="sm" />
          <span>{t("pj.board")}</span>
        </Link>
      </div>
    </article>
  );
}
