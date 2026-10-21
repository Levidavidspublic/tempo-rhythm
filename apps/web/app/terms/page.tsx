import type { Metadata } from "next";
import { type LegalDoc, LegalDraft } from "../privacy/LegalDraft";

/**
 * /terms: a plain first draft of the beta's terms, in English and Hebrew, marked "draft, to be
 * reviewed". The coach and crisis lines match convex/coach.ts and convex/lib/crisisWords.ts (the
 * help card's three resources are repeated here); the price line matches the landing page's beta
 * pricing. The limits section is marked for legal review. Amit reviews before release.
 */

export const metadata: Metadata = {
  title: "Terms (draft) — Tempo Flow",
  description:
    "A plain first draft of the rules for using Tempo Flow during the beta. To be reviewed.",
};

const EMAIL = "amit@tempoflow.app";

const en: LegalDoc = {
  title: "Terms of use",
  updated: "Draft of 16 October 2026",
  lede: "The rules for using Tempo Flow during the beta, in plain words.",
  sections: [
    {
      id: "who",
      heading: "Who you're dealing with",
      blocks: [`Tempo Flow is built and run by one person, Amit. Contact: ${EMAIL}.`],
    },
    {
      id: "beta",
      heading: "Tempo is in beta",
      blocks: [
        [
          "Amit approves each new account by hand. Until yours is approved, you see a waiting screen.",
          "Features may change, move or go away, and things may break. Keep your own copy of anything important.",
          "Amit can pause or close an account, for example when these rules are broken.",
        ],
      ],
    },
    {
      id: "coach",
      heading: "The coach suggests, you decide",
      blocks: [
        [
          "The coach only suggests. Nothing changes in your tasks, pages or templates until you press Accept.",
          "After you accept, Undo stays available for 5 minutes.",
          "The coach is an AI and can be wrong. Check a suggestion before you rely on it.",
          "If you give a personal key to another app, that app acts for you and can change your tasks, pages and calendar directly.",
        ],
      ],
    },
    {
      id: "care",
      heading: "Not therapy, not an emergency service",
      blocks: [
        "Tempo is a coach, not a therapist or counselor. It doesn't diagnose or treat any condition, and it is not an emergency service.",
        "When a message to the coach or a brain dump contains certain crisis words, Tempo doesn't answer with AI. It shows a help card with the same resources as here:",
        [
          "Emergency services: call your local emergency number if you are in immediate danger.",
          "A crisis line near you: search for a suicide or crisis helpline in your country and call or text them.",
          "Someone you trust: tell a friend, family member or doctor how you feel. You don't have to wait for a good moment.",
        ],
        "Tempo doesn't show a helpline number for your country yet, and for now the word check knows English words only. Don't wait for Tempo: if you are in danger, call your local emergency number now.",
      ],
    },
    {
      id: "use",
      heading: "Using Tempo fairly",
      blocks: [
        [
          "Use Tempo for your own planning and notes.",
          "Don't use it to break the law or to hurt anyone.",
          "Don't try to get into other people's accounts, break the service, overload it or get around its limits.",
          "Keep your sign-in email and your personal keys to yourself.",
        ],
      ],
    },
    {
      id: "content",
      heading: "Your words stay yours",
      blocks: [
        "What you write in Tempo is yours. You let Tempo store it and send it to the services named on the privacy page, only to run the app for you.",
      ],
    },
    {
      id: "account",
      heading: "Your account",
      blocks: [
        [
          "You sign in with a link sent to your email. Anyone who can read that email can sign in as you, so keep it safe.",
          "You can delete your account at any time in Settings → Privacy. The privacy page says what happens then.",
        ],
      ],
    },
    {
      id: "price",
      heading: "Price",
      blocks: [
        "Tempo is free during the beta. Signing up asks for no card and charges nothing. If paid plans come later, these terms will change first.",
      ],
    },
    {
      id: "limits",
      heading: "Limits (to be reviewed)",
      blocks: [
        "This part needs legal review most of all.",
        [
          "Tempo is offered as it is, during a beta. There's no promise that it will always work, be available or never lose data.",
          "As far as the law allows, Amit isn't responsible for losses that come from using Tempo or from relying on what the coach suggests.",
        ],
      ],
    },
    {
      id: "changes",
      heading: "Changes",
      blocks: [
        "These terms will change during the beta. The date at the top shows the latest version.",
      ],
    },
    {
      id: "contact",
      heading: "Contact",
      blocks: [`Questions about these terms: ${EMAIL}.`],
    },
  ],
};

const he: LegalDoc = {
  title: "תנאי שימוש",
  updated: "טיוטה מ־16 באוקטובר 2026",
  lede: "הכללים לשימוש ב־Tempo Flow בזמן הבטא, במילים פשוטות.",
  sections: [
    {
      id: "who",
      heading: "מי עומד מאחורי Tempo",
      blocks: [`את Tempo Flow בונה ומפעיל אדם אחד, עמית. ליצירת קשר: ${EMAIL}.`],
    },
    {
      id: "beta",
      heading: "Tempo בבטא",
      blocks: [
        [
          "עמית מאשר כל חשבון חדש ידנית. עד שהחשבון מאושר מופיע מסך המתנה.",
          "תכונות יכולות להשתנות, לזוז או להיעלם, ודברים יכולים להישבר. כדאי לשמור עותק משלכם של כל דבר חשוב.",
          "עמית יכול להשהות או לסגור חשבון, למשל כשהכללים האלה לא נשמרים.",
        ],
      ],
    },
    {
      id: "coach",
      heading: "המאמן מציע, אתם מחליטים",
      blocks: [
        [
          "המאמן רק מציע. שום דבר לא משתנה במשימות, בדפים או בתבניות עד שלוחצים על אישור.",
          "אחרי האישור אפשר לבטל במשך 5 דקות.",
          "המאמן הוא AI והוא יכול לטעות. כדאי לבדוק הצעה לפני שסומכים עליה.",
          "אם נותנים מפתח אישי לאפליקציה אחרת, היא פועלת בשמכם ויכולה לשנות ישירות את המשימות, הדפים והיומן.",
        ],
      ],
    },
    {
      id: "care",
      heading: "לא טיפול ולא שירות חירום",
      blocks: [
        "Tempo הוא מאמן, לא מטפל ולא יועץ. הוא לא מאבחן ולא מטפל באף מצב, והוא לא שירות חירום.",
        "כשהודעה למאמן או פריקת מחשבות כוללות מילים מסוימות של משבר, Tempo לא עונה בעזרת AI. הוא מציג כרטיס עזרה עם אותם מקורות שמופיעים כאן:",
        [
          "שירותי חירום: אם יש סכנה מיידית, התקשרו למספר החירום המקומי.",
          "קו סיוע קרוב: חפשו קו סיוע למשבר או למניעת אובדנות במדינה שלכם, והתקשרו או שלחו הודעה.",
          "מישהו שסומכים עליו: ספרו לחבר, לבן משפחה או לרופא איך אתם מרגישים. לא צריך לחכות לרגע טוב.",
        ],
        "Tempo עוד לא מציג מספר של קו סיוע לפי מדינה, ובדיקת המילים מכירה כרגע רק מילים באנגלית. אל תחכו ל־Tempo: אם יש סכנה, התקשרו עכשיו למספר החירום המקומי.",
      ],
    },
    {
      id: "use",
      heading: "שימוש הוגן",
      blocks: [
        [
          "השתמשו ב־Tempo לתכנון ולפתקים שלכם.",
          "אל תשתמשו בו כדי לעבור על החוק או כדי לפגוע במישהו.",
          "אל תנסו להיכנס לחשבונות של אחרים, לשבור את השירות, להעמיס עליו או לעקוף את המגבלות שלו.",
          "שמרו לעצמכם את מייל הכניסה ואת המפתחות האישיים.",
        ],
      ],
    },
    {
      id: "content",
      heading: "המילים שלכם נשארות שלכם",
      blocks: [
        "מה שכותבים ב־Tempo שייך לכם. אתם מרשים ל־Tempo לשמור אותו ולשלוח אותו לשירותים שמופיעים בדף הפרטיות, רק כדי להפעיל את האפליקציה בשבילכם.",
      ],
    },
    {
      id: "account",
      heading: "החשבון שלכם",
      blocks: [
        [
          "נכנסים עם קישור שנשלח למייל. כל מי שיכול לקרוא את המייל הזה יכול להיכנס בשמכם, אז שמרו עליו.",
          "אפשר למחוק את החשבון בכל זמן בהגדרות ← פרטיות. דף הפרטיות מסביר מה קורה אז.",
        ],
      ],
    },
    {
      id: "price",
      heading: "מחיר",
      blocks: [
        "Tempo חינמי בזמן הבטא. ההרשמה לא מבקשת כרטיס אשראי ולא גובה כסף. אם יהיו מסלולים בתשלום בהמשך, התנאים האלה ישתנו קודם.",
      ],
    },
    {
      id: "limits",
      heading: "גבולות האחריות (לבדיקה)",
      blocks: [
        "החלק הזה צריך בדיקה משפטית יותר מכל השאר.",
        [
          "Tempo ניתן כמו שהוא, בזמן בטא. אין הבטחה שהוא תמיד יעבוד, יהיה זמין או לא יאבד מידע.",
          "ככל שהחוק מאפשר, עמית לא אחראי להפסדים שנובעים משימוש ב־Tempo או מהסתמכות על ההצעות של המאמן.",
        ],
      ],
    },
    {
      id: "changes",
      heading: "שינויים",
      blocks: ["התנאים האלה ישתנו במהלך הבטא. התאריך למעלה מראה את הגרסה האחרונה."],
    },
    {
      id: "contact",
      heading: "יצירת קשר",
      blocks: [`שאלות על התנאים: ${EMAIL}.`],
    },
  ],
};

export default function TermsPage() {
  return <LegalDraft kind="terms" docs={{ en, he }} />;
}
