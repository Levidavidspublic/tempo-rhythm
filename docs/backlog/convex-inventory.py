#!/usr/bin/env python3
"""Inventory tracked Convex references without printing source or reading env values.

Run: python3 docs/backlog/convex-inventory.py [--check]
The immutable baseline excludes this proposed migration documentation itself.
"""

import hashlib
import json
from pathlib import Path
import subprocess
import sys

BASE = "5504fc4038fc45d6c8412c23c45b9a9b6cb2ba73"
DEST = Path("docs/backlog/CONVEX-INVENTORY.json")


def git(*args):
  return subprocess.check_output(["git", *args])


def main():
  tracked = git("ls-tree", "-r", "--name-only", BASE).decode().splitlines()
  excluded = [p for p in tracked if Path(p).name.startswith(".env")]
  matches = (
      git(
          "grep",
          "-I",
          "-i",
          "-n",
          "convex",
          BASE,
          "--",
          ".",
          ":(exclude)**/.env*",
          ":(exclude).env*",
      )
      .decode()
      .splitlines()
  )
  lines = {}
  for match in matches:
    _, path, number, _ = match.split(":", 3)
    lines.setdefault(path, []).append(int(number))
  paths = sorted(
      set(lines)
      | {p for p in tracked if "convex" in p.lower() and p not in excluded}
  )
  files = []
  for path in paths:
    data = git("show", f"{BASE}:{path}")
    files.append(
        {
            "path": path,
            "sha256": hashlib.sha256(data).hexdigest(),
            "matching_lines": lines.get(path, []),
            "path_reference": "convex" in path.lower(),
        }
    )
  groups = {}
  for entry in files:
    path = entry["path"]
    group = (
        "/".join(path.split("/")[:2])
        if path.startswith(("apps/", "packages/"))
        else path.split("/")[0]
    )
    groups[group] = groups.get(group, 0) + 1
  result = {
      "baseline": BASE,
      "scope": "All tracked text references (case-insensitive) plus Convex-named paths; no runtime-only claim",
      "excluded_env_paths": excluded,
      "excluded_env_content": "NOT READ; reference completeness UNKNOWN for these files",
      "matching_text_files": len(lines),
      "matching_lines": sum(map(len, lines.values())),
      "inventoried_files": len(files),
      "groups": dict(sorted(groups.items())),
      "files": files,
  }
  rendered = json.dumps(result, indent=2, ensure_ascii=False) + "\n"
  if "--check" in sys.argv:
    assert (
        DEST.read_text() == rendered
    ), "inventory differs from immutable baseline"
  else:
    DEST.write_text(rendered)
  print(
      f"PASS: {len(files)} inventoried files; {len(lines)} text-reference files; {result['matching_lines']} matching lines; {len(excluded)} env paths excluded"
  )
  print(json.dumps(result["groups"], sort_keys=True))


if __name__ == "__main__":
  main()
