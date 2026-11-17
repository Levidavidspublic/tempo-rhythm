"""Regressions for data-only CLI calls and current-run snapshot publication."""

import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location(
    "graphify_safe", Path(__file__).with_name("graphify_safe.py")
)
ADAPTER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ADAPTER)


class AdapterTests(unittest.TestCase):
    """Exercise command-injection and graph/manifest failure boundaries."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "fixture with spaces"
        self.root.mkdir()

    def snapshot(self, directory, marker, nodes=1):
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "graph.json").write_text(
            json.dumps(
                {"nodes": [{"id": str(i)} for i in range(nodes)], "edges": []}
            ),
            encoding="utf-8",
        )
        (directory / "manifest.json").write_text(
            json.dumps({"marker": marker}), encoding="utf-8"
        )
        (directory / ".graphify_root").write_text(
            str(self.root), encoding="utf-8"
        )

    def write_request(self, data):
        folder = self.root / ".code-map-tools"
        folder.mkdir(exist_ok=True)
        (folder / "request.json").write_text(json.dumps(data), encoding="utf-8")

    def test_quotes_newlines_and_command_substitution_remain_argv_data(self):
        self.snapshot(self.root / "graphify-out", "old")
        payload = "UI ' quote \" $(touch GRAPHIFY_PWNED) `id`\nnext line"
        self.write_request({"operation": "query", "question": payload})
        observed = []

        def runner(arguments, **options):
            observed.append((arguments, options))
            return subprocess.CompletedProcess(arguments, 0, "query result", "")

        before = os.environ.get("GRAPHIFY_NO_AUTO_REFRESH")
        self.assertEqual(ADAPTER.request(self.root, runner), "query result")
        arguments, options = observed[0]
        self.assertEqual(arguments[5], payload)
        self.assertFalse(options["shell"])
        self.assertEqual(options["env"]["GRAPHIFY_NO_AUTO_REFRESH"], "1")
        self.assertEqual(os.environ.get("GRAPHIFY_NO_AUTO_REFRESH"), before)
        self.assertFalse((self.root / "GRAPHIFY_PWNED").exists())

    def test_answer_is_saved_as_json_without_a_subprocess(self):
        payload = "$(id) ' \"\nanswer"
        self.write_request(
            {"operation": "save-result", "question": "UI", "answer": payload}
        )

        def forbidden(*_args, **_options):
            self.fail("Answer persistence must not run a process")

        ADAPTER.request(self.root, forbidden)
        saved = list((self.root / ".code-map-tools/answers").glob("*.json"))
        self.assertEqual(len(saved), 1)
        self.assertEqual(
            json.loads(saved[0].read_text(encoding="utf-8"))["answer"], payload
        )

    def test_unknown_operation_and_cli_option_injection_are_rejected(self):
        self.write_request({"operation": "query", "question": "--force"})
        with self.assertRaises(ValueError):
            ADAPTER.request(self.root)
        self.write_request(
            {"operation": "ingest", "url": "https://example.org/$(id)"}
        )
        with self.assertRaises(ValueError):
            ADAPTER.request(self.root)

    def test_raw_and_links_graph_formats_are_accepted(self):
        path = self.root / "graph.json"
        for field in ("edges", "links"):
            path.write_text(
                json.dumps({"nodes": [], field: []}), encoding="utf-8"
            )
            self.assertEqual(ADAPTER.read_graph(path)[field], [])

    def test_short_exact_label_uses_official_explain_without_filtering(self):
        self.snapshot(self.root / "graphify-out", "old")
        graph = self.root / "graphify-out/graph.json"
        graph.write_text(
            json.dumps({"nodes": [{"id": "ui", "label": "UI"}], "edges": []}),
            encoding="utf-8",
        )
        self.write_request({"operation": "query", "question": "UI"})
        observed = []

        def runner(arguments, **_options):
            observed.append(arguments)
            return subprocess.CompletedProcess(arguments, 0, "UI", "")

        self.assertEqual(ADAPTER.request(self.root, runner), "UI")
        self.assertEqual(observed[0][4:6], ["explain", "UI"])

    def test_manifest_is_published_after_graph_and_root(self):
        staged = self.root / "run/graphify-out"
        target = self.root / "graphify-out"
        self.snapshot(staged, "new")
        self.snapshot(target, "old")
        operations = []

        def replace(source, destination):
            operations.append(destination.name)
            os.replace(source, destination)

        ADAPTER.publish(staged, target, replace)
        self.assertEqual(
            operations, ["graph.json", ".graphify_root", "manifest.json"]
        )
        self.assertEqual(
            json.loads((target / "manifest.json").read_text())["marker"], "new"
        )

    def test_failed_manifest_publish_restores_both_prior_artifacts(self):
        staged = self.root / "run/graphify-out"
        target = self.root / "graphify-out"
        self.snapshot(staged, "new", nodes=2)
        self.snapshot(target, "old")
        original = {
            name: (target / name).read_bytes()
            for name in ("graph.json", "manifest.json", ".graphify_root")
        }

        def replace(source, destination):
            if destination.name == "manifest.json":
                raise OSError("injected publication failure")
            os.replace(source, destination)

        with self.assertRaises(OSError):
            ADAPTER.publish(staged, target, replace)
        for name, content in original.items():
            self.assertEqual((target / name).read_bytes(), content)

    def test_malformed_or_smaller_graph_never_promotes_manifest(self):
        target = self.root / "graphify-out"
        self.snapshot(target, "old", nodes=2)
        staged = self.root / "run/graphify-out"
        self.snapshot(staged, "new")
        with self.assertRaises(ValueError):
            ADAPTER.publish(staged, target)
        self.assertEqual(
            json.loads((target / "manifest.json").read_text())["marker"], "old"
        )
        (staged / "graph.json").write_text("malformed", encoding="utf-8")
        with self.assertRaises(ValueError):
            ADAPTER.publish(staged, target)
        self.assertEqual(
            len(ADAPTER.read_graph(target / "graph.json")["nodes"]), 2
        )

    def test_failed_extraction_preserves_last_good_artifacts(self):
        target = self.root / "graphify-out"
        self.snapshot(target, "old")
        before = (target / "graph.json").read_bytes(), (
            target / "manifest.json"
        ).read_bytes()

        def failed(arguments, **_options):
            raise subprocess.CalledProcessError(1, arguments)

        with self.assertRaises(subprocess.CalledProcessError):
            ADAPTER.refresh(self.root, failed)
        self.assertEqual(
            before,
            (
                (target / "graph.json").read_bytes(),
                (target / "manifest.json").read_bytes(),
            ),
        )

    def test_only_current_run_output_is_published(self):
        stale = self.root / ".code-map-tools/runs/old/graphify-out"
        self.snapshot(stale, "stale", nodes=3)
        (stale / "chunk-99.json").write_text("malformed", encoding="utf-8")

        def current(arguments, **_options):
            output = (
                Path(arguments[arguments.index("--out") + 1]) / "graphify-out"
            )
            self.snapshot(output, "current")
            return subprocess.CompletedProcess(arguments, 0, "", "")

        result = ADAPTER.refresh(self.root, current)
        self.assertEqual(result["nodes"], 1)
        self.assertEqual(
            json.loads((self.root / "graphify-out/manifest.json").read_text())[
                "marker"
            ],
            "current",
        )
        self.assertTrue((stale / "chunk-99.json").exists())


if __name__ == "__main__":
    unittest.main()
