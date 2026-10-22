import * as React from "react";
import "@/app/v3/kb-77.css";
import { kb77t, type Kb77Key, type Kb77Lang } from "@/lib/i18n-groups/kb-77";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      className={cn(
        "kb77-input flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      type={type}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };

/** Pure fixture gallery; the existing production Input remains provider-free. */
export function Kb77Gallery({ lang }: { lang: Kb77Lang }) {
  const t = (key: Kb77Key) => kb77t(lang, key);
  return (
    <main className="kb77-gallery" lang={lang} dir={lang === "he" ? "rtl" : "ltr"}>
      <h1>{t("title")}</h1>
      <p>{t("lede")}</p>
      <div className="kb77-gallery__fields">
        <div className="kb77-gallery__field">
          <label htmlFor="kb77-text">{t("text")}</label>
          <Input id="kb77-text" dir="auto" defaultValue={t("intention")} />
        </div>
        <div className="kb77-gallery__field">
          <label htmlFor="kb77-time">{t("time")}</label>
          <Input id="kb77-time" type="time" dir="ltr" defaultValue="09:30" />
        </div>
        <div className="kb77-gallery__field">
          <label htmlFor="kb77-invalid">{t("invalid")}</label>
          <Input id="kb77-invalid" dir="auto" aria-invalid="true" aria-describedby="kb77-error" />
          <p id="kb77-error" className="kb77-gallery__error">
            {t("error")}
          </p>
        </div>
        <div className="kb77-gallery__field">
          <label htmlFor="kb77-disabled">{t("disabled")}</label>
          <Input id="kb77-disabled" dir="auto" defaultValue={t("later")} disabled />
        </div>
        <div className="kb77-gallery__field">
          <label htmlFor="kb77-readonly">{t("readOnly")}</label>
          <Input id="kb77-readonly" dir="auto" defaultValue={t("saved")} readOnly />
        </div>
        <div className="kb77-gallery__field">
          <label htmlFor="kb77-long">{t("long")}</label>
          <Input id="kb77-long" dir="auto" defaultValue={t("intention")} />
        </div>
      </div>
    </main>
  );
}
