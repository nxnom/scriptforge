import { createServer } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { selectPort } from "./port";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("selectPort", () => {
  it("uses the preferred port when available", async () => {
    const port = await selectPort(0);
    expect(port).toBeGreaterThan(0);
  });

  it("falls back when the preferred port is occupied", async () => {
    const server = createServer().listen(0, "127.0.0.1");
    servers.push(server);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP address");

    const selected = await selectPort(address.port);
    expect(selected).not.toBe(address.port);
    expect(selected).toBeGreaterThan(0);
  });
});
