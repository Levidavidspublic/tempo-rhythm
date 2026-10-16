"use client";

import { useId } from "react";
import { SettingsSwitch } from "@/components/settings/controls";
import type { StudyT } from "./labels";

/**
 * "Type answers" above a flashcard (review session and deck): a switch (role="switch", with the
 * visible On / Off word) and its name. The name is a <label>, so it toggles the switch too.
 */
export function TypeAnswersToggle({
  t,
  on,
  onChange,
}: {
  t: StudyT;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="tp-study-typed" data-component="TypeAnswersToggle">
      <label className="tp-study-typed__label" id={`${id}-label`} htmlFor={`${id}-switch`}>
        {t("st.typed.toggle")}
      </label>
      <SettingsSwitch
        id={`${id}-switch`}
        checked={on}
        onChange={onChange}
        labelledBy={`${id}-label`}
      />
    </div>
  );
}
