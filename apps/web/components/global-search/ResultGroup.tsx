import Link from "next/link";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";

export type ResultRow = {
  id: string;
  label: string;
  href: string;
  detail?: string;
};

type Props = {
  /** Stable id part for the heading ("notes", "tasks", ...). */
  kind: string;
  title: string;
  icon: TpIconName;
  rows: ResultRow[];
};

/** One group of results (search.html Section + ListRow): heading, count, linked rows. */
export function ResultGroup({ kind, title, icon, rows }: Props) {
  if (rows.length === 0) return null;
  const headingId = `search-group-${kind}`;
  return (
    <section aria-labelledby={headingId} className="tp-section" data-component="Section" data-group={kind}>
      <div className="tp-section__head">
        <h2 id={headingId} className="tp-section__title">
          {title}
        </h2>
        <span className="tp-section__count tp-num">{rows.length}</span>
      </div>
      <ul className="tp-list tp-surface sr-list" data-component="ListRow">
        {rows.map((row) => (
          <li key={row.id}>
            <Link href={row.href} data-search-result className="tp-list-row">
              <span className="tp-list-row__icon">
                <TpIcon name={icon} size="sm" />
              </span>
              <span className="tp-list-row__body">
                <span className="tp-list-row__title" dir="auto">
                  {row.label}
                </span>
                {row.detail ? (
                  <span className="tp-list-row__meta" dir="auto">
                    {row.detail}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
