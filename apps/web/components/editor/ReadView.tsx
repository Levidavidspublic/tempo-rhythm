"use client";

import { parseTempoBlocks } from "@tempo/utils";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { TpIcon } from "@/components/tempo/TpIcon";

type Props = {
  body: string;
  /** Opens the page a [[Title]] points to (or makes it, like the editor does). */
  onOpenLink: (title: string) => void;
  labels: { minutes: string; brokenBlock: string; template: string };
};

const WIKI = /\[\[([^[\]\n|]{1,200})(?:\|([^[\]\n]{1,200}))?\]\]/g;

/** [[Title]] → a Markdown link with a `wiki:` URL the link renderer resolves. */
function linkWikis(markdown: string): string {
  return markdown.replace(WIKI, (_whole, title: string, shown?: string) => {
    const text = (shown ?? title).replace(/[[\]]/g, "");
    return `[${text}](wiki:${encodeURIComponent(title.trim())})`;
  });
}

/**
 * Read view of a page (OVERNIGHT-RUN.md decision 2: remark-gfm). Markdown renders with GFM
 * (tables, task lists, strikethrough); Tempo blocks render as the same quiet cards as the
 * editor and never show their JSON. Raw HTML stays escaped and remote images never load.
 */
export function ReadView({ body, onOpenLink, labels }: Props) {
  const segments = parseTempoBlocks(body);
  return (
    <div className="tp-page-content tp-prose" data-component="ReadView" dir="auto">
      {segments.map((segment) => {
        if (segment.kind === "markdown") {
          return (
            <Markdown
              key={segment.start}
              remarkPlugins={[remarkGfm]}
              urlTransform={(url) => (url.startsWith("wiki:") ? url : defaultUrlTransform(url))}
              components={{
                a({ href, children }) {
                  if (href?.startsWith("wiki:")) {
                    const title = decodeURIComponent(href.slice(5));
                    return (
                      <button className="tp-wikilink" type="button" onClick={() => onOpenLink(title)}>
                        {children}
                      </button>
                    );
                  }
                  return (
                    <a href={href} rel="noopener noreferrer nofollow" target="_blank">
                      {children}
                    </a>
                  );
                },
                // No remote requests from a page (contract OD-05): show the alt text instead.
                img({ alt }) {
                  return <span className="tp-muted">{alt ?? ""}</span>;
                },
                p({ children }) {
                  return <p dir="auto">{children}</p>;
                },
                li({ children, className }) {
                  return (
                    <li dir="auto" className={className}>
                      {children}
                    </li>
                  );
                },
                code({ children, className }) {
                  return (
                    <code className={`tp-mono ${className ?? ""}`} dir="ltr">
                      {children}
                    </code>
                  );
                },
              }}
            >
              {linkWikis(segment.source)}
            </Markdown>
          );
        }
        if (segment.kind === "broken") {
          if (segment.errorCode === "unclosed_fence") {
            return (
              <pre key={segment.start} className="tp-mono" dir="ltr">
                {segment.source}
              </pre>
            );
          }
          return (
            <div key={segment.start} className="tp-block-broken" data-component="BrokenBlock" role="note">
              <TpIcon name="alert" size="sm" />
              <span className="tp-block-broken__text">{labels.brokenBlock}</span>
            </div>
          );
        }
        const block = segment.block;
        if (block.type === "page-meta") return null;
        if (block.type === "template") {
          return (
            <div key={segment.start} className="tp-card" data-component="TemplateBlock">
              <div className="tp-card__head">
                <TpIcon name="template" size="sm" />
                <span className="tp-card__title" dir="auto">
                  {labels.template} · {block.data.name}
                </span>
              </div>
            </div>
          );
        }
        const done = block.data.status === "done";
        return (
          <ul key={segment.start} className="tp-block-task" data-component="TaskBlock">
            <li className="tp-task-row" data-component="TaskRow" data-done={done}>
              <span className="tp-check" role="img" aria-label={done ? "✓" : "○"}>
                <span className="tp-check__box">
                  <TpIcon name="check" />
                </span>
              </span>
              <div className="tp-task-row__body">
                <span className="tp-task-row__title" dir="auto">
                  {block.data.title}
                </span>
                <span className="tp-task-row__meta">
                  <span>
                    <span className="tp-num">{block.data.durationMin}</span> {labels.minutes}
                  </span>
                </span>
              </div>
              <span />
            </li>
          </ul>
        );
      })}
    </div>
  );
}
