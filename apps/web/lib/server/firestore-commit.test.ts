import { describe, expect, test } from "bun:test";
import { buildCommitRequest, type CommitWrite } from "./firestore-commit";

const stringField = (value: string) => ({ stringValue: value });

describe("buildCommitRequest", () => {
  test("builds one exact commit body for a create and update", () => {
    expect(
      buildCommitRequest("tempo project", [
        { kind: "create", path: "users/u1/tasks/t1", fields: { title: stringField("Plan") } },
        {
          kind: "update",
          path: "private/u1/proposals/p1",
          fields: { status: stringField("accepted") },
          changedFields: ["status"],
        },
      ])
    ).toEqual({
      ok: true,
      url: "https://firestore.googleapis.com/v1/projects/tempo%20project/databases/(default)/documents:commit",
      body: {
        writes: [
          {
            update: {
              name: "projects/tempo project/databases/(default)/documents/users/u1/tasks/t1",
              fields: { title: { stringValue: "Plan" } },
            },
            currentDocument: { exists: false },
          },
          {
            update: {
              name: "projects/tempo project/databases/(default)/documents/private/u1/proposals/p1",
              fields: { status: { stringValue: "accepted" } },
            },
            updateMask: { fieldPaths: ["status"] },
            currentDocument: { exists: true },
          },
        ],
      },
    });
  });

  test("uses an update-time precondition when supplied", () => {
    const result = buildCommitRequest("tempo", [
      {
        kind: "update",
        path: "users/u1/tasks/t1",
        fields: { title: stringField("Changed") },
        changedFields: ["title"],
        ifUpdateTime: "2026-11-19T12:00:00.000000Z",
      },
    ]);

    expect(result.ok && result.body.writes[0]?.currentDocument).toEqual({
      updateTime: "2026-11-19T12:00:00.000000Z",
    });
  });

  test.each([
    ["empty project id", " ", [{ kind: "create", path: "users/u1", fields: {} }]],
    ["zero writes", "tempo", []],
    [
      "more than 20 writes",
      "tempo",
      Array.from({ length: 21 }, (_, index) => ({
        kind: "create" as const,
        path: `users/u1/tasks/t${index}`,
        fields: {},
      })),
    ],
    ["odd path segments", "tempo", [{ kind: "create", path: "users/u1/tasks", fields: {} }]],
    ["empty path segment", "tempo", [{ kind: "create", path: "users/u1//t1", fields: {} }]],
    ["disallowed root", "tempo", [{ kind: "create", path: "teams/u1", fields: {} }]],
    [
      "more than one uid",
      "tempo",
      [
        { kind: "create", path: "users/u1", fields: {} },
        { kind: "create", path: "private/u2", fields: {} },
      ],
    ],
    [
      "duplicate path",
      "tempo",
      [
        { kind: "create", path: "users/u1", fields: {} },
        { kind: "create", path: "users/u1", fields: {} },
      ],
    ],
    [
      "empty changedFields",
      "tempo",
      [{ kind: "update", path: "users/u1", fields: {}, changedFields: [] }],
    ],
    [
      "changed field absent from fields",
      "tempo",
      [{ kind: "update", path: "users/u1", fields: {}, changedFields: ["title"] }],
    ],
  ])("refuses %s", (_name, projectId, writes) => {
    expect(buildCommitRequest(projectId as string, writes as CommitWrite[]).ok).toBe(false);
  });
});
