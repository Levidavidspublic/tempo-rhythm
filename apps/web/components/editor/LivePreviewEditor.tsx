"use client";

import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { Compartment, EditorSelection, EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap, placeholder as placeholderExtension } from "@codemirror/view";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { slashQuery, wikiQuery } from "@/lib/editor/markdown-model";
import { type EditorLabels, livePreview } from "./live-preview";

/** What the page editor needs to draw the slash menu or the [[ picker under the caret. */
export type EditorTrigger = {
  kind: "slash" | "wiki";
  query: string;
  /** Range the chosen item replaces ("/query" or "[[query"). */
  from: number;
  to: number;
  atLineStart: boolean;
  /** Caret position in viewport coordinates. */
  coords: { left: number; top: number; bottom: number } | null;
};

export type MenuKey = "ArrowUp" | "ArrowDown" | "Enter" | "Escape" | "Tab";

export type LivePreviewEditorHandle = {
  /** Replaces [from, to) and puts the caret `cursor` units into the inserted text. */
  replace: (from: number, to: number, text: string, cursor?: number) => void;
  focus: () => void;
  getText: () => string;
};

type Props = {
  /** The body as loaded. The editor is uncontrolled after mount; remount with `key` per page. */
  initialValue: string;
  ariaLabel: string;
  placeholder?: string;
  labels: EditorLabels;
  onChange: (body: string) => void;
  onTrigger?: (trigger: EditorTrigger | null) => void;
  /** Return true when an open menu handled the key. */
  onMenuKey?: (key: MenuKey) => boolean;
  onOpenLink?: (title: string) => void;
};

/**
 * The v3 page editor surface: CodeMirror 6 over the exact Markdown text with Obsidian-style
 * live preview (OVERNIGHT-RUN.md decision 2). Paste inserts Markdown as text, so it renders at
 * once; copy gives the Markdown back. Each line takes its own direction (dir=auto, F-72).
 */
export const LivePreviewEditor = forwardRef<LivePreviewEditorHandle, Props>(function LivePreviewEditor(
  { initialValue, ariaLabel, placeholder, labels, onChange, onTrigger, onMenuKey, onOpenLink },
  ref,
) {
  const host = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Labels and placeholder follow the UI language; swap them in place, never remount the editor.
  const localized = useRef(new Compartment());
  const localizedExtensions = () => [
    livePreview({ labels, onOpenLink: (title) => callbacks.current.onOpenLink?.(title) }),
    placeholder ? placeholderExtension(placeholder) : [],
    EditorView.contentAttributes.of({ "aria-label": ariaLabel, "aria-multiline": "true", spellcheck: "true" }),
  ];
  const localizedKey = JSON.stringify([labels, placeholder, ariaLabel]);
  // Callbacks change every render; the editor reads them through refs.
  const callbacks = useRef({ onChange, onTrigger, onMenuKey, onOpenLink });
  callbacks.current = { onChange, onTrigger, onMenuKey, onOpenLink };

  useImperativeHandle(ref, () => ({
    replace(from, to, text, cursor) {
      const view = viewRef.current;
      if (!view) return;
      const at = from + (cursor ?? text.length);
      view.dispatch({
        changes: { from, to, insert: text },
        selection: EditorSelection.cursor(at),
        scrollIntoView: true,
        userEvent: "input.complete",
      });
      view.focus();
    },
    focus() {
      viewRef.current?.focus();
    },
    getText() {
      return viewRef.current?.state.doc.toString() ?? "";
    },
  }));

  // biome-ignore lint/correctness/useExhaustiveDependencies: the editor is created once per mount; remount with a new key to load another page
  useEffect(() => {
    if (!host.current) return;
    const menuKey = (key: MenuKey) => () => callbacks.current.onMenuKey?.(key) ?? false;
    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        Prec.highest(
          keymap.of([
            { key: "ArrowUp", run: menuKey("ArrowUp") },
            { key: "ArrowDown", run: menuKey("ArrowDown") },
            { key: "Enter", run: menuKey("Enter") },
            { key: "Tab", run: menuKey("Tab") },
            { key: "Escape", run: menuKey("Escape") },
          ]),
        ),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown({ base: markdownLanguage }),
        localized.current.of(localizedExtensions()),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
          if (!(update.docChanged || update.selectionSet || update.focusChanged)) return;
          const report = callbacks.current.onTrigger;
          if (!report) return;
          const sel = update.state.selection.main;
          if (!sel.empty || !update.view.hasFocus) {
            report(null);
            return;
          }
          const line = update.state.doc.lineAt(sel.head);
          const before = line.text.slice(0, sel.head - line.from);
          const wiki = wikiQuery(before);
          const slash = wiki ? null : slashQuery(before);
          const hit = wiki ?? slash;
          if (!hit) {
            report(null);
            return;
          }
          const from = line.from + hit.offset;
          const c = update.view.coordsAtPos(sel.head);
          report({
            kind: wiki ? "wiki" : "slash",
            query: hit.query,
            from,
            to: sel.head,
            atLineStart: before.slice(0, hit.offset).trim() === "",
            coords: c ? { left: c.left, top: c.top, bottom: c.bottom } : null,
          });
        }),
      ],
    });
    const view = new EditorView({ state, parent: host.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: localizedKey stands for labels, placeholder and ariaLabel
  useEffect(() => {
    viewRef.current?.dispatch({ effects: localized.current.reconfigure(localizedExtensions()) });
  }, [localizedKey]);

  return <div ref={host} className="tp-editor" data-component="PageEditorSurface" />;
});
