export type ClassifiedAccessPattern =
  | "unknown"
  | "entity-lookup"
  | "multi-entity-comparison"
  | "aggregation"
  | "filtering"
  | "nested-path-lookup"
  | "sequence-analysis";

export const JEV_ACCESS_PATTERN_CHOICES = [
  "entity_lookup",
  "multi_entity_comparison",
  "aggregation",
  "filtering",
  "nested_path_lookup",
  "sequence_analysis",
  "unknown",
] as const;

export type JevAccessPatternChoice = (typeof JEV_ACCESS_PATTERN_CHOICES)[number];

export type JevProbabilities = Readonly<Record<JevAccessPatternChoice, number>>;

export interface JevCoarseShapeStatistics {
  readonly rootKind: "null" | "boolean" | "string" | "number" | "array" | "object";
  readonly totalNodes?: number;
  readonly maxDepth?: number;
  readonly objectCount?: number;
  readonly arrayCount?: number;
  readonly recordArrayCount?: number;
  readonly largestRecordCount?: number;
  readonly uniformRecordArrayCount?: number;
  readonly hasSparseRecords?: boolean;
}

export interface AccessPatternClassificationRequest {
  readonly taskInstruction: string;
  readonly shape?: JevCoarseShapeStatistics;
  readonly allowNetwork: boolean;
  readonly allowRemoteTaskDisclosure: boolean;
  readonly signal?: AbortSignal;
}

export interface JevTokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export type JevFallbackReason =
  | "adapter-disabled"
  | "network-disabled"
  | "remote-task-disclosure-disabled"
  | "missing-credential"
  | "invalid-configuration"
  | "invalid-input"
  | "request-timeout"
  | "cancelled"
  | "network-error"
  | "service-error"
  | "malformed-response";

export interface JevFallbackClassification {
  readonly status: "fallback";
  readonly source: "deterministic-fallback";
  readonly accessPattern: "unknown";
  readonly reason: JevFallbackReason;
  readonly diagnosticCode: string;
  readonly httpStatus?: number;
}

export interface JevRemoteClassificationBase {
  readonly source: "jev";
  readonly accessPattern: ClassifiedAccessPattern;
  readonly requestedModel: string;
  readonly resolvedModel: string;
  readonly probabilities: JevProbabilities;
  readonly confidence: number;
  readonly latencyMs: number;
  readonly usage: JevTokenUsage;
}

export interface JevAcceptedClassification extends JevRemoteClassificationBase {
  readonly status: "classified";
  readonly reason: "accepted";
  readonly accessPattern: Exclude<ClassifiedAccessPattern, "unknown">;
}

export interface JevAbstainedClassification extends JevRemoteClassificationBase {
  readonly status: "abstained";
  readonly accessPattern: "unknown";
  readonly reason: "low-confidence" | "model-selected-unknown";
  readonly proposedAccessPattern: ClassifiedAccessPattern;
}

export type AccessPatternClassification =
  | JevFallbackClassification
  | JevAcceptedClassification
  | JevAbstainedClassification;

export interface AccessPatternClassifier {
  classify(request: AccessPatternClassificationRequest): Promise<AccessPatternClassification>;
}

export interface JevHttpAccessPatternClassifierOptions {
  readonly apiKey?: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly minimumConfidence?: number;
  readonly probabilityTolerance?: number;
  readonly maxTaskBytes?: number;
  readonly maxResponseBytes?: number;
  readonly fetchImplementation?: typeof fetch;
  readonly now?: () => number;
}
