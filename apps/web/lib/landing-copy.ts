/**
 * The landing page's words (apps/web/app/page.tsx), in English and Hebrew.
 *
 * Every line says what the beta does today, checked against the code (TEMPO-B07-05, #980):
 * - No testimonials, user counts or screen counts: none of them come from real people or data.
 * - Coach lines and sample pages are labelled as examples.
 * - No App Store or Google Play claim: there is no store listing. The web app runs in a
 *   laptop or phone browser.
 * - Voice is not offered: it only works where its keys are set.
 * - Pricing is "free during the beta", and Amit approves each account by hand (convex/approval.ts).
 *
 * Hebrew uses plural or impersonal forms so it speaks to everyone, like lib/i18n.ts.
 */
import type { Lang } from "./i18n";

type Card = { eyebrow: string; title: string; body: string };

/** One line of the example page. `title` is the page's # line, `note` a muted closing line. */
export type SampleLine = { kind: "title" | "heading" | "line" | "note"; text: string };

export type LandingCopy = {
  meta: { title: string; description: string };
  nav: {
    home: string;
    features: string;
    coach: string;
    pricing: string;
    letter: string;
    signIn: string;
    signUp: string;
    join: string;
  };
  hero: {
    badge: string;
    titleStart: string;
    titleEmphasis: string;
    titleEnd: string;
    lede: string;
    facts: readonly { value: string; label: string }[];
    dumpLabel: string;
    dump: string;
    coachLabel: string;
    coachTitle: string;
    coachBody: string;
    weekLabel: string;
    weekBody: string;
  };
  features: {
    eyebrow: string;
    title: string;
    lede: string;
    page: Card & { chips: readonly string[]; sampleLabel: string; sample: readonly SampleLine[] };
    brainDump: Card & { orderLabel: string; order: readonly { text: string; tag: string }[] };
    coach: Card & { exampleLabel: string; example: string };
    order: Card;
    journal: Card;
    routines: Card;
    week: Card;
  };
  coach: {
    eyebrow: string;
    title: string;
    lede: string;
    examples: readonly { line: string; caption: string }[];
  };
  pricing: {
    eyebrow: string;
    title: string;
    lede: string;
    beta: {
      label: string;
      price: string;
      suffix: string;
      body: string;
      includes: readonly string[];
      cta: string;
    };
    now: {
      badge: string;
      label: string;
      price: string;
      suffix: string;
      body: string;
      includes: readonly string[];
      cta: string;
    };
  };
  letter: { eyebrow: string; title: string; paragraphs: readonly string[]; signature: string };
  closing: { title: string; body: string; cta: string };
  footer: {
    tagline: string;
    product: string;
    features: string;
    coach: string;
    pricing: string;
    signUp: string;
    legal: string;
    privacy: string;
    terms: string;
    contact: string;
    license: string;
    status: string;
  };
};

const en: LandingCopy = {
  meta: {
    title: "Tempo Flow — a planner that won't shame you",
    description:
      "A planner and coach for adults with ADHD, autism or learning disabilities. Dump what's on your mind, get an order for your day, and accept or undo every change. Free during the beta.",
  },
  nav: {
    home: "Tempo Flow home",
    features: "Features",
    coach: "Coach",
    pricing: "Pricing",
    letter: "Letter",
    signIn: "Sign in",
    signUp: "Sign up",
    join: "Join the free beta",
  },
  hero: {
    badge: "Beta · accounts approved by hand",
    titleStart: "A planner that won't ",
    titleEmphasis: "shame",
    titleEnd: " you.",
    lede: "Tempo Flow is a planner and coach for adults with ADHD, autism or learning disabilities. Dump what's on your mind. Tempo sorts it into now, soon and later, and nothing goes on your list until you say yes.",
    facts: [
      { value: "Free", label: "during the beta" },
      { value: "No card", label: "and no password" },
      { value: "Web", label: "on a laptop or a phone" },
    ],
    dumpLabel: "Brain dump · example",
    dump: "Reply to Dana about Saturday. Book the dentist. Pay the electricity bill before Sunday. The tax form is stressing me out.",
    coachLabel: "Coach · example",
    coachTitle: "Add a task to Today?",
    coachBody:
      "Book the dentist · 10 min. Accept, Edit or Not now. Nothing changes until you accept.",
    weekLabel: "This week · example",
    weekBody: "Days with something finished. No streaks, no scores.",
  },
  features: {
    eyebrow: "What's inside",
    title: "Your day on one page, and a coach that asks first.",
    lede: "Today shows your tasks and a Markdown page for the day. The journal is those daily pages, newest first. You can edit, link and export every page.",
    page: {
      eyebrow: "★ Daily page",
      title: "Plain Markdown, with links between pages.",
      body: "Type [[ and a page name to link to it. The other page lists it under Linked here. Tags sit on the page, and Ctrl K (⌘K on a Mac) opens the command bar to jump between screens.",
      chips: ["[[ links ]]", "Linked here", "Ctrl K · ⌘K"],
      sampleLabel: "Example page",
      sample: [
        { kind: "title", text: "# Thursday" },
        { kind: "heading", text: "## Today" },
        { kind: "line", text: "Slides first, then the [[Moving checklist]]." },
        { kind: "line", text: "☑ Pay the electricity bill · 5 min" },
        { kind: "line", text: "☐ Book the dentist · 10 min" },
        { kind: "heading", text: "## Notes" },
        { kind: "note", text: "Tax form after lunch. See [[Taxes]]." },
      ],
    },
    brainDump: {
      eyebrow: "01 — Brain dump",
      title: "Empty your head. Tempo puts it in order.",
      body: "Type everything in one messy pile. The AI sorts it into Now, Soon and Later, with a reason for each line. Nothing is added until you accept it, and the Now lines go on Today.",
      orderLabel: "Your order · example",
      order: [
        { text: "Pay the electricity bill", tag: "NOW" },
        { text: "Book the dentist", tag: "SOON" },
        { text: "Look at the tax form", tag: "LATER" },
      ],
    },
    coach: {
      eyebrow: "02 — Coach",
      title: "It suggests. You decide.",
      body: "The coach sees the page you have open and today's open tasks. It can suggest a task, a new page, a template or an order for your day. A dial from 0 to 10 sets how much it pushes.",
      exampleLabel: "Example",
      example: "“Want me to add ‘Book the dentist’ to today, 10 minutes?”",
    },
    order: {
      eyebrow: "03 — An order for today",
      title: "Ask what to do first. Keep the answer on today's page.",
      body: "Ask the coach “What order should I do these in?” It answers with a card: numbered steps, minutes, and a short reason for each. Save to today puts the steps on today's page, and you can undo it for 5 minutes.",
    },
    journal: {
      eyebrow: "04 — Journal",
      title: "One prompt a day, if you want it.",
      body: "The journal is your daily pages, newest first. Each day offers one optional prompt, and Another prompt shows a different one.",
    },
    routines: {
      eyebrow: "05 — Routines",
      title: "One step at a time.",
      body: "Run a routine step by step. Mark a step done, skip it, or go back a step, and pause when you need to.",
    },
    week: {
      eyebrow: "06 — Weekly",
      title: "This week at a glance.",
      body: "Each weekly page opens with what you finished and your focus time, day by day. A quiet week just says that's fine.",
    },
  },
  coach: {
    eyebrow: "The coach",
    title: "Nothing changes until you say yes.",
    lede: "Every change the coach suggests comes as a card that shows exactly what will change, with Accept, Edit and Not now. After you accept, you can undo it for 5 minutes. The lines below are examples of what it can say. They are not quotes from users.",
    examples: [
      {
        line: "“I can add ‘Pay the electricity bill’ to today, 5 minutes. Nothing changes until you accept.”",
        caption: "Example · a task card",
      },
      {
        line: "“Here's an order for this afternoon: the bill first, because it's quick. Then call the dentist.”",
        caption: "Example · an order for today",
      },
      {
        line: "“Want a weekly page with three things to move forward? I can make it a template.”",
        caption: "Example · a template",
      },
    ],
  },
  pricing: {
    eyebrow: "Pricing",
    title: "Free during the beta. Sign up, then Amit lets you in.",
    lede: "Amit approves each new account by hand. Once you're in, you can use everything that's built, for as long as the beta lasts. No card, and no trial clock.",
    beta: {
      label: "Beta",
      price: "Free",
      suffix: "· sign up",
      body: "Sign up with your email. Once Amit approves you, Tempo opens by itself if the page is still open.",
      includes: [
        "Today, tasks, notes, calendar and journal",
        "A brain dump that sorts into Now, Soon and Later",
        "The coach, with Accept, Edit and Undo",
        "Habits, routines and templates",
      ],
      cta: "Join the free beta →",
    },
    now: {
      badge: "Included now",
      label: "Good to know",
      price: "Free",
      suffix: "· during the beta",
      body: "There is no payment step in the beta. Your pages and tasks are saved to your account, so they're there on any device you sign in on.",
      includes: [
        "Sign in with a link we email you, no password",
        "Export any page as a Markdown file",
        "Hebrew, right to left (some screens are still in English)",
        "No app to install: it runs in your browser",
      ],
      cta: "Join the free beta →",
    },
  },
  letter: {
    eyebrow: "A letter from Amit",
    title: "Why Tempo exists.",
    paragraphs: [
      "Tempo started as a tool I needed for my own brain. Most planners are made for people who already start, switch and remember on their own. When that is the hard part, a long list is one more thing to feel bad about.",
      "So Tempo keeps your day on one calm page, sorts the mess with you, and has a coach that suggests one change at a time. It changes nothing until you say yes, and you can undo it.",
      "It is a coach, not a therapist. It is also a small beta: I approve each account by hand, so I can listen and fix things fast.",
      "If it works for you, that is enough. The beta is free while it is open. If it does not fit, you can leave it there.",
    ],
    signature: "— Amit",
  },
  closing: {
    title: "Free during the beta. All it takes is your email.",
    body: "No card. No password: you sign in with a link we email you. Amit approves each account by hand.",
    cta: "Join the free beta",
  },
  footer: {
    tagline:
      "A planner and coach for adults with ADHD, autism or learning disabilities. A coach, not a therapist.",
    product: "Product",
    features: "Features",
    coach: "The coach",
    pricing: "Pricing",
    signUp: "Sign up",
    legal: "Legal",
    privacy: "Privacy",
    terms: "Terms",
    contact: "Contact",
    license: "© 2026 Tempo Flow · BUSL-1.1",
    status: "Beta",
  },
};

const he: LandingCopy = {
  meta: {
    title: "Tempo Flow — אפליקציית תכנון שלא מביישת אותך",
    description:
      "כלי תכנון ומאמן למבוגרים עם ADHD, אוטיזם או לקויות למידה. שופכים את מה שבראש, מקבלים סדר ליום, ומאשרים או מבטלים כל שינוי. חינם בזמן הבטא.",
  },
  nav: {
    home: "דף הבית של Tempo Flow",
    features: "מה בפנים",
    coach: "המאמן",
    pricing: "מחירים",
    letter: "מכתב",
    signIn: "כניסה",
    signUp: "הרשמה",
    join: "הצטרפות לבטא",
  },
  hero: {
    badge: "בטא · כל חשבון מאושר ידנית",
    titleStart: "אפליקציית תכנון שלא ",
    titleEmphasis: "מביישת",
    titleEnd: " אותך.",
    lede: "Tempo Flow הוא כלי תכנון ומאמן למבוגרים עם ADHD, אוטיזם או לקויות למידה. שופכים את מה שבראש, ו-Tempo מסדר את זה ל״עכשיו״, ״בקרוב״ ו״אחר כך״, ושום דבר לא נכנס לרשימה עד שמאשרים.",
    facts: [
      { value: "חינם", label: "בזמן הבטא" },
      { value: "בלי כרטיס", label: "וגם בלי סיסמה" },
      { value: "בדפדפן", label: "במחשב או בטלפון" },
    ],
    dumpLabel: "פריקת מחשבות · דוגמה",
    dump: "לענות לדנה לגבי שבת. לקבוע תור לרופא שיניים. לשלם חשמל לפני יום ראשון. טופס המס מלחיץ אותי.",
    coachLabel: "המאמן · דוגמה",
    coachTitle: "להוסיף משימה להיום?",
    coachBody:
      "לקבוע תור לרופא שיניים · 10 דק׳. אישור, עריכה או לא עכשיו. שום דבר לא משתנה עד שמאשרים.",
    weekLabel: "השבוע · דוגמה",
    weekBody: "ימים שבהם משהו הושלם. בלי רצפים ובלי ציונים.",
  },
  features: {
    eyebrow: "מה יש בפנים",
    title: "היום שלך בדף אחד, ומאמן ששואל קודם.",
    lede: "בדף ״היום״ יש את המשימות שלך ודף Markdown ליום. היומן הוא הדפים היומיים האלה, החדש ביותר ראשון. כל דף אפשר לערוך, לקשר ולייצא.",
    page: {
      eyebrow: "★ הדף היומי",
      title: "Markdown פשוט, עם קישורים בין דפים.",
      body: "מקלידים [[ ושם של דף כדי לקשר אליו. הדף השני מציג את הקישור תחת ״מקושר לכאן״. תגיות יושבות על הדף, ו-Ctrl K (או ⌘K במק) פותח חיפוש כדי לעבור בין מסכים.",
      chips: ["[[ קישורים ]]", "מקושר לכאן", "קיצור Ctrl K · ⌘K"],
      sampleLabel: "דף לדוגמה",
      sample: [
        { kind: "title", text: "# יום חמישי" },
        { kind: "heading", text: "## היום" },
        { kind: "line", text: "קודם השקפים, ואחר כך [[רשימת המעבר]]." },
        { kind: "line", text: "☑ לשלם חשמל · 5 דק׳" },
        { kind: "line", text: "☐ לקבוע תור לרופא שיניים · 10 דק׳" },
        { kind: "heading", text: "## פתקים" },
        { kind: "note", text: "טופס המס אחרי הצהריים. ראו [[מסים]]." },
      ],
    },
    brainDump: {
      eyebrow: "01 — פריקת מחשבות",
      title: "מרוקנים את הראש. Tempo עושה סדר.",
      body: "כותבים הכול בערימה אחת מבולגנת. ה-AI ממיין ל״עכשיו״, ״בקרוב״ ו״אחר כך״, עם סיבה לכל שורה. שום דבר לא נוסף עד שמאשרים, והשורות של ״עכשיו״ נכנסות לדף היום.",
      orderLabel: "הסדר שלך · דוגמה",
      order: [
        { text: "לשלם חשמל", tag: "עכשיו" },
        { text: "לקבוע תור לרופא שיניים", tag: "בקרוב" },
        { text: "להסתכל על טופס המס", tag: "אחר כך" },
      ],
    },
    coach: {
      eyebrow: "02 — המאמן",
      title: "הוא מציע. ההחלטה שלך.",
      body: "המאמן רואה את הדף הפתוח ואת המשימות הפתוחות של היום. הוא יכול להציע משימה, דף חדש, תבנית או סדר ליום. חוגה מ-0 עד 10 קובעת כמה הוא דוחף.",
      exampleLabel: "דוגמה",
      example: "״להוסיף את ׳לקבוע תור לרופא שיניים׳ להיום, 10 דקות?״",
    },
    order: {
      eyebrow: "03 — סדר להיום",
      title: "שואלים מה קודם. שומרים את התשובה בדף היום.",
      body: "שואלים את המאמן ״באיזה סדר כדאי לי לעשות את אלה?״ והוא עונה בכרטיס: שלבים ממוספרים, דקות וסיבה קצרה לכל שלב. ״שמירה להיום״ מכניסה את השלבים לדף היום, ואפשר לבטל במשך 5 דקות.",
    },
    journal: {
      eyebrow: "04 — יומן",
      title: "שאלה אחת ביום, אם רוצים.",
      body: "היומן הוא הדפים היומיים שלך, החדש ביותר ראשון. בכל יום יש שאלה אחת שלא חייבים לענות עליה, ו״שאלה אחרת״ מחליפה אותה.",
    },
    routines: {
      eyebrow: "05 — שגרות",
      title: "צעד אחד בכל פעם.",
      body: "מריצים שגרה צעד אחרי צעד. מסמנים צעד כבוצע, מדלגים עליו או חוזרים צעד אחורה, ועוצרים כשצריך.",
    },
    week: {
      eyebrow: "06 — השבוע",
      title: "השבוע במבט אחד.",
      body: "כל דף שבועי נפתח עם מה שהושלם וזמן הריכוז, יום אחרי יום. שבוע שקט פשוט אומר שזה בסדר.",
    },
  },
  coach: {
    eyebrow: "המאמן",
    title: "שום דבר לא משתנה עד שמאשרים.",
    lede: "כל שינוי שהמאמן מציע מגיע ככרטיס שמראה בדיוק מה ישתנה, עם אישור, עריכה ולא עכשיו. אחרי שמאשרים, אפשר לבטל במשך 5 דקות. השורות למטה הן דוגמאות למה שהוא יכול לכתוב, לא ציטוטים של משתמשים.",
    examples: [
      {
        line: "״אפשר להוסיף את ׳לשלם חשמל׳ להיום, 5 דקות. שום דבר לא משתנה עד שמאשרים.״",
        caption: "דוגמה · כרטיס משימה",
      },
      {
        line: "״הנה סדר לאחר הצהריים: קודם החשבון, כי זה מהיר. אחר כך להתקשר לרופא השיניים.״",
        caption: "דוגמה · סדר להיום",
      },
      {
        line: "״רוצה דף שבועי עם שלושה דברים לקדם? אפשר להפוך אותו לתבנית.״",
        caption: "דוגמה · תבנית",
      },
    ],
  },
  pricing: {
    eyebrow: "מחירים",
    title: "חינם בזמן הבטא. נרשמים, ועמית מאשר.",
    lede: "עמית מאשר כל חשבון חדש ידנית. אחרי שנכנסים, אפשר להשתמש בכל מה שכבר בנוי, כל עוד הבטא נמשכת. בלי כרטיס אשראי ובלי תקופת ניסיון שנגמרת.",
    beta: {
      label: "בטא",
      price: "חינם",
      suffix: "· הרשמה",
      body: "נרשמים עם המייל. אחרי שעמית מאשר, Tempo נפתח מעצמו אם הדף עדיין פתוח.",
      includes: [
        "היום, משימות, פתקים, לוח שנה ויומן",
        "פריקת מחשבות שממיינת ל״עכשיו״, ״בקרוב״ ו״אחר כך״",
        "המאמן, עם אישור, עריכה וביטול",
        "הרגלים, שגרות ותבניות",
      ],
      cta: "הצטרפות לבטא ←",
    },
    now: {
      badge: "כלול עכשיו",
      label: "טוב לדעת",
      price: "חינם",
      suffix: "· בזמן הבטא",
      body: "אין שלב תשלום בבטא. הדפים והמשימות נשמרים בחשבון שלך, אז הם מחכים בכל מכשיר שמתחברים ממנו.",
      includes: [
        "כניסה עם קישור שנשלח במייל, בלי סיסמה",
        "ייצוא של כל דף כקובץ Markdown",
        "עברית, מימין לשמאל (חלק מהמסכים עדיין באנגלית)",
        "אין מה להתקין: זה עובד בדפדפן",
      ],
      cta: "הצטרפות לבטא ←",
    },
  },
  letter: {
    eyebrow: "מכתב מעמית",
    title: "למה Tempo קיים.",
    paragraphs: [
      "Tempo התחיל ככלי שהייתי צריך בשביל המוח שלי. רוב אפליקציות התכנון בנויות לאנשים שכבר מתחילים, עוברים בין דברים וזוכרים לבד. כשזה בדיוק החלק הקשה, רשימה ארוכה היא עוד דבר להרגיש רע בגללו.",
      "אז Tempo שומר את היום שלך בדף אחד רגוע, עושה איתך סדר בבלגן, ונותן מאמן שמציע שינוי אחד בכל פעם. הוא לא משנה כלום עד שמאשרים, ואפשר לבטל.",
      "זה מאמן, לא מטפל. וזו בטא קטנה: אני מאשר כל חשבון ידנית, כדי להקשיב ולתקן מהר.",
      "אם זה עובד בשבילך, זה מספיק. הבטא חינמית כל עוד היא פתוחה. ואם זה לא מתאים, אפשר פשוט להשאיר את זה.",
    ],
    signature: "— עמית",
  },
  closing: {
    title: "חינם בזמן הבטא. כל מה שצריך זה מייל.",
    body: "בלי כרטיס אשראי. בלי סיסמה: נכנסים עם קישור שנשלח במייל. עמית מאשר כל חשבון ידנית.",
    cta: "הצטרפות לבטא",
  },
  footer: {
    tagline: "כלי תכנון ומאמן למבוגרים עם ADHD, אוטיזם או לקויות למידה. מאמן, לא מטפל.",
    product: "המוצר",
    features: "מה בפנים",
    coach: "המאמן",
    pricing: "מחירים",
    signUp: "הרשמה",
    legal: "משפטי",
    privacy: "פרטיות",
    terms: "תנאים",
    contact: "יצירת קשר",
    license: "© 2026 Tempo Flow · רישיון BUSL-1.1",
    status: "בטא",
  },
};

const LANDING_COPY: Record<Lang, LandingCopy> = { en, he };

export function getLandingCopy(lang: Lang): LandingCopy {
  return LANDING_COPY[lang];
}
