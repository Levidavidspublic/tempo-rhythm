"use client";

import { useEffect, useState } from "react";
import { TodayBrainDumpPanel } from "@/components/today/TodayBrainDumpPanel";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";
import { CoachChat } from "@/components/coach/CoachChat";
import { CoachControls } from "@/components/coach-controls/CoachControls";
import { CoachProposalCard } from "@/components/coach-proposal/CoachProposalCard";
import { ShellAside } from "@/components/tempo/ShellSlots";
import { ProfileReady } from "@/components/today/ProfileReady";

/**
 * /coach: the conversation in main; the push dial, panic and today's proposal in the shell's
 * side column beside it (below it under 1280 px). Keeping them out of main keeps one "Coach"
 * heading in main, which the chat specs select.
 */
export default function Page() {
  const bounds = useLocalDayBounds();
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(width < 48rem)");
    const update = () => setMobile(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return (
    <>
      <ShellAside>
        <div data-coach-marker="dial-panic" data-testid="coach-controls">
          <ProfileReady fallback={null}>
            <CoachControls />
          </ProfileReady>
        </div>
        <div data-coach-marker="proposal" data-testid="coach-proposal">
          <ProfileReady fallback={null}>
            <CoachProposalCard />
          </ProfileReady>
        </div>
      </ShellAside>
      <CoachChat />
      {mobile ? <div className="tp-mobile-chat-plan" id="mobile-plan"><ProfileReady fallback={null}><TodayBrainDumpPanel dueAt={bounds.endMs - 1} mobile /></ProfileReady></div> : null}
    </>
  );
}
