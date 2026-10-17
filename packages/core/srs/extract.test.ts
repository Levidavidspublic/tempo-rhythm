import { describe, expect, test } from "bun:test";
import { flashcardsDataSchema, quizDataSchema, testDataSchema } from "@tempo/utils";
import {
  acceptedAnswers,
  cleanMarkdown,
  clip,
  detectLang,
  hashSeed,
  inlineText,
  outlineToFlashcards,
  outlineToQuiz,
  outlineToTest,
  parseDefinition,
  readOutline,
  seededRandom,
  seededShuffle,
} from "./extract";

const EN = `# Cell biology

Some intro text that is not a definition.

Photosynthesis: how plants turn light into chemical energy.
**Mitochondria** — the powerhouse of the cell
Ribosome - where proteins are made

## Parts of a cell
- Nucleus
- Cytoplasm
- Cell membrane

## Stages of mitosis
1. Prophase
2. Metaphase
3. Anaphase
4. Telophase

\`\`\`json tempo
{"id":"blk_01ARZ3NDEKTSV4RRFFQ69G5FAV","v":1,"type":"task","data":{"title":"Fake: not a card"}}
\`\`\`

<div>Osmosis: <b>water</b> moving across a membrane</div>
<!-- Hidden: not this -->
See [the docs](https://example.com) at 10:30 for more.
`;

const HE = `# ביולוגיה של התא

פוטוסינתזה: התהליך שבו צמחים הופכים אור לאנרגיה כימית.
**מיטוכונדריה** — תחנת הכוח של התא
- ריבוזום: המקום שבו נבנים חלבונים

## חלקי התא
- גרעין
- ציטופלזמה
- קרום התא

## שלבי המיטוזה
1. פרופאזה
2. מטאפאזה
3. אנפאזה
4. טלופאזה
`;

const SOURCE = { noteId: "note_123", title: "Cell biology" };

describe("outline reader: golden fixtures", () => {
  test("English flashcards", () => {
    expect(outlineToFlashcards(EN, { title: "Cell biology", source: SOURCE })).toEqual({
      title: "Cell biology",
      origin: "outline",
      source: SOURCE,
      cards: [
        { id: "c1", front: "Photosynthesis", back: "how plants turn light into chemical energy" },
        { id: "c2", front: "Mitochondria", back: "the powerhouse of the cell" },
        { id: "c3", front: "Ribosome", back: "where proteins are made" },
        { id: "c4", front: "Parts of a cell", back: "Nucleus; Cytoplasm; Cell membrane" },
        {
          id: "c5",
          front: "Stages of mitosis",
          back: "1. Prophase; 2. Metaphase; 3. Anaphase; 4. Telophase",
        },
        { id: "c6", front: "Osmosis", back: "water moving across a membrane" },
      ],
    });
  });

  test("Hebrew flashcards", () => {
    expect(outlineToFlashcards(HE, { title: "ביולוגיה" })).toEqual({
      title: "ביולוגיה",
      origin: "outline",
      cards: [
        { id: "c1", front: "פוטוסינתזה", back: "התהליך שבו צמחים הופכים אור לאנרגיה כימית" },
        { id: "c2", front: "מיטוכונדריה", back: "תחנת הכוח של התא" },
        { id: "c3", front: "ריבוזום", back: "המקום שבו נבנים חלבונים" },
        { id: "c4", front: "חלקי התא", back: "גרעין; ציטופלזמה; קרום התא" },
        { id: "c5", front: "שלבי המיטוזה", back: "1. פרופאזה; 2. מטאפאזה; 3. אנפאזה; 4. טלופאזה" },
      ],
    });
  });

  test("English quiz: prompts, answers and difficulty", () => {
    const quiz = outlineToQuiz(EN, { title: "Cell biology" });
    expect(quiz).not.toBeNull();
    expect(quizDataSchema.safeParse(quiz).success).toBe(true);
    expect(quiz?.mode).toBe("adaptive");
    const summary = quiz?.questions.map((q) => [
      q.id,
      q.prompt,
      q.choices.find((c) => c.id === q.answerId)?.text,
      q.difficulty,
      q.choices.length,
    ]);
    expect(summary).toEqual([
      [
        "q1",
        'What does "Photosynthesis" mean?',
        "how plants turn light into chemical energy",
        1,
        4,
      ],
      ["q2", 'What does "Mitochondria" mean?', "the powerhouse of the cell", 1, 4],
      ["q3", 'What does "Ribosome" mean?', "where proteins are made", 1, 4],
      [
        "q4",
        'Which of these goes with "Parts of a cell"?',
        "Nucleus; Cytoplasm; Cell membrane",
        2,
        4,
      ],
      [
        "q5",
        'What is the right order for "Stages of mitosis"?',
        "Prophase → Metaphase → Anaphase → Telophase",
        3,
        4,
      ],
      ["q6", 'What does "Osmosis" mean?', "water moving across a membrane", 1, 4],
    ]);
    // Distractors are other items' answers; order questions use other orders of the same steps.
    const order = quiz?.questions[4];
    for (const choice of order?.choices ?? []) {
      expect(choice.text.split(" → ").sort()).toEqual([
        "Anaphase",
        "Metaphase",
        "Prophase",
        "Telophase",
      ]);
    }
    const answers = new Set(readOutline(EN).map((item) => item.meaning));
    for (const choice of quiz?.questions[0]?.choices ?? [])
      expect(answers.has(choice.text)).toBe(true);
  });

  test("Hebrew quiz uses Hebrew prompts", () => {
    const quiz = outlineToQuiz(HE, { title: "ביולוגיה", mode: "fixed" });
    expect(quizDataSchema.safeParse(quiz).success).toBe(true);
    expect(quiz?.mode).toBe("fixed");
    expect(quiz?.questions.map((q) => q.prompt)).toEqual([
      'מה הפירוש של "פוטוסינתזה"?',
      'מה הפירוש של "מיטוכונדריה"?',
      'מה הפירוש של "ריבוזום"?',
      'מה שייך לנושא "חלקי התא"?',
      'מה הסדר הנכון של "שלבי המיטוזה"?',
    ]);
  });

  test("English test: an mcq section and a short-answer section", () => {
    const test_ = outlineToTest(EN, { title: "Cell biology" });
    expect(testDataSchema.safeParse(test_).success).toBe(true);
    expect(test_?.style).toBe("standard");
    expect(test_?.sections.map((s) => [s.id, s.title, s.questions.map((q) => q.id)])).toEqual([
      ["mcq", "Multiple choice", ["m1", "m2", "m3"]],
      ["short", "Short answers", ["s1", "s2", "s3"]],
    ]);
    expect(test_?.sections[1]?.questions).toEqual([
      {
        plugin: "short",
        id: "s1",
        prompt: "Which topic do these belong to: Nucleus; Cytoplasm; Cell membrane",
        points: 2,
        accepted: ["Parts of a cell"],
      },
      {
        plugin: "short",
        id: "s2",
        prompt:
          "Which topic do these belong to: 1. Prophase; 2. Metaphase; 3. Anaphase; 4. Telophase",
        points: 2,
        accepted: ["Stages of mitosis"],
      },
      {
        plugin: "short",
        id: "s3",
        prompt: "Which term matches this: water moving across a membrane",
        points: 2,
        accepted: ["Osmosis"],
      },
    ]);
  });

  test("Hebrew test, Bagrut style", () => {
    const test_ = outlineToTest(HE, { title: "ביולוגיה", style: "bagrut" });
    expect(testDataSchema.safeParse(test_).success).toBe(true);
    expect(test_?.style).toBe("bagrut");
    expect(test_?.sections.map((s) => [s.title, s.instructions, s.questions.length])).toEqual([
      ["שאלות בחירה", "בחרו את התשובה המתאימה ביותר.", 3],
      ["תשובות קצרות", "כתבו את המונח או הנושא בכמה מילים.", 2],
    ]);
    expect(test_?.sections[1]?.questions[0]).toMatchObject({
      prompt: "לאיזה נושא שייכים: גרעין; ציטופלזמה; קרום התא",
      accepted: ["חלקי התא"],
    });
  });
});

describe("outline reader: behaviour", () => {
  test("deterministic: same input same output; the seed changes the shuffle", () => {
    expect(outlineToQuiz(EN, { title: "T" })).toEqual(outlineToQuiz(EN, { title: "T" }));
    const orders = new Set(
      [1, 2, 3, 4, 5].map((seed) =>
        JSON.stringify(outlineToQuiz(EN, { title: "T", seed })?.questions.map((q) => q.choices))
      )
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  test("fewer than 2 usable items gives null", () => {
    for (const md of [
      "",
      "Just a paragraph.",
      "Term: meaning",
      "# Heading only\n\nText.",
      "```\nA: b\nC: d\n```",
    ]) {
      expect(outlineToFlashcards(md, { title: "T" })).toBeNull();
      expect(outlineToQuiz(md, { title: "T" })).toBeNull();
      expect(outlineToTest(md, { title: "T" })).toBeNull();
    }
  });

  test("two items are enough for every block type", () => {
    const md = "Cat: a small animal that purrs\nDog: an animal that barks";
    expect(outlineToFlashcards(md, { title: "T" })?.cards).toHaveLength(2);
    expect(outlineToQuiz(md, { title: "T" })?.questions.map((q) => q.choices.length)).toEqual([
      2, 2,
    ]);
    expect(outlineToTest(md, { title: "T" })?.sections.map((s) => s.questions.length)).toEqual([
      1, 1,
    ]);
  });

  test("a blank title falls back to a short default in the page's language", () => {
    expect(outlineToFlashcards(EN, { title: "  " })?.title).toBe("Flashcards");
    expect(outlineToQuiz(HE, { title: "" })?.title).toBe("חידון תרגול");
    expect(outlineToTest(EN, { title: "", lang: "he" })?.title).toBe("מבחן תרגול");
  });

  test("duplicate terms keep the first", () => {
    const items = readOutline("Cat: one\ncat: two\n**CAT** three\nDog: four");
    expect(items.map((i) => i.meaning)).toEqual(["one", "four"]);
  });

  test("lead-in lines ending in a colon title the next list", () => {
    expect(readOutline("The primary colours:\n- red\n- yellow\n- blue")).toEqual([
      {
        kind: "list",
        term: "The primary colours",
        meaning: "red; yellow; blue",
        entries: ["red", "yellow", "blue"],
      },
    ]);
  });

  test("a list with no heading or lead-in is skipped", () => {
    expect(readOutline("- one\n- two\n1. three")).toEqual([]);
  });

  test("definition bullets inside a list stand alone; the rest form the list", () => {
    const items = readOutline("## Animals\n- Cat: purrs\n- Dog\n- Cow");
    expect(items.map((i) => [i.kind, i.term, i.meaning])).toEqual([
      ["definition", "Cat", "purrs"],
      ["list", "Animals", "Dog; Cow"],
    ]);
  });

  test("a list split by a paragraph does not make a second card for the same heading", () => {
    const items = readOutline("## Fruit\n- apple\n\nSome words.\n\n- pear");
    expect(items.map((i) => i.meaning)).toEqual(["apple"]);
  });

  test("task-list boxes, blockquotes and rules", () => {
    const items = readOutline("> Quote: a cited line\n\n---\n\n## Todo\n- [ ] milk\n- [x] eggs");
    expect(items.map((i) => [i.term, i.meaning])).toEqual([
      ["Quote", "a cited line"],
      ["Todo", "milk; eggs"],
    ]);
  });
});

describe("parseDefinition", () => {
  test.each([
    ["Term: meaning", { term: "Term", meaning: "meaning" }],
    ["Term — meaning", { term: "Term", meaning: "meaning" }],
    ["Term – meaning", { term: "Term", meaning: "meaning" }],
    ["Term - meaning", { term: "Term", meaning: "meaning" }],
    ["**Term** meaning", { term: "Term", meaning: "meaning" }],
    ["**Term:** meaning", { term: "Term", meaning: "meaning" }],
    ["__Term__ - meaning", { term: "Term", meaning: "meaning" }],
    ["[[DNA]]: the genetic code", { term: "DNA", meaning: "the genetic code" }],
    ["Speed — distance: over time", { term: "Speed", meaning: "distance: over time" }],
    ["Ellipsis: and so on...", { term: "Ellipsis", meaning: "and so on..." }],
    ["מונח: הסבר", { term: "מונח", meaning: "הסבר" }],
  ])("%p", (input, expected) => {
    expect(parseDefinition(input)).toEqual(expected);
  });

  test.each([
    "Meet at 10:30 today",
    "https://example.com",
    "See http: nothing",
    "This is a very long sentence that goes on and on: then a colon",
    "123: 456",
    "Term: ...",
    "plain text",
  ])("not a definition: %p", (input) => {
    expect(parseDefinition(input)).toBeNull();
  });
});

describe("text helpers", () => {
  test("cleanMarkdown drops fences (unclosed too), comments and tags, decodes entities", () => {
    expect(cleanMarkdown("a\n~~~\nb\n~~~\nc")).toBe("a\nc");
    expect(cleanMarkdown("a\n```json\n{}\n")).toBe("a");
    expect(cleanMarkdown("x<br>y <!-- z --> <span class='k'>w</span>")).toBe("x\ny  w");
    expect(cleanMarkdown("Tom &amp; Jerry &lt;3 &#x5D0; &#1489; &bogus;")).toBe(
      "Tom & Jerry <3 א ב &bogus;"
    );
    expect(cleanMarkdown("a < b")).toBe("a < b");
  });

  test("inlineText keeps link text and drops markup", () => {
    expect(
      inlineText("**bold** *it* `code` ~~gone~~ [link](http://x) ![img](y.png) [[Page|alias]]")
    ).toBe("bold it code gone link alias");
    expect(inlineText("snake_case stays")).toBe("snake_case stays");
  });

  test("detectLang", () => {
    expect(detectLang(HE)).toBe("he");
    expect(detectLang(EN)).toBe("en");
    expect(detectLang("")).toBe("en");
  });

  test("clip respects the codec's UTF-16 length and never splits a surrogate pair", () => {
    expect(clip("  short  ", 10)).toBe("short");
    const cut = clip("a".repeat(600), 500);
    expect(cut).toHaveLength(500);
    expect(cut.endsWith("…")).toBe(true);
    const astral = clip(`${"a".repeat(498)}𝒳𝒳`, 500);
    expect(astral.length).toBeLessThanOrEqual(500);
    expect(astral).not.toMatch(/[\uD800-\uDBFF]…$/);
  });

  test("acceptedAnswers adds the forms with and without a parenthesis", () => {
    expect(acceptedAnswers("DNA (deoxyribonucleic acid)")).toEqual([
      "DNA (deoxyribonucleic acid)",
      "DNA",
      "deoxyribonucleic acid",
    ]);
    expect(acceptedAnswers("Cell")).toEqual(["Cell"]);
  });

  test("seeded randomness is stable and in range", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x >= 0 && x < 1).toBe(true);
    }
    expect(seededShuffle([1, 2, 3, 4, 5], seededRandom(7)).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
    expect(hashSeed("abc")).not.toBe(hashSeed("abd"));
  });
});

describe("every output passes the codec", () => {
  test("long fields are clipped to 500 characters", () => {
    const long = "x".repeat(900);
    const md = `## ${"Heading ".repeat(80)}\n- ${long}\n- y\nCat: ${long}\nDog (canine): ${long}`;
    const cards = outlineToFlashcards(md, { title: "t".repeat(700) });
    expect(flashcardsDataSchema.safeParse(cards).success).toBe(true);
    expect(cards?.title).toHaveLength(500);
    expect(quizDataSchema.safeParse(outlineToQuiz(md, { title: "T" })).success).toBe(true);
    expect(testDataSchema.safeParse(outlineToTest(md, { title: "T" })).success).toBe(true);
  });

  test("150 items cap at 100 cards and 20 questions per test section", () => {
    const md = Array.from({ length: 150 }, (_, i) => `Term ${i}: meaning number ${i}`).join("\n");
    expect(outlineToFlashcards(md, { title: "T" })?.cards).toHaveLength(100);
    expect(outlineToQuiz(md, { title: "T" })?.questions).toHaveLength(100);
    const test_ = outlineToTest(md, { title: "T" });
    expect(test_?.sections.map((s) => s.questions.length)).toEqual([20, 20]);
    expect(testDataSchema.safeParse(test_).success).toBe(true);
  });

  test("random outlines always produce codec-valid data or null", () => {
    const random = seededRandom(2026);
    const pieces = [
      "# Heading",
      "## Sub",
      "- bullet",
      "1. step",
      "Term: meaning",
      "**Bold** text",
      "A — b",
      "שם: הסבר",
      "plain",
      "Lead:",
      "```",
      "<b>x</b>",
      "",
      "---",
      "Same: same",
      "Same: same",
      `Long: ${"z".repeat(520)}`,
      "𝒳: astral",
    ];
    for (let run = 0; run < 300; run++) {
      const md = Array.from({ length: 1 + Math.floor(random() * 25) }, () => {
        return pieces[Math.floor(random() * pieces.length)];
      }).join("\n");
      const seed = Math.floor(random() * 1e9);
      const cards = outlineToFlashcards(md, { title: "T", seed });
      const quiz = outlineToQuiz(md, { title: "T", seed });
      const test_ = outlineToTest(md, { title: "T", seed });
      if (cards) expect(flashcardsDataSchema.safeParse(cards).success).toBe(true);
      if (quiz) expect(quizDataSchema.safeParse(quiz).success).toBe(true);
      if (test_) expect(testDataSchema.safeParse(test_).success).toBe(true);
      if (readOutline(md).length >= 2) expect(cards).not.toBeNull();
    }
  });
});
