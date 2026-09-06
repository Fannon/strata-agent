// R-LOG reference task (issue 028): dated log aggregation over seeded logs.
// Runnable offline check AND importer of the fixture builder for later trial
// runners. No model calls.
//
// Provenance: ADAPTED from Terminal-Bench 2 `log-summary-date-ranges`
// (Apache-2.0; https://github.com/harbor-framework/terminal-bench-2/tree/main/log-summary-date-ranges).
// Adaptations: original seeded log data (upstream data lives in their docker
// image and its verifier hard-codes those counts), frozen JSON oracle instead
// of CSV output, fixed reference date per instance. Task shape kept:
// date-named files, inclusive periods, exact uppercase severity markers.
//
// Fixture rules (stated in the task prompt):
// - File date comes from the name pattern YYYY-MM-DD_*.log; only .log files
//   count; other names are ignored. Line timestamps (if any) are ignored.
// - Markers are exact uppercase [ERROR] / [WARNING] / [INFO], counted per
//   occurrence per line.
// - Periods are inclusive: today (ref date), last_7_days (ref-6..ref),
//   last_30_days (ref-29..ref), month_to_date (month start..ref),
//   total (all dated files regardless of range, including future files).
//
// Oracle: hand-derived from the fixture specification below, recomputed
// independently with plain filesystem reads in test/integration/repo-tasks.test.ts.
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { connectRepo } from "../../src/capabilities/repo/connector.ts";
import { createSession } from "../../src/session.ts";
import type { ExecutorKind } from "../../src/runtime/executor.ts";

export interface RlogTask {
  id: string;
  refDate: string;
  /** Index into FIXTURES below. */
  fixture: number;
  ask: string;
  expected: { periods: Record<string, { ERROR: number; WARNING: number; INFO: number }> };
}

const INSTANCE_1: Record<string, string> = {
  "logs/2026-02-10_app.log":
    "2026-02-10T08:00:00 [ERROR] app boot failed\n".repeat(2) +
    "2026-02-10T08:01:00 [WARNING] cache miss\n" +
    "2026-02-10T08:02:00 [INFO] listening\n".repeat(3),
  "logs/2026-02-04_db.log":
    "2026-02-04T09:00:00 [ERROR] connection refused\n" +
    "2026-02-04T09:01:00 [INFO] retrying\n".repeat(2),
  "logs/2026-01-20_old.log":
    "2026-01-20T10:00:00 [WARNING] deprecated flag\n".repeat(2) +
    "2026-01-20T10:01:00 [INFO] rotated\n",
};

const INSTANCE_2: Record<string, string> = {
  "logs/2026-02-10_app.log":
    "2026-02-10T08:00:00 [ERROR] app boot failed\n" +
    "2026-02-10T08:01:00 [error] lowercase ignored\n".repeat(5) +
    "2026-02-10T08:02:00 [INFO] listening\n",
  "logs/2026-02-15_future.log": "2026-02-15T08:00:00 [ERROR] from the future\n".repeat(9),
  "logs/notes.txt": "[ERROR] not a log file\n".repeat(3),
  "logs/2026-01-31_edge.log": "2026-01-31T23:00:00 [WARNING] month boundary\n",
};

export const RLOG_TASKS: RlogTask[] = [
  {
    id: "R-LOG-1",
    refDate: "2026-02-10",
    fixture: 0,
    ask: 'Logs live under logs/ as YYYY-MM-DD_*.log with exact [ERROR]/[WARNING]/[INFO] markers; file names give the date. Using reference date 2026-02-10, return exactly {"periods": {"today": {"ERROR","WARNING","INFO"}, "last_7_days": {...}, "last_30_days": {...}, "month_to_date": {...}, "total": {...}}}. Periods are inclusive; total covers all dated files.',
    expected: {
      periods: {
        today: { ERROR: 2, WARNING: 1, INFO: 3 },
        last_7_days: { ERROR: 3, WARNING: 1, INFO: 5 },
        last_30_days: { ERROR: 3, WARNING: 3, INFO: 6 },
        month_to_date: { ERROR: 3, WARNING: 1, INFO: 5 },
        total: { ERROR: 3, WARNING: 3, INFO: 6 },
      },
    },
  },
  {
    id: "R-LOG-2",
    refDate: "2026-02-10",
    fixture: 1,
    ask: 'Logs live under logs/ as YYYY-MM-DD_*.log with exact uppercase [ERROR]/[WARNING]/[INFO] markers (other casings do not count; non-.log files do not count). Using reference date 2026-02-10, return exactly {"periods": {"today": {"ERROR","WARNING","INFO"}, "last_7_days": {...}, "last_30_days": {...}, "month_to_date": {...}, "total": {...}}}. Periods are inclusive; total covers all dated files even outside every period.',
    expected: {
      periods: {
        today: { ERROR: 1, WARNING: 0, INFO: 1 },
        last_7_days: { ERROR: 1, WARNING: 0, INFO: 1 },
        last_30_days: { ERROR: 1, WARNING: 1, INFO: 1 },
        month_to_date: { ERROR: 1, WARNING: 0, INFO: 1 },
        total: { ERROR: 10, WARNING: 1, INFO: 1 },
      },
    },
  },
  {
    id: "R-LOG-3",
    refDate: "2026-05-01",
    fixture: 2,
    ask: 'Logs live under logs/ as YYYY-MM-DD_*.log with exact uppercase [ERROR]/[WARNING]/[INFO] markers (non-.log files do not count). Using reference date 2026-05-01, return exactly {"periods": {"today": {"ERROR","WARNING","INFO"}, "last_7_days": {...}, "last_30_days": {...}, "month_to_date": {...}, "total": {...}}}. Periods are inclusive; total covers all dated files even outside every period.',
    expected: {
      periods: {
        today: { ERROR: 1, WARNING: 1, INFO: 2 },
        last_7_days: { ERROR: 3, WARNING: 1, INFO: 3 },
        last_30_days: { ERROR: 3, WARNING: 1, INFO: 3 },
        month_to_date: { ERROR: 1, WARNING: 1, INFO: 2 },
        total: { ERROR: 3, WARNING: 4, INFO: 3 },
      },
    },
  },
  {
    id: "R-LOG-4",
    refDate: "2026-01-05",
    fixture: 3,
    ask: 'Logs live under logs/ as YYYY-MM-DD_*.log with exact uppercase [ERROR]/[WARNING]/[INFO] markers. Using reference date 2026-01-05, return exactly {"periods": {"today": {"ERROR","WARNING","INFO"}, "last_7_days": {...}, "last_30_days": {...}, "month_to_date": {...}, "total": {...}}}. Periods are inclusive across the year boundary; total covers all dated files even outside every period.',
    expected: {
      periods: {
        today: { ERROR: 1, WARNING: 0, INFO: 1 },
        last_7_days: { ERROR: 4, WARNING: 1, INFO: 1 },
        last_30_days: { ERROR: 4, WARNING: 3, INFO: 5 },
        month_to_date: { ERROR: 4, WARNING: 1, INFO: 1 },
        total: { ERROR: 4, WARNING: 3, INFO: 14 },
      },
    },
  },
];

// Instance 3 (held-out): April/May boundary. The Apr 30 file is in last_30
// but not month_to_date; the March file is total-only; README.txt is ignored.
const INSTANCE_3: Record<string, string> = {
  "logs/2026-05-01_app.log":
    "2026-05-01T08:00:00 [ERROR] boot failed\n" +
    "2026-05-01T08:01:00 [WARNING] cache miss\n" +
    "2026-05-01T08:02:00 [INFO] listening\n".repeat(2),
  "logs/2026-04-30_prev.log":
    "2026-04-30T09:00:00 [ERROR] disk full\n".repeat(2) +
    "2026-04-30T09:01:00 [INFO] cleaned\n",
  "logs/2026-03-15_old.log": "2026-03-15T10:00:00 [WARNING] deprecated\n".repeat(3),
  "logs/README.txt": "[ERROR] not a log file\n".repeat(5),
};

// Instance 4 (held-out): year boundary. The Dec 20 file is in last_30 but
// not month_to_date; the February file is future (total only).
const INSTANCE_4: Record<string, string> = {
  "logs/2026-01-05_app.log":
    "2026-01-05T08:00:00 [ERROR] boot failed\n" +
    "2026-01-05T08:01:00 [INFO] listening\n",
  "logs/2025-12-20_holiday.log":
    "2025-12-20T09:00:00 [WARNING] on call\n".repeat(2) +
    "2025-12-20T09:01:00 [INFO] quiet\n".repeat(4),
  "logs/2026-01-03_db.log":
    "2026-01-03T09:00:00 [ERROR] refused\n".repeat(3) +
    "2026-01-03T09:01:00 [WARNING] slow\n",
  "logs/2026-02-01_future.log": "2026-02-01T08:00:00 [INFO] ahead\n".repeat(9),
};

const FIXTURES = [INSTANCE_1, INSTANCE_2, INSTANCE_3, INSTANCE_4];

/** Write one instance fixture into an existing directory. */
export async function buildRlogFixture(dir: string, instance: number): Promise<Record<string, string>> {
  const files = FIXTURES[instance]!;
  for (const [name, content] of Object.entries(files)) {
    const full = join(dir, name);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, content);
  }
  return { ...files };
}

// Human-written reference composition (kept out of candidate prompts): list
// the logs directory, keep dated .log names, read each fully, bucket marker
// counts by filename date against the reference date.
const REFERENCE = `import { api } from '@c/repo';
export async function main() {
  const ref = "__REFDATE__";
  const listed = await api.listFiles({ dir: "logs", depth: 1 });
  const dated = listed.entries
    .filter((e) => e.kind === "file" && /^\\d{4}-\\d{2}-\\d{2}_.+\\.log$/.test(e.path.split("/").pop()!))
    .map((e) => e.path);
  const per: Record<string, { ERROR: number; WARNING: number; INFO: number }> = {};
  for (const path of dated) {
    const content = (await api.readText({ path })).content;
    const counts = { ERROR: 0, WARNING: 0, INFO: 0 };
    for (const line of content.split("\\n")) {
      for (const sev of ["ERROR", "WARNING", "INFO"] as const)
        if (line.includes("[" + sev + "]")) counts[sev]++;
    }
    per[path.split("/").pop()!.slice(0, 10)] = counts;
  }
  const at = (d: string) => new Date(d + "T00:00:00Z").getTime();
  const inRange = (d: string, from: string, to: string) => at(d) >= at(from) && at(d) <= at(to);
  const shift = (days: number) => new Date(at(ref) - days * 86400000).toISOString().slice(0, 10);
  const monthStart = ref.slice(0, 8) + "01";
  const ranges: Record<string, [string, string] | null> = {
    today: [ref, ref],
    last_7_days: [shift(6), ref],
    last_30_days: [shift(29), ref],
    month_to_date: [monthStart, ref],
    total: null,
  };
  const periods: Record<string, { ERROR: number; WARNING: number; INFO: number }> = {};
  for (const [period, range] of Object.entries(ranges)) {
    const total = { ERROR: 0, WARNING: 0, INFO: 0 };
    for (const [date, counts] of Object.entries(per)) {
      if (range === null || inRange(date, range[0], range[1])) {
        total.ERROR += counts.ERROR; total.WARNING += counts.WARNING; total.INFO += counts.INFO;
      }
    }
    periods[period] = total;
  }
  return { periods };
}`;

async function runReference(dir: string, engine: ExecutorKind, refDate: string) {
  const { manifest, connector } = await connectRepo({ root: dir });
  const session = await createSession(
    manifest,
    connector,
    new Set(["readText", "listFiles"]),
    { executor: engine },
  );
  try {
    const out = await session.run(REFERENCE.replace("__REFDATE__", refDate));
    if (out.error) throw new Error(`${refDate}@${engine}: ${out.error}`);
    return out.result;
  } finally {
    await session.close();
  }
}

if (import.meta.main) {
  const dir = await mkdtemp(join(tmpdir(), "strata-rlog-"));
  try {
    for (let i = 0; i < RLOG_TASKS.length; i++) {
      const task = RLOG_TASKS[i]!;
      await buildRlogFixture(dir, task.fixture);
      const quick = await runReference(dir, "quickjs", task.refDate);
      const bun = await runReference(dir, "bun", task.refDate);
      if (!isDeepStrictEqual(quick, bun))
        throw new Error(`${task.id}: engines disagree:\n${JSON.stringify({ quick, bun }, null, 2)}`);
      if (!isDeepStrictEqual(quick, task.expected))
        throw new Error(`${task.id}: unexpected answer:\n${JSON.stringify(quick, null, 2)}`);
      console.log(`ok ${task.id} (engines agree, oracle matched)`);
      const { rm: rmDir } = await import("node:fs/promises");
      for (const name of Object.keys(FIXTURES[i]!)) await rmDir(join(dir, name), { force: true });
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
