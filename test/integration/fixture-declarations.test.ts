import { test, expect, beforeAll } from "bun:test";
import { readFile } from "node:fs/promises";
import { fixtureSession } from "../../examples/fixture.ts";

// Checked-in declarations must match what the fixture server generates.
// If this fails, run `bun run generate` and commit the result.
let declarations: string;
beforeAll(async () => {
  const session = await fixtureSession();
  try {
    declarations = session.declarations;
  } finally {
    await session.close();
  }
});

test("checked-in fixture declarations match generated output", async () => {
  const checkedIn = await readFile(
    new URL("../../src/generated/fixture.d.ts", import.meta.url),
    "utf8",
  );
  expect(declarations).toBe(checkedIn);
});
