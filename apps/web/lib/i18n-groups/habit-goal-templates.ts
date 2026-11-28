/** Personal-template outlines. Hebrew is machine-drafted for Amit's later native read. */
export const en = {
  title: "Start with a habit or goal",
  hint: "Preview an outline, then choose it for an untouched draft. Edit anything before saving your own template.",
  preview: "Preview",
  cancel: "Close preview",
  choose: "Choose outline",
  locked: "Keep editing this draft. Outlines can only fill an untouched blank template.",
  pending: "Saving this draft. Outline selection is unavailable.",
  "habit.name": "Habit reflection",
  "habit.description": "A flexible outline for a small step, helpful support and reflection.",
  "habit.body": "## Intention\nWhat would make this habit useful?\n\n## Small step\n- [ ] Choose one manageable step.\n\n## Useful cue\nWhat moment could help you remember?\n\n## Support\nWhat could make starting easier?\n\n## Reflection\nWhat helped, and what would you adjust?",
  "goal.name": "Goal outline",
  "goal.description": "An editable outline for an outcome, next steps and a review.",
  "goal.body": "## Outcome\nWhat would you like to work toward?\n\n## Reason\nWhy does this matter to you?\n\n## Next step\n- [ ] Choose one manageable next step.\n\n## Milestones\nWhat small signs would show progress?\n\n## Review\nWhen would you like to reflect and adjust?",
} as const;

export const he: Record<keyof typeof en, string> = {
  title: "מתחילים מהרגל או ממטרה",
  hint: "אפשר לעיין במתווה ולבחור בו לטיוטה ריקה שטרם נערכה. אפשר לערוך הכול לפני שמירת התבנית האישית.",
  preview: "תצוגה מקדימה",
  cancel: "סגירת התצוגה המקדימה",
  choose: "בחירת המתווה",
  locked: "אפשר להמשיך לערוך את הטיוטה. מתווים זמינים רק לתבנית ריקה שטרם נערכה.",
  pending: "הטיוטה נשמרת. בחירת מתווה אינה זמינה כרגע.",
  "habit.name": "התבוננות בהרגל",
  "habit.description": "מתווה גמיש לצעד קטן, לתמיכה מועילה ולהתבוננות.",
  "habit.body": "## כוונה\nמה יכול להפוך את ההרגל למועיל?\n\n## צעד קטן\n- [ ] בחירת צעד קטן שאפשר לבצע.\n\n## תזכורת מועילה\nאיזה רגע יכול לעזור להיזכר?\n\n## תמיכה\nמה יכול להקל על ההתחלה?\n\n## התבוננות\nמה עזר, ומה אפשר להתאים בהמשך?",
  "goal.name": "מתווה למטרה",
  "goal.description": "מתווה שניתן לערוך לתוצאה רצויה, לצעדים הבאים ולהתבוננות.",
  "goal.body": "## תוצאה רצויה\nלקראת מה רוצים להתקדם?\n\n## סיבה\nלמה המטרה חשובה?\n\n## הצעד הבא\n- [ ] בחירת צעד קטן שאפשר לבצע.\n\n## אבני דרך\nאילו סימנים קטנים יעידו על התקדמות?\n\n## התבוננות\nמתי כדאי לעצור, להתבונן ולהתאים את הדרך?",
};

export type HabitGoalLang = "en" | "he";
export type HabitGoalKey = keyof typeof en;
export type HabitGoalOutline = "habit" | "goal";
export type HabitGoalDraft = { name: string; description: string; body: string; periodType: "none" };
export const HABIT_GOAL_OUTLINES = ["habit", "goal"] as const;

export function habitGoalText(lang: HabitGoalLang, key: HabitGoalKey): string {
  return (lang === "he" ? he : en)[key];
}

export function habitGoalDraft(lang: HabitGoalLang, outline: HabitGoalOutline): HabitGoalDraft {
  return {
    name: habitGoalText(lang, `${outline}.name`),
    description: habitGoalText(lang, `${outline}.description`),
    body: habitGoalText(lang, `${outline}.body`),
    periodType: "none",
  };
}
