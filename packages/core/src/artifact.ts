import { sha256Text } from "./canonical.js";
import { fail, morphError } from "./errors.js";
import { irNodeToJsonCompatible, parseJsonStrict } from "./ir.js";
import { canonicalJsonText, sanitizeSchema } from "./schema.js";
import type {
  EncodedSection,
  EncoderPlan,
  MorphArtifact,
  MorphIR,
  MorphTask,
  PlannerPolicy,
  TargetProfile,
  VerificationReport,
} from "./types.js";

export interface ArtifactInput {
  readonly ir: MorphIR;
  readonly plan: EncoderPlan;
  readonly section: EncodedSection;
  readonly plannerPolicy: PlannerPolicy;
  readonly target: TargetProfile;
  readonly task: MorphTask;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly schema?: unknown;
  readonly guideId: string;
  readonly guideVersion: string;
  readonly guideText: string;
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("INVALID_ARTIFACT", `${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function stringField(value: unknown, field: string): string {
  if (typeof value !== "string") fail("INVALID_ARTIFACT", `${field} must be a string.`);
  return value;
}

function digestField(value: unknown, field: string): string {
  const digest = stringField(value, field);
  if (!/^[0-9a-f]{64}$/.test(digest)) {
    fail("INVALID_ARTIFACT", `${field} must be lowercase SHA-256 hexadecimal.`);
  }
  return digest;
}

function exactFields(
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
  field: string,
): void {
  const allowedSet = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unsupported.length > 0) {
    fail("INVALID_ARTIFACT", `${field} contains unsupported fields.`, field, {
      unsupportedFields: unsupported,
    });
  }
}

function optionalString(
  value: Readonly<Record<string, unknown>>,
  key: string,
  field: string,
): string | undefined {
  if (!Object.hasOwn(value, key)) return undefined;
  return stringField(value[key], `${field}.${key}`);
}

export function parseArtifactJson(text: string): MorphArtifact {
  const value = irNodeToJsonCompatible(
    parseJsonStrict(text, {
      maxInputBytes: 20 * 1024 * 1024,
      maxDepth: 128,
      maxNodes: 500_000,
    }).root,
  );
  const root = record(value, "artifact");
  exactFields(
    root,
    [
      "artifactVersion",
      "artifactId",
      "inputSemanticDigest",
      "inputKind",
      "plan",
      "section",
      "modelDependencies",
      "dependencyMode",
      "target",
      "requestFrame",
      "integrity",
    ],
    "artifact",
  );
  if (root.artifactVersion !== "morph-artifact/1") {
    fail("UNSUPPORTED_ARTIFACT_VERSION", "Only morph-artifact/1 is supported.");
  }
  if (root.dependencyMode !== "self-contained") {
    fail("DEPENDENCY_MODE_UNSUPPORTED", "Only self-contained artifacts are supported.");
  }
  const plan = record(root.plan, "plan");
  const section = record(root.section, "section");
  const dependencies = record(root.modelDependencies, "modelDependencies");
  const target = record(root.target, "target");
  const frame = record(root.requestFrame, "requestFrame");
  const task = record(frame.task, "requestFrame.task");
  const integrity = record(root.integrity, "integrity");
  const options = record(plan.options, "plan.options");
  const layoutMetadata = record(section.layoutMetadata, "section.layoutMetadata");
  exactFields(plan, ["encoding", "formatVersion", "options", "plannerPolicy"], "plan");
  exactFields(
    section,
    ["encoding", "formatVersion", "payload", "layoutMetadata", "interpretationGuideId"],
    "section",
  );
  exactFields(
    dependencies,
    [
      "schema",
      "dictionaries",
      "interpretationGuideId",
      "interpretationGuideVersion",
      "interpretationGuideText",
    ],
    "modelDependencies",
  );
  exactFields(
    target,
    [
      "profileId",
      "tokenizerId",
      "tokenizerRevision",
      "modelId",
      "modelRevision",
      "providerId",
      "contextWindowTokens",
    ],
    "target",
  );
  exactFields(frame, ["task", "prefix", "suffix", "templateVersion"], "requestFrame");
  exactFields(
    task,
    ["instruction", "accessPattern", "relevantPaths", "preserveReadableLabels"],
    "requestFrame.task",
  );
  exactFields(
    integrity,
    ["payloadDigest", "dependenciesDigest", "algorithm", "canonicalizationVersion"],
    "integrity",
  );
  if (Object.hasOwn(dependencies, "dictionaries")) {
    fail(
      "UNSUPPORTED_ARTIFACT_DEPENDENCY",
      "Dictionary dependencies are not supported by morph-artifact/1 framing.",
      "modelDependencies.dictionaries",
    );
  }
  const schema = Object.hasOwn(dependencies, "schema")
    ? sanitizeSchema(dependencies.schema, {
        maxInputBytes: 5 * 1024 * 1024,
        maxDepth: 64,
        maxNodes: 250_000,
      })
    : undefined;
  const inputKind = root.inputKind;
  if (inputKind !== "json-text" && inputKind !== "js-value") {
    fail("INVALID_ARTIFACT", "inputKind is invalid.");
  }
  const plannerPolicy = plan.plannerPolicy;
  if (
    plannerPolicy !== "compatibility" &&
    plannerPolicy !== "economy-experimental" &&
    plannerPolicy !== "validated"
  ) {
    fail("INVALID_ARTIFACT", "plan.plannerPolicy is invalid.");
  }
  if (integrity.algorithm !== "sha256" || integrity.canonicalizationVersion !== "morph-c14n/1") {
    fail("INVALID_ARTIFACT", "Artifact integrity algorithms are unsupported.");
  }
  if (typeof task.instruction !== "string") {
    fail("INVALID_ARTIFACT", "requestFrame.task.instruction must be a string.");
  }
  if (frame.templateVersion !== "morph-prompt/1") {
    fail(
      "UNSUPPORTED_PROMPT_TEMPLATE",
      "Only morph-prompt/1 artifact request framing is supported.",
    );
  }
  const contextWindowTokens = target.contextWindowTokens;
  if (
    contextWindowTokens !== undefined &&
    (!Number.isSafeInteger(contextWindowTokens) || (contextWindowTokens as number) < 0)
  ) {
    fail(
      "INVALID_ARTIFACT",
      "target.contextWindowTokens must be a nonnegative safe integer when supplied.",
    );
  }
  const parsedTarget: TargetProfile = {
    profileId: stringField(target.profileId, "target.profileId"),
    tokenizerId: stringField(target.tokenizerId, "target.tokenizerId"),
    tokenizerRevision: stringField(target.tokenizerRevision, "target.tokenizerRevision"),
    ...(optionalString(target, "modelId", "target") === undefined
      ? {}
      : { modelId: optionalString(target, "modelId", "target") as string }),
    ...(optionalString(target, "modelRevision", "target") === undefined
      ? {}
      : { modelRevision: optionalString(target, "modelRevision", "target") as string }),
    ...(optionalString(target, "providerId", "target") === undefined
      ? {}
      : { providerId: optionalString(target, "providerId", "target") as string }),
    ...(contextWindowTokens === undefined
      ? {}
      : { contextWindowTokens: contextWindowTokens as number }),
  };
  const accessPattern = task.accessPattern;
  const allowedAccessPatterns = new Set([
    "unknown",
    "entity-lookup",
    "multi-entity-comparison",
    "aggregation",
    "filtering",
    "nested-path-lookup",
    "sequence-analysis",
  ]);
  if (
    accessPattern !== undefined &&
    (typeof accessPattern !== "string" || !allowedAccessPatterns.has(accessPattern))
  ) {
    fail("INVALID_ARTIFACT", "requestFrame.task.accessPattern is invalid.");
  }
  if (
    Object.hasOwn(task, "relevantPaths") &&
    (!Array.isArray(task.relevantPaths) ||
      task.relevantPaths.some((item) => typeof item !== "string"))
  ) {
    fail("INVALID_ARTIFACT", "requestFrame.task.relevantPaths must contain only strings.");
  }
  if (
    Object.hasOwn(task, "preserveReadableLabels") &&
    typeof task.preserveReadableLabels !== "boolean"
  ) {
    fail("INVALID_ARTIFACT", "requestFrame.task.preserveReadableLabels must be a boolean.");
  }
  const parsedTask: MorphTask = {
    instruction: task.instruction,
    ...(typeof accessPattern === "string"
      ? { accessPattern: accessPattern as NonNullable<MorphTask["accessPattern"]> }
      : {}),
    ...(Array.isArray(task.relevantPaths) &&
    task.relevantPaths.every((item) => typeof item === "string")
      ? { relevantPaths: task.relevantPaths as string[] }
      : {}),
    ...(typeof task.preserveReadableLabels === "boolean"
      ? { preserveReadableLabels: task.preserveReadableLabels }
      : {}),
  };
  return {
    artifactVersion: "morph-artifact/1",
    artifactId: digestField(root.artifactId, "artifactId"),
    inputSemanticDigest: digestField(root.inputSemanticDigest, "inputSemanticDigest"),
    inputKind,
    plan: {
      encoding: stringField(plan.encoding, "plan.encoding"),
      formatVersion: stringField(plan.formatVersion, "plan.formatVersion"),
      options,
      plannerPolicy,
    },
    section: {
      encoding: stringField(section.encoding, "section.encoding"),
      formatVersion: stringField(section.formatVersion, "section.formatVersion"),
      payload: stringField(section.payload, "section.payload"),
      layoutMetadata,
      interpretationGuideId: stringField(
        section.interpretationGuideId,
        "section.interpretationGuideId",
      ),
    },
    modelDependencies: {
      ...(schema === undefined ? {} : { schema }),
      interpretationGuideId: stringField(
        dependencies.interpretationGuideId,
        "modelDependencies.interpretationGuideId",
      ),
      interpretationGuideVersion: stringField(
        dependencies.interpretationGuideVersion,
        "modelDependencies.interpretationGuideVersion",
      ),
      interpretationGuideText: stringField(
        dependencies.interpretationGuideText,
        "modelDependencies.interpretationGuideText",
      ),
    },
    dependencyMode: "self-contained",
    target: parsedTarget,
    requestFrame: {
      task: parsedTask,
      prefix: stringField(frame.prefix, "requestFrame.prefix"),
      suffix: stringField(frame.suffix, "requestFrame.suffix"),
      templateVersion: "morph-prompt/1",
    },
    integrity: {
      payloadDigest: digestField(integrity.payloadDigest, "integrity.payloadDigest"),
      dependenciesDigest: digestField(integrity.dependenciesDigest, "integrity.dependenciesDigest"),
      algorithm: "sha256",
      canonicalizationVersion: "morph-c14n/1",
    },
  };
}

export function createArtifact(input: ArtifactInput): MorphArtifact {
  const schema = input.schema === undefined ? undefined : sanitizeSchema(input.schema);
  const dependencies = {
    ...(schema === undefined ? {} : { schema }),
    interpretationGuideId: input.guideId,
    interpretationGuideVersion: input.guideVersion,
    interpretationGuideText: input.guideText,
  };
  const payloadDigest = sha256Text(input.section.payload);
  const dependenciesDigest = sha256Text(canonicalJsonText(dependencies));
  const identity = {
    artifactVersion: "morph-artifact/1",
    inputSemanticDigest: input.ir.semanticDigest,
    inputKind: input.ir.inputKind,
    plan: {
      encoding: input.plan.encoding,
      formatVersion: input.plan.formatVersion,
      options: input.plan.options,
      plannerPolicy: input.plannerPolicy,
    },
    section: {
      encoding: input.section.encoding,
      formatVersion: input.section.formatVersion,
      layoutMetadata: input.section.layoutMetadata,
      interpretationGuideId: input.section.interpretationGuideId,
      payloadDigest,
    },
    dependenciesDigest,
    target: input.target,
    requestFrame: {
      task: input.task,
      prefix: input.prefix ?? "",
      suffix: input.suffix ?? "",
      templateVersion: "morph-prompt/1",
    },
  };
  return {
    artifactVersion: "morph-artifact/1",
    artifactId: sha256Text(canonicalJsonText(identity)),
    inputSemanticDigest: input.ir.semanticDigest,
    inputKind: input.ir.inputKind,
    plan: {
      encoding: input.plan.encoding,
      formatVersion: input.plan.formatVersion,
      options: input.plan.options,
      plannerPolicy: input.plannerPolicy,
    },
    section: input.section,
    modelDependencies: dependencies,
    dependencyMode: "self-contained",
    target: input.target,
    requestFrame: {
      task: input.task,
      prefix: input.prefix ?? "",
      suffix: input.suffix ?? "",
      templateVersion: "morph-prompt/1",
    },
    integrity: {
      payloadDigest,
      dependenciesDigest,
      algorithm: "sha256",
      canonicalizationVersion: "morph-c14n/1",
    },
  };
}

export function verifyArtifactIntegrity(artifact: MorphArtifact): VerificationReport {
  const errors = [];
  if (artifact.artifactVersion !== "morph-artifact/1") {
    errors.push(morphError("UNSUPPORTED_ARTIFACT_VERSION", "Unsupported artifact version."));
  }
  if (artifact.dependencyMode !== "self-contained") {
    errors.push(
      morphError("DEPENDENCY_MODE_UNSUPPORTED", "Only self-contained artifacts are supported."),
    );
  }
  if (
    artifact.integrity.algorithm !== "sha256" ||
    artifact.integrity.canonicalizationVersion !== "morph-c14n/1"
  ) {
    errors.push(
      morphError("UNSUPPORTED_INTEGRITY_SCHEME", "The artifact integrity scheme is unsupported."),
    );
  }
  if (artifact.requestFrame.templateVersion !== "morph-prompt/1") {
    errors.push(
      morphError(
        "UNSUPPORTED_PROMPT_TEMPLATE",
        "Only morph-prompt/1 request framing is supported.",
      ),
    );
  }
  if (artifact.modelDependencies.dictionaries !== undefined) {
    errors.push(
      morphError(
        "UNSUPPORTED_ARTIFACT_DEPENDENCY",
        "Dictionary dependencies are not supported by morph-artifact/1 framing.",
      ),
    );
  }
  if (!/^[0-9a-f]{64}$/.test(artifact.artifactId)) {
    errors.push(morphError("ARTIFACT_ID_MALFORMED", "The artifact identifier is malformed."));
  }
  if (!/^[0-9a-f]{64}$/.test(artifact.inputSemanticDigest)) {
    errors.push(morphError("SEMANTIC_DIGEST_MALFORMED", "The input semantic digest is malformed."));
  }
  const payloadDigest = sha256Text(artifact.section.payload);
  const dependenciesDigest = sha256Text(canonicalJsonText(artifact.modelDependencies));
  const expectedArtifactId = sha256Text(
    canonicalJsonText({
      artifactVersion: "morph-artifact/1",
      inputSemanticDigest: artifact.inputSemanticDigest,
      inputKind: artifact.inputKind,
      plan: artifact.plan,
      section: {
        encoding: artifact.section.encoding,
        formatVersion: artifact.section.formatVersion,
        layoutMetadata: artifact.section.layoutMetadata,
        interpretationGuideId: artifact.section.interpretationGuideId,
        payloadDigest,
      },
      dependenciesDigest,
      target: artifact.target,
      requestFrame: artifact.requestFrame,
    }),
  );
  if (payloadDigest !== artifact.integrity.payloadDigest) {
    errors.push(morphError("PAYLOAD_DIGEST_MISMATCH", "The payload digest does not match."));
  }
  if (dependenciesDigest !== artifact.integrity.dependenciesDigest) {
    errors.push(
      morphError("DEPENDENCIES_DIGEST_MISMATCH", "The dependency digest does not match."),
    );
  }
  if (expectedArtifactId !== artifact.artifactId) {
    errors.push(
      morphError("ARTIFACT_ID_MISMATCH", "The deterministic artifact identity does not match."),
    );
  }
  if (
    artifact.plan.encoding !== artifact.section.encoding ||
    artifact.plan.formatVersion !== artifact.section.formatVersion ||
    artifact.section.interpretationGuideId !== artifact.modelDependencies.interpretationGuideId
  ) {
    errors.push(
      morphError(
        "ARTIFACT_BINDING_MISMATCH",
        "Plan, section, and guide bindings are inconsistent.",
      ),
    );
  }
  const complete =
    typeof artifact.modelDependencies.interpretationGuideId === "string" &&
    typeof artifact.modelDependencies.interpretationGuideVersion === "string" &&
    typeof artifact.modelDependencies.interpretationGuideText === "string";
  if (!complete) {
    errors.push(morphError("DEPENDENCIES_INCOMPLETE", "Required model dependencies are missing."));
  }
  return {
    valid: errors.length === 0,
    checksum:
      payloadDigest === artifact.integrity.payloadDigest &&
      dependenciesDigest === artifact.integrity.dependenciesDigest
        ? "passed"
        : "failed",
    dependencies: complete ? "complete" : "incomplete",
    semanticRoundTrip: "not-run",
    errors,
  };
}
