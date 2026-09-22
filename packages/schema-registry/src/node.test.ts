import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { SchemaRegistryError } from "./index.js";
import { FileSystemSchemaRegistry } from "./node.js";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "morph-schema-registry-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const GUIDE = {
  interpretationGuideId: "guide.test",
  interpretationGuideVersion: "1",
  interpretationGuideText: "Interpret this synthetic fixture.",
} as const;

describe("FileSystemSchemaRegistry", () => {
  it("writes and resolves a content-addressed bundle locally", async () => {
    const directory = await temporaryDirectory();
    const registry = new FileSystemSchemaRegistry({ directory });
    const bundle = await registry.register({
      ...GUIDE,
      schema: { type: "object", properties: { id: { type: "string" } } },
    });

    expect(await registry.resolve(bundle.bundleId)).toEqual(bundle);
    expect(await registry.listIds()).toEqual([bundle.bundleId]);
    expect(await registry.stats()).toMatchObject({ entryCount: 1 });
  });

  it("detects a file whose contents were changed after registration", async () => {
    const directory = await temporaryDirectory();
    const registry = new FileSystemSchemaRegistry({ directory });
    const bundle = await registry.register({ ...GUIDE, schema: { type: "string" } });
    const path = join(directory, `${bundle.bundleId.slice("sha256:".length)}.bundle.json`);
    const value = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    const dependencies = value.modelDependencies as Record<string, unknown>;
    dependencies.interpretationGuideText = "Tampered.";
    await writeFile(path, JSON.stringify(value), "utf8");

    await expect(registry.resolve(bundle.bundleId)).rejects.toMatchObject<
      Partial<SchemaRegistryError>
    >({
      issue: { code: "REGISTRY_DIGEST_MISMATCH", message: expect.any(String) },
    });
  });

  it("enforces a bounded number of local entries", async () => {
    const directory = await temporaryDirectory();
    const registry = new FileSystemSchemaRegistry({
      directory,
      maxEntries: 1,
      maxEntryBytes: 1024 * 1024,
      maxTotalBytes: 1024 * 1024,
    });
    await registry.register({ ...GUIDE, schema: { title: "one" } });
    await expect(registry.register({ ...GUIDE, schema: { title: "two" } })).rejects.toMatchObject({
      issue: { code: "REGISTRY_LIMIT_EXCEEDED" },
    });
  });
});
