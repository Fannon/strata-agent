import { fixtureSession } from "./fixture.ts";
const session = await fixtureSession();
try {
  await Bun.write(
    new URL("../src/generated/fixture.d.ts", import.meta.url),
    session.declarations,
  );
} finally {
  await session.close();
}
