# Demo script: a friend tries Tempo Flow (5 minutes)

For Amit to read aloud. **Lines in bold quotes are what you say.** Everything else is what you or your friend tap. Every label below was checked against the code on 19 Oct: the B07 batch (#1082) plus the new /coach chat (#1090), which is what the live release ships. The script will be walked on preview before the release.

Your friend uses their own phone or laptop. You keep your phone for one thing: approving them.

## Before the demo (Amit, about 10 minutes, once)

1. **The release puts this build on tempoflow.dev (AT).** It ships `integration` (the B07 batch, #1082) plus the /coach chat (#1090). Walk preview.tempoflow.dev with this script first. Then comment `go` on the Release PR: that starts **Release to production** (see `docs/DEPLOY.md`). When the run is green, tempoflow.dev serves the same build. That's your merge and your deploy.
2. **Check you can approve people:** on your phone, sign in to tempoflow.dev and open `https://tempoflow.dev/admin/approvals`. You should see the admin list, not "Admins only". If it says "Admins only", your email isn't in `TEMPO_ADMIN_EMAILS` on the production Convex deployment.
3. Optional: English or Hebrew. Inside the app, the switch is in the rail under **You** (it reads **עברית** / **English**). The landing follows the same choice on that device. On the landing itself, tap **EN** / **עב** at the top (**English** / **עברית** in the footer), or add `?lang=he` to the address. The sign-up and sign-in pages stay English either way.

## 0:00 – 1:00 · The landing page (friend's device)

1. Friend opens **tempoflow.dev**.
   **"This is Tempo Flow. It's a planner for brains that bounce off planners. Scroll with me."**
2. Scroll past the hero to **What's inside**: the daily page, then **Brain dump**, **Coach**, **An order for today**, **Journal**, **Routines** and **Weekly**.
   **"You dump everything in one messy pile; the AI sorts it, and nothing changes until you say yes."**
3. Keep scrolling: **The coach** (three example lines, labelled as examples), then **Pricing**.
   **"It's free during the beta. You sign up, and I let you in by hand."**
4. Then **A letter from Amit**. On a laptop, tap **Letter** in the top bar to jump to it.
   **"And this is why I built it."** Give them ten seconds with the letter.

## 1:00 – 2:00 · Sign up and get approved

1. Friend taps **Join the free beta** (top right, or the big button under the hero).
2. They type their email and tap **Send magic link**. The card turns into **Check your email** and says the first link opens a short waiting page.
3. They open the email, **Your Tempo Flow sign-in link**. It says it's their sign-in link for Tempo Flow and that it works once, for 30 minutes. They tap **Sign in to Tempo Flow**. Tempo shows **"Opening Tempo…"**, then **Waiting for approval** with three steps under **What happens next**.
   **"Read step 2: if this page is still open, Tempo opens by itself. Watch."**
4. While they wait, the page asks **What should Tempo call you?** (optional). They type a first name and tap **Save**.
5. **You**, on your phone: `https://tempoflow.dev/admin/approvals` → find their email → **Approve**.
6. Within a few seconds their page turns into **Today**, greeting them by that name, with no refresh. (On preview this took under a minute, including the time to approve.)
   **"That's it. No password, no card."**

If they closed the page: they come back to tempoflow.dev and tap **Sign in** with the same email.

## 2:00 – 3:00 · Brain dump → first plan

1. Laptop: **Brain dump** in the left rail. Phone: **More** (bottom right) → **Brain dump**.
2. They type a real mess, for example:
   *"Reply to Dana about Saturday. Book the dentist. Groceries are low. Pay the electricity bill before Sunday. I keep putting off the tax form and it is stressing me out."*
3. Tap **Sort it**. In a few seconds (3–8 s on preview) it shows **Your order** in three groups: **Now**, **Soon**, **Later**, each line with a short reason.
   **"Nothing is added yet. You pick."**
4. Tap **Accept** on two or three lines, at least one of them a **Now** line, then **Add accepted**.
5. The notice says **"… added to your tasks. The Now ones are on Today."** Only the **Now** lines go on Today; **Soon** and **Later** wait in Tasks without a date. Tap **Open Today**.
   **"Only what's for now lands on today. The rest waits."**

## 3:00 – 4:00 · The coach proposes, you accept, you undo

1. On **Today**, find **Ask the coach**. Type **"Plan my afternoon. Suggest one task for it."** and tap **Send** (Enter on a laptop).
2. A card appears: **Task · Add a task · Today**, with the exact task and its minutes, and **Accept**, **Edit**, **Not now**.
   **"This is the rule: the AI never changes anything on its own. It shows you the exact change first."**
3. Tap **Accept**. The card says **"Done. You can undo this for 5 minutes."**, with an **Undo** button and a countdown.
4. Tap **Undo**. The card says **"Undone. Nothing changed."**
   **"Five minutes to change your mind, every time."**

## 4:00 – 5:00 · A decision card, saved to today's page

1. In the same chat, type **"What order should I do these in?"** and send.
2. A card appears: **Order**, with numbered steps (the tasks from the brain dump), minutes and a reason each, and **Save to today** and **Not now**.
   If the coach asks first ("Want me to order those? Say the word and I'll make it a card."), reply **"Yes, make it a card."**
3. Tap **Save to today**. The card says **"Saved to today. You can undo this for 5 minutes."**
4. Scroll down to today's page: the steps are there, in that order, under the card's title.
   **"Your day, in the order that makes sense, and it's still your page. Edit it, tick things off."**
5. If you have 30 seconds left: tap **Full chat** on the **Ask the coach** card. This is the coach's own page, and every chat is kept.
   - Laptop: the **Chats** list is on the left. Phone: tap **Chats** at the top of the chat.
   - Tap **New chat**. The chat from Today stays in the list.
   - In **Search your chats**, type **afternoon**. The chat from Today comes up with the matching line; tap it to open it.
   - Under a coach reply, tap **Copy**. It turns into **Copied**.
   **"Nothing you talk through gets lost. Start fresh any time, and find it again later."**

## If something goes sideways

| What you see | What to say or do |
|---|---|
| The email hasn't arrived after a minute | Check spam. Tap **Use a different email**, or send the link again. A link works once, for 30 minutes. |
| They're still on **Waiting for approval** after you approved | Refresh the page once. |
| **Sort it** spins for more than ~20 s | The AI provider is slow. Wait, or tap **Sort it** again; their text stays. |
| The coach replies without a card | Say **"Yes, make it a card."** For "plan my afternoon", it needs at least one task or a goal to go on. |
| The reply ends with **"(That task is already on Today, so there's nothing new to add.)"** and no card | The coach suggested a task they already have on Today, so it dropped the card. Say **"Suggest a different task for this afternoon."** |
| A proposal adds a task they already have | Rarer now: a task already on Today with the same words is caught. A reworded one, or one waiting in Tasks without a date, can still come up. Tap **Not now**. |
| Hebrew: some screen text is still English | Known. In Hebrew: the landing, the app shell, the waiting page, Today, the brain dump, the coach cards and the /coach chat list; the sign-in email has a Hebrew half. Still English: the sign-up and sign-in pages, Panic's action text on /coach, and the time field in /plan's time-block dialog (it follows the browser's language). |

## Don't, during the demo

- If a **Talk** button shows next to **Send**, don't tap it. Voice is usage-billed and not part of this script.
