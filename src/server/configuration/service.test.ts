// @vitest-environment node

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { toolManifestSchema } from "../../tools/manifest";
import { ToolConfigurationRequiredError, ToolConfigurationService } from "./service";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("tool configuration", () => {
  it("encrypts secrets, exposes only their status, and resolves runner values", async () => {
    const root = await temporaryRoot();
    const service = new ToolConfigurationService(join(root, "config"), join(root, "secure", "master.key"));
    const manifest = configuredManifest();

    await expect(service.resolve(manifest)).rejects.toBeInstanceOf(ToolConfigurationRequiredError);
    await service.save(manifest, { username: "maya", accessToken: "top-secret-token" });

    const stored = await readFile(join(root, "config", "social-tool.json"), "utf8");
    expect(stored).toContain("maya");
    expect(stored).not.toContain("top-secret-token");
    expect(await readFile(join(root, "secure", "master.key"))).toHaveLength(32);
    await expect(service.getStatus(manifest)).resolves.toMatchObject({
      ready: true,
      fields: [
        { key: "username", configured: true, value: "maya" },
        { key: "accessToken", configured: true },
        { key: "notifications", configured: true, value: true },
      ],
    });
    await expect(service.resolve(manifest)).resolves.toEqual({
      config: { username: "maya", accessToken: "top-secret-token", notifications: true },
      secrets: ["top-secret-token"],
    });
  });

  it("preserves a blank submitted secret, supports replacement, and deletes the vault", async () => {
    const root = await temporaryRoot();
    const configRoot = join(root, "config");
    const service = new ToolConfigurationService(configRoot, join(root, "secure", "master.key"));
    const manifest = configuredManifest();
    await service.save(manifest, { username: "maya", accessToken: "first" });
    await service.save(manifest, { username: "new-name", accessToken: "" });
    expect((await service.resolve(manifest)).config).toMatchObject({ accessToken: "first" });
    await service.save(manifest, { accessToken: "second" });
    expect((await service.resolve(manifest)).config).toMatchObject({ accessToken: "second" });
    await expect(service.save(manifest, {}, ["accessToken"])).resolves.toMatchObject({ ready: false });
    await expect(service.resolve(manifest)).rejects.toThrow("Access token");

    await service.delete(manifest.id);
    await expect(service.getStatus(manifest)).resolves.toMatchObject({ ready: false });
  });

  it("isolates candidate configuration and transfers it only after save", async () => {
    const root = await temporaryRoot();
    const service = new ToolConfigurationService(join(root, "config"), join(root, "secure", "master.key"));
    const manifest = configuredManifest();
    await service.save(manifest, { username: "installed", accessToken: "installed-secret" });

    await expect(service.getStatus(manifest, "candidate-session-one")).resolves.toMatchObject({ ready: false });
    await service.save(
      manifest,
      { username: "candidate", accessToken: "candidate-secret" },
      [],
      "candidate-session-one",
    );
    expect((await service.resolve(manifest)).config).toMatchObject({ accessToken: "installed-secret" });
    expect((await service.resolve(manifest, "candidate-session-one")).config).toMatchObject({
      accessToken: "candidate-secret",
    });

    await service.move("candidate-session-one", "saved-social-tool");
    expect((await service.resolve(manifest, "saved-social-tool")).config).toMatchObject({
      accessToken: "candidate-secret",
    });
  });
});

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), "scriptforge-config-"));
  roots.push(root);
  return root;
}

function configuredManifest() {
  return toolManifestSchema.parse({
    schemaVersion: 1,
    id: "social-tool",
    version: "1.0.0",
    name: "Social Tool",
    description: "Uses a private account token.",
    category: "Social",
    icon: "share",
    script: "run.mjs",
    interface: { type: "html", entry: "ui.html" },
    requiredExecutables: [],
    configuration: [
      { key: "username", label: "Username", type: "text", required: true },
      { key: "accessToken", label: "Access token", type: "secret", required: true },
      { key: "notifications", label: "Notifications", type: "boolean", defaultValue: true },
    ],
  });
}
