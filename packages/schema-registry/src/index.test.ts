import {
  createArtifact,
  type MorphArtifact,
  parseJsonStrict,
  verifyArtifactIntegrity,
} from "@morph/core";
import { describe, expect, it } from "vitest";
import {
  createRegistryArtifactReference,
  createSchemaGuideBundle,
  hydrateArtifact,
  InMemorySchemaRegistry,
  type SchemaGuideBundleInput,
  SchemaRegistryError,
  verifySchemaGuideBundle,
} from "./index.js";

const GUIDE = {
  interpretationGuideId: "guide.rows",
  interpretationGuideVersion: "1",
  interpretationGuideText: "Read each row using the declared fields.",
} as const;

function exampleArtifact(): MorphArtifact {
  const ir = parseJsonStrict('{"id":"c1","amount":1.2300}');
  return createArtifact({
    ir,
    plan: { encoding: "json-compact", formatVersion: "1", options: {} },
    section: {
      encoding: "json-compact",
      formatVersion: "1",
      payload: '{"id":"c1","amount":1.2300}',
      layoutMetadata: { root: "json" },
      interpretationGuideId: GUIDE.interpretationGuideId,
    },
    plannerPolicy: "compatibility",
    target: {
      profileId: "local-test",
      tokenizerId: "test-tokenizer",
      tokenizerRevision: "fixture-1",
    },
    task: { instruction: "Find the amount for c1." },
    schema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        amount: { type: "number", description: "Exact invoice amount." },
      },
    },
    guideId: GUIDE.interpretationGuideId,
    guideVersion: GUIDE.interpretationGuideVersion,
    guideText: GUIDE.interpretationGuideText,
  });
}

describe("schema and guide bundles", () => {
  it("uses deterministic content addresses independent of object insertion order", () => {
    const first = createSchemaGuideBundle({
      ...GUIDE,
      schema: { type: "object", title: "Customer" },
    });
    const second = createSchemaGuideBundle({
      ...GUIDE,
      schema: { title: "Customer", type: "object" },
    });

    expect(first.bundleId).toBe(second.bundleId);
    expect(first.contentDigest.value).toBe(second.contentDigest.value);
    expect(first.bundleId).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("rejects tampered content rather than trusting its declared digest", () => {
    const bundle = createSchemaGuideBundle({ ...GUIDE, schema: { type: "string" } });
    const tampered = JSON.parse(JSON.stringify(bundle)) as Record<string, unknown>;
    const dependencies = tampered.modelDependencies as Record<string, unknown>;
    dependencies.interpretationGuideText = "Changed after hashing.";

    const verification = verifySchemaGuideBundle(tampered);
    expect(verification.valid).toBe(false);
    expect(verification.errors[0]?.code).toBe("REGISTRY_DIGEST_MISMATCH");
  });

  it("rejects nonlocal schema references without fetching them", () => {
    expect(() =>
      createSchemaGuideBundle({
        ...GUIDE,
        schema: { $ref: "https://example.invalid/schema.json" },
      }),
    ).toThrow();
  });

  it("rejects explicit undefined dependencies instead of silently omitting them", () => {
    expect(() =>
      createSchemaGuideBundle({
        ...GUIDE,
        schema: undefined,
      } as unknown as SchemaGuideBundleInput),
    ).toThrowError(SchemaRegistryError);
  });
});

describe("InMemorySchemaRegistry", () => {
  it("stores verified text and returns a verified independent bundle", async () => {
    const registry = new InMemorySchemaRegistry();
    const bundle = await registry.register({
      ...GUIDE,
      schema: { type: "array", items: { type: "string" } },
      dictionaries: [["US", "CA"]],
    });

    const resolved = await registry.resolve(bundle.bundleId);
    expect(resolved).toEqual(bundle);
    expect(await registry.has(bundle.bundleId)).toBe(true);
    expect(await registry.listIds()).toEqual([bundle.bundleId]);
    expect((await registry.stats()).entryCount).toBe(1);
  });

  it("fails closed at configured entry bounds", async () => {
    const registry = new InMemorySchemaRegistry({
      maxEntries: 1,
      maxEntryBytes: 1024 * 1024,
      maxTotalBytes: 1024 * 1024,
    });
    await registry.register({ ...GUIDE, schema: { title: "one" } });

    await expect(registry.register({ ...GUIDE, schema: { title: "two" } })).rejects.toMatchObject<
      Partial<SchemaRegistryError>
    >({
      issue: { code: "REGISTRY_LIMIT_EXCEEDED", message: expect.any(String) },
    });
  });

  it("rejects URL and traversal text as an identifier", async () => {
    const registry = new InMemorySchemaRegistry();
    await expect(registry.resolve("https://example.invalid/schema.json")).rejects.toMatchObject({
      issue: { code: "REGISTRY_INVALID_ID" },
    });
    await expect(registry.resolve("sha256:../../outside")).rejects.toMatchObject({
      issue: { code: "REGISTRY_INVALID_ID" },
    });
  });
});

describe("artifact hydration", () => {
  it("reconstructs a self-contained artifact and verifies its dependencies", async () => {
    const artifact = exampleArtifact();
    const bundle = createSchemaGuideBundle(artifact.modelDependencies);
    const registry = new InMemorySchemaRegistry();
    await registry.put(bundle);
    const reference = createRegistryArtifactReference(artifact, bundle);

    expect(reference).not.toHaveProperty("artifact.modelDependencies");
    const hydrated = await hydrateArtifact(reference, registry);

    expect(hydrated.dependencyMode).toBe("self-contained");
    expect(hydrated.modelDependencies).toEqual(artifact.modelDependencies);
    expect(verifyArtifactIntegrity(hydrated)).toMatchObject({
      valid: true,
      checksum: "passed",
      dependencies: "complete",
    });
  });

  it("does not hydrate a reference from a bundle with different meaning", async () => {
    const artifact = exampleArtifact();
    const correctBundle = createSchemaGuideBundle(artifact.modelDependencies);
    const reference = createRegistryArtifactReference(artifact, correctBundle);
    const registry = new InMemorySchemaRegistry();
    const differentBundle = await registry.register({
      ...GUIDE,
      interpretationGuideText: "A different guide.",
      schema: artifact.modelDependencies.schema,
    });
    const alteredReference = { ...reference, dependencyBundleId: differentBundle.bundleId };

    await expect(hydrateArtifact(alteredReference, registry)).rejects.toMatchObject({
      issue: { code: "REGISTRY_DEPENDENCY_MISMATCH" },
    });
  });
});
