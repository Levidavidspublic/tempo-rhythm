"use client";

import { fillNodes } from "@tempo/ui";
import Link from "next/link";
import {
  type FormEvent,
  Fragment,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { TpIcon } from "@/components/tempo/TpIcon";
import {
  type AskFrom,
  answerFromSet,
  markQuote,
  readAskPage,
  type SetMatch,
  setPassages,
} from "../../../../packages/core/recap";
import { fillWith } from "./fill";
import type { StudyT } from "./labels";
import type { SetBlock, SetData } from "./StudySetView";

/**
 * "Ask about this set" on /study/[setId]: a quiet disclosure under the study panel. The question
 * is matched on the device against the set's page and the set's own items (`answerFromSet` in
 * packages/core/recap): no model, no network, and every answer is a quote that says where it came
 * from. Matched words are bold, and a line says so. Find it stays secondary; the study panel
 * keeps the screen's one primary. Opening moves focus to the question; closing leaves it on the
 * toggle. The page is read only once the panel first opens (`onOpen`).
 */

/** The page Ask reads: the page the set was made from, else the page that holds the set. */
export function askPageId(data: Pick<SetData, "set" | "note" | "block">): string {
  return data.set.sourceNoteId ?? data.block.data.source?.noteId ?? data.note.id;
}

/** The page's words: undefined while they load, null when there is no page to read. */
export type AskPage = { id: string; title: string; body: string } | null | undefined;

/** Where an answer comes from, in words ("From card 4"). Numbers in .tp-num. */
export function fromLabel(t: StudyT, from: AskFrom): ReactNode {
  if (from.kind === "page") return t("st.ask.from.page");
  if (from.kind === "card") return fillNodes(t("st.ask.from.card"), { n: from.n });
  if (from.kind === "question") return fillNodes(t("st.ask.from.question"), { n: from.n });
  return fillWith(t("st.ask.from.test"), {
    section: <span dir="auto">{from.section}</span>,
    n: <span className="tp-num">{from.n}</span>,
  });
}

/** A quote line with the words the question matched in <mark> (bold; never colour alone). */
function marked(line: string, question: string): ReactNode {
  return markQuote(line, question).map((run, at) =>
    run.match ? <mark key={at}>{run.text}</mark> : <Fragment key={at}>{run.text}</Fragment>
  );
}

/**
 * What was last asked, and how many times Find it was used. The answers sit in a wrapper keyed on
 * the count, so asking the same question again puts them back fresh and a screen reader reads them
 * again: a polite live region doesn't announce words it already holds.
 */
export type AskState = { question: string | null; count: number };

/** One Find it: the question as asked (null when it is only spaces), counted. */
export function askReducer(state: AskState, question: string): AskState {
  return { question: question.trim() || null, count: state.count + 1 };
}

export type SetAskProps = {
  block: SetBlock;
  /**
   * The block's content version (`blockVersion` from getSet). getSet hands back a new block object
   * after every review or attempt; the set's items are read again only when this changes (without
   * it, whenever `block` does).
   */
  version?: string;
  page: AskPage;
  online: boolean;
  t: StudyT;
  /** Called when the panel opens, so the screen reads the page only once someone asks. */
  onOpen?: () => void;
  /** Open with this question already asked (the gallery and static renders). */
  initialQuestion?: string;
};

export function SetAsk({ block, version, page, online, t, onOpen, initialQuestion }: SetAskProps) {
  const id = useId();
  const panelId = `${id}-panel`;
  const inputId = `${id}-question`;
  const [open, setOpen] = useState(initialQuestion !== undefined);
  const [question, setQuestion] = useState(initialQuestion ?? "");
  const [ask, dispatchAsk] = useReducer(askReducer, {
    question: initialQuestion?.trim() || null,
    count: 0,
  });
  const asked = ask.question;
  const input = useRef<HTMLInputElement>(null);
  const focusField = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the version stands for the block's words
  const items = useMemo(() => setPassages(block), [version ?? block]);
  // The page answers once its words are here; while they load the set's items answer first, and
  // offline (or with no page) only the set is searched, and the words say so.
  const where = page ? "page" : page === undefined && online ? "loading" : "set";
  const body = page ? page.body : null;
  // Read once per page body, not once per question or per new `page` object.
  const reading = useMemo(() => (body ? readAskPage(body) : null), [body]);
  const matches = useMemo(
    () => (asked ? answerFromSet({ page: reading, items }, asked) : null),
    [asked, reading, items]
  );

  useEffect(() => {
    if (!open || !focusField.current) return;
    focusField.current = false;
    input.current?.focus();
  }, [open]);

  const toggle = () => {
    if (!open) {
      focusField.current = true;
      onOpen?.();
    }
    setOpen(!open);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    dispatchAsk(question);
  };

  return (
    <section className="tp-study-ask" data-component="SetAsk" aria-labelledby={`${id}-title`}>
      <h2 className="tp-study-ask__heading" id={`${id}-title`}>
        <button
          type="button"
          className="tp-btn tp-btn--ghost tp-study-ask__toggle"
          data-action="ask-set"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
        >
          <TpIcon name="search" size="sm" />
          <span>{t("st.ask.title")}</span>
          <TpIcon name="down" size="sm" className="tp-study-ask__chevron" />
        </button>
      </h2>
      <div className="tp-study-ask__panel" id={panelId} hidden={!open}>
        <form className="tp-recap__askform" onSubmit={submit}>
          <div className="tp-field">
            <label className="tp-label" htmlFor={inputId}>
              {t("st.ask.label")}
            </label>
            {/* The recap's row: the field and Find it side by side, wrapping together on a phone. */}
            <div className="tp-recap__askrow">
              <input
                ref={input}
                id={inputId}
                className="tp-input"
                dir="auto"
                value={question}
                data-action="ask-set-input"
                aria-describedby={`${id}-help`}
                onChange={(event) => setQuestion(event.currentTarget.value)}
              />
              <button
                type="submit"
                className="tp-btn tp-btn--secondary"
                data-action="ask-set-find"
                disabled={!question.trim()}
              >
                <TpIcon name="search" size="sm" />
                <span>{t("st.ask.find")}</span>
              </button>
            </div>
            <p className="tp-help" id={`${id}-help`}>
              {where === "set" ? t("st.ask.helpSet") : t("st.ask.help")}
            </p>
          </div>
        </form>
        <div className="tp-study-ask__results" aria-live="polite">
          {matches && asked ? (
            // The live region stays; what's inside is new on each Find it (see AskState).
            <Fragment key={ask.count}>
              <Answers matches={matches} asked={asked} where={where} page={page} t={t} />
            </Fragment>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Answers({
  matches,
  asked,
  where,
  page,
  t,
}: {
  matches: readonly SetMatch[];
  asked: string;
  where: "page" | "loading" | "set";
  page: AskPage;
  t: StudyT;
}) {
  return (
    <>
      {matches.length > 0 ? (
        <>
          <p className="tp-small tp-muted">{t("st.ask.marked")}</p>
          <ul className="tp-recap__quotes">
            {matches.map((match) => (
              <li key={match.id} data-from={match.from.kind}>
                <p className="tp-recap__from">{fromLabel(t, match.from)}</p>
                {match.lines.map((line, at) => (
                  <p key={at} className="tp-study-ask__line" dir="auto">
                    {marked(line, asked)}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {where === "loading" ? (
        <p className="tp-small">{t("st.ask.stillPage")}</p>
      ) : matches.length === 0 ? (
        <>
          <p className="tp-small">{where === "page" ? t("st.ask.empty") : t("st.ask.emptySet")}</p>
          {page ? (
            <Link
              className="tp-btn tp-btn--ghost"
              href={`/notes/${encodeURIComponent(page.id)}`}
              data-action="ask-open-page"
            >
              <TpIcon name="page" size="sm" />
              <span>
                {page.title.trim()
                  ? fillWith(t("st.ask.openPage"), { page: <span dir="auto">{page.title}</span> })
                  : t("st.set.openPage")}
              </span>
            </Link>
          ) : null}
        </>
      ) : null}
    </>
  );
}
