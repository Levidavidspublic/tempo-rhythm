"""Project adapter for pinned Graphify commands and staged AST snapshots."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import uuid

REPO_ROOT = Path(__file__).resolve().parents[2]
PREFIX = ["uvx", "--from", "graphifyy==0.9.74", "graphify"]


def invoke(arguments, root, runner=subprocess.run):
    """Pass every corpus value as one argv item, with no shell evaluation."""
    environment = os.environ.copy()
    environment["GRAPHIFY_NO_AUTO_REFRESH"] = "1"
    return runner(
        PREFIX + list(arguments),
        cwd=root,
        env=environment,
        shell=False,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )


def read_graph(path):
    """Accept both official raw and node-link graph formats, failing closed."""
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("nodes"), list):
        raise ValueError("Graph must contain a nodes array")
    if not isinstance(data.get("edges", data.get("links")), list):
        raise ValueError("Graph must contain an edges or links array")
    return data


def publish(staged, destination, replace=os.replace):
    """Publish graph before manifest, restoring both on any publication failure.

    Failed snapshots/backups remain beside their run; no source is deleted.
    This mirrors the upstream refusal to shrink or overwrite malformed graphs.
    """
    graph = read_graph(staged / "graph.json")
    manifest = json.loads(
        (staged / "manifest.json").read_text(encoding="utf-8")
    )
    if not isinstance(manifest, dict):
        raise ValueError("Manifest must be an object")
    if (destination / "graph.json").exists():
        previous = read_graph(destination / "graph.json")
        if len(graph["nodes"]) < len(previous["nodes"]):
            raise ValueError(
                "Graph shrink refused; preserve the last good graph "
                "for owner review"
            )
    destination.mkdir(parents=True, exist_ok=True)
    backup = staged.parent / "previous"
    backup.mkdir(exist_ok=False)
    names = ["graph.json", ".graphify_root", "manifest.json"]
    for name in names:
        if not (staged / name).is_file():
            raise ValueError("Incomplete current-run snapshot: " + name)
        if (destination / name).exists():
            shutil.copy2(destination / name, backup / name)
    completed = []
    try:
        for name in names:
            pending = staged.parent / ("publish-" + name)
            shutil.copy2(staged / name, pending)
            replace(pending, destination / name)
            completed.append(name)
    except Exception:
        for name in reversed(completed):
            if (backup / name).exists():
                os.replace(backup / name, destination / name)
            else:
                os.replace(
                    destination / name, staged.parent / ("unpublished-" + name)
                )
        raise
    return {
        "nodes": len(graph["nodes"]),
        "edges": len(graph.get("edges", graph.get("links"))),
    }


def refresh(root, runner=subprocess.run):
    """Use unique output; never reuse stale chunks or caches."""
    run = root / ".code-map-tools" / "runs" / uuid.uuid4().hex
    run.mkdir(parents=True, exist_ok=False)
    invoke(
        [
            "extract",
            str(root),
            "--code-only",
            "--no-cluster",
            "--max-workers",
            "1",
            "--out",
            str(run),
        ],
        root,
        runner,
    )
    staged = run / "graphify-out"
    # Persist the corpus root as data, never derive it from an ingestion URL.
    (staged / ".graphify_root").write_text(str(root), encoding="utf-8")
    result = publish(staged, root / "graphify-out")
    result["run"] = run.name
    return result


def request(root, runner=subprocess.run):
    """Read untrusted questions/labels/answers from one fixed JSON data file."""
    data = json.loads(
        (root / ".code-map-tools" / "request.json").read_text(encoding="utf-8")
    )
    if not isinstance(data, dict):
        raise ValueError("Request must be an object")
    operation = data.get("operation")
    if operation == "save-result":
        if not all(
            isinstance(data.get(key), str) for key in ("question", "answer")
        ):
            raise ValueError("question and answer must be strings")
        target = (
            root / ".code-map-tools" / "answers" / (uuid.uuid4().hex + ".json")
        )
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(
            json.dumps(data, ensure_ascii=False), encoding="utf-8"
        )
        return "Answer saved as local JSON data"
    keys = {
        "query": ["question"],
        "path": ["source", "target"],
        "explain": ["concept"],
    }
    if operation not in keys:
        raise ValueError(
            "Supported operations: query, path, explain, save-result"
        )
    values = [data.get(key) for key in keys[operation]]
    if not all(
        isinstance(value, str) and value and "\0" not in value
        for value in values
    ):
        raise ValueError(
            "Operation values must be nonempty strings without NUL"
        )
    # Values beginning with '-' can be mistaken for CLI options. Reject rather
    # than reinterpret them. Quotes, spaces, newlines and shell metacharacters
    # remain ordinary values and never enter a shell program.
    if any(value.startswith("-") for value in values):
        raise ValueError(
            "Leading option syntax is not accepted as a corpus value"
        )
    graph = root / "graphify-out" / "graph.json"
    graph_data = read_graph(graph)
    # The pinned query tokenizer omits very short terms. Preserve an exact
    # short label such as UI by using the official explain command, which
    # accepts it; graph traversal itself remains the upstream implementation.
    if operation == "query" and len(values[0].strip()) <= 3:
        if any(
            str(node.get("label", "")).casefold() == values[0].casefold()
            for node in graph_data["nodes"]
        ):
            operation = "explain"
    return invoke(
        [operation] + values + ["--graph", str(graph)], root, runner
    ).stdout


def main():
    """Keep executable syntax fixed; all user/corpus text belongs in JSON."""
    operation = sys.argv[1] if len(sys.argv) > 1 else "request"
    if operation == "refresh":
        print(json.dumps(refresh(REPO_ROOT)))
    elif operation == "request":
        print(request(REPO_ROOT))
    elif operation == "hook":
        if (REPO_ROOT / "graphify-out" / "graph.json").exists():
            print(
                "Use the project Graphify JSON request adapter "
                "for graph orientation.",
                file=sys.stderr,
            )
    elif (
        operation == "hook-guard"
        and len(sys.argv) == 3
        and sys.argv[2] in ("read", "search")
    ):
        result = invoke(["hook-guard", sys.argv[2]], REPO_ROOT)
        print(result.stdout, end="")
        print(result.stderr, end="", file=sys.stderr)
    else:
        raise ValueError("Unknown adapter operation")


if __name__ == "__main__":
    main()
