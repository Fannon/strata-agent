import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSession } from "../../src/session.ts";
import { connectRepo } from "../../src/capabilities/repo/connector.ts";
import type { ExecutorKind } from "../../src/runtime/executor.ts";

let dir = "";

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "strata-ranges-"));
  const numbered = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`);
  await writeFile(join(dir, "ten.txt"), numbered.join("\n") + "\n");
  await writeFile(join(dir, "crlf.txt"), "a\r\nb\r\nc\r\n");
  await writeFile(join(dir, "empty.txt"), "");
  await writeFile(join(dir, "noeol.txt"), "one\ntwo");
  await writeFile(join(dir, "blob.bin"), Buffer.from([0x89, 0x50, 0x00, 0xff]));
});

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

const sessionFor = async (engine: ExecutorKind, policy = {}) => {
  const { manifest, connector } = await connectRepo({ root: dir, ...policy });
  return createSession(manifest, connector, new Set(["readText"]), { executor: engine });
};
const program = (body: string) =>
  `import { api } from '@c/repo';\nexport async function main() { ${body} }`;

for (const engine of ["quickjs", "bun"] as const) {
  test(`ranges: middle window reports nextLine on ${engine}`, async () => {
    const session = await sessionFor(engine);
    try {
      const r = await session.run(
        program(`return await api.readText({ path: "ten.txt", fromLine: 3, maxLines: 4 });`),
      );
      expect(r.error).toBeUndefined();
      expect(r.result).toEqual({
        path: "ten.txt",
        content: "line 3\nline 4\nline 5\nline 6",
        truncated: true,
        totalBytes: 71,
        startLine: 3,
        endLine: 6,
        nextLine: 7,
      });
    } finally {
      await session.close();
    }
  });

  test(`ranges: tail to EOF has no nextLine on ${engine}`, async () => {
    const session = await sessionFor(engine);
    try {
      const r = await session.run(
        program(`return await api.readText({ path: "ten.txt", fromLine: 8 });`),
      );
      expect(r.error).toBeUndefined();
      expect(r.result).toEqual({
        path: "ten.txt",
        content: "line 8\nline 9\nline 10",
        truncated: false,
        totalBytes: 71,
        startLine: 8,
        endLine: 10,
      });
    } finally {
      await session.close();
    }
  });

  test(`ranges: beyond EOF returns empty without error on ${engine}`, async () => {
    const session = await sessionFor(engine);
    try {
      const r = await session.run(
        program(`return await api.readText({ path: "ten.txt", fromLine: 99 });`),
      );
      expect(r.error).toBeUndefined();
      expect(r.result).toEqual({
        path: "ten.txt",
        content: "",
        truncated: false,
        totalBytes: 71,
        startLine: 99,
        endLine: 98,
      });
    } finally {
      await session.close();
    }
  });

  test(`ranges: CRLF stripped, empty and unterminated files on ${engine}`, async () => {
    const session = await sessionFor(engine);
    try {
      const crlf = await session.run(
        program(`return await api.readText({ path: "crlf.txt", fromLine: 1, maxLines: 10 });`),
      );
      expect(crlf.error).toBeUndefined();
      expect(crlf.result).toMatchObject({ content: "a\nb\nc", startLine: 1, endLine: 3 });
      const crlfFull = await session.run(
        program(`return await api.readText({ path: "crlf.txt" });`),
      );
      expect(crlfFull.error).toBeUndefined();
      // Unranged reads preserve exact bytes, including CRLF endings.
      expect(crlfFull.result).toMatchObject({ content: "a\r\nb\r\nc\r\n", truncated: false });
      const empty = await session.run(
        program(`return await api.readText({ path: "empty.txt" });`),
      );
      expect(empty.error).toBeUndefined();
      expect(empty.result).toMatchObject({ content: "", startLine: 1, endLine: 0, truncated: false });
      const noeol = await session.run(
        program(`return await api.readText({ path: "noeol.txt", fromLine: 2 });`),
      );
      expect(noeol.error).toBeUndefined();
      expect(noeol.result).toMatchObject({ content: "two", startLine: 2, endLine: 2, truncated: false });
    } finally {
      await session.close();
    }
  });

  test(`ranges: invalid bounds rejected, binary still refused on ${engine}`, async () => {
    const session = await sessionFor(engine);
    try {
      for (const args of [`{ path: "ten.txt", fromLine: 0 }`, `{ path: "ten.txt", maxLines: 0 }`]) {
        const r = await session.run(program(`return await api.readText(${args});`));
        expect(r.error ?? "").toContain("input");
        expect(r.metrics.calls[0]?.failure).toBe("input");
      }
      const bin = await session.run(
        program(`return await api.readText({ path: "blob.bin", fromLine: 2, maxLines: 2 });`),
      );
      expect(bin.error).toBeDefined();
    } finally {
      await session.close();
    }
  });
}

test("ranges: policy maxReadLines clamps oversized requests", async () => {
  const session = await sessionFor("quickjs", { maxReadLines: 5 });
  try {
    const r = await session.run(
      program(`return await api.readText({ path: "ten.txt", maxLines: 100 });`),
    );
    expect(r.error).toBeUndefined();
    expect(r.result).toMatchObject({
      content: "line 1\nline 2\nline 3\nline 4\nline 5",
      startLine: 1,
      endLine: 5,
      nextLine: 6,
      truncated: true,
    });
  } finally {
    await session.close();
  }
});
