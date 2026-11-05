#!/usr/bin/env bash
# Re-author factory bot PRs as Division6066 so CodeRabbit (one seat) reviews them.
# Usage: factory-pr-author.sh pr <number> | push <branch>
# Env: REPO (owner/name), GH_TOKEN (FACTORY_PR_TOKEN), DRY_RUN=1 to only print.
# Uses gh API calls only; never checks out or runs PR code.
set -euo pipefail
MODE="${1:?mode pr|push}"; ARG="${2:?pr number or branch}"
REPO="${REPO:?REPO required}"
BASE="integration"
AUTHOR="${FACTORY_AUTHOR:-Division6066}"
BOT_AUTHORS="${BOT_AUTHORS:-reason-machines[bot] chatgpt-codex-connector[bot] chatgpt-codex-connector cursor[bot] claude[bot] github-actions[bot]}"
DRY="${DRY_RUN:-0}"
run() { if [ "$DRY" = "1" ]; then echo "DRY_RUN would: $*"; else "$@"; fi; }
guard_base() { case "$1" in integration) ;; *) echo "FATAL: base '$1' != integration" >&2; exit 1;; esac; }
existing() { # prints number of an open PR on head authored by AUTHOR
  gh pr list -R "$REPO" --head "$1" --state open --json number,author \
    -q ".[] | select(.author.login==\"$AUTHOR\") | .number" | head -n1; }
guard_base "$BASE"

if [ "$MODE" = "pr" ]; then
  J=$(gh api "repos/$REPO/pulls/$ARG")
  BOT=$(jq -r .user.login <<<"$J"); HEAD=$(jq -r .head.ref <<<"$J")
  PBASE=$(jq -r .base.ref <<<"$J"); STATE=$(jq -r .state <<<"$J")
  SAME=$([ "$(jq -r .head.repo.full_name <<<"$J")" = "$REPO" ] && echo y || echo n)
  echo "PR #$ARG author=$BOT head=$HEAD base=$PBASE state=$STATE same_repo=$SAME"
  guard_base "$PBASE"
  [ "$SAME" = y ] || { echo "skip: fork head"; exit 0; }
  grep -qxF -- "$BOT" <(tr ' ' '\n' <<<"$BOT_AUTHORS") || { echo "skip: $BOT not a factory bot"; exit 0; }
  if N=$(existing "$HEAD") && [ -n "$N" ]; then echo "dedupe: #$N already open by $AUTHOR"; exit 0; fi
  TITLE=$(jq -r .title <<<"$J")
  BODY="$(jq -r '.body // ""' <<<"$J")"$'\n\n---\n'"Re-opened from #$ARG (authored by $BOT)"
  LABELS=$(jq -r '[.labels[].name]|join(",")' <<<"$J")
  # GitHub allows one open PR per head/base, so close the bot PR first.
  run gh pr close "$ARG" -R "$REPO" --comment "Re-opening this as $AUTHOR so CodeRabbit reviews it; see the new PR from branch \`$HEAD\`."
  args=(gh pr create -R "$REPO" --base "$BASE" --head "$HEAD" --title "$TITLE" --body "$BODY")
  [ -n "$LABELS" ] && args+=(--label "$LABELS")
  if [ "$DRY" = "1" ]; then echo "DRY_RUN would: gh pr create --base $BASE --head $HEAD --title '$TITLE' labels='$LABELS'"; echo "--- body footer: Re-opened from #$ARG (authored by $BOT)"; exit 0; fi
  URL=$("${args[@]}"); echo "created $URL"
  gh pr comment "$ARG" -R "$REPO" --body "Re-opened as $URL"
elif [ "$MODE" = "push" ]; then
  HEAD="$ARG"
  OPEN=$(gh pr list -R "$REPO" --head "$HEAD" --state open --json number,author -q '.[]|"#\(.number) by \(.author.login)"')
  if N=$(existing "$HEAD") && [ -n "$N" ]; then echo "dedupe: #$N already open by $AUTHOR for $HEAD"; exit 0; fi
  [ -z "$OPEN" ] || { echo "skip: open PR exists for $HEAD ($OPEN); mode pr handles bot PRs"; exit 0; }
  C=$(gh api "repos/$REPO/commits/$HEAD" -q .commit.message)
  TITLE=$(head -n1 <<<"$C"); BODY=$(tail -n +3 <<<"$C")
  [ -n "$BODY" ] || BODY="Opened automatically from push to \`$HEAD\`."
  run gh pr create -R "$REPO" --base "$BASE" --head "$HEAD" --title "$TITLE" --body "$BODY"
else echo "unknown mode $MODE" >&2; exit 2; fi
