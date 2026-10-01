import { test, expect } from "bun:test";
import { createSession } from "../../src/session.ts";
import { RecoveryLedger, evidence } from "../../src/recovery.ts";
import { DeniedError, bytes, type CapabilityConnector } from "../../src/capabilities/manifest.ts";
import { manifest, makeWorld } from "../../examples/checking/fixture.ts";

const source = (body: string) => `import {api} from '@c/pilot'; export async function main(){${body}}`;
const all = new Set(manifest.operations.map(op => op.name));
async function withSession(fn: (session: Awaited<ReturnType<typeof createSession>>, world: ReturnType<typeof makeWorld>) => Promise<void>) {
  const world = makeWorld();
  const session = await createSession(manifest, world.connector, all);
  try { await fn(session, world); } finally { await session.close(); }
}

test("052: missing/possibly missing root returns are rejected before a payment; inferred JSON remains usable", async () => {
  await withSession(async (session, world) => {
    for (const body of [
      "await api.recordPayment({invoiceId:'i1',amountCents:123}); console.log('done');",
      "await api.recordPayment({invoiceId:'i1',amountCents:123}); if(Math.random()>0.5) return {ok:true};",
      "await api.recordPayment({invoiceId:'i1',amountCents:123}); return 1n;",
      "await api.recordPayment({invoiceId:'i1',amountCents:123}); return () => 1;",
    ]) {
      const report = await session.run(source(body));
      expect(report.metrics.outcome).toBe("compile-error");
      expect(report.metrics.capabilityCalls).toBe(0);
      expect(report.metrics.diagnostics.join()).toContain("main() must return a JSON result");
    }
    expect(world.payments).toHaveLength(1);
    for (const body of ["return null;", "return [1,'x',{ok:true}];", "const value:unknown={ok:true};return value;"])
      expect((await session.run(source(body))).metrics.outcome).toBe("ok");
    // Assertions/any cannot be statically guaranteed; the runtime still checks.
    const runtime = await session.run(source("return undefined as any;"));
    expect(runtime.metrics.outcome).toBe("error");
    expect(runtime.error).toContain("JSON result");
  });
});

test("explicit finalization preserves exact JSON and refuses old, failed, expired and previous-request results", async () => {
  await withSession(async (session) => {
    session.beginTurn();
    const report = await session.run(source("return {quoted:'a\\\"b',empty:null,nested:[false,0,'é']};"));
    // Mutating the public report cannot change the retained answer.
    (report.result as any).empty = "tampered";
    const selected = session.selectResult(report.program);
    expect(JSON.parse(selected.json)).toEqual({quoted:'a"b',empty:null,nested:[false,0,'é']});
    expect(session.consumeSelection()).toEqual(selected);
    expect(session.consumeSelection()).toBeUndefined();
    session.selectResult(report.program);
    const failed = await session.run(source("throw new Error('later failure');"));
    expect(session.consumeSelection()).toBeUndefined();
    expect(() => session.selectResult(report.program)).toThrow("latest successful");
    expect(() => session.selectResult(failed.program)).toThrow("latest successful");
    const next = await session.run(source("return 42;"));
    session.selectResult(next.program);
    session.invalidateResults();
    expect(session.consumeSelection()).toBeUndefined();
    expect(() => session.selectResult(next.program)).toThrow();
    const current = await session.run(source("return false;"));
    session.beginTurn();
    expect(() => session.selectResult(current.program)).toThrow();
    for (let i=0;i<21;i++) await session.run(source("return 0;"));
    expect(() => session.selectResult(current.program)).toThrow();
    expect(() => session.effects(current.program)).toThrow("expired");
  });
});

test("receipts distinguish the new payment from an older payment, survive later failures and guide state inspection", async () => {
  await withSession(async (session, world) => {
    session.beginTurn();
    const payment = await session.run(source("return await api.recordPayment({invoiceId:'i1',amountCents:123});"));
    const r = session.effects();
    expect(r.confirmed).toBe(1);
    expect(r.receipts[0]?.input?.value).toEqual({invoiceId:'i1',amountCents:123});
    expect((r.receipts[0]?.response?.value as any).payment.id).toBe("p1");
    expect(r.receipts[0]?.call).toBe(`${payment.program}.1`);
    expect(r.inspection[0]?.operations).toContain("listPayments");
    expect(world.payments.map(p=>p.id)).toEqual(["p0","p1"]);
    const failed = await session.run(source("return api.recordPayment({invoiceId:'i1',amountCents:'wrong'});"));
    expect(failed.metrics.outcome).toBe("compile-error");
    expect(JSON.parse(failed.text).recovery.confirmed).toBe(1);
    expect(world.payments).toHaveLength(2);
    expect(session.effects().confirmed).toBe(1);
    expect(JSON.stringify(failed.metrics)).not.toContain('"amountCents"');
    session.beginTurn();
    expect(session.effects().total).toBe(0);
    expect(session.effects(payment.program).confirmed).toBe(1);
  });
});

test("confirmed payment remains observable after an execution/result failure", async () => {
  await withSession(async (session, world) => {
    const r = await session.run(source("await api.recordPayment({invoiceId:'i1',amountCents:123}); return 'x'.repeat(10000);"));
    expect(r.metrics.outcome).toBe("error");
    expect(session.effects(r.program).confirmed).toBe(1);
    expect(world.payments).toHaveLength(2);
    expect(() => session.selectResult(r.program)).toThrow();
  });
});

for (const mode of ["input", "policy", "denied", "transport", "output", "unknown-metadata"] as const) {
  test(`receipt outcome ${mode} does not falsely certify an uncertain effect`, async () => {
    const world = makeWorld();
    const connector: CapabilityConnector = { ...world.connector, async invoke(op, input, signal) {
      if (mode === "denied") throw new DeniedError("before effect");
      const result = await world.connector.invoke(op,input,signal);
      if (mode === "transport") throw new Error("lost reply after payment");
      if (mode === "output") return {structured:{payment:{bad:true}},untyped:{},rawBytes:2};
      return result;
    }};
    const meta = mode === "unknown-metadata" ? {...manifest,operations:manifest.operations.map(o=>({...o,metadata:undefined}))} : manifest;
    const session = await createSession(meta,connector,mode === "policy" ? new Set(["listPayments"]) : all);
    try {
      const report = await session.run(source(`return await api.recordPayment({invoiceId:'i1',amountCents:${mode === "input" ? -1 : 123}});`));
      const receipt = session.effects(report.program).receipts[0]!;
      expect(receipt.status).toBe(["input","policy","denied"].includes(mode) ? "not-executed" : mode === "unknown-metadata" ? "confirmed" : "uncertain");
      expect(world.payments).toHaveLength(["input","policy","denied"].includes(mode) ? 1 : 2);
      if (mode === "unknown-metadata") expect(receipt.effect).toBe("unknown");
      if (mode === "output" || mode === "transport") expect(receipt.response).toBeUndefined();
    } finally { await session.close(); }
  });
}

test("cancellation preserves acknowledged earlier calls and leaves the pending payment uncertain", async () => {
  const world = makeWorld();
  let entered!: () => void, release!: () => void;
  const waiting = new Promise<void>(resolve=>entered=resolve);
  const held = new Promise<void>(resolve=>release=resolve);
  let writes=0;
  const connector: CapabilityConnector = { ...world.connector, async invoke(op,input,signal) {
    const result=await world.connector.invoke(op,input,signal);
    if (op === "recordPayment" && ++writes === 2) { entered(); await held; }
    return result;
  }};
  const session=await createSession(manifest,connector,all);
  const abort=new AbortController();
  try {
    const running=session.run(source("await api.recordPayment({invoiceId:'i1',amountCents:123}); return await api.recordPayment({invoiceId:'i2',amountCents:456});"),{signal:abort.signal});
    await waiting;
    expect(()=>session.selectResult("anything")).toThrow("still running");
    abort.abort();
    const report=await running;
    const r=session.effects(report.program);
    expect(report.metrics.outcome).toBe("cancelled");
    expect(report.metrics.calls[0]?.failure).toBeUndefined();
    expect(r.receipts.map(r=>r.status)).toEqual(["confirmed","uncertain"]);
    expect(world.payments).toHaveLength(3);
    release();
    await new Promise(resolve=>setTimeout(resolve,10));
    expect(session.effects(report.program).receipts.map(r=>r.status)).toEqual(["confirmed","uncertain"]);
  } finally { release(); await session.close(); }
});

test("receipt pagination and evidence retention stay bounded without dropping action identities", () => {
  const ledger=new RecoveryLedger();ledger.start("s:p1",1);
  for(let i=0;i<100;i++) ledger.record({call:`s:p1.${i}`,program:"s:p1",capability:"c",operation:"write",effect:"write",status:"confirmed",input:evidence({key:i,note:"é".repeat(2000)}),response:evidence({id:i,note:"x".repeat(2000)})});
  ledger.finish("s:p1");
  const first=ledger.page("s:p1",0);
  expect(first.total).toBe(100);expect(first.receipts).toHaveLength(5);expect(first.nextOffset).toBe(5);
  let count=0,evidenceBytes=0;
  for(let offset=0;offset<100;offset+=5) for(const receipt of ledger.page("s:p1",0,offset).receipts){count++;evidenceBytes+=bytes([receipt.input,receipt.response]);}
  expect(count).toBe(100);expect(evidenceBytes).toBeLessThan(34000);
  expect(ledger.page("s:p1",0,95).nextOffset).toBeNull();
  expect(()=>ledger.page("s:p1",0,-1)).toThrow();
  ledger.page("s:p1",0).receipts[0]!.status="uncertain";
  expect(ledger.page("s:p1",0).receipts[0]?.status).toBe("confirmed");
  for(let i=2;i<=21;i++) ledger.start(`s:p${i}`,i);
  expect(()=>ledger.page("s:p1",0)).toThrow("expired");
  expect(ledger.page(undefined,0).historyIncomplete).toBe(true);
  expect(ledger.page(undefined,20).historyIncomplete).toBe(false);
});


test("an acknowledged operation without an output schema explicitly records unvalidated response evidence", async () => {
  const world=makeWorld();
  const noOutput={...manifest,operations:manifest.operations.map(op=>op.name==='recordPayment'?{...op,outputSchema:undefined}:op)};
  const session=await createSession(noOutput,world.connector,all);
  try {
    const report=await session.run(source("return await api.recordPayment({invoiceId:'i1',amountCents:123});"));
    expect(report.error).toBeUndefined();
    const receipt=session.effects(report.program).receipts[0]!;
    expect(receipt.status).toBe('confirmed');expect(receipt.responseValidated).toBe(false);
    expect((receipt.response?.value as any).payment.id).toBe('p1');
  } finally {await session.close();}
});
