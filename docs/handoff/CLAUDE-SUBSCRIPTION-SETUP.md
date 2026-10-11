# Run Claude Code on the subscription, not metered credits

For Amit's desktop, a VPS and GitHub Actions. Written 11 Oct 2026 from the Claude Code docs (code.claude.com/docs/en/authentication, /setup and /github-actions) and from Amit's claude.ai Usage page.

## Verdict

Claude Code bills your subscription (the 5-hour and weekly limits) when **two things** are true:

1. It runs on a machine you control (desktop, VPS or a GitHub runner), not in a claude.ai cloud session.
2. No API key is sitting in that machine's environment. An API key always wins over the subscription login.

## Which surface bills what

| Surface | Bills | How to keep it on the subscription |
|---|---|---|
| claude.ai/code cloud sessions, Routines, Claude Code on the web | **Cloud session credit first**, then the plan | Can't be switched off from inside a session. Run locally instead. |
| Claude Desktop app on your laptop | Subscription (OAuth) | Sign in with your Max account. It ignores `ANTHROPIC_API_KEY`. |
| `claude` CLI on laptop or VPS | Whatever wins the precedence list below | Keep `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` UNSET, and use `/login` |
| GitHub Actions (`anthropics/claude-code-action`) | The secret you pass it | Pass only `claude_code_oauth_token`, never `anthropic_api_key` |
| Codex cloud | Your ChatGPT plan | Not Claude. Never give Codex a metered API key. |

Two facts behind the first row:

- **The docs** say cloud sessions always use your subscription credentials, and an API key set in the cloud environment does not override them.
- **Your Usage page** says the included cloud session credit "applies automatically to cloud sessions. After it's used or expires, your plan's regular usage applies."

## The precedence list (from the docs)

When several credentials exist, the CLI uses the **first** one present:

1. Cloud provider (`CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY`)
2. `ANTHROPIC_AUTH_TOKEN`
3. `ANTHROPIC_API_KEY`. Interactive mode asks once whether to use it. In `-p` (script) mode it is **always** used when present.
4. `apiKeyHelper` script in a settings file
5. `CLAUDE_CODE_OAUTH_TOKEN`, the one-year subscription token from `claude setup-token`
6. Anthropic profile or federation credentials
7. Your `/login` subscription sign-in (the default for Pro and Max)

So: if 1–4 are absent, you are on the subscription.

---

## A. Desktop (Windows laptop)

**Simplest:** use the Claude Desktop app, signed in with your Max account. Open the repo folder there. Per the docs it uses OAuth and does not read API-key environment variables.

**For the CLI**, run each step as one PowerShell line, then check the result before moving on.

1. **Install:**
   `irm https://claude.ai/install.ps1 | iex`
   Then open a new terminal and run `claude --version`. You should see a version number.

2. **Check for a key that would win.** This prints names only, never values:
   `foreach ($n in 'ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','CLAUDE_CODE_USE_BEDROCK','CLAUDE_CODE_USE_VERTEX','CLAUDE_CODE_USE_FOUNDRY') { foreach ($s in 'Process','User','Machine') { if ([Environment]::GetEnvironmentVariable($n,$s)) { "$n ($s) = SET" } } }`
   You should see nothing. Any line it prints names a variable to remove.

3. **Remove a user-level one** (repeat per name), then open a new terminal:
   `[Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY',$null,'User')`
   A `Machine` one needs an admin PowerShell, with `'Machine'` in place of `'User'`.

4. **Check settings files for a key helper.** This prints file paths only:
   `Select-String -Path "$env:USERPROFILE\.claude\settings*.json" -Pattern 'apiKeyHelper|ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN' -List | Select-Object Path`
   You should see nothing.

5. **Sign in.**
   - In the repo folder, run `claude`, then `/login`, and choose your claude.ai (Pro/Max) account.
   - Then run `/status`. It should show your claude.ai account as the login method, not an API key. When a login and a key both exist, `/status` marks the one not in use.

6. **Drive it from your phone (optional):** in the repo folder, run `claude remote-control`. The session then shows up in the Claude Code app.
   - This needs the `/login` sign-in. A `setup-token` token can't start Remote Control.
   - The laptop must stay on and awake.

## B. VPS (Linux)

1. **Install:**
   `curl -fsSL https://claude.ai/install.sh | bash`
   Then run `claude --version`.

2. **Check for a key that would win.** This prints names only:
   `env | cut -d= -f1 | grep -E '^(ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN|CLAUDE_CODE_USE_(BEDROCK|VERTEX|FOUNDRY))$'`
   You should see nothing.

3. **Check startup files.** This prints file names only:
   `grep -l -E 'ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN|apiKeyHelper' ~/.bashrc ~/.profile ~/.claude/settings*.json /etc/environment 2>/dev/null`
   You should see nothing. Also check any systemd unit or `.env` file that starts Claude.

4. **Sign in on a headless server.**
   - Run `claude` and choose the claude.ai (Pro/Max) login.
   - Open the printed URL on your phone or laptop and sign in.
   - Paste the code back at `Paste code here if prompted`. The docs say this is normal over SSH.
   - Run `/status` to confirm. Credentials are saved in `~/.claude/.credentials.json` (mode 0600).

5. **Keep it running:**
   - `tmux new -s tempo` keeps the session alive when SSH drops.
   - Inside the repo folder, `claude remote-control` lets you drive it from the Claude app.

6. **Renewal:** `/status` shows `Expired — log in again` when the login runs out, and Claude warns 3 days before. Run `/login` to renew. An unattended or Remote Control session stops working once its login expires.

7. **Scripts only (`claude -p`, no person at the keyboard):** you can use a one-year token instead of `/login`.
   - Make it on your laptop with `claude setup-token`.
   - On the VPS, load it at a hidden prompt, never on the command line: `read -rs CLAUDE_CODE_OAUTH_TOKEN && export CLAUDE_CODE_OAUTH_TOKEN`
   - Limits: this token can't run Remote Control or claude.ai connectors, and `--bare` mode ignores it.

Your operating rule 8 applies everywhere: the subscription token is only ever used by the real `claude` binary. Never put it in third-party code.

## C. GitHub Actions

1. **Make the token on your laptop:** run `claude setup-token`, approve in the browser, and copy the token it prints once.

2. **Store it as a repo secret.** The value goes in at the prompt, not on the command line:
   `gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo Levidavidspublic/tempo-rhythm`
   Paste the token when asked.

3. **In every workflow step that uses `anthropics/claude-code-action`:**
   `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}`
   Do **not** also pass `anthropic_api_key` in the same step. The docs don't say which wins if both are given (UNKNOWN), so give only one.

4. **Audit a repo.** Both commands should print nothing:
   `git grep -n "anthropic_api_key" -- .github/workflows`
   `git grep -n "ANTHROPIC_API_KEY" -- .github/workflows`

5. **Renew yearly.** The token lasts one year. To renew, run `claude setup-token` again and repeat step 2.

**State of tempo-rhythm (checked 11 Oct):** `claude.yml` and `factory-lane-claude.yml` already pass `claude_code_oauth_token` from `CLAUDE_CODE_OAUTH_TOKEN`.

**Shared secrets:** the docs suggest an API key, not an OAuth token, for a secret shared across many repos, because the OAuth token is tied to one person's subscription. Using yours across your own repos is your call.

**Limits are shared:** Actions runs on the token count against the same 5-hour and weekly limits as your own sessions.

## D. How to tell which bucket was used

claude.ai → Settings → Usage:

- **Current session / This week** bars move: the subscription.
- **Cloud session credits** bar moves: a cloud session spent the included credit.
- **Usage credits** moves: paid pay-as-you-go. Switch the "Usage credits" toggle **off** for a hard no-spend cap.

## E. Checklist before any long run

- [ ] It runs on desktop, VPS or Actions, not a claude.ai cloud session.
- [ ] `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` and the `CLAUDE_CODE_USE_*` variables are UNSET.
- [ ] No `apiKeyHelper` in settings.
- [ ] `/status` shows your claude.ai account.
- [ ] Actions pass only `claude_code_oauth_token`.
- [ ] "Usage credits" is off if you want a hard cap.
