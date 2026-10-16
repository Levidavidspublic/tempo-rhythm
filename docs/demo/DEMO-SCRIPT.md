# Demo script: a friend tries Tempo Flow (5 minutes)

For Amit to read aloud. **Lines in bold quotes are what you say.** Everything else is what you or your friend tap. Each step was walked headless at 390 px (phone) and 1280 px (laptop), light and dark, English and Hebrew, on the `demo/friend` branch preview. Proof is in `docs/sprint/RUN-LOG.md` → **Demo**.

Your friend uses their own phone or laptop. You keep your phone for one thing: approving them.

## Before the demo (Amit, about 10 minutes, once)

1. **Make tempoflow.dev serve this build (AT).** Today tempoflow.dev serves `master` at `007d28a` (about 4 Oct). Everything below needs `integration` with PR "Demo: friend walk-through" merged, then promoted to production. That's your merge and your deploy. See "Live site vs preview" in the PR's final report.
2. **OpenUI coach cards (AT, optional).** They're behind the flag `openui`, which is OFF on production. To show them on tempoflow.dev, open `https://tempoflow.dev/today?openui=on` once on the device that will see the coach (your friend's). Without it, the same cards show, drawn directly.
3. **Check you can approve people:** on your phone, sign in to tempoflow.dev and open `https://tempoflow.dev/admin/approvals`. You should see the admin list, not "Admins only". If it says "Admins only", your email isn't in `TEMPO_ADMIN_EMAILS` on the production Convex deployment.
4. Optional: English or Hebrew. Inside the app, the switch is in the rail under **You** (it reads **עברית** / **English**). The landing, sign-up and sign-in pages stay English either way.

## 0:00 – 1:00 · The landing page (friend's device)

1. Friend opens **tempoflow.dev**.
   **"This is Tempo Flow. It's a planner for brains that bounce off planners. Scroll with me."**
2. Scroll past the hero to **What's inside**: Daily Note, Brain Dump, Coach, First Plan.
   **"You dump everything in one messy pile; the AI sorts it, and nothing changes until you say yes."**
3. Keep scrolling: **The coach** (three real-sounding lines), then **Pricing**.
   **"It's free during the beta. You sign up, and I let you in by hand."**
4. **Beta testers**, then the letter. On a laptop, tap **Manifesto** in the top bar to jump to it.
   **"And this is why I built it."** Give them ten seconds with the letter.

## 1:00 – 2:00 · Sign up and get approved

1. Friend taps **Join the free beta** (top right, or the big button under the hero).
2. They type their email and tap **Send magic link**. The card turns into **Check your email** and says the first link opens a short waiting page.
3. They open the sign-in email from Tempo and tap the link. Tempo shows **"Opening Tempo…"**, then **Waiting for approval** with three steps.
   **"Read step 2: if this page is still open, Tempo opens by itself. Watch."**
4. **You**, on your phone: `https://tempoflow.dev/admin/approvals` → find their email → **Approve**.
5. Within a few seconds their page turns into **Today**, with no refresh. (On preview this took under a minute, including the time to approve.)
   **"That's it. No password, no card."**

If they closed the page: they come back to tempoflow.dev and tap **Sign in** with the same email.

## 2:00 – 3:00 · Brain dump → first plan

1. Laptop: **Brain dump** in the left rail. Phone: **More** (bottom right) → **Brain dump**.
2. They type a real mess, for example:
   *"Reply to Dana about Saturday. Book the dentist. Groceries are low. Pay the electricity bill before Sunday. I keep putting off the tax form and it is stressing me out."*
3. Tap **Sort it**. In a few seconds (3–8 s on preview) it shows **Your order** in three groups: **Now**, **Soon**, **Later**, each line with a short reason.
   **"Nothing is added yet. You pick."**
4. Tap **Accept** on two or three lines (start with the **Now** ones), then **Add accepted**.
5. The notice says **"… added to your tasks. The Now ones are on Today."** Tap **Open Today**.

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
5. If you have a minute left: tap **This week** (under Next up on Today), or open the week's page from **Pages**. It opens with **This week at a glance**: finished tasks and focus time, each with a small line chart, and the seven days as dots.
   **"No streaks, no scores. A quiet week just says that's fine."**

## If something goes sideways

| What you see | What to say or do |
|---|---|
| The email hasn't arrived after a minute | Check spam. Tap **Use a different email**, or send the link again. |
| They're still on **Waiting for approval** after you approved | Refresh the page once. |
| **Sort it** spins for more than ~20 s | The AI provider is slow. Wait, or tap **Sort it** again; their text stays. |
| The coach replies without a card | Say **"Yes, make it a card."** For "plan my afternoon", it needs at least one task or a goal to go on. |
| A proposal adds a task they already have | Tap **Not now**. (Known: the coach sometimes suggests an existing task.) |
| Hebrew: some screen text is still English | Known; the shell, the waiting page, Today's greeting, the brain dump and the coach cards are in Hebrew. |

## Don't, during the demo

- Don't tap **Talk** (voice). It works on preview but is usage-billed and not part of this script.
- Don't open **Ask the founder**: it's still a placeholder screen.
