# KB-69 approval waiting evidence

The existing `ApprovalGate` still passes `email` and `revoked` to the mounted `WaitingForApproval` screen, and its live status query remains unchanged. The screen mounts `ApprovalStatus` and `WaitingNameFeedback`; the former explains waiting or paused access, and the latter stays next to the optional name field. The field still uses `users.getProfile({})`, `users.updateMyProfile({ fullName: check.name })`, and the checked-in name helper. Successful sign-out still replaces the route with `/sign-in`; a rejected sign-out now offers a visible retry without navigation.

The [contact sheet](./kb-69-approval-waiting.jpg) pairs the saved pre-edit source at commit `52bf2803e9105b25c2538aedd81a754a9fbfdedb` with the mounted current screen at 390 and 1280 px in English and Hebrew, light and dark. Both bundles use the same fictional Maya email/profile and v3 tokens. The old source used Tailwind utility classes; the isolated baseline fixture translates those classes to equivalent basic layout rules, so the sheet is a source-derived comparison rather than a production shell screenshot. Tiles crop blank viewport space to make content legible; browser assertions use the full viewport. The original screen had a name form and sign-out control, but no sign-out failure alert or revision-aware save notice.

## Browser findings

- The actual mounted waiting and revoked states have one `main` and one `h1`. The waiting state shows the optional name field, while revoked does not.
- During a held save, the name input remains editable and the submit control prevents duplicate writes. A newer edit survives either success or rejection of the earlier save. Only the matching submitted draft receives Saved or error feedback.
- A failed sign-out leaves the screen in place, focuses the retryable Sign out control, and never calls `router.replace`; a successful retry uses `/sign-in`.
- Hebrew has an RTL subtree while the email is isolated LTR in `bdi`. User-written names retain `dir=auto`. At 390 px, the field and buttons meet 44 px height, visible keyboard focus is present, and long fictional email content does not overflow. Reduced motion is enabled in the browser fixture.
- The interactive `Kb69Gallery` exercises waiting, revoked, name pending/saved/error, sign-out error/retry, disabled and long-content examples through the real status/feedback exports. Its examples are controlled display states, while behavioral assertions mount the production screen with fictional query/mutation/auth stubs.

The final command table and failure tails are in draft PR #1164. These fixtures do not claim a live account, actual backend writes, or deployed approval behavior. Device screen-reader results remain **UNKNOWN**. Hebrew copy needs Amit's native read.
