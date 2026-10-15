/**
 * Starter page templates. Structure (headings and checklists) follows the
 * kind of outline used in public Joplin, Notesnook, Notion, and Obsidian
 * templates. The words are original. Nothing here is copied.
 * Proposal is a rule on periodType. No model call.
 */

export type PeriodType = "daily" | "weekly" | "monthly" | "none";

export type StarterTemplate = {
  templateId: `starter:${string}`;
  name: string;
  description: string;
  periodType: PeriodType;
  body: string;
};

export const STARTER_TEMPLATES: readonly StarterTemplate[] = [
  {
    templateId: "starter:daily-page",
    name: "Daily page",
    description: "A short outline for one day.",
    periodType: "daily",
    body: `# Today

## Intention
One line for what would make today feel complete.

## Schedule
- [ ] Morning
- [ ] Midday
- [ ] Afternoon

## Notes
`,
  },
  {
    templateId: "starter:weekly-page",
    name: "Weekly page",
    description: "A few outcomes and a place for each day.",
    periodType: "weekly",
    body: `# This week

## Focus
Three outcomes that matter this week.

- [ ] 
- [ ] 
- [ ] 

## Days
### Monday
### Tuesday
### Wednesday
### Thursday
### Friday
### Saturday
### Sunday

## Carry forward
What stays open for next week.
`,
  },
  {
    templateId: "starter:monthly-page",
    name: "Monthly page",
    description: "A theme, four weeks, and open loops.",
    periodType: "monthly",
    body: `# This month

## Theme

## Weeks
### Week 1
### Week 2
### Week 3
### Week 4

## Open loops

## Looking ahead
`,
  },
  {
    templateId: "starter:meeting-notes",
    name: "Meeting notes",
    description: "People, purpose, notes, and next steps.",
    periodType: "none",
    body: `# Meeting

## People

## Purpose

## Notes

## Decisions

## Next steps
- [ ] 
`,
  },
  {
    templateId: "starter:project-brief",
    name: "Project brief",
    description: "Outcome, constraints, and a first step.",
    periodType: "none",
    body: `# Project brief

## Outcome

## Why it matters

## Constraints

## Open questions

## First steps
- [ ] 
`,
  },
  {
    templateId: "starter:reading-notes",
    name: "Reading notes",
    description: "Source, ideas, and what to keep.",
    periodType: "none",
    body: `# Reading notes

## Source

## Main ideas

## Passages to keep

## What I want to remember

## Follow-ups
- [ ] 
`,
  },
  {
    templateId: "starter:journal",
    name: "Journal",
    description: "What happened, what you noticed, what you want next.",
    periodType: "none",
    body: `# Journal

## What happened

## What I noticed

## What I want tomorrow to hold
`,
  },
  {
    templateId: "starter:task-review",
    name: "Task review",
    description: "What is done, what is open, and one next step.",
    periodType: "none",
    body: `# Task review

## Done
- [ ] 

## Still open
- [ ] 

## Next small step
`,
  },
  {
    templateId: "starter:project-review",
    name: "Project review",
    description: "What moved, what is waiting, and when to look again.",
    periodType: "none",
    body: `# Project review

## What moved

## What is waiting

## What to change

## Next review
`,
  },
];

const PERIOD_STARTER: Record<Exclude<PeriodType, "none">, StarterTemplate["templateId"]> = {
  daily: "starter:daily-page",
  weekly: "starter:weekly-page",
  monthly: "starter:monthly-page",
};

export function sectionsFromBody(body: string): string[] {
  const sections: string[] = [];
  for (const line of body.split("\n")) {
    const match = /^#{1,6}\s+(.+?)\s*$/.exec(line);
    const heading = match?.[1]?.trim();
    if (heading) {
      sections.push(heading);
    }
  }
  return sections;
}

export function starterById(templateId: string): StarterTemplate | null {
  return STARTER_TEMPLATES.find((template) => template.templateId === templateId) ?? null;
}

export function isStarterTemplateId(templateId: string): boolean {
  return templateId.startsWith("starter:");
}

/** periodType picks a starter page. "none" has no single proposal. */
export function starterForPeriod(periodType: PeriodType): StarterTemplate | null {
  if (periodType === "none") {
    return null;
  }
  return starterById(PERIOD_STARTER[periodType]);
}
