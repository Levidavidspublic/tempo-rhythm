"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * "Type answers" for flashcards (the review session and a deck): typed recall on or off,
 * remembered per browser in localStorage. Off by default, and off whenever storage can't be read
 * (a private window, blocked site data); then the choice lasts for the page only.
 */

export const TYPED_ANSWERS_KEY = "tempo-study-typed";

export type TypedAnswersStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The browser's localStorage, or null where there is none or reaching it throws. */
export function browserStorage(): TypedAnswersStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readTypedAnswers(storage: TypedAnswersStorage | null): boolean {
  try {
    return storage?.getItem(TYPED_ANSWERS_KEY) === "on";
  } catch {
    return false;
  }
}

export function writeTypedAnswers(storage: TypedAnswersStorage | null, on: boolean): void {
  try {
    if (on) storage?.setItem(TYPED_ANSWERS_KEY, "on");
    else storage?.removeItem(TYPED_ANSWERS_KEY);
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
}

/**
 * The remembered choice and a setter that saves it. Read after mount, so the server render and
 * the first client render match (both off).
 */
export function useTypedAnswers(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(readTypedAnswers(browserStorage()));
  }, []);
  const set = useCallback((next: boolean) => {
    setOn(next);
    writeTypedAnswers(browserStorage(), next);
  }, []);
  return [on, set];
}
