import {
  type AccessPatternClassification,
  type AccessPatternClassificationRequest,
  type AccessPatternClassifier,
  type ClassifiedAccessPattern,
  JEV_ACCESS_PATTERN_CHOICES,
  type JevAccessPatternChoice,
  type JevCoarseShapeStatistics,
  type JevFallbackClassification,
  type JevFallbackReason,
  type JevHttpAccessPatternClassifierOptions,
  type JevProbabilities,
  type JevTokenUsage,
} from "./types.js";

export const JEV_SYSTEM_ONE_ENDPOINT = "https://api.typesafe.ai/v1/systemone" as const;
export const JEV_ACCESS_PATTERN_QUESTION_ID = "access_pattern" as const;
export const DEFAULT_JEV_MODEL = "jev-latest" as const;
export const DEFAULT_JEV_TIMEOUT_MS = 5_000;
export const DEFAULT_JEV_MINIMUM_CONFIDENCE = 0.75;
export const DEFAULT_JEV_PROBABILITY_TOLERANCE = 0.000_001;
export const DEFAULT_JEV_MAX_TASK_BYTES = 64 * 1024;
export const DEFAULT_JEV_MAX_RESPONSE_BYTES = 256 * 1024;

export const JEV_INTEGRATION_STATUS = Object.freeze({
  offlineContractFixtures: "synthetic" as const,
  liveContractTest: "not-run" as const,
});

const CHOICE_SET = new Set<string>(JEV_ACCESS_PATTERN_CHOICES);
const SHAPE_FIELDS = new Set([
  "rootKind",
  "totalNodes",
  "maxDepth",
  "objectCount",
  "arrayCount",
  "recordArrayCount",
  "largestRecordCount",
  "uniformRecordArrayCount",
  "hasSparseRecords",
]);
const ROOT_KINDS = new Set(["null", "boolean", "string", "number", "array", "object"]);
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

const CRITERIA: Readonly<Record<JevAccessPatternChoice, string>> = Object.freeze({
  entity_lookup: "Find one entity or one entity's fields using an identifier or readable label.",
  multi_entity_comparison:
    "Compare fields across two or more entities while preserving row identity.",
  aggregation:
    "Compute or reason about a total, count, minimum, maximum, average, or grouped summary.",
  filtering: "Select records that satisfy one or more conditions.",
  nested_path_lookup:
    "Retrieve a value primarily by following a path through nested objects or arrays.",
  sequence_analysis:
    "Reason about order, position, duplicates, or change across an ordered sequence.",
  unknown:
    "The task is ambiguous, unsupported, or does not clearly match one primary access pattern.",
});

const CHOICE_TO_ACCESS_PATTERN: Readonly<Record<JevAccessPatternChoice, ClassifiedAccessPattern>> =
  Object.freeze({
    entity_lookup: "entity-lookup",
    multi_entity_comparison: "multi-entity-comparison",
    aggregation: "aggregation",
    filtering: "filtering",
    nested_path_lookup: "nested-path-lookup",
    sequence_analysis: "sequence-analysis",
    unknown: "unknown",
  });

interface ValidatedResponse {
  readonly choice: JevAccessPatternChoice;
  readonly probabilities: JevProbabilities;
  readonly confidence: number;
  readonly model: string;
  readonly usage: JevTokenUsage;
}

interface JevRequestBody {
  readonly state: {
    readonly task: string;
    readonly coarse_shape?: JevCoarseShapeStatistics;
  };
  readonly model: string;
  readonly questions: {
    readonly access_pattern: {
      readonly type: "choice";
      readonly instructions: string;
      readonly criteria: Readonly<Record<JevAccessPatternChoice, string>>;
    };
  };
}

function fallback(
  reason: JevFallbackReason,
  diagnosticCode: string,
  httpStatus?: number,
): JevFallbackClassification {
  return {
    status: "fallback",
    source: "deterministic-fallback",
    accessPattern: "unknown",
    reason,
    diagnosticCode,
    ...(httpStatus === undefined ? {} : { httpStatus }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable)
      return false;
  }
  return true;
}

function own(record: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

function exactKeys(record: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function nonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validateShape(
  shape: JevCoarseShapeStatistics | undefined,
): JevCoarseShapeStatistics | undefined {
  if (shape === undefined) return undefined;
  if (!isRecord(shape)) return undefined;
  for (const key of Object.keys(shape)) {
    if (!SHAPE_FIELDS.has(key)) return undefined;
  }
  const rootKind = own(shape, "rootKind");
  if (typeof rootKind !== "string" || !ROOT_KINDS.has(rootKind)) return undefined;
  const countFields = [
    "totalNodes",
    "maxDepth",
    "objectCount",
    "arrayCount",
    "recordArrayCount",
    "largestRecordCount",
    "uniformRecordArrayCount",
  ] as const;
  for (const field of countFields) {
    const value = own(shape, field);
    if (value !== undefined && !nonnegativeInteger(value)) return undefined;
  }
  const hasSparseRecords = own(shape, "hasSparseRecords");
  if (hasSparseRecords !== undefined && typeof hasSparseRecords !== "boolean") return undefined;
  return shape;
}

function finiteUnit(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function validateResponse(value: unknown, tolerance: number): ValidatedResponse | undefined {
  if (!isRecord(value)) return undefined;
  const model = own(value, "model");
  const answers = own(value, "answers");
  const usage = own(value, "usage");
  if (typeof model !== "string" || model.length === 0 || !isRecord(answers) || !isRecord(usage)) {
    return undefined;
  }
  if (!exactKeys(answers, [JEV_ACCESS_PATTERN_QUESTION_ID])) return undefined;
  const answer = own(answers, JEV_ACCESS_PATTERN_QUESTION_ID);
  if (!isRecord(answer) || own(answer, "type") !== "choice") return undefined;
  const choice = own(answer, "choice");
  const confidence = own(answer, "confidence");
  const probabilitiesValue = own(answer, "probabilities");
  if (
    typeof choice !== "string" ||
    !CHOICE_SET.has(choice) ||
    !finiteUnit(confidence) ||
    !isRecord(probabilitiesValue) ||
    !exactKeys(probabilitiesValue, JEV_ACCESS_PATTERN_CHOICES)
  ) {
    return undefined;
  }
  const probabilities = Object.create(null) as Record<JevAccessPatternChoice, number>;
  let sum = 0;
  let maximum = -1;
  for (const option of JEV_ACCESS_PATTERN_CHOICES) {
    const probability = own(probabilitiesValue, option);
    if (!finiteUnit(probability)) return undefined;
    probabilities[option] = probability;
    sum += probability;
    maximum = Math.max(maximum, probability);
  }
  if (Math.abs(sum - 1) > tolerance) return undefined;
  const typedChoice = choice as JevAccessPatternChoice;
  if (maximum - probabilities[typedChoice] > tolerance) return undefined;
  const inputTokens = own(usage, "input_tokens");
  const outputTokens = own(usage, "output_tokens");
  if (!nonnegativeInteger(inputTokens) || !nonnegativeInteger(outputTokens)) return undefined;
  return {
    choice: typedChoice,
    probabilities: Object.freeze(probabilities),
    confidence,
    model,
    usage: { inputTokens, outputTokens },
  };
}

function positiveInteger(value: number | undefined, fallbackValue: number): number | undefined {
  const selected = value ?? fallbackValue;
  return Number.isSafeInteger(selected) && selected > 0 ? selected : undefined;
}

function boundedUnit(value: number | undefined, fallbackValue: number): number | undefined {
  const selected = value ?? fallbackValue;
  return Number.isFinite(selected) && selected >= 0 && selected <= 1 ? selected : undefined;
}

function probabilityTolerance(value: number | undefined): number | undefined {
  const selected = value ?? DEFAULT_JEV_PROBABILITY_TOLERANCE;
  return Number.isFinite(selected) && selected >= 0 && selected <= 0.05 ? selected : undefined;
}

async function readBoundedJson(response: Response, maxBytes: number): Promise<unknown> {
  if (response.body === null) throw new Error("The response body is missing.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > maxBytes) throw new Error("The response body exceeds its byte limit.");
      chunks.push(result.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(decoder.decode(bytes)) as unknown;
}

export class DisabledJevAccessPatternClassifier implements AccessPatternClassifier {
  async classify(
    _request: AccessPatternClassificationRequest,
  ): Promise<AccessPatternClassification> {
    return fallback("adapter-disabled", "JEV_ADAPTER_DISABLED");
  }
}

export class JevHttpAccessPatternClassifier implements AccessPatternClassifier {
  readonly #apiKey: string | undefined;
  readonly #model: string;
  readonly #timeoutMs: number | undefined;
  readonly #minimumConfidence: number | undefined;
  readonly #probabilityTolerance: number | undefined;
  readonly #maxTaskBytes: number | undefined;
  readonly #maxResponseBytes: number | undefined;
  readonly #fetch: typeof fetch;
  readonly #now: () => number;

  constructor(options: JevHttpAccessPatternClassifierOptions = {}) {
    this.#apiKey = options.apiKey;
    this.#model = options.model ?? DEFAULT_JEV_MODEL;
    this.#timeoutMs = positiveInteger(options.timeoutMs, DEFAULT_JEV_TIMEOUT_MS);
    this.#minimumConfidence = boundedUnit(
      options.minimumConfidence,
      DEFAULT_JEV_MINIMUM_CONFIDENCE,
    );
    this.#probabilityTolerance = probabilityTolerance(options.probabilityTolerance);
    this.#maxTaskBytes = positiveInteger(options.maxTaskBytes, DEFAULT_JEV_MAX_TASK_BYTES);
    this.#maxResponseBytes = positiveInteger(
      options.maxResponseBytes,
      DEFAULT_JEV_MAX_RESPONSE_BYTES,
    );
    this.#fetch =
      options.fetchImplementation === undefined ? globalThis.fetch : options.fetchImplementation;
    this.#now = options.now ?? (() => performance.now());
  }

  async classify(
    request: AccessPatternClassificationRequest,
  ): Promise<AccessPatternClassification> {
    if (request.allowNetwork !== true) {
      return fallback("network-disabled", "JEV_NETWORK_DISABLED");
    }
    if (request.allowRemoteTaskDisclosure !== true) {
      return fallback("remote-task-disclosure-disabled", "JEV_REMOTE_TASK_DISCLOSURE_DISABLED");
    }
    if (request.signal?.aborted === true) {
      return fallback("cancelled", "JEV_REQUEST_CANCELLED");
    }
    if (typeof this.#apiKey !== "string" || this.#apiKey.trim().length === 0) {
      return fallback("missing-credential", "JEV_CREDENTIAL_MISSING");
    }
    if (
      typeof this.#model !== "string" ||
      this.#model.trim().length === 0 ||
      this.#timeoutMs === undefined ||
      this.#minimumConfidence === undefined ||
      this.#probabilityTolerance === undefined ||
      this.#maxTaskBytes === undefined ||
      this.#maxResponseBytes === undefined ||
      typeof this.#fetch !== "function"
    ) {
      return fallback("invalid-configuration", "JEV_INVALID_CONFIGURATION");
    }
    if (
      typeof request.taskInstruction !== "string" ||
      encoder.encode(request.taskInstruction).byteLength > this.#maxTaskBytes
    ) {
      return fallback("invalid-input", "JEV_INVALID_INPUT");
    }
    const shape = validateShape(request.shape);
    if (request.shape !== undefined && shape === undefined) {
      return fallback("invalid-input", "JEV_INVALID_INPUT");
    }

    const requestBody: JevRequestBody = {
      state: {
        task: request.taskInstruction,
        ...(shape === undefined ? {} : { coarse_shape: shape }),
      },
      model: this.#model,
      questions: {
        access_pattern: {
          type: "choice",
          instructions:
            "Classify the primary structured-data access pattern for this task. Select unknown when the task is ambiguous or does not clearly match one option.",
          criteria: CRITERIA,
        },
      },
    };

    const controller = new AbortController();
    let timedOut = false;
    let externallyAborted = false;
    const externalAbort = (): void => {
      externallyAborted = true;
      controller.abort();
    };
    request.signal?.addEventListener("abort", externalAbort, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.#timeoutMs);
    const startedAt = this.#now();
    try {
      const response = await this.#fetch(JEV_SYSTEM_ONE_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.#apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) {
        return fallback("service-error", "JEV_SERVICE_ERROR", response.status);
      }
      let responseValue: unknown;
      try {
        responseValue = await readBoundedJson(response, this.#maxResponseBytes);
      } catch {
        return fallback("malformed-response", "JEV_MALFORMED_RESPONSE");
      }
      const validated = validateResponse(responseValue, this.#probabilityTolerance);
      if (validated === undefined) {
        return fallback("malformed-response", "JEV_MALFORMED_RESPONSE");
      }
      const latencyMs = Math.max(0, Math.round(this.#now() - startedAt));
      const proposedAccessPattern = CHOICE_TO_ACCESS_PATTERN[validated.choice];
      const remote = {
        source: "jev" as const,
        requestedModel: this.#model,
        resolvedModel: validated.model,
        probabilities: validated.probabilities,
        confidence: validated.confidence,
        latencyMs,
        usage: validated.usage,
      };
      if (validated.choice === "unknown") {
        return {
          ...remote,
          status: "abstained",
          accessPattern: "unknown",
          reason: "model-selected-unknown",
          proposedAccessPattern,
        };
      }
      if (validated.confidence < this.#minimumConfidence) {
        return {
          ...remote,
          status: "abstained",
          accessPattern: "unknown",
          reason: "low-confidence",
          proposedAccessPattern,
        };
      }
      return {
        ...remote,
        status: "classified",
        accessPattern: proposedAccessPattern as Exclude<ClassifiedAccessPattern, "unknown">,
        reason: "accepted",
      };
    } catch {
      if (externallyAborted) {
        return fallback("cancelled", "JEV_REQUEST_CANCELLED");
      }
      if (timedOut) {
        return fallback("request-timeout", "JEV_REQUEST_TIMEOUT");
      }
      return fallback("network-error", "JEV_NETWORK_ERROR");
    } finally {
      clearTimeout(timeout);
      request.signal?.removeEventListener("abort", externalAbort);
    }
  }
}
