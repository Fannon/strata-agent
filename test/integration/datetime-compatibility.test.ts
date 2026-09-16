/** 040 — AppWorld date-time compatibility (synthetic fixture, no protected data).
 *
 * Pinned upstream declares strict `format: date-time` on response fields
 * (26 of 98 inspected operations) but serializes naive datetimes such as
 * `"2019-01-01T00:00:00"` (orm isoformat; also the form in upstream's own
 * API docstring examples). The strict global default must keep rejecting
 * that form; the boundary-scoped opt-in accepts it verbatim — never
 * inventing a timezone — while still rejecting malformed values, and it
 * must never relax agent-supplied inputs.
 */
import { test, expect } from "bun:test";
import { CapabilityBroker } from "../../src/capabilities/broker.ts";
import { validator } from "../../src/capabilities/schemas.ts";
import type {
  CapabilityConnector,
  CapabilityModule,
} from "../../src/capabilities/manifest.ts";
import { createSession } from "../../src/session.ts";
import { Workspace } from "../../src/compiler/workspace.ts";

/** Environment probe: the Workspace compiler cannot resolve its standard
 * library on Windows (041: lib.es2022.d.ts rejection despite the file
 * being present), so any program compile fails there for environmental
 * reasons. Probe once and skip session execution below on such machines;
 * validator/broker coverage above runs everywhere. Linux verification runs
 * the session test normally. */
function compilerWorks(): boolean {
  const workspace = new Workspace(
    `${"declare const console: { log(...values: unknown[]): void };"}`,
  );
  try {
    const result = workspace.compile("export async function main() { return 1; }");
    return !result.diagnostics.some((d) => d.includes("TS6053"));
  } catch {
    return false;
  } finally {
    workspace.close();
  }
}

// Minimal shape mirroring the pinned manifest (`created_at: date-time`
// inside a `response` envelope); values below are synthetic.
const outputSchema = {
  type: "object",
  properties: {
    response: {
      type: "array",
      items: {
        type: "object",
        properties: {
          playlist_id: { type: "integer" },
          created_at: { type: "string", format: "date-time" },
        },
        required: ["playlist_id", "created_at"],
        additionalProperties: false,
      },
    },
  },
  required: ["response"],
} as never;

const STRICT = "2019-01-01T00:00:00+00:00";
const STRICT_Z = "2019-01-01T00:00:00Z";
const NAIVE = "2019-01-01T00:00:00"; // upstream orm isoformat form
const NAIVE_FRAC = "2019-01-01T00:00:00.123456"; // isoformat with microseconds
const MALFORMED = [
  "not-a-date",
  "2019-13-01T00:00:00", // month out of range
  "2019-01-01", // date without time
  "2019-01-01 00:00:00", // space separator is not ISO `T` form
  "2019-01-01T24:00:00", // hour out of range
  "",
];

function payload(createdAt: string) {
  return { response: [{ playlist_id: 1, created_at: createdAt }] };
}

test("strict global default accepts RFC 3339 and rejects naive upstream form", () => {
  const check = validator(outputSchema);
  expect(check(payload(STRICT))).toBeUndefined();
  expect(check(payload(STRICT_Z))).toBeUndefined();
  const naiveError = check(payload(NAIVE));
  expect(typeof naiveError).toBe("string");
  expect(naiveError).toContain('format "date-time"');
  for (const bad of MALFORMED) {
    expect(check(payload(bad))).toContain('format "date-time"');
  }
});

test("boundary opt-in accepts naive verbatim, keeps strict + rejects malformed", () => {
  const check = validator(outputSchema, { acceptNaiveDateTime: true });
  expect(check(payload(STRICT))).toBeUndefined();
  expect(check(payload(STRICT_Z))).toBeUndefined();
  expect(check(payload(NAIVE))).toBeUndefined();
  expect(check(payload(NAIVE_FRAC))).toBeUndefined();
  for (const bad of MALFORMED) {
    expect(check(payload(bad))).toContain('format "date-time"');
  }
});

function stubModule(): CapabilityModule {
  return {
    id: "compat",
    operations: [
      {
        name: "show_things",
        inputSchema: {
          type: "object",
          properties: {
            since: { type: "string", format: "date-time" },
          },
          required: [],
        },
        outputSchema,
      },
    ],
  };
}

function stubConnector(reply: unknown): CapabilityConnector {
  return {
    backend: "test",
    async invoke() {
      const text = JSON.stringify(reply);
      return { structured: reply, untyped: reply, rawBytes: Buffer.byteLength(text) };
    },
    async close() {},
  };
}

async function invokeOutput(
  acceptNaiveDateTime: boolean | undefined,
  reply: unknown,
): Promise<string | undefined> {
  const broker = new CapabilityBroker(
    stubModule(),
    stubConnector(reply),
    new Set(["show_things"]),
    acceptNaiveDateTime === undefined ? {} : { acceptNaiveDateTime },
  );
  const metrics = {
    sourceBytes: 0,
    compileMs: 0,
    diagnostics: [] as string[],
    executionMs: 0,
    capabilityCalls: 0,
    calls: [] as never[],
    rawCapabilityBytes: 0,
    bytesExposedToPi: 0,
    validationFailures: 0,
    policyFailures: 0,
    engine: "quickjs",
    programId: "test:datetime",
    outcome: "error" as const,
    traceDropped: 0,
  };
  try {
    const result = (await broker.invoke(
      "compat",
      "show_things",
      {},
      AbortSignal.timeout(5000),
      metrics as never,
    )) as unknown;
    // Value preservation: the naive string passes through unchanged.
    expect(result).toEqual(reply);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

test("broker outputs: strict rejects naive, opt-in accepts it unchanged", async () => {
  const strictError = await invokeOutput(undefined, payload(NAIVE));
  expect(strictError).toContain("output");
  expect(await invokeOutput(false, payload(NAIVE))).toContain("output");
  expect(await invokeOutput(true, payload(NAIVE))).toBeUndefined();
  expect(await invokeOutput(true, payload(STRICT))).toBeUndefined();
  expect(await invokeOutput(true, payload("not-a-date"))).toContain("output");
});

test("broker inputs stay strict even with the output opt-in", async () => {
  const broker = new CapabilityBroker(
    stubModule(),
    stubConnector(payload(NAIVE)),
    new Set(["show_things"]),
    { acceptNaiveDateTime: true },
  );
  const metrics = {
    sourceBytes: 0,
    compileMs: 0,
    diagnostics: [] as string[],
    executionMs: 0,
    capabilityCalls: 0,
    calls: [] as never[],
    rawCapabilityBytes: 0,
    bytesExposedToPi: 0,
    validationFailures: 0,
    policyFailures: 0,
    engine: "quickjs",
    programId: "test:datetime-input",
    outcome: "error" as const,
    traceDropped: 0,
  };
  // A naive agent-supplied input must fail input validation, not pass
  // through the output compatibility gate.
  const error = await broker
    .invoke(
      "compat",
      "show_things",
      { since: NAIVE },
      AbortSignal.timeout(5000),
      metrics as never,
    )
    .then(() => undefined)
    .catch((e: unknown) => (e instanceof Error ? e.message : String(e)));
  expect(error).toContain("input");
  // Strict agent input still passes and the naive output is accepted.
  const ok = (await broker.invoke(
    "compat",
    "show_things",
    { since: STRICT },
    AbortSignal.timeout(5000),
    metrics as never,
  )) as unknown;
  expect(ok).toEqual(payload(NAIVE));
});

test.if(compilerWorks())("session validation option reaches output validators", async () => {
  const reply = payload(NAIVE);
  const module = stubModule();
  const allowed = new Set(["show_things"]);
  const strict = await createSession(module, stubConnector(reply), allowed, {});
  try {
    const result = await strict.run(
      `import { api } from "@cap/compat";\nexport async function main() { return await api.show_things({}); }`,
    );
    expect(result.metrics.outcome).toBe("error");
  } finally {
    await strict.close();
  }
  const compat = await createSession(module, stubConnector(reply), allowed, {
    validation: { acceptNaiveDateTime: true },
  });
  try {
    const result = await compat.run(
      `import { api } from "@cap/compat";\nexport async function main() { return await api.show_things({}); }`,
    );
    expect(result.metrics.outcome).toBe("ok");
  } finally {
    await compat.close();
  }
});
