import { describe, expect, test } from "bun:test";
import { notePatch, shouldAdoptRemoteTitle } from "./note-sync";

describe("notePatch", () => {
  test("a body-only edit never sends the title", () => {
    expect(notePatch({ title: false, body: true }, "Old title", "New body")).toEqual({ body: "New body" });
  });

  test("a title-only edit never sends the body", () => {
    expect(notePatch({ title: true, body: false }, "Renamed", "Old body")).toEqual({ title: "Renamed" });
  });

  test("both edited: both are sent; nothing edited: nothing is sent", () => {
    expect(notePatch({ title: true, body: true }, "T", "B")).toEqual({ title: "T", body: "B" });
    expect(notePatch({ title: false, body: false }, "T", "B")).toEqual({});
  });

  test("an emptied title or body is still sent", () => {
    expect(notePatch({ title: true, body: true }, "", "")).toEqual({ title: "", body: "" });
  });
});

describe("shouldAdoptRemoteTitle", () => {
  test("a rename saved in another tab shows here when nothing is unsaved here", () => {
    expect(shouldAdoptRemoteTitle("Renamed in A", "Two tabs", false, false)).toBe(true);
  });

  test("a title being typed here wins until it is saved", () => {
    expect(shouldAdoptRemoteTitle("Renamed in A", "My draft", true, false)).toBe(false);
    expect(shouldAdoptRemoteTitle("Renamed in A", "My draft", false, true)).toBe(false);
  });

  test("the server's trimmed copy of this tab's own title is not a change", () => {
    expect(shouldAdoptRemoteTitle("Week plan", "Week plan ", false, false)).toBe(false);
    expect(shouldAdoptRemoteTitle("Week plan", "Week plan", false, false)).toBe(false);
  });

  test("mixed Hebrew, emoji and Latin titles compare as written", () => {
    expect(shouldAdoptRemoteTitle("שלום world 🎉", "שלום world 🎉", false, false)).toBe(false);
    expect(shouldAdoptRemoteTitle("שלום world 🎉 2", "שלום world 🎉", false, false)).toBe(true);
  });
});
