"use client";

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
    </>
  );
}
