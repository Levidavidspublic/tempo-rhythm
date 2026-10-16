/**
 * IngestSheet (T8-T10 spec, S2): bring a file, pasted text or a photo of text into a new page.
 * English and Hebrew. Prefix: ig. The sheet reads this group through
 * components/ingest/copy.ts, so i18n.ts needs no change; it can be spread into i18n.ts later.
 * Hebrew is machine-drafted, in the neutral plural, and needs native review (OVERNIGHT-RUN.md).
 * `{n}` and `{name}` are filled in by the sheet.
 */
export const en = {
  "ig.open": "Bring in text",
  "ig.title": "Bring in text",
  "ig.lede":
    "Make a page from a file, pasted text or a photo of a page. It stays on this device until you save.",
  "ig.close": "Close",
  "ig.source": "Where the text comes from",
  "ig.tab.file": "File",
  "ig.tab.paste": "Paste",
  "ig.tab.photo": "Photo",

  "ig.file.label": "Choose a file",
  "ig.file.help":
    "Text, Markdown, CSV or a web page (.txt, .md, .csv, .html). Up to 200 KB of text.",
  "ig.file.reading": "Reading the file…",
  "ig.file.read": "Read {name}. Check the text below before you save.",
  "ig.file.type":
    "This file type can't be read here yet. Try a .txt, .md, .csv or .html file, or paste the text.",
  "ig.file.empty": "This file looks empty. Pick another file or paste the text.",
  "ig.file.tooLarge":
    "This file has more than 200 KB of text. Split it into smaller files, or paste a part of it.",
  "ig.file.unreadable":
    "This file couldn't be opened. Try saving it again as plain text, or paste the text.",

  "ig.paste.label": "Text",
  "ig.paste.help": "Paste notes, an article or a list. Formatting stays as plain text.",
  "ig.count": "{n} characters",
  "ig.count.one": "1 character",
  "ig.tooLarge":
    "That's more than 200 KB of text. Save a shorter part, then bring in the rest as another page.",

  "ig.photo.label": "Take or choose a photo",
  "ig.photo.help": "The photo is read on this device and is never uploaded or saved.",
  "ig.photo.reading": "Reading the photo…",
  "ig.photo.read":
    "Here is the text from the photo. Fix anything that came out wrong before you save.",
  "ig.photo.none":
    "No text was found in this photo. Try a sharper, brighter photo, or paste the text.",
  "ig.photo.error": "This photo couldn't be read. Try another photo, or paste the text.",
  "ig.photo.unsupported":
    "Reading photos isn't available in this browser yet. You can type or paste the text instead.",
  "ig.photo.usePaste": "Paste text instead",

  "ig.text.label": "Text for the page",
  "ig.text.help": "This becomes the page. You can edit it here first.",
  "ig.pageTitle": "Page title",
  "ig.pageTitle.help": "Taken from the file name or the first line. Change it if you like.",
  "ig.untitled": "Imported page",
  "ig.needText": "Add some text first, from a file, a paste or a photo.",

  "ig.save": "Save as a page",
  "ig.saving": "Saving…",
  "ig.offline": "You're offline. Your text stays here, and saving waits until you're back.",
  "ig.waiting": "Saves when you're back online",
  "ig.saveError": "That didn't save. Your text is still here.",
  "ig.retry": "Try again",

  "ig.done.title": "Saved as a page",
  "ig.done.body": "Your page is ready. You can open it, or turn it into something to study.",
  "ig.done.open": "Open the page",
  "ig.done.study": "Study it",
  "ig.done.flashcards": "Turn into flashcards",
  "ig.done.quiz": "Turn into a quiz",
  "ig.done.test": "Turn into a practice test",
  "ig.done.close": "Done",
} as const;

export const he: Record<keyof typeof en, string> = {
  "ig.open": "הוספת טקסט",
  "ig.title": "הוספת טקסט",
  "ig.lede": "אפשר ליצור דף מקובץ, מטקסט מודבק או מתמונה של דף. הטקסט נשאר במכשיר הזה עד שתשמרו.",
  "ig.close": "סגירה",
  "ig.source": "מאיפה הטקסט",
  "ig.tab.file": "קובץ",
  "ig.tab.paste": "הדבקה",
  "ig.tab.photo": "תמונה",

  "ig.file.label": "בחרו קובץ",
  "ig.file.help": "טקסט, Markdown, CSV או דף אינטרנט (.txt, .md, .csv, .html). עד 200 KB של טקסט.",
  "ig.file.reading": "קוראים את הקובץ…",
  "ig.file.read": "הקובץ {name} נקרא. בדקו את הטקסט למטה לפני השמירה.",
  "ig.file.type":
    "עוד אי אפשר לקרוא כאן סוג קובץ כזה. נסו קובץ .txt, .md, .csv או .html, או הדביקו את הטקסט.",
  "ig.file.empty": "נראה שהקובץ ריק. בחרו קובץ אחר או הדביקו את הטקסט.",
  "ig.file.tooLarge":
    "בקובץ הזה יש יותר מ־200 KB של טקסט. חלקו אותו לקבצים קטנים יותר, או הדביקו חלק ממנו.",
  "ig.file.unreadable":
    "לא הצלחנו לפתוח את הקובץ. נסו לשמור אותו שוב כטקסט פשוט, או הדביקו את הטקסט.",

  "ig.paste.label": "טקסט",
  "ig.paste.help": "הדביקו הערות, מאמר או רשימה. העיצוב נשמר כטקסט פשוט.",
  "ig.count": "{n} תווים",
  "ig.count.one": "תו אחד",
  "ig.tooLarge": "יש כאן יותר מ־200 KB של טקסט. שמרו חלק קצר יותר, ואת השאר הוסיפו כדף נוסף.",

  "ig.photo.label": "צלמו או בחרו תמונה",
  "ig.photo.help": "התמונה נקראת במכשיר הזה, ולא מועלית או נשמרת לעולם.",
  "ig.photo.reading": "קוראים את התמונה…",
  "ig.photo.read": "זה הטקסט מהתמונה. תקנו כל מה שיצא לא נכון לפני השמירה.",
  "ig.photo.none": "לא נמצא טקסט בתמונה הזאת. נסו תמונה חדה ובהירה יותר, או הדביקו את הטקסט.",
  "ig.photo.error": "לא הצלחנו לקרוא את התמונה. נסו תמונה אחרת, או הדביקו את הטקסט.",
  "ig.photo.unsupported":
    "קריאת תמונות עוד לא זמינה בדפדפן הזה. אפשר להקליד או להדביק את הטקסט במקום.",
  "ig.photo.usePaste": "הדביקו טקסט במקום",

  "ig.text.label": "הטקסט לדף",
  "ig.text.help": "זה יהיה הדף. אפשר לערוך אותו כאן קודם.",
  "ig.pageTitle": "כותרת הדף",
  "ig.pageTitle.help": "נלקחה משם הקובץ או מהשורה הראשונה. אפשר לשנות אותה.",
  "ig.untitled": "דף מיובא",
  "ig.needText": "הוסיפו קודם טקסט, מקובץ, מהדבקה או מתמונה.",

  "ig.save": "שמירה כדף",
  "ig.saving": "שומרים…",
  "ig.offline": "אין חיבור כרגע. הטקסט נשאר כאן, והשמירה תחכה עד שהחיבור יחזור.",
  "ig.waiting": "יישמר כשהחיבור יחזור",
  "ig.saveError": "השמירה לא עברה. הטקסט עדיין כאן.",
  "ig.retry": "לנסות שוב",

  "ig.done.title": "נשמר כדף",
  "ig.done.body": "הדף מוכן. אפשר לפתוח אותו, או להפוך אותו לחומר ללמידה.",
  "ig.done.open": "פתיחת הדף",
  "ig.done.study": "ללמוד מהדף",
  "ig.done.flashcards": "להפוך לכרטיסיות",
  "ig.done.quiz": "להפוך לבוחן",
  "ig.done.test": "להפוך למבחן תרגול",
  "ig.done.close": "סיום",
};

export type IngestCopyKey = keyof typeof en;
