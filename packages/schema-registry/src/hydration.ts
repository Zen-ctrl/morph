import {
  canonicalJsonText,
  type MorphArtifact,
  parseArtifactJson,
  toMorphError,
  verifyArtifactIntegrity,
} from "@morph/core";
import {
  assertSchemaBundleId,
  assertValidSchemaGuideBundle,
  modelDependenciesDigest,
} from "./registry.js";
import {
  type RegistryArtifactReference,
  type RegistryReferencedArtifactBody,
  type SchemaGuideBundle,
  type SchemaGuideRegistry,
  SchemaRegistryError,
} from "./types.js";

function fail(code: string, message: string): never {
  throw new SchemaRegistryError({ code, message });
}

export function createRegistryArtifactReference(
  artifact: MorphArtifact,
  bundle: SchemaGuideBundle,
): RegistryArtifactReference {
  let normalizedArtifact: MorphArtifact;
  try {
    normalizedArtifact = parseArtifactJson(canonicalJsonText(artifact));
  } catch (error) {
    const cause = toMorphError(error);
    throw new SchemaRegistryError({
      code: "REGISTRY_ARTIFACT_INVALID",
      message: "The source artifact is not a valid self-contained artifact.",
      details: { causeCode: cause.code },
    });
  }
  if (normalizedArtifact.dependencyMode !== "self-contained") {
    fail(
      "REGISTRY_ARTIFACT_NOT_SELF_CONTAINED",
      "Only a self-contained artifact can create a registry reference.",
    );
  }
  const artifactVerification = verifyArtifactIntegrity(normalizedArtifact);
  if (!artifactVerification.valid) {
    fail("REGISTRY_ARTIFACT_INVALID", "The source artifact failed integrity verification.");
  }
  const verifiedBundle = assertValidSchemaGuideBundle(bundle);
  const artifactDependencyDigest = modelDependenciesDigest(normalizedArtifact.modelDependencies);
  const bundleDependencyDigest = modelDependenciesDigest(verifiedBundle.modelDependencies);
  if (
    artifactDependencyDigest !== bundleDependencyDigest ||
    normalizedArtifact.integrity.dependenciesDigest !== bundleDependencyDigest
  ) {
    fail(
      "REGISTRY_DEPENDENCY_MISMATCH",
      "The registry bundle does not contain the artifact's exact model dependencies.",
    );
  }
  const {
    modelDependencies: _modelDependencies,
    dependencyMode: _dependencyMode,
    ...artifactBody
  } = normalizedArtifact;
  return {
    referenceVersion: "morph-registry-reference/1",
    dependencyBundleId: verifiedBundle.bundleId,
    artifact: artifactBody,
  };
}

function validateReference(reference: RegistryArtifactReference): {
  readonly artifact: RegistryReferencedArtifactBody;
  readonly dependencyBundleId: RegistryArtifactReference["dependencyBundleId"];
} {
  let normalized: unknown;
  try {
    normalized = JSON.parse(canonicalJsonText(reference)) as unknown;
  } catch {
    fail(
      "REGISTRY_INVALID_REFERENCE",
      "The registry reference must be bounded JSON-compatible data.",
    );
  }
  if (
    typeof normalized !== "object" ||
    normalized === null ||
    Array.isArray(normalized) ||
    !("referenceVersion" in normalized) ||
    normalized.referenceVersion !== "morph-registry-reference/1"
  ) {
    fail("REGISTRY_INVALID_REFERENCE", "Only morph-registry-reference/1 is supported.");
  }
  const keys = Object.keys(normalized).sort();
  if (
    keys.length !== 3 ||
    keys[0] !== "artifact" ||
    keys[1] !== "dependencyBundleId" ||
    keys[2] !== "referenceVersion"
  ) {
    fail("REGISTRY_INVALID_REFERENCE", "The registry reference contains unsupported fields.");
  }
  if (!("dependencyBundleId" in normalized) || typeof normalized.dependencyBundleId !== "string") {
    fail("REGISTRY_INVALID_REFERENCE", "The registry reference is missing its bundle identifier.");
  }
  assertSchemaBundleId(normalized.dependencyBundleId);
  if (
    !("artifact" in normalized) ||
    typeof normalized.artifact !== "object" ||
    normalized.artifact === null
  ) {
    fail("REGISTRY_INVALID_REFERENCE", "The registry reference is missing its artifact body.");
  }
  const artifact = normalized.artifact as RegistryReferencedArtifactBody;
  if (artifact.artifactVersion !== "morph-artifact/1") {
    fail("REGISTRY_INVALID_REFERENCE", "The referenced artifact version is unsupported.");
  }
  return {
    artifact,
    dependencyBundleId:
      normalized.dependencyBundleId as RegistryArtifactReference["dependencyBundleId"],
  };
}

export async function hydrateArtifact(
  reference: RegistryArtifactReference,
  registry: SchemaGuideRegistry,
): Promise<MorphArtifact> {
  const validatedReference = validateReference(reference);
  const artifactBody = validatedReference.artifact;
  const bundle = await registry.resolve(validatedReference.dependencyBundleId);
  if (bundle === undefined) {
    fail(
      "REGISTRY_BUNDLE_NOT_FOUND",
      "The referenced schema and guide bundle is not available locally.",
    );
  }
  const verifiedBundle = assertValidSchemaGuideBundle(bundle);
  const dependenciesDigest = modelDependenciesDigest(verifiedBundle.modelDependencies);
  if (dependenciesDigest !== artifactBody.integrity.dependenciesDigest) {
    fail(
      "REGISTRY_DEPENDENCY_MISMATCH",
      "The resolved bundle does not match the artifact's dependency digest.",
    );
  }
  const hydratedValue: MorphArtifact = {
    ...artifactBody,
    modelDependencies: verifiedBundle.modelDependencies,
    dependencyMode: "self-contained",
  };
  let hydrated: MorphArtifact;
  try {
    hydrated = parseArtifactJson(canonicalJsonText(hydratedValue));
  } catch (error) {
    const cause = toMorphError(error);
    throw new SchemaRegistryError({
      code: "REGISTRY_HYDRATION_FAILED",
      message: "The hydrated artifact is not a valid self-contained artifact.",
      details: { causeCode: cause.code },
    });
  }
  const verification = verifyArtifactIntegrity(hydrated);
  if (!verification.valid || verification.dependencies !== "complete") {
    fail(
      "REGISTRY_HYDRATION_FAILED",
      "The hydrated artifact failed self-contained integrity verification.",
    );
  }
  return hydrated;
}
