# Project workflow

Use `.work/issues/index.md` as the tracked Markdown issue board for plans, questions, research and fixes. `.work/issues/` is checked in; other `.work/` contents are intentionally ignored. Keep raw transcripts, profiles, credentials and generated fixtures local. `README.md` and `ARCHITECTURE.md` describe the shipped project; `docs/handoff.md` is the canonical next-agent handoff.

When the user drops ideas or questions for later, capture them in separate Markdown issues and update the index with a proposed working order and dependencies. Do not research or implement them just because they have been captured.

Write up newly discovered substantial follow-up work on the board instead of silently expanding the current task. Proceed with an issue when the user explicitly selects or authorizes it. Complete small, directly requested changes normally. Preserve this distinction across turns.

Every benchmark comparison must include sample size and distinct task count, success and effect correctness, model requests/turns, tokens, elapsed time and estimated cost. Define turns as model requests and report capability invocations separately. Include failed attempts in averages and cost per success; separate input/output/cache/reasoning tokens when available, and never count reasoning twice. Mark unavailable measurements explicitly. Pair success claims with speed and cost, and preserve primary grading when showing supplementary diagnostics.

If the tracked board is missing, check the branch/history before recreating it; do not infer that previously proposed issues were authorized. Keep issue status, hypotheses, decisions and completion criteria explicit.
