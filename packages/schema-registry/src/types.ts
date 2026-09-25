import type { MorphArtifact } from "@morph/core";

export type SchemaBundleId = `sha256:${string}`;

export interface SchemaGuideBundleInput {
  readonly schema?: unknown;
  readonly dictionaries?: readonly unknown[];
  readonly interpretationGuideId: string;
  readonly interpretationGuideVersion: string;
  readonly interpretationGuideText: string;
}

export interface SchemaGuideBundle {
  readonly bundleVersion: "morph-schema-guide-bundle/1";
  readonly bundleId: SchemaBundleId;
  readonly contentDigest: {
    readonly algorithm: "sha256";
    readonly canonicalizationVersion: "morph-registry-c14n/1";
    readonly value: string;
  };
  readonly canonicalBytes: number;
  readonly modelDependencies: MorphArtifact["modelDependencies"];
}

export interface SchemaRegistryLimits {
  readonly maxEntries: number;
  readonly maxEntryBytes: number;
  readonly maxTotalBytes: number;
}

export interface SchemaRegistryStats extends SchemaRegistryLimits {
  readonly entryCount: number;
  readonly totalBytes: number;
}

export interface SchemaBundleVerification {
  readonly valid: boolean;
  readonly bundleId?: SchemaBundleId;
  readonly canonicalBytes?: number;
  readonly errors: readonly SchemaRegistryIssue[];
}

export interface SchemaRegistryIssue {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface SchemaGuideRegistry {
  register(input: SchemaGuideBundleInput): Promise<SchemaGuideBundle>;
  put(bundle: SchemaGuideBundle): Promise<void>;
  resolve(bundleId: string): Promise<SchemaGuideBundle | undefined>;
  has(bundleId: string): Promise<boolean>;
  listIds(): Promise<readonly SchemaBundleId[]>;
  delete(bundleId: string): Promise<boolean>;
  stats(): Promise<SchemaRegistryStats>;
}

export type RegistryReferencedArtifactBody = Omit<
  MorphArtifact,
  "modelDependencies" | "dependencyMode"
>;

export interface RegistryArtifactReference {
  readonly referenceVersion: "morph-registry-reference/1";
  readonly dependencyBundleId: SchemaBundleId;
  readonly artifact: RegistryReferencedArtifactBody;
}

export class SchemaRegistryError extends Error {
  readonly issue: SchemaRegistryIssue;

  constructor(issue: SchemaRegistryIssue) {
    super(issue.message);
    this.name = "SchemaRegistryError";
    this.issue = issue;
  }
}
