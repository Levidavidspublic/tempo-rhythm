# WALK — Search gateway setting declaration

22 October 2026. Adds only blank TEMPO_SEARCH_SERVICE_URL after gateway #1267. Distinct from TEMPO_SEARCH_UPSTREAM_URL; existing dedicated credential name unchanged. No actual environment value, runtime, schema, provider call or deployment changed. KB-16 validates and consumes it separately.

UNKNOWN: actual branch mandatory install/lint/typecheck/tests/scans/local Playwright/build, CI and CodeRabbit. No behavioral mirror test for a blank declaration. Full validation remains required.
