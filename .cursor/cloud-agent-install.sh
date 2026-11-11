#!/usr/bin/env bash
# Cloud Agent extras. Runs after the bun 1.3.9 frozen install in
# .cursor/environment.json (the integration command from PR #438).
# Idempotent. No env var values are written.
set -euo pipefail

export BUN_INSTALL="${HOME}/.bun"
export PATH="${BUN_INSTALL}/bin:${HOME}/.local/bin:/usr/local/bin:${PATH}"

# Terminals call bunx. The integration install links bun only.
sudo ln -sf "${BUN_INSTALL}/bin/bun" /usr/local/bin/bunx 2>/dev/null || true

if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="${HOME}/.local/bin:${PATH}"
fi

if [[ -x "${HOME}/.local/bin/uv" ]]; then
  sudo ln -sfn "${HOME}/.local/bin/uv" /usr/local/bin/uv 2>/dev/null || true
fi

uv tool install graphifyy

if [[ -x "${HOME}/.local/bin/graphify" ]]; then
  sudo ln -sfn "${HOME}/.local/bin/graphify" /usr/local/bin/graphify 2>/dev/null || true
fi
