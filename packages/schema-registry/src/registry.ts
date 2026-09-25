import type { MorphArtifact, ParseLimits } from "@morph/core";
import {
  canonicalJsonText,
  irNodeToJsonCompatible,
  parseJsonStrict,
  sanitizeJsonCompatible,
  sanitizeSchema,
  sha256Text,
} from "@morph/core";
import {
  type SchemaBundleId,
  type SchemaBundleVerification,
  type SchemaGuideBundle,
  type SchemaGuideBundleInput,
  type SchemaGuideRegistry,
  SchemaRegistryError,
  type SchemaRegistryIssue,
  type SchemaRegistryLimits,
  type SchemaRegistryStats,
} from "./types.js";

export const DEFAULT_SCHEMA_REGISTRY_LIMITS: SchemaRegistryLimits = Object.freeze({
  maxEntries: 128,
  maxEntryBytes: 5 * 1024 * 1024,
  maxTotalBytes: 32 * 1024 * 1024,
});

const BUNDLE_VERSION = "morph-schema-guide-bundle/1" as const;
const CANONICALIZATION_VERSION = "morph-registry-c14n/1" as const;
const ID_PATTERN = /^sha256:([0-9a-f]{64})$/;
const encoder = new TextEncoder();

const BUNDLE_FIELDS = new Set([
  "bundleVersion",
  "bundleId",
  "contentDigest",
  "canonicalBytes",
  "modelDependencies",
]);
const DIGEST_FIELDS = new Set(["algorithm", "canonicalizationVersion", "value"]);
const DEPENDENCY_FIELDS = new Set([
  "schema",
  "dictionaries",
  "interpretationGuideId",
  "interpretationGuideVersion",
  "interpretationGuideText",
]);

function issue(
  code: string,
  message: string,
  path?: string,
  details?: Readonly<Record<string, unknown>>,
): SchemaRegistryIssue {
  return {
    code,
    message,
    ...(path === undefined ? {} : { path }),
    ...(details === undefined ? {} : { details }),
  };
}

function fail(
  code: string,
  message: string,
  path?: string,
  details?: Readonly<Record<string, unknown>>,
): never {
  throw new SchemaRegistryError(issue(code, message, path, details));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function dataRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    fail("REGISTRY_INVALID_BUNDLE", "Expected an ordinary object.", path);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") {
      fail("REGISTRY_INVALID_BUNDLE", "Symbol properties are not supported.", path);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      fail(
        "REGISTRY_INVALID_BUNDLE",
        "Accessor and non-enumerable properties are not supported.",
        path,
      );
    }
  }
  return value;
}

function ownValue(record: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

function assertOnlyFields(
  record: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      fail(
        "REGISTRY_INVALID_BUNDLE",
        "The bundle contains an unsupported field.",
        `${path}/${key}`,
      );
    }
  }
}

function requiredString(record: Record<string, unknown>, key: string, path: string): string {
  const value = ownValue(record, key);
  if (typeof value !== "string" || value.length === 0) {
    fail("REGISTRY_INVALID_BUNDLE", `${key} must be a nonempty string.`, `${path}/${key}`);
  }
  return value;
}

function normalizeLimit(value: number | undefined, fallback: number, name: string): number {
  const selected = value ?? fallback;
  if (!Number.isSafeInteger(selected) || selected < 1) {
    fail("REGISTRY_INVALID_LIMIT", `${name} must be a positive safe integer.`);
  }
  return selected;
}

export function normalizeSchemaRegistryLimits(
  limits: Partial<SchemaRegistryLimits> = {},
): SchemaRegistryLimits {
  return Object.freeze({
    maxEntries: normalizeLimit(
      limits.maxEntries,
      DEFAULT_SCHEMA_REGISTRY_LIMITS.maxEntries,
      "maxEntries",
    ),
    maxEntryBytes: normalizeLimit(
      limits.maxEntryBytes,
      DEFAULT_SCHEMA_REGISTRY_LIMITS.maxEntryBytes,
      "maxEntryBytes",
    ),
    maxTotalBytes: normalizeLimit(
      limits.maxTotalBytes,
      DEFAULT_SCHEMA_REGISTRY_LIMITS.maxTotalBytes,
      "maxTotalBytes",
    ),
  });
}

function freezeJson(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) {
    for (const item of value) freezeJson(item);
    return Object.freeze(value);
  }
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    if ("value" in descriptor) freezeJson(descriptor.value);
  }
  return Object.freeze(value);
}

function normalizeDependencies(input: SchemaGuideBundleInput): MorphArtifact["modelDependencies"] {
  const inputRecord = dataRecord(input, "");
  assertOnlyFields(inputRecord, DEPENDENCY_FIELDS, "");
  const interpretationGuideId = requiredString(inputRecord, "interpretationGuideId", "");
  const interpretationGuideVersion = requiredString(inputRecord, "interpretationGuideVersion", "");
  const guideTextValue = ownValue(inputRecord, "interpretationGuideText");
  if (typeof guideTextValue !== "string") {
    fail(
      "REGISTRY_INVALID_BUNDLE",
      "interpretationGuideText must be a string.",
      "/interpretationGuideText",
    );
  }
  const schemaValue = ownValue(inputRecord, "schema");
  const dictionariesValue = ownValue(inputRecord, "dictionaries");
  if (Object.hasOwn(inputRecord, "schema") && schemaValue === undefined) {
    fail("REGISTRY_DEPENDENCY_INVALID", "schema cannot be explicitly undefined.", "/schema");
  }
  if (Object.hasOwn(inputRecord, "dictionaries") && dictionariesValue === undefined) {
    fail(
      "REGISTRY_DEPENDENCY_INVALID",
      "dictionaries cannot be explicitly undefined.",
      "/dictionaries",
    );
  }
  if (dictionariesValue !== undefined && !Array.isArray(dictionariesValue)) {
    fail("REGISTRY_INVALID_BUNDLE", "dictionaries must be an array.", "/dictionaries");
  }

  let schema: unknown;
  let dictionaries: unknown[] | undefined;
  try {
    schema = schemaValue === undefined ? undefined : sanitizeSchema(schemaValue);
    dictionaries =
      dictionariesValue === undefined
        ? undefined
        : (sanitizeJsonCompatible(dictionariesValue) as unknown[]);
  } catch {
    fail(
      "REGISTRY_DEPENDENCY_INVALID",
      "Schema and dictionary dependencies must be bounded, self-contained JSON-compatible data.",
    );
  }
  const dependencies: MorphArtifact["modelDependencies"] = {
    ...(schema === undefined ? {} : { schema }),
    ...(dictionaries === undefined ? {} : { dictionaries }),
    interpretationGuideId,
    interpretationGuideVersion,
    interpretationGuideText: guideTextValue,
  };
  return freezeJson(dependencies) as MorphArtifact["modelDependencies"];
}

function contentText(dependencies: MorphArtifact["modelDependencies"]): string {
  return canonicalJsonText({
    bundleVersion: BUNDLE_VERSION,
    modelDependencies: dependencies,
  });
}

export function isSchemaBundleId(value: string): value is SchemaBundleId {
  return ID_PATTERN.test(value);
}

export function assertSchemaBundleId(value: string): asserts value is SchemaBundleId {
  if (!isSchemaBundleId(value)) {
    fail(
      "REGISTRY_INVALID_ID",
      "A registry bundle identifier must be sha256 followed by 64 lowercase hexadecimal characters.",
    );
  }
}

export function createSchemaGuideBundle(input: SchemaGuideBundleInput): SchemaGuideBundle {
  const modelDependencies = normalizeDependencies(input);
  const canonical = contentText(modelDependencies);
  const digest = sha256Text(canonical);
  const bundle: SchemaGuideBundle = {
    bundleVersion: BUNDLE_VERSION,
    bundleId: `sha256:${digest}`,
    contentDigest: {
      algorithm: "sha256",
      canonicalizationVersion: CANONICALIZATION_VERSION,
      value: digest,
    },
    canonicalBytes: encoder.encode(canonical).byteLength,
    modelDependencies,
  };
  return freezeJson(bundle) as SchemaGuideBundle;
}

export function serializeSchemaGuideBundle(bundle: SchemaGuideBundle): string {
  const verified = assertValidSchemaGuideBundle(bundle);
  return canonicalJsonText(verified);
}

function parseLimits(maxInputBytes: number): Partial<ParseLimits> {
  return {
    maxInputBytes,
    maxDepth: 128,
    maxNodes: 250_000,
  };
}

export function parseSchemaGuideBundle(
  text: string,
  options: { readonly maxInputBytes?: number } = {},
): SchemaGuideBundle {
  if (typeof text !== "string") {
    fail("REGISTRY_INVALID_BUNDLE", "The serialized bundle must be text.");
  }
  const maxInputBytes = normalizeLimit(
    options.maxInputBytes,
    DEFAULT_SCHEMA_REGISTRY_LIMITS.maxEntryBytes,
    "maxInputBytes",
  );
  let value: unknown;
  try {
    value = irNodeToJsonCompatible(parseJsonStrict(text, parseLimits(maxInputBytes)).root);
  } catch (error) {
    if (error instanceof SchemaRegistryError) throw error;
    fail("REGISTRY_INVALID_BUNDLE", "The serialized bundle is not valid canonical JSON data.");
  }
  return assertValidSchemaGuideBundle(value);
}

export function verifySchemaGuideBundle(value: unknown): SchemaBundleVerification {
  try {
    const bundle = assertValidSchemaGuideBundle(value);
    return {
      valid: true,
      bundleId: bundle.bundleId,
      canonicalBytes: bundle.canonicalBytes,
      errors: [],
    };
  } catch (error) {
    if (error instanceof SchemaRegistryError) {
      return { valid: false, errors: [error.issue] };
    }
    return {
      valid: false,
      errors: [issue("REGISTRY_INVALID_BUNDLE", "The bundle could not be validated.")],
    };
  }
}

export function assertValidSchemaGuideBundle(value: unknown): SchemaGuideBundle {
  const root = dataRecord(value, "");
  assertOnlyFields(root, BUNDLE_FIELDS, "");
  if (ownValue(root, "bundleVersion") !== BUNDLE_VERSION) {
    fail("REGISTRY_UNSUPPORTED_BUNDLE_VERSION", "Only morph-schema-guide-bundle/1 is supported.");
  }
  const bundleIdValue = requiredString(root, "bundleId", "");
  assertSchemaBundleId(bundleIdValue);
  const digestRecord = dataRecord(ownValue(root, "contentDigest"), "/contentDigest");
  assertOnlyFields(digestRecord, DIGEST_FIELDS, "/contentDigest");
  if (
    ownValue(digestRecord, "algorithm") !== "sha256" ||
    ownValue(digestRecord, "canonicalizationVersion") !== CANONICALIZATION_VERSION
  ) {
    fail("REGISTRY_UNSUPPORTED_DIGEST", "The bundle digest configuration is unsupported.");
  }
  const digestValue = requiredString(digestRecord, "value", "/contentDigest");
  if (!/^[0-9a-f]{64}$/.test(digestValue)) {
    fail("REGISTRY_INVALID_BUNDLE", "The content digest must be lowercase SHA-256 hexadecimal.");
  }
  const canonicalBytesValue = ownValue(root, "canonicalBytes");
  if (!Number.isSafeInteger(canonicalBytesValue) || (canonicalBytesValue as number) < 0) {
    fail("REGISTRY_INVALID_BUNDLE", "canonicalBytes must be a nonnegative safe integer.");
  }
  const dependenciesRecord = dataRecord(ownValue(root, "modelDependencies"), "/modelDependencies");
  assertOnlyFields(dependenciesRecord, DEPENDENCY_FIELDS, "/modelDependencies");
  const expected = createSchemaGuideBundle({
    ...(Object.hasOwn(dependenciesRecord, "schema")
      ? { schema: ownValue(dependenciesRecord, "schema") }
      : {}),
    ...(Object.hasOwn(dependenciesRecord, "dictionaries")
      ? { dictionaries: ownValue(dependenciesRecord, "dictionaries") as readonly unknown[] }
      : {}),
    interpretationGuideId: requiredString(
      dependenciesRecord,
      "interpretationGuideId",
      "/modelDependencies",
    ),
    interpretationGuideVersion: requiredString(
      dependenciesRecord,
      "interpretationGuideVersion",
      "/modelDependencies",
    ),
    interpretationGuideText: (() => {
      const guide = ownValue(dependenciesRecord, "interpretationGuideText");
      if (typeof guide !== "string") {
        fail(
          "REGISTRY_INVALID_BUNDLE",
          "interpretationGuideText must be a string.",
          "/modelDependencies/interpretationGuideText",
        );
      }
      return guide;
    })(),
  });
  if (
    expected.bundleId !== bundleIdValue ||
    expected.contentDigest.value !== digestValue ||
    expected.canonicalBytes !== canonicalBytesValue
  ) {
    fail("REGISTRY_DIGEST_MISMATCH", "The bundle content does not match its content address.");
  }
  return expected;
}

export function schemaBundleStorageBytes(bundle: SchemaGuideBundle): number {
  return encoder.encode(serializeSchemaGuideBundle(bundle)).byteLength;
}

export function modelDependenciesDigest(dependencies: MorphArtifact["modelDependencies"]): string {
  const normalized = normalizeDependencies(dependencies);
  return sha256Text(canonicalJsonText(normalized));
}

export class InMemorySchemaRegistry implements SchemaGuideRegistry {
  readonly #limits: SchemaRegistryLimits;
  readonly #entries = new Map<SchemaBundleId, { readonly text: string; readonly bytes: number }>();
  #totalBytes = 0;

  constructor(limits: Partial<SchemaRegistryLimits> = {}) {
    this.#limits = normalizeSchemaRegistryLimits(limits);
  }

  async register(input: SchemaGuideBundleInput): Promise<SchemaGuideBundle> {
    const bundle = createSchemaGuideBundle(input);
    await this.put(bundle);
    return bundle;
  }

  async put(bundle: SchemaGuideBundle): Promise<void> {
    const verified = assertValidSchemaGuideBundle(bundle);
    if (this.#entries.has(verified.bundleId)) return;
    const text = serializeSchemaGuideBundle(verified);
    const bytes = encoder.encode(text).byteLength;
    if (bytes > this.#limits.maxEntryBytes) {
      fail(
        "REGISTRY_ENTRY_TOO_LARGE",
        "The bundle exceeds the configured entry byte limit.",
        undefined,
        {
          maxEntryBytes: this.#limits.maxEntryBytes,
          entryBytes: bytes,
        },
      );
    }
    if (this.#entries.size >= this.#limits.maxEntries) {
      fail("REGISTRY_LIMIT_EXCEEDED", "The registry entry limit has been reached.", undefined, {
        maxEntries: this.#limits.maxEntries,
      });
    }
    if (this.#totalBytes + bytes > this.#limits.maxTotalBytes) {
      fail(
        "REGISTRY_LIMIT_EXCEEDED",
        "The registry total byte limit would be exceeded.",
        undefined,
        {
          maxTotalBytes: this.#limits.maxTotalBytes,
        },
      );
    }
    this.#entries.set(verified.bundleId, { text, bytes });
    this.#totalBytes += bytes;
  }

  async resolve(bundleId: string): Promise<SchemaGuideBundle | undefined> {
    assertSchemaBundleId(bundleId);
    const entry = this.#entries.get(bundleId);
    if (entry === undefined) return undefined;
    const bundle = parseSchemaGuideBundle(entry.text, {
      maxInputBytes: this.#limits.maxEntryBytes,
    });
    if (bundle.bundleId !== bundleId) {
      fail(
        "REGISTRY_DIGEST_MISMATCH",
        "The stored bundle does not match the requested identifier.",
      );
    }
    return bundle;
  }

  async has(bundleId: string): Promise<boolean> {
    assertSchemaBundleId(bundleId);
    return this.#entries.has(bundleId);
  }

  async listIds(): Promise<readonly SchemaBundleId[]> {
    return [...this.#entries.keys()].sort();
  }

  async delete(bundleId: string): Promise<boolean> {
    assertSchemaBundleId(bundleId);
    const entry = this.#entries.get(bundleId);
    if (entry === undefined) return false;
    this.#entries.delete(bundleId);
    this.#totalBytes -= entry.bytes;
    return true;
  }

  async stats(): Promise<SchemaRegistryStats> {
    return {
      ...this.#limits,
      entryCount: this.#entries.size,
      totalBytes: this.#totalBytes,
    };
  }
}
