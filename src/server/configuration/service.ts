import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { chmod, copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { ToolConfigurationField, ToolManifest } from "../../tools/manifest";

const encryptedValueSchema = z.object({
  encrypted: z.literal(true),
  algorithm: z.literal("aes-256-gcm"),
  iv: z.string(),
  tag: z.string(),
  ciphertext: z.string(),
});
const storedValueSchema = z.union([z.string(), z.number(), z.boolean(), encryptedValueSchema]);
const storeSchema = z.object({ schemaVersion: z.literal(1), values: z.record(z.string(), storedValueSchema) });
type StoredValue = z.infer<typeof storedValueSchema>;
type StoredConfig = z.infer<typeof storeSchema>;

export class ToolConfigurationRequiredError extends Error {
  readonly code = "configuration_required";

  constructor(readonly missing: string[]) {
    super(`Add the required ${missing.join(", ")} configuration before running this tool.`);
  }
}

export class ToolConfigurationService {
  constructor(
    private readonly configRoot = join(homedir(), ".scriptforge", "config"),
    private readonly keyPath = join(homedir(), ".scriptforge", "secure", "master.key"),
  ) {}

  async getStatus(manifest: ToolManifest, scope = manifest.id) {
    if (manifest.configuration.length === 0) return { ready: true, fields: [] };
    const store = await this.readStore(scope);
    return {
      ready: this.missingFields(manifest.configuration, store).length === 0,
      fields: manifest.configuration.map((field) => ({
        ...field,
        configured: this.isConfigured(field, store.values[field.key]),
        ...(field.type === "secret" ? {} : { value: publicValue(field, store.values[field.key]) }),
      })),
    };
  }

  async save(
    manifest: ToolManifest,
    values: Record<string, unknown>,
    clearSecrets: string[] = [],
    scope = manifest.id,
  ) {
    const fields = new Map(manifest.configuration.map((field) => [field.key, field]));
    const unknown = [...Object.keys(values), ...clearSecrets].find((key) => !fields.has(key));
    if (unknown) throw new Error(`Unknown configuration field ${unknown}.`);

    const store = await this.readStore(scope);
    for (const key of clearSecrets) {
      if (fields.get(key)?.type !== "secret") throw new Error(`${key} is not a secret field.`);
      delete store.values[key];
    }
    for (const [key, value] of Object.entries(values)) {
      const field = fields.get(key);
      if (!field) continue;
      if (field.type === "secret") {
        if (value === undefined || value === "") continue;
        if (typeof value !== "string") throw new Error(`${field.label} must be text.`);
        store.values[key] = await this.encrypt(manifest.id, key, value);
      } else {
        store.values[key] = validateValue(field, value);
      }
    }

    await this.writeStore(scope, store);
    return this.getStatus(manifest, scope);
  }

  async resolve(manifest: ToolManifest, scope = manifest.id) {
    if (manifest.configuration.length === 0) return { config: {}, secrets: [] };
    const store = await this.readStore(scope);
    const missing = this.missingFields(manifest.configuration, store);
    if (missing.length) throw new ToolConfigurationRequiredError(missing);

    const config: Record<string, unknown> = {};
    const secrets: string[] = [];
    for (const field of manifest.configuration) {
      const stored = store.values[field.key];
      if (field.type === "secret" && encryptedValueSchema.safeParse(stored).success) {
        const value = await this.decrypt(manifest.id, field.key, stored as z.infer<typeof encryptedValueSchema>);
        config[field.key] = value;
        secrets.push(value);
      } else {
        const value = publicValue(field, stored);
        if (value !== undefined) config[field.key] = value;
      }
    }
    return { config, secrets };
  }

  async delete(scope: string) {
    await rm(this.pathFor(scope), { force: true });
  }

  async move(fromScope: string, toScope: string) {
    const source = this.pathFor(fromScope);
    try {
      await readFile(source);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    await mkdir(this.configRoot, { recursive: true, mode: 0o700 });
    await rm(this.pathFor(toScope), { force: true });
    await rename(source, this.pathFor(toScope));
  }

  async copy(fromScope: string, toScope: string) {
    const source = this.pathFor(fromScope);
    try {
      await readFile(source);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    await mkdir(this.configRoot, { recursive: true, mode: 0o700 });
    await copyFile(source, this.pathFor(toScope));
    await chmod(this.pathFor(toScope), 0o600).catch(() => undefined);
  }

  private missingFields(fields: ToolConfigurationField[], store: StoredConfig) {
    return fields
      .filter((field) => field.required && !this.isConfigured(field, store.values[field.key]))
      .map((field) => field.label);
  }

  private isConfigured(field: ToolConfigurationField, stored: StoredValue | undefined) {
    if (field.type === "secret") return encryptedValueSchema.safeParse(stored).success;
    const value = publicValue(field, stored);
    return value !== undefined && value !== "";
  }

  private async encrypt(toolId: string, fieldKey: string, value: string) {
    const key = await this.masterKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(`${toolId}\0${fieldKey}`));
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return {
      encrypted: true as const,
      algorithm: "aes-256-gcm" as const,
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
  }

  private async decrypt(toolId: string, fieldKey: string, value: z.infer<typeof encryptedValueSchema>) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", await this.masterKey(false), Buffer.from(value.iv, "base64"));
      decipher.setAAD(Buffer.from(`${toolId}\0${fieldKey}`));
      decipher.setAuthTag(Buffer.from(value.tag, "base64"));
      return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString(
        "utf8",
      );
    } catch {
      throw new Error("A saved secret could not be decrypted. Replace it in Tool configuration.");
    }
  }

  private async masterKey(create = true): Promise<Buffer> {
    const existing = await readFile(this.keyPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (existing) {
      if (existing.byteLength !== 32) throw new Error("The ScriptForge encryption key is invalid.");
      return existing;
    }
    if (!create) throw new Error("The ScriptForge encryption key is missing.");
    await mkdir(dirname(this.keyPath), { recursive: true, mode: 0o700 });
    const key = randomBytes(32);
    try {
      await writeFile(this.keyPath, key, { flag: "wx", mode: 0o600 });
      return key;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      return this.masterKey(false);
    }
  }

  private async readStore(toolId: string): Promise<StoredConfig> {
    const source = await readFile(this.pathFor(toolId), "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (!source) return { schemaVersion: 1, values: {} };
    const parsed = storeSchema.safeParse(JSON.parse(source));
    if (!parsed.success) throw new Error("The saved tool configuration is invalid.");
    return parsed.data;
  }

  private async writeStore(toolId: string, store: StoredConfig) {
    await mkdir(this.configRoot, { recursive: true, mode: 0o700 });
    const destination = this.pathFor(toolId);
    const temporary = join(this.configRoot, `.${toolId}-${randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(store, null, 2), { mode: 0o600 });
    await chmod(temporary, 0o600).catch(() => undefined);
    try {
      await rename(temporary, destination);
    } catch (error) {
      if (!new Set(["EEXIST", "EPERM"]).has((error as NodeJS.ErrnoException).code ?? "")) throw error;
      await rm(destination, { force: true });
      await rename(temporary, destination);
    }
  }

  private pathFor(scope: string) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(scope)) throw new Error("Invalid configuration scope.");
    return join(this.configRoot, `${scope}.json`);
  }
}

function publicValue(field: ToolConfigurationField, stored: StoredValue | undefined) {
  if (stored !== undefined && !encryptedValueSchema.safeParse(stored).success) return stored;
  return "defaultValue" in field ? field.defaultValue : undefined;
}

function validateValue(field: Exclude<ToolConfigurationField, { type: "secret" }>, value: unknown) {
  if (field.type === "boolean") {
    if (typeof value !== "boolean") throw new Error(`${field.label} must be on or off.`);
    return value;
  }
  if (field.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${field.label} must be a number.`);
    if (field.minimum !== undefined && value < field.minimum) throw new Error(`${field.label} is too small.`);
    if (field.maximum !== undefined && value > field.maximum) throw new Error(`${field.label} is too large.`);
    return value;
  }
  if (typeof value !== "string") throw new Error(`${field.label} must be text.`);
  if (value.length > 8_000) throw new Error(`${field.label} is too long.`);
  if (field.type === "select" && !field.options.some((option) => option.value === value)) {
    throw new Error(`Choose a valid ${field.label}.`);
  }
  return value;
}
