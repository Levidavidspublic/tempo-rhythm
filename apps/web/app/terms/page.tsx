import Link from "next/link";

// דף תנאי שימוש: הסכם משפטי בין בעל האתר למשתמשים
export default function TermsPage() {
  return (
    // The text is Hebrew: right to left in either app language, so the full stops land on the right side.
    <div className="min-h-screen py-20 px-4" dir="rtl" lang="he">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-8">תנאי שימוש</h1>

        <div className="space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">1. קבלת התנאים</h2>
            <p>
              על ידי גישה לאתר זה ושימוש בו, אתם מסכימים לכל התנאים וההגבלות המפורטים כאן. אם אינכם
              מסכימים לתנאים אלה, אנא הימנעו משימוש באתר.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">2. שימוש באתר</h2>
            <p>
              השימוש באתר מותר למטרות חוקיות בלבד. אתם מתחייבים שלא לעשות שימוש באתר בכל דרך שעלולה
              לפגוע בתפקודו, או לגרום נזק לאתר או לצדדים שלישיים.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">3. קניין רוחני</h2>
            <p>
              כל התכנים באתר זה, לרבות טקסטים, גרפיקה, לוגואים ותמונות, הינם רכושנו או רכוש ספקי
              התוכן שלנו ומוגנים על פי חוקי זכויות היוצרים.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">4. הגבלת אחריות</h2>
            <p>
              השירותים והמידע באתר מסופקים &quot;כמות שהם&quot;. איננו מתחייבים לדיוק, שלמות או
              התאמה למטרה מסוימת של המידע המוצג באתר.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">5. שינויים בתנאים</h2>
            <p>
              אנו שומרים לעצמנו את הזכות לשנות את תנאי השימוש בכל עת. השינויים ייכנסו לתוקף מיד עם
              פרסומם באתר.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">6. יצירת קשר</h2>
            <p>לשאלות או הבהרות בנוגע לתנאי השימוש, ניתן ליצור קשר בכתובת: amit@tempoflow.app</p>
          </section>
        </div>

        <div className="mt-12">
          <Link href="/" className="text-primary hover:underline">
            ← חזרה לדף הבית
          </Link>
        </div>
      </div>
    </div>
  );
}
