/**
 * /coach: the "Today's plan" card (components/coach-proposal/CoachProposalCard.tsx).
 * English and Hebrew; i18n.ts merges both. Hebrew needs native review (OVERNIGHT-RUN.md).
 * The tasks' own titles are the person's words and are never translated.
 */
export const en = {
  "cp.title": "Today’s plan",
  "cp.heading": "Your plan for today",
  "cp.loading": "Loading your plan.",
  "cp.plan": "Plan my day",
  "cp.retry": "Try again",
  "cp.accept": "Accept",
  "cp.notToday": "Not today",
  "cp.accepted": "Plan accepted. You can start with the first one.",
  "cp.rejected": "No problem. We can try again whenever.",
  "cp.empty": "Nothing to plan yet. Add a task or do a brain dump.",
  "cp.error": "That didn't work. Try again?",
  "cp.badDay": "Rough day? Keeping it light.",
  "cp.realism.ok": "This fits the time you have.",
  "cp.realism.tooMuch": "This is a lot for the time you have. Want fewer?",
  "cp.firstAction": "First, a 10-second action",
  // Counts: ".one" for exactly 1, ".many" ({n}) for every other number.
  "cp.today.one": "Today: 1 task",
  "cp.today.many": "Today: {n} tasks",
  "cp.lighter.one": "Lighter day: 1 task",
  "cp.lighter.many": "Lighter day: {n} tasks",
  "cp.next.one": "Next time: 1 task",
  "cp.next.many": "Next time: {n} tasks",
  // After a task's title; one form for every number.
  "cp.minutes": "({n} min)",
  // The 10-second actions, word for word as convex/lib/coachLoad.ts (TEN_SECOND_ACTIONS) stores them.
  "cp.action.breath": "Take one slow breath, then put your hand on the first thing you need.",
  "cp.action.water": "Stand up and drink a sip of water.",
  "cp.action.title": "Open the first task and read just its title.",
  "cp.action.jaw": "Unclench your jaw and drop your shoulders once.",
  "cp.action.desk": "Put one thing you do not need away from your desk.",
} as const;

export const he: Record<keyof typeof en, string> = {
  "cp.title": "התוכנית של היום",
  "cp.heading": "התוכנית שלך להיום",
  "cp.loading": "טוענים את התוכנית שלך.",
  "cp.plan": "לתכנן את היום שלי",
  "cp.retry": "לנסות שוב",
  "cp.accept": "אישור",
  "cp.notToday": "לא היום",
  "cp.accepted": "התוכנית אושרה. אפשר להתחיל מהמשימה הראשונה.",
  "cp.rejected": "אין בעיה. אפשר לנסות שוב מתי שרוצים.",
  "cp.empty": "עוד אין מה לתכנן. אפשר להוסיף משימה או לעשות פריקת מחשבות.",
  "cp.error": "זה לא הצליח. לנסות שוב?",
  "cp.badDay": "יום קשה? נשאיר את זה קליל.",
  "cp.realism.ok": "זה מתאים לזמן שיש לך.",
  "cp.realism.tooMuch": "זה הרבה לזמן שיש לך. רוצה פחות משימות?",
  "cp.firstAction": "קודם, פעולה של 10 שניות",
  "cp.today.one": "היום: משימה אחת",
  "cp.today.many": "היום: {n} משימות",
  "cp.lighter.one": "יום קל יותר: משימה אחת",
  "cp.lighter.many": "יום קל יותר: {n} משימות",
  "cp.next.one": "בפעם הבאה: משימה אחת",
  "cp.next.many": "בפעם הבאה: {n} משימות",
  "cp.minutes": "({n} דק׳)",
  "cp.action.breath": "לנשום נשימה איטית אחת, ואז לשים יד על הדבר הראשון שצריך.",
  "cp.action.water": "לקום ולשתות לגימת מים.",
  "cp.action.title": "לפתוח את המשימה הראשונה ולקרוא רק את הכותרת שלה.",
  "cp.action.jaw": "לשחרר את הלסת ולהוריד את הכתפיים פעם אחת.",
  "cp.action.desk": "להרחיק מהשולחן דבר אחד שלא צריך.",
};
