# Connect Tempo to Executor

Tempo's MCP server lets Executor read and manage your tasks, notes and calendar. This guide covers setup. Endpoint details are in [MCP.md](./MCP.md).

## Set up

1. Sign in and open **Settings → Integrations**, then find "Connect an AI assistant (MCP)".
2. Enter a token name (for example `Executor`) and choose **Create token**. The token is shown once; copy it into Executor right away.
3. In Executor, add a new MCP source of type **Streamable HTTP**.
4. Copy the **Endpoint URL** from the card (button "Copy Endpoint URL") into the URL field.
5. Copy the **Authorization header** line from the card, and replace `<your token>` with the token from step 2. Use the header field in Executor, not the URL.
6. Save the source. If the clipboard is unavailable, the card shows each value in a read-only box to select and copy by hand.

The two values are copied separately on purpose: they are form fields, not an importable configuration file.

## Check the tools list

List the tools of the Tempo source in Executor. You should see 12 tools once TEMPO-N2-05 is deployed, and 11 before it. If the list is empty or the call returns 401, the token is wrong or revoked; create a new one.

## Example prompts

- "Add a task: call the dentist tomorrow."
- "What's on my plan today?"
- "List my open tasks and show the three most urgent."
- "Create a note titled Weekly review."

Reading today's plan is supported. Do not rely on writing to the daily plan through MCP until a separate MCP write capability lands.

## Next to Basic Memory

Use the same Executor workspace for both. Add Basic Memory as its own MCP source and Tempo as another. They stay independent: Tempo never reads Basic Memory's files, and Basic Memory never gets your Tempo token.

## Revoke a token

In **Settings → Integrations**, choose **Revoke** next to the token. The next call with it returns 401. Then remove or update the source in Executor. You can hold at most 10 active tokens.

## Safety

- A token is a password. Never paste it into a chat, a ticket or a commit.
- Create one token per tool so you can revoke each on its own.
- If a token leaks, revoke it immediately.
