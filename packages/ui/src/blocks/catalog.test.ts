import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateSpec } from "@json-render/core";
import { BLOCK_CODEC_LIMITS, parseTempoBlocks, tempoBlockSchema } from "@tempo/utils";
import {
  BLOCK_ELEMENT_KEY,
  BROKEN_BLOCK_MESSAGES,
  type BrokenBlockReason,
  blockSegmentToSpec,
  brokenBlockSpec,
  safeBlockSpec,
  type TempoBlockSpec,
  tempoBlockToSpec,
  validateBlockSpec,
} from "./block-spec";
import {
  BLOCK_ACTION_NAMES,
  BLOCK_COMPONENT_TYPES,
  BLOCK_EVENT_NAMES,
  brokenBlockCardPropsSchema,
  JSON_RENDER_VERSION,
  pageMetaPropsSchema,
  setTaskDoneParamsSchema,
  taskBlockPropsSchema,
  templateBlockPropsSchema,
  tempoBlockCatalog,
} from "./catalog";

/**
 * TEMPO-B06-02. All fixtures are synthetic. The tests pin: the json-render version, the fixed
 * allowlist (four components, one action, one event), agreement with the shared codec, the
 * envelope -> spec mapping, and the safe fallback for anything else.
 */

const UI_DIR = join(import.meta.dir, "..", "..");
const REPO_DIR = join(UI_DIR, "..", "..");
const SENTINEL = "SENTINEL_PAYLOAD_9137";

const ids = {
  meta: "blk_01K5F3Z8Q0A7M2N4P6R8T0V2X4",
  task: "blk_01K5F3Z8Q2C9P4Q6R8T0V2X4Z6",
  template: "blk_01K5F3Z8Q4E1N3P5R7T9V1X3Z5",
};

const task = {
  type: "task",
  id: ids.task,
  v: 1,
  data: { title: "Email supervisor", status: "now", order: 1, inelastic: false },
};
const meta = {
  type: "page-meta",
  id: ids.meta,
  v: 1,
  data: { pageType: "daily", date: "2026-10-11", tags: ["uni", "שלום"] },
};
const template = {
  type: "template",
  id: ids.template,
  v: 1,
  data: {
    name: "Gentle day",
    forPageType: "daily",
    isDefault: true,
    tokens: ["date"],
    origin: "builtin",
    status: "live",
    enabled: true,
  },
};

function fence(value: unknown) {
  return `\`\`\`json tempo\n${JSON.stringify(value)}\n\`\`\`\n`;
}

function firstBlockSegment(body: string) {
  const segment = parseTempoBlocks(body).find((candidate) => candidate.kind !== "markdown");
  if (!segment) throw new Error("fixture has no block segment");
  return segment;
}

function onlyElement(spec: TempoBlockSpec) {
  const element = spec.elements[BLOCK_ELEMENT_KEY];
  if (!element) throw new Error("spec has no block element");
  return element;
}

function taskSpec() {
  return blockSegmentToSpec(firstBlockSegment(fence(task)));
}

const REMOVE = Symbol("remove");

/** A deep copy of `spec` with the value at a dotted path replaced, or deleted when `REMOVE`. */
function edit(spec: TempoBlockSpec, path: string, value: unknown): unknown {
  const copy = structuredClone(spec) as Record<string, any>;
  const keys = path.split(".");
  const last = keys.pop() as string;
  let target = copy;
  for (const key of keys) target = target[key];
  if (value === REMOVE) delete target[last];
  else target[last] = value;
  return copy;
}

/** The valid task spec with one edit. */
const edited = (path: string, value: unknown) => edit(taskSpec(), path, value);
const TOGGLE = "elements.block.on.toggle";

describe("version pin and package evidence", () => {
  const manifest = JSON.parse(readFileSync(join(UI_DIR, "package.json"), "utf8")) as {
    dependencies: Record<string, string>;
  };

  function installedPackage(name: string) {
    const candidates = [
      join(UI_DIR, "node_modules", name, "package.json"),
      join(REPO_DIR, "node_modules", name, "package.json"),
    ];
    const found = candidates.find((candidate) => existsSync(candidate));
    if (!found) throw new Error(`${name} is not installed`);
    return JSON.parse(readFileSync(found, "utf8")) as {
      version: string;
      license: string;
      exports: Record<string, unknown>;
    };
  }

  test("@tempo/ui pins both json-render packages to the exact version, without a range", () => {
    expect(manifest.dependencies["@json-render/core"]).toBe(JSON_RENDER_VERSION);
    expect(manifest.dependencies["@json-render/react"]).toBe(JSON_RENDER_VERSION);
    expect(manifest.dependencies.zod).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("the installed packages are that version, Apache-2.0, with the entry points used", () => {
    const core = installedPackage("@json-render/core");
    const react = installedPackage("@json-render/react");
    expect([core.version, react.version]).toEqual([JSON_RENDER_VERSION, JSON_RENDER_VERSION]);
    expect([core.license, react.license]).toEqual(["Apache-2.0", "Apache-2.0"]);
    expect(Object.keys(react.exports)).toContain("./schema");
  });

  test("THIRD-PARTY-NOTICES.md lists both packages at the pinned version", () => {
    const notices = readFileSync(join(REPO_DIR, "THIRD-PARTY-NOTICES.md"), "utf8");
    for (const name of ["core", "react"]) {
      const section = new RegExp(
        `### @json-render/${name}\\n\\n- Version: (\\S+)\\n- License: (\\S+)`
      );
      expect(section.exec(notices)?.slice(1)).toEqual([JSON_RENDER_VERSION, "Apache-2.0"]);
    }
  });
});

describe("the catalog is a fixed allowlist", () => {
  test("exactly four component types, in order", () => {
    expect(tempoBlockCatalog.componentNames).toEqual([
      "TaskBlock",
      "PageMeta",
      "TemplateBlock",
      "BrokenBlockCard",
    ]);
    expect(tempoBlockCatalog.componentNames).toEqual([...BLOCK_COMPONENT_TYPES]);
  });

  test("exactly one action and one event", () => {
    expect(tempoBlockCatalog.actionNames).toEqual(["setTaskDone"]);
    expect([...BLOCK_ACTION_NAMES]).toEqual(["setTaskDone"]);
    expect([...BLOCK_EVENT_NAMES]).toEqual(["toggle"]);
  });

  test("no component takes children or slots", () => {
    for (const name of BLOCK_COMPONENT_TYPES) {
      expect(tempoBlockCatalog.data.components[name].slots).toEqual([]);
    }
  });

  test("every component example satisfies its own props schema", () => {
    const schemas = {
      TaskBlock: taskBlockPropsSchema,
      PageMeta: pageMetaPropsSchema,
      TemplateBlock: templateBlockPropsSchema,
      BrokenBlockCard: brokenBlockCardPropsSchema,
    } as const;
    for (const name of BLOCK_COMPONENT_TYPES) {
      const { props, example } = tempoBlockCatalog.data.components[name];
      expect(props).toBe(schemas[name]);
      expect(props.safeParse(example).success).toBe(true);
    }
  });

  test("the generated prompt lists the four components and the one catalog action", () => {
    const prompt = tempoBlockCatalog.prompt();
    expect(prompt).toContain("AVAILABLE COMPONENTS (4):");
    for (const name of BLOCK_COMPONENT_TYPES) expect(prompt).toContain(`- ${name}: {`);
    expect(prompt).toContain("- setTaskDone:");
    expect(tempoBlockCatalog.jsonSchema()).toBeObject();
  });
});

describe("props schemas", () => {
  const goodTask = { title: "Email supervisor", status: "now", durationMin: 15, inelastic: false };
  const goodBroken = { message: BROKEN_BLOCK_MESSAGES.invalid_spec, undoAvailable: false };
  const goodMeta = { pageType: "daily", tags: [] };
  const goodAction = { blockId: ids.task, done: true };
  const maxText = BLOCK_CODEC_LIMITS.maxTextChars;

  test("accept valid props", () => {
    expect(taskBlockPropsSchema.safeParse(goodTask).success).toBe(true);
    expect(pageMetaPropsSchema.safeParse(goodMeta).success).toBe(true);
    expect(templateBlockPropsSchema.safeParse(blockData(template)).success).toBe(true);
    expect(brokenBlockCardPropsSchema.safeParse(goodBroken).success).toBe(true);
    expect(setTaskDoneParamsSchema.safeParse(goodAction).success).toBe(true);
  });

  function blockData(envelope: { data: Record<string, unknown> }) {
    const { tokens: _tokens, ...rendered } = envelope.data;
    return rendered;
  }

  type Schema = { safeParse: (value: unknown) => { success: boolean } };
  const rejected: [string, Schema, unknown][] = [
    ["task: unknown prop", taskBlockPropsSchema, { ...goodTask, href: "https://example.com" }],
    ["task: block id as a prop", taskBlockPropsSchema, { ...goodTask, id: ids.task }],
    ["task: empty title", taskBlockPropsSchema, { ...goodTask, title: "" }],
    ["task: long title", taskBlockPropsSchema, { ...goodTask, title: "x".repeat(maxText + 1) }],
    ["task: expression title", taskBlockPropsSchema, { ...goodTask, title: { $state: "/t" } }],
    ["task: bound title", taskBlockPropsSchema, { ...goodTask, title: { $bindState: "/t" } }],
    ["task: unknown status", taskBlockPropsSchema, { ...goodTask, status: "archived" }],
    ["task: zero minutes", taskBlockPropsSchema, { ...goodTask, durationMin: 0 }],
    ["task: too many minutes", taskBlockPropsSchema, { ...goodTask, durationMin: 1441 }],
    ["task: fractional minutes", taskBlockPropsSchema, { ...goodTask, durationMin: 1.5 }],
    ["task: bad date", taskBlockPropsSchema, { ...goodTask, scheduledAt: "tomorrow" }],
    ["page-meta: unknown type", pageMetaPropsSchema, { ...goodMeta, pageType: "journal" }],
    ["page-meta: impossible date", pageMetaPropsSchema, { ...goodMeta, date: "2026-02-30" }],
    [
      "page-meta: too many tags",
      pageMetaPropsSchema,
      { ...goodMeta, tags: Array(BLOCK_CODEC_LIMITS.maxArrayItems + 1).fill("a") },
    ],
    ["template: tokens are not a prop", templateBlockPropsSchema, template.data],
    ["broken: braces", brokenBlockCardPropsSchema, { ...goodBroken, message: '{"type":"task"}' }],
    ["broken: block id", brokenBlockCardPropsSchema, { ...goodBroken, message: `See ${ids.task}` }],
    ["broken: fence info", brokenBlockCardPropsSchema, { ...goodBroken, message: "json tempo" }],
    ["broken: line break", brokenBlockCardPropsSchema, { ...goodBroken, message: "a\nb" }],
    ["broken: empty message", brokenBlockCardPropsSchema, { ...goodBroken, message: "" }],
    [
      "broken: long message",
      brokenBlockCardPropsSchema,
      { ...goodBroken, message: "a".repeat(201) },
    ],
    ["broken: truthy undo", brokenBlockCardPropsSchema, { ...goodBroken, undoAvailable: "yes" }],
    ["broken: payload prop", brokenBlockCardPropsSchema, { ...goodBroken, source: SENTINEL }],
    ["action: no done state", setTaskDoneParamsSchema, { blockId: ids.task }],
    [
      "action: lowercase id",
      setTaskDoneParamsSchema,
      { ...goodAction, blockId: ids.task.toLowerCase() },
    ],
    ["action: path-like id", setTaskDoneParamsSchema, { ...goodAction, blockId: "../notes" }],
    ["action: state reference", setTaskDoneParamsSchema, { ...goodAction, done: { $state: "/d" } }],
    ["action: extra param", setTaskDoneParamsSchema, { ...goodAction, statePath: "/x" }],
  ];
  for (const [name, schema, value] of rejected) {
    test(`reject ${name}`, () => {
      expect(schema.safeParse(value).success).toBe(false);
    });
  }
});

describe("agreement with the shared codec", () => {
  const long = (length: number) => "x".repeat(length);
  const maxText = BLOCK_CODEC_LIMITS.maxTextChars;
  const maxShort = BLOCK_CODEC_LIMITS.maxShortStringChars;

  const fixtures: [string, unknown][] = [
    ["task: minimal", task],
    [
      "task: every field at its limit",
      {
        ...task,
        data: {
          title: long(maxText),
          reason: long(maxText),
          durationMin: 1440,
          status: "done",
          order: 9,
          inelastic: true,
          scheduledAt: "2026-10-11T09:00:00+03:00",
          doneAt: "2026-10-11T09:30:00Z",
        },
      },
    ],
    ["task: later", { ...task, data: { ...task.data, status: "later", scheduledAt: null } }],
    ["task: Hebrew title", { ...task, data: { ...task.data, title: "לשלוח מייל למנחה" } }],
    ["page-meta", meta],
    [
      "page-meta: every tag at its limit",
      {
        ...meta,
        data: {
          pageType: "template",
          tags: Array(BLOCK_CODEC_LIMITS.maxArrayItems).fill(long(maxShort)),
        },
      },
    ],
    ["template", template],
    [
      "template: name at its limit, user draft",
      {
        ...template,
        data: {
          ...template.data,
          name: long(maxText),
          origin: "user",
          status: "draft",
          enabled: false,
        },
      },
    ],
  ];

  for (const [name, envelope] of fixtures) {
    test(`${name} draws as its own component, never as a fallback`, () => {
      const segment = firstBlockSegment(fence(envelope));
      expect(segment.kind).toBe("valid");
      const spec = blockSegmentToSpec(segment);
      expect(onlyElement(spec).type).not.toBe("BrokenBlockCard");
      expect(validateBlockSpec(spec).ok).toBe(true);
      expect(tempoBlockCatalog.validate(spec).success).toBe(true);
      expect(validateSpec(spec).valid).toBe(true);
    });
  }

  test("every block type the codec knows has a component", () => {
    const codecTypes = tempoBlockSchema.options.map((option) => option.shape.type.value);
    expect(codecTypes).toEqual(["page-meta", "task", "template"]);
    const drawn = [meta, task, template].map(
      (envelope) => onlyElement(tempoBlockToSpec(envelope)).type
    );
    expect(drawn).toEqual(["PageMeta", "TaskBlock", "TemplateBlock"]);
  });
});

describe("envelope to spec mapping", () => {
  test("a task becomes a TaskBlock with rendering props only", () => {
    const spec = taskSpec();
    expect(spec.root).toBe(BLOCK_ELEMENT_KEY);
    expect(Object.keys(spec.elements)).toEqual([BLOCK_ELEMENT_KEY]);
    const element = onlyElement(spec);
    expect(element.type).toBe("TaskBlock");
    expect(element.children).toEqual([]);
    expect(element.props).toEqual({
      title: "Email supervisor",
      status: "now",
      durationMin: 15,
      inelastic: false,
    });
  });

  test("optional task fields are carried only when present", () => {
    const element = onlyElement(
      tempoBlockToSpec({
        ...task,
        data: { ...task.data, reason: "You wrote it twice.", scheduledAt: "2026-10-11T09:00:00Z" },
      })
    );
    expect(element.props).toMatchObject({
      reason: "You wrote it twice.",
      scheduledAt: "2026-10-11T09:00:00Z",
    });
  });

  test("a page-meta block becomes PageMeta and a template becomes TemplateBlock", () => {
    const metaElement = onlyElement(tempoBlockToSpec(meta));
    expect(metaElement).toMatchObject({
      type: "PageMeta",
      props: { pageType: "daily", date: "2026-10-11", tags: ["uni", "שלום"] },
    });
    const templateElement = onlyElement(tempoBlockToSpec(template));
    expect(templateElement).toMatchObject({
      type: "TemplateBlock",
      props: {
        name: "Gentle day",
        forPageType: "daily",
        isDefault: true,
        origin: "builtin",
        status: "live",
        enabled: true,
      },
    });
    expect(templateElement.props).not.toHaveProperty("tokens");
    expect(templateElement.on).toBeUndefined();
    expect(metaElement.on).toBeUndefined();
  });

  test("ids and internal fields never become props or the element key", () => {
    for (const envelope of [task, meta, template]) {
      const spec = tempoBlockToSpec(envelope);
      const props = JSON.stringify(onlyElement(spec).props);
      expect(props).not.toContain("blk_");
      expect(props).not.toContain('"v"');
      expect(props).not.toContain('"order"');
      expect(Object.keys(spec.elements)).toEqual(["block"]);
    }
  });

  test("the checkbox asks for the NEW done state and carries only the block id", () => {
    expect(onlyElement(tempoBlockToSpec(task)).on).toEqual({
      toggle: { action: "setTaskDone", params: { blockId: ids.task, done: true } },
    });
    for (const status of ["now", "later"]) {
      const open = onlyElement(tempoBlockToSpec({ ...task, data: { ...task.data, status } }));
      expect(open.on?.toggle).toMatchObject({ params: { done: true } });
    }
    const done = onlyElement(tempoBlockToSpec({ ...task, data: { ...task.data, status: "done" } }));
    expect(done.on?.toggle).toMatchObject({ params: { blockId: ids.task, done: false } });
  });

  test("a display-only surface gets a card with no bound event", () => {
    const spec = tempoBlockToSpec(task, { interactive: false });
    expect(onlyElement(spec).type).toBe("TaskBlock");
    expect(onlyElement(spec).on).toBeUndefined();
    expect(validateBlockSpec(spec).ok).toBe(true);
  });

  test("the mapping does not mutate its input", () => {
    const input = structuredClone(task);
    tempoBlockToSpec(input);
    expect(input).toEqual(task);
  });
});

describe("broken and unreadable blocks", () => {
  const reasons = Object.keys(BROKEN_BLOCK_MESSAGES) as BrokenBlockReason[];

  test("every reason has calm copy that the card accepts", () => {
    expect(reasons.length).toBe(13);
    for (const reason of reasons) {
      const spec = brokenBlockSpec(reason);
      expect(validateBlockSpec(spec).ok).toBe(true);
      const { message } = onlyElement(spec).props as { message: string };
      expect(message).toBe(BROKEN_BLOCK_MESSAGES[reason]);
      // docs/UI-BRIEF.md section 7: warm and never shaming.
      expect(message).not.toMatch(/\b(failed|error|invalid|must|required|crush|hustle|grind)\b/i);
    }
  });

  test("an unknown reason falls back to the generic copy", () => {
    for (const reason of ["not_a_reason", "__proto__", "toString", "constructor"]) {
      const spec = brokenBlockSpec(reason as BrokenBlockReason);
      expect(onlyElement(spec).props).toMatchObject({
        message: BROKEN_BLOCK_MESSAGES.invalid_spec,
      });
    }
  });

  test("Undo is offered only when the host says it holds a real handle", () => {
    const undo = (options?: { undoAvailable?: boolean }) =>
      onlyElement(brokenBlockSpec("malformed_json", options)).props;
    expect(undo()).toMatchObject({ undoAvailable: false });
    expect(undo({ undoAvailable: true })).toMatchObject({ undoAvailable: true });
    for (const truthy of [1, "yes", {}, []]) {
      expect(undo({ undoAvailable: truthy as unknown as boolean })).toMatchObject({
        undoAvailable: false,
      });
    }
  });

  const deep = (depth: number) => {
    let nested: unknown = "leaf";
    for (let index = 0; index <= depth; index += 1) nested = [nested];
    return nested;
  };
  const manyBlocks = Array.from({ length: BLOCK_CODEC_LIMITS.maxBlocks + 1 }, (_, index) =>
    fence({ ...task, id: `blk_01K5F3Z8Q2C9P4Q6R8T0V2X4${String(index).padStart(2, "0")}` })
  ).join(`${SENTINEL}\n`);
  const brokenBodies: [string, string][] = [
    ["malformed_json", `\`\`\`json tempo\n{ nope ${SENTINEL} }\n\`\`\`\n`],
    ["unclosed_fence", `\`\`\`json tempo\n{"type":"task","title":"${SENTINEL}"`],
    ["invalid_data", fence({ ...task, data: { ...task.data, title: SENTINEL, status: "x" } })],
    ["invalid_envelope", fence([SENTINEL])],
    ["unsupported_type", fence({ ...task, type: "event", data: { title: SENTINEL } })],
    ["unsupported_version", fence({ ...task, v: 2, data: { title: SENTINEL } })],
    ["duplicate_id", fence(task) + fence({ ...task, data: { ...task.data, title: SENTINEL } })],
    [
      "duplicate_page_meta",
      fence(meta) + fence({ ...meta, id: ids.template, data: { ...meta.data, tags: [SENTINEL] } }),
    ],
    ["nesting_too_deep", fence({ ...task, data: { ...task.data, title: SENTINEL, x: deep(40) } })],
    [
      "block_too_large",
      fence({ ...task, data: { ...task.data, title: SENTINEL, x: "y".repeat(70_000) } }),
    ],
    ["too_many_blocks", manyBlocks],
    ["body_too_large", `${SENTINEL}${"x".repeat(BLOCK_CODEC_LIMITS.maxBodyChars)}`],
  ];

  for (const [code, body] of brokenBodies) {
    test(`${code}: drawn from the error code alone, never from the source`, () => {
      const broken = parseTempoBlocks(body).filter((segment) => segment.kind === "broken");
      const segment = code === "too_many_blocks" ? broken.at(-1) : broken[0];
      if (!segment || segment.kind !== "broken") throw new Error(`fixture produced no ${code}`);
      expect(segment.errorCode).toBe(code as typeof segment.errorCode);

      const spec = blockSegmentToSpec(segment);
      const element = onlyElement(spec);
      expect(element.type).toBe("BrokenBlockCard");
      expect(element.props).toEqual({
        message: BROKEN_BLOCK_MESSAGES[segment.errorCode],
        undoAvailable: false,
      });
      expect(element.on).toBeUndefined();
      const serialized = JSON.stringify(spec);
      for (const leak of [SENTINEL, "blk_", "json tempo", "nope"]) {
        expect(serialized).not.toContain(leak);
      }
      expect(validateBlockSpec(spec).ok).toBe(true);
    });
  }

  test("a markdown segment is never drawn as a block", () => {
    const markdown = parseTempoBlocks("just prose")[0];
    const spec = blockSegmentToSpec(markdown as never);
    expect(onlyElement(spec).props).toMatchObject({ message: BROKEN_BLOCK_MESSAGES.invalid_spec });
  });

  const unreadable: [string, unknown, BrokenBlockReason][] = [
    ["unknown type", { ...task, type: "event" }, "unsupported_type"],
    ["unknown type with known data", { ...meta, type: "Task" }, "unsupported_type"],
    ["version 2", { ...task, v: 2 }, "unsupported_version"],
    ["version as a string", { ...task, v: "1" }, "unsupported_version"],
    ["no version", { type: "task", id: ids.task, data: task.data }, "unsupported_version"],
    ["extra data field", { ...task, data: { ...task.data, done: false } }, "invalid_data"],
    ["extra envelope field", { ...task, owner: "u1" }, "invalid_data"],
    ["bad id", { ...task, id: "blk_nope" }, "invalid_data"],
    ["null", null, "invalid_envelope"],
    ["string", "task", "invalid_envelope"],
    ["number", 42, "invalid_envelope"],
    ["array", [task], "invalid_envelope"],
    ["undefined", undefined, "invalid_envelope"],
  ];
  for (const [name, envelope, reason] of unreadable) {
    test(`${name} falls back to the ${reason} card, matching the codec`, () => {
      const element = onlyElement(tempoBlockToSpec(envelope));
      expect(element.type).toBe("BrokenBlockCard");
      expect(element.props).toMatchObject({ message: BROKEN_BLOCK_MESSAGES[reason] });
      if (typeof envelope === "object" && envelope !== null) {
        const segment = parseTempoBlocks(fence(envelope))[0];
        if (segment?.kind === "broken") expect(segment.errorCode as string).toBe(reason);
      }
    });
  }

  test("an envelope built with a prototype key is rejected, not merged", () => {
    const hostile = JSON.parse(
      `{"type":"task","id":"${ids.task}","v":1,"__proto__":{"polluted":true},"data":${JSON.stringify(task.data)}}`
    );
    expect(onlyElement(tempoBlockToSpec(hostile)).type).toBe("BrokenBlockCard");
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  describe("an input that throws when read never throws out of the adapter", () => {
    const boom = () => {
      throw new Error(SENTINEL);
    };
    const throwingProxy = () => new Proxy({}, { get: boom, has: boom, ownKeys: boom });
    const revokedProxy = () => {
      const { proxy, revoke } = Proxy.revocable({}, {});
      revoke();
      return proxy;
    };
    const getterOn = (key: string) => {
      const hostile: Record<string, unknown> = { ...task };
      Object.defineProperty(hostile, key, { enumerable: true, get: boom });
      return hostile;
    };
    const nestedGetter = () => {
      const data = { ...task.data };
      Object.defineProperty(data, "title", { enumerable: true, get: boom });
      return { ...task, data };
    };
    const hostileBlocks: [string, unknown][] = [
      ["a throwing getter on type", getterOn("type")],
      ["a throwing getter on v", getterOn("v")],
      ["a throwing getter on id", getterOn("id")],
      ["a throwing getter on data", getterOn("data")],
      ["a throwing getter inside data", nestedGetter()],
      ["a throwing Proxy", throwingProxy()],
      ["a revoked Proxy", revokedProxy()],
      ["a Proxy over a valid task whose reads throw", new Proxy(task, { get: boom, has: boom })],
      ["a throwing Proxy as data", { ...task, data: throwingProxy() }],
    ];

    for (const [name, hostile] of hostileBlocks) {
      test(`${name} becomes the generic card with no leak`, () => {
        let spec: TempoBlockSpec | undefined;
        expect(() => {
          spec = tempoBlockToSpec(hostile);
        }).not.toThrow();
        expect(spec).toEqual(brokenBlockSpec("invalid_spec"));
        expect(validateBlockSpec(spec).ok).toBe(true);
        expect(JSON.stringify(spec)).not.toContain(SENTINEL);
      });
    }

    test("the fallback card still honours the Undo option", () => {
      expect(
        onlyElement(tempoBlockToSpec(throwingProxy(), { undoAvailable: true })).props
      ).toMatchObject({ undoAvailable: true });
      expect(onlyElement(tempoBlockToSpec(throwingProxy())).props).toMatchObject({
        undoAvailable: false,
      });
    });

    test("a throwing options object never throws and yields the card without Undo", () => {
      const options = throwingProxy() as { interactive?: boolean; undoAvailable?: boolean };
      for (const input of [task, throwingProxy()]) {
        let spec: TempoBlockSpec | undefined;
        expect(() => {
          spec = tempoBlockToSpec(input, options);
        }).not.toThrow();
        expect(onlyElement(spec as TempoBlockSpec)).toMatchObject({
          type: "BrokenBlockCard",
          props: { undoAvailable: false },
        });
      }
      expect(() => brokenBlockSpec("malformed_json", options)).not.toThrow();
      expect(() => safeBlockSpec(null, options)).not.toThrow();
      expect(() => blockSegmentToSpec(firstBlockSegment(fence(task)), options)).not.toThrow();
    });

    test("a null options value is treated as no options", () => {
      const spec = tempoBlockToSpec(task, null as unknown as undefined);
      expect(onlyElement(spec).type).toBe("TaskBlock");
      expect(
        onlyElement(brokenBlockSpec("malformed_json", null as unknown as undefined)).props
      ).toMatchObject({ undoAvailable: false });
    });

    test("a hostile segment becomes the generic card, and the error text never leaks", () => {
      const hostileSegments: [string, unknown][] = [
        ["a throwing Proxy", throwingProxy()],
        ["a revoked Proxy", revokedProxy()],
        ["a throwing kind getter", Object.defineProperty({}, "kind", { get: boom })],
        [
          "a valid segment whose block getter throws",
          Object.defineProperty({ kind: "valid" }, "block", { get: boom }),
        ],
        [
          "a broken segment whose errorCode getter throws",
          Object.defineProperty({ kind: "broken" }, "errorCode", { get: boom }),
        ],
        [
          "a broken segment whose errorCode is a throwing Proxy",
          { kind: "broken", errorCode: throwingProxy() },
        ],
      ];
      for (const [, segment] of hostileSegments) {
        let spec: TempoBlockSpec | undefined;
        expect(() => {
          spec = blockSegmentToSpec(segment as Parameters<typeof blockSegmentToSpec>[0]);
        }).not.toThrow();
        expect(spec).toEqual(brokenBlockSpec("invalid_spec"));
        expect(JSON.stringify(spec)).not.toContain(SENTINEL);
      }
    });

    test("a hostile reason falls back to the generic copy", () => {
      for (const reason of [throwingProxy(), revokedProxy(), Symbol("x"), 7, null, undefined]) {
        expect(() => brokenBlockSpec(reason as unknown as BrokenBlockReason)).not.toThrow();
        expect(
          onlyElement(brokenBlockSpec(reason as unknown as BrokenBlockReason)).props
        ).toMatchObject({ message: BROKEN_BLOCK_MESSAGES.invalid_spec });
      }
    });
  });
});

describe("a spec from anywhere else must pass the allowlist or it becomes a safe card", () => {
  const fallback = brokenBlockSpec("invalid_spec");
  const toggleOn = taskSpec().elements[BLOCK_ELEMENT_KEY]?.on;
  const withEvent = (path: string, value: unknown) => edited(`${TOGGLE}.${path}`, value);
  const builtInActions = [
    ...tempoBlockCatalog.prompt().matchAll(/^- (\w+): .*\[built-in\]$/gm),
  ].map((match) => match[1] as string);

  const actionNames = [
    ...builtInActions,
    "navigate",
    "toggleTask",
    "SetTaskDone",
    "setTaskDone ",
    "setTaskDone2",
    "__proto__",
    "constructor",
    "",
  ];
  const elementTypes = [
    "Button",
    "Link",
    "Html",
    "Code",
    "Card",
    "TaskBlock ",
    "taskblock",
    "__proto__",
    "constructor",
    "",
  ];
  const rejected: [string, unknown][] = [
    ...elementTypes.map((type): [string, unknown] => [
      `element type ${JSON.stringify(type)}`,
      edited("elements.block.type", type),
    ]),
    ...actionNames.map((action): [string, unknown] => [
      `action name ${JSON.stringify(action)}`,
      edited(`${TOGGLE}.action`, action),
    ]),
    ["PageMeta type with TaskBlock props", edited("elements.block.type", "PageMeta")],
    ["unknown prop", edited("elements.block.props.href", "https://example.com")],
    ["expression as title", edited("elements.block.props.title", { $state: "/t" })],
    ["bound expression as title", edited("elements.block.props.title", { $bindState: "/t" })],
    ["computed title", edited("elements.block.props.title", { $computed: "f", args: {} })],
    ["template title", edited("elements.block.props.title", { $template: "$" + "{/x}" })],
    ["empty title", edited("elements.block.props.title", "")],
    ["oversized title", edited("elements.block.props.title", "x".repeat(501))],
    ["children present", edited("elements.block.children", ["other"])],
    ["children missing", edited("elements.block.children", REMOVE)],
    ["slots", edited("elements.block.slots", { default: [] })],
    ["visible", edited("elements.block.visible", { $state: "/show" })],
    ["repeat", edited("elements.block.repeat", { statePath: "/items" })],
    ["watch", edited("elements.block.watch", { "/x": { action: "setTaskDone" } })],
    ["top-level state", edited("state", { x: 1 })],
    ["unknown top-level key", edited("extra", true)],
    ["wrong root", edited("root", "other")],
    ["missing root", edited("root", REMOVE)],
    ["second element", edited("elements.second", taskSpec().elements[BLOCK_ELEMENT_KEY])],
    ["no elements", edited("elements", {})],
    ["unknown event", edited("elements.block.on", { press: toggleOn?.toggle })],
    ["extra event", edited("elements.block.on.press", toggleOn?.toggle)],
    ["binding as an array", edited(TOGGLE, [toggleOn?.toggle])],
    ["binding with confirm", withEvent("confirm", { title: "a", message: "b" })],
    ["binding with onSuccess navigate", withEvent("onSuccess", { navigate: "/x" })],
    ["binding with onError", withEvent("onError", { set: { "/x": 1 } })],
    ["binding with preventDefault", withEvent("preventDefault", true)],
    ["binding without an action", withEvent("action", REMOVE)],
    ["binding without params", withEvent("params", REMOVE)],
    ["done is a state reference", withEvent("params.done", { $state: "/d" })],
    ["block id is a state reference", withEvent("params.blockId", { $state: "/b" })],
    ["done is a string", withEvent("params.done", "true")],
    ["extra param", withEvent("params.statePath", "/x")],
    ["malformed block id", withEvent("params.blockId", "blk_short")],
    ["lowercase block id", withEvent("params.blockId", ids.task.toLowerCase())],
    ["PageMeta with an action", edit(tempoBlockToSpec(meta), "elements.block.on", toggleOn)],
    [
      "BrokenBlockCard with an action",
      edit(brokenBlockSpec("malformed_json"), "elements.block.on", toggleOn),
    ],
    ["null", null],
    ["undefined", undefined],
    ["string", "TaskBlock"],
    ["number", 42],
    ["true", true],
    ["array", [taskSpec()]],
    ["empty object", {}],
    [
      "prototype key in the spec",
      JSON.parse(
        `{"root":"block","__proto__":{"x":1},"elements":{"block":${JSON.stringify(onlyElement(taskSpec()))}}}`
      ),
    ],
    [
      "getter that throws",
      Object.defineProperty({}, "root", {
        enumerable: true,
        get: () => {
          throw new Error(SENTINEL);
        },
      }),
    ],
  ];

  test("the builders' own output passes", () => {
    for (const envelope of [task, meta, template]) {
      expect(validateBlockSpec(tempoBlockToSpec(envelope)).ok).toBe(true);
    }
    expect(validateBlockSpec(taskSpec())).toEqual({ ok: true, spec: taskSpec() });
  });

  test("the built-in json-render actions are known, none is a catalog action, all rejected below", () => {
    expect(builtInActions).toContain("setState");
    expect(builtInActions).toContain("pushState");
    for (const action of builtInActions)
      expect(tempoBlockCatalog.actionNames).not.toContain(action);
  });

  for (const [name, input] of rejected) {
    test(`reject ${name}`, () => {
      expect(validateBlockSpec(input)).toEqual({ ok: false });
      expect(safeBlockSpec(input)).toEqual(fallback);
    });
  }

  test("a rejected spec is never echoed back", () => {
    const hostile = edit(
      edit(taskSpec(), "elements.block.props.title", { $state: SENTINEL }) as TempoBlockSpec,
      `${TOGGLE}.action`,
      SENTINEL
    );
    expect(JSON.stringify(safeBlockSpec(hostile))).not.toContain(SENTINEL);
    expect(JSON.stringify(validateBlockSpec(hostile))).not.toContain(SENTINEL);
  });

  test("the fallback honours the Undo option", () => {
    expect(onlyElement(safeBlockSpec(null, { undoAvailable: true })).props).toMatchObject({
      undoAvailable: true,
    });
  });
});

describe("json-render 0.21.0 behaviour that makes validateBlockSpec necessary", () => {
  // Tripwire, not a goal: if a json-render upgrade changes these, re-read its d.ts and decide
  // whether validateBlockSpec can shrink. Until then, never rely on catalog.validate() alone.
  test("catalog.validate() does not check props against the component's own schema", () => {
    const wrongProps = edited("elements.block.props", { title: 5 });
    expect(tempoBlockCatalog.validate(wrongProps).success).toBe(true);
    expect(validateBlockSpec(wrongProps).ok).toBe(false);
  });

  test("catalog.validate() drops bindings, so it cannot vet actions", () => {
    const sneaky = edited(`${TOGGLE}.action`, "setState");
    const result = tempoBlockCatalog.validate(sneaky);
    expect(result.success).toBe(true);
    expect(JSON.stringify(result.data)).not.toContain("setState");
    expect(validateBlockSpec(sneaky).ok).toBe(false);
  });

  test("it does reject an element type outside the catalog", () => {
    expect(tempoBlockCatalog.validate(edited("elements.block.type", "Button")).success).toBe(false);
  });
});

describe("module boundary", () => {
  const sources = ["catalog.ts", "block-spec.ts"].map((file) => ({
    file,
    text: readFileSync(join(import.meta.dir, file), "utf8"),
  }));
  const allowedImports = new Set([
    "@json-render/core",
    "@json-render/react/schema",
    "@tempo/utils",
    "zod",
    "./catalog",
  ]);

  test("imports only the pinned json-render entry points, the shared codec, zod and the catalog", () => {
    for (const { file, text } of sources) {
      const specifiers = [...text.matchAll(/^(?:import|export)[^;]*?from "([^"]+)"/gms)].map(
        (match) => match[1] as string
      );
      expect(specifiers.length).toBeGreaterThan(0);
      for (const specifier of specifiers) {
        expect({ file, specifier, allowed: allowedImports.has(specifier) }).toEqual({
          file,
          specifier,
          allowed: true,
        });
      }
    }
  });

  test("does not load React, a renderer, state adapters, storage or the network", () => {
    for (const { text } of sources) {
      expect(text).not.toMatch(/from "react"|from "react-dom|from "@json-render\/react"/);
      expect(text).not.toMatch(/innerHTML|\beval\(|new Function|localStorage|fetch\(/);
      expect(text).not.toMatch(/redux|zustand|jotai|xstate|convex/i);
    }
  });
});
