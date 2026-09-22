import {
  type AccessPattern,
  canonicalJsonText,
  createMorph,
  type MorphRequest,
  sha256Text,
} from "@morph/core";
import { builtInEncoders } from "@morph/encoders";
import { localO200kBaseProfile, localO200kBaseTokenizer } from "@morph/tokenizer-adapters";
import { toonEncoder } from "@morph/toon-adapter";
import {
  type BenchmarkIdentity,
  collectEvaluationProvenance,
  type EvaluationProvenance,
} from "./provenance.js";

export interface EvaluationTaskInput {
  readonly taskId: string;
  readonly family: string;
  readonly instruction: string;
  readonly accessPattern: AccessPattern;
  readonly expectedAnswer: unknown;
}

export interface EvaluationDatasetInput {
  readonly caseId: string;
  readonly family: string;
  readonly variant?: string;
  readonly size: "small" | "medium" | "large";
  readonly jsonText: string;
  readonly tasks: readonly EvaluationTaskInput[];
}

export interface EvaluationPricingProfile {
  readonly profileId: string;
  readonly revision: string;
  readonly currency: string;
  readonly inputPerMillionTokens: number;
  readonly outputPerMillionTokens: number;
  readonly fixedCostPerRequest?: number;
  readonly maximumInputOverheadTokens: number;
}

export interface ModelEvaluationControls {
  readonly providerId: string;
  readonly randomSeed: number;
  readonly maxRequests: number;
  readonly concurrency: number;
  readonly maxRetries: number;
  readonly maxOutputTokens: number;
  readonly requestTimeoutMs: number;
  readonly approvedCallCap?: number;
  readonly maxCost?: number;
  readonly pricingProfile?: EvaluationPricingProfile;
  readonly recordOutputs?: boolean;
}

export interface ModelEvaluationCase {
  readonly trialId: string;
  readonly pairId: string;
  readonly datasetId: string;
  readonly caseId: string;
  readonly taskId: string;
  readonly taskFamily: string;
  readonly dataFamily: string;
  readonly dataVariant?: string;
  readonly size: "small" | "medium" | "large";
  readonly representationRole: "baseline" | "candidate";
  readonly encoding: string;
  readonly planId: string;
  readonly renderedContext: string;
  readonly renderedContextDigest: string;
  readonly promptTokens: number;
  readonly expectedAnswer: unknown;
}

export interface ModelEvaluatorContext {
  readonly providerId: string;
  readonly attempt: number;
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
  readonly signal: AbortSignal;
}

export interface ModelEvaluationUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens?: number;
}

export interface ModelEvaluatorResponse {
  readonly status: "completed" | "failed" | "refused" | "truncated";
  readonly output?: unknown;
  readonly validOutput?: boolean;
  readonly providerModelId?: string;
  readonly providerModelRevision?: string;
  readonly usage?: ModelEvaluationUsage;
  readonly finishReason?: string;
  readonly errorCode?: string;
  readonly refusalCode?: string;
  readonly retryable?: boolean;
}

export interface ModelEvaluator {
  readonly id: string;
  evaluate(
    item: ModelEvaluationCase,
    context: ModelEvaluatorContext,
  ): Promise<ModelEvaluatorResponse>;
}

export interface EvaluationPreparationExclusion {
  readonly caseId: string;
  readonly taskId: string;
  readonly encoding: string;
  readonly reasonCode: string;
}

export interface PreparedModelEvaluation {
  readonly cases: readonly ModelEvaluationCase[];
  readonly exclusions: readonly EvaluationPreparationExclusion[];
  readonly tokenizer: {
    readonly id: string;
    readonly revision: string;
  };
}

export interface ModelEvaluationAttempt {
  readonly attempt: number;
  readonly status: "completed" | "failed" | "refused" | "truncated";
  readonly latencyMs: number;
  readonly usage?: ModelEvaluationUsage;
  readonly cost?: number;
  readonly costBasis?: "provider-usage" | "conservative-reservation";
  readonly providerModelId?: string;
  readonly providerModelRevision?: string;
  readonly finishReason?: string;
  readonly errorCode?: string;
  readonly refusalCode?: string;
  readonly retryable: boolean;
}

export interface ModelEvaluationTrialResult {
  readonly trialId: string;
  readonly pairId: string;
  readonly datasetId: string;
  readonly caseId: string;
  readonly taskId: string;
  readonly taskFamily: string;
  readonly dataFamily: string;
  readonly dataVariant?: string;
  readonly size: "small" | "medium" | "large";
  readonly representationRole: "baseline" | "candidate";
  readonly encoding: string;
  readonly planId: string;
  readonly renderedContextDigest: string;
  readonly promptTokens: number;
  readonly status: "measured" | "failed" | "refused" | "truncated" | "not-run";
  readonly validOutput: boolean | null;
  readonly exactMatch: boolean | null;
  readonly includedInAccuracyDenominator: boolean;
  readonly outputDigest?: string;
  readonly output?: unknown;
  readonly attempts: readonly ModelEvaluationAttempt[];
  readonly reasonCode?: string;
}

export interface ModelEvaluationAggregateRow {
  readonly dimension: "encoding" | "task-family" | "data-family";
  readonly key: string;
  readonly planned: number;
  readonly attempted: number;
  readonly exactMatches: number;
  readonly failures: number;
  readonly refusals: number;
  readonly truncations: number;
  readonly notRun: number;
  readonly exactMatchRate: number | null;
}

export interface ModelEvaluationManifest {
  readonly manifestVersion: "morph-model-evaluation/1";
  readonly generatedAt: string;
  readonly runStatus: "not-run" | "complete" | "partial";
  readonly modelQuality: "not-run" | "measured-unqualified";
  readonly evaluatorId: string | null;
  readonly provenance: EvaluationProvenance;
  readonly tokenizer: {
    readonly id: string;
    readonly revision: string;
    readonly scope: "rendered-text";
  };
  readonly settings: {
    readonly providerId: string;
    readonly randomSeed: number;
    readonly maxRequests: number;
    readonly effectiveRequestCap: number;
    readonly concurrency: number;
    readonly maxRetries: number;
    readonly maxOutputTokens: number;
    readonly requestTimeoutMs: number;
    readonly budgetMode: "call-cap" | "cost-cap";
    readonly approvedCallCap?: number;
    readonly maxCost?: number;
    readonly pricingProfile?: EvaluationPricingProfile;
    readonly candidateEncodings: readonly string[];
    readonly recordOutputs: boolean;
  };
  readonly preparationExclusions: readonly EvaluationPreparationExclusion[];
  readonly randomizedTrialOrder: readonly string[];
  readonly denominators: {
    readonly datasets: number;
    readonly tasks: number;
    readonly pairs: number;
    readonly plannedTrials: number;
    readonly attemptedTrials: number;
    readonly completedTrials: number;
    readonly failedTrials: number;
    readonly refusedTrials: number;
    readonly truncatedTrials: number;
    readonly notRunTrials: number;
    readonly exactMatches: number;
    readonly accuracyDenominator: number;
    readonly pairsWithBothSidesAttempted: number;
    readonly providerRequests: number;
    readonly retries: number;
  };
  readonly cost?: {
    readonly amount: number;
    readonly currency: string;
    readonly basis: "provider-usage" | "mixed-conservative";
  };
  readonly aggregates: readonly ModelEvaluationAggregateRow[];
  readonly trials: readonly ModelEvaluationTrialResult[];
  readonly warnings: readonly string[];
  readonly manifestDigest: string;
}

export interface ModelEvaluationRunOptions {
  readonly corpus: readonly EvaluationDatasetInput[];
  readonly evaluator?: ModelEvaluator;
  readonly controls: ModelEvaluationControls;
  readonly candidateEncodings?: readonly string[];
  readonly benchmark: BenchmarkIdentity;
  readonly baseDirectory?: string;
}

const evaluationCompiler = createMorph({
  encoders: [...builtInEncoders, toonEncoder],
  tokenizers: [localO200kBaseTokenizer],
  targetProfiles: [localO200kBaseProfile],
  qualityProfiles: [],
});

const availableCandidateEncodings = [
  ...new Set([...builtInEncoders, toonEncoder].map((item) => item.id)),
]
  .filter((encoding) => encoding !== "json-compact")
  .sort();

function requireSafeInteger(name: string, value: number, minimum: number): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be a safe integer greater than or equal to ${minimum}.`);
  }
}

function requireFiniteNonnegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite nonnegative number.`);
  }
}

function validatePricingProfile(profile: EvaluationPricingProfile): void {
  if (
    profile.profileId.length === 0 ||
    profile.revision.length === 0 ||
    profile.currency.length === 0
  ) {
    throw new Error("A pricing profile requires an ID, revision, and currency.");
  }
  requireFiniteNonnegative("inputPerMillionTokens", profile.inputPerMillionTokens);
  requireFiniteNonnegative("outputPerMillionTokens", profile.outputPerMillionTokens);
  requireFiniteNonnegative("fixedCostPerRequest", profile.fixedCostPerRequest ?? 0);
  requireSafeInteger("maximumInputOverheadTokens", profile.maximumInputOverheadTokens, 0);
}

function validateControls(controls: ModelEvaluationControls): "call-cap" | "cost-cap" {
  if (controls.providerId.length === 0) throw new Error("providerId is required.");
  requireSafeInteger("randomSeed", controls.randomSeed, 0);
  requireSafeInteger("maxRequests", controls.maxRequests, 1);
  requireSafeInteger("concurrency", controls.concurrency, 1);
  requireSafeInteger("maxRetries", controls.maxRetries, 0);
  requireSafeInteger("maxOutputTokens", controls.maxOutputTokens, 1);
  requireSafeInteger("requestTimeoutMs", controls.requestTimeoutMs, 1);
  const callMode = controls.approvedCallCap !== undefined;
  const costMode = controls.maxCost !== undefined || controls.pricingProfile !== undefined;
  if (callMode === costMode) {
    throw new Error(
      "Configure exactly one paid-execution limit: approvedCallCap, or maxCost with pricingProfile.",
    );
  }
  if (callMode) {
    requireSafeInteger("approvedCallCap", controls.approvedCallCap ?? 0, 1);
    return "call-cap";
  }
  if (controls.maxCost === undefined || controls.pricingProfile === undefined) {
    throw new Error("Cost-capped execution requires both maxCost and pricingProfile.");
  }
  requireFiniteNonnegative("maxCost", controls.maxCost);
  validatePricingProfile(controls.pricingProfile);
  return "cost-cap";
}

function requestFor(
  dataset: EvaluationDatasetInput,
  task: EvaluationTaskInput,
  encoding: string,
): MorphRequest {
  return {
    data: { kind: "json-text", text: dataset.jsonText },
    task: {
      instruction: task.instruction,
      accessPattern: task.accessPattern,
    },
    target: localO200kBaseProfile,
    constraints: {
      mode: "lossless",
      allowNetwork: false,
    },
    planner: {
      policy: "economy-experimental",
      objective: "prompt-tokens",
      allowedEncodings: [encoding],
      forcedEncoding: encoding,
      minimumSavingsTokens: 0,
      minimumSavingsFraction: 0,
    },
  };
}

function artifactPlanId(artifact: {
  readonly plan: {
    readonly encoding: string;
    readonly formatVersion: string;
    readonly options: Readonly<Record<string, unknown>>;
  };
}): string {
  return `${artifact.plan.encoding}@${artifact.plan.formatVersion}:${canonicalJsonText(artifact.plan.options)}`;
}

function trialFromArtifact(
  dataset: EvaluationDatasetInput,
  task: EvaluationTaskInput,
  candidateEncoding: string,
  role: "baseline" | "candidate",
  artifact: Parameters<typeof evaluationCompiler.renderModelContext>[0],
): ModelEvaluationCase {
  const context = evaluationCompiler.renderModelContext(artifact);
  const encoding = artifact.plan.encoding;
  const pairId = `${dataset.caseId}:${task.taskId}:${candidateEncoding}`;
  return {
    trialId: `${pairId}:${role}`,
    pairId,
    datasetId: dataset.caseId,
    caseId: dataset.caseId,
    taskId: task.taskId,
    taskFamily: task.family,
    dataFamily: dataset.family,
    ...(dataset.variant === undefined ? {} : { dataVariant: dataset.variant }),
    size: dataset.size,
    representationRole: role,
    encoding,
    planId: artifactPlanId(artifact),
    renderedContext: context.rendered,
    renderedContextDigest: context.renderedDigest,
    promptTokens: localO200kBaseTokenizer.countText(context.rendered),
    expectedAnswer: task.expectedAnswer,
  };
}

function validateCorpus(corpus: readonly EvaluationDatasetInput[]): void {
  const datasetIds = new Set<string>();
  for (const dataset of corpus) {
    if (dataset.caseId.length === 0 || dataset.family.length === 0) {
      throw new Error("Every evaluation dataset requires a nonempty caseId and family.");
    }
    if (datasetIds.has(dataset.caseId))
      throw new Error(`Duplicate dataset caseId '${dataset.caseId}'.`);
    datasetIds.add(dataset.caseId);
    const taskIds = new Set<string>();
    for (const task of dataset.tasks) {
      if (task.taskId.length === 0 || task.instruction.length === 0) {
        throw new Error(`Dataset '${dataset.caseId}' contains an incomplete task.`);
      }
      if (taskIds.has(task.taskId)) {
        throw new Error(`Dataset '${dataset.caseId}' contains duplicate taskId '${task.taskId}'.`);
      }
      taskIds.add(task.taskId);
    }
  }
}

export async function prepareModelEvaluationCases(
  corpus: readonly EvaluationDatasetInput[],
  requestedCandidateEncodings: readonly string[] = availableCandidateEncodings,
): Promise<PreparedModelEvaluation> {
  validateCorpus(corpus);
  const candidateEncodings = [...new Set(requestedCandidateEncodings)].sort();
  if (candidateEncodings.length === 0)
    throw new Error("At least one candidate encoding is required.");
  for (const encoding of candidateEncodings) {
    if (encoding === "json-compact" || !availableCandidateEncodings.includes(encoding)) {
      throw new Error(`Unknown or baseline-only candidate encoding '${encoding}'.`);
    }
  }
  const cases: ModelEvaluationCase[] = [];
  const exclusions: EvaluationPreparationExclusion[] = [];
  for (const dataset of corpus) {
    for (const task of dataset.tasks) {
      const baseline = await evaluationCompiler.compile(requestFor(dataset, task, "json-compact"));
      if (!baseline.ok) {
        exclusions.push({
          caseId: dataset.caseId,
          taskId: task.taskId,
          encoding: "json-compact",
          reasonCode: baseline.error.code,
        });
        continue;
      }
      for (const candidateEncoding of candidateEncodings) {
        const candidate = await evaluationCompiler.compile(
          requestFor(dataset, task, candidateEncoding),
        );
        if (!candidate.ok) {
          exclusions.push({
            caseId: dataset.caseId,
            taskId: task.taskId,
            encoding: candidateEncoding,
            reasonCode: candidate.error.code,
          });
          continue;
        }
        cases.push(
          trialFromArtifact(dataset, task, candidateEncoding, "baseline", baseline.artifact),
          trialFromArtifact(dataset, task, candidateEncoding, "candidate", candidate.artifact),
        );
      }
    }
  }
  return {
    cases,
    exclusions,
    tokenizer: {
      id: localO200kBaseTokenizer.id,
      revision: localO200kBaseTokenizer.revision,
    },
  };
}

function randomGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function shuffled<T>(values: readonly T[], seed: number): T[] {
  const result = [...values];
  const random = randomGenerator(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const replacement = Math.floor(random() * (index + 1));
    const value = result[index];
    result[index] = result[replacement] as T;
    result[replacement] = value as T;
  }
  return result;
}

function exactJsonMatch(expected: unknown, actual: unknown): boolean {
  try {
    return canonicalJsonText(expected) === canonicalJsonText(actual);
  } catch {
    return false;
  }
}

function responseUsage(value: unknown): ModelEvaluationUsage | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const inputTokens = Reflect.get(value, "inputTokens");
  const outputTokens = Reflect.get(value, "outputTokens");
  const cachedInputTokens = Reflect.get(value, "cachedInputTokens");
  if (
    !Number.isSafeInteger(inputTokens) ||
    (inputTokens as number) < 0 ||
    !Number.isSafeInteger(outputTokens) ||
    (outputTokens as number) < 0 ||
    (cachedInputTokens !== undefined &&
      (!Number.isSafeInteger(cachedInputTokens) || (cachedInputTokens as number) < 0))
  ) {
    return undefined;
  }
  return {
    inputTokens: inputTokens as number,
    outputTokens: outputTokens as number,
    ...(cachedInputTokens === undefined ? {} : { cachedInputTokens: cachedInputTokens as number }),
  };
}

function normalizeResponse(value: unknown): ModelEvaluatorResponse {
  if (typeof value !== "object" || value === null) {
    return { status: "failed", errorCode: "INVALID_EVALUATOR_RESPONSE", retryable: false };
  }
  const status = Reflect.get(value, "status");
  if (
    status !== "completed" &&
    status !== "failed" &&
    status !== "refused" &&
    status !== "truncated"
  ) {
    return { status: "failed", errorCode: "INVALID_EVALUATOR_RESPONSE", retryable: false };
  }
  const usageValue = Reflect.get(value, "usage");
  const usage = usageValue === undefined ? undefined : responseUsage(usageValue);
  if (usageValue !== undefined && usage === undefined) {
    return { status: "failed", errorCode: "INVALID_EVALUATOR_USAGE", retryable: false };
  }
  const stringField = (name: string): string | undefined => {
    const field = Reflect.get(value, name);
    return typeof field === "string" ? field : undefined;
  };
  const retryable = Reflect.get(value, "retryable");
  const validOutput = Reflect.get(value, "validOutput");
  const providerModelId = stringField("providerModelId");
  const providerModelRevision = stringField("providerModelRevision");
  const finishReason = stringField("finishReason");
  const errorCode = stringField("errorCode");
  const refusalCode = stringField("refusalCode");
  return {
    status,
    ...(Object.hasOwn(value, "output") ? { output: Reflect.get(value, "output") } : {}),
    ...(typeof validOutput === "boolean" ? { validOutput } : {}),
    ...(providerModelId === undefined ? {} : { providerModelId }),
    ...(providerModelRevision === undefined ? {} : { providerModelRevision }),
    ...(usage === undefined ? {} : { usage }),
    ...(finishReason === undefined ? {} : { finishReason }),
    ...(errorCode === undefined ? {} : { errorCode }),
    ...(refusalCode === undefined ? {} : { refusalCode }),
    ...(typeof retryable === "boolean" ? { retryable } : {}),
  };
}

function requestCost(
  inputTokens: number,
  outputTokens: number,
  pricing: EvaluationPricingProfile,
): number {
  return (
    (inputTokens * pricing.inputPerMillionTokens) / 1_000_000 +
    (outputTokens * pricing.outputPerMillionTokens) / 1_000_000 +
    (pricing.fixedCostPerRequest ?? 0)
  );
}

function reservedRequestCost(item: ModelEvaluationCase, controls: ModelEvaluationControls): number {
  const pricing = controls.pricingProfile;
  if (pricing === undefined) return 0;
  return requestCost(
    item.promptTokens + pricing.maximumInputOverheadTokens,
    controls.maxOutputTokens,
    pricing,
  );
}

async function invokeEvaluator(
  evaluator: ModelEvaluator,
  item: ModelEvaluationCase,
  controls: ModelEvaluationControls,
  attempt: number,
): Promise<{ readonly response: ModelEvaluatorResponse; readonly latencyMs: number }> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort("MODEL_EVALUATION_TIMEOUT");
  }, controls.requestTimeoutMs);
  const started = performance.now();
  try {
    const response = await Promise.race([
      evaluator.evaluate(item, {
        providerId: controls.providerId,
        attempt,
        maxOutputTokens: controls.maxOutputTokens,
        timeoutMs: controls.requestTimeoutMs,
        signal: controller.signal,
      }),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener(
          "abort",
          () => reject(new Error("MODEL_EVALUATION_TIMEOUT")),
          { once: true },
        );
      }),
    ]);
    return { response: normalizeResponse(response), latencyMs: performance.now() - started };
  } catch (error) {
    return {
      response: {
        status: "failed",
        errorCode: timedOut
          ? "MODEL_EVALUATION_TIMEOUT"
          : error instanceof Error && error.name === "AbortError"
            ? "MODEL_EVALUATION_ABORTED"
            : "MODEL_EVALUATOR_ERROR",
        retryable: timedOut,
      },
      latencyMs: performance.now() - started,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function aggregate(
  trials: readonly ModelEvaluationTrialResult[],
  dimension: ModelEvaluationAggregateRow["dimension"],
  keyOf: (trial: ModelEvaluationTrialResult) => string,
): ModelEvaluationAggregateRow[] {
  const groups = new Map<string, ModelEvaluationTrialResult[]>();
  for (const trial of trials) {
    const key = keyOf(trial);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [trial]);
    else group.push(trial);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => (left === right ? 0 : left < right ? -1 : 1))
    .map(([key, group]) => {
      const attempted = group.filter((item) => item.includedInAccuracyDenominator).length;
      const exactMatches = group.filter((item) => item.exactMatch === true).length;
      return {
        dimension,
        key,
        planned: group.length,
        attempted,
        exactMatches,
        failures: group.filter((item) => item.status === "failed").length,
        refusals: group.filter((item) => item.status === "refused").length,
        truncations: group.filter((item) => item.status === "truncated").length,
        notRun: group.filter((item) => item.status === "not-run").length,
        exactMatchRate: attempted === 0 ? null : exactMatches / attempted,
      };
    });
}

function notRunTrial(item: ModelEvaluationCase, reasonCode: string): ModelEvaluationTrialResult {
  return {
    trialId: item.trialId,
    pairId: item.pairId,
    datasetId: item.datasetId,
    caseId: item.caseId,
    taskId: item.taskId,
    taskFamily: item.taskFamily,
    dataFamily: item.dataFamily,
    ...(item.dataVariant === undefined ? {} : { dataVariant: item.dataVariant }),
    size: item.size,
    representationRole: item.representationRole,
    encoding: item.encoding,
    planId: item.planId,
    renderedContextDigest: item.renderedContextDigest,
    promptTokens: item.promptTokens,
    status: "not-run",
    validOutput: null,
    exactMatch: null,
    includedInAccuracyDenominator: false,
    attempts: [],
    reasonCode,
  };
}

export async function runModelEvaluation(
  options: ModelEvaluationRunOptions,
): Promise<ModelEvaluationManifest> {
  const budgetMode = validateControls(options.controls);
  const candidateEncodings = [
    ...new Set(options.candidateEncodings ?? availableCandidateEncodings),
  ].sort();
  const prepared = await prepareModelEvaluationCases(options.corpus, candidateEncodings);
  const randomized = shuffled(prepared.cases, options.controls.randomSeed);
  const fixtureInputs = options.corpus.map((item) => ({
    path: item.caseId,
    textDigest: sha256Text(item.jsonText),
  }));
  const provenance = collectEvaluationProvenance(
    fixtureInputs,
    options.benchmark,
    options.baseDirectory,
  );
  const effectiveRequestCap = Math.min(
    options.controls.maxRequests,
    options.controls.approvedCallCap ?? options.controls.maxRequests,
  );
  const warnings: string[] = [];
  let providerRequests = 0;
  let reservedCost = 0;
  let spentCost = 0;
  let usedConservativeCost = false;
  let nextTrial = 0;
  const results = new Map<string, ModelEvaluationTrialResult>();

  const claimRequest = (
    item: ModelEvaluationCase,
  ): { readonly allowed: boolean; readonly reserve: number; readonly reason: string } => {
    if (providerRequests >= effectiveRequestCap) {
      return { allowed: false, reserve: 0, reason: "REQUEST_CAP_REACHED" };
    }
    const reserve = reservedRequestCost(item, options.controls);
    if (
      budgetMode === "cost-cap" &&
      spentCost + reservedCost + reserve > (options.controls.maxCost ?? 0) + Number.EPSILON
    ) {
      return { allowed: false, reserve: 0, reason: "COST_CAP_REACHED" };
    }
    providerRequests += 1;
    reservedCost += reserve;
    return { allowed: true, reserve, reason: "" };
  };

  const releaseReservation = (
    reservation: number,
    response: ModelEvaluatorResponse,
  ): { readonly cost?: number; readonly basis?: ModelEvaluationAttempt["costBasis"] } => {
    reservedCost -= reservation;
    const pricing = options.controls.pricingProfile;
    if (pricing === undefined) return {};
    if (response.usage === undefined) {
      spentCost += reservation;
      usedConservativeCost = true;
      return { cost: reservation, basis: "conservative-reservation" };
    }
    const actual = requestCost(response.usage.inputTokens, response.usage.outputTokens, pricing);
    spentCost += actual;
    if (actual > reservation + Number.EPSILON) {
      warnings.push(
        "Provider-reported usage exceeded the pricing profile's reserved maximum for a request.",
      );
    }
    return { cost: actual, basis: "provider-usage" };
  };

  const runTrial = async (item: ModelEvaluationCase): Promise<ModelEvaluationTrialResult> => {
    const attempts: ModelEvaluationAttempt[] = [];
    let terminalResponse: ModelEvaluatorResponse | undefined;
    let blockedRetryReason: string | undefined;
    for (let attempt = 1; attempt <= options.controls.maxRetries + 1; attempt += 1) {
      const claim = claimRequest(item);
      if (!claim.allowed) {
        if (attempts.length === 0) return notRunTrial(item, claim.reason);
        blockedRetryReason = claim.reason;
        break;
      }
      const invocation = await invokeEvaluator(
        options.evaluator as ModelEvaluator,
        item,
        options.controls,
        attempt,
      );
      const cost = releaseReservation(claim.reserve, invocation.response);
      terminalResponse = invocation.response;
      attempts.push({
        attempt,
        status: invocation.response.status,
        latencyMs: invocation.latencyMs,
        ...(invocation.response.usage === undefined ? {} : { usage: invocation.response.usage }),
        ...(cost.cost === undefined || cost.basis === undefined
          ? {}
          : { cost: cost.cost, costBasis: cost.basis }),
        ...(invocation.response.providerModelId === undefined
          ? {}
          : { providerModelId: invocation.response.providerModelId }),
        ...(invocation.response.providerModelRevision === undefined
          ? {}
          : { providerModelRevision: invocation.response.providerModelRevision }),
        ...(invocation.response.finishReason === undefined
          ? {}
          : { finishReason: invocation.response.finishReason }),
        ...(invocation.response.errorCode === undefined
          ? {}
          : { errorCode: invocation.response.errorCode }),
        ...(invocation.response.refusalCode === undefined
          ? {}
          : { refusalCode: invocation.response.refusalCode }),
        retryable: invocation.response.retryable === true,
      });
      if (invocation.response.status !== "failed" || invocation.response.retryable !== true) break;
    }
    if (terminalResponse === undefined) return notRunTrial(item, blockedRetryReason ?? "NOT_RUN");
    const hasOutput = Object.hasOwn(terminalResponse, "output");
    const validOutput =
      terminalResponse.status === "completed" &&
      hasOutput &&
      terminalResponse.validOutput !== false;
    const exactMatch = validOutput && exactJsonMatch(item.expectedAnswer, terminalResponse.output);
    const outputDigest = hasOutput
      ? (() => {
          try {
            return sha256Text(canonicalJsonText(terminalResponse.output));
          } catch {
            return undefined;
          }
        })()
      : undefined;
    const status = terminalResponse.status === "completed" ? "measured" : terminalResponse.status;
    return {
      trialId: item.trialId,
      pairId: item.pairId,
      datasetId: item.datasetId,
      caseId: item.caseId,
      taskId: item.taskId,
      taskFamily: item.taskFamily,
      dataFamily: item.dataFamily,
      ...(item.dataVariant === undefined ? {} : { dataVariant: item.dataVariant }),
      size: item.size,
      representationRole: item.representationRole,
      encoding: item.encoding,
      planId: item.planId,
      renderedContextDigest: item.renderedContextDigest,
      promptTokens: item.promptTokens,
      status,
      validOutput,
      exactMatch,
      includedInAccuracyDenominator: true,
      ...(outputDigest === undefined ? {} : { outputDigest }),
      ...(options.controls.recordOutputs === true && hasOutput
        ? { output: terminalResponse.output }
        : {}),
      attempts,
      ...(blockedRetryReason === undefined
        ? {}
        : { reasonCode: `RETRY_BLOCKED_${blockedRetryReason}` }),
    };
  };

  if (options.evaluator === undefined) {
    for (const item of randomized)
      results.set(item.trialId, notRunTrial(item, "PROVIDER_NOT_CONFIGURED"));
  } else {
    const workerCount = Math.min(options.controls.concurrency, Math.max(1, randomized.length));
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (true) {
          const index = nextTrial;
          nextTrial += 1;
          const item = randomized[index];
          if (item === undefined) return;
          results.set(item.trialId, await runTrial(item));
        }
      }),
    );
  }

  const trials = randomized.map(
    (item) => results.get(item.trialId) ?? notRunTrial(item, "INTERNAL_NOT_RUN"),
  );
  const attemptedTrials = trials.filter((item) => item.includedInAccuracyDenominator).length;
  const completedTrials = trials.filter((item) => item.status === "measured").length;
  const failedTrials = trials.filter((item) => item.status === "failed").length;
  const refusedTrials = trials.filter((item) => item.status === "refused").length;
  const truncatedTrials = trials.filter((item) => item.status === "truncated").length;
  const notRunTrials = trials.filter((item) => item.status === "not-run").length;
  const exactMatches = trials.filter((item) => item.exactMatch === true).length;
  const pairs = new Map<string, ModelEvaluationTrialResult[]>();
  for (const trial of trials) {
    const pair = pairs.get(trial.pairId);
    if (pair === undefined) pairs.set(trial.pairId, [trial]);
    else pair.push(trial);
  }
  const pairsWithBothSidesAttempted = [...pairs.values()].filter(
    (pair) => pair.length === 2 && pair.every((item) => item.includedInAccuracyDenominator),
  ).length;
  const uniqueTasks = new Set(
    options.corpus.flatMap((dataset) =>
      dataset.tasks.map((task) => `${dataset.caseId}:${task.taskId}`),
    ),
  );
  const aggregates = [
    ...aggregate(trials, "encoding", (item) => item.encoding),
    ...aggregate(trials, "task-family", (item) => item.taskFamily),
    ...aggregate(trials, "data-family", (item) => item.dataFamily),
  ];
  const retries = trials.reduce((sum, item) => sum + Math.max(0, item.attempts.length - 1), 0);
  const runStatus: ModelEvaluationManifest["runStatus"] =
    attemptedTrials === 0 ? "not-run" : notRunTrials === 0 ? "complete" : "partial";
  const manifestWithoutDigest = {
    manifestVersion: "morph-model-evaluation/1" as const,
    generatedAt: new Date().toISOString(),
    runStatus,
    modelQuality: attemptedTrials === 0 ? ("not-run" as const) : ("measured-unqualified" as const),
    evaluatorId: options.evaluator?.id ?? null,
    provenance,
    tokenizer: {
      id: prepared.tokenizer.id,
      revision: prepared.tokenizer.revision,
      scope: "rendered-text" as const,
    },
    settings: {
      providerId: options.controls.providerId,
      randomSeed: options.controls.randomSeed,
      maxRequests: options.controls.maxRequests,
      effectiveRequestCap,
      concurrency: options.controls.concurrency,
      maxRetries: options.controls.maxRetries,
      maxOutputTokens: options.controls.maxOutputTokens,
      requestTimeoutMs: options.controls.requestTimeoutMs,
      budgetMode,
      ...(options.controls.approvedCallCap === undefined
        ? {}
        : { approvedCallCap: options.controls.approvedCallCap }),
      ...(options.controls.maxCost === undefined ? {} : { maxCost: options.controls.maxCost }),
      ...(options.controls.pricingProfile === undefined
        ? {}
        : { pricingProfile: options.controls.pricingProfile }),
      candidateEncodings,
      recordOutputs: options.controls.recordOutputs === true,
    },
    preparationExclusions: prepared.exclusions,
    randomizedTrialOrder: randomized.map((item) => item.trialId),
    denominators: {
      datasets: options.corpus.length,
      tasks: uniqueTasks.size,
      pairs: pairs.size,
      plannedTrials: trials.length,
      attemptedTrials,
      completedTrials,
      failedTrials,
      refusedTrials,
      truncatedTrials,
      notRunTrials,
      exactMatches,
      accuracyDenominator: attemptedTrials,
      pairsWithBothSidesAttempted,
      providerRequests,
      retries,
    },
    ...(options.controls.pricingProfile === undefined
      ? {}
      : {
          cost: {
            amount: spentCost,
            currency: options.controls.pricingProfile.currency,
            basis: usedConservativeCost
              ? ("mixed-conservative" as const)
              : ("provider-usage" as const),
          },
        }),
    aggregates,
    trials,
    warnings: [...new Set(warnings)],
  };
  return {
    ...manifestWithoutDigest,
    manifestDigest: sha256Text(canonicalJsonText(manifestWithoutDigest)),
  };
}

export function renderModelEvaluationReport(manifest: ModelEvaluationManifest): string {
  const denominator = manifest.denominators.accuracyDenominator;
  const rate =
    denominator === 0
      ? "not measured"
      : `${((manifest.denominators.exactMatches / denominator) * 100).toFixed(2)}%`;
  const observedModels = new Set(
    manifest.trials.flatMap((trial) =>
      trial.attempts.flatMap((attempt) =>
        attempt.providerModelId === undefined
          ? []
          : [
              `${attempt.providerModelId}${
                attempt.providerModelRevision === undefined
                  ? ""
                  : ` (${attempt.providerModelRevision})`
              }`,
            ],
      ),
    ),
  );
  const lines = [
    "# MORPH model evaluation report",
    "",
    `Generated: ${manifest.generatedAt}`,
    `Run status: ${manifest.runStatus}`,
    `Model quality: ${manifest.modelQuality}`,
    `Provider: ${manifest.settings.providerId}`,
    `Evaluator: ${manifest.evaluatorId ?? "not configured"}`,
    `Observed model identities: ${observedModels.size === 0 ? "not reported" : [...observedModels].join(", ")}`,
    `Benchmark manifest: ${manifest.provenance.benchmark.benchmarkManifestVersion}`,
    `Fixture version: ${manifest.provenance.benchmark.fixtureVersion}`,
    `Git commit: ${manifest.provenance.git.commit ?? "unavailable"}`,
    `Git dirty: ${manifest.provenance.git.dirty === null ? "unknown" : String(manifest.provenance.git.dirty)}`,
    `Randomization seed: ${manifest.settings.randomSeed}`,
    "",
    "## Denominators",
    "",
    `Planned trials: ${manifest.denominators.plannedTrials}`,
    `Attempted trials: ${manifest.denominators.attemptedTrials}`,
    `Exact matches: ${manifest.denominators.exactMatches}/${denominator} (${rate})`,
    `Failures: ${manifest.denominators.failedTrials}`,
    `Refusals: ${manifest.denominators.refusedTrials}`,
    `Truncations: ${manifest.denominators.truncatedTrials}`,
    `Not run: ${manifest.denominators.notRunTrials}`,
    `Matched pairs with both sides attempted: ${manifest.denominators.pairsWithBothSidesAttempted}/${manifest.denominators.pairs}`,
    `Provider requests including retries: ${manifest.denominators.providerRequests}`,
    "",
    "## Results by encoding, task family, and data family",
    "",
    "| Dimension | Key | Exact matches | Accuracy denominator | Exact match rate | Failures | Refusals | Truncations | Not run |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|",
    ...manifest.aggregates.map(
      (row) =>
        `| ${row.dimension} | ${row.key.replaceAll("|", "\\|")} | ${row.exactMatches} | ${row.attempted} | ${
          row.exactMatchRate === null ? "not measured" : `${(row.exactMatchRate * 100).toFixed(2)}%`
        } | ${row.failures} | ${row.refusals} | ${row.truncations} | ${row.notRun} |`,
    ),
    "",
    "Failures, refusals, truncations, and invalid outputs remain in the accuracy denominator after a provider request is made.",
    "This report does not qualify an encoding. Qualification requires the configured paired uncertainty gate on suitable held-out datasets.",
  ];
  if (manifest.cost !== undefined) {
    lines.splice(
      lines.length - 2,
      0,
      `Recorded cost: ${manifest.cost.amount.toFixed(6)} ${manifest.cost.currency} (${manifest.cost.basis})`,
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}

export const modelEvaluationCandidateEncodings = availableCandidateEncodings;
