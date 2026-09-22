import { createArtifact, verifyArtifactIntegrity } from "./artifact.js";
import { sha256Text } from "./canonical.js";
import { fail, MorphException, morphError, toMorphError } from "./errors.js";
import { parseModelContext, renderArtifactModelContext } from "./framing.js";
import { fromJsValue, parseJsonStrict, printJson, semanticEqual } from "./ir.js";
import { profileIR } from "./profile.js";
import { canonicalJsonText, validateSchemaInstance } from "./schema.js";
import type {
  CandidateReport,
  ComparisonReport,
  CompileResult,
  EncoderPlan,
  ExplainReport,
  ModelContext,
  MorphArtifact,
  MorphCompiler,
  MorphEncoder,
  MorphIR,
  MorphOptions,
  MorphRegistry,
  MorphRequest,
  QualityEvidence,
  QualityProfile,
  TargetProfile,
  TokenizerAdapter,
  VerificationReport,
} from "./types.js";
import { validateRequest } from "./validation.js";

interface EvaluatedCandidate {
  readonly report: CandidateReport;
  readonly artifact?: MorphArtifact;
  readonly mechanismCount: number;
}

interface PipelineResult {
  readonly report: ExplainReport;
  readonly selectedArtifact?: MorphArtifact;
  readonly fatalError?: ReturnType<typeof morphError>;
  readonly inputSemanticDigest?: string;
}

const MAX_RETAINED_CANDIDATE_BUFFERS = 8;

const UNKNOWN_QUALITY: QualityEvidence = {
  status: "unknown",
  baselineEncoding: "json-compact",
};

function now(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function planId(plan: EncoderPlan): string {
  return `${plan.encoding}@${plan.formatVersion}:${sha256Text(canonicalJsonText(plan.options)).slice(0, 12)}`;
}

function resolveTarget(registry: MorphRegistry, requested: TargetProfile): TargetProfile {
  const registered = registry.targetProfiles.find(
    (profile) => profile.profileId === requested.profileId,
  );
  if (registered === undefined) {
    fail(
      "UNSUPPORTED_TARGET_PROFILE",
      `Target profile '${requested.profileId}' is not registered.`,
    );
  }
  if (canonicalJsonText(registered) !== canonicalJsonText(requested)) {
    fail(
      "TARGET_PROFILE_MISMATCH",
      "The requested target fields do not match the registered profile with that identifier.",
    );
  }
  return registered;
}

function resolveTokenizer(registry: MorphRegistry, target: TargetProfile): TokenizerAdapter {
  const tokenizer = registry.tokenizers.find(
    (candidate) =>
      candidate.id === target.tokenizerId && candidate.revision === target.tokenizerRevision,
  );
  if (tokenizer === undefined) {
    fail(
      "UNSUPPORTED_TOKENIZER_BINDING",
      `Tokenizer '${target.tokenizerId}' at revision '${target.tokenizerRevision}' is not registered.`,
    );
  }
  return tokenizer;
}

function applicableQuality(
  profiles: readonly QualityProfile[],
  requestedProfileId: string | undefined,
  encoder: MorphEncoder,
  target: TargetProfile,
  plan: EncoderPlan,
  task: MorphRequest["task"],
): { readonly evidence: QualityEvidence; readonly mismatch: boolean } {
  if (requestedProfileId === undefined) return { evidence: UNKNOWN_QUALITY, mismatch: false };
  const profile = profiles.find((candidate) => candidate.profileId === requestedProfileId);
  if (profile === undefined) return { evidence: UNKNOWN_QUALITY, mismatch: true };
  const evidence = profile.evidence;
  const expiresAt = profile.expiresAt === undefined ? undefined : Date.parse(profile.expiresAt);
  const evidenceIsQualified =
    evidence.status === "qualified" &&
    evidence.profileId === profile.profileId &&
    evidence.taskFamily === profile.taskFamily &&
    evidence.baselineEncoding === "json-compact" &&
    typeof evidence.pairedAccuracyDelta === "number" &&
    Number.isFinite(evidence.pairedAccuracyDelta) &&
    typeof evidence.lowerConfidenceBound === "number" &&
    Number.isFinite(evidence.lowerConfidenceBound) &&
    typeof evidence.upperConfidenceBound === "number" &&
    Number.isFinite(evidence.upperConfidenceBound) &&
    evidence.lowerConfidenceBound <= evidence.pairedAccuracyDelta &&
    evidence.pairedAccuracyDelta <= evidence.upperConfidenceBound &&
    evidence.lowerConfidenceBound > -profile.allowedRegression &&
    Number.isSafeInteger(evidence.uniqueCaseCount) &&
    (evidence.uniqueCaseCount ?? 0) > 0 &&
    Number.isSafeInteger(evidence.independentDatasetCount) &&
    (evidence.independentDatasetCount ?? 0) >= 2 &&
    (evidence.independentDatasetCount ?? 0) <= (evidence.uniqueCaseCount ?? 0) &&
    typeof evidence.evidenceDigest === "string" &&
    /^[0-9a-f]{64}$/.test(evidence.evidenceDigest);
  const matches =
    profile.encoding === encoder.id &&
    profile.formatVersion === encoder.formatVersion &&
    profile.targetProfileId === target.profileId &&
    profile.tokenizerId === target.tokenizerId &&
    profile.tokenizerRevision === target.tokenizerRevision &&
    profile.guideVersion === encoder.interpretationGuideVersion &&
    profile.rendererVersion === "morph-prompt/1" &&
    target.modelId !== undefined &&
    target.modelRevision !== undefined &&
    profile.modelId === target.modelId &&
    profile.modelRevision === target.modelRevision &&
    profile.planOptionsDigest === sha256Text(canonicalJsonText(plan.options)) &&
    profile.taskFamily === (task.accessPattern ?? "unknown") &&
    profile.benchmarkProvenance.trim().length > 0 &&
    Object.keys(profile.datasetCharacteristics).length > 0 &&
    /^[0-9a-f]{64}$/.test(profile.answerSchemaDigest) &&
    profile.evaluationMetric.trim().length > 0 &&
    Number.isFinite(profile.allowedRegression) &&
    profile.allowedRegression >= 0 &&
    profile.allowedRegression <= 1 &&
    (expiresAt === undefined || (Number.isFinite(expiresAt) && expiresAt > Date.now())) &&
    evidenceIsQualified;
  return matches
    ? { evidence: profile.evidence, mismatch: false }
    : { evidence: UNKNOWN_QUALITY, mismatch: true };
}

function emptyReport(policy: MorphRequest["planner"]["policy"]): ExplainReport {
  return {
    reportVersion: "morph-explain/1",
    completedSearch: false,
    baselinePlanId: "json-compact@1:unavailable",
    policy,
    candidates: [],
    warnings: [],
    resourceSummary: {},
  };
}

function markSelected(
  candidates: readonly EvaluatedCandidate[],
  selectedPlanId: string | undefined,
  selectionReason: string | undefined,
): readonly CandidateReport[] {
  return candidates.map(({ report }) => ({
    ...report,
    selected: report.planId === selectedPlanId,
    reasonCodes:
      report.planId === selectedPlanId && selectionReason !== undefined
        ? [
            ...report.reasonCodes.filter((reason) => reason !== "ELIGIBLE_FOR_RANKING"),
            selectionReason,
          ]
        : report.reasonCodes,
  }));
}

function withCandidateReason(
  candidate: EvaluatedCandidate,
  reason: string,
  eligible = candidate.report.eligible,
): EvaluatedCandidate {
  const priorReasons = eligible
    ? candidate.report.reasonCodes
    : candidate.report.reasonCodes.filter((item) => item !== "ELIGIBLE_FOR_RANKING");
  return {
    ...candidate,
    report: {
      ...candidate.report,
      eligible,
      reasonCodes: priorReasons.includes(reason) ? priorReasons : [...priorReasons, reason],
    },
  };
}

function compareCandidateRank(left: EvaluatedCandidate, right: EvaluatedCandidate): number {
  const leftTokens = left.report.tokens?.count ?? Number.POSITIVE_INFINITY;
  const rightTokens = right.report.tokens?.count ?? Number.POSITIVE_INFINITY;
  if (leftTokens !== rightTokens) return leftTokens - rightTokens;
  const leftBaseline = left.report.encoding === "json-compact" ? 0 : 1;
  const rightBaseline = right.report.encoding === "json-compact" ? 0 : 1;
  if (leftBaseline !== rightBaseline) return leftBaseline - rightBaseline;
  if (left.mechanismCount !== right.mechanismCount)
    return left.mechanismCount - right.mechanismCount;
  return left.report.planId < right.report.planId
    ? -1
    : left.report.planId > right.report.planId
      ? 1
      : 0;
}

function pruneRetainedArtifacts(candidates: EvaluatedCandidate[]): void {
  const withArtifacts = candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate.artifact !== undefined);
  if (withArtifacts.length <= MAX_RETAINED_CANDIDATE_BUFFERS) return;
  const baseline = withArtifacts.find(
    ({ candidate }) => candidate.report.encoding === "json-compact",
  );
  const remaining = withArtifacts
    .filter(({ index }) => index !== baseline?.index)
    .sort((left, right) => compareCandidateRank(left.candidate, right.candidate));
  const keep = new Set<number>([
    ...(baseline === undefined ? [] : [baseline.index]),
    ...remaining
      .slice(0, MAX_RETAINED_CANDIDATE_BUFFERS - (baseline === undefined ? 0 : 1))
      .map(({ index }) => index),
  ]);
  for (const { candidate, index } of withArtifacts) {
    if (!keep.has(index)) {
      candidates[index] = { report: candidate.report, mechanismCount: candidate.mechanismCount };
    }
  }
}

export function createMorph(registry: MorphRegistry, options: MorphOptions = {}): MorphCompiler {
  const encoderKeys = new Set<string>();
  for (const encoder of registry.encoders) {
    const key = `${encoder.id}@${encoder.formatVersion}`;
    if (encoderKeys.has(key))
      fail("DUPLICATE_ENCODER", `Encoder '${key}' is registered more than once.`);
    encoderKeys.add(key);
  }
  const targetIds = new Set<string>();
  for (const target of registry.targetProfiles) {
    if (targetIds.has(target.profileId)) {
      fail(
        "DUPLICATE_TARGET_PROFILE",
        `Target profile '${target.profileId}' is registered more than once.`,
      );
    }
    targetIds.add(target.profileId);
  }
  const tokenizerKeys = new Set<string>();
  for (const tokenizer of registry.tokenizers) {
    const key = `${tokenizer.id}@${tokenizer.revision}`;
    if (tokenizerKeys.has(key)) {
      fail("DUPLICATE_TOKENIZER", `Tokenizer '${key}' is registered more than once.`);
    }
    tokenizerKeys.add(key);
  }
  const qualityProfileIds = new Set<string>();
  for (const profile of registry.qualityProfiles ?? []) {
    if (qualityProfileIds.has(profile.profileId)) {
      fail(
        "DUPLICATE_QUALITY_PROFILE",
        `Quality profile '${profile.profileId}' is registered more than once.`,
      );
    }
    qualityProfileIds.add(profile.profileId);
  }

  const pipeline = async (originalRequest: MorphRequest): Promise<PipelineResult> => {
    const request: MorphRequest = {
      ...originalRequest,
      constraints: {
        ...options.defaultConstraints,
        ...originalRequest.constraints,
      },
    };
    const start = now();
    if (options.signal?.aborted) {
      return {
        report: emptyReport(originalRequest.planner.policy),
        fatalError: morphError("CANCELLED", "Compilation was cancelled before planning began."),
      };
    }
    const validated = validateRequest(request);
    const constraints = validated.constraints;
    const assertPlanningActive = (): void => {
      if (options.signal?.aborted) {
        fail("CANCELLED", "Compilation was cancelled during planning.");
      }
      if (now() - start >= (constraints.maxPlanningMs ?? 5_000)) {
        fail("PLANNING_TIMEOUT", "Planning exceeded the configured abort limit.");
      }
    };
    assertPlanningActive();
    if (request.planner.objective === "estimated-request-cost") {
      fail(
        "PRICING_PROFILE_REQUIRED",
        "The estimated-request-cost objective requires a registered versioned pricing profile.",
      );
    }
    const target = resolveTarget(registry, request.target);
    if (target.providerId !== undefined && target.contextWindowTokens !== undefined) {
      fail(
        "REQUEST_OVERHEAD_UNKNOWN",
        "A provider context-window budget requires a provider request-counting adapter with known overhead.",
      );
    }
    const tokenizer = resolveTokenizer(registry, target);
    const parseLimits = {
      maxInputBytes: constraints.maxInputBytes ?? 5 * 1024 * 1024,
      maxDepth: constraints.maxDepth ?? 64,
      maxNodes: constraints.maxNodes ?? 250_000,
    };
    const ir =
      request.data.kind === "json-text"
        ? parseJsonStrict(request.data.text, parseLimits)
        : fromJsValue(request.data.value, parseLimits);
    assertPlanningActive();
    validateSchemaInstance(validated.sanitizedSchema, ir);
    assertPlanningActive();
    const profile = profileIR(ir);
    assertPlanningActive();
    const inputBytes = new TextEncoder().encode(printJson(ir)).byteLength;
    const orderedEncoders = [...registry.encoders].sort((left, right) => {
      if (left.id === "json-compact") return -1;
      if (right.id === "json-compact") return 1;
      return registry.encoders.indexOf(left) - registry.encoders.indexOf(right);
    });
    const generated: Array<{ encoder: MorphEncoder; plan: EncoderPlan }> = [];
    for (const encoder of orderedEncoders) {
      for (const plan of encoder.enumerate(ir, request.task)) generated.push({ encoder, plan });
      assertPlanningActive();
    }
    const maxCandidates = constraints.maxCandidates ?? 24;
    const retained = generated.slice(0, maxCandidates);
    const pruned = generated.slice(maxCandidates);
    const evaluated: EvaluatedCandidate[] = [];
    const allowed =
      request.planner.allowedEncodings === undefined
        ? undefined
        : new Set(request.planner.allowedEncodings);

    for (const { encoder, plan } of retained) {
      if (options.signal?.aborted) {
        const baselinePlanId =
          evaluated.find(({ report }) => report.encoding === "json-compact")?.report.planId ??
          "json-compact@1:unavailable";
        return {
          report: {
            reportVersion: "morph-explain/1",
            completedSearch: false,
            baselinePlanId,
            policy: request.planner.policy,
            candidates: evaluated.map(({ report }) => report),
            warnings: ["Compilation was cancelled. No partial winner was selected."],
            resourceSummary: {
              inputBytes,
              totalNodes: profile.totalNodes,
              candidatesGenerated: generated.length,
              candidatesEvaluated: evaluated.length,
              candidatesPruned: pruned.length,
            },
          },
          fatalError: morphError("CANCELLED", "Compilation was cancelled during planning."),
          inputSemanticDigest: ir.semanticDigest,
        };
      }
      if (
        (constraints.maxPlanningMs ?? 5_000) >= 0 &&
        now() - start >= (constraints.maxPlanningMs ?? 5_000)
      ) {
        const baselinePlanId =
          evaluated.find(({ report }) => report.encoding === "json-compact")?.report.planId ??
          "json-compact@1:unavailable";
        return {
          report: {
            reportVersion: "morph-explain/1",
            completedSearch: false,
            baselinePlanId,
            policy: request.planner.policy,
            candidates: evaluated.map(({ report }) => report),
            warnings: [
              "Planning stopped at the configured abort limit. No partial winner was selected.",
            ],
            resourceSummary: {
              inputBytes,
              totalNodes: profile.totalNodes,
              candidatesGenerated: generated.length,
              candidatesEvaluated: evaluated.length,
              candidatesPruned: pruned.length,
            },
          },
          fatalError: morphError(
            "PLANNING_TIMEOUT",
            "Planning exceeded the configured abort limit.",
          ),
          inputSemanticDigest: ir.semanticDigest,
        };
      }
      const candidateStart = now();
      const id = planId(plan);
      const initial = {
        planId: id,
        encoding: plan.encoding,
        formatVersion: plan.formatVersion,
        options: plan.options,
        selected: false,
        applicable: false,
        roundTrip: "not-run" as const,
        dependencies: "not-run" as const,
        quality: UNKNOWN_QUALITY,
        eligible: false,
        reasonCodes: [] as readonly string[],
      };
      if (plan.encoding !== encoder.id || plan.formatVersion !== encoder.formatVersion) {
        evaluated.push({
          report: {
            ...initial,
            reasonCodes: ["INVALID_ENCODER_PLAN"],
            elapsedMs: now() - candidateStart,
          },
          mechanismCount: encoder.mechanismCount,
        });
        continue;
      }
      const applicability = encoder.supports(ir, plan);
      if (!applicability.supported) {
        evaluated.push({
          report: {
            ...initial,
            reasonCodes: ["ENCODER_NOT_APPLICABLE", ...applicability.reasons],
            elapsedMs: now() - candidateStart,
          },
          mechanismCount: encoder.mechanismCount,
        });
        continue;
      }
      try {
        assertPlanningActive();
        const section = encoder.encode(ir, plan);
        assertPlanningActive();
        if (
          new TextEncoder().encode(section.payload).byteLength >
          (constraints.maxRenderedBytes ?? 16 * 1024 * 1024)
        ) {
          evaluated.push({
            report: {
              ...initial,
              applicable: true,
              reasonCodes: ["MAX_RENDERED_BYTES_EXCEEDED"],
              elapsedMs: now() - candidateStart,
            },
            mechanismCount: encoder.mechanismCount,
          });
          continue;
        }
        const directDecoded = encoder.decode(section);
        assertPlanningActive();
        if (!semanticEqual(directDecoded, ir)) {
          if (options.encoderFailureMode !== "quarantine") {
            fail(
              "ROUNDTRIP_FAILED",
              `Encoder '${encoder.id}@${encoder.formatVersion}' failed its direct semantic round trip.`,
            );
          }
          evaluated.push({
            report: {
              ...initial,
              applicable: true,
              roundTrip: "failed",
              reasonCodes: ["ROUNDTRIP_FAILED", "ENCODER_QUARANTINED"],
              elapsedMs: now() - candidateStart,
            },
            mechanismCount: encoder.mechanismCount,
          });
          continue;
        }
        const artifact = createArtifact({
          ir,
          plan,
          section,
          plannerPolicy: request.planner.policy,
          target,
          task: request.task,
          ...(request.context === undefined
            ? {}
            : { prefix: request.context.prefix, suffix: request.context.suffix }),
          ...(validated.sanitizedSchema === undefined ? {} : { schema: validated.sanitizedSchema }),
          guideId: encoder.interpretationGuideId,
          guideVersion: encoder.interpretationGuideVersion,
          guideText: encoder.interpretationGuideText,
        });
        const modelContext = renderArtifactModelContext(artifact);
        assertPlanningActive();
        const renderedBytes = new TextEncoder().encode(modelContext.rendered).byteLength;
        if (renderedBytes > (constraints.maxRenderedBytes ?? 16 * 1024 * 1024)) {
          evaluated.push({
            report: {
              ...initial,
              applicable: true,
              roundTrip: "passed",
              dependencies: "complete",
              reasonCodes: ["MAX_RENDERED_BYTES_EXCEEDED"],
              elapsedMs: now() - candidateStart,
            },
            mechanismCount: encoder.mechanismCount,
          });
          continue;
        }
        const parsed = parseModelContext(modelContext.selfContainedBundle);
        assertPlanningActive();
        if (
          parsed.interpretationGuideText !== encoder.interpretationGuideText ||
          parsed.interpretationGuideId !== encoder.interpretationGuideId ||
          parsed.interpretationGuideVersion !== encoder.interpretationGuideVersion
        ) {
          fail(
            "SELF_CONTAINED_DEPENDENCY_MISMATCH",
            "The rendered guide could not be reconstructed exactly.",
          );
        }
        const bundleDecoded = encoder.decode(parsed.section);
        assertPlanningActive();
        if (
          !semanticEqual(bundleDecoded, ir) ||
          bundleDecoded.semanticDigest !== ir.semanticDigest
        ) {
          if (options.encoderFailureMode !== "quarantine") {
            fail(
              "SELF_CONTAINED_ROUNDTRIP_FAILED",
              `Encoder '${encoder.id}@${encoder.formatVersion}' failed its self-contained semantic round trip.`,
            );
          }
          evaluated.push({
            report: {
              ...initial,
              applicable: true,
              roundTrip: "failed",
              dependencies: "complete",
              reasonCodes: ["SELF_CONTAINED_ROUNDTRIP_FAILED", "ENCODER_QUARANTINED"],
              elapsedMs: now() - candidateStart,
            },
            mechanismCount: encoder.mechanismCount,
          });
          continue;
        }
        const count = tokenizer.countText(modelContext.rendered);
        assertPlanningActive();
        if (!Number.isSafeInteger(count) || count < 0) {
          fail("INVALID_TOKENIZER_RESULT", "The tokenizer returned an invalid count.");
        }
        const tokenMeasurement = {
          count,
          tokenizerId: tokenizer.id,
          tokenizerRevision: tokenizer.revision,
          textDigest: modelContext.renderedDigest,
          scope: "rendered-text" as const,
          certainty: "exact-for-tokenizer" as const,
          assumptions: [
            "Counts the complete visible MORPH-PROMPT/1 text under the selected tokenizer.",
            "Provider message framing, hidden instructions, tools, images, and outputs are excluded.",
          ],
        };
        const qualityResult = applicableQuality(
          registry.qualityProfiles ?? [],
          request.planner.qualityProfileId,
          encoder,
          target,
          plan,
          request.task,
        );
        const reasons: string[] = [];
        let eligible = true;
        if (allowed !== undefined && !allowed.has(plan.encoding)) {
          eligible = false;
          reasons.push("ENCODING_NOT_ALLOWED");
        }
        if (
          request.planner.forcedEncoding !== undefined &&
          request.planner.forcedEncoding !== plan.encoding
        ) {
          eligible = false;
          reasons.push("NOT_FORCED_ENCODING");
        }
        if (qualityResult.mismatch) reasons.push("QUALITY_PROFILE_MISMATCH");
        const isBaseline = plan.encoding === "json-compact";
        if (
          !isBaseline &&
          request.planner.policy !== "economy-experimental" &&
          qualityResult.evidence.status !== "qualified"
        ) {
          eligible = false;
          reasons.push(qualityResult.mismatch ? "QUALITY_PROFILE_MISMATCH" : "QUALITY_UNKNOWN");
        } else if (!isBaseline && qualityResult.evidence.status !== "qualified") {
          reasons.push("QUALITY_UNKNOWN");
        }
        const overBudget =
          (constraints.maxPromptTokens !== undefined && count > constraints.maxPromptTokens) ||
          (target.contextWindowTokens !== undefined &&
            count + (constraints.reservedOutputTokens ?? 0) > target.contextWindowTokens);
        if (overBudget) {
          eligible = false;
          reasons.push("OVER_TOKEN_BUDGET");
        }
        if (eligible) reasons.push("ELIGIBLE_FOR_RANKING");
        evaluated.push({
          report: {
            ...initial,
            applicable: true,
            roundTrip: "passed",
            dependencies: "complete",
            tokens: tokenMeasurement,
            quality: qualityResult.evidence,
            eligible,
            reasonCodes: reasons,
            elapsedMs: now() - candidateStart,
          },
          ...(eligible ? { artifact } : {}),
          mechanismCount: encoder.mechanismCount,
        });
        pruneRetainedArtifacts(evaluated);
      } catch (error) {
        const converted = toMorphError(error, "ENCODER_FAILURE");
        if (converted.code === "CANCELLED" || converted.code === "PLANNING_TIMEOUT") {
          throw new MorphException(converted);
        }
        if (options.encoderFailureMode !== "quarantine") throw new MorphException(converted);
        evaluated.push({
          report: {
            ...initial,
            applicable: true,
            roundTrip: converted.code.includes("ROUNDTRIP") ? "failed" : "not-run",
            reasonCodes: [converted.code, "ENCODER_QUARANTINED"],
            elapsedMs: now() - candidateStart,
          },
          mechanismCount: encoder.mechanismCount,
        });
      }
    }

    for (const { encoder, plan } of pruned) {
      evaluated.push({
        report: {
          planId: planId(plan),
          encoding: plan.encoding,
          formatVersion: plan.formatVersion,
          options: plan.options,
          selected: false,
          applicable: false,
          roundTrip: "not-run",
          dependencies: "not-run",
          quality: UNKNOWN_QUALITY,
          eligible: false,
          reasonCodes: ["CANDIDATE_LIMIT_PRUNED"],
        },
        mechanismCount: encoder.mechanismCount,
      });
    }

    const baselineCandidate = evaluated.find(({ report }) => report.encoding === "json-compact");
    const baseline = baselineCandidate?.report.tokens === undefined ? undefined : baselineCandidate;
    const baselinePlanId = baselineCandidate?.report.planId ?? "json-compact@1:unavailable";
    if (baseline === undefined) {
      const report: ExplainReport = {
        reportVersion: "morph-explain/1",
        completedSearch: true,
        baselinePlanId,
        policy: request.planner.policy,
        candidates: evaluated.map(({ report: candidate }) => candidate),
        warnings: ["The compact JSON baseline could not be measured."],
        resourceSummary: {
          inputBytes,
          totalNodes: profile.totalNodes,
          maxDepth: profile.maxDepth,
          candidatesGenerated: generated.length,
          candidatesEvaluated: retained.length,
          candidatesPruned: pruned.length,
        },
      };
      return {
        report,
        fatalError: baselineCandidate?.report.reasonCodes.includes("MAX_RENDERED_BYTES_EXCEEDED")
          ? morphError(
              "MAX_RENDERED_BYTES_EXCEEDED",
              "The compact JSON baseline could not be completely rendered within the byte limit.",
            )
          : morphError(
              "BASELINE_FAILED",
              "The compact JSON baseline could not be verified and measured.",
            ),
        inputSemanticDigest: ir.semanticDigest,
      };
    }
    const baselineTokens = baseline.report.tokens?.count ?? 0;
    let adjusted = evaluated.map((candidate) => {
      if (candidate.report.tokens === undefined) return candidate;
      const savingsTokens = baselineTokens - candidate.report.tokens.count;
      const savingsFraction =
        baselineTokens === 0
          ? candidate.report.tokens.count === 0
            ? 0
            : -1
          : savingsTokens / baselineTokens;
      return {
        ...candidate,
        report: { ...candidate.report, savingsTokens, savingsFraction },
      };
    });
    const forced = request.planner.forcedEncoding;
    const eligible = adjusted.filter(
      (candidate) => candidate.report.eligible && candidate.artifact !== undefined,
    );
    eligible.sort(compareCandidateRank);
    let selected = eligible[0];
    let selectionReason =
      forced === undefined ? "LOWEST_ELIGIBLE_TOKEN_COUNT" : "CALLER_FORCED_ENCODING";
    if (
      selected !== undefined &&
      selected.report.encoding !== "json-compact" &&
      forced === undefined
    ) {
      const minimumTokens = request.planner.minimumSavingsTokens ?? 16;
      const minimumFraction = request.planner.minimumSavingsFraction ?? 0.02;
      const tokenSavings = selected.report.savingsTokens ?? Number.NEGATIVE_INFINITY;
      const fractionSavings = selected.report.savingsFraction ?? Number.NEGATIVE_INFINITY;
      if (tokenSavings < minimumTokens || fractionSavings < minimumFraction) {
        adjusted = adjusted.map((candidate) =>
          candidate.report.planId === selected?.report.planId
            ? withCandidateReason(candidate, "BELOW_MINIMUM_SAVINGS", false)
            : candidate,
        );
        const baselineEligible = adjusted.find(
          (candidate) =>
            candidate.report.encoding === "json-compact" &&
            candidate.report.eligible &&
            candidate.artifact !== undefined,
        );
        selected = baselineEligible;
        selectionReason = "BASELINE_MINIMUM_SAVINGS";
      }
    }
    if (
      selected?.report.encoding === "json-compact" &&
      request.planner.policy === "compatibility"
    ) {
      selectionReason = "BASELINE_COMPATIBILITY";
    }
    const selectedPlanId = selected?.report.planId;
    const warnings = [
      "Token counts are exact for the selected text tokenizer, not provider request or billing counts.",
      ...(target.modelId === undefined
        ? ["Downstream model quality is unbound for this local tokenizer profile."]
        : []),
      ...(request.planner.policy === "economy-experimental"
        ? ["Experimental selection does not establish downstream model comprehension."]
        : []),
      ...(pruned.length > 0
        ? ["Some generated candidates were pruned by the deterministic candidate cap."]
        : []),
      ...(adjusted.some((candidate) => candidate.report.reasonCodes.includes("ENCODER_QUARANTINED"))
        ? ["One or more encoder failures were quarantined by explicit fail-closed configuration."]
        : []),
    ];
    const report: ExplainReport = {
      reportVersion: "morph-explain/1",
      completedSearch: true,
      baselinePlanId,
      ...(selectedPlanId === undefined ? {} : { selectedPlanId }),
      policy: request.planner.policy,
      candidates: markSelected(adjusted, selectedPlanId, selectionReason),
      warnings,
      resourceSummary: {
        inputBytes,
        totalNodes: profile.totalNodes,
        maxDepth: profile.maxDepth,
        objectCount: profile.objectCount,
        arrayCount: profile.arrayCount,
        recordArrayCount: profile.recordArrays.length,
        candidatesGenerated: generated.length,
        candidatesEvaluated: retained.length,
        candidatesPruned: pruned.length,
        maxRetainedCandidateBuffers: MAX_RETAINED_CANDIDATE_BUFFERS,
      },
    };
    if (selected === undefined || selected.artifact === undefined) {
      const allowedBudgetCandidates = adjusted.filter(
        (candidate) =>
          candidate.report.applicable &&
          candidate.report.roundTrip === "passed" &&
          (allowed === undefined || allowed.has(candidate.report.encoding)) &&
          (forced === undefined || forced === candidate.report.encoding),
      );
      const allOverBudget =
        allowedBudgetCandidates.length > 0 &&
        allowedBudgetCandidates.every((candidate) =>
          candidate.report.reasonCodes.includes("OVER_TOKEN_BUDGET"),
        );
      const smallest = allowedBudgetCandidates
        .map((candidate) => candidate.report.tokens?.count)
        .filter((count): count is number => count !== undefined)
        .sort((left, right) => left - right)[0];
      return {
        report,
        fatalError: allOverBudget
          ? morphError(
              "BUDGET_EXCEEDED",
              "No verified candidate fits the configured token budget.",
              undefined,
              {
                ...(smallest === undefined ? {} : { smallestVerifiedCount: smallest }),
              },
            )
          : morphError(
              "NO_ELIGIBLE_PLAN",
              "No verified candidate is eligible under the requested policy.",
            ),
        inputSemanticDigest: ir.semanticDigest,
      };
    }
    return { report, selectedArtifact: selected.artifact, inputSemanticDigest: ir.semanticDigest };
  };

  const findEncoder = (artifact: MorphArtifact): MorphEncoder => {
    const encoder = registry.encoders.find(
      (candidate) =>
        candidate.id === artifact.plan.encoding &&
        candidate.formatVersion === artifact.plan.formatVersion,
    );
    if (encoder === undefined) {
      fail("ENCODER_NOT_REGISTERED", "The artifact encoder and version are not registered.");
    }
    if (
      artifact.section.encoding !== encoder.id ||
      artifact.section.formatVersion !== encoder.formatVersion ||
      artifact.section.interpretationGuideId !== encoder.interpretationGuideId ||
      artifact.modelDependencies.interpretationGuideId !== encoder.interpretationGuideId ||
      artifact.modelDependencies.interpretationGuideVersion !==
        encoder.interpretationGuideVersion ||
      artifact.modelDependencies.interpretationGuideText !== encoder.interpretationGuideText
    ) {
      fail(
        "ENCODER_DEPENDENCY_MISMATCH",
        "The artifact encoder or trusted interpretation guide does not match the registered implementation.",
      );
    }
    return encoder;
  };

  const decode = (artifact: MorphArtifact): MorphIR => {
    const integrity = verifyArtifactIntegrity(artifact);
    if (!integrity.valid)
      throw new MorphException(
        integrity.errors[0] ?? morphError("ARTIFACT_INVALID", "Artifact verification failed."),
      );
    const encoder = findEncoder(artifact);
    const decoded = encoder.decode(artifact.section);
    if (decoded.semanticDigest !== artifact.inputSemanticDigest) {
      fail(
        "SEMANTIC_DIGEST_MISMATCH",
        "The decoded data does not match the artifact semantic digest.",
      );
    }
    return decoded;
  };

  const renderModelContext = (artifact: MorphArtifact): ModelContext => {
    const integrity = verifyArtifactIntegrity(artifact);
    if (!integrity.valid)
      throw new MorphException(
        integrity.errors[0] ?? morphError("ARTIFACT_INVALID", "Artifact verification failed."),
      );
    findEncoder(artifact);
    return renderArtifactModelContext(artifact);
  };

  const verify = (artifact: MorphArtifact): VerificationReport => {
    let integrity: VerificationReport;
    try {
      integrity = verifyArtifactIntegrity(artifact);
    } catch (error) {
      return {
        valid: false,
        checksum: "not-run",
        dependencies: "incomplete",
        semanticRoundTrip: "not-run",
        errors: [toMorphError(error, "ARTIFACT_INVALID")],
      };
    }
    const errors = [...integrity.errors];
    let semanticRoundTrip: VerificationReport["semanticRoundTrip"] = "not-run";
    if (integrity.valid) {
      try {
        const encoder = findEncoder(artifact);
        const context = renderArtifactModelContext(artifact);
        const parsed = parseModelContext(context.selfContainedBundle);
        const decoded = encoder.decode(parsed.section);
        semanticRoundTrip =
          decoded.semanticDigest === artifact.inputSemanticDigest ? "passed" : "failed";
        if (semanticRoundTrip === "failed") {
          errors.push(
            morphError(
              "SEMANTIC_DIGEST_MISMATCH",
              "The self-contained bundle decodes to different data.",
            ),
          );
        }
      } catch (error) {
        semanticRoundTrip = "failed";
        errors.push(toMorphError(error, "VERIFY_FAILED"));
      }
    }
    return {
      valid: errors.length === 0 && semanticRoundTrip === "passed",
      checksum: integrity.checksum,
      dependencies: integrity.dependencies,
      semanticRoundTrip,
      errors,
    };
  };

  return {
    async compile(request): Promise<CompileResult> {
      try {
        const result = await pipeline(request);
        if (result.fatalError !== undefined || result.selectedArtifact === undefined) {
          return {
            ok: false,
            error: result.fatalError ?? morphError("NO_ELIGIBLE_PLAN", "No plan was selected."),
            report: result.report,
          };
        }
        return { ok: true, artifact: result.selectedArtifact, report: result.report };
      } catch (error) {
        const policy =
          typeof request === "object" &&
          request !== null &&
          typeof (request as { planner?: unknown }).planner === "object" &&
          (request as { planner: { policy?: unknown } }).planner !== null &&
          ["compatibility", "economy-experimental", "validated"].includes(
            String((request as { planner: { policy?: unknown } }).planner.policy),
          )
            ? (request as { planner: { policy: MorphRequest["planner"]["policy"] } }).planner.policy
            : "compatibility";
        return { ok: false, error: toMorphError(error), report: emptyReport(policy) };
      }
    },
    compileJson(text, compileOptions) {
      return this.compile({ ...compileOptions, data: { kind: "json-text", text } });
    },
    compileValue(value, compileOptions) {
      return this.compile({ ...compileOptions, data: { kind: "js-value", value } });
    },
    async compare(request): Promise<ComparisonReport> {
      const result = await pipeline(request);
      return {
        ...result.report,
        ...(result.inputSemanticDigest === undefined
          ? {}
          : { inputSemanticDigest: result.inputSemanticDigest }),
      };
    },
    decode,
    decodeJson(artifact) {
      return printJson(decode(artifact));
    },
    renderModelContext,
    verify,
  };
}
