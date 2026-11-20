import { expect, test } from "bun:test";
import { applyPage, emptyPagedList, failPage, startPage } from "./list-pages";

type Row = { id: string; label: string };

test("empty start", () => {
  const empty = emptyPagedList<Row>();
  const started = startPage(empty);

  expect(empty).toEqual({
    items: [],
    nextCursor: null,
    hasMore: true,
    loading: false,
    requestId: 0,
  });
  expect(started).toEqual({ ...empty, loading: true, requestId: 1 });
  expect(startPage(started)).toBe(started);
});

test("first page", () => {
  const started = startPage(emptyPagedList<Row>());
  const page = applyPage(started, {
    requestId: started.requestId,
    items: [{ id: "one", label: "One" }],
    nextCursor: "one",
    hasMore: true,
  });

  expect(page).toEqual({
    items: [{ id: "one", label: "One" }],
    nextCursor: "one",
    hasMore: true,
    loading: false,
    requestId: 1,
  });
});

test("second page appended", () => {
  const first = applyPage(startPage(emptyPagedList<Row>()), {
    requestId: 1,
    items: [{ id: "one", label: "One" }],
    nextCursor: "one",
    hasMore: true,
  });
  const secondRequest = startPage(first);
  const second = applyPage(secondRequest, {
    requestId: secondRequest.requestId,
    items: [{ id: "two", label: "Two" }],
    nextCursor: "two",
    hasMore: true,
  });

  expect(second.items.map((row) => row.id)).toEqual(["one", "two"]);
});

test("repeated id skipped", () => {
  const list = applyPage(startPage(emptyPagedList<Row>()), {
    requestId: 1,
    items: [
      { id: "one", label: "First" },
      { id: "one", label: "Repeated" },
    ],
    nextCursor: "one",
    hasMore: true,
  });

  expect(list.items).toEqual([{ id: "one", label: "First" }]);
});

test("old request ignored", () => {
  const current = startPage(startPage(emptyPagedList<Row>()), { reset: true });
  const stale = applyPage(current, {
    requestId: current.requestId - 1,
    items: [{ id: "old", label: "Old" }],
    nextCursor: "old",
    hasMore: true,
  });

  expect(stale).toBe(current);
});

test("reset clears", () => {
  const loaded = applyPage(startPage(emptyPagedList<Row>()), {
    requestId: 1,
    items: [{ id: "one", label: "One" }],
    nextCursor: "one",
    hasMore: true,
  });
  const reset = startPage(loaded, { reset: true });

  expect(reset.items).toEqual([]);
  expect(reset.nextCursor).toBeNull();
  expect(reset.loading).toBe(true);
  expect(reset.requestId).toBe(2);
});

test("has-more false without a cursor", () => {
  const noCursor = applyPage(startPage(emptyPagedList<Row>()), {
    requestId: 1,
    items: [{ id: "one", label: "One" }],
    nextCursor: "  ",
    hasMore: true,
  });

  expect(noCursor.hasMore).toBe(false);
  expect(startPage(noCursor)).toBe(noCursor);
});

test("fail keeps rows", () => {
  const loaded = applyPage(startPage(emptyPagedList<Row>()), {
    requestId: 1,
    items: [{ id: "one", label: "One" }],
    nextCursor: "one",
    hasMore: true,
  });
  const request = startPage(loaded);
  const failed = failPage(request, request.requestId);

  expect(failed).toEqual({ ...request, loading: false });
  expect(failPage(request, request.requestId - 1)).toBe(request);
});
