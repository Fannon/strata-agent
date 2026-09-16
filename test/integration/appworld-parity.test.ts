/** 042 gate-3 offline parity: direct reference arm agrees with the typed
 * broker on visibility, validation and failure categories (fake backend,
 * no network). Live backend parity runs through the controller's direct
 * mode against fresh worlds; see the 042 issue and parity table.
 */
import { test, expect } from "bun:test";
import { CapabilityBroker } from "../../src/capabilities/broker.ts";
import {
  resolveRefs,
  runDirectCalls,
} from "../../examples/appworld/direct.ts";
import type {
  CapabilityConnector,
  CapabilityModule,
} from "../../src/capabilities/manifest.ts";

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

const inputSchema = {
  type: "object",
  properties: {
    access_token: { type: "string", minLength: 1 },
    since: { type: "string", format: "date-time" },
  },
  required: ["access_token"],
} as never;

function stubModule(): CapabilityModule {
  return {
    id: "parity",
    operations: [
      { name: "show_things", inputSchema, outputSchema },
      { name: "other_op", inputSchema: { type: "object", properties: {} } },
    ],
  };
}

function reply(createdAt: string) {
  return { response: [{ playlist_id: 1, created_at: createdAt }] };
}

/** Fake backend keyed by scenario: what the "server" returns. */
function stubConnector(scenario: {
  payload?: unknown;
  isError?: boolean;
  throws?: boolean;
}): CapabilityConnector {
  return {
    backend: "test",
    async invoke() {
      if (scenario.throws) throw new Error("boom");
      const body = scenario.payload ?? {};
      return {
        structured: body,
        untyped: body,
        ...(scenario.isError ? { isError: true as const } : {}),
        rawBytes: Buffer.byteLength(JSON.stringify(body)),
      };
    },
    async close() {},
  };
}

function metrics() {
  return {
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
    programId: "test:parity",
    outcome: "error" as const,
    traceDropped: 0,
  };
}

async function brokerOutcome(
  scenario: Parameters<typeof stubConnector>[0],
  input: Record<string, unknown>,
  options: { acceptNaiveDateTime?: boolean; allowed?: Set<string> } = {},
): Promise<{ ok: boolean; failure?: string; value?: unknown }> {
  const broker = new CapabilityBroker(
    stubModule(),
    stubConnector(scenario),
    options.allowed ?? new Set(["show_things", "other_op"]),
    options.acceptNaiveDateTime === true ? { acceptNaiveDateTime: true } : {},
  );
  try {
    const value = (await broker.invoke(
      "parity",
      "show_things",
      input,
      AbortSignal.timeout(5000),
      metrics() as never,
    )) as unknown;
    return { ok: true, value };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failure = message.includes(": policy:")
      ? "policy"
      : message.includes(": input:")
        ? "input"
        : message.includes(": output:")
          ? "output"
          : "transport";
    return { ok: false, failure };
  }
}

const GOOD_INPUT = { access_token: "tok" };

test("arms agree across the validation matrix", async () => {
  const cases: Array<{
    name: string;
    scenario: Parameters<typeof stubConnector>[0];
    input: Record<string, unknown>;
    naive: boolean;
  }> = [
    { name: "strict output", scenario: { payload: reply("2019-01-01T00:00:00+00:00") }, input: GOOD_INPUT, naive: false },
    { name: "naive output", scenario: { payload: reply("2019-01-01T00:00:00") }, input: GOOD_INPUT, naive: true },
    { name: "malformed output", scenario: { payload: reply("not-a-date") }, input: GOOD_INPUT, naive: true },
    { name: "missing required input", scenario: { payload: reply("2019-01-01T00:00:00+00:00") }, input: {}, naive: false },
    { name: "naive input stays strict", scenario: { payload: reply("2019-01-01T00:00:00+00:00") }, input: { ...GOOD_INPUT, since: "2019-01-01T00:00:00" }, naive: true },
    { name: "isError is transport", scenario: { payload: reply("2019-01-01T00:00:00+00:00"), isError: true }, input: GOOD_INPUT, naive: false },
    { name: "throw is transport", scenario: { throws: true }, input: GOOD_INPUT, naive: false },
  ];
  for (const setting of [false, true]) {
    for (const c of cases) {
      const broker = await brokerOutcome(c.scenario, c.input, { acceptNaiveDateTime: setting });
      const direct = await runDirectCalls(
        stubModule(),
        stubConnector(c.scenario),
        [{ op: "show_things", input: c.input }],
        setting ? { outputFormats: { acceptNaiveDateTime: true } } : {},
      );
      const d = direct.calls[0];
      expect({ ...broker, setting, case: c.name }).toEqual({
        ok: d.ok,
        ...(d.ok ? { value: direct.results[0] } : { failure: d.failure }),
        setting,
        case: c.name,
      });
      if (d.ok) expect(direct.results[0]).toEqual(broker.value);
    }
  }
});

test("arms agree on allowlist denial without invoking", async () => {
  const allowed = new Set(["other_op"]);
  const broker = await brokerOutcome(
    { payload: reply("2019-01-01T00:00:00+00:00") },
    GOOD_INPUT,
    { allowed, acceptNaiveDateTime: true },
  );
  expect(broker.ok).toBe(false);
  expect(broker.failure).toBe("policy");
  let invoked = false;
  const connector: CapabilityConnector = {
    backend: "test",
    async invoke() {
      invoked = true;
      return { structured: {}, untyped: {}, rawBytes: 2 };
    },
    async close() {},
  };
  const direct = await runDirectCalls(
    stubModule(),
    connector,
    [{ op: "show_things", input: GOOD_INPUT }],
    { allowed, outputFormats: { acceptNaiveDateTime: true } },
  );
  expect(direct.calls[0].failure).toBe("policy");
  expect(direct.calls[0].invoked).toBe(false);
  expect(invoked).toBe(false);
});

test("resolveRefs wires runtime values between calls", () => {
  const results = [{ response: { access_token: "tok", nested: [{ id: 7 }] } }];
  expect(resolveRefs({ t: { $call: 0, $path: "response.access_token" } }, results)).toEqual({
    t: "tok",
  });
  expect(resolveRefs([{ $call: 0, $path: "response.nested.0.id" }], results)).toEqual([7]);
  expect(resolveRefs({ plain: 1, text: "x" }, results)).toEqual({ plain: 1, text: "x" });
  expect(() => resolveRefs({ $call: 5, $path: "response" }, results)).toThrow("no result yet");
  expect(() => resolveRefs({ $call: 0, $path: "response.missing" }, results)).toThrow("not found");
});

test("$select filters and projects runtime lists", () => {
  const results = [
    { response: [
      { account_name: "gmail", password: "pw1" },
      { account_name: "spotify", password: "pw2" },
    ] },
  ];
  const sel = (where: unknown) => ({
    $select: { call: 0, path: "response", where, get: "password" },
  });
  expect(resolveRefs(sel({ account_name: "spotify" }), results)).toBe("pw2");
  expect(resolveRefs(sel({ account_name: "~SPOT" }), results)).toBe("pw2");
  expect(() => resolveRefs(sel({ account_name: "venmo" }), results)).toThrow("no matching");
  expect(() => resolveRefs(sel("nope"), results)).toThrow("must be an object");
  expect(() => resolveRefs({ $select: { call: 0 } }, results)).toThrow("$select needs");
});
