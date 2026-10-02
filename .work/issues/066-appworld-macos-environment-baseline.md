# 066 — Reconcile the rebuilt macOS AppWorld dependency baseline

Status: DEFERRED, not selected. Discovered during authorized 065 environment preflight.
Dependencies: pinned upstream AppWorld `42b5bcf3cd334fee33f0c37c02070a9f5807add5`; independent of production Strata's 050 Bun baseline.

The rebuilt Python 3.11.16 environment resolves unbounded upstream dependencies to SQLModel 0.0.47, Pydantic 2.13.5 and Pendulum 3.2.0. Broad upstream verification is not green: cached failure IDs include 17 Amazon, 18 background-server, two SQLModel, two AppWorld and one common-system case. This is a failure-ID inventory, not an aggregate test-result count; the original enormous output was truncated. Local-server tests ran under sandbox restrictions, so those permission failures do not establish application defects. Selected AppWorld API servers require local socket permission.

Grader preflight also found `Song.find_one().delete()` failing with a missing Pydantic private-attribute map. The selected login/read paths and supervisor submission work; this does not certify the full environment. 065 uses positive/negative upstream answer controls and independent full-row state comparisons, including a direct-SQL mutation control. No upstream dependency patch or broad test repair belongs to that read-only study.

If selected, isolate dependency/date failures from sandbox failures, choose a reproducible supported dependency set, rerun affected upstream tests with local-server permission, and publish exact counts and limits. Preserve the ignored original environment lock and preflight evidence. Do not silently change dependency pins midway through a frozen campaign.
