"""Safety regressions, without live GitHub or Windows startup claims."""

import importlib.machinery
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

# The vendored monitor deliberately remains Unix-only. Isolate that dependency
# while testing its pure safety logic on Windows; actual startup is tested
# separately and reported UNKNOWN when fcntl is unavailable.
if sys.platform == "win32":
    sys.modules.setdefault("fcntl", types.ModuleType("fcntl"))
loader = importlib.machinery.SourceFileLoader(
    "pr_wait", str(Path(__file__).with_name("pr-wait"))
)
spec = importlib.util.spec_from_loader(loader.name, loader)
monitor = importlib.util.module_from_spec(spec)
loader.exec_module(monitor)

HEAD = "a" * 40


def connection(nodes=(), more=False, cursor=None):
    return {
        "nodes": list(nodes),
        "pageInfo": {"hasNextPage": more, "endCursor": cursor},
    }


def pr():
    return {
        "headRefOid": HEAD,
        "baseRefName": "integration",
        "state": "OPEN",
        "url": "test",
        "author": {"login": "owner"},
        "viewer": "owner",
        "baseRef": {"target": {"oid": "base"}},
        "mergeStateStatus": "CLEAN",
        "comments": connection(),
        "reviews": connection(),
        "reviewThreads": connection(),
    }


def response(data):
    return subprocess.CompletedProcess([], 0, json.dumps(data), "")


class SafetyTests(unittest.TestCase):
    """Verify fail-closed readiness with isolated GitHub responses."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.state_patch = patch.object(
            monitor, "STATE_DIR", Path(self.temp.name)
        )
        self.state_patch.start()
        self.addCleanup(self.state_patch.stop)
        self.addCleanup(self.temp.cleanup)

    def watcher(self):
        return monitor.Watcher("owner/repo", 1, "ready", 5)

    def test_only_exact_bot_actor_is_trusted(self):
        for login, kind in [("my-coderabbit", "Bot"), ("coderabbitai", "User")]:
            self.assertIsNone(
                monitor.trusted_bot(
                    {"author": {"login": login, "__typename": kind}}
                )
            )
        self.assertEqual(
            monitor.trusted_bot(
                {"author": {"login": "coderabbitai", "__typename": "Bot"}}
            ),
            "coderabbit",
        )

    def test_failed_rule_discovery_never_becomes_empty(self):
        with patch.object(
            monitor, "gh_lines", side_effect=monitor.GhError("HTTP 403", False)
        ):
            with self.assertRaises(monitor.GhError):
                monitor.required_checks("owner/repo", "integration")

    def test_classic_404_requires_successful_rules_discovery(self):
        with patch.object(
            monitor,
            "gh_lines",
            side_effect=[[], monitor.GhError("HTTP 404", False)],
        ):
            self.assertEqual(
                monitor.required_checks("owner/repo", "integration"), set()
            )

    def test_base_comparison_failure_is_not_no_overlap(self):
        watcher = self.watcher()
        watcher.pr_files[HEAD] = {"a.py"}
        with patch.object(
            monitor, "gh_lines", side_effect=monitor.GhError("HTTP 503", True)
        ):
            with self.assertRaises(monitor.GhError):
                watcher.base_overlap(HEAD, "old", "new")

    def test_paginate_all_connections_and_nested_thread_comments(self):
        initial = pr()
        for name in ("comments", "reviews", "reviewThreads"):
            initial[name] = connection([], True, name + "1")
        thread = {
            "id": "t1",
            "isResolved": False,
            "path": "a.py",
            "line": 1,
            "comments": connection([{"id": "c1"}], True, "nested1"),
        }
        pages = [
            response(
                {
                    "data": {
                        "viewer": {"login": "owner"},
                        "repository": {"pullRequest": initial},
                    }
                }
            )
        ]
        for name in ("comments", "reviews", "reviewThreads"):
            nodes = (
                [thread] if name == "reviewThreads" else [{"id": name + "2"}]
            )
            pages.append(
                response(
                    {
                        "data": {
                            "repository": {
                                "pullRequest": {
                                    "headRefOid": HEAD,
                                    name: connection(nodes),
                                }
                            }
                        }
                    }
                )
            )
        pages.append(
            response(
                {"data": {"node": {"comments": connection([{"id": "c2"}])}}}
            )
        )
        with patch.object(monitor, "gh", side_effect=pages) as gh:
            result = self.watcher().fetch_pr()
        self.assertEqual(gh.call_count, 5)
        self.assertFalse(result["reviewThreads"]["nodes"][0]["isResolved"])
        self.assertEqual(
            len(result["reviewThreads"]["nodes"][0]["comments"]["nodes"]), 2
        )
        self.assertEqual(result["comments"]["nodes"][0]["id"], "comments2")
        self.assertEqual(result["reviews"]["nodes"][0]["id"], "reviews2")

    def test_head_change_during_pagination_fails_closed(self):
        initial = pr()
        initial["comments"] = connection([], True, "c1")
        pages = [
            response(
                {
                    "data": {
                        "viewer": {"login": "owner"},
                        "repository": {"pullRequest": initial},
                    }
                }
            ),
            response(
                {
                    "data": {
                        "repository": {
                            "pullRequest": {
                                "headRefOid": "b" * 40,
                                "comments": connection(),
                            }
                        }
                    }
                }
            ),
        ]
        with patch.object(monitor, "gh", side_effect=pages):
            with self.assertRaises(monitor.GhError):
                self.watcher().fetch_pr()

    def poll(self, snapshot, checks, watcher=None):
        watcher = watcher or self.watcher()
        with patch.object(
            watcher, "fetch_pr", return_value=snapshot
        ), patch.object(
            watcher, "fetch_checks", return_value=checks
        ), patch.object(
            monitor, "required_checks", return_value={"ci"}
        ) as required, patch.object(
            monitor,
            "gh",
            return_value=response(
                {
                    "headRefOid": snapshot["headRefOid"],
                    "baseRefName": snapshot["baseRefName"],
                }
            ),
        ):
            watcher.poll()
        return watcher, required

    def test_failed_and_cancelled_reviewer_check_never_completes_review(self):
        for bucket in ("fail", "cancel", "pending", "skipping"):
            snapshot = pr()
            snapshot["reviews"] = connection(
                [
                    {
                        "id": "r",
                        "url": "test",
                        "body": "review",
                        "state": "COMMENTED",
                        "commit": {"oid": HEAD},
                        "author": {
                            "login": "coderabbitai",
                            "__typename": "Bot",
                        },
                    }
                ]
            )
            watcher, _ = self.poll(
                snapshot,
                {
                    "ci": {"bucket": "pass", "link": "", "description": ""},
                    "CodeRabbit": {
                        "bucket": bucket,
                        "link": "",
                        "description": "",
                    },
                },
            )
            self.assertNotIn("bot:coderabbit:" + HEAD, watcher.reported)

    def test_reviewer_name_alone_does_not_prove_review(self):
        watcher, _ = self.poll(
            pr(),
            {
                "ci": {"bucket": "pass", "link": "", "description": ""},
                "CodeRabbit": {"bucket": "pass", "link": "", "description": ""},
            },
        )
        self.assertNotIn("bot:coderabbit:" + HEAD, watcher.reported)

    def test_required_check_cache_refreshes_when_base_changes(self):
        watcher = self.watcher()
        watcher.required = {"old-check"}
        watcher.required_base = "old"
        watcher, required = self.poll(
            pr(),
            {"ci": {"bucket": "pending", "link": "", "description": ""}},
            watcher,
        )
        required.assert_called_once_with("owner/repo", "integration")
        self.assertEqual(watcher.required, {"ci"})

    def test_head_revalidation_blocks_mixed_snapshot(self):
        watcher = self.watcher()
        with patch.object(watcher, "fetch_pr", return_value=pr()), patch.object(
            watcher, "fetch_checks", return_value={}
        ), patch.object(
            monitor, "required_checks", return_value={"ci"}
        ), patch.object(
            monitor,
            "gh",
            return_value=response(
                {"headRefOid": "b" * 40, "baseRefName": "integration"}
            ),
        ):
            with self.assertRaises(monitor.GhError):
                watcher.poll()
        self.assertIsNone(watcher.prev_snapshot)

    def test_skipped_required_check_is_not_green(self):
        with self.assertRaises(SystemExit) as caught:
            self.poll(
                pr(),
                {"ci": {"bucket": "skipping", "link": "", "description": ""}},
            )
        self.assertEqual(caught.exception.code, 1)

    def test_missing_required_check_stays_pending(self):
        watcher = self.watcher()
        self.poll(pr(), {}, watcher)
        self.poll(pr(), {}, watcher)
        self.assertNotIn("checks:" + HEAD, watcher.reported)

    def test_unresolved_thread_blocks_readiness_after_stable_checks(self):
        snapshot = pr()
        snapshot["reviews"] = connection(
            [
                {
                    "id": "r",
                    "url": "test",
                    "body": "review",
                    "state": "COMMENTED",
                    "commit": {"oid": HEAD},
                    "author": {"login": "coderabbitai", "__typename": "Bot"},
                }
            ]
        )
        snapshot["reviewThreads"] = connection(
            [
                {
                    "id": "old-thread",
                    "isResolved": False,
                    "path": "a.py",
                    "line": 1,
                    "comments": connection(
                        [
                            {
                                "id": "old-finding",
                                "url": "old-finding",
                                "body": "still valid",
                                "author": {
                                    "login": "coderabbitai",
                                    "__typename": "Bot",
                                },
                            }
                        ]
                    ),
                }
            ]
        )
        watcher = self.watcher()
        checks = {"ci": {"bucket": "pass", "link": "", "description": ""}}
        self.poll(snapshot, checks, watcher)
        with self.assertRaises(SystemExit) as caught:
            self.poll(snapshot, checks, watcher)
        self.assertEqual(caught.exception.code, 1)


if __name__ == "__main__":
    unittest.main()
