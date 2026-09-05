# Project workflow

Use `.work/issues/index.md` as the local Markdown issue board for plans, questions, research and fixes. `.work/` is intentionally gitignored; `README.md` and `ARCHITECTURE.md` describe the shipped project.

When the user drops ideas or questions for later, capture them in separate Markdown issues and update the index with a proposed working order and dependencies. Do not research or implement them just because they have been captured.

Write up newly discovered substantial follow-up work on the board instead of silently expanding the current task. Proceed with an issue when the user explicitly selects or authorizes it. Complete small, directly requested changes normally. Preserve this distinction across turns.

If the local board is missing in a fresh checkout, recreate its folder and index when needed; do not infer that previously proposed issues were authorized. Keep issue status, hypotheses, decisions and completion criteria explicit.
