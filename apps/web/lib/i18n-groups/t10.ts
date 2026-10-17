/**
 * Kitchen T10 stretch copy: Settings > Reminders (S14), the ShareSheet (S26) and the MiniAppFrame
 * (S24). English and Hebrew (neutral plural); i18n.ts merges both. None of these screens is in
 * the v3 design, so every string is drafted here [EXTRAPOLATED].
 */
export const en = {
  // S14 Settings > Reminders
  "rem.nav": "Reminders",
  "rem.navSub": "Where your nags can reach you outside Tempo.",
  "rem.title": "Reminders",
  "rem.sub": "Where your nags can reach you outside Tempo.",
  "rem.offline": "You're offline. This list comes back when you are.",
  "rem.loading": "Loading reminder channels",
  "rem.errorTitle": "Couldn't load reminder channels.",
  "rem.errorBody": "Your nags are safe and still show in Tempo. Try again?",
  "rem.nTitle": "Reminders stay in Tempo for now",
  "rem.nBody":
    "No messaging channel is connected yet, so your nags show here in the app. Once a channel is chosen, you'll pick it on this page, and nothing goes out until you turn it on.",
  "rem.channels": "Messaging channels",
  "rem.channelsDesc": "A reminder sent this way uses only words you wrote or accepted. No stock messages, no emoji.",
  "rem.notConnected": "Not connected yet",
  "rem.ch.whatsapp": "Your nags as WhatsApp messages.",
  "rem.ch.telegram": "Your nags as Telegram messages.",
  "rem.ch.sms": "Your nags as text messages to your phone.",
  "rem.ch.other": "Your nags as messages outside Tempo.",
  "rem.empty": "No channels are listed yet. Your reminders stay in the app.",
  "rem.nagsLabel": "The words your nags use",
  "rem.nagsHelp": "Each reminder only ever says a phrase you wrote or accepted.",
  "rem.nagsBtn": "Open nags",

  // S26 ShareSheet
  "share.menu": "Share…",
  "share.titlePage": "Share this page",
  "share.titleSet": "Share this study set",
  "share.close": "Close",
  "share.private": "Nothing is uploaded or published. Files are made on this device.",
  "share.system": "Share with an app…",
  "share.systemHelp": "Opens your device's own share options.",
  "share.copy": "Copy link",
  "share.copyHelp": "The link opens this for you when you're signed in. It doesn't make it public.",
  "share.copied": "Link copied.",
  "share.copyBlocked": "This browser didn't allow copying. You can copy the address from the address bar.",
  "share.md": "Download Markdown",
  "share.mdHelp": "A .md file you can open in any notes app.",
  "share.mdDone": "Markdown file saved to your downloads.",
  "share.anki": "Download for Anki",
  "share.ankiHelp": "Your cards as a tab-separated text file. In Anki, choose Import File.",
  "share.ankiDone": "Anki file saved to your downloads.",
  "share.systemBlocked": "The share options didn't open. Copy link works too.",

  // S24 MiniAppFrame
  "mini.kind": "Widget",
  "mini.what":
    "A small widget saved in this page. It runs walled off from Tempo: it can't see your account, your other pages, your keys or the internet.",
  "mini.ask": "Run it only if you know where it came from.",
  "mini.run": "Run this widget",
  "mini.tooBig": "This widget is larger than 64 KB, so Tempo won't run it. The page itself is fine.",
  "mini.running": "Running in a sealed frame",
  "mini.done": "The widget says it's finished.",
  "mini.stopped": "This widget tried to open another page, so Tempo stopped it. Nothing else on this page changed.",
  "mini.runAgain": "Run it again",
} as const;

export type T10CopyKey = keyof typeof en;

export const he: Record<T10CopyKey, string> = {
  "rem.nav": "תזכורות",
  "rem.navSub": "איפה הנדנודים יכולים להגיע אליכם מחוץ ל־Tempo.",
  "rem.title": "תזכורות",
  "rem.sub": "איפה הנדנודים יכולים להגיע אליכם מחוץ ל־Tempo.",
  "rem.offline": "אין חיבור כרגע. הרשימה תחזור כשהחיבור יחזור.",
  "rem.loading": "טוענים ערוצי תזכורות",
  "rem.errorTitle": "לא הצלחנו לטעון את ערוצי התזכורות.",
  "rem.errorBody": "הנדנודים שלכם שמורים ועדיין מופיעים ב־Tempo. לנסות שוב?",
  "rem.nTitle": "בינתיים התזכורות נשארות ב־Tempo",
  "rem.nBody":
    "עדיין לא מחובר ערוץ הודעות, אז הנדנודים מופיעים כאן באפליקציה. כשייבחר ערוץ, תוכלו לבחור אותו בעמוד הזה, ושום דבר לא יישלח עד שתפעילו אותו.",
  "rem.channels": "ערוצי הודעות",
  "rem.channelsDesc": "תזכורת שנשלחת כך משתמשת רק במילים שכתבתם או אישרתם. בלי הודעות מוכנות, בלי אימוג'י.",
  "rem.notConnected": "עדיין לא מחובר",
  "rem.ch.whatsapp": "הנדנודים שלכם כהודעות WhatsApp.",
  "rem.ch.telegram": "הנדנודים שלכם כהודעות Telegram.",
  "rem.ch.sms": "הנדנודים שלכם כהודעות טקסט לטלפון.",
  "rem.ch.other": "הנדנודים שלכם כהודעות מחוץ ל־Tempo.",
  "rem.empty": "עדיין אין ערוצים ברשימה. התזכורות נשארות באפליקציה.",
  "rem.nagsLabel": "המילים של הנדנודים",
  "rem.nagsHelp": "כל תזכורת אומרת רק משפט שכתבתם או אישרתם.",
  "rem.nagsBtn": "לנדנודים",

  "share.menu": "שיתוף…",
  "share.titlePage": "שיתוף העמוד",
  "share.titleSet": "שיתוף ערכת הלימוד",
  "share.close": "סגירה",
  "share.private": "שום דבר לא מועלה או מתפרסם. הקבצים נוצרים במכשיר הזה.",
  "share.system": "שיתוף עם אפליקציה…",
  "share.systemHelp": "פותח את אפשרויות השיתוף של המכשיר.",
  "share.copy": "העתקת קישור",
  "share.copyHelp": "הקישור פותח את זה בשבילכם כשאתם מחוברים. הוא לא הופך את זה לציבורי.",
  "share.copied": "הקישור הועתק.",
  "share.copyBlocked": "הדפדפן לא אפשר העתקה. אפשר להעתיק את הכתובת משורת הכתובת.",
  "share.md": "הורדה כ־Markdown",
  "share.mdHelp": "קובץ ‎.md שאפשר לפתוח בכל אפליקציית פתקים.",
  "share.mdDone": "קובץ ה־Markdown נשמר בהורדות.",
  "share.anki": "הורדה ל־Anki",
  "share.ankiHelp": "הכרטיסים כקובץ טקסט מופרד בטאבים. ב־Anki בוחרים Import File.",
  "share.ankiDone": "הקובץ ל־Anki נשמר בהורדות.",
  "share.systemBlocked": "אפשרויות השיתוף לא נפתחו. אפשר גם להעתיק קישור.",

  "mini.kind": "וידג'ט",
  "mini.what":
    "וידג'ט קטן ששמור בעמוד הזה. הוא רץ מבודד מ־Tempo: הוא לא רואה את החשבון, את שאר העמודים, את המפתחות או את האינטרנט.",
  "mini.ask": "כדאי להפעיל אותו רק אם אתם יודעים מאיפה הוא הגיע.",
  "mini.run": "הפעלת הווידג'ט",
  "mini.tooBig": "הווידג'ט גדול מ־64 KB, אז Tempo לא יפעיל אותו. העמוד עצמו בסדר.",
  "mini.running": "רץ במסגרת סגורה",
  "mini.done": "הווידג'ט סיים.",
  "mini.stopped": "הווידג'ט ניסה לפתוח עמוד אחר, אז Tempo עצר אותו. שום דבר אחר בעמוד לא השתנה.",
  "mini.runAgain": "להפעיל שוב",
};
