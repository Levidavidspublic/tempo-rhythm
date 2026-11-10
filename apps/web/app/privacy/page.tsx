import type { Metadata } from "next";
import { type LegalDoc, LegalDraft } from "./LegalDraft";

/**
 * /privacy: a plain first draft of what Tempo stores and which services it calls, in English and
 * Hebrew, marked "draft, to be reviewed". Every claim matches the code on the day it was written
 * (convex/schema.ts, convex/lib/accountDeletion.ts, convex/lib/ai_router.ts, convex/voice.ts,
 * convex/auth.ts, convex/mcp.ts). What the code can't show (provider terms and server locations,
 * a minimum age, final erasure) is left for review and says so. Amit reviews before release.
 */

export const metadata: Metadata = {
  title: "Privacy (draft) — Tempo Flow",
  description:
    "A plain first draft of what Tempo Flow stores, why, and which services handle it. To be reviewed.",
};

const EMAIL = "amit@tempoflow.app";

const en: LegalDoc = {
  title: "Privacy",
  updated: "Draft of 16 October 2026",
  lede: "What Tempo Flow keeps about you, why, and who else handles it. This page describes the app as it is built today.",
  sections: [
    {
      id: "who",
      heading: "Who runs Tempo",
      blocks: [
        `Tempo Flow is built and run by one person, Amit. For anything on this page, write to ${EMAIL}.`,
      ],
    },
    {
      id: "stores",
      heading: "What Tempo stores",
      blocks: [
        "Tempo keeps what it needs to run the app for you:",
        [
          "Your account: your email address, the name you give, when you joined, and whether your account is approved.",
          "What you make: pages and notes, tasks and their steps, habits and check-ins, goals, day plans and time blocks, focus sessions, calendar events, templates, and reminders with their words.",
          "Your chats with the coach: what you write, what the coach answers, and the suggestions you accepted or turned down.",
          "What Tempo remembers about you: short notes you added or imported yourself.",
          "Your settings: theme, language, the day your week starts, your time zone, the coach's style and similar choices.",
          "Voice: how long each voice session lasted. Never the audio. What you say becomes text and is saved in the chat, like a typed message.",
          "Connection keys: if you make a personal key for another app, Tempo keeps only a fingerprint (hash) of it, never the key itself.",
          "Signing in: your sign-in sessions (you stay signed in for up to 30 days) and one-time sign-in links.",
        ],
      ],
    },
    {
      id: "never",
      heading: "What Tempo does not do",
      blocks: [
        [
          "No usage tracking. Tempo does not record which screens or buttons you use. The setting for it stays off and locked.",
          "No ads, and we don't sell your data.",
          "A brain dump isn't kept as you wrote it. The text goes to the AI model to be sorted, and Tempo saves only what you choose to keep, as a page or as tasks.",
          "If a message to the coach or a brain dump contains certain crisis words, Tempo doesn't send it to the AI model. It shows a help card instead.",
        ],
      ],
    },
    {
      id: "services",
      heading: "Who else handles your data",
      blocks: [
        "Tempo uses these services to run:",
        [
          "Convex stores everything listed above and runs Tempo's server code.",
          "Vercel hosts the website. Like any web host, it receives your requests, including your IP address.",
          "Resend sends the sign-in email. It receives your email address and the sign-in link.",
          "DeepInfra runs the AI model. For a coach reply it receives your message, the recent messages in that chat, today's open tasks and the page you have open beside the coach. It also receives a brain dump's text when you sort one, and a reminder's words when you ask for suggestions.",
          "Voice, only when it is switched on: your microphone audio goes straight from your browser to Deepgram, which turns it into text, and DeepInfra reads the coach's replies aloud.",
          "An app you connect yourself: if you give a personal key (Settings → Integrations) to another AI app, that app can read and change your tasks, pages and calendar in Tempo. You can revoke the key at any time.",
        ],
        "Each service has its own terms about what it keeps and for how long, and its own server locations. We will add links and locations here after review.",
      ],
    },
    {
      id: "approval",
      heading: "Who sees your account",
      blocks: [
        "Amit approves each new account by hand. To do that, he sees your email address, your name and when you signed up. Until your account is approved, you see a waiting screen and the AI features stay off.",
      ],
    },
    {
      id: "control",
      heading: "Undo, download and delete",
      blocks: [
        [
          "Deleting a task or a page shows Undo for 5 minutes, and so does a coach change you accepted. Deleted tasks and pages are hidden and kept, so they can come back. Deleting a goal or a habit erases it at once.",
          "Settings → Memory shows everything Tempo remembers. You can forget any of it, or download it all as a Markdown file.",
          `A download of all your data isn't built yet. Until it is, write to ${EMAIL} to ask for a copy.`,
          "To delete your account, go to Settings → Privacy → Delete my account. Your pages, tasks, habits, chats, memories and settings leave the app at once, and the coach can no longer read them. If you sign in again within 30 days, the account opens again, empty.",
          "Today, deleting your account hides your data and marks it deleted. It is not yet erased from the database: the job that erases it for good isn't built yet. We will update this section when it is.",
        ],
      ],
    },
    {
      id: "device",
      heading: "Cookies and your device",
      blocks: [
        [
          "Tempo sets sign-in cookies to keep you signed in. It uses no advertising or tracking cookies.",
          "Your browser keeps a few settings for this device in its local storage, such as theme, language, text size and the reading font. They stay on the device.",
          "The fonts come with the website itself, so loading a page doesn't contact a font service.",
        ],
      ],
    },
    {
      id: "children",
      heading: "Children",
      blocks: [
        "Tempo is made for adults. A minimum age isn't set yet. We will add it here after review.",
      ],
    },
    {
      id: "changes",
      heading: "Changes to this page",
      blocks: [
        "This page will change as Tempo changes. The date at the top shows the latest version.",
      ],
    },
    {
      id: "contact",
      heading: "Contact",
      blocks: [`Questions, a request for your data, or something here that looks wrong: ${EMAIL}.`],
    },
  ],
};

const he: LegalDoc = {
  title: "פרטיות",
  updated: "טיוטה מ־16 באוקטובר 2026",
  lede: "מה Tempo Flow שומר עליכם, למה, ומי עוד מטפל במידע. הדף מתאר את האפליקציה כפי שהיא בנויה היום.",
  sections: [
    {
      id: "who",
      heading: "מי מפעיל את Tempo",
      blocks: [
        `את Tempo Flow בונה ומפעיל אדם אחד, עמית. לכל דבר בדף הזה אפשר לכתוב לו בכתובת ${EMAIL}.`,
      ],
    },
    {
      id: "stores",
      heading: "מה Tempo שומר",
      blocks: [
        "Tempo שומר את מה שצריך כדי להפעיל את האפליקציה בשבילכם:",
        [
          "החשבון: כתובת המייל, השם שנתתם, מתי הצטרפתם, והאם החשבון אושר.",
          "מה שאתם יוצרים: דפים ופתקים, משימות והשלבים שלהן, הרגלים וסימונים, יעדים, תוכניות יום ובלוקים של זמן, זמני ריכוז, אירועים ביומן, תבניות, ותזכורות עם המילים שלהן.",
          "השיחות עם המאמן: מה שכתבתם, מה שהמאמן ענה, וההצעות שאישרתם או דחיתם.",
          "מה ש־Tempo זוכר עליכם: פתקים קצרים שהוספתם או ייבאתם בעצמכם.",
          "ההגדרות: ערכת צבעים, שפה, היום שבו השבוע מתחיל, אזור הזמן, סגנון המאמן ובחירות דומות.",
          "קול: כמה זמן נמשכה כל שיחה קולית. אף פעם לא ההקלטה. מה שאומרים הופך לטקסט ונשמר בשיחה, כמו הודעה מוקלדת.",
          "מפתחות חיבור: אם יוצרים מפתח אישי לאפליקציה אחרת, Tempo שומר רק טביעת אצבע שלו (hash), אף פעם לא את המפתח עצמו.",
          "כניסה: החיבורים הפעילים שלכם (נשארים מחוברים עד 30 יום) וקישורי כניסה חד־פעמיים.",
        ],
      ],
    },
    {
      id: "never",
      heading: "מה Tempo לא עושה",
      blocks: [
        [
          "אין מעקב שימוש. Tempo לא רושם באילו מסכים או כפתורים אתם משתמשים. ההגדרה הזו כבויה ונעולה.",
          "אין פרסומות, ואנחנו לא מוכרים את המידע שלכם.",
          "פריקת מחשבות לא נשמרת כפי שנכתבה. הטקסט נשלח למודל ה־AI כדי למיין אותו, ו־Tempo שומר רק את מה שבוחרים לשמור, כדף או כמשימות.",
          "אם הודעה למאמן או פריקת מחשבות כוללות מילים מסוימות של משבר, Tempo לא שולח אותן למודל ה־AI. במקום זה הוא מציג כרטיס עזרה.",
        ],
      ],
    },
    {
      id: "services",
      heading: "מי עוד מטפל במידע",
      blocks: [
        "Tempo משתמש בשירותים האלה כדי לפעול:",
        [
          "Convex שומר את כל מה שמופיע למעלה ומריץ את קוד השרת של Tempo.",
          "Vercel מארח את האתר. כמו כל אירוח אתרים, הוא מקבל את הבקשות שלכם, כולל כתובת ה־IP.",
          "Resend שולח את מייל הכניסה. הוא מקבל את כתובת המייל ואת קישור הכניסה.",
          "DeepInfra מריץ את מודל ה־AI. כדי שהמאמן יענה, הוא מקבל את ההודעה שלכם, את ההודעות האחרונות באותה שיחה, את המשימות הפתוחות של היום ואת הדף שפתוח ליד המאמן. הוא מקבל גם את הטקסט של פריקת מחשבות כשממיינים אותה, ואת המילים של תזכורת כשמבקשים הצעות.",
          "קול, רק כשהוא מופעל: השמע מהמיקרופון עובר ישר מהדפדפן ל־Deepgram, שהופך אותו לטקסט, ו־DeepInfra מקריא בקול את התשובות של המאמן.",
          "אפליקציה שאתם מחברים בעצמכם: אם נותנים מפתח אישי (הגדרות ← חיבורים) לאפליקציית AI אחרת, היא יכולה לקרוא ולשנות את המשימות, הדפים והיומן שלכם ב־Tempo. אפשר לבטל את המפתח בכל זמן.",
        ],
        "לכל שירות יש תנאים משלו לגבי מה שהוא שומר ולכמה זמן, ומיקומי שרתים משלו. נוסיף כאן קישורים ומיקומים אחרי הבדיקה.",
      ],
    },
    {
      id: "approval",
      heading: "מי רואה את החשבון",
      blocks: [
        "עמית מאשר כל חשבון חדש ידנית. בשביל זה הוא רואה את כתובת המייל, את השם ואת תאריך ההרשמה. עד שהחשבון מאושר מופיע מסך המתנה, ותכונות ה־AI כבויות.",
      ],
    },
    {
      id: "control",
      heading: "ביטול, הורדה ומחיקה",
      blocks: [
        [
          "מחיקה של משימה או של דף מציגה אפשרות ביטול למשך 5 דקות, וכך גם שינוי של המאמן שאישרתם. משימות ודפים שנמחקו מוסתרים ונשמרים, כדי שאפשר יהיה להחזיר אותם. מחיקה של יעד או של הרגל מוחקת אותו מיד.",
          "בהגדרות ← זיכרון רואים את כל מה ש־Tempo זוכר. אפשר לשכוח כל פריט, או להוריד הכול כקובץ Markdown.",
          `הורדה של כל המידע שלכם עוד לא בנויה. עד שתהיה, אפשר לבקש עותק בכתובת ${EMAIL}.`,
          "כדי למחוק את החשבון: הגדרות ← פרטיות ← למחוק את החשבון שלי. הדפים, המשימות, ההרגלים, השיחות, הזיכרונות וההגדרות יוצאים מהאפליקציה מיד, והמאמן כבר לא יכול לקרוא אותם. כניסה מחדש תוך 30 יום פותחת שוב את החשבון, ריק.",
          "כרגע, מחיקת החשבון מסתירה את המידע ומסמנת אותו כמחוק. הוא עוד לא נמחק ממסד הנתונים: התהליך שמוחק אותו לתמיד עוד לא בנוי. נעדכן את הסעיף הזה כשיהיה.",
        ],
      ],
    },
    {
      id: "device",
      heading: "עוגיות והמכשיר שלכם",
      blocks: [
        [
          "Tempo משתמש בעוגיות כניסה כדי שתישארו מחוברים. אין עוגיות של פרסום או של מעקב.",
          "הדפדפן שומר כמה הגדרות של המכשיר הזה באחסון המקומי שלו, כמו ערכת צבעים, שפה, גודל טקסט והגופן לקריאה. הן נשארות במכשיר.",
          "הגופנים מגיעים עם האתר עצמו, כך שטעינת דף לא פונה לשירות גופנים.",
        ],
      ],
    },
    {
      id: "children",
      heading: "ילדים",
      blocks: ["Tempo נבנה למבוגרים. עוד לא נקבע גיל מינימום. נוסיף אותו כאן אחרי הבדיקה."],
    },
    {
      id: "changes",
      heading: "שינויים בדף",
      blocks: ["הדף הזה ישתנה כש־Tempo ישתנה. התאריך למעלה מראה את הגרסה האחרונה."],
    },
    {
      id: "contact",
      heading: "יצירת קשר",
      blocks: [`שאלות, בקשה לקבל את המידע שלכם, או משהו כאן שנראה לא נכון: ${EMAIL}.`],
    },
  ],
};

export default function PrivacyPage() {
  return <LegalDraft kind="privacy" docs={{ en, he }} />;
}
