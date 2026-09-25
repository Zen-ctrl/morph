export type JsonPrimitive = null | boolean | string | number;

export type IRNode =
  | { readonly kind: "null" }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "number"; readonly lexeme: string }
  | { readonly kind: "array"; readonly items: readonly IRNode[] }
  | {
      readonly kind: "object";
      readonly entries: readonly (readonly [string, IRNode])[];
    };

export interface MorphIR {
  readonly irVersion: "morph-ir/1";
  readonly root: IRNode;
  readonly inputKind: "json-text" | "js-value";
  readonly semanticDigest: string;
}

export type AccessPattern =
  | "unknown"
  | "entity-lookup"
  | "multi-entity-comparison"
  | "aggregation"
  | "filtering"
  | "nested-path-lookup"
  | "sequence-analysis";

export type PlannerPolicy = "compatibility" | "economy-experimental" | "validated";

export interface MorphTask {
  readonly instruction: string;
  readonly accessPattern?: AccessPattern;
  readonly relevantPaths?: readonly string[];
  readonly preserveReadableLabels?: boolean;
}

export interface TargetProfile {
  readonly profileId: string;
  readonly tokenizerId: string;
  readonly tokenizerRevision: string;
  readonly modelId?: string;
  readonly modelRevision?: string;
  readonly providerId?: string;
  readonly contextWindowTokens?: number;
}

export interface MorphConstraints {
  readonly mode: "lossless";
  readonly maxPromptTokens?: number;
  readonly reservedOutputTokens?: number;
  readonly maxInputBytes?: number;
  readonly maxDepth?: number;
  readonly maxNodes?: number;
  readonly maxCandidates?: number;
  readonly maxRenderedBytes?: number;
  readonly maxPlanningMs?: number;
  readonly allowNetwork?: boolean;
}

export interface PlannerOptions {
  readonly policy: PlannerPolicy;
  readonly objective: "prompt-tokens" | "estimated-request-cost";
  readonly allowedEncodings?: readonly string[];
  readonly forcedEncoding?: string;
  readonly allowExperimentalTransforms?: boolean;
  readonly qualityProfileId?: string;
  readonly pricingProfileId?: string;
  readonly minimumSavingsTokens?: number;
  readonly minimumSavingsFraction?: number;
}

export interface MorphRequest {
  readonly data:
    | { readonly kind: "json-text"; readonly text: string }
    | { readonly kind: "js-value"; readonly value: unknown };
  readonly schema?: unknown;
  readonly task: MorphTask;
  readonly target: TargetProfile;
  readonly constraints: MorphConstraints;
  readonly planner: PlannerOptions;
  readonly context?: {
    readonly prefix: string;
    readonly suffix: string;
  };
}

export interface TokenMeasurement {
  readonly count: number;
  readonly tokenizerId: string;
  readonly tokenizerRevision: string;
  readonly textDigest: string;
  readonly scope: "rendered-text" | "provider-request";
  readonly certainty: "exact-for-tokenizer" | "provider-reported" | "estimate";
  readonly assumptions: readonly string[];
}

export interface QualityEvidence {
  readonly status: "unknown" | "insufficient" | "qualified" | "failed";
  readonly profileId?: string;
  readonly taskFamily?: string;
  readonly baselineEncoding: "json-compact";
  readonly pairedAccuracyDelta?: number;
  readonly lowerConfidenceBound?: number;
  readonly upperConfidenceBound?: number;
  readonly uniqueCaseCount?: number;
  readonly independentDatasetCount?: number;
  readonly evidenceDigest?: string;
}

export interface QualityProfile {
  readonly profileId: string;
  readonly encoding: string;
  readonly formatVersion: string;
  readonly targetProfileId: string;
  readonly tokenizerId: string;
  readonly tokenizerRevision: string;
  readonly modelId: string;
  readonly modelRevision: string;
  readonly guideVersion: string;
  readonly rendererVersion: "morph-prompt/1";
  readonly planOptionsDigest: string;
  readonly taskFamily: AccessPattern;
  readonly benchmarkProvenance: string;
  readonly datasetCharacteristics: Readonly<Record<string, unknown>>;
  readonly answerSchemaDigest: string;
  readonly evaluationMetric: string;
  readonly allowedRegression: number;
  readonly evidence: QualityEvidence;
  readonly expiresAt?: string;
}

export interface MorphError {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface EncoderApplicability {
  readonly supported: boolean;
  readonly reasons: readonly string[];
}

export interface EncoderPlan {
  readonly encoding: string;
  readonly formatVersion: string;
  readonly options: Readonly<Record<string, unknown>>;
}

export interface EncodedSection {
  readonly encoding: string;
  readonly formatVersion: string;
  readonly payload: string;
  readonly layoutMetadata: Readonly<Record<string, unknown>>;
  readonly interpretationGuideId: string;
}

export interface MorphEncoder {
  readonly id: string;
  readonly formatVersion: string;
  readonly interpretationGuideId: string;
  readonly interpretationGuideVersion: string;
  readonly interpretationGuideText: string;
  readonly mechanismCount: number;
  supports(ir: MorphIR, plan: EncoderPlan): EncoderApplicability;
  enumerate(ir: MorphIR, hints: MorphTask): readonly EncoderPlan[];
  encode(ir: MorphIR, plan: EncoderPlan): EncodedSection;
  decode(section: EncodedSection): MorphIR;
}

export interface TokenizerAdapter {
  readonly id: string;
  readonly revision: string;
  readonly vocabulary: string;
  readonly normalization: string;
  readonly specialTokenPolicy: string;
  readonly implementation: string;
  countText(text: string): number;
  tokenIds?(text: string): readonly number[];
}

export interface CandidateReport {
  readonly planId: string;
  readonly encoding: string;
  readonly formatVersion: string;
  readonly options: Readonly<Record<string, unknown>>;
  readonly selected: boolean;
  readonly applicable: boolean;
  readonly roundTrip: "passed" | "failed" | "not-run";
  readonly dependencies: "complete" | "incomplete" | "not-run";
  readonly tokens?: TokenMeasurement;
  readonly savingsTokens?: number;
  readonly savingsFraction?: number;
  readonly quality: QualityEvidence;
  readonly eligible: boolean;
  readonly reasonCodes: readonly string[];
  readonly elapsedMs?: number;
}

export interface ExplainReport {
  readonly reportVersion: "morph-explain/1";
  readonly completedSearch: boolean;
  readonly baselinePlanId: string;
  readonly selectedPlanId?: string;
  readonly policy: PlannerPolicy;
  readonly candidates: readonly CandidateReport[];
  readonly warnings: readonly string[];
  readonly resourceSummary: Readonly<Record<string, number>>;
}

export interface MorphArtifact {
  readonly artifactVersion: "morph-artifact/1";
  readonly artifactId: string;
  readonly inputSemanticDigest: string;
  readonly inputKind: "json-text" | "js-value";
  readonly plan: {
    readonly encoding: string;
    readonly formatVersion: string;
    readonly options: Readonly<Record<string, unknown>>;
    readonly plannerPolicy: PlannerPolicy;
  };
  readonly section: EncodedSection;
  readonly modelDependencies: {
    readonly schema?: unknown;
    readonly dictionaries?: readonly unknown[];
    readonly interpretationGuideId: string;
    readonly interpretationGuideVersion: string;
    readonly interpretationGuideText: string;
  };
  readonly dependencyMode: "self-contained";
  readonly target: TargetProfile;
  readonly requestFrame: {
    readonly task: MorphTask;
    readonly prefix: string;
    readonly suffix: string;
    readonly templateVersion: string;
  };
  readonly integrity: {
    readonly payloadDigest: string;
    readonly dependenciesDigest: string;
    readonly algorithm: "sha256";
    readonly canonicalizationVersion: "morph-c14n/1";
  };
}

export interface ModelContext {
  readonly format: "morph-context/1";
  readonly interpretationGuide: string;
  readonly dataBlock: string;
  readonly selfContainedBundle: string;
  readonly rendered: string;
  readonly renderedDigest: string;
}

export interface ParsedModelContext {
  readonly format: "morph-context/1";
  readonly section: EncodedSection;
  readonly schema?: unknown;
  readonly interpretationGuideId: string;
  readonly interpretationGuideVersion: string;
  readonly interpretationGuideText: string;
  readonly inputKind: "json-text" | "js-value";
  readonly inputSemanticDigest: string;
}

export interface VerificationReport {
  readonly valid: boolean;
  readonly checksum: "passed" | "failed" | "not-run";
  readonly dependencies: "complete" | "incomplete";
  readonly semanticRoundTrip: "passed" | "failed" | "not-run";
  readonly errors: readonly MorphError[];
}

export interface ComparisonReport extends ExplainReport {
  readonly inputSemanticDigest?: string;
}

export type CompileResult =
  | { readonly ok: true; readonly artifact: MorphArtifact; readonly report: ExplainReport }
  | { readonly ok: false; readonly error: MorphError; readonly report?: ExplainReport };

export interface MorphRegistry {
  readonly encoders: readonly MorphEncoder[];
  readonly tokenizers: readonly TokenizerAdapter[];
  readonly targetProfiles: readonly TargetProfile[];
  readonly qualityProfiles?: readonly QualityProfile[];
}

export interface MorphOptions {
  readonly defaultConstraints?: Partial<MorphConstraints>;
  readonly signal?: AbortSignal;
  readonly encoderFailureMode?: "throw" | "quarantine";
}

export interface MorphCompiler {
  compile(request: MorphRequest): Promise<CompileResult>;
  compileJson(text: string, options: Omit<MorphRequest, "data">): Promise<CompileResult>;
  compileValue(value: unknown, options: Omit<MorphRequest, "data">): Promise<CompileResult>;
  compare(request: MorphRequest): Promise<ComparisonReport>;
  decode(artifact: MorphArtifact): MorphIR;
  decodeJson(artifact: MorphArtifact): string;
  renderModelContext(artifact: MorphArtifact): ModelContext;
  verify(artifact: MorphArtifact): VerificationReport;
}

export interface ParseLimits {
  readonly maxInputBytes: number;
  readonly maxDepth: number;
  readonly maxNodes: number;
}

export interface ShapeProfile {
  readonly rootKind: IRNode["kind"];
  readonly totalNodes: number;
  readonly maxDepth: number;
  readonly objectCount: number;
  readonly arrayCount: number;
  readonly stringCount: number;
  readonly numberCount: number;
  readonly booleanCount: number;
  readonly nullCount: number;
  readonly totalStringCodePoints: number;
  readonly repeatedScalarCount: number;
  readonly cappedScalarCardinality: number;
  readonly untrackedScalarCount: number;
  readonly scalarCardinalityCapped: boolean;
  readonly recordArrays: readonly RecordArrayProfile[];
  readonly exact: boolean;
}

export interface RecordArrayProfile {
  readonly path: string;
  readonly recordCount: number;
  readonly fieldUnion: readonly string[];
  readonly fieldIntersection: readonly string[];
  readonly uniformKeySet: boolean;
  readonly primitiveCellsOnly: boolean;
  readonly observedTypes: Readonly<Record<string, readonly IRNode["kind"][]>>;
  readonly missingKeyCounts: Readonly<Record<string, number>>;
  readonly nullCounts: Readonly<Record<string, number>>;
}

export interface ProfileOptions {
  readonly maxScalarCardinality?: number;
}
