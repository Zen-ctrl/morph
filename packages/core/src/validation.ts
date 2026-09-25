import { fail } from "./errors.js";
import { sanitizeSchema } from "./schema.js";
import type { AccessPattern, MorphConstraints, MorphRequest, PlannerPolicy } from "./types.js";

export const DEFAULT_CONSTRAINTS: MorphConstraints = {
  mode: "lossless",
  maxInputBytes: 5 * 1024 * 1024,
  maxDepth: 64,
  maxNodes: 250_000,
  maxCandidates: 24,
  maxRenderedBytes: 16 * 1024 * 1024,
  maxPlanningMs: 5_000,
  allowNetwork: false,
};

const ACCESS_PATTERNS = new Set<AccessPattern>([
  "unknown",
  "entity-lookup",
  "multi-entity-comparison",
  "aggregation",
  "filtering",
  "nested-path-lookup",
  "sequence-analysis",
]);

const POLICIES = new Set<PlannerPolicy>(["compatibility", "economy-experimental", "validated"]);

function optionalNonnegativeInteger(value: number | undefined, name: string): void {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
    fail("INVALID_REQUEST", `${name} must be a nonnegative safe integer.`);
  }
}

function optionalFinite(value: number | undefined, name: string): void {
  if (value !== undefined && !Number.isFinite(value)) {
    fail("INVALID_REQUEST", `${name} must be finite.`);
  }
}

export interface ValidatedRequest {
  readonly request: MorphRequest;
  readonly constraints: MorphConstraints;
  readonly sanitizedSchema?: unknown;
}

export function validateRequest(request: MorphRequest): ValidatedRequest {
  if (typeof request !== "object" || request === null) {
    fail("INVALID_REQUEST", "The compile request must be an object.");
  }
  if (typeof request.data !== "object" || request.data === null) {
    fail("INVALID_REQUEST", "The compile request must include a data entry point.");
  }
  if (request.data.kind === "json-text") {
    if (typeof request.data.text !== "string")
      fail("INVALID_REQUEST", "JSON-text data must be a string.");
  } else if (request.data.kind !== "js-value") {
    fail("INVALID_REQUEST", "The data kind must be 'json-text' or 'js-value'.");
  }
  if (typeof request.task?.instruction !== "string") {
    fail("INVALID_REQUEST", "A task instruction string is required.");
  }
  if (
    request.task.accessPattern !== undefined &&
    !ACCESS_PATTERNS.has(request.task.accessPattern)
  ) {
    fail("INVALID_REQUEST", "The access-pattern hint is unsupported.");
  }
  if (
    request.task.relevantPaths !== undefined &&
    (!Array.isArray(request.task.relevantPaths) ||
      request.task.relevantPaths.some((path) => typeof path !== "string"))
  ) {
    fail("INVALID_REQUEST", "relevantPaths must contain strings.");
  }
  if (
    request.task.preserveReadableLabels !== undefined &&
    typeof request.task.preserveReadableLabels !== "boolean"
  ) {
    fail("INVALID_REQUEST", "preserveReadableLabels must be a boolean when supplied.");
  }
  if (
    typeof request.target?.profileId !== "string" ||
    typeof request.target.tokenizerId !== "string" ||
    typeof request.target.tokenizerRevision !== "string"
  ) {
    fail("INVALID_REQUEST", "The target profile and tokenizer identity are required.");
  }
  for (const [name, value] of [
    ["modelId", request.target.modelId],
    ["modelRevision", request.target.modelRevision],
    ["providerId", request.target.providerId],
  ] as const) {
    if (value !== undefined && typeof value !== "string") {
      fail("INVALID_REQUEST", `target.${name} must be a string when supplied.`);
    }
  }
  if (request.constraints?.mode !== "lossless") {
    fail("INVALID_REQUEST", "MORPH v1 supports only lossless mode.");
  }
  if (typeof request.planner !== "object" || request.planner === null) {
    fail("INVALID_REQUEST", "A planner configuration is required.");
  }
  const constraints: MorphConstraints = { ...DEFAULT_CONSTRAINTS, ...request.constraints };
  if (constraints.allowNetwork !== undefined && typeof constraints.allowNetwork !== "boolean") {
    fail("INVALID_REQUEST", "allowNetwork must be a boolean.");
  }
  optionalNonnegativeInteger(constraints.maxPromptTokens, "maxPromptTokens");
  optionalNonnegativeInteger(constraints.reservedOutputTokens, "reservedOutputTokens");
  optionalNonnegativeInteger(constraints.maxInputBytes, "maxInputBytes");
  optionalNonnegativeInteger(constraints.maxDepth, "maxDepth");
  optionalNonnegativeInteger(constraints.maxNodes, "maxNodes");
  optionalNonnegativeInteger(constraints.maxCandidates, "maxCandidates");
  optionalNonnegativeInteger(constraints.maxRenderedBytes, "maxRenderedBytes");
  optionalNonnegativeInteger(constraints.maxPlanningMs, "maxPlanningMs");
  optionalNonnegativeInteger(request.target.contextWindowTokens, "contextWindowTokens");
  if (!POLICIES.has(request.planner?.policy)) {
    fail("INVALID_REQUEST", "The planner policy is unsupported.");
  }
  if (
    request.planner.objective !== "prompt-tokens" &&
    request.planner.objective !== "estimated-request-cost"
  ) {
    fail("INVALID_REQUEST", "The planner objective is unsupported.");
  }
  optionalFinite(request.planner.minimumSavingsFraction, "minimumSavingsFraction");
  optionalNonnegativeInteger(request.planner.minimumSavingsTokens, "minimumSavingsTokens");
  if (
    request.planner.minimumSavingsFraction !== undefined &&
    request.planner.minimumSavingsFraction < 0
  ) {
    fail("INVALID_REQUEST", "minimumSavingsFraction must be nonnegative.");
  }
  for (const [name, value] of [
    ["forcedEncoding", request.planner.forcedEncoding],
    ["qualityProfileId", request.planner.qualityProfileId],
    ["pricingProfileId", request.planner.pricingProfileId],
  ] as const) {
    if (value !== undefined && typeof value !== "string") {
      fail("INVALID_REQUEST", `planner.${name} must be a string when supplied.`);
    }
  }
  if (
    request.planner.allowedEncodings !== undefined &&
    (!Array.isArray(request.planner.allowedEncodings) ||
      request.planner.allowedEncodings.some((encoding) => typeof encoding !== "string"))
  ) {
    fail("INVALID_REQUEST", "allowedEncodings must contain strings.");
  }
  if (
    request.planner.allowExperimentalTransforms !== undefined &&
    typeof request.planner.allowExperimentalTransforms !== "boolean"
  ) {
    fail("INVALID_REQUEST", "allowExperimentalTransforms must be a boolean when supplied.");
  }
  if (
    constraints.maxPromptTokens !== undefined &&
    request.target.contextWindowTokens !== undefined &&
    constraints.reservedOutputTokens !== undefined &&
    constraints.maxPromptTokens + constraints.reservedOutputTokens >
      request.target.contextWindowTokens
  ) {
    fail(
      "INCONSISTENT_TOKEN_BUDGET",
      "Prompt and reserved output tokens exceed the declared context window.",
    );
  }
  if (
    request.context !== undefined &&
    (typeof request.context !== "object" ||
      request.context === null ||
      typeof request.context.prefix !== "string" ||
      typeof request.context.suffix !== "string")
  ) {
    fail("INVALID_REQUEST", "Context prefix and suffix must be strings.");
  }
  const sanitizedSchema =
    request.schema === undefined
      ? undefined
      : sanitizeSchema(request.schema, {
          maxInputBytes:
            constraints.maxInputBytes ?? DEFAULT_CONSTRAINTS.maxInputBytes ?? 5 * 1024 * 1024,
          maxDepth: constraints.maxDepth ?? DEFAULT_CONSTRAINTS.maxDepth ?? 64,
          maxNodes: constraints.maxNodes ?? DEFAULT_CONSTRAINTS.maxNodes ?? 250_000,
        });
  return {
    request,
    constraints,
    ...(sanitizedSchema === undefined ? {} : { sanitizedSchema }),
  };
}
